const logger = require('../utils/logger');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Handle MongoDB validation errors
 */
const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

/**
 * Handle MongoDB duplicate key errors
 */
const handleDuplicateKeyError = (err) => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
};

/**
 * Handle MongoDB cast errors
 */
const handleCastError = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);

/**
 * Handle JWT expiration errors
 */
const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

/**
 * Handle MongoDB errors
 */
const handleMongoError = (err) => {
    if (err.name === 'ValidationError') return handleValidationError(err);
    if (err.code === 11000) return handleDuplicateKeyError(err);
    if (err.name === 'CastError') return handleCastError(err);
    if (err.name === 'JsonWebTokenError') return handleJWTError();
    if (err.name === 'TokenExpiredError') return handleJWTExpiredError();

    return err;
};

/**
 * Send error response in development
 */
const sendErrorDev = (err, req, res) => {
    // API error
    if (req.originalUrl.startsWith('/api')) {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    }

    // Rendered error page
    return res.status(err.statusCode).render('error', {
        title: 'Something went wrong!',
        msg: err.message
    });
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, req, res) => {
    // API error
    if (req.originalUrl.startsWith('/api')) {
        // Operational, trusted error: send message to client
        if (err.isOperational) {
            return res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        }

        // Programming or other unknown error: don't leak error details
        logger.error('ERROR 💥', err);
        return res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!'
        });
    }

    // Rendered error page
    if (err.isOperational) {
        return res.status(err.statusCode).render('error', {
            title: 'Something went wrong!',
            msg: err.message
        });
    }

    // Programming or other unknown error: don't leak error details
    logger.error('ERROR 💥', err);
    return res.status(err.statusCode).render('error', {
        title: 'Something went wrong!',
        msg: 'Please try again later.'
    });
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error
    logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Handle specific MongoDB errors
    const mongoError = handleMongoError(err);
    if (mongoError !== err) {
        err = mongoError;
    }

    // Send error response based on environment
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, req, res);
    } else {
        sendErrorProd(err, req, res);
    }
};

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
    const error = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
    next(error);
};

/**
 * Handle async errors
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Handle socket errors
 */
const handleSocketError = (socket, error) => {
    logger.error('Socket error:', {
        socketId: socket.id,
        error: error.message,
        stack: error.stack
    });

    socket.emit('error', {
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
};

/**
 * Validate request body
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const { error } = schema.validate(req.body);
            if (error) {
                const message = error.details.map(detail => detail.message).join(', ');
                return res.status(400).json({
                    status: 'fail',
                    message: `Validation error: ${message}`
                });
            }
            next();
        } catch (err) {
            next(err);
        }
    };
};

/**
 * Handle rate limit errors
 */
const handleRateLimitError = (req, res) => {
    return res.status(429).json({
        status: 'fail',
        message: 'Too many requests from this IP, please try again later.'
    });
};

/**
 * Handle CORS errors
 */
const handleCORSError = (err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            status: 'fail',
            message: 'CORS policy violation'
        });
    }
    next(err);
};

/**
 * Handle file upload errors
 */
const handleFileUploadError = (err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            status: 'fail',
            message: 'File too large'
        });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            status: 'fail',
            message: 'Unexpected file field'
        });
    }
    next(err);
};

/**
 * Handle database connection errors
 */
const handleDatabaseError = (err) => {
    logger.error('Database connection error:', err);

    if (err.name === 'MongoNetworkError') {
        return new AppError('Database connection failed. Please try again later.', 503);
    }

    if (err.name === 'MongoTimeoutError') {
        return new AppError('Database operation timed out. Please try again.', 503);
    }

    return err;
};

/**
 * Handle Redis errors
 */
const handleRedisError = (err) => {
    logger.error('Redis error:', err);

    if (err.code === 'ECONNREFUSED') {
        return new AppError('Cache service unavailable. Please try again later.', 503);
    }

    return err;
};

/**
 * Global error handler for unhandled rejections
 */
const handleUnhandledRejection = (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    logger.error(err.stack);

    process.exit(1);
};

/**
 * Global error handler for uncaught exceptions
 */
const handleUncaughtException = (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    logger.error(err.stack);

    process.exit(1);
};

// Set up global error handlers
process.on('unhandledRejection', handleUnhandledRejection);
process.on('uncaughtException', handleUncaughtException);

module.exports = {
    AppError,
    errorHandler,
    notFound,
    catchAsync,
    handleSocketError,
    validateRequest,
    handleRateLimitError,
    handleCORSError,
    handleFileUploadError,
    handleDatabaseError,
    handleRedisError,
    handleUnhandledRejection,
    handleUncaughtException
}; 