import { CommentManager } from '../../../src/adapters/github/comment';
import { Decision, DecisionMatch } from '../../../src/core/types';
import { createMockLogger } from '../../helpers';

const createCommentMock = jest.fn().mockResolvedValue({ data: { id: 200 } });
const listCommentsMock = jest.fn().mockResolvedValue({ data: [] });
const updateCommentMock = jest.fn().mockResolvedValue({});
const deleteCommentMock = jest.fn().mockResolvedValue({});

jest.mock('@actions/github', () => ({
    getOctokit: jest.fn(() => ({
        rest: {
            issues: {
                createComment: createCommentMock,
                listComments: listCommentsMock,
                updateComment: updateCommentMock,
                deleteComment: deleteCommentMock,
            },
        },
    })),
    context: {
        repo: { owner: 'test-owner', repo: 'test-repo' },
        payload: { pull_request: { number: 123 } },
    },
}));

const CONTEXT_SENTINEL = 'BillingRequiresAcidCompliance';

function makeDecision(overrides: Partial<Decision> = {}): Decision {
    return {
        id: 'DEC-DB-001',
        title: 'Database Choice for Billing',
        status: 'active',
        severity: 'critical',
        date: '2024-03-15',
        files: ['src/db/**'],
        context: `We chose Postgres over MongoDB. ${CONTEXT_SENTINEL}.`,
        sourceFile: '.decispher/decisions.md',
        lineNumber: 12,
        schemaVersion: 1,
        ...overrides,
    };
}

/** One DecisionMatch per file, exactly as FileMatcher emits them. */
function matchesForFiles(decision: Decision, files: string[]): DecisionMatch[] {
    return files.map((file) => ({
        file,
        decision,
        matchedPattern: 'src/db/**',
        matchDetails: {
            matched: true,
            matchedFiles: [file],
            matchedPatterns: ['src/db/**'],
            ruleDepth: 0,
        },
    }));
}

describe('CommentManager — per-decision grouping', () => {
    let manager: CommentManager;
    const logger = createMockLogger();

    beforeEach(() => {
        manager = new CommentManager('fake-token', logger);
        createCommentMock.mockClear();
        listCommentsMock.mockClear();
        listCommentsMock.mockResolvedValue({ data: [] });
    });

    const bodyOf = (): string => createCommentMock.mock.calls[0][0].body;

    it('renders a decision context ONCE regardless of how many files matched', async () => {
        const decision = makeDecision();
        const files = Array.from({ length: 40 }, (_, i) => `src/db/file-${i}.ts`);

        await manager.postAlert(matchesForFiles(decision, files));

        const body = bodyOf();
        const contextOccurrences = body.split(CONTEXT_SENTINEL).length - 1;

        expect(contextOccurrences).toBe(1);
    });

    it('renders one heading per decision, not per file', async () => {
        const decision = makeDecision();
        const files = Array.from({ length: 40 }, (_, i) => `src/db/file-${i}.ts`);

        await manager.postAlert(matchesForFiles(decision, files));

        const headingOccurrences = bodyOf().split('#### DEC').length - 1;
        expect(headingOccurrences).toBe(1);
    });

    it('still lists every matched file', async () => {
        const decision = makeDecision();
        const files = Array.from({ length: 12 }, (_, i) => `src/db/file-${i}.ts`);

        await manager.postAlert(matchesForFiles(decision, files));

        const body = bodyOf();
        expect(body).toContain('**12** files');

        // File paths are markdown-escaped in the rendered comment, so `-` and
        // `.` arrive backslash-escaped. Assert against that real output.
        for (const file of files) {
            expect(body).toContain(file.replace(/[-.]/g, '\\$&'));
        }
        expect(body).toContain('📂 12 matched files');
    });

    it('keeps a single-file match inline rather than as a collapsed list', async () => {
        const decision = makeDecision();

        await manager.postAlert(matchesForFiles(decision, ['src/db/pool.ts']));

        const body = bodyOf();
        expect(body).toContain('| **File** | `src/db/pool\\.ts` |');
        expect(body).not.toContain('matched files</summary>');
    });

    it('groups independently per decision and counts decisions in the heading', async () => {
        const dbDecision = makeDecision();
        const apiDecision = makeDecision({
            id: 'DEC-API-002',
            title: 'API Versioning',
            severity: 'warning',
            context: 'Versioning rationale.',
        });

        await manager.postAlert([
            ...matchesForFiles(dbDecision, ['src/db/a.ts', 'src/db/b.ts']),
            ...matchesForFiles(apiDecision, ['src/api/x.ts', 'src/api/y.ts', 'src/api/z.ts']),
        ]);

        const body = bodyOf();
        expect(body).toContain('### 🔴 Critical Decisions (1)');
        expect(body).toContain('### 🟡 Important Decisions (1)');
        expect(body).toContain('**5 file(s)**');
        expect(body).toContain('**2 architectural decision(s)**');
    });

    it('de-duplicates a file reported more than once for the same decision', async () => {
        const decision = makeDecision();
        const dupes = matchesForFiles(decision, ['src/db/pool.ts', 'src/db/pool.ts']);

        await manager.postAlert(dupes);

        expect(bodyOf()).toContain('| **File** | `src/db/pool\\.ts` |');
    });

    it('collapses a rule-based match that carries many files in matchDetails', async () => {
        const decision = makeDecision({ id: 'DEC-RULE-003', rules: { type: 'file', pattern: 'x' } as never });
        const files = ['src/db/a.ts', 'src/db/b.ts', 'src/db/c.ts'];

        await manager.postAlert([
            {
                file: files.join(', '),
                decision,
                matchedPattern: 'src/db/**',
                matchDetails: {
                    matched: true,
                    matchedFiles: files,
                    matchedPatterns: ['src/db/**'],
                    ruleDepth: 1,
                },
            },
        ]);

        const body = bodyOf();
        expect(body).toContain('**3** files');
        expect(body).toContain('| **Type** | Rule-based |');
        expect(body.split(CONTEXT_SENTINEL).length - 1).toBe(1);
    });

    it('keeps a wide PR under the limit with every decision intact', async () => {
        // 30 decisions x 60 files = 1,800 matches. Rendered per-file this was
        // ~1.6M characters, which collapsed to the counts-only fallback and
        // lost every rationale. Grouped it is ~48K and keeps all 30.
        const matches: DecisionMatch[] = [];
        for (let d = 0; d < 30; d++) {
            const decision = makeDecision({
                id: `DEC-${String(d).padStart(3, '0')}`,
                context: 'A'.repeat(400),
            });
            const files = Array.from({ length: 60 }, (_, i) => `src/mod${d}/file-${i}.ts`);
            matches.push(...matchesForFiles(decision, files));
        }

        await manager.postAlert(matches);

        const body = bodyOf();
        expect(body.length).toBeLessThan(60000);

        // Decision ids are markdown-escaped, so `DEC-000` renders as `DEC\-000`.
        expect(body.split('#### DEC').length - 1).toBe(30);

        // Full detail retained — not the counts-only fallback.
        expect(body).not.toContain('Details truncated');
        expect(body).toContain('Read full context');
    });
});
