// server.js

// Modules importeren
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Express-app en HTTP-server opzetten
const app = express();
const server = http.createServer(app);

// Socket.IO initialiseren met CORS-instellingen (hier staan we voor alle origins toe)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// In-memory opslag voor spelers en spelstatus
let players = {}; // { socketId: { name: string, score: number } }
let gameStarted = false;
let currentBlock = null; // 'orange' of 'decoy'
let blockActive = false;
let blockTimeout = null;
let currentLobbyCode = null;

// Functie om een willekeurige lobby-ID te genereren (standaard 6 tekens)
function generateLobbyId(length = 6) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Serveer statische bestanden uit de map 'public'
app.use(express.static('public'));

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`Client verbonden: ${socket.id}`);

  // TV-client: maak lobby aan via 'createLobby'
  socket.on('createLobby', () => {
    currentLobbyCode = generateLobbyId();
    console.log(`Nieuwe lobby aangemaakt via TV: ${currentLobbyCode}`);
    socket.emit('lobbyCreated', { lobbyCode: currentLobbyCode });
    // Reset spelerslijst bij aanmaken van een nieuwe lobby
    players = {};
    io.emit('lobbyUpdate', players);
  });

  // joinLobby event: zowel voor TV als mobile
  socket.on('joinLobby', (data) => {
    // Controleer of er een actieve lobby is
    if (!currentLobbyCode) {
      socket.emit('lobbyError', { message: 'Geen actieve lobby beschikbaar.' });
      console.log(`Join poging mislukt voor ${data.name}: geen actieve lobby.`);
      return;
    }
    // Voor TV kan er eventueel een lobbycode worden meegestuurd, voor mobile niet
    if (data.lobbyCode && data.lobbyCode !== currentLobbyCode) {
      socket.emit('lobbyError', { message: 'Ongeldige lobby code.' });
      console.log(`Join poging mislukt voor ${data.name}: verkeerde code ${data.lobbyCode}`);
      return;
    }
    players[socket.id] = { name: data.name, score: 0 };
    console.log(`${data.name} is de lobby binnengekomen.`);
    io.emit('lobbyUpdate', players);
    socket.emit('lobbyJoined', { lobbyCode: currentLobbyCode });
  });

  // Start het spel (voor TV) via 'startGame'
  socket.on('startGame', () => {
    if (!gameStarted && currentLobbyCode) {
      gameStarted = true;
      io.emit('gameStarted');
      console.log('Spel gestart.');
      startRound();
    }
  });

  // Event: speler klikt tijdens het spel (mobile input)
  socket.on('clientClick', () => {
    if (blockActive && currentBlock === 'orange') {
      if (players[socket.id]) {
        players[socket.id].score += 1;
        io.emit('scoreUpdate', players);
        blockActive = false;
        clearTimeout(blockTimeout);
        io.emit('blockClicked', { winner: players[socket.id].name });
        console.log(`${players[socket.id].name} heeft op een oranje blok geklikt.`);
      }
    } else if (blockActive && currentBlock === 'decoy') {
      // Optioneel: negatieve score voor klikken op decoy
      if (players[socket.id]) {
        players[socket.id].score -= 1;
        io.emit('scoreUpdate', players);
        console.log(`${players[socket.id].name} heeft op een decoy geklikt.`);
      }
    }
  });

  // Bij disconnect: verwijder speler en update de lobby
  socket.on('disconnect', () => {
    console.log(`Client verbroken: ${socket.id}`);
    delete players[socket.id];
    io.emit('lobbyUpdate', players);
  });
});

// Functie om een spelronde te starten
function startRound() {
  const roundDuration = 60000; // 60 seconden gameplay
  const delay = Math.floor(Math.random() * 7000) + 3000; // Tussen 3 en 10 seconden vertraging

  setTimeout(() => {
    const isOrange = Math.random() < 0.5;
    currentBlock = isOrange ? 'orange' : 'decoy';
    blockActive = true;
    io.emit('blockAppear', { type: currentBlock });
    console.log(`Blok verschijnt: ${currentBlock}`);

    blockTimeout = setTimeout(() => {
      blockActive = false;
      io.emit('blockDisappear', { type: currentBlock });
      console.log(`Blok verdwijnt: ${currentBlock}`);
      if (gameStarted) {
        startRound();
      }
    }, 1000); // Blok blijft 2 seconden zichtbaar
  }, delay);

  // Na roundDuration stopt het spel en worden de scores verzonden
  setTimeout(() => {
    gameStarted = false;
    io.emit('roundEnded', players);
    console.log('Ronde beëindigd. Finale scores:', players);
  }, roundDuration);
}

// Start de server op poort 3000
server.listen(3000, () => {
  console.log('Server luistert op poort 3000');
  console.log("Typ 'mklobby' in de console om een nieuwe lobby aan te maken.");
});

// Consolecommando's
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  const command = input.trim();
  if (command === 'mklobby') {
    currentLobbyCode = generateLobbyId();
    console.log(`Nieuwe lobby gegenereerd via console: ${currentLobbyCode}`);
    // Optioneel: reset de spelerslijst
    players = {};
    io.emit('lobbyUpdate', players);
  } else if (command === 'startgame') {
    if (!gameStarted && currentLobbyCode) {
      gameStarted = true;
      io.emit('gameStarted');
      console.log('Spel gestart via console.');
      startRound();
    }
  } else {
    console.log(`Onbekend commando: ${command}`);
  }
});
