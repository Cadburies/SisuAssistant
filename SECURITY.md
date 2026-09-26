# Security policy

Sisu Assistant is the personal automation system of one sailing yacht, published for reference. There is no support team or response SLA, but security reports are welcome and taken seriously.

## Reporting a vulnerability

Please report privately — **do not open a public issue**:

- GitHub → **Security** tab → **Report a vulnerability** (private vulnerability reporting is enabled), or
- contact the repository owner through their GitHub profile.

Include what you found, where (file / endpoint / commit), and how to reproduce it. If you find a credential or key in this repository or its history, say which file and commit — do not post the value.

## Scope and design notes

- **No secrets belong in git.** Live credentials live in `homeassistant/secrets.yaml` (gitignored); `homeassistant/secrets.yaml.example` holds placeholders only. Every commit runs `scripts/scan_secrets.sh`, which also checks that no real secret value is staged. Policy: `.ai_context/secrets.md`.
- **Services are LAN-only** on the boat's private networks (HA Green, the F8 NAS, ESP32 devices). Addresses in the docs are private RFC 1918 ranges.
- **Safety-critical control runs locally** on the ESP32 alternator firmware, with hard limits that no dashboard or API can change (`homeassistant/docs/ALTERNATOR_LIMITS.md`). Reports about bypassing those limits are the highest priority.
