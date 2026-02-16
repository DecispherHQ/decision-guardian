
import { runCheck } from '../../src/cli/commands/check';
import { DecisionParser } from '../../src/core/parser';
import { FileMatcher } from '../../src/core/matcher';
import { LocalGitProvider } from '../../src/adapters/local/local-git-provider';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../../src/core/parser');
jest.mock('../../src/core/matcher');
jest.mock('../../src/adapters/local/local-git-provider');
// Mock fs
jest.mock('fs');
jest.mock('../../src/adapters/local/console-logger', () => {
    return {
        ConsoleLogger: jest.fn().mockImplementation(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
        })),
    };
});

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    return undefined as never;
});

describe('check command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default fs mocks
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false });
        (fs.readFileSync as jest.Mock).mockReturnValue('');
    });

    it('should exit with 0 when no critical violations found', async () => {
        // Setup mocks
        (DecisionParser as jest.Mock).mockImplementation(() => ({
            parseFile: jest.fn().mockResolvedValue({
                decisions: [{ id: 'DEC-001' }],
                warnings: [],
                errors: []
            })
        }));

        (LocalGitProvider as jest.Mock).mockImplementation(() => ({
            getFileDiffs: jest.fn().mockResolvedValue([{ filename: 'test.ts' }])
        }));

        (FileMatcher as jest.Mock).mockImplementation(() => ({
            findMatchesWithDiffs: jest.fn().mockResolvedValue([]),
            groupBySeverity: jest.fn().mockReturnValue({ critical: [], warning: [], info: [] }),
            findMatches: jest.fn().mockResolvedValue([])
        }));

        // Run command
        await runCheck({
            decisionFile: 'decisions.md',
            mode: 'staged',
            failOnCritical: true
        });

        expect(mockExit).toHaveBeenCalledWith(0);
        expect(DecisionParser).toHaveBeenCalled();
        expect(LocalGitProvider).toHaveBeenCalledWith(expect.objectContaining({ mode: 'staged' }));
    });

    it('should exit with 1 when critical violations found and failOnCritical is true', async () => {
        // Setup mocks
        (DecisionParser as jest.Mock).mockImplementation(() => ({
            parseFile: jest.fn().mockResolvedValue({
                decisions: [{ id: 'DEC-CRIT', severity: 'critical' }],
                warnings: [],
                errors: []
            })
        }));

        (LocalGitProvider as jest.Mock).mockImplementation(() => ({
            getFileDiffs: jest.fn().mockResolvedValue([{ filename: 'critical.ts' }])
        }));

        (FileMatcher as jest.Mock).mockImplementation(() => ({
            findMatchesWithDiffs: jest.fn().mockResolvedValue([{
                file: 'critical.ts',
                decision: { id: 'DEC-CRIT', severity: 'critical' }
            }]),
            groupBySeverity: jest.fn().mockReturnValue({
                critical: [{ decision: { severity: 'critical' } }],
                warning: [],
                info: []
            })
        }));

        await runCheck({
            decisionFile: 'decisions.md',
            mode: 'staged',
            failOnCritical: true
        });

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle missing decision file', async () => {
        (DecisionParser as jest.Mock).mockImplementation(() => ({
            parseFile: jest.fn().mockRejectedValue(new Error('File not found'))
        }));

        await runCheck({
            decisionFile: 'missing.md',
            mode: 'staged',
            failOnCritical: false
        });

        expect(mockExit).toHaveBeenCalledWith(1);
    });
});
