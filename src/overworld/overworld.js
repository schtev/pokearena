// ═══════════════════════════════════════════════════
//  src/overworld/overworld.js
//  Tile-based overworld renderer + player movement.
//
//  Renders to a <canvas> element inside screen-overworld.
//  Player is a coloured square with directional arrow
//  (proper sprite sheet would be a drop-in swap later).
//
//  Systems handled here:
//    - Tile rendering (colour-coded per type)
//    - Player movement (arrow keys + WASD)
//    - Collision detection (blocked tiles + OOB)
//    - NPC rendering + line-of-sight triggers
//    - Map exit detection + map transition
//    - Tall grass encounter rolls
//    - Dialogue system (typewriter + choices)
//    - Pokémon Center healing
//    - HUD: map name, badge count, player name
// ═══════════════════════════════════════════════════

const Overworld = (() => {

  // ─── Constants ────────────────────────────────
  const TILE_SIZE = 40;   // pixels per tile (canvas)
  const MOVE_COOLDOWN = 160;  // ms between moves (held key)
  const ENCOUNTER_RATE = 0.15;  // 15% per grass step

  const BLOCKED_TILES = new Set([3,4,5,10]);
  const GRASS_TILE    = 2;

  // Sprite loading is handled by SpriteManager (src/story/spriteManager.js).
  // It tries sprites/ folder first, falls back to PokeAPI URLs.
  // _getPortrait() is a thin wrapper used by dialogue + NPC drawing.
  function _getPortrait(spriteKey) {
    return (typeof SpriteManager !== 'undefined')
      ? SpriteManager.trainerPortrait(spriteKey)
      : null;
  }
  function _getOverworldSprite(spriteKey) {
    return (typeof SpriteManager !== 'undefined')
      ? SpriteManager.overworldSprite(spriteKey)
      : null;
  }
  function _preloadSprites() {
    if (typeof SpriteManager !== 'undefined') SpriteManager.preloadAll();
  }

  // ─── State ────────────────────────────────────
  let canvas, ctx;
  let currentMap  = null;
  let playerX     = 4;
  let playerY     = 4;
  let playerDir   = 'down';   // 'up'|'down'|'left'|'right'
  let mapName     = '';
  let lastMove    = 0;
  let keys        = {};
  let dialogueQueue = [];
  let dialogueActive = false;
  let dialogueOnDone = null;
  let moveEnabled    = true;

  // Screen DOM refs (injected)
  let _overlayEl, _dialogEl, _dialogText, _dialogPrompt, _dialogName, _hudName, _hudBadges, _hudMap;

  // ─── HTML injection ───────────────────────────

  function _buildHTML() {
    return `
<div id="screen-overworld" class="screen">
  <div class="ow-hud">
    <div class="ow-hud-left">
      <span class="ow-hud-trainer" id="ow-hud-trainer">Red</span>
      <span class="ow-hud-map"    id="ow-hud-map">Pallet Town</span>
    </div>
    <div class="ow-hud-badges" id="ow-hud-badges" title="Badges"></div>
    <button class="ow-menu-btn" onclick="Overworld.openMenu()">☰</button>
  </div>
  <canvas id="ow-canvas" class="ow-canvas"></canvas>
  <div class="ow-dialogue hidden" id="ow-dialogue">
    <img class="ow-dialogue-portrait" id="ow-dialogue-portrait" src="" alt="" style="display:none">
    <div class="ow-dialogue-body">
      <div class="ow-dialogue-name" id="ow-dialogue-name"></div>
      <div class="ow-dialogue-text" id="ow-dialogue-text"></div>
    </div>
    <div class="ow-dialogue-prompt" id="ow-dialogue-prompt">▼</div>
  </div>
  <div class="ow-controls">
    <div class="ow-dpad">
      <button class="ow-dpad-btn ow-up"    onpointerdown="Overworld._dpadPress('up')"    onpointerup="Overworld._dpadRelease('up')">▲</button>
      <button class="ow-dpad-btn ow-left"  onpointerdown="Overworld._dpadPress('left')"  onpointerup="Overworld._dpadRelease('left')">◀</button>
      <button class="ow-dpad-btn ow-right" onpointerdown="Overworld._dpadPress('right')" onpointerup="Overworld._dpadRelease('right')">▶</button>
      <button class="ow-dpad-btn ow-down"  onpointerdown="Overworld._dpadPress('down')"  onpointerup="Overworld._dpadRelease('down')">▼</button>
    </div>
    <button class="ow-action-btn" onpointerdown="Overworld._interact()">A</button>
  </div>
  <div class="ow-story-menu hidden" id="ow-story-menu">
    <div class="ow-sm-panel">

      <!-- Tab bar -->
      <div class="ow-sm-tabs">
        <button class="ow-sm-tab ow-sm-active" onclick="Overworld._menuTab('party')">👾 Party</button>
        <button class="ow-sm-tab" onclick="Overworld._menuTab('bag')">🎒 Bag</button>
        <button class="ow-sm-tab" onclick="Overworld._menuTab('badges')">🏅 Badges</button>
        <button class="ow-sm-tab" onclick="Overworld._menuTab('map')">🗺️ Map</button>
        <button class="ow-sm-tab" onclick="Overworld._menuTab('save')">⚙️ Save</button>
      </div>

      <!-- Party tab -->
      <div class="ow-sm-content" id="ow-sm-party">
        <div class="ow-sm-party-grid" id="ow-sm-party-grid"></div>
      </div>

      <!-- Bag tab -->
      <div class="ow-sm-content hidden" id="ow-sm-bag">
        <div class="ow-sm-money" id="ow-sm-money">₽ 0</div>
        <div class="ow-sm-bag-list" id="ow-sm-bag-list"></div>
      </div>

      <!-- Badges tab -->
      <div class="ow-sm-content hidden" id="ow-sm-badges">
        <div class="ow-sm-badge-grid" id="ow-sm-badge-grid"></div>
      </div>

      <!-- Map tab -->
      <div class="ow-sm-content hidden" id="ow-sm-map">
        <div class="ow-sm-map-area" id="ow-sm-map-area"></div>
      </div>

      <!-- Save/Settings tab -->
      <div class="ow-sm-content hidden" id="ow-sm-save">
        <div class="ow-sm-trainer-card" id="ow-sm-trainer-card"></div>
        <div class="ow-sm-save-buttons">
          <button class="big-btn secondary" onclick="SaveSystem.save(); Overworld._menuToast('Game saved!')">
            💾 Save Game
          </button>
          <button class="big-btn secondary" onclick="Overworld.closeMenu(); Screen.show('screen-menu')">
            ← Main Menu
          </button>
        </div>
      </div>

      <button class="ow-sm-close-btn" onclick="Overworld.closeMenu()">✕ Close</button>
    </div>
  </div>
  <div class="ow-sm-toast hidden" id="ow-sm-toast"></div>
</div>`;
  }

  function _injectCSS() {
    if (document.getElementById('ow-styles')) return;
    const s = document.createElement('style');
    s.id = 'ow-styles';
    s.textContent = `
#screen-overworld {
  background: #1a1d2e;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  position: relative;
}
.ow-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 14px;
  background: rgba(13,15,26,0.9);
  border-bottom: 2px solid var(--border);
  z-index: 10;
  flex-shrink: 0;
}
.ow-hud-left { display:flex; flex-direction:column; gap:2px; }
.ow-hud-trainer {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--accent-yellow);
}
.ow-hud-map {
  font-size: 12px;
  color: var(--text-muted);
}
.ow-hud-badges {
  display: flex;
  gap: 6px;
  align-items: center;
}
.ow-badge-icon {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
}
.ow-badge-icon.earned { border-color: var(--accent-yellow); background: var(--accent-yellow); }
.ow-menu-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
}
.ow-canvas {
  display: block;
  image-rendering: pixelated;
  flex: 1;
  max-height: calc(100vh - 200px);
  cursor: default;
}
/* Dialogue */
.ow-dialogue {
  position: absolute;
  bottom: 110px;
  left: 10px; right: 10px;
  background: var(--bg-panel);
  border: 3px solid var(--accent-yellow);
  border-radius: var(--radius-md);
  padding: 10px 14px 26px;
  z-index: 20;
  min-height: 80px;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.ow-dialogue.hidden { display: none !important; }
.ow-dialogue-portrait {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  flex-shrink: 0;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-dark);
  object-fit: contain;
}
.ow-dialogue-body {
  flex: 1;
  min-width: 0;
}
.ow-dialogue-name {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--accent-yellow);
  margin-bottom: 6px;
  min-height: 14px;
}
.ow-dialogue-text {
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  min-height: 42px;
}
.ow-dialogue-prompt {
  position: absolute;
  bottom: 6px; right: 12px;
  color: var(--accent-yellow);
  font-size: 12px;
  animation: blink 1s ease-in-out infinite;
}
/* D-Pad controls */
.ow-controls {
  position: absolute;
  bottom: 10px;
  left: 0; right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 20px;
  z-index: 15;
  pointer-events: none;
}
.ow-dpad {
  display: grid;
  grid-template-columns: 44px 44px 44px;
  grid-template-rows: 44px 44px;
  gap: 2px;
  pointer-events: all;
}
.ow-dpad-btn {
  background: rgba(26,29,46,0.9);
  border: 2px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.ow-dpad-btn:active { background: var(--bg-card); }
.ow-up    { grid-column: 2; grid-row: 1; }
.ow-left  { grid-column: 1; grid-row: 2; }
.ow-right { grid-column: 3; grid-row: 2; }
.ow-down  { grid-column: 2; grid-row: 2; }
.ow-action-btn {
  pointer-events: all;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--accent-red);
  border: 3px solid #b71c1c;
  color: #fff;
  font-family: var(--font-pixel);
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 4px 0 #7f0000;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
/* Pause menu */
.ow-pause-menu {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}
.ow-pause-menu.hidden { display: none !important; }
.ow-pause-card {
  background: var(--bg-panel);
  border: 2px solid var(--border-bright);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 260px;
}
.ow-pause-title {
  font-family: var(--font-pixel);
  font-size: 12px;
  color: var(--text-primary);
  text-align: center;
}
.ow-pause-stats {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.7;
}
    `;
    document.head.appendChild(s);
  }

  // ─── Canvas setup ─────────────────────────────

  function _setupCanvas() {
    canvas = document.getElementById('ow-canvas');
    ctx    = canvas.getContext('2d');
    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);
  }

  function _resizeCanvas() {
    if (!canvas || !currentMap) return;
    const mapW = currentMap.width  * TILE_SIZE;
    const mapH = currentMap.height * TILE_SIZE;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight - 200;
    const scale = Math.min(maxW / mapW, maxH / mapH, 1);
    canvas.width  = mapW;
    canvas.height = mapH;
    canvas.style.width  = Math.floor(mapW * scale) + 'px';
    canvas.style.height = Math.floor(mapH * scale) + 'px';
  }

  // ─── Pixel-art tile drawing ───────────────────
  // Each function draws one TILE_SIZE × TILE_SIZE tile
  // at canvas coords (x, y). All colours are the Gen 1
  // GameBoy Color palette approximation.

  const T = TILE_SIZE;

  // ── Pixel-pattern tile engine ─────────────────
  // Each tile is defined as an 8×8 grid of colour indices.
  // Colours are rendered at P = T/8 pixels each,
  // giving an authentic chunky GameBoy look.
  //
  // Palette per tile: [darkest, dark, light, lightest]
  // Index: 0=darkest  1=dark  2=light  3=lightest
  // '_' = transparent (skip — draws nothing, lets base show)

  const P = T / 8; // pixel size (5px at T=40)

  function _drawPattern(px0, py0, pattern, palette) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = pattern[row][col];
        if (idx === '_') continue;
        ctx.fillStyle = palette[idx];
        ctx.fillRect(px0 + col*P, py0 + row*P, P, P);
      }
    }
  }

  // ── Tile patterns (8×8, index into palette) ────

  // Walkable path — Gen 1 grey brick
  const PAT_PATH = [
    [2,2,2,2,2,2,2,2],
    [1,1,1,0,1,1,1,0],
    [2,2,2,2,2,2,2,2],
    [2,2,2,2,2,2,2,2],
    [0,1,1,1,0,1,1,1],
    [2,2,2,2,2,2,2,2],
    [2,2,2,2,2,2,2,2],
    [1,0,1,1,1,0,1,1],
  ];
  const PAL_PATH = ['#787868','#909080','#b8b8a0','#d8d8c0'];

  // Walkable grass — bright green checkerboard
  const PAT_GRASS = [
    [2,3,2,3,2,3,2,3],
    [3,2,3,2,3,2,3,2],
    [2,3,2,3,2,3,2,3],
    [1,2,1,2,1,2,1,2],
    [2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2],
    [2,3,2,3,2,3,2,3],
    [3,2,3,2,3,2,3,2],
  ];
  const PAL_GRASS = ['#308010','#50a828','#78d040','#a0e860'];

  // Tall grass — darker, with blade shapes
  const PAT_TALL = [
    [1,2,1,1,2,1,1,2],
    [2,1,2,1,1,2,1,1],
    [0,2,1,2,1,1,2,1],
    [1,0,2,1,2,1,0,2],
    [2,1,0,2,1,2,1,0],
    [1,2,1,0,2,1,2,1],
    [0,1,2,1,1,0,1,2],
    [1,0,1,2,0,1,2,1],
  ];
  const PAL_TALL = ['#186008','#287818','#3ca028','#58c040'];

  // Tree canopy — dark green block with highlight
  const PAT_TREE = [
    [0,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,1,2,2,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,0,0,0,0,0,0],
  ];
  const PAL_TREE = ['#082808','#104810','#207020','#38a030'];

  // Water — base layer (animated shimmer drawn on top)
  const PAT_WATER_A = [
    [1,1,2,2,1,1,2,2],
    [1,2,2,3,2,2,3,2],
    [2,2,3,2,2,3,2,2],
    [2,1,2,2,1,2,2,1],
    [1,1,2,2,1,1,2,2],
    [2,2,3,2,2,3,2,2],
    [2,3,2,2,3,2,2,3],
    [1,2,2,1,2,2,1,2],
  ];
  const PAT_WATER_B = [
    [2,2,1,1,2,2,1,1],
    [2,3,2,2,3,2,2,3],
    [3,2,2,3,2,2,3,2],
    [1,2,1,1,2,1,1,2],
    [2,2,1,1,2,2,1,1],
    [3,2,2,3,2,2,3,2],
    [2,2,3,2,2,3,2,2],
    [2,1,2,2,1,2,2,1],
  ];
  const PAL_WATER = ['#0830a0','#1850c8','#2878e8','#68b0f8'];

  // Building wall — grey blocks with dark outline
  const PAT_BLDG = [
    [0,1,1,1,0,1,1,1],
    [1,2,2,2,1,2,2,2],
    [1,2,2,2,1,2,2,2],
    [0,1,1,0,1,1,1,0],
    [1,2,2,1,2,2,2,1],
    [1,2,2,1,2,2,2,1],
    [1,2,2,1,2,2,2,1],
    [0,1,1,0,1,1,1,0],
  ];
  const PAL_BLDG = ['#606060','#909090','#c0c0c0','#e0e0e0'];

  // Door — building base with brown door + gold knob
  const PAT_DOOR = [
    [1,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,1],
    [1,2,0,0,0,0,2,1],
    [1,2,0,3,3,0,2,1],
    [1,2,0,3,3,0,2,1],
    [1,2,0,2,0,0,2,1],
    [0,2,0,0,0,0,2,0],
    [3,3,3,3,3,3,3,3],
  ];
  const PAL_DOOR = ['#603818','#c0c0c0','#e0e0e0','#f0f0e8'];

  // Sand / dirt path
  const PAT_SAND = [
    [2,3,2,3,3,2,3,2],
    [3,2,3,2,2,3,2,3],
    [2,3,1,3,3,1,3,2],
    [3,2,3,2,2,3,2,3],
    [2,3,3,1,1,3,3,2],
    [3,2,2,3,3,2,2,3],
    [2,3,3,2,2,3,3,2],
    [3,2,2,3,3,2,2,3],
  ];
  const PAL_SAND = ['#b09050','#c8a860','#e0c078','#f0d898'];

  // Fence
  const PAT_FENCE = [
    [2,1,2,2,2,2,1,2],
    [1,2,1,1,1,1,2,1],
    [2,1,2,2,2,2,1,2],
    [0,1,0,0,0,0,1,0],
    [2,1,2,2,2,2,1,2],
    [1,2,1,1,1,1,2,1],
    [2,1,2,2,2,2,1,2],
    [0,1,0,0,0,0,1,0],
  ];
  const PAL_FENCE = ['#604020','#8a6030','#b08040','#d0a860'];

  // Flower (on grass base)
  const PAT_FLOWER = [
    [2,3,2,3,2,3,2,3],
    [3,2,3,2,3,2,3,2],
    [2,3,0,3,2,3,0,3],
    [1,2,3,2,1,2,3,2],
    [2,3,2,3,2,3,2,3],
    [3,0,3,2,3,0,3,2],
    [2,3,2,3,2,3,2,3],
    [3,2,3,2,3,2,3,2],
  ];
  const PAL_FLOWER = ['#e82898','#78d040','#a0e860','#f8f860'];

  // Ledge (path with drop indicator at bottom)
  const PAT_LEDGE = [
    [2,2,2,2,2,2,2,2],
    [1,1,1,0,1,1,1,0],
    [2,2,2,2,2,2,2,2],
    [2,2,2,2,2,2,2,2],
    [0,1,1,1,0,1,1,1],
    [2,2,2,2,2,2,2,2],
    [0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1],
  ];
  const PAL_LEDGE = ['#505040','#707060','#b8b8a0','#d8d8c0'];

  let _waterFrame = 0;
  let _waterTick  = 0; // slow down water animation

  function _tilePath(x, y)    { _drawPattern(x,y, PAT_PATH,  PAL_PATH);  }
  function _tileGrass(x, y)   { _drawPattern(x,y, PAT_GRASS, PAL_GRASS); }
  function _tileTallGrass(x,y){ _drawPattern(x,y, PAT_TALL,  PAL_TALL);  }
  function _tileTree(x, y)    { _drawPattern(x,y, PAT_TREE,  PAL_TREE);  }
  function _tileBuilding(x,y) { _drawPattern(x,y, PAT_BLDG,  PAL_BLDG);  }
  function _tileDoor(x, y)    { _drawPattern(x,y, PAT_DOOR,  PAL_DOOR);  }
  function _tileSand(x, y)    { _drawPattern(x,y, PAT_SAND,  PAL_SAND);  }
  function _tileFence(x, y)   { _drawPattern(x,y, PAT_FENCE, PAL_FENCE); }
  function _tileFlower(x, y)  { _drawPattern(x,y, PAT_FLOWER,PAL_FLOWER);}
  function _tileLedge(x, y)   { _drawPattern(x,y, PAT_LEDGE, PAL_LEDGE); }

  function _tileWater(x, y, col, row) {
    // Alternate between two wave patterns every 8 frames
    const pat = ((_waterFrame + col + row) % 8 < 4) ? PAT_WATER_A : PAT_WATER_B;
    _drawPattern(x, y, pat, PAL_WATER);
  }

  function _drawTile(tileId, x, y, col, row) {
    // Try the real tileset first (if loaded)
    if (typeof TilesetRenderer !== 'undefined' && TilesetRenderer.isReady()) {
      TilesetRenderer.drawTile(ctx, tileId, x, y, T, col, row, _waterFrame);
      return;
    }
    // Pixel-pattern fallback (always works, no files needed)
    switch(tileId) {
      case 0: _tilePath(x, y);            break;
      case 1: _tileGrass(x, y);           break;
      case 2: _tileTallGrass(x, y);       break;
      case 3: _tileTree(x, y);            break;
      case 4: _tileWater(x, y, col, row); break;
      case 5: _tileBuilding(x, y);        break;
      case 6: _tileDoor(x, y);            break;
      case 7: _tileFlower(x, y);          break;
      case 8: _tileLedge(x, y);           break;
      case 9: _tileSand(x, y);            break;
      case 10: _tileFence(x, y);          break;
      default:
        _tileGrass(x, y);  // safe fallback
    }
  }

  // Flower tile (decorative, walkable)
  function _tileFlower(x, y) {
    _tileGrass(x, y); // grass base
    const cols = ['#f8f840','#f840f8','#f84040'];
    [[4,4],[10,8],[6,12],[12,4]].forEach(([fx,fy],i) => {
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(x+fx,   y+fy,   4, 4);
      ctx.fillStyle = cols[i%3];
      ctx.fillRect(x+fx+1, y+fy+1, 2, 2);
    });
  }

  // Ledge tile — looks like a path with a small drop edge
  function _tileLedge(x, y) {
    _tilePath(x, y);
    ctx.fillStyle = '#806040';
    ctx.fillRect(x, y+T-4, T, 4); // dark edge at bottom
    ctx.fillStyle = '#a08050';
    ctx.fillRect(x, y+T-6, T, 2);
  }

  // ─── Pixel-art character drawing ─────────────
  // Draws a 16×16 sprite (scaled to TILE_SIZE) using
  // a compact pixel definition array:
  // Each entry: [x, y, w, h, colour] in a 16×16 grid.
  // Scaled by T/16 to fill the tile.

  const S = T / 16; // scale factor (2.5 at T=40)

  // ── Player (Red) — 4 directions × 2 walk frames ──
  // Frame 0 = idle/left-foot, Frame 1 = right-foot
  // Hat: red cap #e83030, brim: #282828
  // Skin: #f8c880, shirt: #e83030, jeans: #3858c0
  // Bag strap: #b07840, shoes: #282828
  const PLAYER_PIXELS = {
    down: [
      // hat crown
      [4,0,8,2,'#e83030'],[3,1,10,2,'#e83030'],
      // brim
      [2,3,12,2,'#282828'],
      // face
      [4,4,8,5,'#f8c880'],
      // eyes
      [5,6,2,2,'#282828'],[9,6,2,2,'#282828'],
      // shirt
      [3,9,10,4,'#e83030'],
      // bag strap
      [2,9,2,6,'#b07840'],
      // jeans
      [3,13,4,3,'#3858c0'],[9,13,4,3,'#3858c0'],
      // shoes
      [3,15,4,1,'#282828'],[9,15,4,1,'#282828'],
    ],
    down_walk: [
      [4,0,8,2,'#e83030'],[3,1,10,2,'#e83030'],
      [2,3,12,2,'#282828'],
      [4,4,8,5,'#f8c880'],
      [5,6,2,2,'#282828'],[9,6,2,2,'#282828'],
      [3,9,10,4,'#e83030'],
      [2,9,2,6,'#b07840'],
      // legs shifted — right foot forward
      [3,13,4,3,'#3858c0'],[9,13,4,3,'#3858c0'],
      [4,15,3,1,'#282828'],[10,14,3,1,'#282828'],
    ],
    up: [
      [4,0,8,2,'#e83030'],[3,1,10,2,'#e83030'],
      [2,3,12,2,'#282828'],
      // back of head/hair
      [4,4,8,5,'#c8a060'],
      // shirt back
      [3,9,10,4,'#e83030'],
      [2,9,2,6,'#b07840'],
      [3,13,4,3,'#3858c0'],[9,13,4,3,'#3858c0'],
      [3,15,4,1,'#282828'],[9,15,4,1,'#282828'],
    ],
    up_walk: [
      [4,0,8,2,'#e83030'],[3,1,10,2,'#e83030'],
      [2,3,12,2,'#282828'],
      [4,4,8,5,'#c8a060'],
      [3,9,10,4,'#e83030'],
      [2,9,2,6,'#b07840'],
      [3,13,4,3,'#3858c0'],[9,13,4,3,'#3858c0'],
      [4,15,3,1,'#282828'],[10,14,3,1,'#282828'],
    ],
    left: [
      // hat (facing left — slightly offset brim)
      [4,0,8,2,'#e83030'],[2,1,10,2,'#e83030'],
      [1,3,11,2,'#282828'],
      // face side-on
      [4,4,7,5,'#f8c880'],
      // one eye (far side)
      [8,6,2,2,'#282828'],
      // shirt
      [3,9,10,4,'#e83030'],
      // bag on back (right side from viewer = far side)
      [11,9,2,6,'#b07840'],[12,9,2,6,'#8a5820'],
      [3,13,4,3,'#3858c0'],[8,13,4,3,'#3858c0'],
      [3,15,4,1,'#282828'],[8,15,4,1,'#282828'],
    ],
    left_walk: [
      [4,0,8,2,'#e83030'],[2,1,10,2,'#e83030'],
      [1,3,11,2,'#282828'],
      [4,4,7,5,'#f8c880'],
      [8,6,2,2,'#282828'],
      [3,9,10,4,'#e83030'],
      [11,9,2,6,'#b07840'],[12,9,2,6,'#8a5820'],
      [3,13,4,3,'#3858c0'],[8,13,4,3,'#3858c0'],
      // walk: feet alternate
      [3,15,4,1,'#282828'],[9,14,3,1,'#282828'],
    ],
    right: [
      [4,0,8,2,'#e83030'],[4,1,10,2,'#e83030'],
      [4,3,11,2,'#282828'],
      [5,4,7,5,'#f8c880'],
      [6,6,2,2,'#282828'],
      [3,9,10,4,'#e83030'],
      [2,9,2,6,'#b07840'],[1,9,2,6,'#8a5820'],
      [4,13,4,3,'#3858c0'],[9,13,4,3,'#3858c0'],
      [4,15,4,1,'#282828'],[9,15,4,1,'#282828'],
    ],
    right_walk: [
      [4,0,8,2,'#e83030'],[4,1,10,2,'#e83030'],
      [4,3,11,2,'#282828'],
      [5,4,7,5,'#f8c880'],
      [6,6,2,2,'#282828'],
      [3,9,10,4,'#e83030'],
      [2,9,2,6,'#b07840'],[1,9,2,6,'#8a5820'],
      [4,13,4,3,'#3858c0'],[9,13,4,3,'#3858c0'],
      [5,15,3,1,'#282828'],[9,14,4,1,'#282828'],
    ],
  };

  let _walkFrame    = 0; // 0 or 1
  let _walkCounter  = 0; // increments on each move
  function _tickWalk() {
    _walkCounter++;
    _walkFrame = _walkCounter % 2;
  }

  // Generic NPC shapes — one per archetype
  // ── Character pixel sprites ────────────────────
  // Format: [gridX, gridY, width, height, colour] on a 16×16 grid.
  // S = T/16 scales each unit to canvas pixels.
  // 'up' sprites show the back of the character.
  // 'left'/'right' show the side profile.
  // _getPixels() falls back to 'down' if direction not defined.

  const NPC_PIXELS = {

    youngster: {
      down: [
        [5,0,6,4,'#201808'],                         // dark hair
        [4,2,8,4,'#f8c880'],                         // face
        [5,4,2,2,'#201808'],[9,4,2,2,'#201808'],     // eyes
        [4,7,8,5,'#3070e0'],                         // shirt
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],   // arms
        [4,12,3,4,'#a06820'],[9,12,3,4,'#a06820'],  // shorts
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],  // shoes
      ],
      up: [
        [5,0,6,4,'#201808'],
        [4,2,8,4,'#c8a060'],                         // back of head
        [4,7,8,5,'#3070e0'],
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],
        [4,12,3,4,'#a06820'],[9,12,3,4,'#a06820'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      left: [
        [4,0,7,4,'#201808'],
        [4,2,7,4,'#f8c880'],
        [8,4,2,2,'#201808'],                         // one eye (far side)
        [4,7,8,5,'#3070e0'],
        [11,8,2,4,'#f8c880'],                        // arm on right side
        [4,12,3,4,'#a06820'],[8,12,3,4,'#a06820'],
        [4,15,4,1,'#282828'],
      ],
      right: [
        [5,0,7,4,'#201808'],
        [5,2,7,4,'#f8c880'],
        [6,4,2,2,'#201808'],
        [4,7,8,5,'#3070e0'],
        [3,8,2,4,'#f8c880'],
        [4,12,3,4,'#a06820'],[9,12,3,4,'#a06820'],
        [8,15,4,1,'#282828'],
      ],
    },

    lass: {
      down: [
        [4,0,8,2,'#f05090'],[4,1,8,3,'#f05090'],    // pink hair
        [5,3,6,3,'#f8c880'],                         // face
        [5,5,2,2,'#201808'],[9,5,2,2,'#201808'],
        [4,7,8,5,'#f050a0'],                         // top
        [3,8,2,3,'#f8c880'],[11,8,2,3,'#f8c880'],
        [3,12,10,4,'#f87090'],                       // skirt
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      up: [
        [4,0,8,5,'#f05090'],
        [5,3,6,3,'#f8d090'],
        [4,7,8,5,'#f050a0'],
        [3,8,2,3,'#f8c880'],[11,8,2,3,'#f8c880'],
        [3,12,10,4,'#f87090'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      left: [
        [4,0,8,5,'#f05090'],
        [4,3,7,3,'#f8c880'],
        [8,5,2,2,'#201808'],
        [4,7,8,5,'#f050a0'],
        [11,8,2,3,'#f8c880'],
        [3,12,10,4,'#f87090'],
        [4,15,4,1,'#282828'],
      ],
      right: [
        [4,0,8,5,'#f05090'],
        [5,3,7,3,'#f8c880'],
        [6,5,2,2,'#201808'],
        [4,7,8,5,'#f050a0'],
        [3,8,2,3,'#f8c880'],
        [3,12,10,4,'#f87090'],
        [8,15,4,1,'#282828'],
      ],
    },

    nurse: {
      down: [
        [5,0,6,2,'#f8a0a0'],                         // nurse cap
        [4,1,8,1,'#f8f8f8'],[6,1,4,1,'#e83030'],    // cap stripe
        [5,2,6,4,'#f8c880'],                         // face
        [5,4,2,2,'#201808'],[9,4,2,2,'#201808'],
        [4,7,8,5,'#f8f8f8'],                         // white uniform
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],
        [4,12,8,4,'#f8f8f8'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      up: [
        [5,0,6,2,'#f8a0a0'],[4,1,8,1,'#f8f8f8'],
        [5,2,6,4,'#f8d090'],
        [4,7,8,5,'#f8f8f8'],
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],
        [4,12,8,4,'#f8f8f8'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      left: [
        [5,0,6,2,'#f8a0a0'],[4,1,8,1,'#f8f8f8'],
        [5,2,6,4,'#f8c880'],[9,4,2,2,'#201808'],
        [4,7,8,5,'#f8f8f8'],[11,8,2,4,'#f8c880'],
        [4,12,8,4,'#f8f8f8'],
        [4,15,4,1,'#282828'],
      ],
      right: [
        [5,0,6,2,'#f8a0a0'],[4,1,8,1,'#f8f8f8'],
        [5,2,6,4,'#f8c880'],[5,4,2,2,'#201808'],
        [4,7,8,5,'#f8f8f8'],[3,8,2,4,'#f8c880'],
        [4,12,8,4,'#f8f8f8'],
        [8,15,4,1,'#282828'],
      ],
    },

    oak: {
      down: [
        [5,0,6,5,'#909070'],                         // grey hair
        [5,2,6,4,'#f8c880'],
        [5,4,2,2,'#201808'],[9,4,2,2,'#201808'],
        [3,7,10,5,'#d8d8c8'],                        // white lab coat
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],
        [5,12,2,4,'#404030'],[9,12,2,4,'#404030'],  // dark trousers
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      up: [
        [5,0,6,5,'#909070'],
        [5,2,6,4,'#d0b080'],
        [3,7,10,5,'#d8d8c8'],
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],
        [5,12,2,4,'#404030'],[9,12,2,4,'#404030'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      left: [
        [5,0,6,5,'#909070'],
        [5,2,6,4,'#f8c880'],[9,4,2,2,'#201808'],
        [3,7,10,5,'#d8d8c8'],[11,8,2,4,'#f8c880'],
        [5,12,2,4,'#404030'],[9,12,2,4,'#404030'],
        [4,15,4,1,'#282828'],
      ],
      right: [
        [5,0,6,5,'#909070'],
        [5,2,6,4,'#f8c880'],[5,4,2,2,'#201808'],
        [3,7,10,5,'#d8d8c8'],[3,8,2,4,'#f8c880'],
        [5,12,2,4,'#404030'],[9,12,2,4,'#404030'],
        [8,15,4,1,'#282828'],
      ],
    },

    rival: {
      down: [
        [4,0,8,3,'#f8d840'],                         // spiky blonde hair
        [3,1,2,3,'#f8d840'],[11,1,2,3,'#f8d840'],
        [5,2,6,4,'#f8c880'],
        [5,4,2,2,'#201808'],[9,4,2,2,'#201808'],
        [4,7,8,5,'#3068b8'],                         // blue jacket
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],
        [4,12,3,4,'#202060'],[9,12,3,4,'#202060'],  // navy jeans
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      up: [
        [4,0,8,3,'#f8d840'],
        [3,1,2,3,'#f8d840'],[11,1,2,3,'#f8d840'],
        [5,2,6,4,'#d0a060'],
        [4,7,8,5,'#3068b8'],
        [3,8,2,4,'#f8c880'],[11,8,2,4,'#f8c880'],
        [4,12,3,4,'#202060'],[9,12,3,4,'#202060'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      left: [
        [4,0,8,4,'#f8d840'],[3,1,2,3,'#f8d840'],
        [5,2,6,4,'#f8c880'],[9,4,2,2,'#201808'],
        [4,7,8,5,'#3068b8'],[11,8,2,4,'#f8c880'],
        [4,12,3,4,'#202060'],[8,12,3,4,'#202060'],
        [4,15,4,1,'#282828'],
      ],
      right: [
        [4,0,8,4,'#f8d840'],[11,1,2,3,'#f8d840'],
        [5,2,6,4,'#f8c880'],[5,4,2,2,'#201808'],
        [4,7,8,5,'#3068b8'],[3,8,2,4,'#f8c880'],
        [4,12,3,4,'#202060'],[9,12,3,4,'#202060'],
        [8,15,4,1,'#282828'],
      ],
    },

    brock: {
      down: [
        [4,0,8,5,'#201808'],                         // dark spiky hair
        [5,2,6,4,'#c89060'],                         // tan face
        [5,4,2,1,'#201808'],[9,4,2,1,'#201808'],    // squinting (thin line)
        [4,7,8,5,'#a07040'],                         // tan/brown gi
        [3,8,2,4,'#c89060'],[11,8,2,4,'#c89060'],
        [4,12,3,4,'#604820'],[9,12,3,4,'#604820'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      up: [
        [4,0,8,5,'#201808'],
        [5,2,6,4,'#a07030'],
        [4,7,8,5,'#a07040'],
        [3,8,2,4,'#c89060'],[11,8,2,4,'#c89060'],
        [4,12,3,4,'#604820'],[9,12,3,4,'#604820'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      left: [
        [4,0,8,5,'#201808'],
        [5,2,6,4,'#c89060'],[9,4,2,1,'#201808'],
        [4,7,8,5,'#a07040'],[11,8,2,4,'#c89060'],
        [4,12,3,4,'#604820'],[8,12,3,4,'#604820'],
        [4,15,4,1,'#282828'],
      ],
      right: [
        [4,0,8,5,'#201808'],
        [5,2,6,4,'#c89060'],[5,4,2,1,'#201808'],
        [4,7,8,5,'#a07040'],[3,8,2,4,'#c89060'],
        [4,12,3,4,'#604820'],[9,12,3,4,'#604820'],
        [8,15,4,1,'#282828'],
      ],
    },

    misty: {
      down: [
        [4,0,8,2,'#f87830'],                         // orange hair
        [3,1,3,4,'#f87830'],[10,1,3,4,'#f87830'],   // pigtails
        [5,2,6,3,'#f8c880'],
        [5,4,2,2,'#201808'],[9,4,2,2,'#201808'],
        [4,7,8,4,'#f8a050'],                         // orange crop top
        [3,8,2,3,'#f8c880'],[11,8,2,3,'#f8c880'],
        [4,11,8,5,'#3070e0'],                        // blue shorts
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      up: [
        [4,0,8,2,'#f87830'],
        [3,1,3,4,'#f87830'],[10,1,3,4,'#f87830'],
        [5,2,6,3,'#d09050'],
        [4,7,8,4,'#f8a050'],
        [3,8,2,3,'#f8c880'],[11,8,2,3,'#f8c880'],
        [4,11,8,5,'#3070e0'],
        [4,15,3,1,'#282828'],[9,15,3,1,'#282828'],
      ],
      left: [
        [4,0,8,2,'#f87830'],[10,1,3,4,'#f87830'],
        [5,2,6,3,'#f8c880'],[9,4,2,2,'#201808'],
        [4,7,8,4,'#f8a050'],[11,8,2,3,'#f8c880'],
        [4,11,8,5,'#3070e0'],
        [4,15,4,1,'#282828'],
      ],
      right: [
        [4,0,8,2,'#f87830'],[3,1,3,4,'#f87830'],
        [5,2,6,3,'#f8c880'],[5,4,2,2,'#201808'],
        [4,7,8,4,'#f8a050'],[3,8,2,3,'#f8c880'],
        [4,11,8,5,'#3070e0'],
        [8,15,4,1,'#282828'],
      ],
    },

  };
  // All facings fall back to 'down' if not defined
  function _getPixels(map, dir) {
    return map[dir] || map.down || [];
  }

  function _drawPixelSprite(pixels, tx, ty, greyed) {
    for (const [px, py, pw, ph, col] of pixels) {
      ctx.fillStyle = greyed ? '#808080' : col;
      ctx.fillRect(tx + px*S, ty + py*S, pw*S, ph*S);
    }
  }

  // ─── Rendering ────────────────────────────────

  function _render() {
    if (!ctx || !currentMap) return;
    ctx.imageSmoothingEnabled = false; // pixel-perfect scaling
    const { tiles, npcs, exits } = currentMap;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let row = 0; row < currentMap.height; row++) {
      for (let col = 0; col < currentMap.width; col++) {
        _drawTile(tiles[row][col], col*T, row*T, col, row);
      }
    }

    // Draw NPCs
    for (const npc of (npcs || [])) {
      _drawNPC(npc);
    }

    // Draw player
    _drawPlayer();
  }

  function _drawNPC(npc) {
    const tx = npc.x * T;
    const ty = npc.y * T;
    const isDefeated = StorySave.hasDefeatedNPC(npc.id);
    const facing     = npc._activeFacing || npc.facing || 'down';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(tx + T/2, ty + T - 3, T*0.35, 3, 0, 0, Math.PI*2);
    ctx.fill();

    // Try real overworld sprite (individual PNG — one facing per file)
    const owSprite = _getOverworldSprite(npc.sprite);
    if (owSprite && owSprite.ready) {
      ctx.imageSmoothingEnabled = false;
      if (isDefeated) {
        ctx.globalAlpha = 0.5;
      }
      // Our individual sprites are single frames — just draw directly
      ctx.drawImage(owSprite, tx, ty, T, T);
      ctx.globalAlpha = 1.0;
    } else {
      // Pixel-art fallback
      const pixelDef = NPC_PIXELS[npc.sprite] || NPC_PIXELS.youngster;
      const pixels   = _getPixels(pixelDef, facing);
      _drawPixelSprite(pixels, tx, ty, isDefeated);
    }

    // Exclamation mark for unbattled trainer in sight range
    if (!isDefeated && (npc.isBattleTrigger || npc.isGymLeader) && npc.sightRange > 0) {
      ctx.fillStyle = '#f8c800';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', tx + T/2, ty - 2);
    }
  }

  function _drawPlayer() {
    const tx = playerX * T;
    const ty = playerY * T;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(tx + T/2, ty + T - 3, T*0.35, 3, 0, 0, Math.PI*2);
    ctx.fill();

    // Pick sprite set by gender
    const gender    = (typeof StorySave !== 'undefined') ? StorySave.getGender() : 'male';
    const charName  = gender === 'female' ? 'leaf' : 'red';

    // Direction → row/frame mapping for our individual sprite files
    // Files: {char}_{dir}_{idle|step1|step2}.png
    // Dirs: down, up, side (left), side_r (right)
    const dirMap = { down:'down', up:'up', left:'side', right:'side_r' };
    const dir    = dirMap[playerDir] || 'down';
    const frames = [`${charName}_${dir}_idle`, `${charName}_${dir}_step1`, `${charName}_${dir}_step2`];
    const frameIdx = _walkFrame === 0 ? 0 : (_walkCounter % 2 === 0 ? 1 : 2);
    const spriteName = frames[frameIdx];

    const sp = _getOverworldSprite(spriteName);
    if (sp && sp.ready) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sp, tx, ty, T, T);
    } else {
      // Pixel-art fallback
      const frameKey = _walkFrame === 1 ? `${playerDir}_walk` : playerDir;
      const pixels = PLAYER_PIXELS[frameKey] || PLAYER_PIXELS[playerDir] || [];
      _drawPixelSprite(pixels, tx, ty, false);
    }
  }

  // ─── Collision & movement ─────────────────────

  function _isTileBlocked(x, y) {
    if (!currentMap) return true;
    if (x < 0 || y < 0 || x >= currentMap.width || y >= currentMap.height) return true;
    const tileId = currentMap.tiles[y][x];
    return BLOCKED_TILES.has(tileId);
  }

  function _isNPCAt(x, y) {
    if (!currentMap) return null;
    return (currentMap.npcs || []).find(n => n.x === x && n.y === y) || null;
  }

  function _getExitAt(x, y) {
    if (!currentMap) return null;
    return (currentMap.exits || []).find(e => e.x === x && e.y === y) || null;
  }

  function _tryMove(dir) {
    if (!moveEnabled || dialogueActive) return;

    const now = performance.now();
    if (now - lastMove < MOVE_COOLDOWN) return;
    lastMove = now;

    playerDir = dir;

    let nx = playerX;
    let ny = playerY;
    if (dir === 'up')    ny--;
    if (dir === 'down')  ny++;
    if (dir === 'left')  nx--;
    if (dir === 'right') nx++;

    // Check exit first (even before collision)
    const exit = _getExitAt(nx, ny);
    if (exit) {
      _warpTo(exit.toMap, exit.toX, exit.toY);
      return;
    }

    if (_isTileBlocked(nx, ny)) { _render(); return; }
    if (_isNPCAt(nx, ny)) { _render(); return; }

    playerX = nx;
    playerY = ny;
    _tickWalk(); // animate walk frame

    // Check NPC sight-line (trainers that charge you)
    _checkTrainerSight();

    // Check wild encounter
    const tile = currentMap.tiles[playerY]?.[playerX];
    if (tile === GRASS_TILE && Math.random() < ENCOUNTER_RATE) {
      _triggerWildEncounter();
      return;
    }

    // Check standing-on-exit (for door tiles like pokecenter)
    const standExit = _getExitAt(playerX, playerY);
    if (standExit) {
      _warpTo(standExit.toMap, standExit.toX, standExit.toY);
      return;
    }

    _render();
  }

  // ─── NPC interactions ─────────────────────────

  function _interact() {
    if (dialogueActive) { _advanceDialogue(); return; }

    // Face-ahead tile
    let tx = playerX, ty = playerY;
    if (playerDir === 'up')    ty--;
    if (playerDir === 'down')  ty++;
    if (playerDir === 'left')  tx--;
    if (playerDir === 'right') tx++;

    // Sign?
    const sign = (currentMap.signs || []).find(s => s.x === tx && s.y === ty);
    if (sign) { _startDialogue(null, sign.text.split('\n')); return; }

    // NPC?
    const npc = _isNPCAt(tx, ty);
    if (npc) { _talkToNPC(npc); return; }
  }

  function _talkToNPC(npc) {
    const isDefeated = StorySave.hasDefeatedNPC(npc.id);
    const lines = isDefeated && npc.defeatedDialogue
      ? npc.defeatedDialogue
      : npc.dialogue || [];

    // Substitute {player} and {rival} and {starter}
    const sub = (str) => str
      .replace(/\{player\}/g, StorySave.getPlayerName())
      .replace(/\{rival\}/g,  StorySave.getRivalName())
      .replace(/\{starter\}/g, () => {
        const k = StorySave.getStarterKey();
        return k ? POKEMON_DATA[k]?.name || k : 'partner';
      });

    const subLines = lines.map(sub);

    // Portrait from PokeAPI trainer sprites
    const portrait = _getPortrait(npc.sprite || 'default');

    if (npc.isHealer) {
      _startDialogue(npc.name, subLines, () => _healTeam(), portrait);
      return;
    }

    if (npc.isGymLeader && !isDefeated) {
      _startDialogue(npc.name, subLines, () => _startGymBattle(npc), portrait);
      return;
    }

    if (npc.isBattleTrigger && !isDefeated) {
      _startDialogue(npc.name, subLines, () => _startTrainerBattle(npc), portrait);
      return;
    }

    _startDialogue(npc.name, subLines, null, portrait);
  }

  function _checkTrainerSight() {
    for (const npc of (currentMap.npcs || [])) {
      if (!npc.isBattleTrigger && !npc.isGymLeader) continue;
      if (StorySave.hasDefeatedNPC(npc.id)) continue;
      const range = npc.sightRange || 0;
      if (range === 0) continue;

      let inSight = false;
      if (npc.facing === 'down'  && playerX === npc.x && playerY > npc.y && playerY <= npc.y + range) inSight = true;
      if (npc.facing === 'up'    && playerX === npc.x && playerY < npc.y && playerY >= npc.y - range) inSight = true;
      if (npc.facing === 'right' && playerY === npc.y && playerX > npc.x && playerX <= npc.x + range) inSight = true;
      if (npc.facing === 'left'  && playerY === npc.y && playerX < npc.x && playerX >= npc.x - range) inSight = true;

      if (inSight) {
        // Turn NPC to face the player before dialogue
        if      (npc.facing === 'down'  && playerY > npc.y) npc._activeFacing = 'down';
        else if (npc.facing === 'up'    && playerY < npc.y) npc._activeFacing = 'up';
        else if (npc.facing === 'right' && playerX > npc.x) npc._activeFacing = 'right';
        else if (npc.facing === 'left'  && playerX < npc.x) npc._activeFacing = 'left';

        const portrait = _getPortrait(npc.sprite || 'default');
        const lines = (npc.dialogue || []).map(l =>
          l.replace(/\{player\}/g, StorySave.getPlayerName())
        );
        _startDialogue(npc.name, lines, () => _startTrainerBattle(npc), portrait);
        return;
      }
    }
  }

  // ─── Dialogue system ──────────────────────────
  // Queue-based typewriter dialogue. Each call to
  // _advanceDialogue() shows the next line.
  // onDone is called after the last line.

  let _typingTimer  = null;
  let _typingFull   = '';
  let _typingIdx    = 0;

  function _startDialogue(speakerName, lines, onDone, portraitUrl) {
    dialogueActive    = true;
    moveEnabled       = false;
    dialogueQueue     = [...lines];
    dialogueOnDone    = onDone || null;

    const dlg      = document.getElementById('ow-dialogue');
    const nameEl   = document.getElementById('ow-dialogue-name');
    const portraitEl = document.getElementById('ow-dialogue-portrait');
    if (dlg)    dlg.classList.remove('hidden');
    if (nameEl) nameEl.textContent = speakerName || '';
    if (portraitEl) {
      if (portraitUrl && typeof SpriteManager !== 'undefined') {
        SpriteManager.bindToElement(portraitEl, portraitUrl);
        // Show element — bindToElement handles async src swap
        portraitEl.style.display = 'block';
        // Hide if it ultimately fails
        portraitUrl._onReady = portraitUrl._onReady || [];
        portraitUrl._onReady.push(img => {
          if (img.failed || !img.src) portraitEl.style.display = 'none';
        });
      } else {
        portraitEl.style.display = 'none';
      }
    }

    _showNextLine();
  }

  function _showNextLine() {
    if (dialogueQueue.length === 0) {
      _endDialogue();
      return;
    }
    const line = dialogueQueue.shift();
    _typeText(line);
  }

  function _typeText(text) {
    const el = document.getElementById('ow-dialogue-text');
    if (!el) return;
    clearTimeout(_typingTimer);
    _typingFull = text;
    _typingIdx  = 0;
    el.textContent = '';

    function tick() {
      _typingIdx++;
      el.textContent = _typingFull.slice(0, _typingIdx);
      if (_typingIdx < _typingFull.length) {
        _typingTimer = setTimeout(tick, 28);
      }
    }
    tick();
  }

  function _advanceDialogue() {
    // If still typing, show full text first
    const el = document.getElementById('ow-dialogue-text');
    if (el && el.textContent.length < _typingFull.length) {
      clearTimeout(_typingTimer);
      el.textContent = _typingFull;
      _typingIdx = _typingFull.length;
      return;
    }
    _showNextLine();
  }

  function _endDialogue() {
    dialogueActive = false;
    moveEnabled    = true;
    const dlg = document.getElementById('ow-dialogue');
    if (dlg) dlg.classList.add('hidden');
    // Reset any temporary facing overrides on all NPCs
    if (currentMap) {
      for (const npc of (currentMap.npcs || [])) delete npc._activeFacing;
    }
    if (dialogueOnDone) {
      const cb = dialogueOnDone;
      dialogueOnDone = null;
      cb();
    }
  }

  // ─── Map transitions ──────────────────────────

  function _warpTo(mapId, toX, toY) {
    const mapDef = MapData.getMap(mapId);
    if (!mapDef) { console.error('Map not found:', mapId); return; }

    currentMap = mapDef;
    playerX    = toX;
    playerY    = toY;
    StorySave.setLocation(mapId);
    _updateHUD();
    _resizeCanvas();
    _render();

    // Flash effect
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      setTimeout(() => _render(), 120);
    }
  }

  // ─── Battles ──────────────────────────────────

  function _startTrainerBattle(npc) {
    if (!npc.battleTeam || npc.battleTeam.length === 0) return;
    moveEnabled = false;

    const enemyTeam = npc.battleTeam.map(entry =>
      createPokemonInstance(entry.key, entry.level)
    ).filter(Boolean);

    if (enemyTeam.length === 0) return;

    // Always use story party — completely independent of Team Builder
    const playerTeam = StorySave.buildBattleParty();
    if (playerTeam.length === 0) {
      _startDialogue(null, ['Something went wrong — no party found!']);
      return;
    }

    _launchStoryBattle(playerTeam, enemyTeam, npc);
  }

  function _startGymBattle(npc) {
    const badgeIndex = npc.gymIndex;
    if (StorySave.getBadges()[badgeIndex]) {
      // Already have badge — just show defeated dialogue
      const defLines = (npc.defeatedDialogue || ['You already have the ' + npc.badgeName + '!']).map(l =>
        l.replace(/\{player\}/g, StorySave.getPlayerName()));
      _startDialogue(npc.name, defLines);
      return;
    }
    _startTrainerBattle(npc);
  }

  function _launchStoryBattle(playerTeam, enemyTeam, npc) {
    // Store which NPC we're fighting so we can award badge after
    _launchStoryBattle._pendingNPC = npc;

    Screen.show('screen-battle');
    Battle.start(playerTeam, enemyTeam, {
      cpuTier: npc.isGymLeader ? 3 : 2,
      storyNPC: npc,
      onWin:  () => _onStoryBattleWin(npc),
      onLose: () => _onStoryBattleLose(),
    });
  }
  _launchStoryBattle._pendingNPC = null;

  function _onStoryBattleWin(npc) {
    StorySave.defeatNPC(npc.id);
    // Sync level-ups earned during battle back to story save
    StorySave.syncPartyFromBattle(Battle.playerTeam || []);
    const lines = [];
    if (npc.isGymLeader) {
      StorySave.earnBadge(npc.gymIndex);
      lines.push(`You got the ${npc.badgeName}!`);
    }
    if (npc.reward?.money) {
      StorySave.addMoney(npc.reward.money);
      lines.push(`${npc.name} paid ₽${npc.reward.money}.`);
    }

    // Return to overworld
    Screen.show('screen-overworld');
    _updateHUD();
    _render();

    if (lines.length > 0) {
      setTimeout(() => _startDialogue(null, lines), 300);
    }
  }

  function _onStoryBattleLose() {
    Screen.show('screen-overworld');
    // Heal and penalize
    _healTeam();
    _render();
    setTimeout(() => {
      _startDialogue(null, [
        "You blacked out!",
        "You were taken to the nearest Pokémon Center.",
      ]);
    }, 300);
  }

  function _triggerWildEncounter() {
    const wild = MapData.rollWildPokemon(currentMap.id);
    if (!wild) return;

    const wildPkmn = createPokemonInstance(wild.key, wild.level);
    if (!wildPkmn) return;

    // Use full story party
    const playerTeam = StorySave.buildBattleParty();
    if (playerTeam.length === 0) return;

    Screen.show('screen-battle');
    Battle.start(playerTeam, [wildPkmn], {
      cpuTier: 1,
      isWild: true,
      onWin:  () => _onStoryWildWin(playerTeam),
      onLose: () => _onStoryBattleLose(),
    });
  }

  function _onStoryWildWin(playerTeam) {
    // Sync any level-ups back to story save
    StorySave.syncPartyFromBattle(playerTeam);
    Screen.show('screen-overworld');
    _render();
  }

  // _starterLevel removed — story party now tracked entirely in StorySave.party

  // ─── Healing ──────────────────────────────────

  function _healTeam() {
    // Story party heals between battles — createPokemonInstance always
    // creates at full HP, so healing is automatic on next battle.
    // We just need to show the flavour dialogue here.
    const party = StorySave.getParty();
    if (party.length === 0) return;
    _startDialogue('Nurse Joy', [
      "We restored your Pokémon to full health!",
      "We hope to see you again!",
    ]);
  }

  // ─── HUD ──────────────────────────────────────

  function _updateHUD() {
    const trainerEl = document.getElementById('ow-hud-trainer');
    const mapEl     = document.getElementById('ow-hud-map');
    const badgesEl  = document.getElementById('ow-hud-badges');

    if (trainerEl) trainerEl.textContent = StorySave.getPlayerName();
    if (mapEl && currentMap) mapEl.textContent = currentMap.name;

    if (badgesEl) {
      const badges   = StorySave.getBadges();
      const badgeNames = ['🪨','💧','⚡','🌿','🔮','🏔️','🔥','🌊'];
      badgesEl.innerHTML = badges.map((earned, i) =>
        `<div class="ow-badge-icon${earned ? ' earned' : ''}" title="Badge ${i+1}">${badgeNames[i]}</div>`
      ).join('');
    }
  }

  // ─── Pause menu ───────────────────────────────

  // ── Story Menu ──────────────────────────────────
  let _activeTab = 'party';

  function openMenu() {
    moveEnabled = false;
    const el = document.getElementById('ow-story-menu');
    if (el) el.classList.remove('hidden');
    _menuTab(_activeTab);
  }

  function closeMenu() {
    moveEnabled = true;
    const el = document.getElementById('ow-story-menu');
    if (el) el.classList.add('hidden');
  }

  function _menuTab(tab) {
    _activeTab = tab;
    // Switch tab active state
    document.querySelectorAll('.ow-sm-tab').forEach(b => b.classList.remove('ow-sm-active'));
    const tabs = ['party','bag','badges','map','save'];
    const tabBtns = document.querySelectorAll('.ow-sm-tab');
    tabBtns[tabs.indexOf(tab)]?.classList.add('ow-sm-active');
    // Show correct content
    tabs.forEach(t => {
      const el = document.getElementById(`ow-sm-${t}`);
      if (el) el.classList.toggle('hidden', t !== tab);
    });
    // Populate
    if (tab === 'party')  _renderMenuParty();
    if (tab === 'bag')    _renderMenuBag();
    if (tab === 'badges') _renderMenuBadges();
    if (tab === 'map')    _renderMenuMap();
    if (tab === 'save')   _renderMenuSave();
  }

  const ITEM_NAMES = {
    potion:'Potion', superPotion:'Super Potion', fullRestore:'Full Restore',
    revive:'Revive', fullRevive:'Full Revive',
    xAttack:'X Attack', xDefense:'X Defense', xSpeed:'X Speed',
  };

  function _renderMenuParty() {
    const grid = document.getElementById('ow-sm-party-grid');
    if (!grid) return;
    const party = StorySave.getParty();
    if (!party.length) { grid.innerHTML = '<p class="ow-sm-empty">Your party is empty.</p>'; return; }
    grid.innerHTML = party.map(m => {
      const d   = POKEMON_DATA[m.key];
      const pct = Math.round((m.xp || 0) / Math.max(1, (typeof XPSystem !== 'undefined' ? XPSystem.xpForLevel(m.level+1) : 1000)) * 100);
      return `<div class="ow-sm-party-card">
        <img class="ow-sm-pkmn-sprite" src="${d ? getSpriteUrl(d.id) : ''}" alt="${m.key}">
        <div class="ow-sm-pkmn-info">
          <div class="ow-sm-pkmn-name">${d?.name || m.key}</div>
          <div class="ow-sm-pkmn-types">${(d?.types||[]).map(t=>`<span class="type-badge type-${t}">${t}</span>`).join('')}</div>
          <div class="ow-sm-pkmn-level">Lv. ${m.level}</div>
          <div class="ow-sm-xp-bar"><div class="ow-sm-xp-fill" style="width:${Math.min(100,pct)}%"></div></div>
        </div>
      </div>`;
    }).join('');
  }

  function _renderMenuBag() {
    const moneyEl = document.getElementById('ow-sm-money');
    const listEl  = document.getElementById('ow-sm-bag-list');
    if (moneyEl) moneyEl.textContent = `₽ ${(StorySave.getMoney() || 0).toLocaleString()}`;
    if (!listEl) return;
    const inv = SaveSystem.getInventory();
    const items = Object.entries(ITEM_NAMES)
      .map(([key, name]) => ({ key, name, count: inv[key] || 0 }))
      .filter(i => i.count > 0);
    if (!items.length) { listEl.innerHTML = '<p class="ow-sm-empty">Bag is empty.</p>'; return; }
    listEl.innerHTML = items.map(i =>
      `<div class="ow-sm-bag-item">
        <span class="ow-sm-bag-name">${i.name}</span>
        <span class="ow-sm-bag-count">×${i.count}</span>
      </div>`
    ).join('');
  }

  const BADGE_DATA = [
    { name:'Boulder Badge', gym:'Pewter City',   leader:'Brock',    type:'rock',     icon:'🪨' },
    { name:'Cascade Badge', gym:'Cerulean City', leader:'Misty',    type:'water',    icon:'💧' },
    { name:'Thunder Badge', gym:'Vermilion City',leader:'Lt. Surge',type:'electric', icon:'⚡' },
    { name:'Rainbow Badge', gym:'Celadon City',  leader:'Erika',    type:'grass',    icon:'🌿' },
    { name:'Soul Badge',    gym:'Fuchsia City',  leader:'Koga',     type:'poison',   icon:'🔮' },
    { name:'Marsh Badge',   gym:'Saffron City',  leader:'Sabrina',  type:'psychic',  icon:'🌀' },
    { name:'Volcano Badge', gym:'Cinnabar Island',leader:'Blaine',  type:'fire',     icon:'🔥' },
    { name:'Earth Badge',   gym:'Viridian City', leader:'Giovanni', type:'ground',   icon:'🏔️' },
  ];

  function _renderMenuBadges() {
    const grid = document.getElementById('ow-sm-badge-grid');
    if (!grid) return;
    const badges = StorySave.getBadges();
    grid.innerHTML = BADGE_DATA.map((b, i) => `
      <div class="ow-sm-badge-card ${badges[i] ? 'ow-sm-badge-earned' : 'ow-sm-badge-locked'}">
        <div class="ow-sm-badge-icon">${badges[i] ? b.icon : '?'}</div>
        <div class="ow-sm-badge-name">${b.name}</div>
        <div class="ow-sm-badge-gym">${b.gym}</div>
        <div class="ow-sm-badge-leader">${b.leader}</div>
      </div>`
    ).join('');
  }

  const MAP_LAYOUT = [
    // [col, row, mapId, label, connections]
    { id:'palletTown',    col:1, row:4, label:'Pallet' },
    { id:'route1',        col:1, row:3, label:'Route 1', isRoute:true },
    { id:'viridianCity',  col:1, row:2, label:'Viridian' },
    { id:'route2south',   col:1, row:1, label:'Route 2', isRoute:true },
    { id:'viridianForest',col:1, row:0, label:'V.Forest', isRoute:true },
    { id:'pewterCity',    col:1, row:-1,label:'Pewter' },
    { id:'route3',        col:2, row:-1,label:'Route 3', isRoute:true },
    { id:'mtMoon',        col:3, row:-1,label:'Mt.Moon', isRoute:true },
    { id:'ceruleanCity',  col:4, row:-1,label:'Cerulean' },
  ];

  function _renderMenuMap() {
    const area = document.getElementById('ow-sm-map-area');
    if (!area) return;
    const current = StorySave.getLocation();
    const CELL = 52;
    // Find bounding box
    const cols = MAP_LAYOUT.map(n => n.col);
    const rows = MAP_LAYOUT.map(n => n.row);
    const minC = Math.min(...cols), maxC = Math.max(...cols);
    const minR = Math.min(...rows), maxR = Math.max(...rows);
    const W = (maxC - minC + 1) * CELL + 16;
    const H = (maxR - minR + 1) * CELL + 40;

    let svg = `<svg width="${W}" height="${H}" style="overflow:visible">`;
    // Connection lines
    const nodeMap = Object.fromEntries(MAP_LAYOUT.map(n => [n.id, n]));
    const drawn = new Set();
    for (const node of MAP_LAYOUT) {
      const map = MapData.getMap(node.id);
      if (!map) continue;
      for (const exit of (map.exits || [])) {
        const key = [node.id, exit.toMap].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const target = nodeMap[exit.toMap];
        if (!target) continue;
        const x1 = (node.col   - minC) * CELL + CELL/2 + 8;
        const y1 = (maxR - node.col === node.row ? 0 : (maxR - node.row)) * CELL + CELL/2 + 20;
        const x2 = (target.col - minC) * CELL + CELL/2 + 8;
        const y2 = (maxR - target.row) * CELL + CELL/2 + 20;
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a3f6e" stroke-width="2" stroke-dasharray="4,3"/>`;
      }
    }
    // Nodes
    for (const node of MAP_LAYOUT) {
      const cx = (node.col - minC) * CELL + CELL/2 + 8;
      const cy = (maxR - node.row) * CELL + CELL/2 + 20;
      const isCurrent = node.id === current;
      const fill = isCurrent ? '#4e8cff' : (node.isRoute ? '#2a3a2a' : '#232640');
      const stroke = isCurrent ? '#80b8ff' : '#3a3f6e';
      const tcolor = isCurrent ? '#fff' : '#9a9fc0';
      svg += `<rect x="${cx - CELL/2 + 2}" y="${cy - 16}" width="${CELL - 4}" height="32" rx="6"
                    fill="${fill}" stroke="${stroke}" stroke-width="${isCurrent ? 2 : 1}"/>`;
      svg += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="8" fill="${tcolor}"
                    font-family="'Press Start 2P',monospace">${node.label}</text>`;
      if (isCurrent) {
        svg += `<text x="${cx}" y="${cy - 20}" text-anchor="middle" font-size="10" fill="#f5c518">▼</text>`;
      }
    }
    svg += '</svg>';
    area.innerHTML = svg;
  }

  function _renderMenuSave() {
    const card = document.getElementById('ow-sm-trainer-card');
    if (!card) return;
    const gender  = StorySave.getGender();
    const sprite  = `sprites/overworld/${gender === 'female' ? 'leaf' : 'red'}_down_idle.png`;
    card.innerHTML = `
      <div class="ow-sm-tc-inner">
        <img src="${sprite}" class="ow-sm-tc-sprite" onerror="this.style.display='none'">
        <div class="ow-sm-tc-info">
          <div class="ow-sm-tc-name">${StorySave.getPlayerName()}</div>
          <div class="ow-sm-tc-detail">Rival: ${StorySave.getRivalName()}</div>
          <div class="ow-sm-tc-detail">Location: ${currentMap?.name || '?'}</div>
          <div class="ow-sm-tc-detail">Badges: ${StorySave.getBadgeCount()} / 8</div>
          <div class="ow-sm-tc-detail">Money: ₽${(StorySave.getMoney()||0).toLocaleString()}</div>
          <div class="ow-sm-tc-detail">Time: ${SaveSystem.getPlaytimeString()}</div>
        </div>
      </div>`;
  }

  function _menuToast(msg) {
    const el = document.getElementById('ow-sm-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(_menuToast._t);
    _menuToast._t = setTimeout(() => el.classList.add('hidden'), 2000);
  }
  _menuToast._t = null;

  // ─── Input ────────────────────────────────────

  function _setupInput() {
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('screen-overworld')?.classList.contains('active')) return;
      if (dialogueActive) {
        if (['Enter','Space','z','Z'].includes(e.key)) { e.preventDefault(); _advanceDialogue(); }
        return;
      }
      keys[e.key] = true;
      const MAP = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                    w:'up', s:'down', a:'left', d:'right',
                    W:'up', S:'down', A:'left', D:'right' };
      if (MAP[e.key]) { e.preventDefault(); _tryMove(MAP[e.key]); }
      if (e.key === 'Enter' || e.key === 'z') _interact();
      if (e.key === 'Escape') openMenu();
    });

    document.addEventListener('keyup', e => { delete keys[e.key]; });

    // Dialogue click
    const dlg = document.getElementById('ow-dialogue');
    if (dlg) dlg.addEventListener('click', _advanceDialogue);
  }

  // D-pad touch controls
  function _dpadPress(dir) {
    if (!moveEnabled) return;
    _tryMove(dir);
    _dpadPress._interval = setInterval(() => _tryMove(dir), MOVE_COOLDOWN);
  }
  _dpadPress._interval = null;

  function _dpadRelease(dir) {
    clearInterval(_dpadPress._interval);
  }

  // ─── Game loop (requestAnimationFrame) ────────
  let _rafId = null;
  let _lastRender = 0;

  function _loop(ts) {
    _rafId = requestAnimationFrame(_loop);
    if (ts - _lastRender < 50) return;   // cap at ~20fps for overworld
    _lastRender = ts;
    _waterTick = (_waterTick + 1) % 4;
    if (_waterTick === 0) _waterFrame = (_waterFrame + 1) % 16; // slow water anim
    _render();
  }

  // ─── Public init ──────────────────────────────

  function init() {
    // Defer init if data globals aren't ready yet (load-order safety)
    if (typeof MapData === 'undefined' || typeof POKEMON_DATA === 'undefined') {
      console.warn('[Overworld] Data not ready yet — deferring init until DOMContentLoaded');
      const _retry = () => {
        if (typeof MapData !== 'undefined' && typeof POKEMON_DATA !== 'undefined') {
          Overworld.init();
        } else {
          console.error('[Overworld] MapData or POKEMON_DATA still missing after page load. Check index.html script order.');
        }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _retry, { once: true });
      } else {
        // Page already loaded — something else is wrong
        console.error('[Overworld] MapData or POKEMON_DATA not defined. Check index.html script order.');
      }
      return;
    }

    _injectCSS();
    if (!document.getElementById('screen-overworld')) {
      document.body.insertAdjacentHTML('beforeend', _buildHTML());
    }

    _setupCanvas();
    _setupInput();

    // Load saved location
    const savedLoc = StorySave.getLocation() || 'palletTown';
    const mapDef   = MapData.getMap(savedLoc) || MapData.getMap('palletTown');
    currentMap     = mapDef;

    // Place player
    playerX = 4; playerY = 4;
    playerDir = 'down';
    moveEnabled = true;
    dialogueActive = false;

    _preloadSprites();
    // Preload player sprites for both genders
    if (typeof SpriteManager !== 'undefined') {
      ['red','leaf'].forEach(char => {
        ['down','up','side','side_r'].forEach(dir => {
          ['idle','step1','step2'].forEach(frame => {
            SpriteManager.overworldSprite(`${char}_${dir}_${frame}`);
          });
        });
      });
    }
    // Start loading the tileset — renders immediately once loaded
    if (typeof TilesetRenderer !== 'undefined') TilesetRenderer.preload();
    _updateHUD();
    _resizeCanvas();

    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = requestAnimationFrame(_loop);

    // Opening dialogue on first visit
    if (!StorySave.getFlag('seenPalletIntro')) {
      StorySave.setFlag('seenPalletIntro', true);
      setTimeout(() => {
        _startDialogue('Prof. Oak', [
          `${StorySave.getPlayerName()}! Your adventure begins in Pallet Town.`,
          'Use the arrow keys or D-pad to move around.',
          'Press A or Enter to talk to people.',
          'Head north to Route 1 to begin your journey!',
        ]);
      }, 500);
    }
  }

  return {
    init,
    openMenu,
    closeMenu,
    _menuTab,
    _menuToast,
    _interact,
    _advanceDialogue,
    _dpadPress,
    _dpadRelease,
    _onStoryBattleWin,
    _onStoryBattleLose,
  };

})();
