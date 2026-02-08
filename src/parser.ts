import * as fs from 'fs/promises';
import * as path from 'path';
import { Decision, ParseResult, ParseError, DecisionStatus, Severity } from './types';
import { RuleParser } from './rule-parser';

export class DecisionParser {
  private readonly ruleParser = new RuleParser();

  private readonly STATUS_SYNONYMS: Record<string, DecisionStatus> = {
    active: 'active',
    enabled: 'active',
    live: 'active',
    deprecated: 'deprecated',
    obsolete: 'deprecated',
    superseded: 'superseded',
    replaced: 'superseded',
    archived: 'archived',
    inactive: 'archived',
  };

  private readonly SEVERITY_SYNONYMS: Record<string, Severity> = {
    info: 'info',
    informational: 'info',
    low: 'info',
    warning: 'warning',
    warn: 'warning',
    medium: 'warning',
    critical: 'critical',
    error: 'critical',
    high: 'critical',
    blocker: 'critical',
  };

  /**
   * Parse a decisions.md file
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    const normalizedWorkspace = path.normalize(workspaceRoot);

    if (
      !resolvedPath.startsWith(normalizedWorkspace + path.sep) &&
      resolvedPath !== normalizedWorkspace
    ) {
      return {
        decisions: [],
        errors: [
          {
            line: 0,
            message: `Security: Path traversal detected - ${filePath}`,
          },
        ],
        warnings: [],
      };
    }

    try {
      const stat = await fs.stat(resolvedPath);

      if (stat.isDirectory()) {
        return this.parseDirectory(resolvedPath);
      }

      const content = await fs.readFile(resolvedPath, 'utf-8');
      return await this.parseContent(content, resolvedPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        decisions: [],
        errors: [
          {
            line: 0,
            message: `Failed to read file: ${message}`,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Recursively parse a directory for rule files
   */
  async parseDirectory(dirPath: string): Promise<ParseResult> {
    const combinedResult: ParseResult = {
      decisions: [],
      errors: [],
      warnings: [],
    };

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories like .git
          if (entry.name.startsWith('.')) continue;

          const subResult = await this.parseDirectory(fullPath);
          this.mergeResults(combinedResult, subResult);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))
        ) {

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const fileResult = await this.parseContent(content, fullPath);
            this.mergeResults(combinedResult, fileResult);
          } catch (err) {
            combinedResult.errors.push({
              line: 0,
              message: `Failed to parse ${entry.name}: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
      }
    } catch (error) {
      combinedResult.errors.push({
        line: 0,
        message: `Failed to list directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return combinedResult;
  }

  private mergeResults(target: ParseResult, source: ParseResult) {
    target.decisions.push(...source.decisions);
    target.errors.push(...source.errors);
    target.warnings.push(...source.warnings);
  }

  /**
   * Parse markdown content into decisions
   */
  async parseContent(content: string, sourceFile: string): Promise<ParseResult> {
    const decisions: Decision[] = [];
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    const blocks = this.splitIntoBlocks(content);

    for (const block of blocks) {
      try {
        const decision = await this.parseBlock(block, sourceFile, warnings);

        if (!decision.id || !decision.title) {
          errors.push({
            line: block.lineNumber,
            message: `Decision missing required fields (id or title)`,
            context: block.raw.substring(0, 100),
          });
          continue;
        }

        decisions.push(decision);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          line: block.lineNumber,
          message,
          context: block.raw.substring(0, 100),
        });
      }
    }

    return { decisions, errors, warnings };
  }

  /**
   * Split content into decision blocks
   */
  private splitIntoBlocks(content: string): DecisionBlock[] {
    if (!content.trim()) {
      return [];
    }

    const blocks: DecisionBlock[] = [];
    const markerPattern = /<!--\s*DECISION-(?:[A-Z0-9]+-)*[A-Z0-9]+\s*-->/gi;

    let match;
    const markers: number[] = [];

    while ((match = markerPattern.exec(content)) !== null) {
      markers.push(match.index);
    }

    // Split at markers
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i];
      const end = markers[i + 1] || content.length;
      const blockContent = content.substring(start, end);

      blocks.push({
        raw: blockContent,
        lineNumber: this.computeLineStart(content, blockContent),
      });
    }

    return blocks;
  }

  /**
   * Compute the line number where a block starts
   */
  private computeLineStart(fullContent: string, blockContent: string): number {
    const index = fullContent.indexOf(blockContent);
    if (index === -1) return 1;

    const before = fullContent.substring(0, index);
    return before.split(/\r?\n/).length;
  }

  /**
   * Parse a single decision block
   */
  private async parseBlock(
    block: DecisionBlock,
    sourceFile: string,
    warnings: string[],
  ): Promise<Decision> {
    const content = block.raw;

    const idMatch = content.match(/<!--\s*(DECISION-(?:[A-Z0-9]+-)*[A-Z0-9]+)\s*-->/i);
    const id = idMatch ? idMatch[1].toUpperCase() : '';

    const titleMatch = content.match(/##\s*Decision:\s*(.+)/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const statusRaw = this.extractField(content, 'Status', 'active');
    const date = this.extractField(content, 'Date', new Date().toISOString().split('T')[0]);
    const severityRaw = this.extractField(content, 'Severity', 'info');

    this.validateDate(date, id, warnings);

    const files = this.extractFilesList(content);

    const ruleResult = await this.ruleParser.extractRules(content, sourceFile);
    if (ruleResult.error) {
      warnings.push(`${id}: ${ruleResult.error}`);
    }

    const contextMatch = content.match(/###\s*Context\s*\n([\s\S]+?)(?=\n---+|\n<!--|$)/);
    const context = contextMatch ? contextMatch[1].trim() : '';

    return {
      id,
      title,
      date,
      status: this.normalizeStatus(statusRaw),
      severity: this.normalizeSeverity(severityRaw),
      schemaVersion: 1,
      files,
      rules: ruleResult.rules ?? undefined,
      context,
      sourceFile,
      lineNumber: block.lineNumber,
    };
  }

  /**
   * Extract a metadata field like "**Status**: Active"
   */
  private extractField(content: string, fieldName: string, defaultValue: string): string {
    const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^\\*\\*${escaped}\\*\\*:\\s*(.+)$`, 'im');
    const match = content.match(regex);
    return match ? match[1].trim() : defaultValue;
  }

  /**
   * Extract list of file patterns
   */
  private extractFilesList(content: string): string[] {
    const files: string[] = [];

    const filesMatch = content.match(/\*\*Files\*\*:\s*\n/);
    if (!filesMatch || filesMatch.index === undefined) {
      return files;
    }

    const startPos = filesMatch.index + filesMatch[0].length;
    const remainingContent = content.substring(startPos);
    const lines = remainingContent.split('\n');
    for (const line of lines) {
      const withBackticks = line.match(/^\s*[-*]\s*`([^`]+)`\s*$/);
      const withoutBackticks = line.match(/^\s*[-*]\s+([^\s`]+)\s*$/);

      if (withBackticks) {
        files.push(withBackticks[1].trim());
      } else if (withoutBackticks) {
        files.push(withoutBackticks[1].trim());
      } else if (line.trim() !== '') {
        break;
      }
    }

    return files;
  }

  /**
   * Validate date format and provide warnings
   */
  private validateDate(dateString: string, decisionId: string, warnings: string[]): void {
    if (!dateString) return;

    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRegex.test(dateString)) {
      warnings.push(`Decision ${decisionId}: Invalid date format '${dateString}' - use YYYY-MM-DD`);
      return;
    }

    const parsed = new Date(dateString + 'T00:00:00Z');

    if (isNaN(parsed.getTime())) {
      warnings.push(`Decision ${decisionId}: Invalid date format '${dateString}' - use YYYY-MM-DD`);
      return;
    }

    const [year, month, day] = dateString.split('-').map(Number);
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      warnings.push(`Decision ${decisionId}: Invalid date '${dateString}' (day doesn't exist)`);
      return;
    }

    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);

    if (parsed > now) {
      warnings.push(`Decision ${decisionId}: Date is in the future - is this correct?`);
    } else if (parsed < tenYearsAgo) {
      warnings.push(`Decision ${decisionId}: Date is >10 years old - consider archiving`);
    }
  }

  /**
   * Normalize status using synonyms
   */
  private normalizeStatus(status: string): DecisionStatus {
    const normalized = status.toLowerCase().trim();
    return this.STATUS_SYNONYMS[normalized] || 'active';
  }

  /**
   * Normalize severity using synonyms
   */
  private normalizeSeverity(severity: string): Severity {
    const normalized = severity.toLowerCase().trim();
    return this.SEVERITY_SYNONYMS[normalized] || 'info';
  }
}

interface DecisionBlock {
  raw: string;
  lineNumber: number;
}
