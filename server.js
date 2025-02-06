// server.js

// Modules importeren
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Express-app en HTTP-server opzetten
const app = express();
const server = http.createServer(app);

// Socket.IO initialiseren op de HTTP-server
// Voeg CORS-instellingen toe zodat verzoeken van http://127.0.0.1:5500 toegestaan worden
const io = socketIo(server, {
    cors: {
      origin: "*",  // Of vervang door "*" om alle origins toe te staan
      methods: ["GET", "POST"],
      credentials: true
    }
  });

// In-memory opslag voor spelers en spelstatus
let players = {};  // Bijvoorbeeld: { socketId: { name: string, score: number } }
let gameStarted = false;
let currentBlock = null; // Kan 'orange' of 'decoy' zijn
let blockActive = false;
let blockTimeout = null;

// Variabele voor de huidige lobbycode
let currentLobbyCode = null;

// Functie om een willekeurige lobby-ID te genereren (standaard 6 tekens)
function generateLobbyId(length = 6) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Serveer statische bestanden vanuit de map 'public'
app.use(express.static('public'));

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`Client verbonden: ${socket.id}`);
  
  // Event: Lobby genereren via de socket (bijvoorbeeld vanuit een admin-UI)
  socket.on('generateLobby', () => {
    currentLobbyCode = generateLobbyId();
    console.log(`Nieuwe lobby gegenereerd via socket: ${currentLobbyCode}`);
    socket.emit('lobbyGenerated', { lobbyCode: currentLobbyCode });
  });

  // Event: Een speler probeert de lobby te joinen
  socket.on('joinLobby', (data) => {
    // Controleer of de ingevoerde lobbycode overeenkomt met de huidige code
    if (data.lobbyCode === currentLobbyCode) {
      players[socket.id] = { name: data.name, score: 0 };
      console.log(`${data.name} is de lobby binnengekomen.`);
      io.emit('lobbyUpdate', players);
    } else {
      // Fout: lobbycode klopt niet
      socket.emit('lobbyError', { message: 'Ongeldige lobby code.' });
      console.log(`Lobby join poging mislukt voor ${data.name}. Ingevoerde code: ${data.lobbyCode}`);
    }
  });

  // Event: Spel starten (bijv. door de host)
  socket.on('startGame', () => {
    if (!gameStarted) {
      gameStarted = true;
      io.emit('gameStarted');
      console.log('Het spel is gestart.');
      startRound();
    }
  });

  // Event: Een speler klikt tijdens het spel
  socket.on('clientClick', () => {
    if (blockActive && currentBlock === 'orange') {
      players[socket.id].score += 1;
      io.emit('scoreUpdate', players);
      blockActive = false;
      clearTimeout(blockTimeout);
      io.emit('blockClicked', { winner: players[socket.id].name });
      console.log(`${players[socket.id].name} heeft op een oranje blok geklikt.`);
    }
  });

  // Event: Een client verbreekt de verbinding
  socket.on('disconnect', () => {
    console.log(`Client verbroken: ${socket.id}`);
    delete players[socket.id];
    io.emit('lobbyUpdate', players);
  });
});

// Functie om een spelronde te starten
function startRound() {
  const roundDuration = 60000; // 60 seconden
  const delay = Math.floor(Math.random() * 7000) + 3000; // Tussen 3 en 10 seconden
  setTimeout(() => {
    const isOrange = Math.random() < 0.5;
    currentBlock = isOrange ? 'orange' : 'decoy';
    blockActive = true;
    io.emit('blockAppear', { type: currentBlock });
    console.log(`Blok verschijnt: ${currentBlock}`);
    
    // Het blok blijft 2 seconden actief
    blockTimeout = setTimeout(() => {
      blockActive = false;
      io.emit('blockDisappear', { type: currentBlock });
      console.log(`Blok verdwijnt: ${currentBlock}`);
      if (gameStarted) {
        startRound();
      }
    }, 2000);
  }, delay);
  
  // Na de ronde stopt het spel en worden de scores verzonden
  setTimeout(() => {
    gameStarted = false;
    io.emit('roundEnded', players);
    console.log('Ronde beëindigd. Finale scores:', players);
  }, roundDuration);
}

// Start de server op poort 3000
server.listen(3000, () => {
  console.log('Server luistert op poort 3000');
  console.log("Typ 'mklobby' in de console om een nieuwe lobby te genereren.");
});

// Voeg een console-commando toe zodat je vanuit de terminal een lobby kunt genereren
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (input) => {
  const command = input.trim();
  if (command === 'mklobby') {
    currentLobbyCode = generateLobbyId();
    console.log(`Nieuwe lobby gegenereerd via console: ${currentLobbyCode}`);
  } else if (command === 'startgame') {
    startRound();
  }
  else {
    console.log(`Onbekend commando: ${command}`);
  }
});
