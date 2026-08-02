# Credits

## Artwork

**All pixel art in this project is original and generated from code.** There are
no ripped or third-party image assets in `public/assets/`. Every tileset,
character sprite, building, prop and UI element is drawn procedurally by the
scripts in [`tools/art/`](tools/art/).

## Reference material

The FireRed / LeafGreen sheets in `reference/` were used as **visual reference
only**. They are:

- gitignored (`/reference` in `.gitignore`)
- never imported by the game
- never copied into `public/assets/`
- never deployed

What was taken from them is *measurements and colour values*, not artwork:

| Taken | Where it ended up |
|---|---|
| Overworld sprite cell size (16x24, ~20px of content) | `tools/art/chars.mjs` |
| The outline colour `#414A6A` — a dark blue, never black | `PAL.outline` |
| Terrain colour ramps (mint-teal grass, pale sand paths) | `tools/art/palette.mjs` |
| House construction grammar (ribbed roof, ridge band, dentil edges) | `tools/art/props.mjs` |
| Gym facade grammar (flat slab roof, bays, entrance block) | `tools/art/props.mjs` |

Pokémon, FireRed and LeafGreen are trademarks of Nintendo / Creatures Inc. /
GAME FREAK Inc. This project is not affiliated with, endorsed by, or derived
from their software.

## Font

`public/assets/fonts/font-main.*` and `boot/font-small.*` are rasterised at
build time from `reference/pokemon_fire_red.ttf`.

That TTF is the **FireRed/LeafGreen font recreation built with FontStruct**,
which is distributed under **Creative Commons Attribution-ShareAlike 3.0**
(CC BY-SA 3.0). Attribution is given here as required.

Because the generated bitmap font is a derivative work of a CC BY-SA font, the
font PNG/XML pair inherits the ShareAlike condition. If you replace the TTF with
an original or differently-licensed pixel font, this condition no longer applies
to the rest of the project.

## Audio

All music and sound effects are **original**, synthesized from scratch by
[`tools/generate-audio.mjs`](tools/generate-audio.mjs) — square, triangle and
noise oscillators written to 8-bit WAV, then encoded to OGG/M4A with ffmpeg.
No samples, no loops, no third-party audio.

## Software

- [Phaser 4](https://phaser.io) — MIT
- [easystar.js](https://github.com/prettymuchbryce/easystarjs) — MIT
- [opentype.js](https://github.com/opentypejs/opentype.js) — MIT (build-time only)
- [Vite](https://vite.dev) — MIT
