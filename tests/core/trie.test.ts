import { PatternTrie } from '../../src/core/trie';
import { Decision } from '../../src/core/types';

describe('PatternTrie', () => {
    const createDecision = (id: string, files: string[]): Decision => ({
        id,
        title: `Decision ${id}`,
        date: '2023-01-01',
        status: 'active',
        severity: 'info',
        files,
        context: 'Test context',
        sourceFile: 'decisions.md',
        lineNumber: 1,
        schemaVersion: 1
    });

    it('should match exact file paths', () => {
        const d1 = createDecision('1', ['src/foo.ts']);
        const trie = new PatternTrie([d1]);

        const candidates = trie.findCandidates('src/foo.ts');
        expect(candidates.has(d1)).toBe(true);
        expect(candidates.size).toBe(1);
    });

    it('should not match unrelated paths', () => {
        const d1 = createDecision('1', ['src/foo.ts']);
        const trie = new PatternTrie([d1]);

        const candidates = trie.findCandidates('src/bar.ts');
        expect(candidates.has(d1)).toBe(false);
    });

    it('should handle directory prefixes', () => {
        const d1 = createDecision('1', ['src/api/*.ts']);
        const trie = new PatternTrie([d1]);

        // "src/api" matches the static part
        const candidates1 = trie.findCandidates('src/api/user.ts');
        expect(candidates1.has(d1)).toBe(true); // Should be a candidate because of wildcard at matching level

        // "src/utils" does not match "src/api"
        const candidates2 = trie.findCandidates('src/utils/helper.ts');
        expect(candidates2.has(d1)).toBe(false);
    });

    it('should handle root wildcards', () => {
        const d1 = createDecision('1', ['**/*.ts']);
        const trie = new PatternTrie([d1]);

        const candidates = trie.findCandidates('src/deep/nested/file.ts');
        expect(candidates.has(d1)).toBe(true);
    });

    it('should handle mixed patterns', () => {
        const d_api = createDecision('api', ['src/api/**']);
        const d_ui = createDecision('ui', ['src/ui/**']);
        const d_all = createDecision('all', ['**/*.md']);

        const trie = new PatternTrie([d_api, d_ui, d_all]);

        // API file
        const apiCandidates = trie.findCandidates('src/api/v1/user.ts');
        expect(apiCandidates.has(d_api)).toBe(true);
        expect(apiCandidates.has(d_ui)).toBe(false);
        expect(apiCandidates.has(d_all)).toBe(true); // wildcard at root matches implementation

        // UI file
        const uiCandidates = trie.findCandidates('src/ui/components/Button.tsx');
        expect(uiCandidates.has(d_api)).toBe(false);
        expect(uiCandidates.has(d_ui)).toBe(true);
        expect(uiCandidates.has(d_all)).toBe(true);

        // Markdown file
        const mdCandidates = trie.findCandidates('README.md');
        expect(mdCandidates.has(d_api)).toBe(false);
        expect(mdCandidates.has(d_ui)).toBe(false);
        expect(mdCandidates.has(d_all)).toBe(true);
    });

    it('should match multiple decisions on same path', () => {
        const d1 = createDecision('1', ['src/foo.ts']);
        const d2 = createDecision('2', ['src/foo.ts']);

        const trie = new PatternTrie([d1, d2]);

        const candidates = trie.findCandidates('src/foo.ts');
        expect(candidates.has(d1)).toBe(true);
        expect(candidates.has(d2)).toBe(true);
    });

    // ── BUG-009 Regression — exclude-only Files patterns ─────────────────────

    describe('BUG-009 Regression — exclude-only Files patterns', () => {
        it('should return exclude-only decisions as candidates for every file', () => {
            // Decision whose entire Files list is exclusions — it should fire on every file
            // that is NOT excluded. The trie must return it as a candidate so matchesDecision()
            // can apply the exclusion gate.
            const dExcludeOnly = createDecision('EXCL', ['!src/**/*.test.ts']);
            const trie = new PatternTrie([dExcludeOnly]);

            // A production file — NOT excluded — must be a candidate
            const prodCandidates = trie.findCandidates('src/api/controller.ts');
            expect(prodCandidates.has(dExcludeOnly)).toBe(true);

            // A test file — excluded — is still returned as a candidate by the trie;
            // the real exclusion happens in matchesDecision(), not in findCandidates().
            const testCandidates = trie.findCandidates('src/api/controller.test.ts');
            expect(testCandidates.has(dExcludeOnly)).toBe(true);
        });

        it('should not add exclude-only decisions to candidates when files list is empty', () => {
            const dNoFiles = createDecision('NOFILES', []);
            const trie = new PatternTrie([dNoFiles]);

            const candidates = trie.findCandidates('src/anything.ts');
            expect(candidates.has(dNoFiles)).toBe(false);
        });

        it('should still index include patterns normally when mixed with exclusions', () => {
            const dMixed = createDecision('MIXED', ['src/**/*.ts', '!src/**/*.test.ts']);
            const trie = new PatternTrie([dMixed]);

            const candidates = trie.findCandidates('src/api/controller.ts');
            expect(candidates.has(dMixed)).toBe(true);
        });
    });
});
