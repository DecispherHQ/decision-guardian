# Security Policy

## Supported Versions

Please use the latest version of this action.

## Reporting a Vulnerability

Please report vulnerabilities to the maintainers directly.

## Trust & Safety

We take security seriously.

### Explicit Privacy & Security Guarantees

❌ **No data leaves GitHub**
Your code and decision data never leave the runner. Telemetry collection can be stopped and never collects source code, file contents, repo names, or any identifying information.

✅ **Read-only access except PR comments**
The action requires read access to the repository content. Write access is strictly limited to posting comments on Pull Requests.

### Opt-out Telemetry Privacy

Telemetry is **enabled by default** (opt-out via `DG_TELEMETRY=0`). The following guarantees always apply:

- **No source code** is ever transmitted
- **No identifiers**: repo names, org names, usernames, emails, commit messages, branch names, file names, and file paths are all blocked at the module level
- **Runtime blocklist**: A privacy module validates every payload before sending and throws an error if any blocked field is present
- **Aggregated storage**: Data is aggregated per-day on the server with a 90-day TTL
- **Fire-and-forget**: Telemetry never blocks or slows down the tool — failures are silently ignored

See [TELEMETRY.md](docs/common/TELEMETRY.md) for full details.
