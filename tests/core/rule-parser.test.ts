/**
 * Tests for RuleParser - especially path traversal security
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { RuleParser } from '../../src/core/rule-parser';

describe('RuleParser', () => {
    const testDir = path.join(process.cwd(), 'test-temp-rules');
    const workspaceDir = path.join(testDir, 'workspace');
    const outsideDir = path.join(testDir, 'outside');

    let parser: RuleParser;
    let originalCwd: string;
    let originalWorkspace: string | undefined;

    beforeAll(async () => {
        // Save original values
        originalCwd = process.cwd();
        originalWorkspace = process.env.GITHUB_WORKSPACE;

        // Create test directories
        await fs.mkdir(workspaceDir, { recursive: true });
        await fs.mkdir(outsideDir, { recursive: true });

        // Create test rule files
        const validRule = {
            match_mode: 'any',
            pattern: '**/*.ts',
        };

        await fs.writeFile(
            path.join(workspaceDir, 'valid-rule.json'),
            JSON.stringify(validRule, null, 2)
        );

        await fs.writeFile(
            path.join(outsideDir, 'malicious-rule.json'),
            JSON.stringify(validRule, null, 2)
        );

        // Set workspace to our test workspace
        process.env.GITHUB_WORKSPACE = workspaceDir;

        parser = new RuleParser();
    });

    afterAll(async () => {
        // Restore original values
        process.env.GITHUB_WORKSPACE = originalWorkspace;

        // Clean up test directories
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe('Inline JSON Rules', () => {
        it('should parse inline JSON rules', async () => {
            const content = `
## DECISION-001
**Rules**: \`\`\`json
{
    "match_mode": "any",
    "pattern": "**/*.ts"
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeDefined();
            expect(result.rules?.match_mode).toBe('any');
            expect(result.error).toBeUndefined();
        });

        it('should return error for invalid JSON', async () => {
            const content = `
## DECISION-001
**Rules**: \`\`\`json
{ invalid json }
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toContain('Failed to parse inline JSON rules');
        });
    });

    describe('External Rule Files', () => {
        it('should load external rule file within workspace', async () => {
            const content = `
## DECISION-001
**Rules**: [Rules File](./valid-rule.json)
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeDefined();
            expect(result.rules?.match_mode).toBe('any');
            expect(result.error).toBeUndefined();
        });

        it('should load external rule file with plain path', async () => {
            const content = `
## DECISION-001
**Rules**: ./valid-rule.json
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeDefined();
            expect(result.rules?.match_mode).toBe('any');
            expect(result.error).toBeUndefined();
        });

        it('should handle missing external file', async () => {
            const content = `
## DECISION-001
**Rules**: ./nonexistent.json
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toContain('Failed to load external rules');
        });
    });

    describe('🔴 CRITICAL: Path Traversal Security', () => {
        it('should REJECT path traversal attack using ../../../', async () => {
            // Calculate relative path to escape workspace
            const relPath = path.relative(workspaceDir, path.join(outsideDir, 'malicious-rule.json'));

            const content = `
## DECISION-001
**Rules**: ${relPath}
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Security Error');
            expect(result.error).toContain('outside the workspace');
        });

        it('should REJECT absolute path outside workspace', async () => {
            const absolutePath = path.join(outsideDir, 'malicious-rule.json');

            const content = `
## DECISION-001
**Rules**: [Malicious](${absolutePath})
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Security Error');
            expect(result.error).toContain('outside the workspace');
        });

        it('should REJECT path trying to read system files (Unix-style)', async () => {
            const content = `
## DECISION-001
**Rules**: ../../../etc/passwd.json
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Security Error');
        });

        it('should REJECT path trying to read system files (Windows-style)', async () => {
            const content = `
## DECISION-001
**Rules**: C:\\Windows\\System32\\config\\secrets.json
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Security Error');
        });

        it('should ACCEPT valid subdirectory within workspace', async () => {
            // Create a subdirectory
            const subDir = path.join(workspaceDir, 'rules');
            await fs.mkdir(subDir, { recursive: true });

            const validRule = {
                match_mode: 'any',
                pattern: '**/*.ts',
            };

            await fs.writeFile(
                path.join(subDir, 'sub-rule.json'),
                JSON.stringify(validRule, null, 2)
            );

            const content = `
## DECISION-001
**Rules**: ./rules/sub-rule.json
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeDefined();
            expect(result.rules?.match_mode).toBe('any');
            expect(result.error).toBeUndefined();
        });

        it('should normalize paths correctly on Windows', async () => {
            // Test with mixed slashes
            const content = `
## DECISION-001
**Rules**: ./valid-rule.json
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });

    describe('Rule Validation', () => {
        it('should set default match_mode to "any"', async () => {
            const content = `
## DECISION-001
**Rules**: \`\`\`json
{
    "pattern": "**/*.ts"
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeDefined();
            expect(result.rules?.match_mode).toBe('any');
        });

        it('should validate nested conditions', async () => {
            const content = `
## DECISION-001
**Rules**: \`\`\`json
{
    "match_mode": "all",
    "conditions": [
        {
            "pattern": "**/*.ts"
        },
        {
            "pattern": "src/**"
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeDefined();
            expect(result.rules?.conditions).toHaveLength(2);
            expect(result.error).toBeUndefined();
        });

        it('should reject invalid content rule mode', async () => {
            const content = `
## DECISION-001
**Rules**: \`\`\`json
{
    "pattern": "**/*.ts",
    "content_rules": [
        {
            "mode": "invalid_mode"
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toContain('Invalid content rule mode');
        });

        it('should validate regex patterns', async () => {
            const content = `
## DECISION-001
**Rules**: \`\`\`json
{
    "pattern": "**/*.ts",
    "content_rules": [
        {
            "mode": "regex",
            "pattern": "["
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toContain('Invalid regex pattern');
        });
    });

    describe('No Rules', () => {
        it('should return null when no rules found', async () => {
            const content = `
## DECISION-001
This is a decision without rules.
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toBeUndefined();
        });
    });
});
