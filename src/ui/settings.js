// ═══════════════════════════════════════════════════
//  src/ui/settings.js   (Part 4)
//  Profile & Settings screen.
//  Shows: playtime, best floor, collection %, sound
//  toggle, volume, reset save, and version info.
// ═══════════════════════════════════════════════════

const Settings = (() => {

  function render() {
    const save     = SaveSystem.get();
    const unlocked = SaveSystem.getUnlocked();
    const total    = Object.keys(POKEMON_DATA).length;
    const pct      = Math.round((unlocked.length / total) * 100);

    // Playtime
    const ptEl = document.getElementById('settings-playtime');
    if (ptEl) ptEl.textContent = SaveSystem.getPlaytimeString();

    // Best floor
    const bfEl = document.getElementById('settings-best-floor');
    if (bfEl) bfEl.textContent = save.bestFloor > 0 ? `Floor ${save.bestFloor}` : '—';

    // Collection %
    const colEl = document.getElementById('settings-collection');
    if (colEl) colEl.textContent = `${unlocked.length} / ${total} (${pct}%)`;

    // Last saved
    const lsEl = document.getElementById('settings-last-saved');
    if (lsEl) {
      lsEl.textContent = save.lastSaved
        ? new Date(save.lastSaved).toLocaleString()
        : 'Never';
    }

    // Volume slider
    const volEl = document.getElementById('settings-volume');
    if (volEl) volEl.value = Math.round((save.volume ?? 0.35) * 100);

    // Mute toggle label
    updateMuteBtnLabel();
  }

  function updateMuteBtnLabel() {
    const btn = document.getElementById('settings-mute-btn');
    const muted = SaveSystem.get().muted ?? false;
    if (btn) btn.textContent = muted ? '🔇 Unmute' : '🔊 Mute Sound';
  }

  function setVolume(val) {
    const v = val / 100;
    SoundSystem.setVolume(v);
    SaveSystem.get().volume = v;
    SaveSystem.save();
  }

  function toggleMute() {
    const muted = SoundSystem.toggleMute();
    SaveSystem.get().muted = muted;
    SaveSystem.save();
    updateMuteBtnLabel();
    // Also update battle screen mute button if visible
    const battleMuteBtn = document.getElementById('mute-btn');
    if (battleMuteBtn) {
      battleMuteBtn.textContent = muted ? '🔇' : '🔊';
      battleMuteBtn.classList.toggle('muted', muted);
    }
  }

  function confirmReset() {
    const confirmed = window.confirm(
      '⚠️ This will delete ALL save data — team, unlocked Pokémon, tower progress.\n\nAre you absolutely sure?'
    );
    if (!confirmed) return;
    SaveSystem.reset();
    // Re-sync
    Object.keys(POKEMON_DATA).forEach(k => { POKEMON_DATA[k].unlocked = false; });
    SaveSystem.getUnlocked().forEach(k => { if (POKEMON_DATA[k]) POKEMON_DATA[k].unlocked = true; });
    TeamBuilder.init();
    Tower.init();
    render();
    TeamBuilder.showToast('Save data reset. Starting fresh!');
    Screen.show('screen-menu');
  }

  function init() {
    render();
  }

  return { init, render, setVolume, toggleMute, confirmReset };

})();
