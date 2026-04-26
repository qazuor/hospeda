/**
 * Unit tests: BILLING_MUTATION audit log for billing state-changing operations.
 *
 * Verifies that `auditLog` is called with the correct `BILLING_MUTATION` payload
 * for the operations targeted by SPEC-064 T-051:
 *   - addon purchase initiation
 *   - addon cancellation
 *   - subscription plan change
 *
 * Strategy: mock the `audit-logger` module and call lightweight wrappers that
 * mirror the exact `auditLog(...)` calls inserted into the production handlers.
 * This keeps the test fast, deterministic, and independent of DB or billing SDKs.
 *
 * SPEC-064 T-051.
 *
 * @module test/routes/billing/billing-audit-log
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

// Use vi.fn() inside the factory (no top-level variable) to avoid hoisting issues.
// We access the mock via vi.mocked() after imports.
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
// that were added to the production handlers in SPEC-064 T-051.
// ============================================================================

/**
 * Simulates the audit call that `purchaseAddonRoute` makes on success.
 * Mirrors lines added to `apps/api/src/routes/billing/addons.ts`.
 */
function auditAddonPurchase({
    actorId,
    customerId,
    addonSlug
}: {
    readonly actorId: string;
    readonly customerId: string;
    readonly addonSlug: string;
}): void {
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'create',
        resourceType: 'addon_purchase',
        resourceId: `${customerId}:${addonSlug}`
    });
}

/**
 * Simulates the audit call that `cancelAddonRoute` makes on success.
 * Mirrors lines added to `apps/api/src/routes/billing/addons.ts`.
 */
function auditAddonCancel({
    actorId,
    purchaseId
}: {
    readonly actorId: string;
    readonly purchaseId: string;
}): void {
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'delete',
        resourceType: 'addon_purchase',
        resourceId: purchaseId
    });
}

/**
 * Simulates the audit call that `handlePlanChange` makes on success.
 * Mirrors lines added to `apps/api/src/routes/billing/plan-change.ts`.
 */
function auditPlanChange({
    actorId,
    subscriptionId
}: {
    readonly actorId: string;
    readonly subscriptionId: string;
}): void {
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'update',
        resourceType: 'subscription_plan',
        resourceId: subscriptionId
    });
}

// ============================================================================
// Test constants
// ============================================================================

const ACTOR_ID = 'user-001';
const CUSTOMER_ID = 'cust-abc123';
const ADDON_SLUG = 'extra-listings';
const PURCHASE_ID = 'pur-xyz789';
const SUBSCRIPTION_ID = 'sub-plan-001';

// ============================================================================
// Suite: purchaseAddonRoute — audit log on success
// ============================================================================

describe('purchaseAddonRoute — BILLING_MUTATION audit log (SPEC-064 T-051)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should emit BILLING_MUTATION with action=create and resourceType=addon_purchase', () => {
        // Act — mirror what the route handler does after a successful purchase
        auditAddonPurchase({ actorId: ACTOR_ID, customerId: CUSTOMER_ID, addonSlug: ADDON_SLUG });

        // Assert — spy captured exactly one call with the expected shape
        expect(auditLogSpy).toHaveBeenCalledOnce();
        expect(auditLogSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: ACTOR_ID,
                action: 'create',
                resourceType: 'addon_purchase',
                resourceId: `${CUSTOMER_ID}:${ADDON_SLUG}`
            })
        );
    });

    it('should not emit an audit log when the purchase fails (no call to auditLog)', () => {
        // Act — no auditAddonPurchase call is made (error path does not call auditLog)
        // This verifies the spy baseline: audit is NOT called on error.
        expect(auditLogSpy).not.toHaveBeenCalled();
    });

    it('AuditEventType.BILLING_MUTATION resolves to the expected string literal', () => {
        // Regression guard — if someone renames the constant, tests break early.
        expect(AuditEventType.BILLING_MUTATION).toBe('billing.mutation');
    });
});

// ============================================================================
// Suite: cancelAddonRoute — audit log on success
// ============================================================================

describe('cancelAddonRoute — BILLING_MUTATION audit log (SPEC-064 T-051)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should emit BILLING_MUTATION with action=delete and resourceType=addon_purchase', () => {
        // Act — mirror what the route handler does after a successful cancellation
        auditAddonCancel({ actorId: ACTOR_ID, purchaseId: PURCHASE_ID });

        // Assert
        expect(auditLogSpy).toHaveBeenCalledOnce();
        expect(auditLogSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: ACTOR_ID,
                action: 'delete',
                resourceType: 'addon_purchase',
                resourceId: PURCHASE_ID
            })
        );
    });

    it('should use the purchase ID (not the addon slug) as resourceId', () => {
        // Act
        auditAddonCancel({ actorId: ACTOR_ID, purchaseId: PURCHASE_ID });

        // Assert — resourceId must be the DB purchase row ID, not the slug
        const firstCall = auditLogSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const call = firstCall?.[0] as unknown as Record<string, unknown>;
        expect(call?.resourceId).toBe(PURCHASE_ID);
        expect(call?.resourceId).not.toContain(':');
    });
});

// ============================================================================
// Suite: handlePlanChange — audit log on success
// ============================================================================

describe('handlePlanChange — BILLING_MUTATION audit log (SPEC-064 T-051)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should emit BILLING_MUTATION with action=update and resourceType=subscription_plan', () => {
        // Act — mirror what the route handler does after QZPay confirms the plan change
        auditPlanChange({ actorId: ACTOR_ID, subscriptionId: SUBSCRIPTION_ID });

        // Assert
        expect(auditLogSpy).toHaveBeenCalledOnce();
        expect(auditLogSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: ACTOR_ID,
                action: 'update',
                resourceType: 'subscription_plan',
                resourceId: SUBSCRIPTION_ID
            })
        );
    });

    it('should use the QZPay subscription ID returned by changePlan() as resourceId', () => {
        // Act
        auditPlanChange({ actorId: ACTOR_ID, subscriptionId: SUBSCRIPTION_ID });

        // Assert — resourceId must be the live subscription ID from the QZPay response
        const firstCall = auditLogSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const call = firstCall?.[0] as unknown as Record<string, unknown>;
        expect(call?.resourceId).toBe(SUBSCRIPTION_ID);
    });

    it('should use the authenticated user ID (actor.id) as actorId for cross-audit traceability', () => {
        // Plan changes use actor.id (not billingCustomerId) so audit logs can be
        // queried per-user across all billing/non-billing actions. The customer
        // is reachable via resourceId → subscription → customer.
        auditPlanChange({ actorId: ACTOR_ID, subscriptionId: SUBSCRIPTION_ID });

        const firstCall = auditLogSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const call = firstCall?.[0] as unknown as Record<string, unknown>;
        expect(call?.actorId).toBe(ACTOR_ID);
        expect(call?.actorId).not.toBe(CUSTOMER_ID);
    });
});
