# Vibe Code - AI-Powered Coding Platform

## Overview
Vibe Code is an AI-powered coding platform that allows users to create, edit, and debug code through natural language conversation with AI. The platform integrates with GitHub repositories, provides live code preview via E2B sandboxes, and offers a beautiful, mobile-responsive interface.

## Features
- **Firebase Authentication**: Google sign-in for user management
- **Project Management**: Create and manage multiple coding projects
- **AI Chat Agent**: Powered by OpenRouter's z-ai/glm-4.5-air:free model
- **GitHub Integration**: Connect repositories using personal access tokens
- **Live Preview**: E2B sandbox integration for running code
- **AI Tools**:
  - `write_file`: Create or update files in GitHub repositories
  - `edit_file`: Edit specific parts of existing files
  - `serper_web_search`: Search the web for information
  - `configure_run_button`: Set the command to run applications
  - `run_app`: Execute configured run commands
- **Mobile-Friendly**: Responsive design with bottom tab navigation on mobile
- **Dark/Light Mode**: Theme toggle with localStorage persistence
- **PostgreSQL Database**: Persistent data storage

## Architecture

### Frontend (React + TypeScript)
- **Auth**: Firebase authentication with Google provider
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn UI with Tailwind CSS
- **Theme**: Custom design tokens following developer tool aesthetics

### Backend (Express + TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenRouter API (GLM-4.5-air model)
- **GitHub**: Octokit REST API
- **Web Search**: Serper API
- **Sandbox**: E2B SDK (mock implementation for development)

### Database Schema
- `users`: Firebase user sync (id, email, displayName, photoURL)
- `projects`: User projects with GitHub connection info
- `messages`: Chat history with tool call metadata

## API Endpoints

### Authentication
- `POST /api/auth/sync`: Sync Firebase user with database

### Projects
- `GET /api/projects`: List user's projects
- `GET /api/projects/:id`: Get project details
- `POST /api/projects`: Create new project
- `DELETE /api/projects/:id`: Delete project
- `POST /api/projects/:id/connect-github`: Connect GitHub repository
- `POST /api/projects/:id/disconnect-github`: Disconnect repository

### GitHub
- `GET /api/github/repos/:projectId`: List user's repositories

### Messages
- `GET /api/messages/:projectId`: Get chat history
- `POST /api/messages`: Send message and get AI response

### Sandbox
- `GET /api/sandbox/status/:projectId`: Get sandbox status
- `POST /api/sandbox/run`: Start sandbox with run command
- `POST /api/sandbox/stop`: Stop running sandbox

## Environment Variables
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON (for production auth)
- `OPENROUTER_API_KEY`: OpenRouter API key
- `E2B_API_KEY`: E2B sandbox API key
- `SERPER_API_KEY`: Serper web search API key
- `DATABASE_URL`: PostgreSQL connection string

## User Flow
1. **Sign In**: User signs in with Google via Firebase
2. **Create Project**: User creates a new project from dashboard
3. **Connect GitHub**: User provides GitHub personal access token and selects repository
4. **Chat with AI**: User asks AI to write, edit, or debug code
5. **AI Actions**: AI uses tools to modify files, search web, configure run commands
6. **Preview**: User runs the app in E2B sandbox and sees live preview
7. **Iterate**: User continues chatting with AI to improve the code

## Development
- Run `npm run dev` to start both frontend (Vite) and backend (Express)
- Database migrations: `npm run db:push`
- The app uses dark mode by default with modern developer tool styling

## Design System
- **Colors**: Deep blue-gray backgrounds, vibrant blue primary
- **Typography**: Inter for UI, JetBrains Mono for code
- **Components**: Shadcn UI primitives with custom theming
- **Layout**: Sidebar navigation on desktop, bottom tabs on mobile
- **Interactions**: Subtle hover elevations, smooth transitions

## Recent Changes
- Initial implementation complete
- Firebase authentication integrated
- PostgreSQL database schema deployed
- All frontend components created with exceptional visual quality
- Backend API routes implemented with AI tool calling
- GitHub integration via personal access tokens
- Mock E2B sandbox for development (ready for real E2B SDK)
