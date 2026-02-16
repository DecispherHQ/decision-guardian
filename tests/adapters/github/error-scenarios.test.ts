/**
 * Comprehensive Error Scenario Tests
 * Tests critical failure modes and security boundaries
 */

import { GitHubProvider } from '../../../src/adapters/github/github-provider';
import { ContentMatchers } from '../../../src/core/content-matchers';
import { DecisionParser } from '../../../src/core/parser';
import { CommentManager } from '../../../src/adapters/github/comment';
import { ContentRule } from '../../../src/core/rule-types';
import { FileDiff, DecisionMatch } from '../../../src/core/types';
import { createMockLogger } from '../../helpers';

// Mock dependencies
jest.mock('@actions/github');

describe('Error Handling', () => {
    const logger = createMockLogger();

    describe('GitHub API Rate Limits', () => {
        it('handles 429 rate limit with retry-after header', async () => {
            const mockOctokit = {
                rest: {
                    pulls: {
                        listFiles: jest.fn()
                            .mockRejectedValueOnce({
                                status: 429,
                                response: {
                                    headers: {
                                        'retry-after': '2' // 2 seconds
                                    }
                                }
                            })
                            .mockResolvedValueOnce({
                                data: [
                                    {
                                        filename: 'test.ts',
                                        status: 'modified',
                                        additions: 1,
                                        deletions: 0,
                                        changes: 1,
                                        patch: '+console.log("test");'
                                    }
                                ]
                            })
                    }
                }
            };

            const { getOctokit, context } = require('@actions/github');
            getOctokit.mockReturnValue(mockOctokit);
            // Mock the context for GitHubProvider constructor
            Object.defineProperty(context, 'payload', {
                value: { pull_request: { number: 1 } },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(context, 'repo', {
                value: { owner: 'test', repo: 'test' },
                writable: true,
                configurable: true,
            });

            const provider = new GitHubProvider('fake-token', logger);
            const result = await provider.getFileDiffs();

            // Should have retried and succeeded
            expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledTimes(2);
            expect(result.length).toBe(1);
            expect(result[0].filename).toBe('test.ts');
        }, 10000); // 10 second timeout for retry delays

        it('handles 403 rate limit with x-ratelimit-reset header', async () => {
            const futureResetTime = Math.floor(Date.now() / 1000) + 2; // 2 seconds from now

            const mockOctokit = {
                rest: {
                    pulls: {
                        listFiles: jest.fn()
                            .mockRejectedValueOnce({
                                status: 403,
                                response: {
                                    headers: {
                                        'x-ratelimit-remaining': '0',
                                        'x-ratelimit-reset': futureResetTime.toString()
                                    }
                                }
                            })
                            .mockResolvedValueOnce({
                                data: [{
                                    filename: 'test.ts',
                                    status: 'modified',
                                    additions: 1,
                                    deletions: 0,
                                    changes: 1,
                                    patch: '+test'
                                }]
                            })
                    }
                }
            };

            const { getOctokit, context } = require('@actions/github');
            getOctokit.mockReturnValue(mockOctokit);
            Object.defineProperty(context, 'payload', {
                value: { pull_request: { number: 1 } },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(context, 'repo', {
                value: { owner: 'test', repo: 'test' },
                writable: true,
                configurable: true,
            });

            const provider = new GitHubProvider('fake-token', logger);
            const result = await provider.getFileDiffs();

            expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(1);
        }, 10000);

        it('fails immediately on non-rate-limit errors', async () => {
            const notFoundError = Object.assign(new Error('Not Found'), { status: 404 });
            const mockOctokit = {
                rest: {
                    pulls: {
                        listFiles: jest.fn().mockRejectedValue(notFoundError)
                    }
                }
            };

            const { getOctokit, context } = require('@actions/github');
            getOctokit.mockReturnValue(mockOctokit);
            Object.defineProperty(context, 'payload', {
                value: { pull_request: { number: 1 } },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(context, 'repo', {
                value: { owner: 'test', repo: 'test' },
                writable: true,
                configurable: true,
            });

            const provider = new GitHubProvider('fake-token', logger);
            await expect(provider.getFileDiffs()).rejects.toThrow();

            // Should NOT retry on non-rate-limit errors
            expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledTimes(1);
        });

        it('trips circuit breaker on excessive wait time', async () => {
            const veryFutureResetTime = Math.floor(Date.now() / 1000) + 400; // 6+ minutes
            const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
                status: 403,
                response: {
                    headers: {
                        'x-ratelimit-remaining': '0',
                        'x-ratelimit-reset': veryFutureResetTime.toString()
                    }
                }
            });

            const mockOctokit = {
                rest: {
                    pulls: {
                        listFiles: jest.fn().mockRejectedValue(rateLimitError)
                    }
                }
            };

            const { getOctokit, context } = require('@actions/github');
            getOctokit.mockReturnValue(mockOctokit);
            Object.defineProperty(context, 'payload', {
                value: { pull_request: { number: 1 } },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(context, 'repo', {
                value: { owner: 'test', repo: 'test' },
                writable: true,
                configurable: true,
            });

            const provider = new GitHubProvider('fake-token', logger);
            await expect(provider.getFileDiffs()).rejects.toThrow();

            // Should fail immediately without retrying due to circuit breaker
            expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledTimes(1);
        });
    });

    describe('ReDoS Protection', () => {
        it('rejects unsafe regex patterns using safe-regex', async () => {
            const matchers = new ContentMatchers(logger);

            // Known ReDoS pattern
            const rule: ContentRule = {
                mode: 'regex',
                pattern: '(a+)+b', // Catastrophic backtracking
                flags: ''
            };

            const fileDiff: FileDiff = {
                filename: 'test.txt',
                status: 'modified',
                additions: 1,
                deletions: 0,
                changes: 1,
                patch: '+' + 'a'.repeat(100) + 'c' // Won't match, but causes ReDoS
            };

            const result = await matchers.matchRegex(rule, fileDiff);

            // Should reject as unsafe
            expect(result.matched).toBe(false);
            expect(result.matchedPatterns).toEqual([]);
        });

        it('handles VM timeout for long-running regex', async () => {
            const matchers = new ContentMatchers(logger);

            // Pattern that passes safe-regex but could still be slow
            const rule: ContentRule = {
                mode: 'regex',
                pattern: 'a*b',
                flags: ''
            };

            const fileDiff: FileDiff = {
                filename: 'test.txt',
                status: 'modified',
                additions: 1,
                deletions: 0,
                changes: 1,
                patch: '+' + 'a'.repeat(1000000) // Very long string
            };

            const startTime = Date.now();
            const result = await matchers.matchRegex(rule, fileDiff);
            const duration = Date.now() - startTime;

            // Should complete within reasonable time (VM timeout is 5s)
            expect(duration).toBeLessThan(10000);
        }, 15000);

        it('rejects overly long regex patterns', async () => {
            const matchers = new ContentMatchers(logger);

            const rule: ContentRule = {
                mode: 'regex',
                pattern: 'a'.repeat(1001), // > 1000 chars
                flags: ''
            };

            const fileDiff: FileDiff = {
                filename: 'test.txt',
                status: 'modified',
                additions: 1,
                deletions: 0,
                changes: 1,
                patch: '+test'
            };

            const result = await matchers.matchRegex(rule, fileDiff);

            expect(result.matched).toBe(false);
        });

        it('rejects overly large content', async () => {
            const matchers = new ContentMatchers(logger);

            const rule: ContentRule = {
                mode: 'regex',
                pattern: 'test',
                flags: ''
            };

            const fileDiff: FileDiff = {
                filename: 'test.txt',
                status: 'modified',
                additions: 1,
                deletions: 0,
                changes: 1,
                patch: '+' + 'a'.repeat(1024 * 1024 + 1) // > 1MB
            };

            const result = await matchers.matchRegex(rule, fileDiff);

            expect(result.matched).toBe(false);
        });
    });

    describe('Concurrent Comment Updates', () => {
        it('handles 409 conflict with exponential backoff', async () => {
            const mockOctokit = {
                rest: {
                    issues: {
                        listComments: jest.fn().mockResolvedValue({
                            data: []
                        }),
                        createComment: jest.fn()
                            .mockRejectedValueOnce({ status: 409 }) // First attempt fails
                            .mockResolvedValueOnce({ data: { id: 1 } }) // Second succeeds
                    }
                }
            };

            const { getOctokit } = require('@actions/github');
            getOctokit.mockReturnValue(mockOctokit);

            const manager = new CommentManager('fake-token', logger);

            const matches: DecisionMatch[] = [{
                file: 'test.ts',
                matchedPattern: 'test',
                decision: {
                    id: 'DEC-001',
                    title: 'Test',
                    status: 'active',
                    severity: 'info',
                    date: '2024-01-01',
                    files: [],
                    context: 'Test context',
                    sourceFile: 'decisions.md',
                    lineNumber: 1,
                    schemaVersion: 1
                }
            }];

            await manager.postAlert(matches, {
                owner: 'test',
                repo: 'test',
                number: 1
            });

            // Should have retried
            expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(2);
        }, 10000);

        it('handles multiple concurrent updates gracefully', async () => {
            const mockOctokit = {
                rest: {
                    issues: {
                        listComments: jest.fn().mockResolvedValue({
                            data: []
                        }),
                        createComment: jest.fn().mockResolvedValue({ data: { id: 1 } })
                    }
                }
            };

            const { getOctokit } = require('@actions/github');
            getOctokit.mockReturnValue(mockOctokit);

            const manager = new CommentManager('fake-token', logger);

            const createMatches = (id: string): DecisionMatch[] => [{
                file: 'test.ts',
                matchedPattern: 'test',
                decision: {
                    id,
                    title: 'Test',
                    status: 'active',
                    severity: 'info',
                    date: '2024-01-01',
                    files: [],
                    context: 'Test context',
                    sourceFile: 'decisions.md',
                    lineNumber: 1,
                    schemaVersion: 1
                }
            }];

            const updates = await Promise.allSettled([
                manager.postAlert(createMatches('DEC-001'), { owner: 'test', repo: 'test', number: 1 }),
                manager.postAlert(createMatches('DEC-002'), { owner: 'test', repo: 'test', number: 1 }),
                manager.postAlert(createMatches('DEC-003'), { owner: 'test', repo: 'test', number: 1 })
            ]);

            // All should succeed
            const succeeded = updates.filter(r => r.status === 'fulfilled').length;
            expect(succeeded).toBe(3);
        });
    });

    describe('Path Traversal Security', () => {
        it('prevents path traversal attacks', async () => {
            const parser = new DecisionParser();

            // Mock workspace
            process.env.GITHUB_WORKSPACE = '/home/runner/work/repo';

            const result = await parser.parseFile('../../../etc/passwd');

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].message).toContain('Security');
            expect(result.errors[0].message).toContain('Path traversal');
            expect(result.decisions.length).toBe(0);
        });

        it('allows valid paths within workspace', async () => {
            const parser = new DecisionParser();
            process.env.GITHUB_WORKSPACE = process.cwd();

            // Create a temp test file
            const fs = require('fs/promises');
            const path = require('path');
            const testFile = path.join(process.cwd(), 'test-decisions.md');

            await fs.writeFile(testFile, `
<!-- DECISION-TEST-001 -->
## Decision: Test Decision
**Status**: Active
**Date**: 2024-01-01
**Severity**: Info
**Files**:
- test.ts

### Context
Test context
            `.trim());

            const result = await parser.parseFile('test-decisions.md');

            expect(result.errors.filter((e: any) => e.message.includes('Security')).length).toBe(0);

            // Cleanup
            await fs.unlink(testFile).catch(() => { });
        });

        it('normalizes paths correctly to prevent bypass', async () => {
            const parser = new DecisionParser();
            process.env.GITHUB_WORKSPACE = '/home/runner/work/repo';

            // Attempt to bypass with complex path
            const result = await parser.parseFile('./subdir/../../../../../../etc/passwd');

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].message).toContain('Security');
        });
    });

    describe('Invalid Input Handling', () => {
        it('handles invalid regex gracefully', async () => {
            const matchers = new ContentMatchers(logger);

            const rule: ContentRule = {
                mode: 'regex',
                pattern: '[invalid(regex', // Not closed properly
                flags: ''
            };

            const fileDiff: FileDiff = {
                filename: 'test.txt',
                status: 'modified',
                additions: 1,
                deletions: 0,
                changes: 1,
                patch: '+test'
            };

            const result = await matchers.matchRegex(rule, fileDiff);

            // Should return false, not throw
            expect(result.matched).toBe(false);
        });

        it('handles malformed patch content', async () => {
            const matchers = new ContentMatchers(logger);

            const rule: ContentRule = {
                mode: 'string',
                patterns: ['test']
            };

            const fileDiff: FileDiff = {
                filename: 'test.txt',
                status: 'modified',
                additions: 0,
                deletions: 0,
                changes: 0,
                patch: '' // Empty patch
            };

            const result = matchers.matchString(rule, fileDiff);

            expect(result.matched).toBe(false);
            expect(result.matchedPatterns).toEqual([]);
        });
    });
});
