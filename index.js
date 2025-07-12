const config = {
    // Server configuration
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',

    // Database configuration
    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/game_engine',
        uriTest: process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/game_engine_test',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }
    },

    // Redis configuration
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD || null,
        options: {
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
        }
    },

    // JWT configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'your-session-secret-key-change-in-production',
        cookieMaxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE, 10) || 86400000,
    },

    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    },

    // Game configuration
    game: {
        maxPlayersPerGame: parseInt(process.env.MAX_PLAYERS_PER_GAME, 10) || 8,
        turnTimeLimit: parseInt(process.env.TURN_TIME_LIMIT, 10) || 30000, // 30 seconds
        gameTimeout: parseInt(process.env.GAME_TIMEOUT, 10) || 300000, // 5 minutes
        maxGamesPerPlayer: parseInt(process.env.MAX_GAMES_PER_PLAYER, 10) || 5,
    },

    // WebSocket configuration
    websocket: {
        heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 10) || 25000,
        heartbeatTimeout: parseInt(process.env.WS_HEARTBEAT_TIMEOUT, 10) || 5000,
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log',
    },

    // CORS configuration
    cors: {
        origin: process.env.CORS_ORIGIN ?
            process.env.CORS_ORIGIN.split(',') :
            ['http://localhost:3000', 'http://localhost:3001'],
    },

    // File upload configuration
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880, // 5MB
        path: process.env.UPLOAD_PATH || 'uploads/',
    },

    // Email configuration
    email: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },

    // External APIs
    externalApi: {
        key: process.env.EXTERNAL_API_KEY || '',
    }
};

module.exports = config; 