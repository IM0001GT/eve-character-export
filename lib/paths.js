"use strict";

const path = require("path");

const TOOL_ROOT = path.resolve(__dirname, "..");
// Prefer nest under a nearby project _local/; else under tool dir .data/
const CANDIDATE_ROOT = path.resolve(TOOL_ROOT, "..", "..");
const REPO_ROOT = require("fs").existsSync(path.join(CANDIDATE_ROOT, "compose.yaml"))
  || require("fs").existsSync(path.join(CANDIDATE_ROOT, "package.json"))
  ? CANDIDATE_ROOT
  : TOOL_ROOT;

const DEFAULT_DATA_ROOT = path.join(REPO_ROOT, "_local", "eve-character-export");
const DEFAULT_DUMP_ROOT = path.join(DEFAULT_DATA_ROOT, "exports");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_DATA_ROOT, "sso-config.json");
const DEFAULT_TOKEN_DIR = path.join(DEFAULT_DATA_ROOT, "tokens");

module.exports = {
  TOOL_ROOT,
  REPO_ROOT,
  DEFAULT_DATA_ROOT,
  DEFAULT_DUMP_ROOT,
  DEFAULT_CONFIG_PATH,
  DEFAULT_TOKEN_DIR,
  // alias used by dump.js
  get DEFAULT_BUNDLE_ROOT() {
    return path.join(DEFAULT_DATA_ROOT, "packages");
  },
};
