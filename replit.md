# Vibe Code - AI-Powered App Building Platform

## Overview
Vibe Code is an AI-powered platform enabling users to build applications through natural language conversations with AI. It features secure file storage in AWS S3, real-time code execution and preview in E2B sandboxes, and interactive development with streaming AI responses. The platform aims to democratize app development by allowing users to describe their desired application and have the AI translate that into functional code and infrastructure.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
I like functional programming.
I prefer simple language.
Do not make changes to the folder Z.
Do not make changes to the file Y.

## System Architecture

### UI/UX Decisions
The platform uses a dark mode by default with aesthetics inspired by modern developer tools. It features a responsive design with Shadcn UI components, Tailwind CSS, Inter for UI typography, and JetBrains Mono for code. Layouts include sidebar navigation for desktop and bottom tab navigation for mobile, ensuring a consistent and mobile-friendly experience. Interactions are enhanced with subtle hover elevations and smooth transitions.

### Technical Implementations
- **Frontend**: React with TypeScript, TanStack Query for state management, Wouter for routing, and native Fetch API with Server-Sent Events (SSE) for streaming.
- **Backend**: Express with TypeScript, PostgreSQL database managed by Drizzle ORM.
- **AI Integration**: Anthropic Claude Sonnet 4.5 via Amazon Bedrock (Model ID: `anthropic.claude-sonnet-4-5-20250929-v1:0`) provides advanced reasoning and code generation capabilities, including an "Extended Thinking Mode" for complex tasks.
- **File Management**: AWS S3 for persistent storage, integrated with E2B sandboxes for real-time file syncing and code execution.
- **Code Execution**: E2B Code Interpreter SDK for isolated, real-time code execution and preview, supporting shell commands and various programming languages.
- **Authentication**: Firebase Authentication with Google Sign-in.
- **Streaming**: Implemented using SSE for real-time AI responses, tool execution feedback, and action tracking.
- **Database Schema**: Includes `users` (synced with Firebase), `projects` (with S3 prefix, E2B sandbox info, and `workflowCommand` for auto-starting servers), `files` (metadata), and `messages` (chat history with MCP tool data).

### Feature Specifications
- **Advanced AI Chat Agent**: Utilizes Anthropic Claude Sonnet 4.5 for streaming responses, live MCP tool execution feedback, and an "Extended Thinking Mode."
- **AI MCP Tools**:
    - `create_boilerplate`: Generates project structures (e.g., React+Vite).
    - `write_file`: Creates/updates files in S3 and E2B.
    - `edit_file`: Modifies existing files.
    - `delete_file`: Deletes files from S3, E2B, and database.
    - `list_files`: Lists project files from S3.
    - `read_file`: Reads file content from S3 or E2B.
    - `run_shell`: Executes shell commands, supporting long-running processes.
    - `run_code`: Runs Python/JavaScript in E2B interpreter.
    - `serper_web_search`: Proactive web search for documentation.
- **Simplified Chat Display**: Shows concise summaries of MCP tool actions.
- **Real-time Action Tracking**: Visual progress indicators for AI actions.
- **Automatic Workflow System**: Auto-saves and re-runs server start commands (`workflowCommand`) when sandboxes are recreated, ensuring application continuity.

## External Dependencies
- **Firebase**: For user authentication (Google Sign-in).
- **AWS S3**: For secure and persistent file storage.
- **Amazon Bedrock**: Provides access to Anthropic Claude Sonnet 4.5 for AI capabilities.
- **E2B Code Interpreter SDK**: For isolated code execution, shell command execution, and real-time application preview.
- **Serper API**: For proactive web search functionality.
- **PostgreSQL**: As the primary relational database.