import * as github from '@actions/github';
import * as core from '@actions/core';
import { FileDiff } from './types';
import { metrics } from './metrics';

const MAX_RETRIES = 3;
const MAX_WAIT_TIME_MS = 6 * 60 * 1000; // 6 minutes max wait to avoid hanging CI

/**
 * Execute a function with rate limit handling (Circuit Breaker pattern)
 * Trips if:
 * 1. Wait time exceeds MAX_WAIT_TIME_MS (default 6 mins)
 * 2. Retry count exceeds MAX_RETRIES
 * 3. Error is not a rate limit error
 */
async function executeWithRateLimit<T>(operation: () => Promise<T>, description: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      metrics.incrementApiCall();
      return await operation();
    } catch (error: any) {
      lastError = error;

      const isRateLimit =
        (error.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') ||
        error.status === 429;

      if (!isRateLimit) {
        metrics.incrementApiError();
        throw error; // Non-rate-limit error, fail immediately
      }

      if (attempt >= MAX_RETRIES) {
        metrics.incrementApiError();
        throw error; // Max retries exhausted
      }

      let waitMs = 60000;
      if (error.response?.headers['x-ratelimit-reset']) {
        const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10) * 1000;
        waitMs = Math.max(resetTime - Date.now() + 1000, 1000);
      } else if (error.response?.headers['retry-after']) {
        waitMs = parseInt(error.response.headers['retry-after'], 10) * 1000;
      }

      if (waitMs > MAX_WAIT_TIME_MS) {
        core.setFailed(
          `Rate limit hit for ${description}. ` +
          `Wait time (${Math.round(waitMs / 60000)}m) exceeds limit.`,
        );
        throw error;
      }

      metrics.incrementRateLimitHit();
      core.warning(
        `Rate limit hit for ${description}. ` +
        `Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/${MAX_RETRIES}`,
      );

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError || new Error('Operation failed');
}

/**
 * Get list of changed files in the PR with full pagination support
 */
export async function getChangedFiles(token: string, contextArgs?: { owner: string; repo: string; pull_number: number }): Promise<string[]> {
  const octokit = github.getOctokit(token);

  let owner: string;
  let repo: string;
  let pull_number: number;

  if (contextArgs) {
    ({ owner, repo, pull_number } = contextArgs);
  } else {
    const context = github.context;
    if (!context.payload.pull_request) {
      throw new Error('This action only works on pull_request events');
    }
    owner = context.repo.owner;
    repo = context.repo.repo;
    pull_number = context.payload.pull_request.number;
  }

  const files: string[] = [];
  let page = 1;
  const MAX_PAGES = 30; // GitHub's max is 3000 files (100 * 30)

  try {
    while (page <= MAX_PAGES) {
      const { data } = await executeWithRateLimit(() => octokit.rest.pulls.listFiles({ owner, repo, pull_number, per_page: 100, page, }), `fetch files page ${page}`);

      files.push(...data.map((f) => f.filename.replace(/\\/g, '/')));

      core.debug(`Fetched page ${page}: ${data.length} files`);
      if (data.length < 100) {
        break;
      }

      page++;
    }

    if (page > MAX_PAGES) {
      core.warning('PR has 3000+ files - only checking first 3000');
    }

    return files;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch PR files: ${message}`);
  }
}

/**
 * Get file diffs with patch content for advanced rule matching
 */
export async function getFileDiffs(token: string, contextArgs?: { owner: string; repo: string; pull_number: number }): Promise<FileDiff[]> {
  const octokit = github.getOctokit(token);

  let owner: string;
  let repo: string;
  let pull_number: number;

  if (contextArgs) {
    ({ owner, repo, pull_number } = contextArgs);
  } else {
    const context = github.context;
    if (!context.payload.pull_request) {
      throw new Error('This action only works on pull_request events');
    }
    owner = context.repo.owner;
    repo = context.repo.repo;
    pull_number = context.payload.pull_request.number;
  }

  try {
    const firstPage = await executeWithRateLimit(() => octokit.rest.pulls.listFiles({ owner, repo, pull_number, per_page: 100, page: 1, }), 'fetch files page 1');

    if (firstPage.data.length < 100) {
      core.debug(`Fetched all ${firstPage.data.length} file diffs in single request`);
      return firstPage.data.map((f) => ({
        filename: f.filename.replace(/\\/g, '/'),
        status: f.status as FileDiff['status'],
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch || '',
        previous_filename: f.previous_filename,
      }));
    }

    const fileMap = new Map<string, FileDiff>();
    let page = 1;
    const MAX_PAGES = 30;

    while (page <= MAX_PAGES) {
      const { data } =
        page === 1
          ? firstPage
          : await executeWithRateLimit(() => octokit.rest.pulls.listFiles({ owner, repo, pull_number, per_page: 100, page, }), `fetch diffs page ${page}`);

      if (data.length === 0) break;

      for (const file of data) {
        const normalized = file.filename.replace(/\\/g, '/');

        fileMap.set(normalized, {
          filename: normalized,
          status: file.status as FileDiff['status'],
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch || '',
          previous_filename: file.previous_filename,
        });
      }

      core.debug(`Fetched page ${page}: ${data.length} file diffs`);
      if (data.length < 100) break;

      page++;
    }

    if (page > MAX_PAGES) {
      core.warning('PR has 3000+ files - only checking first 3000');
    }

    return Array.from(fileMap.values());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch PR file diffs: ${message}`);
  }
}

/**
 * Stream file diffs for very large PRs (3000+ files)
 */
export async function* streamFileDiffs(token: string, contextArgs?: { owner: string; repo: string; pull_number: number }): AsyncGenerator<FileDiff[], void, unknown> {
  const octokit = github.getOctokit(token);

  let owner: string;
  let repo: string;
  let pull_number: number;

  if (contextArgs) {
    ({ owner, repo, pull_number } = contextArgs);
  } else {
    const context = github.context;
    if (!context.payload.pull_request) {
      throw new Error('This action only works on pull_request events');
    }
    owner = context.repo.owner;
    repo = context.repo.repo;
    pull_number = context.payload.pull_request.number;
  }

  let page = 1;
  const MAX_PAGES = 30;

  while (page <= MAX_PAGES) {
    const { data } = await executeWithRateLimit(() => octokit.rest.pulls.listFiles({ owner, repo, pull_number, per_page: 100, page, }), `stream diffs page ${page}`);

    if (data.length === 0) break;

    yield data.map((f) => ({
      filename: f.filename.replace(/\\/g, '/'),
      status: f.status as FileDiff['status'],
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch || '',
      previous_filename: f.previous_filename,
    }));

    if (data.length < 100) break;
    page++;
  }
}
