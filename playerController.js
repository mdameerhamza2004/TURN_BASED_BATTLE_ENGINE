const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const PlayerService = require('../services/playerService');

const router = express.Router();
const playerService = new PlayerService();

/**
 * @swagger
 * /api/v1/players/profile:
 *   get:
 *     summary: Get player profile
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player profile retrieved successfully
 */
router.get('/profile', authenticate, catchAsync(async (req, res) => {
    const player = await playerService.getPlayerById(req.player._id);

    res.json({
        status: 'success',
        data: player
    });
}));

/**
 * @swagger
 * /api/v1/players/profile:
 *   put:
 *     summary: Update player profile
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               avatar:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', authenticate, [
    body('displayName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Display name must be 2-50 characters long'),
    body('avatar')
        .optional()
        .isURL()
        .withMessage('Avatar must be a valid URL'),
    body('preferences')
        .optional()
        .isObject()
        .withMessage('Preferences must be an object')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const updateData = {
        displayName: req.body.displayName,
        avatar: req.body.avatar,
        preferences: req.body.preferences
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
            delete updateData[key];
        }
    });

    const player = await playerService.updatePlayerProfile(req.player._id, updateData);

    res.json({
        status: 'success',
        data: player
    });
}));

/**
 * @swagger
 * /api/v1/players/online:
 *   get:
 *     summary: Get online players
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Online players retrieved successfully
 */
router.get('/online', authenticate, catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const players = await playerService.getOnlinePlayers(limit);

    res.json({
        status: 'success',
        data: {
            players,
            total: players.length
        }
    });
}));

/**
 * @swagger
 * /api/v1/players/top:
 *   get:
 *     summary: Get top players
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top players retrieved successfully
 */
router.get('/top', authenticate, catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const players = await playerService.getTopPlayers(limit);

    res.json({
        status: 'success',
        data: {
            players,
            total: players.length
        }
    });
}));

/**
 * @swagger
 * /api/v1/players/search:
 *   get:
 *     summary: Search players
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 */
router.get('/search', authenticate, catchAsync(async (req, res) => {
    const { q: query } = req.query;
    const limit = parseInt(req.query.limit) || 20;

    if (!query) {
        throw new AppError('Search query is required', 400);
    }

    const players = await playerService.searchPlayers(query, limit);

    res.json({
        status: 'success',
        data: {
            players,
            total: players.length,
            query
        }
    });
}));

/**
 * @swagger
 * /api/v1/players/{playerId}:
 *   get:
 *     summary: Get player by ID
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player retrieved successfully
 *       404:
 *         description: Player not found
 */
router.get('/:playerId', authenticate, catchAsync(async (req, res) => {
    const { playerId } = req.params;
    const player = await playerService.getPlayerById(playerId);

    res.json({
        status: 'success',
        data: player.toPublicJSON()
    });
}));

/**
 * @swagger
 * /api/v1/players/friends:
 *   get:
 *     summary: Get player friends
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Friends list retrieved successfully
 */
router.get('/friends', authenticate, catchAsync(async (req, res) => {
    const friends = await playerService.getPlayerFriends(req.player._id);

    res.json({
        status: 'success',
        data: {
            friends,
            total: friends.length
        }
    });
}));

/**
 * @swagger
 * /api/v1/players/friends/{playerId}:
 *   post:
 *     summary: Add friend
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Friend added successfully
 *       404:
 *         description: Player not found
 */
router.post('/friends/:playerId', authenticate, catchAsync(async (req, res) => {
    const { playerId } = req.params;

    if (playerId === req.player._id.toString()) {
        throw new AppError('Cannot add yourself as a friend', 400);
    }

    await playerService.addFriend(req.player._id, playerId);

    res.json({
        status: 'success',
        message: 'Friend request sent successfully'
    });
}));

/**
 * @swagger
 * /api/v1/players/friends/{playerId}:
 *   delete:
 *     summary: Remove friend
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Friend removed successfully
 */
router.delete('/friends/:playerId', authenticate, catchAsync(async (req, res) => {
    const { playerId } = req.params;

    await playerService.removeFriend(req.player._id, playerId);

    res.json({
        status: 'success',
        message: 'Friend removed successfully'
    });
}));

/**
 * @swagger
 * /api/v1/players/stats:
 *   get:
 *     summary: Get player statistics
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player statistics retrieved successfully
 */
router.get('/stats', authenticate, catchAsync(async (req, res) => {
    const player = await playerService.getPlayerById(req.player._id);

    res.json({
        status: 'success',
        data: {
            stats: player.stats,
            achievements: player.achievements,
            totalFriends: player.friends.length
        }
    });
}));

/**
 * @swagger
 * /api/v1/players/delete-account:
 *   post:
 *     summary: Delete player account
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: Invalid password
 */
router.post('/delete-account', authenticate, [
    body('password')
        .notEmpty()
        .withMessage('Password is required')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { password } = req.body;
    await playerService.deletePlayerAccount(req.player._id, password);

    res.json({
        status: 'success',
        message: 'Account deleted successfully'
    });
}));

module.exports = router; 