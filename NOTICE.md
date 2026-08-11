# Notice

## Purpose

**EVE Character Data Export** helps you export **your own** character data from
EVE Online’s official Tranquility **ESI** for:

1. **Personal backup / offline study** of skills, assets, and related data you
   already own (primary purpose).
2. **Optional** loading of that same portable export into a **local private**
   EveJS practice server so you can learn mechanics offline without live-game
   time sinks or loss risk (secondary, optional workflow).

It is not a public multiplayer service, not a bot, and not a way to access other
people’s characters.

## Not included (by design)

This package never ships:

- EVE SSO client IDs or secrets  
- Refresh / access tokens  
- Character dumps, bundles, or portraits  
- Account usernames, passwords, or game-store databases  

Each user must create their **own** application on the
[EVE Developers Portal](https://developers.eveonline.com/) and authorize **their
own** characters via SSO.

## CCP / EVE Online

EVE Online and related trademarks are property of CCP hf. / the current rights
holder. This tool is **not** affiliated with, endorsed by, or supported by CCP.

You are responsible for complying with:

- EVE Online’s Terms of Service  
- ESI / developer terms  
- Applicable law  

Use only data you are authorized to access (your own characters via official SSO).

## Privacy

Exports and tokens under `_local/tq-import/` are sensitive. Do not publish or
share them. Revoke the app on the EVE Developers Portal if a client secret or
refresh token is leaked.

## Naming

- Preferred CLI: `eve-character-export.js`  
- Legacy CLI: `tq-import.js` (same program)  
- Folder path `tools/tq-import/` is kept so existing installs and scripts keep working.

## License

Kit scripts/docs are provided as-is for private use and sharing of the **tool**
only — never share dumps, tokens, or third-party data.
