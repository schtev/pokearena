#!/usr/bin/env node
// ═══════════════════════════════════════════════════
//  tools/cutSprites.js
//  Cuts individual trainer sprites from a Spriters
//  Resource sheet and saves them into sprites/trainers/
//
//  Usage:
//    node tools/cutSprites.js <path-to-sheet.png>
//
//  Example:
//    node tools/cutSprites.js ~/Downloads/frlg-trainers.png
//
//  Requirements:
//    npm install jimp   (pure JS image library, no native deps)
//
//  The sheet must be the FireRed/LeafGreen trainer sprite
//  sheet from The Spriters Resource (536×1400px).
//  The background colour (orange ~RGB 255,127,38) is made
//  transparent in the output files.
// ═══════════════════════════════════════════════════

const path  = require('path');
const fs    = require('fs');

async function main() {
  const sheetPath = process.argv[2];
  if (!sheetPath) {
    console.error('Usage: node tools/cutSprites.js <sheet.png>');
    process.exit(1);
  }
  if (!fs.existsSync(sheetPath)) {
    console.error('File not found:', sheetPath);
    process.exit(1);
  }

  // Load jimp dynamically (must be installed: npm install jimp)
  let Jimp;
  try {
    Jimp = (await import('jimp')).Jimp ?? require('jimp');
  } catch(e) {
    // Try older require
    try { Jimp = require('jimp'); }
    catch(e2) {
      console.error('jimp not found. Run:  npm install jimp');
      process.exit(1);
    }
  }

  console.log('Loading sheet:', sheetPath);
  const sheet = await Jimp.read(sheetPath);
  const sw = sheet.bitmap.width;
  const sh = sheet.bitmap.height;
  console.log(`Sheet: ${sw}×${sh}px`);

  // ── Grid constants (measured from the FRLG sheet) ──
  // 8 columns, 64px wide, starting at x=8, 1px gap between cells
  const CELL_W  = 64;
  const CELL_H  = 64;
  const COL_X   = [8, 73, 138, 203, 268, 333, 398, 463];

  // Orange background color to make transparent
  // The sheet uses ~RGB(255, 127, 38) ±30 tolerance
  const BG_R = 255, BG_G = 127, BG_B = 38, BG_TOL = 45;

  function isBackground(r, g, b) {
    return (
      Math.abs(r - BG_R) < BG_TOL &&
      Math.abs(g - BG_G) < BG_TOL + 20 &&  // green varies more
      Math.abs(b - BG_B) < BG_TOL
    );
  }

  // ── Sprite definitions ─────────────────────────
  // Format: { filename, col, row_y }
  // col = 0-7 (column index in COL_X)
  // row_y = y pixel where that sprite row begins
  //
  // Sprite rows start at these y values:
  //   Player:         y=42
  //   Rival:          y=142
  //   Regular rows:   y=242, 307, 372, 437, 502, 567
  //   Gym Leaders:    y=667
  //   Elite Four:     y=767
  //   Brendan/May:    y=867
  //   Back rows:      y=967, 1032, 1097, 1162, 1227, 1292 (partial)

  const SPRITES = [
    // Player
    { file: 'red',         col: 0, y: 42  },
    { file: 'leaf',        col: 1, y: 42  },

    // Rival (Blue/Gary)
    { file: 'rival',       col: 0, y: 142 },
    { file: 'rival-late',  col: 1, y: 142 },
    { file: 'rival-champ', col: 2, y: 142 },

    // Regular Trainers — Row 1 (y=242)
    { file: 'youngster',   col: 0, y: 242 },
    { file: 'lass',        col: 1, y: 242 },
    { file: 'bug-catcher', col: 2, y: 242 },
    { file: 'hiker',       col: 3, y: 242 },
    { file: 'camper',      col: 4, y: 242 },
    { file: 'picnicker',   col: 5, y: 242 },
    { file: 'super-nerd',  col: 6, y: 242 },
    { file: 'fisherman',   col: 7, y: 242 },

    // Row 2 (y=307)
    { file: 'sailor',      col: 0, y: 307 },
    { file: 'biker',       col: 1, y: 307 },
    { file: 'hiker2',      col: 2, y: 307 },
    { file: 'gentleman',   col: 3, y: 307 },
    { file: 'rocker',      col: 4, y: 307 },
    { file: 'engineer',    col: 5, y: 307 },
    { file: 'juggler',     col: 6, y: 307 },
    { file: 'blackbelt',   col: 7, y: 307 },

    // Row 3 (y=372)
    { file: 'scientist',   col: 0, y: 372 },
    { file: 'beauty',      col: 1, y: 372 },
    { file: 'psychic',     col: 2, y: 372 },
    { file: 'cooltrainer-m', col: 3, y: 372 },
    { file: 'cooltrainer-f', col: 4, y: 372 },
    { file: 'firebreather', col: 5, y: 372 },
    { file: 'tamer',       col: 6, y: 372 },
    { file: 'birdkeeper',  col: 7, y: 372 },

    // Row 4 (y=437)
    { file: 'channeler',   col: 0, y: 437 },
    { file: 'pokemaniac',  col: 1, y: 437 },
    { file: 'gambler',     col: 2, y: 437 },
    { file: 'swimmer-m',   col: 3, y: 437 },
    { file: 'swimmer-f',   col: 4, y: 437 },
    { file: 'cueball',     col: 5, y: 437 },
    { file: 'burglar',     col: 6, y: 437 },
    { file: 'rocketgrunt-m', col: 7, y: 437 },

    // Row 5 (y=502)
    { file: 'rocketgrunt-f', col: 0, y: 502 },
    { file: 'cue-ball',    col: 1, y: 502 },
    { file: 'tester1',     col: 2, y: 502 },
    { file: 'tester2',     col: 3, y: 502 },
    { file: 'tester3',     col: 4, y: 502 },
    { file: 'tester4',     col: 5, y: 502 },
    { file: 'tester5',     col: 6, y: 502 },
    { file: 'tester6',     col: 7, y: 502 },

    // Row 6 (y=567)
    { file: 'camper2',     col: 0, y: 567 },
    { file: 'picnicker2',  col: 1, y: 567 },
    { file: 'trainer6-3',  col: 2, y: 567 },
    { file: 'trainer6-4',  col: 3, y: 567 },
    { file: 'trainer6-5',  col: 4, y: 567 },

    // Gym Leaders (y=667)
    { file: 'brock',       col: 0, y: 667 },
    { file: 'misty',       col: 1, y: 667 },
    { file: 'ltsurge',     col: 2, y: 667 },
    { file: 'erika',       col: 3, y: 667 },
    { file: 'koga',        col: 4, y: 667 },
    { file: 'sabrina',     col: 5, y: 667 },
    { file: 'blaine',      col: 6, y: 667 },
    { file: 'giovanni',    col: 7, y: 667 },

    // Elite Four (y=767) — Lorelei, Bruno, Agatha, Lance, Blue(champion)
    { file: 'lorelei',     col: 0, y: 767 },
    { file: 'bruno',       col: 1, y: 767 },
    { file: 'agatha',      col: 2, y: 767 },
    { file: 'lance',       col: 3, y: 767 },
    { file: 'champion',    col: 4, y: 767 },

    // Brendan & May (y=867)
    { file: 'brendan',     col: 0, y: 867 },
    { file: 'may',         col: 1, y: 867 },

    // Back sprites (y=967 onwards) — 6 rows of walking animation frames
    { file: 'red-back',    col: 0, y: 967  },
    { file: 'leaf-back',   col: 0, y: 1032 },
    { file: 'oldman-back', col: 0, y: 1097 },
    { file: 'primo-back',  col: 0, y: 1162 },
    { file: 'brendan-back',col: 0, y: 1227 },
    { file: 'may-back',    col: 0, y: 1292 },
  ];

  // ── Output directory ───────────────────────────
  const outDir = path.join(__dirname, '..', 'sprites', 'trainers');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // ── Cut and save ────────────────────────────────
  console.log(`\nCutting ${SPRITES.length} sprites → ${outDir}\n`);
  let ok = 0, skip = 0;

  for (const sp of SPRITES) {
    const x = COL_X[sp.col];
    const y = sp.y;

    // Bounds check
    if (x + CELL_W > sw || y + CELL_H > sh) {
      console.log(`  ⚠ SKIP ${sp.file} (out of bounds: x=${x} y=${y})`);
      skip++;
      continue;
    }

    // Crop cell
    const cell = sheet.clone().crop({ x, y, w: CELL_W, h: CELL_H });

    // Make background transparent
    cell.scan(0, 0, CELL_W, CELL_H, function(px, py, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      if (isBackground(r, g, b)) {
        this.bitmap.data[idx + 3] = 0; // set alpha to 0
      }
    });

    const destPath = path.join(outDir, `${sp.file}.png`);
    await cell.write(destPath);
    process.stdout.write(`  ✓ ${sp.file}.png\n`);
    ok++;
  }

  console.log(`\nDone! ${ok} sprites saved, ${skip} skipped.`);
  console.log(`Output: ${outDir}`);
  console.log('\nNow open index.html — portraits will use these sprites automatically.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
