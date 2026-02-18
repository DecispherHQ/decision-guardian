/**
 * LocalGitProvider — ISCMProvider for local git repositories.
 *
 * Uses `git diff` to get changed files and diffs.
 * Configuration passed via constructor (diff mode, base branch, working directory).
 */
import { execFileSync } from 'child_process';
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
          'Branch names must only contain alphanumeric characters, hyphens, underscores, slashes, and dots.',
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
    // eslint-disable-next-line no-useless-escape
    return /^[a-zA-Z0-9\-_.\/]+$/.test(name) && name.length > 0 && name.length < 256; // Reasonable length limit
  }

  /**
   * Get list of changed file paths from git diff.
   * Uses NUL-terminated output to safely handle spaces/newlines/quotes.
   */
  async getChangedFiles(): Promise<string[]> {
    const diffArgs = this.buildDiffArgs();
    const args = ['diff', ...diffArgs, '--name-only', '-z'];
    const output = this.execGit(args);
    return output
      .split('\0')
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => this.normalizePath(f));
  }

  /**
   * Get file diffs with patch content for advanced rule matching.
   */
  async getFileDiffs(): Promise<FileDiff[]> {
    const diffArgs = this.buildDiffArgs();
    const numstatArgs = ['diff', ...diffArgs, '--numstat', '-z', '-M'];
    const patchArgs = ['diff', ...diffArgs, '-U3', '-M'];

    const numstatOutput = this.execGit(numstatArgs);
    const patchOutput = this.execGit(patchArgs);

    const files = this.parseNumstat(numstatOutput);
    const patches = this.parsePatchesByFile(patchOutput);

    return files.map((f) => ({
      ...f,
      patch: patches.get(f.filename) || '',
    }));
  }

  /**
   * Build git diff arguments based on configured mode.
   * Returns an array of args (safe for execFileSync).
   */
  private buildDiffArgs(): string[] {
    switch (this.config.mode) {
      case 'staged':
        return ['--cached'];
      case 'branch':
        return [`${this.config.baseBranch}...HEAD`];
      case 'all':
        return ['HEAD'];
      default:
        return ['--cached'];
    }
  }

  /**
   * Execute a git command using execFileSync (no shell).
   * Args is an array of git arguments (e.g. ['diff', '--name-only', '-z'])
   */
  private execGit(args: string[]): string {
    try {
      const out = execFileSync('git', args, {
        cwd: this.config.cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024, // 10MB for large diffs
      });
      // execFileSync with encoding returns string already
      return String(out).trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Git command failed: git ${args.join(' ')}\n${message}`);
    }
  }

  /**
   * Normalize path: unescape backslash escapes and use forward slashes.
   */
  private normalizePath(raw: string): string {
    // Git may escape characters with backslashes in some outputs; unescape common escapes
    // e.g. "a\\/b" or "file\\ name" -> remove the escaping backslash
    const unescaped = raw.replace(/\\(.)/g, '$1');
    return unescaped.replace(/\\/g, '/').trim();
  }

  /**
   * Parse git diff --numstat -z output into FileDiff objects (without patches).
   *
   * Behavior handled:
   *  - Normal: "<adds>\t<dels>\t<path>\0"
   *  - Rename-like: "<adds>\t<dels>\0<old_path>\0<new_path>\0"
   *
   * We iterate NUL-separated tokens and robustly handle both shapes.
   */
  private parseNumstat(output: string): Array<{
    filename: string;
    status: FileDiff['status'];
    additions: number;
    deletions: number;
    changes: number;
  }> {
    if (!output) return [];

    const parts = output.split('\0');
    const results: Array<{
      filename: string;
      status: FileDiff['status'];
      additions: number;
      deletions: number;
      changes: number;
    }> = [];

    let i = 0;
    while (i < parts.length) {
      const token = parts[i++];

      if (!token) continue;

      // token usually looks like "<adds>\t<dels>\t<path>" but for some rename cases it might be "<adds>\t<dels>"
      const tabParts = token.split('\t');

      const additionsRaw = tabParts[0] ?? '-';
      const deletionsRaw = tabParts[1] ?? '-';
      const additions = additionsRaw === '-' ? 0 : parseInt(additionsRaw, 10) || 0;
      const deletions = deletionsRaw === '-' ? 0 : parseInt(deletionsRaw, 10) || 0;

      // prefer filename inline if present
      if (tabParts.length >= 3) {
        const filenameRaw = tabParts.slice(2).join('\t');
        const filename = this.normalizePath(filenameRaw);
        const status =
          additions > 0 && deletions === 0
            ? 'added'
            : additions === 0 && deletions > 0
              ? 'removed'
              : 'modified';
        results.push({
          filename,
          status,
          additions,
          deletions,
          changes: additions + deletions,
        });
        continue;
      }

      // If we get here, the token did not include a filename -- filenames come in subsequent NUL-separated tokens.
      // Consume next NUL parts for old/new.
      const next1 = i < parts.length ? parts[i++] : '';
      // Peek to see if there's another token (rename case)
      const peek = i < parts.length ? parts[i] : undefined;
      let filename = '';
      let status: FileDiff['status'] = 'modified';

      if (peek !== undefined && peek !== '') {
        // Treat as rename: next1 = old, peek = new
        const next2 = parts[i++];
        filename = this.normalizePath(next2);
        status = 'renamed';
      } else {
        // Single following filename
        filename = this.normalizePath(next1 || '');
        status =
          additions > 0 && deletions === 0
            ? 'added'
            : additions === 0 && deletions > 0
              ? 'removed'
              : 'modified';
      }

      if (filename) {
        results.push({
          filename,
          status,
          additions,
          deletions,
          changes: additions + deletions,
        });
      }
    }

    return results;
  }

  /**
   * Parse unified diff output and split by file.
   * Tries to robustly extract the b/<path> filename from the diff header whether
   * paths are quoted or not, and unescapes where necessary.
   */
  private parsePatchesByFile(output: string): Map<string, string> {
    const patches = new Map<string, string>();
    if (!output) return patches;

    // Split by diff header (keep header with section)
    const sections = output.split(/(?=^diff --git )/m);

    for (const section of sections) {
      if (!section.trim()) continue;

      // Several header forms:
      // diff --git a/path b/path
      // diff --git "a/path with space" "b/path with space"
      // We capture both sides and prefer the b/ path
      let filename: string | undefined;

      // Try unquoted first
      const standardMatch = section.match(/^diff --git a\/(.+?) b\/(.+?)(?:\s|$)/m);
      if (standardMatch) {
        filename = standardMatch[2];
      } else {
        // Try quoted "a/..." "b/..."
        const quotedMatch = section.match(/^diff --git "(?:a\/(.+?))" "(?:b\/(.+?))"(?:\s|$)/m);
        if (quotedMatch) {
          filename = quotedMatch[2];
        } else {
          // As a last resort, try to parse rename/from/to lines
          const rnFrom = section.match(/^rename from (.+)$/m);
          const rnTo = section.match(/^rename to (.+)$/m);
          if (rnTo) filename = rnTo[1].trim();
          else if (rnFrom) filename = rnFrom[1].trim();
        }
      }

      if (!filename) continue;

      filename = this.normalizePath(filename);

      // Find first hunk start for patch contents
      const hunkStart = section.search(/^@@/m);
      if (hunkStart !== -1) {
        // include the hunk(s) only for patch (from first @@ onward)
        const patch = section.substring(hunkStart);
        patches.set(filename, patch);
      } else {
        // No hunks (maybe binary or mode-only changes); store whole section
        patches.set(filename, section);
      }
    }

    return patches;
  }
}
