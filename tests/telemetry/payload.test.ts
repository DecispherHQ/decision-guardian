import { buildPayload, PAYLOAD_SCHEMA } from '../../src/telemetry/payload';
import { validatePrivacy } from '../../src/telemetry/privacy';
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

    describe('repository identity', () => {
        const originalRepo = process.env.GITHUB_REPOSITORY;
        const originalEvent = process.env.GITHUB_EVENT_NAME;

        afterEach(() => {
            if (originalRepo === undefined) delete process.env.GITHUB_REPOSITORY;
            else process.env.GITHUB_REPOSITORY = originalRepo;
            if (originalEvent === undefined) delete process.env.GITHUB_EVENT_NAME;
            else process.env.GITHUB_EVENT_NAME = originalEvent;
        });

        it('should carry a schema version', () => {
            expect(buildPayload('action', snapshot, '1.0.0').schema).toBe(PAYLOAD_SCHEMA);
        });

        it('should include an opaque repo_hash, never the repository name', () => {
            process.env.GITHUB_REPOSITORY = 'acme-corp/secret-project';
            const result = buildPayload('action', snapshot, '1.0.0');

            expect(result.repo_hash).toMatch(/^[a-f0-9]{16}$/);
            expect(JSON.stringify(result)).not.toContain('acme-corp');
            expect(JSON.stringify(result)).not.toContain('secret-project');
        });

        it('should produce the same hash for the same repo across runs', () => {
            process.env.GITHUB_REPOSITORY = 'acme-corp/widget';
            const a = buildPayload('action', snapshot, '1.0.0');
            const b = buildPayload('action', snapshot, '1.0.0');
            expect(a.repo_hash).toBe(b.repo_hash);
        });

        it('should record the triggering event name', () => {
            process.env.GITHUB_REPOSITORY = 'acme-corp/widget';
            process.env.GITHUB_EVENT_NAME = 'pull_request';
            expect(buildPayload('action', snapshot, '1.0.0').event_name).toBe('pull_request');
        });

        it('should pass the privacy validator', () => {
            process.env.GITHUB_REPOSITORY = 'acme-corp/secret-project';
            const result = buildPayload('action', snapshot, '1.0.0');
            expect(() =>
                validatePrivacy(result as unknown as Record<string, unknown>)
            ).not.toThrow();
        });
    });
});
