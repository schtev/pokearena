// ═══════════════════════════════════════════════════
//  src/tower/eggHatch.js
//  Egg hatch overlay for the Infinite Tower.
//
//  Called after a floor clear when an egg was awarded.
//  Animates in three stages:
//    1. Egg + rarity reveal (shake animation)
//    2. Crack → hatch flash
//    3. Pokémon sprite reveal + "Added to party!" or
//       "Party full" message
//
//  Returns a Promise that resolves when the player
//  clicks Continue, so callers can await it.
// ═══════════════════════════════════════════════════

const EggHatch = (() => {

  // ── CSS injection ────────────────────────────────
  function _injectCSS() {
    if (document.getElementById('egg-hatch-styles')) return;
    const s = document.createElement('style');
    s.id = 'egg-hatch-styles';
    s.textContent = `
#egg-hatch-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  flex-direction: column;
  gap: 0;
}
#egg-hatch-overlay.hidden { display: none !important; }

.eh-card {
  background: var(--bg-panel);
  border: 3px solid var(--border-bright);
  border-radius: var(--radius-lg);
  padding: 32px 40px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  min-width: 300px;
  max-width: 380px;
  text-align: center;
  animation: ehSlideIn .4s cubic-bezier(.22,1,.36,1);
}
@keyframes ehSlideIn {
  from { opacity:0; transform: scale(0.85) translateY(20px); }
  to   { opacity:1; transform: scale(1)   translateY(0); }
}

.eh-floor-label {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.eh-title {
  font-family: var(--font-pixel);
  font-size: 13px;
  color: var(--text-primary);
}

/* Egg sprite container */
.eh-egg-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.eh-egg {
  font-size: 72px;
  user-select: none;
  line-height: 1;
  filter: drop-shadow(0 4px 16px currentColor);
  transition: transform .15s ease;
}
.eh-egg.eh-shake {
  animation: ehShake .5s ease;
}
@keyframes ehShake {
  0%,100%  { transform: rotate(0deg) scale(1); }
  20%      { transform: rotate(-12deg) scale(1.08); }
  40%      { transform: rotate(14deg)  scale(1.12); }
  60%      { transform: rotate(-10deg) scale(1.08); }
  80%      { transform: rotate(8deg)   scale(1.04); }
}
.eh-egg.eh-crack {
  animation: ehCrack .4s ease forwards;
}
@keyframes ehCrack {
  0%   { transform: scale(1); filter: brightness(1); }
  50%  { transform: scale(1.3); filter: brightness(2); }
  100% { transform: scale(0); filter: brightness(3) blur(4px); opacity: 0; }
}

/* Rarity badge */
.eh-rarity {
  font-family: var(--font-pixel);
  font-size: 11px;
  padding: 6px 16px;
  border-radius: 20px;
  border: 2px solid currentColor;
  letter-spacing: 1px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity .4s ease, transform .4s ease;
}
.eh-rarity.eh-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Pokémon reveal */
.eh-pokemon-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(12px) scale(0.9);
  transition: opacity .5s ease, transform .5s cubic-bezier(.34,1.56,.64,1);
}
.eh-pokemon-wrap.eh-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.eh-pokemon-sprite {
  width: 96px;
  height: 96px;
  image-rendering: pixelated;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,.5));
}
.eh-pokemon-name {
  font-family: var(--font-pixel);
  font-size: 12px;
  color: var(--text-primary);
}
.eh-pokemon-types {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.eh-result-msg {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.eh-party-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 4px;
}
.eh-party-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.eh-party-slot img {
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
}
.eh-party-slot span {
  font-size: 9px;
  font-family: var(--font-pixel);
  color: var(--text-muted);
}
.eh-party-slot.eh-new {
  filter: drop-shadow(0 0 8px gold);
}
    `;
    document.head.appendChild(s);
  }

  // ── HTML injection ───────────────────────────────
  function _inject() {
    if (document.getElementById('egg-hatch-overlay')) return;
    _injectCSS();
    document.body.insertAdjacentHTML('beforeend', `
<div id="egg-hatch-overlay" class="hidden">
  <div class="eh-card">
    <div class="eh-floor-label" id="eh-floor-label">Floor reward</div>
    <div class="eh-title">An egg appeared!</div>

    <div class="eh-egg-wrap">
      <div class="eh-egg" id="eh-egg">🥚</div>
    </div>

    <div class="eh-rarity" id="eh-rarity">???</div>

    <div class="eh-pokemon-wrap" id="eh-pokemon-wrap">
      <img class="eh-pokemon-sprite" id="eh-pokemon-sprite" src="" alt="">
      <div class="eh-pokemon-name" id="eh-pokemon-name"></div>
      <div class="eh-pokemon-types" id="eh-pokemon-types"></div>
    </div>

    <div class="eh-result-msg" id="eh-result-msg"></div>

    <div class="eh-party-row" id="eh-party-row"></div>

    <button class="big-btn" id="eh-continue-btn" style="display:none">
      Continue →
    </button>
  </div>
</div>`);
  }

  // ── Helpers ──────────────────────────────────────
  function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  const TYPE_COLORS = {
    fire:'#E64A19',water:'#1565C0',grass:'#2E7D32',electric:'#F9A825',
    psychic:'#AD1457',ice:'#006064',dragon:'#4527A0',dark:'#212121',
    fighting:'#BF360C',poison:'#6A1B9A',ground:'#4E342E',flying:'#1565C0',
    bug:'#558B2F',rock:'#5D4037',ghost:'#283593',steel:'#37474F',
    normal:'#546E7A',fairy:'#AD1457',
  };

  // ── Main show function ───────────────────────────

  /**
   * Show the egg hatch animation for a given egg object.
   * @param {object} egg  — { rarity, rarityData, key, name }
   * @returns {Promise<void>}
   */
  function show(egg) {
    _inject();
    return new Promise(async resolve => {
      const overlay    = document.getElementById('egg-hatch-overlay');
      const eggEl      = document.getElementById('eh-egg');
      const rarityEl   = document.getElementById('eh-rarity');
      const pkWrap     = document.getElementById('eh-pokemon-wrap');
      const pkSprite   = document.getElementById('eh-pokemon-sprite');
      const pkName     = document.getElementById('eh-pokemon-name');
      const pkTypes    = document.getElementById('eh-pokemon-types');
      const resultMsg  = document.getElementById('eh-result-msg');
      const partyRow   = document.getElementById('eh-party-row');
      const continueBtn= document.getElementById('eh-continue-btn');
      const floorLabel = document.getElementById('eh-floor-label');

      // Reset state
      eggEl.className      = 'eh-egg';
      rarityEl.className   = 'eh-rarity';
      pkWrap.className     = 'eh-pokemon-wrap';
      continueBtn.style.display = 'none';
      resultMsg.textContent     = '';
      partyRow.innerHTML        = '';
      pkTypes.innerHTML         = '';

      // Floor label
      floorLabel.textContent = `Floor ${Tower.getCurrentFloor() - 1} reward`;

      // Style egg and rarity by tier
      const colour = egg.rarityData.colour;
      eggEl.style.color     = colour;
      rarityEl.style.color  = colour;
      rarityEl.style.borderColor = colour;
      rarityEl.textContent  = egg.rarityData.label;

      overlay.classList.remove('hidden');

      // Stage 1: Show egg, pause
      await _wait(600);

      // Shake a few times
      for (let i = 0; i < 3; i++) {
        eggEl.classList.add('eh-shake');
        await _wait(550);
        eggEl.classList.remove('eh-shake');
        await _wait(200);
      }

      // Reveal rarity badge
      rarityEl.classList.add('eh-visible');
      if (egg.rarity === 'LEGENDARY') {
        // Flash the overlay for legendary
        overlay.style.background = `rgba(${colour.replace('#','').match(/../g).map(h=>parseInt(h,16)).join(',')}, 0.3)`;
        await _wait(300);
        overlay.style.background = 'rgba(0,0,0,0.88)';
      }
      await _wait(800);

      // Stage 2: Crack and hatch
      eggEl.classList.add('eh-crack');
      await _wait(500);
      eggEl.style.display = 'none';

      // Stage 3: Reveal Pokémon
      const pkData = POKEMON_DATA[egg.key] || POKEMON_DATA[egg.key.replace('-','')];
      const isShiny = egg.isShiny || false;
      if (pkData) {
        pkSprite.src        = getSpriteUrl(pkData.id, isShiny);
        pkName.textContent  = (isShiny ? '✨ ' : '') + pkData.name;
        if (isShiny) pkName.style.color = '#f5c518';
        pkTypes.innerHTML   = (pkData.types || []).map(t =>
          `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t]||'#555'}">${t}</span>`
        ).join('');
      } else {
        pkName.textContent = egg.name || egg.key;
        pkTypes.innerHTML  = '';
      }

      pkWrap.classList.add('eh-visible');
      await _wait(600);

      // Add to tower party
      const added = Tower.addHatchedToParty(egg.key, egg.isShiny);
      SaveSystem.unlockPokemon(egg.key);
      if (egg.isShiny) {
        SaveSystem.unlockShiny(egg.key);
      }
      const shinyPrefix = egg.isShiny ? '✨ Shiny ' : '';
      if (added) {
        resultMsg.textContent = `${shinyPrefix}${egg.name} joined your tower party!`;
        if (egg.isShiny) resultMsg.style.color = '#f5c518';
      } else {
        resultMsg.textContent = `Party is full! ${shinyPrefix}${egg.name} was released into the wild but added to your collection.`;
      }

      // Show current party
      const party = Tower.getRunParty();
      partyRow.innerHTML = party.map((m, i) => {
        const d   = POKEMON_DATA[m.key];
        const isNew = m.key === egg.key && added;
        return `<div class="eh-party-slot ${isNew ? 'eh-new' : ''}">
          <img src="${d ? getSpriteUrl(d.id) : ''}" alt="${m.key}">
          <span>Lv${m.level}</span>
        </div>`;
      }).join('');

      continueBtn.style.display = 'block';
      continueBtn.onclick = () => {
        eggEl.style.display = '';
        overlay.classList.add('hidden');
        resolve();
      };
    });
  }

  return { show };

})();
