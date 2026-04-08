# SPEC-040: Critical Package Coverage - auth-ui, billing, logger, email

## Progress: 0/35 tasks (0%)

**Average Complexity:** 1.8/2.5 (max)
**Critical Path:** T-001 -> T-005 -> T-030 -> T-035 -> T-039 (5 steps)
**Parallel Tracks:** 4 identified (one per package)

---

### Setup Phase (4 tasks)

- [ ] **T-001** (complexity: 1) - Install @testing-library/user-event in auth-ui
  - Blocked by: none | Blocks: T-005..T-015

- [ ] **T-002** (complexity: 1) - Install @react-email/render in email package
  - Blocked by: none | Blocks: T-027..T-029

- [ ] **T-003** (complexity: 1.5) - Export shouldUseWhiteText and redactSensitiveData from logger formatter
  - Blocked by: none | Blocks: T-021, T-022

- [ ] **T-004** (complexity: 1) - Create vitest.config.ts for email package
  - Blocked by: none | Blocks: T-027..T-029

### Core Phase - auth-ui (11 tasks)

- [ ] **T-005** (complexity: 2.5) - Remove basic.test.tsx + SignInForm render/hydration tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-006** (complexity: 2.5) - SignInForm submit, error, redirect tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-007** (complexity: 2) - SignInForm OAuth tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-008** (complexity: 2.5) - SignUpForm tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-009** (complexity: 2.5) - ForgotPasswordForm tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-010** (complexity: 2.5) - ResetPasswordForm tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-011** (complexity: 2.5) - VerifyEmail tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-012** (complexity: 2) - SignOutButton tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-013** (complexity: 2.5) - UserMenu tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-014** (complexity: 2) - SimpleUserMenu tests
  - Blocked by: T-001 | Blocks: T-035

- [ ] **T-015** (complexity: 2) - useAuthTranslations hook tests
  - Blocked by: T-001 | Blocks: T-035

### Core Phase - billing (3 tasks)

- [ ] **T-016** (complexity: 1.5) - limits.config.ts tests
  - Blocked by: none | Blocks: T-036

- [ ] **T-017** (complexity: 1.5) - entitlements.config cross-validation tests
  - Blocked by: none | Blocks: T-036

- [ ] **T-018** (complexity: 2) - config-validator edge case tests
  - Blocked by: none | Blocks: T-036

### Core Phase - logger (7 tasks)

- [ ] **T-019** (complexity: 2.5) - formatter.ts formatValue tests
  - Blocked by: T-003 | Blocks: T-037

- [ ] **T-020** (complexity: 2.5) - formatter.ts formatLogMessage/formatLogArgs tests
  - Blocked by: T-003 | Blocks: T-037

- [ ] **T-021** (complexity: 2) - formatter.ts color/utility tests
  - Blocked by: T-003 | Blocks: T-037

- [ ] **T-022** (complexity: 2) - redactSensitiveData isolated tests
  - Blocked by: T-003 | Blocks: T-037

- [ ] **T-023** (complexity: 1.5) - categories.ts tests
  - Blocked by: none | Blocks: T-037

- [ ] **T-024** (complexity: 1.5) - config.ts tests
  - Blocked by: none | Blocks: T-037

- [ ] **T-025** (complexity: 2.5) - environment.ts tests
  - Blocked by: none | Blocks: T-037

### Core Phase - email (4 tasks)

- [ ] **T-026** (complexity: 1.5) - createEmailClient tests
  - Blocked by: none | Blocks: T-038

- [ ] **T-027** (complexity: 2) - BaseLayout template tests
  - Blocked by: T-002, T-004 | Blocks: T-038

- [ ] **T-028** (complexity: 2) - VerifyEmailTemplate tests
  - Blocked by: T-002, T-004 | Blocks: T-038

- [ ] **T-029** (complexity: 2) - ResetPasswordTemplate tests
  - Blocked by: T-002, T-004 | Blocks: T-038

### Integration Phase (4 tasks)

- [ ] **T-030** (complexity: 1) - Update auth-ui coverage thresholds to 90%
  - Blocked by: T-005..T-015 | Blocks: T-035

- [ ] **T-031** (complexity: 1) - Update billing coverage thresholds to 90%
  - Blocked by: T-016..T-018 | Blocks: T-036

- [ ] **T-032** (complexity: 1.5) - Update logger coverage thresholds to 90%
  - Blocked by: T-019..T-025 | Blocks: T-037

- [ ] **T-033** (complexity: 1) - Verify email coverage thresholds at 90%
  - Blocked by: T-026..T-029 | Blocks: T-038

### Testing Phase (5 tasks)

- [ ] **T-035** (complexity: 1.5) - Quality gate: auth-ui
  - Blocked by: T-030 | Blocks: T-039

- [ ] **T-036** (complexity: 1) - Quality gate: billing
  - Blocked by: T-031 | Blocks: T-039

- [ ] **T-037** (complexity: 1) - Quality gate: logger
  - Blocked by: T-032 | Blocks: T-039

- [ ] **T-038** (complexity: 1) - Quality gate: email
  - Blocked by: T-033 | Blocks: T-039

- [ ] **T-039** (complexity: 1.5) - Final global quality gate
  - Blocked by: T-035..T-038 | Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003, T-004, T-016, T-017, T-018, T-023, T-024, T-025, T-026
Level 1: T-005..T-015, T-019..T-022, T-027..T-029
Level 2: T-030, T-031, T-032, T-033
Level 3: T-035, T-036, T-037, T-038
Level 4: T-039

## Parallel Tracks

1. **auth-ui track**: T-001 -> T-005..T-015 -> T-030 -> T-035
2. **billing track**: T-016..T-018 -> T-031 -> T-036
3. **logger track**: T-003 -> T-019..T-022 | T-023..T-025 -> T-032 -> T-037
4. **email track**: T-002 + T-004 -> T-027..T-029 | T-026 -> T-033 -> T-038

## Suggested Start

Begin with **T-001** + **T-002** + **T-003** + **T-004** (setup tasks, all complexity 1-1.5, no dependencies) in parallel. Then the 4 package tracks can proceed independently.
