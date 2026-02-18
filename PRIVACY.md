# Privacy Policy - Decision Guardian Telemetry

## Overview

Decision Guardian collects **anonymous, aggregated usage metrics** to help us understand how the tool is being used and to improve it over time. We take privacy seriously and have designed our telemetry system with privacy-first principles.

## What We Collect

We collect **only** the following anonymous metrics:

### Metrics Data
- **Files processed**: Number of files analyzed in a run
- **Decisions evaluated**: Number of decision rules evaluated
- **Matches found**: Number of times decisions matched files
- **Match severity breakdown**: Count of critical, warning, and info matches
- **Duration**: How long the analysis took (in milliseconds)

### Environment Data (Anonymous)
- **Node.js version**: e.g., "v20.11.0"
- **Operating system**: e.g., "linux", "darwin", "win32"
- **CI environment**: Boolean indicating if running in CI (true/false)
- **Source**: Whether run as GitHub Action or CLI
- **Version**: Decision Guardian version number

### Example Telemetry Payload
```json
{
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
}
```

## What We DON'T Collect

We have **strict privacy safeguards** to ensure we never collect sensitive information:

### ❌ Blocked Data (Never Collected)
- Repository names or URLs
- Organization names
- File names or paths
- File contents or diffs
- PR titles, descriptions, or comments
- Decision file contents
- User names or emails
- GitHub tokens or credentials
- Commit messages
- Branch names
- Any personally identifiable information (PII)

### Privacy Validation
Our telemetry system includes a **privacy validator** that scans every payload before sending to ensure no blocked fields are included. If any blocked field is detected, the telemetry is rejected and never sent.

See: [`src/telemetry/privacy.ts`](./src/telemetry/privacy.ts)

## How We Use This Data

The anonymous telemetry data helps us:

1. **Understand usage patterns**: How many files are typically analyzed, common severity distributions
2. **Performance optimization**: Identify performance bottlenecks and optimize based on real-world usage
3. **Feature prioritization**: Understand which features are most used
4. **Platform support**: Know which Node.js versions and operating systems to prioritize
5. **Quality assurance**: Detect issues across different environments

## Data Storage & Retention

- **Storage**: Data is stored in Cloudflare KV (edge storage)
- **Retention**: Automatically deleted after **90 days**
- **Aggregation**: Data is aggregated by day (no individual run details are stored long-term)
- **Access**: Only aggregate statistics are accessible via the `/stats` endpoint
- **Security**: Data is transmitted over HTTPS and stored encrypted at rest

## Opt-Out

Telemetry is **enabled by default (opt-out)** and can be controlled via environment variables for both GitHub Actions and CLI:

### GitHub Action
```yaml
- uses: DecispherHQ/decision-guardian@v1
  env:
    DG_TELEMETRY: '0'  # Disable telemetry
```

### CLI
```bash
# Disable telemetry for a single run
DG_TELEMETRY=0 decision-guardian check

# Disable permanently (add to .bashrc, .zshrc, etc.)
export DG_TELEMETRY=0
```

### Environment Variables
- `DG_TELEMETRY=1` or `DG_TELEMETRY=true` - Enable telemetry (default)
- `DG_TELEMETRY=0` or `DG_TELEMETRY=false` - Disable telemetry
- `DG_TELEMETRY_URL` - Override the telemetry endpoint (for testing)

## Transparency

### Open Source
- **All telemetry code is open source** and available for review:
  - [`src/telemetry/`](./src/telemetry/) - Client-side telemetry implementation
  - [`workers/telemetry/`](./workers/telemetry/) - Serverless worker endpoint
- **Data collection is visible** in the source code
- **Privacy validation logic** is reviewable and testable

### Telemetry Endpoint
- **URL**: `https://decision-guardian-telemetry.decision-guardian-telemetry.workers.dev/collect`
- **Stats**: `https://decision-guardian-telemetry.decision-guardian-telemetry.workers.dev/stats` (public, aggregated data)

> **Note**: The `decision-guardian-telemetry.workers.dev` subdomain is the official production endpoint for Decision Guardian telemetry, deployed on Cloudflare Workers. The worker source code is open source and available in [`workers/telemetry/`](./workers/telemetry/).

## Questions or Concerns?

If you have any questions or concerns about our telemetry practices:

1. **Review the code**: All telemetry code is in this repository
2. **Open an issue**: [GitHub Issues](https://github.com/DecispherHQ/decision-guardian/issues)
3. **Contact us**: Create a discussion in [GitHub Discussions](https://github.com/DecispherHQ/decision-guardian/discussions)

## Changes to This Policy

We will update this policy if our telemetry practices change. All changes will be:
- Committed to this repository
- Documented in the CHANGELOG
- Announced in release notes

---

**Last Updated**: February 16, 2026
