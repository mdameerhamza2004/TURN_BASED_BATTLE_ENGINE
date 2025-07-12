const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const PlayerService = require('../services/playerService');
const { authenticate, refreshAccessToken } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();
const playerService = new PlayerService();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        error: 'Too many authentication attempts',
        message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new player
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               displayName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Player registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     player:
 *                       $ref: '#/components/schemas/Player'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Validation error
 *       409:
 *         description: Username or email already exists
 */
router.post('/register', authLimiter, [
    body('username')
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('displayName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Display name must be 2-50 characters long')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const playerData = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        displayName: req.body.displayName
    };

    const player = await playerService.createPlayer(playerData);

    // Generate tokens
    const accessToken = player.generateAuthToken();
    const refreshToken = player.generateRefreshToken();

    logger.logDatabaseOperation('register', 'Player', player._id);

    res.status(201).json({
        status: 'success',
        data: {
            player,
            accessToken,
            refreshToken
        }
    });
}));

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login player
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     player:
 *                       $ref: '#/components/schemas/Player'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked
 */
router.post('/login', authLimiter, [
    body('username')
        .notEmpty()
        .withMessage('Username or email is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { username, password } = req.body;
    const result = await playerService.authenticatePlayer(username, password);

    logger.logDatabaseOperation('login', 'Player', result.player._id);

    res.json({
        status: 'success',
        data: result
    });
}));

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);

    logger.logDatabaseOperation('token_refresh', 'Player', result.player._id);

    res.json({
        status: 'success',
        data: result
    });
}));

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout player
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Not authenticated
 */
router.post('/logout', authenticate, catchAsync(async (req, res) => {
    // Update player status to offline
    await playerService.updatePlayerStatus(req.player._id, 'offline');

    logger.logDatabaseOperation('logout', 'Player', req.player._id);

    res.json({
        status: 'success',
        message: 'Logged out successfully'
    });
}));

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current player profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Player'
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, catchAsync(async (req, res) => {
    const player = await playerService.getPlayerById(req.player._id);

    res.json({
        status: 'success',
        data: player
    });
}));

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change player password
 *     tags: [Authentication]
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
 *         description: Not authenticated
 */
router.post('/change-password', authenticate, [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { currentPassword, newPassword } = req.body;
    await playerService.changePassword(req.player._id, currentPassword, newPassword);

    logger.logDatabaseOperation('password_change', 'Player', req.player._id);

    res.json({
        status: 'success',
        message: 'Password changed successfully'
    });
}));

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: Email not found
 */
router.post('/forgot-password', authLimiter, [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
], catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError(`Validation error: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { email } = req.body;

    // Check if player exists
    const player = await playerService.getPlayerByEmail(email);
    if (!player) {
        // Don't reveal if email exists or not for security
        return res.json({
            status: 'success',
            message: 'If the email exists, a password reset link has been sent'
        });
    }

    // TODO: Implement password reset email functionality
    // For now, just log the request
    logger.logDatabaseOperation('forgot_password_request', 'Player', player._id);

    res.json({
        status: 'success',
        message: 'If the email exists, a password reset link has been sent'
    });
}));

module.exports = router; 