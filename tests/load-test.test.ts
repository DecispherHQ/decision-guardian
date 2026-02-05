/**
 * Load and Performance Tests
 * Validates system behavior under high load scenarios
 */

import { FileMatcher } from '../src/matcher';
import { Decision, FileDiff } from '../src/types';

describe('Performance Under Load', () => {
    describe('Large PR Handling', () => {
        it('handles 3000 file PR efficiently', async () => {
            // Create 3000 file diffs
            const largeFileDiffs: FileDiff[] = Array.from({ length: 3000 }, (_, i) => ({
                filename: `src/components/file${i}.ts`,
                status: 'modified' as const,
                additions: 10,
                deletions: 5,
                changes: 15,
                patch: `@@ -1,5 +1,10 @@
-old line ${i}
+new line ${i}
+console.log("test ${i}");`
            }));

            // Create 100 decisions with various patterns
            const testDecisions: Decision[] = Array.from({ length: 100 }, (_, i) => ({
                id: `DEC-${String(i + 1).padStart(3, '0')}`,
                title: `Decision ${i + 1}`,
                status: 'active' as const,
                severity: 'info' as const,
                date: '2024-01-01',
                files: [
                    `src/components/file${i * 10}.ts`,
                    `src/components/file${i * 10 + 1}.ts`,
                    `src/components/file${i * 10 + 2}.ts`,
                ],
                context: `Context for decision ${i + 1}`,
                sourceFile: 'decisions.md',
                lineNumber: i * 10,
                schemaVersion: 1
            }));

            const matcher = new FileMatcher(testDecisions);

            const startTime = Date.now();
            const startMemory = process.memoryUsage();

            const matches = await matcher.findMatchesWithDiffs(largeFileDiffs);

            const duration = Date.now() - startTime;
            const endMemory = process.memoryUsage();
            const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

            console.log(`\n📊 Performance Metrics (3000 files, 100 decisions):`);
            console.log(`   Duration: ${duration}ms`);
            console.log(`   Memory Delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Heap Used: ${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Matches Found: ${matches.length}\n`);

            // Performance assertions
            expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
            expect(endMemory.heapUsed).toBeLessThan(512 * 1024 * 1024); // < 512MB heap
            expect(matches.length).toBeGreaterThan(0); // Should find some matches
        }, 35000); // 35 second test timeout

        it('handles 1000 file PR with glob patterns efficiently', async () => {
            const fileDiffs: FileDiff[] = Array.from({ length: 1000 }, (_, i) => ({
                filename: `src/modules/module${i}/index.ts`,
                status: 'modified' as const,
                additions: 5,
                deletions: 3,
                changes: 8,
                patch: `+import { Something } from './types';`
            }));

            const decisions: Decision[] = [
                {
                    id: 'DEC-GLOB-001',
                    title: 'All TypeScript Files',
                    status: 'active',
                    severity: 'info',
                    date: '2024-01-01',
                    files: ['**/*.ts'], // Glob pattern matching ALL files
                    context: 'Test glob matching',
                    sourceFile: 'decisions.md',
                    lineNumber: 1,
                    schemaVersion: 1
                }
            ];

            const matcher = new FileMatcher(decisions);

            const startTime = Date.now();
            const matches = await matcher.findMatchesWithDiffs(fileDiffs);
            const duration = Date.now() - startTime;

            console.log(`\n📊 Glob Pattern Performance (1000 files):`);
            console.log(`   Duration: ${duration}ms`);
            console.log(`   Matches: ${matches.length}\n`);

            expect(duration).toBeLessThan(20000); // < 20 seconds for glob matching
            // findMatchesWithDiffs now returns one match per file
            expect(matches.length).toBe(1000);
            // Verify all files are matched
            expect(matches[0].decision.id).toBe('DEC-GLOB-001');
        }, 25000);

        it('handles mixed pattern types at scale', async () => {
            const fileDiffs: FileDiff[] = Array.from({ length: 500 }, (_, i) => ({
                filename: `src/file${i}.ts`,
                status: 'modified' as const,
                additions: 10,
                deletions: 5,
                changes: 15,
                patch: `@@ -1,3 +1,5 @@
+import { Config } from './config';
+const API_KEY = "secret";
+console.log("debug");`
            }));

            const decisions: Decision[] = [
                // Exact match
                {
                    id: 'DEC-001',
                    title: 'Exact Match',
                    status: 'active',
                    severity: 'info',
                    date: '2024-01-01',
                    files: ['src/file100.ts'],
                    context: 'Exact file match',
                    sourceFile: 'decisions.md',
                    lineNumber: 1,
                    schemaVersion: 1
                },
                // Glob pattern
                {
                    id: 'DEC-002',
                    title: 'Glob Pattern',
                    status: 'active',
                    severity: 'warning',
                    date: '2024-01-01',
                    files: ['src/file*.ts'],
                    context: 'Glob pattern',
                    sourceFile: 'decisions.md',
                    lineNumber: 10,
                    schemaVersion: 1
                },
                // Advanced rules with content matching
                {
                    id: 'DEC-003',
                    title: 'Content Match',
                    status: 'active',
                    severity: 'critical',
                    date: '2024-01-01',
                    files: [],
                    rules: {
                        match_mode: 'all',
                        conditions: [
                            {
                                type: 'file',
                                pattern: 'src/*.ts',
                                content_rules: [
                                    {
                                        mode: 'string',
                                        patterns: ['API_KEY', 'secret']
                                    }
                                ]
                            }
                        ]
                    },

                    context: 'Sensitive data detection',
                    sourceFile: 'decisions.md',
                    lineNumber: 20,
                    schemaVersion: 1
                }
            ];

            const matcher = new FileMatcher(decisions);

            const startTime = Date.now();
            const matches = await matcher.findMatchesWithDiffs(fileDiffs);
            const duration = Date.now() - startTime;

            console.log(`\n📊 Mixed Pattern Performance (500 files, 3 decision types):`);
            console.log(`   Duration: ${duration}ms`);
            console.log(`   Matches: ${matches.length}\n`);

            expect(duration).toBeLessThan(15000); // < 15 seconds
            expect(matches.length).toBeGreaterThan(0);

            // Verify we found the content match
            const contentMatches = matches.filter(m => m.decision.id === 'DEC-003');
            expect(contentMatches.length).toBeGreaterThan(0);
        }, 20000);
    });

    describe('Memory Management', () => {
        it('does not leak memory on repeated operations', async () => {
            const fileDiffs: FileDiff[] = Array.from({ length: 100 }, (_, i) => ({
                filename: `src/file${i}.ts`,
                status: 'modified' as const,
                additions: 5,
                deletions: 2,
                changes: 7,
                patch: '+test'
            }));

            const decisions: Decision[] = [{
                id: 'DEC-001',
                title: 'Test',
                status: 'active',
                severity: 'info',
                date: '2024-01-01',
                files: ['**/*.ts'],
                context: 'Test',
                sourceFile: 'decisions.md',
                lineNumber: 1,
                schemaVersion: 1
            }];

            const matcher = new FileMatcher(decisions);

            // Force GC if available
            if (global.gc) {
                global.gc();
            }

            const initialMemory = process.memoryUsage().heapUsed;

            // Run 10 iterations
            for (let i = 0; i < 10; i++) {
                await matcher.findMatchesWithDiffs(fileDiffs);
            }

            // Force GC again
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

            console.log(`\n📊 Memory Growth (10 iterations):`);
            console.log(`   Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Growth: ${memoryGrowth.toFixed(2)}MB\n`);

            // Memory growth should be minimal (< 50MB)
            expect(memoryGrowth).toBeLessThan(50);
        }, 30000);

        it('handles streaming for extremely large PRs', async () => {
            // This tests the architecture's ability to handle streaming
            // In practice, GitHub limits PRs to 3000 files
            const decisions: Decision[] = [{
                id: 'DEC-001',
                title: 'Test',
                status: 'active',
                severity: 'info',
                date: '2024-01-01',
                files: ['**/*.ts'],
                context: 'Test',
                sourceFile: 'decisions.md',
                lineNumber: 1,
                schemaVersion: 1
            }];

            const matcher = new FileMatcher(decisions);
            let totalMatches = 0;
            let peakMemory = 0;

            // Simulate processing in chunks (like streamFileDiffs would do)
            const CHUNK_SIZE = 100;
            const TOTAL_FILES = 1000;

            for (let chunk = 0; chunk < TOTAL_FILES / CHUNK_SIZE; chunk++) {
                const fileDiffs: FileDiff[] = Array.from({ length: CHUNK_SIZE }, (_, i) => ({
                    filename: `src/chunk${chunk}/file${i}.ts`,
                    status: 'modified' as const,
                    additions: 5,
                    deletions: 2,
                    changes: 7,
                    patch: '+test'
                }));

                const matches = await matcher.findMatchesWithDiffs(fileDiffs);
                totalMatches += matches.length;

                const currentMemory = process.memoryUsage().heapUsed;
                peakMemory = Math.max(peakMemory, currentMemory);
            }

            console.log(`\n📊 Streaming Performance (1000 files in 10 chunks):`);
            console.log(`   Total Matches: ${totalMatches}`);
            console.log(`   Peak Memory: ${(peakMemory / 1024 / 1024).toFixed(2)}MB\n`);

            expect(totalMatches).toBe(TOTAL_FILES);
            expect(peakMemory).toBeLessThan(512 * 1024 * 1024); // < 512MB
        }, 30000);
    });

    describe('Trie Performance', () => {
        it('efficiently matches against large decision sets', async () => {
            // Test Trie's efficiency with many exact file patterns
            const decisions: Decision[] = Array.from({ length: 500 }, (_, i) => ({
                id: `DEC-${String(i + 1).padStart(3, '0')}`,
                title: `Decision ${i + 1}`,
                status: 'active' as const,
                severity: 'info' as const,
                date: '2024-01-01',
                files: [
                    `src/module${i}/file1.ts`,
                    `src/module${i}/file2.ts`,
                    `src/module${i}/file3.ts`,
                ],
                context: `Context ${i + 1}`,
                sourceFile: 'decisions.md',
                lineNumber: i * 10,
                schemaVersion: 1
            }));

            const fileDiffs: FileDiff[] = [
                {
                    filename: 'src/module100/file1.ts',
                    status: 'modified',
                    additions: 5,
                    deletions: 2,
                    changes: 7,
                    patch: '+test'
                },
                {
                    filename: 'src/module200/file2.ts',
                    status: 'modified',
                    additions: 3,
                    deletions: 1,
                    changes: 4,
                    patch: '+test'
                }
            ];

            const matcher = new FileMatcher(decisions);

            const startTime = Date.now();
            const matches = await matcher.findMatchesWithDiffs(fileDiffs);
            const duration = Date.now() - startTime;

            console.log(`\n📊 Trie Lookup Performance (500 decisions, 2 file lookups):`);
            console.log(`   Duration: ${duration}ms`);
            console.log(`   Matches: ${matches.length}\n`);

            // Should be very fast with Trie
            expect(duration).toBeLessThan(1000); // < 1 second
            expect(matches.length).toBe(2);
        });
    });
});
