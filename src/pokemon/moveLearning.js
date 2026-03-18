// ═══════════════════════════════════════════════════
//  src/pokemon/moveLearning.js   (Part 3)
//  Handles the "Pokémon wants to learn a new move!"
//  flow. Shows a dialogue letting the player pick
//  which existing move to replace (or skip learning).
// ═══════════════════════════════════════════════════

const MoveLearning = (() => {

  /**
   * Check every Pokémon on the battle team for new moves at their
   * current level, and run the learn dialogue sequentially.
   *
   * @param {object[]} battleTeam - Live battle instances (post-level-up)
   * @returns {Promise<void>}
   */
  async function checkAndLearnMoves(battleTeam) {
    for (const pkmn of battleTeam) {
      const knownIds  = pkmn.moves.map(m => m.id);
      const newMoves  = getNewMovesAtLevel(pkmn.key, pkmn.level, knownIds);

      for (const { moveKey } of newMoves) {
        const moveData = MOVES_DATA[moveKey];
        if (!moveData) continue;

        // If the Pokémon has fewer than 4 moves, just add it
        if (pkmn.moves.length < 4) {
          pkmn.moves.push({ ...moveData, id: moveKey, currentPP: moveData.pp });
          showLearnToast(`${pkmn.name} learned ${moveData.name}!`);
          SoundSystem.play('levelUp');
          await wait(1200);
        } else {
          // Full moveset — ask player which move to replace
          await showLearnDialogue(pkmn, moveKey, moveData);
        }
      }
    }
  }

  /**
   * Show the "learn new move" overlay and wait for player decision.
   * @param {object} pkmn      - Live battle Pokémon instance
   * @param {string} moveKey   - Key of the new move
   * @param {object} moveData  - Move object from MOVES_DATA
   */
  function showLearnDialogue(pkmn, moveKey, moveData) {
    return new Promise(resolve => {
      const overlay  = document.getElementById('learn-overlay');
      const titleEl  = document.getElementById('learn-title');
      const newMoveEl= document.getElementById('learn-new-move');
      const slotsEl  = document.getElementById('learn-move-slots');
      const skipBtn  = document.getElementById('learn-skip-btn');

      if (!overlay) { resolve(); return; }

      titleEl.textContent   = `${pkmn.name} wants to learn ${moveData.name}!`;

      // Render new move info
      newMoveEl.innerHTML = `
        <div class="learn-move-card new-move">
          <div class="lmc-header">
            <span class="lmc-name">${moveData.name}</span>
            <span class="type-badge type-${moveData.type}">${moveData.type}</span>
          </div>
          <div class="lmc-stats">
            <span>Power: <b>${moveData.power || '—'}</b></span>
            <span>Acc: <b>${moveData.accuracy >= 999 ? '∞' : moveData.accuracy}</b></span>
            <span>PP: <b>${moveData.pp}</b></span>
            <span class="lmc-cat">${moveData.category}</span>
          </div>
          <div class="lmc-desc">${moveData.desc || ''}</div>
        </div>
      `;

      // Render current 4 moves as replace targets
      slotsEl.innerHTML = '';
      pkmn.moves.forEach((m, i) => {
        const btn = document.createElement('button');
        btn.className = 'learn-slot-btn';
        btn.innerHTML = `
          <div class="lmc-header">
            <span class="lmc-name">${m.name}</span>
            <span class="type-badge type-${m.type}">${m.type}</span>
          </div>
          <div class="lmc-stats">
            <span>Power: <b>${m.power || '—'}</b></span>
            <span>PP: <b>${m.currentPP ?? m.pp}/${m.pp}</b></span>
            <span class="lmc-cat">${m.category}</span>
          </div>
          <div class="lmc-replace-label">← Replace with ${moveData.name}</div>
        `;
        btn.addEventListener('click', () => {
          // Replace this move slot
          pkmn.moves[i] = { ...moveData, id: moveKey, currentPP: moveData.pp };
          showLearnToast(`${pkmn.name} forgot ${m.name} and learned ${moveData.name}!`);
          SoundSystem.play('levelUp');
          overlay.classList.add('hidden');
          resolve();
        });
        slotsEl.appendChild(btn);
      });

      skipBtn.onclick = () => {
        showLearnToast(`${pkmn.name} did not learn ${moveData.name}.`);
        overlay.classList.add('hidden');
        resolve();
      };

      overlay.classList.remove('hidden');
    });
  }

  function showLearnToast(msg) {
    // Reuse the level-up toast style
    if (typeof showLevelUpToast === 'function') {
      showLevelUpToast(msg);
    } else {
      console.log(msg);
    }
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { checkAndLearnMoves, showLearnDialogue };

})();
