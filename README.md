# Meet AI

An AI-powered video meeting application where you can have real-time voice conversations with custom AI agents.

## Introduction

Meet AI lets you create personalized AI agents and have natural voice conversations with them in a video call interface. Each agent can be customized with specific instructions, personality, and voice.

**Features:**
- Create custom AI agents with unique instructions and voice
- Real-time voice conversations via OpenAI Realtime API (WebRTC)
- Live transcription during calls
- AI-generated meeting summaries after calls
- Ask AI chat to query meeting content
- AI-generated or uploaded agent avatars

## How It Works

### 1. Create an AI Agent
Define your agent with:
- **Name & Description** - Agent identity
- **Instructions** - Behavior and personality (e.g., "You are a French tutor")
- **Voice** - Choose from: alloy, ash, ballad, coral, echo, sage, shimmer, verse
- **Avatar** - Upload an image or generate one with AI

### 2. Start a Meeting
Create a meeting and select which agent to talk with.

### 3. Voice Conversation
During the call:
- Speak naturally - your voice streams to the AI via WebRTC
- The AI responds in real-time with the selected voice
- Live transcription shows the conversation as it happens
- Interrupt the AI anytime

### 4. Post-Call Processing
After ending the call, Inngest background jobs automatically:
- Save the transcript with speaker labels and timestamps
- Generate a topic-based summary using GPT-4o

### 5. Review Meeting
Access completed meetings to:
- Read the searchable transcript
- View the AI-generated summary
- Ask follow-up questions via the Ask AI chat

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui (Radix UI)
- TanStack Query
- Wouter (routing)

### Backend
- Node.js + Express.js
- TypeScript
- Drizzle ORM
- PostgreSQL

### AI & Real-time
- OpenAI Realtime API with WebRTC (voice conversations + live transcription)
- OpenAI GPT-4o (summaries, Ask AI responses)
- OpenAI gpt-image-1 (avatar generation)

### Background Jobs
- Inngest (event-driven job orchestration)

### Storage
- Replit Object Storage (agent avatars)

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database ([Neon](https://neon.tech) recommended)
- OpenAI API key (with Realtime API access)
- Inngest account (free tier)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd meet-ai
npm install
```

### 2. Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Inngest
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# Session
SESSION_SECRET=random-secret-string
```

### 3. Set Up Database

```bash
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

App runs at `http://localhost:5000`

### 5. Run Inngest Dev Server

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

Inngest dev UI at `http://localhost:8288`

## Project Structure

```
meet-ai/
├── client/src/
│   ├── components/     # UI components
│   ├── hooks/          # Custom hooks (useRealtimeAgent)
│   ├── pages/          # Page components
│   └── lib/            # Utilities
├── server/
│   ├── inngest/        # Background job definitions
│   ├── routes.ts       # API endpoints
│   └── storage.ts      # Database operations
├── shared/
│   └── schema.ts       # Drizzle schema + types
└── migrations/         # Database migrations
```

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/agents` | List/create agents |
| PATCH/DELETE | `/api/agents/:id` | Update/delete agent |
| GET/POST | `/api/meetings` | List/create meetings |
| GET | `/api/meetings/:id` | Get meeting with transcripts & summaries |
| POST | `/api/realtime/session` | Initialize WebRTC session with OpenAI |
| POST | `/api/generate-avatar` | Generate AI avatar for agent |
| POST | `/api/conversations/:id/messages` | Send message to Ask AI |

## License

MIT
