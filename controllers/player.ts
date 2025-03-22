import { Server as SocketIOServer, Socket } from 'socket.io';

export interface Player {
    playerName: string;
    lobbyId: string;
    //... other player data (e.g., score) if needed
}
const players: { [playerId: string]: Player } = {}; // Object to store player data in memory (key: socket.id)

export const addPlayer = (socket: Socket, io: SocketIOServer, data: { lobbyId: string, playerName: string }) => {
    const { lobbyId, playerName } = data;
    const playerId = socket.id;
    // Basic validation: Check if the name is not empty
    if (playerName.trim() === '') {
        socket.emit('joinFailed', { message: 'Name cannot be empty' });
        return;
    }
    // Store player information
    players[playerId] = {
        playerName,
        lobbyId,
        //... other player data (e.g., score) if needed
    };
    // You might want to update the player list in the lobby here
    //... (e.g., emit an event to update the player list on the TV screen)
    socket.emit('playerAdded', { playerId, playerName });
};

export const removePlayer = (socket: Socket, io: SocketIOServer) => {
    const playerId = socket.id;
    const lobbyId = players[playerId].lobbyId; // Get lobbyId before deleting
    // Remove player from the data structure
    delete players[playerId];
    // You might want to update the player list in the lobby here
    //... (e.g., emit an event to update the player list on the TV screen)
    socket.to(lobbyId).emit('playerRemoved', { playerId });
};
//... other player-related functions (if needed)