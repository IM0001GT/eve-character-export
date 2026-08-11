# EVE Character Data Export — Guide

## Purpose

Download a **personal copy** of character data you already own on EVE Online
Tranquility, using the official ESI API and your own developer application.

Typical reasons people export their own data:

- Personal backup of skills, assets, and related character records  
- Private notes / spreadsheets / tooling on your own PC  

## Requirements

1. **Node.js** (v20+ recommended)  
2. A browser on the same machine for SSO  
3. Your own app at [developers.eveonline.com](https://developers.eveonline.com/)  

## Create your ESI application

1. Open the EVE Developers Portal and create an application.  
2. Set the callback URL **exactly** to:

   ```text
   http://127.0.0.1:8731/callback
   ```

3. Enable the character **read** scopes listed in [SCOPES.md](./SCOPES.md).  
4. Suggested app name: **Personal Character Data Export** (or similar).  

## Setup and export

```bash
node tools/eve-character-export/eve-character-export.js setup
node tools/eve-character-export/eve-character-export.js export --username myaccount
```

- `--username` is only a **local label** for files on disk (not your EVE password).  
- SSO opens in your browser; approve each character you want included.  
- Re-run later with `--reuse-tokens` to refresh without full re-auth when possible.

## Where files are stored

```text
_local/eve-character-export/
  sso-config.json          # your client id (private)
  tokens/                  # refresh tokens (private)
  exports/<export-id>/     # one full export
    account.json
    characters/
      <id>_<name>/
        public.json
        skills.json
        assets.json
        ...
```

**Do not** publish or share this folder.

## Export folder layout

Each export is a directory with:

- `account.json` — account-level metadata for this export session  
- `characters/<id>_<name>/` — per-character ESI endpoint JSON files  

That layout is a normal personal ESI dump structure and can be used by any local
tooling that understands the same folder shape.

## List previous exports

```bash
node tools/eve-character-export/eve-character-export.js list-exports
```

## Privacy

- Tokens and exports never leave your PC unless **you** copy them.  
- Revoke the app on the Developers Portal if a secret or refresh token leaks.  
- See [NOTICE.md](./NOTICE.md).
