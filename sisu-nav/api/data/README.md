Local Settings key store (#123). `keys.local.json` is gitignored and
written by `POST /api/settings/keys`. Mount this directory into the API
container as `/data/keys` (see compose `SISU_KEYS_FILE`).
