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

describe('FileMatcher path normalization', () => {
    const logger = createMockLogger();

    describe('Windows path handling', () => {
        it('normalizes Windows backslashes in file paths', async () => {
            const decisions = [createDecision({ files: ['src/app.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            // Windows-style paths should be normalized
            const matches = await matcher.findMatches(['src\\app.ts']);
            expect(matches).toHaveLength(1);
            expect(matches[0].file).toBe('src/app.ts');
        });

        it('normalizes Windows paths in patterns', async () => {
            // Pattern with backslashes (unlikely but possible)
            const decisions = [createDecision({ files: ['src\\lib\\*.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches(['src/lib/utils.ts']);
            expect(matches).toHaveLength(1);
        });

        it('matches nested Windows paths', async () => {
            const decisions = [createDecision({ files: ['src/**/*.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches(['src\\deep\\nested\\file.ts']);
            expect(matches).toHaveLength(1);
            expect(matches[0].file).toBe('src/deep/nested/file.ts');
        });
    });

    describe('POSIX path handling', () => {
        it('matches POSIX paths correctly', async () => {
            const decisions = [createDecision({ files: ['src/app.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches(['src/app.ts']);
            expect(matches).toHaveLength(1);
        });

        it('matches nested POSIX paths', async () => {
            const decisions = [createDecision({ files: ['src/deep/nested/file.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches(['src/deep/nested/file.ts']);
            expect(matches).toHaveLength(1);
        });
    });

    describe('recursive globs', () => {
        it('matches **/*.ts pattern', async () => {
            const decisions = [createDecision({ files: ['src/**/*.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches([
                'src/app.ts',
                'src/lib/utils.ts',
                'src/deep/nested/file.ts',
            ]);
            expect(matches).toHaveLength(3);
        });

        it('matches **/* for all files', async () => {
            const decisions = [createDecision({ files: ['config/**/*'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches([
                'config/database.yml',
                'config/app/settings.json',
            ]);
            expect(matches).toHaveLength(2);
        });

        it('does not match *.ts without directory prefix', async () => {
            // matchBase: false means *.ts won't match src/app.ts
            const decisions = [createDecision({ files: ['*.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            // *.ts should only match root-level .ts files
            const matches = await matcher.findMatches(['src/app.ts', 'app.ts']);
            expect(matches).toHaveLength(1);
            expect(matches[0].file).toBe('app.ts');
        });
    });

    describe('single directory patterns', () => {
        it('matches src/*.ts for single directory', async () => {
            const decisions = [createDecision({ files: ['src/*.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches([
                'src/app.ts',
                'src/utils.ts',
                'src/lib/deep.ts',  // Should NOT match
            ]);
            expect(matches).toHaveLength(2);
        });
    });

    describe('dotfile handling', () => {
        it('matches dotfiles when dot: true', async () => {
            const decisions = [createDecision({ files: ['src/**/*.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches(['src/.hidden.ts']);
            expect(matches).toHaveLength(1);
        });

        it('matches .github files', async () => {
            const decisions = [createDecision({ files: ['.github/**/*'] })];
            const matcher = new FileMatcher(decisions, logger);

            const matches = await matcher.findMatches([
                '.github/workflows/ci.yml',
                '.github/CODEOWNERS',
            ]);
            expect(matches).toHaveLength(2);
        });
    });

    describe('case sensitivity', () => {
        it('is case-sensitive by default', async () => {
            const decisions = [createDecision({ files: ['src/App.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            // Different case should NOT match
            const noMatch = await matcher.findMatches(['src/app.ts']);
            expect(noMatch).toHaveLength(0);

            // Same case should match
            const match = await matcher.findMatches(['src/App.ts']);
            expect(match).toHaveLength(1);
        });
    });

    describe('mixed path separators', () => {
        it('handles mixed separators in single path', async () => {
            const decisions = [createDecision({ files: ['src/**/*.ts'] })];
            const matcher = new FileMatcher(decisions, logger);

            // Mixed separators (unlikely but possible from some tools)
            const matches = await matcher.findMatches(['src/lib\\utils.ts']);
            expect(matches).toHaveLength(1);
            expect(matches[0].file).toBe('src/lib/utils.ts');
        });
    });
});
