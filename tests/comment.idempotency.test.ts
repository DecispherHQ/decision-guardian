import { CommentManager } from '../src/comment';
import { DecisionMatch } from '../src/types';

// Mock GitHub API
const createCommentMock = jest.fn().mockResolvedValue({});
const updateCommentMock = jest.fn().mockResolvedValue({});
const listCommentsMock = jest.fn().mockResolvedValue({ data: [] });
const deleteCommentMock = jest.fn().mockResolvedValue({});

jest.mock('@actions/github', () => ({
    getOctokit: jest.fn(() => ({
        rest: {
            issues: {
                createComment: createCommentMock,
                updateComment: updateCommentMock,
                listComments: listCommentsMock,
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

// Mock Actions Core
jest.mock('@actions/core', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

describe('CommentManager idempotency', () => {
    let manager: CommentManager;

    beforeEach(() => {
        manager = new CommentManager('fake-token');
        createCommentMock.mockClear();
        updateCommentMock.mockClear();
        listCommentsMock.mockClear();
        deleteCommentMock.mockClear();
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

    describe('when no existing comment', () => {
        beforeEach(() => {
            listCommentsMock.mockResolvedValue({ data: [] });
        });

        it('creates new comment', async () => {
            await manager.postAlert([mockMatch]);

            expect(listCommentsMock).toHaveBeenCalledTimes(1);
            expect(createCommentMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock).not.toHaveBeenCalled();

            const callArgs = createCommentMock.mock.calls[0][0];
            expect(callArgs.owner).toBe('test-owner');
            expect(callArgs.repo).toBe('test-repo');
            expect(callArgs.issue_number).toBe(123);
            expect(callArgs.body).toContain('decision-guardian-v1');
            expect(callArgs.body).toContain('hash:');
        });
    });

    describe('when existing comment with different hash', () => {
        beforeEach(() => {
            listCommentsMock.mockResolvedValue({
                data: [
                    {
                        id: 456,
                        body: '<!-- decision-guardian-v1 -->\n<!-- hash:oldhash -->\n\nOld content',
                    },
                ],
            });
        });

        it('updates existing comment', async () => {
            await manager.postAlert([mockMatch]);

            expect(listCommentsMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            expect(createCommentMock).not.toHaveBeenCalled();

            const callArgs = updateCommentMock.mock.calls[0][0];
            expect(callArgs.comment_id).toBe(456);
            expect(callArgs.body).toContain('decision-guardian-v1');
        });
    });

    describe('when existing comment with same hash', () => {
        it('skips update when content unchanged', async () => {
            // First, post to get the hash
            listCommentsMock.mockResolvedValue({ data: [] });
            await manager.postAlert([mockMatch]);

            // Get the hash from the created comment
            const createdBody = createCommentMock.mock.calls[0][0].body;
            const hashMatch = createdBody.match(/<!-- hash:([a-f0-9-]+) -->/);
            const hash = hashMatch ? hashMatch[1] : 'unknown';

            // Reset mocks
            createCommentMock.mockClear();
            updateCommentMock.mockClear();
            listCommentsMock.mockClear();

            // Now simulate existing comment with same hash
            listCommentsMock.mockResolvedValue({
                data: [
                    {
                        id: 789,
                        body: `<!-- decision-guardian-v1 -->\n<!-- hash:${hash} -->\n\nContent`,
                    },
                ],
            });

            // Post again with same matches
            await manager.postAlert([mockMatch]);

            expect(listCommentsMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock).not.toHaveBeenCalled();
            expect(createCommentMock).not.toHaveBeenCalled();
        });
    });

    describe('hash stability', () => {
        it('generates consistent hash for same matches', async () => {
            listCommentsMock.mockResolvedValue({ data: [] });

            // Post twice
            await manager.postAlert([mockMatch]);
            const firstBody = createCommentMock.mock.calls[0][0].body;

            createCommentMock.mockClear();
            listCommentsMock.mockResolvedValue({ data: [] });

            await manager.postAlert([mockMatch]);
            const secondBody = createCommentMock.mock.calls[0][0].body;

            // Extract hashes
            const firstHash = firstBody.match(/<!-- hash:([a-f0-9-]+) -->/)?.[1];
            const secondHash = secondBody.match(/<!-- hash:([a-f0-9-]+) -->/)?.[1];

            expect(firstHash).toBe(secondHash);
        });

        it('generates different hash for different matches', async () => {
            listCommentsMock.mockResolvedValue({ data: [] });

            await manager.postAlert([mockMatch]);
            const firstBody = createCommentMock.mock.calls[0][0].body;

            createCommentMock.mockClear();
            listCommentsMock.mockResolvedValue({ data: [] });

            const differentMatch = {
                ...mockMatch,
                file: 'src/different.ts',
            };
            await manager.postAlert([differentMatch]);
            const secondBody = createCommentMock.mock.calls[0][0].body;

            const firstHash = firstBody.match(/<!-- hash:([a-f0-9-]+) -->/)?.[1];
            const secondHash = secondBody.match(/<!-- hash:([a-f0-9-]+) -->/)?.[1];

            expect(firstHash).not.toBe(secondHash);
        });
    });

    describe('error handling', () => {
        it('handles listComments failure gracefully', async () => {
            listCommentsMock.mockRejectedValue(new Error('API error'));

            await manager.postAlert([mockMatch]);

            // Should fall back to creating new comment
            expect(createCommentMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('comment content', () => {
        it('includes marker and hash in comment', async () => {
            listCommentsMock.mockResolvedValue({ data: [] });

            await manager.postAlert([mockMatch]);

            const body = createCommentMock.mock.calls[0][0].body;
            expect(body).toContain('<!-- decision-guardian-v1 -->');
            expect(body).toMatch(/<!-- hash:[a-f0-9-]+ -->/);
        });

        it('groups decisions by severity', async () => {
            listCommentsMock.mockResolvedValue({ data: [] });

            const infoMatch: DecisionMatch = {
                ...mockMatch,
                decision: { ...mockMatch.decision, id: 'DEC-002', severity: 'info' },
            };

            await manager.postAlert([mockMatch, infoMatch]);

            const body = createCommentMock.mock.calls[0][0].body;
            expect(body).toContain('Critical Decisions (1)');
            expect(body).toContain('Informational (1)');
        });
    });

    describe('postAllClear functionality', () => {
        it('updates existing comment to all-clear status', async () => {
            listCommentsMock.mockResolvedValue({
                data: [
                    {
                        id: 456,
                        body: '<!-- decision-guardian-v1 -->\n<!-- hash:somehash -->\n\n## ⚠️ Decision Context Alert\n\nOld warning content',
                    },
                ],
            });

            await manager.postAllClear();

            expect(listCommentsMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            expect(createCommentMock).not.toHaveBeenCalled();

            const callArgs = updateCommentMock.mock.calls[0][0];
            expect(callArgs.comment_id).toBe(456);
            expect(callArgs.body).toContain('Decision Guardian - All Clear');
            expect(callArgs.body).toContain('hash:all-clear');
            expect(callArgs.body).toContain('no longer modifies any files protected');
        });

        it('does not create comment when no existing comment', async () => {
            listCommentsMock.mockResolvedValue({ data: [] });

            await manager.postAllClear();

            expect(listCommentsMock).toHaveBeenCalledTimes(1);
            expect(createCommentMock).not.toHaveBeenCalled();
            expect(updateCommentMock).not.toHaveBeenCalled();
        });

        it('skips update when already showing all-clear', async () => {
            listCommentsMock.mockResolvedValue({
                data: [
                    {
                        id: 456,
                        body: '<!-- decision-guardian-v1 -->\n<!-- hash:all-clear -->\n\n## ✅ Decision Guardian - All Clear',
                    },
                ],
            });

            await manager.postAllClear();

            expect(listCommentsMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock).not.toHaveBeenCalled();
            expect(createCommentMock).not.toHaveBeenCalled();
        });

        it('transitions from all-clear back to warning when matches found again', async () => {
            // First, simulate a comment that was set to all-clear
            listCommentsMock.mockResolvedValue({
                data: [
                    {
                        id: 456,
                        body: '<!-- decision-guardian-v1 -->\n<!-- hash:all-clear -->\n\n## ✅ Decision Guardian - All Clear',
                    },
                ],
            });

            // Post new matches - should update the all-clear comment back to warning
            await manager.postAlert([mockMatch]);

            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            const callArgs = updateCommentMock.mock.calls[0][0];
            expect(callArgs.comment_id).toBe(456);
            expect(callArgs.body).toContain('Decision Context Alert');
            expect(callArgs.body).toContain('Critical Decisions');
            expect(callArgs.body).not.toContain('All Clear');
        });

        it('cleans up duplicate comments when posting all-clear', async () => {
            listCommentsMock.mockResolvedValue({
                data: [
                    {
                        id: 100,
                        body: '<!-- decision-guardian-v1 -->\n<!-- hash:hash1 -->\n\nFirst comment',
                    },
                    {
                        id: 200,
                        body: '<!-- decision-guardian-v1 -->\n<!-- hash:hash2 -->\n\nDuplicate comment',
                    },
                ],
            });

            await manager.postAllClear();

            // Should update the first comment
            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock.mock.calls[0][0].comment_id).toBe(100);

            // Should delete the duplicate
            expect(deleteCommentMock).toHaveBeenCalledTimes(1);
            expect(deleteCommentMock.mock.calls[0][0].comment_id).toBe(200);
        });

        it('handles deleted comment (404) gracefully by skipping update', async () => {
            listCommentsMock.mockResolvedValue({
                data: [
                    {
                        id: 456,
                        body: '<!-- decision-guardian-v1 -->\n<!-- hash:somehash -->\n\nOld warning',
                    },
                ],
            });

            // Simulate 404 on update
            updateCommentMock.mockRejectedValue({ status: 404 });

            await manager.postAllClear();

            // Should attempt update but catch 404 and return
            expect(listCommentsMock).toHaveBeenCalledTimes(1);
            expect(updateCommentMock).toHaveBeenCalledTimes(1);
            expect(createCommentMock).not.toHaveBeenCalled();
        });
    });
});
