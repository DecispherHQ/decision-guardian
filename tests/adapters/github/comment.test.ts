
import { CommentManager } from '../../../src/adapters/github/comment';
import { DecisionMatch } from '../../../src/core/types';
import { createMockLogger } from '../../helpers';

// Mock GitHub API
const createCommentMock = jest.fn().mockResolvedValue({});
jest.mock('@actions/github', () => ({
    getOctokit: jest.fn(() => ({
        rest: {
            issues: {
                createComment: createCommentMock,
            },
        },
    })),
    context: {
        repo: { owner: 'test-owner', repo: 'test-repo' },
        payload: {
            pull_request: { number: 123 },
        },
    },
}));

describe('CommentManager', () => {
    let manager: CommentManager;
    const logger = createMockLogger();

    beforeEach(() => {
        manager = new CommentManager('fake-token', logger);
        createCommentMock.mockClear();
    });

    const mockMatch: DecisionMatch = {
        file: 'src/app.ts',
        matchedPattern: 'src/*.ts',
        decision: {
            id: 'DEC-001',
            title: 'Critical Decision',
            status: 'active',
            severity: 'critical',
            date: '2024-01-01',
            files: [],
            context: 'Context here',
            sourceFile: 'decisions.md',
            lineNumber: 1,
            schemaVersion: 1,
        },
    };

    it('posts comment with correct body', async () => {
        await manager.postAlert([mockMatch]);

        expect(createCommentMock).toHaveBeenCalledTimes(1);
        const callArgs = createCommentMock.mock.calls[0][0];

        expect(callArgs.owner).toBe('test-owner');
        expect(callArgs.repo).toBe('test-repo');
        expect(callArgs.issue_number).toBe(123);

        // Check body content
        const body = callArgs.body;
        expect(body).toContain('Decision Context Alert');
        expect(body).toContain('Critical Decisions (1)');
        expect(body).toContain('DEC\\-001: Critical Decision');
        expect(body).toContain('Context here');
    });

    it('groups multiple decisions correctly', async () => {
        const infoMatch = {
            ...mockMatch,
            decision: { ...mockMatch.decision, id: 'DEC-002', severity: 'info' as const }
        };

        await manager.postAlert([mockMatch, infoMatch]);

        const body = createCommentMock.mock.calls[0][0].body;
        expect(body).toContain('Critical Decisions (1)');
        expect(body).toContain('Informational (1)');
    });
});
