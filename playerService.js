const Player = require('../models/Player');
const logger = require('../utils/logger');
const { validatePassword, validateUsername, validateEmail } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

class PlayerService {
    /**
     * Create a new player
     * @param {Object} playerData - Player data
     * @returns {Object} Created player
     */
    async createPlayer(playerData) {
        try {
            const { username, email, password, displayName } = playerData;

            // Validate input data
            const usernameValidation = validateUsername(username);
            if (!usernameValidation.valid) {
                throw new AppError(`Username validation failed: ${usernameValidation.errors.join(', ')}`, 400);
            }

            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                throw new AppError(`Email validation failed: ${emailValidation.errors.join(', ')}`, 400);
            }

            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
            }

            // Check if username or email already exists
            const existingPlayer = await Player.findOne({
                $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
            });

            if (existingPlayer) {
                if (existingPlayer.username === username.toLowerCase()) {
                    throw new AppError('Username already exists', 400);
                }
                if (existingPlayer.email === email.toLowerCase()) {
                    throw new AppError('Email already exists', 400);
                }
            }

            // Create new player
            const player = new Player({
                username: username.toLowerCase(),
                email: email.toLowerCase(),
                password,
                displayName: displayName || username
            });

            await player.save();

            logger.logDatabaseOperation('create', 'Player', player._id);

            return player.toJSON();
        } catch (error) {
            logger.error('Create player error:', error);
            throw error;
        }
    }

    /**
     * Authenticate player
     * @param {string} username - Username or email
     * @param {string} password - Password
     * @returns {Object} Player with tokens
     */
    async authenticatePlayer(username, password) {
        try {
            // Find player by username or email
            const player = await Player.findOne({
                $or: [
                    { username: username.toLowerCase() },
                    { email: username.toLowerCase() }
                ]
            });

            if (!player) {
                throw new AppError('Invalid credentials', 401);
            }

            // Check if account is locked
            if (player.isLocked()) {
                throw new AppError('Account is temporarily locked. Please try again later.', 423);
            }

            // Check if account is active
            if (!player.isActive) {
                throw new AppError('Account is disabled', 401);
            }

            // Verify password
            const isPasswordValid = await player.comparePassword(password);
            if (!isPasswordValid) {
                await player.incLoginAttempts();
                throw new AppError('Invalid credentials', 401);
            }

            // Reset login attempts on successful login
            await player.resetLoginAttempts();

            // Update last login and status
            await player.updateLastSeen();
            await player.updateStatus('online');

            // Generate tokens
            const accessToken = player.generateAuthToken();
            const refreshToken = player.generateRefreshToken();

            logger.logDatabaseOperation('login', 'Player', player._id);

            return {
                player: player.toJSON(),
                accessToken,
                refreshToken
            };
        } catch (error) {
            logger.error('Authentication error:', error);
            throw error;
        }
    }

    /**
     * Get player by ID
     * @param {string} playerId - Player ID
     * @returns {Object} Player object
     */
    async getPlayerById(playerId) {
        try {
            const player = await Player.findById(playerId).select('-password');
            if (!player) {
                throw new AppError('Player not found', 404);
            }
            return player;
        } catch (error) {
            logger.error('Get player by ID error:', error);
            throw error;
        }
    }

    /**
     * Get player by username
     * @param {string} username - Username
     * @returns {Object} Player object
     */
    async getPlayerByUsername(username) {
        try {
            const player = await Player.findByUsername(username).select('-password');
            if (!player) {
                throw new AppError('Player not found', 404);
            }
            return player;
        } catch (error) {
            logger.error('Get player by username error:', error);
            throw error;
        }
    }

    /**
     * Update player profile
     * @param {string} playerId - Player ID
     * @param {Object} updateData - Update data
     * @returns {Object} Updated player
     */
    async updatePlayerProfile(playerId, updateData) {
        try {
            const allowedFields = ['displayName', 'avatar', 'preferences'];
            const filteredData = {};

            // Only allow specific fields to be updated
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredData[key] = updateData[key];
                }
            });

            const player = await Player.findByIdAndUpdate(
                playerId,
                { $set: filteredData },
                { new: true, runValidators: true }
            ).select('-password');

            if (!player) {
                throw new AppError('Player not found', 404);
            }

            logger.logDatabaseOperation('update', 'Player', playerId);

            return player;
        } catch (error) {
            logger.error('Update player profile error:', error);
            throw error;
        }
    }

    /**
     * Change player password
     * @param {string} playerId - Player ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {boolean} Success status
     */
    async changePassword(playerId, currentPassword, newPassword) {
        try {
            const player = await Player.findById(playerId);
            if (!player) {
                throw new AppError('Player not found', 404);
            }

            // Verify current password
            const isCurrentPasswordValid = await player.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                throw new AppError('Current password is incorrect', 400);
            }

            // Validate new password
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.valid) {
                throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
            }

            // Update password
            player.password = newPassword;
            await player.save();

            logger.logDatabaseOperation('password_change', 'Player', playerId);

            return true;
        } catch (error) {
            logger.error('Change password error:', error);
            throw error;
        }
    }

    /**
     * Update player status
     * @param {string} playerId - Player ID
     * @param {string} status - New status
     * @returns {Object} Updated player
     */
    async updatePlayerStatus(playerId, status) {
        try {
            const player = await Player.findByIdAndUpdate(
                playerId,
                {
                    $set: {
                        status,
                        lastSeen: new Date()
                    }
                },
                { new: true }
            ).select('-password');

            if (!player) {
                throw new AppError('Player not found', 404);
            }

            logger.logDatabaseOperation('status_update', 'Player', playerId, { status });

            return player;
        } catch (error) {
            logger.error('Update player status error:', error);
            throw error;
        }
    }

    /**
     * Get online players
     * @param {number} limit - Limit number of results
     * @returns {Array} Online players
     */
    async getOnlinePlayers(limit = 50) {
        try {
            const players = await Player.findOnlinePlayers().limit(limit);
            return players;
        } catch (error) {
            logger.error('Get online players error:', error);
            throw error;
        }
    }

    /**
     * Get top players
     * @param {number} limit - Limit number of results
     * @returns {Array} Top players
     */
    async getTopPlayers(limit = 10) {
        try {
            const players = await Player.findTopPlayers(limit);
            return players;
        } catch (error) {
            logger.error('Get top players error:', error);
            throw error;
        }
    }

    /**
     * Search players
     * @param {string} query - Search query
     * @param {number} limit - Limit number of results
     * @returns {Array} Matching players
     */
    async searchPlayers(query, limit = 20) {
        try {
            const players = await Player.find({
                $or: [
                    { username: { $regex: query, $options: 'i' } },
                    { displayName: { $regex: query, $options: 'i' } }
                ],
                isActive: true
            })
                .select('username displayName avatar status stats')
                .limit(limit);

            return players;
        } catch (error) {
            logger.error('Search players error:', error);
            throw error;
        }
    }

    /**
     * Get player active games
     * @param {string} playerId - Player ID
     * @returns {Array} Active game IDs
     */
    async getPlayerActiveGames(playerId) {
        try {
            const player = await Player.findById(playerId).select('activeGames');
            if (!player) {
                throw new AppError('Player not found', 404);
            }
            return player.activeGames.map(game => game.gameId);
        } catch (error) {
            logger.error('Get player active games error:', error);
            throw error;
        }
    }

    /**
     * Add game to player
     * @param {string} playerId - Player ID
     * @param {string} gameId - Game ID
     * @returns {Object} Updated player
     */
    async addGameToPlayer(playerId, gameId) {
        try {
            const player = await Player.findById(playerId);
            if (!player) {
                throw new AppError('Player not found', 404);
            }

            await player.addGame(gameId);

            logger.logDatabaseOperation('add_game', 'Player', playerId, { gameId });

            return player;
        } catch (error) {
            logger.error('Add game to player error:', error);
            throw error;
        }
    }

    /**
     * Remove game from player
     * @param {string} playerId - Player ID
     * @param {string} gameId - Game ID
     * @returns {Object} Updated player
     */
    async removeGameFromPlayer(playerId, gameId) {
        try {
            const player = await Player.findById(playerId);
            if (!player) {
                throw new AppError('Player not found', 404);
            }

            await player.removeGame(gameId);

            logger.logDatabaseOperation('remove_game', 'Player', playerId, { gameId });

            return player;
        } catch (error) {
            logger.error('Remove game from player error:', error);
            throw error;
        }
    }

    /**
     * Update player stats
     * @param {string} playerId - Player ID
     * @param {Object} gameResult - Game result
     * @returns {Object} Updated player
     */
    async updatePlayerStats(playerId, gameResult) {
        try {
            const player = await Player.findById(playerId);
            if (!player) {
                throw new AppError('Player not found', 404);
            }

            await player.updateStats(gameResult);

            logger.logDatabaseOperation('update_stats', 'Player', playerId, gameResult);

            return player;
        } catch (error) {
            logger.error('Update player stats error:', error);
            throw error;
        }
    }

    /**
     * Add friend
     * @param {string} playerId - Player ID
     * @param {string} friendId - Friend ID
     * @returns {Object} Updated player
     */
    async addFriend(playerId, friendId) {
        try {
            const player = await Player.findById(playerId);
            if (!player) {
                throw new AppError('Player not found', 404);
            }

            const friend = await Player.findById(friendId);
            if (!friend) {
                throw new AppError('Friend not found', 404);
            }

            if (playerId === friendId) {
                throw new AppError('Cannot add yourself as a friend', 400);
            }

            await player.addFriend(friendId);

            logger.logDatabaseOperation('add_friend', 'Player', playerId, { friendId });

            return player;
        } catch (error) {
            logger.error('Add friend error:', error);
            throw error;
        }
    }

    /**
     * Remove friend
     * @param {string} playerId - Player ID
     * @param {string} friendId - Friend ID
     * @returns {Object} Updated player
     */
    async removeFriend(playerId, friendId) {
        try {
            const player = await Player.findById(playerId);
            if (!player) {
                throw new AppError('Player not found', 404);
            }

            await player.removeFriend(friendId);

            logger.logDatabaseOperation('remove_friend', 'Player', playerId, { friendId });

            return player;
        } catch (error) {
            logger.error('Remove friend error:', error);
            throw error;
        }
    }

    /**
     * Get player friends
     * @param {string} playerId - Player ID
     * @returns {Array} Player friends
     */
    async getPlayerFriends(playerId) {
        try {
            const player = await Player.findById(playerId)
                .populate('friends.playerId', 'username displayName avatar status lastSeen')
                .select('friends');

            if (!player) {
                throw new AppError('Player not found', 404);
            }

            return player.friends;
        } catch (error) {
            logger.error('Get player friends error:', error);
            throw error;
        }
    }

    /**
     * Delete player account
     * @param {string} playerId - Player ID
     * @param {string} password - Player password for confirmation
     * @returns {boolean} Success status
     */
    async deletePlayerAccount(playerId, password) {
        try {
            const player = await Player.findById(playerId);
            if (!player) {
                throw new AppError('Player not found', 404);
            }

            // Verify password
            const isPasswordValid = await player.comparePassword(password);
            if (!isPasswordValid) {
                throw new AppError('Password is incorrect', 400);
            }

            // Soft delete by setting isActive to false
            player.isActive = false;
            player.status = 'offline';
            await player.save();

            logger.logDatabaseOperation('delete_account', 'Player', playerId);

            return true;
        } catch (error) {
            logger.error('Delete player account error:', error);
            throw error;
        }
    }
}

module.exports = PlayerService; 