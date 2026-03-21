// ═══════════════════════════════════════════════════
//  src/story/spriteManager.js
//  Central sprite loader for Story Mode.
//
//  Priority chain:
//    1. sprites/trainers/{name}.png  (user-provided local files)
//    2. PokeAPI CDN URL              (works out of the box online)
//    3. Canvas pixel-art fallback    (always works, no files needed)
//
//  Every load returns an Image object immediately.
//  img.ready === true once it can be drawn.
//  img.failed === true if all sources failed.
//
//  Callers use SpriteManager.drawOrFallback() which
//  automatically picks real sprite vs canvas drawing.
// ═══════════════════════════════════════════════════

const SpriteManager = (() => {

  const LOCAL   = 'sprites/';
  const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/';

  // ── Trainer portrait table ─────────────────────
  // Maps internal key → { localFile, remoteFile }
  // Local:  sprites/trainers/{localFile}.png
  // Remote: {POKEAPI}trainers/{remoteFile}.png
  const TRAINERS = {
    brock:      ['brock',       'brock'],
    misty:      ['misty',       'misty'],
    ltsurge:    ['ltsurge',     'lt-surge'],
    erika:      ['erika',       'erika'],
    koga:       ['koga',        'koga'],
    sabrina:    ['sabrina',     'sabrina'],
    blaine:     ['blaine',      'blaine'],
    giovanni:   ['giovanni',    'giovanni'],
    rival:      ['rival',       'blue'],
    blue:       ['rival',       'blue'],
    red:        ['red',         'red'],
    oak:        ['oak',         'professor-oak'],
    youngster:  ['youngster',   'youngster'],
    lass:       ['lass',        'lass'],
    hiker:      ['hiker',       'hiker'],
    bugcatcher: ['bug-catcher', 'bug-catcher'],
    nurse:      ['nurse',       'nurse'],
    default:    ['youngster',   'youngster'],
  };

  // ── Overworld sprite table ─────────────────────
  // Local only: sprites/overworld/{file}.png
  // Format expected: 48×64 sprite sheet, 3 cols × 4 rows
  //   col 0=idle, col 1=step-left, col 2=step-right
  //   row 0=down, row 1=left, row 2=right, row 3=up
  const OVERWORLD = {
    // Individual player animation frames
    'red_down_idle':    'red_down_idle',
    'red_down_step1':   'red_down_step1',
    'red_down_step2':   'red_down_step2',
    'red_up_idle':      'red_up_idle',
    'red_up_step1':     'red_up_step1',
    'red_up_step2':     'red_up_step2',
    'red_side_idle':    'red_side_idle',
    'red_side_step1':   'red_side_step1',
    'red_side_step2':   'red_side_step2',
    'red_side_r_idle':  'red_side_r_idle',
    'red_side_r_step1': 'red_side_r_step1',
    'red_side_r_step2': 'red_side_r_step2',
    'leaf_down_idle':   'leaf_down_idle',
    'leaf_down_step1':  'leaf_down_step1',
    'leaf_down_step2':  'leaf_down_step2',
    'leaf_up_idle':     'leaf_up_idle',
    'leaf_up_step1':    'leaf_up_step1',
    'leaf_up_step2':    'leaf_up_step2',
    'leaf_side_idle':   'leaf_side_idle',
    'leaf_side_step1':  'leaf_side_step1',
    'leaf_side_step2':  'leaf_side_step2',
    'leaf_side_r_idle': 'leaf_side_r_idle',
    'leaf_side_r_step1':'leaf_side_r_step1',
    'leaf_side_r_step2':'leaf_side_r_step2',
    // NPC overworld sprites — filenames in sprites/overworld/
    red:           'red_down_idle',
    leaf:          'leaf_down_idle',
    rival:         'rival_ow',
    youngster:     'youngster',
    lass:          'lass',
    bugcatcher:    'bugcatcher',
    hiker:         'hiker',
    sailor:        'sailor',
    camper:        'camper',
    picnicker:     'picnicker',
    supernerd:     'supernerd',
    fisherman:     'fisherman',
    blackbelt:     'blackbelt',
    beauty:        'beauty',
    cooltrainer:   'cooltrainer_m',
    scientist:     'scientist',
    gambler:       'gambler',
    channeler:     'channeler',
    pokemaniac:    'pokemaniac',
    burglar:       'burglar',
    cueball:       'cueball',
    rocketgrunt:   'rocketgrunt',
    gentleman:     'gentleman',
    engineer:      'engineer',
    rocker:        'rocker',
    juggler:       'juggler',
    tamer:         'tamer',
    birdkeeper:    'birdkeeper',
    swimmer:       'swimmer_m',
    psychic:       'psychic',
    oak:           'oak_ow',
    brock:         'brock_ow',
    misty:         'misty_ow',
    ltsurge:       'ltsurge_ow',
    erika:         'erika_ow',
    koga:          'koga_ow',
    sabrina:       'sabrina_ow',
    blaine:        'blaine_ow',
    giovanni:      'giovanni_ow',
    nurse:         'nurse_ow',
  };

  // ── Image cache ────────────────────────────────
  const _cache = {};

  // ── Core loader ────────────────────────────────
  // Returns an Image immediately. .ready flips true when drawable.
  // Tries local path first. On error, tries remotePath.
  // On remote success, copies src back to the cached img so
  // all existing references to it automatically become ready.

  function _load(key, localSrc, remoteSrc) {
    if (_cache[key]) return _cache[key];

    const img  = new Image();
    img.ready  = false;
    img.failed = false;
    _cache[key] = img;

    // Callbacks that fire on any resolution (success or final failure)
    // so external waiters can respond
    img._onReady = [];
    function _resolve() {
      img._onReady.forEach(fn => fn(img));
      img._onReady = [];
    }

    function tryRemote() {
      if (!remoteSrc) { img.failed = true; _resolve(); return; }
      const tmp = new Image();
      tmp.onload = () => {
        // Swap src on the cached object — triggers its onload
        img.onload = () => { img.ready = true; _resolve(); };
        img.src = tmp.src;   // will re-trigger img.onload
      };
      tmp.onerror = () => { img.failed = true; _resolve(); };
      tmp.src = remoteSrc;
    }

    img.onload  = () => { img.ready = true; _resolve(); };
    img.onerror = () => { img.ready = false; tryRemote(); };
    img.src     = localSrc;

    return img;
  }

  // ── Public API ─────────────────────────────────

  /**
   * Load a trainer battle portrait.
   * Returns Image immediately — check .ready before drawing.
   * Pass onReady callback to be notified when it loads.
   */
  function trainerPortrait(key, onReady) {
    const entry = TRAINERS[key] || TRAINERS.default;
    const img = _load(
      `trainer:${key}`,
      `${LOCAL}trainers/${entry[0]}.png`,
      `${POKEAPI}trainers/${entry[1]}.png`
    );
    if (onReady) {
      if (img.ready || img.failed) onReady(img);
      else img._onReady.push(onReady);
    }
    return img;
  }

  /**
   * Load an overworld walking sprite (local only).
   * Returns Image or null if key unknown.
   */
  function overworldSprite(key) {
    const file = OVERWORLD[key];
    if (!file) return null;
    return _load(
      `overworld:${key}`,
      `${LOCAL}overworld/${file}.png`,
      null   // no remote source for overworld sprites
    );
  }

  /**
   * Preload all trainer portraits and overworld sprites.
   * Call once when story initialises.
   */
  function preloadAll() {
    Object.keys(TRAINERS).forEach(k => trainerPortrait(k));
    Object.keys(OVERWORLD).forEach(k => overworldSprite(k));
  }

  /**
   * Draw img into ctx at (x,y,w,h), or call fallback() if not ready.
   */
  function drawOrFallback(ctx, img, x, y, w, h, fallback) {
    if (img && img.ready) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    } else if (fallback) {
      fallback();
    }
  }

  /**
   * Set an <img> element's src from a SpriteManager Image,
   * handling the async case cleanly.
   * @param {HTMLImageElement} el   — DOM img element to update
   * @param {Image} smImg           — SpriteManager image object
   * @param {string} [placeholder]  — src to show while loading
   */
  function bindToElement(el, smImg, placeholder, trainerKey) {
    if (!el) return;
    if (!smImg) {
      // No sprite at all — try canvas fallback
      if (trainerKey && typeof TrainerSprites !== 'undefined') {
        const fb = TrainerSprites.get(trainerKey);
        if (fb && fb.src) el.src = fb.src;
      }
      return;
    }
    if (smImg.ready) {
      el.src = smImg.src;
    } else if (smImg.failed) {
      // Remote failed — use canvas-drawn fallback
      if (trainerKey && typeof TrainerSprites !== 'undefined') {
        const fb = TrainerSprites.get(trainerKey);
        if (fb && fb.src) el.src = fb.src;
      } else if (placeholder) {
        el.src = placeholder;
      }
    } else {
      smImg._onReady.push(loaded => {
        if (loaded.ready && loaded.src) {
          el.src = loaded.src;
        } else if (trainerKey && typeof TrainerSprites !== 'undefined') {
          const fb = TrainerSprites.get(trainerKey);
          if (fb && fb.src) el.src = fb.src;
        }
      });
    }
  }

  return {
    trainerPortrait,
    overworldSprite,
    preloadAll,
    drawOrFallback,
    bindToElement,
  };

})();
