// ═══════════════════════════════════════════════════
//  src/online/pvp.js   (Part 4)
//  Online PvP client — connects to the Socket.io
//  server (server/server.js), handles matchmaking,
//  room management, and syncing battle moves with
//  the opponent over the network.
//
//  The battle engine runs LOCALLY on both clients
//  with the same seed — moves are exchanged, not
//  game state — so latency only affects turn timing,
//  not the actual battle outcome.
// ═══════════════════════════════════════════════════

const PvP = (() => {

  // ─── State ────────────────────────────────────
  let socket        = null;
  let roomId        = null;
  let playerSlot    = null;   // 0 or 1
  let opponentName  = null;
  let waitingForOpp = false;
  let _connected    = false;

  // Move queue — incoming moves are buffered here so they're never lost
  // if they arrive before waitForOpponentMove() registers its callback.
  const moveQueue    = [];
  let   moveWaiter   = null;   // resolve fn of the currently-waiting Promise, or null

  // The server URL — change this to your Railway/Render URL in production
  const SERVER_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://pokearena.onrender.com'; // ← update this after deploying

  // ─── Connection ───────────────────────────────
  /**
   * Connect to the PvP server.
   * Requires Socket.io CDN to be loaded (see index.html).
   * @param {string} playerName
   */
  function connect(playerName) {
    if (_connected) return;

    if (typeof io === 'undefined') {
      updateStatus('error', 'Socket.io not loaded. Check your internet connection.');
      return;
    }

    updateStatus('connecting', 'Connecting to server...');

    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 8000,
    });

    socket.on('connect', () => {
      _connected = true;
      socket.emit('setName', playerName);
      updateStatus('connected', `Connected as ${playerName}`);
      updateOnlineCount();
    });

    socket.on('disconnect', (reason) => {
      _connected = false;
      updateStatus('disconnected', `Disconnected: ${reason}`);
      resetLobbyUI();
    });

    socket.on('connect_error', (err) => {
      updateStatus('error', `Can't reach server. Is it running?\n${err.message}`);
    });

    // ── Matchmaking ──
    socket.on('waitingForOpponent', () => {
      waitingForOpp = true;
      updateStatus('waiting', '🔍 Searching for opponent...');
      showLobbyState('searching');
    });

    socket.on('battleStart', (data) => {
      waitingForOpp = false;
      roomId       = data.room;
      playerSlot   = data.slot;           // 0 = went first, 1 = went second
      opponentName = data.opponentName;

      updateStatus('matched', `⚔️ Matched with ${opponentName}!`);
      showLobbyState('matched');

      // Give a moment for UI then start the battle
      setTimeout(() => startOnlineBattle(data), 1200);
    });

    // ── Move exchange ──
    // Moves are pushed into a queue so they're never lost if they arrive
    // before the battle engine has registered its next waiter.
    socket.on('opponentMove', (moveId) => {
      if (moveWaiter) {
        // Battle engine is already waiting — resolve immediately
        const resolve = moveWaiter;
        moveWaiter = null;
        resolve(moveId);
      } else {
        // Move arrived early — buffer it
        moveQueue.push(moveId);
      }
    });

    socket.on('opponentDisconnected', () => {
      // Unblock any pending waitForOpponentMove with a sentinel,
      // then let the battle engine trigger the proper victory path.
      if (moveWaiter) {
        const resolve = moveWaiter;
        moveWaiter = null;
        resolve('__opponent_fled__');
      }
      // Also directly notify the battle module in case we're not mid-turn
      if (typeof Battle !== 'undefined' && Battle.opponentFled) {
        Battle.opponentFled(opponentName);
      }
    });

    // ── Chat ──
    socket.on('chatMessage', ({ from, text }) => {
      appendChat(from, text);
    });

    // ── Online count ──
    socket.on('onlineCount', (count) => {
      const el = document.getElementById('pvp-online-count');
      if (el) el.textContent = `${count} trainer${count !== 1 ? 's' : ''} online`;
    });
  }

  function disconnect() {
    if (socket) socket.disconnect();
    _connected    = false;
    socket        = null;
    roomId        = null;
    playerSlot    = null;
    opponentName  = null;
    waitingForOpp = false;
    moveQueue.length = 0;
    moveWaiter    = null;
  }

  // ─── Matchmaking ──────────────────────────────
  function findMatch() {
    if (!_connected) {
      updateStatus('error', 'Not connected to server.');
      return;
    }

    const team = TeamBuilder.getTeam();
    if (team.length === 0) {
      TeamBuilder.showToast('Build a team first!');
      return;
    }

    // Send team summary (just keys + levels) — the opponent doesn't need full data
    socket.emit('findMatch', {
      name:      getPlayerName(),
      teamKeys:  team,
    });
  }

  function cancelSearch() {
    if (socket) socket.emit('cancelSearch');
    waitingForOpp = false;
    showLobbyState('idle');
    updateStatus('connected', 'Search cancelled.');
  }

  // ─── Sending moves ────────────────────────────
  /**
   * Send the player's chosen move index to the opponent.
   * Both clients run the same engine with the same inputs,
   * so we only need to exchange move indices, not game state.
   * @param {string} moveId
   */
  function sendMove(moveId) {
    if (socket && roomId) {
      socket.emit('move', { room: roomId, moveId });
    }
  }

  /**
   * Returns a Promise that resolves with the next opponent move ID.
   * If a move already arrived and is buffered in the queue, resolves immediately.
   * This replaces the old callback-based onOpponentMove.
   */
  function waitForMove() {
    return new Promise((resolve) => {
      if (moveQueue.length > 0) {
        // Move already arrived — consume it immediately
        resolve(moveQueue.shift());
      } else {
        // Nothing yet — register as waiter
        moveWaiter = resolve;
      }
    });
  }

  /**
   * Legacy alias kept so Battle.start() opts still work.
   * @param {Function} cb  — ignored; use waitForMove() instead
   */
  function onOpponentMove(cb) {
    // No-op: move delivery is now handled by waitForMove()
  }

  // ─── Chat ─────────────────────────────────────
  function sendChat(text) {
    if (!socket || !roomId || !text.trim()) return;
    socket.emit('chatMessage', { room: roomId, text: text.trim() });
    appendChat('You', text.trim());
  }

  function appendChat(from, text) {
    const log = document.getElementById('pvp-chat-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.innerHTML = `<b>${from}:</b> ${escapeHtml(text)}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // ─── Online battle integration ─────────────────
  function startOnlineBattle(data) {
    const level = parseInt(document.getElementById('pvp-battle-level')?.value || '50', 10);
    const playerTeam = TeamBuilder.buildBattleTeam(level);

    // Build opponent team from their key list at the same level
    const enemyTeam = (data.opponentTeam || ['charizard','blastoise','venusaur'])
      .map(k => createPokemonInstance(k, level))
      .filter(Boolean);

    Screen.show('screen-battle');

    // Start battle in PvP mode — moves must be sent/received via socket
    Battle.start(playerTeam, enemyTeam, {
      tower:   false,
      cpuTier: 0,       // 0 = no CPU, moves come from socket
      pvp:     true,
      slot:    playerSlot,
      sendMove,
      onOpponentMove: waitForMove,   // queue-aware Promise-based receiver
    });
  }

  function endOnlineBattle(won) {
    disconnect();
    const overlay = document.getElementById('result-overlay');
    const icon    = document.getElementById('result-icon');
    const title   = document.getElementById('result-title');
    const detail  = document.getElementById('result-detail');

    if (overlay) {
      icon.textContent  = won ? '🏆' : '💀';
      title.textContent = won ? 'Victory!' : 'Defeated!';
      detail.textContent = won
        ? `You beat ${opponentName}!`
        : `${opponentName} wins this time.`;
      overlay.classList.remove('hidden');
    }
  }

  // ─── UI helpers ───────────────────────────────
  function updateStatus(state, msg) {
    const el = document.getElementById('pvp-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = `pvp-status pvp-status-${state}`;
  }

  function showLobbyState(state) {
    // state: 'idle' | 'searching' | 'matched'
    const idleEl      = document.getElementById('pvp-idle');
    const searchingEl = document.getElementById('pvp-searching');
    const matchedEl   = document.getElementById('pvp-matched');

    if (idleEl)      idleEl.classList.toggle('hidden',      state !== 'idle');
    if (searchingEl) searchingEl.classList.toggle('hidden', state !== 'searching');
    if (matchedEl)   matchedEl.classList.toggle('hidden',   state !== 'matched');

    if (state === 'matched' && matchedEl) {
      document.getElementById('pvp-opponent-name').textContent = opponentName || '???';
    }
  }

  function resetLobbyUI() {
    showLobbyState('idle');
    updateStatus('disconnected', 'Not connected');
  }

  function updateOnlineCount() {
    if (socket) socket.emit('requestCount');
  }

  function getPlayerName() {
    const inp = document.getElementById('pvp-name-input');
    return inp?.value?.trim() || 'Trainer';
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return {
    connect, disconnect, findMatch, cancelSearch,
    sendMove, onOpponentMove, waitForMove, sendChat,
    get connected() { return _connected; }
  };

})();
