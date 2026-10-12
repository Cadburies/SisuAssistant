---
name: ui-evidence
description: Use when a change alters something a person sees — an HA dashboard card, the saloon display, a Sisu Nav panel, layer or control — and you need proof it works on the live box rather than "the YAML parses". Drives the real page in a browser, checks each acceptance statement, and records the evidence on the issue.
---

# UI evidence

Our own lightweight take on michaelshimeles/skills `evidence-driven-testing`. That skill isn't copied (it has no license). This one only needs a browser-automation tool (Claude in Chrome, Playwright, a computer-use tool, …) and no recorder.

## When

After the deploy (`do-issue` step 6), whenever the issue's Acceptance names something visible. Not before the deploy, because the box would still show the old version.

## Steps

1. **Turn Acceptance into test statements**, e.g. "Helm card shows ETA in hh:mm", "Charts panel lists imported Navionics sets once".
2. **Open the live page** in a new browser tab:
   - HA dashboards: `http://192.168.0.20:8123/<dashboard-path>` (paths in `homeassistant/configuration.yaml` `lovelace: dashboards:`)
   - Sisu Nav: `http://192.168.0.21:8088/`; Follow me: `https://192.168.0.21:8443`
3. **Act out each statement:** navigate, click, toggle. Confirm by reading the page text back, not only by eye. Hard-reload after a deploy (HA caches dashboards). Read the browser console for Sisu Nav errors.
4. **Capture:**
   - a screenshot per statement
   - a short recording (GIF/video) when the statement is an interaction (named `issue-N-<what>.gif`)
5. **Record on the issue** in the `release.sh` summary, under `### UI evidence`: one line per statement with ✅/❌ and what the page actually showed (text read back, entity state). Images can't be attached through `gh`. Keep them local, and if the feature map's `image:` should change, save the verified PNG to `.ai_context/feature_map/_img/` and reference it there (it publishes to the wiki).
6. **Close the tab.** Don't trigger dialogs (delete/confirm buttons). Don't change live settings that aren't part of the test, and put back any toggle you flipped.

❌ on any statement → `debug-root-cause`, not a re-skin. Box unreachable → "UI evidence skipped: unreachable", and leave the box unticked.
