# Sisu Nav — Design system

> Visual language for the cockpit UI (#122): a "futuristic" dark instrument
> panel by default (night), with a high-contrast day mode for bright
> on-the-water use. For UI behavior see [USER_GUIDE.md](USER_GUIDE.md); for
> plugin architecture see [DEVELOPER.md](DEVELOPER.md).

## Tokens (`web/src/app/App.css`)

All color is CSS custom properties on `:root` — **never hardcode a color in
a plugin's own `.css` file**; add or reuse a token here instead, or both
themes drift out of sync silently.

| Token | Role |
|---|---|
| `--bg` | Page/map background |
| `--panel` | Side-stack / popup background |
| `--well` | Recessed surface — inputs, cards, rows |
| `--well-2` | Secondary recessed surface — map popups |
| `--statusbar` | Bottom status bar background |
| `--line` | Borders, dividers |
| `--text` / `--muted` | Primary / secondary text |
| `--gold` | Primary accent — active/primary controls, "on" states |
| `--cyan` | Secondary accent — hover, selection, secondary actions |
| `--red` | Danger / error — **never restyle away from meaning "wrong/stop"** |
| `--ok` / `--wait` | Status semantics — connected/good vs. pending/caution |
| `--glow-gold` / `--glow-cyan` / `--glow-red` / `--glow-ok` | `box-shadow` values for the glow treatment below |

Night is defined on bare `:root` (it's the default and always has been —
no user has to opt into it). Day is `:root[data-theme="light"]`, redefining
every token above with darker, more saturated accents on a light background
— same hue identity (gold stays gold, cyan stays cyan) so a screenshot from
either theme is still recognizably "Sisu Nav," just re-lit for the
conditions. `--glow-*` shrinks its blur radius and drops the outer bloom in
day mode — a full neon glow reads as noise in bright sun, an outline ring
doesn't.

## The glow treatment

A button/toggle/active-state gets `box-shadow: var(--glow-<color>)` on
`:hover` and whenever it represents an "on"/selected/primary state —
paired with the matching `border-color`/`color` change that already existed
everywhere before this pass. The rule of thumb:

- **Gold** = primary / the thing that's "on" right now (an active map-hud
  toggle, a primary form action, a lit status dot).
- **Cyan** = hover / secondary selection (a hovered row, a "you could click
  this" affordance, an "active" secondary control alongside a gold
  primary one).
- **Red** / **ok** = keep their existing meaning (danger, success) — glow
  reinforces it, it doesn't replace `--red` as the language for "something
  is wrong." **Do not** reach for a decorative glow color on an error state
  just because it looks nicer; `--glow-red` exists specifically so errors
  stay legible-but-glowing, not muted-but-safe-looking.

Every interactive element that changed color on hover/active before this
pass now also gets the matching glow — that sweep already happened across
every plugin's CSS. A **new** plugin should follow the same rule: define
its own hover/active color change using the existing tokens, add the
matching `--glow-*` box-shadow, don't invent a new accent color.

## Day/night toggle (`web/src/app/theme.ts`)

`theme.ts` is a small persisted-state module (same shape as `layers.ts`/
`side.ts`): `getTheme()`/`setTheme()`/`toggleTheme()`/`subscribeTheme()`,
backed by `localStorage`, stamping `data-theme="light"` on
`document.documentElement` (removed entirely for night — night is the
`:root` default). Deliberately **not** driven by `prefers-color-scheme` —
day mode is something you turn on because it's bright out, not something
the OS silently flips for you mid-session. The toggle lives in the status
bar (`App.tsx`'s `.bar`, next to the SK sign-in control) so it's reachable
regardless of what panel is open.

## Adding to this system

- New color need? Check if an existing token already means what you want
  before adding one — `--gold`/`--cyan` cover "primary"/"hover-or-secondary"
  for almost everything so far.
- New recessed surface (an input, a card)? Use `--well`, not a new hex.
- Never let a glow effect make a safety-relevant color (red/wait) read as
  merely decorative — legibility and meaning come first, the glow is
  garnish on top of it, not a replacement for it.
