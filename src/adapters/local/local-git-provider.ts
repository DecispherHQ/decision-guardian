/**
 * LocalGitProvider — ISCMProvider for local git repositories.
 *
 * Uses `git diff` to get changed files and diffs.
 * Configuration passed via constructor (diff mode, base branch, working directory).
 */
import { execSync } from 'child_process';
import type { ISCMProvider } from '../../core/interfaces/scm-provider';
import type { FileDiff } from '../../core/types';

export interface LocalGitConfig {
    /** Diff mode: what changes to compare */
    mode: 'staged' | 'branch' | 'all';
    /** Base branch for 'branch' mode comparison (default: 'main') */
    baseBranch?: string;
    /** Working directory (default: process.cwd()) */
    cwd?: string;
}

export class LocalGitProvider implements ISCMProvider {
    private readonly config: Required<LocalGitConfig>;

    constructor(config: LocalGitConfig) {
        // Validate baseBranch to prevent shell injection
        if (config.baseBranch && !this.isValidBranchName(config.baseBranch)) {
            throw new Error(
                `Invalid baseBranch: "${config.baseBranch}". ` +
                'Branch names must only contain alphanumeric characters, hyphens, underscores, slashes, and dots.'
            );
        }

        this.config = {
            mode: config.mode,
            baseBranch: config.baseBranch || 'main',
            cwd: config.cwd || process.cwd(),
        };
    }

    /**
     * Validate branch name to prevent shell injection.
     * Allows: letters, numbers, -, _, /, .
     * Git allows more, but we restrict to safe subset.
     */
    private isValidBranchName(name: string): boolean {
        // Only allow safe characters: alphanumeric, -, _, /, .
        // Reject shell metacharacters: ; & | $ ` \ " ' < > ( ) etc.
        return /^[a-zA-Z0-9\-_.\/]+$/.test(name) &&
            name.length > 0 &&
            name.length < 256;  // Reasonable length limit
    }

    /**
     * Get list of changed file paths from git diff.
     */
    async getChangedFiles(): Promise<string[]> {
        const diffArgs = this.buildDiffArgs();
        const output = this.execGit(`diff ${diffArgs} --name-only`);
        return output
            .split('\n')
            .map((f) => f.trim().replace(/\\/g, '/'))
            .filter(Boolean);
    }

    /**
     * Get file diffs with patch content for advanced rule matching.
     */
    async getFileDiffs(): Promise<FileDiff[]> {
        const diffArgs = this.buildDiffArgs();
        const output = this.execGit(`diff ${diffArgs} --numstat`);
        const patchOutput = this.execGit(`diff ${diffArgs} -U3`);

        const files = this.parseNumstat(output);
        const patches = this.parsePatchesByFile(patchOutput);

        return files.map((f) => ({
            ...f,
            patch: patches.get(f.filename) || '',
        }));
    }

    /**
     * Build git diff arguments based on configured mode.
     */
    private buildDiffArgs(): string {
        switch (this.config.mode) {
            case 'staged':
                return '--cached';
            case 'branch':
                return `${this.config.baseBranch}...HEAD`;
            case 'all':
                return 'HEAD';
            default:
                return '--cached';
        }
    }

    /**
     * Execute a git command and return stdout.
     */
    private execGit(args: string): string {
        try {
            return execSync(`git ${args}`, {
                cwd: this.config.cwd,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 10 * 1024 * 1024, // 10MB for large diffs
            }).trim();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Git command failed: git ${args}\n${message}`);
        }
    }

    /**
     * Parse git diff --numstat output into FileDiff objects (without patches).
     */
    private parseNumstat(output: string): Array<{ filename: string; status: FileDiff['status']; additions: number; deletions: number; changes: number }> {
        if (!output) return [];

        const results: Array<{ filename: string; status: FileDiff['status']; additions: number; deletions: number; changes: number }> = [];

        for (const line of output.split('\n')) {
            if (!line) continue;
            const parts = line.split('\t');
            if (parts.length < 3) continue;

            const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
            const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
            const filename = parts[2].replace(/\\/g, '/');

            results.push({
                filename,
                status: 'modified' as FileDiff['status'],
                additions,
                deletions,
                changes: additions + deletions,
            });
        }

        return results;
    }

    /**
     * Parse unified diff output and split by file.
     */
    private parsePatchesByFile(output: string): Map<string, string> {
        const patches = new Map<string, string>();
        if (!output) return patches;

        // Split on file boundaries: "diff --git a/... b/..."
        const fileSections = output.split(/(?=^diff --git )/m);

        for (const section of fileSections) {
            if (!section.trim()) continue;

            // Extract filename from "diff --git a/path b/path"
            const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
            if (!headerMatch) continue;

            const filename = headerMatch[2].replace(/\\/g, '/');

            // Extract just the hunk content (everything after the file headers)
            const hunkStart = section.indexOf('@@');
            if (hunkStart !== -1) {
                patches.set(filename, section.substring(hunkStart));
            }
        }

        return patches;
    }
}
