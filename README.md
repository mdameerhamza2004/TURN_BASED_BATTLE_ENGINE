# Multiplayer Turn-based Game Engine

A robust backend engine for creating multiplayer turn-based games with real-time synchronization, game state management, and scalable architecture.

## Features

- **Real-time Multiplayer Support**: WebSocket-based communication for instant game updates
- **Turn Management**: Sophisticated turn handling with validation and timing controls
- **Game State Management**: Persistent game state with automatic recovery
- **Player Management**: Player authentication, session handling, and matchmaking
- **Game Room System**: Create, join, and manage game rooms
- **Scalable Architecture**: Microservices-based design for horizontal scaling
- **Database Integration**: MongoDB for game state persistence
- **API Documentation**: Comprehensive REST API with OpenAPI/Swagger
- **Testing Suite**: Unit and integration tests for all components

## Project Structure

```
├── src/
│   ├── core/           # Core game engine components
│   ├── models/         # Data models and schemas
│   ├── services/       # Business logic services
│   ├── controllers/    # API controllers
│   ├── middleware/     # Custom middleware
│   ├── utils/          # Utility functions
│   └── config/         # Configuration files
├── tests/              # Test suites
├── docs/               # API documentation
├── scripts/            # Build and deployment scripts
└── docker/             # Docker configuration
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB 5+
- Redis (for session management)
- Docker (optional)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Docker Setup

```bash
docker-compose up -d
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3000/api-docs`
- API Base URL: `http://localhost:3000/api/v1`

## Core Components

### Game Engine
- Turn-based game logic
- State management
- Player actions validation
- Game rules enforcement

### WebSocket Server
- Real-time communication
- Room management
- Player synchronization
- Event broadcasting

### Database Layer
- Game state persistence
- Player data management
- Session storage
- Analytics tracking

## License

MIT License - see LICENSE file for details 