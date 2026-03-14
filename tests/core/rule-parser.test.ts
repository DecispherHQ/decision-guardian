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
            // Could be "Unsafe regex pattern", "Invalid regex pattern", or "Invalid regex pattern syntax" depending on safe-regex behavior
            const errorMsg = result.error || '';
            const isInvalidOrUnsafe = errorMsg.includes('Invalid regex pattern') || errorMsg.includes('Unsafe regex pattern');
            expect(isInvalidOrUnsafe).toBe(true);
        });
    });

    describe('BUG-001 Regression — Template Schema (type/pattern/content_rules)', () => {
        it('should parse a FileRule condition with type:"file", pattern, and content_rules', async () => {
            const content = `
## DECISION-SEC-001
**Rules**: \`\`\`json
{
    "match_mode": "any",
    "conditions": [
        {
            "type": "file",
            "pattern": "src/**/*.ts",
            "content_rules": [
                {
                    "mode": "regex",
                    "pattern": "(api[_-]?key|secret)\\\\s*[:=]\\\\s*['\\\"][^'\\\"]{8,}['\\\"]",
                    "flags": "i"
                }
            ]
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();
            expect(result.rules?.conditions).toHaveLength(1);

            const condition = result.rules?.conditions?.[0] as { type: string; pattern: string };
            expect(condition.type).toBe('file');
            expect(condition.pattern).toBe('src/**/*.ts');
        });

        it('should parse multiple FileRule conditions (one per file glob)', async () => {
            const content = `
## DECISION-SEC-002
**Rules**: \`\`\`json
{
    "match_mode": "any",
    "conditions": [
        {
            "type": "file",
            "pattern": "src/**/*.ts",
            "content_rules": [{ "mode": "string", "patterns": ["router.get("] }]
        },
        {
            "type": "file",
            "pattern": "src/**/*.js",
            "content_rules": [{ "mode": "string", "patterns": ["router.get("] }]
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();
            expect(result.rules?.conditions).toHaveLength(2);
        });
        it('should reject the old wrong template schema: {files:[...], content:{...}} without type or pattern', async () => {
            // The old (buggy) template format — conditions have no `type` and no `pattern` (string),
            // so isFileRule() returns false and they fall through as empty RuleConditions.
            // This test documents that the parser does NOT treat them as valid FileRules.
            const content = `
## DECISION-WRONG
**Rules**: \`\`\`json
{
    "match": "any",
    "conditions": [
        {
            "files": ["src/**/*.ts"],
            "content": {
                "mode": "regex",
                "pattern": "api_key",
                "flags": "i"
            }
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            // The old schema parses as JSON without throwing, but none of the conditions
            // have `type === "file"` and a `pattern` string — so they will not be
            // dispatched to evaluateSingleRule(), producing zero matches at runtime.
            // Confirm conditions are NOT recognised as FileRules (no `type` field).
            const condition = result.rules?.conditions?.[0] as Record<string, unknown> | undefined;
            // Either parsing fails or the condition lacks `type:"file"` — either way it must NOT have type === "file"
            expect(condition?.type).not.toBe('file');
        });
    });

    describe('BUG-002 Regression — string mode singular pattern coercion', () => {
        it('should accept singular "pattern" string in string mode and coerce to patterns array', async () => {
            const content = `
## DECISION-BUG002
**Rules**: \`\`\`json
{
    "type": "file",
    "pattern": "src/**/*.ts",
    "content_rules": [
        {
            "mode": "string",
            "pattern": "router.post("
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            // Must NOT fail — coercion must have happened silently
            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();
        });

        it('should coerce singular pattern and expose it as patterns array on the content rule object', async () => {
            const content = `
## DECISION-BUG002-B
**Rules**: \`\`\`json
{
    "match_mode": "any",
    "conditions": [
        {
            "type": "file",
            "pattern": "src/**/*.ts",
            "content_rules": [
                {
                    "mode": "string",
                    "pattern": "router.post("
                }
            ]
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();

            // After coercion the content rule must expose a `patterns` array
            const condition = result.rules?.conditions?.[0] as { content_rules?: Array<Record<string, unknown>> };
            const contentRule = condition?.content_rules?.[0];
            expect(Array.isArray(contentRule?.['patterns'])).toBe(true);
            expect(contentRule?.['patterns']).toEqual(['router.post(']);
        });

        it('should leave existing patterns array untouched when patterns is already an array', async () => {
            const content = `
## DECISION-BUG002-C
**Rules**: \`\`\`json
{
    "type": "file",
    "pattern": "src/**/*.ts",
    "content_rules": [
        {
            "mode": "string",
            "patterns": ["router.post(", "router.put("]
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();
        });

        it('should throw (and return error) for string mode with neither pattern nor patterns', async () => {
            const content = `
## DECISION-BUG002-D
**Rules**: \`\`\`json
{
    "type": "file",
    "pattern": "src/**/*.ts",
    "content_rules": [
        {
            "mode": "string"
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            // Neither pattern nor patterns provided — should still be an error
            expect(result.rules).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('String mode requires');
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

    describe('BUG-005 Regression — content_match_mode validation', () => {
        it('should accept content_match_mode: "any" on a FileRule', async () => {
            const content = `
## DECISION-BUG005-A
**Rules**: \`\`\`json
{
    "type": "file",
    "pattern": "src/**/*.ts",
    "content_match_mode": "any",
    "content_rules": [
        { "mode": "string", "patterns": ["router.post("] },
        { "mode": "regex", "pattern": "authMiddleware" }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();
        });

        it('should accept content_match_mode: "all" on a FileRule', async () => {
            const content = `
## DECISION-BUG005-B
**Rules**: \`\`\`json
{
    "type": "file",
    "pattern": "src/**/*.ts",
    "content_match_mode": "all",
    "content_rules": [
        { "mode": "string", "patterns": ["router.post("] },
        { "mode": "regex", "pattern": "authMiddleware" }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();
        });

        it('should reject an invalid content_match_mode value', async () => {
            const content = `
## DECISION-BUG005-C
**Rules**: \`\`\`json
{
    "type": "file",
    "pattern": "src/**/*.ts",
    "content_match_mode": "invalid",
    "content_rules": [
        { "mode": "string", "patterns": ["foo"] }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.rules).toBeNull();
            expect(result.error).toContain('Invalid content_match_mode');
        });

        it('should accept content_match_mode: "all" inside a conditions array', async () => {
            const content = `
## DECISION-BUG005-D
**Rules**: \`\`\`json
{
    "match_mode": "all",
    "conditions": [
        {
            "type": "file",
            "pattern": "src/api/**/*.ts",
            "content_match_mode": "all",
            "content_rules": [
                { "mode": "string", "patterns": ["router.post("] },
                { "mode": "regex", "pattern": "authMiddleware" }
            ]
        }
    ]
}
\`\`\`
            `;

            const result = await parser.extractRules(content, path.join(workspaceDir, 'decisions.md'));

            expect(result.error).toBeUndefined();
            expect(result.rules).toBeDefined();
            expect(result.rules?.conditions).toHaveLength(1);
        });
    });
});

