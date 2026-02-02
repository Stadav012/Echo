# Survey AI Backend

This is the backend server for the Survey AI application, built with Bun and TypeScript.

## Features

- Fast HTTP server using Bun runtime
- RESTful API endpoints
- TypeScript for type safety
- Voice processing capabilities (coming soon)
- Survey management API

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed on your system

### Installation

```bash
# Install dependencies
bun install
```

### Running the Server

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Health Check
- **GET** `/health` - Check if the server is running

### Survey Endpoints
- **GET** `/api/survey` - Get all surveys
- **POST** `/api/survey` - Create a new survey

### Voice Processing
- **POST** `/api/voice` - Process voice input (coming soon)

## Project Structure

```
backend/
├── src/
│   ├── index.ts      # Main server file
│   ├── types.ts      # TypeScript type definitions
│   └── config.ts     # Configuration
├── package.json      # Dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `CORS_ORIGIN` - CORS origin (default: *)
- `NODE_ENV` - Environment (development/production)

This project was created using `bun init` in bun v1.3.8. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

