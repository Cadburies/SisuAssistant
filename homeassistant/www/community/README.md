# Vendored Home Assistant frontend cards

Third-party cards served from `/local/community/`. Each one is a copy of an upstream release, checked byte for byte. Update by downloading the new release asset, checking its SHA-256 against the release, and updating this table in the same commit (#211).

| Card | Version | Source | SHA-256 of the `.js` |
|---|---|---|---|
| `config-template-card` | 1.3.6 (latest; upstream quiet since 2021) | [iantrich/config-template-card release 1.3.6](https://github.com/iantrich/config-template-card/releases/tag/1.3.6), asset `config-template-card.js` | `ecee3c7e0a10920e9a432de2e7f1f9506ae742425e95741d1835bbd4dea56c2e` |

## Why `config-template-card`'s `eval` is accepted

The card `eval`s the JavaScript templates written in our own dashboard YAML (`homeassistant/ui-lovelace.yaml`, `homeassistant/dashboards/*.yaml`). Entity states reach those templates as values, not code. To inject code, someone needs write access to the dashboard files, which means the Mac checkout or an HA admin login, and that is already full control. The cyber-check sweep flags the `eval` lines; this note is the recorded decision. If a template ever interpolates text that comes from outside (an MQTT payload, AIS name, Spectra label) into code instead of passing it as a value, this decision no longer holds.
