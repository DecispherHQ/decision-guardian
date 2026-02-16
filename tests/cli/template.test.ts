
import { runTemplate, listTemplates } from '../../src/cli/commands/template';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs');
// Mock paths.ts
jest.mock('../../src/cli/paths', () => ({
    getTemplatesDir: jest.fn().mockReturnValue('/mock/templates'),
}));

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    return undefined as never;
});

describe('template command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should implement listTemplates', () => {
        listTemplates();
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Available templates:'));
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('basic'));
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('security'));
    });

    it('should output content to stdout when runTemplate called without output path', () => {
        // Mock fs
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('Template Content');

        runTemplate('basic');

        expect(mockConsoleLog).toHaveBeenCalledWith('Template Content');
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should write content to file when runTemplate called with output path', () => {
        // Mock fs
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('Template Content');
        (fs.mkdirSync as jest.Mock).mockImplementation();
        (fs.writeFileSync as jest.Mock).mockImplementation();

        runTemplate('security', 'output/security.md');

        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('security.md'), 'Template Content', 'utf-8');
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Written to'));
    });

    it('should exit with error if template name is invalid', () => {
        runTemplate('invalid-template');

        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Unknown template'));
    });

    it('should exit with error if template file is missing', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false); // Template file missing

        runTemplate('basic');

        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Template file missing'));
    });
});
