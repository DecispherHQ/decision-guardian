# Production-Grade Decision Examples

This directory contains 10 real-world examples of architectural decisions that teams should document and protect using Decision Guardian.

**Author**: Ali Abbas  
**Organization**: Decispher  
**Purpose**: Demonstrate best practices for decision documentation

---

## 📚 Complete Example Set

### Critical Severity (Production Impact)

1. **[Database Choice](./example-001-database-choice.md)** - PostgreSQL vs MongoDB for authentication
   - **Demonstrates**: Advanced rules (AND/OR logic, regex content matching)
   - **Key Learning**: ACID requirements, team expertise, performance benchmarks
   - **Real Cost**: $0 (prevented $2M+ mistake)

2. **[Rate Limiting](./example-002-rate-limiting.md)** - API rate limit configuration
   - **Demonstrates**: Regex pattern matching for constants
   - **Key Learning**: Incident-driven decisions, customer communication
   - **Real Cost**: $12K incident → $0 after implementation

3. **[Timeout Configuration](./example-003-timeout-config.md)** - Payment processing timeouts
   - **Demonstrates**: Line range protection (critical config lines)
   - **Key Learning**: Race conditions, Redis TTL alignment
   - **Real Cost**: $68K double-charge incident prevented

4. **[No Hardcoded Secrets](./example-004-no-hardcoded-secrets.md)** - Security credential management
   - **Demonstrates**: Regex security scanning, file exclusions
   - **Key Learning**: Multi-layer security enforcement
   - **Real Cost**: $340K breach → $0 after enforcement

5. **[Dependency Pinning](./example-005-dependency-pinning.md)** - Exact version requirements
   - **Demonstrates**: Simple string pattern matching
   - **Key Learning**: Production stability vs. flexibility trade-offs
   - **Real Cost**: $47K outage → $0 with pinning

### Warning Severity (Quality Standards)

6. **[TypeScript Strict Mode](./example-006-typescript-strict.md)** - Type safety enforcement
   - **Demonstrates**: Config file protection
   - **Key Learning**: Gradual migration strategy, developer education
   - **Real Cost**: $4.8K payment bug → 47% reduction in type errors

---

## 🎯 Example Highlights by Feature

### Advanced Rules Examples

**Example 1** (Database Choice):
```json
{
  "match_mode": "all",
  "conditions": [
    {
      "type": "file",
      "pattern": "src/auth/**/*.{ts,js}",
      "exclude": "**/*.test.{ts,js}",
      "content_rules": [
        {
          "mode": "regex",
          "pattern": "(mongoose|mongodb|MongoClient)",
          "flags": "i"
        }
      ]
    }
  ]
}
```

**What it does:**
- Scans ALL authentication code
- EXCLUDES test files (won't flag test mocks)
- Detects MongoDB usage via regex
- Alerts team to evaluate against decision

### Content Matching Examples

**Regex Mode** (Example 4 - Security):
```json
{
  "mode": "regex",
  "pattern": "(password|api[_-]?key|secret|token)\\s*[=:]\\s*['\"][^'\"]{8,}['\"]",
  "flags": "i"
}
```

**String Mode** (Example 5 - Dependencies):
```json
{
  "mode": "string",
  "patterns": ["\"strict\": false", "\"strict\":false"]
}
```

**Line Range Mode** (Example 3 - Timeouts):
```json
{
  "mode": "line_range",
  "start": 1,
  "end": 25
}
```

### File Pattern Examples

**Multiple Patterns** (Example 1):
```markdown
**Files**:
- `src/auth/database.ts`
- `src/auth/session-store.ts`
- `config/database.yml`
- `migrations/auth/**/*.sql`
```

**Exclusions** (Example 4):
```markdown
**Files**:
- `src/**/*.{ts,js,py,go,java}`
- `config/**/*.{json,yml,yaml,toml}`
- `!**/*.test.{ts,js}`
- `!**/fixtures/**`
```

---

## 💡 Writing Effective Decisions

### Anatomy of a Great Decision

Every example follows this structure:

```markdown
<!-- DECISION-ID -->
## Decision: Descriptive Title

**Status**: Active
**Date**: YYYY-MM-DD
**Severity**: Critical|Warning|Info

**Files**: [Protected file patterns]
**Rules**: [Optional advanced rules]

### Context

#### The Problem
What pain point led to this decision?

#### The Solution
What did you decide and why?

#### Alternatives Considered
What else did you evaluate?
- Why rejected
- When it would be good

#### Implementation Details
How is this enforced technically?

#### Success Metrics
What improved after this decision?

#### When to Revisit
Under what conditions should this be re-evaluated?

#### References
- Links to incidents, Slack discussions, docs
```

### Quality Checklist

Use this for your own decisions:

- [ ] **Clear problem statement** - What broke? What cost?
- [ ] **Specific decision** - No ambiguity about what's decided
- [ ] **Rationale explained** - Not just what, but WHY
- [ ] **Alternatives documented** - What you rejected and why
- [ ] **Implementation details** - Code examples, configs
- [ ] **Success metrics** - How you measure impact
- [ ] **Review schedule** - When to re-evaluate
- [ ] **References** - Links to incidents, data, discussions
- [ ] **Owner identified** - Who maintains this decision
- [ ] **Files/patterns correct** - Decision Guardian will catch violations

---

## 🎓 Learning from These Examples

### Common Patterns

**1. Incident-Driven Decisions**

All examples stem from real incidents:
- Example 1: MongoDB evaluated but ACID compliance required
- Example 2: API abuse caused $12K outage
- Example 3: Double-charge bug cost $68K
- Example 4: Hardcoded credentials led to $340K breach
- Example 5: Auto-update caused $47K outage
- Example 6: Type bug caused $4.8K payment error

**Lesson**: Document decisions AFTER the pain, prevent recurrence

**2. Cost Quantification**

Every decision shows ROI:
- Total costs prevented: $476K+
- Total implementation cost: ~$50K (tooling + time)
- **ROI**: 9.5x in first year

**Lesson**: Quantify impact to justify enforcement effort

**3. Review Schedules**

Every decision has a review date:
- Critical: Quarterly review
- Warning: Annual review
- Triggers: Specific conditions for early review

**Lesson**: Decisions age; schedule re-evaluation

**4. Escape Hatches**

Every decision allows overrides:
- Manual approval process (with justification)
- Emergency bypass (with follow-up)
- Documented exceptions

**Lesson**: Rigid rules break; allow flexibility with guardrails

---

## 🛠️ Using These Examples

### For Your Team

**1. Copy and Customize:**
```bash
# Copy an example
cp examples/example-001-database-choice.md .decispher/decisions/database.md

# Customize for your context
# Change: dates, costs, references, team names
# Keep: structure, thoroughness, detail level
```

**2. Extract Patterns:**

Use these examples as templates:
- Copy the structure
- Replace the specifics
- Maintain the rigor

**3. Learn from Mistakes:**

Each example shows:
- What went wrong
- How much it cost
- How the decision prevents recurrence

**Apply to your incidents:**
- Document what happened
- Explain the decision
- Prevent the next team from repeating it

### For Decision Guardian Testing

**Test Your Setup:**

```bash
# 1. Add an example to your repo
cp examples/example-004-no-hardcoded-secrets.md .decispher/decisions.md

# 2. Create a test PR with a violation
echo 'const apiKey = "sk_live_abc123456789";' > test.ts
git checkout -b test-violation
git add test.ts
git commit -m "Test: trigger security decision"
git push origin test-violation

# 3. Open PR - Decision Guardian should comment with DECISION-SEC-001

# 4. Clean up
git checkout main
git branch -D test-violation
```

---

## 📖 Real-World Scenarios

### Scenario 1: Prevent Database Switch

**Situation**: Junior dev opens PR to "modernize" by switching to MongoDB

**Without Decision Guardian**:
1. PR gets merged (reviewer misses context)
2. Team spends 3 months evaluating MongoDB again
3. Discover same ACID compliance issues
4. Revert to PostgreSQL
5. **Waste**: 3 engineer-months

**With Decision Guardian**:
1. PR opened
2. Bot comments: "DECISION-DB-001: We evaluated MongoDB in 2024 and chose PostgreSQL for ACID compliance"
3. Developer reads context, closes PR
4. **Time saved**: 3 engineer-months

### Scenario 2: Prevent Security Breach

**Situation**: Developer commits AWS credentials for "quick testing"

**Without Decision Guardian**:
1. Credentials committed to public repo
2. Security researcher finds them (or attacker)
3. Unauthorized AWS usage: $50K bill
4. Incident response: 1 week
5. **Cost**: $50K+ + reputation damage

**With Decision Guardian**:
1. Pre-commit hook catches credential pattern
2. Commit blocked immediately
3. Developer moves to environment variable
4. **Cost**: 0

### Scenario 3: Prevent Production Outage

**Situation**: Pod restarts pull new dependency version with breaking change

**Without Decision Guardian**:
1. Kubernetes pod restart
2. npm install pulls express@4.19.0 (was 4.18.2)
3. Breaking change crashes app
4. 75-minute outage
5. **Cost**: $47K revenue loss

**With Decision Guardian**:
1. Developer tries to add `^` to package.json
2. PR check fails: "DECISION-DEP-001: Use exact versions"
3. Developer uses exact version
4. **Cost**: 0

---

## 🎯 Next Steps

### For Individual Developers

1. **Read all 10 examples** (30 minutes)
2. **Identify patterns** in your own codebase
3. **Document 1-2 decisions** from recent incidents
4. **Set up Decision Guardian** in a test repo
5. **Share with your team**

### For Engineering Teams

1. **Team review** of examples (1-hour meeting)
2. **Brainstorm decisions** to document (recent incidents, ongoing debates)
3. **Assign owners** for each decision area
4. **Document 5 decisions** in first week
5. **Enable Decision Guardian** on main repo
6. **Review effectiveness** after 1 month

### For Engineering Leaders

1. **Calculate cost** of repeated mistakes
2. **Mandate decision documentation** for critical systems
3. **Include in onboarding** (new hires read decisions)
4. **Track metrics** (violations prevented, time saved)
5. **Celebrate** when Decision Guardian prevents incidents

---

## 📊 Impact Metrics from These Examples

### Quantified Value

| Decision | Cost Without | Cost With | Savings |
|----------|--------------|-----------|---------|
| Database Choice | $2M+ (wrong choice) | $0 | $2M+ |
| Rate Limiting | $12K/incident | $0 | $12K+ |
| Timeout Config | $68K (double charges) | $0 | $68K |
| No Secrets | $340K (breach) | $0 | $340K |
| Dep Pinning | $47K (outage) | $0 | $47K |
| TS Strict | $4.8K (type bugs) | $0 | $4.8K |
| **Total** | **$2.5M+** | **$0** | **$2.5M+** |

### Time Savings

| Scenario | Time Without | Time With | Saved |
|----------|--------------|-----------|-------|
| Re-evaluating MongoDB | 3 months | 0 | 3 eng-months |
| Debugging type bugs | 4 hrs/bug | 30 min | 87% reduction |
| Incident response | 75 min avg | 0 | 100% prevention |
| Onboarding (context) | 2 weeks | 2 days | 80% faster |

---

## ❓ FAQ

**Q: How long does it take to write a decision like these?**  
A: 30-60 minutes if you have the context. Examples took longer because they're teaching tools.

**Q: Do I need this much detail?**  
A: Start simple. Add detail as decisions are questioned. These examples show the "gold standard" for critical decisions.

**Q: What if my team disagrees with a decision?**  
A: Schedule a review. Update the decision with new context. Version control shows the evolution.

**Q: Can I copy these examples directly?**  
A: Copy the structure, not the specifics. Your MongoDB decision will differ from ours. But the pattern is universal.

**Q: What if a decision becomes outdated?**  
A: Update the status to "Deprecated" or "Superseded". Link to the new decision. Never delete (history matters).

---

## 🔗 Additional Resources

- **[Decision Guardian Website](https://decision-guardian.decispher.com/)** - Official website with live demo
- **[Decision Guardian GitHub](https://github.com/DecispherHQ/decision-guardian)** - Installation & setup
- **[DECISIONS_FORMAT.md](../docs/common/DECISIONS_FORMAT.md)** - Complete format reference
- **[CONTRIBUTING.md](../Contributing.md)** - How to contribute examples

---

**Made with ❤️ by [Ali Abbas](https://github.com/gr8-alizaidi) • Part of [Decispher](https://decispher.com)**

*Last Updated*: 2024-12-15
