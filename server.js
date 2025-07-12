const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import configurations and services
const config = require('./config');
const logger = require('./utils/logger');
const database = require('./config/database');
const redis = require('./config/redis');
const socketHandler = require('./core/socketHandler');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const playerRoutes = require('./routes/players');
const roomRoutes = require('./routes/rooms');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: config.websocket.heartbeatTimeout,
    pingInterval: config.websocket.heartbeatInterval
});

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
    origin: config.cors.origin,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
const redisStore = new RedisStore({
    client: redis,
    prefix: 'session:'
});

app.use(session({
    store: redisStore,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.nodeEnv === 'production',
        httpOnly: true,
        maxAge: config.session.cookieMaxAge
    }
}));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv
    });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/games', gameRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/rooms', roomRoutes);

// API documentation
if (config.nodeEnv === 'development') {
    const swaggerJsdoc = require('swagger-jsdoc');
    const swaggerUi = require('swagger-ui-express');

    const swaggerOptions = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'Multiplayer Turn-based Game Engine API',
                version: '1.0.0',
                description: 'Backend API for multiplayer turn-based games'
            },
            servers: [
                {
                    url: `http://localhost:${config.port}`,
                    description: 'Development server'
                }
            ]
        },
        apis: ['./src/controllers/*.js']
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Error handling middleware
app.use(errorHandler);

// Initialize Socket.IO handler
socketHandler(io);

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

// Start server
const startServer = async () => {
    try {
        // Connect to database
        await database.connect();
        logger.info('Database connected successfully');

        // Connect to Redis
        await redis.connect();
        logger.info('Redis connected successfully');

        // Start HTTP server
        server.listen(config.port, config.host, () => {
            logger.info(`Server running on http://${config.host}:${config.port}`);
            logger.info(`Environment: ${config.nodeEnv}`);
            logger.info(`API Documentation: http://${config.host}:${config.port}/api-docs`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = { app, server, io }; 