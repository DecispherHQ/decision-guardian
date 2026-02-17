"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentMatchers = void 0;
/**
 * Content Matchers - Match content patterns within file diffs
 */
const parse_diff_1 = __importDefault(require("parse-diff"));
const safe_regex_1 = __importDefault(require("safe-regex"));
const vm_1 = __importDefault(require("vm"));
const logger_1 = require("./logger");
const crypto = __importStar(require("crypto"));
class ContentMatchers {
    resultCache = new Map();
    MAX_CACHE_SIZE = 500;
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Match string patterns in changed lines
     */
    matchString(rule, fileDiff) {
        const changedLines = this.getChangedLines(fileDiff.patch);
        const matchedPatterns = [];
        for (const pattern of rule.patterns || []) {
            if (changedLines.some((line) => line.includes(pattern))) {
                matchedPatterns.push(pattern);
            }
        }
        return {
            matched: matchedPatterns.length > 0,
            matchedPatterns,
        };
    }
    /**
     * Match regex pattern in changed content
     */
    async matchRegex(rule, fileDiff) {
        if (rule.pattern && !(0, safe_regex_1.default)(rule.pattern)) {
            (0, logger_1.logStructured)(this.logger, 'warning', `[Security] Unsafe regex pattern rejected`, {
                pattern: rule.pattern,
            });
            return { matched: false, matchedPatterns: [] };
        }
        const ALLOWED_FLAGS = /^[gimsuy]*$/;
        if (rule.flags && !ALLOWED_FLAGS.test(rule.flags)) {
            (0, logger_1.logStructured)(this.logger, 'warning', `[Security] Invalid regex flags rejected`, {
                flags: rule.flags,
            });
            return { matched: false, matchedPatterns: [] };
        }
        const changedContent = this.getChangedLines(fileDiff.patch).join('\n');
        const MAX_CONTENT_SIZE = 1024 * 1024;
        if (changedContent.length > MAX_CONTENT_SIZE) {
            (0, logger_1.logStructured)(this.logger, 'warning', `[Security] Content exceeds size limit`, {
                size: changedContent.length,
                limit: MAX_CONTENT_SIZE,
            });
            return { matched: false, matchedPatterns: [] };
        }
        if (rule.pattern && rule.pattern.length > 1000) {
            (0, logger_1.logStructured)(this.logger, 'warning', `[Security] Regex pattern too complex`, {
                length: rule.pattern.length,
            });
            return { matched: false, matchedPatterns: [] };
        }
        const cacheKey = this.createCacheKey(rule.pattern, rule.flags || '', changedContent);
        const cached = this.resultCache.get(cacheKey);
        if (cached !== undefined) {
            return {
                matched: cached,
                matchedPatterns: cached ? [rule.pattern] : [],
            };
        }
        try {
            const matched = this.runRegexWithTimeout(rule.pattern, rule.flags, changedContent, 5000);
            this.updateCache(cacheKey, matched);
            return {
                matched,
                matchedPatterns: matched ? [rule.pattern] : [],
            };
        }
        catch (error) {
            const errorMessage = String(error);
            (0, logger_1.logStructured)(this.logger, 'warning', `Regex check failed for pattern`, {
                pattern: rule.pattern,
                error: errorMessage,
            });
            // Fail closed: treat error/timeout as a match (security risk)
            return {
                matched: true,
                matchedPatterns: [`Regex check failed: ${errorMessage}`]
            };
        }
    }
    /**
     * Run Regex in a VM sandbox with timeout
     */
    runRegexWithTimeout(pattern, flags, text, timeoutMs) {
        const sandbox = Object.create(null);
        sandbox.result = false;
        sandbox.text = String(text);
        sandbox.pattern = String(pattern);
        sandbox.flags = String(flags || '');
        const context = vm_1.default.createContext(sandbox, {
            name: 'RegexSandbox',
            codeGeneration: {
                strings: false,
                wasm: false,
            },
        });
        const code = `
        'use strict';
        try {
            const regex = new RegExp(pattern, flags);
            result = regex.test(text);
        } catch (e) {
            result = false;
        }
        `;
        vm_1.default.runInContext(code, context, {
            timeout: timeoutMs,
            displayErrors: false,
        });
        return Boolean(sandbox.result);
    }
    /**
     * Match if changes occur within specified line range
     */
    matchLineRange(rule, fileDiff) {
        const changedLineNumbers = this.extractChangedLineNumbers(fileDiff.patch);
        const matched = changedLineNumbers.some((lineNum) => lineNum >= rule.start && lineNum <= rule.end);
        return {
            matched,
            matchedPatterns: matched ? [`lines ${rule.start}-${rule.end}`] : [],
        };
    }
    /**
     * Full file mode - any change to the file matches
     */
    matchFullFile(_fileDiff) {
        return {
            matched: true,
            matchedPatterns: ['full_file'],
        };
    }
    /**
     * JSON path mode - check if specific JSON keys changed
     */
    matchJsonPath(rule, fileDiff) {
        const changedLines = this.getChangedLines(fileDiff.patch).join('\n');
        const matchedPatterns = [];
        for (const path of rule.paths || []) {
            const key = path.split('.').pop() || path;
            // still heuristic but avoids matching random string occurrences
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const keyRegex = new RegExp(`"${escapedKey}"\\s*:`);
            if (keyRegex.test(changedLines)) {
                matchedPatterns.push(path);
            }
        }
        return {
            matched: matchedPatterns.length > 0,
            matchedPatterns,
        };
    }
    createCacheKey(pattern, flags, content) {
        const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
        return `${pattern}:${flags}:${contentHash}`;
    }
    updateCache(key, value) {
        if (this.resultCache.size >= this.MAX_CACHE_SIZE) {
            const toEvict = Math.floor(this.MAX_CACHE_SIZE * 0.1);
            const iterator = this.resultCache.keys();
            for (let i = 0; i < toEvict; i++) {
                const firstKey = iterator.next().value;
                if (firstKey)
                    this.resultCache.delete(firstKey);
            }
        }
        this.resultCache.set(key, value);
    }
    /**
     * Extract changed (added) lines from diff using parse-diff
     */
    getChangedLines(patch) {
        if (!patch)
            return [];
        try {
            const fullDiff = `diff --git a/file b/file
--- a/file
+++ b/file
${patch}`;
            const parsed = (0, parse_diff_1.default)(fullDiff);
            const lines = [];
            for (const file of parsed) {
                for (const chunk of file.chunks) {
                    for (const change of chunk.changes) {
                        if (change.type === 'add') {
                            lines.push(change.content.substring(1));
                        }
                    }
                }
            }
            return lines;
        }
        catch (error) {
            (0, logger_1.logStructured)(this.logger, 'warning', `[Parsing] Failed to parse diff content`, {
                error: String(error),
            });
            return [];
        }
    }
    /**
     * Extract line numbers of changed lines using parse-diff
     */
    extractChangedLineNumbers(patch) {
        if (!patch)
            return [];
        try {
            const fullDiff = `diff --git a/file b/file
--- a/file
+++ b/file
${patch}`;
            const parsed = (0, parse_diff_1.default)(fullDiff);
            const lineNumbers = [];
            for (const file of parsed) {
                for (const chunk of file.chunks) {
                    for (const change of chunk.changes) {
                        if (change.type === 'add' && change.ln) {
                            lineNumbers.push(change.ln);
                        }
                    }
                }
            }
            return lineNumbers;
        }
        catch (error) {
            (0, logger_1.logStructured)(this.logger, 'warning', `[Parsing] Failed to parse diff line numbers`, {
                error: String(error),
            });
            return [];
        }
    }
}
exports.ContentMatchers = ContentMatchers;
