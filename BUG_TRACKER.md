# Bug Tracker

This document tracks identified bugs, their severity, description, status, and the branch where they were resolved.

## Known Bugs

### [BUG-001] Template JSON schema produces zero matches
- **Severity**: 🔴 Critical
- **Affects**: CLI, GitHub Action, Templates
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-001-template-json-schema`
- **Description**: Every shipped template (security, advanced-rules, database, api) generated rules using the `{match, conditions: [{files, content}]}` schema. The `RuleEvaluator` dispatched conditions through `isFileRule()`, which requires `type === 'file'` on the condition object. Template conditions had no `type` field, so `isFileRule()` returned false. The condition fell into the recursive `evaluate()` path, expectations for nested `conditions[]` were not met, and it produced `matched: false`.
- **Resolution**: Updated all templates to use the correct schema (`{"type": "file", "pattern": "...", "content_rules": [...]}`) and added regression tests to `rule-parser.test.ts`.

---

### [BUG-002] String mode: singular pattern silently degrades to glob-only match
- **Severity**: 🔴 Critical
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-002-string-mode-singular-pattern`
- **Description**: When a content rule was written with `{"mode": "string", "pattern": "router.post("}` (singular `pattern` field as shown in some README examples), `validateContentRule()` threw `'String mode requires patterns array'`. The error was caught by the caller in `rule-parser.ts`, emitted as a ⚠ warning, and `rules` was set to `null`. The decision then loaded with `rules: undefined`. `FileMatcher` treated it as a glob-only decision and fired on every file matching the glob, regardless of actual content — producing massive false-positives.
- **Root Cause**: `validateContentRule()` case `'string'` unconditionally threw when `rule.patterns` was absent, with no fallback for the common singular `rule.pattern` form.
- **Resolution**: Instead of throwing, `validateContentRule()` now auto-coerces a singular `pattern` string into `patterns: [rule.pattern]` in-place before returning. Rules that already have a `patterns` array continue to work unchanged. Rules with neither `pattern` nor `patterns` still correctly throw an actionable error. Four regression tests added to `tests/core/rule-parser.test.ts`.

---

### [BUG-003] json_path nested paths fail for in-place value edits
- **Severity**: 🔴 Critical
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-003-json-path-nested-value-edit`
- **Description**: `matchJsonPath()` scanned only added (`+`) diff lines when resolving dotted paths like `"database.password"`. For an in-place value edit (e.g. changing `"password": "old"` to `"password": "new"`), only the leaf `password` line appeared in the diff as an added line — the parent `"database": {` was an **unchanged context line** and therefore invisible to the matcher. The hierarchical scan failed to find the parent key, so `allKeysFound` became `false` and the path match silently returned no result. Any `json_path` rule with depth ≥ 2 was non-functional for value edits.
- **Root Cause**: `getChangedLinesWithNumbers()` collected only `type === 'add'` lines. Context (normal) lines — which carry unchanged parent keys — were never included in the candidate set passed to `matchJsonPath()`.
- **Resolution**: Added a new private helper `getChangedLinesWithContext()` that collects both `add` and `normal` (context) lines with their new-file line numbers, tagging each with an `isAdded` flag. `matchJsonPath()` now uses this richer set so ancestral keys found only in context lines are visible. To prevent false positives (matching a path that is purely contextual with no actual change), the **leaf key must still appear on an added line** (`leafIsAdded` guard). Four regression tests were added to `tests/core/content-matchers.test.ts` covering: 2-level in-place edit, 3-level deep in-place edit, false-positive guard (leaf only in context), and multiple-path partial match.

---

### [BUG-004] --fail-on-error does not exit 1 on rule parse failures
- **Severity**: 🔴 Reliability
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-004-fail-on-error-ignores-warnings`
- **Description**: Rule validation failures (malformed JSON, wrong schema, bad regex, inverted `line_range`) are caught in `rule-parser.ts` and stored in `parseResult.warnings[]` via `parser.ts` `parseBlock()`. The CLI's `--fail-on-error` flag (and GitHub Action's `fail_on_error` input) only checked `parseResult.errors[]`. Because rule parse failures land in `warnings[]` (a separate `string[]`), `--fail-on-error` exited 0 even when visibly broken rule schemas were present on screen (e.g. `⚠ DECISION-INV-001: Failed to parse inline JSON rules: Line range start must be <= end`).
- **Root Cause**: `parser.ts` `parseBlock()` pushes `ruleResult.error` into `warnings[]`, not `errors[]`. The `--fail-on-error` guard in `check.ts` and `main.ts` was never extended to cover this array.
- **Resolution**: Added a second guard in `check.ts` and `main.ts` that exits/fails immediately after printing warnings if `failOnError` is enabled and `parseResult.warnings.length > 0`. Two regression tests added to `tests/cli/check.test.ts` covering: (1) exit 1 when rule parse warnings exist with `failOnError: true`, (2) exit 0 when warnings exist but `failOnError: false`.

---

*(Add new bugs below!)*

---