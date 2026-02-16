
import { FileMatcher } from '../../src/core/matcher';
import { Decision } from '../../src/core/types';
import { createMockLogger } from '../helpers';

function createDecision(overrides: Partial<Decision> = {}): Decision {
    return {
        id: 'DEC-001',
        title: 'Test Decision',
        status: 'active',
        severity: 'info',
        date: '2024-01-01',
        files: [],
        context: 'Test context',
        sourceFile: 'decisions.md',
        lineNumber: 1,
        schemaVersion: 1,
        ...overrides,
    };
}

describe('FileMatcher', () => {
    const logger = createMockLogger();

    it('matches exact file path', async () => {
        const decisions = [createDecision({ files: ['src/app.ts'] })];
        const matcher = new FileMatcher(decisions, logger);
        const matches = await matcher.findMatches(['src/app.ts']);
        expect(matches).toHaveLength(1);
        expect(matches[0].matchedPattern).toBe('src/app.ts');
    });

    it('matches wildcard patterns', async () => {
        const decisions = [createDecision({ files: ['src/*.ts'] })];
        const matcher = new FileMatcher(decisions, logger);
        const matches = await matcher.findMatches(['src/app.ts', 'src/utils.ts']);
        expect(matches).toHaveLength(2);
    });

    it('matches recursive patterns', async () => {
        const decisions = [createDecision({ files: ['src/**/*.test.ts'] })];
        const matcher = new FileMatcher(decisions, logger);
        const matches = await matcher.findMatches(['src/deep/nested/file.test.ts']);
        expect(matches).toHaveLength(1);
    });

    it('ignores non-active decisions', async () => {
        const decisions = [
            createDecision({ status: 'archived', files: ['src/app.ts'] })
        ];
        const matcher = new FileMatcher(decisions, logger);
        const matches = await matcher.findMatches(['src/app.ts']);
        expect(matches).toHaveLength(0);
    });

    it('handles large file sets with parallel chunking', async () => {
        const decisions = [createDecision({ files: ['**/*.ts'] })];
        const matcher = new FileMatcher(decisions, logger);

        // Generate 600 files to trigger chunking (>500 limit)
        const files = Array.from({ length: 600 }, (_, i) => `src/file${i}.ts`);

        const matches = await matcher.findMatches(files);
        expect(matches).toHaveLength(600);
    });
});
