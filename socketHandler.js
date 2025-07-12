const logger = require('../utils/logger');
const GameEngine = require('./gameEngine');
const PlayerService = require('../services/playerService');
const RoomService = require('../services/roomService');
const { authenticateSocket } = require('../middleware/auth');

class SocketHandler {
    constructor() {
        this.gameEngine = new GameEngine();
        this.playerService = new PlayerService();
        this.roomService = new RoomService();
        this.connectedPlayers = new Map(); // socketId -> playerId
        this.playerSockets = new Map(); // playerId -> socketId
        this.gameRooms = new Map(); // gameId -> Set of socketIds
    }

    /**
     * Initialize socket handler
     * @param {Object} io - Socket.IO instance
     */
    initialize(io) {
        this.io = io;

        // Set up game engine event listeners
        this.setupGameEngineListeners();

        // Set up socket event handlers
        io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        logger.info('Socket handler initialized');
    }

    /**
     * Handle new socket connection
     * @param {Object} socket - Socket instance
     */
    async handleConnection(socket) {
        try {
            logger.logSocketEvent('connection', socket.id);

            // Authenticate socket
            const player = await authenticateSocket(socket);
            if (!player) {
                socket.emit('error', { message: 'Authentication failed' });
                socket.disconnect();
                return;
            }

            // Store player connection
            this.connectedPlayers.set(socket.id, player.id);
            this.playerSockets.set(player.id, socket.id);

            // Join player to their active games
            await this.joinPlayerToGames(socket, player);

            // Set up socket event handlers
            this.setupSocketEventHandlers(socket, player);

            // Send connection confirmation
            socket.emit('connected', {
                playerId: player.id,
                playerName: player.name,
                timestamp: new Date().toISOString()
            });

            logger.logSocketEvent('player_connected', socket.id, null, { playerId: player.id });

        } catch (error) {
            logger.error('Socket connection error:', error);
            socket.emit('error', { message: 'Connection failed' });
            socket.disconnect();
        }
    }

    /**
     * Set up socket event handlers
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     */
    setupSocketEventHandlers(socket, player) {
        // Join room
        socket.on('join_room', async (data) => {
            await this.handleJoinRoom(socket, player, data);
        });

        // Leave room
        socket.on('leave_room', async (data) => {
            await this.handleLeaveRoom(socket, player, data);
        });

        // Create room
        socket.on('create_room', async (data) => {
            await this.handleCreateRoom(socket, player, data);
        });

        // Game actions
        socket.on('game_action', async (data) => {
            await this.handleGameAction(socket, player, data);
        });

        // Player ready
        socket.on('player_ready', async (data) => {
            await this.handlePlayerReady(socket, player, data);
        });

        // Chat message
        socket.on('chat_message', async (data) => {
            await this.handleChatMessage(socket, player, data);
        });

        // Ping/pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // Disconnect
        socket.on('disconnect', () => {
            this.handleDisconnect(socket, player);
        });

        // Error handling
        socket.on('error', (error) => {
            logger.error('Socket error:', error);
        });
    }

    /**
     * Handle player joining a room
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {Object} data - Join room data
     */
    async handleJoinRoom(socket, player, data) {
        try {
            const { roomId } = data;

            if (!roomId) {
                socket.emit('error', { message: 'Room ID is required' });
                return;
            }

            const room = await this.roomService.getRoom(roomId);
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            // Join socket to room
            socket.join(roomId);

            // Add player to room
            await this.roomService.addPlayerToRoom(roomId, player.id);

            // Join game if room has active game
            if (room.gameId) {
                await this.joinPlayerToGame(socket, player, room.gameId);
            }

            // Notify other players
            socket.to(roomId).emit('player_joined_room', {
                playerId: player.id,
                playerName: player.name,
                timestamp: new Date().toISOString()
            });

            // Send room state to joining player
            const roomState = await this.roomService.getRoomState(roomId, player.id);
            socket.emit('room_state', roomState);

            logger.logSocketEvent('join_room', socket.id, roomId, { playerId: player.id });

        } catch (error) {
            logger.error('Join room error:', error);
            socket.emit('error', { message: error.message });
        }
    }

    /**
     * Handle player leaving a room
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {Object} data - Leave room data
     */
    async handleLeaveRoom(socket, player, data) {
        try {
            const { roomId } = data;

            if (!roomId) {
                socket.emit('error', { message: 'Room ID is required' });
                return;
            }

            // Leave socket from room
            socket.leave(roomId);

            // Remove player from room
            await this.roomService.removePlayerFromRoom(roomId, player.id);

            // Leave game if room has active game
            const room = await this.roomService.getRoom(roomId);
            if (room && room.gameId) {
                await this.leavePlayerFromGame(socket, player, room.gameId);
            }

            // Notify other players
            socket.to(roomId).emit('player_left_room', {
                playerId: player.id,
                playerName: player.name,
                timestamp: new Date().toISOString()
            });

            logger.logSocketEvent('leave_room', socket.id, roomId, { playerId: player.id });

        } catch (error) {
            logger.error('Leave room error:', error);
            socket.emit('error', { message: error.message });
        }
    }

    /**
     * Handle creating a new room
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {Object} data - Create room data
     */
    async handleCreateRoom(socket, player, data) {
        try {
            const { name, gameType, maxPlayers, isPrivate } = data;

            if (!name || !gameType) {
                socket.emit('error', { message: 'Room name and game type are required' });
                return;
            }

            const room = await this.roomService.createRoom({
                name,
                gameType,
                maxPlayers: maxPlayers || 4,
                isPrivate: isPrivate || false,
                createdBy: player.id
            });

            // Join the created room
            await this.handleJoinRoom(socket, player, { roomId: room.id });

            logger.logSocketEvent('create_room', socket.id, room.id, { playerId: player.id });

        } catch (error) {
            logger.error('Create room error:', error);
            socket.emit('error', { message: error.message });
        }
    }

    /**
     * Handle game action
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {Object} data - Game action data
     */
    async handleGameAction(socket, player, data) {
        try {
            const { gameId, action } = data;

            if (!gameId || !action) {
                socket.emit('error', { message: 'Game ID and action are required' });
                return;
            }

            // Process action through game engine
            const result = this.gameEngine.processAction(gameId, player.id, action);

            // Broadcast action result to all players in the game
            const gameRoom = `game_${gameId}`;
            this.io.to(gameRoom).emit('game_action_result', {
                playerId: player.id,
                action,
                result,
                timestamp: new Date().toISOString()
            });

            logger.logSocketEvent('game_action', socket.id, gameId, {
                playerId: player.id,
                action: action.type
            });

        } catch (error) {
            logger.error('Game action error:', error);
            socket.emit('error', { message: error.message });
        }
    }

    /**
     * Handle player ready status
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {Object} data - Player ready data
     */
    async handlePlayerReady(socket, player, data) {
        try {
            const { gameId, ready } = data;

            if (!gameId) {
                socket.emit('error', { message: 'Game ID is required' });
                return;
            }

            const game = this.gameEngine.getGame(gameId);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            // Update player ready status
            const gamePlayer = game.state.players.find(p => p.id === player.id);
            if (gamePlayer) {
                gamePlayer.ready = ready;
                game.state.updatedAt = new Date();
            }

            // Broadcast ready status to all players in the game
            const gameRoom = `game_${gameId}`;
            this.io.to(gameRoom).emit('player_ready_status', {
                playerId: player.id,
                ready,
                timestamp: new Date().toISOString()
            });

            // Check if game should start
            this.gameEngine.checkGameStart(gameId);

            logger.logSocketEvent('player_ready', socket.id, gameId, {
                playerId: player.id,
                ready
            });

        } catch (error) {
            logger.error('Player ready error:', error);
            socket.emit('error', { message: error.message });
        }
    }

    /**
     * Handle chat message
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {Object} data - Chat message data
     */
    async handleChatMessage(socket, player, data) {
        try {
            const { roomId, message, type = 'text' } = data;

            if (!roomId || !message) {
                socket.emit('error', { message: 'Room ID and message are required' });
                return;
            }

            const chatMessage = {
                playerId: player.id,
                playerName: player.name,
                message,
                type,
                timestamp: new Date().toISOString()
            };

            // Broadcast message to room
            this.io.to(roomId).emit('chat_message', chatMessage);

            // Store message in database
            await this.roomService.addChatMessage(roomId, chatMessage);

            logger.logSocketEvent('chat_message', socket.id, roomId, {
                playerId: player.id,
                messageType: type
            });

        } catch (error) {
            logger.error('Chat message error:', error);
            socket.emit('error', { message: error.message });
        }
    }

    /**
     * Handle socket disconnect
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     */
    handleDisconnect(socket, player) {
        try {
            logger.logSocketEvent('disconnect', socket.id, null, { playerId: player.id });

            // Remove from connected players
            this.connectedPlayers.delete(socket.id);
            this.playerSockets.delete(player.id);

            // Leave all rooms
            socket.rooms.forEach((roomId) => {
                if (roomId !== socket.id) {
                    this.handleLeaveRoom(socket, player, { roomId });
                }
            });

            // Update player status
            this.playerService.updatePlayerStatus(player.id, 'offline');

        } catch (error) {
            logger.error('Disconnect error:', error);
        }
    }

    /**
     * Join player to their active games
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     */
    async joinPlayerToGames(socket, player) {
        try {
            const activeGames = await this.playerService.getPlayerActiveGames(player.id);

            for (const gameId of activeGames) {
                await this.joinPlayerToGame(socket, player, gameId);
            }
        } catch (error) {
            logger.error('Join player to games error:', error);
        }
    }

    /**
     * Join player to a specific game
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {string} gameId - Game ID
     */
    async joinPlayerToGame(socket, player, gameId) {
        try {
            const gameRoom = `game_${gameId}`;
            socket.join(gameRoom);

            // Add to game rooms tracking
            if (!this.gameRooms.has(gameId)) {
                this.gameRooms.set(gameId, new Set());
            }
            this.gameRooms.get(gameId).add(socket.id);

            // Send current game state
            const gameState = this.gameEngine.getGameState(gameId, player.id);
            socket.emit('game_state', {
                gameId,
                state: gameState,
                timestamp: new Date().toISOString()
            });

            logger.logSocketEvent('join_game', socket.id, gameId, { playerId: player.id });

        } catch (error) {
            logger.error('Join player to game error:', error);
        }
    }

    /**
     * Leave player from a specific game
     * @param {Object} socket - Socket instance
     * @param {Object} player - Player object
     * @param {string} gameId - Game ID
     */
    async leavePlayerFromGame(socket, player, gameId) {
        try {
            const gameRoom = `game_${gameId}`;
            socket.leave(gameRoom);

            // Remove from game rooms tracking
            const gameSockets = this.gameRooms.get(gameId);
            if (gameSockets) {
                gameSockets.delete(socket.id);
                if (gameSockets.size === 0) {
                    this.gameRooms.delete(gameId);
                }
            }

            logger.logSocketEvent('leave_game', socket.id, gameId, { playerId: player.id });

        } catch (error) {
            logger.error('Leave player from game error:', error);
        }
    }

    /**
     * Set up game engine event listeners
     */
    setupGameEngineListeners() {
        // Game started
        this.gameEngine.on('gameStarted', (data) => {
            const { gameId } = data;
            const gameRoom = `game_${gameId}`;

            this.io.to(gameRoom).emit('game_started', {
                gameId,
                timestamp: new Date().toISOString()
            });
        });

        // Turn started
        this.gameEngine.on('turnStarted', (data) => {
            const { gameId, playerId } = data;
            const gameRoom = `game_${gameId}`;

            this.io.to(gameRoom).emit('turn_started', {
                gameId,
                playerId,
                timestamp: new Date().toISOString()
            });
        });

        // Game ended
        this.gameEngine.on('gameEnded', (data) => {
            const { gameId, reason, winner, gameState } = data;
            const gameRoom = `game_${gameId}`;

            this.io.to(gameRoom).emit('game_ended', {
                gameId,
                reason,
                winner,
                gameState,
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Get game engine instance
     * @returns {GameEngine} Game engine instance
     */
    getGameEngine() {
        return this.gameEngine;
    }

    /**
     * Get connected players count
     * @returns {number} Connected players count
     */
    getConnectedPlayersCount() {
        return this.connectedPlayers.size;
    }

    /**
     * Get active games count
     * @returns {number} Active games count
     */
    getActiveGamesCount() {
        return this.gameEngine.getActiveGames().length;
    }
}

// Export singleton instance
module.exports = new SocketHandler(); 