# Meet AI

An AI-powered video conferencing platform where you can create custom AI agents that participate in real-time voice conversations during video calls.

## Introduction

Meet AI reimagines video meetings by introducing intelligent AI participants. Instead of talking to a static chatbot, you can have natural, flowing voice conversations with AI agents that you design and customize. Whether you need a language tutor, interview coach, sales trainer, or creative brainstorming partner, Meet AI brings your AI assistant to life with real-time voice interaction.

**Key Features:**
- Create custom AI agents with unique personalities, instructions, and voice styles
- Real-time voice conversations using OpenAI's Realtime API with WebRTC
- Automatic transcript generation after each call
- AI-powered meeting summaries organized by topics
- Ask AI feature to query your meeting content after calls
- AI-generated or custom uploaded agent avatars

## How It Works

### 1. Create Your AI Agent
Design a custom AI agent by defining:
- **Name & Description** - Give your agent an identity
- **Instructions** - Define how the agent should behave (e.g., "You are a French language tutor who helps beginners learn conversational French")
- **Voice** - Choose from multiple voice options (alloy, ash, ballad, coral, echo, sage, shimmer, verse)
- **Avatar** - Upload an image or generate one with AI

### 2. Start a Meeting
Create a new meeting and select which AI agent should join. When you're ready, join the call to begin your voice conversation.

### 3. Voice Conversation
During the meeting:
- Your microphone captures your voice and streams it to the AI
- The AI responds naturally in real-time using the selected voice
- The conversation flows like talking to a real person
- You can interrupt the AI at any time

### 4. Post-Call Processing
After you end the call, background jobs automatically:
- Generate a complete transcript with speaker attribution and timestamps
- Create an AI-powered summary organized by discussion topics
- Set up the Ask AI chat interface for that meeting

### 5. Review & Query
Access your completed meetings to:
- Read the full searchable transcript with highlighted search terms
- Review the topic-based summary
- Ask questions about the meeting content using the Ask AI chat

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** component library (Radix UI primitives)
- **TanStack Query** for server state management
- **Wouter** for client-side routing

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **Drizzle ORM** for database operations
- **PostgreSQL** database
- **Inngest** for background job orchestration

### AI & Real-time
- **OpenAI Realtime API** with WebRTC for voice conversations
- **OpenAI GPT-4** for summaries and Ask AI responses
- **OpenAI Whisper** for speech-to-text transcription
- **OpenAI Image Generation** for agent avatars

### External Services
- **Neon** (or any PostgreSQL provider) for database hosting
- **Inngest Cloud** for production background jobs

## Local Setup

### Prerequisites
- Node.js 18+ installed
- A PostgreSQL database (we recommend [Neon](https://neon.tech) for easy setup)
- OpenAI API key with access to Realtime API
- Inngest account (free tier available)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd meet-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://username:password@your-neon-host.neon.tech/dbname?sslmode=require

# OpenAI (for Realtime API voice calls)
OPENAI_API_KEY=sk-your-openai-api-key

# Inngest (for background jobs)
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# Session
SESSION_SECRET=your-random-session-secret
```

### 4. Set Up the Database

Push the database schema to your Neon database:

```bash
npm run db:push
```

### 5. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### 6. Run Inngest Dev Server (for background jobs)

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest dev server at `http://localhost:8288` for local background job processing.

## Project Structure

```
meet-ai/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── pages/         # Page components
├── server/                 # Backend Express application
│   ├── inngest/           # Background job definitions
│   ├── replit_integrations/ # Object storage integration
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # Database operations
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Drizzle ORM schema
└── migrations/            # Database migrations
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create a new agent |
| PATCH | `/api/agents/:id` | Update an agent |
| DELETE | `/api/agents/:id` | Delete an agent |
| GET | `/api/meetings` | List all meetings |
| POST | `/api/meetings` | Create a new meeting |
| POST | `/api/realtime/session` | Start WebRTC session with OpenAI |
| POST | `/api/generate-avatar` | Generate AI avatar for agent |
| POST | `/api/meetings/:id/ask` | Ask AI questions about meeting content |

## License

MIT
