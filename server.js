// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const port = 3000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- Optional Authentication Middleware ---
// This middleware requires that a query parameter "token" equals "UNITY".
io.use((socket, next) => {
  if (socket.handshake.query.token === "UNITY") {
    next();
  } else {
    next(new Error("Authentication error"));
  }
});

// --- Lobby Storage ---
// Store lobbies in an object, keyed by lobby code.
let lobbies = {}; // Each lobby is an object with properties below.

// Lobby structure:
// {
//   code: string,
//   tvSocketId: string,          // Socket ID of the TV (host) that created the lobby.
//   players: { [socketId]: { name: string, score: number } },
//   gameStarted: boolean,
//   currentBlock: string,        // "orange" or "decoy"
//   blockActive: boolean,
//   blockTimeout: Timeout reference
// }

// Generate a random lobby code (default 6 characters)
function generateLobbyId(length = 6) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Helper to log current server stats
function logServerStats() {
  let lobbyCount = Object.keys(lobbies).length;
  let totalPlayers = 0;
  for (let code in lobbies) {
    totalPlayers += Object.keys(lobbies[code].players).length;
  }
  console.log(`Server Stats: ${lobbyCount} active lobby(ies), ${totalPlayers} player(s) connected.`);
}

// Socket.IO connection handling
io.on('connection', socket => {
  console.log(`Client connected: ${socket.id}`);

  // --- TV Client creates a lobby ---
  socket.on('createLobby', data => {
    const lobbyCode = generateLobbyId();
    // Create a new lobby object
    lobbies[lobbyCode] = {
      code: lobbyCode,
      tvSocketId: socket.id,
      players: {},
      gameStarted: false,
      currentBlock: null,
      blockActive: false,
      blockTimeout: null
    };
    // Add the TV client to a room with the lobby code
    socket.join(lobbyCode);
    console.log(`Lobby [${lobbyCode}] created by TV ${socket.id}`);
    socket.emit('lobbyCreated', lobbyCode);
    io.to(lobbyCode).emit('lobbyUpdate', getPlayersListString(lobbies[lobbyCode]));
    logServerStats();
  });

  // --- Mobile client joins a lobby ---
  socket.on('joinLobby', data => {
    // Expect data: { name: string, lobbyCode: string }
    if (!data.lobbyCode) {
      socket.emit('lobbyError', { message: 'No lobby code provided.' });
      console.log(`Join failed for ${data.name}: no lobby code provided.`);
      return;
    }
    let lobby = lobbies[data.lobbyCode];
    if (!lobby) {
      socket.emit('lobbyError', { message: 'Lobby does not exist.' });
      console.log(`Join failed for ${data.name}: lobby ${data.lobbyCode} does not exist.`);
      return;
    }
    // Add the mobile player to the lobby and join the corresponding room.
    lobby.players[socket.id] = { name: data.name, score: 0 };
    socket.join(lobby.code);
    console.log(`${data.name} joined lobby ${lobby.code}`);
    io.to(lobby.code).emit('lobbyUpdate', getPlayersListString(lobby));
    socket.emit('lobbyJoined', lobby.code);
    logServerStats();
  });

  // --- TV Client starts the game ---
  socket.on('startGame', () => {
    // Identify the lobby by checking if the socket is the TV host.
    let lobby = null;
    for (let code in lobbies) {
      if (lobbies[code].tvSocketId === socket.id) {
        lobby = lobbies[code];
        break;
      }
    }
    if (!lobby) {
      socket.emit('lobbyError', { message: 'You are not the lobby host.' });
      return;
    }
    if (!lobby.gameStarted) {
      lobby.gameStarted = true;
      console.log(`Game started in lobby ${lobby.code}`);
      io.to(lobby.code).emit('gameStarted');
      startRound(lobby);
    }
  });

  // --- Mobile client sends a click event during the game ---
  socket.on('clientClick', () => {
    let lobby = getLobbyBySocket(socket.id);
    if (!lobby || !lobby.blockActive) return;
    if (lobby.currentBlock === "orange") {
      if (lobby.players[socket.id]) {
        lobby.players[socket.id].score += 1;
        io.to(lobby.code).emit('scoreUpdate', lobby.players);
        io.to(lobby.code).emit('scorePopup', { playerName: lobby.players[socket.id].name, points: "+1" });
        console.log(`${lobby.players[socket.id].name} scored +1 in lobby ${lobby.code}`);
      }
    } else if (lobby.currentBlock === "decoy") {
      if (lobby.players[socket.id]) {
        lobby.players[socket.id].score -= 1;
        io.to(lobby.code).emit('scoreUpdate', lobby.players);
        io.to(lobby.code).emit('scorePopup', { playerName: lobby.players[socket.id].name, points: "-1" });
        console.log(`${lobby.players[socket.id].name} scored -1 in lobby ${lobby.code}`);
      }
    }
    // Hide the block immediately and cancel the timeout.
    lobby.blockActive = false;
    if (lobby.blockTimeout) clearTimeout(lobby.blockTimeout);
    io.to(lobby.code).emit('blockDisappear', { blockType: lobby.currentBlock });
  });

  // --- On disconnect, remove player or close lobby ---
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    for (let code in lobbies) {
      let lobby = lobbies[code];
      if (lobby.players[socket.id]) {
        console.log(`${lobby.players[socket.id].name} removed from lobby ${code}`);
        delete lobby.players[socket.id];
        io.to(code).emit('lobbyUpdate', getPlayersListString(lobby));
      }
      // If the TV host disconnects, close the lobby.
      if (lobby.tvSocketId === socket.id) {
        console.log(`TV host left. Closing lobby ${code}.`);
        io.to(code).emit('lobbyClosed', { message: "Lobby closed by host." });
        delete lobbies[code];
      }
    }
    logServerStats();
  });
});

// Helper: Get a comma-separated list of player names in a lobby.
function getPlayersListString(lobby) {
  let names = [];
  for (let id in lobby.players) {
    names.push(lobby.players[id].name);
  }
  return names.join(',');
}

// Helper: Find the lobby that contains a given socket id.
function getLobbyBySocket(socketId) {
  for (let code in lobbies) {
    if (lobbies[code].players[socketId]) {
      return lobbies[code];
    }
  }
  return null;
}

// Function to start a game round in a given lobby.
function startRound(lobby) {
  const roundDuration = 60000; // 60 seconds of gameplay
  const delay = Math.floor(Math.random() * 7000) + 3000; // delay between 3 and 10 seconds

  setTimeout(() => {
    lobby.currentBlock = (Math.random() < 0.5) ? "orange" : "decoy";
    lobby.blockActive = true;
    io.to(lobby.code).emit('blockAppear', { blockType: lobby.currentBlock });
    console.log(`Lobby ${lobby.code}: Block appears: ${lobby.currentBlock}`);

    lobby.blockTimeout = setTimeout(() => {
      lobby.blockActive = false;
      io.to(lobby.code).emit('blockDisappear', { blockType: lobby.currentBlock });
      console.log(`Lobby ${lobby.code}: Block disappears: ${lobby.currentBlock}`);
      if (lobby.gameStarted) startRound(lobby);
    }, 2000); // Block visible for 2 seconds
  }, delay);

  // End the round after roundDuration
  setTimeout(() => {
    lobby.gameStarted = false;
    io.to(lobby.code).emit('roundEnded', lobby.players);
    console.log(`Lobby ${lobby.code}: Round ended. Final scores:`, lobby.players);
  }, roundDuration);
}

// --- Console Command Functionality ---
// Commands: 
//    emit <eventName> [jsonPayload]  -> Emit an event to all clients
//    stats                           -> Display server stats
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  input = input.trim();
  if (input.length === 0) return;
  let parts = input.split(' ');
  if (parts[0] === "emit") {
    if (parts.length < 2) {
      console.log("Usage: emit <eventName> [jsonPayload]");
      return;
    }
    let eventName = parts[1];
    let payload = {};
    if (parts.length > 2) {
      let eventIndex = input.indexOf(eventName);
      let jsonPart = input.substring(eventIndex + eventName.length).trim();
      try {
        payload = JSON.parse(jsonPart);
      } catch (e) {
        console.log("Invalid JSON payload:", e);
        return;
      }
    }
    console.log(`Emitting event '${eventName}' with payload:`, payload);
    io.emit(eventName, payload);
  } else if (parts[0] === "stats") {
    let lobbyCount = Object.keys(lobbies).length;
    let totalPlayers = 0;
    for (let code in lobbies) {
      totalPlayers += Object.keys(lobbies[code].players).length;
    }
    console.log(`Server Stats: ${lobbyCount} active lobby(ies), ${totalPlayers} player(s) connected.`);
  } else {
    console.log(`Unknown command. Use "emit <eventName> [jsonPayload]" or "stats".`);
  }
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log("Type commands in the console to emit events or 'stats' to view server statistics.");
});
