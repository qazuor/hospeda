/**
 * Dry-run tests for the `courtesy-expiry` cron job (HOS-180, HOS-994).
 *
 * Split out of `courtesy-expiry.test.ts` only because the two files together
 * exceed the repo's 500-line cap; the mock scaffolding is deliberately
 * identical.
 *
 * `dryRun` on this job is not cosmetic. `apps/api/src/cron/jobs/` declares 42
 * `CronJobDefinition`s; before HOS-994 exactly two of them contained no
 * reference to `dryRun` at all — this one and
 * `poll-apify-reputation-runs.job.ts` — and this one owns the most
 * irreversible effects of any job in the repo: a rehearsal used to genuinely
 * resume MercadoPago preapprovals, hard cancel them, mail subscribers and
 * clear windows off the rows.
 *
 * The sharpest of those is the start-notification stamp. Writing
 * `courtesyStartedNotifiedAt` during a rehearsal costs nothing visible today
 * and silences the next REAL run forever: the subscriber is never told their
 * gift began, and no error is raised anywhere. So every test here asserts on
 * an empty `callOrder` — that nothing at all was touched — rather than on the
 * absence of one particular call.
 *
 * @module test/cron/courtesy-expiry.dry-run
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const resumeMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();
const endedNotifyMock = vi.fn();
const startedNotifyMock = vi.fn();
const hardCancelMock = vi.fn();
const clearEntitlementCacheMock = vi.fn();

/** Rows the simulated `select ... where status = courtesy` returns. */
let subscriptionRows: Array<Record<string, unknown>> = [];
/** What `getQZPayBilling()` hands the sweep (`null` = billing not configured). */
let billingInstance: unknown = null;

/** Every side effect the sweep can have, in the order it had them. */
const callOrder: string[] = [];

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: (...args: unknown[]) => {
        callOrder.push('clear-cache');
        return clearEntitlementCacheMock(...args);
    }
}));

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: () => billingInstance
}));

vi.mock('../../src/services/billing/preapproval-hard-cancel.js', () => ({
    hardCancelPreapprovalBestEffort: (...args: unknown[]) => {
        callOrder.push('hard-cancel');
        return hardCancelMock(...args);
    }
}));

vi.mock('../../src/services/courtesy-notifications.service.js', () => ({
    sendCourtesyEndedNotification: (...args: unknown[]) => {
        callOrder.push('notify-ended');
        return endedNotifyMock(...args);
    },
    sendCourtesyStartedNotification: (...args: unknown[]) => {
        callOrder.push('notify-started');
        return startedNotifyMock(...args);
    }
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@repo/db');
    return {
        ...actual,
        billingSubscriptions: { id: 'id', status: 'status' },
        billingSubscriptionEvents: { subscriptionId: 'subscription_id' },
        eq: vi.fn(() => 'eq'),
        getDb: () => ({
            select: () => ({
                from: () => ({
                    where: async () => subscriptionRows
                })
            }),
            update: () => ({
                set: (values: unknown) => ({
                    where: async () => {
                        callOrder.push('local-write');
                        return updateMock(values);
                    }
                })
            }),
            insert: () => ({
                values: async (values: unknown) => {
                    callOrder.push('audit');
                    return insertMock(values);
                }
            })
        })
    };
});

const { courtesyExpiryJob } = await import('../../src/cron/jobs/courtesy-expiry.job');

/** The handler stamps its own clock, so fixtures are relative to real time. */
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

/**
 * A subscription sitting in a gift whose window has already elapsed.
 *
 * HOS-993: the three window fields are typed columns on the row now, not
 * `metadata` keys — a `timestamptz` column arrives as a `Date`, so the
 * fixture uses `Date` instances rather than ISO strings. `metadata` still
 * carries `billingInterval` (untouched by HOS-993).
 */
function elapsedCourtesyRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub-1',
        customerId: 'cus-1',
        status: 'courtesy',
        cancelAtPeriodEnd: false,
        mpSubscriptionId: 'mp-preapproval-1',
        courtesyStartsAt: PAST,
        courtesyEndsAt: PAST,
        courtesyCyclesGranted: 2,
        metadata: { billingInterval: 'monthly' },
        ...overrides
    };
}

/** A subscription whose gift has just begun and was never announced. */
function openingCourtesyRow(overrides: Record<string, unknown> = {}) {
    return elapsedCourtesyRow({
        courtesyStartsAt: PAST,
        courtesyEndsAt: FUTURE,
        courtesyCyclesGranted: 2,
        ...overrides
    });
}

function makeBilling() {
    return {
        subscriptions: {
            resume: (...args: unknown[]) => {
                callOrder.push('mp-resume');
                return resumeMock(...args);
            }
        }
    };
}

/** A context in dry-run mode, which is what every test here exercises. */
function dryRunContext(overrides?: Partial<CronJobContext>): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date(),
        dryRun: true,
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    subscriptionRows = [];
    billingInstance = makeBilling();
    resumeMock.mockResolvedValue(undefined);
    endedNotifyMock.mockResolvedValue(undefined);
    startedNotifyMock.mockResolvedValue(undefined);
    hardCancelMock.mockResolvedValue({ outcome: 'cancelled' });
});

describe('courtesy-expiry dry run — counts without touching anything', () => {
    it('reports an elapsed window it would resume, and calls nothing', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow()];

        // Act
        const result = await courtesyExpiryJob.handler(dryRunContext());

        // Assert — every side effect the real path has, individually absent.
        expect(resumeMock).not.toHaveBeenCalled();
        expect(endedNotifyMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
        expect(clearEntitlementCacheMock).not.toHaveBeenCalled();
        expect(callOrder).toEqual([]);

        // ...and the count is the real one, not zero: a rehearsal that reports
        // nothing to do is indistinguishable from a broken sweep.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
        expect(result.details).toEqual({
            dryRun: true,
            wouldResume: 1,
            wouldHardCancel: 0,
            wouldNotifyStart: 0
        });
    });

    it('reports a cancelled-mid-gift row without hard-cancelling the preapproval', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow({ cancelAtPeriodEnd: true })];

        // Act
        const result = await courtesyExpiryJob.handler(dryRunContext());

        // Assert — a hard cancel is unrecoverable; it is the one call in this
        // job that cannot be repeated or undone at MercadoPago.
        expect(hardCancelMock).not.toHaveBeenCalled();
        expect(callOrder).toEqual([]);
        expect(result.processed).toBe(1);
        expect(result.details).toEqual({
            dryRun: true,
            wouldResume: 0,
            wouldHardCancel: 1,
            wouldNotifyStart: 0
        });
    });

    it('reports an opening window WITHOUT notifying and WITHOUT writing the stamp', async () => {
        // Arrange — the gift has begun and nobody has been told yet.
        subscriptionRows = [openingCourtesyRow()];

        // Act
        const result = await courtesyExpiryJob.handler(dryRunContext());

        // Assert — the stamp is the mechanism that makes the notification
        // one-shot. Written here, the next REAL run reads it, skips the mail,
        // and the subscriber is never told their gift started — silently,
        // permanently, with no error anywhere.
        expect(startedNotifyMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
        expect(callOrder).toEqual([]);
        expect(result.processed).toBe(1);
        expect(result.details).toEqual({
            dryRun: true,
            wouldResume: 0,
            wouldHardCancel: 0,
            wouldNotifyStart: 1
        });
    });

    it('counts all three kinds of work in one sweep and still touches nothing', async () => {
        // Arrange
        subscriptionRows = [
            elapsedCourtesyRow({ id: 'sub-resume' }),
            elapsedCourtesyRow({ id: 'sub-cancel', cancelAtPeriodEnd: true }),
            openingCourtesyRow({ id: 'sub-start' })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(dryRunContext());

        // Assert
        expect(callOrder).toEqual([]);
        expect(result.success).toBe(true);
        expect(result.processed).toBe(3);
        expect(result.details).toEqual({
            dryRun: true,
            wouldResume: 1,
            wouldHardCancel: 1,
            wouldNotifyStart: 1
        });
    });

    it('logs the mode it is running in', async () => {
        // Arrange
        const ctx = dryRunContext();

        // Act
        await courtesyExpiryJob.handler(ctx);

        // Assert — an operator reading `cron_runs` must be able to tell a
        // rehearsal from a run that actually resumed people.
        expect(ctx.logger.info).toHaveBeenCalledWith(
            'Starting courtesy expiry sweep',
            expect.objectContaining({ dryRun: true })
        );
    });
});

describe('courtesy-expiry dry run — data faults still surface', () => {
    it('still fails loudly on a courtesy row with no readable window', async () => {
        // Arrange — corrupt data is wrong whether or not anyone writes today.
        subscriptionRows = [
            elapsedCourtesyRow({
                courtesyStartsAt: null,
                courtesyEndsAt: null,
                courtesyCyclesGranted: null
            })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(dryRunContext());

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.details?.dryRun).toBe(true);
        expect(result.details?.failures).toEqual([
            'sub-1: status is courtesy but no readable window'
        ]);
        expect(callOrder).toEqual([]);
    });

    it('still reports an elapsed window it could not resume for lack of billing', async () => {
        // Arrange
        billingInstance = null;
        subscriptionRows = [elapsedCourtesyRow()];

        // Act
        const result = await courtesyExpiryJob.handler(dryRunContext());

        // Assert — the diagnosis runs before the dry-run early-out, so a
        // rehearsal reports exactly the failure a real run would hit.
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.details?.failures).toEqual(['sub-1: billing not configured, cannot resume']);
    });
});
