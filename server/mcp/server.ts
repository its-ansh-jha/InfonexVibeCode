import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listFilesInS3, getFileFromS3 } from '../lib/s3';
import { readFileFromSandbox, executeShellCommand } from '../lib/e2b';

const server = new Server(
  {
    name: 'vibe-code-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_s3_files',
        description: 'List all files in S3 for a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'The project ID to list files for',
            },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'read_s3_file',
        description: 'Read the content of a file from S3',
        inputSchema: {
          type: 'object',
          properties: {
            s3Key: {
              type: 'string',
              description: 'The S3 key of the file to read',
            },
          },
          required: ['s3Key'],
        },
      },
      {
        name: 'list_e2b_files',
        description: 'List all files in E2B sandbox for a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'The project ID to list files for',
            },
            directory: {
              type: 'string',
              description: 'Directory to list (default: /home/user)',
              default: '/home/user',
            },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'read_e2b_file',
        description: 'Read the content of a file from E2B sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'The project ID',
            },
            filePath: {
              type: 'string',
              description: 'The file path to read',
            },
          },
          required: ['projectId', 'filePath'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'list_s3_files': {
      const { projectId } = request.params.arguments as { projectId: string };
      const files = await listFilesInS3(projectId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(files, null, 2),
          },
        ],
      };
    }

    case 'read_s3_file': {
      const { s3Key } = request.params.arguments as { s3Key: string };
      const content = await getFileFromS3(s3Key);
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    }

    case 'list_e2b_files': {
      const { projectId, directory = '/home/user' } = request.params.arguments as {
        projectId: string;
        directory?: string;
      };
      const result = await executeShellCommand(projectId, `find ${directory} -type f`);
      return {
        content: [
          {
            type: 'text',
            text: result.stdout,
          },
        ],
      };
    }

    case 'read_e2b_file': {
      const { projectId, filePath } = request.params.arguments as {
        projectId: string;
        filePath: string;
      };
      const content = await readFileFromSandbox(projectId, filePath);
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

runServer().catch(console.error);
