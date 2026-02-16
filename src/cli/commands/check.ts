import * as path from 'path';
import * as fs from 'fs';
import { DecisionParser } from '../../core/parser';
import { FileMatcher } from '../../core/matcher';
import { ConsoleLogger } from '../../adapters/local/console-logger';
import { LocalGitProvider, LocalGitConfig } from '../../adapters/local/local-git-provider';
import { metrics } from '../../core/metrics';
import { formatMatchesTable, formatSummary } from '../formatter';

export interface CheckOptions {
    decisionFile: string;
    mode: 'staged' | 'branch' | 'all';
    baseBranch?: string;
    failOnCritical: boolean;
}

export async function runCheck(opts: CheckOptions): Promise<void> {
    const logger = new ConsoleLogger();
    const startTime = Date.now();

    try {
        const decisionPath = path.resolve(opts.decisionFile);
        const isDir = fs.existsSync(decisionPath) && fs.statSync(decisionPath).isDirectory();

        const parser = new DecisionParser();
        let parseResult;

        if (isDir) {
            logger.info(`Scanning directory: ${decisionPath}`);
            parseResult = await parser.parseDirectory(decisionPath);
        } else {
            if (!fs.existsSync(decisionPath)) {
                logger.error(`Decision file not found: ${decisionPath}`);
                logger.info('Run "decision-guardian init" to create one.');
                process.exit(1);
            }
            logger.info(`Checking: ${decisionPath}`);
            parseResult = await parser.parseFile(decisionPath);
        }

        if (parseResult.warnings.length > 0) {
            parseResult.warnings.forEach(w => logger.warning(w));
        }

        if (parseResult.errors.length > 0) {
            parseResult.errors.forEach(e => logger.error(`Line ${e.line}: ${e.message}`));
        }

        if (parseResult.decisions.length === 0) {
            logger.warning('No decisions found in the specified path.');
            process.exit(0);
        }

        logger.info(`Found ${parseResult.decisions.length} decisions`);

        const gitConfig: LocalGitConfig = {
            mode: opts.mode,
            baseBranch: opts.baseBranch,
            cwd: process.cwd(),
        };

        const provider = new LocalGitProvider(gitConfig);
        const fileDiffs = await provider.getFileDiffs();

        metrics.addFilesProcessed(fileDiffs.length);

        if (fileDiffs.length === 0) {
            logger.info('No changed files detected.');
            process.exit(0);
        }

        logger.info(`${fileDiffs.length} files changed`);

        const matcher = new FileMatcher(parseResult.decisions, logger);
        let matches;

        try {
            matches = await matcher.findMatchesWithDiffs(fileDiffs);
        } catch {
            const fileNames = fileDiffs.map(f => f.filename);
            matches = await matcher.findMatches(fileNames);
        }

        metrics.addMatchesFound(matches.length);
        metrics.setDuration(Date.now() - startTime);

        const grouped = matcher.groupBySeverity(matches);
        console.log(formatMatchesTable(matches));

        const snapshot = metrics.getSnapshot();
        console.log(formatSummary({
            filesProcessed: snapshot.files_processed,
            decisionsEvaluated: parseResult.decisions.length,
            matchesFound: snapshot.matches_found,
            critical: grouped.critical.length,
            warning: grouped.warning.length,
            info: grouped.info.length,
            durationMs: snapshot.duration_ms,
        }));

        if (opts.failOnCritical && grouped.critical.length > 0) {
            logger.error(`${grouped.critical.length} critical violations found`);
            process.exit(1);
        }

        process.exit(0);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Check failed: ${message}`);
        process.exit(1);
    }
}
