import { buildPayload } from '../../src/telemetry/payload';
import { MetricsSnapshot } from '../../src/core/metrics';

describe('buildPayload', () => {
    const snapshot: MetricsSnapshot = {
        api_calls: 0,
        api_errors: 0,
        rate_limit_hits: 0,
        files_processed: 10,
        decisions_evaluated: 5,
        matches_found: 3,
        critical_matches: 1,
        warning_matches: 1,
        info_matches: 1,
        duration_ms: 250,
        parse_errors: 0,
        parse_warnings: 0,
    };

    it('should build a valid payload', () => {
        const result = buildPayload('cli', snapshot, '1.2.3');

        expect(result.event).toBe('run_complete');
        expect(result.source).toBe('cli');
        expect(result.version).toBe('1.2.3');
        expect(result.metrics.files_processed).toBe(10);
        expect(result.metrics.critical_matches).toBe(1);
        expect(result.metrics.duration_ms).toBe(250);
        expect(result.environment.node_version).toBe(process.version);
        expect(result.timestamp).toBeDefined();
    });

    it('should strip api-only fields from metrics', () => {
        const result = buildPayload('action', snapshot, '1.0.0');
        const metricsKeys = Object.keys(result.metrics);
        expect(metricsKeys).not.toContain('api_calls');
        expect(metricsKeys).not.toContain('rate_limit_hits');
    });
});
