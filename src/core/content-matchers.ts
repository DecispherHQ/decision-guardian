/**
 * Content Matchers - Match content patterns within file diffs
 */
import parseDiff from 'parse-diff';
import safeRegex from 'safe-regex';
import vm from 'vm';
import { ContentRule } from './rule-types';
import { FileDiff } from './types';
import { logStructured } from './logger';
import type { ILogger } from './interfaces/logger';
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
    private readonly logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

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
            logStructured(this.logger, 'warning', `[Security] Unsafe regex pattern rejected`, {
                pattern: rule.pattern,
            });
            return { matched: false, matchedPatterns: [] };
        }

        const ALLOWED_FLAGS = /^[gimsuy]*$/;
        if (rule.flags && !ALLOWED_FLAGS.test(rule.flags)) {
            logStructured(this.logger, 'warning', `[Security] Invalid regex flags rejected`, {
                flags: rule.flags,
            });
            return { matched: false, matchedPatterns: [] };
        }

        const changedContent = this.getChangedLines(fileDiff.patch).join('\n');
        const MAX_CONTENT_SIZE = 1024 * 1024;

        if (changedContent.length > MAX_CONTENT_SIZE) {
            logStructured(this.logger, 'warning', `[Security] Content exceeds size limit`, {
                size: changedContent.length,
                limit: MAX_CONTENT_SIZE,
            });
            return { matched: false, matchedPatterns: [] };
        }

        if (rule.pattern && rule.pattern.length > 1000) {
            logStructured(this.logger, 'warning', `[Security] Regex pattern too complex`, {
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
            const errorMessage = String(error);
            logStructured(this.logger, 'warning', `Regex check failed for pattern`, {
                pattern: rule.pattern,
                error: errorMessage,
            });
            // Fail closed: treat error/timeout as a match (security risk)
            return {
                matched: true,
                matchedPatterns: [`Regex check failed: ${errorMessage}`]
            };
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

        vm.runInContext(code, context, {
            timeout: timeoutMs,
            displayErrors: false,
        });
        return Boolean(sandbox.result);
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
     */
    matchJsonPath(rule: ContentRule, fileDiff: FileDiff): { matched: boolean; matchedPatterns: string[] } {
        const changedLines = this.getChangedLines(fileDiff.patch).join('\n');
        const matchedPatterns: string[] = [];

        for (const path of rule.paths || []) {
            const key = path.split('.').pop() || path;
            // still heuristic but avoids matching random string occurrences
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const keyRegex = new RegExp(`"${escapedKey}"\\s*:`);

            if (keyRegex.test(changedLines)) {
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
            logStructured(this.logger, 'warning', `[Parsing] Failed to parse diff content`, {
                error: String(error),
            });
            return [];
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
            logStructured(this.logger, 'warning', `[Parsing] Failed to parse diff line numbers`, {
                error: String(error),
            });
            return [];
        }
    }
}


