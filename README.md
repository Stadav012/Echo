# Echo - Survey AI Platform

A modern voice-powered survey application built with Next.js and Bun. Echo enables creating, conducting, and analyzing surveys with voice input capabilities powered by AI.

## 🚀 Features

- **Voice Surveys**: Conduct surveys using voice input for a natural and accessible experience
- **AI Analytics**: Intelligent insights from survey responses using AI
- **Real-time Processing**: Process and analyze responses instantly
- **Modern Stack**: Built with Next.js, TypeScript, and Bun for blazing-fast performance
- **Full-stack**: Complete frontend and backend solution

## 📁 Project Structure

```
Echo/
├── frontend/          # Next.js frontend application
│   ├── app/          # Next.js app directory
│   ├── public/       # Static assets
│   └── package.json  # Frontend dependencies
│
├── backend/          # Bun backend server
│   ├── src/          # Source files
│   │   ├── index.ts  # Main server file
│   │   ├── types.ts  # TypeScript definitions
│   │   └── config.ts # Configuration
│   └── package.json  # Backend dependencies
│
└── README.md         # This file
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework for production
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **React 19** - Latest React features

### Backend
- **Bun** - Fast all-in-one JavaScript runtime
- **TypeScript** - Type-safe backend
- **Native HTTP Server** - Built on Bun's native server

## 📦 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Bun](https://bun.sh) (v1.0 or higher)

### Installing Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"
```

## 🚦 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Stadav012/Echo.git
cd Echo
```

### 2. Set Up Backend

```bash
cd backend
bun install
bun run dev
```

The backend server will start at `http://localhost:3001`

### 3. Set Up Frontend

Open a new terminal:

```bash
cd frontend
bun install
bun run dev
```

The frontend will start at `http://localhost:3000`

## 🖥️ Development

### Backend Development

```bash
cd backend

# Install dependencies
bun install

# Run in development mode (with hot reload)
bun run dev

# Run in production mode
bun run start

# Build
bun run build
```

### Frontend Development

```bash
cd frontend

# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Run linter
bun run lint
```

## 🔌 API Endpoints

### Health Check
- `GET /health` - Check server status

### Survey Endpoints
- `GET /api/survey` - Get all surveys
- `POST /api/survey` - Create a new survey

### Voice Processing
- `POST /api/voice` - Process voice input (coming soon)

## 🌐 Environment Variables

### Backend
Create a `.env` file in the `backend` directory:

```env
PORT=3001
CORS_ORIGIN=*
NODE_ENV=development
```

### Frontend
Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 📝 Usage

1. Start both the backend and frontend servers
2. Open your browser to `http://localhost:3000`
3. Explore the Survey AI platform interface
4. Backend API is available at `http://localhost:3001`

## 🧪 Testing

```bash
# Backend
cd backend
bun test

# Frontend
cd frontend
bun test
```

## 🚢 Deployment

### Frontend (Vercel)
The frontend can be easily deployed to Vercel:

```bash
cd frontend
vercel deploy
```

### Backend
The backend can be deployed to any platform that supports Bun:
- [Bun Deploy](https://bun.sh/docs/deploy)
- Docker
- VPS with Bun installed

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Bun](https://bun.sh)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

Made with ❤️ for better surveys
