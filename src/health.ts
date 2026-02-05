import * as fs from 'fs/promises';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionConfig } from './types';

export async function validateHealth(config: ActionConfig): Promise<boolean> {
  try {
    // Check decision file exists
    await fs.access(config.decisionFile);

    // Validate GitHub token using repo-level endpoint (works with GITHUB_TOKEN)
    const octokit = github.getOctokit(config.token);
    const { repo, owner } = github.context.repo;
    // Using repos.get to verify token validity - only requires repo permissions
    await octokit.rest.repos.get({ owner, repo });

    return true;
  } catch (error) {
    core.error(`Health check failed: ${error}`);
    return false;
  }
}
