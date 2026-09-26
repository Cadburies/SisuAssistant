---
title: Sisu Nav › Settings (API keys)
id: nav/settings/keys
kind: setting
tags: settings api keys maptiler mapbox google azure aisstream save clear masked
status: live
script: keys.sh
---
Every API key Sisu Nav can use: paste and **Save** (stored on the boat, shown masked), **Clear local** to fall back to secrets.yaml.

- **Reach:** Sisu Nav → right stack → **Settings** panel
- **Action:** paste a key → **Save**; **Clear local** removes the override; reload after changing map keys.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running
- **Expect:** Rows show masked previews like `••••1234` and where each key came from; Bing/Apple rows disabled (Not implemented yet). Known issue #168: the Azure key is still returned in full by `/api/config`.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Settings`) · `sisu-nav/web/src/plugins/settings/` · `sisu-nav/api/settings/` (`/api/settings`)
