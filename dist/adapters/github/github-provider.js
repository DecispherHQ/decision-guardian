"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubProvider = void 0;
/**
 * GitHubProvider — ISCMProvider for GitHub Actions context.
 *
 * Wraps the existing github-utils.ts logic behind the ISCMProvider interface.
 * All @actions/github usage is contained here.
 */
const github = __importStar(require("@actions/github"));
const metrics_1 = require("../../core/metrics");
const comment_1 = require("./comment");
const MAX_RETRIES = 3;
const MAX_WAIT_TIME_MS = 6 * 60 * 1000; // 6 minutes
class GitHubProvider {
    octokit;
    logger;
    token;
    owner;
    repo;
    pullNumber;
    commentManager;
    constructor(token, logger) {
        this.token = token;
        this.logger = logger;
        this.octokit = github.getOctokit(token);
        this.commentManager = new comment_1.CommentManager(token, logger);
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
    async getChangedFiles() {
        const files = [];
        let page = 1;
        const MAX_PAGES = 30;
        while (page <= MAX_PAGES) {
            const { data } = await this.executeWithRateLimit(() => this.octokit.rest.pulls.listFiles({
                owner: this.owner,
                repo: this.repo,
                pull_number: this.pullNumber,
                per_page: 100,
                page,
            }), `fetch files page ${page}`);
            files.push(...data.map((f) => f.filename.replace(/\\/g, '/')));
            this.logger.debug(`Fetched page ${page}: ${data.length} files`);
            if (data.length < 100)
                break;
            page++;
        }
        if (page > MAX_PAGES) {
            this.logger.warning('PR has 3000+ files - only checking first 3000');
        }
        return files;
    }
    /**
     * Get file diffs with patch content for advanced rule matching.
     */
    async getFileDiffs() {
        const firstPage = await this.executeWithRateLimit(() => this.octokit.rest.pulls.listFiles({
            owner: this.owner,
            repo: this.repo,
            pull_number: this.pullNumber,
            per_page: 100,
            page: 1,
        }), 'fetch files page 1');
        if (firstPage.data.length < 100) {
            this.logger.debug(`Fetched all ${firstPage.data.length} file diffs in single request`);
            return firstPage.data.map((f) => ({
                filename: f.filename.replace(/\\/g, '/'),
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                changes: f.changes,
                patch: f.patch || '',
                previous_filename: f.previous_filename,
            }));
        }
        const fileMap = new Map();
        let page = 1;
        const MAX_PAGES = 30;
        while (page <= MAX_PAGES) {
            const { data } = page === 1
                ? firstPage
                : await this.executeWithRateLimit(() => this.octokit.rest.pulls.listFiles({
                    owner: this.owner,
                    repo: this.repo,
                    pull_number: this.pullNumber,
                    per_page: 100,
                    page,
                }), `fetch diffs page ${page}`);
            if (data.length === 0)
                break;
            for (const file of data) {
                const normalized = file.filename.replace(/\\/g, '/');
                fileMap.set(normalized, {
                    filename: normalized,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    changes: file.changes,
                    patch: file.patch || '',
                    previous_filename: file.previous_filename,
                });
            }
            this.logger.debug(`Fetched page ${page}: ${data.length} file diffs`);
            if (data.length < 100)
                break;
            page++;
        }
        if (page > MAX_PAGES) {
            this.logger.warning('PR has 3000+ files - only checking first 3000');
        }
        return Array.from(fileMap.values());
    }
    /**
     * Stream file diffs for very large PRs.
     */
    async *streamFileDiffs() {
        let page = 1;
        const MAX_PAGES = 30;
        while (page <= MAX_PAGES) {
            const { data } = await this.executeWithRateLimit(() => this.octokit.rest.pulls.listFiles({
                owner: this.owner,
                repo: this.repo,
                pull_number: this.pullNumber,
                per_page: 100,
                page,
            }), `stream diffs page ${page}`);
            if (data.length === 0)
                break;
            yield data.map((f) => ({
                filename: f.filename.replace(/\\/g, '/'),
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                changes: f.changes,
                patch: f.patch || '',
                previous_filename: f.previous_filename,
            }));
            if (data.length < 100)
                break;
            page++;
        }
    }
    /**
     * Post decision alerts as PR comment.
     */
    async postComment(matches) {
        await this.commentManager.postAlert(matches, {
            owner: this.owner,
            repo: this.repo,
            number: this.pullNumber,
        });
    }
    /**
     * Execute with rate limit handling (Circuit Breaker pattern).
     */
    async executeWithRateLimit(operation, description) {
        let lastError;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                metrics_1.metrics.incrementApiCall();
                return await operation();
            }
            catch (error) {
                const err = error;
                lastError = error instanceof Error ? error : new Error(String(error));
                const isRateLimit = (err.status === 403 && err.response?.headers['x-ratelimit-remaining'] === '0') ||
                    err.status === 429;
                if (!isRateLimit) {
                    metrics_1.metrics.incrementApiError();
                    throw error;
                }
                if (attempt >= MAX_RETRIES) {
                    metrics_1.metrics.incrementApiError();
                    throw error;
                }
                let waitMs = 60000;
                if (err.response?.headers['x-ratelimit-reset']) {
                    const resetTime = parseInt(err.response.headers['x-ratelimit-reset'], 10) * 1000;
                    waitMs = Math.max(resetTime - Date.now() + 1000, 1000);
                }
                else if (err.response?.headers['retry-after']) {
                    waitMs = parseInt(err.response.headers['retry-after'], 10) * 1000;
                }
                if (waitMs > MAX_WAIT_TIME_MS) {
                    this.logger.error(`Rate limit hit for ${description}. ` +
                        `Wait time (${Math.round(waitMs / 60000)}m) exceeds limit.`);
                    throw error;
                }
                metrics_1.metrics.incrementRateLimitHit();
                this.logger.warning(`Rate limit hit for ${description}. ` +
                    `Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/${MAX_RETRIES}`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
        throw lastError || new Error('Operation failed');
    }
}
exports.GitHubProvider = GitHubProvider;
