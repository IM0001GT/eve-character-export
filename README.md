# EVE Character Data Export

**v2.0.0** — export *your own* EVE Online character data via official ESI.

Primary use: **personal character data export** (backup and offline study of skills,
assets, and related ESI data you already own on Tranquility).

Optional companion step: load a portable bundle into a **local EveJS** private
server so you can practice mechanics offline — without putting live-game time and
hulls at risk while you learn.

| Doc | Description |
|-----|-------------|
| **[GUIDE.md](./GUIDE.md)** | Full walkthrough |
| **[SCOPES.md](./SCOPES.md)** | ESI scopes for your developer app |
| **[NOTICE.md](./NOTICE.md)** | Privacy, trademarks, terms |

> **CLI entry points (same tool)**  
> Preferred: `eve-character-export.js`  
> Legacy: `tq-import.js` (still supported)

## Quick start — export only (no EveJS required)

```bash
# From an EveJS install root, or any checkout that contains this tools/ folder
node tools/tq-import/eve-character-export.js setup
node tools/tq-import/eve-character-export.js export --username myaccount
node tools/tq-import/eve-character-export.js package --dump <export-id>
```

You get a private export under `_local/tq-import/dumps/` and a portable
`players-bundle.json` under `_local/tq-import/bundles/`.

Create **your own** app at [developers.eveonline.com](https://developers.eveonline.com/)  
with callback `http://127.0.0.1:8731/callback` (see GUIDE).

## Optional — load into local EveJS (practice / learning)

For people who still play on Tranquility but want a private sandbox to learn
mechanics (industry, fittings, space risk) without multi-hour setbacks:

```bash
# Server must be STOPPED
node tools/tq-import/eve-character-export.js import-evejs \
  --bundle _local/tq-import/bundles/<export-id>/players-bundle.json \
  --on-conflict overwrite

node tools/tq-import/eve-character-export.js portraits --dump <export-id> --username myaccount
```

Or one shot after export packaging:

```bash
node tools/tq-import/eve-character-export.js pipeline --username myaccount --with-evejs-import
```

### Docker layouts (import-evejs only)

| Install style | Typical volume | Typical image |
|---------------|----------------|---------------|
| Stock EveJS 0.12.x | `evejs-data` | `evejs-local` |
| DML / evejs-xeve | `evejs-xeve-data` | `evejs-xeve-local` |

Auto-detected; prompt if several match. Override with `--volume` / `--image`.

### Faces after a server upgrade

```bash
node tools/tq-import/eve-character-export.js restore-portraits
node tools/tq-import/eve-character-export.js restore-portraits --username myaccount
node tools/tq-import/eve-character-export.js restore-portraits --sync-only
```

## Commands

```text
setup | export | package | import-evejs | portraits | restore-portraits | pipeline | help

Legacy aliases (still work):
  dump      = export
  convert   = package
  import    = import-evejs
  tq-import.js = eve-character-export.js
```

## Share this kit (no secrets)

```bash
bash tools/tq-import/package-kit.sh
# → dist/eve-character-export-v*.tar.gz  and  .zip
```

Never includes SSO secrets, tokens, dumps, or character data.

## Related

| Project | Purpose |
|---------|---------|
| [evejs-upgrade](https://github.com/IM0001GT/evejs-upgrade) | Upgrade EveJS installs to stock 0.12.5 |
| [evejs-solo-rpg-preset](https://github.com/IM0001GT/evejs-solo-rpg-preset) | Solo timer preset for stock EveJS |
| [dmspack-install-windows](https://github.com/IM0001GT/dmspack-install-windows) | Windows pack installer |
