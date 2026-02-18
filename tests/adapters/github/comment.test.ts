
import { CommentManager } from '../../../src/adapters/github/comment';
import { DecisionMatch } from '../../../src/core/types';
import { createMockLogger } from '../../helpers';

// Mock GitHub API
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
        payload: {
            pull_request: { number: 123 },
        },
    },
}));

describe('CommentManager', () => {
    let manager: CommentManager;
    const logger = createMockLogger();
    const MARKER = '<!-- decision-guardian-v1 -->';

    beforeEach(() => {
        manager = new CommentManager('fake-token', logger);
        createCommentMock.mockClear();
        listCommentsMock.mockClear();
        updateCommentMock.mockClear();
        deleteCommentMock.mockClear();

        // Default behavior: no existing comments
        listCommentsMock.mockResolvedValue({ data: [] });
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
        const infoMatch: DecisionMatch = {
            ...mockMatch,
            decision: { ...mockMatch.decision, id: 'DEC-002', severity: 'info' }
        };

        await manager.postAlert([mockMatch, infoMatch]);

        const body = createCommentMock.mock.calls[0][0].body;
        expect(body).toContain('Critical Decisions (1)');
        expect(body).toContain('Informational (1)');
    });

    describe('postAllClear', () => {
        it('updates existing comment to all-clear status', async () => {
            // Setup: existing warning comment
            listCommentsMock.mockResolvedValue({
                data: [{
                    id: 101,
                    body: `${MARKER}\n<!-- hash:some-old-hash -->\n## ⚠️ Decision Context Alert`
                }]
            });

            await manager.postAllClear();

            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock.mock.calls[0][0]).toEqual({
                owner: 'test-owner',
                repo: 'test-repo',
                comment_id: 101,
                body: expect.stringContaining('All Clear')
            });
            expect(createCommentMock).not.toHaveBeenCalled();
        });

        it('does not create comment when no existing comment', async () => {
            // Setup: no existing comment
            listCommentsMock.mockResolvedValue({ data: [] });

            await manager.postAllClear();

            expect(updateCommentMock).not.toHaveBeenCalled();
            expect(createCommentMock).not.toHaveBeenCalled();
        });

        it('skips update when already showing all-clear', async () => {
            // Setup: existing all-clear comment
            listCommentsMock.mockResolvedValue({
                data: [{
                    id: 101,
                    body: `${MARKER}\n<!-- hash:all-clear -->\n## ✅ Decision Guardian - All Clear`
                }]
            });

            await manager.postAllClear();

            expect(updateCommentMock).not.toHaveBeenCalled();
            // Should verify logger info was called, but using mock logger which we can't easily assert on here without casting
        });

        it('cleans up duplicate comments when posting all-clear', async () => {
            // Setup: multiple existing comments
            listCommentsMock.mockResolvedValue({
                data: [
                    { id: 101, body: `${MARKER}\nWarnings...` },
                    { id: 102, body: `${MARKER}\nWarnings...` }
                ]
            });

            await manager.postAllClear();

            // Should update the first one
            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock).toHaveBeenCalledWith(expect.objectContaining({
                comment_id: 101
            }));

            // Should delete the second one
            expect(deleteCommentMock).toHaveBeenCalledTimes(1);
            expect(deleteCommentMock).toHaveBeenCalledWith(expect.objectContaining({
                comment_id: 102
            }));
        });
    });

    describe('state transitions', () => {
        it('transitions from all-clear back to warning when matches found', async () => {
            // Setup: existing all-clear comment
            listCommentsMock.mockResolvedValue({
                data: [{
                    id: 101,
                    body: `${MARKER}\n<!-- hash:all-clear -->\n## ✅ Decision Guardian - All Clear`
                }]
            });

            await manager.postAlert([mockMatch]);

            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            const callArgs = updateCommentMock.mock.calls[0][0];
            expect(callArgs.comment_id).toBe(101);
            expect(callArgs.body).toContain('Decision Context Alert');
            expect(callArgs.body).toContain('Critical Decisions');
        });

        it('updates existing warning comment with new warnings', async () => {
            // Setup: existing warning comment with old hash
            listCommentsMock.mockResolvedValue({
                data: [{
                    id: 101,
                    body: `${MARKER}\n<!-- hash:old-hash -->\n## ⚠️ Decision Context Alert`
                }]
            });

            await manager.postAlert([mockMatch]);

            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock.mock.calls[0][0].comment_id).toBe(101);
        });

        it('skips update if warning content is identical (same hash)', async () => {
            // We need to calculate the expected hash to simulate it being identical
            // Or we can mock hashContent or make the test more integrated.
            // Let's rely on the implementation detail that we can extract hash from body.
            // But strict hash matching depends on exact content. 
            // Instead, let's run it once to get the hash, then run again.

            // First run to "create"
            listCommentsMock.mockResolvedValue({ data: [] });
            await manager.postAlert([mockMatch]);
            const createdBody = createCommentMock.mock.calls[0][0].body;

            // Extract hash from created body
            const hashMatch = createdBody.match(/<!-- hash:([a-z0-9-]+) -->/);
            const hash = hashMatch ? hashMatch[1] : 'fail';

            // Second run with existing comment having that hash
            createCommentMock.mockClear();
            listCommentsMock.mockResolvedValue({
                data: [{
                    id: 101,
                    body: createdBody
                }]
            });

            await manager.postAlert([mockMatch]);

            expect(updateCommentMock).not.toHaveBeenCalled();
            expect(createCommentMock).not.toHaveBeenCalled();
        });
    });
});
