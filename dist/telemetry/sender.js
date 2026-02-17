"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelemetry = sendTelemetry;
const payload_1 = require("./payload");
const privacy_1 = require("./privacy");
const DEFAULT_ENDPOINT = 'https://decision-guardian-telemetry.iamalizaidi110.workers.dev/collect';
const TIMEOUT_MS = 5000;
function isOptedIn(_source) {
    // Unified telemetry control for both GitHub Actions and CLI via DG_TELEMETRY env
    // Opt-out model: telemetry is enabled by default
    // Users must explicitly set DG_TELEMETRY to '0' or 'false' to disable
    if (process.env.DG_TELEMETRY === '0' || process.env.DG_TELEMETRY === 'false') {
        return false;
    }
    // Enabled by default if not set, or if set to '1' or 'true'
    return true;
}
function getEndpoint() {
    return process.env.DG_TELEMETRY_URL || DEFAULT_ENDPOINT;
}
async function sendTelemetry(source, snapshot, version) {
    if (!isOptedIn(source))
        return;
    try {
        const payload = (0, payload_1.buildPayload)(source, snapshot, version);
        (0, privacy_1.validatePrivacy)(payload);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        await fetch(getEndpoint(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timer);
    }
    catch {
        // Silently fail — never break the tool
    }
}
