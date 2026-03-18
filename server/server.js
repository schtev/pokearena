// ═══════════════════════════════════════════════════
//  server/server.js   (Part 4)
//  PokéArena multiplayer server.
//
//  SETUP:
//    1. In your pokearena/ folder run: npm init -y
//    2. npm install express socket.io cors
//    3. node server/server.js
//
//  DEPLOY FREE on Railway:
//    1. Push this repo to GitHub
//    2. Go to railway.app → New Project → Deploy from GitHub
//    3. Select your repo → it auto-detects Node.js
//    4. Add env var: PORT=3000
//    5. Copy the deployment URL into src/online/pvp.js SERVER_URL
//
//  HOW IT WORKS:
//    - Players connect via Socket.io WebSocket
//    - findMatch puts player in queue or pairs them with waiting player
//    - Once paired, both join a private room
//    - Each player sends their move index → server relays to opponent
//    - Both clients run the SAME battle engine with the exchanged moves
//    - No game state lives on the server — it's just a relay
// ═══════════════════════════════════════════════════

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');

const app    = express();
const server = http.createServer(app);

// ─── CORS — allow your GitHub Pages URL ──────────
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      /https:\/\/.+\.github\.io/,        // any GitHub Pages domain
      /https:\/\/.+\.railway\.app/,      // Railway preview URLs
    ],
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.get('/', (req, res) => res.send('PokéArena server running ✅'));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── State ────────────────────────────────────────
const waitingPlayers = [];   // Queue of { socket, name, teamKeys }
const rooms          = {};   // roomId → { players: [socket, socket] }
let onlineCount      = 0;

// ─── Connection handler ───────────────────────────
io.on('connection', (socket) => {
  onlineCount++;
  io.emit('onlineCount', onlineCount);
  console.log(`🟢 Connected: ${socket.id} (${onlineCount} online)`);

  let playerName = 'Trainer';
  let playerTeamKeys = [];

  // ── Identity ──
  socket.on('setName', (name) => {
    playerName = String(name).slice(0, 20) || 'Trainer';
  });

  // ── Matchmaking ──
  socket.on('findMatch', ({ name, teamKeys }) => {
    playerName     = String(name || 'Trainer').slice(0, 20);
    playerTeamKeys = Array.isArray(teamKeys) ? teamKeys : [];

    // Remove from queue if already waiting (reconnect case)
    const existing = waitingPlayers.findIndex(p => p.socket.id === socket.id);
    if (existing !== -1) waitingPlayers.splice(existing, 1);

    if (waitingPlayers.length > 0) {
      // Pair with waiting player
      const opponent = waitingPlayers.pop();
      const roomId   = `battle_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

      socket.join(roomId);
      opponent.socket.join(roomId);

      rooms[roomId] = { players: [opponent.socket, socket], moves: {} };

      // Notify both — slot 0 goes first (determined by who was waiting longer)
      opponent.socket.emit('battleStart', {
        room:         roomId,
        slot:         0,
        opponentName: playerName,
        opponentTeam: playerTeamKeys,
      });

      socket.emit('battleStart', {
        room:         roomId,
        slot:         1,
        opponentName: opponent.name,
        opponentTeam: opponent.teamKeys,
      });

      console.log(`⚔️  Battle: ${opponent.name} vs ${playerName} (room: ${roomId})`);
    } else {
      // Add to queue
      waitingPlayers.push({ socket, name: playerName, teamKeys: playerTeamKeys });
      socket.emit('waitingForOpponent');
      console.log(`⏳ Waiting: ${playerName}`);
    }
  });

  socket.on('cancelSearch', () => {
    const idx = waitingPlayers.findIndex(p => p.socket.id === socket.id);
    if (idx !== -1) waitingPlayers.splice(idx, 1);
  });

  // ── Move relay ──
  // Both clients send their move; server relays each to the OTHER player
  socket.on('move', ({ room, moveId }) => {
    socket.to(room).emit('opponentMove', moveId);
  });

  // ── Chat relay ──
  socket.on('chatMessage', ({ room, text }) => {
    const sanitised = String(text).slice(0, 120);
    socket.to(room).emit('chatMessage', { from: playerName, text: sanitised });
  });

  // ── Online count request ──
  socket.on('requestCount', () => {
    socket.emit('onlineCount', onlineCount);
  });

  // ── Disconnect cleanup ──
  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit('onlineCount', onlineCount);
    console.log(`🔴 Disconnected: ${socket.id} (${onlineCount} online)`);

    // Remove from waiting queue
    const idx = waitingPlayers.findIndex(p => p.socket.id === socket.id);
    if (idx !== -1) waitingPlayers.splice(idx, 1);

    // Notify room partner
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players.some(p => p.id === socket.id)) {
        socket.to(roomId).emit('opponentDisconnected');
        delete rooms[roomId];
        break;
      }
    }
  });
});

// ─── Start ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 PokéArena server running on port ${PORT}`);
});
