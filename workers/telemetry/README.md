# Decision Guardian — Telemetry Worker

Cloudflare Worker that receives and aggregates anonymous usage telemetry from the Decision Guardian CLI and GitHub Action.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/collect` | Receive a telemetry event, aggregate into daily stats |
| `GET` | `/stats` | Return aggregated usage summary |

## Data Flow

```
Client → POST /collect → validate payload → aggregate into KV (per-day key) → 200 OK
Browser → GET /stats   → read last 90 days from KV → return JSON summary
```

## KV Schema

Keys follow the pattern `stats:YYYY-MM-DD` with TTL of 90 days.

Each key stores:
```json
{
  "events": 42,
  "files_processed": 1200,
  "decisions_evaluated": 350,
  "matches_found": 87,
  "sources": { "action": 30, "cli": 12 }
}
```

## Deployment

1. Create a KV namespace:
   ```bash
   wrangler kv:namespace create TELEMETRY_KV
   ```

2. Update `wrangler.toml` with the namespace ID from step 1.

3. Deploy:
   ```bash
   wrangler deploy
   ```

## Privacy

The worker does **not** store individual events. All data is aggregated per-day immediately upon receipt. No PII, source code, repo names, or identifying information is ever stored.

See [docs/TELEMETRY.md](../../docs/TELEMETRY.md) for full privacy guarantees.
