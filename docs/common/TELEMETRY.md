# Telemetry — Technical Reference

Decision Guardian includes an opt-out telemetry system to help us understand usage patterns and improve the tool.

> **Data policy, opt-out instructions, and the full list of blocked fields are in [PRIVACY.md](../../PRIVACY.md).**  
> This document covers the technical architecture only.

## Architecture

```
Client (Action/CLI)           Cloudflare Worker           KV Store
┌─────────────────┐          ┌──────────────────┐         ┌────────┐
│ buildPayload()  │──POST──▶│ POST /collect     │──put──▶│ Daily  │
│ validatePrivacy │          │ aggregate per-day │        │ Agg.   │
│ sendTelemetry() │          │                  │         │ 90-day │
└─────────────────┘          │ GET /stats        │◀──get─│  TTL    │
                             └──────────────────┘         └────────┘
```

- **Fire-and-forget**: Telemetry never blocks or slows down the main tool.
- **5-second timeout**: If the endpoint is unreachable, the request silently fails.
- **90-day retention**: Aggregated data expires after 90 days.
- **Privacy validation**: Every payload is validated against a blocklist before sending. If any blocked field is detected, the payload is rejected and never sent. See [`src/telemetry/privacy.ts`](../../src/telemetry/privacy.ts).

## Source Modules

| Module | Responsibility |
|--------|---------------|
| [`src/telemetry/payload.ts`](../../src/telemetry/payload.ts) | Type-safe payload builder |
| [`src/telemetry/privacy.ts`](../../src/telemetry/privacy.ts) | Blocklist validation |
| [`src/telemetry/sender.ts`](../../src/telemetry/sender.ts) | Fire-and-forget HTTP sender |
| [`workers/telemetry/`](../../workers/telemetry/) | Cloudflare Worker backend (collect + aggregate) |

## Telemetry Control

Telemetry is **enabled by default** (opt-out). To disable:

**GitHub Action:**
```yaml
- uses: DecispherHQ/decision-guardian@v1
  env:
    DG_TELEMETRY: '0'  # Disable telemetry
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

**CLI:**
```bash
# Disable for a single run
DG_TELEMETRY=0 decision-guardian check .decispher/decisions.md

# Disable permanently
export DG_TELEMETRY=0
```

For full data policy details, see [PRIVACY.md](../../PRIVACY.md).
