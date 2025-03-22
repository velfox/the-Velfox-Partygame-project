import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { handlePlayerClick } from './inputController'; // Import the function

export interface Player {
    playerId: string;
    playerName: string;
}

export interface Lobby {
    lobbyId: string;
    hostId: string;
    players: Player[];
    gameStarted: boolean;
}

export const lobbies: { [lobbyId: string]: Lobby } = {}; // Object to store lobby data

export const createLobby = (socket: Socket, io: SocketIOServer) => {
    const lobbyId = uuidv4();
    const hostId = socket.id;
    const newLobby: Lobby = {
        lobbyId,
        hostId,
        players: [{ playerId: hostId, playerName: 'Host' }], // Initial player is the host
        gameStarted: false, // Add gameStarted flag
    };
    lobbies[lobbyId] = newLobby; // Store lobby in the lobbies object
    socket.join(lobbyId);
    socket.emit('lobbyCreated', { lobbyCode: newLobby.lobbyId });
    io.to(lobbyId).emit('updatePlayerList', { players: newLobby.players });
    console.log(`Lobby ${lobbyId} created by ${hostId}`);
};

export const joinLobby = (
    socket: Socket,
    io: SocketIOServer,
    data: { lobbyId: string; playerName: string }
) => {
    const { lobbyId, playerName } = data;
    const lobby = lobbies[lobbyId];
    if (lobby && !lobby.gameStarted) {
        // Check if lobby exists and game has not started
        const playerId = socket.id;
        lobby.players.push({ playerId, playerName });
        socket.join(lobbyId);
        socket.emit('joinedLobby', { lobbyId });
        io.to(lobbyId).emit('updatePlayerList', { players: lobby.players });
        console.log(`Player <span class="math-inline">\{playerName\} \(</span>{playerId}) joined lobby ${lobbyId}`);

        // Initialize input handling for this player
        handlePlayerClick(socket, (clickedPlayerId) => {
            // Handle the player click here (e.g., update game state)
            console.log(`Player ${clickedPlayerId} clicked in lobby ${lobbyId}`);
            // Emit to all clients in the lobby that a player clicked
            io.to(lobbyId).emit('playerClicked', { playerId: clickedPlayerId });
        });
    } else {
        socket.emit('joinFailed', { message: 'Lobby not found or game already started' });
        console.log(`Join failed for <span class="math-inline">\{playerName\} \(</span>{socket.id}) - lobby ${lobbyId}`);
    }
};

export const leaveLobby = (
    socket: Socket,
    io: SocketIOServer,
    data: { lobbyId: string }
) => {
    const { lobbyId } = data;
    const lobby = lobbies[lobbyId];
    const playerId = socket.id;
    if (lobby) {
        lobby.players = lobby.players.filter((p) => p.playerId !== playerId);
        socket.leave(lobbyId);
        io.to(lobbyId).emit('updatePlayerList', { players: lobby.players });
        if (lobby.players.length === 0) {
            delete lobbies[lobbyId]; // Remove the lobby if it's empty
            console.log(`Lobby ${lobbyId} removed (no players left)`);
        } else {
            if (lobby.hostId === playerId) {
                // Assign a new host if the current host leaves
                lobby.hostId = lobby.players[0].playerId; // Or another logic to choose a new host
                io.to(lobby.hostId).emit('becomeHost', { lobbyId });
                console.log(`Player ${lobby.hostId} is now the host of lobby ${lobbyId}`);
            }
        }
    } else {
        socket.emit('leaveFailed', { message: 'Lobby not found' });
    }
};

export const getLobby = (lobbyId: string) => {
    return lobbies[lobbyId];
};