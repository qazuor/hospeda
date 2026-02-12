---
name: check-deps
description: Checks project dependencies for outdated packages, security vulnerabilities, and license compliance
---

# Check Dependencies Command

## Purpose

Performs a comprehensive dependency health check across the project. Identifies outdated packages, security vulnerabilities, and license compliance issues. Uses the project's package manager audit tools (npm audit, pnpm audit, yarn audit) along with additional analysis to provide actionable recommendations for keeping dependencies secure and up-to-date.

## When to Use

- **Regular Maintenance**: Weekly or bi-weekly dependency health checks
- **Before Deployments**: Ensure no known vulnerabilities ship to production
- **After Adding Dependencies**: Verify new packages are secure and properly licensed
- **Security Incidents**: When vulnerability disclosures affect your stack
- **Compliance Audits**: When license compliance documentation is required
- **Upgrade Planning**: When planning major dependency upgrades

## Usage

```bash
/check-deps [options]
```

### Options

- `--scope <area>`: Focus on specific check (outdated, security, licenses, all)
- `--severity <level>`: Minimum severity to report (critical, high, moderate, low)
- `--fix`: Attempt automatic fixes for vulnerabilities where possible
- `--report`: Generate detailed dependency report file
- `--interactive`: Show interactive upgrade recommendations
- `--production`: Only check production dependencies (exclude devDependencies)

### Examples

```bash
/check-deps                                      # Full dependency check
/check-deps --scope security                     # Security-only check
/check-deps --scope outdated --interactive       # Interactive upgrade guide
/check-deps --severity critical --fix            # Fix critical vulnerabilities
/check-deps --scope licenses --report            # License compliance report
/check-deps --production --severity high         # Production deps, high+ severity
```

## Check Process

### Step 1: Environment Detection

**Actions:**

- Detect package manager (npm, pnpm, yarn, bun)
- Identify lock file (package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb)
- Check for monorepo configuration (workspaces, TurboRepo, Nx, Lerna)
- Verify node_modules exists (prompt for install if not)

**Checks:**

- [ ] Package manager detected
- [ ] Lock file present and valid
- [ ] Dependencies installed
- [ ] Monorepo structure identified (if applicable)

### Step 2: Security Vulnerability Audit

**Actions:**

- Run package manager audit command:
  - `npm audit --json`
  - `pnpm audit --json`
  - `yarn audit --json`
- Parse vulnerability results
- Categorize by severity (critical, high, moderate, low)
- Identify affected dependency chains
- Check for available patches or updates

**Vulnerability Categories:**

- **Critical**: Remote code execution, authentication bypass, data exposure
- **High**: Denial of service, privilege escalation, significant data leaks
- **Moderate**: Cross-site scripting, information disclosure
- **Low**: Minor issues, theoretical vulnerabilities

**Checks:**

- [ ] Audit command executed successfully
- [ ] Results parsed and categorized
- [ ] Remediation paths identified
- [ ] Transitive dependency chains mapped

### Step 3: Outdated Package Analysis

**Actions:**

- Run outdated check:
  - `npm outdated --json`
  - `pnpm outdated --json`
  - `yarn outdated --json`
- Categorize updates by type:
  - **Major**: Breaking changes likely (semver major bump)
  - **Minor**: New features, backward compatible
  - **Patch**: Bug fixes, backward compatible
- Identify packages with significant version gaps
- Flag deprecated packages
- Check for packages with no recent activity (potentially abandoned)

**Checks:**

- [ ] Outdated packages identified
- [ ] Update types categorized (major/minor/patch)
- [ ] Deprecated packages flagged
- [ ] Abandoned packages identified

### Step 4: License Compliance Check

**Actions:**

- Analyze licenses of all direct dependencies
- Check transitive dependency licenses
- Identify potentially problematic licenses:
  - **Permissive** (MIT, Apache-2.0, BSD): Generally safe
  - **Copyleft** (GPL, AGPL, LGPL): May require source disclosure
  - **Unknown/Custom**: Requires manual review
  - **No License**: Potentially risky
- Generate license summary

**License Categories:**

- **Green**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense
- **Yellow**: LGPL-2.1, LGPL-3.0, MPL-2.0, CC-BY-4.0 (review recommended)
- **Red**: GPL-2.0, GPL-3.0, AGPL-3.0 (copyleft, may have implications)
- **Unknown**: No license detected or custom license (manual review required)

**Checks:**

- [ ] All dependency licenses identified
- [ ] Copyleft licenses flagged
- [ ] Unknown licenses flagged
- [ ] License summary generated

### Step 5: Results Compilation

**Actions:**

- Aggregate results from all checks
- Prioritize findings by severity and impact
- Generate fix recommendations
- Create report file if `--report` enabled

## Output Format

### Terminal Output

```
Dependency Check Results
===================================================================

Package Manager: pnpm
Lock File: pnpm-lock.yaml
Total Dependencies: 247 (142 direct, 105 transitive)
Monorepo: Yes (4 workspaces)

SECURITY VULNERABILITIES
===================================================================

Critical (1)
-------------------------------------------------------------------
  [CVE-2024-XXXXX] Prototype Pollution in lodash
    Package: lodash@4.17.20
    Fixed in: >= 4.17.21
    Path: my-app > express > lodash
    Fix: pnpm update lodash

High (2)
-------------------------------------------------------------------
  [CVE-2024-XXXXX] ReDoS in semver
    Package: semver@7.3.5
    Fixed in: >= 7.5.2
    Path: my-app > npm > semver
    Fix: pnpm update semver

  [CVE-2024-XXXXX] Path Traversal in tar
    Package: tar@6.1.0
    Fixed in: >= 6.2.1
    Path: my-app > npm > tar
    Fix: pnpm update tar

Moderate (3)
-------------------------------------------------------------------
  [Listed with details...]

OUTDATED PACKAGES
===================================================================

Major Updates Available (3)
-------------------------------------------------------------------
  Package          Current    Latest     Type
  react            18.2.0     19.0.0     dependencies
  typescript       5.3.3      5.7.0      devDependencies
  eslint           8.56.0     9.0.0      devDependencies

Minor Updates Available (8)
-------------------------------------------------------------------
  Package          Current    Latest     Type
  next             14.1.0     14.3.0     dependencies
  zod              3.22.0     3.23.0     dependencies
  [...]

Patch Updates Available (12)
-------------------------------------------------------------------
  [Listed...]

Deprecated Packages (1)
-------------------------------------------------------------------
  tslint@6.1.3 - Deprecated in favor of ESLint

LICENSE COMPLIANCE
===================================================================

Summary:
  MIT: 189 packages
  Apache-2.0: 23 packages
  BSD-3-Clause: 15 packages
  ISC: 12 packages
  LGPL-3.0: 2 packages (review recommended)
  Unknown: 1 package (manual review required)

Packages Requiring Review:
-------------------------------------------------------------------
  [LGPL-3.0] some-package@1.0.0
    Impact: May require source disclosure for linked code
    Action: Review license terms for your use case

  [UNKNOWN] custom-lib@2.0.0
    Impact: No license detected; usage terms unclear
    Action: Contact package author or find alternative

===================================================================
Summary
===================================================================

  Security:   1 critical, 2 high, 3 moderate
  Outdated:   3 major, 8 minor, 12 patch
  Deprecated: 1 package
  Licenses:   2 require review, 1 unknown

  Recommendation: Address critical vulnerability immediately.
  Run: /check-deps --fix to attempt automatic fixes.
```

### Report File

When `--report` is enabled, generates a detailed report at
`.claude/reports/dependency-check-report.md` with full details,
affected dependency chains, and step-by-step remediation instructions.

## Automatic Fixes

When `--fix` is specified:

```
Attempting Automatic Fixes
===================================================================

[1/3] Fixing lodash vulnerability...
  Running: pnpm update lodash
  Result: Updated lodash 4.17.20 -> 4.17.21
  Status: FIXED

[2/3] Fixing semver vulnerability...
  Running: pnpm update semver
  Result: Updated semver 7.3.5 -> 7.5.2
  Status: FIXED

[3/3] Fixing tar vulnerability...
  Running: pnpm update tar
  Result: Dependency locked by parent package
  Status: MANUAL FIX REQUIRED
    Suggestion: Update npm package or add resolution override

===================================================================
Fix Summary: 2 fixed, 1 requires manual intervention
```

## Integration with Workflow

This command integrates at multiple workflow points:

- **Development Phase**: Run after adding new dependencies
- **Validation Phase**: Part of pre-deployment quality checks
- **Maintenance**: Regular scheduled dependency health checks
- **CI/CD**: Can be integrated into continuous integration pipelines

## Best Practices

1. **Run Regularly**: Schedule weekly dependency checks
2. **Fix Critical First**: Always address critical vulnerabilities immediately
3. **Test After Updates**: Run full test suite after dependency updates
4. **Review Licenses**: Check license compliance when adding new packages
5. **Pin Versions**: Use lock files and consider pinning critical dependencies
6. **Monitor Deprecations**: Plan migration away from deprecated packages early
7. **Document Exceptions**: If a vulnerability cannot be immediately fixed, document why
8. **Use Interactive Mode**: When planning major upgrades, use `--interactive` for guided process

## Related Commands

- `/code-review` - Code quality review (includes dependency usage patterns)
- `/security-review` - Deep security review (includes dependency attack surface)
- `/generate-changelog` - Document dependency updates in changelog

## Notes

- Requires dependencies to be installed (`node_modules` present)
- Monorepo support: checks all workspace packages
- Transitive dependency vulnerabilities may require updating parent packages
- License checking uses package.json license fields; some packages may need manual verification
- The `--fix` option only updates within semver-compatible ranges by default
- For major version upgrades, use `--interactive` for guided migration assistance
