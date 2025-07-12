const redis = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            if (this.isConnected) {
                logger.info('Redis already connected');
                return;
            }

            this.client = redis.createClient({
                url: config.redis.url,
                password: config.redis.password,
                ...config.redis.options
            });

            // Handle connection events
            this.client.on('connect', () => {
                logger.info('Redis client connecting...');
            });

            this.client.on('ready', () => {
                logger.info('Redis client ready');
                this.isConnected = true;
            });

            this.client.on('error', (error) => {
                logger.error('Redis client error:', error);
                this.isConnected = false;
            });

            this.client.on('end', () => {
                logger.warn('Redis client disconnected');
                this.isConnected = false;
            });

            this.client.on('reconnecting', () => {
                logger.info('Redis client reconnecting...');
            });

            await this.client.connect();

            // Test the connection
            await this.client.ping();
            logger.info('Redis connected successfully');

        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client && this.isConnected) {
                await this.client.quit();
                this.isConnected = false;
                logger.info('Redis disconnected');
            }
        } catch (error) {
            logger.error('Error disconnecting from Redis:', error);
            throw error;
        }
    }

    getClient() {
        return this.client;
    }

    isConnected() {
        return this.isConnected;
    }

    // Health check method
    async healthCheck() {
        try {
            if (!this.isConnected || !this.client) {
                return { status: 'disconnected', message: 'Redis not connected' };
            }

            const pong = await this.client.ping();
            if (pong === 'PONG') {
                return { status: 'healthy', message: 'Redis connection is healthy' };
            } else {
                return { status: 'unhealthy', message: 'Redis ping failed' };
            }
        } catch (error) {
            logger.error('Redis health check failed:', error);
            return { status: 'unhealthy', message: error.message };
        }
    }

    // Utility methods for common operations
    async set(key, value, ttl = null) {
        try {
            if (ttl) {
                return await this.client.setEx(key, ttl, JSON.stringify(value));
            } else {
                return await this.client.set(key, JSON.stringify(value));
            }
        } catch (error) {
            logger.error('Redis set error:', error);
            throw error;
        }
    }

    async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Redis get error:', error);
            throw error;
        }
    }

    async del(key) {
        try {
            return await this.client.del(key);
        } catch (error) {
            logger.error('Redis del error:', error);
            throw error;
        }
    }

    async exists(key) {
        try {
            return await this.client.exists(key);
        } catch (error) {
            logger.error('Redis exists error:', error);
            throw error;
        }
    }

    async expire(key, ttl) {
        try {
            return await this.client.expire(key, ttl);
        } catch (error) {
            logger.error('Redis expire error:', error);
            throw error;
        }
    }

    async ttl(key) {
        try {
            return await this.client.ttl(key);
        } catch (error) {
            logger.error('Redis ttl error:', error);
            throw error;
        }
    }

    // Hash operations
    async hset(key, field, value) {
        try {
            return await this.client.hSet(key, field, JSON.stringify(value));
        } catch (error) {
            logger.error('Redis hset error:', error);
            throw error;
        }
    }

    async hget(key, field) {
        try {
            const value = await this.client.hGet(key, field);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Redis hget error:', error);
            throw error;
        }
    }

    async hgetall(key) {
        try {
            const hash = await this.client.hGetAll(key);
            const result = {};
            for (const [field, value] of Object.entries(hash)) {
                result[field] = JSON.parse(value);
            }
            return result;
        } catch (error) {
            logger.error('Redis hgetall error:', error);
            throw error;
        }
    }

    // List operations
    async lpush(key, value) {
        try {
            return await this.client.lPush(key, JSON.stringify(value));
        } catch (error) {
            logger.error('Redis lpush error:', error);
            throw error;
        }
    }

    async rpop(key) {
        try {
            const value = await this.client.rPop(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Redis rpop error:', error);
            throw error;
        }
    }

    async lrange(key, start, stop) {
        try {
            const list = await this.client.lRange(key, start, stop);
            return list.map(item => JSON.parse(item));
        } catch (error) {
            logger.error('Redis lrange error:', error);
            throw error;
        }
    }
}

module.exports = new RedisClient(); 