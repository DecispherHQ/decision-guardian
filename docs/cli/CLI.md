# CLI Usage

Decision Guardian includes a local CLI for running checks outside GitHub Actions.

## Installation

```bash
npm install -g decision-guardian
# or use directly
npx decision-guardian
```

## Commands

### `check <path>`

Check a decision file against local git changes.

```bash
decision-guardian check .decispher/decisions.md
decision-guardian check .decispher/decisions.md --staged
decision-guardian check .decispher/decisions.md --branch main
decision-guardian check .decispher/decisions.md --all --fail-on-critical
```

| Flag | Default | Description |
|------|---------|-------------|
| `--staged` | ✅ | Compare staged changes |
| `--branch <base>` | | Compare against a branch |
| `--all` | | Compare all uncommitted changes |
| `--fail-on-critical` | | Exit code 1 if critical decisions triggered |

### `checkall`

Auto-discover and check all `.decispher/` files in the current directory.

```bash
decision-guardian checkall
decision-guardian checkall --fail-on-critical
```

### `init`

Scaffold a `.decispher/` directory with a starter decision file.

```bash
decision-guardian init
decision-guardian init --template security
```

Creates `.decispher/decisions.md` from the chosen template. Available templates: `basic`, `advanced-rules`, `security`, `database`, `api`.

### `template <name>`

Print or save a template.

```bash
decision-guardian template basic           # Print to stdout
decision-guardian template security -o .   # Write to current dir
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No critical violations |
| `1` | Critical violations found (with `--fail-on-critical`) or error |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DG_TELEMETRY` | Set to `1` to opt into anonymous usage telemetry |
| `DG_TELEMETRY_URL` | Override telemetry endpoint |

## CI/CD Integration

Use the CLI in any CI system (GitLab CI, Jenkins, CircleCI, etc.):

```yaml
# GitLab CI example
check-decisions:
  image: node:20
  script:
    - npx decision-guardian check .decispher/decisions.md --branch $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --fail-on-critical
```

## Bundle Size

The CLI ships as a single file bundle at ~430KB (target: <500KB).
