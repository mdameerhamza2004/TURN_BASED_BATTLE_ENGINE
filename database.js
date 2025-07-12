const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

class Database {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            if (this.isConnected) {
                logger.info('Database already connected');
                return;
            }

            const uri = config.nodeEnv === 'test' ? config.database.uriTest : config.database.uri;

            this.connection = await mongoose.connect(uri, config.database.options);
            this.isConnected = true;

            logger.info('MongoDB connected successfully');

            // Handle connection events
            mongoose.connection.on('error', (error) => {
                logger.error('MongoDB connection error:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('MongoDB reconnected');
                this.isConnected = true;
            });

            // Graceful shutdown
            process.on('SIGINT', async () => {
                await this.disconnect();
                process.exit(0);
            });

        } catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.isConnected = false;
                logger.info('MongoDB disconnected');
            }
        } catch (error) {
            logger.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }

    getConnection() {
        return this.connection;
    }

    isConnected() {
        return this.isConnected;
    }

    // Health check method
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected', message: 'Database not connected' };
            }

            // Ping the database
            await mongoose.connection.db.admin().ping();
            return { status: 'healthy', message: 'Database connection is healthy' };
        } catch (error) {
            logger.error('Database health check failed:', error);
            return { status: 'unhealthy', message: error.message };
        }
    }
}

module.exports = new Database(); 