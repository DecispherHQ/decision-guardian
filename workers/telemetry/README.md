# Decision Guardian Telemetry Worker

A privacy-first Cloudflare Worker that collects **anonymous, aggregated usage metrics** for Decision Guardian.

## 🔒 Privacy Statement

This worker implements Decision Guardian's privacy-first telemetry:

- ✅ **Anonymous**: No user IDs, repository names, or identifiable information
- ✅ **Aggregated**: Data is grouped by day, no individual run details stored
- ✅ **Time-limited**: All data automatically deleted after 90 days
- ✅ **Validated**: Privacy validator blocks any sensitive fields
- ✅ **Open Source**: Code is public and auditable

See the full [Privacy Policy](../../PRIVACY.md).

## 📡 Endpoints

### POST /collect

Collects telemetry events from Decision Guardian runs.

**Request:**
```bash
curl -X POST https://decision-guardian-telemetry.iamalizaidi110.workers.dev/collect \
  -H "Content-Type: application/json" \
  -d '{
    "event": "run_complete",
    "version": "1.1.0",
    "source": "cli",
    "timestamp": "2026-02-16T14:45:00.000Z",
    "metrics": {
      "files_processed": 15,
      "decisions_evaluated": 8,
      "matches_found": 3,
      "critical_matches": 1,
      "warning_matches": 2,
      "info_matches": 0,
      "duration_ms": 1250
    },
    "environment": {
      "node_version": "v20.11.0",
      "os_platform": "linux",
      "ci": true
    }
  }'
```

**Response:**
```json
{
  "status": "ok"
}
```

### GET /stats

Returns aggregated statistics (public endpoint).

**Request:**
```bash
curl https://decision-guardian-telemetry.iamalizaidi110.workers.dev/stats
```

**Response:**
```json
{
  "days": 7,
  "total_runs": 1245,
  "total_files": 18675,
  "total_matches": 3421,
  "daily": [
    {
      "date": "2026-02-16",
      "total_runs": 234,
      "total_files": 3450,
      "total_matches": 521,
      "total_decisions": 1890,
      "sources": {
        "cli": 145,
        "action": 89
      },
      "versions": {
        "1.1.0": 200,
        "1.0.0": 34
      }
    }
  ]
}
```

## 🚀 Deployment

### Prerequisites
1. [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Initial Setup

```bash
cd workers/telemetry

# Install dependencies
npm install

# Create KV namespace
npx wrangler kv:namespace create TELEMETRY_KV

# Update wrangler.toml with the namespace ID
```

Update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "TELEMETRY_KV"
id = "your-namespace-id-here"
preview_id = "your-preview-id-here"
```

### Deploy

```bash
# Deploy to production
npx wrangler deploy

# View logs
npx wrangler tail
```

### Local Development

```bash
# Start local dev server
npx wrangler dev

# Test locally
curl http://localhost:8787/stats
```

## 📊 Data Structure

**Key Pattern:** `events:{YYYY-MM-DD}`

**Value:**
```typescript
{
  date: "2026-02-16",
  total_runs: 234,
  total_files: 3450,
  total_matches: 521,
  total_decisions: 1890,
  sources: { "cli": 145, "action": 89 },
  versions: { "1.1.0": 200, "1.0.0": 34 }
}
```

**TTL:** 90 days (automatic expiration)

## 🔐 Security & Privacy

- **CORS enabled**: Accessible from web browsers
- **Input validation**: Rejects malformed payloads
- **No PII**: Privacy validator prevents sensitive data storage
- **Public stats**: `/stats` endpoint is publicly accessible (aggregated data only)

See [PRIVACY.md](../../PRIVACY.md) for full details.

## 📚 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Privacy Policy](../../PRIVACY.md)
- [Main Documentation](../../README.md)

---

**Maintained by Decispher**
