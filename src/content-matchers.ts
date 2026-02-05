/**
 * Content Matchers - Match content patterns within file diffs
 */
import parseDiff from 'parse-diff';
import safeRegex from 'safe-regex';
import vm from 'vm';
import { ContentRule } from './rule-types';
import { FileDiff } from './types';
import { logStructured } from './logger';
import * as crypto from 'crypto';

interface ParsedChange {
  type: 'add' | 'del' | 'normal';
  content: string;
  ln?: number; // Line number in new file (for additions)
  ln1?: number; // Line number in old file (for deletions)
  ln2?: number; // Line number in new file (for normal lines)
}

export class ContentMatchers {
  private resultCache = new Map<string, boolean>();
  private readonly MAX_CACHE_SIZE = 500;

  /**
   * Match string patterns in changed lines
   */
  matchString(rule: ContentRule, fileDiff: FileDiff): { matched: boolean; matchedPatterns: string[] } {

    const changedLines = this.getChangedLines(fileDiff.patch);
    const matchedPatterns: string[] = [];

    for (const pattern of rule.patterns || []) {
      if (changedLines.some((line) => line.includes(pattern))) {
        matchedPatterns.push(pattern);
      }
    }

    return {
      matched: matchedPatterns.length > 0,
      matchedPatterns,
    };
  }

  /**
   * Match regex pattern in changed content
   */
  async matchRegex(rule: ContentRule, fileDiff: FileDiff): Promise<{ matched: boolean; matchedPatterns: string[] }> {

    if (rule.pattern && !safeRegex(rule.pattern)) {
      logStructured('warning', `[Security] Unsafe regex pattern rejected`, {
        pattern: rule.pattern,
      });
      return { matched: false, matchedPatterns: [] };
    }

    const changedContent = this.getChangedLines(fileDiff.patch).join('\n');
    const MAX_CONTENT_SIZE = 1024 * 1024;

    if (changedContent.length > MAX_CONTENT_SIZE) {
      logStructured('warning', `[Security] Content exceeds size limit`, {
        size: changedContent.length,
        limit: MAX_CONTENT_SIZE,
      });
      return { matched: false, matchedPatterns: [] };
    }

    if (rule.pattern && rule.pattern.length > 1000) {
      logStructured('warning', `[Security] Regex pattern too complex`, {
        length: rule.pattern.length,
      });
      return { matched: false, matchedPatterns: [] };
    }

    const cacheKey = this.createCacheKey(rule.pattern!, rule.flags || '', changedContent);
    const cached = this.resultCache.get(cacheKey);

    if (cached !== undefined) {
      return {
        matched: cached,
        matchedPatterns: cached ? [rule.pattern!] : [],
      };
    }

    try {
      const matched = this.runRegexWithTimeout(rule.pattern!, rule.flags, changedContent, 5000);

      this.updateCache(cacheKey, matched);

      return {
        matched,
        matchedPatterns: matched ? [rule.pattern!] : [],
      };
    } catch (error) {
      logStructured('warning', `Regex check failed for pattern`, {
        pattern: rule.pattern,
        error: String(error),
      });
      return { matched: false, matchedPatterns: [] };
    }
  }

  /**
   * Run Regex in a VM sandbox with timeout
   */
  private runRegexWithTimeout(pattern: string, flags: string | undefined, text: string, timeoutMs: number): boolean {
    const sandbox = Object.create(null);
    sandbox.result = false;
    sandbox.text = String(text);
    sandbox.pattern = String(pattern);
    sandbox.flags = String(flags || '');

    const context = vm.createContext(sandbox, {
      name: 'RegexSandbox',
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    });

    const code = `
        'use strict';
        try {
            const regex = new RegExp(pattern, flags);
            result = regex.test(text);
        } catch (e) {
            result = false;
        }
        `;

    try {
      vm.runInContext(code, context, {
        timeout: timeoutMs,
        displayErrors: false,
      });
      return Boolean(sandbox.result);
    } catch (e) {
      return false;
    }
  }

  /**
   * Match if changes occur within specified line range
   */
  matchLineRange(rule: ContentRule, fileDiff: FileDiff): { matched: boolean; matchedPatterns: string[] } {
    const changedLineNumbers = this.extractChangedLineNumbers(fileDiff.patch);

    const matched = changedLineNumbers.some((lineNum) => lineNum >= rule.start! && lineNum <= rule.end!,);

    return {
      matched,
      matchedPatterns: matched ? [`lines ${rule.start}-${rule.end}`] : [],
    };
  }

  /**
   * Full file mode - any change to the file matches
   */
  matchFullFile(_fileDiff: FileDiff): { matched: boolean; matchedPatterns: string[] } {
    return {
      matched: true,
      matchedPatterns: ['full_file'],
    };
  }

  /**
   * JSON path mode - check if specific JSON keys changed
   * Phase 2 implementation
   */
  matchJsonPath(rule: ContentRule, fileDiff: FileDiff): { matched: boolean; matchedPatterns: string[] } {
    const changedLines = this.getChangedLines(fileDiff.patch).join('\n');
    const matchedPatterns: string[] = [];

    for (const path of rule.paths || []) {
      const key = path.split('.').pop() || path;
      if (changedLines.includes(key)) {
        matchedPatterns.push(path);
      }
    }

    return {
      matched: matchedPatterns.length > 0,
      matchedPatterns,
    };
  }

  private createCacheKey(pattern: string, flags: string, content: string): string {
    const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    return `${pattern}:${flags}:${contentHash}`;
  }

  private updateCache(key: string, value: boolean): void {
    if (this.resultCache.size >= this.MAX_CACHE_SIZE) {
      const toEvict = Math.floor(this.MAX_CACHE_SIZE * 0.1);
      const iterator = this.resultCache.keys();

      for (let i = 0; i < toEvict; i++) {
        const firstKey = iterator.next().value;
        if (firstKey) this.resultCache.delete(firstKey);
      }
    }
    this.resultCache.set(key, value);
  }

  /**
   * Extract changed (added) lines from diff using parse-diff
   */
  private getChangedLines(patch: string): string[] {
    if (!patch) return [];

    try {
      const fullDiff = `diff --git a/file b/file
--- a/file
+++ b/file
${patch}`;

      const parsed = parseDiff(fullDiff);
      const lines: string[] = [];

      for (const file of parsed) {
        for (const chunk of file.chunks) {
          for (const change of chunk.changes as ParsedChange[]) {
            if (change.type === 'add') {
              lines.push(change.content.substring(1));
            }
          }
        }
      }

      return lines;
    } catch (error) {
      return patch
        .split('\n')
        .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
        .map((line) => line.substring(1));
    }
  }

  /**
   * Extract line numbers of changed lines using parse-diff
   */
  private extractChangedLineNumbers(patch: string): number[] {
    if (!patch) return [];

    try {
      const fullDiff = `diff --git a/file b/file
--- a/file
+++ b/file
${patch}`;

      const parsed = parseDiff(fullDiff);
      const lineNumbers: number[] = [];

      for (const file of parsed) {
        for (const chunk of file.chunks) {
          for (const change of chunk.changes as ParsedChange[]) {
            if (change.type === 'add' && change.ln) {
              lineNumbers.push(change.ln);
            }
          }
        }
      }

      return lineNumbers;
    } catch (error) {
      return this.parseHunksManually(patch);
    }
  }

  /**
   * Fallback manual hunk parsing for line numbers
   */
  private parseHunksManually(patch: string): number[] {
    const lineNumbers: number[] = [];
    const lines = patch.split('\n');
    let currentLine = 0;

    for (const line of lines) {
      // Parse hunk headers: @@ -1,5 +1,6 @@
      const hunkMatch = line.match(/^@@ -\d+,?\d* \+(\d+),?(\d*) @@/);
      if (hunkMatch) {
        currentLine = parseInt(hunkMatch[1]);
        continue;
      }

      if (line.startsWith('+') && !line.startsWith('+++')) {
        lineNumbers.push(currentLine);
        currentLine++;
      } else if (!line.startsWith('-')) {
        currentLine++;
      }
    }

    return lineNumbers;
  }
}
