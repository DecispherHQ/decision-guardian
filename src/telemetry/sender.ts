import { MetricsSnapshot } from '../core/metrics';
import { buildPayload } from './payload';
import { validatePrivacy } from './privacy';

const DEFAULT_ENDPOINT =
  'https://decision-guardian-telemetry.decision-guardian-telemetry.workers.dev/collect';
const TIMEOUT_MS = 5000;

function isOptedIn(_source: 'action' | 'cli'): boolean {
  // Unified telemetry control for both GitHub Actions and CLI via DG_TELEMETRY env
  // Opt-out model: telemetry is enabled by default
  // Users must explicitly set DG_TELEMETRY to '0' or 'false' to disable
  if (process.env.DG_TELEMETRY === '0' || process.env.DG_TELEMETRY === 'false') {
    return false;
  }

  // Enabled by default if not set, or if set to '1' or 'true'
  return true;
}

function getEndpoint(): string {
  return process.env.DG_TELEMETRY_URL || DEFAULT_ENDPOINT;
}

export async function sendTelemetry(
  source: 'action' | 'cli',
  snapshot: MetricsSnapshot,
  version: string,
): Promise<void> {
  if (!isOptedIn(source)) return;

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
