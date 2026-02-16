"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMatcher = void 0;
/**
 * FileMatcher — matches changed files against decision patterns.
 */
const minimatch_1 = require("minimatch");
const trie_1 = require("./trie");
const rule_evaluator_1 = require("./rule-evaluator");
const metrics_1 = require("./metrics");
class FileMatcher {
    normalizedDecisions;
    trie;
    ruleEvaluator;
    logger;
    constructor(decisions, logger) {
        this.logger = logger;
        this.ruleEvaluator = new rule_evaluator_1.RuleEvaluator(logger);
        this.normalizedDecisions = decisions.map((d) => ({
            ...d,
            files: d.files.map((f) => f.replace(/\\/g, '/').normalize('NFC')),
        }));
        const activeDecisions = this.normalizedDecisions.filter((d) => d.status === 'active');
        this.trie = new trie_1.PatternTrie(activeDecisions);
    }
    /**
     * Find matches using advanced rules
     */
    async findMatchesWithDiffs(fileDiffs) {
        const activeDecisions = this.normalizedDecisions.filter((d) => d.status === 'active');
        metrics_1.metrics.addDecisionsEvaluated(activeDecisions.length);
        const matches = [];
        const ruleDecisions = activeDecisions.filter((d) => d.rules);
        const patternDecisions = activeDecisions.filter((d) => !d.rules);
        if (patternDecisions.length > 0) {
            const patternDecisionSet = new Set(patternDecisions);
            const decisionMatches = new Map();
            for (const fileDiff of fileDiffs) {
                const normalizedFile = fileDiff.filename.replace(/\\/g, '/').normalize('NFC');
                const candidates = this.trie.findCandidates(normalizedFile);
                for (const decision of candidates) {
                    if (!patternDecisionSet.has(decision))
                        continue;
                    const matchedPattern = this.matchesDecision(normalizedFile, decision);
                    if (matchedPattern) {
                        if (!decisionMatches.has(decision)) {
                            decisionMatches.set(decision, { files: [], patterns: new Set() });
                        }
                        const matchData = decisionMatches.get(decision);
                        matchData.files.push(normalizedFile);
                        matchData.patterns.add(matchedPattern);
                    }
                }
            }
            for (const [decision, data] of decisionMatches) {
                for (const file of data.files) {
                    const matchedPattern = this.matchesDecision(file, decision);
                    if (matchedPattern) {
                        matches.push({
                            file, decision, matchedPattern,
                            matchDetails: {
                                matched: true,
                                matchedFiles: [file],
                                matchedPatterns: [matchedPattern],
                                ruleDepth: 0,
                            },
                        });
                    }
                }
            }
        }
        if (ruleDecisions.length > 0) {
            const CONCURRENCY = 50;
            const totalBatches = Math.ceil(ruleDecisions.length / CONCURRENCY);
            for (let i = 0; i < ruleDecisions.length; i += CONCURRENCY) {
                const batchNum = Math.floor(i / CONCURRENCY) + 1;
                this.logger.debug(`Processing rule batch ${batchNum}/${totalBatches}...`);
                const batch = ruleDecisions.slice(i, i + CONCURRENCY);
                const batchResults = await Promise.allSettled(batch.map(async (decision) => {
                    const result = await this.ruleEvaluator.evaluate(decision.rules, fileDiffs);
                    if (result.matched) {
                        return {
                            file: result.matchedFiles.join(', '),
                            decision,
                            matchedPattern: result.matchedPatterns.slice(0, 3).join(', '),
                            matchDetails: result,
                        };
                    }
                    return null;
                }));
                const successfulResults = batchResults
                    .filter((r) => r.status === 'fulfilled' && r.value !== null)
                    .map((r) => r.value);
                const failures = batchResults.filter((r) => r.status === 'rejected');
                if (failures.length > 0) {
                    this.logger.warning(`${failures.length} decision evaluations failed in this batch. Check debug logs for details.`);
                    failures.forEach((f) => this.logger.debug(`Decision evaluation failed: ${f.reason}`));
                }
                matches.push(...successfulResults);
            }
        }
        return matches.sort((a, b) => {
            return activeDecisions.indexOf(a.decision) - activeDecisions.indexOf(b.decision);
        });
    }
    /**
     * Find all decisions that protect the given changed files
     */
    async findMatches(changedFiles) {
        const activeDecisions = this.normalizedDecisions.filter((d) => d.status === 'active');
        metrics_1.metrics.addDecisionsEvaluated(activeDecisions.length);
        const CHUNK_SIZE = 500;
        if (changedFiles.length > CHUNK_SIZE) {
            const chunks = [];
            for (let i = 0; i < changedFiles.length; i += CHUNK_SIZE) {
                chunks.push(changedFiles.slice(i, i + CHUNK_SIZE));
            }
            const results = chunks.map((chunk) => this.processChunk(chunk));
            return results.flat();
        }
        return this.processChunk(changedFiles);
    }
    processChunk(files) {
        const matches = [];
        for (const file of files) {
            const normalizedFile = file.replace(/\\/g, '/');
            const candidates = this.trie.findCandidates(normalizedFile);
            for (const decision of candidates) {
                const matchedPattern = this.matchesDecision(normalizedFile, decision);
                if (matchedPattern) {
                    matches.push({ file: normalizedFile, decision, matchedPattern, });
                }
            }
        }
        return matches;
    }
    /**
     * Check if a file matches any pattern in a decision
     */
    matchesDecision(file, decision) {
        let matchedPattern = null;
        let isMatch = false;
        for (const pattern of decision.files) {
            if (pattern.startsWith('!')) {
                if (this.matchesPattern(file, pattern.substring(1))) {
                    return null;
                }
            }
            else {
                if (this.matchesPattern(file, pattern)) {
                    isMatch = true;
                    matchedPattern = pattern;
                }
            }
        }
        return isMatch ? matchedPattern : null;
    }
    /**
     * Check if a file matches a glob pattern
     */
    matchesPattern(file, pattern) {
        const normalizedFile = file.normalize('NFC');
        return (0, minimatch_1.minimatch)(normalizedFile, pattern, {
            dot: true,
            matchBase: false,
            nocase: false,
            nobrace: false,
        });
    }
    /**
     * Group matches by severity for prioritization
     */
    groupBySeverity(matches) {
        return {
            critical: matches.filter((m) => m.decision.severity === 'critical'),
            warning: matches.filter((m) => m.decision.severity === 'warning'),
            info: matches.filter((m) => m.decision.severity === 'info'),
        };
    }
}
exports.FileMatcher = FileMatcher;
