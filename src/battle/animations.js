// ═══════════════════════════════════════════════════
//  src/battle/animations.js
//  Visual feedback for battle events.
//  All animations use the Web Animations API +
//  CSS classes defined in style.css.
// ═══════════════════════════════════════════════════

const BattleAnimations = (() => {

  // ─── Helper: Promise-based delay ──────────────
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ─── Sprite shake (attacker lunges forward) ───
  /**
   * Animate the attacker sprite lunging toward the defender.
   * @param {HTMLElement} spriteEl
   * @param {'enemy'|'player'} side
   */
  async function attackLunge(spriteEl, side) {
    const dir = side === 'player' ? 1 : -1; // player lunges right, enemy lunges left
    spriteEl.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${dir * 28}px, -8px)` },
      { transform: 'translate(0, 0)' }
    ], { duration: 300, easing: 'ease-in-out' });
    await wait(300);
  }

  // ─── Defender flash (hit confirmation) ────────
  /**
   * Flash the defender sprite white 3 times to show a hit.
   * @param {HTMLElement} spriteEl
   */
  async function hitFlash(spriteEl) {
    for (let i = 0; i < 3; i++) {
      spriteEl.animate([
        { filter: 'brightness(1) drop-shadow(0 8px 16px rgba(0,0,0,0.6))' },
        { filter: 'brightness(8) drop-shadow(0 8px 30px rgba(255,255,255,0.8))' },
        { filter: 'brightness(1) drop-shadow(0 8px 16px rgba(0,0,0,0.6))' }
      ], { duration: 120, easing: 'ease-in-out' });
      await wait(130);
    }
  }

  // ─── Damage number float ──────────────────────
  /**
   * Show a floating damage number above the defender's sprite.
   * @param {HTMLElement} arenaEl   - Parent element (battle arena)
   * @param {HTMLElement} spriteEl  - Defender sprite (for positioning)
   * @param {number} damage
   * @param {number} effectiveness  - Type multiplier (for colour)
   * @param {boolean} isCrit
   */
  function showDamageFloat(arenaEl, spriteEl, damage, effectiveness, isCrit) {
    const rect = spriteEl.getBoundingClientRect();
    const arenaRect = arenaEl.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = 'damage-float';
    el.textContent = isCrit ? `${damage}★` : `${damage}`;

    // Colour by effectiveness
    if (effectiveness === 0) {
      el.style.display = 'none'; return; // no number for immune
    } else if (effectiveness >= 2) {
      el.style.color = '#ff4d4d';
      el.style.fontSize = '18px';
    } else if (effectiveness < 1) {
      el.style.color = '#8899cc';
    }

    if (isCrit) {
      el.style.color = '#f5c518';
      el.style.fontSize = '18px';
    }

    el.style.left = `${rect.left - arenaRect.left + rect.width / 2 - 20}px`;
    el.style.top  = `${rect.top  - arenaRect.top  - 10}px`;
    el.style.position = 'absolute';
    el.style.zIndex   = '20';

    arenaEl.appendChild(el);
    el.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-50px)' }
    ], { duration: 900, easing: 'ease-out', fill: 'forwards' });

    setTimeout(() => el.remove(), 950);
  }

  // ─── HP Bar drain ─────────────────────────────
  /**
   * Smoothly drain the HP bar to the new percentage.
   * Updates the colour threshold (green → yellow → red).
   *
   * @param {HTMLElement} barEl    - The .hp-bar-fill element
   * @param {HTMLElement} numsEl   - The element showing "HP / maxHP"
   * @param {number} currentHP
   * @param {number} maxHP
   */
  async function drainHP(barEl, numsEl, currentHP, maxHP) {
    const pct = Math.max(0, (currentHP / maxHP) * 100);

    barEl.style.width = `${pct}%`;

    // Colour thresholds
    barEl.classList.remove('mid', 'low');
    if (pct <= 20) barEl.classList.add('low');
    else if (pct <= 50) barEl.classList.add('mid');

    // Update text
    if (numsEl) numsEl.textContent = `${Math.max(0, currentHP)} / ${maxHP}`;

    await wait(500); // match the CSS transition duration
  }

  // ─── Faint animation ──────────────────────────
  /**
   * Make the sprite fall and fade out.
   * @param {HTMLElement} spriteEl
   */
  async function faintAnimation(spriteEl) {
    spriteEl.animate([
      { transform: 'translateY(0)',   opacity: 1 },
      { transform: 'translateY(60px)', opacity: 0 }
    ], { duration: 500, easing: 'ease-in', fill: 'forwards' });
    await wait(500);
  }

  // ─── Pokémon enter animation ──────────────────
  /**
   * New Pokémon slides in from the side.
   * @param {HTMLElement} spriteEl
   * @param {'player'|'enemy'} side
   */
  async function enterAnimation(spriteEl, side) {
    spriteEl.style.opacity = '1'; // reset from faint
    spriteEl.style.transform = '';
    const dir = side === 'player' ? -1 : 1;
    spriteEl.animate([
      { transform: `translateX(${dir * 80}px)`, opacity: 0 },
      { transform: 'translateX(0)',              opacity: 1 }
    ], { duration: 350, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
    await wait(350);
  }

  // ─── Status effect flash ──────────────────────
  /**
   * Flash a status colour (burn=orange, paralysis=yellow, etc.)
   * @param {HTMLElement} spriteEl
   * @param {string} status
   */
  async function statusFlash(spriteEl, status) {
    const colours = {
      burned:   'rgba(255, 100, 0, 0.7)',
      paralyzed:'rgba(255, 220, 0, 0.7)',
      poisoned: 'rgba(180, 0, 220, 0.7)',
      frozen:   'rgba(100, 200, 255, 0.7)',
      asleep:   'rgba(100, 100, 160, 0.6)'
    };
    const colour = colours[status] || 'rgba(255,255,255,0.6)';

    spriteEl.animate([
      { filter: `brightness(1)` },
      { filter: `brightness(0) sepia(1) saturate(5) hue-rotate(0deg) drop-shadow(0 0 12px ${colour})` },
      { filter: `brightness(1)` }
    ], { duration: 400, easing: 'ease-in-out' });

    await wait(400);
  }

  // ─── Screen shake (for powerful moves) ────────
  /**
   * Briefly shake the entire battle arena.
   * @param {HTMLElement} arenaEl
   */
  async function screenShake(arenaEl) {
    arenaEl.animate([
      { transform: 'translate(0, 0)' },
      { transform: 'translate(-6px, 3px)' },
      { transform: 'translate(6px, -3px)' },
      { transform: 'translate(-4px, 4px)' },
      { transform: 'translate(4px, -2px)' },
      { transform: 'translate(0, 0)' }
    ], { duration: 350, easing: 'ease-in-out' });
    await wait(350);
  }

  // ─── Full "attack" sequence ────────────────────
  /**
   * Play the complete visual sequence for one attack:
   *   1. Attacker lunges
   *   2. Hit flash on defender
   *   3. Damage float
   *   4. HP drain
   *   5. Screen shake for big hits (power > 80)
   *
   * @param {object} opts
   *   attackerEl, defenderEl, arenaEl,
   *   defenderHPBar, defenderHPNums,
   *   damage, effectiveness, isCrit,
   *   move, attackerSide,
   *   currentHP, maxHP
   */
  async function playAttackSequence(opts) {
    const {
      attackerEl, defenderEl, arenaEl,
      defenderHPBar, defenderHPNums,
      damage, effectiveness, isCrit,
      move, attackerSide,
      currentHP, maxHP
    } = opts;

    // 1. Lunge
    await attackLunge(attackerEl, attackerSide);

    // 2. Flash + float + drain simultaneously
    if (damage > 0 && effectiveness > 0) {
      hitFlash(defenderEl);
      showDamageFloat(arenaEl, defenderEl, damage, effectiveness, isCrit);

      // Screen shake for powerful moves
      if (move.power >= 80) screenShake(arenaEl);

      await drainHP(defenderHPBar, defenderHPNums, currentHP, maxHP);
    }
  }

  // ─── Public API ───────────────────────────────
  return {
    wait,
    attackLunge,
    hitFlash,
    showDamageFloat,
    drainHP,
    faintAnimation,
    enterAnimation,
    statusFlash,
    screenShake,
    playAttackSequence
  };

})();
