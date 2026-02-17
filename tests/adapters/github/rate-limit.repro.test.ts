
import { GitHubProvider } from '../../../src/adapters/github/github-provider';
import { createMockLogger } from '../../helpers';

jest.mock('@actions/github');

describe('GitHub Rate Limit Backoff Logic Flaw Repro', () => {
    const logger = createMockLogger();
    let setTimeoutSpy: jest.SpyInstance;


    afterEach(() => {
        jest.useRealTimers();
        if (setTimeoutSpy) setTimeoutSpy.mockRestore();
    });

    it('handles invalid x-ratelimit-reset header gracefully (defaults to 60s)', async () => {
        // Use real timers because we expect wait to be 1ms (very fast) if bug exists.
        // If bug doesn't exist (e.g. wait is long), this might timeout, which failure is acceptable for now or we use fake timers.
        // Actually, let's use fake timers to be safe and inspect the value.
        jest.useFakeTimers();
        setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        const mockOctokit = {
            rest: {
                pulls: {
                    listFiles: jest.fn()
                        .mockRejectedValueOnce({
                            status: 403,
                            response: {
                                headers: {
                                    'x-ratelimit-remaining': '0',
                                    'x-ratelimit-reset': 'invalid-timestamp'
                                }
                            }
                        })
                        .mockResolvedValueOnce({ data: [] })
                }
            }
        };

        const { getOctokit, context } = require('@actions/github');
        getOctokit.mockReturnValue(mockOctokit);
        // Setup context
        context.payload = { pull_request: { number: 1 } };
        context.repo = { owner: 'test', repo: 'test' };

        const provider = new GitHubProvider('fake-token', logger);
        const promise = provider.getFileDiffs();

        // Flush microtasks to reach setTimeout
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const calls = setTimeoutSpy.mock.calls;

        const nanCall = calls.find(args => Number.isNaN(args[1]));
        expect(nanCall).toBeUndefined();

        // Should default to 60000 since header was invalid
        const validDefaultCall = calls.find(args => args[1] === 60000);
        expect(validDefaultCall).toBeDefined();

        // Advance timers to let it finish. We expect 60000ms wait.
        jest.advanceTimersByTime(60000);
        await promise;
    });

    it('defaults to 60s when headers are missing (current behavior check)', async () => {
        jest.useFakeTimers();
        setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        const mockOctokit = {
            rest: {
                pulls: {
                    listFiles: jest.fn()
                        .mockRejectedValueOnce({
                            status: 429,
                            response: { headers: {} } // Start with empty headers
                        })
                        .mockResolvedValueOnce({ data: [] })
                }
            }
        };

        const { getOctokit, context } = require('@actions/github');
        getOctokit.mockReturnValue(mockOctokit);
        context.payload = { pull_request: { number: 1 } };
        context.repo = { owner: 'test', repo: 'test' };

        const provider = new GitHubProvider('fake-token', logger);
        const promise = provider.getFileDiffs();

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const calls = setTimeoutSpy.mock.calls;

        // Expect 60000ms wait
        const defaultWaitCall = calls.find(args => args[1] === 60000);
        expect(defaultWaitCall).toBeDefined();

        jest.advanceTimersByTime(60000);
        await promise;
    });
});
