// Overworld character sprites.
//
// Metrics measured from reference/…Overworld NPCs.png: the sheet's cells are
// 16x24 with ~15x20 of content, and the head takes half the sprite's height.
// Sheet layout: 3 cols (neutral, stepA, stepB) x 4 rows (down, up, left, right)
// for the walk block, then the same four rows again for the run block.
import { Bitmap, art, padTop } from '../pixel.mjs';
import { PAL } from './palette.mjs';

export const FRAME_W = 16;
export const FRAME_H = 24;
const CONTENT_H = 20; // rows of actual artwork, bottom-aligned in the frame

function paletteFor(o = {}) {
  return {
    K: PAL.outline,
    H: o.hair ?? PAL.hair,
    h: o.hairHi ?? PAL.hairHi,
    S: o.skin ?? PAL.skin,
    s: o.skinShade ?? PAL.skinShade,
    E: PAL.eye,
    B: o.shirt ?? PAL.shirt,
    b: o.shirtDark ?? PAL.shirtDark,
    W: o.collar ?? PAL.collar,
    P: o.pants ?? PAL.pants,
    p: o.pantsDark ?? PAL.pantsDark,
    O: o.shoe ?? PAL.shoe,
    R: o.bag ?? PAL.bag,
  };
}

// ---------------------------------------------------------------------------
// Hairstyles. Rows 0-9 of every body template are the head; swapping that block
// is what makes the cast read as different people at 16px.
// ---------------------------------------------------------------------------

const HEADS_DOWN = {
  short: [
    '.....KKKKKK.....',
    '...KKHHHHHHKK...',
    '..KHHHHHHHHHHK..',
    '..KHhhHHHHhhHK..',
    '..KHHHHHHHHHHK..',
    '..KSSSSSSSSSSK..',
    '..KSEESSSSEESK..',
    '..KSSSSSSSSSSK..',
    '..KsSSSSSSSSsK..',
    '...KKssssssKK...',
  ],
  spiky: [
    '..K..KKKKK..K...',
    '..KKKHHHHHKKK...',
    '..KHHHHHHHHHK...',
    '.KHHhhHHHhhHHK..',
    '.KHHHHHHHHHHHK..',
    '..KSSSSSSSSSSK..',
    '..KSEESSSSEESK..',
    '..KSSSSSSSSSSK..',
    '..KsSSSSSSSSsK..',
    '...KKssssssKK...',
  ],
  long: [
    '.....KKKKKK.....',
    '...KKHHHHHHKK...',
    '..KHHHHHHHHHHK..',
    '.KHHhhHHHHhhHHK.',
    '.KHHHHHHHHHHHHK.',
    '.KHSSSSSSSSSSHK.',
    '.KHSEESSSSEESHK.',
    '.KHSSSSSSSSSSHK.',
    '.KHsSSSSSSSSsHK.',
    '.KHKKssssssKKHK.',
  ],
  cap: [
    '.....KKKKKK.....',
    '...KKHHHHHHKK...',
    '..KHHHHHHHHHHK..',
    '..KHhhHHHHhhHK..',
    '.KHHHHHHHHHHHHK.',
    '.KKHHHHHHHHHHKK.',
    '..KSSSSSSSSSSK..',
    '..KSEESSSSEESK..',
    '..KsSSSSSSSSsK..',
    '...KKssssssKK...',
  ],
};

const HEADS_SIDE = {
  short: [
    '.....KKKKK......',
    '...KKHHHHHKK....',
    '..KHHHHHHHHK....',
    '..KHhhHHHHHK....',
    '..KHHHHHHSSK....',
    '..KHHHSSSSSK....',
    '..KHHSSEESSK....',
    '..KHSSSSSSSK....',
    '..KsSSSSSSsK....',
    '...KKssssKK.....',
  ],
  spiky: [
    '..K..KKKK.K.....',
    '..KKKHHHHKK.....',
    '.KHHHHHHHHK.....',
    '.KHhhHHHHHHK....',
    '.KHHHHHHHSSK....',
    '..KHHHSSSSSK....',
    '..KHHSSEESSK....',
    '..KHSSSSSSSK....',
    '..KsSSSSSSsK....',
    '...KKssssKK.....',
  ],
  long: [
    '.....KKKKK......',
    '...KKHHHHHKK....',
    '..KHHHHHHHHK....',
    '..KHhhHHHHHK....',
    '..KHHHHHHSSK....',
    '..KHHHSSSSSK....',
    '..KHHSSEESSK....',
    '..KHHSSSSSSK....',
    '..KHsSSSSSsK....',
    '..KHKKssssKK....',
  ],
  cap: [
    '.....KKKKK......',
    '...KKHHHHHKK....',
    '..KHHHHHHHHK....',
    '..KHhhHHHHHK....',
    '.KKHHHHHHHHKK...',
    '..KHHHSSSSSK....',
    '..KHHSSEESSK....',
    '..KHSSSSSSSK....',
    '..KsSSSSSSsK....',
    '...KKssssKK.....',
  ],
};

/** Back of the head: the face becomes hair, so skin and eyes turn into hair. */
function backOfHead(rows) {
  return rows.map((r) => r.replace(/S/g, 'H').replace(/E/g, 'H'));
}

// Rows 0-9 head, 10-15 torso, 16-19 legs.
const BODY_DOWN = [
  ...HEADS_DOWN.short,
  '....KWWWWWWK....',
  '...KBBBBBBBBK...',
  '..KSBBBBBBBBSK..',
  '..KSBBBBBBBBSK..',
  '..KSbBBBBBBbSK..',
  '..KKbBBBBBBbKK..',
  '...KPPPPPPPPK...',
  '...KPPKKKKPPK...',
  '...KOOK..KOOK...',
  '...KKKK..KKKK...',
];

const BODY_UP = [
  ...backOfHead(HEADS_DOWN.short),
  '....KWWWWWWK....',
  '...KBBBBBBBBK...',
  '..KSBbRRRRbBSK..',
  '..KSBbRRRRbBSK..',
  '..KSbbRRRRbbSK..',
  '..KKbBBBBBBbKK..',
  '...KPPPPPPPPK...',
  '...KPPKKKKPPK...',
  '...KOOK..KOOK...',
  '...KKKK..KKKK...',
];

// Right-facing profile; the left-facing row is mirrored from this.
const BODY_SIDE = [
  ...HEADS_SIDE.short,
  '....KWWWWK......',
  '...KBBBBBBK.....',
  '...KBBBBBBK.....',
  '...KBBBBBBK.....',
  '...KbBBBBbK.....',
  '...KbBBBBbK.....',
  '....KPPPPK......',
  '....KPPPPK......',
  '....KOOOOK......',
  '....KKKKKK......',
];

const LEGS_FRONT_A = [
  '...KPPPPPPPPK...',
  '..KPPPKKKKPPK...',
  '..KOOK...KPPK...',
  '..KKKK...KOOK...',
];
const LEGS_FRONT_B = [
  '...KPPPPPPPPK...',
  '...KPPKKKKPPPK..',
  '...KPPK...KOOK..',
  '...KOOK...KKKK..',
];
const LEGS_SIDE_A = [
  '....KPPPPK......',
  '...KPPKPPK......',
  '..KOOK.KOOK.....',
  '..KKKK.KKKK.....',
];
const LEGS_SIDE_B = [
  '....KPPPPK......',
  '....KPPKPPK.....',
  '...KOOK.KOOK....',
  '...KKKK.KKKK....',
];

// Running swings the legs wider and lifts the trailing foot clear of the floor.
const RUN_FRONT_A = [
  '...KPPPPPPPPK...',
  '.KPPPPKKKKPPK...',
  '.KOOK....KPPK...',
  '.KKKK....KOOK...',
];
const RUN_FRONT_B = [
  '...KPPPPPPPPK...',
  '...KPPKKKKPPPPK.',
  '...KPPK....KOOK.',
  '...KOOK....KKKK.',
];
const RUN_SIDE_A = [
  '....KPPPPK......',
  '..KPPPKPPK......',
  '.KOOK..KOOK.....',
  '.KKKK..KKKK.....',
];
const RUN_SIDE_B = [
  '....KPPPPK......',
  '....KPPKPPPK....',
  '...KOOK..KOOK...',
  '...KKKK..KKKK...',
];

function withLegs(rows, block) {
  const out = rows.slice();
  const start = CONTENT_H - block.length;
  for (let i = 0; i < block.length; i++) out[start + i] = block[i];
  return out;
}

/**
 * @param {object} opts palette overrides, e.g. { hair: PAL.npcHairA }
 * @param {boolean} withRun also emit the four run rows
 * @returns {Bitmap} 48 x (96 | 192)
 */
export function buildCharacter(opts = {}, withRun = false) {
  const pal = paletteFor(opts);
  const style = opts.hairStyle ?? 'short';
  const blocks = withRun ? ['walk', 'run'] : ['walk'];
  const sheet = new Bitmap(FRAME_W * 3, FRAME_H * 4 * blocks.length);

  // Swap in this character's head, and optionally an apron down the torso.
  const apron = (rows) =>
    opts.torso === 'apron'
      ? rows.map((r, i) => (i >= 11 && i <= 15 ? r.replace(/BBBB/, 'WWWW') : r))
      : rows;
  const DOWN = apron([...HEADS_DOWN[style], ...BODY_DOWN.slice(10)]);
  const UP = [...backOfHead(HEADS_DOWN[style]), ...BODY_UP.slice(10)];
  const SIDE = apron([...HEADS_SIDE[style], ...BODY_SIDE.slice(10)]);

  blocks.forEach((mode, bi) => {
    const run = mode === 'run';
    const fA = run ? RUN_FRONT_A : LEGS_FRONT_A;
    const fB = run ? RUN_FRONT_B : LEGS_FRONT_B;
    const sA = run ? RUN_SIDE_A : LEGS_SIDE_A;
    const sB = run ? RUN_SIDE_B : LEGS_SIDE_B;

    const dirs = [
      [DOWN, withLegs(DOWN, fA), withLegs(DOWN, fB)],
      [UP, withLegs(UP, fA), withLegs(UP, fB)],
      [SIDE, withLegs(SIDE, sA), withLegs(SIDE, sB)], // left (mirrored)
      [SIDE, withLegs(SIDE, sA), withLegs(SIDE, sB)], // right
    ];

    dirs.forEach((frames, dir) => {
      frames.forEach((rows, f) => {
        let bmp = art(padTop(rows, FRAME_H), pal);
        if (dir === 2) bmp = bmp.flipX();
        const lift = run && f > 0 ? 1 : 0; // slight bob while running
        sheet.blit(bmp, f * FRAME_W, bi * FRAME_H * 4 + dir * FRAME_H - lift);
      });
    });
  });

  return sheet;
}

// Every character differs in hairstyle AND palette, so none of them read as
// a recolour of another.
export const CHARACTERS = {
  player: {
    opts: { hairStyle: 'short' }, // dark hair, blue hoodie
    run: true,
  },
  'npc-professor': {
    opts: {
      hairStyle: 'long',
      hair: PAL.greyDark, hairHi: PAL.grey,
      skin: PAL.npcSkinB, skinShade: PAL.npcSkinBShade,
      shirt: PAL.labCoat, shirtDark: PAL.labCoatDark,
      pants: PAL.greyDeep, pantsDark: PAL.outline, bag: PAL.labCoatDark,
    },
    run: false,
  },
  'npc-townsfolk-a': {
    opts: {
      hairStyle: 'spiky',
      hair: PAL.npcHairA, hairHi: PAL.npcHairAHi,
      shirt: PAL.npcShirtA, shirtDark: PAL.npcShirtADark,
      skin: PAL.npcSkinB, skinShade: PAL.npcSkinBShade,
      pants: PAL.trunkDark, pantsDark: PAL.woodDeep,
      bag: PAL.npcShirtADark,
    },
    run: false,
  },
  'npc-townsfolk-b': {
    opts: {
      hairStyle: 'long',
      hair: PAL.npcHairB, hairHi: PAL.npcHairBHi,
      shirt: PAL.npcShirtB, shirtDark: PAL.npcShirtBDark,
      pants: PAL.woodDark, pantsDark: PAL.woodDeep,
      bag: PAL.npcShirtBDark,
    },
    run: false,
  },
  'npc-trainer': {
    opts: {
      hairStyle: 'spiky',
      hair: PAL.outline, hairHi: PAL.greyDark,
      shirt: PAL.roofRed, shirtDark: PAL.roofRedDark,
      skin: PAL.skin, skinShade: PAL.skinShade,
      pants: PAL.greyDeep, pantsDark: PAL.outline,
      bag: PAL.roofRedDark,
    },
    run: false,
  },
  'npc-clerk': {
    opts: {
      hairStyle: 'cap',
      torso: 'apron',
      hair: PAL.roofBlue, hairHi: PAL.roofBlueLight, // branded cap
      shirt: PAL.roofBlueDark, shirtDark: PAL.uiBorderDark,
      collar: PAL.frameWhite,
      skin: PAL.npcSkinB, skinShade: PAL.npcSkinBShade,
      pants: PAL.greyDeep, pantsDark: PAL.outline,
      bag: PAL.frameWhite,
    },
    run: false,
  },
};
