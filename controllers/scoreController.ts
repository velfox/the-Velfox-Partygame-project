import { Server as SocketIOServer } from 'socket.io';

interface PlayerScores {
    [playerId: string]: number;
}
interface LobbyScores {
    players: PlayerScores;
}
const lobbies: { [lobbyId: string]: LobbyScores } = {}; // Object to store lobby data, including scores

export const updateScore = (playerId: string, lobbyId: string, points: number) => {
    if (!lobbies[lobbyId]) {
        lobbies[lobbyId] = {
            players: {}, // Initialize an empty object to store player scores
        };
    }
    if (!lobbies[lobbyId].players[playerId]) {
        lobbies[lobbyId].players[playerId] = 0;
    }
    lobbies[lobbyId].players[playerId] += points;
    // Emit an event to update scores on the clients
    // You might want to include the player name in the event data as well
    //... (e.g., io.to(lobbyId).emit('scoreUpdate', { playerId, score: lobbies[lobbyId][playerId] }); )
};

export const getScores = (lobbyId: string) => {
    if (!lobbies[lobbyId]) {
        return {}; // Return an empty object if the lobby doesn't exist
    }
    return lobbies[lobbyId].players;
};

export const getPlayerName = (playerId: string, lobbyId: string) => {
    // This function retrieves the player's name from the lobby data
    if (
        lobbies[lobbyId] &&
        lobbies[lobbyId].players[playerId] !== undefined
    ) {
        // Assuming you store player names in the lobby data when they join
        //... (e.g., return lobbies[lobbyId].players[playerId].name; )
    }
    return "Unknown Player"; // Or handle the case where the player is not found
};
//... other score-related functions (if needed)