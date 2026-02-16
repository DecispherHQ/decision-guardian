"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPayload = buildPayload;
function buildPayload(source, snapshot, version) {
    return {
        event: 'run_complete',
        version,
        source,
        timestamp: new Date().toISOString(),
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
