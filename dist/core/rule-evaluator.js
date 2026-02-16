"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEvaluator = void 0;
/**
 * Rule Evaluator - Evaluates decision rules against file diffs
 */
const minimatch_1 = require("minimatch");
const rule_types_1 = require("./rule-types");
const content_matchers_1 = require("./content-matchers");
class RuleEvaluator {
    contentMatchers;
    logger;
    constructor(logger) {
        this.logger = logger;
        this.contentMatchers = new content_matchers_1.ContentMatchers(logger);
    }
    /**
     * Evaluate if a changeset matches the decision rules
     */
    async evaluate(rules, fileDiffs, depth = 0) {
        // Depth safety check
        if (depth > rule_types_1.MAX_RULE_DEPTH) {
            return {
                matched: false,
                matchedPatterns: [],
                matchedFiles: [],
                ruleDepth: depth,
                error: `Rule nesting exceeds max depth of ${rule_types_1.MAX_RULE_DEPTH}`,
            };
        }
        const matchMode = rules.match_mode || 'any';
        // Check if this is a single-rule case
        if (rules.pattern && !rules.conditions) {
            return this.evaluateSingleRule(rules, fileDiffs, depth);
        }
        if (!rules.conditions || rules.conditions.length === 0) {
            return {
                matched: false,
                matchedPatterns: [],
                matchedFiles: [],
                ruleDepth: depth,
            };
        }
        const settlement = await Promise.allSettled(rules.conditions.map((condition) => {
            if ((0, rule_types_1.isFileRule)(condition)) {
                return this.evaluateSingleRule(condition, fileDiffs, depth + 1);
            }
            else {
                return this.evaluate(condition, fileDiffs, depth + 1);
            }
        }));
        const results = settlement.map((r) => r.status === 'fulfilled'
            ? r.value
            : {
                matched: false,
                matchedPatterns: [],
                matchedFiles: [],
                ruleDepth: depth + 1,
                error: `Condition evaluation failed: ${r.reason}`,
            });
        const matched = matchMode === 'all'
            ? results.every((r) => r.matched) // AND
            : results.some((r) => r.matched); // OR
        const matchedPatterns = results.flatMap((r) => r.matchedPatterns).sort();
        const matchedFiles = [...new Set(results.flatMap((r) => r.matchedFiles))].sort();
        const errors = results
            .map((r) => r.error)
            .filter(Boolean)
            .join('; ');
        return {
            matched,
            matchedPatterns,
            matchedFiles,
            ruleDepth: depth,
            error: errors || undefined,
        };
    }
    /**
     * Evaluate a single file rule with error boundary
     */
    async evaluateSingleRule(rule, fileDiffs, depth) {
        try {
            const matchingFiles = fileDiffs.filter((file) => {
                const matches = (0, minimatch_1.minimatch)(file.filename, rule.pattern, {
                    dot: true,
                    matchBase: false,
                    nocase: false,
                });
                if (matches && rule.exclude) {
                    return !(0, minimatch_1.minimatch)(file.filename, rule.exclude, {
                        dot: true,
                        matchBase: false,
                        nocase: false,
                    });
                }
                return matches;
            });
            if (matchingFiles.length === 0) {
                return {
                    matched: false,
                    matchedPatterns: [],
                    matchedFiles: [],
                    ruleDepth: depth,
                };
            }
            if (!rule.content_rules || rule.content_rules.length === 0) {
                return {
                    matched: true,
                    matchedPatterns: [rule.pattern],
                    matchedFiles: matchingFiles.map((f) => f.filename),
                    ruleDepth: depth,
                };
            }
            const allMatchedPatterns = [];
            const allMatchedFiles = [];
            for (const file of matchingFiles) {
                const contentResult = await this.evaluateContentRules(rule.content_rules, file);
                if (contentResult.matched) {
                    allMatchedPatterns.push(...contentResult.matchedPatterns);
                    allMatchedFiles.push(file.filename);
                }
            }
            return {
                matched: allMatchedFiles.length > 0,
                matchedPatterns: [...new Set(allMatchedPatterns)].sort(),
                matchedFiles: allMatchedFiles.sort(),
                ruleDepth: depth,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warning(`Rule evaluation failed for pattern "${rule.pattern}": ${message}`);
            return {
                matched: false,
                matchedPatterns: [],
                matchedFiles: [],
                ruleDepth: depth,
                error: message,
            };
        }
    }
    /**
     * Evaluate content rules against a file diff
     */
    async evaluateContentRules(rules, file) {
        const allMatchedPatterns = [];
        for (const rule of rules) {
            let result;
            switch (rule.mode) {
                case 'string':
                    result = this.contentMatchers.matchString(rule, file);
                    break;
                case 'regex':
                    result = await this.contentMatchers.matchRegex(rule, file);
                    break;
                case 'line_range':
                    result = this.contentMatchers.matchLineRange(rule, file);
                    break;
                case 'full_file':
                    result = this.contentMatchers.matchFullFile(file);
                    break;
                case 'json_path':
                    result = this.contentMatchers.matchJsonPath(rule, file);
                    break;
                default: {
                    const _exhaustiveCheck = rule.mode;
                    throw new Error(`Unhandled content match mode: ${_exhaustiveCheck}`);
                }
            }
            if (result.matched) {
                allMatchedPatterns.push(...result.matchedPatterns);
            }
        }
        return {
            matched: allMatchedPatterns.length > 0,
            matchedPatterns: allMatchedPatterns.sort(),
        };
    }
}
exports.RuleEvaluator = RuleEvaluator;
