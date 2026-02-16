/**
 * MetricsCollector — Platform-agnostic performance metrics.
 */

export interface MetricsSnapshot {
    api_calls: number;
    api_errors: number;
    rate_limit_hits: number;
    files_processed: number;
    decisions_evaluated: number;
    matches_found: number;
    critical_matches: number;
    warning_matches: number;
    info_matches: number;
    duration_ms: number;
    parse_errors: number;
    parse_warnings: number;
}

export class MetricsCollector {
    private data: MetricsSnapshot = {
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

    incrementApiCall(): void {
        this.data.api_calls++;
    }

    incrementApiError(): void {
        this.data.api_errors++;
    }

    incrementRateLimitHit(): void {
        this.data.rate_limit_hits++;
    }

    addFilesProcessed(count: number): void {
        this.data.files_processed += count;
    }

    addDecisionsEvaluated(count: number): void {
        this.data.decisions_evaluated += count;
    }

    addMatchesFound(count: number): void {
        this.data.matches_found += count;
    }

    addCriticalMatches(count: number): void {
        this.data.critical_matches += count;
    }

    addWarningMatches(count: number): void {
        this.data.warning_matches += count;
    }

    addInfoMatches(count: number): void {
        this.data.info_matches += count;
    }

    setDuration(ms: number): void {
        this.data.duration_ms = ms;
    }

    addParseErrors(count: number): void {
        this.data.parse_errors += count;
    }

    addParseWarnings(count: number): void {
        this.data.parse_warnings += count;
    }

    /**
     * Returns an immutable snapshot of collected metrics.
     * Callers decide how to output: console, Actions output, telemetry, etc.
     */
    getSnapshot(): MetricsSnapshot {
        return { ...this.data };
    }

    /**
     * Reset all metrics to zero (useful for testing)
     */
    reset(): void {
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

/** Shared singleton instance */
export const metrics = new MetricsCollector();
