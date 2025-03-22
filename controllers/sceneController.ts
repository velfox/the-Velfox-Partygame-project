import { Server as SocketIOServer } from 'socket.io';

interface SceneData {
    [key: string]: any;
}
export const switchToScene = (io: SocketIOServer, lobbyId: string, sceneName: string, sceneData: SceneData = {}) => {
    // You can add logic here to handle different scenes or client types
    // if needed (e.g., send different data to TV vs. mobile)
    io.to(lobbyId).emit('switchToScene', { scene: sceneName, sceneData });
};