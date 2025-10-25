import { getFileFromS3 } from './s3';
import { storage } from '../storage';
import { readFileFromSandbox, writeFileToSandbox } from './e2b';

/**
 * Checks if vite.config.ts exists and ensures server.allowedHosts includes both 'all' and the sandbox preview URL
 * This ensures the preview URL works correctly for all domains
 */
export async function ensureViteConfigAllowedHosts(projectId: string, sandboxUrl?: string): Promise<void> {
  try {
    // Check if vite.config.ts exists in the database
    const viteConfigFile = await storage.getFileByPath(projectId, 'vite.config.ts');

    if (!viteConfigFile) {
      // File doesn't exist, nothing to do
      return;
    }

    // Get the file content from S3
    let content: string;
    try {
      content = await getFileFromS3(viteConfigFile.s3Key);
    } catch (error) {
      console.log(`vite.config.ts not found in S3 for project ${projectId}`);
      return;
    }

    // Build the allowedHosts array
    const allowedHosts = ['all', '.e2b.dev'];
    if (sandboxUrl) {
      try {
        const url = new URL(sandboxUrl);
        const hostname = url.hostname;
        if (!allowedHosts.includes(hostname)) {
          allowedHosts.push(hostname);
        }
      } catch (error) {
        console.error('Failed to parse sandbox URL:', error);
      }
    }

    const allowedHostsStr = JSON.stringify(allowedHosts);
    
    // Check if allowedHosts is already set correctly
    const hasCorrectAllowedHosts = content.includes(`allowedHosts: ${allowedHostsStr}`);

    if (hasCorrectAllowedHosts) {
      // Already configured correctly
      return;
    }

    // Need to update the configuration
    let updatedContent = content;

    // Check if server config exists
    if (content.includes('server:')) {
      // Server config exists, check if allowedHosts is present
      if (content.includes('allowedHosts:')) {
        // Replace existing allowedHosts value
        updatedContent = content.replace(
          /allowedHosts:\s*(?:true|false|['"][^'"]*['"]|\[.*?\])/,
          `allowedHosts: ${allowedHostsStr}`
        );
      } else {
        // Add allowedHosts to existing server config
        updatedContent = content.replace(
          /server:\s*{/,
          `server: {\n    allowedHosts: ${allowedHostsStr},`
        );
      }
    } else {
      // No server config exists, add it
      // Find the export default and add server config
      if (content.includes('export default defineConfig({')) {
        updatedContent = content.replace(
          /export default defineConfig\({/,
          `export default defineConfig({\n  server: {\n    host: '0.0.0.0',\n    port: 3000,\n    allowedHosts: ${allowedHostsStr}\n  },`
        );
      } else if (content.includes('export default {')) {
        updatedContent = content.replace(
          /export default {/,
          `export default {\n  server: {\n    host: '0.0.0.0',\n    port: 3000,\n    allowedHosts: ${allowedHostsStr}\n  },`
        );
      }
    }

    // Only update if content actually changed
    if (updatedContent !== content) {
      // Write back to sandbox
      await writeFileToSandbox(projectId, 'vite.config.ts', updatedContent);

      console.log(`Updated vite.config.ts allowedHosts for project ${projectId} with hosts: ${allowedHostsStr}`);
    }
  } catch (error) {
    console.error(`Error ensuring vite.config.ts allowedHosts for project ${projectId}:`, error);
    // Don't throw - this is a background check that shouldn't break the flow
  }
}

/**
 * Validates vite.config.ts when a file is created or updated
 * Call this after write_file operations for vite.config.ts
 */
export async function validateViteConfigOnWrite(projectId: string, path: string, content: string, sandboxUrl?: string): Promise<string> {
  if (path !== 'vite.config.ts') {
    return content;
  }

  // Build the allowedHosts array
  const allowedHosts = ['all', '.e2b.dev'];
  if (sandboxUrl) {
    try {
      const url = new URL(sandboxUrl);
      const hostname = url.hostname;
      if (!allowedHosts.includes(hostname)) {
        allowedHosts.push(hostname);
      }
    } catch (error) {
      console.error('Failed to parse sandbox URL:', error);
    }
  }

  const allowedHostsStr = JSON.stringify(allowedHosts);

  // Ensure the configuration has the correct allowedHosts setting
  let updatedContent = content;

  const hasCorrectAllowedHosts = content.includes(`allowedHosts: ${allowedHostsStr}`);

  if (!hasCorrectAllowedHosts) {
    // Apply the same fixes as ensureViteConfigAllowedHosts
    if (content.includes('server:')) {
      if (content.includes('allowedHosts:')) {
        updatedContent = content.replace(
          /allowedHosts:\s*(?:true|false|['"][^'"]*['"]|\[.*?\])/,
          `allowedHosts: ${allowedHostsStr}`
        );
      } else {
        updatedContent = content.replace(
          /server:\s*{/,
          `server: {\n    allowedHosts: ${allowedHostsStr},`
        );
      }
    } else {
      if (content.includes('export default defineConfig({')) {
        updatedContent = content.replace(
          /export default defineConfig\({/,
          `export default defineConfig({\n  server: {\n    host: '0.0.0.0',\n    port: 3000,\n    allowedHosts: ${allowedHostsStr}\n  },`
        );
      } else if (content.includes('export default {')) {
        updatedContent = content.replace(
          /export default {/,
          `export default {\n  server: {\n    host: '0.0.0.0',\n    port: 3000,\n    allowedHosts: ${allowedHostsStr}\n  },`
        );
      }
    }
  }

  return updatedContent;
}