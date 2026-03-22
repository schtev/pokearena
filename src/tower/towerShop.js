// ═══════════════════════════════════════════════════
//  src/tower/towerShop.js
//  Tower Floor Shop — appears every 5 floors.
//  Player can buy items and eggs using tower coins
//  earned from battles (1 coin per 100 XP gained).
//  Coins are stored per-run in the slot save.
// ═══════════════════════════════════════════════════

const TowerShop = (() => {

  // ── Coin helpers ─────────────────────────────────
  function getCoins() {
    const slot = SaveSystem.getTowerSlot(Tower.getActiveSlot());
    return slot?.coins || 0;
  }

  function _addCoins(n) {
    const idx  = Tower.getActiveSlot();
    const slot = SaveSystem.getTowerSlot(idx) || {};
    slot.coins = (slot.coins || 0) + n;
    SaveSystem.saveTowerSlot(idx, slot);
  }

  function _spendCoins(n) {
    const idx  = Tower.getActiveSlot();
    const slot = SaveSystem.getTowerSlot(idx) || {};
    if ((slot.coins || 0) < n) return false;
    slot.coins = (slot.coins || 0) - n;
    SaveSystem.saveTowerSlot(idx, slot);
    return true;
  }

  // Give coins after each tower battle victory (called from main.js)
  function awardBattleCoins(xpEarned) {
    const coins = Math.max(1, Math.floor(xpEarned / 80));
    _addCoins(coins);
    return coins;
  }

  // ── Shop catalogue ───────────────────────────────
  // Each entry: { id, label, desc, cost, type, ... }
  function _buildCatalogue(floorNumber) {
    const tier = Math.floor(floorNumber / 10);

    const always = [
      { id:'potion',      label:'Potion',       desc:'Restore 60 HP',         cost:3,  type:'item', itemKey:'superPotion' },
      { id:'revive',      label:'Revive',        desc:'Revive fainted Pokémon',cost:8,  type:'item', itemKey:'revive' },
      { id:'fullRestore', label:'Full Restore',  desc:'Full HP + cure status', cost:15, type:'item', itemKey:'fullRestore' },
      { id:'egg_common',  label:'🥚 Common Egg', desc:'Hatch a Common Pokémon',cost:5,  type:'egg',  rarity:'COMMON' },
    ];

    const mid = tier >= 1 ? [
      { id:'superPotion', label:'Super Potion',  desc:'Restore 120 HP',        cost:6,  type:'item', itemKey:'hyperPotion' },
      { id:'xAttack',     label:'X Attack',      desc:'+2 Attack this battle',  cost:10, type:'item', itemKey:'xAttack' },
      { id:'xSpeed',      label:'X Speed',       desc:'+2 Speed this battle',   cost:10, type:'item', itemKey:'xSpeed' },
      { id:'egg_uncommon',label:'🥚 Uncommon Egg',desc:'Hatch an Uncommon Pokémon',cost:12,type:'egg',rarity:'UNCOMMON'},
    ] : [];

    const high = tier >= 3 ? [
      { id:'fullRevive',  label:'Full Revive',   desc:'Revive to full HP',     cost:20, type:'item', itemKey:'maxRevive' },
      { id:'elixir',      label:'Elixir',        desc:'Restore all move PP',   cost:18, type:'item', itemKey:'elixir' },
      { id:'egg_rare',    label:'🥚 Rare Egg',    desc:'Hatch a Rare Pokémon',  cost:25, type:'egg',  rarity:'RARE' },
    ] : [];

    const elite = tier >= 5 ? [
      { id:'egg_epic',    label:'🥚 Epic Egg',    desc:'Hatch an Epic Pokémon', cost:50, type:'egg',  rarity:'EPIC' },
      { id:'egg_legend',  label:'🥚 Legend Egg',  desc:'Hatch a Legendary!',    cost:100,type:'egg',  rarity:'LEGENDARY' },
    ] : [];

    return [...always, ...mid, ...high, ...elite];
  }

  // ── CSS injection ────────────────────────────────
  function _injectCSS() {
    if (document.getElementById('tower-shop-css')) return;
    const s = document.createElement('style');
    s.id = 'tower-shop-css';
    s.textContent = `
#tower-shop-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.88);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
#tower-shop-overlay.hidden { display: none !important; }

.ts-shop-panel {
  background: var(--bg-panel);
  border: 3px solid var(--accent-yellow);
  border-radius: var(--radius-lg);
  width: min(440px, 96vw);
  max-height: 88vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: shopSlideIn .3s cubic-bezier(.22,1,.36,1);
}
@keyframes shopSlideIn {
  from { opacity:0; transform:scale(.88) translateY(20px); }
  to   { opacity:1; transform:scale(1) translateY(0); }
}
.ts-shop-header {
  background: linear-gradient(90deg, #1a1400, #2a2000);
  border-bottom: 2px solid var(--accent-yellow);
  padding: 14px 20px;
  display: flex; justify-content: space-between; align-items: center;
}
.ts-shop-title {
  font-family: var(--font-pixel); font-size: 12px; color: var(--accent-yellow);
}
.ts-shop-coins {
  font-family: var(--font-pixel); font-size: 11px; color: var(--accent-yellow);
  background: rgba(245,197,24,.15); border: 1px solid var(--accent-yellow);
  border-radius: 12px; padding: 4px 12px;
}
.ts-shop-items {
  overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.ts-shop-item {
  display: flex; align-items: center; gap: 14px;
  background: var(--bg-card); border: 2px solid var(--border);
  border-radius: var(--radius-md); padding: 12px 16px;
  cursor: pointer; transition: border-color .15s, transform .1s;
}
.ts-shop-item:hover { border-color: var(--accent-yellow); transform: translateX(3px); }
.ts-shop-item.cant-afford { opacity: .45; cursor: not-allowed; }
.ts-shop-item-icon { font-size: 28px; flex-shrink: 0; }
.ts-shop-item-info { flex: 1; }
.ts-shop-item-name { font-family: var(--font-pixel); font-size: 10px; color: var(--text-primary); }
.ts-shop-item-desc { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.ts-shop-item-cost {
  font-family: var(--font-pixel); font-size: 10px;
  color: var(--accent-yellow); flex-shrink: 0;
}
.ts-shop-close {
  margin: 12px; padding: 10px;
  background: none; border: 2px solid var(--border);
  border-radius: var(--radius-md); color: var(--text-muted);
  font-family: var(--font-pixel); font-size: 9px;
  cursor: pointer; transition: border-color .15s;
}
.ts-shop-close:hover { border-color: var(--accent-red); color: var(--accent-red); }
.ts-shop-toast {
  text-align: center; font-family: var(--font-pixel); font-size: 9px;
  color: var(--accent-green); padding: 6px; min-height: 24px;
}
    `;
    document.head.appendChild(s);
  }

  // ── HTML injection ───────────────────────────────
  function _inject() {
    if (document.getElementById('tower-shop-overlay')) return;
    _injectCSS();
    document.body.insertAdjacentHTML('beforeend', `
<div id="tower-shop-overlay" class="hidden">
  <div class="ts-shop-panel">
    <div class="ts-shop-header">
      <span class="ts-shop-title">🛒 Floor Shop</span>
      <span class="ts-shop-coins" id="ts-coins">🪙 0</span>
    </div>
    <div class="ts-shop-items" id="ts-shop-items"></div>
    <div class="ts-shop-toast" id="ts-shop-toast"></div>
    <button class="ts-shop-close" id="ts-shop-close">Continue to next floor →</button>
  </div>
</div>`);
  }

  // ── Show ─────────────────────────────────────────
  function show() {
    _inject();
    return new Promise(resolve => {
      const overlay   = document.getElementById('tower-shop-overlay');
      const itemsEl   = document.getElementById('ts-shop-items');
      const coinsEl   = document.getElementById('ts-coins');
      const toastEl   = document.getElementById('ts-shop-toast');
      const closeBtn  = document.getElementById('ts-shop-close');

      const floor     = Tower.getCurrentFloor() - 1; // shop is after clearing that floor
      const catalogue = _buildCatalogue(floor);

      function refreshCoins() {
        coinsEl.textContent = `🪙 ${getCoins()}`;
      }

      function renderItems() {
        refreshCoins();
        const coins = getCoins();
        itemsEl.innerHTML = catalogue.map(entry => {
          const canAfford = coins >= entry.cost;
          const icons = { item:'📦', egg:'🥚' };
          return `<div class="ts-shop-item${canAfford ? '' : ' cant-afford'}"
                       onclick="TowerShop._buy('${entry.id}')">
            <div class="ts-shop-item-icon">${icons[entry.type] || '📦'}</div>
            <div class="ts-shop-item-info">
              <div class="ts-shop-item-name">${entry.label}</div>
              <div class="ts-shop-item-desc">${entry.desc}</div>
            </div>
            <div class="ts-shop-item-cost">🪙 ${entry.cost}</div>
          </div>`;
        }).join('');
      }

      // Store catalogue for buy handler
      _currentCatalogue = catalogue;
      _onPurchase = () => { renderItems(); };

      renderItems();
      overlay.classList.remove('hidden');

      closeBtn.onclick = () => {
        overlay.classList.add('hidden');
        _currentCatalogue = null;
        resolve();
      };
    });
  }

  let _currentCatalogue = null;
  let _onPurchase = null;

  function _toast(msg, colour = 'var(--accent-green)') {
    const el = document.getElementById('ts-shop-toast');
    if (el) { el.textContent = msg; el.style.color = colour; }
  }

  function _buy(id) {
    const entry = _currentCatalogue?.find(e => e.id === id);
    if (!entry) return;
    if (getCoins() < entry.cost) { _toast('Not enough coins!', 'var(--accent-red)'); return; }

    if (!_spendCoins(entry.cost)) { _toast('Purchase failed.', 'var(--accent-red)'); return; }

    if (entry.type === 'item') {
      SaveSystem.addItem(entry.itemKey, 1);
      _toast(`Bought ${entry.label}!`);
    } else if (entry.type === 'egg') {
      // Force-roll an egg at the given rarity and queue it
      const rd   = Tower.RARITY[entry.rarity];
      const pool = rd.pool.filter(k => POKEMON_DATA[k]);
      if (!pool.length) { _toast('No Pokémon available.', 'var(--accent-red)'); return; }
      const key  = pool[Math.floor(Math.random() * pool.length)];
      const isShiny = Math.random() < 0.02; // 2% shiny from shop eggs
      const egg  = { rarity: entry.rarity, rarityData: rd, key, name: POKEMON_DATA[key]?.name || key, isShiny };
      Tower.setPendingEgg(egg);
      _toast(`${entry.label} hatching after next battle!`);
    }

    if (_onPurchase) _onPurchase();
  }

  return { show, awardBattleCoins, getCoins, _buy };

})();
