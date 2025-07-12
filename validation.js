const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Validation failed', {
            path: req.path,
            method: req.method,
            errors: errors.array()
        });

        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// Registration validation
const validateRegistration = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),

    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

    handleValidationErrors
];

// Login validation
const validateLogin = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required'),

    body('password')
        .notEmpty()
        .withMessage('Password is required'),

    handleValidationErrors
];

// Game creation validation
const validateGameCreation = [
    body('gameType')
        .isIn(['chess', 'checkers', 'tic-tac-toe', 'custom'])
        .withMessage('Invalid game type'),

    body('maxPlayers')
        .isInt({ min: 2, max: 8 })
        .withMessage('Max players must be between 2 and 8'),

    body('isPrivate')
        .optional()
        .isBoolean()
        .withMessage('isPrivate must be a boolean'),

    body('gameSettings')
        .optional()
        .isObject()
        .withMessage('Game settings must be an object'),

    handleValidationErrors
];

// Game action validation
const validateGameAction = [
    body('actionType')
        .isIn(['move', 'skip', 'surrender', 'chat'])
        .withMessage('Invalid action type'),

    body('actionData')
        .isObject()
        .withMessage('Action data must be an object'),

    handleValidationErrors
];

// Chat message validation
const validateChatMessage = [
    body('message')
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('Message must be between 1 and 500 characters')
        .escape()
        .withMessage('Message contains invalid characters'),

    handleValidationErrors
];

// Room creation validation
const validateRoomCreation = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Room name must be between 1 and 100 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),

    body('gameType')
        .isIn(['chess', 'checkers', 'tic-tac-toe', 'custom'])
        .withMessage('Invalid game type'),

    body('maxPlayers')
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

    body('gameSettings')
        .optional()
        .isObject()
        .withMessage('Game settings must be an object'),

    handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
    body('displayName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Display name must be between 1 and 50 characters'),

    body('avatar')
        .optional()
        .isURL()
        .withMessage('Avatar must be a valid URL'),

    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio must be less than 500 characters'),

    body('preferences')
        .optional()
        .isObject()
        .withMessage('Preferences must be an object'),

    handleValidationErrors
];

// Password change validation
const validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),

    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),

    handleValidationErrors
];

// Status update validation
const validateStatusUpdate = [
    body('status')
        .isIn(['online', 'offline', 'away', 'busy'])
        .withMessage('Invalid status value'),

    handleValidationErrors
];

// Room join validation
const validateRoomJoin = [
    body('password')
        .optional()
        .isLength({ min: 1 })
        .withMessage('Password cannot be empty if provided'),

    handleValidationErrors
];

// Pagination validation
const validatePagination = [
    body('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    body('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    handleValidationErrors
];

// ObjectId validation
const validateObjectId = (req, res, next) => {
    const { id } = req.params;
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;

    if (!objectIdPattern.test(id)) {
        logger.warn('Invalid ObjectId format', { id, path: req.path });
        return res.status(400).json({
            error: 'Invalid ID format'
        });
    }

    next();
};

module.exports = {
    validateRegistration,
    validateLogin,
    validateGameCreation,
    validateGameAction,
    validateChatMessage,
    validateRoomCreation,
    validateProfileUpdate,
    validatePasswordChange,
    validateStatusUpdate,
    validateRoomJoin,
    validatePagination,
    validateObjectId,
    handleValidationErrors
}; 