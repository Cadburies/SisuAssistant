# Archived ESPHome drafts

- `new_*.yaml` — early include experiments (wrong pins / broken paths). Superseded by `packages/marine_board_base.yaml` + role packages.
- `alternator.yaml` (old) — pre–Marine Board LilyGo-style draft if present.
- `test.yaml` — ad-hoc tests.
- `bench_t8s3.yaml` — retired LilyGo T8-S3 connectivity bench. Lab hardware is the Marine Board.

Do not flash these. Live entrypoints: `../alternatorport.yaml`, `../alternatorstarboard.yaml`, `../waterlevels.yaml`, `../freezer.yaml`, `../saloon_display.yaml`, `../bench_marine_board.yaml` (GPIO mapping, not a vessel role).  
Root `alternator.yaml` was removed — use the side entrypoints only.
