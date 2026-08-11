#!/usr/bin/env node
"use strict";

/**
 * EVE Character Data Export
 *
 * Export your own EVE Online character data via official ESI for personal
 * backup and private record-keeping. Uses only your developer application
 * and SSO — no third-party services.
 */

const path = require("path");
const fs = require("fs");
const readline = require("readline");

const {
  loadSsoConfig,
  saveSsoConfig,
  ensureDataRoot,
  ensureDir,
} = require("./lib/config");
const { dumpAccount } = require("./lib/dump");
const {
  DEFAULT_DUMP_ROOT,
  DEFAULT_CONFIG_PATH,
  DEFAULT_DATA_ROOT,
  REPO_ROOT,
} = require("./lib/paths");

const TOOL_VERSION = "2.0.0";

function printHelp() {
  console.log(`
EVE Character Data Export  v${TOOL_VERSION}
================================

Export *your own* EVE Online character data via official ESI.
Personal backup and private records only. You authorize characters with SSO
using an application you create on the EVE Developers Portal.

Usage:
  node tools/eve-character-export/eve-character-export.js <command> [options]

Commands:
  setup                 Save your ESI client id (and optional secret)
  export                Authorize characters and download a full personal export
  list-exports          List local export folders
  help                  This message

Options:
  --username <name>     Label for this account export (required for export)
  --reuse-tokens        Reuse saved refresh tokens for this username
  --no-interactive      Do not prompt for extra characters (tokens only)
  --max-characters <n>  Stop after N character authorizations

Setup:
  1. Create your own app at https://developers.eveonline.com/
  2. Callback URL (exact): http://127.0.0.1:8731/callback
  3. Enable the character *read* scopes listed in SCOPES.md
  4. Run:  ... setup
  5. Run:  ... export --username myaccount1

Export data is stored only on this machine under:
  ${DEFAULT_DATA_ROOT}

Never share exports, tokens, or sso-config.json.
See NOTICE.md.
`);
}

function parseArgs(argv) {
  const args = {
    command: null,
    username: null,
    reuseTokens: false,
    interactive: true,
    maxCharacters: 0,
    help: false,
  };
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help" || argv[0] === "help") {
    args.help = true;
    return args;
  }
  args.command = argv[0];
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    switch (a) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "--username":
        args.username = next();
        break;
      case "--reuse-tokens":
        args.reuseTokens = true;
        break;
      case "--no-interactive":
        args.interactive = false;
        break;
      case "--max-characters":
        args.maxCharacters = Number(next()) || 0;
        break;
      default:
        console.error(`Unknown argument: ${a}`);
        args.help = true;
    }
  }
  return args;
}

function ask(question, defaultValue = "") {
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultValue);
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const hint = defaultValue ? ` [${defaultValue}]` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${hint}: `, (answer) => {
      rl.close();
      resolve(String(answer || "").trim() || defaultValue);
    });
  });
}

async function cmdSetup() {
  ensureDataRoot();
  const existing = loadSsoConfig();
  console.log("EVE SSO application setup");
  console.log("Create an app at: https://developers.eveonline.com/");
  console.log("Callback URL must be exactly: http://127.0.0.1:8731/callback");
  console.log("Enable character READ scopes listed in SCOPES.md");
  console.log("");

  const clientId = await ask("Client ID", existing.clientId || "");
  if (!clientId) throw new Error("Client ID is required");
  const clientSecret = await ask(
    "Client Secret (leave blank for PKCE / native app)",
    existing.clientSecret || "",
  );
  const callbackUrl = await ask(
    "Callback URL",
    existing.callbackUrl || "http://127.0.0.1:8731/callback",
  );

  const saved = saveSsoConfig({
    clientId,
    clientSecret: clientSecret || null,
    callbackUrl,
    callbackPort: 8731,
    usePkce: !clientSecret,
  });
  console.log(`\nSaved SSO config → ${DEFAULT_CONFIG_PATH}`);
  console.log(
    JSON.stringify(
      { ...saved, clientSecret: saved.clientSecret ? "(set)" : null },
      null,
      2,
    ),
  );
}

async function cmdExport(args) {
  const ssoConfig = loadSsoConfig();
  if (!ssoConfig.clientId) {
    throw new Error(
      "SSO not configured. Run: node tools/eve-character-export/eve-character-export.js setup",
    );
  }
  if (!args.username) {
    throw new Error("--username is required (label for this account export)");
  }

  const manifest = await dumpAccount({
    username: args.username,
    ssoConfig,
    reuseTokens: args.reuseTokens,
    interactive: args.interactive,
    maxCharacters: args.maxCharacters,
  });

  console.log("\nExport complete.");
  if (manifest && manifest.dumpRoot) {
    console.log(`  Folder: ${manifest.dumpRoot}`);
  } else {
    console.log(`  Under:  ${DEFAULT_DUMP_ROOT}`);
  }
  console.log("Keep this folder private. Do not upload or share it.");
  return manifest;
}

function cmdListExports() {
  ensureDir(DEFAULT_DUMP_ROOT);
  if (!fs.existsSync(DEFAULT_DUMP_ROOT)) {
    console.log("No exports yet.");
    return;
  }
  const entries = fs
    .readdirSync(DEFAULT_DUMP_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
  if (!entries.length) {
    console.log(`No export folders under ${DEFAULT_DUMP_ROOT}`);
    return;
  }
  console.log(`Exports in ${DEFAULT_DUMP_ROOT}:\n`);
  for (const name of entries) {
    console.log(`  ${name}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) {
    printHelp();
    return;
  }

  ensureDataRoot();
  ensureDir(DEFAULT_DUMP_ROOT);

  switch (args.command) {
    case "setup":
      await cmdSetup();
      break;
    case "export":
    case "dump": // legacy alias
      await cmdExport(args);
      break;
    case "list-exports":
    case "list":
      cmdListExports();
      break;
    case "help":
      printHelp();
      break;
    default:
      printHelp();
      throw new Error(`Unknown command: ${args.command}`);
  }
}

main().catch((error) => {
  console.error(`\nError: ${error.message || error}`);
  process.exitCode = 1;
});
