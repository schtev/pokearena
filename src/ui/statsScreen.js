// ═══════════════════════════════════════════════════
//  src/ui/statsScreen.js   (Part 3)
//  Renders the detailed Pokémon stats screen.
//  Accessible from Team Builder by clicking a slot.
//  Shows: sprite, types, full stat bars, moveset,
//  evolution chain, and learnset table.
// ═══════════════════════════════════════════════════

const StatsScreen = (() => {

  let _currentKey   = null;
  let _currentLevel = 50;

  /**
   * Open the stats screen for a given Pokémon.
   * @param {string} key   - Pokémon key
   * @param {number} level - Level to display stats at (default 50)
   */
  function show(key, level = 50) {
    _currentKey   = key;
    _currentLevel = level;

    const overlay = document.getElementById('stats-overlay');
    if (!overlay) return;

    render(key, level);
    overlay.classList.remove('hidden');
  }

  function hide() {
    document.getElementById('stats-overlay')?.classList.add('hidden');
  }

  // ─── Full render ──────────────────────────────
  function render(key, level) {
    const data = POKEMON_DATA[key];
    if (!data) return;

    // Create a temporary instance to get real stat values
    const instance = createPokemonInstance(key, level);

    // Header
    document.getElementById('stats-name').textContent   = data.name;
    document.getElementById('stats-num').textContent    = `#${String(data.id).padStart(3,'0')}`;
    document.getElementById('stats-level').textContent  = `Lv. ${level}`;
    document.getElementById('stats-sprite').src         = getSpriteUrl(data.id);

    // Types
    const typesEl = document.getElementById('stats-types');
    typesEl.innerHTML = data.types
      .map(t => `<span class="type-badge type-${t}">${t}</span>`)
      .join('');

    // Stat bars
    renderStatBars(instance, data.baseStats);

    // Moves
    renderMoves(instance.moves, key, level);

    // Evolution chain
    renderEvoChain(key);

    // Learnset table
    renderLearnset(key, level);
  }

  // ─── Stat bars ────────────────────────────────
  const STAT_MAX = { hp:500, attack:300, defense:300, spatk:300, spdef:300, speed:250 };
  const STAT_LABELS = { hp:'HP', attack:'Atk', defense:'Def', spatk:'SpA', spdef:'SpD', speed:'Spe' };
  const STAT_COLORS = {
    hp:      '#3ddc84',
    attack:  '#e8304a',
    defense: '#4e8cff',
    spatk:   '#b06aff',
    spdef:   '#74d0f0',
    speed:   '#f5c518'
  };

  function renderStatBars(instance, baseStats) {
    const container = document.getElementById('stats-bars');
    if (!container) return;
    container.innerHTML = '';

    const stats = [
      ['hp',      instance.maxHP,         baseStats.hp],
      ['attack',  instance.stats.attack,  baseStats.attack],
      ['defense', instance.stats.defense, baseStats.defense],
      ['spatk',   instance.stats.spatk,   baseStats.spatk],
      ['spdef',   instance.stats.spdef,   baseStats.spdef],
      ['speed',   instance.stats.speed,   baseStats.speed],
    ];

    stats.forEach(([key, value, base]) => {
      const pct = Math.min(100, (base / STAT_MAX[key]) * 100);
      const color = STAT_COLORS[key];

      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `
        <span class="stat-label-name">${STAT_LABELS[key]}</span>
        <span class="stat-base">${base}</span>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width:0%;background:${color}" data-target="${pct}"></div>
        </div>
        <span class="stat-value">${value}</span>
      `;
      container.appendChild(row);
    });

    // Animate bars in after a short delay
    requestAnimationFrame(() => {
      container.querySelectorAll('.stat-bar-fill').forEach(bar => {
        setTimeout(() => {
          bar.style.width = bar.dataset.target + '%';
        }, 80);
      });
    });
  }

  // ─── Moves panel ──────────────────────────────
  function renderMoves(moves, key, level) {
    const container = document.getElementById('stats-moves');
    if (!container) return;
    container.innerHTML = '';

    // Current 4 moves
    moves.forEach(move => {
      const card = document.createElement('div');
      card.className = 'stats-move-card';
      card.innerHTML = `
        <div class="smc-top">
          <span class="smc-name">${move.name}</span>
          <span class="type-badge type-${move.type}">${move.type}</span>
        </div>
        <div class="smc-bottom">
          <span class="smc-cat ${move.category}">${move.category}</span>
          <span>Pwr <b>${move.power || '—'}</b></span>
          <span>Acc <b>${move.accuracy >= 999 ? '∞' : move.accuracy}</b></span>
          <span>PP <b>${move.pp}</b></span>
        </div>
      `;
      container.appendChild(card);
    });

    // Empty slots
    for (let i = moves.length; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'stats-move-card empty-move';
      card.textContent = '— Empty —';
      container.appendChild(card);
    }
  }

  // ─── Evolution chain ──────────────────────────
  function renderEvoChain(key) {
    const container = document.getElementById('stats-evo-chain');
    if (!container) return;
    container.innerHTML = '';

    // Walk back to find the start of the chain
    const chain = buildChain(key);

    chain.forEach((step, i) => {
      if (i > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'evo-chain-arrow';
        arrow.innerHTML = `<span>→</span><small>Lv.${step.atLevel}</small>`;
        container.appendChild(arrow);
      }

      const node = document.createElement('div');
      node.className = `evo-chain-node${step.key === key ? ' current' : ''}`;
      node.innerHTML = `
        <img src="${getSpriteUrl(step.id)}" alt="${step.name}" />
        <span>${step.name}</span>
      `;
      node.addEventListener('click', () => {
        if (step.key !== key && POKEMON_DATA[step.key]?.unlocked) {
          render(step.key, _currentLevel);
          _currentKey = step.key;
        }
      });
      container.appendChild(node);
    });
  }

  function buildChain(key) {
    // Evolution table from evolution.js
    const EVO_TABLE = {
      bulbasaur: { into: 'ivysaur', level: 16 },
      ivysaur:   { into: 'venusaur', level: 32 },
      charmander:{ into: 'charmeleon', level: 16 },
      charmeleon:{ into: 'charizard', level: 36 },
      squirtle:  { into: 'wartortle', level: 16 },
      wartortle: { into: 'blastoise', level: 36 },
      pikachu:   { into: 'raichu', level: 22 },
    };

    // Reverse-lookup: find who evolves into this key
    const PREV = {};
    for (const [k, v] of Object.entries(EVO_TABLE)) PREV[v.into] = { key: k, level: v.level };

    // Walk to root
    let root = key;
    while (PREV[root]) root = PREV[root].key;

    // Walk forward from root building chain
    const chain = [];
    let current = root;
    while (current) {
      const d = POKEMON_DATA[current];
      const evo = EVO_TABLE[current];
      chain.push({ key: current, id: d?.id, name: d?.name, atLevel: PREV[current]?.level });
      current = evo?.into || null;
    }

    return chain;
  }

  // ─── Learnset table ───────────────────────────
  function renderLearnset(key, level) {
    const container = document.getElementById('stats-learnset');
    if (!container) return;

    const moves = getLearnsetUpToLevel(key, 100); // show full learnset

    if (moves.length === 0) {
      container.innerHTML = '<p style="color:var(--text-dim);padding:8px">No learnset data.</p>';
      return;
    }

    container.innerHTML = `
      <table class="learnset-table">
        <thead>
          <tr>
            <th>Lv</th>
            <th>Move</th>
            <th>Type</th>
            <th>Cat</th>
            <th>Pwr</th>
            <th>Acc</th>
          </tr>
        </thead>
        <tbody>
          ${moves.map(({ level: lv, move: m, moveKey }) => `
            <tr class="${lv <= level ? '' : 'future-move'}">
              <td class="ls-level">${lv}</td>
              <td class="ls-name">${m.name}</td>
              <td><span class="type-badge type-${m.type}">${m.type}</span></td>
              <td class="ls-cat ${m.category}">${m.category.slice(0,4)}</td>
              <td>${m.power || '—'}</td>
              <td>${m.accuracy >= 999 ? '∞' : m.accuracy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ─── Level slider ─────────────────────────────
  function setLevel(level) {
    _currentLevel = Math.max(1, Math.min(100, level));
    if (_currentKey) render(_currentKey, _currentLevel);
  }

  return { show, hide, setLevel };

})();
