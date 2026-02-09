# Contributing to Decision Guardian

Thank you for your interest in contributing to Decision Guardian! This project is part of the Decispher ecosystem, and we welcome contributions from the community.

**Project Author**: Ali Abbas ([@gr8-alizaidi](https://github.com/gr8-alizaidi))  
**Organization**: Decispher  
**License**: MIT

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Documentation](#documentation)
- [Community](#community)

---

## 📜 Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. By participating, you are expected to uphold this code.

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:
- Age, body size, disability, ethnicity
- Gender identity and expression
- Level of experience
- Nationality, personal appearance, race, religion
- Sexual identity and orientation

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what's best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Harassment, trolling, or inflammatory comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct inappropriate in a professional setting

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to [decispher@gmail.com](mailto:decispher@gmail.com). All complaints will be reviewed and investigated promptly and fairly.

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 20.x or higher
- **npm** 9.x or higher
- **Git** 2.x or higher
- A **GitHub account**
- Basic knowledge of TypeScript and GitHub Actions

### Fork and Clone

1. **Fork the repository** on GitHub by clicking the "Fork" button
2. **Clone your fork** locally:

```bash
git clone https://github.com/YOUR_USERNAME/decision-guardian.git
cd decision-guardian
```

3. **Add upstream remote**:

```bash
git remote add upstream https://github.com/DecispherHQ/decision-guardian.git
```

4. **Install dependencies**:

```bash
npm install
```

5. **Verify setup**:

```bash
npm test
npm run build
```

---

## 🤝 How to Contribute

### Contribution Scope

Decision Guardian is the **open-source GitHub Action** component of the Decispher ecosystem. Contributions should focus on:

**In Scope:**
- ✅ Bug fixes for the GitHub Action
- ✅ Performance improvements
- ✅ Documentation improvements
- ✅ Test coverage
- ✅ Markdown decision file parsing
- ✅ File pattern matching
- ✅ Advanced rule evaluation
- ✅ GitHub PR comment formatting

**Out of Scope:**
- ❌ Proprietary Decispher features
- ❌ Cloud-hosted services
- ❌ Paid tier features
- ❌ Integration with external platforms beyond GitHub

### Types of Contributions

We welcome:

#### 🐛 Bug Fixes
- Fix reported issues
- Improve error handling
- Resolve edge cases

#### ✨ Features (Aligned with Project Scope)
- New content matching modes
- Additional rule types
- Performance optimizations
- Developer experience improvements

#### 📝 Documentation
- Improve README or guides
- Add code examples
- Fix typos or clarify instructions

#### 🧪 Testing
- Add test coverage
- Improve test quality
- Add integration tests

#### 🎨 Performance
- Optimize algorithms (Trie, caching, etc.)
- Reduce memory usage
- Improve GitHub API efficiency

---

## 💻 Development Setup

### Project Structure

```
decision-guardian/
├── src/
│   ├── main.ts              # Action entry point
│   ├── parser.ts            # Decision file parser (Markdown)
│   ├── matcher.ts           # Pattern matching engine (Trie-based)
│   ├── rule-evaluator.ts   # Advanced rule evaluation
│   ├── rule-parser.ts       # JSON rule parser
│   ├── content-matchers.ts # Content matching (regex, string, line_range)
│   ├── comment.ts           # GitHub PR comment management
│   ├── github-utils.ts      # GitHub API utilities
│   ├── trie.ts              # Prefix trie for pattern matching
│   ├── metrics.ts           # Performance metrics
│   ├── logger.ts            # Structured logging
│   ├── health.ts            # Health validation
│   ├── types.ts             # Core type definitions
│   └── rule-types.ts        # Rule type definitions
├── __tests__/               # Test files
├── dist/                    # Compiled bundle (generated)
├── action.yml               # GitHub Action metadata
├── package.json             # Dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

### Available Scripts

```bash
# Development
npm run build          # Compile TypeScript → JavaScript
npm run package        # Bundle with @vercel/ncc → dist/index.js

# Testing
npm test               # Run Jest test suite
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix linting issues
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without changes

# Complete Verification
npm run all            # format + lint + test + build + package
```

### Development Workflow

1. **Create a feature branch**:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

2. **Make focused commits**:

```bash
git add .
git commit -m "feat(parser): add support for Unicode normalization"
```

3. **Keep your branch updated**:

```bash
git fetch upstream
git rebase upstream/main
```

4. **Run verification**:

```bash
npm run all
```

5. **Push to your fork**:

```bash
git push origin feature/your-feature-name
```

---

## 📐 Coding Standards

### TypeScript Style Guide

#### Naming Conventions

```typescript
// Classes: PascalCase
class DecisionParser { }
class PatternTrie { }

// Interfaces: PascalCase
interface Decision { }
interface RuleCondition { }

// Functions/Methods: camelCase
function parseDecisions() { }
async function evaluateRule() { }

// Constants: UPPER_SNAKE_CASE
const MAX_RULE_DEPTH = 10;
const MAX_RETRY_COUNT = 3;

// Private members: underscore prefix (optional but recommended)
private _cache: Map<string, boolean>;
```

#### File Organization

```typescript
// 1. Node.js built-in imports
import * as fs from 'fs/promises';
import * as path from 'path';

// 2. Third-party imports (sorted)
import * as core from '@actions/core';
import * as github from '@actions/github';
import { minimatch } from 'minimatch';

// 3. Local imports (sorted)
import { Decision, DecisionMatch } from './types';
import { RuleCondition } from './rule-types';

// 4. Constants
const MAX_COMMENT_LENGTH = 60000;

// 5. Types/Interfaces
interface ParseResult { }

// 6. Classes/Functions
export class Parser { }

// 7. Default export (if any)
export default Parser;
```

#### Code Style

```typescript
// ✅ Good: Clear, typed, documented
/**
 * Evaluate decision rules against file diffs
 * 
 * Supports nested AND/OR logic up to MAX_RULE_DEPTH levels.
 * Uses parallel processing for performance.
 * 
 * @param rules - The rule condition to evaluate
 * @param fileDiffs - Array of file diffs from the PR
 * @param depth - Current recursion depth (default: 0)
 * @returns Match details including matched files and patterns
 * @throws {Error} If depth exceeds MAX_RULE_DEPTH
 */
async evaluate(
  rules: RuleCondition,
  fileDiffs: FileDiff[],
  depth: number = 0
): Promise<RuleMatchDetails> {
  // Implementation
}

// ❌ Avoid: Unclear, untyped, undocumented
async function check(r, f, d) {
  // What does this do?
}
```

#### Error Handling

```typescript
// ✅ Good: Specific error handling with proper types
try {
  const result = await parseFile(filePath);
  return result;
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  core.error(`Failed to parse file: ${message}`);
  
  if (error instanceof Error && error.stack) {
    core.debug(error.stack);
  }
  
  throw new Error(`Parse failed: ${message}`);
}

// ❌ Avoid: Generic error handling
try {
  await parseFile(filePath);
} catch (e) {
  console.log('Error');
}
```

#### Security Best Practices

```typescript
// ✅ Good: Path traversal protection
const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();
const resolvedPath = path.resolve(workspaceRoot, filePath);
const normalizedWorkspace = path.normalize(workspaceRoot);

if (!resolvedPath.startsWith(normalizedWorkspace + path.sep)) {
  throw new Error('Path traversal detected');
}

// ✅ Good: Input validation with Zod
import { z } from 'zod';

const ConfigSchema = z.object({
  decisionFile: z.string()
    .regex(/^[a-zA-Z0-9._/-]+$/)
    .refine(val => !val.includes('..'), 'Path traversal not allowed'),
});

// ✅ Good: Regex safety (ReDoS prevention)
import safeRegex from 'safe-regex';
import vm from 'vm';

if (!safeRegex(pattern)) {
  throw new Error('Unsafe regex pattern detected');
}

// Execute in VM sandbox with timeout
const sandbox = vm.createContext(/* ... */);
vm.runInContext(code, sandbox, { timeout: 5000 });
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

**Scopes** (based on actual codebase):
- `parser` - Decision file parsing
- `matcher` - File pattern matching
- `rule-evaluator` - Rule evaluation logic
- `content-matchers` - Content matching modes
- `comment` - GitHub comment management
- `github-utils` - GitHub API utilities
- `trie` - Pattern trie optimization
- `metrics` - Performance metrics
- `logger` - Logging utilities
- `types` - Type definitions
- `docs` - Documentation
- `tests` - Test files

**Examples**:

```bash
feat(parser): add Unicode filename normalization

Normalize filenames to NFC form to ensure consistent matching across
platforms (macOS uses NFD, Windows/Linux use NFC).

This fixes matching issues when files contain accented characters.

Closes #123

---

fix(comment): prevent duplicate comments on conflict

Add retry logic with exponential backoff when GitHub API returns 409.
Includes duplicate comment cleanup to maintain idempotency.

Fixes #456

---

perf(trie): optimize candidate filtering for large decision sets

Replace linear search with Trie-based lookup, reducing complexity
from O(N×M) to O(log N) for file matching.

Benchmark: 10x faster for 500+ decisions.

---

docs(README): clarify advanced rules syntax

Add examples for nested AND/OR logic and content matching modes.

---

test(rule-evaluator): add coverage for edge cases

Test depth limits, parallel processing, and error boundaries.
```

### Code Comments

```typescript
// ✅ Good: Explain WHY, not WHAT
// Cache regex results to avoid repeated compilation in large PRs
// This reduces time complexity from O(n²) to O(n)
private resultCache = new Map<string, boolean>();

// ✅ Good: Document complex algorithms
/**
 * Progressive truncation strategy (5 layers):
 * Layer 1: Full detail (all matches)
 * Layer 2: First 20 detailed, rest summarized
 * Layer 3: First 10 detailed
 * Layer 4: First 5 detailed
 * Layer 5: Ultra-compact (counts only)
 * Layer 6: Hard truncation (last resort)
 */
private buildTruncatedComment(matches: DecisionMatch[]): string

// ✅ Good: Explain non-obvious decisions
// Normalize to NFC because macOS uses NFD by default
// This ensures "café" matches across all platforms
const normalized = filename.normalize('NFC');

// ❌ Avoid: Stating the obvious
// Increment counter
counter++;

// ❌ Avoid: Commented-out code (use git history instead)
// const oldImplementation = () => { ... }
```

---

## 🧪 Testing Guidelines

### Test Structure

Tests use **Jest** and mirror the source structure:

```
__tests__/
├── parser.test.ts
├── matcher.test.ts
├── rule-evaluator.test.ts
├── content-matchers.test.ts
├── trie.test.ts
└── fixtures/
    ├── valid-decisions.md
    ├── invalid-decisions.md
    └── test-rules.json
```

### Writing Tests

```typescript
import { DecisionParser } from '../src/parser';

describe('DecisionParser', () => {
  let parser: DecisionParser;

  beforeEach(() => {
    parser = new DecisionParser();
  });

  describe('parseContent', () => {
    it('should parse a valid decision block', async () => {
      const content = `
<!-- DECISION-001 -->
## Decision: Test Decision

**Status**: Active
**Date**: 2024-01-15
**Severity**: Critical

**Files**:
- \`src/**/*.ts\`

### Context
Test context
---
      `;

      const result = await parser.parseContent(content, 'test.md');

      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0]).toMatchObject({
        id: 'DECISION-001',
        title: 'Test Decision',
        status: 'active',
        severity: 'critical',
        files: ['src/**/*.ts'],
      });
      expect(result.errors).toHaveLength(0);
    });

    it('should normalize status synonyms', async () => {
      const content = `
<!-- DECISION-002 -->
## Decision: Test

**Status**: Enabled

**Files**:
- \`*.ts\`

### Context
Context
---
      `;

      const result = await parser.parseContent(content, 'test.md');

      expect(result.decisions[0].status).toBe('active');
    });

    it('should collect parse errors without failing', async () => {
      const content = `
<!-- DECISION-BROKEN -->
## Decision: Missing Fields
---
      `;

      const result = await parser.parseContent(content, 'test.md');

      expect(result.decisions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        line: expect.any(Number),
        message: expect.stringContaining('missing required fields'),
      });
    });
  });

  describe('parseFile', () => {
    it('should reject path traversal attempts', async () => {
      const result = await parser.parseFile('../../../etc/passwd');

      expect(result.decisions).toHaveLength(0);
      expect(result.errors[0].message).toContain('Path traversal detected');
    });
  });
});
```

### Test Coverage Goals

We aim for **80%+ code coverage**. Focus on:

- ✅ **Happy paths**: Normal, expected behavior
- ✅ **Edge cases**: Empty inputs, null values, boundary conditions
- ✅ **Error paths**: Invalid input, network failures, timeouts
- ✅ **Security**: Path traversal, ReDoS, injection attacks
- ✅ **Performance**: Large PRs, many decisions, deep nesting

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Critical Test Areas

Based on the codebase, ensure tests cover:

1. **Parser** (`parser.test.ts`)
   - Markdown parsing
   - Status/severity normalization
   - Date validation
   - File pattern extraction
   - Directory scanning
   - Path traversal protection

2. **Matcher** (`matcher.test.ts`)
   - Glob pattern matching
   - Trie candidate filtering
   - Exclusion patterns (`!pattern`)
   - Unicode filename handling

3. **Rule Evaluator** (`rule-evaluator.test.ts`)
   - AND/OR logic
   - Nested conditions
   - Depth limit enforcement
   - Parallel processing
   - Error boundaries

4. **Content Matchers** (`content-matchers.test.ts`)
   - String mode
   - Regex mode (with timeout/ReDoS protection)
   - Line range mode
   - Full file mode
   - JSON path mode

5. **GitHub Utils** (`github-utils.test.ts`)
   - Rate limit handling
   - Pagination
   - Circuit breaker pattern
   - Retry logic

6. **Comment Manager** (`comment.test.ts`)
   - Idempotency (hash-based)
   - Progressive truncation
   - Duplicate cleanup
   - Conflict retry

### Test Best Practices

```typescript
// ✅ Good: Descriptive test names following "should" pattern
it('should return empty array when no decisions are active', () => {});
it('should cache regex results to improve performance', () => {});

// ❌ Avoid: Vague test names
it('works', () => {});
it('test parser', () => {});

// ✅ Good: Arrange-Act-Assert pattern
it('should filter decisions by status', () => {
  // Arrange
  const decisions: Decision[] = [
    { id: 'D1', status: 'active', /* ... */ },
    { id: 'D2', status: 'archived', /* ... */ }
  ];

  // Act
  const active = decisions.filter(d => d.status === 'active');

  // Assert
  expect(active).toHaveLength(1);
  expect(active[0].id).toBe('D1');
});

// ✅ Good: Test one behavior at a time
it('should normalize status to lowercase', () => {
  expect(normalizeStatus('ACTIVE')).toBe('active');
});

it('should map status synonyms correctly', () => {
  expect(normalizeStatus('enabled')).toBe('active');
  expect(normalizeStatus('obsolete')).toBe('deprecated');
});

// ❌ Avoid: Testing multiple behaviors
it('should normalize and validate status', () => {
  // Tests too much at once - split into separate tests
});

// ✅ Good: Use test fixtures for complex data
const validDecision = readFixture('fixtures/valid-decisions.md');

// ✅ Good: Test error messages
expect(() => parseInvalid()).toThrow('Decision missing required fields');
```

---

## 🔄 Pull Request Process

### Before Submitting

**Checklist:**

- [ ] Code follows TypeScript style guide
- [ ] All tests pass (`npm test`)
- [ ] Linter passes (`npm run lint`)
- [ ] Formatter passes (`npm run format:check`)
- [ ] Bundle is updated (`npm run package`)
- [ ] Documentation is updated (if APIs changed)
- [ ] CHANGELOG.md is updated (if applicable)
- [ ] Commits follow conventional commit format
- [ ] No security vulnerabilities introduced

**Run full verification:**
```bash
npm run all
```

### Submitting a PR

1. **Push your branch** to your fork
2. **Open a Pull Request** against `main`
3. **Fill out the PR template** completely
4. **Link related issues** (Fixes #123, Closes #456)
5. **Wait for CI checks** to pass
6. **Request review** from maintainers

### PR Template

```markdown
## Description
Brief description of changes and motivation

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## How Has This Been Tested?
Describe the tests you ran and how to reproduce.

- [ ] Test A
- [ ] Test B

## Checklist
- [ ] My code follows the project's TypeScript style guide
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have run `npm run all` and all checks pass
- [ ] I have run `npm run package` and committed the updated dist/

## Related Issues
Fixes #(issue)
Closes #(issue)

## Additional Context
Add any other context about the PR here.
```

### Review Process

1. **Automated CI/CD checks** must pass
   - TypeScript compilation
   - Linting (ESLint)
   - Formatting (Prettier)
   - Tests (Jest)
   - Bundle verification

2. **Code review** by at least one maintainer
   - Code quality
   - Test coverage
   - Security considerations
   - Performance impact

3. **All review comments** must be addressed or resolved

4. **Branch must be up-to-date** with `main`

### After Merge

Maintainers will:
1. Squash and merge your PR (or rebase if appropriate)
2. Update CHANGELOG.md
3. Create a new release tag (if applicable)
4. Close related issues automatically

---

## 🐛 Reporting Bugs

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Try the latest version** (`DecispherHQ/decision-guardian@v1`)
3. **Gather debug information**:
   ```yaml
   env:
     ACTIONS_STEP_DEBUG: true
   ```

### Bug Report Template

Use the GitHub issue template. Include:

**Description**
Clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Create decision file with '...'
2. Configure workflow with '...'
3. Open PR with changes to '...'
4. See error

**Expected behavior**
What you expected to happen.

**Actual behavior**
What actually happened.

**Decision File**
```markdown
<!-- DECISION-001 -->
## Decision: Title

**Status**: Active
**Date**: 2024-01-15
**Severity**: Critical

**Files**:
- `src/**/*.ts`

### Context
Context here
---
```

**Workflow Configuration**
```yaml
name: Decision Guardian
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DecispherHQ/decision-guardian@v1
        with:
          decision_file: '.decispher/decisions.md'
          fail_on_critical: true
```

**Environment**
- Decision Guardian version: [e.g., v1.0.0]
- GitHub Actions runner: [e.g., ubuntu-latest]
- Repository: [public/private/enterprise]
- Node.js version: [if custom runner]

**Logs**
```
Paste relevant action logs here
```

**Screenshots**
If applicable, add screenshots of PR comments or errors.

**Additional context**
Any other details about the problem.

### Security Vulnerabilities

**🚨 Do NOT open public issues for security vulnerabilities.**

Instead, email **[decispher@gmail.com](mailto:decispher@gmail.com)** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information (for follow-up)

We will respond within **48 hours** and work with you to resolve the issue.

---

## 💡 Suggesting Features

### Scope of Features

Decision Guardian is the **open-source foundation** of the Decispher ecosystem. We accept feature suggestions that:

✅ **Align with core scope:**
- Improve decision file parsing
- Enhance pattern matching
- Add new content matching modes
- Optimize performance
- Improve developer experience
- Better GitHub integration

❌ **Out of scope:**
- Features requiring cloud infrastructure
- Integration with third-party platforms
- Paid/premium features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem. Ex. I'm frustrated when [...]

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions or features you've considered.

**Example Use Case**
```markdown
<!-- Example decision file using this feature -->
```

**Why this belongs in the open-source project**
Explain why this should be part of Decision Guardian vs. proprietary Decispher features.

**Would you be willing to implement this?**
- [ ] Yes, I can submit a PR
- [ ] I can help with testing
- [ ] I need someone else to implement it

**Additional context**
Any other context, screenshots, or examples.
```

### Feature Discussion Process

Before implementing **major features**:

1. **Open a GitHub Discussion** (not an issue)
2. **Get maintainer feedback** on feasibility and scope
3. **Wait for approval** before investing significant time
4. **Create a design document** for complex features

This prevents wasted effort on features that may not align with the project vision.

---

## 📚 Documentation

### Documentation Standards

All documentation should:

- ✅ Use clear, concise language
- ✅ Include working code examples
- ✅ Be kept up-to-date with code changes
- ✅ Follow proper Markdown formatting
- ✅ Include table of contents for long documents

### Files to Update

When making changes, consider updating:

- `README.md` - Overview and quick start
- `DECISIONS_FORMAT.md` - Decision file format reference
- `TECHNICAL_OVERVIEW.md` - Architecture and implementation
- `examples/` - Example decision files
- Code comments (JSDoc/TSDoc)

### Documentation Examples

```typescript
/**
 * Evaluate decision rules against file diffs
 * 
 * Supports nested AND/OR logic up to MAX_RULE_DEPTH (10) levels deep.
 * Uses Promise.allSettled for parallel processing with error boundaries.
 * 
 * @param rules - The rule condition to evaluate
 * @param fileDiffs - Array of file diffs from the PR
 * @param depth - Current recursion depth (default: 0)
 * @returns Match details including matched files, patterns, and depth
 * 
 * @example
 * ```typescript
 * const evaluator = new RuleEvaluator();
 * const result = await evaluator.evaluate(
 *   {
 *     match_mode: 'all',
 *     conditions: [
 *       { type: 'file', pattern: 'src/**/*.ts' },
 *       { type: 'file', pattern: 'config/*.yml' }
 *     ]
 *   },
 *   fileDiffs
 * );
 * 
 * if (result.matched) {
 *   console.log(`Matched ${result.matchedFiles.length} files`);
 * }
 * ```
 * 
 * @throws {Error} If depth exceeds MAX_RULE_DEPTH (prevents stack overflow)
 */
async evaluate(
  rules: RuleCondition,
  fileDiffs: FileDiff[],
  depth: number = 0
): Promise<RuleMatchDetails>
```

---

## 👥 Community

### Getting Help

- **GitHub Discussions**: Ask questions, share ideas, discuss features
- **Issues**: Report bugs, request features (after discussion)
- **Email**: [decispher@gmail.com](mailto:decispher@gmail.com)

### Helping Others

Great ways to contribute **without code**:

- ✅ Answer questions in GitHub Discussions
- ✅ Help triage issues (reproduce bugs, verify fixes)
- ✅ Improve documentation and examples
- ✅ Share your decision file templates
- ✅ Write blog posts or tutorials about Decision Guardian
- ✅ Give feedback on proposed features

### Recognition

Contributors are recognized through:

- Listing in README.md contributors section
- Mention in release notes
- GitHub contributor badge
- Special recognition for significant contributions

---

## 🎯 Good First Issues

New to the project? Look for issues labeled:

- `good first issue` - Beginner-friendly
- `help wanted` - Community help appreciated
- `documentation` - Improve docs
- `testing` - Add test coverage
- `performance` - Optimization opportunities

---

## 📝 Intellectual Property

### Contribution License

By contributing to Decision Guardian, you agree that:

1. Your contributions will be licensed under the **MIT License**
2. You have the right to submit the contribution
3. The contribution is your original work or properly attributed

### Ownership and Attribution

- **Project Author**: Ali Abbas
- **Organization**: Decispher
- **Copyright**: © 2024-2025 Ali Abbas / Decispher

All contributions will be attributed to contributors in release notes and the README.

### Trademark

"Decispher" and "Decision Guardian" are trademarks of Decispher. Use of these marks is subject to applicable trademark law.

---

## 🙏 Thank You

Thank you for contributing to Decision Guardian! Every contribution, no matter how small, helps make the project better.

**Questions?**
- Email: [decispher@gmail.com](mailto:decispher@gmail.com)
- GitHub: [@gr8-alizaidi](https://github.com/gr8-alizaidi)

**Happy Contributing! 🎉**

---

**Project**: Decision Guardian  
**Author**: Ali Abbas ([@gr8-alizaidi](https://github.com/gr8-alizaidi))  
**Organization**: Decispher  
**License**: MIT

*This contributing guide is adapted from open source best practices and is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).*