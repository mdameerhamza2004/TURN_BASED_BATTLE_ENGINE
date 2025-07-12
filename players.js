const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/players:
 *   get:
 *     summary: Get all players
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [online, offline, away]
 *         description: Filter players by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of players to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of players retrieved successfully
 */
router.get('/', authenticate, playerController.getAllPlayers);

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
 *         description: Player ID
 *     responses:
 *       200:
 *         description: Player retrieved successfully
 *       404:
 *         description: Player not found
 */
router.get('/:playerId', authenticate, playerController.getPlayerById);

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
 *                 maxLength: 50
 *               avatar:
 *                 type: string
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid profile data
 */
router.put('/profile', authenticate, playerController.updateProfile);

/**
 * @swagger
 * /api/v1/players/password:
 *   put:
 *     summary: Change password
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
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid password
 *       401:
 *         description: Current password is incorrect
 */
router.put('/password', authenticate, playerController.changePassword);

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
router.get('/stats', authenticate, playerController.getStats);

/**
 * @swagger
 * /api/v1/players/{playerId}/stats:
 *   get:
 *     summary: Get player statistics by ID
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Player ID
 *     responses:
 *       200:
 *         description: Player statistics retrieved successfully
 *       404:
 *         description: Player not found
 */
router.get('/:playerId/stats', authenticate, playerController.getPlayerStats);

/**
 * @swagger
 * /api/v1/players/friends:
 *   get:
 *     summary: Get player's friends list
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Friends list retrieved successfully
 */
router.get('/friends', authenticate, playerController.getFriends);

/**
 * @swagger
 * /api/v1/players/friends/{friendId}:
 *   post:
 *     summary: Add friend
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *         description: Friend's player ID
 *     responses:
 *       200:
 *         description: Friend added successfully
 *       404:
 *         description: Player not found
 *       409:
 *         description: Already friends
 */
router.post('/friends/:friendId', authenticate, playerController.addFriend);

/**
 * @swagger
 * /api/v1/players/friends/{friendId}:
 *   delete:
 *     summary: Remove friend
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *         description: Friend's player ID
 *     responses:
 *       200:
 *         description: Friend removed successfully
 *       404:
 *         description: Player not found
 */
router.delete('/friends/:friendId', authenticate, playerController.removeFriend);

/**
 * @swagger
 * /api/v1/players/status:
 *   put:
 *     summary: Update player status
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [online, offline, away, busy]
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.put('/status', authenticate, playerController.updateStatus);

module.exports = router; 