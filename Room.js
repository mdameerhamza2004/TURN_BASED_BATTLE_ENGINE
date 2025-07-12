const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200
    },
    gameType: {
        type: String,
        required: true,
        enum: ['chess', 'checkers', 'tic-tac-toe', 'custom']
    },
    status: {
        type: String,
        enum: ['open', 'full', 'in-game', 'closed'],
        default: 'open'
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        default: null
    },
    maxPlayers: {
        type: Number,
        required: true,
        min: 2,
        max: 8,
        default: 4
    },
    currentPlayers: {
        type: Number,
        default: 0
    },
    players: [{
        playerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player',
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        isHost: {
            type: Boolean,
            default: false
        },
        isSpectator: {
            type: Boolean,
            default: false
        }
    }],
    gameId: {
        type: String,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true
    },
    settings: {
        allowSpectators: {
            type: Boolean,
            default: true
        },
        autoStart: {
            type: Boolean,
            default: false
        },
        turnTimeLimit: {
            type: Number,
            default: 30000,
            min: 5000,
            max: 300000
        },
        gameTimeLimit: {
            type: Number,
            default: 300000,
            min: 60000,
            max: 3600000
        },
        rules: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    chat: {
        enabled: {
            type: Boolean,
            default: true
        },
        messages: [{
            playerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Player'
            },
            playerName: {
                type: String,
                required: true
            },
            message: {
                type: String,
                required: true,
                maxlength: 500
            },
            type: {
                type: String,
                enum: ['text', 'system', 'game'],
                default: 'text'
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }],
        maxMessages: {
            type: Number,
            default: 100
        }
    },
    tags: [{
        type: String,
        trim: true
    }],
    metadata: {
        version: {
            type: String,
            default: '1.0.0'
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard', 'expert']
        },
        estimatedDuration: {
            type: Number, // in minutes
            default: 10
        }
    }
}, {
    timestamps: true
});

// Indexes
roomSchema.index({ status: 1 });
roomSchema.index({ gameType: 1 });
roomSchema.index({ isPrivate: 1 });
roomSchema.index({ 'players.playerId': 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ name: 'text', description: 'text' });

// Virtual for is full
roomSchema.virtual('isFull').get(function () {
    return this.currentPlayers >= this.maxPlayers;
});

// Virtual for can join
roomSchema.virtual('canJoin').get(function () {
    return this.status === 'open' && !this.isFull;
});

// Pre-save middleware to update current players count
roomSchema.pre('save', function (next) {
    this.currentPlayers = this.players.length;

    // Update status based on player count and game state
    if (this.gameId) {
        this.status = 'in-game';
    } else if (this.currentPlayers >= this.maxPlayers) {
        this.status = 'full';
    } else {
        this.status = 'open';
    }

    next();
});

// Instance methods
roomSchema.methods.addPlayer = function (playerId, isSpectator = false) {
    const existingPlayer = this.players.find(p => p.playerId.toString() === playerId.toString());

    if (!existingPlayer) {
        this.players.push({
            playerId,
            joinedAt: new Date(),
            isHost: this.players.length === 0, // First player is host
            isSpectator
        });
    }

    return this.save();
};

roomSchema.methods.removePlayer = function (playerId) {
    this.players = this.players.filter(p => p.playerId.toString() !== playerId.toString());

    // If host left, assign new host
    if (this.players.length > 0 && !this.players.find(p => p.isHost)) {
        this.players[0].isHost = true;
    }

    return this.save();
};

roomSchema.methods.setHost = function (playerId) {
    // Remove current host
    this.players.forEach(p => p.isHost = false);

    // Set new host
    const player = this.players.find(p => p.playerId.toString() === playerId.toString());
    if (player) {
        player.isHost = true;
    }

    return this.save();
};

roomSchema.methods.addChatMessage = function (playerId, playerName, message, type = 'text') {
    if (!this.chat.enabled) {
        throw new Error('Chat is disabled in this room');
    }

    this.chat.messages.push({
        playerId,
        playerName,
        message,
        type,
        timestamp: new Date()
    });

    // Keep only the last maxMessages
    if (this.chat.messages.length > this.chat.maxMessages) {
        this.chat.messages = this.chat.messages.slice(-this.chat.maxMessages);
    }

    return this.save();
};

roomSchema.methods.addSystemMessage = function (message) {
    return this.addChatMessage(null, 'System', message, 'system');
};

roomSchema.methods.addGameMessage = function (playerId, playerName, message) {
    return this.addChatMessage(playerId, playerName, message, 'game');
};

roomSchema.methods.setGame = function (gameId) {
    this.gameId = gameId;
    this.status = 'in-game';
    return this.save();
};

roomSchema.methods.clearGame = function () {
    this.gameId = null;
    this.status = this.isFull ? 'full' : 'open';
    return this.save();
};

roomSchema.methods.getPlayerById = function (playerId) {
    return this.players.find(p => p.playerId.toString() === playerId.toString());
};

roomSchema.methods.isPlayerInRoom = function (playerId) {
    return this.players.some(p => p.playerId.toString() === playerId.toString());
};

roomSchema.methods.isPlayerHost = function (playerId) {
    const player = this.getPlayerById(playerId);
    return player ? player.isHost : false;
};

roomSchema.methods.getHost = function () {
    return this.players.find(p => p.isHost);
};

roomSchema.methods.getActivePlayers = function () {
    return this.players.filter(p => !p.isSpectator);
};

roomSchema.methods.getSpectators = function () {
    return this.players.filter(p => p.isSpectator);
};

roomSchema.methods.canStartGame = function () {
    const activePlayers = this.getActivePlayers();
    return activePlayers.length >= 2 && this.status === 'open';
};

// Static methods
roomSchema.statics.findOpenRooms = function (gameType = null) {
    const query = { status: 'open', isPrivate: false };
    if (gameType) query.gameType = gameType;

    return this.find(query)
        .populate('players.playerId', 'username displayName avatar')
        .populate('createdBy', 'username displayName')
        .sort({ createdAt: -1 });
};

roomSchema.statics.findByGameType = function (gameType) {
    return this.find({ gameType })
        .populate('players.playerId', 'username displayName avatar')
        .populate('createdBy', 'username displayName')
        .sort({ createdAt: -1 });
};

roomSchema.statics.findByPlayer = function (playerId) {
    return this.find({ 'players.playerId': playerId })
        .populate('players.playerId', 'username displayName avatar')
        .populate('createdBy', 'username displayName')
        .sort({ updatedAt: -1 });
};

roomSchema.statics.findPublicRooms = function () {
    return this.find({ isPrivate: false })
        .populate('players.playerId', 'username displayName avatar')
        .populate('createdBy', 'username displayName')
        .sort({ createdAt: -1 });
};

roomSchema.statics.findActiveGames = function () {
    return this.find({ status: 'in-game' })
        .populate('players.playerId', 'username displayName avatar')
        .populate('createdBy', 'username displayName')
        .sort({ updatedAt: -1 });
};

// JSON serialization
roomSchema.methods.toJSON = function () {
    const room = this.toObject();
    return room;
};

// Public room info (for room lists)
roomSchema.methods.toPublicJSON = function () {
    const room = this.toObject();
    delete room.password;
    delete room.chat.messages;
    delete room.settings.rules;
    return room;
};

module.exports = mongoose.model('Room', roomSchema); 