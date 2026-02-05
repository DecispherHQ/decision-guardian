<!-- DECISION-SEC-001 -->
## Decision: No Hardcoded Credentials in Source Code

**Status**: Active  
**Date**: 2024-08-01  
**Severity**: Critical

**Files**:
- `src/**/*.{ts,js,py,go,java}`
- `config/**/*.{json,yml,yaml,toml}`
- `!**/*.test.{ts,js}`
- `!**/fixtures/**`

**Rules**:
```json
{
  "type": "file",
  "pattern": "src/**/*.{ts,js,py,go}",
  "exclude": "**/{*.test.*,**/fixtures/**,**/mocks/**}",
  "content_rules": [
    {
      "mode": "regex",
      "pattern": "(password|api[_-]?key|secret|token|private[_-]?key|access[_-]?key)\\s*[=:]\\s*['\"][^'\"]{8,}['\"]",
      "flags": "i"
    }
  ]
}
```

### Context

We **prohibit hardcoded credentials** in source code after a severe security incident exposed our production database.

#### The Incident

**July 15, 2024 - Production Database Breach:**

A developer committed this code to a public GitHub repository:

```javascript
// ❌ NEVER DO THIS
const dbConfig = {
  host: 'prod-db.company.com',
  user: 'admin',
  password: 'P@ssw0rd123!ProdDB',  // <-- HARDCODED PASSWORD
  database: 'users'
};
```

**Timeline:**
- **10:23 AM**: Code committed and pushed to GitHub
- **10:47 AM**: Security researcher finds credentials (GitHub search)
- **11:15 AM**: Researcher attempts responsible disclosure (email sent)
- **2:30 PM**: Attacker discovers credentials independently
- **2:45 PM**: Unauthorized database access detected
- **3:00 PM**: Database credentials rotated, access revoked
- **3:15 PM**: Incident response team convened

**Impact:**
- 47,000 user records accessed (names, emails, hashed passwords)
- Attacker downloaded full user table
- Data exfiltration: ~2.3 GB
- Mandatory security disclosures to all users
- GDPR compliance investigation triggered
- **Total cost**: $340,000 (legal, notifications, monitoring, PR damage)

**Legal Consequences:**
- EU GDPR fine: €150,000
- California CCPA investigation (ongoing)
- 12-month credit monitoring for affected users: $94,000

#### Root Cause Analysis

**How it happened:**

1. Developer testing locally with production database (bad practice)
2. Hard-coded credentials "just for testing" (famous last words)
3. Forgot to remove before commit (no pre-commit hooks)
4. Code review missed it (reviewer focused on logic, not secrets)
5. Repository was accidentally made public (default setting)

**Why it wasn't caught:**

- ❌ No automated secret scanning in CI/CD
- ❌ No pre-commit hooks for secret detection
- ❌ No code review checklist for security
- ❌ No distinction between dev/staging/prod credentials in code
- ❌ Repository visibility not enforced (human error)

#### The Solution

**Zero-Tolerance Policy:**

**All credentials MUST come from:**
1. **Environment variables** (preferred)
2. **AWS Secrets Manager** (for production)
3. **HashiCorp Vault** (for sensitive operations)
4. **Encrypted configuration files** (with encrypted keys in Secrets Manager)

**Never from:**
- ❌ Source code files
- ❌ Git repository (even if private)
- ❌ Docker images
- ❌ Configuration files in version control

#### Implementation

**✅ Correct: Environment Variables**

```typescript
// config/database.ts
import { z } from 'zod';

const envSchema = z.object({
  DB_HOST: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string().min(16), // Enforce strong passwords
  DB_NAME: z.string(),
  DB_PORT: z.string().regex(/^\d+$/),
});

// Validate at startup (fail fast)
const env = envSchema.parse(process.env);

export const dbConfig = {
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: parseInt(env.DB_PORT, 10),
};
```

**✅ Correct: AWS Secrets Manager**

```typescript
// config/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  
  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} not found`);
  }
  
  return response.SecretString;
}

// Usage
const dbPassword = await getSecret('prod/database/password');
```

**✅ Correct: Local Development**

```bash
# .env.local (NOT committed to git)
DB_HOST=localhost
DB_USER=dev_user
DB_PASSWORD=local_dev_password_123
DB_NAME=app_dev
DB_PORT=5432
```

```bash
# .gitignore (ensure .env files are ignored)
.env
.env.local
.env.*.local
*.secret
credentials.json
```

**✅ Correct: CI/CD**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Secrets from GitHub Secrets (encrypted)
      - name: Deploy
        env:
          DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}
          API_KEY: ${{ secrets.STRIPE_API_KEY }}
        run: |
          npm run deploy
```

#### Enforcement Layers

**Layer 1: Pre-Commit Hooks (Local)**

```bash
# .husky/pre-commit
#!/bin/sh

# Scan for potential secrets
npx secretlint --format json

# Block commit if secrets found
if [ $? -ne 0 ]; then
  echo "❌ Potential secrets detected. Commit blocked."
  echo "Remove secrets and try again."
  exit 1
fi
```

**Layer 2: GitHub Actions (CI)**

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on: [push, pull_request]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better detection
      
      - name: GitGuardian scan
        uses: GitGuardian/ggshield-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITGUARDIAN_API_KEY: ${{ secrets.GITGUARDIAN_API_KEY }}
      
      - name: TruffleHog scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
```

**Layer 3: Decision Guardian (PR Review)**

This decision file with regex rules automatically comments on PRs that contain patterns matching credentials.

**Layer 4: GitHub Secret Scanning (Backup)**

GitHub's built-in secret scanning catches known patterns (API keys from 200+ providers).

#### Detected Patterns

**Our regex catches:**

```typescript
// ❌ Blocked patterns
const apiKey = "sk_live_51HqT2lKj3m4n5o6p7q8r9s0";
const password = "SuperSecret123!";
const secret = 'my-secret-token-12345678';
const accessKey = "AKIAIOSFODNN7EXAMPLE";
const privateKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB...";

// ✅ Allowed (not in source, or too short, or clearly fake)
const password = process.env.DB_PASSWORD;  // From environment
const apiKey = "test_key";  // Too short (< 8 chars)
const example = "replace_with_your_key";  // Placeholder
const mock = "mock_credential_for_testing";  // In test files (excluded)
```

**Pattern Explanation:**

```regex
(password|api[_-]?key|secret|token|private[_-]?key|access[_-]?key)
  ↑ Matches common credential keywords

\s*[=:]\s*
  ↑ Matches assignment (= or :) with optional whitespace

['\"][^'\"]{8,}['\"]
  ↑ Matches quoted string with 8+ characters
    (prevents false positives on short strings like "test")
```

**Why 8+ characters:**
- Most real credentials are >12 characters
- Reduces false positives on variable names like `key = "test"`
- Configurable if needed (currently optimal for our codebase)

#### False Positives & Exceptions

**Allowed:**

```typescript
// ✅ Test fixtures (excluded via pattern)
// tests/fixtures/mock-credentials.ts
export const mockPassword = "test_password_123";

// ✅ Documentation examples
// docs/api.md
// Example: apiKey = "your_key_here"

// ✅ Placeholder values
const API_KEY_PLACEHOLDER = "replace_with_real_key";
```

**Manual Override Process:**

If Decision Guardian flags a false positive:

1. Add comment explaining why it's safe:
```typescript
// SAFE: This is a placeholder for documentation
// Decision Guardian: DECISION-SEC-001 override approved by @security-lead
const exampleKey = "example_api_key_12345";
```

2. Security team reviews override
3. If approved, add file to exclusion list

**Override Log:**
- 3 overrides granted in 5 months
- All documented in security audit trail

#### Credential Rotation Policy

**Rotation Schedule:**
- Production database: Every 90 days
- API keys (external services): Every 180 days
- Service accounts: Every 365 days
- After any security incident: Immediately

**Rotation Process:**
1. Generate new credential in Secrets Manager
2. Deploy new credential (blue-green deployment)
3. Verify new credential works
4. Revoke old credential
5. Monitor for errors (24 hours)
6. Document rotation in audit log

#### Monitoring & Alerts

**Metrics:**
- Secret scan failures (pre-commit, CI/CD)
- Override requests (manual review needed)
- Failed authentication attempts (potential leaked credential)
- Secrets Manager access patterns (unusual activity)

**Alerts:**
- 🔴 **Critical**: Hardcoded secret detected in public repo (immediate page)
- 🔴 **Critical**: Unusual Secrets Manager access pattern
- 🟡 **Warning**: Pre-commit hook bypassed (commit made without hook)
- 🟢 **Info**: Credential rotation due within 7 days

#### Training & Documentation

**Developer Onboarding:**
- Mandatory security training (includes credential management)
- Live demonstration of pre-commit hooks
- Practice exercise: Configure local environment with .env

**Documentation:**
- [Internal Wiki: Secret Management Best Practices](https://wiki.company.com/security/secrets)
- [Runbook: What to do if you accidentally commit a secret](https://wiki.company.com/security/leaked-secret-runbook)
- [Video Tutorial: Using AWS Secrets Manager](https://company.wistia.com/secrets-manager)

**Incident Response Plan:**

If a secret is committed:
1. **Immediately**: Rotate the credential
2. **Within 1 hour**: Review git history, assess exposure
3. **Within 4 hours**: Notify security team, legal (if needed)
4. **Within 24 hours**: Post-mortem, update documentation

#### Success Metrics

**Since Implementation (Aug 1, 2024):**
- ✅ Zero hardcoded credentials in 4,847 commits
- ✅ 37 potential secrets caught by pre-commit hooks
- ✅ 12 caught by Decision Guardian (developer bypassed pre-commit)
- ✅ 0 security incidents related to hardcoded credentials

**Developer Compliance:**
- 100% of developers have pre-commit hooks installed
- 94% of developers pass secret scanning first try
- Average time to fix flagged secret: 8 minutes

**Cost Savings:**
- Previous incident: $340,000
- Prevention cost: $12,000/year (tooling + training)
- **ROI**: 28x first year alone

#### Related Security Decisions

- **DECISION-SEC-002**: Secrets rotation schedule
- **DECISION-SEC-003**: Access control for Secrets Manager
- **DECISION-SEC-004**: Production database access policy
- **DECISION-SEC-005**: Security code review checklist

#### References

- **Incident Report**: [Post-mortem - Database Breach July 15, 2024](https://docs.google.com/document/d/security-breach-2024-07)
- **GDPR Fine Details**: [Legal - GDPR Penalty Documentation](https://company.sharepoint.com/legal/gdpr-2024)
- **Security Training**: [Mandatory Module: Secret Management](https://company.lessonly.com/security/secrets)
- **Tool Evaluation**: [Secret Scanning Tools Comparison](https://docs.google.com/spreadsheets/d/secret-tools-eval)

#### Tools Used

**Scanning:**
- [GitGuardian](https://www.gitguardian.com/) - Real-time secret detection
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) - Open-source scanner
- [secretlint](https://github.com/secretlint/secretlint) - Pre-commit hook
- GitHub Secret Scanning (built-in)

**Storage:**
- AWS Secrets Manager (production)
- HashiCorp Vault (sensitive operations)
- 1Password (team shared credentials, non-production)

---

**Last Updated**: 2024-12-15  
**Next Review**: 2025-02-01  
**Owner**: Security Team (@security-lead)  
**Status**: Active - enforced via Decision Guardian

**🔒 SECURITY CRITICAL 🔒**

This decision prevents catastrophic security breaches.

**If Decision Guardian flags your code:**
1. DO NOT bypass by removing the pattern
2. DO NOT commit and "fix it later"
3. DO move the secret to environment variables or Secrets Manager
4. DO ask #security-help if you need assistance

**Questions? Ask in #security-help before committing.**
