# Multiplayer Turn-based Game Engine

A robust backend engine for creating multiplayer turn-based games with real-time synchronization, turn management, and game state handling.

## Features

- **Real-time Multiplayer**: WebSocket-based communication for instant game updates
- **Turn Management**: Sophisticated turn handling with timeouts and validation
- **Game State Management**: Centralized state management with conflict resolution
- **Player Management**: Player authentication, session handling, and reconnection
- **Game Types**: Extensible architecture supporting various game types
- **Scalable**: Built for horizontal scaling with room-based architecture
- **TypeScript**: Full TypeScript support with strict typing

## Architecture

```
src/
├── core/           # Core game engine logic
├── games/          # Game type implementations
├── network/        # WebSocket and HTTP handling
├── models/         # Data models and interfaces
├── services/       # Business logic services
├── utils/          # Utility functions
└── index.ts        # Main entry point
```

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Development**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### HTTP API
- `GET /api/health` - Health check
- `POST /api/games` - Create new game
- `GET /api/games/:id` - Get game status
- `POST /api/games/:id/join` - Join game
- `GET /api/games/:id/players` - Get players in game

### WebSocket Events
- `join_game` - Join a game room
- `leave_game` - Leave a game room
- `make_move` - Submit a game move
- `end_turn` - End current turn
- `game_state` - Receive game state updates

## Game Types

The engine supports multiple game types through a plugin architecture:

- **TicTacToe**: Classic 3x3 grid game
- **Chess**: Full chess implementation
- **Checkers**: Traditional checkers game
- **Custom**: Extend with your own game logic

## Configuration

Key configuration options in `.env`:

```env
PORT=3000
NODE_ENV=development
TURN_TIMEOUT=30000
MAX_PLAYERS_PER_GAME=4
LOG_LEVEL=info
```

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details 
