# ESI scopes checklist

When creating your app at [developers.eveonline.com](https://developers.eveonline.com/),
enable the scopes below (all are **read-only** for characters).

Suggested app name on the portal: something like **Personal Character Data Export**
(local callback only — not a public service).

The tool requests these scopes automatically on SSO; the portal app must allow them.

## Required for a full personal character export

Copy-paste list (space-separated) for the authorize URL is built by `lib/scopes.js`.

| Scope | Why |
|-------|-----|
| `publicData` | Public character info |
| `esi-skills.read_skills.v1` | Skills, SP, attributes |
| `esi-skills.read_skillqueue.v1` | Skill queue |
| `esi-wallet.read_character_wallet.v1` | ISK, journal, transactions |
| `esi-assets.read_assets.v1` | Assets + names/locations |
| `esi-location.read_location.v1` | Docked / system location |
| `esi-location.read_ship_type.v1` | Active ship |
| `esi-location.read_online.v1` | Online status |
| `esi-clones.read_clones.v1` | Home / jump clones |
| `esi-clones.read_implants.v1` | Active implants |
| `esi-fittings.read_fittings.v1` | Saved fittings |
| `esi-characters.read_standings.v1` | Standings |
| `esi-characters.read_loyalty.v1` | LP wallets |
| `esi-characters.read_blueprints.v1` | Blueprints ME/TE/runs |
| `esi-characters.read_fatigue.v1` | Jump fatigue |
| `esi-characters.read_titles.v1` | Titles |
| `esi-characters.read_medals.v1` | Medals |
| `esi-characters.read_notifications.v1` | Notifications |
| `esi-characters.read_contacts.v1` | Contacts |
| `esi-characters.read_agents_research.v1` | Research agents |
| `esi-characters.read_corporation_roles.v1` | Corp roles (if any) |
| `esi-characters.read_fw_stats.v1` | Faction warfare stats |
| `esi-contracts.read_character_contracts.v1` | Contracts (dump only) |
| `esi-industry.read_character_jobs.v1` | Industry jobs (dump only) |
| `esi-industry.read_character_mining.v1` | Mining ledger (dump only) |
| `esi-markets.read_character_orders.v1` | Market orders (dump only) |
| `esi-killmails.read_killmails.v1` | Recent killmails (dump only) |
| `esi-calendar.read_calendar_events.v1` | Calendar (dump only) |
| `esi-planets.manage_planets.v1` | Planetary interaction (dump only) |
| `esi-fleets.read_fleet.v1` | Fleet membership (if any) |
| `esi-search.search_structures.v1` | Structure search helper |
| `esi-universe.read_structures.v1` | Structure names for remapping |

## Not requested

- Mail scopes (mail is not dumped)  
- Write / UI / corporation hangar scopes  

## App settings

| Field | Value |
|-------|--------|
| Application type | Authentication & API Access |
| Callback URL | `http://127.0.0.1:8731/callback` (exact) |
| Connection type | Public (PKCE) **or** Confidential (client secret) |

**Tip:** If SSO fails with “invalid scope”, re-open the app on the portal and
ensure every scope above is checked, then re-run `setup` / `dump`.
