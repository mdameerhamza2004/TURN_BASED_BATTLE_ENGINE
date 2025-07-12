const mongoose = require('mongoose');

const gameStateSchema = new mongoose.Schema({
    gameId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    gameType: {
        type: String,
        required: true,
        enum: ['chess', 'checkers', 'tic-tac-toe', 'custom']
    },
    config: {
        maxPlayers: {
            type: Number,
            required: true,
            min: 2,
            max: 8
        },
        minPlayers: {
            type: Number,
            required: true,
            min: 2,
            max: 8
        },
        turnTimeLimit: {
            type: Number,
            default: 30000, // 30 seconds
            min: 5000,
            max: 300000
        },
        gameTimeLimit: {
            type: Number,
            default: 300000, // 5 minutes
            min: 60000,
            max: 3600000
        },
        rules: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        isPrivate: {
            type: Boolean,
            default: false
        },
        allowSpectators: {
            type: Boolean,
            default: true
        },
        autoStart: {
            type: Boolean,
            default: false
        }
    },
    state: {
        status: {
            type: String,
            enum: ['waiting', 'active', 'paused', 'ended', 'cancelled'],
            default: 'waiting'
        },
        players: [{
            id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Player',
                required: true
            },
            name: {
                type: String,
                required: true
            },
            ready: {
                type: Boolean,
                default: false
            },
            connected: {
                type: Boolean,
                default: true
            },
            joinedAt: {
                type: Date,
                default: Date.now
            },
            lastActivity: {
                type: Date,
                default: Date.now
            },
            score: {
                type: Number,
                default: 0
            },
            position: {
                type: Number,
                default: 0
            },
            isSpectator: {
                type: Boolean,
                default: false
            }
        }],
        currentTurn: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player'
        },
        turnOrder: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player'
        }],
        currentRound: {
            type: Number,
            default: 1
        },
        totalRounds: {
            type: Number,
            default: 1
        },
        gameData: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        turnHistory: [{
            playerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Player'
            },
            action: {
                type: mongoose.Schema.Types.Mixed,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            round: {
                type: Number,
                required: true
            },
            turnNumber: {
                type: Number,
                required: true
            }
        }],
        events: [{
            type: {
                type: String,
                required: true
            },
            playerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Player'
            },
            data: {
                type: mongoose.Schema.Types.Mixed
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }],
        winner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Player'
        },
        endReason: {
            type: String,
            enum: ['victory', 'draw', 'timeout', 'forfeit', 'insufficient_players', 'cancelled']
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        startedAt: {
            type: Date
        },
        endedAt: {
            type: Date
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true
    },
    metadata: {
        version: {
            type: String,
            default: '1.0.0'
        },
        tags: [{
            type: String
        }],
        description: {
            type: String
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard', 'expert']
        },
        estimatedDuration: {
            type: Number, // in minutes
            default: 10
        }
    },
    analytics: {
        totalTurns: {
            type: Number,
            default: 0
        },
        averageTurnTime: {
            type: Number,
            default: 0
        },
        longestTurn: {
            type: Number,
            default: 0
        },
        shortestTurn: {
            type: Number,
            default: 0
        },
        playerActivity: [{
            playerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Player'
            },
            turnsTaken: {
                type: Number,
                default: 0
            },
            totalTime: {
                type: Number,
                default: 0
            },
            averageTime: {
                type: Number,
                default: 0
            },
            lastTurnAt: {
                type: Date
            }
        }]
    }
}, {
    timestamps: true
});

// Indexes
gameStateSchema.index({ 'state.status': 1 });
gameStateSchema.index({ 'state.players.id': 1 });
gameStateSchema.index({ 'state.currentTurn': 1 });
gameStateSchema.index({ createdAt: -1 });
gameStateSchema.index({ 'state.startedAt': -1 });
gameStateSchema.index({ 'state.endedAt': -1 });
gameStateSchema.index({ gameType: 1, 'state.status': 1 });

// Virtual for game duration
gameStateSchema.virtual('duration').get(function () {
    if (!this.state.startedAt) return 0;
    const endTime = this.state.endedAt || new Date();
    return Math.floor((endTime - this.state.startedAt) / 1000); // seconds
});

// Virtual for is active
gameStateSchema.virtual('isActive').get(function () {
    return this.state.status === 'active';
});

// Virtual for is waiting
gameStateSchema.virtual('isWaiting').get(function () {
    return this.state.status === 'waiting';
});

// Virtual for is ended
gameStateSchema.virtual('isEnded').get(function () {
    return this.state.status === 'ended';
});

// Pre-save middleware to update timestamps
gameStateSchema.pre('save', function (next) {
    this.state.updatedAt = new Date();
    next();
});

// Instance methods
gameStateSchema.methods.addPlayer = function (player) {
    const existingPlayer = this.state.players.find(p => p.id.toString() === player.id.toString());

    if (!existingPlayer) {
        this.state.players.push({
            id: player.id,
            name: player.name,
            ready: false,
            connected: true,
            joinedAt: new Date(),
            lastActivity: new Date()
        });
    }

    return this.save();
};

gameStateSchema.methods.removePlayer = function (playerId) {
    this.state.players = this.state.players.filter(p => p.id.toString() !== playerId.toString());
    return this.save();
};

gameStateSchema.methods.updatePlayerStatus = function (playerId, status) {
    const player = this.state.players.find(p => p.id.toString() === playerId.toString());
    if (player) {
        player.connected = status === 'connected';
        player.lastActivity = new Date();
    }
    return this.save();
};

gameStateSchema.methods.setPlayerReady = function (playerId, ready) {
    const player = this.state.players.find(p => p.id.toString() === playerId.toString());
    if (player) {
        player.ready = ready;
    }
    return this.save();
};

gameStateSchema.methods.addTurn = function (playerId, action, round, turnNumber) {
    this.state.turnHistory.push({
        playerId,
        action,
        timestamp: new Date(),
        round,
        turnNumber
    });

    this.analytics.totalTurns += 1;

    // Update player activity
    let playerActivity = this.analytics.playerActivity.find(p => p.playerId.toString() === playerId.toString());
    if (!playerActivity) {
        playerActivity = {
            playerId,
            turnsTaken: 0,
            totalTime: 0,
            averageTime: 0
        };
        this.analytics.playerActivity.push(playerActivity);
    }

    playerActivity.turnsTaken += 1;
    playerActivity.lastTurnAt = new Date();

    return this.save();
};

gameStateSchema.methods.addEvent = function (type, playerId = null, data = {}) {
    this.state.events.push({
        type,
        playerId,
        data,
        timestamp: new Date()
    });
    return this.save();
};

gameStateSchema.methods.startGame = function () {
    this.state.status = 'active';
    this.state.startedAt = new Date();
    this.state.currentRound = 1;

    // Generate turn order if not already set
    if (!this.state.turnOrder || this.state.turnOrder.length === 0) {
        this.state.turnOrder = this.state.players
            .filter(p => !p.isSpectator)
            .map(p => p.id);

        // Shuffle turn order
        for (let i = this.state.turnOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.state.turnOrder[i], this.state.turnOrder[j]] = [this.state.turnOrder[j], this.state.turnOrder[i]];
        }
    }

    this.state.currentTurn = this.state.turnOrder[0];

    return this.save();
};

gameStateSchema.methods.endGame = function (reason, winner = null) {
    this.state.status = 'ended';
    this.state.endedAt = new Date();
    this.state.endReason = reason;
    this.state.winner = winner;

    return this.save();
};

gameStateSchema.methods.nextTurn = function () {
    if (!this.state.currentTurn || this.state.turnOrder.length === 0) return;

    const currentIndex = this.state.turnOrder.findIndex(id => id.toString() === this.state.currentTurn.toString());
    const nextIndex = (currentIndex + 1) % this.state.turnOrder.length;

    this.state.currentTurn = this.state.turnOrder[nextIndex];

    // Check if we've completed a round
    if (nextIndex === 0) {
        this.state.currentRound += 1;
    }

    return this.save();
};

gameStateSchema.methods.getCurrentPlayer = function () {
    return this.state.players.find(p => p.id.toString() === this.state.currentTurn.toString());
};

gameStateSchema.methods.getPlayerById = function (playerId) {
    return this.state.players.find(p => p.id.toString() === playerId.toString());
};

gameStateSchema.methods.isPlayerTurn = function (playerId) {
    return this.state.currentTurn && this.state.currentTurn.toString() === playerId.toString();
};

gameStateSchema.methods.canStart = function () {
    const readyPlayers = this.state.players.filter(p => p.ready && !p.isSpectator);
    return readyPlayers.length >= this.config.minPlayers &&
        readyPlayers.length === this.state.players.filter(p => !p.isSpectator).length;
};

// Static methods
gameStateSchema.statics.findActiveGames = function () {
    return this.find({ 'state.status': 'active' }).populate('state.players.id', 'username displayName avatar');
};

gameStateSchema.statics.findWaitingGames = function () {
    return this.find({ 'state.status': 'waiting' }).populate('state.players.id', 'username displayName avatar');
};

gameStateSchema.statics.findByPlayer = function (playerId) {
    return this.find({ 'state.players.id': playerId }).populate('state.players.id', 'username displayName avatar');
};

gameStateSchema.statics.findByGameType = function (gameType) {
    return this.find({ gameType }).populate('state.players.id', 'username displayName avatar');
};

gameStateSchema.statics.findRecentGames = function (limit = 10) {
    return this.find({ 'state.status': 'ended' })
        .sort({ 'state.endedAt': -1 })
        .limit(limit)
        .populate('state.players.id', 'username displayName avatar')
        .populate('state.winner', 'username displayName');
};

// JSON serialization
gameStateSchema.methods.toJSON = function () {
    const gameState = this.toObject();
    return gameState;
};

// Public game state (for spectators)
gameStateSchema.methods.toPublicJSON = function () {
    const gameState = this.toObject();
    // Remove sensitive information
    delete gameState.config.rules;
    return gameState;
};

module.exports = mongoose.model('GameState', gameStateSchema); 