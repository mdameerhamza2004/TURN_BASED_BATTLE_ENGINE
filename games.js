const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/games:
 *   get:
 *     summary: Get all games
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, active, completed, cancelled]
 *         description: Filter games by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of games to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of games retrieved successfully
 */
router.get('/', authenticate, gameController.getAllGames);

/**
 * @swagger
 * /api/v1/games/{gameId}:
 *   get:
 *     summary: Get game by ID
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: Game ID
 *     responses:
 *       200:
 *         description: Game retrieved successfully
 *       404:
 *         description: Game not found
 */
router.get('/:gameId', authenticate, gameController.getGameById);

/**
 * @swagger
 * /api/v1/games:
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
 *                 type: integer
 *                 minimum: 2
 *                 maximum: 8
 *               gameSettings:
 *                 type: object
 *               isPrivate:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Game created successfully
 *       400:
 *         description: Invalid game configuration
 */
router.post('/', authenticate, gameController.createGame);

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
 *         description: Game ID
 *     responses:
 *       200:
 *         description: Successfully joined the game
 *       400:
 *         description: Cannot join game
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/join', authenticate, gameController.joinGame);

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
 *         description: Game ID
 *     responses:
 *       200:
 *         description: Successfully left the game
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/leave', authenticate, gameController.leaveGame);

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
 *         description: Game ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actionType
 *               - actionData
 *             properties:
 *               actionType:
 *                 type: string
 *                 enum: [move, skip, surrender, chat]
 *               actionData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Action performed successfully
 *       400:
 *         description: Invalid action
 *       403:
 *         description: Not your turn
 */
router.post('/:gameId/action', authenticate, gameController.performAction);

/**
 * @swagger
 * /api/v1/games/{gameId}/chat:
 *   post:
 *     summary: Send chat message in game
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: Game ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid message
 */
router.post('/:gameId/chat', authenticate, gameController.sendChatMessage);

/**
 * @swagger
 * /api/v1/games/{gameId}/history:
 *   get:
 *     summary: Get game history
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: Game ID
 *     responses:
 *       200:
 *         description: Game history retrieved successfully
 *       404:
 *         description: Game not found
 */
router.get('/:gameId/history', authenticate, gameController.getGameHistory);

module.exports = router; 