/**
 * GitHubProvider — ISCMProvider for GitHub Actions context.
 *
 * Wraps the existing github-utils.ts logic behind the ISCMProvider interface.
 * All @actions/github usage is contained here.
 */
import * as github from '@actions/github';
import type { ISCMProvider } from '../../core/interfaces/scm-provider';
import type { ILogger } from '../../core/interfaces/logger';
import type { FileDiff, DecisionMatch } from '../../core/types';
import { metrics } from '../../core/metrics';
import { CommentManager } from './comment';

const MAX_RETRIES = 3;
const MAX_WAIT_TIME_MS = 6 * 60 * 1000; // 6 minutes

export class GitHubProvider implements ISCMProvider {
    private readonly octokit: ReturnType<typeof github.getOctokit>;
    private readonly logger: ILogger;
    private readonly token: string;
    private readonly owner: string;
    private readonly repo: string;
    private readonly pullNumber: number;
    private commentManager: CommentManager;

    constructor(token: string, logger: ILogger) {
        this.token = token;
        this.logger = logger;
        this.octokit = github.getOctokit(token);
        this.commentManager = new CommentManager(token, logger);

        const context = github.context;
        if (!context.payload.pull_request) {
            throw new Error('This action only works on pull_request events');
        }

        this.owner = context.repo.owner;
        this.repo = context.repo.repo;
        this.pullNumber = context.payload.pull_request.number;
    }

    /**
     * Get list of changed file paths in the PR.
     */
    async getChangedFiles(): Promise<string[]> {
        const files: string[] = [];
        let page = 1;
        const MAX_PAGES = 30;

        while (page <= MAX_PAGES) {
            const { data } = await this.executeWithRateLimit(
                () =>
                    this.octokit.rest.pulls.listFiles({
                        owner: this.owner,
                        repo: this.repo,
                        pull_number: this.pullNumber,
                        per_page: 100,
                        page,
                    }),
                `fetch files page ${page}`,
            );

            files.push(...data.map((f) => f.filename.replace(/\\/g, '/')));
            this.logger.debug(`Fetched page ${page}: ${data.length} files`);

            if (data.length < 100) break;
            page++;
        }

        if (page > MAX_PAGES) {
            throw new Error('PR too large for automatic verification');
        }

        return files;
    }

    /**
     * Get file diffs with patch content for advanced rule matching.
     */
    async getFileDiffs(): Promise<FileDiff[]> {
        const firstPage = await this.executeWithRateLimit(
            () =>
                this.octokit.rest.pulls.listFiles({
                    owner: this.owner,
                    repo: this.repo,
                    pull_number: this.pullNumber,
                    per_page: 100,
                    page: 1,
                }),
            'fetch files page 1',
        );

        if (firstPage.data.length < 100) {
            this.logger.debug(`Fetched all ${firstPage.data.length} file diffs in single request`);
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
                    : await this.executeWithRateLimit(
                        () =>
                            this.octokit.rest.pulls.listFiles({
                                owner: this.owner,
                                repo: this.repo,
                                pull_number: this.pullNumber,
                                per_page: 100,
                                page,
                            }),
                        `fetch diffs page ${page}`,
                    );

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

            this.logger.debug(`Fetched page ${page}: ${data.length} file diffs`);
            if (data.length < 100) break;
            page++;
        }

        if (page > MAX_PAGES) {
            throw new Error('PR too large for automatic verification');
        }

        return Array.from(fileMap.values());
    }

    /**
     * Stream file diffs for very large PRs.
     */
    async *streamFileDiffs(): AsyncGenerator<FileDiff[], void, unknown> {
        let page = 1;
        const MAX_PAGES = 30;

        while (page <= MAX_PAGES) {
            const { data } = await this.executeWithRateLimit(
                () =>
                    this.octokit.rest.pulls.listFiles({
                        owner: this.owner,
                        repo: this.repo,
                        pull_number: this.pullNumber,
                        per_page: 100,
                        page,
                    }),
                `stream diffs page ${page}`,
            );

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

        if (page > MAX_PAGES) {
            throw new Error('PR too large for automatic verification');
        }
    }

    /**
     * Post decision alerts as PR comment.
     */
    async postComment(matches: DecisionMatch[]): Promise<void> {
        await this.commentManager.postAlert(matches, {
            owner: this.owner,
            repo: this.repo,
            number: this.pullNumber,
        });
    }

    /**
     * Post "All Clear" status if previous alerts exist.
     */
    async postAllClear(): Promise<void> {
        await this.commentManager.postAllClear({
            owner: this.owner,
            repo: this.repo,
            number: this.pullNumber,
        });
    }

    /**
     * Execute with rate limit handling (Circuit Breaker pattern).
     */
    private async executeWithRateLimit<T>(
        operation: () => Promise<T>,
        description: string,
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                metrics.incrementApiCall();
                return await operation();
            } catch (error: unknown) {
                const err = error as { status?: number; response?: { headers: Record<string, string> } };
                lastError = error instanceof Error ? error : new Error(String(error));

                const isRateLimit =
                    (err.status === 403 && err.response?.headers['x-ratelimit-remaining'] === '0') ||
                    err.status === 429;

                if (!isRateLimit) {
                    metrics.incrementApiError();
                    throw error;
                }

                if (attempt >= MAX_RETRIES) {
                    metrics.incrementApiError();
                    throw error;
                }

                let waitMs = 60000;
                let calculated = false;

                if (err.response?.headers['x-ratelimit-reset']) {
                    const resetEpoch = parseInt(err.response.headers['x-ratelimit-reset'], 10);
                    if (!isNaN(resetEpoch)) {
                        waitMs = Math.max(resetEpoch * 1000 - Date.now() + 1000, 1000);
                        calculated = true;
                    }
                }

                if (!calculated && err.response?.headers['retry-after']) {
                    const retrySeconds = parseInt(err.response.headers['retry-after'], 10);
                    if (!isNaN(retrySeconds)) {
                        waitMs = retrySeconds * 1000;
                    }
                }

                if (waitMs > MAX_WAIT_TIME_MS) {
                    this.logger.error(
                        `Rate limit hit for ${description}. ` +
                        `Wait time (${Math.round(waitMs / 60000)}m) exceeds limit.`,
                    );
                    throw error;
                }

                metrics.incrementRateLimitHit();
                this.logger.warning(
                    `Rate limit hit for ${description}. ` +
                    `Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/${MAX_RETRIES}`,
                );

                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }

        throw lastError || new Error('Operation failed');
    }
}
