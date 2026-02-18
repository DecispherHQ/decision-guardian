# Decision Guardian - Complete Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [What is Decision Guardian?](#what-is-decision-guardian)
3. [Quick Start](#quick-start)
4. [Installation & Integration](#installation--integration)
5. [CLI Mode Deep Dive](#cli-mode-deep-dive)
6. [The Decisions File](#the-decisions-file)
7. [Decision Format Reference](#decision-format-reference)
8. [Advanced Rules System](#advanced-rules-system)
9. [Configuration Options](#configuration-options)
10. [Telemetry & Data Privacy](#telemetry--data-privacy)
11. [Use Cases & Examples](#use-cases--examples)
12. [Troubleshooting](#troubleshooting)
13. [Performance & Optimization](#performance--optimization)
14. [Best Practices](#best-practices)
15. [Decision Lifecycle Management](#decision-lifecycle-management)
16. [Advanced Patterns](#advanced-patterns)
17. [Testing Your Decisions](#testing-your-decisions)
18. [Migration Guide](#migration-guide)
19. [FAQ](#faq)
20. [Additional Resources](#additional-resources)

---

## Introduction

Decision Guardian is a tool that automatically surfaces architectural decisions and important context when code changes modify protected files. It can be used as a **GitHub Action** for automated PR checks or as a **CLI tool** for local development and any CI/CD integration. Instead of relying on institutional knowledge or hoping developers read documentation, Decision Guardian proactively alerts teams when changes touch sensitive areas of the codebase.

### Key Features

- **Automatic Context Surfacing**: Alerts appear as PR comments (GitHub Action) or terminal output (CLI) when protected files are modified
- **Severity Levels**: Categorize decisions as Critical, Warning, or Info
- **Advanced Pattern Matching**: Support for glob patterns, regex, content-based rules, and nested logic
- **Performance Optimized**: Handles PRs with thousands of files efficiently
- **Zero Configuration**: Works out-of-the-box with sensible defaults

---

## What is Decision Guardian?

Decision Guardian helps engineering teams by:

1. **Preserving Context**: Documents "why" certain files or patterns require careful review
2. **Onboarding New Developers**: Automatically educates team members about architectural decisions
3. **Preventing Technical Debt**: Surfaces warnings before problematic changes are merged
4. **Enforcing Standards**: Can fail PR checks (GitHub Action) or exit with code 1 (CLI) for critical violations

### How It Works

Decision Guardian operates in two modes:

**GitHub Action Mode:**

1. You create a `decisions.md` file documenting architectural decisions
2. Add Decision Guardian to your GitHub Actions workflow
3. When a PR is opened, Decision Guardian:
   - Analyzes which files changed
   - Matches them against your documented decisions
   - Posts a comment with relevant context
   - Optionally fails the check for critical violations

**CLI Mode:**

1. You create a `decisions.md` file documenting architectural decisions
2. Install Decision Guardian CLI (`npm install -g decision-guardian` or use `npx`)
3. Run checks locally or in any CI system:
   - `check <path>` - Check specific decision file against git changes
   - `checkall` - Auto-discover and check all `.decispher/` files
   - Choose comparison mode: `--staged`, `--branch`, or `--all`
   - Optionally fail on critical violations with `--fail-on-critical`
4. Use in pre-commit hooks, GitLab CI, Jenkins, CircleCI, or any environment with git and Node.js

### When to Use Each Mode

| Use Case | Recommended Mode | Why |
|----------|------------------|-----|
| Automated PR checks on GitHub | GitHub Action | Native integration, automatic comments |
| Local development | CLI | Fast feedback before pushing |
| Pre-commit validation | CLI | Catch violations before commit |
| GitLab/Jenkins/CircleCI | CLI | Works in any CI system |
| Manual code review | CLI | On-demand checking |
| Multiple hosting platforms | CLI | Portable across environments |

### Understanding Comment Updates

Decision Guardian uses a smart hash-based system to manage PR comments:

**How it works**:

1. **Content Hash**: Decision Guardian creates a hash based on:
   - All matched decision IDs
   - All matched file paths
   - All matched patterns (including rule-based patterns)
   - Sorted to ensure consistency

2. **Update Logic**:
   ```
   If existing comment found:
     Extract old hash from comment
     Calculate new hash from current matches
     
     If hashes match:
       Skip update (no changes)
       Log: "Existing comment is up-to-date, skipping update"
     Else:
       Update comment with new content
   Else:
     Create new comment
   ```

3. **Duplicate Cleanup**: 
   - If multiple Decision Guardian comments exist (rare race condition)
   - Keeps the first one, deletes the rest
   - Logs: `Found N duplicate comments, cleaning up...`

**When comments update**:
- ✅ New files match decisions
- ✅ Previously matched files no longer match
- ✅ Different patterns match the same files
- ✅ Decision severity/content changes
- ❌ No update if exact same matches (hash unchanged)

**The hash is stored in the comment as**:
```html
<!-- hash:abc123def456 -->
```


This prevents unnecessary GitHub API calls and comment edits.


---

## Quick Start

### 1. Create a Decisions File

Create `.decispher/decisions.md` in your repository:

```markdown
<!-- DECISION-DB-001 -->
## Decision: Database Connection Pool Configuration

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/config/database.ts`
- `src/lib/db-pool.ts`

### Context

These files control database connection pooling. Changes here can cause:
- Connection exhaustion under load
- Memory leaks
- Performance degradation

Always load-test changes with production-like traffic patterns.

---
```

### 2. Add GitHub Action Workflow

Create `.github/workflows/decision-guardian.yml`:

```yaml
name: Decision Guardian

on:
  pull_request:

jobs:
  check-decisions:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # Required to post PR comments
      contents: read
    steps:
      - uses: actions/checkout@v4
      
      - name: Decision Guardian
        uses: DecispherHQ/decision-guardian@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fail_on_critical: true
```

> **⚠️ Important**: The `permissions` block is required. On repositories where the default token has restricted permissions (common in organizations), omitting it will cause the action to silently fail to post comments.

### 3. Test It

Create a PR that modifies `src/config/database.ts`. Decision Guardian will automatically post a comment with the context from `DECISION-DB-001`.

---

## Installation & Integration

### Prerequisites

**GitHub Action** (automated PR checks):
- GitHub repository with Actions enabled
- Node.js 20+ (handled automatically by the runner)

**CLI** (local development or any CI system):
- Node.js 20+
- Git repository

### Step-by-Step Integration

#### Option 1: Standalone Workflow (Recommended)

Create `.github/workflows/decision-guardian.yml`:

```yaml
name: Decision Guardian

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  decision-check:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # Required to post comments
      contents: read
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run Decision Guardian
        uses: DecispherHQ/decision-guardian@v1
        with:
          decision_file: '.decispher/decisions.md'
          fail_on_critical: true
          fail_on_error: false
          token: ${{ secrets.GITHUB_TOKEN }}
```

#### Option 2: Integrate with Existing CI Workflow

Add to your existing test workflow:

```yaml
name: CI

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
      
      # Add Decision Guardian
      - name: Check Architectural Decisions
        uses: DecispherHQ/decision-guardian@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Permissions Required

Decision Guardian needs these GitHub permissions:

- `pull-requests: write` - To post/update comments
- `contents: read` - To read the decisions file

These are automatically granted when using `${{ secrets.GITHUB_TOKEN }}`.

---

## CLI Mode Deep Dive

The Decision Guardian CLI provides a flexible way to run decision checks locally or in any CI/CD environment. This section covers everything you need to know about using the CLI effectively.

### Installation

**Option 1: Global Installation**

```bash
npm install -g decision-guardian
decision-guardian --version
```

Benefits:
- Available as `decision-guardian` command globally
- No `npx` prefix needed
- Faster execution (no download step)

**Option 2: Use with npx (No Installation)**

```bash
npx decision-guardian --help
```

Benefits:
- No global installation required
- Always uses latest version
- Great for CI/CD environments

**Option 3: Local Project Dependency**

```bash
npm install --save-dev decision-guardian
# Then run via npm scripts
```

```json
{
  "scripts": {
    "check-decisions": "decision-guardian checkall --fail-on-critical"
  }
}
```

### Command Reference

#### `check <path>`

Check a specific decision file against git changes.

**Syntax:**
```bash
decision-guardian check <decision-file-path> [flags]
```

**Examples:**

```bash
# Check staged changes (default)
decision-guardian check .decispher/decisions.md

# Check against a specific branch
decision-guardian check .decispher/decisions.md --branch main

# Check against origin/main
decision-guardian check .decispher/decisions.md --branch origin/main

# Check all uncommitted changes
decision-guardian check .decispher/decisions.md --all

# Fail on critical violations
decision-guardian check .decispher/decisions.md --fail-on-critical
```

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--staged` | boolean | `true` | Compare staged changes (git diff --cached) |
| `--branch <branch-name>` | string | - | Compare against specified branch (e.g. `main`, `origin/main`) |
| `--all` | boolean | `false` | Compare all uncommitted changes (staged + unstaged) |
| `--fail-on-critical` | boolean | `false` | Exit with code 1 if critical decisions triggered |

**Exit Codes:**
- `0` - Success (no critical violations or `--fail-on-critical` not set)
- `1` - Critical violations found (with `--fail-on-critical`) or error

**What Gets Compared:**

- `--staged` (default): Files in staging area (`git diff --cached`)
- `--branch <name>`: Difference between current branch and `<name>` (`git diff <name>...HEAD`)
- `--all`: All uncommitted changes (`git diff HEAD`)

#### `checkall`

Auto-discover and check all decision files in the `.decispher/` directory.

**Syntax:**
```bash
decision-guardian checkall [flags]
```

**Examples:**

```bash
# Check all .decispher/ files with default (staged) mode
decision-guardian checkall

# Check against main branch
decision-guardian checkall --branch main

# Check all uncommitted changes and fail on critical
decision-guardian checkall --all --fail-on-critical
```

**How it works:**
1. Searches for `.decispher/` directory in current directory
2. Recursively scans for all `.md` and `.markdown` files
3. Parses and merges all decisions
4. Evaluates them together against git changes
5. Outputs consolidated results

**Benefits:**
- No need to specify decision file paths
- Automatically picks up new decision files
- Perfect for monorepos with multiple decision files

#### `init`

Scaffold a `.decispher/` directory with a starter decision file.

**Syntax:**
```bash
decision-guardian init [--template <name>]
```

**Examples:**

```bash
# Create with basic template
decision-guardian init

# Use security template
decision-guardian init --template security

# Use database template
decision-guardian init --template database
```

**Available Templates:**
- `basic` - Simple starter with common patterns
- `advanced-rules` - Examples using JSON rules system
- `security` - Security-focused decisions
- `database` - Database and migration decisions
- `api` - API and breaking change decisions

**What it creates:**
```
.decispher/
└── decisions.md  (populated with chosen template)
```

#### `template <name>`

Print or save a decision file template.

**Syntax:**
```bash
decision-guardian template <template-name> [--output <path>]
decision-guardian template --list
```

**Examples:**

```bash
# List available templates
decision-guardian template --list

# Print to stdout
decision-guardian template security

# Save to file
decision-guardian template security --output .decispher/security.md

# Save to current directory
decision-guardian template api -o .
```

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `--list` | boolean | List all available templates |
| `--output`, `-o` | string | Write template to file instead of stdout |


### Comparison Modes Explained

Understanding when to use each comparison mode:

#### Staged Mode (`--staged`, default)

**Use when:**
- Running in pre-commit hooks
- Checking what you're about to commit
- Quick local validation before `git commit`

**Git command equivalent:**
```bash
git diff --cached
```

**Example workflow:**
```bash
git add src/config/database.ts
decision-guardian check .decispher/decisions.md  # Uses --staged by default
git commit -m "Update database config"
```

> **⚠️ Common Pitfall — No Staged Files**: `--staged` is the default mode. If you run `decision-guardian check` without staging any files first, you will see:
> ```
> No changes detected
> ```
> This is **not a bug** — it means there is nothing in the staging area (`git diff --cached` returned empty). To check unstaged changes, use `--all`. To check against a branch, use `--branch main`.

#### Branch Mode (`--branch <name>`)

**Use when:**
- Checking all changes in feature branch vs main
- CI/CD merge request validation
- Comparing against remote branches

**Git command equivalent:**
```bash
git diff <branch>...HEAD
```

**Example workflow:**
```bash
# On feature branch, compare against main
decision-guardian check .decispher/decisions.md --branch main

# Compare against remote main
decision-guardian check .decispher/decisions.md --branch origin/main

# GitLab CI: compare against target branch
decision-guardian check .decispher/decisions.md --branch origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME
```

#### All Mode (`--all`)

**Use when:**
- Checking all uncommitted work (staged + unstaged)
- Quick local check before pushing
- Validating work in progress

**Git command equivalent:**
```bash
git diff HEAD
```

**Example workflow:**
```bash
# Made changes but haven't staged yet
decision-guardian check .decispher/decisions.md --all

# See all violations before committing anything
```

### Git Integration Strategies

#### Pre-commit Hook

Prevent commits that violate critical decisions.

**Setup:**

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Check staged changes before commit
npx decision-guardian check .decispher/decisions.md --staged --fail-on-critical

# Store exit code
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "❌ Commit blocked: Critical decision violations found"
  echo "Fix the issues or use 'git commit --no-verify' to bypass (not recommended)"
  exit 1
fi

exit 0
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

**Alternative: Using Husky**

```bash
npm install --save-dev husky
npx husky init
```

Create `.husky/pre-commit`:
```bash
#!/bin/sh
npx decision-guardian checkall --staged --fail-on-critical
```

#### Pre-push Hook

Check all commits before pushing to remote.

Create `.git/hooks/pre-push`:

```bash
#!/bin/sh
# Compare against origin/main before push
npx decision-guardian checkall --branch origin/main --fail-on-critical
```

#### Manual Workflow Integration

```bash
# 1. Make changes
vim src/config/database.ts

# 2. Check decisions before staging
decision-guardian checkall --all

# 3. Stage if no violations
git add src/config/database.ts

# 4. Check again (staged only)
decision-guardian checkall --staged --fail-on-critical

# 5. Commit if passing
git commit -m "Update database config"
```

### CI/CD Integration Patterns

#### GitLab CI

**Basic Integration:**

```yaml
# .gitlab-ci.yml
stages:
  - validate

check-decisions:
  stage: validate
  image: node:20
  only:
    - merge_requests
  script:
    - npx decision-guardian check .decispher/decisions.md --branch origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME --fail-on-critical
```

**Advanced (with caching):**

```yaml
check-decisions:
  stage: validate
  image: node:20
  only:
    - merge_requests
  cache:
    key: decision-guardian
    paths:
      - node_modules/
  before_script:
    - npm install -g decision-guardian
  script:
    - decision-guardian checkall --branch origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME --fail-on-critical
  allow_failure: false
```

#### Jenkins

**Declarative Pipeline:**

```groovy
pipeline {
  agent any
  
  stages {
    stage('Check Decisions') {
      steps {
        script {
          def exitCode = sh(
            script: 'npx decision-guardian checkall --branch origin/main --fail-on-critical',
            returnStatus: true
          )
          
          if (exitCode != 0) {
            error('Critical architectural decision violations found')
          }
        }
      }
    }
  }
}
```

**Freestyle Project:**

```bash
# Build → Execute shell
npx decision-guardian check .decispher/decisions.md --branch origin/main --fail-on-critical
```

#### CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  check-decisions:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Check Architectural Decisions
          command: npx decision-guardian checkall --branch origin/main --fail-on-critical

workflows:
  validate:
    jobs:
      - check-decisions
```

#### Bitbucket Pipelines

```yaml
# bitbucket-pipelines.yml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Check Decisions
          image: node:20
          script:
            - npx decision-guardian checkall --branch origin/$BITBUCKET_PR_DESTINATION_BRANCH --fail-on-critical
```

#### Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  - main

pr:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: |
      npx decision-guardian checkall --branch origin/main --fail-on-critical
    displayName: 'Check Architectural Decisions'
```

#### Travis CI

```yaml
# .travis.yml
language: node_js
node_js:
  - 20

script:
  - npx decision-guardian checkall --branch $TRAVIS_BRANCH --fail-on-critical
```

### Advanced CLI Usage Patterns

#### Pattern 1: Multi-Stage Validation

Check at different stages of development:

```bash
#!/bin/bash
# validate.sh - Multi-stage decision checking

echo "Stage 1: Checking unstaged changes..."
decision-guardian checkall --all

echo "Stage 2: Checking staged changes..."
decision-guardian checkall --staged

echo "Stage 3: Checking against main branch..."
decision-guardian checkall --branch main --fail-on-critical
```

#### Pattern 2: Conditional Execution

Only run on specific file types:

```bash
# Check if any .ts files changed
if git diff --name-only --cached | grep -q '\.ts$'; then
  echo "TypeScript files changed, checking decisions..."
  decision-guardian checkall --staged --fail-on-critical
else
  echo "No TypeScript files changed, skipping decision check"
fi
```

#### Pattern 3: Custom Output Handling

```bash
# Capture output for logging
OUTPUT=$(decision-guardian checkall --branch main 2>&1)
EXIT_CODE=$?

# Log to file
echo "$OUTPUT" >> decision-check.log

# Send to monitoring system
if [ $EXIT_CODE -ne 0 ]; then
  curl -X POST https://monitoring.example.com/alert \
    -d "message=$OUTPUT"
fi

exit $EXIT_CODE
```

#### Pattern 4: Directory-Specific Checks

For monorepos with multiple decision file sets:

```bash
#!/bin/bash
# check-all-services.sh

SERVICES=("auth" "api" "frontend")

for service in "${SERVICES[@]}"; do
  echo "Checking $service decisions..."
  decision-guardian check ".decispher/$service/decisions.md" --branch main --fail-on-critical
done
```

### Troubleshooting CLI-Specific Issues

#### Issue: "No git repository found"

**Cause:** CLI requires git to determine changed files

**Solution:**
```bash
# Ensure you're in a git repository
git init  # If new project
git remote add origin <url>  # If needed
```

#### Issue: "No changes detected"

**Cause:** No files in the comparison

**Solutions:**
```bash
# Check what would be compared
git diff --cached  # For --staged mode
git diff HEAD  # For --all mode
git diff main...HEAD  # For --branch main mode

# Ensure files are staged (for --staged mode)
git add . 
```

#### Issue: "Error reading decision file"

**Cause:** File path incorrect or file doesn't exist

**Solutions:**
```bash
# Verify file exists
ls -la .decispher/decisions.md

# Use absolute path
decision-guardian check $(pwd)/.decispher/decisions.md

# Use checkall to auto-discover
decision-guardian checkall
```

#### Issue: "Exit code 1 but no violations shown"

**Cause:** Parse error in decision file

**Solution:**
- Check decision file syntax
- Look for malformed decision IDs
- Validate JSON in Rules blocks
- Review error output carefully

### Performance Considerations

**CLI vs GitHub Action:**

| Aspect | CLI | GitHub Action |
|--------|-----|---------------|
| **Execution** | Local machine/CI runner | GitHub-hosted runner |
| **Speed** | Depends on machine | ~2-5 seconds overhead |
| **File Access** | Direct filesystem | Via checkout action |
| **Git History** | Full local history | Shallow clone by default |
| **Caching** | Manual/CI caching | Automatic via Actions cache |

**Optimization Tips:**

```bash
# 1. Use global installation for faster execution
npm install -g decision-guardian

# 2. Cache in CI
# GitLab CI
cache:
  paths:
    - node_modules/

# CircleCI
- restore_cache:
    keys:
      - v1-dependencies-{{ checksum "package.json" }}

# 3. Use checkall instead of multiple check commands
decision-guardian checkall  # ✅ Single execution
# vs
decision-guardian check file1.md  # ❌ Multiple executions
decision-guardian check file2.md
```

### Environment Variables

Control CLI behavior via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DG_TELEMETRY` | Control telemetry | `1` (enabled) |
| `DG_TELEMETRY_URL` | Override telemetry endpoint | - |
| `NODE_ENV` | Affects debug output | - |

**Example:**

```bash
# Disable telemetry
export DG_TELEMETRY=0
decision-guardian checkall

# Enable telemetry
export DG_TELEMETRY=1
decision-guardian checkall
```

---

## The Decisions File

The decisions file is a Markdown document containing structured architectural decisions. By default, Decision Guardian looks for `.decispher/decisions.md`, but you can customize this location.

### File Requirements

- **Encoding**: The file **must be UTF-8 encoded**. Other encodings (like UTF-16 or Latin-1) may cause parse errors.
- **Format**: Standard Markdown with HTML comments for metadata.

### File Structure

```markdown
<!-- DECISION-ID -->
## Decision: Title

**Status**: Active  
**Date**: YYYY-MM-DD  
**Severity**: Critical|Warning|Info

**Files**:
- pattern1
- pattern2

### Context

Description of the decision and why it matters.

---

<!-- Next decision -->
```

### Decision ID Format

Decision IDs follow this pattern:

```
DECISION-[CATEGORY-]NUMBER

Examples:
- DECISION-001
- DECISION-DB-001
- DECISION-API-AUTH-001
- DECISION-SECURITY-XSS-001
```

**Rules**:
- Must start with `DECISION-`
- Can include category prefixes (DB, API, SECURITY, etc.)
- Must end with a number
- Use uppercase letters and hyphens only

### Organizing Multiple Decisions Files

For large repositories, you can organize decisions in two ways:

**Option 1: Multiple workflow runs with separate files**
```
.decispher/
├── decisions.md          # Main file
├── backend-decisions.md  # Backend-specific
└── frontend-decisions.md # Frontend-specific
```

Configure separate workflow jobs (each runs independently):
```yaml
- name: Check Backend Decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/backend-decisions.md'

- name: Check Frontend Decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/frontend-decisions.md'
```

**Option 2: Directory-based organization (Automatic Discovery)**

Provide a directory path instead of a file path. Decision Guardian will automatically discover and parse all `.md` and `.markdown` files in that directory and its subdirectories:

```yaml
- name: Check All Decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Points to directory - note the trailing slash
```

Directory structure example:
```
.decispher/
├── backend/
│   ├── database.md
│   ├── api.md
│   └── auth.md
├── frontend/
│   ├── components.md
│   └── routing.md
└── infrastructure/
    ├── docker.md
    └── kubernetes.md
```

**How it works**:
1. Decision Guardian detects that the path is a directory (using `fs.stat`)
2. Recursively scans all subdirectories
3. Parses all `.md` and `.markdown` files
4. Merges all decisions, errors, and warnings
5. Evaluates them together in a single run

**Benefits**:
- Automatic discovery of new decision files (no workflow updates needed)
- Better organization by domain/team
- Cleaner repository structure
- Single comment on PR combining all decisions
- All decisions evaluated together (not separate workflow runs)

**Important Notes**:
- Hidden directories (starting with `.`) like `.git` are automatically skipped
- Use trailing slash to clearly indicate a directory: `.decispher/` vs `.decispher/decisions.md`
- If a directory contains no `.md` files, you'll get an error about missing decisions
- Parse errors in any file are collected and reported together
- **Non-decision Markdown files** (e.g. a `README.md` inside `.decispher/` that explains your decision structure) will be parsed but will not match any `<!-- DECISION-* -->` markers. They are silently ignored — no parse errors will be produced for files that simply contain no decision blocks. You do **not** need to exclude them.


---

## Decision Format Reference

### Required Fields

#### Decision Marker

```markdown
<!-- DECISION-ID -->
```

This unique identifier must be the first line of each decision block.

#### Title

```markdown
## Decision: Your Decision Title
```

A clear, descriptive title explaining what the decision covers.

#### Status

```markdown
**Status**: Active
```

**Valid Values**:
- `Active` / `Enabled` / `Live` - Currently enforced
- `Deprecated` / `Obsolete` - Still in code but being phased out
- `Superseded` / `Replaced` - Replaced by another decision
- `Archived` / `Inactive` - No longer relevant

**Only `Active` decisions trigger alerts.**

**Critical Behavior**:

**ONLY `Active` status decisions trigger alerts**. All other statuses are **ignored** during PR checks.

```markdown
**Status**: Active        # ✅ Will alert on PR
**Status**: Deprecated    # ❌ Ignored (no alert)
**Status**: Superseded    # ❌ Ignored (no alert)
**Status**: Archived      # ❌ Ignored (no alert)
```

**Why other statuses exist**:

- `Deprecated`: Decision still in decision file for reference, but no longer enforced
- `Superseded`: Replaced by newer decision (include link to new decision)
- `Archived`: Historical record only

**Code implementation**:
```typescript
const activeDecisions = decisions.filter(d => d.status === 'active');
// Only active decisions are evaluated
```

**Best practice**: 

Instead of deleting old decisions, change their status:
```markdown

## Decision: Legacy System

**Status**: Deprecated  
**Deprecated Date**: 2025-01-15
**Superseded By**: DECISION-NEW-002

This decision is no longer enforced. See DECISION-NEW-002 for current guidance.
```




This preserves history while preventing alerts.


#### Date

```markdown
**Date**: 2025-01-15
```

**Format**: `YYYY-MM-DD` (ISO 8601)

This tracks when the decision was made. Decision Guardian will warn if:
- Date is in the future
- Date is more than 10 years old (suggesting it should be reviewed)

#### Severity

```markdown
**Severity**: Critical
```

**Valid Values**:

| Severity | Synonyms | Use Case | Fails PR? |
|----------|----------|----------|-----------|
| `Info` | `Informational`, `Low` | FYI notices, documentation | No |
| `Warning` | `Warn`, `Medium` | Important but not blocking | No |
| `Critical` | `Error`, `High`, `Blocker` | Must be reviewed carefully | Yes (if `fail_on_critical: true`) |

#### Schema Version (Internal)

Decision Guardian internally tracks a schema version for every decision.

- **Field**: `schemaVersion`
- **Current Value**: `1` (Always)
- **Purpose**: Future-proofing for potential schema changes. You generally don't need to specify this manually in Markdown; the parser assigns version 1 automatically.

#### Files

```markdown
**Files**:
- `src/config/*.ts`
- `lib/security/**/*.js`
- `!lib/security/tests/**`
```

File patterns use glob syntax:

| Pattern | Matches |
|---------|---------|
| `*.ts` | All TypeScript files in current directory |
| `**/*.ts` | All TypeScript files in any subdirectory |
| `src/config/*.ts` | TypeScript files in `src/config/` only |
| `!pattern` | Exclude files matching pattern |

**Examples**:

```markdown
**Files**:
- `package.json`                    # Exact file
- `src/**/*.ts`                     # All TS files under src/
- `*.config.js`                     # All config files
- `migrations/**/*.sql`             # All SQL migrations
- `!migrations/**/test_*.sql`       # Exclude test migrations
```

**Path Normalization**:

Decision Guardian automatically normalizes file paths to ensure consistent matching across platforms:

1. **Backslashes → Forward slashes**:
   ```
   Windows:  src\config\database.ts
   Linux:    src/config/database.ts
   Internal: src/config/database.ts  (always forward slash)
   ```

2. **Unicode Normalization (NFC)**:
   - Handles accented characters consistently
   - Prevents issues with different Unicode representations

3. **What this means**:
   - Always write patterns with forward slashes: `src/config/*.ts`
   - They will match files on Windows even though Windows uses backslashes
   - Both `src/api/auth.ts` and `src\api\auth.ts` will match pattern `src/api/*.ts`

**In logs, you'll see normalized paths**:
```
File: src/config/database.ts  (even on Windows)
```


#### Context

```markdown
### Context

This is where you explain:
- Why this decision was made
- What developers should know
- What to watch out for
- Links to related documentation
```

The context section is the most important part. Make it:
- Clear and actionable
- Specific about risks
- Include examples where helpful
- Link to deeper documentation

---

## Advanced Rules System

For complex matching scenarios, Decision Guardian supports a JSON-based rules system alongside file patterns.

### When to Use Advanced Rules

Use advanced rules when you need to:
- Match specific code patterns (not just files)
- Combine multiple conditions with AND/OR logic
- Match content within diffs (added/modified lines)
- Exclude certain files from broad patterns
- Create conditional logic (e.g., "if file X changes AND contains pattern Y")

### Rules vs Files: Precedence

**Important**: If a decision block contains a `**Rules**:` section, the legacy `**Files**:` section is **effectively ignored** for matching purposes, though it serves as documentation.

- **Rules**: The source of truth for matching logic.
- **Files**: Legacy simple pattern matching.
- **Recommendation**: If using Advanced Rules, you can omit `Files:` or keep it purely for human readability.

### Basic Rule Structure

#### Inline Rules

```markdown
**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.ts",
  "content_rules": [
    {
      "mode": "string",
      "patterns": ["process.env", "API_KEY"]
    }
  ]
}
```
```

This rule triggers when:
1. Any TypeScript file under `src/` is modified, AND
2. The changes contain `process.env` or `API_KEY`

#### External Rule Files

For complex rules or reusable rule sets, you can reference external JSON files:

```markdown
**Rules**: [Security Rules](./rules/security-rules.json)
```

Or simply:

```markdown
**Rules**: ./rules/database-rules.json
```

The external file should contain valid JSON matching the rule structure:

```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/db/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["DROP TABLE", "TRUNCATE"]
        }
      ]
    }
  ]
}
```

**Benefits of external files**:
- Reuse rules across multiple decisions
- Keep decision files cleaner and more readable
- Share rule libraries across repositories
- Version control complex rule logic separately

**Path Resolution**:

External rule file paths are resolved **relative to the decision file's location**, not the repository root.

**Example**:

If your decision file is at:
```
.decispher/backend/database.md
```

And you reference:
```markdown
**Rules**: ./rules/db-rules.json
```

Decision Guardian will look for:
```
.decispher/backend/rules/db-rules.json
```

**Best practice**: Use relative paths from the decision file:
```markdown
**Rules**: ./rules/security-rules.json        # Same directory
**Rules**: ../shared-rules/common.json        # Parent directory (allowed)
**Rules**: ../../global-rules/security.json   # Two levels up (allowed)
```

**Security note**: While `..` is allowed in rule file references, absolute paths and paths outside the workspace are blocked for security.

### Rule Types

#### File Rules

Match files by glob pattern, optionally with content matching:

```json
{
  "type": "file",
  "pattern": "src/api/**/*.ts",
  "exclude": "src/api/**/*.test.ts",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "fetch\\(['\"]https://",
      "flags": "i"
    }
  ]
}
```

**Fields**:
- `type`: Always `"file"`
- `pattern`: Glob pattern for file paths
- `exclude`: Optional glob to exclude files
- `content_rules`: Array of content matching rules (see below)

### Content Matching Modes

#### 1. String Mode

Match exact strings in changed lines:

```json
{
  "mode": "string",
  "patterns": ["TODO", "FIXME", "console.log"]
}
```

**Use for**: Simple keyword matching

#### 2. Regex Mode

Match using regular expressions:

```json
{
  "mode": "regex",
  "pattern": "password\\s*=\\s*['\"]",
  "flags": "i"
}
```

**Flags**:
- `i` - Case insensitive
- `m` - Multiline
- `g` - Global

**Security**: Decision Guardian runs regex with a 5-second timeout and rejects unsafe patterns to prevent ReDoS attacks.

**Use for**: Complex pattern matching, validation checks

**Security Protections**:

Decision Guardian includes multiple layers of regex security:

1. **Safe-Regex Check**:
   ```typescript
   if (!safeRegex(pattern)) {
     // Pattern rejected before execution
     logStructured('warning', '[Security] Unsafe regex pattern rejected');
   }
   ```

2. **VM Sandbox Execution**:
   - All regex runs in isolated VM context
   - No access to file system or process
   - Code generation disabled (`codeGeneration: { strings: false, wasm: false }`)

3. **Timeout Protection**:
   - Maximum execution time: **5000ms (5 seconds)**
   - Prevents ReDoS (Regular Expression Denial of Service)
   - If timeout exceeded, match returns `false`

4. **Content Size Limit**:
   - Maximum content size: **1 MB**
   - Prevents memory exhaustion attacks

5. **Pattern Length Limit**:
   - Maximum pattern length: **1000 characters**
   - Prevents complex pattern attacks

**Examples of rejected patterns**:

```json
// ❌ Catastrophic backtracking
{
  "pattern": "(a+)+"
}
// Warning: [Security] Unsafe regex pattern rejected

// ❌ Too complex
{
  "pattern": "very-long-pattern-over-1000-chars..."
}
// Warning: [Security] Regex pattern too complex

// ❌ Content too large
// Warning: [Security] Content exceeds size limit
```

**What you'll see in logs**:

```
Warning: [Security] Unsafe regex pattern rejected | {"pattern":"(a+)+"}
Warning: Regex check failed for pattern | {"pattern":"...","error":"Timeout"}
```

**Result Caching**:

To improve performance, regex results are cached:
- Cache key: `SHA256(pattern:flags:content_hash)`
- Maximum cache size: 500 entries
- LRU eviction: 10% of cache when full
- Prevents re-evaluating same pattern on same content


#### 3. Line Range Mode

Match changes in specific line numbers:

```json
{
  "mode": "line_range",
  "start": 1,
  "end": 50
}
```

**Use for**: Protecting specific sections (e.g., license headers, config blocks)

#### 4. Full File Mode

Match any change to the file:

```json
{
  "mode": "full_file"
}
```

**Use for**: Files that always need review regardless of what changed

#### 5. JSON Path Mode (Experimental)

Match changes to specific JSON keys (heuristic with hierarchical ordering enforce):

```json
{
  "mode": "json_path",
  "paths": ["$.database.pool_size", "$.api.timeout"]
}
```

**How it works**:
- Parses the diff to find changed lines
- Verifies that ALL keys in the path appear in the changed lines
- Enforces hierarchical order: each subsequent key must appear at a line number >= the previous key
- **Example**: `config.server.port` matches only if `config`, `server`, and `port` all appear in the diff in that order.

**Use for**: Configuration files where structural changes matter and you want to avoid matching random occurrences of common keys like "id" or "name".

> **Note**: This mode is **Experimental**. It uses a lightweight heuristic (regex-based) to verify key presence and order without fully parsing the JSON/YAML content. This ensures compatibility with git diffs (which are often partial files) but may have edge cases. Use in production with the understanding that false positives are possible if keys appear in comments or strings.

### Complex Rule Logic

#### AND Logic (All conditions must match)

```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/auth/**/*.ts"
    },
    {
      "type": "file",
      "pattern": "src/database/**/*.ts"
    }
  ]
}
```

This triggers only if BOTH auth and database files are changed.

#### OR Logic (Any condition matches)

```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "Dockerfile"
    },
    {
      "type": "file",
      "pattern": "docker-compose.yml"
    }
  ]
}
```

This triggers if EITHER Docker file is changed.

#### Nested Logic

Combine AND/OR for complex scenarios:

```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/api/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["fetch", "axios"]
        }
      ]
    },
    {
      "match_mode": "any",
      "conditions": [
        {
          "type": "file",
          "pattern": "src/config/api.ts"
        },
        {
          "type": "file",
          "pattern": "src/lib/http-client.ts"
        }
      ]
    }
  ]
}
```

This reads as: "Alert if (API files with fetch/axios changes) AND (config OR http-client file changed)"

**Nesting Limit**: Maximum 10 levels deep to prevent stack overflow

### Complete Example

```markdown
<!-- DECISION-SEC-001 -->
## Decision: Prevent Hardcoded Credentials

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/**/*.ts`
- `src/**/*.js`

**Rules**:
~~~json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/**/*.{ts,js}",
      "exclude": "**/*.test.{ts,js}",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(password|api[_-]?key|secret|token)\\s*[=:]\\s*['\"][^'\"]+['\"]",
          "flags": "i"
        }
      ]
    },
    {
      "type": "file",
      "pattern": ".env*",
      "content_rules": [
        {
          "mode": "string",
          "patterns": ["PASSWORD=", "API_KEY=", "SECRET="]
        }
      ]
    }
  ]
}
~~~

### Context

This decision prevents hardcoded credentials in source code.

**What triggers an alert**:
- Any JS/TS file (excluding tests) containing patterns like `password = "xyz"`, `apiKey: "abc"`, etc.
- .env files with PASSWORD, API_KEY, or SECRET assignments

**What to do**:
- Use environment variables
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Never commit credentials to git
```

### Error Handling in Advanced Rules

Decision Guardian uses **error boundaries** to prevent one bad rule from breaking all checks:

**Rule-Level Error Handling**:

```typescript
try {
  // Evaluate rule
  const result = await evaluateRule(rule);
  return result;
} catch (error) {
  // Log warning but continue
  core.warning(`Rule evaluation failed for pattern "${rule.pattern}": ${error.message}`);
  
  return {
    matched: false,
    error: error.message  // Included in response
  };
}
```

**What this means**:

1. **Bad rule doesn't fail entire check**:
   - If rule 1 has invalid regex → warning logged, skipped
   - Rules 2-10 continue normally
   - PR check completes successfully

2. **Batch Processing**:
   ```typescript
   const results = await Promise.allSettled(
     batch.map(decision => evaluate(decision))
   );
   // Captures both successes and failures
   ```

3. **You'll see in logs**:
   ```
   Warning: Rule evaluation failed for pattern "src/**/*.ts": Invalid regex
   Warning: 3 decision evaluations failed in this batch. Check debug logs for details.
   ```

4. **Debug mode shows details**:
   ```yaml
   env:
     ACTIONS_STEP_DEBUG: true
   ```
   
   Shows:
   ```
   Debug: Decision evaluation failed: Timeout exceeded
   ```

**When errors occur**:

Common causes:
- Invalid regex pattern
- Timeout (regex takes > 5 seconds)
- Malformed JSON rules
- Nested rules exceed depth limit (10 levels)

**Result**:
- Error logged as warning
- Decision marked as `matched: false`
- Other decisions continue evaluating
- PR check doesn't fail (unless `fail_on_error: true`)

---

## Configuration Options

### Action Inputs

Configure Decision Guardian in your workflow file:

```yaml
- uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/decisions.md'
    fail_on_critical: true
    fail_on_error: false
    token: ${{ secrets.GITHUB_TOKEN }}
  env:
    DG_TELEMETRY: '0'  # Optional: disable telemetry
```

#### `decision_file`

**Type**: String  
**Default**: `.decispher/decisions.md`  
**Required**: No

Path to your decisions file OR directory (relative to repository root).

**Accepts**:
- Single file path: `.decispher/decisions.md`
- Directory path: `.decispher/` (auto-discovers all `.md` and `.markdown` files recursively)

**Examples**:
```yaml
decision_file: 'docs/architecture/decisions.md'  # Single file
decision_file: '.github/decisions.md'            # Single file
decision_file: '.decispher/'                     # Directory (recursive scan)
decision_file: 'docs/decisions/'                 # Directory (recursive scan)
```

**Directory Mode Behavior**:
When you provide a directory path, Decision Guardian will:
- Recursively scan all subdirectories
- Parse all files ending in `.md` or `.markdown`
- Skip hidden directories (starting with `.`) like `.git`
- Merge all decisions from all files into a single evaluation

**Directory structure example**:
```
.decispher/
├── backend/
│   ├── database.md
│   ├── api.md
│   └── auth.md
├── frontend/
│   ├── components.md
│   └── routing.md
└── infrastructure/
    ├── docker.md
    └── kubernetes.md
```

**Security**: 
- Path must be relative (not absolute)
- Cannot contain `..` (path traversal protection)
- Path traversal is detected and blocked with error: `Security: Path traversal detected`


#### `fail_on_critical`

**Type**: Boolean  
**Default**: `false`  
**Required**: No

Whether to fail the PR check when Critical decisions are violated.

**Recommended**: `true` for production projects

**Example**:
```yaml
fail_on_critical: true  # PR check fails if critical files modified
```

When `true`:
- PR status check shows ❌ if critical decisions match
- Prevents accidental merging of risky changes
- Can be overridden by admins if necessary

When `false`:
- PR status check always passes ✅
- Comments still appear with context
- Purely informational

#### `fail_on_error`

**Type**: Boolean  
**Default**: `false`  
**Required**: No

Whether to fail the action if the decisions file has parse errors.

**Recommended**: `false` (be lenient with syntax errors)

**Example**:
```yaml
fail_on_error: true  # Strict mode - any parse errors fail the check
```

Parse errors include:
- Invalid decision ID format
- Malformed JSON rules
- Missing required fields
- Invalid date formats

When `false`: Warnings are logged but the action continues.

#### `token`

**Type**: String  
**Default**: `${{ github.token }}`  
**Required**: Yes

GitHub token for API access. Always use the automatic token:

```yaml
token: ${{ secrets.GITHUB_TOKEN }}
```

**Do not** use a personal access token (PAT) unless you need specific permissions.

### Action Outputs

Decision Guardian sets these outputs for use in subsequent workflow steps:

```yaml
- uses: DecispherHQ/decision-guardian@v1
  id: decision-check
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use outputs
  run: |
    echo "Matches found: ${{ steps.decision-check.outputs.matches_found }}"
    echo "Critical count: ${{ steps.decision-check.outputs.critical_count }}"
```

#### `matches_found`

**Type**: Number

Total number of decision matches found.

#### `critical_count`

**Type**: Number

Number of Critical severity matches.

#### `metrics`

**Type**: JSON String

Detailed performance and usage metrics:

```json
{
  "api_calls": 5,
  "api_errors": 0,
  "rate_limit_hits": 0,
  "files_processed": 237,
  "decisions_evaluated": 15,
  "matches_found": 3,
  "duration_ms": 4521
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `api_calls` | number | Total GitHub API calls made |
| `api_errors` | number | Number of API errors (excluding rate limits) |
| `rate_limit_hits` | number | Number of times rate limit was hit |
| `files_processed` | number | Total files analyzed in the PR |
| `decisions_evaluated` | number | Number of decisions checked |
| `matches_found` | number | Total decision matches |
| `duration_ms` | number | Total execution time in milliseconds |

**Also logged to console**:

```
=== Performance Metrics ===
API Calls: 5
API Errors: 0
Rate Limit Hits: 0
Files Processed: 237
Decisions Evaluated: 15
Matches Found: 3
Duration: 4521ms
```

**Usage in workflow**:

```yaml
- name: Decision Guardian
  id: decisions
  uses: DecispherHQ/decision-guardian@v1

- name: Parse Metrics
  run: |
    METRICS='${{ steps.decisions.outputs.metrics }}'
    echo "Duration: $(echo $METRICS | jq -r '.duration_ms')ms"
    echo "Files: $(echo $METRICS | jq -r '.files_processed')"
```


---

## Sample PR Comment

When Decision Guardian finds matches, it posts a structured comment on the Pull Request. Here is what a typical comment looks like:

---

<!-- decision-guardian-v1 -->
<!-- hash:a1b2c3d4e5f6 -->

## ⚠️ Decision Context Alert

This PR modifies **3 file(s)** protected by architectural decisions. Please review the context below before merging.

---

### 🔴 Critical Decisions (1)

#### DECISION-DB-001: Database Connection Pool Configuration

**File**: `src/config/database.ts`  
**Matched**: `src/config/*.ts`  
**Match Type**: File pattern  
**Date**: 2025-01-15

These files control database connection pooling. Changes here can cause:
- Connection exhaustion under load
- Memory leaks
- Performance degradation

Always load-test changes with production-like traffic patterns.

---

### 🟡 Important Decisions (1)

#### DECISION-API-001: Public API Contract Protection

**File**: `src/api/v1/users.ts`  
**Matched**: `src/api/v1/**/*.ts`  
**Match Type**: Rule-based  
**Date**: 2025-01-12

Changes to v1 API routes affect external clients. Before merging:
- Update API documentation
- Notify integration partners
- Consider deprecation path

---

### ℹ️ Informational (1)

#### DECISION-PERF-001: Performance-Critical Path

**File**: `src/services/search.ts`  
**Matched**: `src/services/search.ts`  
**Match Type**: File pattern  
**Date**: 2025-01-05

This file handles 10K+ req/s. Run benchmarks before merging.

---
*🤖 Generated by [Decision Guardian](https://github.com/DecispherHQ/decision-guardian)*

---

**Key elements of the comment:**
- **Header** — identifies the comment for idempotent updates (the `<!-- hash:... -->` tag prevents duplicate edits)
- **Severity groupings** — 🔴 Critical, 🟡 Important (Warning), ℹ️ Informational
- **Per-match details** — which file triggered it, which pattern matched, and the full decision context
- **Footer** — attribution link

When no violations are found on a subsequent commit (after a previous violation), the comment updates to show an **All Clear ✅** status instead of being deleted.

---

## Error Message Reference

A consolidated reference of all error and warning messages you may encounter, their causes, and how to fix them.

### Parse-Time Errors & Warnings

| Message | Cause | Fix |
|---------|-------|-----|
| `Warning: Line N: Decision missing required fields (id or title)` | A decision block is missing the `<!-- DECISION-ID -->` marker or `## Decision:` title | Add the missing marker/title |
| `Warning: DECISION-XXX: Failed to parse JSON rules: Unexpected token` | Malformed JSON in a `**Rules**:` block | Validate JSON with [jsonlint.com](https://jsonlint.com) |
| `Warning: DECISION-XXX: Invalid date format` | Date is not in `YYYY-MM-DD` format | Use ISO 8601 format: `2025-01-15` |
| `Warning: DECISION-XXX: Date is in the future` | Decision date is set to a future date | Correct the date |
| `Warning: DECISION-XXX: Date is more than 10 years old` | Decision may be stale | Review and update or archive the decision |
| `Warning: DECISION-XXX: Unknown status value` | Status is not one of the valid values | Use `Active`, `Deprecated`, `Superseded`, or `Archived` |

### Security Errors

| Message | Cause | Fix |
|---------|-------|-----|
| `Security: Path traversal detected` | `decision_file` input contains `..` or is an absolute path | Use a relative path without `..` (e.g. `.decispher/decisions.md`) |
| `[Security] Unsafe regex pattern rejected` | A regex in a `Rules` block could cause catastrophic backtracking (ReDoS) | Simplify the regex; avoid patterns like `(a+)+` or `(.*)*` |
| `[Security] Regex pattern too complex` | Regex pattern exceeds 1000 characters | Shorten the pattern |
| `[Security] Content exceeds size limit` | The diff content being matched exceeds 1 MB | Use file-level patterns instead of content rules for very large files |

### Runtime Errors

| Message | Cause | Fix |
|---------|-------|-----|
| `Failed to read file: ENOENT` | Decision file not found at the specified path | Verify the file exists and is committed; check `decision_file` path |
| `Not a pull request event, skipping comment` | Workflow triggered on `push` or other non-PR event | Ensure workflow trigger is `on: pull_request` |
| `No changes detected` | No files in the comparison scope (e.g. nothing staged in `--staged` mode) | Stage files first (`git add`) or use `--all` / `--branch` mode |
| `No git repository found` | CLI run outside a git repository | Run from within a git repository root |
| `Rule evaluation failed for pattern "...": ...` | A rule threw an unexpected error during evaluation | Check rule JSON syntax and regex validity; enable debug mode for details |
| `Warning: Comment would exceed 60000 chars, truncating...` | PR has too many matches to fit in one GitHub comment | Use more specific patterns to reduce match count |
| `Found N duplicate comments, cleaning up...` | Race condition created multiple Decision Guardian comments | Informational — auto-cleaned. Add `concurrency:` to workflow to prevent |
| `Conflict detected when posting comment, retrying... (N/3)` | Concurrent workflow runs hit a 409 conflict | Informational — auto-retried. Add `concurrency:` to workflow |
| `Rate limit hit for fetch files page N. Waiting Xs before retry N/3` | GitHub API rate limit exceeded | Wait for reset, re-run workflow, or split large PRs |
| `Error reading external rule file: ...` | External JSON rule file not found at the resolved path | Verify the path is relative to the decision file's location |

### CLI-Specific Errors

| Message | Cause | Fix |
|---------|-------|-----|
| `Error: No .decispher/ directory found` | `checkall` run in a directory with no `.decispher/` folder | Run from repo root or create `.decispher/` with `decision-guardian init` |
| `Error reading decision file: ...` | File path argument to `check` is wrong | Verify the path; use `decision-guardian checkall` to auto-discover |
| `Exit code 1 (no violations shown)` | Parse error in decision file with `--fail-on-critical` | Check decision file syntax; look for malformed IDs or JSON |

---

## Telemetry & Data Privacy

Decision Guardian includes optional telemetry to help improving the tool. We value your privacy and are transparent about what data is collected.

### Data Collected

We collect **anonymous** usage metrics only. We **NEVER** collect source code, file names, file contents, decision titles, or any sensitive project information.

**The Payload:**
See `src/telemetry/payload.ts` for the exact type definition.

```typescript
interface TelemetryPayload {
    event: 'run_complete';
    version: string;        // Tool version (e.g. "1.0.0")
    source: 'action' | 'cli';
    timestamp: string;      // ISO date
    metrics: {
        files_processed: number;      // Count only
        decisions_evaluated: number;  // Count only
        matches_found: number;        // Count only
        critical_matches: number;     // Count only
        warning_matches: number;      // Count only
        info_matches: number;         // Count only
        duration_ms: number;          // Execution time
    };
    environment: {
        node_version: string;         // e.g. "v20.10.0"
        os_platform: string;          // e.g. "linux", "win32"
        ci: boolean;                  // true/false
    };
}
```

### Telemetry Endpoint

Data is sent to our Cloudflare Worker endpoint:
`https://decision-guardian-telemetry.iamalizaidi110.workers.dev/collect`

### Privacy Policy

For more details on how we handle data, please refer to:
- [TELEMETRY.md](../../TELEMETRY.md) - Technical details
- [PRIVACY.md](../../PRIVACY.md) - Privacy policy

### Opting Out

You can disable telemetry at any time by setting the `DG_TELEMETRY` environment variable to `0` or `false`.

```yaml
env:
  DG_TELEMETRY: '0'
```

---

## Use Cases & Examples

### Example 1: Database Migration Safety

**Scenario**: Prevent database schema changes without proper review

```markdown
<!-- DECISION-DB-MIGRATION-001 -->
## Decision: Database Schema Changes

**Status**: Active  
**Date**: 2025-01-10  
**Severity**: Critical

**Files**:
- `prisma/schema.prisma`
- `migrations/**/*.sql`
- `src/db/schema.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "prisma/schema.prisma"
    },
    {
      "type": "file",
      "pattern": "migrations/**/*.sql",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(DROP|ALTER|TRUNCATE)\\s+TABLE",
          "flags": "i"
        }
      ]
    }
  ]
}
```

### Context

Schema changes can cause:
- Production downtime
- Data loss
- Breaking changes for deployed services

**Required before merging**:
1. DBA review
2. Backup verification
3. Rollback plan documented
4. Load test completed
5. Migration tested on staging

**Documentation**: [Migration Runbook](link)

---
```

### Example 2: API Contract Changes

**Scenario**: Alert when public API contracts change

```markdown
<!-- DECISION-API-001 -->
## Decision: Public API Contract Protection

**Status**: Active  
**Date**: 2025-01-12  
**Severity**: Warning

**Files**:
- `src/api/v1/**/*.ts`
- `openapi.yaml`

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/api/v1/**/*.ts",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "@(Get|Post|Put|Delete|Patch)\\(",
      "flags": "g"
    }
  ]
}
```

### Context

Changes to v1 API routes affect external clients.

**Before merging**:
- Update API documentation
- Notify integration partners
- Consider deprecation path
- Add to changelog

**Breaking changes require**: Major version bump and migration guide

---
```

### Example 3: Security-Sensitive Files

**Scenario**: Protect authentication and authorization code

```markdown
<!-- DECISION-SEC-AUTH-001 -->
## Decision: Authentication System Protection

**Status**: Active  
**Date**: 2025-01-08  
**Severity**: Critical

**Files**:
- `src/auth/**/*`
- `src/middleware/auth.ts`
- `src/lib/jwt.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/auth/**/*.ts"
    },
    {
      "type": "file",
      "pattern": "src/**/*.ts",
      "content_rules": [
        {
          "mode": "string",
          "patterns": [
            "jwt.sign",
            "bcrypt",
            "crypto.createHmac",
            "passport.authenticate"
          ]
        }
      ]
    }
  ]
}
```

### Context

Authentication bugs can lead to:
- Account takeovers
- Data breaches
- Compliance violations

**Required reviews**:
- Security team approval
- Penetration testing
- Session management audit

**Testing checklist**:
- [ ] Unit tests for all auth paths
- [ ] Integration tests with real tokens
- [ ] Test with expired/invalid tokens
- [ ] Test permission boundaries

---
```

### Example 4: Performance-Critical Code

**Scenario**: Flag changes to hot paths

```markdown
<!-- DECISION-PERF-001 -->
## Decision: Performance-Critical Path Protection

**Status**: Active  
**Date**: 2025-01-05  
**Severity**: Warning

**Files**:
- `src/services/search.ts`
- `src/lib/cache.ts`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/services/search.ts",
      "content_rules": [
        {
          "mode": "line_range",
          "start": 45,
          "end": 120
        }
      ]
    },
    {
      "type": "file",
      "pattern": "src/**/*.ts",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(for|while)\\s*\\([^)]*\\)\\s*{[^}]*(for|while)",
          "flags": "s"
        }
      ]
    }
  ]
}
```

### Context

These files handle 10K+ requests/second. Changes here impact:
- API response times
- Server CPU usage
- User experience

**Before merging**:
- Run performance benchmarks
- Compare against baseline metrics
- Check for O(n²) complexity
- Profile with production data

**Benchmark script**: `npm run benchmark`

---
```

### Example 5: Configuration File Changes

**Scenario**: Require approval for infrastructure config

```markdown
<!-- DECISION-INFRA-001 -->
## Decision: Infrastructure Configuration Protection

**Status**: Active  
**Date**: 2025-01-03  
**Severity**: Critical

**Files**:
- `Dockerfile`
- `docker-compose.yml`
- `k8s/**/*.yaml`
- `.github/workflows/*.yml`

**Rules**:
```json
{
  "match_mode": "any",
  "conditions": [
    {
      "type": "file",
      "pattern": "{Dockerfile,docker-compose.yml}"
    },
    {
      "type": "file",
      "pattern": "k8s/**/*.yaml",
      "content_rules": [
        {
          "mode": "string",
          "patterns": [
            "replicas:",
            "resources:",
            "limits:",
            "requests:"
          ]
        }
      ]
    }
  ]
}
```

### Context

Infrastructure changes affect:
- Production deployments
- Cost (resource limits)
- Availability (replicas)
- Security (container config)

**Required before merging**:
- DevOps team review
- Staging deployment test
- Rollback plan
- Monitoring alerts updated

---
```

---

## Troubleshooting

### Common Issues

#### Issue: "Not a pull request event, skipping comment"

**Cause**: Decision Guardian only runs on pull request events, but workflow triggered on push to main.

**Solution**: Update your workflow trigger:

```yaml
on:
  pull_request:  # ✅ Correct
  # Don't use: push, schedule, etc. for comment posting
```

#### Issue: "Failed to read file: ENOENT"

**Cause**: Decisions file not found at specified path.

**Solution**: 
1. Verify the file exists: `ls .decispher/decisions.md`
2. Check the path in your workflow:
   ```yaml
   decision_file: '.decispher/decisions.md'  # Must match actual location
   ```
3. Ensure the file is committed to git

#### Issue: "Security: Path traversal detected"

**Cause**: Invalid file path with `..` or absolute path.

**Solution**: Use relative paths only:

```yaml
decision_file: '.decispher/decisions.md'  # ✅ Correct
decision_file: '../decisions.md'          # ❌ Invalid
decision_file: '/etc/decisions.md'        # ❌ Invalid
```

#### Issue: Parse errors in decisions file

**Cause**: Malformed markdown or invalid JSON rules.

**Solution**: Check the workflow logs for specific errors:

```
Warning: Line 45: Decision missing required fields (id or title)
Warning: DECISION-001: Failed to parse JSON rules: Unexpected token
```

Common fixes:
- Ensure decision ID is in `<!-- DECISION-ID -->` format
- Validate JSON rules with a JSON validator
- Check all required fields are present
- Use correct field names (case-sensitive)

#### Issue: "Rate limit hit"

**Cause**: GitHub API rate limit exceeded (rare, usually only with 3000+ file PRs).

**Solution**: Decision Guardian automatically retries with exponential backoff. If it fails:

1. Wait for rate limit to reset (shown in error)
2. Re-run the workflow
3. For chronic issues, split large PRs into smaller ones

#### Issue: Pattern Matching Not Working as Expected

**Cause**: Glob patterns can be tricky.

**Solution**:
1. Use the `repro_minimatch.js` script included in the root of the repository to test your patterns against file paths locally.
   ```bash
   node repro_minimatch.js
   # Edit the file to change 'file' and 'pattern' variables to test specific cases
   ```
2. Verify you are using forward slashes `/` even on Windows.

#### Issue: No comment posted on PR

**Possible causes**:

1. **No matches found** - Check if files in PR actually match decision patterns:
   ```bash
   # Test pattern matching locally
   echo "src/config/database.ts" | grep -E "src/config/.*\.ts"
   ```

2. **Permissions issue** - Ensure workflow has `pull-requests: write`:
   ```yaml
   permissions:
     pull-requests: write
     contents: read
   ```

3. **Decision status not Active** - Only Active decisions trigger alerts:
   ```markdown
   **Status**: Active  # Must be Active, not Deprecated/Archived
   ```

#### Issue: Comment not updating, creating duplicates

**Cause**: Concurrent workflow runs or race condition (very rare).

**Solution**: Decision Guardian has built-in duplicate cleanup. If you see duplicates:

1. They'll be auto-cleaned on next run
2. Manually delete extra comments if needed
3. Enable concurrency control in workflow:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
     cancel-in-progress: true
   ```

### Debug Mode

Enable debug logging:

```yaml
- uses: DecispherHQ/decision-guardian@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
  env:
    ACTIONS_STEP_DEBUG: true
```

This outputs detailed logs including:
- File matching decisions
- Rule evaluation steps
- API calls and responses
- Performance metrics

---

## Performance & Optimization

### How Decision Guardian Handles Large PRs

Decision Guardian automatically adjusts its processing strategy based on PR size:

| PR Size | Strategy | Implementation |
|---------|----------|----------------|
| < 100 files | Single batch fetch | Fetches all files at once with `getFileDiffs()` |
| 100-1000 files | Chunked processing | Processes in chunks of 500 files |
| 1000+ files | Streaming mode | Uses `streamFileDiffs()` with batch processing |
| 3000+ files | Paginated limit | GitHub's max 3000 files (100 per page × 30 pages) |

**Streaming Mode** (triggered at 1000+ files):

When Decision Guardian detects a large PR:
```
core.info('Large PR detected (1247 files), using streaming mode')
```

It switches to `processWithStreaming()`:
- Fetches files in batches of 100 (GitHub's page limit)
- Processes each batch immediately (memory efficient)
- Reports progress: `Processed 300 files, found 5 matches so far`
- Maximum 30 pages = 3000 files hard limit

**File Chunking** (100-1000 files):

For medium PRs, file matching is chunked:
```typescript
const CHUNK_SIZE = 500;
// Processes files in chunks to avoid memory issues
```

**API Call Optimization**:

Decision Guardian minimizes API calls:
- **First page check**: If PR < 100 files, uses single API call
- **Pagination**: Only fetches additional pages if needed
- **Deduplication**: Files are deduplicated by path
- **Caching**: Pattern Trie provides O(1) candidate lookup



### Optimization Techniques Used

### Optimization Techniques Used

1.  **Pattern Trie (Aho-Corasick variant)**:
    -   **Problem**: Matching N files against M patterns is normally O(N × M).
    -   **Solution**: We compile all decision patterns into a Trie (Prefix Tree).
    -   **Result**: Candidate lookup becomes **O(L)** where L is the length of the file path, effectively **O(1)** relative to the number of decisions. This allows Decision Guardian to scale to thousands of decisions with negligible performance impact.

2.  **Caching**: Regex results cached to avoid re-evaluation
3. **Parallel Processing**: Batch rule evaluation with Promise.allSettled
4. **Streaming**: Memory-efficient processing for huge PRs
5. **Early Termination**: Stop matching once enough context found

### Performance Monitoring

Check the metrics output:

```json
{
  "api_calls": 5,
  "files_processed": 237,
  "decisions_evaluated": 15,
  "duration_ms": 4521
}
```

**Typical benchmarks**:
- 1 API call per 100 files
- 10-50ms per decision evaluation
- Sub-second for simple pattern matching
- 1-5 seconds for complex rules with regex

### Tips for Faster Runs

1. **Use specific patterns** instead of broad wildcards:
   ```markdown
   src/config/*.ts          # ✅ Fast
   **/*.ts                  # ⚠️ Slower (scans entire repo)
   ```

2. **Limit regex complexity**:
   ```json
   "pattern": "fetch\\("         # ✅ Fast
   "pattern": "(fetch|axios|http|request)\\([^)]*\\)"  # ⚠️ Slower
   ```

3. **Use file patterns** over content rules when possible:
   ```markdown
   Files: src/api/auth.ts   # ✅ Fastest
   Rules: { regex match }   # ⚠️ Requires diff parsing
   ```

4. **Group related decisions**:
   ```markdown
   # Instead of 10 decisions for 10 files
   # Use 1 decision with 10 file patterns
   Files:
   - src/auth/*.ts
   - src/api/*.ts
   - ...
   ```

### Comment Size Limits and Truncation

GitHub limits PR comments to **65,536 characters**. Decision Guardian handles this with progressive truncation:

**Maximum Comment Length**: 60,000 characters (safety margin)

**Truncation Strategy** (applied in order):

1. **Full Comment** (first attempt):
   - Shows all matches with full details
   - If under 60K chars → post as-is ✅

2. **Progressive Truncation** (if full comment too large):
   - **Level 1**: Show 20 detailed matches, rest as summary
   - **Level 2**: Show 10 detailed matches, rest as summary  
   - **Level 3**: Show 5 detailed matches, rest as summary
   - **Level 4**: Show 2 detailed matches, rest as summary
   - **Level 5**: Show 0 detailed matches, only summary

3. **File Limit Per Decision** (combined with above):
   - **Level 1**: Show 10 files per decision in summary
   - **Level 2**: Show 5 files per decision in summary
   - **Level 3**: Show 3 files per decision in summary
   - **Level 4**: Show 1 file per decision in summary

4. **Ultra-Compact Mode** (if still too large):
   - Shows only:
     - Total counts by severity
     - Table of decision IDs with file counts
     - Top 50 decisions (sorted by file count)
   
5. **Hard Truncation** (last resort):
   - Truncates at last newline before 60K
   - Adds warning: `⚠️ Comment truncated due to GitHub's 65536 character limit`

**What you'll see in logs**:

```
Warning: Comment would exceed 60000 chars (73421), truncating...
```

**In the comment**:

When truncated, you'll see:
```markdown
> **Note**: This PR affects **1247 files** - showing summary due to size limits.

### 🔴 Critical Decisions (3)
[First 2 shown in detail]

### 📋 Additional Matches (1245 more)

Click to expand summary of remaining files
...


---
*🤖 Generated by Decision Guardian. Showing 2 of 1247 matches in detail.*
```

**Best practices to avoid truncation**:
- Use specific file patterns (not `**/*`)
- Group related files in single decisions
- Use content rules to filter matches
- Consider splitting very broad decisions

---

## Best Practices

### Writing Effective Decisions

#### 1. Be Specific and Actionable

**Bad**:
```markdown
### Context
This is important. Be careful.
```

**Good**:
```markdown
### Context
This file controls rate limiting. Changes here can:
- Block legitimate users if too strict
- Allow abuse if too lenient
- Cause OOM if configured incorrectly

Before merging:
1. Load test with 2x expected traffic
2. Verify Redis connection pool settings
3. Test rate limit bypass for admins
```

#### 2. Include Links and Examples

```markdown
### Context

API authentication tokens must use JWT with RSA-256 signing.

**Why**: HMAC-SHA256 uses symmetric keys, creating key distribution problems.

**Examples**:
```typescript
// ✅ Correct
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

// ❌ Avoid
const token = jwt.sign(payload, secretKey, { algorithm: 'HS256' });
```

**Related docs**: 
- [JWT Best Practices](https://example.com/jwt-guide)
- [Key Management](https://example.com/keys)
- [Security Audit Results](https://example.com/audit-2024)
```

#### 3. Use Appropriate Severity Levels

| Use Critical When | Use Warning When | Use Info When |
|-------------------|------------------|---------------|
| Production outage risk | Best practice violations | FYI documentation |
| Security vulnerabilities | Performance concerns | Coding standards |
| Data loss possible | Breaking API changes | Design patterns |
| Compliance violation | Tech debt | Historical context |

#### 4. Keep Decisions Updated

```markdown
<!-- DECISION-OLD-001 -->
## Decision: Legacy Authentication System

**Status**: Deprecated  
**Date**: 2023-05-10  
**Severity**: Warning

**Superseded by**: DECISION-AUTH-002

**Files**:
- `src/auth/legacy/**/*`

### Context

This authentication system is being phased out.

**Migration deadline**: 2025-03-01

**New implementations**: Use DECISION-AUTH-002 instead
**Existing code**: Will be migrated in Q1 2025

---
```

#### 5. Organize by Domain

Use consistent ID prefixes:

```
DECISION-DB-*       # Database decisions
DECISION-API-*      # API decisions
DECISION-SEC-*      # Security decisions
DECISION-INFRA-*    # Infrastructure decisions
DECISION-PERF-*     # Performance decisions
DECISION-UI-*       # Frontend/UI decisions
```

### Team Workflow Recommendations

#### For Small Teams (< 10 developers)

1. **Single decisions file**: `.decispher/decisions.md`
2. **Liberal use**: Document anything worth remembering
3. **Quick updates**: Edit directly in PRs
4. **Severity**: Mostly Info and Warning, few Critical

**Example workflow**:
```markdown
<!-- DECISION-TEAM-001 -->
## Decision: PR Review Requirements

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Info

**Files**:
- `.github/CODEOWNERS`

### Context

All PRs require 1 approval. Critical files need 2.

Critical files are marked in CODEOWNERS.
```

**Recommended directory structure**:
```
.decispher/
├── README.md              # Overview of your decision process
├── general/
│   └── pr-process.md
├── backend/
│   └── decisions.md
└── frontend/
    └── decisions.md
```

Then configure:
```yaml
- uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Auto-discovers all .md files
```

#### For Medium Teams (10-50 developers)

1. **Organized decisions**: Split by domain
2. **Clear ownership**: Use CODEOWNERS with decisions file
3. **Regular review**: Quarterly decision audit
4. **Severity enforcement**: Use `fail_on_critical: true`

**Directory structure**:
```
.decispher/
├── decisions.md              # Cross-cutting concerns
├── rules/                    # Shared rule libraries
│   ├── security-common.json
│   └── performance-common.json
├── backend/
│   └── backend-decisions.md
├── frontend/
│   └── frontend-decisions.md
└── infrastructure/
    └── infra-decisions.md
```

**Workflow configuration**:
```yaml
- name: Check All Decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Recursively finds all .md files
    fail_on_critical: true
```

**Decision file example using shared rules**:
```markdown
<!-- DECISION-SEC-001 -->
## Decision: Authentication Security

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `src/auth/**/*.ts`

**Rules**: ./rules/security-common.json

### Context

See shared security rules for details on what triggers alerts.
```

#### For Large Teams (50+ developers)

1. **Federated decisions**: Each team owns their file
2. **Strict governance**: Decision review board
3. **Automated compliance**: Critical decisions enforced
4. **Metrics tracking**: Monitor decision violation rates

**Advanced setup with directory scanning**:
```yaml
# Single job scans entire decision directory tree
- name: Check All Team Decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/'  # Scans all subdirectories
    fail_on_critical: true

# Or if you want separate checks per team:
- name: Check Backend Decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/backend/'
    fail_on_critical: true

- name: Check Frontend Decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/frontend/'
    fail_on_critical: true
```

**Team structure example**:
```
.decispher/
├── backend/
│   ├── api/
│   │   ├── rest-api.md
│   │   └── graphql.md
│   ├── database/
│   │   └── migrations.md
│   └── rules/
│       └── backend-common.json
├── frontend/
│   ├── components/
│   │   └── ui-library.md
│   └── state/
│       └── redux.md
└── shared/
    └── security.md
```

### Decision Lifecycle Management

#### Creating a New Decision

1. **Identify the need**: What keeps breaking? What needs protection?
2. **Document clearly**: Use the template below
3. **Set appropriate severity**: Start conservative (Info), increase if needed
4. **Review with team**: Get feedback on wording and scope
5. **Merge and announce**: Let team know it's active

**Template**:
```markdown
<!-- DECISION-XXX-NNN -->
## Decision: [Clear, Descriptive Title]

**Status**: Active  
**Date**: YYYY-MM-DD  
**Severity**: [Info|Warning|Critical]

**Files**:
- `pattern/one`
- `pattern/two`

### Context

**What**: Brief description of what this protects

**Why**: Reason for the decision

**Impact**: What happens if ignored

**Actions required**: What reviewers should do

**Related**: Links to docs, ADRs, tickets

---
```

#### Updating an Existing Decision

```markdown
<!-- DECISION-DB-001 -->
## Decision: Database Connection Pooling

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical
**Last Updated**: 2025-01-20  
**Updated By**: @username

**Files**:
- `src/config/database.ts`
- `src/lib/db-pool.ts`

### Context

[Updated context with new information]

**Update notes**:
- 2025-01-20: Added max_connections limit warning
- 2025-01-15: Initial version

---
```

#### Deprecating a Decision

```markdown
<!-- DECISION-OLD-LOGGING-001 -->
## Decision: Winston Logger Configuration

**Status**: Deprecated  
**Date**: 2023-06-01  
**Severity**: Warning
**Deprecated Date**: 2025-01-15
**Superseded By**: DECISION-LOGGING-002

**Files**:
- `src/config/winston.ts`

### Context

This decision is deprecated. Use structured logging (DECISION-LOGGING-002) instead.

**Migration guide**: [Link to migration doc]

**Deprecation timeline**:
- 2025-01-15: Marked deprecated
- 2025-03-01: Will change to Archived
- 2025-06-01: Old code will be removed

---
```

#### Archiving a Decision

```markdown
<!-- DECISION-ANCIENT-001 -->
## Decision: Legacy Build System

**Status**: Archived  
**Date**: 2020-03-10  
**Archived Date**: 2025-01-15
**Severity**: Info

**Files**:
- `gulpfile.js` (removed)
- `build/legacy/**` (removed)

### Context

This decision is archived for historical reference only.

**What it was**: Gulp-based build system used 2020-2024

**Why archived**: Migrated to Vite (DECISION-BUILD-003)

**Code removed**: 2024-12-15

---
```

### Security Best Practices

#### 1. Never Commit Secrets in Decisions

**Bad**:
```markdown
API_KEY: sk_live_abc123xyz  # ❌ NEVER DO THIS
```

**Good**:
```markdown
API keys must be stored in AWS Secrets Manager.
Path: `/prod/api-keys/stripe`
```

#### 2. Use Pattern Matching, Not Hardcoded Values

**Bad**:
```json
{
  "mode": "string",
  "patterns": ["password123", "admin@example.com"]
}
```

**Good**:
```json
{
  "mode": "regex",
  "pattern": "(password|secret|token)\\s*[=:]\\s*['\"][^'\"]+['\"]",
  "flags": "i"
}
```

#### 3. Protect the Decisions File Itself

```markdown
<!-- DECISION-META-001 -->
## Decision: Decision Guardian Configuration Protection

**Status**: Active  
**Date**: 2025-01-15  
**Severity**: Critical

**Files**:
- `.decispher/decisions.md`
- `.github/workflows/decision-guardian.yml`

### Context

Changes to Decision Guardian config affect PR protection.

**Required**:
- Senior engineer approval
- Test on a test PR first
- Document changes in commit message

---
```

### Advanced Patterns

#### Pattern 1: Multi-Repo Consistency

For organizations with multiple repos:

**Create a shared decisions template**:
```
shared-decisions/
├── security-decisions.md
├── database-decisions.md
└── api-decisions.md
```

**Import in each repo**:
```bash
# In CI or setup script
curl -o .decispher/security.md https://internal.example.com/shared-decisions/security-decisions.md
```

#### Pattern 2: Dynamic Decision Generation

Generate decisions from other sources:

```yaml
# .github/workflows/generate-decisions.yml
name: Generate Decisions

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate from ADRs
        run: |
          node scripts/adr-to-decisions.js
          
      - name: Commit if changed
        run: |
          git config user.name "Decision Bot"
          git config user.email "bot@example.com"
          git add .decispher/decisions.md
          git commit -m "Update decisions from ADRs" || true
          git push
```

#### Pattern 3: Integration with Other Tools

**With Danger.js**:
```javascript
// dangerfile.js
import { danger, warn } from 'danger';

// Complement Decision Guardian with additional checks
const modifiedFiles = danger.git.modified_files;

if (modifiedFiles.includes('package.json')) {
  warn('📦 package.json modified - review dependencies for security issues');
}
```

**With Reviewdog**:
```yaml
- name: Run Decision Guardian
  uses: DecispherHQ/decision-guardian@v1
  
- name: Reviewdog annotations
  uses: reviewdog/action-eslint@v1
```

### Testing Your Decisions

#### Test Decision Matching Locally

Create a test script:

```bash
#!/bin/bash
# test-decisions.sh

echo "Testing decision patterns..."

# Test 1: Database files
echo "✓ Testing DECISION-DB-001"
if echo "src/config/database.ts" | grep -qE "src/config/.*\.ts"; then
  echo "  ✓ Pattern matches"
else
  echo "  ✗ Pattern failed"
fi

# Test 2: Exclusions
echo "✓ Testing exclusions"
if echo "src/api/test.ts" | grep -qE "src/api/.*\.ts" && \
   ! echo "src/api/test.ts" | grep -qE "\.test\.ts"; then
  echo "  ✗ Should be excluded"
else
  echo "  ✓ Correctly excluded"
fi
```

#### Create Test PRs

Set up test PRs to validate your decisions:

```markdown
# .github/PULL_REQUEST_TEMPLATE/decision-test.md

## Decision Guardian Test PR

This PR tests decision: DECISION-XXX-NNN

**Expected behavior**:
- [ ] Comment should appear
- [ ] Severity should be: [Critical/Warning/Info]
- [ ] Should match files: [list]

**Actual behavior**:
[Fill after running]
```

### Monitoring and Metrics

#### Track Decision Violations

Use GitHub Actions outputs:

```yaml
- name: Run Decision Guardian
  id: decisions
  uses: DecispherHQ/decision-guardian@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Report Metrics
  run: |
    echo "Matches: ${{ steps.decisions.outputs.matches_found }}"
    echo "Critical: ${{ steps.decisions.outputs.critical_count }}"
    
    # Send to monitoring system
    curl -X POST https://metrics.example.com/api/decisions \
      -d "matches=${{ steps.decisions.outputs.matches_found }}" \
      -d "critical=${{ steps.decisions.outputs.critical_count }}"
```

#### Dashboard Example

Track over time:
- Most frequently violated decisions
- Average time to resolve critical violations
- Decisions that need updating (old dates)
- Decision coverage (% of files protected)

### Migration Guide

#### Migrating from Manual PR Comments

**Before**: Team members manually comment on PRs

**After**: Automated with Decision Guardian

**Steps**:

1. **Audit existing comments**: What knowledge exists in old PR discussions?
2. **Document patterns**: Create decisions for recurring comments
3. **Start with Info severity**: Non-blocking at first
4. **Gather feedback**: Iterate on wording
5. **Increase severity**: Move to Warning/Critical as needed

#### Migrating from CODEOWNERS

**Before**: CODEOWNERS for required reviewers

**After**: Use both - CODEOWNERS + Decision Guardian

```
# CODEOWNERS - Who reviews
src/auth/**     @security-team
src/db/**       @database-team

# decisions.md - What to review for
DECISION-SEC-001: Security patterns
DECISION-DB-001: Database migration safety
```

**Benefits of using both**:
- CODEOWNERS: Enforces reviewers
- Decision Guardian: Provides context

#### Migrating from ADRs (Architecture Decision Records)

If you have ADRs in `docs/adr/`:

**Option 1: Reference ADRs**
```markdown
<!-- DECISION-ARCH-001 -->
## Decision: Microservices Communication Pattern

**Status**: Active  
**Date**: 2025-01-10  
**Severity**: Warning

**Files**:
- `services/*/src/api/**/*.ts`

### Context

See ADR-015 for full rationale: [link](docs/adr/015-service-communication.md)

**Quick summary**: All service-to-service calls must use gRPC, not HTTP REST.

---
```

**Option 2: Convert ADRs to Decisions**
```bash
# Script to convert ADRs
for adr in docs/adr/*.md; do
  echo "<!-- DECISION-ADR-$(basename $adr .md) -->" >> decisions.md
  echo "## Decision: $(grep '^# ' $adr | sed 's/# //')" >> decisions.md
  # ... extract other fields
done
```

### Troubleshooting Advanced Scenarios

#### Scenario: Decision Comment Not Appearing

**Debug checklist**:

1. Verify decision status:
   ```markdown
   **Status**: Active  # Must be Active, not Deprecated
   ```

2. Test pattern matching:
   ```bash
   # Check if your file matches the pattern
   # Use https://globster.xyz/ to test glob patterns
   ```

3. Check file normalization:
   ```bash
   # Windows paths use backslashes, Decision Guardian normalizes to forward slashes
   # src\config\db.ts → src/config/db.ts
   ```

4. Verify PR contains actual changes:
   ```bash
   # Decision Guardian only checks modified/added files
   # Renamed-only or deleted-only won't trigger
   ```

5. Check GitHub Actions logs:
   ```
   Loaded 15 decisions (with advanced rules)
   PR modifies 3 files
   Found 0 matches  # ← Issue is here
   ```

#### Scenario: Too Many False Positives

**Solutions**:

1. **Narrow file patterns**:
   ```markdown
   # Too broad
   **/*.ts
   
   # Better
   src/api/v1/**/*.ts
   ```

2. **Add exclusions**:
   ```json
   {
     "type": "file",
     "pattern": "src/**/*.ts",
     "exclude": "**/*.{test,spec}.ts"
   }
   ```

3. **Use content rules**:
   ```json
   {
     "type": "file",
     "pattern": "src/**/*.ts",
     "content_rules": [
       {
         "mode": "string",
         "patterns": ["database", "connection"]
       }
     ]
   }
   ```

4. **Lower severity**:
   ```markdown
   # Change from Critical to Info
   **Severity**: Info
   ```

#### Scenario: Performance Issues with Large PRs

**Symptoms**: Action takes > 60 seconds, times out, or fails

**Solutions**:

1. **Simplify patterns**:
   ```markdown
   # Avoid very broad patterns
   **/**/***  # ❌ Too broad
   
   # Use specific paths
   src/specific-dir/**/*.ts  # ✅ Better
   ```

2. **Reduce regex complexity**:
   ```json
   {
     "mode": "regex",
     "pattern": "simple.*pattern"  # ✅ Fast
     // Avoid: "((complex|nested)+|(patterns)*)*"  ❌ Slow
   }
   ```

3. **Batch decisions**:
   ```markdown
   # Instead of 50 small decisions
   # Create 5 larger decisions with multiple patterns
   ```

4. **Use file patterns over content rules**:
   ```markdown
   # Faster
   **Files**: src/api/auth.ts
   
   # Slower (requires diff parsing)
   **Rules**: { content_rules: [...] }
   ```

#### Scenario: Regex Pattern Security Warnings

**Error**: `[Security] Unsafe regex pattern rejected`

**Cause**: Pattern could cause ReDoS (Regular Expression Denial of Service)

**Solution**: Simplify the regex:

```json
// ❌ Unsafe (catastrophic backtracking)
"pattern": "(a+)+"

// ✅ Safe
"pattern": "a+"

// ❌ Unsafe
"pattern": "(.*)*"

// ✅ Safe
"pattern": ".*"
```

Use tools like [regex101.com](https://regex101.com/) to test patterns.


#### Issues

##### Issue: Comment not updating, creating duplicates

**Cause**: Concurrent workflow runs creating/updating comments simultaneously (race condition).

**How Decision Guardian Handles This**:

Decision Guardian includes **automatic retry with conflict resolution**:

```typescript
const MAX_RETRIES = 3;

for (let retry = 0; retry < MAX_RETRIES; retry++) {
  try {
    await postComment();
    return; // Success
  } catch (error) {
    if (error.status === 409 && retry < MAX_RETRIES - 1) {
      // Conflict detected, wait and retry
      await sleep(1000 * (retry + 1)); // Exponential backoff
      continue;
    }
    throw error; // Other errors or max retries exceeded
  }
}
```

**What you'll see in logs**:

```
Warning: Conflict detected when posting comment, retrying... (1/3)
```

**Wait times**:
- Retry 1: 1 second
- Retry 2: 2 seconds
- Retry 3: 3 seconds

**Duplicate Cleanup**:

If duplicates exist (from past race conditions):
```typescript
if (existingComments.length > 1) {
  core.info('Found 3 duplicate comments, cleaning up...');
  // Keeps first comment, deletes the rest
}
```

**Solutions**:

1. **Usually auto-resolves**: Retry logic handles most conflicts
2. **Enable concurrency control** in workflow:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
     cancel-in-progress: true
   ```
3. **Manual cleanup**: If duplicates persist, manually delete extra comments

**When conflicts occur**:
- Multiple commits pushed rapidly to PR
- Workflow re-run while previous run still active
- Two workflows modifying same PR simultaneously

---

##### Issue: "Rate limit hit"

**Cause**: GitHub API rate limit exceeded during file fetching.

**How Decision Guardian Handles This**:

Decision Guardian includes built-in rate limit protection with a **Circuit Breaker** pattern:

1. **Automatic Retry**: Up to 3 attempts per API call
2. **Smart Wait Time**: 
   - Uses GitHub's `x-ratelimit-reset` header to calculate exact wait time
   - Falls back to `retry-after` header if available
   - Minimum wait: 1 second, default: 60 seconds
3. **Trip Conditions** (action fails if):
   - Wait time exceeds 6 minutes
   - Retry count exceeds 3
   - Error is not a rate limit error (fails immediately)

**What you'll see in logs**:

```
Warning: Rate limit hit for fetch files page 2. 
Waiting 73s before retry 1/3
```

**If the circuit trips**:
```
Error: Rate limit hit for fetch files page 5. 
Wait time (8m) exceeds limit.
```

**Solutions**:

1. **Wait and re-run**: Rate limits reset hourly
2. **Check rate limit status**:
   ```bash
   curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/rate_limit
   ```
3. **For chronic issues**: 
   - Use a PAT with higher rate limits
   - Split very large PRs into smaller ones
   - Stagger workflow runs across repositories

**Rate Limit Facts**:
- `GITHUB_TOKEN` in Actions: 1000 requests/hour per repository
- Personal Access Token: 5000 requests/hour
- Decision Guardian typically uses 1-5 API calls for normal PRs
- Only large PRs (1000+ files) are at risk



### FAQ

#### Q: Can Decision Guardian prevent merges?

**A**: Yes, when `fail_on_critical: true` is set, PRs touching Critical decisions will fail the status check. However, repository admins can override this.

#### Q: Does it work with monorepos?

**A**: Yes! Decision Guardian works great with monorepos. Use path-specific patterns:

```markdown
**Files**:
- `apps/backend/src/auth/**/*`
- `packages/shared/src/security/**/*`
```

#### Q: Can I use it with private repositories?

**A**: Yes, Decision Guardian works with both public and private repositories using the standard `GITHUB_TOKEN`.

#### Q: Does it support other CI/CD platforms?

**A**: Yes! The Decision Guardian CLI works with all CI systems including GitLab CI, Jenkins, CircleCI, Azure DevOps, and Bitbucket. Ideally, you can run it as a step in your pipeline to check for violations. The native PR commenting feature is currently specific to GitHub Actions, but the CLI can be used to fail builds on critical violations anywhere.

#### Q: How do I ignore Decision Guardian for specific PRs?

**A**: Add a workflow condition:

```yaml
- uses: DecispherHQ/decision-guardian@v1
  if: "!contains(github.event.pull_request.labels.*.name, 'skip-decisions')"
```

Then add the `skip-decisions` label to PRs that should bypass checking.

#### Q: Can I customize the comment format?

**A**: Not currently, but you can request features via GitHub Issues on the Decision Guardian repository.

#### Q: What's the difference between Decision Guardian and CODEOWNERS?

| Feature | CODEOWNERS | Decision Guardian |
|---------|-----------|-------------------|
| Purpose | Assign reviewers | Provide context |
| Enforcement | Required reviews | Optional (or fail check) |
| Content | Who reviews | Why it matters |
| Format | Simple list | Rich markdown |
| Conditions | File patterns only | Advanced rules |

**Best practice**: Use both together!

#### Q: How do I version control decisions?

**A**: Decisions are version-controlled in git alongside code. Use `git log` to see decision history:

```bash
git log --follow .decispher/decisions.md
```

For major decision changes, use git tags:

```bash
git tag -a decisions-v2.0 -m "Major decision overhaul"
```

#### Q: Can decisions reference external documents?

**A**: Yes! Link to any documentation:

```markdown
### Context

See full details: [Security Runbook](https://docs.example.com/security)

Quick reference:
- [Authentication Guide](https://wiki.example.com/auth)
- [Slack Channel](https://example.slack.com/archives/C123456)
```

---

## Additional Resources

### Example Repositories

- [Decision Guardian Examples](https://github.com/DecispherHQ/decision-guardian/tree/main/samples) - Sample decisions for common scenarios

### Community

- **GitHub Discussions**: Ask questions, share patterns
- **Discord**: Real-time chat with other users
- **Stack Overflow**: Tag questions with `decision-guardian`

### Related Tools

- **ADR Tools**: Architecture Decision Records
- **Danger**: Automated PR review
- **Reviewdog**: Automated code review comments
- **CODEOWNERS**: Automatic PR reviewer assignment

### Further Reading

- [Architecture Decision Records (ADRs)](https://adr.github.io/)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/best-practices-for-github-actions)
- [Glob Pattern Reference](https://en.wikipedia.org/wiki/Glob_(programming))

---

## Support

### Getting Help

1. **Documentation**: Start here (you're reading it!)
2. **GitHub Issues**: Bug reports and feature requests
3. **Discussions**: Questions and community support
4. **Email**: decispher@gmail.com for support

### Contributing

Decision Guardian is open source! Contributions welcome:

- Submit bug fixes
- Propose new features
- Improve documentation
- Share example decisions

See [Contributing.md](https://github.com/DecispherHQ/decision-guardian/blob/main/Contributing.md)

### License

Decision Guardian is MIT licensed. Free for commercial and personal use.

---

**Decision Guardian** - Surface architectural context automatically.

Built with ❤️ by the Decispher Team

> **📋 Changelog**: For the full version history, see [CHANGELOG.md](https://github.com/DecispherHQ/decision-guardian/blob/main/CHANGELOG.md).
