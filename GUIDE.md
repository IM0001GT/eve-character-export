# EVE Character Data Export — User Guide

Export **your own** EVE Online character data from Tranquility via official **ESI**.

**Primary use:** personal backup and offline study of skills, assets, and related
data you already own.

**Optional use:** load that portable export into a **local EveJS** practice server
so you can learn mechanics offline (industry, fittings, space risk) without the
live-game time cost of losing a ship while you practice.

No third-party cloud account: data is pulled with **your** ESI SSO app and stored
only on your machine.

---

## What this kit is

| Component | Role |
|-----------|------|
| `eve-character-export.js` | Preferred CLI entry |
| `tq-import.js` | Same CLI (legacy filename) |
| `lib/` | ESI SSO, export, package, portrait helpers |
| `GUIDE.md` | This guide |
| `SCOPES.md` | ESI scope checklist for the developer portal |
| `NOTICE.md` | Privacy / trademarks / terms |
| `package-kit.sh` | Build a clean zip/tar to share (no secrets) |

### What transfers well

| Data | Notes |
|------|--------|
| Skills, SP, attributes, skill queue | Full |
| ISK balance | Full |
| Assets (ships, modules, cargo, hangars) | Nested item trees preserved |
| Blueprints (ME / TE / runs) | Attached to items |
| Implants, jump clones | Clone locations remapped if needed |
| Location / active ship | Structures → fallback station |
| Standings, LP, fittings | Imported in portable form |
| Portraits (JPEG) | From `images.evetech.net` for UI / select |

### What does not fully transfer

| Data | Notes |
|------|--------|
| Full 3D paperdoll DNA | Not available via ESI; JPEGs are used instead |
| Mail | Skipped (slow / not needed offline) |
| Live market orders, industry jobs, contracts, PI | Saved in the **dump** for later; not fully live on import |
| Player citadels | Hangars remapped (default: **Jita 4-4**) |
| Player corporations | Stripped to an NPC corp (same idea as EVE.js player export) |

---

## Requirements

### For export only (primary)

1. **Node.js** (v20+ recommended).  
2. Browser on the same machine for SSO.  
3. Your own app on [developers.eveonline.com](https://developers.eveonline.com/).  

EveJS is **not** required to export or package your data.

### For optional EveJS load (practice server)

4. A working **EveJS** install (stock or DML) you can start/stop.  
5. Optional but recommended: **Docker Compose** stack for the server.

### Drop-in install

If you received this kit as a zip:

```bash
# From your EveJS install root (or any tools-friendly tree):
unzip eve-character-export-v*.zip -d tools/
# or: tar xzf eve-character-export-v*.tar.gz -C tools/
# Resulting path: tools/tq-import/
```

If it already lives as `tools/tq-import/`, you are done installing the kit.

### Stock EveJS vs DML (Docker volume / image names)

Optional `import-evejs` writes into the **Docker volume** your server uses:

| Layout | Volume | Image (compose build) |
|--------|--------|------------------------|
| **Stock** EveJS 0.12.x | `evejs-data` | `evejs-local` |
| **DML** / evejs-xeve | `evejs-xeve-data` | `evejs-xeve-local` |

**Auto-detect:** on `import`, `portraits`, and `restore-portraits`, the tool lists EveJS-like volumes and images. If only one volume matches, it is used. If several match, you are prompted.

**Manual pin:**

```bash
# Stock EveJS
node tools/tq-import/eve-character-export.js import-evejs --bundle path/to/players-bundle.json \
  --volume evejs-data --image evejs-local

# DML / evejs-xeve
node tools/tq-import/eve-character-export.js import-evejs --bundle path/to/players-bundle.json \
  --volume evejs-xeve-data --image evejs-xeve-local
```

List volumes/images on the machine:

```bash
docker volume ls | findstr /i evejs
docker images | findstr /i evejs
```

Host-only (no Docker), if you run Node against a bind-mounted gameStore:

```bash
node tools/tq-import/eve-character-export.js import-evejs --bundle ... --host-only --target C:\path\to\gameStore\data
```

### Restore faces only (already imported)

After a server upgrade, character data is fine but select-screen faces are blank.
You do **not** need to re-import the account.

```bash
# Re-download missing JPGs from Tranquility + sync into Docker volume
node tools/tq-import/eve-character-export.js restore-portraits

# One local account only
node tools/tq-import/eve-character-export.js restore-portraits --username myaccount

# JPGs still on disk under generated/Character/ — only push into the volume
node tools/tq-import/eve-character-export.js restore-portraits --sync-only

# Always re-download from images.evetech.net
node tools/tq-import/eve-character-export.js restore-portraits --force-download
```

`restore-portraits` uses, in order:

1. `tqImport.sourceCharacterID` on each local character row (set at import)  
2. Name match against dumps under `_local/tq-import/dumps/`  
3. Optional `--dump <id>` / `--bundle`  
4. Existing host files under `generated/Character/` (`--sync-only`)

Then it syncs into `gameStore/images/Character/` on the Docker volume (0.12.5+).

### Portraits on EveJS 0.12.5+ (Docker volume)

Stock **0.12.5** serves character faces from the **Docker data volume**:

```text
<volume>/gameStore/images/Character/{localId}_{size}.jpg
```

The `portraits` command still writes the host legacy path
`server/src/_secondary/image/generated/Character/`, and **also copies** those
files into the Docker volume when `evejs-xeve-data` (or your compose volume) is
detected. That matches the server’s runtime image store so character select is
not blank after import.

If faces are still missing:

```bash
VOL=evejs-xeve-data   # or: docker volume ls | grep evejs
docker run --rm -v "$VOL:/data" \
  -v "$PWD/server/src/_secondary/image/generated/Character:/portraits:ro" \
  alpine sh -c 'mkdir -p /data/gameStore/images/Character && cp -a /portraits/. /data/gameStore/images/Character/'
docker compose restart server
```

### Docker portrait mount (once, optional legacy fallback)

Portraits are served from:

```text
server/src/_secondary/image/generated/Character/
```

Ensure `compose.yaml` bind-mounts that folder into the server container (evejs-xeve already includes this when up to date):

```yaml
- ./server/src/_secondary/image/generated/Character:/app/server/src/_secondary/image/generated/Character
```

Then:

```bash
mkdir -p server/src/_secondary/image/generated/Character
docker compose up --detach --force-recreate server
```

---

## Step 0 — Create an EVE SSO application

1. Sign in at [developers.eveonline.com](https://developers.eveonline.com/).  
2. Create an application (**Authentication & API Access**).  
3. Set **Callback URL** exactly:

   ```text
   http://127.0.0.1:8731/callback
   ```

4. Enable the character **read** scopes listed in **[SCOPES.md](./SCOPES.md)**.  
5. Save **Client ID** (and Client Secret only if you chose a confidential app).

You do **not** need (and should not share) anyone else’s keys.

---

## Step 1 — Configure the tool

From the **evejs-xeve repository root**:

```bash
node tools/tq-import/eve-character-export.js setup
```

Paste your Client ID (secret optional for PKCE). Config is stored only on your machine:

```text
_local/tq-import/sso-config.json
```

Or use environment variables:

```bash
export EVE_SSO_CLIENT_ID="your-client-id"
# optional:
export EVE_SSO_CLIENT_SECRET="your-secret"
```

---

## Step 2 — Dump your account (offline snapshot)

Pick a **local login username** for this TQ account (e.g. `myaccount`). All characters you authorize will hang under that one login.

```bash
node tools/tq-import/eve-character-export.js export --username myaccount
```

1. Open the printed SSO URL in a browser.  
2. Log into EVE Online and select **one character**.  
3. Approve scopes.  
4. In the terminal: authorize another character with **Y**, or **N** when done.

### Output

```text
_local/tq-import/dumps/<username>-<timestamp>/
  account.json
  characters/<tqId>_<name>/
    skills.json, assets.json, wallet.json, ...
```

This dump is reusable: convert/import again without talking to CCP.

Re-dump later with saved tokens:

```bash
node tools/tq-import/eve-character-export.js export --username myaccount --reuse-tokens
```

Tokens live under `_local/tq-import/tokens/` — **keep private**.

---

## Step 3 — Convert to an EVE.js player bundle

```bash
node tools/tq-import/eve-character-export.js package --dump <dump-folder-or-id>
```

Produces:

```text
_local/tq-import/bundles/<dump-id>/
  players-bundle.json
  remap-report.json      # citadel → Jita (or your fallback) moves
```

Optional:

```bash
node tools/tq-import/eve-character-export.js package \
  --dump <dump-id> \
  --fallback-station 60003760
```

(`60003760` = Jita 4-4.)

---

## Step 4 — Import into the local server

**Stop the game server first** (in-memory cache would overwrite SQLite).

### Docker (recommended)

If the named volume `evejs-xeve-data` exists, `import` writes into that volume automatically:

```bash
docker compose stop server market

node tools/tq-import/eve-character-export.js import-evejs \
  --bundle _local/tq-import/bundles/<dump-id>/players-bundle.json \
  --on-conflict overwrite

docker compose up --detach
```

### Why Docker path matters

| Path | Used by |
|------|---------|
| Docker volume `evejs-xeve-data` → `/var/lib/evejs/gameStore` | Docker server (what you play) |
| Host fallback `server/src/gameStore/gamestore.sqlite` | Accidental if Docker is ignored |

Importing only to the host fallback looks “successful” but the client still shows empty character creation.

### Username conflict

If you already logged in once with the same username, an empty account may exist:

| Flag | Behavior |
|------|----------|
| `--on-conflict skip` | Do nothing (default) |
| `--on-conflict rename` | Creates `username_imported` |
| `--on-conflict overwrite` | Prefer this for a re-import |

### Native / non-Docker host

```bash
node tools/tq-import/eve-character-export.js import-evejs \
  --bundle .../players-bundle.json \
  --host-only \
  --target /path/to/gameStore/data \
  --on-conflict overwrite
```

---

## Step 5 — Portraits

```bash
node tools/tq-import/eve-character-export.js portraits \
  --dump <dump-folder-or-id> \
  --username myaccount
```

This:

1. Downloads JPEGs from CCP’s image service into  
   `server/src/_secondary/image/generated/Character/{localId}_{size}.jpg`  
2. Sets character flags so the UI loads image-server portraits  
3. Seeds the **client portrait cache** (Wine/Proton  
   `cache/Pictures/Characters/`) so character select is not stuck on the stock icon  

Then fully **quit and relaunch** the EVE client.

If select still shows the default face, delete stale cache files:

```text
.../cache/Pictures/Characters/<localCharacterId>_*.jpg
```

and re-run `portraits`.

---

## Step 6 — Play

1. Start the server (`docker compose up --detach` or your native launcher).  
2. Launch the patched local client.  
3. Log in with the **local username** from dump (e.g. `myaccount`).  
4. Password: whatever your install allows (many dev configs skip password checks).  
5. Pick a character; hangar goods from citadels are typically in **Jita 4-4**.

---

## Second TQ account

Use a different local username:

```bash
node tools/tq-import/eve-character-export.js export --username myaccount2
node tools/tq-import/eve-character-export.js package --dump <new-dump-id>
# server stopped:
node tools/tq-import/eve-character-export.js import-evejs --bundle ... --on-conflict skip
node tools/tq-import/eve-character-export.js portraits --dump <new-dump-id> --username myaccount2
```

---

## Command reference

```text
node tools/tq-import/eve-character-export.js setup
node tools/tq-import/eve-character-export.js export      --username <name> [--reuse-tokens]
node tools/tq-import/eve-character-export.js package   --dump <path-or-id> [--fallback-station <id>]
node tools/tq-import/eve-character-export.js import-evejs    --bundle <players-bundle.json> [options]
node tools/tq-import/eve-character-export.js portraits --dump <path-or-id> [--username <name>]
node tools/tq-import/eve-character-export.js pipeline  --username <name>
node tools/tq-import/eve-character-export.js help
```

### Import options

| Option | Meaning |
|--------|---------|
| `--on-conflict skip\|rename\|overwrite` | Existing local username |
| `--host-only` | Do not use Docker volume |
| `--target <dataDir>` | Explicit gameStore data directory |
| `--dry-run` | Plan import without writing |

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Character creation screen, no toons | Import went to host DB; re-import with Docker auto path or correct `--target`. Server was running during import → stop, import, start. |
| Username exists / no new chars | Use `--on-conflict overwrite` or `rename`. |
| Stock face on character select | Run `portraits`; clear client `cache/Pictures/Characters/*`; full client restart. |
| SSO invalid scope | Enable all scopes in [SCOPES.md](./SCOPES.md) on the portal. |
| Callback error | Callback must be exactly `http://127.0.0.1:8731/callback`. |
| Dump hangs | Current kit skips mail; update if you have an older copy that still fetches mail. |
| Citadel assets missing | Check `remap-report.json`; default hangar is Jita 4-4. |

---

## Privacy when sharing this kit

**Do share:** the `tools/tq-import` sources + this guide.

**Do not share:**

- `_local/tq-import/` (config, tokens, dumps, bundles)  
- `sso-config.json`  
- Any `gamestore.sqlite`  
- Portrait files tied to your characters  

Build a clean archive with:

```bash
bash tools/tq-import/package-kit.sh
```

Output goes to `dist/` (no secrets).

---

## Related EVE.js tools

- `server/src/gameStore/exportPlayers.js` / `importPlayers.js` — EVE.js ↔ EVE.js only  
- In-game GM: `/giveskills`, `/setisk`, `/allskills` — manual fallback  

See also [NOTICE.md](./NOTICE.md).


## Command name aliases

| Preferred | Legacy (still works) |
|-----------|----------------------|
| `export` | `dump` |
| `package` | `convert` |
| `import-evejs` | `import` |
| `eve-character-export.js` | `tq-import.js` |
