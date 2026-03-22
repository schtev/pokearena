// ═══════════════════════════════════════════════════
//  src/overworld/tilesetRenderer.js
//  Draws overworld tiles from individual PNG files.
//
//  Each tile is sprites/tiles/tile_R{row}_C{col}.png
//  (e.g. tile_R00_C05.png = row 0, col 5)
//
//  TILE ASSIGNMENTS  (update TILE_MAP below to change)
//  ─────────────────────────────────────────────────
//  Game tile IDs (mapData.js):
//    0 = path/road      1 = plain grass    2 = tall grass
//    3 = tree/wall      4 = water          5 = building wall
//    6 = door           7 = flower         8 = ledge
//    9 = sand/dirt     10 = fence
//
//  Current assignments (verified from tileset image):
//    path        → R00_C05  (teal walkable base)
//    grass       → R00_C05  (same — open grass)
//    tall grass  → R08_C09 + R08_C10  (darker encounter grass)
//    tree        → R00_C04 + R00_C03  (dark tree blob)
//    water       → R01_C16 + R01_C17  (blue water, 2-frame anim)
//    building    → R01_C00 + R01_C01  (tan wall)
//    door        → R01_C02 + R01_C03  (door tile)
//    flower      → R00_C06 + R00_C07  (flower decoration)
//    ledge       → R03_C17 + R04_C17  (grey path, drawn with drop line)
//    sand        → R01_C08 + R01_C09  (cream/sand)
//    fence       → R01_C05 + R01_C06  (fence)
//
//  To reassign a tile: change the filename(s) in TILE_MAP below.
//  Each entry is an array — multiple = variants (animated or
//  position-varied so adjacent tiles don't look identical).
// ═══════════════════════════════════════════════════

const TilesetRenderer = (() => {

  // ── Tile file → game tile ID mapping ───────────
  // Format:  gameId: ['filename', ...]
  // Filenames are relative to sprites/tiles/
  // Multiple filenames = variants. Water animates;
  // others pick variant by map position (stable).

  const TILE_MAP = {
    0:  ['tile_R00_C05'],                        // path (open grass/walkable)
    1:  ['tile_R00_C01', 'tile_R00_C03'],        // plain grass (2 variants)
    2:  ['tile_R00_C04', 'tile_R00_C03'],        // tall grass (encounter)
    3:  ['tile_R04_C09', 'tile_R04_C10'],        // tree / impassable wall
    4:  ['tile_R05_C14', 'tile_R18_C07'],        // water (no anim variant — use same tile)
    5:  ['tile_R18_C10', 'tile_R18_C11'],        // building wall
    6:  ['tile_R10_C08', 'tile_R10_C03'],        // door
    7:  ['tile_R00_C01', 'tile_R00_C03'],        // flower / decoration
    8:  ['tile_R03_C17', 'tile_R04_C17'],        // ledge (path + drop edge)
    9:  ['tile_R06_C12', 'tile_R06_C11'],        // sand / dirt
    10: ['tile_R01_C05', 'tile_R01_C06'],        // fence
  };

  const BASE = 'sprites/tiles/';

  // ── Image cache ─────────────────────────────────
  // Keyed by filename. Each entry: { img, ready, failed }

  const _cache = {};

  function _loadImg(filename) {
    if (_cache[filename]) return _cache[filename];
    const entry = { img: new Image(), ready: false, failed: false };
    entry.img.onload  = () => { entry.ready  = true; };
    entry.img.onerror = () => { entry.failed = true; };
    entry.img.src = BASE + filename + '.png';
    _cache[filename] = entry;
    return entry;
  }

  // ── Public: preload all mapped tiles ───────────

  function preload() {
    const all = new Set();
    for (const variants of Object.values(TILE_MAP)) {
      for (const fname of variants) all.add(fname);
    }
    for (const fname of all) _loadImg(fname);
  }

  // ── Public: is everything loaded? ──────────────

  function isReady() {
    for (const variants of Object.values(TILE_MAP)) {
      for (const fname of variants) {
        const e = _cache[fname];
        if (!e || (!e.ready && !e.failed)) return false;
      }
    }
    return true;
  }

  // ── Public: draw a single game tile ────────────
  // Returns true if drawn from real sprite, false if caller should fallback.

  function drawTile(ctx, tileId, dx, dy, destSize, col, row, waterFrame) {
    const variants = TILE_MAP[tileId];
    if (!variants) return false;

    let fname;
    if (tileId === 4) {
      // Water: animate between variant 0 and 1 based on frame + position
      const idx = Math.floor(((waterFrame >> 2) + col + row)) % variants.length;
      fname = variants[idx];
    } else {
      // Stable positional variant — same tile spot always same graphic
      fname = variants[(col * 7 + row * 3) % variants.length];
    }

    const entry = _cache[fname] || _loadImg(fname);
    if (!entry.ready) return false;   // not loaded yet → use fallback

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(entry.img, dx, dy, destSize, destSize);

    // Extra visual cue for ledge: dark drop edge at bottom
    if (tileId === 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(dx, dy + destSize - Math.max(3, destSize >> 3),
                   destSize, Math.max(3, destSize >> 3));
    }

    return true;
  }

  // ── Public: reassign a tile at runtime ─────────
  // Lets the game or a settings screen swap tile graphics live.
  // e.g. TilesetRenderer.assign(1, ['tile_R00_C05', 'tile_R04_C12'])

  function assign(tileId, filenames) {
    TILE_MAP[tileId] = filenames;
    filenames.forEach(f => _loadImg(f));
  }

  return { preload, isReady, drawTile, assign };

})();