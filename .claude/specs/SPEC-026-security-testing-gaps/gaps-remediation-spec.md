# SPEC-026-GAPS: Security Testing Gaps Remediation

> **Parent Spec**: SPEC-026 - Security Testing Gaps
> **Status**: approved
> **Created**: 2026-03-10
> **Complexity**: high (30 gaps, 5 phases)
> **Estimated effort**: 21-28 hours

## Overview

Remediation of 30 verified security gaps found during SPEC-026 audits. Covers IDOR vulnerabilities, audit logging infrastructure, lockout hardening, password policy unification, session limits, and test cleanup.

## Phase 0 - Blockers (P0)

### P0-1: Fix build failure in @repo/config (GAP-016)
- **File**: `packages/config/src/env.ts:207`
- **Change**: Replace `error.errors` with `error.issues` (ZodError property). Type `err` parameter properly.
- **Verify**: Line 25 of same file uses `.issues` correctly. Follow that pattern.
- **Test**: Run `pnpm --filter @repo/config typecheck`

### P0-2: Fix IDOR in Sponsorship service (GAP-001/028)
- **Files**:
  - `packages/schemas/src/enums/permission.enum.ts` - Add `SPONSORSHIP_UPDATE_ANY`, `SPONSORSHIP_UPDATE_OWN`, `SPONSORSHIP_DELETE_ANY`, `SPONSORSHIP_DELETE_OWN`, `SPONSORSHIP_RESTORE_ANY`, `SPONSORSHIP_RESTORE_OWN`, `SPONSORSHIP_VIEW_ANY`, `SPONSORSHIP_VIEW_OWN`
  - `packages/service-core/src/services/sponsorship/sponsorship.service.ts` - Change `_canUpdate`, `_canSoftDelete`, `_canHardDelete`, `_canRestore`, `_canView` to use `checkGenericPermission` with ANY/OWN pattern
  - `packages/seed/src/required/` - Update admin role seeds with new permissions
- **Pattern to follow**: `packages/service-core/src/services/accommodation/accommodation.permissions.ts` (lines 43-51) using `checkGenericPermission(actor, ANY_PERM, OWN_PERM, isOwner(actor, entity), errorMsg)`
- **Ownership field**: `sponsorUserId` or `createdById`

### P0-3: Fix IDOR in Owner-Promotion service (GAP-001/029)
- **Files**: Same pattern as P0-2 but for:
  - `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts`
  - Permission enum with `OWNER_PROMOTION_*_ANY`/`OWNER_PROMOTION_*_OWN`
- **Ownership field**: `ownerId`

## Phase 1 - Critical Fixes (P1)

### P1-1: Add try-catch to auditLog() (GAP-018)
- **File**: `apps/api/src/utils/audit-logger.ts:126-133`
- **Change**: Wrap auditLog() body in try-catch. In catch, use `console.error` (avoid logger recursion).

### P1-2: Add audit log to change-password (GAP-033)
- **File**: `apps/api/src/routes/auth/change-password.ts`
- **Change**: Add `AUTH_PASSWORD_CHANGED` to AuditEventType. Add auditLog() call after successful password change. Include actor, IP, timestamp. NEVER include passwords.
- **Depends on**: P1-1

### P1-3: Unify password schema (GAP-014/019)
- **Files**:
  - Create `packages/schemas/src/common/password.schema.ts` with `StrongPasswordSchema` using regex `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/`, min 8, max 128
  - Update `packages/schemas/src/api/auth.schema.ts:49-52` `ChangePasswordInputSchema` to use `StrongPasswordSchema`
  - Update `packages/schemas/src/entities/user/user.crud.schema.ts:165-181` `UserPasswordChangeInputSchema` to use `StrongPasswordSchema`
  - Update `packages/schemas/src/entities/user/user.crud.schema.ts:187-198` `UserPasswordResetInputSchema` to use `StrongPasswordSchema`
  - Export from schemas package index

### P1-4: Update metadata and cross-references (GAP-012/021)
- **Files**:
  - `.claude/specs/SPEC-026-security-testing-gaps/metadata.json` - Set status=completed, completed date
  - `.claude/tasks/SPEC-026-security-testing-gaps/TODOs.md` - Update progress
  - `.claude/tasks/SPEC-019-security-permissions-hardening/TODOs.md` - Add SPEC-026 cross-reference

### P1-5: Add audit log to user admin routes (GAP-009)
- **Files**: `apps/api/src/routes/user/admin/delete.ts`, `hardDelete.ts`, `create.ts`, `restore.ts`, `batch.ts`
- **Change**: Add `USER_ADMIN_MUTATION` event type. Add auditLog() after successful operations in each file.
- **Depends on**: P1-1

### P1-6: Extend lockout to forgot-password, signup, resend (GAP-002)
- **File**: `apps/api/src/routes/auth/handler.ts`
- **Change**: Add lockout handlers for `/forgot-password`, `/sign-up/email`, and email verification resend. Use composite key `email:ip`. More permissive limits than signin (e.g., 10 attempts / 15 min for signup, 5 / 15 min for forgot-password).
- **Depends on**: P1-1

## Phase 2 - Audit Infrastructure (P1-P2)

### P2-1: Implement recursive scrubSensitiveData() (GAP-027)
- **File**: `apps/api/src/utils/audit-logger.ts:111-119`
- **Change**: Make scrubSensitiveData() recursive with depth limit (3-4 levels) and cycle protection. Add tests.

### P2-2: Move AuditEventType to @repo/logger (GAP-007)
- **Files**:
  - Create `packages/logger/src/audit-types.ts` with AuditEventType, AuditEventTypeValue, BaseAuditEntry, and all entry interfaces
  - Update `packages/logger/src/index.ts` to re-export
  - Update `apps/api/src/utils/audit-logger.ts` to import from `@repo/logger`
  - Update all consumers
- **Depends on**: P1-2, P1-5 (new event types must be created first)

### P2-3: Add Sentry breadcrumbs to auditLog() (GAP-008)
- **File**: `apps/api/src/utils/audit-logger.ts`
- **Change**: Add `Sentry.addBreadcrumb({ category: 'audit', message: entry.auditEvent, data: scrubbed, level: 'info' })` inside auditLog().
- **Depends on**: P2-2

### P2-4: Create generic audit middleware (GAP-017/025/030/032)
- **Files**:
  - Create `apps/api/src/middlewares/audit.ts` (~80 lines)
  - Modify `apps/api/src/utils/create-app.ts` to register after actorMiddleware()
  - Add `RESOURCE_MUTATION` event type
- **Design**: Middleware checks `c.req.method` (skip GET/HEAD/OPTIONS). For mutations, uses afterResponse hook. Logs if `c.res.status < 400`. Extracts actor from context, resource from path, method from HTTP. Must be 100% fail-safe (try-catch).
- **Depends on**: P2-2, P2-1

## Phase 3 - Lockout Hardening (P2)

### P3-1: Add .trim() to lockout store (GAP-031)
- **File**: `apps/api/src/middlewares/auth-lockout.ts:196,233`
- **Change**: Add `.trim()` after `.toLowerCase()` in checkLockout() and recordFailedAttempt().

### P3-2: Replace read-then-write with Redis INCR (GAP-003)
- **File**: `apps/api/src/middlewares/auth-lockout.ts:237-255`
- **Change**: Use Redis INCR (atomic) instead of GET+SET. For in-memory store, keep as-is. Handle firstAttempt timestamp with separate key or MULTI/EXEC.

### P3-3: Add 3 missing lockout integration tests (GAP-015)
- **File**: `apps/api/test/integration/auth/login-lockout.test.ts`
- **Tests**: 1) unlock after window expires, 2) BA 429 not counted as failed attempt, 3) route isolation (other auth routes unaffected)

### P3-4: Add lockout concurrency test (GAP-011)
- **File**: `apps/api/test/middlewares/` (new or existing)
- **Change**: Test with Promise.all() of N simultaneous failed login attempts. Verify count is exactly N.
- **Depends on**: P3-2

## Phase 4 - Session & Test Improvements (P2)

### P4-1: Investigate and implement maxSessions (GAP-024)
- **File**: `apps/api/src/lib/auth.ts`
- **Change**: Research Better Auth maxSessions support. If native, configure limit (5-10). If not, implement middleware that counts active sessions in PostgreSQL.

### P4-2: Add concurrent signout test (GAP-022)
- **File**: `apps/api/test/integration/auth/multi-session-signout.test.ts`
- **Change**: Add test with Promise.all() of simultaneous signout requests.

### P4-3: Add audit verification to session tests (GAP-020)
- **File**: `apps/api/test/integration/auth/signout-session.test.ts`
- **Change**: Add vi.spyOn on auditLog to verify SESSION_SIGNOUT events are emitted.

## Phase 5 - Cleanup (P3-P4)

### P5-1: Add DLQ test with real DB (GAP-006)
- **File**: New test in `apps/api/test/integration/webhooks/`
- **Change**: Test Dead Letter Queue with real DB assertions (not mocks).

### P5-2: Delete legacy webhook test files (GAP-005/026)
- **Files**: Evaluate and delete legacy mock-based files in `apps/api/test/integration/webhooks/` (webhook-idempotency.test.ts, webhook-persistence.test.ts, others)
- **Depends on**: P5-1

### P5-3: Update spec docs (GAP-004/010)
- **Files**: `.claude/specs/SPEC-026-security-testing-gaps/spec.md`
- **Changes**: Document COOLDOWN_MS was intentionally discarded. Document SESSION_SIGNOUT naming decision.

## Dependency Graph

```
P0-1 (build fix)
  └─> P0-2, P0-3 (IDOR)

P1-1 (try-catch)
  ├─> P1-2 (password audit) ──> P1-5 (user audit) ──> P2-2 (move types)
  │                                                       ├─> P2-3 (Sentry)
  │                                                       └─> P2-4 (middleware) ← P2-1
  └─> P1-6 (lockout extension)

P3-2 (Redis INCR) ──> P3-4 (concurrency test)
P5-1 (DLQ test) ──> P5-2 (delete legacy)

Independent: P1-3, P1-4, P3-1, P3-3, P4-1, P4-2, P4-3, P5-3
```

## Out of Scope

- GAP-013 (CSP nonce): Covered by SPEC-040
- GAP-023: Closed as false positive
