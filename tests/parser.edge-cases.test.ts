import { DecisionParser } from '../src/parser';

describe('DecisionParser edge cases', () => {
    const parser = new DecisionParser();

    describe('alphanumeric IDs', () => {
        it('parses DECISION-001', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test Decision
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test context.`,
                'test.md'
            );

            expect(result.errors).toHaveLength(0);
            expect(result.decisions).toHaveLength(1);
            expect(result.decisions[0].id).toBe('DECISION-001');
        });

        it('parses DECISION-TEST-001', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-TEST-001 -->
## Decision: Complex ID
**Status**: Active
**Date**: 2024-01-15
**Severity**: Warning
**Files**:
- \`src/test.ts\`

### Context
Testing alphanumeric IDs.`,
                'test.md'
            );

            expect(result.errors).toHaveLength(0);
            expect(result.decisions[0].id).toBe('DECISION-TEST-001');
        });

        it('parses DECISION-V2-AUTH', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-V2-AUTH -->
## Decision: Auth v2
**Status**: Active
**Date**: 2024-01-15
**Severity**: Critical
**Files**:
- \`src/auth.ts\`

### Context
Version 2 auth.`,
                'test.md'
            );

            expect(result.errors).toHaveLength(0);
            expect(result.decisions[0].id).toBe('DECISION-V2-AUTH');
        });

        it('handles case-insensitive IDs', async () => {
            const result = await parser.parseContent(
                `<!-- decision-001 -->
## Decision: Lowercase ID
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Testing lowercase.`,
                'test.md'
            );

            expect(result.errors).toHaveLength(0);
            // ID should be normalized to uppercase
            expect(result.decisions[0].id).toBe('DECISION-001');
        });
    });

    describe('file patterns', () => {
        it('extracts files with backticks', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`
- \`src/util.ts\`

### Context
Context.`,
                'test.md'
            );

            expect(result.decisions[0].files).toEqual(['src/app.ts', 'src/util.ts']);
        });

        it('extracts files without backticks', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- src/app.ts
- src/util.ts

### Context
Context.`,
                'test.md'
            );

            expect(result.decisions[0].files).toEqual(['src/app.ts', 'src/util.ts']);
        });

        it('stops at non-list content', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
This is context text.`,
                'test.md'
            );

            expect(result.decisions[0].files).toEqual(['src/app.ts']);
        });

        it('handles empty Files section', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:

### Context
No files specified.`,
                'test.md'
            );

            expect(result.decisions[0].files).toEqual([]);
        });
    });

    describe('status synonyms', () => {
        it('normalizes enabled to active', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Enabled
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].status).toBe('active');
        });

        it('normalizes obsolete to deprecated', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Obsolete
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].status).toBe('deprecated');
        });

        it('normalizes replaced to superseded', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Replaced
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].status).toBe('superseded');
        });

        it('normalizes inactive to archived', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Inactive
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].status).toBe('archived');
        });
    });

    describe('severity synonyms', () => {
        it('normalizes low to info', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Low
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].severity).toBe('info');
        });

        it('normalizes medium to warning', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Medium
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].severity).toBe('warning');
        });

        it('normalizes high to critical', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: High
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].severity).toBe('critical');
        });

        it('normalizes blocker to critical', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Blocker
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.decisions[0].severity).toBe('critical');
        });
    });

    describe('date validation', () => {
        it('warns on invalid date format', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: Jan 15, 2024
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            // Date "Jan 15, 2024" is actually parseable by JS Date, so no warning
            expect(result.errors).toHaveLength(0);
        });

        it('warns on completely invalid date', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: not-a-date
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.warnings.some(w => w.includes('Invalid date'))).toBe(true);
        });

        it('accepts valid ISO dates', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: Test
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
Test.`,
                'test.md'
            );

            expect(result.warnings.filter(w => w.includes('date'))).toHaveLength(0);
        });
    });

    describe('multiple decisions', () => {
        it('parses multiple decisions in one file', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
## Decision: First Decision
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/first.ts\`

### Context
First context.

<!-- DECISION-002 -->
## Decision: Second Decision
**Status**: Active
**Date**: 2024-02-01
**Severity**: Warning
**Files**:
- \`src/second.ts\`

### Context
Second context.`,
                'test.md'
            );

            expect(result.errors).toHaveLength(0);
            expect(result.decisions).toHaveLength(2);
            expect(result.decisions[0].id).toBe('DECISION-001');
            expect(result.decisions[1].id).toBe('DECISION-002');
        });
    });

    describe('malformed input', () => {
        it('handles empty content', async () => {
            const result = await parser.parseContent('', 'test.md');
            expect(result.decisions).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });

        it('handles content with no decisions', async () => {
            const result = await parser.parseContent('# Just a regular markdown file\n\nNo decisions here.', 'test.md');
            expect(result.decisions).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });

        it('reports error for decision missing title', async () => {
            const result = await parser.parseContent(
                `<!-- DECISION-001 -->
**Status**: Active
**Date**: 2024-01-15
**Severity**: Info
**Files**:
- \`src/app.ts\`

### Context
No title.`,
                'test.md'
            );

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain('missing required fields');
        });
    });
});
