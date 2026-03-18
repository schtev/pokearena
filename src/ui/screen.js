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
        break;
      case 'screen-battle':
        // Battle is initialised by startBattle() or startTowerBattle()
        break;
    }
  }

  /**
   * Returns the currently visible screen element.
   */
  function current() {
    return currentScreen;
  }

  return { show, current };

})();
