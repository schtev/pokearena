// ═══════════════════════════════════════════════════
//  src/tower/floorTransition.js   (Part 3)
//  Animated floor number reveal between tower fights.
//  Shows: floor number, floor type, enemy preview,
//  and a dramatic slide-in transition.
// ═══════════════════════════════════════════════════

const FloorTransition = (() => {

  // Floor type flavour
  const FLOOR_FLAVOUR = {
    wild:    { icon: '🌿', label: 'Wild Battle',     colour: '#3ddc84', bg: '#0d1f0d' },
    trainer: { icon: '🧑', label: 'Trainer Battle',  colour: '#4e8cff', bg: '#0d0f1f' },
    elite:   { icon: '⚔️', label: 'Elite Trainer',   colour: '#b06aff', bg: '#160d1f' },
    boss:    { icon: '💀', label: 'FLOOR BOSS',       colour: '#e8304a', bg: '#1f0d0d' },
  };

  /**
   * Show the animated floor transition overlay, then resolve when
   * the player clicks "Begin!" (or auto-advances after a short delay).
   *
   * @param {object} floorData  - From Tower.generateFloor()
   * @param {boolean} autoStart - If true, auto-dismiss after 2.5s
   * @returns {Promise<void>}
   */
  function show(floorData, autoStart = false) {
    return new Promise(resolve => {
      const overlay     = document.getElementById('floor-transition-overlay');
      const numEl       = document.getElementById('ft-floor-num');
      const typeIconEl  = document.getElementById('ft-type-icon');
      const typeLabelEl = document.getElementById('ft-type-label');
      const enemyListEl = document.getElementById('ft-enemy-list');
      const beginBtn    = document.getElementById('ft-begin-btn');
      const bgEl        = document.getElementById('ft-bg');

      if (!overlay) { resolve(); return; }

      const flavour = FLOOR_FLAVOUR[floorData.type] || FLOOR_FLAVOUR.trainer;

      // Style
      bgEl.style.background  = flavour.bg;
      numEl.style.color      = flavour.colour;
      numEl.style.textShadow = `3px 3px 0 ${flavour.colour}44, 0 0 40px ${flavour.colour}88`;

      // Content
      numEl.textContent      = `FLOOR ${floorData.floorNumber}`;
      typeIconEl.textContent = flavour.icon;
      typeLabelEl.textContent= flavour.label;
      typeLabelEl.style.color= flavour.colour;

      // Enemy preview
      enemyListEl.innerHTML = '';
      floorData.enemyTeam.forEach(pkmn => {
        const card = document.createElement('div');
        card.className = 'ft-enemy-card';
        card.innerHTML = `
          <img src="${pkmn.spriteUrl}" alt="${pkmn.name}" />
          <span class="ft-enemy-name">${pkmn.name}</span>
          <span class="ft-enemy-level">Lv.${pkmn.level}</span>
          <div class="ft-enemy-types">
            ${pkmn.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')}
          </div>
        `;
        enemyListEl.appendChild(card);
      });

      // Reward hint
      const rewardEl = document.getElementById('ft-reward');
      if (rewardEl) {
        if (floorData.reward) {
          rewardEl.textContent = `🎁 Reward: Unlock ${floorData.reward.name}`;
          rewardEl.style.display = 'block';
        } else {
          rewardEl.style.display = 'none';
        }
      }

      // Show overlay with animation
      overlay.classList.remove('hidden');
      overlay.classList.add('ft-enter');
      setTimeout(() => overlay.classList.remove('ft-enter'), 500);

      // Animate floor number counting up
      animateFloorNum(numEl, floorData.floorNumber, flavour.colour);

      // Begin button
      beginBtn.onclick = () => {
        overlay.classList.add('ft-exit');
        setTimeout(() => {
          overlay.classList.remove('ft-exit');
          overlay.classList.add('hidden');
          resolve();
        }, 400);
      };

      // Auto-start option (for tower continuation flow)
      if (autoStart) {
        setTimeout(() => beginBtn.click(), 2800);
      }
    });
  }

  /**
   * Animate the floor number counting up from 1 (or previous) to target.
   */
  function animateFloorNum(el, target, colour) {
    const start    = Math.max(1, target - 8);
    const duration = 600;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const current  = Math.floor(start + (target - start) * easeOut(progress));
      el.textContent = `FLOOR ${current}`;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = `FLOOR ${target}`;
    }
    requestAnimationFrame(tick);
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /**
   * Update the tower menu floor preview card with live floor data.
   * @param {object} floorData
   */
  function updateMenuPreview(floorData) {
    const card = document.getElementById('floor-preview');
    if (!card) return;

    const flavour = FLOOR_FLAVOUR[floorData.type] || FLOOR_FLAVOUR.trainer;

    card.innerHTML = `
      <div class="floor-card" style="border-color:${flavour.colour};box-shadow:0 0 20px ${flavour.colour}44">
        <div class="floor-type-badge" style="background:${flavour.colour}">
          ${flavour.icon} ${flavour.label.toUpperCase()}
        </div>
        <div class="ft-preview-enemies">
          ${floorData.enemyTeam.slice(0, 3).map(p => `
            <div class="ft-preview-enemy">
              <img src="${p.spriteUrl}" alt="${p.name}" />
              <span>${p.name}</span>
              <span style="font-size:10px;color:var(--text-muted)">Lv.${p.level}</span>
            </div>
          `).join('')}
        </div>
        ${floorData.reward
          ? `<p class="floor-reward">🎁 ${floorData.reward.name} unlock on clear!</p>`
          : `<p style="color:var(--text-dim);font-size:12px">No reward this floor</p>`
        }
        <p style="color:${flavour.colour};font-family:var(--font-pixel);font-size:9px;margin-top:4px">
          ${floorData.trainerName}
        </p>
      </div>
    `;
  }

  return { show, updateMenuPreview };

})();
