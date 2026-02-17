
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
});
