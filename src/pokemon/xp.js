// ═══════════════════════════════════════════════════
//  src/pokemon/xp.js   (Part 5)
//  XP / EXP system.
//  Each Pokémon has an XP total that fills a bar.
//  When the bar fills, the Pokémon levels up.
//  XP is persisted in the save file alongside levels.
// ═══════════════════════════════════════════════════

const XPSystem = (() => {

  // ─── XP curve (Medium-Fast) ───────────────────
  // Total XP needed to reach level N.
  // Formula: level³  (Medium-Fast group, used by most Gen 1 Pokémon)
  function xpForLevel(level) {
    return Math.pow(Math.max(1, level), 3);
  }

  /**
   * XP needed to go from level N to level N+1.
   * @param {number} level
   */
  function xpNeeded(level) {
    return xpForLevel(level + 1) - xpForLevel(level);
  }

  /**
   * How much XP into the current level a Pokémon is.
   * @param {number} totalXP
   * @param {number} level
   */
  function xpIntoLevel(totalXP, level) {
    return totalXP - xpForLevel(level);
  }

  /**
   * Percentage (0–100) of the current level bar filled.
   */
  function xpPercent(totalXP, level) {
    const into   = xpIntoLevel(totalXP, level);
    const needed = xpNeeded(level);
    return Math.min(100, Math.max(0, (into / needed) * 100));
  }

  // ─── Grant XP after a battle ──────────────────
  /**
   * Calculate XP reward for defeating an enemy Pokémon.
   * Simplified formula: base = enemyLevel * 3
   * Tower mode multiplies by floor bonus.
   *
   * @param {object} defeated     - Fainted enemy Pokémon
   * @param {number} floorBonus   - 1.0 for quick battle, floor/10 for tower
   * @returns {number} XP to award
   */
  /**
   * Calculate XP reward for defeating an enemy Pokémon.
   * Scales relative to enemy level. In tower mode the floor bonus
   * is applied but starts at a sensible baseline (1.0 at floor 1).
   *
   * @param {object} defeated     - Fainted enemy Pokémon
   * @param {number} floorBonus   - 1.0 at floor 1, grows with floor
   * @param {number} playerLevel  - Current player active Pokémon level
   */
  function calcReward(defeated, floorBonus = 1, playerLevel = 5) {
    // Base: enemy level × 7 (roughly 7× faster than raw level³ grind)
    const base = defeated.level * 7;

    // Level-difference multiplier: beating higher-level enemies gives bonus
    const lvDiff   = (defeated.level - playerLevel) * 0.05;
    const lvMult   = Math.max(0.5, Math.min(3.0, 1 + lvDiff));

    // Floor bonus: gently increases with floor (1.0 at floor 1, 2.0 at floor 10)
    const fBonus = Math.max(1, Math.min(3, floorBonus));

    return Math.max(10, Math.floor(base * lvMult * fBonus));
  }

  /**
   * Grant XP to a live battle Pokémon.
   * Returns an array of level-up events { oldLevel, newLevel }.
   *
   * @param {object} pkmn      - Live battle instance (has .level and .xp)
   * @param {number} amount    - XP to grant
   * @returns {{ levelled: boolean, oldLevel: number, newLevel: number }[]}
   */
  function grant(pkmn, amount) {
    if (!pkmn) return [];

    if (pkmn.xp === undefined) pkmn.xp = xpForLevel(pkmn.level);

    pkmn.xp += amount;

    const events = [];
    while (pkmn.xp >= xpForLevel(pkmn.level + 1)) {
      const oldLevel = pkmn.level;
      pkmn.level++;
      events.push({ levelled: true, oldLevel, newLevel: pkmn.level });
    }

    return events;
  }

  // ─── Render XP bar (in battle info box) ───────
  /**
   * Update the animated XP bar for a Pokémon.
   * @param {string}  side       - 'player'
   * @param {object}  pkmn
   * @param {boolean} animate    - Whether to animate the fill
   */
  function updateBar(side, pkmn, animate = true) {
    if (side !== 'player') return; // Only show XP bar for player side
    const bar = document.getElementById('player-xp-bar-fill');
    if (!bar) return;

    const pct = xpPercent(pkmn.xp ?? xpForLevel(pkmn.level), pkmn.level);
    if (animate) {
      bar.style.transition = 'width 0.8s cubic-bezier(0.22,1,0.36,1)';
    } else {
      bar.style.transition = 'none';
    }
    bar.style.width = `${pct}%`;
  }

  /**
   * Animate the XP bar filling up, potentially rolling over on level-up.
   * @param {string} side
   * @param {object} pkmn
   * @param {number} gainedXP
   */
  async function animateGain(side, pkmn, gainedXP) {
    if (side !== 'player') return;

    const bar    = document.getElementById('player-xp-bar-fill');
    const xpText = document.getElementById('player-xp-text');
    if (!bar) return;

    const startXP  = (pkmn.xp ?? xpForLevel(pkmn.level)) - gainedXP;
    const startPct = xpPercent(startXP, pkmn.level);
    const endPct   = xpPercent(pkmn.xp, pkmn.level);

    // Animate from start to end (or 100% if levelled)
    bar.style.transition = 'none';
    bar.style.width = `${startPct}%`;

    await new Promise(r => requestAnimationFrame(r));

    bar.style.transition = 'width 1s cubic-bezier(0.22,1,0.36,1)';
    bar.style.width = `${endPct}%`;

    if (xpText) {
      const into   = xpIntoLevel(pkmn.xp, pkmn.level);
      const needed = xpNeeded(pkmn.level);
      xpText.textContent = `${into} / ${needed} XP`;
    }
  }

  return {
    xpForLevel, xpNeeded, xpIntoLevel, xpPercent,
    calcReward, grant, updateBar, animateGain,
  };

})();
