/**
 * BUG-005 Regression Tests — RuleEvaluator content_match_mode AND/OR logic
 */
import { RuleEvaluator } from '../../src/core/rule-evaluator';
import { FileDiff } from '../../src/core/types';
import { createMockLogger } from '../helpers';

const logger = createMockLogger();

/** Build a minimal FileDiff where addedLine is the single new line in the diff. */
function makeFileDiff(filename: string, addedLine: string): FileDiff {
    return {
        filename,
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: `@@ -0,0 +1 @@\n+${addedLine}`,
    };
}

describe('BUG-005 Regression — content_match_mode AND/OR logic', () => {
    let evaluator: RuleEvaluator;

    beforeEach(() => {
        evaluator = new RuleEvaluator(logger);
    });

    describe('content_match_mode: "any" (default OR behaviour)', () => {
        it('fires when only ONE of two content rules matches', async () => {
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'router.post("/endpoint", handler);'),
            ];

            const rules = {
                type: 'file' as const,
                pattern: 'src/api/**/*.ts',
                // no content_match_mode — defaults to "any"
                content_rules: [
                    { mode: 'string' as const, patterns: ['router.post('] },
                    { mode: 'regex' as const, pattern: 'authMiddleware' },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            // OR: router.post( matched → overall: true
            expect(result.matched).toBe(true);
            expect(result.matchedFiles).toContain('src/api/routes.ts');
        });

        it('fires when BOTH content rules match', async () => {
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'router.post("/endpoint", authMiddleware, handler);'),
            ];

            const rules = {
                type: 'file' as const,
                pattern: 'src/api/**/*.ts',
                content_rules: [
                    { mode: 'string' as const, patterns: ['router.post('] },
                    { mode: 'regex' as const, pattern: 'authMiddleware' },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            expect(result.matched).toBe(true);
        });

        it('does NOT fire when NO content rule matches', async () => {
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'const x = 1;'),
            ];

            const rules = {
                type: 'file' as const,
                pattern: 'src/api/**/*.ts',
                content_rules: [
                    { mode: 'string' as const, patterns: ['router.post('] },
                    { mode: 'regex' as const, pattern: 'authMiddleware' },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            expect(result.matched).toBe(false);
        });
    });

    describe('content_match_mode: "all" (AND behaviour)', () => {
        it('does NOT fire when only ONE of two content rules matches', async () => {
            // Only router.post( is in the diff — authMiddleware is absent
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'router.post("/endpoint", handler);'),
            ];

            const rules = {
                type: 'file' as const,
                pattern: 'src/api/**/*.ts',
                content_match_mode: 'all' as const,
                content_rules: [
                    { mode: 'string' as const, patterns: ['router.post('] },
                    { mode: 'regex' as const, pattern: 'authMiddleware' },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            // AND: authMiddleware absent → must NOT fire
            expect(result.matched).toBe(false);
        });

        it('fires when ALL content rules match on the same file', async () => {
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'router.post("/endpoint", authMiddleware, handler);'),
            ];

            const rules = {
                type: 'file' as const,
                pattern: 'src/api/**/*.ts',
                content_match_mode: 'all' as const,
                content_rules: [
                    { mode: 'string' as const, patterns: ['router.post('] },
                    { mode: 'regex' as const, pattern: 'authMiddleware' },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            // AND: both present → fires
            expect(result.matched).toBe(true);
            expect(result.matchedFiles).toContain('src/api/routes.ts');
        });

        it('does NOT fire when neither content rule matches', async () => {
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'const x = 1;'),
            ];

            const rules = {
                type: 'file' as const,
                pattern: 'src/api/**/*.ts',
                content_match_mode: 'all' as const,
                content_rules: [
                    { mode: 'string' as const, patterns: ['router.post('] },
                    { mode: 'regex' as const, pattern: 'authMiddleware' },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            expect(result.matched).toBe(false);
        });

        it('fires for a file that matches all rules and ignores files that match only some', async () => {
            const fileDiffs = [
                // main.ts: has BOTH patterns
                makeFileDiff('src/api/main.ts', 'router.post("/main", authMiddleware, handler);'),
                // other.ts: has only router.post — authMiddleware absent
                makeFileDiff('src/api/other.ts', 'router.post("/other", handler);'),
            ];

            const rules = {
                type: 'file' as const,
                pattern: 'src/api/**/*.ts',
                content_match_mode: 'all' as const,
                content_rules: [
                    { mode: 'string' as const, patterns: ['router.post('] },
                    { mode: 'regex' as const, pattern: 'authMiddleware' },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            expect(result.matched).toBe(true);
            expect(result.matchedFiles).toContain('src/api/main.ts');
            expect(result.matchedFiles).not.toContain('src/api/other.ts');
        });
    });

    describe('content_match_mode: "all" within match_mode: "all" compound rule', () => {
        it('fires only when outer AND and inner AND are both satisfied', async () => {
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'router.post("/endpoint", authMiddleware, handler);'),
                makeFileDiff('src/api/middleware.ts', 'export function authMiddleware() {}'),
            ];

            const rules = {
                match_mode: 'all' as const,
                conditions: [
                    {
                        type: 'file' as const,
                        pattern: 'src/api/routes.ts',
                        content_match_mode: 'all' as const,
                        content_rules: [
                            { mode: 'string' as const, patterns: ['router.post('] },
                            { mode: 'regex' as const, pattern: 'authMiddleware' },
                        ],
                    },
                    {
                        type: 'file' as const,
                        pattern: 'src/api/middleware.ts',
                        content_match_mode: 'all' as const,
                        content_rules: [
                            { mode: 'string' as const, patterns: ['authMiddleware'] },
                        ],
                    },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            expect(result.matched).toBe(true);
        });

        it('does NOT fire when outer AND is met but inner AND on one condition fails', async () => {
            // routes.ts present but MISSING authMiddleware → inner AND fails
            const fileDiffs = [
                makeFileDiff('src/api/routes.ts', 'router.post("/endpoint", handler);'),
                makeFileDiff('src/api/middleware.ts', 'export function authMiddleware() {}'),
            ];

            const rules = {
                match_mode: 'all' as const,
                conditions: [
                    {
                        type: 'file' as const,
                        pattern: 'src/api/routes.ts',
                        content_match_mode: 'all' as const,
                        content_rules: [
                            { mode: 'string' as const, patterns: ['router.post('] },
                            { mode: 'regex' as const, pattern: 'authMiddleware' },
                        ],
                    },
                    {
                        type: 'file' as const,
                        pattern: 'src/api/middleware.ts',
                        content_match_mode: 'all' as const,
                        content_rules: [
                            { mode: 'string' as const, patterns: ['authMiddleware'] },
                        ],
                    },
                ],
            };

            const result = await evaluator.evaluate(rules as never, fileDiffs);

            expect(result.matched).toBe(false);
        });
    });
});
