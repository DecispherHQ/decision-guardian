/**
 * Rule Types for Advanced Decision Rules System
 * Provides fine-grained control over what changes trigger decision alerts
 */

/** Safety limit for nested rules to prevent stack overflow */
export const MAX_RULE_DEPTH = 10;

/** Match modes for combining conditions */
export type MatchMode = 'any' | 'all'; // OR | AND

/**
 * Content matching modes
 * Phase 1: string, regex, line_range, full_file
 * Phase 2: json_path (future)
 */
export type ContentMatchMode = 'string' | 'regex' | 'line_range' | 'full_file' | 'json_path';

/**
 * Content rule for matching within file diffs
 */
export interface ContentRule {
  /** The matching mode to use */
  mode: ContentMatchMode;

  /** String patterns to search for (for 'string' mode) */
  patterns?: string[];

  /** Regex pattern (for 'regex' mode) */
  pattern?: string;

  /** Regex flags, e.g., 'i' for case-insensitive (for 'regex' mode) */
  flags?: string;

  /** Start line number (for 'line_range' mode) */
  start?: number;

  /** End line number (for 'line_range' mode) */
  end?: number;

  /** JSON paths to check (for 'json_path' mode - Phase 2) */
  paths?: string[];

  /** Only match in changed lines, not context (default: true) */
  match_changed_lines_only?: boolean;
}

/**
 * File-level rule with optional content rules
 */
export interface FileRule {
  /** Rule type identifier */
  type: 'file';

  /** Glob pattern to match file paths */
  pattern: string;

  /** Optional glob pattern to exclude files */
  exclude?: string;

  /** Content rules to apply to matched files */
  content_rules?: ContentRule[];
}

/**
 * Rule condition that can be nested for complex logic
 */
export interface RuleCondition {
  /** How to combine conditions: 'any' (OR) or 'all' (AND) */
  match_mode?: MatchMode;

  /** Nested conditions (can be FileRule or another RuleCondition) */
  conditions?: (FileRule | RuleCondition)[];

  // For simple single-rule cases, allow direct fields:
  /** Rule type for simple case */
  type?: 'file';

  /** File pattern for simple case */
  pattern?: string;

  /** Exclusion pattern for simple case */
  exclude?: string;

  /** Content rules for simple case */
  content_rules?: ContentRule[];
}

/**
 * Type guard to check if a condition is a FileRule
 */
export function isFileRule(condition: FileRule | RuleCondition): condition is FileRule {
  return (
    (condition as FileRule).type === 'file' && typeof (condition as FileRule).pattern === 'string'
  );
}

/**
 * Type guard to check if a condition is a nested RuleCondition
 */
export function isRuleCondition(condition: FileRule | RuleCondition): condition is RuleCondition {
  return Array.isArray((condition as RuleCondition).conditions);
}
