// GitHub API integration using Octokit
import { Octokit } from "@octokit/rest";

export async function createGitHubClient(token: string) {
  return new Octokit({ auth: token });
}

export async function listRepositories(token: string) {
  const octokit = await createGitHubClient(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });
  return data;
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });

  if ('content' in data) {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  throw new Error('File not found or is a directory');
}

export async function writeFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  const octokit = await createGitHubClient(token);

  try {
    // Try to get existing file to get its SHA
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ("sha" in existingFile) {
      // Update existing file
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        sha: existingFile.sha,
      });
    }
  } catch (error: any) {
    if (error.status === 404) {
      // Create new file
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
      });
    } else {
      throw error;
    }
  }
}

export async function listFiles(
  token: string,
  owner: string,
  repo: string,
  path: string = ''
): Promise<any[]> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}