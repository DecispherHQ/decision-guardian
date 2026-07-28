# Telemetry — Technical Reference

Decision Guardian includes an opt-out telemetry system to help us understand usage patterns and improve the tool.

> **Data policy, opt-out instructions, and the full list of blocked fields are in [PRIVACY.md](../../PRIVACY.md).**  
> This document covers the technical architecture only.

## Architecture

```
Client (Action/CLI)           Cloudflare Worker              KV Store
┌─────────────────┐          ┌──────────────────┐    ┌──────────────────────┐
│ computeRepoHash │          │ POST /collect     │──▶│ events:<date>         │
│ buildPayload()  │──POST──▶│  validate + write │    │   daily counts, 90d   │
│ validatePrivacy │          │                  │──▶│ seen:<date>:<hash>    │
│ sendTelemetry() │          │ GET /stats        │◀──│   repo activity, 400d │
└─────────────────┘          └──────────────────┘    └──────────────────────┘
```

- **Fire-and-forget**: Telemetry never blocks or slows down the main tool.
- **5-second timeout**: If the endpoint is unreachable, the request silently fails.
- **Two keyspaces**: `events:<date>` holds daily counts (90-day TTL). `seen:<date>:<repo_hash>` records that a repository was active on a date (400-day TTL, so retention can be measured year over year).
- **Cohorts are derived, not stored**: a repository's first-seen date is the earliest `seen:` key bearing its hash, so `/stats` needs no per-repository lookup and no second keyspace.
- **Run counts are a floor**: `events:<date>` is a read-modify-write against one key, so concurrent runs drop increments. `/stats` reports this as `counters_are_floor: true`. Repository counts are exact, because those are blind writes to per-repository keys.
- **Privacy validation**: Every payload is checked before sending. A blocked field name aborts the send; so does a `repo_hash` that is not 16 lowercase hex characters. See [`src/telemetry/privacy.ts`](../../src/telemetry/privacy.ts).

## Source Modules

| Module | Responsibility |
|--------|---------------|
| [`src/telemetry/identity.ts`](../../src/telemetry/identity.ts) | Repo reference normalization and HMAC hashing |
| [`src/telemetry/payload.ts`](../../src/telemetry/payload.ts) | Type-safe payload builder |
| [`src/telemetry/privacy.ts`](../../src/telemetry/privacy.ts) | Blocklist and hash-shape validation |
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
