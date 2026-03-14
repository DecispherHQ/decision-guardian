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
- **Resolution**: Added a new private helper `getChangedLinesWithContext()` that collects both `add` and `normal` (context) lines with their new-file line numbers, tagging each with an `isAdded` flag. `matchJsonPath()` now uses this richer set so ancestral keys found only in context lines are visible. To prevent false positives (matching a path that is purely contextual with no actual change), the **leaf key must still appear on an added line** (`leafIsAdded` guard). Four regression tests were added to `tests/core/content-matchers.test.ts`.

---

### [BUG-004] --fail-on-error does not exit 1 on rule parse failures
- **Severity**: 🔴 Reliability
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-004-fail-on-error-ignores-warnings`
- **Description**: Rule validation failures (malformed JSON, wrong schema, bad regex, inverted `line_range`) are caught in `rule-parser.ts` and stored in `parseResult.warnings[]` via `parser.ts` `parseBlock()`. The CLI's `--fail-on-error` flag (and GitHub Action's `fail_on_error` input) only checked `parseResult.errors[]`. Because rule parse failures land in `warnings[]` (a separate `string[]`), `--fail-on-error` exited 0 even when visibly broken rule schemas were present on screen.
- **Root Cause**: `parser.ts` `parseBlock()` pushes `ruleResult.error` into `warnings[]`, not `errors[]`. The `--fail-on-error` guard in `check.ts` and `main.ts` was never extended to cover this array.
- **Resolution**: Added a second guard in `check.ts` and `main.ts` that exits/fails immediately after printing warnings if `failOnError` is enabled and `parseResult.warnings.length > 0`. Two regression tests added to `tests/cli/check.test.ts`.

---

### [BUG-005] match_mode: "all" AND logic broken for content_rules within a FileRule
- **Severity**: 🔴 Logic
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-005-match-mode-all-and-logic`
- **Description**: `evaluateContentRules()` in `rule-evaluator.ts` unconditionally applied OR logic — if **any** `content_rule` matched, the file rule fired. There was no mechanism to require that **all** `content_rules` match (AND) on a single `FileRule`. A decision like `{type:"file", pattern:"src/api/**/*.ts", content_rules:[{mode:"string",...},{mode:"regex",...}]}` would fire even when only one of the two content rules was satisfied, regardless of user intent.
- **Root Cause**: `evaluateContentRules()` collected matched patterns across all rules and returned `matched: allMatchedPatterns.length > 0`. Any single match was enough. There was no `content_match_mode` field on `FileRule` to opt into AND behaviour.
- **Resolution**: Added `content_match_mode?: "any" | "all"` to the `FileRule` interface. `evaluateSingleRule()` now passes it to `evaluateContentRules()`. When `"all"` is set, `evaluateContentRules()` short-circuits and returns `{matched: false}` as soon as any individual content rule fails to match — enforcing true AND semantics. Default remains `"any"` (OR), preserving backward compatibility. `validateFileRule()` in `rule-parser.ts` rejects invalid `content_match_mode` values with an actionable error. Seven regression tests added to `tests/core/rule-evaluator.test.ts` and four parser validation tests to `tests/core/rule-parser.test.ts`.

---

### [BUG-007] Deleted lines are invisible to all content matchers
- **Severity**: 🟡 Behavioral (Undocumented)
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-007-deleted-lines-invisible`
- **Description**: All three diff-extraction methods — `getChangedLines()`, `getChangedLinesWithNumbers()`, and `extractChangedLineNumbers()` — filtered exclusively for `change.type === 'add'`. Removed lines (`del`) were silently ignored. As a result, removing a guarded element (e.g. deleting a hardcoded secret, removing an `authMiddleware` call) never triggered a decision. There was no way to author a decision that fires when a line is deleted.
- **Root Cause**: `src/core/content-matchers.ts` — all three extraction methods only collected `type === 'add'` lines; `del` changes were never processed.
- **Resolution**: Added `match_deleted_lines?: boolean` to the `ContentRule` interface (defaults to `false` for full backward compatibility). When set to `true`, `getChangedLines()` and `extractChangedLineNumbers()` include `del` diff lines alongside `add` lines. `matchString()`, `matchRegex()`, and `matchLineRange()` each pass `rule.match_deleted_lines ?? false` into the helpers. Four regression tests added to `tests/core/content-matchers.test.ts`.

---

### [BUG-008] Duplicate decision IDs: both fire, no warning
- **Severity**: 🟡 Reliability
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-008-duplicate-decision-ids`
- **Description**: Two decisions with the same ID in the same file (or across files in `checkall`) were both loaded and both fired independently. The parser had no deduplication step. In a multi-file directory scan, the same ID could appear with different severities — both matched, producing confusing output. No warning was emitted to the user.
- **Root Cause**: `src/core/parser.ts` — `parseContent()` pushed every parsed block to `decisions[]` with no ID uniqueness check.
- **Resolution**: After all blocks are parsed, a deduplication pass in `parseContent()` keeps only the first occurrence per ID. Subsequent duplicates are discarded and a descriptive warning (including line number and source file) is pushed to `parseResult.warnings[]`. Four regression tests added to `tests/core/parser.test.ts`.

---

### [BUG-009] Exclude-only Files patterns are silently no-ops
- **Severity**: 🟡 Usability
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-009-exclude-only-files-noop`
- **Description**: The `PatternTrie` constructor skipped all patterns starting with `!`. A decision whose `Files` list contained only exclusion patterns (e.g. `!src/**/*.test.ts`) was never inserted into the trie, never received candidates from `findCandidates()`, and never fired. No warning was emitted. The decision was silently ignored.
- **Root Cause**: `src/core/trie.ts` — the constructor iterated `decision.files` and skipped every `!`-prefixed pattern, so a decision with exclusion-only files produced no trie insertion at all.
- **Resolution**: When all patterns for a decision are exclusions, the trie constructor now inserts it under `**` (match-all), ensuring `findCandidates()` returns it as a candidate for every file. The existing exclusion gate in `matchesDecision()` (`matcher.ts`) then applies the `!`-patterns so excluded files are correctly skipped. `parseBlock()` in `parser.ts` also emits a `warnings[]` entry when it detects an exclude-only Files list, so users know the decision will fire on every file except those excluded. Three trie regression tests and two parser warning tests added.

---

### [BUG-010] line_range inverted range degrades to glob-only match
- **Severity**: 🟡 Reliability
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `bugfix/BUG-010-line-range-inverted`
- **Description**: When `start > end` in a `line_range` rule, `validateContentRule()` threw a 'Line range start must be <= end' error. This error was caught and stored as a warning, and the decision loaded with `rules: undefined`. Consequently, it fired as a glob-only pattern match on every file matching the pattern, producing false positives instead of cleanly failing.
- **Root Cause**: In `rule-parser.ts`, inverted ranges prompted an error to be thrown instead of coercing or fixing the values.
- **Resolution**: `validateContentRule()` now automatically swaps `start` and `end` if `start > end`, allowing the line range rule to function correctly rather than degrading to a false positive match.

### [BUG-011] Missing external rules file degrades to glob-only match
- **Severity**: 🟡 Reliability
- **Affects**: CLI, GitHub Action
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-011`
- **Description**: When an external rules file reference (`**Rules**: [link](./rules/file.json)`) points to a nonexistent file or fails to parse, `extractRules()` returned `{rules: null, error: "Failed to load..."}`. The error was caught in `parseBlock()` and pushed into the `warnings` array. The decision loaded with `rules: undefined`, and consequently fired as a glob-only match on every file matching the `Files` list rather than gracefully failing.
- **Root Cause**: In `parseBlock()` (inside `src/core/parser.ts`), missing external rules returned an error that was appended to `warnings` instead of throwing an error or being added to the `errors` array, causing it to fall back to an active decision without rules.
- **Resolution**: `parseBlock()` now throws an error when `ruleResult.error` is present. This correctly skips adding the decision and routes the error message to the `errors` array, preventing false-positive matches and ensuring `--fail-on-error` can catch it. Added one regression test to `tests/core/parser.test.ts`.

---

### [BUG-012] Empty and whitespace-only decision files silently ignored
- **Severity**: 🟡 Usability
- **Affects**: CLI, GitHub Action, Documentation
- **Status**: ✅ Fixed
- **Branch**: `fix/BUG-012-empty-decision-files`
- **Description**: Empty `.md` files and files containing only whitespace were successfully passed to `parseContent()`, which called `splitIntoBlocks()`. The `content.trim()` check inside `splitIntoBlocks()` returned early with an empty `[]` array. The file then produced `{decisions: [], errors: [], warnings: []}`. In `checkall` directory mode, these empty results were merged silently with zero output, providing no feedback to the user that a file was empty or missing decision markers.
- **Root Cause**: `parseContent()` in `src/core/parser.ts` did not check if any blocks were returned by `splitIntoBlocks()` and gave no warning if the file was empty or lacked decision markers.
- **Resolution**: Updated `parseContent()` to emit a warning to `parseResult.warnings[]` when no decision blocks are found in a file. This ensures that in both direct file mode and `checkall` directory mode, the user is notified of empty or invalid decision files. Added three regression tests to `tests/core/parser.test.ts`.

---
