import * as core from '@actions/core';

// metrics.ts - Track performance metrics
export class MetricsCollector {
  private metrics = {
    api_calls: 0,
    api_errors: 0,
    rate_limit_hits: 0,
    files_processed: 0,
    decisions_evaluated: 0,
    matches_found: 0,
    duration_ms: 0,
  };

  incrementApiCall() {
    this.metrics.api_calls++;
  }
  incrementApiError() {
    this.metrics.api_errors++;
  }
  incrementRateLimitHit() {
    this.metrics.rate_limit_hits++;
  }
  addFilesProcessed(count: number) {
    this.metrics.files_processed += count;
  }
  addDecisionsEvaluated(count: number) {
    this.metrics.decisions_evaluated += count;
  }
  addMatchesFound(count: number) {
    this.metrics.matches_found += count;
  }
  setDuration(ms: number) {
    this.metrics.duration_ms = ms;
  }

  report() {
    core.info('=== Performance Metrics ===');
    core.info(`API Calls: ${this.metrics.api_calls}`);
    core.info(`API Errors: ${this.metrics.api_errors}`);
    core.info(`Rate Limit Hits: ${this.metrics.rate_limit_hits}`);
    core.info(`Files Processed: ${this.metrics.files_processed}`);
    core.info(`Decisions Evaluated: ${this.metrics.decisions_evaluated}`);
    core.info(`Matches Found: ${this.metrics.matches_found}`);
    core.info(`Duration: ${this.metrics.duration_ms}ms`);

    core.setOutput('metrics', JSON.stringify(this.metrics));
  }
}

export const metrics = new MetricsCollector();
