# TODOs: Auth UI Package Extraction

Spec: SPEC-033 | Status: pending | Progress: 0/37

## Setup
- [ ] T-001: Clean existing auth-ui package and set up project structure (complexity: 3)
- [ ] T-002: Define all TypeScript types in types.ts (complexity: 4) [blocked by T-001]
- [ ] T-003: Create CSS variables stylesheet with defaults and dark mode (complexity: 2) [blocked by T-001]
- [ ] T-004: Implement theming system (theme.ts + AuthThemeProvider) (complexity: 3) [blocked by T-001]
- [ ] T-005: Add auth i18n translation keys to @repo/i18n (es/en/pt) (complexity: 4) [blocked by T-001, T-003]

## Core
- [ ] T-006: Implement getInitials utility (complexity: 1) [blocked by T-002]
- [ ] T-007: Implement getDisplayName utility (complexity: 1) [blocked by T-002]
- [ ] T-008: Implement usePasswordStrength hook (complexity: 2) [blocked by T-002]
- [ ] T-009: Implement useAuthTranslations hook (complexity: 3) [blocked by T-002, T-005]
- [ ] T-010: Implement PasswordStrengthIndicator component (complexity: 3) [blocked by T-002, T-008]
- [ ] T-011: Implement OAuthButtons internal component and built-in icons (complexity: 3) [blocked by T-002]
- [ ] T-012: Implement SignInForm component (complexity: 4) [blocked by T-002, T-004, T-009, T-011]
- [ ] T-013: Implement SignUpForm component (complexity: 4) [blocked by T-002, T-004, T-009, T-011]
- [ ] T-014: Implement ForgotPasswordForm component (complexity: 3) [blocked by T-002, T-004, T-009]
- [ ] T-015: Implement ResetPasswordForm component (complexity: 4) [blocked by T-002, T-004, T-008, T-009, T-010]
- [ ] T-016: Implement ChangePasswordForm component (complexity: 4) [blocked by T-002, T-004, T-008, T-009, T-010]
- [ ] T-017: Implement VerifyEmail component (complexity: 3) [blocked by T-002, T-004, T-009]
- [ ] T-018: Implement UserButton component (complexity: 4) [blocked by T-002, T-004, T-006, T-007, T-009]
- [ ] T-019: Set up index.ts exports (complexity: 1) [blocked by T-012..T-018]

## Testing
- [ ] T-020: Set up test infrastructure (vitest config, test utils, axe setup) (complexity: 2) [blocked by T-019]
- [ ] T-021: Tests for getInitials and getDisplayName utilities (complexity: 1) [blocked by T-020]
- [ ] T-022: Tests for usePasswordStrength hook (complexity: 2) [blocked by T-020]
- [ ] T-023: Tests for useAuthTranslations hook (complexity: 2) [blocked by T-020]
- [ ] T-024: Tests for PasswordStrengthIndicator component (complexity: 2) [blocked by T-020]
- [ ] T-025: Tests for SignInForm component (complexity: 3) [blocked by T-020]
- [ ] T-026: Tests for SignUpForm component (complexity: 3) [blocked by T-020]
- [ ] T-027: Tests for ForgotPasswordForm component (complexity: 2) [blocked by T-020]
- [ ] T-028: Tests for ResetPasswordForm component (complexity: 3) [blocked by T-020]
- [ ] T-029: Tests for ChangePasswordForm component (complexity: 3) [blocked by T-020]
- [ ] T-030: Tests for VerifyEmail component (complexity: 2) [blocked by T-020]
- [ ] T-031: Tests for UserButton component (complexity: 3) [blocked by T-020]
- [ ] T-032: Tests for AuthThemeProvider (complexity: 2) [blocked by T-020]
- [ ] T-033: Verify 90%+ test coverage (complexity: 2) [blocked by T-021..T-032]

## Integration
- [ ] T-034: Update apps/web-old auth component imports (complexity: 3) [blocked by T-019, T-033]
- [ ] T-035: Update apps/admin auth component imports (complexity: 3) [blocked by T-019, T-033]
- [ ] T-037: Final build verification and smoke test (complexity: 2) [blocked by T-034, T-035]

## Docs
- [ ] T-036: Write CLAUDE.md for the package (complexity: 2) [blocked by T-019]
