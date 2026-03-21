#!/usr/bin/env node
// ═══════════════════════════════════════════════════
//  tools/downloadSprites.js
//  One-time sprite downloader for PokéArena Story Mode.
//
//  Run from the project root:
//    node tools/downloadSprites.js
//
//  Downloads trainer portrait sprites from PokeAPI's
//  GitHub repo directly into sprites/trainers/.
//  This means the game works offline after running this.
//
//  Requirements: Node.js 18+ (uses built-in fetch)
// ═══════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/';

// Trainer sprites to download
// Format: [localFilename, remoteFilename]
const TRAINERS = [
  ['brock',       'brock'],
  ['misty',       'misty'],
  ['ltsurge',     'lt-surge'],
  ['erika',       'erika'],
  ['koga',        'koga'],
  ['sabrina',     'sabrina'],
  ['blaine',      'blaine'],
  ['giovanni',    'giovanni'],
  ['rival',       'blue'],
  ['red',         'red'],
  ['oak',         'professor-oak'],
  ['youngster',   'youngster'],
  ['lass',        'lass'],
  ['hiker',       'hiker'],
  ['bug-catcher', 'bug-catcher'],
  ['nurse',       'nurse'],
];

const OUT_DIR = path.join(__dirname, '..', 'sprites', 'trainers');

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Created ${OUT_DIR}`);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    // Skip if already downloaded
    if (fs.existsSync(dest)) {
      console.log(`  ✓ (already exists) ${path.basename(dest)}`);
      return resolve(dest);
    }

    const file = fs.createWriteStream(dest + '.tmp');
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest + '.tmp');
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest + '.tmp');
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          fs.renameSync(dest + '.tmp', dest);
          resolve(dest);
        });
      });
    }).on('error', err => {
      file.close();
      try { fs.unlinkSync(dest + '.tmp'); } catch(_) {}
      reject(err);
    });
  });
}

async function main() {
  console.log('PokéArena Sprite Downloader');
  console.log('===========================');
  console.log(`Downloading ${TRAINERS.length} trainer sprites from PokeAPI...\n`);

  let ok = 0, fail = 0;

  for (const [local, remote] of TRAINERS) {
    const url  = `${BASE_URL}${remote}.png`;
    const dest = path.join(OUT_DIR, `${local}.png`);
    process.stdout.write(`  Downloading ${remote}.png → ${local}.png... `);
    try {
      await download(url, dest);
      console.log('✓');
      ok++;
    } catch (err) {
      console.log(`✗ (${err.message})`);
      fail++;
    }
  }

  console.log(`\nDone! ${ok} downloaded, ${fail} failed.`);
  if (fail > 0) {
    console.log('Failed sprites will fall back to the PokeAPI CDN in-game.');
  }
  console.log('\nYour sprites are in:', OUT_DIR);
  console.log('Open index.html in a browser to play!\n');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
