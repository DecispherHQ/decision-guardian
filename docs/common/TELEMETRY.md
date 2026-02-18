# Telemetry

Decision Guardian includes a telemetry system to help us understand usage patterns and improve the tool.

## Privacy First

- **No source code**: We never collect file contents, diff bodies, or decision text.
- **No identifiers**: No repo names, org names, usernames, emails, or commit messages.
- **Aggregated only**: Data is aggregated per-day on the server. Individual events are not stored.

### Blocked Fields

The privacy module enforces a blocklist. Any payload containing these fields is rejected before sending:

`repo_name`, `org_name`, `file_names`, `file_paths`, `pr_title`, `pr_body`, `decision_content`, `user_names`, `github_token`, `commit_message`, `branch_name`, `author`, `email`

## What We Collect

When enabled, we collect only:

| Field | Example | Purpose |
|-------|---------|---------|
| `event` | `run_complete` | Event type |
| `version` | `1.2.3` | Tool version for compatibility |
| `source` | `action` or `cli` | Where it ran |
| `files_processed` | `42` | Scale of usage |
| `decisions_evaluated` | `15` | Feature adoption |
| `matches_found` | `3` | Detection effectiveness |
| `critical/warning/info` | `1/1/1` | Severity distribution |
| `duration_ms` | `1200` | Performance |
| `node_version` | `v20.10.0` | Runtime compatibility |
| `os_platform` | `linux` | Platform support |
| `ci` | `true` | CI vs local usage |

## Telemetry Control

### Unified Environment Variable Control (Opt-Out, Default: Enabled)

Telemetry is **enabled by default** for both GitHub Actions and CLI. To disable, use the `DG_TELEMETRY` environment variable:

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

### Custom Endpoint

For self-hosted telemetry:

```bash
DG_TELEMETRY_URL=https://your-server.com/collect decision-guardian check ...
```

## Architecture

```
Client (Action/CLI)           Cloudflare Worker           KV Store
┌─────────────────┐          ┌──────────────────┐        ┌────────┐
│ buildPayload()  │──POST──▶│ POST /collect     │──put──▶│ Daily  │
│ validatePrivacy │          │ aggregate per-day │        │ Agg.   │
│ sendTelemetry() │          │                  │        │ 90-day │
└─────────────────┘          │ GET /stats        │◀──get──│ TTL    │
                             └──────────────────┘        └────────┘
```

- **Fire-and-forget**: Telemetry never blocks or slows down the main tool.
- **5-second timeout**: If the endpoint is unreachable, the request silently fails.
- **90-day retention**: Aggregated data expires after 90 days.
