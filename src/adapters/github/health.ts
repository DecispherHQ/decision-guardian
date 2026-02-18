/**
 * GitHub-specific health check — validates GitHub token and API access.
 */
import * as github from '@actions/github';
import type { ILogger } from '../../core/interfaces/logger';

/**
 * Validate that the GitHub token has proper permissions.
 */
export async function validateToken(token: string, logger: ILogger): Promise<boolean> {
  try {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    await octokit.rest.repos.get({ owner, repo });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`GitHub token validation failed: ${message}`);
    return false;
  }
}
