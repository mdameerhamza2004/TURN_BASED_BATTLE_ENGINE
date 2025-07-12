const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const playerSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
        match: /^[a-zA-Z0-9_]+$/
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    displayName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    avatar: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'away', 'busy'],
        default: 'offline'
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    stats: {
        gamesPlayed: {
            type: Number,
            default: 0
        },
        gamesWon: {
            type: Number,
            default: 0
        },
        gamesLost: {
            type: Number,
            default: 0
        },
        totalScore: {
            type: Number,
            default: 0
        },
        averageScore: {
            type: Number,
            default: 0
        },
        winRate: {
            type: Number,
            default: 0
        }
    },
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'auto'
        },
        language: {
            type: String,
            default: 'en'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            },
            gameInvites: {
                type: Boolean,
                default: true
            },
            turnReminders: {
                type: Boolean,
                default: true
            }
        },
        privacy: {
            showOnlineStatus: {
                type: Boolean,
                default: true
            },
            showGameHistory: {
                type: Boolean,
                default: true
            },
            allowFriendRequests: {
                type: Boolean,
                default: true
            }
        }
    },
    friends: [{
        playerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player'
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'blocked'],
            default: 'pending'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    activeGames: [{
        gameId: {
            type: String,
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    achievements: [{
        id: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        unlockedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
playerSchema.index({ username: 1 });
playerSchema.index({ email: 1 });
playerSchema.index({ status: 1 });
playerSchema.index({ 'stats.gamesPlayed': -1 });
playerSchema.index({ 'stats.winRate': -1 });

// Virtual for win rate
playerSchema.virtual('winRatePercentage').get(function () {
    if (this.stats.gamesPlayed === 0) return 0;
    return Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100);
});

// Pre-save middleware to hash password
playerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to update stats
playerSchema.pre('save', function (next) {
    if (this.stats.gamesPlayed > 0) {
        this.stats.averageScore = Math.round(this.stats.totalScore / this.stats.gamesPlayed);
        this.stats.winRate = Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100);
    }
    next();
});

// Instance methods
playerSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

playerSchema.methods.generateAuthToken = function () {
    const payload = {
        id: this._id,
        username: this.username,
        email: this.email
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
    });
};

playerSchema.methods.generateRefreshToken = function () {
    const payload = {
        id: this._id,
        type: 'refresh'
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.refreshExpiresIn
    });
};

playerSchema.methods.updateLastSeen = function () {
    this.lastSeen = new Date();
    this.lastLogin = new Date();
    return this.save();
};

playerSchema.methods.updateStatus = function (status) {
    this.status = status;
    this.lastSeen = new Date();
    return this.save();
};

playerSchema.methods.addGame = function (gameId) {
    // Remove if already exists
    this.activeGames = this.activeGames.filter(game => game.gameId !== gameId);

    // Add new game
    this.activeGames.push({ gameId });
    return this.save();
};

playerSchema.methods.removeGame = function (gameId) {
    this.activeGames = this.activeGames.filter(game => game.gameId !== gameId);
    return this.save();
};

playerSchema.methods.updateStats = function (gameResult) {
    this.stats.gamesPlayed += 1;
    this.stats.totalScore += gameResult.score || 0;

    if (gameResult.won) {
        this.stats.gamesWon += 1;
    } else {
        this.stats.gamesLost += 1;
    }

    return this.save();
};

playerSchema.methods.addFriend = function (friendId) {
    const existingFriend = this.friends.find(friend =>
        friend.playerId.toString() === friendId.toString()
    );

    if (!existingFriend) {
        this.friends.push({ playerId: friendId });
    }

    return this.save();
};

playerSchema.methods.removeFriend = function (friendId) {
    this.friends = this.friends.filter(friend =>
        friend.playerId.toString() !== friendId.toString()
    );
    return this.save();
};

playerSchema.methods.unlockAchievement = function (achievement) {
    const existingAchievement = this.achievements.find(a => a.id === achievement.id);

    if (!existingAchievement) {
        this.achievements.push(achievement);
    }

    return this.save();
};

playerSchema.methods.isLocked = function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

playerSchema.methods.incLoginAttempts = function () {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account after 5 failed attempts
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
    }

    return this.updateOne(updates);
};

playerSchema.methods.resetLoginAttempts = function () {
    return this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 }
    });
};

// Static methods
playerSchema.statics.findByUsername = function (username) {
    return this.findOne({ username: username.toLowerCase() });
};

playerSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() });
};

playerSchema.statics.findOnlinePlayers = function () {
    return this.find({ status: 'online' }).select('username displayName avatar status lastSeen');
};

playerSchema.statics.findTopPlayers = function (limit = 10) {
    return this.find({ isActive: true })
        .sort({ 'stats.winRate': -1, 'stats.gamesPlayed': -1 })
        .limit(limit)
        .select('username displayName avatar stats');
};

// JSON serialization
playerSchema.methods.toJSON = function () {
    const player = this.toObject();
    delete player.password;
    delete player.loginAttempts;
    delete player.lockUntil;
    return player;
};

// Public profile (for other players)
playerSchema.methods.toPublicJSON = function () {
    const player = this.toObject();
    delete player.password;
    delete player.email;
    delete player.loginAttempts;
    delete player.lockUntil;
    delete player.friends;
    delete player.activeGames;
    delete player.preferences;
    return player;
};

module.exports = mongoose.model('Player', playerSchema); 