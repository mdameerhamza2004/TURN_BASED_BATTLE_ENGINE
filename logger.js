const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        if (stack) {
            log += `\n${stack}`;
        }

        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }

        return log;
    })
);

// Define console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;

        if (stack) {
            log += `\n${stack}`;
        }

        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }

        return log;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    defaultMeta: { service: 'game-engine' },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),

        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
            filename: config.logging.file,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ]
});

// If we're not in production, log to the console as well
if (config.nodeEnv !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Create a stream object for Morgan HTTP request logging
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

// Utility methods for different log levels
logger.logRequest = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });

    next();
};

logger.logError = (error, req = null) => {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        name: error.name
    };

    if (req) {
        errorInfo.request = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        };
    }

    logger.error('Application Error', errorInfo);
};

logger.logGameEvent = (event, gameId, playerId = null, data = {}) => {
    logger.info('Game Event', {
        event,
        gameId,
        playerId,
        timestamp: new Date().toISOString(),
        ...data
    });
};

logger.logSocketEvent = (event, socketId, roomId = null, data = {}) => {
    logger.info('Socket Event', {
        event,
        socketId,
        roomId,
        timestamp: new Date().toISOString(),
        ...data
    });
};

logger.logDatabaseOperation = (operation, collection, documentId = null, data = {}) => {
    logger.info('Database Operation', {
        operation,
        collection,
        documentId,
        timestamp: new Date().toISOString(),
        ...data
    });
};

logger.logPerformance = (operation, duration, data = {}) => {
    logger.info('Performance', {
        operation,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        ...data
    });
};

module.exports = logger; 