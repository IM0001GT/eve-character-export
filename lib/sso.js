"use strict";

const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { URL, URLSearchParams } = require("url");
const { CHARACTER_READ_SCOPES } = require("./scopes");

const AUTH_URL = "https://login.eveonline.com/v2/oauth/authorize";
const TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";
const USER_AGENT = "evejs-tq-import/1.0 (local offline import tool)";

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (_) {
    return null;
  }
}

function characterFromAccessToken(accessToken) {
  const claims = decodeJwtPayload(accessToken) || {};
  const sub = String(claims.sub || "");
  const match = sub.match(/CHARACTER:EVE:(\d+)/i);
  const characterID = match ? Number(match[1]) : 0;
  return {
    characterID,
    characterName: claims.name || claims.character_name || null,
    scopes: Array.isArray(claims.scp)
      ? claims.scp
      : typeof claims.scp === "string"
        ? claims.scp.split(" ")
        : [],
    claims,
  };
}

function httpsFormPost(urlString, formBody, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = typeof formBody === "string" ? formBody : new URLSearchParams(formBody).toString();
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": USER_AGENT,
          Host: "login.eveonline.com",
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {
            json = null;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const err = new Error(
              `SSO token error HTTP ${res.statusCode}: ${text.slice(0, 500)}`,
            );
            err.statusCode = res.statusCode;
            err.body = json || text;
            reject(err);
            return;
          }
          resolve(json);
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function exchangeAuthorizationCode(ssoConfig, code, codeVerifier = null) {
  if (ssoConfig.clientSecret) {
    const basic = Buffer.from(
      `${ssoConfig.clientId}:${ssoConfig.clientSecret}`,
      "utf8",
    ).toString("base64");
    return httpsFormPost(
      TOKEN_URL,
      {
        grant_type: "authorization_code",
        code,
      },
      { Authorization: `Basic ${basic}` },
    );
  }

  return httpsFormPost(TOKEN_URL, {
    grant_type: "authorization_code",
    code,
    client_id: ssoConfig.clientId,
    code_verifier: codeVerifier,
  });
}

async function refreshAccessToken(ssoConfig, refreshToken) {
  if (ssoConfig.clientSecret) {
    const basic = Buffer.from(
      `${ssoConfig.clientId}:${ssoConfig.clientSecret}`,
      "utf8",
    ).toString("base64");
    return httpsFormPost(
      TOKEN_URL,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      { Authorization: `Basic ${basic}` },
    );
  }

  return httpsFormPost(TOKEN_URL, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: ssoConfig.clientId,
  });
}

function buildAuthorizeUrl(ssoConfig, scopes = CHARACTER_READ_SCOPES, pkce = null) {
  const state = base64Url(crypto.randomBytes(16));
  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: ssoConfig.callbackUrl,
    client_id: ssoConfig.clientId,
    scope: scopes.join(" "),
    state,
  });
  if (pkce) {
    params.set("code_challenge", pkce.challenge);
    params.set("code_challenge_method", "S256");
  }
  return {
    url: `${AUTH_URL}?${params.toString()}`,
    state,
  };
}

/**
 * Opens a one-shot local HTTP server, prints the login URL, and resolves with
 * tokens when the browser returns.
 */
function authorizeInteractive(ssoConfig, options = {}) {
  const scopes = options.scopes || CHARACTER_READ_SCOPES;
  const usePkce = Boolean(options.usePkce || ssoConfig.usePkce || !ssoConfig.clientSecret);
  const pkce = usePkce ? createPkcePair() : null;
  const { url, state } = buildAuthorizeUrl(ssoConfig, scopes, pkce);
  const callback = new URL(ssoConfig.callbackUrl);
  const port = Number(callback.port || ssoConfig.callbackPort || 8731);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
        if (reqUrl.pathname !== callback.pathname) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }
        const code = reqUrl.searchParams.get("code");
        const returnedState = reqUrl.searchParams.get("state");
        const error = reqUrl.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h1>SSO error</h1><pre>${error}</pre><p>You can close this tab.</p>`);
          server.close();
          reject(new Error(`SSO returned error: ${error}`));
          return;
        }
        if (!code || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h1>Invalid callback</h1><p>State mismatch or missing code.</p>");
          server.close();
          reject(new Error("Invalid SSO callback (state/code)"));
          return;
        }

        const tokenPayload = await exchangeAuthorizationCode(
          ssoConfig,
          code,
          pkce ? pkce.verifier : null,
        );
        const identity = characterFromAccessToken(tokenPayload.access_token);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<h1>Authorized: ${identity.characterName || identity.characterID}</h1>` +
            `<p>You can close this tab and return to the terminal.</p>`,
        );
        server.close();
        resolve({
          ...tokenPayload,
          identity,
          authorizedAt: new Date().toISOString(),
        });
      } catch (error) {
        try {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(String(error.message || error));
        } catch (_) {
          // ignore
        }
        server.close();
        reject(error);
      }
    });

    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      console.log("");
      console.log("Open this URL in a browser and log into EVE Online:");
      console.log("");
      console.log(url);
      console.log("");
      console.log(`Waiting for callback on ${ssoConfig.callbackUrl} ...`);
      console.log("(Select one character on the account. Repeat for each character.)");
    });
  });
}

module.exports = {
  USER_AGENT,
  CHARACTER_READ_SCOPES,
  authorizeInteractive,
  refreshAccessToken,
  characterFromAccessToken,
  decodeJwtPayload,
  buildAuthorizeUrl,
};
