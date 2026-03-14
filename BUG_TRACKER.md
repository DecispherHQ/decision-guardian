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

*(Add new bugs below!)*
