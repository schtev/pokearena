// ═══════════════════════════════════════════════════
//  src/ui/screen.js
//  Simple screen manager.
//  All game screens are <div id="screen-X"> elements
//  in the HTML. This module shows/hides them with
//  a CSS transition.
// ═══════════════════════════════════════════════════

const Screen = (() => {

  let currentScreen = null;

  /**
   * Show a screen by its element ID.
   * Hides all other screens first.
   * @param {string} id - e.g. 'screen-menu'
   */
  function show(id) {
    // Hide current screen
    if (currentScreen) {
      currentScreen.style.display = 'none';
      currentScreen.classList.remove('active');
    }

    const next = document.getElementById(id);
    if (!next) {
      console.error(`Screen not found: ${id}`);
      return;
    }

    next.style.display = 'flex';

    // Allow the browser a frame to register the display change
    // before adding 'active' (which triggers the CSS transition)
    requestAnimationFrame(() => {
      next.classList.add('active');
    });

    currentScreen = next;

    // Run any screen-specific init hooks
    onScreenShow(id);
  }

  /**
   * Per-screen setup called after the transition.
   * @param {string} id
   */
  function onScreenShow(id) {
    switch (id) {
      case 'screen-team':
        TeamBuilder.renderTeamSlots();
        TeamBuilder.renderCollection();
        break;

      case 'screen-tower-menu':
        Tower.init();
        if (typeof FloorTransition !== 'undefined') {
          const floorData = Tower.generateFloor(Tower.getCurrentFloor());
          FloorTransition.updateMenuPreview(floorData);
        }
        const unlockedEl = document.getElementById('unlocked-count');
        if (unlockedEl) unlockedEl.textContent = SaveSystem.getUnlocked().length;
        break;

      case 'screen-dex':
        if (typeof Pokedex !== 'undefined') Pokedex.init();
        break;

      case 'screen-settings':
        if (typeof Settings !== 'undefined') Settings.init();
        // Update volume display
        const volInput = document.getElementById('settings-volume');
        const volPct   = document.getElementById('settings-volume-pct');
        if (volInput && volPct) {
          volInput.oninput = () => {
            volPct.textContent = `${volInput.value}%`;
            Settings.setVolume(parseInt(volInput.value));
          };
        }
        break;

      case 'screen-online':
        // Populate team preview
        renderPvPTeamPreview();
        break;

      case 'screen-battle':
        break;
    }
  }

  function renderPvPTeamPreview() {
    const container = document.getElementById('pvp-team-preview');
    if (!container) return;
    const keys = TeamBuilder.getTeam();
    if (keys.length === 0) {
      container.innerHTML = '<p style="color:var(--text-dim);font-size:12px">No team built yet.</p>';
      return;
    }
    container.innerHTML = keys.map(key => {
      const d = POKEMON_DATA[key];
      return d ? `
        <div class="pvp-team-slot">
          <img src="${getSpriteUrl(d.id)}" alt="${d.name}" />
          <span>${d.name}</span>
        </div>` : '';
    }).join('');
  }

  /**
   * Returns the currently visible screen element.
   */
  function current() {
    return currentScreen;
  }

  return { show, current };

})();
