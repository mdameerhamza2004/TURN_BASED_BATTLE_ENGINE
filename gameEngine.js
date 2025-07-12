const EventEmitter = require('events');
const logger = require('../utils/logger');
const config = require('../config');
const GameState = require('../models/GameState');
const Player = require('../models/Player');

class GameEngine extends EventEmitter {
    constructor() {
        super();
        this.activeGames = new Map();
        this.gameTimers = new Map();
        this.turnTimers = new Map();
    }

    /**
     * Create a new game
     * @param {Object} gameConfig - Game configuration
     * @returns {Object} Game instance
     */
    createGame(gameConfig) {
        const gameId = this.generateGameId();
        const game = {
            id: gameId,
            config: gameConfig,
            state: {
                status: 'waiting',
                players: [],
                currentTurn: null,
                turnOrder: [],
                gameData: {},
                createdAt: new Date(),
                updatedAt: new Date()
            },
            rules: gameConfig.rules || {},
            maxPlayers: gameConfig.maxPlayers || config.game.maxPlayersPerGame,
            turnTimeLimit: gameConfig.turnTimeLimit || config.game.turnTimeLimit
        };

        this.activeGames.set(gameId, game);
        logger.logGameEvent('game_created', gameId, null, gameConfig);

        // Set game timeout
        this.setGameTimeout(gameId);

        return game;
    }

    /**
     * Add a player to a game
     * @param {string} gameId - Game ID
     * @param {Object} player - Player object
     * @returns {boolean} Success status
     */
    addPlayer(gameId, player) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        if (game.state.players.length >= game.maxPlayers) {
            throw new Error('Game is full');
        }

        if (game.state.players.find(p => p.id === player.id)) {
            throw new Error('Player already in game');
        }

        const gamePlayer = {
            id: player.id,
            name: player.name,
            ready: false,
            connected: true,
            joinedAt: new Date(),
            lastActivity: new Date()
        };

        game.state.players.push(gamePlayer);
        game.state.updatedAt = new Date();

        logger.logGameEvent('player_joined', gameId, player.id);

        // Check if game should start
        if (game.state.players.length >= game.config.minPlayers) {
            this.checkGameStart(gameId);
        }

        return true;
    }

    /**
     * Remove a player from a game
     * @param {string} gameId - Game ID
     * @param {string} playerId - Player ID
     * @returns {boolean} Success status
     */
    removePlayer(gameId, playerId) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        const playerIndex = game.state.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            throw new Error('Player not found in game');
        }

        game.state.players.splice(playerIndex, 1);
        game.state.updatedAt = new Date();

        logger.logGameEvent('player_left', gameId, playerId);

        // If game is active and player was current turn, move to next turn
        if (game.state.status === 'active' && game.state.currentTurn === playerId) {
            this.nextTurn(gameId);
        }

        // If not enough players, end game
        if (game.state.players.length < game.config.minPlayers && game.state.status === 'active') {
            this.endGame(gameId, 'insufficient_players');
        }

        return true;
    }

    /**
     * Start a game
     * @param {string} gameId - Game ID
     * @returns {boolean} Success status
     */
    startGame(gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        if (game.state.status !== 'waiting') {
            throw new Error('Game is not in waiting status');
        }

        if (game.state.players.length < game.config.minPlayers) {
            throw new Error('Not enough players to start game');
        }

        // Initialize game state
        game.state.status = 'active';
        game.state.turnOrder = this.generateTurnOrder(game.state.players);
        game.state.currentTurn = game.state.turnOrder[0];
        game.state.gameData = this.initializeGameData(game);
        game.state.startedAt = new Date();
        game.state.updatedAt = new Date();

        // Start first turn
        this.startTurn(gameId);

        logger.logGameEvent('game_started', gameId);

        return true;
    }

    /**
     * Process a player action
     * @param {string} gameId - Game ID
     * @param {string} playerId - Player ID
     * @param {Object} action - Action data
     * @returns {Object} Action result
     */
    processAction(gameId, playerId, action) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        if (game.state.status !== 'active') {
            throw new Error('Game is not active');
        }

        if (game.state.currentTurn !== playerId) {
            throw new Error('Not your turn');
        }

        // Validate action
        const validationResult = this.validateAction(game, playerId, action);
        if (!validationResult.valid) {
            throw new Error(validationResult.error);
        }

        // Process action
        const result = this.executeAction(game, playerId, action);

        // Update game state
        game.state.gameData = result.gameData;
        game.state.updatedAt = new Date();

        logger.logGameEvent('action_processed', gameId, playerId, { action, result });

        // Check for game end conditions
        if (result.gameEnded) {
            this.endGame(gameId, result.endReason, result.winner);
        } else {
            // Move to next turn
            this.nextTurn(gameId);
        }

        return result;
    }

    /**
     * Get current game state
     * @param {string} gameId - Game ID
     * @param {string} playerId - Player ID (for filtering private data)
     * @returns {Object} Game state
     */
    getGameState(gameId, playerId = null) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        const state = { ...game.state };

        // Filter private data based on player
        if (playerId) {
            state.gameData = this.filterPrivateData(state.gameData, playerId);
        }

        return state;
    }

    /**
     * End a game
     * @param {string} gameId - Game ID
     * @param {string} reason - End reason
     * @param {string} winner - Winner ID (optional)
     */
    endGame(gameId, reason, winner = null) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        game.state.status = 'ended';
        game.state.endedAt = new Date();
        game.state.endReason = reason;
        game.state.winner = winner;
        game.state.updatedAt = new Date();

        // Clear timers
        this.clearGameTimers(gameId);

        // Save game state to database
        this.saveGameState(game);

        logger.logGameEvent('game_ended', gameId, null, { reason, winner });

        // Emit game end event
        this.emit('gameEnded', { gameId, reason, winner, gameState: game.state });

        // Remove from active games after a delay
        setTimeout(() => {
            this.activeGames.delete(gameId);
        }, 60000); // Keep for 1 minute after ending
    }

    /**
     * Generate turn order
     * @param {Array} players - Players array
     * @returns {Array} Turn order
     */
    generateTurnOrder(players) {
        const playerIds = players.map(p => p.id);
        // Fisher-Yates shuffle
        for (let i = playerIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
        }
        return playerIds;
    }

    /**
     * Start a turn
     * @param {string} gameId - Game ID
     */
    startTurn(gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return;

        const currentPlayer = game.state.players.find(p => p.id === game.state.currentTurn);
        if (!currentPlayer) return;

        // Set turn timer
        this.setTurnTimer(gameId);

        logger.logGameEvent('turn_started', gameId, game.state.currentTurn);

        // Emit turn start event
        this.emit('turnStarted', { gameId, playerId: game.state.currentTurn });
    }

    /**
     * Move to next turn
     * @param {string} gameId - Game ID
     */
    nextTurn(gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return;

        // Clear current turn timer
        this.clearTurnTimer(gameId);

        // Find next player in turn order
        const currentIndex = game.state.turnOrder.indexOf(game.state.currentTurn);
        const nextIndex = (currentIndex + 1) % game.state.turnOrder.length;
        game.state.currentTurn = game.state.turnOrder[nextIndex];

        // Start next turn
        this.startTurn(gameId);
    }

    /**
     * Set turn timer
     * @param {string} gameId - Game ID
     */
    setTurnTimer(gameId) {
        this.clearTurnTimer(gameId);

        const timer = setTimeout(() => {
            this.handleTurnTimeout(gameId);
        }, game.turnTimeLimit);

        this.turnTimers.set(gameId, timer);
    }

    /**
     * Clear turn timer
     * @param {string} gameId - Game ID
     */
    clearTurnTimer(gameId) {
        const timer = this.turnTimers.get(gameId);
        if (timer) {
            clearTimeout(timer);
            this.turnTimers.delete(gameId);
        }
    }

    /**
     * Handle turn timeout
     * @param {string} gameId - Game ID
     */
    handleTurnTimeout(gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return;

        logger.logGameEvent('turn_timeout', gameId, game.state.currentTurn);

        // Process default action or skip turn
        const defaultAction = this.getDefaultAction(game, game.state.currentTurn);
        if (defaultAction) {
            this.processAction(gameId, game.state.currentTurn, defaultAction);
        } else {
            this.nextTurn(gameId);
        }
    }

    /**
     * Set game timeout
     * @param {string} gameId - Game ID
     */
    setGameTimeout(gameId) {
        const timer = setTimeout(() => {
            this.handleGameTimeout(gameId);
        }, config.game.gameTimeout);

        this.gameTimers.set(gameId, timer);
    }

    /**
     * Clear game timers
     * @param {string} gameId - Game ID
     */
    clearGameTimers(gameId) {
        const gameTimer = this.gameTimers.get(gameId);
        if (gameTimer) {
            clearTimeout(gameTimer);
            this.gameTimers.delete(gameId);
        }

        this.clearTurnTimer(gameId);
    }

    /**
     * Handle game timeout
     * @param {string} gameId - Game ID
     */
    handleGameTimeout(gameId) {
        logger.logGameEvent('game_timeout', gameId);
        this.endGame(gameId, 'timeout');
    }

    /**
     * Check if game should start
     * @param {string} gameId - Game ID
     */
    checkGameStart(gameId) {
        const game = this.activeGames.get(gameId);
        if (!game) return;

        const readyPlayers = game.state.players.filter(p => p.ready);
        if (readyPlayers.length >= game.config.minPlayers &&
            readyPlayers.length === game.state.players.length) {
            this.startGame(gameId);
        }
    }

    /**
     * Generate unique game ID
     * @returns {string} Game ID
     */
    generateGameId() {
        return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Initialize game data (to be overridden by specific game types)
     * @param {Object} game - Game object
     * @returns {Object} Initial game data
     */
    initializeGameData(game) {
        return {};
    }

    /**
     * Validate action (to be overridden by specific game types)
     * @param {Object} game - Game object
     * @param {string} playerId - Player ID
     * @param {Object} action - Action data
     * @returns {Object} Validation result
     */
    validateAction(game, playerId, action) {
        return { valid: true };
    }

    /**
     * Execute action (to be overridden by specific game types)
     * @param {Object} game - Game object
     * @param {string} playerId - Player ID
     * @param {Object} action - Action data
     * @returns {Object} Action result
     */
    executeAction(game, playerId, action) {
        return {
            gameData: game.state.gameData,
            gameEnded: false
        };
    }

    /**
     * Get default action for timeout (to be overridden by specific game types)
     * @param {Object} game - Game object
     * @param {string} playerId - Player ID
     * @returns {Object} Default action
     */
    getDefaultAction(game, playerId) {
        return null;
    }

    /**
     * Filter private data (to be overridden by specific game types)
     * @param {Object} gameData - Game data
     * @param {string} playerId - Player ID
     * @returns {Object} Filtered game data
     */
    filterPrivateData(gameData, playerId) {
        return gameData;
    }

    /**
     * Save game state to database
     * @param {Object} game - Game object
     */
    async saveGameState(game) {
        try {
            const gameState = new GameState({
                gameId: game.id,
                state: game.state,
                config: game.config,
                createdAt: game.state.createdAt,
                updatedAt: game.state.updatedAt
            });

            await gameState.save();
            logger.logDatabaseOperation('save', 'GameState', game.id);
        } catch (error) {
            logger.error('Failed to save game state:', error);
        }
    }

    /**
     * Get all active games
     * @returns {Array} Active games
     */
    getActiveGames() {
        return Array.from(this.activeGames.values());
    }

    /**
     * Get game by ID
     * @param {string} gameId - Game ID
     * @returns {Object} Game object
     */
    getGame(gameId) {
        return this.activeGames.get(gameId);
    }
}

module.exports = GameEngine; 