# Decision Guardian - Features & Roadmap

## Current Features (v1.0)

### Core Features

#### 🔍 Smart Pattern Matching
- **Glob Patterns**: Match files using wildcards (`*.ts`, `**/*.js`, `src/api/**/*.ts`)
- **Exclusion Patterns**: Exclude specific files (`!**/*.test.ts`)
- **Brace Expansion**: Match multiple extensions (`*.{ts,js,tsx}`)
- **Pattern Trie**: O(1) candidate lookup for performance

#### 📝 Decision File Parsing
- **Markdown Format**: Human-readable decision documentation
- **Single File Mode**: All decisions in one `.decispher/decisions.md`
- **Directory Mode**: Auto-discover all `.md` files in `.decispher/`
- **Nested Directories**: Support for team-based organization
- **External Rule Files**: Reference JSON rules from separate files

#### 🚨 Severity Levels
| Level | Badge | Behavior |
|-------|-------|----------|
| Critical | 🔴 | Can block PR merge |
| Warning | 🟡 | Highlighted but non-blocking |
| Info | ℹ️ | Informational only |

#### ✅ Status Management
| Status | Active? | Description |
|--------|---------|-------------|
| `active` | ✅ | Enforced on all PRs |
| `deprecated` | ❌ | Visible but not enforced |
| `superseded` | ❌ | Replaced by another decision |
| `archived` | ❌ | Historical record only |

---

### Advanced Rules System

#### Content Matching Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `string` | Match exact strings in diff | Detect forbidden keywords |
| `regex` | Match regular expressions | Complex pattern detection |
| `line_range` | Match changes in line range | Protect file headers |
| `full_file` | Match any change | Critical config files |
| `json_path` | Match JSON key changes | Config value protection |

#### Boolean Logic
- **OR Logic** (`match_mode: "any"`): Trigger if any condition matches
- **AND Logic** (`match_mode: "all"`): Trigger only if all conditions match
- **Nested Conditions**: Combine AND/OR up to 10 levels deep

#### File Rules
- File pattern with glob syntax
- Exclude patterns for exceptions
- Content rules for diff analysis

---

### GitHub Integration

#### PR Comments
- Auto-post decision context on matching PRs
- Idempotent updates (no duplicate comments)
- Grouped by severity (Critical > Warning > Info)
- Decision count summary

#### Check Status
- Pass/fail based on matched decisions
- `fail_on_critical` option
- `fail_on_error` for parse issues
- Detailed error reporting

#### Large PR Handling
- Pagination for 100+ files
- Streaming mode for 1000+ files
- Memory-efficient processing
- 3000+ file support

---

### Performance Features

| Feature | Description |
|---------|-------------|
| **Pattern Trie** | O(1) file candidate lookup |
| **Regex Caching** | Compiled patterns reused |
| **Parallel Processing** | Multi-rule evaluation |
| **Streaming Mode** | Batch processing for large PRs |
| **Early Exit** | Stop on first match when possible |

---

### Security Features

| Feature | Description |
|---------|-------------|
| **Path Traversal Protection** | Blocks `..` in paths |
| **ReDoS Prevention** | Safe-regex validation + timeout |
| **Input Validation** | Zod schema enforcement |
| **Sandboxed Regex** | 5-second timeout |
| **No Credential Logging** | Sensitive data protected |

---

### Developer Experience

- Comprehensive error messages
- Line-number error reporting
- Parse warnings for common issues
- Structured logging
- Performance metrics output

---

## Upcoming Features

### Version 1.1 (Planned)

#### 🆕 Decision Templates
```markdown
**Template**: security-review
```
Pre-built decision templates for common patterns:
- Security review required
- Performance-critical code
- API breaking changes
- Database migrations

#### 🔄 Decision Inheritance
```markdown
**Extends**: DECISION-BASE-001
```
Inherit file patterns and rules from parent decisions.

#### 📊 Analytics Dashboard
- Decision match history
- Most triggered decisions
- File hotspots
- Team insights

---

### Version 1.2 (Planned)

#### 🔗 Cross-Repository Rules
Share decision rules across multiple repositories via:
- GitHub Action input references
- NPM package rules
- URL-based rule imports

#### 🏷️ Decision Labels
```
**Labels**: security, database, breaking-change
```
Categorize decisions for filtering and organization.

#### 💬 Custom Comment Templates
Configure PR comment format:
- Markdown templates
- Variable substitution
- Conditional sections

---

### Version 2.0 (Future)


#### 📱 VS Code Extension
- In-editor decision viewing
- Decision authoring assistance
- Pattern testing

#### 🌐 Web Dashboard
- Decision management UI
- Repository insights
- Team collaboration
- Rule builder

---

## Feature Comparison

### vs CODEOWNERS

| Feature | CODEOWNERS | Decision Guardian |
|---------|------------|-------------------|
| File matching | ✅ Glob patterns | ✅ Glob + Content rules |
| Assign reviewers | ✅ | ❌ |
| Context/reasoning | ❌ | ✅ Rich markdown |
| Severity levels | ❌ | ✅ Critical/Warning/Info |
| Content matching | ❌ | ✅ Regex, string, etc. |
| Block PRs | ❌ | ✅ Optional |

### vs ADR (Architecture Decision Records)

| Feature | Traditional ADR | Decision Guardian |
|---------|-----------------|-------------------|
| Documentation | ✅ | ✅ |
| Automatic surfacing | ❌ | ✅ |
| File association | ❌ | ✅ |
| PR integration | ❌ | ✅ |
| Enforcement | ❌ | ✅ |

### vs Danger.js

| Feature | Danger.js | Decision Guardian |
|---------|-----------|-------------------|
| Custom rules | ✅ Full code | ✅ Declarative |
| Setup complexity | High | Low |
| Learning curve | Steep | Minimal |
| Maintenance | Code changes | Markdown updates |
| Type safety | ✅ | ✅ |

---

## Release History

### Version 1.0.0 (Current)
- Initial release
- Core pattern matching
- Advanced rules system
- GitHub Action integration
- Performance optimizations
- Security features

---

## Feature Requests

Have a feature idea? We'd love to hear it!

- **GitHub Issues**: [Request a feature](https://github.com/decispher/decision-guardian/issues/new?labels=enhancement)
- **Discussions**: [Share ideas](https://github.com/decispher/decision-guardian/discussions)

### Requested Features (Community)

| Feature | Votes | Status |
|---------|-------|--------|
| VS Code extension | 🔼 0 | Under review |
| Custom comment format | 🔼 0 | Under review |
| Decision templates | 🔼 0 | Under review |
| GitLab support | 🔼 0 | Under review |
| Bitbucket support | 🔼 0 | Under review |

---

## Contributing to Features

### How to Contribute

1. **Discuss First**: Open an issue or discussion
2. **Design Review**: For major features, create an RFC
3. **Implementation**: Submit PR with tests
4. **Documentation**: Update relevant docs

### Priority Guidelines

| Priority | Criteria |
|----------|----------|
| P0 (Critical) | Security issues, data loss bugs |
| P1 (High) | Core feature broken, many users affected |
| P2 (Medium) | Feature gaps, quality improvements |
| P3 (Low) | Nice-to-have, minor enhancements |

---

## Deprecation Policy

- Features deprecated with 2 minor versions notice
- Deprecated features work but show warnings
- Removed in next major version
- Migration guides provided
