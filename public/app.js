// app.js

// Bepaal het clienttype via de URL-parameter (default: mobile)
const urlParams = new URLSearchParams(window.location.search);
const clientType = urlParams.get('client') === 'tv' ? 'tv' : 'mobile';

console.log(`Client type: ${clientType}`);

// Maak verbinding met de Socket.IO-server (dezelfde voor beide clienttypes)
const socket = io('http://localhost:3000');

// Container voor scenes
const appContainer = document.getElementById('app');

// Globale variabele voor de lobbycode
let lobbyCodeGlobal = null;

/**
 * Laad een scene uit de map 'scenes/{clientType}/{sceneName}.html'
 */
function loadScene(sceneName) {
  fetch(`scenes/${clientType}/${sceneName}.html`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Kan scene "${sceneName}" niet laden`);
      }
      return response.text();
    })
    .then(html => {
      appContainer.innerHTML = html;
      initScene(sceneName);
    })
    .catch(err => {
      console.error(err);
      appContainer.innerHTML = `<p style="color:red;">Fout bij het laden van scene: ${err.message}</p>`;
    });
}

/**
 * Initialiseer scene-specifieke logica
 */
function initScene(sceneName) {
  if (sceneName === 'home') {
    // Home scene
    if (clientType === 'tv') {
      // TV-home: alleen knop om een lobby aan te maken
      const createBtn = document.getElementById('createLobbyBtn');
      createBtn.addEventListener('click', () => {
        socket.emit('createLobby');
      });
      // Luister naar 'lobbyCreated'
      socket.on('lobbyCreated', (data) => {
        lobbyCodeGlobal = data.lobbyCode;
        console.log(`Lobby aangemaakt: ${lobbyCodeGlobal}`);
        loadScene('lobby');
      });
    } else {
      // Mobile-home: speler vult alleen zijn naam in
      const joinForm = document.getElementById('joinForm');
      joinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const playerName = document.getElementById('playerName').value;
        // Voor mobiele spelers gaat de joinLobby zonder invoer van lobbycode
        socket.emit('joinLobby', { name: playerName });
      });
      socket.on('lobbyJoined', (data) => {
        lobbyCodeGlobal = data.lobbyCode;
        console.log(`Speler joined lobby: ${lobbyCodeGlobal}`);
        loadScene('lobby');
      });
      socket.on('lobbyError', (error) => {
        alert('Fout: ' + error.message);
      });
    }
  } else if (sceneName === 'lobby') {
    // Lobby scene: toon de lobbycode en spelerslijst
    document.getElementById('lobbyName').textContent = `Lobby: ${lobbyCodeGlobal || 'Onbekend'}`;
    // Voor tv: startknop om het spel te starten
    if (clientType === 'tv') {
      const startBtn = document.getElementById('startGameBtn');
      startBtn.addEventListener('click', () => {
        socket.emit('startGame');
      });
    }
  } else if (sceneName === 'countdown') {
    // Countdown scene: 3 seconden countdown
    const countdownElement = document.getElementById('countdown');
    let count = 3;
    countdownElement.textContent = count;
    const audio = document.getElementById('notificationSound');
    if (audio) audio.play();
    const interval = setInterval(() => {
      count--;
      countdownElement.textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        loadScene('game');
      }
    }, 1000);
  } else if (sceneName === 'game') {
    // Game scene: gameplay
    // Verwacht:
    // - Een div met id="block"
    // - Een element met id="gameTimer"
    // - Op mobile: een knop met id="clickButton"
    const blockDiv = document.getElementById('block');
    const gameTimer = document.getElementById('gameTimer');
    
    if (clientType === 'mobile') {
      const clickButton = document.getElementById('clickButton');
      clickButton.addEventListener('click', () => {
        socket.emit('clientClick');
      });
    }
    // Luister naar server-events voor het tonen/verbergen van blokken
    socket.on('blockAppear', (data) => {
      blockDiv.style.display = 'block';
      blockDiv.style.backgroundColor = (data.type === 'orange') ? 'orange' : 'gray';
      console.log(`Blok verschijnt: ${data.type}`);
    });
    socket.on('blockDisappear', () => {
      blockDiv.style.display = 'none';
      console.log('Blok verdwijnt');
    });
    
    // Start een timer van 60 seconden
    let timeLeft = 60;
    gameTimer.textContent = timeLeft;
    const timerInterval = setInterval(() => {
      timeLeft--;
      gameTimer.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        loadScene('score');
      }
    }, 1000);
  } else if (sceneName === 'score') {
    // Score scene: toon de scores gesorteerd van hoog naar laag, met de winnaar prominent
    // We verwachten dat de server via 'scoreUpdate' de scores stuurt
    socket.on('scoreUpdate', (scores) => {
      // scores is een object: { socketId: { name, score } }
      // Zet dit om naar een array en sorteer op score (aflopend)
      const playersArray = Object.values(scores).sort((a, b) => b.score - a.score);
      const scoreList = document.getElementById('scoreList');
      scoreList.innerHTML = '';
      if (playersArray.length > 0) {
        // Maak de winnaar extra groot
        const winner = playersArray[0];
        const winnerItem = document.createElement('li');
        winnerItem.innerHTML = `<strong style="font-size:2em;">Winner: ${winner.name} - ${winner.score}</strong>`;
        scoreList.appendChild(winnerItem);
        // Voeg de overige spelers toe
        for (let i = 1; i < playersArray.length; i++) {
          const li = document.createElement('li');
          li.textContent = `${playersArray[i].name} - ${playersArray[i].score}`;
          scoreList.appendChild(li);
        }
      }
    });
    // Na 20 seconden keer je terug naar de lobby (alle clients)
    setTimeout(() => {
      loadScene('lobby');
    }, 20000);
  }
}

// Globale Socket.IO event listeners

// Lobby-update: update de spelerslijst in de lobby scene
socket.on('lobbyUpdate', (players) => {
  const listElem = document.getElementById('playersList');
  if (listElem) {
    listElem.innerHTML = '';
    // Sorteer de spelers eventueel op naam of volgorde (hier gewoon in willekeurige volgorde)
    for (const id in players) {
      const li = document.createElement('li');
      li.textContent = `${players[id].name} - Score: ${players[id].score}`;
      listElem.appendChild(li);
    }
  }
});

// Wanneer de server aangeeft dat het spel gestart is, laadt alle clients de countdown scene
socket.on('gameStarted', () => {
  console.log('Game gestart (vanuit server)');
  loadScene('countdown');
});

// Start de SPA door de home scene te laden
loadScene('home');
