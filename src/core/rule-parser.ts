/**
 * Rule Parser - Extracts JSON rules from markdown decision blocks
 */
import * as fs from 'fs/promises';
import safeRegex from 'safe-regex';
import * as path from 'path';
import { RuleCondition, ContentRule, FileRule, MAX_RULE_DEPTH, isFileRule } from './rule-types';

export interface RuleParseResult {
  rules: RuleCondition | null;
  error?: string;
}

export class RuleParser {
  /**
   * Extract JSON rules from markdown content
   * Supports:
   * 1. Inline JSON: **Rules**: followed by ```json ... ```
   * 2. External File: **Rules**: [Link](./path) or just path
   */
  async extractRules(content: string, sourceFilePath: string): Promise<RuleParseResult> {
    // 1. Try inline JSON first
    const rulesMatch = content.match(/\*\*Rules\*\*:\s*```json\s+([\s\S]+?)\s+```/i);

    if (rulesMatch) {
      try {
        const parsed = JSON.parse(rulesMatch[1]) as RuleCondition;
        const validated = this.validate(parsed, 0);
        return { rules: validated };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          rules: null,
          error: `Failed to parse inline JSON rules: ${message}`,
        };
      }
    }

    // 2. Try external file reference
    // Matches: **Rules**: [Label](path) or **Rules**: path/to/file.json
    const linkMatch = content.match(/\*\*Rules\*\*:\s*(?:\[.*?\]\((.*?)\)|(\S+\.json))/i);

    if (linkMatch) {
      const relPath = linkMatch[1] || linkMatch[2];
      try {
        const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();
        const sourceDir = path.dirname(sourceFilePath);

        // Resolve path relative to the decision file
        const resolvedPath = path.resolve(sourceDir, relPath);

        const normalizedWorkspace = path.normalize(workspaceRoot);
        const normalizedPath = path.normalize(resolvedPath);

        // Security check: Reject paths outside workspace (Path Traversal protection)
        // We also strictly reject Windows-specific absolute paths (like C:\...) on non-Windows platforms
        // to prevent them from being interpreted as relative filenames
        const isWindowsSpecificAbsolute =
          path.win32.isAbsolute(relPath) && !path.posix.isAbsolute(relPath);
        const isCrossPlatformAbsolute = process.platform !== 'win32' && isWindowsSpecificAbsolute;

        if (
          (!resolvedPath.startsWith(normalizedWorkspace + path.sep) &&
            resolvedPath !== normalizedWorkspace) ||
          isCrossPlatformAbsolute
        ) {
          return {
            rules: null,
            error:
              `Security Error: External rule file '${relPath}' resolves to a path outside the workspace. ` +
              `Only files within the workspace are allowed. ` +
              `Resolved: ${normalizedPath}, Workspace: ${normalizedWorkspace}`,
          };
        }

        const fileContent = await fs.readFile(resolvedPath, 'utf-8');
        const parsed = JSON.parse(fileContent) as RuleCondition;
        const validated = this.validate(parsed, 0);
        return { rules: validated };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          rules: null,
          error: `Failed to load external rules from ${relPath}: ${message}`,
        };
      }
    }

    return { rules: null };
  }

  /**
   * Validate rule structure with depth tracking
   */
  private validate(rules: RuleCondition, depth: number): RuleCondition {
    if (depth > MAX_RULE_DEPTH) {
      throw new Error(`Rule nesting exceeds max depth of ${MAX_RULE_DEPTH}`);
    }

    if (!rules.match_mode) {
      rules.match_mode = 'any';
    }

    if (rules.pattern && !rules.conditions) {
      this.validateFileRule(rules as unknown as FileRule);
      return rules;
    }
    if (rules.conditions && Array.isArray(rules.conditions)) {
      for (const condition of rules.conditions) {
        if (isFileRule(condition)) {
          this.validateFileRule(condition);
        } else {
          this.validate(condition as RuleCondition, depth + 1);
        }
      }
    }

    return rules;
  }

  /**
   * Validate a file rule
   */
  private validateFileRule(rule: FileRule): void {
    if (!rule.pattern) {
      throw new Error('FileRule must have a pattern');
    }

    if (rule.content_rules && Array.isArray(rule.content_rules)) {
      for (const contentRule of rule.content_rules) {
        this.validateContentRule(contentRule);
      }
    }
  }

  /**
   * Validate a content rule
   */
  private validateContentRule(rule: ContentRule): void {
    const validModes = ['string', 'regex', 'line_range', 'full_file', 'json_path'];

    if (!validModes.includes(rule.mode)) {
      throw new Error(`Invalid content rule mode: ${rule.mode}`);
    }

    switch (rule.mode) {
      case 'string': {
        if (!rule.patterns || !Array.isArray(rule.patterns)) {
          throw new Error('String mode requires patterns array');
        }
        break;
      }
      case 'regex': {
        if (!rule.pattern) {
          throw new Error('Regex mode requires pattern');
        }

        let isSafe;
        try {
          isSafe = safeRegex(rule.pattern);
        } catch (e) {
          throw new Error(`Invalid regex pattern (safe-check failed): ${rule.pattern}`);
        }

        if (!isSafe) {
          throw new Error(`Unsafe regex pattern: ${rule.pattern}`);
        }

        const ALLOWED_FLAGS = /^[gimsuy]*$/;
        if (rule.flags && !ALLOWED_FLAGS.test(rule.flags)) {
          throw new Error(`Invalid regex flags: ${rule.flags}`);
        }

        try {
          new RegExp(rule.pattern, rule.flags || '');
        } catch (e) {
          throw new Error(`Invalid regex pattern syntax: ${rule.pattern}`);
        }
        break;
      }
      case 'line_range':
        if (typeof rule.start !== 'number' || typeof rule.end !== 'number') {
          throw new Error('Line range mode requires start and end numbers');
        }
        if (rule.start > rule.end) {
          throw new Error('Line range start must be <= end');
        }
        break;
      case 'json_path':
        if (!rule.paths || !Array.isArray(rule.paths)) {
          throw new Error('JSON path mode requires paths array');
        }
        break;
      case 'full_file':
        break;
    }
  }
}
