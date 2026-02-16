"use strict";
/**
 * MetricsCollector — Platform-agnostic performance metrics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.MetricsCollector = void 0;
class MetricsCollector {
    data = {
        api_calls: 0,
        api_errors: 0,
        rate_limit_hits: 0,
        files_processed: 0,
        decisions_evaluated: 0,
        matches_found: 0,
        critical_matches: 0,
        warning_matches: 0,
        info_matches: 0,
        duration_ms: 0,
        parse_errors: 0,
        parse_warnings: 0,
    };
    incrementApiCall() {
        this.data.api_calls++;
    }
    incrementApiError() {
        this.data.api_errors++;
    }
    incrementRateLimitHit() {
        this.data.rate_limit_hits++;
    }
    addFilesProcessed(count) {
        this.data.files_processed += count;
    }
    addDecisionsEvaluated(count) {
        this.data.decisions_evaluated += count;
    }
    addMatchesFound(count) {
        this.data.matches_found += count;
    }
    addCriticalMatches(count) {
        this.data.critical_matches += count;
    }
    addWarningMatches(count) {
        this.data.warning_matches += count;
    }
    addInfoMatches(count) {
        this.data.info_matches += count;
    }
    setDuration(ms) {
        this.data.duration_ms = ms;
    }
    addParseErrors(count) {
        this.data.parse_errors += count;
    }
    addParseWarnings(count) {
        this.data.parse_warnings += count;
    }
    /**
     * Returns an immutable snapshot of collected metrics.
     * Callers decide how to output: console, Actions output, telemetry, etc.
     */
    getSnapshot() {
        return { ...this.data };
    }
    /**
     * Reset all metrics to zero (useful for testing)
     */
    reset() {
        this.data = {
            api_calls: 0,
            api_errors: 0,
            rate_limit_hits: 0,
            files_processed: 0,
            decisions_evaluated: 0,
            matches_found: 0,
            critical_matches: 0,
            warning_matches: 0,
            info_matches: 0,
            duration_ms: 0,
            parse_errors: 0,
            parse_warnings: 0,
        };
    }
}
exports.MetricsCollector = MetricsCollector;
/** Shared singleton instance */
exports.metrics = new MetricsCollector();
