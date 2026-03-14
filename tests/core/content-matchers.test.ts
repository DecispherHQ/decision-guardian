
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

    describe('matchJsonPath', () => {
        const makeFileDiff = (): FileDiff => ({
            filename: 'config.json',
            patch: 'mocked',
            additions: 5,
            deletions: 0,
            changes: 5,
            status: 'modified',
        });

        it('should match when all keys in path appear in hierarchical line order (all added)', () => {
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
            // Only "port" appears — "config" and "server" are missing entirely
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

            // "config" is found at line 5, but then "server" must be >= 5.
            // "server" is at line 3, which is < 5, so it fails.
            expect(result.matched).toBe(false);
        });

        it('should match a single-key path when the key is present as an added line', () => {
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

        // ── BUG-003 regression tests ──────────────────────────────────────────────

        it('[BUG-003] should match "database.password" when only the leaf value is edited in-place', () => {
            // Scenario: "database": { is an unchanged context line.
            // Only the "password" line is added (old value deleted, new value added).
            // Before this fix, the parent "database" key was invisible to matchJsonPath,
            // causing the path to fail silently.
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                // context line — "database" key is unchanged
                                { type: 'normal', content: '  "database": {', ln2: 1 },
                                // deleted old value
                                { type: 'del', content: '-    "password": "old_password"', ln1: 2 },
                                // added new value — this is the only "add" line
                                { type: 'add', content: '+    "password": "new_password_123"', ln: 2 },
                                // context closing brace
                                { type: 'normal', content: '  }', ln2: 3 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['database.password'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            expect(result.matched).toBe(true);
            expect(result.matchedPatterns).toContain('database.password');
        });

        it('[BUG-003] should match a 3-level deep path when only the leaf is added', () => {
            // config.database.password — only password line is added; ancestors are context
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'normal', content: '  "config": {',    ln2: 1 },
                                { type: 'normal', content: '    "database": {', ln2: 2 },
                                { type: 'del',    content: '-      "password": "old"', ln1: 3 },
                                { type: 'add',    content: '+      "password": "new_secret"', ln: 3 },
                                { type: 'normal', content: '    }',            ln2: 4 },
                                { type: 'normal', content: '  }',              ln2: 5 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['config.database.password'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            expect(result.matched).toBe(true);
            expect(result.matchedPatterns).toContain('config.database.password');
        });

        it('[BUG-003] should NOT match when parent keys are context lines but the leaf is also only a context line (no actual change)', () => {
            // All lines are context — no real change happened under the path.
            // An unrelated line was added elsewhere so there IS at least one add line.
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'normal', content: '  "database": {',        ln2: 1 },
                                { type: 'normal', content: '    "password": "same"', ln2: 2 },
                                { type: 'normal', content: '  }',                    ln2: 3 },
                                // Unrelated added line — must NOT trigger a false match
                                { type: 'add',    content: '+  "version": "2"',      ln: 10 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['database.password'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            // "password" exists in the diff but only as a context (normal) line — leafIsAdded = false
            expect(result.matched).toBe(false);
            expect(result.matchedPatterns).toHaveLength(0);
        });

        // ── BUG-007 regression tests ──────────────────────────────────────────────

        it('[BUG-007] matchString: deleted lines are invisible by default (backward compat)', () => {
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'del', content: '-const api_key = "sk_live_supersecret123";' },
                                { type: 'add', content: '+const api_key = process.env.API_KEY;' },
                            ],
                        },
                    ],
                },
            ]);

            const fileDiff: FileDiff = {
                filename: 'src/old-secrets.ts',
                patch: 'mocked',
                additions: 1,
                deletions: 1,
                changes: 2,
                status: 'modified',
            };

            // Without match_deleted_lines — hardcoded secret on the deleted line must NOT match
            const rule = { mode: 'string', patterns: ['sk_live_supersecret123'] };
            const result = matchers.matchString(rule as any, fileDiff);
            expect(result.matched).toBe(false);
        });

        it('[BUG-007] matchString: deleted lines ARE visible with match_deleted_lines: true', () => {
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'del', content: '-const api_key = "sk_live_supersecret123";' },
                                { type: 'add', content: '+const api_key = process.env.API_KEY;' },
                            ],
                        },
                    ],
                },
            ]);

            const fileDiff: FileDiff = {
                filename: 'src/old-secrets.ts',
                patch: 'mocked',
                additions: 1,
                deletions: 1,
                changes: 2,
                status: 'modified',
            };

            const rule = { mode: 'string', patterns: ['sk_live_supersecret123'], match_deleted_lines: true };
            const result = matchers.matchString(rule as any, fileDiff);
            expect(result.matched).toBe(true);
            expect(result.matchedPatterns).toContain('sk_live_supersecret123');
        });

        it('[BUG-007] matchRegex: deleted lines ARE visible with match_deleted_lines: true', async () => {
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'del', content: '-const api_key = "sk_live_supersecret123";' },
                                { type: 'add', content: '+const api_key = process.env.API_KEY;' },
                            ],
                        },
                    ],
                },
            ]);

            const fileDiff: FileDiff = {
                filename: 'src/old-secrets.ts',
                patch: 'mocked',
                additions: 1,
                deletions: 1,
                changes: 2,
                status: 'modified',
            };

            const rule = { mode: 'regex', pattern: 'sk_live_[a-z0-9]+', match_deleted_lines: true };
            const result = await matchers.matchRegex(rule as any, fileDiff);
            expect(result.matched).toBe(true);
        });

        it('[BUG-007] matchRegex: deleted lines NOT matched by default (backward compat)', async () => {
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'del', content: '-const api_key = "sk_live_supersecret123";' },
                                { type: 'add', content: '+const api_key = process.env.API_KEY;' },
                            ],
                        },
                    ],
                },
            ]);

            const fileDiff: FileDiff = {
                filename: 'src/old-secrets.ts',
                patch: 'mocked',
                additions: 1,
                deletions: 1,
                changes: 2,
                status: 'modified',
            };

            const rule = { mode: 'regex', pattern: 'sk_live_[a-z0-9]+' };
            const result = await matchers.matchRegex(rule as any, fileDiff);
            expect(result.matched).toBe(false);
        });

        it('[BUG-003] should correctly handle multiple paths — match one but not the other', () => {
            // "database.password" value was edited (leaf is an add line).
            // "api.key" appears only as a context line — must NOT match.
            (parseDiff as unknown as jest.Mock).mockReturnValue([
                {
                    chunks: [
                        {
                            changes: [
                                { type: 'normal', content: '  "database": {',        ln2: 1 },
                                { type: 'del',    content: '-    "password": "old"', ln1: 2 },
                                { type: 'add',    content: '+    "password": "new"', ln:  2 },
                                { type: 'normal', content: '  }',                    ln2: 3 },
                                { type: 'normal', content: '  "api": {',             ln2: 4 },
                                { type: 'normal', content: '    "key": "unchanged"', ln2: 5 },
                                { type: 'normal', content: '  }',                    ln2: 6 },
                            ],
                        },
                    ],
                },
            ]);

            const rule = { type: 'json_path', paths: ['database.password', 'api.key'] };
            const result = matchers.matchJsonPath(rule as any, makeFileDiff());

            expect(result.matched).toBe(true);
            expect(result.matchedPatterns).toContain('database.password');
            expect(result.matchedPatterns).not.toContain('api.key');
        });
    });
});
