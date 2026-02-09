# Decision Guardian

> **Prevent institutional amnesia by surfacing past architectural decisions directly on Pull Requests.**

[![GitHub Action](https://img.shields.io/badge/GitHub-Action-blue?logo=github-actions)](https://github.com/marketplace/actions/decision-guardian)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Maintained by Decispher](https://img.shields.io/badge/Maintained%20by-Decispher-orange)](https://decispher.com)
[![Website](https://img.shields.io/badge/Website-decision--guardian.decispher.com-blueviolet)](https://decision-guardian.decispher.com/)

Decision Guardian is a GitHub Action that automatically surfaces architectural decisions and critical context when Pull Requests modify protected files. Instead of relying on tribal knowledge, Decision Guardian proactively alerts teams when changes touch sensitive code.

**Created by [Ali Abbas](https://github.com/gr8-alizaidi) • Part of the [Decispher](https://decispher.com) project**

---

## 🎯 The Problem

Engineering teams lose critical context when:
- Senior engineers leave
- Architectural decisions aren't documented
- New developers modify sensitive code without understanding why

**Real scenario:**
```
March 2023: Team chooses Postgres over MongoDB for ACID compliance
September 2023: Senior engineer who made decision leaves
March 2024: New developer opens PR to switch to MongoDB
Result: Team wastes 3 months re-evaluating the same decision
```

**Decision Guardian prevents this by making past decisions visible when they matter most.**

---

## 🚀 Quick Start

### 1. Create Decision File

Create `.decispher/decisions.md`:

```markdown
<!-- DECISION-DB-001 -->
## Decision: Database Choice for Billing

**Status**: Active  
**Date**: 2024-03-15  
**Severity**: Critical

**Files**:
- `src/db/pool.ts`
- `config/database.{yml,yaml}`

### Context

We chose Postgres over MongoDB because billing requires ACID compliance.
MongoDB doesn't guarantee consistency for financial transactions.

**Alternatives rejected:**
- MongoDB: No ACID guarantees
- Redis: Added unnecessary complexity

**Related:**
- [Slack thread](link)
- [Architecture review](link)

---
```

### 2. Add Workflow

Create `.github/workflows/decision-guardian.yml`:

```yaml
name: Decision Guardian

on:
  pull_request:

permissions:
  pull-requests: write
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: DecispherHQ/decision-guardian@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          decision_file: '.decispher/decisions.md'
          fail_on_critical: true
```

### 3. See It Work

When someone opens a PR modifying `src/db/pool.ts`, Decision Guardian automatically comments with the context from `DECISION-DB-001`.

---

## ✨ Features

### Core Capabilities

✅ **Automatic Context Surfacing**
- Posts PR comments when protected files change
- Groups by severity (Critical, Warning, Info)
- Shows decision rationale and links

✅ **Flexible Matching**
- File patterns with glob support (`src/**/*.ts`, `!**/*.test.ts`)
- Advanced rules (regex, content matching, boolean logic)
- Directory scanning (multiple decision files)

✅ **Production-Ready**
- Handles PRs with 3,000+ files
- Idempotent comments (no spam)
- Rate limit handling with retry
- ReDoS protection for regex

✅ **Smart Behavior**
- Updates existing comments instead of creating duplicates
- Only active decisions trigger alerts
- Self-healing duplicate cleanup
- Progressive truncation for large PRs

---

## Configuration

### Inputs

```yaml
- uses: DecispherHQ/decision-guardian@v1
  with:
    decision_file: '.decispher/decisions.md'  # or directory
    fail_on_critical: false                    # block PRs?
    fail_on_error: false                       # strict mode
    token: ${{ secrets.GITHUB_TOKEN }}
```

| Input | Default | Description |
|-------|---------|-------------|
| `decision_file` | `.decispher/decisions.md` | Path to file or directory |
| `fail_on_critical` | `false` | Fail PR check on critical violations |
| `fail_on_error` | `false` | Fail on parse errors |
| `token` | `${{ github.token }}` | GitHub token (required) |

### Outputs

```yaml
- uses: DecispherHQ/decision-guardian@v1
  id: check

- run: echo "Matches: ${{ steps.check.outputs.matches_found }}"
```

| Output | Description |
|--------|-------------|
| `matches_found` | Number of decisions matched |
| `critical_count` | Critical severity violations |
| `metrics` | Performance data (JSON) |

---

## Decision File Format

### Basic Structure

```markdown
<!-- DECISION-ID -->
## Decision: Title

**Status**: Active  
**Date**: YYYY-MM-DD  
**Severity**: Critical|Warning|Info

**Files**:
- `pattern`

### Context

Explanation of the decision.

---
```

### Field Reference

**Decision ID**: `DECISION-[CATEGORY-]NUMBER`
- Examples: `DECISION-001`, `DECISION-DB-001`, `DECISION-API-AUTH-001`
- Must be uppercase, can include hyphens

**Status** (only `Active` triggers alerts):
- `Active` - Currently enforced
- `Deprecated` - Being phased out
- `Superseded` - Replaced by newer decision
- `Archived` - Historical reference only

**Severity**:
- `Critical` - Blocks PR if `fail_on_critical: true`
- `Warning` - Important but non-blocking
- `Info` - FYI only

**Files** (glob patterns):
- `src/db/pool.ts` - Exact file
- `src/**/*.ts` - All .ts files (recursive)
- `config/*.yml` - .yml in config/ only
- `!**/*.test.ts` - Exclude tests

**Context**: Explain why the decision was made, alternatives rejected, and links to related docs.

---

## Advanced Rules

For complex scenarios, use JSON-based rules:

```markdown
**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.ts",
  "exclude": "**/*.test.ts",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "password\\s*=\\s*['\"]",
      "flags": "i"
    }
  ]
}
```
```

### Rule Types

**File Rules**:
```json
{
  "type": "file",
  "pattern": "src/api/**/*.ts",
  "exclude": "**/*.test.ts",
  "content_rules": [...]
}
```

**Content Modes**:
- `string` - Match literal strings
- `regex` - Pattern matching (5s timeout, ReDoS-protected)
- `line_range` - Specific line numbers
- `full_file` - Any change
- `json_path` - Target JSON keys

**Boolean Logic**:
```json
{
  "match_mode": "any",  // OR
  "conditions": [...]
}
```

```json
{
  "match_mode": "all",  // AND
  "conditions": [...]
}
```

**Nesting**: Up to 10 levels deep

---

## Examples

### Example 1: Database Configuration

```markdown
<!-- DECISION-DB-001 -->
## Decision: Connection Pool Size

**Status**: Active  
**Date**: 2024-01-15  
**Severity**: Critical

**Files**:
- `src/db/pool.ts`
- `config/database.yml`

### Context

Pool size fixed at 20 connections to prevent exhaustion.

Tested with production load (5K req/s). Higher values caused
connection leaks under sustained traffic.

**Do not modify without load testing.**

---
```

### Example 2: Security Pattern

```markdown
<!-- DECISION-SEC-001 -->
## Decision: No Hardcoded Credentials

**Status**: Active  
**Date**: 2024-02-01  
**Severity**: Critical

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.{ts,js}",
  "exclude": "**/*.test.{ts,js}",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "(password|api[_-]?key|secret)\\s*[=:]\\s*['\"][^'\"]+['\"]",
      "flags": "i"
    }
  ]
}
```

### Context

Detects hardcoded credentials. Use environment variables
or AWS Secrets Manager instead.

---
```

### Example 3: API Changes

```markdown
<!-- DECISION-API-001 -->
## Decision: Public API v1 Protection

**Status**: Active  
**Date**: 2024-03-01  
**Severity**: Warning

**Files**:
- `src/api/v1/**/*.ts`
- `openapi.yaml`

### Context

v1 API changes affect external clients.

**Before merging:**
- Update API docs
- Notify integration partners
- Version bump if breaking

---
```

---

## 🏗️ Architecture

### Core Components

```
┌────────────────────────────────────────────────────┐
│                  DECISION GUARDIAN                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │         DECISION PARSER (AST-based)          │  │
│  │  - Markdown parsing with remark              │  │
│  │  - JSON rule extraction & validation         │  │
│  │  - Multi-file directory support              │  │ 
│  └──────────────────────────────────────────────┘  │
│                      ↓                             │
│  ┌──────────────────────────────────────────────┐  │
│  │      DECISION INDEX (Prefix Trie)            │  │
│  │  - O(log n) file lookup                      │  │
│  │  - Wildcard pattern optimization             │  │
│  └──────────────────────────────────────────────┘  │
│                      ↓                             │
│  ┌──────────────────────────────────────────────┐  │
│  │         FILE MATCHER (Rule Evaluator)        │  │
│  │  - Glob pattern matching (minimatch)         │  │
│  │  - Advanced rule evaluation                  │  │
│  │  - Content diff analysis                     │  │
│  │  - Parallel processing                       │  │
│  └──────────────────────────────────────────────┘  │
│                      ↓                             │
│  ┌──────────────────────────────────────────────┐  │
│  │      COMMENT MANAGER (Idempotent)            │  │
│  │  - Hash-based update detection               │  │
│  │  - Self-healing duplicate cleanup            │  │
│  │  - Progressive truncation (5 layers)         │  │
│  │  - Retry with exponential backoff            │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```


**High-level flow:**

```
PR Created → Parse Decisions → Match Files → Post Comment → Check Status
```

**Key components:**
- **Parser** (`parser.ts`): Markdown → structured data
- **Matcher** (`matcher.ts`): Trie-based file matching
- **Rule Evaluator** (`rule-evaluator.ts`): Advanced rules
- **Comment Manager** (`comment.ts`): Idempotent PR comments


### Key Optimizations

- **Prefix Trie**: Avoids O(N×M) file-decision comparisons
- **Streaming Mode**: Processes PRs with 3000+ files without OOM
- **Smart Caching**: Regex results cached to prevent ReDoS
- **Batch Processing**: Parallel evaluation with concurrency limits
- **Progressive Truncation**: 5-layer fallback ensures comments always fit

### Security

- ✅ Path traversal protection
- ✅ ReDoS prevention (VM sandbox with timeout)
- ✅ Input validation (Zod schemas)
- ✅ Safe regex checking (safe-regex)
- ✅ Content size limits
- ✅ Depth limits on nested rules

---

## 📊 Performance

**Benchmark Results** (MacBook Pro M1, 16GB RAM):

| Scenario | Files | Decisions | Time | Memory |
|----------|-------|-----------|------|--------|
| Small PR | 10 | 50 | 1.2s | 45MB |
| Medium PR | 100 | 200 | 2.8s | 78MB |
| Large PR | 500 | 500 | 8.4s | 142MB |
| Huge PR | 3000 | 1000 | 34s | 289MB |

**API Calls**: ~2-4 per run (list files, create/update comment)


---

## Best Practices

### Writing Decisions

**Be specific:**
```markdown
❌ This is important. Be careful.

✅ Rate limiting config. Changes can:
   - Block legitimate users (too strict)
   - Allow abuse (too loose)
   - Cause OOM (incorrect values)
   
   Before merging: Load test with 2x traffic
```

**Include context:**
```markdown
### Context

**Why**: Billing requires ACID compliance
**Impact**: Data loss risk if violated
**Tested**: Load tested at 10K req/s
**Links**: [Slack](url), [Jira](url)
```

**Use appropriate severity:**
- `Critical`: Production impact, security, data loss
- `Warning`: Best practices, performance
- `Info`: Documentation, patterns

### Team Workflow

**Small teams (<10):**
- Single file: `.decispher/decisions.md`
- Start with `Info/Warning` severity
- Gradually add `Critical` as patterns emerge

**Medium teams (10-50):**
- Directory structure:
  ```
  .decispher/
  ├── backend/
  ├── frontend/
  └── infrastructure/
  ```
- Use `fail_on_critical: true`
- Quarterly decision reviews

**Large teams (50+):**
- Federated ownership
- CODEOWNERS on `.decispher/`
- Decision review board
- Metrics tracking

---

## Troubleshooting

### Common Issues

**"Not a pull request event"**
```yaml
on:
  pull_request:  # ✅ Correct
  # Not: push, schedule
```

**"Failed to read file: ENOENT"**
- Verify file exists: `ls .decispher/decisions.md`
- Check path in workflow matches actual location
- Ensure file is committed

**"Path traversal detected"**
```yaml
decision_file: '.decispher/decisions.md'  # ✅
decision_file: '../decisions.md'          # ❌
```

**No comment posted**
- Check permissions: `pull-requests: write`
- Verify status is `Active` (not `Archived`)
- Check files match patterns

### Debug Mode

```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

---


## 🛠️ Development

### Setup

```bash
git clone https://github.com/DecispherHQ/decision-guardian.git
cd decision-guardian
npm install
```

### Build

```bash
npm run build      # Compile TypeScript
npm run package    # Bundle for distribution
npm test           # Run tests
npm run lint       # Check code quality
```


---

## 🤝 Contributing

We welcome contributions! Decision Guardian is open source (MIT) and maintained by [Decispher](https://decispher.com).

### Ways to Contribute

1. **Report Bugs**: [Open an issue](https://github.com/DecispherHQ/decision-guardian/issues)
2. **Suggest Features**: [Start a discussion](https://github.com/DecispherHQ/decision-guardian/discussions)
3. **Submit PRs**: See [Contributing.md](Contributing.md)
4. **Improve Docs**: Fix typos, add examples
5. **Share**: Star ⭐ the repo, write blog posts

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Make your changes
4. Add tests (if applicable)
5. Run `npm test` and `npm run lint`
6. Commit with conventional commits (`feat:`, `fix:`, `docs:`)
7. Push and open a Pull Request

---

## 📝 FAQ

**Q: Can it prevent merges?**  
A: Yes, when `fail_on_critical: true`.

**Q: Works with monorepos?**  
A: Yes. Use path-specific patterns.

**Q: Works with private repos?**  
A: Yes. Uses `GITHUB_TOKEN`.

**Q: Difference vs CODEOWNERS?**  
A: CODEOWNERS assigns reviewers. Decision Guardian explains why review matters.

**Q: How do I skip for specific PRs?**  
A: Use label condition:
```yaml
if: "!contains(github.event.pull_request.labels.*.name, 'skip-decisions')"
```

---

## 💬 Support

- **Website**: [decision-guardian.decispher.com](https://decision-guardian.decispher.com/)
- **Community**: [GitHub Discussions](https://github.com/DecispherHQ/decision-guardian/discussions)
- **Issues**: [Bug Reports](https://github.com/DecispherHQ/decision-guardian/issues)
- **Enterprise**: [Decispher Support](https://decision-guardian.decispher.com/support)
- **Email**: [decispher@gmail.com](mailto:decispher@gmail.com)

---


## 📄 License

**MIT License** - See [LICENSE](LICENSE) file for details.

Decision Guardian is free and open source.

---

## About

**Decision Guardian** is created and maintained by **Ali Abbas** as part of the **Decispher** project.

Decispher helps engineering teams preserve and leverage institutional knowledge.

**Connect:**
- GitHub: [@gr8-alizaidi](https://github.com/gr8-alizaidi)
- Twitter: [@gr8_alizaidi](https://twitter.com/gr8_alizaidi)

---

## 🙏 Acknowledgments

Built with:
- [minimatch](https://github.com/isaacs/minimatch) - Glob matching
- [parse-diff](https://github.com/sergeyt/parse-diff) - Unified diff parsing
- [zod](https://github.com/colinhacks/zod) - Runtime validation
- [safe-regex](https://github.com/substack/safe-regex) - ReDoS prevention
- [@actions/github](https://github.com/actions/toolkit) - GitHub API client

Inspired by:
- [Architecture Decision Records (ADR)](https://adr.github.io/)
- [CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)


---

## 🌟 Show Your Support

If Decision Guardian helps your team, please:
- ⭐ Star this repository
- 🐦 Tweet about it ([@decispher](https://twitter.com/decispher))
- 📝 Write a blog post
- 💼 Recommend it to colleagues

**Made with ❤️ by [Decispher](https://decispher.com)**

*Preventing institutional amnesia, one PR at a time.*