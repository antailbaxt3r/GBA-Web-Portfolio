# 8-bit Portfolio

A personal portfolio that is not a website but a small explorable town, rendered
like a Game Boy Advance overworld. You control a pixel trainer, walk around, and
enter four buildings - Work, Projects, About Me, Contact — reading the portfolio
through in-world objects and dialogue boxes.

Built with **Phaser 4 + TypeScript + Vite**. Every pixel and every note of audio
is generated from code; see [CREDITS.md](CREDITS.md).

---

## Quick start

```bash
npm install
npm run assets:all     # generate art, maps, audio, then validate
npm run dev            # http://localhost:5173
```

`public/assets/` is generated output. If it is missing or you change anything in
`tools/`, re-run `npm run assets:all`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run assets` | Generate all sprites, tilesets, UI and fonts |
| `npm run maps` | Generate the town and four interiors |
| `npm run audio` | Synthesize music and SFX (needs `ffmpeg` for OGG/M4A) |
| `npm run validate` | Assert PNG discipline, font coverage, content wiring |
| `npm run assets:all` | All four of the above, in order |
| `npm run assets:preview` | Contact sheet + mock scene into `preview/` |

## Controls

| | Keyboard | Pointer / touch |
|---|---|---|
| Move | Arrows **or** WASD | Tap anywhere to walk there |
| Run | Shift or X | — |
| Talk / confirm | Z, Enter or Space | Tap the object |
| Advance dialogue | Z, Enter or Space | Tap anywhere |
| Choose an option | Arrows + Z | Tap the row |
| Back / cancel | X, Esc or Backspace | Tap the BACK / CANCEL row |

Clicking an object walks the character to it and reads it automatically. A
keypress always cancels an in-progress click-path, on the next tile boundary.

There is no on-screen D-pad or A/B overlay. A touchscreen already has a
pointer, and the overlay covered a third of a phone viewport to duplicate
input the screen accepts directly.

---

## How it is put together

### Everything is generated

There is no art directory to hand-maintain. `tools/art/` draws every asset with
a small pixel toolkit built on a dependency-free PNG encoder:

```
tools/
  png.mjs          PNG encode/decode (zlib only)
  pixel.mjs        Bitmap, string-art parser, 15-bit colour snapping
  art/
    palette.mjs    colours sampled from reference/, snapped to the GBA grid
    chars.mjs      16x24 character sprites, 4 hairstyles, walk + run
    tiles.mjs      terrain and interior tilesets, edge auto-tiling
    props.mjs      buildings, trees, furniture
    ui.mjs         window frames, cursors, spinner, transition masks
    font.mjs       TTF -> BMFont rasteriser
  generate-assets.mjs   orchestrates the above, packs the atlas
  generate-maps.mjs     town + interiors as Tiled JSON + object manifests
  generate-audio.mjs    chiptune synthesis
  validate.mjs          build-time assertions
```

The payoff is that collision, building placement and sprite dimensions cannot
drift apart — the map generator imports the actual building sprite config, so a
building that changes size automatically re-blocks the right tiles.

### The 240x160 rule

The game renders at the GBA's native framebuffer, so one screen is exactly
15x10 tiles and every sprite lands on a whole pixel. Upscaling happens at the
canvas level, snapped to whole multiples (`src/main.ts`), because fractional
scaling makes pixel art shimmer.

### One movement path

The player, every NPC, and every step of a click-path all go through
`GridEntity.tryStep`. There is exactly one movement implementation, which is why
keyboard and mouse movement cannot desync from collision or animation.

Timings are FireRed's: 250 ms per tile walking, 130 ms running, an 80 ms
turn-in-place beat before the first step in a new direction, and an 80 ms input
buffer at the end of each step so held directions produce seamless walking.

### Maps

Maps are generated, not hand-drawn, but they are emitted as **real Tiled JSON**
and can be opened in [Tiled](https://www.mapeditor.org/) for hand editing. Each
map ships two files:

- `<name>.json` — tile layers (`ground`, `decor-below`, `collision`)
- `<name>.objects.json` — a typed manifest of spawns, doors, props, interactables and NPCs

### Content

**Every user-facing string lives in `src/data/content.ts`.** Nothing else in the
codebase contains prose. `npm run validate` asserts that every character in
every string exists in the bitmap font, and that every `contentId` referenced by
a map object resolves to a real dialogue node.

### Accessibility and SEO

The canvas is invisible to crawlers and screen readers, so the full portfolio is
also emitted as semantic HTML by the `staticMirror` plugin in `vite.config.ts`,
generated **from `content.ts` at build time** so it can never drift. On top of
that:

- a skip link ("view as text") is the first focusable element
- dialogue is mirrored into an `aria-live` region as it is revealed
- `<noscript>` renders the full text version

- JSON-LD `Person` schema, Open Graph tags and a 1200x630 preview image are
  generated too, along with `robots.txt` and `sitemap.xml`

---

## Deploying (Netlify)

Config lives in [`netlify.toml`](netlify.toml). Connect the repo in Netlify and
it picks everything up — build command, publish directory, Node version,
security headers and caching. No dashboard settings required.

```bash
# production deploy from your machine
npm run deploy

# draft deploy with a shareable preview URL
npm run deploy:preview

# exactly what Netlify runs
npm run validate && npm run build

# check the production bundle locally first
npm run build && npm run preview
```

**Assets are committed on purpose.** The art generator rasterises the bitmap
font from `reference/pokemon_fire_red.ttf`, which is gitignored and never
deployed, so Netlify *cannot* regenerate `public/assets/`. After changing
anything in `tools/`, run `npm run assets:all` locally and commit the result.
`npm run validate` runs on every deploy and fails it if content and maps have
drifted apart.

**URLs resolve themselves.** Netlify injects `URL` and `DEPLOY_PRIME_URL`, and
`vite.config.ts` uses them for the canonical tag, Open Graph URLs, JSON-LD and
`sitemap.xml` — so branch deploys advertise their own address rather than the
production one. Set `SITE_URL` to override.

### Output layout and caching

| Path | Cache-Control |
|---|---|
| `/build/*` | `max-age=31536000, immutable` — content-hashed by Vite |
| `/assets/*` | `max-age=86400, stale-while-revalidate` — stable names the game loads by path |
| `/index.html` | `max-age=0, must-revalidate` |

Vite's bundle is emitted to `/build`, not `/assets`, so hashed and stable-named
files never share a directory and each can carry the correct cache rule.

A strict Content-Security-Policy is set in `netlify.toml`; the production build
was verified to run under it with zero violations.
