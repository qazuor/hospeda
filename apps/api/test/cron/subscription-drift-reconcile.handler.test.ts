/**
 * Handler tests for the `subscription-drift-reconcile` cron (HOS-914).
 *
 * The predicate file next to this one pins WHICH rows are candidates. This file
 * pins what the tick DOES with them, and the three things that matter are the
 * three a reader cannot verify from the predicate alone:
 *
 * 1. **Nobody is cancelled because MercadoPago drew a blank.** The single worst
 *    outcome of this issue is cutting service to someone who paid. The test
 *    below hands the sweep a provider that answers 404 and asserts the adapter's
 *    `cancel`/`update` were never touched, the row was never written, and the
 *    tick reported FAILURE with the id named — escalation, not a verdict.
 * 2. **A transient failure is not the same report.** A 429 or an expired token
 *    makes every row unreadable; if that escalated, one bad token would page a
 *    human about the whole portfolio.
 * 3. **All five verticals, and the dual-owner account.** The sweep selects by
 *    ROW, never by customer, so an account that is both a host and a partner has
 *    both subscriptions reconciled instead of one of them being picked by a
 *    `.find()`.
 *
 * @module test/cron/subscription-drift-reconcile.handler
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';
import { markProviderReadFailure } from '../../src/routes/webhooks/mercadopago/provider-read-failure';

/** Rows the simulated candidate SELECT returns. */
let selectedRows: Array<Record<string, unknown>> = [];
/** Whether the advisory lock is granted. */
let lockAcquired = true;
/** What `getQZPayBilling()` hands the sweep (`null` = billing not configured). */
let billingInstance: unknown = { marker: 'billing' };

const processSubscriptionUpdatedMock = vi.fn();
const mpCancelSpy = vi.fn();
const mpUpdateSpy = vi.fn();
const sentryCaptureSpy = vi.fn();

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: () => billingInstance
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Partial mocks, both of them: a whole-module object literal leaves every other
// export `undefined`, and when the missing one is called inside a try/catch the
// phase silently does nothing while every assertion still passes (HOS-702).
// `billing-mock-must-be-partial.guard.test.ts` enforces this for @repo/billing;
// @repo/service-core is spread for the same reason rather than because a guard
// made us.
vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: () => ({
        subscriptions: {
            // Neither may ever be called by this job. Spied so the assertion is
            // "no write was attempted", not "no write was observed".
            cancel: mpCancelSpy,
            update: mpUpdateSpy
        }
    })
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    excludeAddonDomainCondition: () => 'exclude-addon'
}));

vi.mock('@sentry/node', () => ({
    captureException: sentryCaptureSpy
}));

vi.mock('../../src/services/billing/preapproval-recovery.service.js', () => ({
    // Real value is 350ms (measured). Zeroed here so the suite does not spend a
    // third of a second per row; the spacing itself is pinned by that module.
    MP_CALL_SPACING_MS: 0
}));

vi.mock('../../src/routes/webhooks/mercadopago/subscription-logic.js', () => ({
    processSubscriptionUpdated: (...args: unknown[]) => processSubscriptionUpdatedMock(...args)
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@repo/db');
    return {
        ...actual,
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id',
            status: 'status',
            mpSubscriptionId: 'mp_subscription_id',
            trialEnd: 'trial_end',
            cancelAtPeriodEnd: 'cancel_at_period_end',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at'
        },
        and: vi.fn(() => 'and'),
        eq: vi.fn(() => 'eq'),
        inArray: vi.fn(() => 'inArray'),
        isNotNull: vi.fn(() => 'isNotNull'),
        isNull: vi.fn(() => 'isNull'),
        sql: vi.fn(() => 'sql'),
        withTransaction: async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({
                execute: async () => ({ rows: [{ acquired: lockAcquired }] }),
                select: () => ({
                    from: () => ({
                        where: () => ({
                            orderBy: () => ({
                                limit: async () => selectedRows
                            })
                        })
                    })
                })
            })
    };
});

vi.mock('drizzle-orm', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('drizzle-orm');
    return {
        ...actual,
        asc: vi.fn(() => 'asc'),
        gt: vi.fn(() => 'gt'),
        lt: vi.fn(() => 'lt'),
        ne: vi.fn(() => 'ne'),
        or: vi.fn(() => 'or')
    };
});

const { subscriptionDriftReconcileJob } = await import(
    '../../src/cron/jobs/subscription-drift-reconcile.job.js'
);

/**
 * Stamp an error as coming from the provider READ, the way
 * `processSubscriptionUpdated`'s `retrieve()` boundary does. Without the mark the
 * classifier files it `transient` by design (HOS-914 F4), so a fixture that means
 * "MercadoPago could not resolve this" has to carry it.
 */
function markedProviderRead<T>(error: T): T {
    markProviderReadFailure(error);
    return error;
}

/** Reference instant; every fed row is made stale relative to it. */
const NOW = new Date('2026-09-09T12:00:00Z');
const STALE = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);

const loggedWarnings: Array<{ message: string; data?: Record<string, unknown> }> = [];

const loggedErrors: Array<{
    message: string;
    data?: Record<string, unknown>;
    options?: { capture?: boolean };
}> = [];

function buildContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: (message: string, data?: Record<string, unknown>) => {
                loggedWarnings.push({ message, data });
            },
            error: (
                message: string,
                data?: Record<string, unknown>,
                options?: { capture?: boolean }
            ) => {
                loggedErrors.push({ message, data, options });
            },
            debug: vi.fn()
        },
        startedAt: NOW,
        dryRun: false,
        ...overrides
    };
}

/** A candidate row. `productDomain` rides along to make the vertical explicit. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'sub-1',
        customerId: 'cus-1',
        status: 'active',
        mpSubscriptionId: 'preapproval-1',
        trialEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: STALE,
        deletedAt: null,
        productDomain: 'accommodation',
        ...overrides
    };
}

beforeEach(() => {
    selectedRows = [];
    lockAcquired = true;
    billingInstance = { marker: 'billing' };
    loggedErrors.length = 0;
    loggedWarnings.length = 0;
    processSubscriptionUpdatedMock.mockReset();
    processSubscriptionUpdatedMock.mockResolvedValue({
        success: true,
        statusChanged: false,
        outcome: 'already_in_sync'
    });
    mpCancelSpy.mockReset();
    mpUpdateSpy.mockReset();
    sentryCaptureSpy.mockReset();
});

describe('subscription-drift-reconcile — MercadoPago drawing a blank is never a cancellation', () => {
    it('does not write, does not cancel, and FAILS the tick naming the row', async () => {
        // Arrange — the provider cannot resolve the preapproval. This is the
        // shape a cash-paid partner (HOS-1062) or a mis-recorded id produces.
        selectedRows = [row({ id: 'sub-cash', mpSubscriptionId: 'preapproval-ghost' })];
        processSubscriptionUpdatedMock.mockRejectedValue(
            markedProviderRead(
                Object.assign(new Error('Retrieve subscription - Not Found'), { status: 404 })
            )
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert — no provider mutation was even attempted
        expect(mpCancelSpy).not.toHaveBeenCalled();
        expect(mpUpdateSpy).not.toHaveBeenCalled();
        // …and the tick is not reported as a success
        expect(result.success).toBe(false);
        expect(result.details?.unknownAtProvider).toBe(1);
        expect(result.details?.unknownAtProviderIds).toEqual(['sub-cash']);
        expect(result.details?.transientErrors).toBe(0);
        expect(result.message).toContain('NOT cancelled');
        // …and a human is told which row, loudly. The escalation rides on the
        // logger's capture hook; the explicit Sentry.captureException that used to
        // sit beside it was removed because, with the runner's own soft-failure
        // capture for `success: false`, a ghost row produced THREE Sentry events per
        // tick with no dedup or backoff.
        const escalation = loggedErrors.find((e) => e.data?.subscriptionId === 'sub-cash');
        expect(escalation).toBeDefined();
        expect(escalation?.options?.capture).toBe(true);
        // Exactly ONE capture channel from this job. The explicit
        // Sentry.captureException that used to sit beside the log is gone: with the
        // logger's hook and the runner's soft-failure capture for `success: false`,
        // a single ghost row fired three Sentry events per tick — 72 a day, with no
        // dedup and no backoff — and the third said nothing the first two had not.
        expect(sentryCaptureSpy).not.toHaveBeenCalled();
    });

    it('keeps sweeping the rest of the batch after an unknown row', async () => {
        // Arrange — one ghost between two healthy rows.
        selectedRows = [
            row({ id: 'sub-a', mpSubscriptionId: 'preapproval-a' }),
            row({ id: 'sub-ghost', mpSubscriptionId: 'preapproval-ghost' }),
            row({ id: 'sub-b', mpSubscriptionId: 'preapproval-b' })
        ];
        processSubscriptionUpdatedMock.mockImplementation(
            async ({ event }: { event: { data: { id: string } } }) => {
                if (event.data.id === 'preapproval-ghost') {
                    throw markedProviderRead(
                        Object.assign(new Error('Not Found'), { code: 'resource_not_found' })
                    );
                }
                return { success: true, statusChanged: false, outcome: 'already_in_sync' };
            }
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).toHaveBeenCalledTimes(3);
        expect(result.details?.inSync).toBe(2);
        expect(result.details?.unknownAtProvider).toBe(1);
    });
});

describe('subscription-drift-reconcile — a transient failure reports differently', () => {
    it('counts a 429 as transient, never as unknown-at-provider', async () => {
        // Arrange
        selectedRows = [row({ id: 'sub-429' })];
        processSubscriptionUpdatedMock.mockRejectedValue(
            markedProviderRead(
                Object.assign(new Error('Rate limit exceeded'), { code: 'rate_limit_error' })
            )
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.transientErrors).toBe(1);
        expect(result.details?.unknownAtProvider).toBe(0);
        expect(result.details?.unknownAtProviderIds).toEqual([]);
        // A transient failure is a warn, not an escalation.
        expect(loggedErrors.some((e) => e.data?.subscriptionId === 'sub-429')).toBe(false);
        // Still not a success: the row was not reconciled this tick.
        expect(result.success).toBe(false);
    });
});

describe('subscription-drift-reconcile — all five verticals and the dual-owner account', () => {
    it('reconciles one row per subscription regardless of product domain', async () => {
        // Arrange — the five things that charge, plus a SECOND row for the
        // partner's own customer id in the accommodation domain: the account
        // that is a host and a partner at once (`host-provider@local.test`).
        selectedRows = [
            row({ id: 's-acc', mpSubscriptionId: 'pa-acc', productDomain: 'accommodation' }),
            row({ id: 's-gas', mpSubscriptionId: 'pa-gas', productDomain: 'gastronomy' }),
            row({ id: 's-exp', mpSubscriptionId: 'pa-exp', productDomain: 'experience' }),
            row({
                id: 's-tou',
                mpSubscriptionId: 'pa-tou',
                productDomain: 'accommodation',
                customerId: 'cus-tourist'
            }),
            row({
                id: 's-par',
                mpSubscriptionId: 'pa-par',
                productDomain: 'partner',
                customerId: 'cus-dual'
            }),
            row({
                id: 's-dual-host',
                mpSubscriptionId: 'pa-dual-host',
                productDomain: 'accommodation',
                customerId: 'cus-dual'
            })
        ];
        processSubscriptionUpdatedMock.mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'active',
            outcome: 'status_written'
        });

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert — every row, not every customer
        expect(processSubscriptionUpdatedMock).toHaveBeenCalledTimes(6);
        const seen = processSubscriptionUpdatedMock.mock.calls.map(
            (call) => (call[0] as { event: { data: { id: string } } }).event.data.id
        );
        expect(seen.sort()).toEqual(
            ['pa-acc', 'pa-dual-host', 'pa-exp', 'pa-gas', 'pa-par', 'pa-tou'].sort()
        );
        // Both of the dual owner's subscriptions were reconciled.
        expect(seen.filter((id) => id.startsWith('pa-dual') || id === 'pa-par')).toHaveLength(2);
        expect(result.details?.corrected).toBe(6);
        expect(result.success).toBe(true);
    });

    it('filters a row the SQL should not have returned, in code', async () => {
        // Arrange — the predicate is the specification; the query is the
        // optimisation. A loosened WHERE must not be able to widen what gets
        // compared, so a preapproval-less row is dropped here too.
        selectedRows = [row({ id: 's-no-preapproval', mpSubscriptionId: null })];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.processed).toBe(0);
    });
});

describe('subscription-drift-reconcile — counting and the two no-op exits', () => {
    it('separates corrected rows from rows already in sync', async () => {
        // Arrange
        selectedRows = [
            row({ id: 's-1', mpSubscriptionId: 'pa-1' }),
            row({ id: 's-2', mpSubscriptionId: 'pa-2' })
        ];
        processSubscriptionUpdatedMock.mockImplementation(
            async ({ event }: { event: { data: { id: string } } }) =>
                event.data.id === 'pa-1'
                    ? {
                          success: true,
                          statusChanged: true,
                          newStatus: 'cancelled',
                          outcome: 'status_written'
                      }
                    : { success: true, statusChanged: false, outcome: 'already_in_sync' }
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.corrected).toBe(1);
        expect(result.details?.inSync).toBe(1);
        expect(result.processed).toBe(2);
        expect(result.success).toBe(true);
    });

    it('a dry run compares nothing and says so', async () => {
        // Arrange — `processSubscriptionUpdated` WRITES, so a rehearsal must not
        // reach it at all. Asserted on the call count, not on the message: a
        // report is not evidence of what a run did (HOS-918).
        selectedRows = [row()];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext({ dryRun: true }));

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.details?.dryRun).toBe(true);
        expect(result.processed).toBe(1);
    });

    it('does nothing when a sibling replica holds the advisory lock', async () => {
        // Arrange
        lockAcquired = false;
        selectedRows = [row()];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.message).toBe('lock_not_acquired');
        expect(result.details?.acquiredLock).toBe(false);
    });

    it('skips the run when billing is not configured', async () => {
        // Arrange
        billingInstance = null;
        selectedRows = [row()];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.message).toBe('billing_not_configured');
    });
});

describe('subscription-drift-reconcile — a no-op is not automatically a clean bill of health', () => {
    it('reports a REFUSED transition as unresolved, never as "already in sync"', async () => {
        // Arrange — the review's sharpest case: local `paused`, MercadoPago reports
        // `finished`, which maps to EXPIRED. PAUSED → EXPIRED is not in
        // VALID_TRANSITIONS, so the write is skipped and `statusChanged` is false.
        // Reading that boolean alone made the only observable output of the last
        // safety net in the system say "no divergence" about the one row that had
        // one — and `success: true` meant the runner's soft-failure capture stayed
        // silent too.
        selectedRows = [row({ id: 'sub-refused', status: 'paused' })];
        processSubscriptionUpdatedMock.mockResolvedValue({
            success: true,
            statusChanged: false,
            outcome: 'transition_refused'
        });

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.unresolved).toBe(1);
        expect(result.details?.inSync).toBe(0);
        expect(result.details?.unresolvedRows).toEqual([
            { id: 'sub-refused', outcome: 'transition_refused' }
        ]);
        // Held against success, so the runner's soft-failure capture fires.
        expect(result.success).toBe(false);
        const escalation = loggedErrors.find((e) => e.data?.subscriptionId === 'sub-refused');
        expect(escalation?.options?.capture).toBe(true);
    });

    it.each([
        ['stored_status_unrecognized'],
        ['provider_status_unknown'],
        ['local_row_not_found']
    ])('reports %s as unresolved too', async (outcome) => {
        // Arrange — each is a divergence that was not applied, for a different
        // reason. None of them means local and provider agree.
        selectedRows = [row({ id: `sub-${outcome}` })];
        processSubscriptionUpdatedMock.mockResolvedValue({
            success: true,
            statusChanged: false,
            outcome
        });

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.unresolved).toBe(1);
        expect(result.success).toBe(false);
    });

    it.each([
        ['already_in_sync'],
        ['addon_routed'],
        ['provider_pending'],
        ['soft_cancel_grace'],
        ['transition_refused_legacy_active_to_trialing']
    ])('treats %s as a genuine no-op and keeps the tick green', async (outcome) => {
        // Arrange — the benign set. Widening it is how a divergence gets filed as
        // health, so each member is asserted by name rather than by category.
        selectedRows = [row({ id: `sub-${outcome}` })];
        processSubscriptionUpdatedMock.mockResolvedValue({
            success: true,
            statusChanged: false,
            outcome
        });

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.inSync).toBe(1);
        expect(result.details?.unresolved).toBe(0);
        expect(result.success).toBe(true);
    });

    it('treats an ABSENT outcome as unresolved, so a new upstream value cannot pass as healthy', async () => {
        // Arrange — fail-closed by construction: the benign set is an allowlist and
        // everything else counts as unresolved. A `SubscriptionUpdateOutcome` added
        // upstream therefore surfaces loudly until someone classifies it, instead of
        // inheriting "already in sync" the way the boolean did.
        selectedRows = [row({ id: 'sub-no-outcome' })];
        processSubscriptionUpdatedMock.mockResolvedValue({ success: true, statusChanged: false });

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.unresolved).toBe(1);
        expect(result.details?.unresolvedRows).toEqual([
            { id: 'sub-no-outcome', outcome: 'unknown' }
        ]);
        expect(result.success).toBe(false);
    });
});

describe('subscription-drift-reconcile — the cursor is what makes the bounded batch fair', () => {
    it('advances past a full page so the next tick sees the REST of the population', async () => {
        // Arrange — the defect this replaced: ordering by `updated_at ASC` never
        // advances, because an in-sync row is not written and so does not move. With
        // 60 eligible rows the 55th could diverge and never be looked at while the
        // tick reported "50 already in sync" and success.
        selectedRows = Array.from({ length: 50 }, (_, i) =>
            row({ id: `sub-${String(i).padStart(2, '0')}`, mpSubscriptionId: `pa-${i}` })
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert — the cursor now sits on the last SELECTED id
        expect(result.details?.cursorAfterId).toBe('sub-49');
        expect(result.details?.batchLimitReached).toBe(true);
    });

    it('wraps to the start of the id space on a short page', async () => {
        // Arrange — fewer rows than the limit means the id space is exhausted.
        selectedRows = [row({ id: 'sub-a' }), row({ id: 'sub-b' })];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.cursorAfterId).toBeNull();
        expect(result.details?.batchLimitReached).toBe(false);
    });

    it('warns when the batch limit is reached — the only signal the population outgrew the budget', async () => {
        // Arrange
        selectedRows = Array.from({ length: 50 }, (_, i) =>
            row({ id: `sub-${String(i).padStart(2, '0')}`, mpSubscriptionId: `pa-${i}` })
        );

        // Act
        await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(loggedWarnings.some((w) => w.message.includes('batch limit reached'))).toBe(true);
    });

    it('advances the cursor past rows it could NOT converge, so a ghost cannot pin the window', async () => {
        // Arrange — a ghost preapproval used to be a permanent resident of the
        // batch: it consumed a slot and a provider call every tick for ever, and
        // starved everything behind it. The cursor is advanced from what was
        // SELECTED, not from what succeeded, so it moves past the ghost.
        selectedRows = Array.from({ length: 50 }, (_, i) =>
            row({ id: `sub-${String(i).padStart(2, '0')}`, mpSubscriptionId: `pa-${i}` })
        );
        processSubscriptionUpdatedMock.mockRejectedValue(
            markedProviderRead(Object.assign(new Error('Not Found'), { status: 404 }))
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert — every row failed, and the cursor still moved
        expect(result.details?.unknownAtProvider).toBe(50);
        expect(result.details?.cursorAfterId).toBe('sub-49');
    });

    it('a DRY RUN leaves the cursor untouched', async () => {
        // Arrange — the cursor is module state, so first drive a real short page to
        // put it at a known value (null), rather than depending on test order.
        selectedRows = [row({ id: 'sub-reset' })];
        const reset = await subscriptionDriftReconcileJob.handler(buildContext());
        expect(reset.details?.cursorAfterId).toBeNull();
        // The reset tick legitimately reconciled its one row; forget that so the
        // assertion below is about the DRY RUN only.
        processSubscriptionUpdatedMock.mockClear();

        // A rehearsal over a FULL page would advance a real run's cursor to sub-49,
        // which would make the next real tick skip everything it merely counted.
        selectedRows = Array.from({ length: 50 }, (_, i) =>
            row({ id: `sub-${String(i).padStart(2, '0')}`, mpSubscriptionId: `pa-${i}` })
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext({ dryRun: true }));

        // Assert — unchanged, and nothing was written
        expect(result.details?.cursorAfterId).toBeNull();
        expect(result.details?.batchLimitReached).toBe(true);
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
    });
});

describe('subscription-drift-reconcile — the WHERE clause the mocked builder cannot see', () => {
    /*
     * The tests above feed rows straight past a stubbed query builder, so they are
     * structurally blind to the predicates in the SELECT itself. Two of those
     * predicates are load-bearing: the preapproval filter is what keeps a cash-paid
     * partner (HOS-1062) out of the population, and the add-on exclusion being the
     * ONLY domain predicate is what makes the sweep cover all five verticals on
     * identical terms.
     *
     * ## What these four assertions actually prove — and it is less than you want
     *
     * They are `toContain` over the file's live text. That proves the substring is
     * PRESENT somewhere, nothing more. It does not prove the predicate is reachable,
     * that it is passed to the `and(...)`, or that it ran: hoisting a condition into
     * an unused `const` leaves every one of them green. Proving the real thing needs
     * an AST walk (or a live database), and that was judged not worth the cost here.
     *
     * So the test NAMES below say "the source text contains", not "requires a
     * preapproval id". A guard must not assert more than its predicate checks — the
     * earlier names did, which is the same defect class this PR corrected in
     * `preapproval-less-expiry`'s comment.
     */
    const source = readFileSync(
        resolve(__dirname, '../../src/cron/jobs/subscription-drift-reconcile.job.ts'),
        'utf-8'
    );
    /** Live code only: the module doc legitimately names domains in prose. */
    const liveCode = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    it('the source TEXT contains the isNotNull(mpSubscriptionId) predicate (presence only, not behaviour)', () => {
        // Arrange & Act & Assert
        expect(liveCode).toContain('isNotNull(billingSubscriptions.mpSubscriptionId)');
    });

    it('the source TEXT contains an excludeAddonDomainCondition() call (presence only, not behaviour)', () => {
        // Arrange & Act & Assert
        expect(liveCode).toContain('excludeAddonDomainCondition()');
    });

    it('the source TEXT mentions no other product-domain predicate (presence only, not behaviour)', () => {
        // Arrange — a `ProductDomainEnum` comparison, a
        // `subscriptionMatchesDomain` call or a `productDomain` predicate here
        // would silently narrow the sweep to one vertical while every test above
        // kept passing, because those tests never see the WHERE clause.
        // Act & Assert
        expect(liveCode).not.toContain('ProductDomainEnum');
        expect(liveCode).not.toContain('subscriptionMatchesDomain');
        expect(liveCode).not.toContain('billingSubscriptions.productDomain');
    });

    it('the source TEXT contains no call to either reconciler bridge (presence only, not behaviour)', () => {
        // Arrange — calling them here would double-fire them for every
        // corrected row, and would also owe this file an entry in
        // test/services/subscription-linked-entities-bridge.guard.test.ts.
        // Act & Assert
        expect(liveCode).not.toContain('reconcileSubscriptionLinkedEntities(');
        expect(liveCode).not.toContain('reconcilePartnerForSubscription(');
    });
});
