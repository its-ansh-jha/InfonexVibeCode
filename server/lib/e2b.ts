import CodeInterpreter from '@e2b/code-interpreter';

const E2B_API_KEY = process.env.E2B_API_KEY!;

export interface SandboxInfo {
  sandboxId: string;
  url: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

const activeSandboxes = new Map<string, CodeInterpreter>();

export async function createSandbox(projectId: string): Promise<SandboxInfo> {
  try {
    const sandbox = await CodeInterpreter.create({
      apiKey: E2B_API_KEY,
      metadata: {
        projectId,
        createdAt: new Date().toISOString(),
      }
    });

    activeSandboxes.set(projectId, sandbox);

    return {
      sandboxId: sandbox.sandboxID,
      url: `https://${sandbox.getHostname(3000)}`,
    };
  } catch (error: any) {
    throw new Error(`Failed to create E2B sandbox: ${error.message}`);
  }
}

export async function getSandbox(projectId: string): Promise<CodeInterpreter | null> {
  return activeSandboxes.get(projectId) || null;
}

export async function getOrCreateSandbox(projectId: string): Promise<CodeInterpreter> {
  let sandbox = activeSandboxes.get(projectId);
  
  if (!sandbox) {
    const sandboxInfo = await createSandbox(projectId);
    sandbox = activeSandboxes.get(projectId);
    
    if (!sandbox) {
      throw new Error('Failed to retrieve sandbox after creation');
    }
  }
  
  return sandbox;
}

export async function executeCode(
  projectId: string,
  code: string,
  language: 'python' | 'javascript' = 'python'
): Promise<ExecutionResult> {
  try {
    const sandbox = await getOrCreateSandbox(projectId);
    
    const execution = await sandbox.notebook.execCell(code);
    
    return {
      stdout: execution.logs.stdout.join('\n'),
      stderr: execution.logs.stderr.join('\n'),
      exitCode: execution.error ? 1 : 0,
      error: execution.error?.name,
    };
  } catch (error: any) {
    return {
      stdout: '',
      stderr: error.message,
      exitCode: 1,
      error: error.message,
    };
  }
}

export async function executeShellCommand(
  projectId: string,
  command: string
): Promise<ExecutionResult> {
  try {
    const sandbox = await getOrCreateSandbox(projectId);
    
    const process = await sandbox.process.start({
      cmd: command,
    });

    await process.wait();
    
    return {
      stdout: process.output.stdout,
      stderr: process.output.stderr,
      exitCode: process.output.exitCode,
    };
  } catch (error: any) {
    return {
      stdout: '',
      stderr: error.message,
      exitCode: 1,
      error: error.message,
    };
  }
}

export async function writeFileToSandbox(
  projectId: string,
  filePath: string,
  content: string
): Promise<void> {
  try {
    const sandbox = await getOrCreateSandbox(projectId);
    await sandbox.files.write(filePath, content);
  } catch (error: any) {
    throw new Error(`Failed to write file to sandbox: ${error.message}`);
  }
}

export async function readFileFromSandbox(
  projectId: string,
  filePath: string
): Promise<string> {
  try {
    const sandbox = await getOrCreateSandbox(projectId);
    const content = await sandbox.files.read(filePath);
    return content;
  } catch (error: any) {
    throw new Error(`Failed to read file from sandbox: ${error.message}`);
  }
}

export async function listFilesInSandbox(
  projectId: string,
  dirPath: string = '/'
): Promise<string[]> {
  try {
    const sandbox = await getOrCreateSandbox(projectId);
    const files = await sandbox.files.list(dirPath);
    return files.map((f: any) => f.name);
  } catch (error: any) {
    throw new Error(`Failed to list files in sandbox: ${error.message}`);
  }
}

export async function closeSandbox(projectId: string): Promise<void> {
  const sandbox = activeSandboxes.get(projectId);
  
  if (sandbox) {
    await sandbox.close();
    activeSandboxes.delete(projectId);
  }
}

export async function getSandboxUrl(projectId: string, port: number = 3000): Promise<string> {
  const sandbox = await getOrCreateSandbox(projectId);
  return `https://${sandbox.getHostname(port)}`;
}
