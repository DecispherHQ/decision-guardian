import { sendTelemetry } from '../../src/telemetry/sender';

describe('sendTelemetry', () => {
    const originalEnv = process.env;
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        global.fetch = mockFetch as any;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    const snapshot = {
        api_calls: 0,
        api_errors: 0,
        rate_limit_hits: 0,
        files_processed: 5,
        decisions_evaluated: 3,
        matches_found: 1,
        critical_matches: 0,
        warning_matches: 1,
        info_matches: 0,
        duration_ms: 100,
        parse_errors: 0,
        parse_warnings: 0,
    };

    it('should send by default when DG_TELEMETRY is not set (opt-out model)', async () => {
        delete process.env.DG_TELEMETRY;
        await sendTelemetry('cli', snapshot, '1.0.0');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not send when DG_TELEMETRY is 0', async () => {
        process.env.DG_TELEMETRY = '0';
        await sendTelemetry('cli', snapshot, '1.0.0');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send when DG_TELEMETRY is 1', async () => {
        process.env.DG_TELEMETRY = '1';
        await sendTelemetry('cli', snapshot, '1.0.0');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('decision-guardian-telemetry.iamalizaidi110.workers.dev'),
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('should use custom endpoint when DG_TELEMETRY_URL is set', async () => {
        process.env.DG_TELEMETRY = 'true';
        process.env.DG_TELEMETRY_URL = 'https://custom.endpoint/collect';
        await sendTelemetry('action', snapshot, '1.0.0');
        expect(mockFetch).toHaveBeenCalledWith(
            'https://custom.endpoint/collect',
            expect.anything()
        );
    });

    it('should respect DG_TELEMETRY for GitHub Action when set to 1', async () => {
        process.env.DG_TELEMETRY = '1';
        await sendTelemetry('action', snapshot, '1.0.0');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect DG_TELEMETRY for GitHub Action when set to 0', async () => {
        process.env.DG_TELEMETRY = '0';
        await sendTelemetry('action', snapshot, '1.0.0');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send for both action and cli when DG_TELEMETRY is true', async () => {
        process.env.DG_TELEMETRY = 'true';
        await sendTelemetry('action', snapshot, '1.0.0');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        mockFetch.mockClear();

        await sendTelemetry('cli', snapshot, '1.0.0');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should silently fail on network error', async () => {
        process.env.DG_TELEMETRY = '1';
        mockFetch.mockRejectedValueOnce(new Error('Network error'));
        await expect(sendTelemetry('cli', snapshot, '1.0.0')).resolves.toBeUndefined();
    });
});
