/**
 * Represents a parsed decision from decisions.md
 */
import { RuleCondition } from './rule-types';

export interface Decision {
    // Identity
    id: string; // e.g., "DECISION-001", "DECISION-TEST-001"

    // Metadata
    title: string;
    date: string; // ISO 8601 or simple date
    status: DecisionStatus;
    severity: Severity;
    schemaVersion: 1; // Version discriminator for decision schema

    // Protection Rules (legacy)
    files: string[];

    // Advanced Rules (new)
    rules?: RuleCondition; // JSON-based rule conditions

    // Content
    context: string;

    // Source tracking
    sourceFile: string; // Path to decisions.md
    lineNumber: number; // For error reporting
}

export type DecisionStatus = 'active' | 'deprecated' | 'superseded' | 'archived';
export type Severity = 'info' | 'warning' | 'critical';

/**
 * Represents a file diff from a changeset (PR, MR, local git diff)
 */
export interface FileDiff {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
    patch: string; // The actual unified diff content
    previous_filename?: string;
}

/**
 * Rule evaluation result details
 */
export interface RuleMatchDetails {
    matched: boolean;
    matchedPatterns: string[];
    matchedFiles: string[];
    ruleDepth: number;
    error?: string; // For error boundary reporting
}

/**
 * Represents a file that matches a decision's protection rules
 */
export interface DecisionMatch {
    file: string; // Changed file path
    decision: Decision;
    matchedPattern: string; // Which pattern matched
    matchDetails?: RuleMatchDetails; // Detailed match info for rule-based matches
}

/**
 * Configuration for the action / CLI
 */
export interface ActionConfig {
    decisionFile: string; // Path to decisions.md
    failOnCritical: boolean; // Should critical violations fail the check?
    failOnError: boolean; // Should parse errors fail the check?
    token: string; // Auth token (GitHub token, GitLab token, etc.)
}

/**
 * Result of parsing decisions.md
 */
export interface ParseResult {
    decisions: Decision[];
    errors: ParseError[];
    warnings: string[];
}

export interface ParseError {
    line: number;
    message: string;
    context?: string;
}
