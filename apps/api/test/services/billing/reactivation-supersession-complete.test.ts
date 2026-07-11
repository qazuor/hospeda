/**
 * Unit tests for the shared "complete one reactivation supersession pairing"
 * step (HOS-114 T-015a/T-016, second adversarial-review pass).
 *
 * Covers:
 * - Idempotency: an existing audit row for the pairing skips everything else.
 * - Superseded row not found: skipped, no cancel call.
 * - No `mpSubscriptionId` (trial-reactivation flow, superseded sub never had
 *   a real preapproval) — re-verify falls back to `billing.subscriptions.get()`
 *   (local storage), which is safe there because there is no live preapproval
 *   to leak money through.
 * - `mpSubscriptionId` present (lapsed-reactivation flow, superseded sub once
 *   had a real preapproval) — re-verify goes through
 *   `paymentAdapter.subscriptions.retrieve()` (the PROVIDER), never the local
 *   row, so a "live-preapproval-but-locally-canceled" sub is genuinely
 *   reconciled instead of trusting a stale local read.
 * - Terminal ALLOW-list: only `canceled`/`cancelled`/`incomplete_expired`/
 *   `finished`/`expired` count as confirmed-terminal. `paused`, `past_due`,
 *   `pending`, and unknown/unresolved statuses must NOT write the audit row.
 * - The provider `retrieve()` call itself throwing is treated as unresolved
 *   (conservative — never falsely marks a pairing done).
 * - Unexpected errors (e.g. the audit insert throwing) are caught and
 *   reported as `'error'`, never propagate.
 *
 * @module test/services/billing/reactivation-supersession-complete
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPostHogClient } from '../../../src/lib/posthog.js';
import { completeSupersessionPairing } from '../../../src/services/billing/reactivation-supersession-complete';
import { resolveOwnerUserId } from '../../../src/services/subscription-pause.service.js';

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// HOS-130: analytics deps. Default `getPostHogClient` → null so EVERY existing
// test (which never opts into analytics) skips the new capture block entirely,
// exactly as when PostHog is unconfigured in prod. The HOS-130 describe below
// overrides this to a fake client per-test.
vi.mock('../../../src/lib/posthog.js', () => ({
    getPostHogClient: vi.fn(() => null)
}));

vi.mock('../../../src/services/subscription-pause.service.js', () => ({
    resolveOwnerUserId: vi.fn()
}));

/**
 * A minimal Drizzle-like `db` fake supporting the two sequential
 * `.select().from().where().limit()` calls `completeSupersessionPairing`
 * issues (idempotency check, then the superseded-row lookup) and one
 * `.insert().values().onConflictDoNothing()` call — the trailing
 * `onConflictDoNothing()` is the atomic backstop against the partial
 * unique index added in
 * `packages/db/src/migrations/extras/029-hos114-supersession-audit-unique.index.sql`.
 */
function makeDbFake(
    options: {
        existingAuditRows?: unknown[];
        supersededRows?: unknown[];
        // HOS-130: rows returned by the 3rd SELECT (new sub `billingInterval`),
        // issued only when the trial-conversion analytics block runs.
        newSubRows?: unknown[];
        insertShouldFail?: boolean;
    } = {}
) {
    const {
        existingAuditRows = [],
        supersededRows = [],
        newSubRows = [],
        insertShouldFail = false
    } = options;
    const selectResultsInOrder = [existingAuditRows, supersededRows, newSubRows];
    let callIndex = 0;

    const select = vi.fn().mockImplementation(() => {
        const rows = selectResultsInOrder[callIndex] ?? [];
        callIndex++;
        return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue(rows)
        };
    });

    const onConflictDoNothing = insertShouldFail
        ? vi.fn().mockRejectedValue(new Error('audit insert failed'))
        : vi.fn().mockResolvedValue(undefined);
    const insertValues = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    return { select, insert, insertValues, onConflictDoNothing };
}

const NEW_SUBSCRIPTION = { id: 'sub-new-001', customerId: 'cust-001', planId: 'plan-001' };
const SUPERSEDED_ID = 'sub-old-001';
const MP_SUBSCRIPTION_ID = 'mp-preapproval-old-001';

describe('completeSupersessionPairing', () => {
    let mockCancel: ReturnType<typeof vi.fn>;
    let mockGet: ReturnType<typeof vi.fn>;
    let mockRetrieve: ReturnType<typeof vi.fn>;
    let billing: {
        subscriptions: { cancel: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    };
    let paymentAdapter: { subscriptions: { retrieve: ReturnType<typeof vi.fn> } };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCancel = vi.fn().mockResolvedValue(undefined);
        mockGet = vi.fn();
        mockRetrieve = vi.fn();
        billing = { subscriptions: { cancel: mockCancel, get: mockGet } };
        paymentAdapter = { subscriptions: { retrieve: mockRetrieve } };
    });

    describe('idempotency', () => {
        it('returns "already-audited" and never calls cancel when an audit row already exists', async () => {
            const db = makeDbFake({ existingAuditRows: [{ id: 'existing-evt' }] });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-001',
                source: 'webhook'
            });

            expect(outcome).toBe('already-audited');
            expect(mockCancel).not.toHaveBeenCalled();
            expect(mockGet).not.toHaveBeenCalled();
            expect(mockRetrieve).not.toHaveBeenCalled();
            expect(db.insert).not.toHaveBeenCalled();
        });
    });

    describe('superseded row not found', () => {
        it('returns "superseded-not-found" and never calls cancel', async () => {
            const db = makeDbFake({ existingAuditRows: [], supersededRows: [] });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-002',
                source: 'webhook'
            });

            expect(outcome).toBe('superseded-not-found');
            expect(mockCancel).not.toHaveBeenCalled();
            expect(db.insert).not.toHaveBeenCalled();
        });
    });

    describe('no mpSubscriptionId (trial-reactivation flow — never had a real preapproval)', () => {
        it('re-verifies via billing.subscriptions.get() (local) and writes the audit row when confirmed cancelled', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [{ id: SUPERSEDED_ID, status: 'trialing', mpSubscriptionId: null }]
            });
            mockGet.mockResolvedValue({ id: SUPERSEDED_ID, status: 'canceled' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-003',
                source: 'webhook'
            });

            expect(outcome).toBe('completed');
            expect(mockCancel).toHaveBeenCalledWith(SUPERSEDED_ID);
            expect(mockGet).toHaveBeenCalledWith(SUPERSEDED_ID);
            // No mpSubscriptionId — the provider must never be consulted.
            expect(mockRetrieve).not.toHaveBeenCalled();
            expect(db.insertValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: NEW_SUBSCRIPTION.id,
                    previousStatus: SubscriptionStatusEnum.TRIALING,
                    newStatus: SubscriptionStatusEnum.ACTIVE,
                    triggerSource: 'trial-reactivation',
                    providerEventId: 'evt-003',
                    metadata: expect.objectContaining({
                        supersededSubscriptionId: SUPERSEDED_ID,
                        convertedFromTrial: 'true'
                    })
                })
            );
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });

        it('does NOT write the audit row when the local re-verify still shows trialing', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [{ id: SUPERSEDED_ID, status: 'trialing', mpSubscriptionId: null }]
            });
            mockCancel.mockRejectedValue(new Error('unexpected'));
            mockGet.mockResolvedValue({ id: SUPERSEDED_ID, status: 'trialing' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-004',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });
    });

    describe('mpSubscriptionId present (lapsed-reactivation flow — once had a real preapproval)', () => {
        it('re-verifies via the PROVIDER (paymentAdapter.subscriptions.retrieve), NOT the local row', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'canceled', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            // The lapsed flow's expected outcome: cancel() throws "already
            // cancelled" (harmless), and the PROVIDER confirms terminal.
            mockCancel.mockRejectedValue(new Error('Subscription already cancelled'));
            mockRetrieve.mockResolvedValue({ status: 'canceled' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-005',
                source: 'webhook'
            });

            expect(outcome).toBe('completed');
            expect(mockRetrieve).toHaveBeenCalledWith(MP_SUBSCRIPTION_ID);
            // The local billing.get() must NEVER be consulted when a provider
            // mapping exists — that was the exact bug this fix corrects.
            expect(mockGet).not.toHaveBeenCalled();
            expect(db.insertValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    previousStatus: SubscriptionStatusEnum.CANCELLED,
                    triggerSource: 'subscription-reactivation',
                    metadata: expect.objectContaining({ reactivatedFromCanceled: 'true' })
                })
            );
        });

        it('REGRESSION (blocker): does NOT write the audit row when the local status is already "canceled" but the PROVIDER still reports the preapproval live', async () => {
            // This is the exact scenario the second adversarial review
            // flagged: `billing.subscriptions.get()` alone would have read
            // the LOCAL 'canceled' status and falsely concluded
            // confirmed-terminal, masking a still-live MercadoPago
            // preapproval that can keep charging the customer.
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'canceled', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            mockCancel.mockRejectedValue(new Error('MercadoPago 503'));
            // Provider truth: still active, despite the stale local row.
            mockRetrieve.mockResolvedValue({ status: 'active' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-006',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        it('treats a failed provider retrieve() as unresolved (conservative — never falsely marks done)', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'canceled', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            mockRetrieve.mockRejectedValue(new Error('MP network timeout'));

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-007',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
        });
    });

    describe('MEDIUM fix: terminal ALLOW-list (paused/past_due/unknown must NOT be treated as terminal)', () => {
        it.each([
            ['paused', 'active preapproval merely paused — can resume and charge'],
            ['past_due', 'payment failing but preapproval still live — can recover and charge'],
            ['pending', 'not yet resolved at the provider'],
            ['some-unrecognized-status', 'unknown status — never assume terminal']
        ])('does NOT write the audit row when the re-verified status is "%s" (%s)', async (status) => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'active', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            mockRetrieve.mockResolvedValue({ status });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-008',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        it.each([
            'canceled',
            'cancelled',
            'incomplete_expired',
            'finished',
            'expired'
        ])('DOES write the audit row when the re-verified status is the known-terminal "%s"', async (status) => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    {
                        id: SUPERSEDED_ID,
                        status: 'active',
                        mpSubscriptionId: MP_SUBSCRIPTION_ID
                    }
                ]
            });
            mockRetrieve.mockResolvedValue({ status });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-009',
                source: 'webhook'
            });

            expect(outcome).toBe('completed');
            expect(db.insertValues).toHaveBeenCalledOnce();
        });
    });

    describe('unexpected errors', () => {
        it('returns "error" and never throws when the audit insert itself fails', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [{ id: SUPERSEDED_ID, status: 'trialing', mpSubscriptionId: null }],
                insertShouldFail: true
            });
            mockGet.mockResolvedValue({ id: SUPERSEDED_ID, status: 'canceled' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-010',
                source: 'webhook'
            });

            expect(outcome).toBe('error');
            expect(Sentry.captureException).toHaveBeenCalled();
        });
    });

    // ── HOS-130: trial→paid conversion analytics event ─────────────────────
    describe('HOS-130: trial_converted_to_paid analytics event', () => {
        let mockCapture: ReturnType<typeof vi.fn>;
        let mockPlansGet: ReturnType<typeof vi.fn>;

        // A plan carrying BOTH an active monthly and an active annual price, so
        // `convertedInterval` is driven by the NEW sub's billing_interval, not
        // by the plan (which cannot disambiguate on its own).
        const PLAN = {
            id: 'plan-001',
            name: 'host-pro',
            prices: [
                {
                    active: true,
                    billingInterval: 'month',
                    intervalCount: 1,
                    unitAmount: 500_000, // centavos → 5000 major
                    currency: 'ARS'
                },
                {
                    active: true,
                    billingInterval: 'year',
                    intervalCount: 1,
                    unitAmount: 5_000_000, // centavos → 50000 major
                    currency: 'ARS'
                }
            ]
        };

        beforeEach(() => {
            mockCapture = vi.fn();
            vi.mocked(getPostHogClient).mockReturnValue({ capture: mockCapture } as never);
            mockPlansGet = vi.fn().mockResolvedValue(PLAN);
            (billing as { plans?: unknown }).plans = { get: mockPlansGet };
            vi.mocked(resolveOwnerUserId).mockResolvedValue('user-owner-001');
            // The superseded trial sub has no preapproval → Step 4 re-verifies
            // via local get(); return terminal so the flow reaches 'completed'.
            mockGet.mockResolvedValue({ id: SUPERSEDED_ID, status: 'canceled' });
        });

        /** A trial superseded row carrying the given metadata. */
        function makeTrialConversionDb(opts: {
            supersededMetadata?: Record<string, unknown>;
            newSubBillingInterval?: string | null;
        }) {
            return makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    {
                        id: SUPERSEDED_ID,
                        status: 'trialing',
                        mpSubscriptionId: null,
                        metadata: opts.supersededMetadata ?? {}
                    }
                ],
                newSubRows: [{ billingInterval: opts.newSubBillingInterval ?? 'year' }]
            });
        }

        const callTrialConversion = (db: unknown) =>
            completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-hos130',
                source: 'webhook'
            });

        it('AC-1: annual trial → annual paid emits the event with both intervals annual', async () => {
            const db = makeTrialConversionDb({
                supersededMetadata: { intendedInterval: 'annual' },
                newSubBillingInterval: 'year'
            });

            const outcome = await callTrialConversion(db);

            expect(outcome).toBe('completed');
            expect(mockCapture).toHaveBeenCalledWith(
                expect.objectContaining({
                    distinctId: 'user-owner-001',
                    event: 'trial_converted_to_paid',
                    properties: expect.objectContaining({
                        intendedInterval: 'annual',
                        convertedInterval: 'annual',
                        planSlug: 'host-pro',
                        amount: 50_000, // 5_000_000 centavos in major units
                        currency: 'ARS',
                        supersededSubscriptionId: SUPERSEDED_ID,
                        newSubscriptionId: NEW_SUBSCRIPTION.id,
                        triggerSource: 'trial-reactivation',
                        $set: { converted_from_trial: true, last_conversion_interval: 'annual' }
                    })
                })
            );
        });

        it('AC-2: annual trial → monthly paid captures the interval switch (intended annual, converted monthly)', async () => {
            const db = makeTrialConversionDb({
                supersededMetadata: { intendedInterval: 'annual' },
                newSubBillingInterval: 'month'
            });

            const outcome = await callTrialConversion(db);

            expect(outcome).toBe('completed');
            expect(mockCapture).toHaveBeenCalledWith(
                expect.objectContaining({
                    properties: expect.objectContaining({
                        intendedInterval: 'annual',
                        convertedInterval: 'monthly',
                        amount: 5_000, // monthly price in major units
                        currency: 'ARS'
                    })
                })
            );
        });

        it('AC-3: stitch keys — supersededSubscriptionId, newSubscriptionId, distinctId', async () => {
            const db = makeTrialConversionDb({
                supersededMetadata: { intendedInterval: 'monthly' },
                newSubBillingInterval: 'month'
            });

            await callTrialConversion(db);

            const props = mockCapture.mock.calls[0]?.[0]?.properties;
            expect(props.supersededSubscriptionId).toBe(SUPERSEDED_ID);
            expect(props.newSubscriptionId).toBe(NEW_SUBSCRIPTION.id);
            expect(mockCapture.mock.calls[0]?.[0]?.distinctId).toBe('user-owner-001');
        });

        it('AC-4: an already-audited pairing (idempotent re-delivery) emits NO event', async () => {
            // Exactly-once: a webhook redelivery / cron re-run of a pairing that
            // was already audited returns 'already-audited' at Step 1, long
            // before the capture block — so the event can never double-fire.
            const db = makeDbFake({ existingAuditRows: [{ id: 'existing-evt' }] });

            const outcome = await callTrialConversion(db);

            expect(outcome).toBe('already-audited');
            expect(mockCapture).not.toHaveBeenCalled();
        });

        it('falls back to the billing customer id as distinctId when the owner user cannot be resolved', async () => {
            vi.mocked(resolveOwnerUserId).mockResolvedValue(null);
            const db = makeTrialConversionDb({
                supersededMetadata: { intendedInterval: 'annual' }
            });

            await callTrialConversion(db);

            expect(mockCapture.mock.calls[0]?.[0]?.distinctId).toBe(NEW_SUBSCRIPTION.customerId);
        });

        it('AC-5: a lapsed-subscription reactivation (subscription-reactivation) emits NO event', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'canceled', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            mockRetrieve.mockResolvedValue({ status: 'canceled' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-hos130-lapsed',
                source: 'webhook'
            });

            expect(outcome).toBe('completed');
            expect(mockCapture).not.toHaveBeenCalled();
        });

        it('AC-7: absent intendedInterval and a failed plan lookup degrade to null props (never throw)', async () => {
            mockPlansGet.mockRejectedValue(new Error('plan lookup down'));
            const db = makeTrialConversionDb({
                supersededMetadata: {}, // no intendedInterval
                newSubBillingInterval: 'year'
            });

            const outcome = await callTrialConversion(db);

            expect(outcome).toBe('completed');
            expect(mockCapture).toHaveBeenCalledWith(
                expect.objectContaining({
                    properties: expect.objectContaining({
                        intendedInterval: null,
                        convertedInterval: 'annual', // still known from the new sub row
                        planSlug: null,
                        amount: null,
                        currency: null
                    })
                })
            );
        });

        it('nulls amount/currency (never falls back to the monthly price) when the converted interval is unresolvable', async () => {
            // New-sub SELECT returns no row → convertedInterval null → the price
            // lookup must be skipped, not silently matched against the monthly
            // price (which would emit a wrong amount for an annual conversion).
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    {
                        id: SUPERSEDED_ID,
                        status: 'trialing',
                        mpSubscriptionId: null,
                        metadata: { intendedInterval: 'annual' }
                    }
                ],
                newSubRows: []
            });

            const outcome = await callTrialConversion(db);

            expect(outcome).toBe('completed');
            const props = mockCapture.mock.calls[0]?.[0]?.properties;
            expect(props.convertedInterval).toBeNull();
            // The monthly price must NOT have leaked in despite the plan having one.
            expect(props.amount).toBeNull();
            expect(props.currency).toBeNull();
            expect(props.$set.last_conversion_interval).toBeNull();
        });

        it('AC-8: a throwing PostHog capture never blocks the supersession (still "completed")', async () => {
            mockCapture.mockImplementation(() => {
                throw new Error('posthog transport failed');
            });
            const db = makeTrialConversionDb({
                supersededMetadata: { intendedInterval: 'annual' }
            });

            const outcome = await callTrialConversion(db);

            expect(outcome).toBe('completed');
        });

        it('emits nothing (and skips the plan lookup) when PostHog is unconfigured', async () => {
            vi.mocked(getPostHogClient).mockReturnValue(null);
            const db = makeTrialConversionDb({
                supersededMetadata: { intendedInterval: 'annual' }
            });

            const outcome = await callTrialConversion(db);

            expect(outcome).toBe('completed');
            expect(mockCapture).not.toHaveBeenCalled();
            expect(mockPlansGet).not.toHaveBeenCalled();
        });
    });
});
