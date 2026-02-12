# TODOs: Clerk to Better Auth Migration

Spec: SPEC-004 | Status: completed | Progress: 38/38

## Setup (6 tasks)

- [x] T-001: Install Better Auth and core dependencies (complexity: 2)
- [x] T-002: Create @repo/email package with Resend + React Email (complexity: 4)
- [x] T-003: Create Better Auth Drizzle schema (session, account, verification tables) (complexity: 3)
- [x] T-004: Create Better Auth core config file (complexity: 4)
- [x] T-005: Modify users table schema for Better Auth compatibility (complexity: 4)
- [x] T-006: Generate and apply database migration (complexity: 3)

## Core Backend (6 tasks)

- [x] T-007: Rewrite API auth middleware for Better Auth (complexity: 3)
- [x] T-008: Update actor middleware to use Better Auth session (complexity: 3)
- [x] T-009: Simplify or remove UserCache (complexity: 2)
- [x] T-010: Create Better Auth handler route and remove Clerk routes (complexity: 3)
- [x] T-011: Update env config and validation schemas (complexity: 2)
- [x] T-012: Update UserService to remove auth provider methods (complexity: 3)

## Frontend (10 tasks)

- [x] T-013: Create Better Auth React client for admin app (complexity: 2)
- [x] T-014: Create Better Auth integration for Astro web app (complexity: 3)
- [x] T-016: Rewrite admin root layout and auth provider (complexity: 3)
- [x] T-017: Rewrite admin route protection (_authed.tsx and auth.tsx) (complexity: 3)
- [x] T-018: Rewrite admin signin and signup routes (complexity: 3)
- [x] T-019: Rewrite admin header user component (complexity: 2)
- [x] T-020: Rewrite web app middleware and auth components (complexity: 3)
- [x] T-021: Rewrite web app signin/signup form wrappers (complexity: 2)
- [x] T-022: Remove Astro Clerk integration from config (complexity: 1)

## Auth UI Package (5 tasks)

- [x] T-023: Rewrite auth-ui SignInForm component (complexity: 4)
- [x] T-024: Rewrite auth-ui SignUpForm component (complexity: 4)
- [x] T-025: Rewrite auth-ui UserMenu component (complexity: 3)
- [x] T-026: Rewrite auth-ui SimpleUserMenu and SignOutButton (complexity: 2)
- [x] T-027: Add password reset and email verification components to auth-ui (complexity: 3)

## Integration (3 tasks)

- [x] T-015: Implement Better Auth database hooks for billing integration (complexity: 4)
- [x] T-028: Update seed scripts for Better Auth (complexity: 3)
- [x] T-029: Configure OAuth providers (Google, Facebook) (complexity: 2)

## Testing (5 tasks)

- [x] T-030: Create shared auth test utilities (complexity: 3)
- [x] T-031: Update all API test files to use BA mocks (complexity: 4)
- [x] T-032: Update auth-ui and frontend test files (complexity: 3)
- [x] T-033: Write integration tests for full auth + billing flow (complexity: 4)
- [x] T-034: Run full test suite and verify coverage >= 90% (complexity: 3)

## Cleanup (4 tasks)

- [x] T-035: Remove all Clerk package dependencies (complexity: 2)
- [x] T-036: Clean up AuthProviderEnum and deprecated code (complexity: 2)
- [x] T-037: Update documentation (complexity: 2)
- [x] T-038: Final validation: typecheck, lint, test, build (complexity: 2)
