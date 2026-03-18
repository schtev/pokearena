// ═══════════════════════════════════════════════════
//  src/ui/battleLog.js   (Part 6)
//  Persistent battle log that records every event
//  in the current battle. Shown via a slide-up panel.
//  Colour-coded by event type.
// ═══════════════════════════════════════════════════

const BattleLog = (() => {

  let _entries = [];
  let _visible = false;

  // ─── Entry types → CSS class ──────────────────
  const CLASS_MAP = {
    player:       'log-player',
    enemy:        'log-enemy',
    system:       'log-system',
    crit:         'log-crit',
    super:        'log-super',
    noteffective: 'log-noteffective',
    weather:      'log-weather',
    ability:      'log-ability',
    item:         'log-item',
    levelup:      'log-levelup',
  };

  // ─── Add entry ────────────────────────────────
  /**
   * @param {string} text
   * @param {'player'|'enemy'|'system'|'crit'|'super'|'noteffective'|
   *          'weather'|'ability'|'item'|'levelup'} type
   */
  function add(text, type = 'system') {
    _entries.push({ text, type, ts: Date.now() });
    if (_entries.length > 120) _entries.shift(); // keep last 120
    if (_visible) _renderLatest();
  }

  function clear() {
    _entries = [];
    const panel = document.getElementById('battle-log-panel');
    if (panel) panel.innerHTML = '';
  }

  // ─── Render ───────────────────────────────────
  function _renderAll() {
    const panel = document.getElementById('battle-log-panel');
    if (!panel) return;
    panel.innerHTML = '';
    _entries.forEach(e => panel.appendChild(_makeEl(e)));
    panel.scrollTop = panel.scrollHeight;
  }

  function _renderLatest() {
    const panel = document.getElementById('battle-log-panel');
    if (!panel) return;
    const last = _entries[_entries.length - 1];
    if (!last) return;
    panel.appendChild(_makeEl(last));
    panel.scrollTop = panel.scrollHeight;
  }

  function _makeEl(entry) {
    const el = document.createElement('div');
    el.className = `log-entry ${CLASS_MAP[entry.type] || 'log-system'}`;
    el.textContent = entry.text;
    return el;
  }

  // ─── Toggle visibility ────────────────────────
  function toggle() {
    _visible = !_visible;
    const panel = document.getElementById('battle-log-panel');
    const btn   = document.getElementById('battle-log-btn');
    if (panel) {
      panel.classList.toggle('hidden', !_visible);
      if (_visible) {
        _renderAll();
        panel.scrollTop = panel.scrollHeight;
      }
    }
    if (btn) btn.textContent = _visible ? '📋 Hide Log' : '📋 Log';
  }

  function hide() {
    _visible = false;
    document.getElementById('battle-log-panel')?.classList.add('hidden');
  }

  // ─── Convenience helpers (called from main.js) ─
  function logMove(attackerName, moveName, side) {
    add(`${attackerName} used ${moveName}!`, side === 'player' ? 'player' : 'enemy');
  }

  function logDamage(defenderName, damage, effectiveness, isCrit) {
    if (isCrit) add(`Critical hit! ${defenderName} took ${damage} damage!`, 'crit');
    else if (effectiveness >= 2) add(`Super effective! ${defenderName} took ${damage}!`, 'super');
    else if (effectiveness < 1 && effectiveness > 0) add(`Not very effective... (${damage} dmg)`, 'noteffective');
    else if (effectiveness === 0) add(`It had no effect!`, 'noteffective');
    else add(`${defenderName} took ${damage} damage.`, 'system');
  }

  function logFaint(pkmnName) {
    add(`${pkmnName} fainted!`, 'system');
  }

  function logWeather(msg)  { add(msg, 'weather'); }
  function logAbility(msg)  { add(msg, 'ability'); }
  function logItem(msg)     { add(msg, 'item'); }
  function logLevelUp(msg)  { add(msg, 'levelup'); }
  function logMiss(moveName){ add(`But it missed!`, 'system'); }
  function logEffect(msg)   { add(msg, 'system'); }

  return {
    add, clear, toggle, hide,
    logMove, logDamage, logFaint, logWeather,
    logAbility, logItem, logLevelUp, logMiss, logEffect,
  };

})();
