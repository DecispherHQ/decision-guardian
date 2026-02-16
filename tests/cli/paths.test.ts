/**
 * Tests for CLI paths module - ensures template directory resolution works correctly
 * after npm bundling and global installation.
 */

import * as path from 'path';
import * as fs from 'fs';
import { getTemplatesDir } from '../../src/cli/paths';

describe('getTemplatesDir', () => {
    it('should return a path that exists', () => {
        const templatesPath = getTemplatesDir();
        expect(fs.existsSync(templatesPath)).toBe(true);
    });

    it('should point to a directory named "templates"', () => {
        const templatesPath = getTemplatesDir();
        expect(path.basename(templatesPath)).toBe('templates');
    });

    it('should contain template files', () => {
        const templatesPath = getTemplatesDir();
        const files = fs.readdirSync(templatesPath);

        // Should have at least one .md template file
        const mdFiles = files.filter(f => f.endsWith('.md'));
        expect(mdFiles.length).toBeGreaterThan(0);

        // Should have common templates
        expect(files).toContain('basic.md');
    });

    it('should resolve to correct path in development mode', () => {
        const templatesPath = getTemplatesDir();

        // In development, should resolve relative to project root
        // The path should end with /templates
        expect(templatesPath).toMatch(/templates$/);
    });

    it('should be accessible for reading template files', () => {
        const templatesPath = getTemplatesDir();
        const basicTemplate = path.join(templatesPath, 'basic.md');

        expect(fs.existsSync(basicTemplate)).toBe(true);

        // Should be able to read the file
        const content = fs.readFileSync(basicTemplate, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
    });
});
