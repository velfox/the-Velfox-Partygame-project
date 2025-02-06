// app.js

// Maak verbinding met de Socket.IO-server op poort 3000
const socket = io('http://localhost:3000');

// Element waarin de scenes worden geladen
const appContainer = document.getElementById('app');

// Globale variabele voor de lobbycode (wordt ingesteld nadat join succesvol is)
let lobbyCodeGlobal = null;

/**
 * Laad een scene (HTML-file) dynamisch uit de map 'scenes'.
 * sceneName is de naam van de scene (bijv. 'home', 'lobby', 'countdown', 'game', 'score')
 */
function loadScene(sceneName) {
  fetch(`scenes/${sceneName}.html`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Kan scene "${sceneName}" niet laden`);
      }
      return response.text();
    })
    .then(html => {
      appContainer.innerHTML = html;
      // Na het laden initialiseer je de scene-specifieke functionaliteit.
      initScene(sceneName);
    })
    .catch(err => {
      console.error(err);
      appContainer.innerHTML = `<p style="color:red;">Fout bij het laden van scene: ${err.message}</p>`;
    });
}

/**
 * Initialiseer de scene-specifieke logica op basis van sceneNaam.
 */
function initScene(sceneName) {
  if (sceneName === 'home') {
    // Home scene: toon formulier voor spelernaam en lobbycode
    const joinForm = document.getElementById('joinForm');
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const playerName = document.getElementById('playerName').value;
      const lobbyCode = document.getElementById('lobbyCode').value;
      socket.emit('joinLobby', { name: playerName, lobbyCode: lobbyCode });
    });
    // Luister naar bevestiging dat de lobby succesvol is gejoined
    socket.on('lobbyJoined', (data) => {
      lobbyCodeGlobal = data.lobbyCode;
      console.log(`Lobby succesvol gejoined: ${lobbyCodeGlobal}`);
      loadScene('lobby');
    });
    // Foutafhandeling voor ongeldige lobbycode
    socket.on('lobbyError', (error) => {
      alert('Fout: ' + error.message);
    });
  } else if (sceneName === 'lobby') {
    // Lobby scene: toon de lobbynaam en spelerslijst
    const lobbyNameElem = document.getElementById('lobbyName');
    lobbyNameElem.textContent = `Lobby: ${lobbyCodeGlobal || 'Onbekend'}`;
    // Voor de host: knop om het spel te starten
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        socket.emit('startGame');
      });
    }
  } else if (sceneName === 'countdown') {
    // Countdown scene: start een 3-seconden countdown en speel een notificatiegeluid
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
    // Game scene: initialiseer gameplay
    // Verwacht de volgende elementen in game.html:
    // - Een div met id="block" (waar het blok verschijnt)
    // - Een knop met id="clickButton" (om op het blok te klikken)
    // - Een element met id="gameTimer" (voor de resterende tijd)
    const blockDiv = document.getElementById('block');
    const clickButton = document.getElementById('clickButton');
    const gameTimer = document.getElementById('gameTimer');

    clickButton.addEventListener('click', () => {
      socket.emit('clientClick');
    });

    // Luister naar server-events voor het tonen en verbergen van het blok
    socket.on('blockAppear', (data) => {
      blockDiv.style.display = 'block';
      blockDiv.style.backgroundColor = (data.type === 'orange') ? 'orange' : 'gray';
      console.log(`Blok verschijnt: ${data.type}`);
    });
    socket.on('blockDisappear', () => {
      blockDiv.style.display = 'none';
      console.log('Blok verdwijnt');
    });

    // Start de game-timer van 60 seconden
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
    // Score scene: na 20 seconden terug naar de lobby
    setTimeout(() => {
      loadScene('lobby');
    }, 20000);
  }
}

// Luister naar globale Socket.IO events om de spelerslijst in de lobby te updaten
socket.on('lobbyUpdate', (players) => {
  const listElem = document.getElementById('playersList');
  if (listElem) {
    listElem.innerHTML = '';
    for (const id in players) {
      const li = document.createElement('li');
      li.textContent = `${players[id].name} - Score: ${players[id].score}`;
      listElem.appendChild(li);
    }
  }
});

// Belangrijk: Luister naar het 'gameStarted'-event zodat de client de countdown laadt
socket.on('gameStarted', () => {
  console.log('Game is gestart (vanuit de server)');
  loadScene('countdown');
});

// Start de SPA door de home scene te laden
loadScene('home');
