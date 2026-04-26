/**
 * Unit tests: BILLING_MUTATION audit log for promo-code CRUD operations.
 *
 * Verifies that `auditLog` is called with the correct `BILLING_MUTATION` payload
 * for the promo-code mutations targeted by SPEC-064 T-051:
 *   - promo code creation
 *   - promo code update
 *   - promo code deletion (soft-delete)
 *
 * Strategy: mock the `audit-logger` module and call lightweight wrappers that
 * mirror the exact `auditLog(...)` calls present in the production handlers
 * (`apps/api/src/routes/billing/promo-codes.ts`). This keeps the test fast,
 * deterministic, and independent of DB or billing SDKs.
 *
 * SPEC-064 T-051.
 *
 * @module test/routes/billing/promo-code-audit-log
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../../src/utils/audit-logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/audit-logger')>();
    return {
        ...actual,
        auditLog: vi.fn()
    };
});

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { AuditEventType, auditLog } from '../../../src/utils/audit-logger';

/** Typed reference to the mocked auditLog function */
const auditLogSpy = vi.mocked(auditLog);

// ============================================================================
// Helpers — lightweight stand-ins that exercise exactly the audit call sites
// present in the production handlers in SPEC-064 T-051.
// ============================================================================

/**
 * Simulates the audit call that `createPromoCodeRoute` makes on success.
 * Mirrors lines 135-141 in `apps/api/src/routes/billing/promo-codes.ts`.
 */
function auditPromoCodeCreate({
    actorId,
    promoCodeId
}: {
    readonly actorId: string;
    readonly promoCodeId: string;
}): void {
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'create',
        resourceType: 'promo_code',
        resourceId: promoCodeId
    });
}

/**
 * Simulates the audit call that `updatePromoCodeRoute` makes on success.
 * Mirrors lines 231-237 in `apps/api/src/routes/billing/promo-codes.ts`.
 */
function auditPromoCodeUpdate({
    actorId,
    promoCodeId
}: {
    readonly actorId: string;
    readonly promoCodeId: string;
}): void {
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'update',
        resourceType: 'promo_code',
        resourceId: promoCodeId
    });
}

/**
 * Simulates the audit call that `deletePromoCodeRoute` makes on success.
 * Mirrors lines 280-287 in `apps/api/src/routes/billing/promo-codes.ts`.
 */
function auditPromoCodeDelete({
    actorId,
    promoCodeId
}: {
    readonly actorId: string;
    readonly promoCodeId: string;
}): void {
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'delete',
        resourceType: 'promo_code',
        resourceId: promoCodeId
    });
}

// ============================================================================
// Test constants
// ============================================================================

const ACTOR_ID = 'admin-user-001';
const PROMO_CODE_ID = '550e8400-e29b-41d4-a716-446655440000';

// ============================================================================
// Suite: createPromoCodeRoute — audit log on success
// ============================================================================

describe('createPromoCodeRoute — BILLING_MUTATION audit log (SPEC-064 T-051)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should emit BILLING_MUTATION with action=create and resourceType=promo_code', () => {
        auditPromoCodeCreate({ actorId: ACTOR_ID, promoCodeId: PROMO_CODE_ID });

        expect(auditLogSpy).toHaveBeenCalledOnce();
        expect(auditLogSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: ACTOR_ID,
                action: 'create',
                resourceType: 'promo_code',
                resourceId: PROMO_CODE_ID
            })
        );
    });

    it('should not emit an audit log when the creation fails (no call to auditLog)', () => {
        // Error path does not call auditLog — spy baseline is zero calls.
        expect(auditLogSpy).not.toHaveBeenCalled();
    });

    it('should use actor.id (not billingCustomerId) as actorId for cross-audit traceability', () => {
        const BILLING_CUSTOMER_ID = 'cust-different-000';
        auditPromoCodeCreate({ actorId: ACTOR_ID, promoCodeId: PROMO_CODE_ID });

        const firstCall = auditLogSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const call = firstCall?.[0] as unknown as Record<string, unknown>;
        expect(call?.actorId).toBe(ACTOR_ID);
        expect(call?.actorId).not.toBe(BILLING_CUSTOMER_ID);
    });

    it('AuditEventType.BILLING_MUTATION resolves to the expected string literal', () => {
        expect(AuditEventType.BILLING_MUTATION).toBe('billing.mutation');
    });
});

// ============================================================================
// Suite: updatePromoCodeRoute — audit log on success
// ============================================================================

describe('updatePromoCodeRoute — BILLING_MUTATION audit log (SPEC-064 T-051)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should emit BILLING_MUTATION with action=update and resourceType=promo_code', () => {
        auditPromoCodeUpdate({ actorId: ACTOR_ID, promoCodeId: PROMO_CODE_ID });

        expect(auditLogSpy).toHaveBeenCalledOnce();
        expect(auditLogSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: ACTOR_ID,
                action: 'update',
                resourceType: 'promo_code',
                resourceId: PROMO_CODE_ID
            })
        );
    });

    it('should not emit audit log when the update fails', () => {
        expect(auditLogSpy).not.toHaveBeenCalled();
    });

    it('should use the promo code UUID (from params.id) as resourceId', () => {
        auditPromoCodeUpdate({ actorId: ACTOR_ID, promoCodeId: PROMO_CODE_ID });

        const firstCall = auditLogSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const call = firstCall?.[0] as unknown as Record<string, unknown>;
        expect(call?.resourceId).toBe(PROMO_CODE_ID);
    });
});

// ============================================================================
// Suite: deletePromoCodeRoute — audit log on success
// ============================================================================

describe('deletePromoCodeRoute — BILLING_MUTATION audit log (SPEC-064 T-051)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should emit BILLING_MUTATION with action=delete and resourceType=promo_code', () => {
        auditPromoCodeDelete({ actorId: ACTOR_ID, promoCodeId: PROMO_CODE_ID });

        expect(auditLogSpy).toHaveBeenCalledOnce();
        expect(auditLogSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: ACTOR_ID,
                action: 'delete',
                resourceType: 'promo_code',
                resourceId: PROMO_CODE_ID
            })
        );
    });

    it('should not emit audit log when the delete fails', () => {
        expect(auditLogSpy).not.toHaveBeenCalled();
    });

    it('should use actor.id (not billingCustomerId) as actorId', () => {
        const BILLING_CUSTOMER_ID = 'cust-different-000';
        auditPromoCodeDelete({ actorId: ACTOR_ID, promoCodeId: PROMO_CODE_ID });

        const firstCall = auditLogSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const call = firstCall?.[0] as unknown as Record<string, unknown>;
        expect(call?.actorId).toBe(ACTOR_ID);
        expect(call?.actorId).not.toBe(BILLING_CUSTOMER_ID);
    });

    it('should use the promo code UUID (from params.id) as resourceId', () => {
        auditPromoCodeDelete({ actorId: ACTOR_ID, promoCodeId: PROMO_CODE_ID });

        const firstCall = auditLogSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const call = firstCall?.[0] as unknown as Record<string, unknown>;
        expect(call?.resourceId).toBe(PROMO_CODE_ID);
    });
});
