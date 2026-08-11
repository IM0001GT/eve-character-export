"use strict";

const fs = require("fs");
const path = require("path");
const { ensureDir, writeJson, readJson } = require("./config");
const { EsiClient } = require("./esi");
const {
  authorizeInteractive,
  refreshAccessToken,
  characterFromAccessToken,
} = require("./sso");
const {
  DEFAULT_DUMP_ROOT,
  DEFAULT_TOKEN_DIR,
} = require("./paths");

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeName(value) {
  return String(value || "unknown")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unknown";
}

async function saveEndpoint(dir, name, fetcher) {
  const started = Date.now();
  try {
    const result = await fetcher();
    writeJson(path.join(dir, `${name}.json`), {
      ok: true,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      ...result,
    });
    const count = Array.isArray(result.data)
      ? result.data.length
      : result.data != null
        ? 1
        : 0;
    console.log(`    ✓ ${name}${count ? ` (${count})` : ""}`);
    return result;
  } catch (error) {
    writeJson(path.join(dir, `${name}.json`), {
      ok: false,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      error: String(error.message || error),
    });
    console.log(`    ✗ ${name}: ${error.message || error}`);
    return null;
  }
}

async function ensureFreshToken(ssoConfig, tokenRecord) {
  if (!tokenRecord || !tokenRecord.refresh_token) {
    return tokenRecord;
  }
  const expiresAt = Number(tokenRecord.expiresAtMs || 0);
  if (expiresAt > Date.now() + 60_000 && tokenRecord.access_token) {
    return tokenRecord;
  }
  const refreshed = await refreshAccessToken(ssoConfig, tokenRecord.refresh_token);
  const identity =
    characterFromAccessToken(refreshed.access_token) ||
    tokenRecord.identity ||
    {};
  return {
    ...tokenRecord,
    ...refreshed,
    identity,
    expiresAtMs: Date.now() + Number(refreshed.expires_in || 1200) * 1000,
    refreshedAt: new Date().toISOString(),
  };
}

function tokenPathFor(username, characterID) {
  return path.join(
    DEFAULT_TOKEN_DIR,
    safeName(username),
    `${characterID}.json`,
  );
}

function saveToken(username, tokenRecord) {
  const characterID =
    (tokenRecord.identity && tokenRecord.identity.characterID) ||
    tokenRecord.characterID;
  const filePath = tokenPathFor(username, characterID);
  writeJson(filePath, {
    ...tokenRecord,
    // never print secret in logs; file is local-only
  });
  return filePath;
}

async function authorizeCharacter(ssoConfig, username) {
  const tokenPayload = await authorizeInteractive(ssoConfig);
  const record = {
    ...tokenPayload,
    expiresAtMs: Date.now() + Number(tokenPayload.expires_in || 1200) * 1000,
    username,
  };
  const filePath = saveToken(username, record);
  console.log(
    `  Saved token for ${record.identity.characterName} (${record.identity.characterID}) → ${filePath}`,
  );
  return record;
}

/**
 * Full read-only dump of one character into characterDir.
 */
async function dumpCharacter(esi, characterID, characterDir, options = {}) {
  ensureDir(characterDir);
  const meta = {
    characterID,
    startedAt: new Date().toISOString(),
    endpoints: [],
  };

  const simpleGets = [
    ["public", `/characters/${characterID}/`],
    ["corporation_history", `/characters/${characterID}/corporationhistory/`],
    ["portrait", `/characters/${characterID}/portrait/`],
    ["skills", `/characters/${characterID}/skills/`],
    ["skillqueue", `/characters/${characterID}/skillqueue/`],
    ["attributes", `/characters/${characterID}/attributes/`],
    ["location", `/characters/${characterID}/location/`],
    ["ship", `/characters/${characterID}/ship/`],
    ["online", `/characters/${characterID}/online/`],
    ["wallet", `/characters/${characterID}/wallet/`],
    ["clones", `/characters/${characterID}/clones/`],
    ["implants", `/characters/${characterID}/implants/`],
    ["fittings", `/characters/${characterID}/fittings/`],
    ["standings", `/characters/${characterID}/standings/`],
    ["loyalty_points", `/characters/${characterID}/loyalty/points/`],
    ["fatigue", `/characters/${characterID}/fatigue/`],
    ["titles", `/characters/${characterID}/titles/`],
    ["roles", `/characters/${characterID}/roles/`],
    ["medals", `/characters/${characterID}/medals/`],
    ["notifications", `/characters/${characterID}/notifications/`],
    ["notifications_contacts", `/characters/${characterID}/notifications/contacts/`],
    ["agents_research", `/characters/${characterID}/agents_research/`],
    ["industry_jobs", `/characters/${characterID}/industry/jobs/`, { query: { include_completed: true } }],
    ["mining", `/characters/${characterID}/mining/`],
    ["fw_stats", `/characters/${characterID}/fw/stats/`],
    ["fleet", `/characters/${characterID}/fleet/`],
    ["contacts_labels", `/characters/${characterID}/contacts/labels/`],
    ["planets", `/characters/${characterID}/planets/`],
    ["calendar", `/characters/${characterID}/calendar/`],
  ];

  for (const [name, pathName, extra] of simpleGets) {
    await saveEndpoint(characterDir, name, async () => {
      const res = await esi.get(pathName, extra || {});
      return {
        statusCode: res.statusCode,
        data: res.body,
        error: res.statusCode >= 300 ? res.body : null,
      };
    });
    meta.endpoints.push(name);
  }

  // Paginated list endpoints
  const paged = [
    ["assets", `/characters/${characterID}/assets/`],
    ["blueprints", `/characters/${characterID}/blueprints/`],
    ["contacts", `/characters/${characterID}/contacts/`],
    ["contracts", `/characters/${characterID}/contracts/`],
    ["wallet_journal", `/characters/${characterID}/wallet/journal/`],
    ["wallet_transactions", `/characters/${characterID}/wallet/transactions/`],
    ["orders", `/characters/${characterID}/orders/`],
    ["orders_history", `/characters/${characterID}/orders/history/`],
    ["killmails_recent", `/characters/${characterID}/killmails/recent/`],
  ];

  let assets = [];
  for (const [name, pathName] of paged) {
    const result = await saveEndpoint(characterDir, name, async () => {
      const pageResult = await esi.getAllPages(pathName);
      return {
        statusCode: pageResult.statusCode,
        pages: pageResult.pages,
        data: pageResult.data,
        error: pageResult.error || null,
      };
    });
    if (name === "assets" && result && Array.isArray(result.data)) {
      assets = result.data;
    }
    meta.endpoints.push(name);
  }

  // Asset names + locations (chunked)
  const assetIds = assets.map((a) => a.item_id).filter(Boolean);
  await saveEndpoint(characterDir, "asset_names", async () => {
    const data = await esi.postChunked(
      `/characters/${characterID}/assets/names/`,
      assetIds,
    );
    return { statusCode: 200, data };
  });
  meta.endpoints.push("asset_names");

  await saveEndpoint(characterDir, "asset_locations", async () => {
    const data = await esi.postChunked(
      `/characters/${characterID}/assets/locations/`,
      assetIds,
    );
    return { statusCode: 200, data };
  });
  meta.endpoints.push("asset_locations");

  // Mail intentionally skipped — not needed for private-server play and
  // per-message body fetches are slow / can stall large mailboxes.

  // Contracts: items + bids
  const contractsFile = readJson(path.join(characterDir, "contracts.json"), {});
  const contracts = Array.isArray(contractsFile.data) ? contractsFile.data : [];
  const contractDetailsDir = ensureDir(path.join(characterDir, "contracts_detail"));
  for (const contract of contracts) {
    const id = contract.contract_id;
    if (!id) continue;
    const items = await esi.get(`/characters/${characterID}/contracts/${id}/items/`);
    const bids = await esi.get(`/characters/${characterID}/contracts/${id}/bids/`);
    writeJson(path.join(contractDetailsDir, `${id}.json`), {
      contract_id: id,
      items: { statusCode: items.statusCode, data: items.body },
      bids: { statusCode: bids.statusCode, data: bids.body },
    });
  }
  meta.endpoints.push("contracts_detail");
  console.log(`    ✓ contracts_detail (${contracts.length})`);

  // Planets detail
  const planetsFile = readJson(path.join(characterDir, "planets.json"), {});
  const planets = Array.isArray(planetsFile.data) ? planetsFile.data : [];
  const planetsDir = ensureDir(path.join(characterDir, "planets_detail"));
  for (const planet of planets) {
    const planetId = planet.planet_id;
    if (!planetId) continue;
    const res = await esi.get(`/characters/${characterID}/planets/${planetId}/`);
    writeJson(path.join(planetsDir, `${planetId}.json`), {
      planet_id: planetId,
      statusCode: res.statusCode,
      data: res.body,
    });
  }
  meta.endpoints.push("planets_detail");
  console.log(`    ✓ planets_detail (${planets.length})`);

  // Calendar event details
  const calendarFile = readJson(path.join(characterDir, "calendar.json"), {});
  const events = Array.isArray(calendarFile.data) ? calendarFile.data : [];
  const calendarDir = ensureDir(path.join(characterDir, "calendar_detail"));
  for (const event of events) {
    const eventId = event.event_id;
    if (!eventId) continue;
    const detail = await esi.get(`/characters/${characterID}/calendar/${eventId}/`);
    const attendees = await esi.get(
      `/characters/${characterID}/calendar/${eventId}/attendees/`,
    );
    writeJson(path.join(calendarDir, `${eventId}.json`), {
      event_id: eventId,
      detail: { statusCode: detail.statusCode, data: detail.body },
      attendees: { statusCode: attendees.statusCode, data: attendees.body },
    });
  }
  meta.endpoints.push("calendar_detail");
  console.log(`    ✓ calendar_detail (${events.length})`);

  // Killmail details
  const kmFile = readJson(path.join(characterDir, "killmails_recent.json"), {});
  const killmails = Array.isArray(kmFile.data) ? kmFile.data : [];
  const kmDir = ensureDir(path.join(characterDir, "killmails_detail"));
  if (!options.skipKillmailBodies) {
    for (const km of killmails) {
      if (!km.killmail_id || !km.killmail_hash) continue;
      const res = await esi.get(
        `/killmails/${km.killmail_id}/${km.killmail_hash}/`,
        { auth: false },
      );
      writeJson(path.join(kmDir, `${km.killmail_id}.json`), {
        killmail_id: km.killmail_id,
        killmail_hash: km.killmail_hash,
        statusCode: res.statusCode,
        data: res.body,
      });
    }
    console.log(`    ✓ killmails_detail (${killmails.length})`);
  }
  meta.endpoints.push("killmails_detail");

  // Structure metadata for any structure location we saw
  const structureIds = new Set();
  for (const asset of assets) {
    if (asset.location_type === "other" || asset.location_type === "item") {
      // item locations are containers; structure IDs are typically huge "other"
    }
    if (asset.location_type === "other" && asset.location_id) {
      structureIds.add(asset.location_id);
    }
  }
  const locationFile = readJson(path.join(characterDir, "location.json"), {});
  const loc = locationFile && locationFile.data ? locationFile.data : {};
  if (loc.structure_id) structureIds.add(loc.structure_id);
  const clonesFile = readJson(path.join(characterDir, "clones.json"), {});
  const clones = clonesFile && clonesFile.data ? clonesFile.data : {};
  if (clones.home_location && clones.home_location.location_id) {
    if (clones.home_location.location_type === "structure") {
      structureIds.add(clones.home_location.location_id);
    }
  }
  for (const jc of Array.isArray(clones.jump_clones) ? clones.jump_clones : []) {
    if (jc.location_type === "structure" && jc.location_id) {
      structureIds.add(jc.location_id);
    }
  }

  const structuresDir = ensureDir(path.join(characterDir, "structures"));
  for (const structureId of structureIds) {
    const res = await esi.get(`/universe/structures/${structureId}/`);
    writeJson(path.join(structuresDir, `${structureId}.json`), {
      structure_id: structureId,
      statusCode: res.statusCode,
      data: res.body,
    });
  }
  writeJson(path.join(characterDir, "structure_ids.json"), {
    ok: true,
    data: [...structureIds],
  });
  meta.endpoints.push("structures");
  console.log(`    ✓ structures (${structureIds.size})`);

  meta.finishedAt = new Date().toISOString();
  meta.esiErrors = esi.errorLog.slice();
  writeJson(path.join(characterDir, "_meta.json"), meta);
  return meta;
}

/**
 * Dump one or more characters under a username into a timestamped dump folder.
 *
 * @param {object} options
 * @param {string} options.username local account name for the dump / import
 * @param {object} options.ssoConfig
 * @param {string[]} [options.characterTokenFiles] reuse existing token files
 * @param {number} [options.maxCharacters] stop after N characters (interactive)
 */
async function dumpAccount(options) {
  const username = String(options.username || "").trim();
  if (!username) {
    throw new Error("--username is required");
  }
  const ssoConfig = options.ssoConfig;
  if (!ssoConfig || !ssoConfig.clientId) {
    throw new Error(
      "Missing EVE SSO client ID. Run: node tools/tq-import/tq-import.js setup",
    );
  }

  ensureDir(DEFAULT_DUMP_ROOT);
  ensureDir(DEFAULT_TOKEN_DIR);

  const dumpId = options.dumpId || `${safeName(username)}-${stamp()}`;
  const dumpRoot = path.join(DEFAULT_DUMP_ROOT, dumpId);
  ensureDir(dumpRoot);

  const accountManifest = {
    dumpVersion: 1,
    username,
    dumpId,
    dumpRoot,
    createdAt: new Date().toISOString(),
    characters: [],
    fallbackStationID: options.fallbackStationID || 60003760,
  };

  const tokens = [];

  // Load any pre-existing tokens for this username if requested
  if (options.reuseTokens) {
    const tokenDir = path.join(DEFAULT_TOKEN_DIR, safeName(username));
    if (fs.existsSync(tokenDir)) {
      for (const file of fs.readdirSync(tokenDir)) {
        if (!file.endsWith(".json")) continue;
        const record = readJson(path.join(tokenDir, file), null);
        if (record && record.refresh_token) {
          tokens.push(record);
        }
      }
    }
  }

  if (options.characterTokenFiles) {
    for (const file of options.characterTokenFiles) {
      const record = readJson(file, null);
      if (record) tokens.push(record);
    }
  }

  const maxCharacters = Number(options.maxCharacters || 0) || 0;
  const interactive = options.interactive !== false;

  // Interactive auth loop
  if (interactive) {
    console.log(`\nDump target: ${dumpRoot}`);
    console.log(`Local username for this TQ account: ${username}`);
    console.log(
      "Authorize each character on this EVE account (one browser login per character).",
    );

    // Always offer at least one auth if we have no tokens
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (tokens.length > 0) {
        console.log(`\nCharacters authorized so far: ${tokens.length}`);
        for (const t of tokens) {
          const id = t.identity || characterFromAccessToken(t.access_token);
          console.log(`  - ${id.characterName || "?"} (${id.characterID})`);
        }
      }

      if (maxCharacters > 0 && tokens.length >= maxCharacters) {
        break;
      }

      const shouldAuth =
        tokens.length === 0 ||
        (await askYesNo(
          tokens.length === 0
            ? "Authorize first character now?"
            : "Authorize another character on this account?",
          tokens.length === 0,
        ));

      if (!shouldAuth) {
        break;
      }

      const record = await authorizeCharacter(ssoConfig, username);
      // Replace existing token for same character if re-authed
      const cid = record.identity.characterID;
      const idx = tokens.findIndex(
        (t) =>
          (t.identity && t.identity.characterID) === cid ||
          t.characterID === cid,
      );
      if (idx >= 0) {
        tokens[idx] = record;
      } else {
        tokens.push(record);
      }
    }
  }

  if (tokens.length === 0) {
    throw new Error("No characters authorized — nothing to dump.");
  }

  for (const tokenRecord of tokens) {
    let fresh = await ensureFreshToken(ssoConfig, tokenRecord);
    saveToken(username, fresh);
    const identity =
      fresh.identity || characterFromAccessToken(fresh.access_token);
    const characterID = identity.characterID;
    if (!characterID) {
      console.warn("  Skipping token without character ID");
      continue;
    }

    const charName = identity.characterName || String(characterID);
    const characterDir = path.join(
      dumpRoot,
      "characters",
      `${characterID}_${safeName(charName)}`,
    );
    console.log(`\n== Dumping ${charName} (${characterID}) ==`);

    const esi = new EsiClient({ accessToken: fresh.access_token });
    // refresh mid-dump if needed — wrap a simple check before heavy work
    const refreshIfNeeded = async () => {
      if (Number(fresh.expiresAtMs || 0) < Date.now() + 30_000) {
        fresh = await ensureFreshToken(ssoConfig, fresh);
        saveToken(username, fresh);
        esi.setAccessToken(fresh.access_token);
      }
    };
    await refreshIfNeeded();

    const meta = await dumpCharacter(esi, characterID, characterDir, options);
    accountManifest.characters.push({
      characterID,
      characterName: charName,
      dir: path.relative(dumpRoot, characterDir),
      meta,
    });
  }

  accountManifest.finishedAt = new Date().toISOString();
  writeJson(path.join(dumpRoot, "account.json"), accountManifest);
  writeJson(path.join(dumpRoot, "README.txt"), {
    note:
      "Offline Tranquility ESI dump for EVE.js import. Safe to re-convert without re-downloading.",
    username,
    characters: accountManifest.characters.map((c) => ({
      id: c.characterID,
      name: c.characterName,
    })),
  });

  console.log(`\nDump complete: ${dumpRoot}`);
  console.log(
    `Characters: ${accountManifest.characters.map((c) => c.characterName).join(", ")}`,
  );
  return accountManifest;
}

function askYesNo(question, defaultYes = true) {
  // Non-interactive environments: use default
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultYes);
  }
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const hint = defaultYes ? "Y/n" : "y/N";
  return new Promise((resolve) => {
    rl.question(`${question} [${hint}] `, (answer) => {
      rl.close();
      const text = String(answer || "").trim().toLowerCase();
      if (!text) {
        resolve(defaultYes);
        return;
      }
      resolve(text === "y" || text === "yes");
    });
  });
}

module.exports = {
  dumpAccount,
  dumpCharacter,
  authorizeCharacter,
  ensureFreshToken,
  saveToken,
  tokenPathFor,
  stamp,
  safeName,
};
