import { MetricsSnapshot } from '../core/metrics';
import { computeRepoHash, resolveRepoVisibility } from './identity';

export const PAYLOAD_SCHEMA = 2;

export interface TelemetryPayload {
  event: 'run_complete';
  schema: number;
  version: string;
  source: 'action' | 'cli';
  timestamp: string;
  repo_hash: string | null;
  repo_visibility: 'public' | 'private' | null;
  event_name: string | null;
  metrics: {
    files_processed: number;
    decisions_evaluated: number;
    matches_found: number;
    critical_matches: number;
    warning_matches: number;
    info_matches: number;
    duration_ms: number;
  };
  environment: {
    node_version: string;
    os_platform: string;
    ci: boolean;
  };
}

export function buildPayload(
  source: 'action' | 'cli',
  snapshot: MetricsSnapshot,
  version: string,
): TelemetryPayload {
  return {
    event: 'run_complete',
    schema: PAYLOAD_SCHEMA,
    version,
    source,
    timestamp: new Date().toISOString(),
    repo_hash: computeRepoHash(),
    repo_visibility: resolveRepoVisibility(),
    event_name: process.env.GITHUB_EVENT_NAME || null,
    metrics: {
      files_processed: snapshot.files_processed,
      decisions_evaluated: snapshot.decisions_evaluated,
      matches_found: snapshot.matches_found,
      critical_matches: snapshot.critical_matches,
      warning_matches: snapshot.warning_matches,
      info_matches: snapshot.info_matches,
      duration_ms: snapshot.duration_ms,
    },
    environment: {
      node_version: process.version,
      os_platform: process.platform,
      ci: !!process.env.CI,
    },
  };
}
