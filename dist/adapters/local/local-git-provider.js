"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalGitProvider = void 0;
/**
 * LocalGitProvider — ISCMProvider for local git repositories.
 *
 * Uses `git diff` to get changed files and diffs.
 * Configuration passed via constructor (diff mode, base branch, working directory).
 */
const child_process_1 = require("child_process");
class LocalGitProvider {
    config;
    constructor(config) {
        // Validate baseBranch to prevent shell injection
        if (config.baseBranch && !this.isValidBranchName(config.baseBranch)) {
            throw new Error(`Invalid baseBranch: "${config.baseBranch}". ` +
                'Branch names must only contain alphanumeric characters, hyphens, underscores, slashes, and dots.');
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
    isValidBranchName(name) {
        // Only allow safe characters: alphanumeric, -, _, /, .
        // Reject shell metacharacters: ; & | $ ` \ " ' < > ( ) etc.
        return /^[a-zA-Z0-9\-_.\/]+$/.test(name) &&
            name.length > 0 &&
            name.length < 256; // Reasonable length limit
    }
    /**
     * Get list of changed file paths from git diff.
     */
    async getChangedFiles() {
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
    async getFileDiffs() {
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
    buildDiffArgs() {
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
    execGit(args) {
        try {
            return (0, child_process_1.execSync)(`git ${args}`, {
                cwd: this.config.cwd,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                maxBuffer: 10 * 1024 * 1024, // 10MB for large diffs
            }).trim();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Git command failed: git ${args}\n${message}`);
        }
    }
    /**
     * Parse git diff --numstat output into FileDiff objects (without patches).
     */
    parseNumstat(output) {
        if (!output)
            return [];
        const results = [];
        for (const line of output.split('\n')) {
            if (!line)
                continue;
            const parts = line.split('\t');
            if (parts.length < 3)
                continue;
            const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
            const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
            const filename = parts[2].replace(/\\/g, '/');
            results.push({
                filename,
                status: 'modified',
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
    parsePatchesByFile(output) {
        const patches = new Map();
        if (!output)
            return patches;
        // Split on file boundaries: "diff --git a/... b/..."
        const fileSections = output.split(/(?=^diff --git )/m);
        for (const section of fileSections) {
            if (!section.trim())
                continue;
            // Extract filename from "diff --git a/path b/path"
            const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
            if (!headerMatch)
                continue;
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
exports.LocalGitProvider = LocalGitProvider;
