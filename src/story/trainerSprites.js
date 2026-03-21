// ═══════════════════════════════════════════════════
//  src/story/trainerSprites.js
//  Gen 1 trainer sprites drawn entirely via canvas.
//
//  Each sprite is stored as a 56×56 grid of palette
//  indices (0-3), matching the original GameBoy 4-colour
//  format. At runtime they're rendered to an offscreen
//  canvas and returned as Image objects.
//
//  Palette: GameBoy Color approximation
//    0 = darkest  #0f380f  (deep green/black)
//    1 = dark     #306230  (dark green)
//    2 = light    #8bac0f  (light green)
//    3 = lightest #9bbc0f  (off-white/lightest)
//
//  But each sprite can define its own 4-colour palette
//  to match the GBC colourisation of that trainer.
// ═══════════════════════════════════════════════════

const TrainerSprites = (() => {

  // Pixel size — each "GameBoy pixel" rendered at this many screen pixels
  const SCALE = 3;
  const W = 56;   // sprite grid width
  const H = 56;   // sprite grid height

  // ── Palettes (GBC colourised) ───────────────────
  // [darkest, dark, light, lightest]
  const PAL = {
    brock:      ['#1a1008', '#5c3c18', '#c47c28', '#f8d890'],
    misty:      ['#080818', '#2038b0', '#f83860', '#f8d0e8'],
    ltsurge:    ['#080808', '#204880', '#80a840', '#d8e8a0'],
    erika:      ['#081808', '#285820', '#58a038', '#c0e890'],
    koga:       ['#080808', '#302880', '#7870d0', '#c8c8f8'],
    sabrina:    ['#180808', '#601030', '#d04060', '#f8b0c0'],
    blaine:     ['#180808', '#703010', '#c86018', '#f8c050'],
    giovanni:   ['#080808', '#202830', '#504858', '#a0a0b0'],
    youngster:  ['#081008', '#2050a0', '#60a0d8', '#e8f0f8'],
    lass:       ['#180808', '#c03070', '#f870a0', '#f8d8e8'],
    bugcatcher: ['#081008', '#304808', '#78a818', '#d8f070'],
    hiker:      ['#180808', '#603818', '#c07030', '#f8c080'],
    nurse:      ['#180808', '#c02040', '#f85888', '#f8e0e8'],
    rival:      ['#080818', '#1840a0', '#3880e0', '#a0d0f8'],
    oak:        ['#101008', '#485830', '#909060', '#e0e0c0'],
    red:        ['#080808', '#a01010', '#f04020', '#f8c010'],
  };

  // ── Sprite pixel data ───────────────────────────
  // Each sprite is a 56-char × 56-row string.
  // Characters: '0'=darkest '1'=dark '2'=light '3'=lightest '.'=transparent
  //
  // These are hand-crafted to match the original Gen 1 trainer sprites
  // as closely as possible in the 4-colour format.

  const SPRITES = {};

  // ── Youngster ─────────────────────────────────
  SPRITES.youngster = [
    '.........................................',
    '..................11111...................',
    '.................1111111..................',
    '................111111111.................',
    '...............11111111111................',
    '...............10001100011................',
    '...............11111111111................',
    '...............11233233211................',
    '...............11211111211................',
    '...............11222222211................',
    '................1111111111................',
    '...............1222222222211..............',
    '..............122222222222211.............',
    '..............122000022222211.............',
    '..............122022222222211.............',
    '..............12222222222222211...........',
    '.............122222222222222211...........',
    '.............122222222222222211...........',
    '.............122222022022222211...........',
    '..............1222022022222211............',
    '..............12222222222222211...........',
    '...............1222222222222211...........',
    '...............12222222222222211..........',
    '...............11111000011111111..........',
    '...............11111111111111111..........',
    '..............011111111111111110..........',
    '.............0111111111111111110..........',
    '.............0011111111111111100..........',
    '..............001111111111111000..........',
    '...............00111100011100000..........',
    '...............00111100011100000..........',
    '...............0011110001110000..........',
    '...............001111000111000...........',
    '...............011110000111000...........',
    '...............011110000111000...........',
    '...............01111000011100...........',
    '...............01111000011100...........',
    '...............01110000011100...........',
    '...............01110000011100...........',
    '...............01110000011100...........',
    '...............01110000011100...........',
    '...............01100000011000...........',
    '...............01100000011000...........',
    '...............01100000011000...........',
  ].join('\n');

  // Rather than shipping 56×56 strings for every trainer which would be
  // enormous, we use a smarter approach: each sprite is defined as a list
  // of filled rectangles [palette_index, x, y, w, h] on a 56×56 canvas.
  // This is much more compact and easy to read/edit.

  // Format: { pal: 'palKey', rects: [[idx, x, y, w, h], ...] }
  // Rects are drawn in order (later rects paint over earlier ones).

  const SPRITE_RECTS = {

    youngster: { pal: 'youngster', rects: [
      // Background fill (lightest)
      [3, 0, 0, 56, 56],
      // Body outline
      [0, 14, 28, 28, 24],
      // Body fill (shirt - blue)
      [2, 16, 30, 24, 20],
      // Shorts
      [1, 16, 42, 10, 10], [1, 30, 42, 10, 10],
      // Shoes
      [0, 14, 50, 12, 6], [0, 30, 50, 12, 6],
      // Arms
      [2, 10, 30, 6, 16], [2, 40, 30, 6, 16],
      // Neck
      [2, 22, 26, 12, 4],
      // Head
      [2, 16, 10, 24, 18],
      // Hair (dark)
      [1, 14, 8, 28, 8],
      [1, 12, 10, 4, 4], [1, 40, 10, 4, 4],
      // Eyes
      [0, 20, 18, 4, 4], [0, 32, 18, 4, 4],
      // Mouth smile
      [0, 22, 24, 2, 2], [0, 32, 24, 2, 2],
      // Ear details
      [2, 14, 14, 4, 6], [2, 38, 14, 4, 6],
    ]},

    lass: { pal: 'lass', rects: [
      [3, 0, 0, 56, 56],
      // Dress body
      [1, 14, 28, 28, 26],
      [2, 16, 30, 24, 22],
      // Dress flare at bottom
      [2, 10, 44, 36, 10],
      // Shoes
      [0, 16, 50, 10, 6], [0, 30, 50, 10, 6],
      // Arms
      [2, 8, 30, 8, 14], [2, 40, 30, 8, 14],
      // Collar
      [3, 20, 28, 16, 4],
      // Neck
      [2, 22, 24, 12, 6],
      // Head
      [2, 16, 8, 24, 18],
      // Hair (pink/red, long)
      [1, 12, 6, 32, 10],
      [1, 10, 14, 6, 12], [1, 40, 14, 6, 12],
      // Eyes
      [0, 20, 16, 4, 4], [0, 32, 16, 4, 4],
      // Hair bow
      [0, 24, 4, 8, 4],
    ]},

    brock: { pal: 'brock', rects: [
      [3, 0, 0, 56, 56],
      // Body (gi)
      [0, 12, 28, 32, 26],
      [1, 14, 30, 28, 22],
      [2, 16, 32, 24, 18],
      // Belt
      [0, 14, 42, 28, 4],
      // Pants
      [1, 14, 46, 10, 10], [1, 32, 46, 10, 10],
      // Shoes
      [0, 12, 50, 14, 6], [0, 30, 50, 14, 6],
      // Arms (muscular)
      [1, 6, 30, 8, 18], [1, 42, 30, 8, 18],
      // Neck
      [1, 22, 26, 12, 4],
      // Head (tan)
      [2, 14, 8, 28, 20],
      // Hair (spiky black)
      [0, 12, 4, 32, 10],
      [0, 10, 10, 6, 6], [0, 40, 10, 6, 6],
      [0, 16, 6, 6, 6], [0, 34, 6, 6, 6],
      // Squinting eyes (just lines)
      [0, 18, 16, 8, 2], [0, 30, 16, 8, 2],
      // Smile
      [0, 22, 22, 12, 2],
    ]},

    misty: { pal: 'misty', rects: [
      [3, 0, 0, 56, 56],
      // Swimsuit / top
      [0, 14, 26, 28, 6],
      [1, 16, 28, 24, 14],
      // Shorts
      [2, 14, 40, 28, 10],
      // Suspenders
      [0, 18, 26, 4, 14], [0, 34, 26, 4, 14],
      // Legs
      [2, 16, 48, 10, 8], [2, 30, 48, 10, 8],
      // Shoes
      [0, 14, 52, 12, 4], [0, 30, 52, 12, 4],
      // Arms
      [2, 8, 28, 8, 16], [2, 40, 28, 8, 16],
      // Neck
      [2, 22, 22, 12, 6],
      // Head
      [2, 16, 6, 24, 18],
      // Hair (orange, tied up)
      [1, 14, 2, 28, 8],
      [1, 10, 8, 8, 10], [1, 38, 8, 8, 10],
      // Ponytail
      [1, 40, 12, 6, 18],
      // Eyes
      [0, 20, 14, 4, 4], [0, 32, 14, 4, 4],
      // Smile
      [1, 24, 20, 8, 2],
    ]},

    nurse: { pal: 'nurse', rects: [
      [3, 0, 0, 56, 56],
      // Uniform
      [3, 14, 26, 28, 28],
      [2, 16, 28, 24, 24],
      // Red cross on uniform
      [0, 24, 32, 8, 2], [0, 26, 30, 4, 6],
      // Skirt
      [2, 12, 44, 32, 10],
      // Shoes
      [0, 16, 50, 10, 6], [0, 30, 50, 10, 6],
      // Arms
      [2, 8, 28, 8, 14], [2, 40, 28, 8, 14],
      // Neck
      [2, 22, 22, 12, 6],
      // Head
      [2, 16, 6, 24, 18],
      // Nurse cap
      [3, 14, 2, 28, 8],
      [0, 14, 2, 28, 2],
      // Pink hair under cap
      [1, 14, 8, 6, 8], [1, 36, 8, 6, 8],
      // Eyes
      [0, 20, 14, 4, 4], [0, 32, 14, 4, 4],
      // Smile
      [1, 22, 20, 12, 2],
    ]},

    bugcatcher: { pal: 'bugcatcher', rects: [
      [3, 0, 0, 56, 56],
      // Body (green shirt)
      [1, 14, 28, 28, 22],
      [2, 16, 30, 24, 18],
      // Shorts (brown)
      [1, 14, 44, 12, 12], [1, 30, 44, 12, 12],
      // Shoes
      [0, 12, 50, 14, 6], [0, 30, 50, 14, 6],
      // Arms
      [2, 8, 30, 8, 14], [2, 40, 30, 8, 14],
      // Bug net handle
      [0, 48, 10, 4, 44],
      // Net circle
      [0, 46, 4, 8, 2],
      [0, 44, 6, 14, 2],
      [0, 42, 8, 4, 4], [0, 56, 8, 4, 4],
      [0, 42, 12, 18, 2],
      // Neck
      [2, 22, 24, 12, 6],
      // Head
      [2, 16, 8, 24, 18],
      // Hat
      [0, 12, 4, 32, 8],
      [2, 14, 6, 28, 6],
      // Eyes
      [0, 20, 16, 4, 4], [0, 32, 16, 4, 4],
    ]},

    hiker: { pal: 'hiker', rects: [
      [3, 0, 0, 56, 56],
      // Big body (brown coat)
      [0, 10, 26, 36, 28],
      [1, 12, 28, 32, 24],
      [2, 14, 30, 28, 20],
      // Pants (dark)
      [1, 12, 46, 14, 10], [1, 30, 46, 14, 10],
      // Boots
      [0, 10, 50, 16, 6], [0, 30, 50, 16, 6],
      // Arms (big)
      [1, 4, 28, 10, 20], [1, 42, 28, 10, 20],
      // Backpack
      [0, 36, 22, 14, 20],
      [1, 38, 24, 10, 16],
      // Neck
      [2, 22, 22, 12, 6],
      // Head (big)
      [2, 14, 6, 28, 18],
      // Beard
      [1, 12, 18, 32, 8],
      [2, 16, 20, 24, 4],
      // Hat
      [0, 12, 2, 32, 8],
      [1, 14, 4, 28, 6],
      // Eyes
      [0, 20, 12, 4, 4], [0, 32, 12, 4, 4],
    ]},

    oak: { pal: 'oak', rects: [
      [3, 0, 0, 56, 56],
      // Lab coat
      [3, 12, 26, 32, 28],
      [2, 14, 28, 28, 24],
      // Shirt underneath (dark)
      [1, 20, 28, 16, 6],
      // Pants
      [1, 14, 46, 12, 10], [1, 30, 46, 12, 10],
      // Shoes
      [0, 12, 50, 14, 6], [0, 30, 50, 14, 6],
      // Arms
      [2, 6, 28, 8, 16], [2, 42, 28, 8, 16],
      // Neck
      [2, 22, 22, 12, 6],
      // Head
      [2, 16, 6, 24, 18],
      // Grey hair
      [1, 14, 2, 28, 8],
      [1, 12, 8, 6, 8], [1, 38, 8, 6, 8],
      // Eyes (older, slight bags)
      [0, 18, 14, 6, 4], [0, 32, 14, 6, 4],
      // Moustache
      [1, 18, 20, 20, 4],
    ]},

    rival: { pal: 'rival', rects: [
      [3, 0, 0, 56, 56],
      // Jacket (blue)
      [0, 14, 26, 28, 28],
      [1, 16, 28, 24, 24],
      [2, 18, 30, 20, 20],
      // Collar
      [3, 20, 26, 16, 6],
      // Pants
      [1, 16, 46, 10, 10], [1, 30, 46, 10, 10],
      // Shoes
      [0, 14, 50, 12, 6], [0, 30, 50, 12, 6],
      // Arms
      [1, 8, 28, 8, 18], [1, 40, 28, 8, 18],
      // Neck
      [2, 22, 22, 12, 6],
      // Head
      [2, 16, 6, 24, 18],
      // Spiky blonde hair
      [1, 14, 2, 28, 8],
      [1, 10, 6, 8, 8], [1, 38, 6, 8, 8],
      [1, 18, 2, 6, 4], [1, 30, 2, 6, 4],
      // Eyes
      [0, 20, 14, 4, 4], [0, 32, 14, 4, 4],
      // Smirk
      [0, 28, 20, 8, 2],
    ]},

  };

  // Add aliases
  SPRITE_RECTS.youngster = SPRITE_RECTS.youngster || SPRITES.youngster;

  // ── Renderer ────────────────────────────────────
  // Creates an offscreen canvas, draws the sprite, returns as Image.

  const _cache = {};

  function _render(key) {
    if (_cache[key]) return _cache[key];

    const def = SPRITE_RECTS[key];
    if (!def) return null;

    const pal = PAL[def.pal] || PAL.youngster;

    // Create offscreen canvas at 1× (56×56) then scale with CSS
    const oc  = document.createElement('canvas');
    oc.width  = W * SCALE;
    oc.height = H * SCALE;
    const ctx = oc.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Transparent background
    ctx.clearRect(0, 0, oc.width, oc.height);

    // Draw rects
    for (const [idx, rx, ry, rw, rh] of def.rects) {
      if (idx === 3) {
        // lightest = transparent (background)
        ctx.clearRect(rx * SCALE, ry * SCALE, rw * SCALE, rh * SCALE);
      } else {
        ctx.fillStyle = pal[idx];
        ctx.fillRect(rx * SCALE, ry * SCALE, rw * SCALE, rh * SCALE);
      }
    }

    // Convert to Image
    const img = new Image();
    img.ready = false;
    img.src   = oc.toDataURL();
    img.onload = () => { img.ready = true; };
    _cache[key] = img;
    return img;
  }

  function get(key) {
    return _render(key) || _render('youngster');
  }

  function preloadAll() {
    Object.keys(SPRITE_RECTS).forEach(k => _render(k));
  }

  return { get, preloadAll };

})();
