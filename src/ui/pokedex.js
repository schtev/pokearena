// ═══════════════════════════════════════════════════
//  src/ui/pokedex.js   (Part 4)
//  Full Pokédex browser — shows all Pokémon in dex
//  order, locked ones silhouetted, unlocked ones
//  fully visible. Click any unlocked entry to open
//  the stats screen. Filterable by type and name.
// ═══════════════════════════════════════════════════

const Pokedex = (() => {

  let _filter   = '';
  let _typeFilter = 'all';

  // All Pokémon in dex order (by ID)
  function getSortedEntries() {
    return Object.entries(POKEMON_DATA)
      .sort(([, a], [, b]) => a.id - b.id);
  }

  // ─── Render ───────────────────────────────────
  function render() {
    const grid    = document.getElementById('dex-grid');
    const counter = document.getElementById('dex-counter');
    if (!grid) return;

    const entries   = getSortedEntries();
    const unlocked  = SaveSystem.getUnlocked();
    const total     = entries.length;
    const seen      = unlocked.length;

    if (counter) counter.textContent = `${seen} / ${total} caught`;

    grid.innerHTML = '';

    entries.forEach(([key, data]) => {
      const isUnlocked = unlocked.includes(key);

      // Filter
      if (_filter && !data.name.toLowerCase().includes(_filter.toLowerCase())) return;
      if (_typeFilter !== 'all' && !data.types.includes(_typeFilter)) return;

      const card = document.createElement('div');
      card.className = `dex-card${isUnlocked ? ' unlocked' : ' locked'}`;
      card.title     = isUnlocked ? data.name : '???';

      if (isUnlocked) {
        const abilityName = (typeof AbilitySystem !== 'undefined')
          ? AbilitySystem.getAbilityName(key) : '';
        card.innerHTML = `
          <div class="dex-num">#${String(data.id).padStart(3,'0')}</div>
          <img class="dex-sprite" src="${getSpriteUrl(data.id)}" alt="${data.name}" loading="lazy" />
          <div class="dex-name">${data.name}</div>
          <div class="dex-types">
            ${data.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')}
          </div>
          ${abilityName && abilityName !== 'None' ? `<div class="dex-ability">${abilityName}</div>` : ''}
        `;
        card.addEventListener('click', () => {
          SoundSystem.play('menuSelect');
          StatsScreen.show(key, 50);
        });
      } else {
        card.innerHTML = `
          <div class="dex-num">#${String(data.id).padStart(3,'0')}</div>
          <div class="dex-silhouette">
            <img src="${getSpriteUrl(data.id)}" alt="???" loading="lazy" />
          </div>
          <div class="dex-name">???</div>
          <div class="dex-hint">Battle to unlock</div>
        `;
      }

      grid.appendChild(card);
    });

    // Show empty state
    if (grid.children.length === 0) {
      grid.innerHTML = '<p class="dex-empty">No Pokémon match your search.</p>';
    }
  }

  function setFilter(text) {
    _filter = text;
    render();
  }

  function setTypeFilter(type) {
    _typeFilter = type;
    render();
  }

  function init() {
    render();
  }

  return { init, render, setFilter, setTypeFilter };

})();
