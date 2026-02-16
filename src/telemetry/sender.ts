import { MetricsSnapshot } from '../core/metrics';
import { buildPayload } from './payload';
import { validatePrivacy } from './privacy';

const DEFAULT_ENDPOINT = 'https://telemetry.decispher.com/collect';
const TIMEOUT_MS = 5000;

function isOptedIn(): boolean {
    if (process.env.DG_TELEMETRY === '0' || process.env.DG_TELEMETRY === 'false') {
        return false;
    }
    return process.env.DG_TELEMETRY === '1' || process.env.DG_TELEMETRY === 'true';
}

function getEndpoint(): string {
    return process.env.DG_TELEMETRY_URL || DEFAULT_ENDPOINT;
}

export async function sendTelemetry(
    source: 'action' | 'cli',
    snapshot: MetricsSnapshot,
    version: string
): Promise<void> {
    if (!isOptedIn()) return;

    try {
        const payload = buildPayload(source, snapshot, version);
        validatePrivacy(payload as unknown as Record<string, unknown>);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        await fetch(getEndpoint(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timer);
    } catch {
        // Silently fail — never break the tool
    }
}
