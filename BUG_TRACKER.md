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

*(Add new bugs below!)*
