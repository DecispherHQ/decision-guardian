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
const github = __importStar(require("@actions/github"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const parser_1 = require("./core/parser");
const matcher_1 = require("./core/matcher");
const metrics_1 = require("./core/metrics");
const logger_1 = require("./core/logger");
const health_1 = require("./core/health");
const actions_logger_1 = require("./adapters/github/actions-logger");
const github_provider_1 = require("./adapters/github/github-provider");
const health_2 = require("./adapters/github/health");
const zod_1 = require("zod");
const sender_1 = require("./telemetry/sender");
const version_1 = require("./version");
// Create the logger for the entire action lifetime
const logger = new actions_logger_1.ActionsLogger();
/**
 * Main entry point for the GitHub Action
 */
async function run() {
    const startTime = Date.now();
    const errors = [];
    let config;
    try {
        // 1. Load configuration
        config = loadConfig();
        // 2. Health checks
        const decisionFileOk = await (0, health_1.checkDecisionFileExists)(config.decisionFile);
        const tokenOk = await (0, health_2.validateToken)(config.token, logger);
        if (!decisionFileOk || !tokenOk) {
            logger.setFailed('System health check failed');
            return;
        }
        logger.info(`Decision file: ${config.decisionFile}`);
        // 3. Parse decisions
        logger.startGroup('Parsing decisions...');
        const parser = new parser_1.DecisionParser();
        // Check if path is a directory and handle accordingly
        const isDir = fs.existsSync(config.decisionFile) && fs.statSync(config.decisionFile).isDirectory();
        const parseResult = isDir
            ? await parser.parseDirectory(config.decisionFile)
            : await parser.parseFile(config.decisionFile);
        if (parseResult.warnings.length > 0) {
            parseResult.warnings.forEach((warn) => {
                logger.warning(warn);
            });
        }
        if (parseResult.errors.length > 0) {
            logger.warning(`Found ${parseResult.errors.length} parse errors`);
            parseResult.errors.forEach((err) => {
                logger.warning(`Line ${err.line}: ${err.message}`);
            });
            if (config.failOnError) {
                logger.setFailed(`Decision file has ${parseResult.errors.length} parse errors`);
                return;
            }
        }
        const hasRules = parseResult.decisions.some((d) => d.rules);
        logger.info(`Loaded ${parseResult.decisions.length} decisions (${hasRules ? 'with advanced rules' : 'file-based only'})`);
        logger.endGroup();
        // 4. Create SCM provider and fetch diffs
        logger.startGroup('Fetching file diffs...');
        const provider = new github_provider_1.GitHubProvider(config.token, logger);
        const changedFiles = await provider.getChangedFiles();
        const useStreaming = changedFiles.length > 1000;
        // Create FileMatcher once for all code paths
        const matcher = new matcher_1.FileMatcher(parseResult.decisions, logger);
        let matches = [];
        let processedFileCount = 0;
        if (useStreaming) {
            logger.info(`Large PR detected (${changedFiles.length} files), using streaming mode`);
            logger.endGroup();
            logger.startGroup('Processing with streaming...');
            matches = await processWithStreaming(parseResult.decisions, provider);
            processedFileCount = changedFiles.length;
            logger.endGroup();
        }
        else {
            const fileDiffs = await provider.getFileDiffs();
            processedFileCount = fileDiffs.length;
            metrics_1.metrics.addFilesProcessed(fileDiffs.length);
            logger.info(`PR modifies ${fileDiffs.length} files`);
            if (fileDiffs.length === 0) {
                logger.info('No file diffs found - PR is clear!');
                logger.setOutput('matches_found', '0');
                logger.setOutput('critical_count', '0');
                (0, logger_1.logStructured)(logger, 'info', 'Decision Guardian completed successfully (no files)', {
                    duration_ms: Date.now() - startTime,
                });
                metrics_1.metrics.setDuration(Date.now() - startTime);
                reportMetrics(config);
                return;
            }
            logger.endGroup();
            // 5. Match files to decisions
            logger.startGroup('Matching decisions...');
            try {
                matches = await matcher.findMatchesWithDiffs(fileDiffs);
            }
            catch (error) {
                logger.warning(`Advanced matching failed, falling back to simple mode: ${error}`);
                const fileNames = fileDiffs.map((f) => f.filename);
                matches = await matcher.findMatches(fileNames);
            }
        }
        const grouped = matcher.groupBySeverity(matches);
        metrics_1.metrics.addMatchesFound(matches.length);
        metrics_1.metrics.addCriticalMatches(grouped.critical.length);
        metrics_1.metrics.addWarningMatches(grouped.warning.length);
        metrics_1.metrics.addInfoMatches(grouped.info.length);
        logger.info(`Found ${matches.length} matches:`);
        logger.info(`  - Critical: ${grouped.critical.length}`);
        logger.info(`  - Warning: ${grouped.warning.length}`);
        logger.info(`  - Info: ${grouped.info.length}`);
        logger.endGroup();
        // 6. Post comment if matches found
        if (matches.length > 0) {
            logger.startGroup('Posting PR comment...');
            await provider.postComment(matches);
            logger.endGroup();
            logger.setOutput('matches_found', String(matches.length));
            logger.setOutput('critical_count', String(grouped.critical.length));
            // 7. Fail check if critical decisions violated
            if (config.failOnCritical && grouped.critical.length > 0) {
                const failureMessage = `PR modifies ${grouped.critical.length} files protected by critical decisions`;
                (0, logger_1.logStructured)(logger, 'error', 'Decision Guardian failed checks', {
                    match_count: matches.length,
                    critical_count: grouped.critical.length,
                    duration_ms: Date.now() - startTime,
                });
                logger.setFailed(failureMessage);
                metrics_1.metrics.setDuration(Date.now() - startTime);
                reportMetrics(config);
                return;
            }
        }
        else {
            logger.info('No decision matches found - PR is clear!');
            logger.setOutput('matches_found', '0');
            logger.setOutput('critical_count', '0');
        }
        const duration = Date.now() - startTime;
        (0, logger_1.logStructured)(logger, 'info', 'Decision Guardian completed successfully', {
            pr_number: github.context.payload.pull_request?.number,
            file_count: processedFileCount,
            decision_count: parseResult.decisions.length,
            match_count: matches.length,
            duration_ms: duration,
        });
        metrics_1.metrics.setDuration(duration);
        reportMetrics(config);
        logger.info('✅ Decision Guardian completed successfully');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        errors.push(message);
        (0, logger_1.logStructured)(logger, 'error', 'Decision Guardian failed', {
            duration_ms: Date.now() - startTime,
            errors,
        });
        logger.setFailed(`Action failed: ${message}`);
        if (stack) {
            logger.debug(stack);
        }
        metrics_1.metrics.setDuration(Date.now() - startTime);
        // Send telemetry only if config was loaded successfully
        if (config) {
            reportMetrics(config);
        }
    }
}
const ConfigSchema = zod_1.z.object({
    decisionFile: zod_1.z
        .string()
        .regex(/^[a-zA-Z0-9._/-]+$/, 'Invalid characters in decision file path')
        .refine((val) => !val.includes('..'), 'Path traversal not allowed'),
    failOnCritical: zod_1.z.boolean(),
    failOnError: zod_1.z.boolean(),
    token: zod_1.z.string().min(1, 'Token cannot be empty'),
});
/**
 * Load action configuration from inputs
 */
function loadConfig() {
    const rawConfig = {
        decisionFile: logger.getInput('decision_file') || '.decispher/decisions.md',
        failOnCritical: logger.getBooleanInput('fail_on_critical'),
        failOnError: logger.getBooleanInput('fail_on_error'),
        token: logger.getInput('token', true),
    };
    const result = ConfigSchema.safeParse(rawConfig);
    if (!result.success) {
        const errorMessage = result.error.issues
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
        throw new Error(`Invalid configuration: ${errorMessage}`);
    }
    if (path.isAbsolute(result.data.decisionFile)) {
        throw new Error('decision_file must be a relative path');
    }
    const config = result.data;
    logger.debug(`Configuration loaded: ${JSON.stringify({
        ...config,
        token: '***',
    })}`);
    return config;
}
/**
 * Report metrics using the decoupled snapshot approach
 */
function reportMetrics(_config) {
    const snapshot = metrics_1.metrics.getSnapshot();
    logger.info('=== Performance Metrics ===');
    logger.info(`API Calls: ${snapshot.api_calls}`);
    logger.info(`API Errors: ${snapshot.api_errors}`);
    logger.info(`Rate Limit Hits: ${snapshot.rate_limit_hits}`);
    logger.info(`Files Processed: ${snapshot.files_processed}`);
    logger.info(`Decisions Evaluated: ${snapshot.decisions_evaluated}`);
    logger.info(`Matches Found: ${snapshot.matches_found}`);
    logger.info(`Duration: ${snapshot.duration_ms}ms`);
    logger.setOutput('metrics', JSON.stringify(snapshot));
    // Send telemetry (controlled by DG_TELEMETRY env variable)
    (0, sender_1.sendTelemetry)('action', snapshot, version_1.VERSION).catch(() => { });
}
/**
 * Process large PRs using streaming
 */
async function processWithStreaming(decisions, provider) {
    const matcher = new matcher_1.FileMatcher(decisions, logger);
    const allMatches = [];
    let processedCount = 0;
    if (!provider.streamFileDiffs) {
        throw new Error('Provider does not support streaming');
    }
    for await (const batch of provider.streamFileDiffs()) {
        const batchMatches = await matcher.findMatchesWithDiffs(batch);
        allMatches.push(...batchMatches);
        processedCount += batch.length;
        logger.info(`Processed ${processedCount} files, found ${allMatches.length} matches so far`);
    }
    return allMatches;
}
// Run the action
run();
