
import { ContentMatchers } from '../../src/core/content-matchers';
import { RuleParser } from '../../src/core/rule-parser';
import { FileDiff } from '../../src/core/types';
import { createMockLogger } from '../helpers';
// safe-regex is used internally

describe('Regex Flag Validation Security', () => {
    const logger = createMockLogger();
    let matchers: ContentMatchers;

    beforeEach(() => {
        jest.clearAllMocks();
        matchers = new ContentMatchers(logger);
    });

    it('should allow valid safe flags (g, i, m, s, u, y)', async () => {
        const rule = {
            mode: 'regex' as const,
            pattern: 'test',
            flags: 'gim' // Valid flags
        };

        const fileDiff: FileDiff = {
            filename: 'test.txt',
            patch: '@@ -0,0 +1 @@\n+TEST content', // Case insensitive match
            additions: 1,
            deletions: 0,
            changes: 1,
            status: 'modified'
        };

        const result = await matchers.matchRegex(rule, fileDiff);
        expect(result.matched).toBe(true);
        expect(result.matchedPatterns).toContain('test');
    });

    it('should REJECT invalid/dangerous flags not in allowlist', async () => {
        const rule = {
            mode: 'regex' as const,
            pattern: 'test',
            flags: 'v'
        };

        const fileDiff: FileDiff = {
            filename: 'test.txt',
            patch: '@@ -0,0 +1 @@\n+test content',
            additions: 1,
            deletions: 0,
            changes: 1,
            status: 'modified'
        };

        const result = await matchers.matchRegex(rule, fileDiff);
        expect(result.matched).toBe(false);
        // Uses logger.warning, not warn
        expect(logger.warning).toHaveBeenCalledWith(
            expect.stringContaining('Invalid regex flags rejected')
        );
    });

    it('should REJECT garbage flags', async () => {
        const rule = {
            mode: 'regex' as const,
            pattern: 'test',
            flags: 'xyz'
        };
        const fileDiff: FileDiff = {
            filename: 'test.txt',
            patch: '@@ -0,0 +1 @@\n+test content',
            additions: 1,
            deletions: 0,
            changes: 1,
            status: 'modified'
        };

        const result = await matchers.matchRegex(rule, fileDiff);
        expect(result.matched).toBe(false);
        expect(logger.warning).toHaveBeenCalledWith(
            expect.stringContaining('Invalid regex flags rejected')
        );
    });

    it('should validate unsafe regex in RuleParser', () => {
        const parser = new RuleParser();
        const rule = {
            mode: 'regex',
            pattern: '(a+)+', // ReDoS pattern
            flags: ''
        };

        expect(() => {
            (parser as any).validateContentRule(rule);
        }).toThrow('Unsafe regex pattern');
    });

    it('should validate invalid flags in RuleParser', () => {
        const parser = new RuleParser();
        const rule = {
            mode: 'regex',
            pattern: 'abc',
            flags: 'xyz'
        };

        expect(() => {
            (parser as any).validateContentRule(rule);
        }).toThrow('Invalid regex flags');
    });
});
