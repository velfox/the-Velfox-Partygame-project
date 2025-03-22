// orangeDecoyGame.ts
import { Server as SocketIOServer, Socket } from 'socket.io';

let currentBlockType: 'orange' | 'decoy' | null = null;
let blockInterval: NodeJS.Timeout;

export const init = (io: SocketIOServer, lobbyId: string, onGameEndCallback: () => void) => {
    // Function to generate a block with a random type (orange or decoy)
    const generateBlock = () => {
        currentBlockType = Math.random() < 0.5 ? 'orange' : 'decoy';
        io.to(lobbyId).emit('blockAppear', { type: currentBlockType });
        // Hide the block after a short delay (adjust as needed)
        setTimeout(() => {
            io.to(lobbyId).emit('blockDisappear');
            currentBlockType = null; // Reset block type
        }, 2000); // 2 seconds
    };
    // Start generating blocks repeatedly
    blockInterval = setInterval(generateBlock, 3000); // Every 3 seconds
    // Set a timer to end the game after 60 seconds
    setTimeout(() => {
        clearInterval(blockInterval); // Stop generating blocks
        onGameEndCallback();
    }, 60000);
};

export const getCurrentBlockType = (lobbyId: string) => {
    // This function is called by the gameController to check the current block type
    return currentBlockType;
};