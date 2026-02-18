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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCheck = runCheck;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const parser_1 = require("../../core/parser");
const matcher_1 = require("../../core/matcher");
const console_logger_1 = require("../../adapters/local/console-logger");
const local_git_provider_1 = require("../../adapters/local/local-git-provider");
const metrics_1 = require("../../core/metrics");
const formatter_1 = require("../formatter");
const sender_1 = require("../../telemetry/sender");
const version_1 = require("../../version");
async function runCheck(opts) {
    const logger = new console_logger_1.ConsoleLogger();
    const startTime = Date.now();
    try {
        const decisionPath = path.resolve(opts.decisionFile);
        const isDir = fs.existsSync(decisionPath) && fs.statSync(decisionPath).isDirectory();
        const parser = new parser_1.DecisionParser();
        let parseResult;
        if (isDir) {
            logger.info(`Scanning directory: ${decisionPath}`);
            parseResult = await parser.parseDirectory(decisionPath);
        }
        else {
            if (!fs.existsSync(decisionPath)) {
                logger.error(`Decision file not found: ${decisionPath}`);
                logger.info('Run "decision-guardian init" to create one.');
                process.exit(1);
            }
            logger.info(`Checking: ${decisionPath}`);
            parseResult = await parser.parseFile(decisionPath);
        }
        if (parseResult.warnings.length > 0) {
            parseResult.warnings.forEach((w) => logger.warning(w));
        }
        if (parseResult.errors.length > 0) {
            parseResult.errors.forEach((e) => logger.error(`Line ${e.line}: ${e.message}`));
            if (opts.failOnError) {
                logger.error(`Check failed: ${parseResult.errors.length} parse errors found (fail-on-error enabled)`);
                process.exit(1);
            }
        }
        if (parseResult.decisions.length === 0) {
            logger.warning('No decisions found in the specified path.');
            process.exit(0);
        }
        logger.info(`Found ${parseResult.decisions.length} decisions`);
        const gitConfig = {
            mode: opts.mode,
            baseBranch: opts.baseBranch,
            cwd: process.cwd(),
        };
        const provider = new local_git_provider_1.LocalGitProvider(gitConfig);
        const fileDiffs = await provider.getFileDiffs();
        metrics_1.metrics.addFilesProcessed(fileDiffs.length);
        if (fileDiffs.length === 0) {
            logger.info('No changed files detected.');
            process.exit(0);
        }
        logger.info(`${fileDiffs.length} files changed`);
        const matcher = new matcher_1.FileMatcher(parseResult.decisions, logger);
        let matches;
        try {
            matches = await matcher.findMatchesWithDiffs(fileDiffs);
        }
        catch {
            const fileNames = fileDiffs.map((f) => f.filename);
            matches = await matcher.findMatches(fileNames);
        }
        metrics_1.metrics.addMatchesFound(matches.length);
        metrics_1.metrics.setDuration(Date.now() - startTime);
        const grouped = matcher.groupBySeverity(matches);
        metrics_1.metrics.addCriticalMatches(grouped.critical.length);
        metrics_1.metrics.addWarningMatches(grouped.warning.length);
        metrics_1.metrics.addInfoMatches(grouped.info.length);
        console.log((0, formatter_1.formatMatchesTable)(matches));
        const snapshot = metrics_1.metrics.getSnapshot();
        console.log((0, formatter_1.formatSummary)({
            filesProcessed: snapshot.files_processed,
            decisionsEvaluated: parseResult.decisions.length,
            matchesFound: snapshot.matches_found,
            critical: grouped.critical.length,
            warning: grouped.warning.length,
            info: grouped.info.length,
            durationMs: snapshot.duration_ms,
        }));
        (0, sender_1.sendTelemetry)('cli', snapshot, version_1.VERSION).catch(() => { });
        if (opts.failOnCritical && grouped.critical.length > 0) {
            logger.error(`${grouped.critical.length} critical violations found`);
            process.exit(1);
        }
        process.exit(0);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Check failed: ${message}`);
        process.exit(1);
    }
}
