
import * as path from 'path';
import { DecisionParser } from '../../src/core/parser';

describe('DecisionParser', () => {
    const parser = new DecisionParser();

    it('should parse valid decisions file', async () => {
        const fixturePath = path.resolve(__dirname, '../fixtures/valid-decisions.md');
        const result = await parser.parseFile(fixturePath);

        expect(result.errors).toEqual([]);
        expect(result.decisions).toHaveLength(1);

        const decision = result.decisions[0];
        expect(decision.id).toBe('DECISION-001');
        expect(decision.title).toBe('Database Pool Size');
        expect(decision.status).toBe('active');
        expect(decision.severity).toBe('critical');
        expect(decision.date).toBe('2024-01-15');
        expect(decision.files).toEqual(['src/db/pool.ts', 'config/database.yml']);
        expect(decision.context).toContain('Connection pooling prevents exhaustion');
    });

    it('should handle broken files gracefully', async () => {
        const result = await parser.parseContent(
            '<!-- DECISION-999 -->\n## Invalid block\n',
            'test.md'
        );
        // Missing fields
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Decision missing required fields');
    });

    it('should ignore malformed markers and handle multiple blocks', async () => {
        const content = `
some random text
<!-- DECISION-001 -->
## Decision: Valid 1
**Status**: Active
<!-- MALFORMED-MARKER -->
<!-- DECISION-002 -->
## Decision: Valid 2
**Status**: Active
        `;
        const result = await parser.parseContent(content, 'test.md');
        expect(result.decisions).toHaveLength(2);
        expect(result.decisions[0].id).toBe('DECISION-001');
        expect(result.decisions[1].id).toBe('DECISION-002');
    });

    // ── BUG-009 Regression — exclude-only Files warning ───────────────────────

    describe('BUG-009 Regression — exclude-only Files patterns', () => {
        it('should emit a warning when all Files patterns are exclusions', async () => {
            const content = `
<!-- DECISION-EXCL-001 -->
## Decision: Exclude-only test
**Status**: Active
**Severity**: Warning
**Date**: 2024-01-01

**Files**:
- \`!src/**/*.test.ts\`
            `;

            const result = await parser.parseContent(content, 'excl-test.md');

            // Decision still parsed successfully
            expect(result.decisions).toHaveLength(1);
            expect(result.decisions[0].id).toBe('DECISION-EXCL-001');

            // Warning must be present
            const exclWarning = result.warnings.find(w => w.includes('DECISION-EXCL-001'));
            expect(exclWarning).toBeDefined();
            expect(exclWarning).toMatch(/all.*files.*patterns.*exclusions/i);
        });

        it('should NOT warn when at least one include pattern is present alongside exclusions', async () => {
            const content = `
<!-- DECISION-MIXED-001 -->
## Decision: Mixed patterns
**Status**: Active
**Severity**: Warning
**Date**: 2024-01-01

**Files**:
- \`src/**/*.ts\`
- \`!src/**/*.test.ts\`
            `;

            const result = await parser.parseContent(content, 'mixed-test.md');

            expect(result.decisions).toHaveLength(1);
            const exclWarnings = result.warnings.filter(w =>
                /all.*files.*patterns.*exclusions/i.test(w)
            );
            expect(exclWarnings).toHaveLength(0);
        });
    });
});

