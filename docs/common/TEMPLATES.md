# Decision File Templates

Decision Guardian ships with 5 starter templates. Use them with `init` or `template`:

```bash
decision-guardian init --template security
decision-guardian template api > my-api-decisions.md
```

## Available Templates

### `basic`

Simple file-pattern decisions with glob matching. Best for getting started.

Covers: file paths, glob wildcards, severity levels, status tracking.

### `advanced-rules`

JSON-based rules with regex, content matching, boolean logic, and line ranges.

Covers: `content_rules`, `match_mode` (any/all), `regex` with flags, `line_range`, `json_path`.

### `security`

Security-focused decisions: hardcoded secrets detection, auth middleware enforcement.

Covers: credential patterns, regex content scanning, test file exclusions.

### `database`

Database migration and schema protection.

Covers: migration file guards, schema lock files, connection pool config, ORM settings.

### `api`

API versioning, rate limiting, and contract protection.

Covers: OpenAPI spec changes, versioned endpoint paths, rate limit config files.

## Template Format

All templates follow the standard decision file format:

```markdown
<!-- DECISION-CATEGORY-NNN -->
## Decision: Title

**Status**: Active
**Date**: YYYY-MM-DD
**Severity**: Critical|Warning|Info

**Files**:
- `glob/pattern/**/*.ts`

### Context

Why this decision was made and what to do before changing it.

---
```

See [README.md](../README.md#decision-file-format) for the full format reference.
