const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/rooms:
 *   get:
 *     summary: Get all rooms
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, full, closed]
 *         description: Filter rooms by status
 *       - in: query
 *         name: gameType
 *         schema:
 *           type: string
 *         description: Filter rooms by game type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of rooms to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of rooms retrieved successfully
 */
router.get('/', authenticate, roomController.getAllRooms);

/**
 * @swagger
 * /api/v1/rooms/{roomId}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *       404:
 *         description: Room not found
 */
router.get('/:roomId', authenticate, roomController.getRoomById);

/**
 * @swagger
 * /api/v1/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - gameType
 *               - maxPlayers
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               gameType:
 *                 type: string
 *                 enum: [chess, checkers, tic-tac-toe, custom]
 *               maxPlayers:
 *                 type: integer
 *                 minimum: 2
 *                 maximum: 8
 *               isPrivate:
 *                 type: boolean
 *                 default: false
 *               password:
 *                 type: string
 *                 description: Required if isPrivate is true
 *               gameSettings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Room created successfully
 *       400:
 *         description: Invalid room configuration
 */
router.post('/', authenticate, roomController.createRoom);

/**
 * @swagger
 * /api/v1/rooms/{roomId}/join:
 *   post:
 *     summary: Join a room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Required for private rooms
 *     responses:
 *       200:
 *         description: Successfully joined the room
 *       400:
 *         description: Cannot join room
 *       401:
 *         description: Invalid password for private room
 *       404:
 *         description: Room not found
 */
router.post('/:roomId/join', authenticate, roomController.joinRoom);

/**
 * @swagger
 * /api/v1/rooms/{roomId}/leave:
 *   post:
 *     summary: Leave a room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Successfully left the room
 *       404:
 *         description: Room not found
 */
router.post('/:roomId/leave', authenticate, roomController.leaveRoom);

/**
 * @swagger
 * /api/v1/rooms/{roomId}/chat:
 *   post:
 *     summary: Send chat message in room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
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
router.post('/:roomId/chat', authenticate, roomController.sendChatMessage);

/**
 * @swagger
 * /api/v1/rooms/{roomId}/chat:
 *   get:
 *     summary: Get room chat history
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Get messages before this timestamp
 *     responses:
 *       200:
 *         description: Chat history retrieved successfully
 *       404:
 *         description: Room not found
 */
router.get('/:roomId/chat', authenticate, roomController.getChatHistory);

/**
 * @swagger
 * /api/v1/rooms/{roomId}/start-game:
 *   post:
 *     summary: Start a game in the room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gameSettings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Game started successfully
 *       400:
 *         description: Cannot start game
 *       403:
 *         description: Not room owner
 */
router.post('/:roomId/start-game', authenticate, roomController.startGame);

/**
 * @swagger
 * /api/v1/rooms/{roomId}/settings:
 *   put:
 *     summary: Update room settings
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               isPrivate:
 *                 type: boolean
 *               password:
 *                 type: string
 *               gameSettings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Room settings updated successfully
 *       403:
 *         description: Not room owner
 */
router.put('/:roomId/settings', authenticate, roomController.updateRoomSettings);

/**
 * @swagger
 * /api/v1/rooms/{roomId}:
 *   delete:
 *     summary: Delete room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *       403:
 *         description: Not room owner
 */
router.delete('/:roomId', authenticate, roomController.deleteRoom);

module.exports = router; 