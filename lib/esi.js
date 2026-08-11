"use strict";

const https = require("https");
const { URL } = require("url");
const { USER_AGENT } = require("./sso");

const ESI_BASE = "https://esi.evetech.net/latest";
const DEFAULT_DATASOURCE = "tranquility";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(method, urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const headers = {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...(options.headers || {}),
    };
    let body = null;
    if (options.body != null) {
      body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          if (text && res.statusCode !== 204) {
            try {
              json = JSON.parse(text);
            } catch (_) {
              json = text;
            }
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
            raw: text,
          });
        });
      },
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

class EsiClient {
  constructor({ accessToken, datasource = DEFAULT_DATASOURCE } = {}) {
    this.accessToken = accessToken || null;
    this.datasource = datasource;
    this.errorLog = [];
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  buildUrl(path, query = {}) {
    const url = new URL(path.startsWith("http") ? path : `${ESI_BASE}${path}`);
    url.searchParams.set("datasource", this.datasource);
    for (const [key, value] of Object.entries(query || {})) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async request(method, path, options = {}) {
    const maxAttempts = options.maxAttempts || 8;
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      const headers = { ...(options.headers || {}) };
      if (this.accessToken && options.auth !== false) {
        headers.Authorization = `Bearer ${this.accessToken}`;
      }
      const url = this.buildUrl(path, options.query);
      const response = await requestJson(method, url, {
        headers,
        body: options.body,
      });

      if (response.statusCode === 420 || response.statusCode === 429) {
        const retryAfter = Number(response.headers["retry-after"] || 5);
        await sleep(Math.max(1, retryAfter) * 1000);
        continue;
      }
      if (response.statusCode >= 500 && attempt < maxAttempts) {
        await sleep(500 * attempt);
        continue;
      }
      return response;
    }
    throw new Error(`ESI request failed after retries: ${method} ${path}`);
  }

  async get(path, options = {}) {
    return this.request("GET", path, options);
  }

  async post(path, body, options = {}) {
    return this.request("POST", path, { ...options, body });
  }

  /**
   * GET with X-Pages pagination. Returns concatenated array.
   */
  async getAllPages(path, options = {}) {
    const first = await this.get(path, { ...options, query: { ...(options.query || {}), page: 1 } });
    if (first.statusCode === 404) {
      return { statusCode: 404, pages: 0, data: [], error: first.body };
    }
    if (first.statusCode < 200 || first.statusCode >= 300) {
      return {
        statusCode: first.statusCode,
        pages: 0,
        data: [],
        error: first.body,
      };
    }
    const pages = Math.max(1, Number(first.headers["x-pages"] || 1));
    const data = Array.isArray(first.body) ? first.body.slice() : [];
    for (let page = 2; page <= pages; page += 1) {
      const res = await this.get(path, {
        ...options,
        query: { ...(options.query || {}), page },
      });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        this.errorLog.push({ path, page, statusCode: res.statusCode, body: res.body });
        break;
      }
      if (Array.isArray(res.body)) {
        data.push(...res.body);
      }
    }
    return { statusCode: 200, pages, data };
  }

  /**
   * Chunked POST helper (ESI max 1000 item ids).
   */
  async postChunked(path, ids, options = {}) {
    const chunkSize = options.chunkSize || 1000;
    const list = Array.isArray(ids) ? ids : [];
    const out = [];
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      const res = await this.post(path, chunk, options);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        this.errorLog.push({ path, statusCode: res.statusCode, body: res.body, chunkSize: chunk.length });
        continue;
      }
      if (Array.isArray(res.body)) {
        out.push(...res.body);
      }
    }
    return out;
  }
}

module.exports = {
  EsiClient,
  ESI_BASE,
  DEFAULT_DATASOURCE,
  sleep,
};
