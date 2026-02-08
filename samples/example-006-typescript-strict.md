<!-- DECISION-TS-001 -->
## Decision: TypeScript Strict Mode Required for All New Code

**Status**: Active  
**Date**: 2024-06-15  
**Severity**: Warning

**Files**:
- `tsconfig.json`
- `src/**/*.ts`
- `!src/legacy/**/*.ts`

**Rules**:
```json
{
  "type": "file",
  "pattern": "tsconfig.json",
  "content_rules": [
    {
      "mode": "string",
      "patterns": ["\"strict\": false", "\"strict\":false"]
    }
  ]
}
```

### Context

We enforce **TypeScript strict mode** for all new code to prevent type-related bugs before they reach production.

#### The Bug That Changed Everything

**May 12, 2024 - Type Coercion Bug in Payment Processing:**

A subtle TypeScript type issue caused incorrect payment amounts:

```typescript
// Bug: Implicit any parameter
function calculateTotal(items) {  // ← No type annotation
  return items.reduce((sum, item) => {
    return sum + item.price;  // ← Implicit any allows this
  }, 0);
}

// Caller passes wrong shape
const total = calculateTotal([
  { price: "29.99" },  // ← String, not number!
  { price: "49.99" }
]);

console.log(total);  // "029.9949.99" (string concatenation!)
```

**Result:**
- User charged $0.00 (payment gateway rejected invalid amount)
- Order marked as "paid" anyway (bug in state machine)
- 12 orders fulfilled without payment
- **Revenue loss**: $4,847
- Manual outreach to customers for payment

**Why TypeScript Didn't Catch It:**

```json
// tsconfig.json (before)
{
  "compilerOptions": {
    "strict": false,  // ← The problem
    "noImplicitAny": false
  }
}
```

With `strict: false`, TypeScript allowed:
- Implicit `any` types
- Null/undefined type coercion
- `this` type inference issues
- Unchecked index access

#### The Solution

**Enable Strict Mode:**

```json
// tsconfig.json (after)
{
  "compilerOptions": {
    // Master strict flag
    "strict": true,
    
    // Individual flags (all enabled by strict: true)
    "alwaysStrict": true,           // Emit "use strict"
    "strictNullChecks": true,       // null/undefined handling
    "strictFunctionTypes": true,    // Function param contravariance
    "strictBindCallApply": true,    // Type-check bind/call/apply
    "strictPropertyInitialization": true,  // Class properties must be initialized
    "noImplicitAny": true,          // Ban implicit any
    "noImplicitThis": true,         // Ban implicit this type
    "useUnknownInCatchVariables": true,  // catch (e) → e is unknown
    
    // Additional safety (not part of strict, but recommended)
    "noUncheckedIndexedAccess": true,  // array[i] returns T | undefined
    "noImplicitReturns": true,         // All code paths must return
    "noFallthroughCasesInSwitch": true,  // Switch statements must have breaks
    "noUnusedLocals": true,            // Flag unused variables
    "noUnusedParameters": true,        // Flag unused function params
    "exactOptionalPropertyTypes": true  // Distinguish undefined vs missing
  }
}
```

**The Bug Would Have Been Caught:**

```typescript
// With strict mode enabled
function calculateTotal(items) {  // ❌ Error: Parameter 'items' implicitly has an 'any' type
  return items.reduce((sum, item) => {
    return sum + item.price;
  }, 0);
}

// Fixed version
interface CartItem {
  price: number;  // ← Explicit type
  quantity: number;
}

function calculateTotal(items: CartItem[]): number {  // ✅ Fully typed
  return items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
}

// Caller error now caught at compile time
const total = calculateTotal([
  { price: "29.99" }  // ❌ Error: Type 'string' is not assignable to type 'number'
]);
```

#### Migration Strategy

**Gradual Rollout (Existing Code):**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true  // Enable for all code
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "src/legacy/**/*.ts"  // Exempt legacy code (for now)
  ]
}

// tsconfig.legacy.json (for old code)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": false  // Legacy code still uses loose mode
  },
  "include": ["src/legacy/**/*.ts"]
}
```

**Migration Progress Tracking:**

```bash
# Count files in legacy mode
find src/legacy -name "*.ts" | wc -l
# Goal: Reduce to 0 by Q2 2025
```

**Migration Schedule:**
- **Q3 2024**: All new code must use strict mode (enforced by PR checks)
- **Q4 2024**: Migrate 50% of legacy code
- **Q1 2025**: Migrate 90% of legacy code
- **Q2 2025**: 100% strict mode, remove tsconfig.legacy.json

#### Benefits Observed

**Type Safety:**

```typescript
// Before: Unsafe
function getUser(id) {  // any type
  return users.find(u => u.id === id);  // returns User | undefined
}

const user = getUser(123);
console.log(user.name);  // ❌ Runtime error if user is undefined

// After: Safe
function getUser(id: string): User | undefined {
  return users.find(u => u.id === id);
}

const user = getUser("123");
if (user) {
  console.log(user.name);  // ✅ TypeScript enforces null check
} else {
  console.log("User not found");
}
```

**Null Safety:**

```typescript
// Before: Null pointer exceptions
const config = getConfig();
const timeout = config.timeout;  // ❌ Crashes if config is null

// After: Forced null handling
const config = getConfig();  // Returns Config | null
const timeout = config?.timeout ?? 5000;  // ✅ Safe with optional chaining
```

**Array Access Safety:**

```typescript
// Before: Unchecked index access
const items = [1, 2, 3];
const first = items[0];  // Type: number (lies!)
const tenth = items[10]; // Type: number (lies! Actually undefined)
console.log(tenth.toFixed(2));  // ❌ Runtime error

// After: Checked index access (noUncheckedIndexedAccess: true)
const items = [1, 2, 3];
const first = items[0];  // Type: number | undefined
const tenth = items[10]; // Type: number | undefined

if (tenth !== undefined) {
  console.log(tenth.toFixed(2));  // ✅ TypeScript enforces check
}
```

#### Enforcement

**PR Check:**

```yaml
# .github/workflows/typescript-check.yml
name: TypeScript Strict Check

on: [pull_request]

jobs:
  check-strict:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check tsconfig.json
        run: |
          if grep -q '"strict": false' tsconfig.json; then
            echo "❌ strict: false found in tsconfig.json"
            echo "Enable strict mode. See DECISION-TS-001"
            exit 1
          fi
          
      - name: Check for new files in legacy
        run: |
          # Fail if new .ts files added to src/legacy/
          NEW_LEGACY=$(git diff --name-only origin/main...HEAD | grep "^src/legacy/.*\.ts$" || true)
          if [ -n "$NEW_LEGACY" ]; then
            echo "❌ New TypeScript files in src/legacy/ directory"
            echo "New code must go in src/ with strict mode enabled"
            echo "Files: $NEW_LEGACY"
            exit 1
          fi
      
      - name: TypeScript compilation
        run: npm run type-check
```

**ESLint Rule:**

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',  // Ban 'any' type
    '@typescript-eslint/explicit-function-return-type': 'warn',  // Require return types
    '@typescript-eslint/no-non-null-assertion': 'warn',  // Warn on ! operator
    '@typescript-eslint/strict-boolean-expressions': 'warn',  // Strict if conditions
  }
};
```

#### Common Migration Patterns

**Pattern 1: Add Parameter Types**

```typescript
// Before
function greet(name) {
  return `Hello, ${name}`;
}

// After
function greet(name: string): string {
  return `Hello, ${name}`;
}
```

**Pattern 2: Handle Nullability**

```typescript
// Before
function getFirstItem(items) {
  return items[0];
}

// After
function getFirstItem<T>(items: T[]): T | undefined {
  return items[0];
}
```

**Pattern 3: Type Third-Party Libraries**

```bash
# Install type definitions
npm install --save-dev @types/lodash
npm install --save-dev @types/express
```

**Pattern 4: Escape Hatch (Use Sparingly)**

```typescript
// Only when absolutely necessary (third-party API with no types)
const untypedData = thirdPartyLib.getData() as any;  // Document why!
```

#### Metrics & Success

**Before Strict Mode (Jan-May 2024):**
- Type-related bugs in production: 8
- Null pointer exceptions: 5
- Type coercion bugs: 3
- Average debug time: 4 hours per bug

**After Strict Mode (Jun-Dec 2024):**
- Type-related bugs in production: 1
- Null pointer exceptions: 0
- Type coercion bugs: 0
- Average debug time: 30 minutes (caught earlier)

**Developer Feedback:**
- Initial: "Annoying, so many errors"
- After 2 weeks: "Actually catching real bugs"
- After 1 month: "Would never go back to loose mode"

**Code Quality:**
- 47% reduction in runtime type errors
- 89% of bugs caught at compile time (vs 34% before)
- 28% reduction in PR iterations (fewer bugs found in review)

#### Trade-offs

**Pros:**
- ✅ Catch bugs at compile time (not runtime)
- ✅ Better IDE autocomplete
- ✅ Self-documenting code (types as documentation)
- ✅ Safer refactoring (compiler catches breaking changes)

**Cons:**
- ❌ More verbose code (type annotations required)
- ❌ Steeper learning curve for junior devs
- ❌ Migration effort for existing code (100+ hours)
- ❌ Slower initial development (think about types upfront)

**Our Assessment:** Pros significantly outweigh cons

#### When to Disable Strict Checks

**Never disable globally.**

**Rarely disable locally:**

```typescript
// Only when integrating with untyped third-party library
// @ts-expect-error - Legacy API has no types, tracked in JIRA-123
const result = legacyAPI.doSomething();
```

**Document all @ts-expect-error:**
- Link to ticket for fixing
- Explain why it's necessary
- Set reminder to remove

#### Training & Resources

**Onboarding:**
- New hires complete TypeScript Strict Mode tutorial (2 hours)
- Pair programming session migrating legacy file
- Reference card: Common strict mode patterns

**Documentation:**
- [Internal Wiki: TypeScript Best Practices](https://wiki.company.com/typescript/strict-mode)
- [Video: Introduction to Strict Mode](https://company.wistia.com/ts-strict)
- [Cheat Sheet: Strict Mode Migration Patterns](https://wiki.company.com/typescript/migration)

#### Related Decisions

- **DECISION-TS-002**: TypeScript version policy (use latest stable)
- **DECISION-TS-003**: Type definition maintenance strategy
- **DECISION-CODE-001**: ESLint configuration standards

#### References

- **Bug Report**: [Payment Type Coercion May 12, 2024](https://jira.company.com/browse/BUG-4471)
- **TypeScript Handbook**: [Strict Mode Documentation](https://www.typescriptlang.org/tsconfig#strict)
- **Migration Guide**: [Our TypeScript Strict Mode Journey](https://blog.company.com/typescript-strict-mode)

---

**Last Updated**: 2024-12-15  
**Next Review**: 2025-06-15 (annual)  
**Owner**: Platform Team (@platform-lead)  
**Status**: Active - enforced via Decision Guardian

**🎯 QUALITY STANDARD**

Strict mode is our baseline for type safety.

**If Decision Guardian flags your tsconfig.json:**
- Do NOT set `"strict": false`
- Do NOT disable individual strict checks
- DO migrate legacy code incrementally
- DO ask #typescript-help for migration assistance

**Migration Office Hours: Tuesdays 2-3 PM in #typescript-help**
