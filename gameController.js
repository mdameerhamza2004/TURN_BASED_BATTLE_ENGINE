const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const GameEngine = require('../core/gameEngine');
const GameState = require('../models/GameState');

const router = express.Router();
const gameEngine = new GameEngine();

/**
 * @swagger
 * /api/v1/games:
 *   get:
 *     summary: Get all active games
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gameType
 *         schema:
 *           type: string
 *         description: Filter by game type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by game status
 *     responses:
 *       200:
 *         description: List of active games
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
    const { gameType, status } = req.query;
    const activeGames = gameEngine.getActiveGames();

    let filteredGames = activeGames;

    if (gameType) {
        filteredGames = filteredGames.filter(game => game.config.gameType === gameType);
    }

    if (status) {
        filteredGames = filteredGames.filter(game => game.state.status === status);
    }

    res.json({
        status: 'success',
        data: {
            games: filteredGames,
            total: filteredGames.length
        }
    });
}));

/**
 * @swagger
 * /api/v1/games/create:
 *   post:
 *     summary: Create a new game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gameType
 *               - maxPlayers
 *             properties:
 *               gameType:
 *                 type: string
 *                 enum: [chess, checkers, tic-tac-toe, custom]
 *               maxPlayers:
 *                 type: number
 *                 minimum: 2
 *                 maximum: 8
 *               minPlayers:
 *                 type: number
 *                 minimum: 2
 *                 maximum: 8
 *               turnTimeLimit:
 *                 type: number
 *                 minimum: 5000
 *                 maximum: 300000
 *               rules:
 *                 type: object
 *     responses:
 *       201:
 *         description: Game created successfully
 */
router.post('/create', authenticate, [
    body('gameType')
        .isIn(['chess', 'checkers', 'tic-tac-toe', 'custom'])
        .withMessage('Invalid game type'),
    body('maxPlayers')
        .isInt({ min: 2, max: 8 })
        .withMessage('Max players must be between 2 and 8'),
    body('minPlayers')
        .optional()
        .isInt({ min: 2, max: 8 })
        .withMessage('Min players must be between 2 and 8'),
    body('turnTimeLimit')
        .optional()
        .isInt({ min: 5000, max: 300000 })
        .withMessage('Turn time limit must be between 5 and 300 seconds')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const gameConfig = {
        gameType: req.body.gameType,
        maxPlayers: req.body.maxPlayers,
        minPlayers: req.body.minPlayers || 2,
        turnTimeLimit: req.body.turnTimeLimit || 30000,
        rules: req.body.rules || {},
        createdBy: req.player._id
    };

    const game = gameEngine.createGame(gameConfig);

    // Add creator as first player
    gameEngine.addPlayer(game.id, {
        id: req.player._id,
        name: req.player.displayName
    });

    logger.logGameEvent('game_created', game.id, req.player._id, gameConfig);

    res.status(201).json({
        status: 'success',
        data: {
            game
        }
    });
}));

/**
 * @swagger
 * /api/v1/games/{gameId}:
 *   get:
 *     summary: Get game state
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Game state retrieved successfully
 *       404:
 *         description: Game not found
 */
router.get('/:gameId', authenticate, catchAsync(async (req, res) => {
    const { gameId } = req.params;

    const gameState = gameEngine.getGameState(gameId, req.player._id);

    res.json({
        status: 'success',
        data: {
            game: gameState
        }
    });
}));

/**
 * @swagger
 * /api/v1/games/{gameId}/join:
 *   post:
 *     summary: Join a game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully joined game
 *       400:
 *         description: Cannot join game
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/join', authenticate, catchAsync(async (req, res) => {
    const { gameId } = req.params;

    const player = {
        id: req.player._id,
        name: req.player.displayName
    };

    gameEngine.addPlayer(gameId, player);

    logger.logGameEvent('player_joined', gameId, req.player._id);

    res.json({
        status: 'success',
        message: 'Successfully joined game'
    });
}));

/**
 * @swagger
 * /api/v1/games/{gameId}/leave:
 *   post:
 *     summary: Leave a game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully left game
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/leave', authenticate, catchAsync(async (req, res) => {
    const { gameId } = req.params;

    gameEngine.removePlayer(gameId, req.player._id);

    logger.logGameEvent('player_left', gameId, req.player._id);

    res.json({
        status: 'success',
        message: 'Successfully left game'
    });
}));

/**
 * @swagger
 * /api/v1/games/{gameId}/start:
 *   post:
 *     summary: Start a game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Game started successfully
 *       400:
 *         description: Cannot start game
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/start', authenticate, catchAsync(async (req, res) => {
    const { gameId } = req.params;

    gameEngine.startGame(gameId);

    logger.logGameEvent('game_started', gameId, req.player._id);

    res.json({
        status: 'success',
        message: 'Game started successfully'
    });
}));

/**
 * @swagger
 * /api/v1/games/{gameId}/action:
 *   post:
 *     summary: Perform a game action
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: object
 *     responses:
 *       200:
 *         description: Action performed successfully
 *       400:
 *         description: Invalid action
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/action', authenticate, [
    body('action')
        .isObject()
        .withMessage('Action must be an object')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { gameId } = req.params;
    const { action } = req.body;

    const result = gameEngine.processAction(gameId, req.player._id, action);

    logger.logGameEvent('action_performed', gameId, req.player._id, { action });

    res.json({
        status: 'success',
        data: {
            result
        }
    });
}));

/**
 * @swagger
 * /api/v1/games/{gameId}/ready:
 *   post:
 *     summary: Set player ready status
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ready
 *             properties:
 *               ready:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ready status updated
 */
router.post('/:gameId/ready', authenticate, [
    body('ready')
        .isBoolean()
        .withMessage('Ready must be a boolean')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { gameId } = req.params;
    const { ready } = req.body;

    const game = gameEngine.getGame(gameId);
    if (!game) {
        throw new AppError('Game not found', 404);
    }

    const gamePlayer = game.state.players.find(p => p.id === req.player._id);
    if (gamePlayer) {
        gamePlayer.ready = ready;
        game.state.updatedAt = new Date();
    }

    logger.logGameEvent('player_ready', gameId, req.player._id, { ready });

    res.json({
        status: 'success',
        message: `Player ${ready ? 'ready' : 'not ready'}`
    });
}));

/**
 * @swagger
 * /api/v1/games/history:
 *   get:
 *     summary: Get game history
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Game history retrieved successfully
 */
router.get('/history', authenticate, catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const games = await GameState.find({
        'state.players.id': req.player._id,
        'state.status': 'ended'
    })
        .sort({ 'state.endedAt': -1 })
        .skip(skip)
        .limit(limit)
        .populate('state.players.id', 'username displayName avatar');

    const total = await GameState.countDocuments({
        'state.players.id': req.player._id,
        'state.status': 'ended'
    });

    res.json({
        status: 'success',
        data: {
            games,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
}));

/**
 * @swagger
 * /api/v1/games/stats:
 *   get:
 *     summary: Get game statistics
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Game statistics retrieved successfully
 */
router.get('/stats', authenticate, catchAsync(async (req, res) => {
    const activeGames = gameEngine.getActiveGames();
    const activeGamesCount = activeGames.length;

    const playerActiveGames = activeGames.filter(game =>
        game.state.players.some(p => p.id === req.player._id)
    ).length;

    const totalGames = await GameState.countDocuments({
        'state.players.id': req.player._id
    });

    const wonGames = await GameState.countDocuments({
        'state.players.id': req.player._id,
        'state.winner': req.player._id
    });

    const winRate = totalGames > 0 ? Math.round((wonGames / totalGames) * 100) : 0;

    res.json({
        status: 'success',
        data: {
            activeGames: activeGamesCount,
            playerActiveGames,
            totalGames,
            wonGames,
            winRate
        }
    });
}));

module.exports = router; 