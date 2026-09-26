---
title: <App> › <Feature name as the user sees it>
id: <folder/path/without-.md>
kind: <root|network|host|app|service|dashboard|view|card|chip|control|panel|layer|setting|route|device|page|flow|hardware>
tags: <lowercase words and synonyms a person would search for, one line>
status: <live|planned|unverified|broken>
script: <same-basename>.sh
audience: <crew (default — published to the wiki) | agent (internal, not published); optional>
---
<One sentence: what it is / what it shows, in crew language.>

- **Reach:** <full click/tap path from the app's entry point, not just the last hop> · `<exact URL / route / IP>`
- **Action:** <what tap / hold / click / call does — or "display only">
- **Needs:** <crew words first (on the boat Wi-Fi, board powered, Shadow ON, route active…) · agent detail after the dot (HA Green hop, secrets) — only the part before " · " goes to the wiki>
- **Expect:** <what you should see, incl. the normal "nothing happening" state>
- **Source:** `<file>` (`<grep-able anchor>`) · `<file>`
