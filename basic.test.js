const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const Player = require('../src/models/Player');
const config = require('../src/config');

// Test database setup
beforeAll(async () => {
    await mongoose.connect(config.database.uriTest);
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
});

beforeEach(async () => {
    await Player.deleteMany({});
});

describe('Basic API Tests', () => {
    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('environment');
        });
    });

    describe('Authentication', () => {
        it('should register a new player', async () => {
            const playerData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!',
                displayName: 'Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(playerData)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('player');
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
            expect(response.body.data.player.username).toBe(playerData.username);
        });

        it('should login a player', async () => {
            // First register a player
            const playerData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!',
                displayName: 'Test User'
            };

            await request(app)
                .post('/api/v1/auth/register')
                .send(playerData);

            // Then login
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    username: playerData.username,
                    password: playerData.password
                })
                .expect(200);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('player');
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
        });

        it('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Player Profile', () => {
        let authToken;
        let playerId;

        beforeEach(async () => {
            // Register and login a player
            const playerData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!',
                displayName: 'Test User'
            };

            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(playerData);

            authToken = registerResponse.body.data.accessToken;
            playerId = registerResponse.body.data.player._id;
        });

        it('should get player profile', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('username', 'testuser');
            expect(response.body.data).toHaveProperty('email', 'test@example.com');
        });

        it('should update player profile', async () => {
            const updateData = {
                displayName: 'Updated Name',
                avatar: 'https://example.com/avatar.jpg'
            };

            const response = await request(app)
                .put('/api/v1/players/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('displayName', updateData.displayName);
            expect(response.body.data).toHaveProperty('avatar', updateData.avatar);
        });
    });

    describe('Game Operations', () => {
        let authToken;

        beforeEach(async () => {
            // Register and login a player
            const playerData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!',
                displayName: 'Test User'
            };

            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(playerData);

            authToken = registerResponse.body.data.accessToken;
        });

        it('should create a new game', async () => {
            const gameData = {
                gameType: 'chess',
                maxPlayers: 2,
                minPlayers: 2,
                turnTimeLimit: 30000
            };

            const response = await request(app)
                .post('/api/v1/games/create')
                .set('Authorization', `Bearer ${authToken}`)
                .send(gameData)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('game');
            expect(response.body.data.game).toHaveProperty('id');
            expect(response.body.data.game.config.gameType).toBe(gameData.gameType);
        });

        it('should get active games', async () => {
            const response = await request(app)
                .get('/api/v1/games')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('games');
            expect(response.body.data).toHaveProperty('total');
        });
    });

    describe('Room Operations', () => {
        let authToken;

        beforeEach(async () => {
            // Register and login a player
            const playerData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!',
                displayName: 'Test User'
            };

            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(playerData);

            authToken = registerResponse.body.data.accessToken;
        });

        it('should create a new room', async () => {
            const roomData = {
                name: 'Test Room',
                description: 'A test room',
                gameType: 'chess',
                maxPlayers: 4
            };

            const response = await request(app)
                .post('/api/v1/rooms')
                .set('Authorization', `Bearer ${authToken}`)
                .send(roomData)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('room');
            expect(response.body.data.room).toHaveProperty('name', roomData.name);
            expect(response.body.data.room).toHaveProperty('gameType', roomData.gameType);
        });

        it('should get rooms list', async () => {
            const response = await request(app)
                .get('/api/v1/rooms')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body.data).toHaveProperty('rooms');
            expect(response.body.data).toHaveProperty('pagination');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 errors', async () => {
            const response = await request(app)
                .get('/api/v1/nonexistent')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        it('should handle validation errors', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    username: 'a', // Too short
                    email: 'invalid-email',
                    password: '123' // Too short
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('message');
        });
    });
}); 