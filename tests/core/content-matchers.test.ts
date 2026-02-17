
import { ContentMatchers } from '../../src/core/content-matchers';
import { FileDiff } from '../../src/core/types';
import { createMockLogger } from '../helpers';
import parseDiff from 'parse-diff';

// Mock parse-diff module
jest.mock('parse-diff', () => {
    return jest.fn();
});

describe('ContentMatchers', () => {
    const logger = createMockLogger();
    let matchers: ContentMatchers;

    beforeEach(() => {
        jest.clearAllMocks();
        matchers = new ContentMatchers(logger);
    });

    it('should NOT fall back to naive parsing when parse-diff fails', () => {
        // Mock parse-diff to throw explicitly to simulate failure
        (parseDiff as unknown as jest.Mock).mockImplementation(() => {
            throw new Error('Simulated parse error');
        });

        // A patch that looks like it has an added line "+ secret" if parsed naively
        const patchTriggeringFallback = `
context line
+ secret
- old
        `.trim();

        const fileDiff: FileDiff = {
            filename: 'test.txt',
            patch: patchTriggeringFallback,
            additions: 1,
            deletions: 1,
            changes: 2,
            status: 'modified'
        };

        const rule = {
            type: 'string',
            patterns: ['secret']
        };

        // Act
        const result = matchers.matchString(rule as any, fileDiff);

        // Assert
        // CURRENT BEHAVIOR (naive fallback): The fallback code runs:
        // patch.split('\n').filter(line => line.startsWith('+')...) -> ["+ secret"] -> [" secret"]
        // So "secret" is found.
        // We expect result.matched to be TRIE if the bug exists.
        // Once fixed, it should be FALSE.

        // For reproduction, I expect true (confirm bug).
        // But for TDD, I usually expect false and verify it fails.
        // Let's assert expectation of the FIX.

        expect(result.matched).toBe(false);
    });

    it('should correctly use parse-diff for valid inputs', () => {
        // Mock valid return from parse-diff
        (parseDiff as unknown as jest.Mock).mockReturnValue([
            {
                chunks: [
                    {
                        changes: [
                            { type: 'add', content: '+match_this' },
                            { type: 'del', content: '-ignore_this' }
                        ]
                    }
                ]
            }
        ]);

        const fileDiff: FileDiff = {
            filename: 'test.txt',
            patch: 'doesn\'t matter since mocked',
            additions: 1,
            deletions: 1,
            changes: 2,
            status: 'modified'
        };

        const rule = {
            type: 'string',
            patterns: ['match_this']
        };

        const result = matchers.matchString(rule as any, fileDiff);

        expect(result.matched).toBe(true);
        expect(result.matchedPatterns).toContain('match_this');
    });

    describe('matchJsonPath (improved heuristic)', () => {
        const makeFileDiff = (): FileDiff => ({
            filename: 'config.json',
            patch: 'mocked',
            additions: 5,
            deletions: 0,
            changes: 5,
            status: 'modified',
        });

        it('should match when all keys in path appear in hierarchical line order', () => {
            // Simulate: line 1 has "config", line 3 has "server", line 5 has "port"
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'add', content: '+  "config": {', ln: 1 },
                                { type: 'add', content: '+    "server": {', ln: 3 },
                                { type: 'add', content: '+      "port": 8080', ln: 5 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['config.server.port'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            expect(result.matched).toBe(true);
            expect(result.matchedPatterns).toContain('config.server.port');
        });

        it('should NOT match when only the leaf key is present', () => {
            // Only "port" appears — "config" and "server" are missing
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'add', content: '+  "port": 3000', ln: 10 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['config.server.port'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            expect(result.matched).toBe(false);
            expect(result.matchedPatterns).toHaveLength(0);
        });

        it('should NOT match when keys appear in reverse line order', () => {
            // "port" at line 1, "server" at line 3, "config" at line 5 — wrong order
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'add', content: '+  "port": 8080', ln: 1 },
                                { type: 'add', content: '+  "server": {', ln: 3 },
                                { type: 'add', content: '+  "config": {', ln: 5 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['config.server.port'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            // "config" found at line 5, but then "server" must be >= 5.
            // "server" is at line 3 which is < 5, so it fails.
            expect(result.matched).toBe(false);
        });

        it('should match a single-key path when the key is present', () => {
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'add', content: '+  "version": "2.0.0"', ln: 1 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['version'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            expect(result.matched).toBe(true);
            expect(result.matchedPatterns).toContain('version');
        });
    });
});
