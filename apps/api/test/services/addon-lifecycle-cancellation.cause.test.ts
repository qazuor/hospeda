/**
 * `handleSubscriptionCancellationAddons` and WHY the plan was cancelled
 * (HOS-847 PR 7a — owner decision, 2026-09-07).
 *
 * ## The bug these tests reproduce
 *
 * A recurring add-on has a MercadoPago preapproval of its own, with a cycle of
 * its own, so the plan's period and the add-on's do not line up. Before this
 * change the handler revoked every `status = 'active'` purchase the moment the
 * PLAN was cancelled, without ever looking at the add-on's own
 * `current_period_end`. A plan ending on the 10th over an add-on charged on the
 * 25th took fifteen days the customer had already paid for.
 *
 * The rule is now: the add-on lives until ITS OWN `current_period_end`. Two
 * causes still revoke on the spot — non-payment (nothing was collected) and a
 * deliberate admin lever (an operational action has to bite immediately).
 *
 * ## The undecided third case, pinned rather than guessed
 *
 * The MercadoPago webhook cannot tell "they cancelled" from "they stopped
 * paying" — see the comment at its call site. That is `'unknown'`, and its
 * handling lives in ONE constant. The test below pins today's behaviour to that
 * constant so the owner's answer is a one-line change with a failing test
 * attached, rather than a silent policy shift.
 *
 * @module test/services/addon-lifecycle-cancellation.cause
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCatalogGetBySlug, mockClose, mockRevoke, mockSoftCancel, envStub } = vi.hoisted(() => ({
    mockCatalogGetBySlug: vi.fn(),
    mockClose: vi.fn(),
    mockRevoke: vi.fn(),
    mockSoftCancel: vi.fn(),
    envStub: { HOSPEDA_ADDON_LIFECYCLE_ENABLED: true }
}));

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(function () {
        return { getBySlug: mockCatalogGetBySlug, list: vi.fn() };
    }),
    PlanService: vi.fn().mockImplementation(function () {
        return { getById: vi.fn(), getBySlug: vi.fn() };
    }),
    BILLING_EVENT_TYPES: { ADDON_REVOCATION_FAILED: 'ADDON_REVOCATION_FAILED' }
}));

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(
        async (callback: (tx: unknown) => Promise<unknown>, existingTx?: unknown) =>
            callback(existingTx)
    ),
    billingSubscriptionEvents: {
        subscriptionId: 'subscription_id',
        eventType: 'event_type',
        triggerSource: 'trigger_source',
        metadata: 'metadata'
    }
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        mpSubscriptionId: 'mp_subscription_id',
        currentPeriodEnd: 'current_period_end',
        cancelAtPeriodEnd: 'cancel_at_period_end',
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
        metadata: 'metadata',
        updatedAt: 'updated_at'
    }
}));

vi.mock('../../src/middlewares/entitlement', () => ({ clearEntitlementCache: vi.fn() }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({ env: envStub }));

vi.mock('../../src/services/addon-lifecycle.service', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/services/addon-lifecycle.service')>()),
    revokeAddonForSubscriptionCancellation: mockRevoke
}));

vi.mock('../../src/services/addon-preapproval-cancel', () => ({
    closeAddonPreapproval: mockClose
}));

// Partial, not a whole-module literal: a second export added to this module
// later must not silently become `undefined` inside the handler's try/catch
// (HOS-702).
vi.mock('../../src/services/addon-soft-cancel', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/services/addon-soft-cancel')>()),
    softCancelRecurringAddon: mockSoftCancel
}));

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

import {
    causeHonoursPaidPeriod,
    handleSubscriptionCancellationAddons,
    UNKNOWN_CANCELLATION_CAUSE_POLICY
} from '../../src/services/addon-lifecycle-cancellation.service.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = 'sub_plan_hos847_7a';
const CUSTOMER_ID = 'cus_hos847_7a';
const PREAPPROVAL_ID = 'preapproval-of-the-addon';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fifteen days of a period the customer has already been charged for. */
const paidPeriodStillRunning = () => new Date(Date.now() + 15 * DAY_MS);
/** The same add-on, a day after its period ran out. */
const paidPeriodElapsed = () => new Date(Date.now() - DAY_MS);

/**
 * Builds the purchase row the handler's `SELECT *` returns.
 *
 * @param currentPeriodEnd - The add-on's own period end (`null` for one-time).
 * @returns A purchase row fixture.
 */
function recurringPurchase(currentPeriodEnd: Date | null) {
    return {
        id: 'purch_7a01-0002-0003-0004-000000000001',
        addonSlug: 'extra-accommodations-20',
        subscriptionId: SUBSCRIPTION_ID,
        customerId: CUSTOMER_ID,
        status: 'active' as const,
        mpSubscriptionId: currentPeriodEnd ? PREAPPROVAL_ID : null,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        metadata: {},
        deletedAt: null
    };
}

/**
 * Minimal Drizzle fluent-builder stub. `select().from().where()` resolves the
 * rows; `update().set().where()` records the payload.
 *
 * @param rows - Rows the SELECT should return.
 * @returns The stub plus handles on the recorded `set()` payloads.
 */
function createMockDb(rows: unknown[]) {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn<(payload: Record<string, unknown>) => { where: typeof updateWhere }>(
        () => ({ where: updateWhere })
    );
    const update = vi.fn(() => ({ set: updateSet }));
    const selectWhere = vi.fn().mockResolvedValue(rows);
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) }));
    const insertValues = vi.fn().mockResolvedValue(undefined);

    return {
        select,
        update,
        insert: vi.fn(() => ({ values: insertValues })),
        _updateSet: updateSet,
        _insertValues: insertValues
    };
}

/** Every `set(...)` payload that made a purchase terminal. */
function terminalWrites(db: ReturnType<typeof createMockDb>): unknown[] {
    return db._updateSet.mock.calls
        .map(([payload]) => payload as Record<string, unknown> | undefined)
        .filter((payload) => payload?.status === 'canceled');
}

const billing = {} as QZPayBilling;

describe('handleSubscriptionCancellationAddons — the cancellation cause (HOS-847 PR 7a)', () => {
    beforeEach(() => {
        envStub.HOSPEDA_ADDON_LIFECYCLE_ENABLED = true;
        mockClose.mockResolvedValue({ closed: true, kind: 'cancelled' });
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: { slug: 'extra-accommodations-20', name: 'Extra accommodations', type: 'limit' }
        });
        mockRevoke.mockResolvedValue({
            purchaseId: recurringPurchase(null).id,
            addonSlug: 'extra-accommodations-20',
            addonType: 'limit' as const,
            outcome: 'success' as const
        });
        mockSoftCancel.mockResolvedValue({ success: true, data: undefined });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('a voluntary cancellation does not take back a period already charged', () => {
        it('keeps the add-on granted until its OWN current_period_end', async () => {
            const accessUntil = paidPeriodStillRunning();
            const db = createMockDb([recurringPurchase(accessUntil)]);

            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never,
                cause: 'voluntary'
            });

            // The benefit survives: nothing revoked, no terminal row written.
            expect(mockRevoke).not.toHaveBeenCalled();
            expect(terminalWrites(db)).toEqual([]);

            // And it is scheduled to end on the add-on's own date, not the plan's.
            expect(mockSoftCancel).toHaveBeenCalledTimes(1);
            expect(mockSoftCancel.mock.calls[0]?.[0]).toMatchObject({
                purchaseId: recurringPurchase(null).id,
                customerId: CUSTOMER_ID,
                addonSlug: 'extra-accommodations-20',
                addonName: 'Extra accommodations',
                currentPeriodEnd: accessUntil
            });

            expect(result.deferred).toEqual([
                {
                    purchaseId: recurringPurchase(null).id,
                    addonSlug: 'extra-accommodations-20',
                    accessUntil
                }
            ]);
            expect(result.succeeded).toEqual([]);
            expect(result.failed).toEqual([]);
        });

        it('still closes the MercadoPago preapproval first — charging stops today', async () => {
            const db = createMockDb([recurringPurchase(paidPeriodStillRunning())]);

            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never,
                cause: 'voluntary'
            });

            expect(mockClose).toHaveBeenCalledWith({
                purchase: expect.objectContaining({ mpSubscriptionId: PREAPPROVAL_ID }),
                source: 'plan-cancellation',
                billing
            });
        });

        it('CONTROL: the same add-on IS revoked once its own period has elapsed', async () => {
            // Without this control, a handler that deferred everything
            // unconditionally would satisfy the assertions above.
            const db = createMockDb([recurringPurchase(paidPeriodElapsed())]);

            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never,
                cause: 'voluntary'
            });

            expect(mockSoftCancel).not.toHaveBeenCalled();
            expect(mockRevoke).toHaveBeenCalledTimes(1);
            expect(terminalWrites(db)).toHaveLength(1);
            expect(result.deferred).toEqual([]);
            expect(result.succeeded).toHaveLength(1);
        });

        it('CONTROL: a one-time add-on (no period recorded) is revoked as before', async () => {
            const db = createMockDb([recurringPurchase(null)]);

            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never,
                cause: 'voluntary'
            });

            expect(mockSoftCancel).not.toHaveBeenCalled();
            expect(mockRevoke).toHaveBeenCalledTimes(1);
            expect(result.deferred).toEqual([]);
        });

        it('a refused soft-cancel is a FAILED purchase, so MercadoPago redelivers', async () => {
            const db = createMockDb([recurringPurchase(paidPeriodStillRunning())]);
            mockSoftCancel.mockResolvedValue({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'update blew up' }
            });

            await expect(
                handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing,
                    db: db as never,
                    cause: 'voluntary'
                })
            ).rejects.toThrow(/could not be revoked/);

            // Left `active`, never written terminal — the next redelivery retries it.
            expect(terminalWrites(db)).toEqual([]);
        });
    });

    describe('the two causes that revoke on the spot', () => {
        it.each([
            'non-payment',
            'admin-action'
        ] as const)('%s revokes even inside a period that was charged', async (cause) => {
            const db = createMockDb([recurringPurchase(paidPeriodStillRunning())]);

            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never,
                cause
            });

            expect(mockSoftCancel).not.toHaveBeenCalled();
            expect(mockRevoke).toHaveBeenCalledTimes(1);
            expect(terminalWrites(db)).toHaveLength(1);
            expect(result.deferred).toEqual([]);
        });
    });

    describe('the cause the webhook cannot know — pinned, not decided', () => {
        it('follows UNKNOWN_CANCELLATION_CAUSE_POLICY, which is still the pre-HOS-847 behaviour', async () => {
            // This assertion is deliberately written against the CONSTANT, not
            // against a hardcoded expectation: the day the owner answers, the
            // one-line flip makes this test describe the new policy instead of
            // failing for the wrong reason.
            const db = createMockDb([recurringPurchase(paidPeriodStillRunning())]);

            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never,
                cause: 'unknown'
            });

            if (UNKNOWN_CANCELLATION_CAUSE_POLICY === 'revoke-now') {
                expect(mockRevoke).toHaveBeenCalledTimes(1);
                expect(result.deferred).toEqual([]);
            } else {
                expect(mockSoftCancel).toHaveBeenCalledTimes(1);
                expect(result.deferred).toHaveLength(1);
            }
        });

        it('an omitted cause means `unknown`, never "honour the period"', async () => {
            // Every pre-existing call site (all of them tests) omits the field.
            // Omission must not become the permissive branch by accident.
            const db = createMockDb([recurringPurchase(paidPeriodStillRunning())]);

            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never
            });

            expect(mockSoftCancel).toHaveBeenCalledTimes(causeHonoursPaidPeriod('unknown') ? 1 : 0);
        });
    });

    describe('causeHonoursPaidPeriod', () => {
        it('honours the paid period for a voluntary cancellation only', () => {
            expect(causeHonoursPaidPeriod('voluntary')).toBe(true);
            expect(causeHonoursPaidPeriod('non-payment')).toBe(false);
            expect(causeHonoursPaidPeriod('admin-action')).toBe(false);
        });

        it('derives the unknown case from the policy constant', () => {
            expect(causeHonoursPaidPeriod('unknown')).toBe(
                UNKNOWN_CANCELLATION_CAUSE_POLICY === 'honour-paid-period'
            );
        });
    });
});
