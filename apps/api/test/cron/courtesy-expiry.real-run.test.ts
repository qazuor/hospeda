/**
 * Real-run tests for the `courtesy-expiry` cron job (HOS-180, HOS-994).
 *
 * The third file of the set only because `courtesy-expiry.test.ts` sits seven
 * lines under the repo's 500-line cap; the mock scaffolding is deliberately
 * identical to its two siblings.
 *
 * Two blind spots the sibling files structurally cannot cover:
 *
 * 1. **A real run must not be able to REPORT itself as a rehearsal.**
 *    `success`, `processed`, `errors` and the sequence of side effects are
 *    identical in both modes by design, so the only thing separating "resumed
 *    a live preapproval" from "counted what it would have resumed" is
 *    `details` and the message. Nothing asserted on them, which left a
 *    one-token mutation — `if (dryRun)` → `if (true)` in the report block —
 *    fully green while producing the inverse of the HOS-918 failure: a run
 *    that did everything, filed in `cron_runs` claiming it did nothing.
 * 2. **The `.catch` on the ended-notification is load-bearing.** By the time
 *    it runs, `resume()` has already succeeded and MercadoPago is charging
 *    again. Letting a mailer outage propagate would skip the `ACTIVE` write,
 *    the window clear and the audit row, leaving the row `courtesy` with an
 *    open window while the provider bills — and the next sweep would call
 *    `resume()` on it all over again.
 *
 * @module test/cron/courtesy-expiry.real-run
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

/** A context in production mode, which is what every test here exercises. */
function realRunContext(overrides?: Partial<CronJobContext>): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date(),
        dryRun: false,
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

describe('courtesy-expiry real run — never reports itself as a rehearsal', () => {
    it('reports a resumed window as work DONE, not as work it would do', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow()];

        // Act
        const result = await courtesyExpiryJob.handler(realRunContext());

        // Assert — it really did the work...
        expect(resumeMock).toHaveBeenCalledWith('sub-1');

        // ...and says so. `success`/`processed`/`errors` are identical in both
        // modes, so this is the ONLY signal in `cron_runs` that separates a run
        // which resumed a live preapproval from one that merely counted it.
        expect(result.details).toEqual({
            dryRun: false,
            resumed: 1,
            hardCancelled: 0,
            notifiedStart: 0
        });
        expect(result.details).not.toHaveProperty('wouldResume');
        expect(result.details).not.toHaveProperty('wouldHardCancel');
        expect(result.details).not.toHaveProperty('wouldNotifyStart');
        expect(result.message).not.toMatch(/dry run/i);
    });

    it('reports a hard-cancelled window separately from a resumed one', async () => {
        // Arrange
        subscriptionRows = [
            elapsedCourtesyRow({ id: 'sub-resume' }),
            elapsedCourtesyRow({ id: 'sub-cancel', cancelAtPeriodEnd: true })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(realRunContext());

        // Assert — the rehearsal already distinguished these two; the real run
        // must too, or the mode that matters is the less auditable one.
        expect(result.details).toEqual({
            dryRun: false,
            resumed: 1,
            hardCancelled: 1,
            notifiedStart: 0
        });
        expect(result.message).toContain('1 by cancellation');
    });

    it('reports a start notification it actually sent', async () => {
        // Arrange
        subscriptionRows = [openingCourtesyRow()];

        // Act
        const result = await courtesyExpiryJob.handler(realRunContext());

        // Assert
        expect(startedNotifyMock).toHaveBeenCalledWith({ subscriptionId: 'sub-1' });
        expect(result.details).toEqual({
            dryRun: false,
            resumed: 0,
            hardCancelled: 0,
            notifiedStart: 1
        });
    });

    it('marks a FAILED real run as real too', async () => {
        // Arrange — the loud-failure branch has its own return, and its own
        // chance to lie about the mode.
        subscriptionRows = [
            elapsedCourtesyRow({
                courtesyStartsAt: null,
                courtesyEndsAt: null,
                courtesyCyclesGranted: null
            })
        ];
        const ctx = realRunContext();

        // Act
        const result = await courtesyExpiryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(false);
        expect(result.details?.dryRun).toBe(false);
        expect(result.message).not.toMatch(/dry run/i);
        // The log line carries the mode too, so an operator triaging a red run
        // can tell a rehearsal's failure from one that left somebody paused.
        expect(ctx.logger.error).toHaveBeenCalledWith(
            'Courtesy expiry completed with failures',
            expect.objectContaining({ dryRun: false })
        );
    });
});

describe('courtesy-expiry real run — a dead mailer cannot strand a resumed row', () => {
    it('settles the row and audits it even when the ended notification throws', async () => {
        // Arrange — `resume()` succeeds, so MercadoPago is charging again; the
        // mailer is what fails.
        subscriptionRows = [elapsedCourtesyRow()];
        endedNotifyMock.mockRejectedValue(new Error('mailer down'));

        // Act
        const result = await courtesyExpiryJob.handler(realRunContext());

        // Assert — everything AFTER the notification still ran. Without the
        // `.catch`, the throw would skip all three and leave the row `courtesy`
        // with an open window while the provider bills it, and the next sweep
        // would resume an already-resumed preapproval.
        expect(callOrder).toEqual([
            'mp-resume',
            'notify-ended',
            'local-write',
            'audit',
            'clear-cache'
        ]);
        const written = updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(written.status).toBe('active');
        expect(written.courtesyEndsAt).toBeNull();
        expect(insertMock).toHaveBeenCalledTimes(1);

        // A subscriber who did not get the mail is a minor problem; the run is
        // not a failure and must not be retried.
        expect(result.success).toBe(true);
        expect(result.errors).toBe(0);
        expect(result.processed).toBe(1);
    });
});
