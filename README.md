# EVE Character Data Export

**v2.0.0**

Export *your own* EVE Online character data from Tranquility using official **ESI**.

Personal backup and private record-keeping. You create your own application on the
[EVE Developers Portal](https://developers.eveonline.com/) and authorize your own
characters via SSO. Data stays on your machine.

| Doc | Description |
|-----|-------------|
| **[GUIDE.md](./GUIDE.md)** | Walkthrough |
| **[SCOPES.md](./SCOPES.md)** | ESI scopes checklist |
| **[NOTICE.md](./NOTICE.md)** | Privacy and trademarks |

## Quick start

```bash
node tools/eve-character-export/eve-character-export.js setup
node tools/eve-character-export/eve-character-export.js export --username myaccount
node tools/eve-character-export/eve-character-export.js list-exports
```

Exports are written under:

```text
_local/eve-character-export/exports/
```

## Commands

```text
setup | export | list-exports | help
```

(`dump` is accepted as an alias for `export`.)

## Install from GitHub

```bash
git clone https://github.com/IM0001GT/eve-character-export.git tools/eve-character-export
node tools/eve-character-export/eve-character-export.js setup
```

## Package this kit

```bash
bash tools/eve-character-export/package-kit.sh
```

Never includes SSO secrets, tokens, or character exports.
