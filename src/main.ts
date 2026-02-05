import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';
import { DecisionParser } from './parser';
import { FileMatcher } from './matcher';
import { CommentManager } from './comment';
import { ActionConfig, DecisionMatch } from './types';
import { getFileDiffs, getChangedFiles, streamFileDiffs } from './github-utils';
import { metrics } from './metrics';
import { logStructured } from './logger';
import { z } from 'zod';
import { validateHealth } from './health';

/**
 * Main entry point for the GitHub Action
 */

async function run(): Promise<void> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // 1. Load configuration
    const config = loadConfig();

    if (!(await validateHealth(config))) {
      core.setFailed('System health check failed');
      return;
    }

    core.info(`Decision file: ${config.decisionFile}`);

    // 2. Parse decisions (pre-computed, reused for all files)
    core.startGroup('Parsing decisions...');
    const parser = new DecisionParser();
    const parseResult = await parser.parseFile(config.decisionFile);

    if (parseResult.warnings.length > 0) {
      parseResult.warnings.forEach((warn) => {
        core.warning(warn);
      });
    }

    if (parseResult.errors.length > 0) {
      core.warning(`Found ${parseResult.errors.length} parse errors`);
      parseResult.errors.forEach((err) => {
        core.warning(`Line ${err.line}: ${err.message}`);
      });

      if (config.failOnError) {
        core.setFailed(`Decision file has ${parseResult.errors.length} parse errors`);
        return;
      }
    }

    const hasRules = parseResult.decisions.some((d) => d.rules);
    core.info(
      `Loaded ${parseResult.decisions.length} decisions (${hasRules ? 'with advanced rules' : 'file-based only'})`,
    );
    core.endGroup();

    // 3. Check PR size and choose appropriate processing mode
    core.startGroup('Fetching file diffs...');

    const changedFiles = await getChangedFiles(config.token);
    const useStreaming = changedFiles.length > 1000;

    let matches: DecisionMatch[];
    let processedFileCount = 0;

    if (useStreaming) {
      core.info(`Large PR detected (${changedFiles.length} files), using streaming mode`);
      core.endGroup();

      core.startGroup('Processing with streaming...');
      matches = await processWithStreaming(parser, parseResult.decisions, config.token);
      processedFileCount = changedFiles.length;
      core.endGroup();
    } else {
      const fileDiffs = await getFileDiffs(config.token);
      processedFileCount = fileDiffs.length;
      metrics.addFilesProcessed(fileDiffs.length);
      core.info(`PR modifies ${fileDiffs.length} files`);

      if (fileDiffs.length === 0) {
        core.info('No file diffs found - PR is clear!');
        core.setOutput('matches_found', 0);
        core.setOutput('critical_count', 0);

        logStructured('info', 'Decision Guardian completed successfully (no files)', {
          duration_ms: Date.now() - startTime,
        });
        metrics.setDuration(Date.now() - startTime);
        metrics.report();
        return;
      }

      core.endGroup();

      // 4. Match files to decisions using advanced rules
      core.startGroup('Matching decisions...');
      const matcher = new FileMatcher(parseResult.decisions);

      try {
        matches = await matcher.findMatchesWithDiffs(fileDiffs);
      } catch (error) {
        core.warning(`Advanced matching failed, falling back to simple mode: ${error}`);
        const fileNames = fileDiffs.map((f) => f.filename);
        matches = await matcher.findMatches(fileNames);
      }
    }

    const matcher = new FileMatcher(parseResult.decisions);
    const grouped = matcher.groupBySeverity(matches);

    metrics.addMatchesFound(matches.length);

    core.info(`Found ${matches.length} matches:`);
    core.info(`  - Critical: ${grouped.critical.length}`);
    core.info(`  - Warning: ${grouped.warning.length}`);
    core.info(`  - Info: ${grouped.info.length}`);
    core.endGroup();

    // 5. Post comment if matches found
    if (matches.length > 0) {
      core.startGroup('Posting PR comment...');
      const commentManager = new CommentManager(config.token);
      await commentManager.postAlert(matches);
      core.endGroup();

      core.setOutput('matches_found', matches.length);
      core.setOutput('critical_count', grouped.critical.length);

      // 6. Fail check if critical decisions violated and config says so
      if (config.failOnCritical && grouped.critical.length > 0) {
        const failureMessage = `PR modifies ${grouped.critical.length} files protected by critical decisions`;
        logStructured('error', 'Decision Guardian failed checks', {
          match_count: matches.length,
          critical_count: grouped.critical.length,
          duration_ms: Date.now() - startTime,
        });
        core.setFailed(failureMessage);
        metrics.setDuration(Date.now() - startTime);
        metrics.report();
        return;
      }
    } else {
      core.info('No decision matches found - PR is clear!');
      core.setOutput('matches_found', 0);
      core.setOutput('critical_count', 0);
    }

    if (config.telemetryEnabled) {
      core.info(
        `Telemetry: Decision Guardian run completed. Matches: ${matches.length}, Critical: ${grouped.critical.length}`,
      );
    }

    const duration = Date.now() - startTime;
    logStructured('info', 'Decision Guardian completed successfully', {
      pr_number: github.context.payload.pull_request?.number,
      file_count: processedFileCount,
      decision_count: parseResult.decisions.length,
      match_count: matches.length,
      duration_ms: duration,
    });

    metrics.setDuration(duration);
    metrics.report();

    core.info('✅ Decision Guardian completed successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    errors.push(message);

    logStructured('error', 'Decision Guardian failed', {
      duration_ms: Date.now() - startTime,
      errors,
    });

    core.setFailed(`Action failed: ${message}`);
    if (stack) {
      core.debug(stack);
    }

    metrics.setDuration(Date.now() - startTime);
    metrics.report();
  }
}

const ConfigSchema = z.object({
  decisionFile: z
    .string()
    .regex(/^[a-zA-Z0-9._/-]+$/, 'Invalid characters in decision file path')
    .refine((val) => !val.includes('..'), 'Path traversal not allowed'),
  failOnCritical: z.boolean(),
  failOnError: z.boolean(),
  telemetryEnabled: z.boolean(),
  token: z.string().min(1, 'Token cannot be empty'),
});

/**
 * Load action configuration from inputs
 */
function loadConfig(): ActionConfig {
  const rawConfig = {
    decisionFile: core.getInput('decision_file') || '.decispher/decisions.md',
    failOnCritical: core.getBooleanInput('fail_on_critical'),
    failOnError: core.getBooleanInput('fail_on_error'),
    telemetryEnabled: core.getBooleanInput('telemetry_enabled'),
    token: core.getInput('token', { required: true }),
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

  core.debug(
    `Configuration loaded: ${JSON.stringify({
      ...config,
      token: '***',
    })}`,
  );

  return config;
}

/**
 * Process large PRs using streaming to avoid memory exhaustion
 */
async function processWithStreaming(
  parser: DecisionParser,
  decisions: any[],
  token: string,
): Promise<DecisionMatch[]> {
  const matcher = new FileMatcher(decisions);
  const allMatches: DecisionMatch[] = [];
  let processedCount = 0;

  for await (const batch of streamFileDiffs(token)) {
    const batchMatches = await matcher.findMatchesWithDiffs(batch);
    allMatches.push(...batchMatches);

    processedCount += batch.length;
    core.info(`Processed ${processedCount} files, found ${allMatches.length} matches so far`);
  }

  return allMatches;
}

// Run the action
run();
