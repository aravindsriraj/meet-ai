# Meet AI - AI-Powered Video Meeting Application

## Overview

Meet AI is a full-stack, AI-powered video call application that enables users to create and manage video meetings with custom AI agents. The application features live AI participation during calls, automatic post-call processing (transcripts, summaries), and an intelligent Q&A interface for querying meeting content.

**Current Status**: MVP Complete - All core features implemented and tested.

Key capabilities:
- Create and configure custom AI agents with specific roles (e.g., language tutor, interview coach)
- Real-time video calls with AI agent participation via OpenAI Realtime API
- Automatic post-call transcript generation and AI-powered summarization
- Searchable transcripts with highlighted search terms
- Meeting recordings playback
- ChatGPT-like Q&A interface for asking questions about meeting content
- Mobile-responsive design with adaptive UI components

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18+ with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express.js 5 with TypeScript running on Node.js
- **API Pattern**: RESTful JSON API endpoints under `/api/`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all database table definitions and Zod validation schemas
- **Build System**: esbuild for server bundling, Vite for client bundling

### Data Models
The application uses these core entities:
- **Users**: Basic authentication with username/password
- **Agents**: Custom AI agents with name, description, instructions, and voice settings
- **Meetings**: Video call sessions with status lifecycle (upcoming → active → processing → completed/cancelled)
- **Transcripts**: Speaker-attributed text segments with timestamps
- **Summaries**: AI-generated topic summaries with timestamps
- **Conversations/Messages**: Q&A chat threads tied to meetings

### Real-time Voice Features (OpenAI Realtime API with WebRTC)
- **Continuous Voice Conversation**: WebRTC-based connection to OpenAI Realtime API for natural, hands-free conversation
- **Backend Endpoint**: `/api/realtime/session` - forwards SDP offer to OpenAI's `/v1/realtime/calls` with session config
- **Frontend Hook**: `useRealtimeAgent` - manages WebRTC peer connection, audio I/O, and data channel events
- **Voice Activity Detection**: Server-side VAD automatically detects when user starts/stops speaking
- **Live Transcription**: Real-time transcript display using `input_audio_transcription` events
- **Interruption Support**: Users can interrupt AI speech at any time
- **Text Input Fallback**: Optional text input for typing messages to the AI

#### WebRTC Connection Flow
1. Client creates RTCPeerConnection and gets local audio stream
2. Client creates data channel "oai-events" for Realtime API events
3. Client creates SDP offer and sends to `/api/realtime/session`
4. Server forwards offer + session config to OpenAI Realtime API
5. Server returns SDP answer to client
6. Client sets remote description, connection established
7. Audio flows bidirectionally via WebRTC tracks
8. Events (transcripts, response status) flow via data channel

### Development vs Production
- Development: Vite dev server with HMR, proxied through Express
- Production: Static file serving from `dist/public/`, server bundled to `dist/index.cjs`

## External Dependencies

### AI Services
- **OpenAI API**: Used for chat completions, speech-to-text, text-to-speech, and image generation
- Configured via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables
- Voice options: alloy, echo, fable, onyx, nova, shimmer

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations stored in `/migrations` directory
- Push schema changes with `npm run db:push`

### Key NPM Packages
- `drizzle-orm` / `drizzle-zod`: Database ORM and schema validation
- `@tanstack/react-query`: Server state management
- `zod`: Runtime type validation
- `express-session` / `connect-pg-simple`: Session management
- `p-limit` / `p-retry`: Batch processing utilities for rate-limited API calls

### Replit Integrations
Located in `server/replit_integrations/` and `client/replit_integrations/`:
- **Audio**: Voice recording, playback, and streaming utilities
- **Chat**: Conversation storage and chat routes
- **Image**: Image generation endpoints
- **Batch**: Rate-limited batch processing utilities