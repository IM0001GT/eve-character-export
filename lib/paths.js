"use strict";

const path = require("path");

const TOOL_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(TOOL_ROOT, "..", "..");
const DEFAULT_DATA_ROOT = path.join(REPO_ROOT, "_local", "tq-import");
const DEFAULT_DUMP_ROOT = path.join(DEFAULT_DATA_ROOT, "dumps");
const DEFAULT_BUNDLE_ROOT = path.join(DEFAULT_DATA_ROOT, "bundles");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_DATA_ROOT, "sso-config.json");
const DEFAULT_TOKEN_DIR = path.join(DEFAULT_DATA_ROOT, "tokens");

// Jita IV - Moon 4 - Caldari Navy Assembly Plant
const JITA_44_STATION_ID = 60003760;
const JITA_SYSTEM_ID = 30000142;
const DEFAULT_NPC_CORP = 1000060; // Native Freshfood
const PLAYER_CORP_FLOOR = 2000000;

// NPC station IDs live in this band in the SDE.
const NPC_STATION_MIN = 60000000;
const NPC_STATION_MAX = 64000000;

module.exports = {
  TOOL_ROOT,
  REPO_ROOT,
  DEFAULT_DATA_ROOT,
  DEFAULT_DUMP_ROOT,
  DEFAULT_BUNDLE_ROOT,
  DEFAULT_CONFIG_PATH,
  DEFAULT_TOKEN_DIR,
  JITA_44_STATION_ID,
  JITA_SYSTEM_ID,
  DEFAULT_NPC_CORP,
  PLAYER_CORP_FLOOR,
  NPC_STATION_MIN,
  NPC_STATION_MAX,
};
