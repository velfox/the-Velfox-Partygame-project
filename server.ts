import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
// Import controllers
import * as lobbyController from './controllers/lobbyController';
import * as gameController from './controllers/gameController';
import * as playerController from './controllers/player';
import * as scoreController from './controllers/scoreController';
import * as inputController from './controllers/inputController';
import * as soundController from './controllers/soundController';
import * as sceneController from './controllers/sceneController';

const app = express();
const server = http.createServer(app);
// Initialize Socket.IO with CORS settings
const io = new SocketIOServer(server, {
    cors: {
        origin: "*", // Allow requests from any origin (adjust for production)
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve the main HTML file for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('A user connected');
    // Lobby events
    socket.on('createLobby', () => lobbyController.createLobby(socket, io));
    socket.on('joinLobby', (data: { lobbyId: string, playerName: string }) => lobbyController.joinLobby(socket, io, data));
    socket.on('leaveLobby', (data: { lobbyId: string }) => lobbyController.leaveLobby(socket, io, data));
    socket.on('getPlayers', (data: { lobbyId: string }, callback: (players: lobbyController.Player[]) => void) => {
        const lobby = lobbyController.getLobby(data.lobbyId);
        if (lobby) {
            callback(lobby.players);
        }
    });
    // Game events
    socket.on('startGame', (lobbyId: string) => gameController.startGame(io, lobbyId));
    // Disconnect event
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        // Find the lobby the player was in
        const lobbyId = Object.values(lobbyController.lobbies).find(lobby => lobby.players.some(player => player.playerId === socket.id))?.lobbyId;
        if (lobbyId) {
            // Remove the player from the lobby
            lobbyController.leaveLobby(socket, io, { lobbyId });
        }
    });
});
// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});