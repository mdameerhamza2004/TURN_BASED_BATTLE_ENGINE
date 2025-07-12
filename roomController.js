const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Room = require('../models/Room');

const router = express.Router();

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
 *         name: gameType
 *         schema:
 *           type: string
 *         description: Filter by game type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by room status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of rooms retrieved successfully
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
    const { gameType, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { isPrivate: false };
    if (gameType) query.gameType = gameType;
    if (status) query.status = status;

    const rooms = await Room.find(query)
        .populate('players.playerId', 'username displayName avatar')
        .populate('createdBy', 'username displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Room.countDocuments(query);

    res.json({
        status: 'success',
        data: {
            rooms,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }
    });
}));

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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               description:
 *                 type: string
 *                 maxLength: 200
 *               gameType:
 *                 type: string
 *                 enum: [chess, checkers, tic-tac-toe, custom]
 *               maxPlayers:
 *                 type: number
 *                 minimum: 2
 *                 maximum: 8
 *               isPrivate:
 *                 type: boolean
 *               password:
 *                 type: string
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Room created successfully
 */
router.post('/', authenticate, [
    body('name')
        .isLength({ min: 3, max: 50 })
        .withMessage('Room name must be 3-50 characters long'),
    body('description')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Description must be less than 200 characters'),
    body('gameType')
        .isIn(['chess', 'checkers', 'tic-tac-toe', 'custom'])
        .withMessage('Invalid game type'),
    body('maxPlayers')
        .optional()
        .isInt({ min: 2, max: 8 })
        .withMessage('Max players must be between 2 and 8'),
    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean'),
    body('password')
        .optional()
        .isLength({ min: 1 })
        .withMessage('Password cannot be empty if provided'),
    body('settings')
        .optional()
        .isObject()
        .withMessage('Settings must be an object')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const roomData = {
        name: req.body.name,
        description: req.body.description,
        gameType: req.body.gameType,
        maxPlayers: req.body.maxPlayers || 4,
        isPrivate: req.body.isPrivate || false,
        password: req.body.password,
        createdBy: req.player._id,
        settings: req.body.settings || {}
    };

    const room = new Room(roomData);
    await room.save();

    // Add creator as first player
    await room.addPlayer(req.player._id);

    // Add system message
    await room.addSystemMessage(`${req.player.displayName} created the room`);

    logger.logDatabaseOperation('create', 'Room', room._id);

    res.status(201).json({
        status: 'success',
        data: {
            room: room.toPublicJSON()
        }
    });
}));

/**
 * @swagger
 * /api/v1/rooms/{roomId}:
 *   get:
 *     summary: Get room details
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room details retrieved successfully
 *       404:
 *         description: Room not found
 */
router.get('/:roomId', authenticate, catchAsync(async (req, res) => {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)
        .populate('players.playerId', 'username displayName avatar')
        .populate('createdBy', 'username displayName');

    if (!room) {
        throw new AppError('Room not found', 404);
    }

    // Check if room is private and user is not a member
    if (room.isPrivate && !room.isPlayerInRoom(req.player._id)) {
        throw new AppError('Access denied', 403);
    }

    res.json({
        status: 'success',
        data: {
            room: room.toJSON()
        }
    });
}));

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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *               asSpectator:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Successfully joined room
 *       400:
 *         description: Cannot join room
 *       403:
 *         description: Access denied
 *       404:
 *         description: Room not found
 */
router.post('/:roomId/join', authenticate, [
    body('password')
        .optional()
        .isString()
        .withMessage('Password must be a string'),
    body('asSpectator')
        .optional()
        .isBoolean()
        .withMessage('asSpectator must be a boolean')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { roomId } = req.params;
    const { password, asSpectator = false } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
        throw new AppError('Room not found', 404);
    }

    // Check if room is full
    if (room.isFull && !asSpectator) {
        throw new AppError('Room is full', 400);
    }

    // Check password for private rooms
    if (room.isPrivate && room.password && room.password !== password) {
        throw new AppError('Invalid password', 403);
    }

    // Check if already in room
    if (room.isPlayerInRoom(req.player._id)) {
        throw new AppError('Already in room', 400);
    }

    await room.addPlayer(req.player._id, asSpectator);

    // Add system message
    await room.addSystemMessage(`${req.player.displayName} joined the room`);

    logger.logDatabaseOperation('join', 'Room', roomId, { playerId: req.player._id });

    res.json({
        status: 'success',
        message: 'Successfully joined room'
    });
}));

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
 *     responses:
 *       200:
 *         description: Successfully left room
 *       404:
 *         description: Room not found
 */
router.post('/:roomId/leave', authenticate, catchAsync(async (req, res) => {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
        throw new AppError('Room not found', 404);
    }

    if (!room.isPlayerInRoom(req.player._id)) {
        throw new AppError('Not in room', 400);
    }

    await room.removePlayer(req.player._id);

    // Add system message
    await room.addSystemMessage(`${req.player.displayName} left the room`);

    logger.logDatabaseOperation('leave', 'Room', roomId, { playerId: req.player._id });

    res.json({
        status: 'success',
        message: 'Successfully left room'
    });
}));

/**
 * @swagger
 * /api/v1/rooms/{roomId}/chat:
 *   get:
 *     summary: Get room chat messages
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Chat messages retrieved successfully
 */
router.get('/:roomId/chat', authenticate, catchAsync(async (req, res) => {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const room = await Room.findById(roomId);
    if (!room) {
        throw new AppError('Room not found', 404);
    }

    if (!room.isPlayerInRoom(req.player._id)) {
        throw new AppError('Not in room', 403);
    }

    const messages = room.chat.messages.slice(-limit);

    res.json({
        status: 'success',
        data: {
            messages,
            total: room.chat.messages.length
        }
    });
}));

/**
 * @swagger
 * /api/v1/rooms/{roomId}/chat:
 *   post:
 *     summary: Send chat message
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 500
 *               type:
 *                 type: string
 *                 enum: [text, game]
 *                 default: text
 *     responses:
 *       200:
 *         description: Message sent successfully
 */
router.post('/:roomId/chat', authenticate, [
    body('message')
        .isLength({ min: 1, max: 500 })
        .withMessage('Message must be 1-500 characters long'),
    body('type')
        .optional()
        .isIn(['text', 'game'])
        .withMessage('Type must be text or game')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { roomId } = req.params;
    const { message, type = 'text' } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
        throw new AppError('Room not found', 404);
    }

    if (!room.isPlayerInRoom(req.player._id)) {
        throw new AppError('Not in room', 403);
    }

    if (!room.chat.enabled) {
        throw new AppError('Chat is disabled in this room', 400);
    }

    await room.addChatMessage(req.player._id, req.player.displayName, message, type);

    logger.logDatabaseOperation('chat_message', 'Room', roomId, {
        playerId: req.player._id,
        messageType: type
    });

    res.json({
        status: 'success',
        message: 'Message sent successfully'
    });
}));

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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Room settings updated successfully
 */
router.put('/:roomId/settings', authenticate, [
    body('name')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Room name must be 3-50 characters long'),
    body('description')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Description must be less than 200 characters'),
    body('settings')
        .optional()
        .isObject()
        .withMessage('Settings must be an object')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
        throw new AppError('Room not found', 404);
    }

    // Only host can update settings
    if (!room.isPlayerHost(req.player._id)) {
        throw new AppError('Only host can update room settings', 403);
    }

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.settings) updateData.settings = req.body.settings;

    Object.assign(room, updateData);
    await room.save();

    logger.logDatabaseOperation('update_settings', 'Room', roomId, { playerId: req.player._id });

    res.json({
        status: 'success',
        data: {
            room: room.toPublicJSON()
        }
    });
}));

/**
 * @swagger
 * /api/v1/rooms/{roomId}/host:
 *   post:
 *     summary: Transfer host
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
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
 *               - playerId
 *             properties:
 *               playerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Host transferred successfully
 */
router.post('/:roomId/host', authenticate, [
    body('playerId')
        .notEmpty()
        .withMessage('Player ID is required')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { roomId } = req.params;
    const { playerId } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
        throw new AppError('Room not found', 404);
    }

    // Only current host can transfer host
    if (!room.isPlayerHost(req.player._id)) {
        throw new AppError('Only host can transfer host', 403);
    }

    // Check if target player is in room
    if (!room.isPlayerInRoom(playerId)) {
        throw new AppError('Player is not in room', 400);
    }

    await room.setHost(playerId);

    // Add system message
    await room.addSystemMessage(`Host transferred to ${playerId}`);

    logger.logDatabaseOperation('transfer_host', 'Room', roomId, {
        fromPlayerId: req.player._id,
        toPlayerId: playerId
    });

    res.json({
        status: 'success',
        message: 'Host transferred successfully'
    });
}));

module.exports = router; 