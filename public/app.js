// app.ts
// Import `io` from the `socket.io-client` package
import { io } from "socket.io-client";
// Define client type via URL parameter (default: mobile)
const urlParams = new URLSearchParams(window.location.search);
const clientType = urlParams.get('client') === 'tv' ? 'tv' : 'mobile';
console.log(`Client type: ${clientType}`);
// Use the global `io` object provided by the Socket.IO CDN
const socket = io('http://localhost:3000');
// Container for scenes
const appContainer = document.getElementById('app');
// Global variable for lobby code
let lobbyCodeGlobal = null;
/**
 * Load a scene from 'scenes/{sceneName}.html'
 */
function loadScene(sceneName, sceneData = {}) {
    // Include clientType in the path for scenes
    const clientPath = sceneData.clientType ? `${sceneData.clientType}/` : '';
    fetch(`scenes/${clientPath}${sceneName}.html`)
        .then(response => {
        if (!response.ok) {
            throw new Error(`Cannot load scene "${sceneName}"`);
        }
        return response.text();
    })
        .then(html => {
        appContainer.innerHTML = html;
        initScene(sceneName, sceneData);
    })
        .catch(err => {
        console.error(err);
        appContainer.innerHTML = `<p style="color:red;">Error loading scene: ${err.message}</p>`;
    });
}
/**
 * Initialize scene-specific logic
 */
function initScene(sceneName, sceneData) {
    if (sceneName === 'welcome') {
        // Welcome scene: handle button clicks
        const hostButton = document.getElementById('hostButton');
        const playerButton = document.getElementById('playerButton');
        hostButton.addEventListener('click', () => {
            // Set clientType to 'tv' and load the TV home scene
            loadScene('home', { clientType: 'tv' });
        });
        playerButton.addEventListener('click', () => {
            // Set clientType to 'mobile' and load the Mobile home scene
            loadScene('home', { clientType: 'mobile' });
        });
    }
    else if (sceneName === 'home') {
        // Home scene logic
        const clientType = sceneData.clientType;
        if (clientType === 'tv') {
            const createBtn = document.getElementById('createLobbyBtn');
            createBtn.addEventListener('click', () => {
                socket.emit('createLobby');
            });
            socket.on('lobbyCreated', (data) => {
                lobbyCodeGlobal = data.lobbyCode;
                console.log(`Lobby created: ${lobbyCodeGlobal}`);
                loadScene('lobby');
            });
        }
        else {
            const joinForm = document.getElementById('joinForm');
            joinForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const playerName = document.getElementById('playerName').value;
                const lobbyCode = document.getElementById('lobbyCode').value;
                socket.emit('joinLobby', { lobbyId: lobbyCode, playerName });
            });
            socket.on('joinedLobby', (data) => {
                lobbyCodeGlobal = data.lobbyId;
                console.log(`Player joined lobby: ${lobbyCodeGlobal}`);
                loadScene('lobby');
            });
            socket.on('joinFailed', (error) => {
                alert('Error: ' + error.message);
            });
        }
    }
    else if (sceneName === 'lobby') {
        // Lobby scene: show lobby code and player list
        const lobbyCodeElement = document.getElementById('lobbyCode');
        lobbyCodeElement.textContent = `Lobby: ${lobbyCodeGlobal || 'Unknown'}`;
        // Update player list
        const updatePlayerList = (players) => {
            const listElem = document.getElementById('playersList');
            if (listElem) {
                listElem.innerHTML = '';
                for (const player of players) { // players is already an array
                    const li = document.createElement('li');
                    li.textContent = player.playerName;
                    listElem.appendChild(li);
                }
            }
        };
        // Initial player list update
        socket.emit('getPlayers', { lobbyId: lobbyCodeGlobal }, updatePlayerList);
        // Listen for player updates
        socket.on('updatePlayerList', (data) => {
            updatePlayerList(data.players);
        });
        // For tv: start button to start the game
        if (clientType === 'tv') {
            const startBtn = document.getElementById('startGameBtn');
            startBtn.addEventListener('click', () => {
                socket.emit('startGame', lobbyCodeGlobal);
            });
        }
    }
    else if (sceneName === 'countdown') {
        // Countdown scene: 3 seconds countdown
        // (Implementation remains the same)
    }
    else if (sceneName === 'game') {
        // Game scene: gameplay
        const blockDiv = document.getElementById('block');
        const gameTimer = document.getElementById('gameTimer');
        if (clientType === 'mobile') {
            const clickButton = document.getElementById('clickButton');
            clickButton.addEventListener('click', () => {
                socket.emit('playerClick', { lobbyId: lobbyCodeGlobal, playerId: socket.id }); // Add playerId to the data
            });
        }
        // Listen to server events for showing/hiding blocks
        socket.on('blockAppear', (data) => {
            blockDiv.style.display = 'block';
            blockDiv.style.backgroundColor = data.type === 'orange' ? 'orange' : 'gray';
            console.log(`Block appears: ${data.type}`);
        });
        socket.on('blockDisappear', () => {
            blockDiv.style.display = 'none';
            console.log('Block disappears');
        });
        socket.on('blockClicked', (data) => {
            // Display the winner and points (adjust UI as needed)
            console.log(`Block clicked by: ${data.winner}, points: ${data.points}`);
        });
        // Start a timer of 60 seconds
        // (Implementation remains the same)
    }
    else if (sceneName === 'score') {
        // Score scene: show the scores
        const scoreList = document.getElementById('scoreList');
        scoreList.innerHTML = ''; // Clear previous scores
        if (sceneData.scores) {
            for (const playerId in sceneData.scores) {
                const playerScore = sceneData.scores[playerId];
                const li = document.createElement('li');
                li.textContent = `${playerScore.playerName} - ${playerScore.score}`;
                scoreList.appendChild(li);
            }
        }
        // After 20 seconds, return to the lobby (all clients)
        // (Implementation remains the same)
    }
}
// Global Socket.IO event listeners
// When the server indicates that the game has started, all clients load the countdown scene
socket.on('gameStarted', () => {
    console.log('Game started (from server)');
    loadScene('countdown');
});
socket.on('gameEnded', () => {
    console.log('Game ended (from server)');
    // Optionally do something on the client-side when the game ends
});
socket.on('switchToScene', (data) => {
    loadScene(data.scene, data.sceneData);
});
// Load the welcome scene on startup
loadScene('welcome');
