# Changelog archive

Cold storage for rolled-off hot changelog entries.

## Rules

- **Never session-load** this directory in normal agent work.
- Agents are not routed here from INDEX Read-Next.
- Open only when a human asks for historical behavior or audit trail.
- Prefer files named by year or quarter, e.g. `2025.md`, `2026-Q1.md`.
- Do not re-copy archived text back into warm files.
