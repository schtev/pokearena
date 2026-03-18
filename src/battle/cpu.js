// ═══════════════════════════════════════════════════
//  src/battle/cpu.js
//  CPU AI — three difficulty tiers.
//
//  Tier 1 (RANDOM)  — picks any available move randomly
//  Tier 2 (SMART)   — picks best type-effectiveness move
//  Tier 3 (PREDICT) — considers player's move, switches smart
//
//  Tower floors 1–9:  Tier 1
//  Tower floors 10–29: Tier 2
//  Tower floors 30+:   Tier 3 (boss floors always Tier 3)
// ═══════════════════════════════════════════════════

const CPU = (() => {

  // ─── Tier 1: Random ───────────────────────────
  /**
   * Pick a random move with PP remaining.
   * Falls back to Struggle if all PP is drained.
   * @param {object} cpuPkmn
   * @returns {object} move
   */
  function randomMove(cpuPkmn) {
    const available = cpuPkmn.moves.filter(m => (m.currentPP ?? m.pp) > 0);
    if (available.length === 0) return getStruggle();
    return available[Math.floor(Math.random() * available.length)];
  }

  // ─── Tier 2: Smart ────────────────────────────
  /**
   * Score each move by:
   *   score = power × typeEffectiveness × stab
   * Pick the highest-scoring move.
   * Prefers damaging moves but will use status moves if nothing hits well.
   *
   * @param {object} cpuPkmn
   * @param {object} playerPkmn
   * @returns {object} move
   */
  function smartMove(cpuPkmn, playerPkmn) {
    const available = cpuPkmn.moves.filter(m => (m.currentPP ?? m.pp) > 0);
    if (available.length === 0) return getStruggle();

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of available) {
      let score = 0;

      if (move.power > 0) {
        const effectiveness = getTypeEffectiveness(move.type, playerPkmn.types);
        const stab = cpuPkmn.types.includes(move.type) ? 1.5 : 1;
        score = move.power * effectiveness * stab;

        // Avoid moves that don't affect the target at all
        if (effectiveness === 0) score = -100;

        // Small bonus for high-priority moves when player is low HP
        const playerHPPct = playerPkmn.currentHP / playerPkmn.maxHP;
        if ((move.priority || 0) > 0 && playerHPPct < 0.25) score += 30;
      } else {
        // Status moves — give them a base score so CPU uses them sometimes
        score = 20;

        // CPU is smarter about status: only sleep/paralyse if player isn't already afflicted
        if (move.effect && move.effect.startsWith('paralysis') && playerPkmn.status) score = -50;
        if (move.effect && move.effect.startsWith('sleep') && playerPkmn.status) score = -50;

        // Boost moves: worth doing if CPU is healthy
        const cpuHPPct = cpuPkmn.currentHP / cpuPkmn.maxHP;
        if (move.effect && move.effect.includes('up') && cpuHPPct > 0.6) score = 40;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove  = move;
      }
    }

    return bestMove || randomMove(cpuPkmn);
  }

  // ─── Tier 3: Predictive ───────────────────────
  /**
   * Extends smart logic with:
   * - Considers if the CPU will move first and can KO the player
   * - Uses recovery moves if below 30% HP
   * - Switches to a different attack if the player appears to wall it
   *   (Note: switching Pokémon handled by the battle UI separately)
   *
   * @param {object} cpuPkmn
   * @param {object} playerPkmn
   * @param {object} context   - { cpuTeam, playerTeam, turnNumber }
   * @returns {object} move
   */
  function predictiveMove(cpuPkmn, playerPkmn, context = {}) {
    const available = cpuPkmn.moves.filter(m => (m.currentPP ?? m.pp) > 0);
    if (available.length === 0) return getStruggle();

    const cpuHPPct    = cpuPkmn.currentHP / cpuPkmn.maxHP;
    const playerHPPct = playerPkmn.currentHP / playerPkmn.maxHP;

    // Prioritise recovery if very low HP
    if (cpuHPPct < 0.25) {
      const healMove = available.find(m =>
        m.effect && (m.effect.startsWith('heal') || m.effect === 'rest')
      );
      if (healMove) return healMove;
    }

    // Try to find a move that can KO (very rough estimate)
    for (const move of available) {
      if (move.power === 0) continue;
      const { damage } = BattleEngine.calculateDamage(cpuPkmn, playerPkmn, move);
      if (damage >= playerPkmn.currentHP) {
        // This move can finish them — use it!
        return move;
      }
    }

    // Otherwise fall back to smart logic
    return smartMove(cpuPkmn, playerPkmn);
  }

  // ─── Team Switch Decision ─────────────────────
  /**
   * CPU decides whether to switch based on current matchup.
   * Returns the index in cpuTeam to switch to, or -1 for no switch.
   * Only used by Tier 3 AI (predictive).
   *
   * @param {object} cpuPkmn     - Active CPU Pokémon
   * @param {object} playerPkmn  - Active player Pokémon
   * @param {object[]} cpuTeam   - Full CPU team
   * @returns {number} teamIndex or -1
   */
  function considerSwitch(cpuPkmn, playerPkmn, cpuTeam) {
    const cpuHPPct = cpuPkmn.currentHP / cpuPkmn.maxHP;
    if (cpuHPPct > 0.5) return -1; // don't switch if healthy

    // Find a team member with a better type matchup
    let bestIdx   = -1;
    let bestScore = 0;

    for (let i = 0; i < cpuTeam.length; i++) {
      const candidate = cpuTeam[i];
      if (candidate === cpuPkmn) continue;
      if (BattleEngine.hasFainted(candidate)) continue;

      // Score based on how well this Pokémon resists the player's types
      let resistScore = 0;
      for (const pType of playerPkmn.types) {
        const mult = getTypeEffectiveness(pType, candidate.types);
        if (mult < 1) resistScore += 2;
        if (mult === 0) resistScore += 4;
        if (mult > 1) resistScore -= 2;
      }

      if (resistScore > bestScore) {
        bestScore = resistScore;
        bestIdx   = i;
      }
    }

    // Only switch if the candidate is meaningfully better (score > 2)
    return bestScore > 2 ? bestIdx : -1;
  }

  // ─── Struggle ─────────────────────────────────
  /**
   * Fallback move when all PP is depleted.
   * Deals fixed damage and hurts the user too.
   */
  function getStruggle() {
    return {
      id:         'struggle',
      name:       'Struggle',
      type:       'normal',
      category:   'physical',
      power:      50,
      accuracy:   100,
      pp:         999,
      currentPP:  999,
      effect:     'recoil_25'
    };
  }

  // ─── Main entry point ─────────────────────────
  /**
   * Choose a CPU move based on difficulty tier.
   *
   * @param {object} cpuPkmn
   * @param {object} playerPkmn
   * @param {number} tier       - 1 | 2 | 3
   * @param {object} context    - Extra data for Tier 3
   * @returns {object} The chosen move
   */
  function chooseMove(cpuPkmn, playerPkmn, tier = 1, context = {}) {
    switch (tier) {
      case 1: return randomMove(cpuPkmn);
      case 2: return smartMove(cpuPkmn, playerPkmn);
      case 3: return predictiveMove(cpuPkmn, playerPkmn, context);
      default: return randomMove(cpuPkmn);
    }
  }

  /**
   * Get the AI tier for a given floor number.
   * @param {number} floorNumber
   * @returns {number} 1 | 2 | 3
   */
  function getTierForFloor(floorNumber) {
    if (floorNumber >= 30) return 3;
    if (floorNumber >= 10) return 2;
    return 1;
  }

  return {
    chooseMove,
    randomMove,
    smartMove,
    predictiveMove,
    considerSwitch,
    getTierForFloor
  };

})();
