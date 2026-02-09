import * as fs from 'fs/promises';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionConfig } from './types';

export async function validateHealth(config: ActionConfig): Promise<boolean> {
  try {
    await fs.access(config.decisionFile);

    const octokit = github.getOctokit(config.token);
    const { repo, owner } = github.context.repo;
    await octokit.rest.repos.get({ owner, repo });

    return true;
  } catch (error) {
    core.error(`Health check failed: ${error}`);
    return false;
  }
}
