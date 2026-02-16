
import { runInit } from '../../src/cli/commands/init';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs');
// Mock paths.ts
jest.mock('../../src/cli/paths', () => ({
    getTemplatesDir: jest.fn().mockReturnValue('/mock/templates'),
}));

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    return undefined as never;
});

// Mock console to avoid clutter
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('init command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: target file missing (false), template exists (true if in /mock/)
        (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
            if (p.includes('decisions.md') && !p.includes('templates')) return false;
            // Template path check - assuming mocked path
            if (p.includes('/mock/templates')) return true;
            return false;
        });
        (fs.mkdirSync as jest.Mock).mockImplementation();
        (fs.copyFileSync as jest.Mock).mockImplementation();
    });

    it('should create .decispher directory and decisions.md if not exists', () => {
        runInit('basic');

        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.decispher'), { recursive: true });
        expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should skip creation if decision file already exists', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true); // target file exists

        runInit('basic');

        expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should use specified template', () => {
        runInit('security');

        // Verify template name is used in source path (first arg)
        expect(fs.copyFileSync).toHaveBeenCalledWith(
            expect.stringContaining('security.md'),
            expect.stringContaining('decisions.md')
        );
    });

    it('should exit with error if template not found', () => {
        // Force existsSync false for template path
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        runInit('invalid-template');

        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Template "invalid-template" not found'));
    });
});
