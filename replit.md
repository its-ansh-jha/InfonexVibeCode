# Vibe Code - AI-Powered App Building Platform

## Overview
Vibe Code is an AI-powered app building platform that allows users to create applications through natural language conversation with AI. The platform stores files in AWS S3, runs code in E2B sandboxes with real-time preview, and provides streaming AI responses for an interactive development experience.

## Features
- **Firebase Authentication**: Google sign-in for user management
- **Project Management**: Create and manage multiple app projects
- **Advanced AI Chat Agent**: 
  - Powered by Anthropic's Claude Sonnet 4.5 via Amazon Bedrock
  - Streaming responses with live MCP tool execution feedback
  - Extended thinking mode for complex reasoning tasks
  - Real-time action tracking with visual progress indicators
- **AWS S3 Storage**: Secure file storage for all project files
- **E2B Sandbox Integration**: Real-time code execution and preview in isolated sandboxes
- **Advanced AI MCP Tools**:
  - `create_boilerplate`: Create complete boilerplate project structures (React+Vite with properly configured vite.config.ts)
  - `write_file`: Create or update files (saved to S3 and E2B sandbox)
  - `edit_file`: Edit specific parts of existing files
  - `delete_file`: Delete files from S3, E2B sandbox, and database with accurate status reporting
  - `list_files`: List all files in the current project (searches S3 storage)
  - `read_file`: Read the content of any file from S3 or E2B sandbox
  - `run_shell`: Execute shell commands with support for long-running processes (servers, npm run dev)
  - `run_code`: Run Python/JavaScript code in E2B code interpreter
  - `serper_web_search`: Proactive web search during operations for documentation and best practices
- **Streaming Responses**: Real-time AI responses with live MCP tool execution feedback
- **Simplified Chat Display**: Shows MCP tool summaries (e.g., "Created index.html") instead of full code
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
- **AI Integration**: 
  - Anthropic Claude Sonnet 4.5 via Amazon Bedrock
  - Model ID: anthropic.claude-sonnet-4-5-20250929-v1:0
  - Streaming responses via SSE with thinking blocks
  - Extended thinking mode for complex problem-solving
- **File Storage**: AWS S3 for persistent file storage
- **Code Execution**: E2B Code Interpreter SDK
- **Web Search**: Serper API with proactive integration
- **Sandbox**: E2B SDK with real code execution and preview

### Database Schema
- `users`: Firebase user sync (id, email, displayName, photoURL)
- `projects`: User projects with S3 prefix, E2B sandbox info, and workflow command
  - `workflowCommand`: Auto-saved server start command (e.g., "npm run dev") that runs when sandbox is recreated
- `files`: File metadata tracking (path, s3Key, size, mimeType)
- `messages`: Chat history with MCP tool call metadata and real-time action tracking

## API Endpoints

### Authentication
- `POST /api/auth/sync`: Sync Firebase user with database

### Projects
- `GET /api/projects`: List user's projects
- `GET /api/projects/:id`: Get project details
- `POST /api/projects`: Create new project (auto-creates E2B sandbox)
- `POST /api/projects/:id/boilerplate`: Create boilerplate templates (react-vite, node-express)
- `DELETE /api/projects/:id`: Delete project and cleanup S3/E2B resources

### Files
- `GET /api/files/:projectId`: List project files
- `GET /api/files/:projectId/:fileId`: Get file content from S3
- `POST /api/files`: Create/update file (saves to S3 and E2B sandbox)
- `DELETE /api/files/:fileId`: Delete file from S3, E2B sandbox, and database with comprehensive status reporting

### E2B Sandbox
- `POST /api/sandbox/:projectId/execute`: Execute code in sandbox
- `POST /api/sandbox/:projectId/shell`: Run shell command
- `GET /api/sandbox/:projectId/url`: Get sandbox preview URL

### Messages
- `GET /api/messages/:projectId`: Get chat history
- `POST /api/messages/stream`: Send message and receive streaming AI response with MCP tool execution

## Environment Variables
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `AWS_ACCESS_KEY_ID`: AWS access key for S3 and Bedrock
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3 and Bedrock
- `AWS_REGION`: AWS region (e.g., us-east-1)
- `AWS_S3_BUCKET_NAME`: S3 bucket name for file storage
- `E2B_API_KEY`: E2B sandbox API key
- `SERPER_API_KEY`: Serper web search API key
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
- **October 30, 2025** (Latest Session): Migration to Claude Sonnet 4.5 with Extended Thinking
  - **AI Model Migration**: Switched from Google Gemini to Anthropic Claude Sonnet 4.5 via Amazon Bedrock
    - Model: `anthropic.claude-sonnet-4-5-20250929-v1:0`
    - Superior coding performance with 77.2% accuracy on SWE-bench Verified
    - Enhanced agentic capabilities and tool handling
    - 1M token context window for large codebases
  - **Extended Thinking Mode**: New reasoning capability for complex tasks
    - Toggle button in chat interface to enable/disable reasoning mode
    - AI shows its step-by-step thinking process in real-time
    - Streaming thinking blocks displayed separately from final response
    - Configurable thinking budget (default 4096 tokens) for balancing speed and depth
  - **Streaming Architecture**: Updated to handle Bedrock's streaming format
    - Handles both text and thinking content blocks
    - Real-time display of AI's reasoning process
    - Improved error handling and connection resilience
  - **UI Enhancements**: New Brain icon and toggle for reasoning mode
    - Extended Thinking card displays reasoning process during streaming
    - Visual distinction between thinking and response content
    - Mobile-responsive reasoning mode toggle
- **October 25, 2025** (Latest Session): Enhanced AI Capabilities & Command Tracking
  - **Boilerplate Creation MCP Tool**: AI can now create complete project structures with one command
    - `create_boilerplate` MCP tool for React+Vite projects with properly configured vite.config.ts
    - Includes all necessary files: package.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, TypeScript configs
    - Fixes the vite allowedHosts configuration issue automatically
  - **File Management MCP Tools**: AI can now browse and read existing files
    - `list_files` MCP tool to see all files in a project
    - `read_file` MCP tool to read any file content from S3 or E2B sandbox
    - AI is now fully aware of existing project structure before making changes
  - **Enhanced Command Execution UI**: Real-time loading states for all commands
    - Loading spinner (🔄) shows while commands are executing
    - Green checkmark (✓) appears when commands complete
    - Smart handling for long-running commands (npm run dev shows checkmark immediately)
    - Users can now see exactly when commands finish vs when they're still running
  - **MCP Server Integration**: Added Model Context Protocol server for potential future integrations
  
- **October 24, 2025**: Real-Time Action Tracking System
  - **Live Progress Indicators**: AI now shows real-time progress indicators as it works
  - **Action Streaming**: Actions like "Installing dependencies", "Configured Start application", etc. display in real-time
  - **Visual Feedback**: Each action shows with contextual icons (package, file, terminal, settings, etc.)
  - **Status Updates**: Actions transition from "in_progress" (spinner) to "completed" (check mark) automatically
  - **Database Integration**: All actions are stored in messages table for historical replay
  - **UI Components**: New ActionSteps component displays actions above chat messages
  - **System Prompt Updates**: AI instructed to emit [action:description] patterns before performing tasks

- **October 23, 2025**: Advanced AI Platform Enhancements
  - **Enhanced File Management**:
    - `delete_file` MCP tool now removes files from all three locations: S3, E2B sandbox, and database
    - Accurate status reporting with detailed error messages for each deletion step
    - Partial deletion handling with clear feedback when operations fail
  - **Advanced Shell Command Execution**:
    - Automatic detection of long-running server commands (npm run dev, python servers, etc.)
    - Background execution for servers without blocking AI responses
    - Command results automatically forwarded back to AI for context
    - Workflow command auto-save for sandbox recreation
  - **Proactive Web Search Integration**:
    - System prompt updated to emphasize using Serper during operations (not after)
    - AI can search for documentation, libraries, and best practices while building
    - More accurate and capable AI responses with real-time information access
    
- **October 23, 2025** (Earlier): Critical fixes and workflow automation
  - **Chat Scrolling Fixed**: Removed fixed positioning on input area that was preventing message scrolling
  - **AI Streaming Improvements**:
    - Server commands (npm run dev, python servers) now run in background without blocking AI stream
    - AI responses complete immediately after starting long-running commands
    - MCP tool summaries show "Created index.html" and "Started: npm run dev" format (concise, no full code)
  - **Automatic Workflow System**:
    - Added `workflowCommand` field to projects schema
    - When AI starts a server (npm run dev, python app.py, etc.), command is auto-saved to project
    - When sandbox expires and is recreated:
      1. All files sync from S3 to new sandbox
      2. Saved workflow command runs automatically in background
      3. Website/app comes back online immediately without user intervention
  - **System Prompt Enhancements**:
    - AI now creates all websites and apps in ENGLISH language by default
    - Clearer guidance on server command behavior and tool execution
    - Better explanations for background command execution

- **October 23, 2025** (Earlier): Major mobile UX and UI enhancements
  - **Chat Page Improvements**:
    - Added intelligent code block parsing with syntax detection
    - Implemented copy-to-clipboard functionality for code snippets
    - Enhanced mobile responsiveness with proper spacing for all screen sizes (xs, sm, md, lg)
    - Improved touch targets for better mobile interaction
    - Added gradient avatars and smooth animations
    - Auto-resizing textarea for message composition
  - **Files Page Improvements**:
    - Added real-time file search/filter functionality
    - Responsive grid layouts optimized for mobile devices
    - Enhanced file list display with better touch targets
    - Improved empty states and loading indicators
    - Better mobile typography and spacing
  - **Preview Page Improvements**:
    - Added fullscreen/minimize toggle for desktop/tablet views
    - Responsive control bar with mobile-optimized buttons
    - Better sandbox status indicators (active/expired)
    - Improved mobile layout with touch-friendly controls
    - Added responsive iframe container sizing
  - **Projects Page Fixes**:
    - Fixed schema issue by removing non-existent githubRepoName field
    - Now displays sandboxId for better debugging visibility
    - Maintained responsive card grid layout
  - **Overall Mobile Enhancements**:
    - Consistent responsive breakpoints across all pages (sm, md, lg)
    - Better touch targets (minimum 44px height for interactive elements)
    - Improved typography scaling for mobile devices
    - Enhanced spacing and padding for mobile views
    - Smooth transitions and animations throughout the app
    
- **October 23, 2025** (Earlier): Complete migration from GitHub to S3+E2B architecture
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
