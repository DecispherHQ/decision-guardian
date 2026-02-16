/**
 * Tests for LocalGitProvider - focusing on baseBranch validation to prevent shell injection
 */

import { LocalGitProvider } from '../../src/adapters/local/local-git-provider';

describe('LocalGitProvider - baseBranch validation', () => {
    describe('Valid branch names', () => {
        it('should accept standard branch names', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main'
            })).not.toThrow();

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'develop'
            })).not.toThrow();

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'master'
            })).not.toThrow();
        });

        it('should accept branch names with hyphens', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'feature-branch'
            })).not.toThrow();

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'my-awesome-feature'
            })).not.toThrow();
        });

        it('should accept branch names with slashes (e.g., feature/foo)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'feature/my-feature'
            })).not.toThrow();

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'bugfix/issue-123'
            })).not.toThrow();

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'release/v1.0.0'
            })).not.toThrow();
        });

        it('should accept branch names with underscores', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'my_feature_branch'
            })).not.toThrow();
        });

        it('should accept branch names with dots', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'release.1.0'
            })).not.toThrow();
        });

        it('should accept numeric branch names', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: '123'
            })).not.toThrow();
        });

        it('should accept when baseBranch is undefined (uses default)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch'
            })).not.toThrow();
        });

        it('should accept empty string as baseBranch (uses default)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: ''
            })).not.toThrow();
        });
    });

    describe('Invalid branch names (security)', () => {
        it('should reject branch names with semicolons (command separator)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main; rm -rf /'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with ampersands (background/chain)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main && malicious'
            })).toThrow(/Invalid baseBranch/);

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main & background'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with pipes (command chaining)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main | cat /etc/passwd'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with dollar signs (variable expansion)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main$VARIABLE'
            })).toThrow(/Invalid baseBranch/);

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main$(whoami)'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with backticks (command substitution)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main`whoami`'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with backslashes', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main\\escape'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with quotes', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main"quoted"'
            })).toThrow(/Invalid baseBranch/);

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: "main'quoted'"
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with angle brackets (redirection)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main > /tmp/output'
            })).toThrow(/Invalid baseBranch/);

            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main < /tmp/input'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with parentheses (subshells)', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main(subshell)'
            })).toThrow(/Invalid baseBranch/);
        });

        it('should reject branch names with spaces', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main branch'
            })).toThrow(/Invalid baseBranch/);
        });



        it('should reject excessively long branch names', () => {
            const longName = 'a'.repeat(300);
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: longName
            })).toThrow(/Invalid baseBranch/);
        });
    });

    describe('Error message', () => {
        it('should provide helpful error message', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'main; malicious'
            })).toThrow('Branch names must only contain alphanumeric characters, hyphens, underscores, slashes, and dots');
        });

        it('should include the invalid branch name in error', () => {
            expect(() => new LocalGitProvider({
                mode: 'branch',
                baseBranch: 'bad;branch'
            })).toThrow('bad;branch');
        });
    });
});
