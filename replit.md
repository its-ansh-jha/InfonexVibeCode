# Vibe Code - AI-Powered App Building Platform

## Overview
Vibe Code is an AI-powered app building platform that allows users to create applications through natural language conversation with AI. The platform stores files in AWS S3, runs code in E2B sandboxes with real-time preview, and provides streaming AI responses for an interactive development experience.

## Features
- **Firebase Authentication**: Google sign-in for user management
- **Project Management**: Create and manage multiple app projects
- **AI Chat Agent**: Powered by OpenRouter's z-ai/glm-4.5-air:free model with streaming responses
- **AWS S3 Storage**: Secure file storage for all project files
- **E2B Sandbox Integration**: Real-time code execution and preview in isolated sandboxes
- **AI Tools**:
  - `write_file`: Create or update files (saved to S3 and E2B sandbox)
  - `edit_file`: Edit specific parts of existing files
  - `run_shell`: Execute shell commands in E2B sandbox
  - `run_code`: Run Python/JavaScript code in E2B code interpreter
  - `serper_web_search`: Search the web for information
- **Streaming Responses**: Real-time AI responses with live tool execution feedback
- **Simplified Chat Display**: Shows tool summaries (e.g., "Created index.html") instead of full code
- **Mobile-Friendly**: Responsive design with bottom tab navigation on mobile
- **Dark/Light Mode**: Theme toggle with localStorage persistence
- **PostgreSQL Database**: Persistent data storage

## Architecture

### Frontend (React + TypeScript)
- **Auth**: Firebase authentication with Google provider
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn UI with Tailwind CSS
- **Streaming**: Native fetch API with Server-Sent Events (SSE)
- **Theme**: Custom design tokens following developer tool aesthetics

### Backend (Express + TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenRouter API (GLM-4.5-air model) with streaming
- **File Storage**: AWS S3 for persistent file storage
- **Code Execution**: E2B Code Interpreter SDK
- **Web Search**: Serper API
- **Sandbox**: E2B SDK with real code execution and preview

### Database Schema
- `users`: Firebase user sync (id, email, displayName, photoURL)
- `projects`: User projects with S3 prefix and E2B sandbox info
- `files`: File metadata tracking (path, s3Key, size, mimeType)
- `messages`: Chat history with tool call metadata

## API Endpoints

### Authentication
- `POST /api/auth/sync`: Sync Firebase user with database

### Projects
- `GET /api/projects`: List user's projects
- `GET /api/projects/:id`: Get project details
- `POST /api/projects`: Create new project (auto-creates E2B sandbox)
- `DELETE /api/projects/:id`: Delete project and cleanup S3/E2B resources

### Files
- `GET /api/files/:projectId`: List project files
- `GET /api/files/:projectId/:fileId`: Get file content from S3
- `POST /api/files`: Create/update file (saves to S3 and E2B sandbox)
- `DELETE /api/files/:fileId`: Delete file from S3 and database

### E2B Sandbox
- `POST /api/sandbox/:projectId/execute`: Execute code in sandbox
- `POST /api/sandbox/:projectId/shell`: Run shell command
- `GET /api/sandbox/:projectId/url`: Get sandbox preview URL

### Messages
- `GET /api/messages/:projectId`: Get chat history
- `POST /api/messages/stream`: Send message and receive streaming AI response with tool execution

## Environment Variables
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `OPENROUTER_API_KEY`: OpenRouter API key
- `E2B_API_KEY`: E2B sandbox API key
- `SERPER_API_KEY`: Serper web search API key
- `AWS_ACCESS_KEY_ID`: AWS access key for S3
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3
- `AWS_REGION`: AWS region (e.g., us-east-1)
- `AWS_S3_BUCKET_NAME`: S3 bucket name for file storage
- `DATABASE_URL`: PostgreSQL connection string

## User Flow
1. **Sign In**: User signs in with Google via Firebase
2. **Create Project**: User creates a new app project (E2B sandbox auto-created)
3. **Chat with AI**: User describes the app they want to build
4. **AI Creates Files**: AI writes files that are automatically saved to S3 and E2B sandbox
5. **View Files**: User can browse all project files in the Files page
6. **Preview**: User sees live preview of the app running in E2B sandbox
7. **Iterate**: User continues chatting with AI to improve and expand the app

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
- **October 23, 2025**: Complete migration from GitHub to S3+E2B architecture
  - Removed GitHub integration entirely (Octokit, personal access tokens, repository connection)
  - Implemented AWS S3 file storage with proper encryption and security
  - Integrated real E2B Code Interpreter SDK for code execution and preview
  - Added streaming AI responses with Server-Sent Events (SSE)
  - Updated chat UI to show simplified tool summaries instead of full code
  - Created Files page to browse S3-stored files with metadata
  - Updated Preview page to show E2B sandbox iframe
  - Added real-time file syncing between S3 and E2B sandbox
  - Implemented proper Firebase authentication for streaming endpoints
  - All files now stored in S3 with pattern: `projects/{userId}/{timestamp}/{filePath}`
- **October 22, 2025**: Initial implementation with GitHub integration
  - Firebase authentication integrated
  - PostgreSQL database schema deployed
  - All frontend components created with exceptional visual quality
  - Backend API routes implemented with AI tool calling
