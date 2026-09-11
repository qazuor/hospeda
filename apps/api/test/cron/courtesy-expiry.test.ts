/**
 * Unit tests for the `courtesy-expiry` cron job (HOS-180, HOS-994).
 *
 * This job is LOAD-BEARING, not a backstop: a courtesy is a PAUSED MercadoPago
 * preapproval and nothing else in the system resumes it. If a sweep silently
 * skips a row, the subscriber's gift turns into a permanent loss of service.
 * These tests therefore assert three things a green run cannot fake:
 * **order** (resume → notify → clear window → audit → cache, because the other
 * way round a failed resume leaves a row saying `active` over a still-paused
 * preapproval), **silence where silence is intended** (a subscriber who
 * cancelled mid-gift gets no "your gift ended" mail), and **noise where noise
 * is intended** (any failure reports `success: false`, spec R-1).
 *
 * `@repo/db` is mocked LOCALLY here, not through this package's global
 * `test/setup.ts`: the sweep runs `db.select().from().where()` with no trailing
 * `.execute()`, and the global mock's `mockReturnThis()` chain would hand that
 * `await` the db object instead of an array.
 *
 * @module test/cron/courtesy-expiry
 */
import * as Sentry from '@sentry/node';
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
/** When set, the initial select rejects — exercises the top-level catch. */
let selectError: Error | null = null;
/** What `getQZPayBilling()` hands the sweep (`null` = billing not configured). */
let billingInstance: unknown = null;

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
                    where: async () => {
                        if (selectError) {
                            throw selectError;
                        }
                        return subscriptionRows;
                    }
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

/**
 * The job stamps its own clock (`new Date()` inside the handler), so fixtures
 * are expressed relative to real time rather than to `ctx.startedAt`.
 */
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

/**
 * A subscription sitting in a gift whose window has already elapsed.
 *
 * HOS-993: the three window fields are typed columns on the row now, not
 * `metadata` keys — a `timestamptz` column arrives as a `Date`, so the
 * fixture uses `Date` instances rather than ISO strings. `metadata` still
 * carries `billingInterval` (untouched by HOS-993) and, where a test needs
 * it, `courtesyStartedNotifiedAt` (deliberately left in metadata).
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

/** A subscription whose gift has begun but not yet ended. */
function runningCourtesyRow(overrides: Record<string, unknown> = {}) {
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

function createMockContext(overrides?: Partial<CronJobContext>): CronJobContext {
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

/** The single `set(...)` payload of the Nth local write. */
function updatedValues(index = 0): Record<string, unknown> {
    return updateMock.mock.calls[index]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    subscriptionRows = [];
    selectError = null;
    billingInstance = makeBilling();
    resumeMock.mockResolvedValue(undefined);
    endedNotifyMock.mockResolvedValue(undefined);
    startedNotifyMock.mockResolvedValue(undefined);
    hardCancelMock.mockResolvedValue({ outcome: 'cancelled' });
});

describe('courtesy-expiry — job definition', () => {
    it('is registered as an hourly enabled job', () => {
        // Assert — hourly, not daily: the cron-lag grace is six hours.
        expect(courtesyExpiryJob.name).toBe('courtesy-expiry');
        expect(courtesyExpiryJob.schedule).toBe('0 * * * *');
        expect(courtesyExpiryJob.enabled).toBe(true);
    });
});

describe('courtesy-expiry — window ends (AC-5)', () => {
    it('resumes, notifies, clears the window, audits and drops the cache in that order', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow()];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert — the provider is called first: a local row that says `active`
        // over a still-paused preapproval is unrecoverable.
        expect(resumeMock).toHaveBeenCalledWith('sub-1');
        expect(callOrder).toEqual([
            'mp-resume',
            'notify-ended',
            'local-write',
            'audit',
            'clear-cache'
        ]);
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
    });

    it('writes ACTIVE and nulls the three courtesy columns', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow()];

        // Act
        await courtesyExpiryJob.handler(createMockContext());

        // Assert — a lingering window would make the NEXT unrelated pause
        // derive as a courtesy and hand out free entitlements. HOS-993: the
        // window lives in its own columns now, so clearing it no longer
        // touches `metadata` at all — the patch names only the three
        // courtesy columns (plus status).
        const values = updatedValues();
        expect(values.status).toBe('active');
        expect(values.courtesyStartsAt).toBeNull();
        expect(values.courtesyEndsAt).toBeNull();
        expect(values.courtesyCyclesGranted).toBeNull();
        expect(values).not.toHaveProperty('metadata');
    });

    it('records a COURTESY_WINDOW_ENDED audit event and clears the customer cache', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow()];

        // Act
        await courtesyExpiryJob.handler(createMockContext());

        // Assert
        const event = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(event.subscriptionId).toBe('sub-1');
        expect(event.eventType).toBe('COURTESY_WINDOW_ENDED');
        expect(event.newStatus).toBe('active');
        expect(event.triggerSource).toBe('courtesy-expiry-cron');
        expect((event.metadata as Record<string, unknown>).cyclesGranted).toBe(2);
        expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cus-1');
    });

    it('leaves a still-running window completely alone', async () => {
        // Arrange — the gift ends tomorrow, and it already notified its start.
        subscriptionRows = [
            runningCourtesyRow({
                metadata: { courtesyStartedNotifiedAt: PAST.toISOString() }
            })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert
        expect(callOrder).toEqual([]);
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
    });
});

describe('courtesy-expiry — cancelled mid-gift (AC-5)', () => {
    it('hard-cancels the preapproval and settles the row as CANCELLED without resuming', async () => {
        // Arrange — the subscriber asked to leave while the gift was running.
        subscriptionRows = [elapsedCourtesyRow({ cancelAtPeriodEnd: true })];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert — resuming would restart billing on somebody who is leaving.
        expect(resumeMock).not.toHaveBeenCalled();
        expect(hardCancelMock).toHaveBeenCalledWith({
            subscriptionId: 'sub-1',
            mpSubscriptionId: 'mp-preapproval-1',
            source: 'courtesy-expiry'
        });
        expect(callOrder).toEqual(['hard-cancel', 'local-write', 'clear-cache']);

        const values = updatedValues();
        expect(values.status).toBe('cancelled');
        expect(values.courtesyStartsAt).toBeNull();
        expect(values.courtesyEndsAt).toBeNull();
        expect(values.courtesyCyclesGranted).toBeNull();
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
    });

    it('sends NO "gift ended" notification — that silence is deliberate', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow({ cancelAtPeriodEnd: true })];

        // Act
        await courtesyExpiryJob.handler(createMockContext());

        // Assert — announcing the end of a gift to somebody who already asked
        // to go is noise, and the audit row is skipped for the same reason.
        expect(endedNotifyMock).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
    });
});

describe('courtesy-expiry — failures are loud (spec R-1)', () => {
    it('reports success:false and captures to Sentry when the resume throws', async () => {
        // Arrange
        subscriptionRows = [elapsedCourtesyRow()];
        resumeMock.mockRejectedValue(new Error('MP is down'));

        // Act — must not throw: one bad row cannot abort the sweep.
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(0);
        expect(result.details?.failures).toEqual(['sub-1: MP is down']);
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
            tags: { cronJob: 'courtesy-expiry', phase: 'resume' }
        });
        // Nothing local was written: the row stays `courtesy` and is retried.
        expect(updateMock).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
    });

    it('keeps sweeping the remaining rows after one fails', async () => {
        // Arrange
        subscriptionRows = [
            elapsedCourtesyRow({ id: 'sub-bad' }),
            elapsedCourtesyRow({ id: 'sub-good', customerId: 'cus-2' })
        ];
        resumeMock.mockRejectedValueOnce(new Error('MP is down')).mockResolvedValue(undefined);

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(1);
        expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cus-2');
    });

    it('leaves a courtesy row with an unreadable window intact and counts it as an error', async () => {
        // Arrange — corrupt data: status says courtesy, the window columns say
        // nothing.
        subscriptionRows = [
            elapsedCourtesyRow({
                courtesyStartsAt: null,
                courtesyEndsAt: null,
                courtesyCyclesGranted: null
            })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert — resuming could end a gift still owed; clearing would erase
        // the evidence. So it does neither and shouts.
        expect(callOrder).toEqual([]);
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.details?.failures).toEqual([
            'sub-1: status is courtesy but no readable window'
        ]);
    });

    it('counts one error per elapsed row when billing is not configured', async () => {
        // Arrange
        billingInstance = null;
        subscriptionRows = [
            elapsedCourtesyRow({ id: 'sub-1' }),
            elapsedCourtesyRow({ id: 'sub-2' })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert — no global early-return: every stranded subscriber is named.
        expect(result.success).toBe(false);
        expect(result.errors).toBe(2);
        expect(result.details?.failures).toEqual([
            'sub-1: billing not configured, cannot resume',
            'sub-2: billing not configured, cannot resume'
        ]);
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('reports success:false with a top-level Sentry capture when the sweep itself throws', async () => {
        // Arrange
        selectError = new Error('db unreachable');

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
            tags: { cronJob: 'courtesy-expiry', phase: 'top-level' }
        });
    });
});

describe('courtesy-expiry — window starts, exactly once (AC-13)', () => {
    it('notifies the subscriber and stamps the metadata the first time the window opens', async () => {
        // Arrange — started yesterday, ends tomorrow, never announced.
        subscriptionRows = [runningCourtesyRow()];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert
        expect(startedNotifyMock).toHaveBeenCalledWith({ subscriptionId: 'sub-1' });
        expect(callOrder).toEqual(['notify-started', 'local-write']);

        const values = updatedValues();
        const metadata = values.metadata as Record<string, unknown>;
        expect(typeof metadata.courtesyStartedNotifiedAt).toBe('string');
        expect(metadata.billingInterval).toBe('monthly');
        // HOS-993: the window now lives in its own columns, untouched by this
        // write — there is no risk of the metadata spread swallowing it, since
        // this `.set()` never names the window columns at all.
        expect(values).not.toHaveProperty('courtesyEndsAt');
        // No resume: the gift is running, not ending.
        expect(resumeMock).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
    });

    it('sends NOTHING on a second sweep over the same boundary', async () => {
        // Arrange — same row, but already carrying the stamp.
        subscriptionRows = [
            runningCourtesyRow({
                metadata: {
                    billingInterval: 'monthly',
                    courtesyStartedNotifiedAt: PAST.toISOString()
                }
            })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert — the stamp is the whole anti-renotification mechanism.
        expect(startedNotifyMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
        expect(result.processed).toBe(0);
        expect(result.success).toBe(true);
    });

    it('says nothing before the window actually opens', async () => {
        // Arrange — granted, but the paid period has not run out yet.
        subscriptionRows = [
            runningCourtesyRow({
                courtesyStartsAt: FUTURE,
                courtesyEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
                courtesyCyclesGranted: 1
            })
        ];

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert
        expect(startedNotifyMock).not.toHaveBeenCalled();
        expect(callOrder).toEqual([]);
        expect(result.processed).toBe(0);
    });

    it('counts a failed start notification as an error and does not stamp', async () => {
        // Arrange
        subscriptionRows = [runningCourtesyRow()];
        startedNotifyMock.mockRejectedValue(new Error('mailer down'));

        // Act
        const result = await courtesyExpiryJob.handler(createMockContext());

        // Assert — unstamped, so the next hourly sweep retries the mail.
        expect(updateMock).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.details?.failures).toEqual(['sub-1: start notification — mailer down']);
    });
});
