import { Server as SocketIOServer } from 'socket.io';
import { handlePlayerClick } from './inputController';
import * as orangeDecoyGame from '../games/orangeDecoyGame';
import * as scoreController from './scoreController';
import * as inputController from './inputController';
import * as soundController from './soundController';
import * as sceneController from './sceneController'; // Import sceneController

export const startGame = (io: SocketIOServer, lobbyId: string) => {
    // 1. Initialize input
    inputController.init(io, lobbyId, (playerId: string) => {
        // Callback on click
        const blockType = orangeDecoyGame.getCurrentBlockType(lobbyId);
        if (blockType) { // Only if there is an active block
            const points = blockType === 'orange' ? 1 : -1;
            scoreController.updateScore(playerId, lobbyId, points);
            io.to(lobbyId).emit('blockClicked', {
                winner: scoreController.getPlayerName(playerId, lobbyId), // Name of the clicking player
                points
            });
            soundController.play('click'); // Play click sound
        }
    });
    // 2. Play sound
    soundController.play('countdown');
    // 3. Initialize game
    orangeDecoyGame.init(io, lobbyId, () => {
        // Callback when the game ends
        endGame(io, lobbyId);
    });
    // 4. Update scene (to game scene)
    sceneController.switchToScene(io, lobbyId, 'game');
    // 5. Start the gameplay (countdown etc.)
    io.to(lobbyId).emit('gameStarted');
};

export const endGame = (io: SocketIOServer, lobbyId: string) => {
    const scores = scoreController.getScores(lobbyId);
    sceneController.switchToScene(io, lobbyId, 'score', { scores }); // Pass scores to sceneController
    io.to(lobbyId).emit('gameEnded');
    //... (Further handling: back to lobby, etc.)
};

// Removed handlePlayerClick as it is no longer needed and conflicts with the imported declaration.