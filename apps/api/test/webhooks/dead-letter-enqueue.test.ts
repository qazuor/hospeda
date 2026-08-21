/**
 * HOS-717 — the webhook recovery queue actually gets written.
 *
 * ## Why the assertions here are shaped the way they are
 *
 * `apps/api/test/setup.ts` mocks `@repo/db` globally, and that mock does not
 * declare `billingWebhookEvents` or `billingWebhookDeadLetter`. Under it both
 * tables import as `undefined`, so an assertion like
 * `expect(insert).toHaveBeenCalledWith(billingWebhookDeadLetter)` degenerates to
 * `toHaveBeenCalledWith(undefined)` — which passes just as happily when the code
 * inserts into the WRONG table, or into no table at all. That is a vacuous test,
 * and it is exactly the failure mode that let this whole feature ship with no
 * production writer.
 *
 * This file therefore installs its own `vi.mock('@repo/db')` (a per-file mock
 * wins over the global one) in which each table is a **distinct, non-undefined
 * sentinel object**. `expect(insert).toHaveBeenCalledWith(DEAD_LETTER_TABLE)`
 * then genuinely discriminates: inserting into `billingWebhookEvents` instead
 * fails the assertion. The `identity guard` block below asserts the sentinels
 * are distinct and defined, so the discrimination itself is proven rather than
 * assumed.
 *
 * @module test/webhooks/dead-letter-enqueue
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Distinct table sentinels — the whole point of this file's local @repo/db mock.
// ---------------------------------------------------------------------------

const {
    DEAD_LETTER_TABLE,
    WEBHOOK_EVENTS_TABLE,
    mockGetDb,
    mockSql,
    mockEq,
    mockAnd,
    mockOr,
    mockIsNull
} = vi.hoisted(() => ({
    DEAD_LETTER_TABLE: {
        __table: 'billing_webhook_dead_letter',
        id: 'id',
        providerEventId: 'provider_event_id',
        resolvedAt: 'resolved_at',
        attempts: 'attempts',
        createdAt: 'created_at'
    },
    WEBHOOK_EVENTS_TABLE: {
        __table: 'billing_webhook_events',
        id: 'id',
        providerEventId: 'provider_event_id',
        provider: 'provider',
        type: 'type',
        payload: 'payload',
        status: 'status',
        error: 'error',
        processedAt: 'processed_at',
        attempts: 'attempts',
        livemode: 'livemode'
    },
    mockGetDb: vi.fn(),
    mockSql: vi.fn(
        (strings: TemplateStringsArray, ...values: readonly unknown[]) =>
            ({ __sql: strings.join('?'), values }) as unknown
    ),
    mockEq: vi.fn((column: unknown, value: unknown) => ({ __eq: [column, value] })),
    mockAnd: vi.fn((...conditions: readonly unknown[]) => ({ __and: conditions })),
    mockOr: vi.fn((...conditions: readonly unknown[]) => ({ __or: conditions })),
    mockIsNull: vi.fn((column: unknown) => ({ __isNull: column }))
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    billingWebhookDeadLetter: DEAD_LETTER_TABLE,
    billingWebhookEvents: WEBHOOK_EVENTS_TABLE,
    sql: mockSql,
    eq: mockEq,
    and: mockAnd,
    or: mockOr,
    isNull: mockIsNull
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: vi.fn()
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { billingWebhookDeadLetter, billingWebhookEvents } from '@repo/db';
import {
    enqueueWebhookForRetry,
    WEBHOOK_RETRY_MAX_ATTEMPTS,
    webhookRetryDelayHours
} from '../../src/routes/webhooks/mercadopago/dead-letter';
import { markEventFailedByProviderId } from '../../src/routes/webhooks/mercadopago/utils';

// ---------------------------------------------------------------------------
// Chainable db stub. Terminal calls are driven per-test.
// ---------------------------------------------------------------------------

interface DbStub {
    readonly select: ReturnType<typeof vi.fn>;
    readonly from: ReturnType<typeof vi.fn>;
    readonly where: ReturnType<typeof vi.fn>;
    readonly limit: ReturnType<typeof vi.fn>;
    readonly insert: ReturnType<typeof vi.fn>;
    readonly values: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
    readonly set: ReturnType<typeof vi.fn>;
    readonly returning: ReturnType<typeof vi.fn>;
}

function createDbStub({
    existingDeadLetterRows = [] as readonly unknown[],
    updateReturning = [] as readonly unknown[]
} = {}): DbStub {
    const stub: Record<string, ReturnType<typeof vi.fn>> = {};
    const chain = () => stub;

    stub.select = vi.fn(chain);
    stub.from = vi.fn(chain);
    stub.insert = vi.fn(chain);
    stub.update = vi.fn(chain);
    stub.set = vi.fn(chain);
    // `where` stays chainable so both shapes work: the enqueue's error-refresh
    // UPDATE ends there (awaiting a non-thenable object resolves to it, which is
    // all that branch needs), while the lookup and the status UPDATE continue on
    // to the terminal `.limit()` / `.returning()`.
    stub.where = vi.fn(chain);
    stub.limit = vi.fn(() => Promise.resolve(existingDeadLetterRows));
    stub.values = vi.fn(() => Promise.resolve(undefined));
    stub.returning = vi.fn(() => Promise.resolve(updateReturning));

    return stub as unknown as DbStub;
}

const FAILED_EVENT = {
    providerEventId: 'mp-evt-4242',
    provider: 'mercadopago',
    type: 'payment.updated',
    payload: { id: 'mp-evt-4242', data: { id: '4242' } },
    livemode: false
} as const;

beforeEach(() => {
    vi.clearAllMocks();
});

describe('identity guard — the table sentinels really do discriminate', () => {
    it('exposes two distinct, defined tables', () => {
        // Without this the whole file could be green while asserting
        // `toHaveBeenCalledWith(undefined)`, which is what the global
        // apps/api @repo/db mock would otherwise produce.
        expect(billingWebhookDeadLetter).toBeDefined();
        expect(billingWebhookEvents).toBeDefined();
        expect(billingWebhookDeadLetter).not.toBe(billingWebhookEvents);
        expect(billingWebhookDeadLetter).not.toEqual(billingWebhookEvents);
    });
});

describe('webhookRetryDelayHours — the retry schedule', () => {
    it('lets the first recovery attempt run on the next hourly tick', () => {
        expect(webhookRetryDelayHours(0)).toBe(0);
    });

    it('doubles the gap between attempts (1h, 2h, 4h, 8h)', () => {
        const cumulative = [0, 1, 2, 3, 4].map(webhookRetryDelayHours);
        expect(cumulative).toEqual([0, 1, 3, 7, 15]);

        const gaps = cumulative.slice(1).map((value, index) => {
            const previous = cumulative[index];
            return value - (previous ?? 0);
        });
        expect(gaps).toEqual([1, 2, 4, 8]);
    });

    it('spans well over half a day before the budget of 5 attempts runs out', () => {
        expect(WEBHOOK_RETRY_MAX_ATTEMPTS).toBe(5);
        // Last attempt fires ~15h after the failure — long enough to outlive a
        // provider outage, short enough that a dead event does not linger.
        expect(webhookRetryDelayHours(WEBHOOK_RETRY_MAX_ATTEMPTS - 1)).toBe(15);
    });

    it('never grows past the give-up point and tolerates junk input', () => {
        expect(webhookRetryDelayHours(WEBHOOK_RETRY_MAX_ATTEMPTS + 50)).toBe(
            webhookRetryDelayHours(WEBHOOK_RETRY_MAX_ATTEMPTS)
        );
        expect(webhookRetryDelayHours(-3)).toBe(0);
        expect(webhookRetryDelayHours(Number.NaN)).toBe(0);
    });
});

describe('enqueueWebhookForRetry', () => {
    it('inserts the failure into the dead-letter table, not the events table', async () => {
        const db = createDbStub();
        mockGetDb.mockReturnValue(db);

        const outcome = await enqueueWebhookForRetry({
            event: FAILED_EVENT,
            errorMessage: 'MercadoPago timed out'
        });

        expect(outcome).toBe('enqueued');
        expect(db.insert).toHaveBeenCalledTimes(1);
        expect(db.insert).toHaveBeenCalledWith(billingWebhookDeadLetter);
        expect(db.insert).not.toHaveBeenCalledWith(billingWebhookEvents);
    });

    it('queues at attempts = 0 and carries the event identity and payload', async () => {
        const db = createDbStub();
        mockGetDb.mockReturnValue(db);

        await enqueueWebhookForRetry({
            event: FAILED_EVENT,
            errorMessage: 'MercadoPago timed out'
        });

        expect(db.values).toHaveBeenCalledWith({
            providerEventId: 'mp-evt-4242',
            provider: 'mercadopago',
            type: 'payment.updated',
            payload: FAILED_EVENT.payload,
            error: 'MercadoPago timed out',
            attempts: 0,
            livemode: false
        });
    });

    it('inherits livemode from the event row instead of defaulting to true', async () => {
        const db = createDbStub();
        mockGetDb.mockReturnValue(db);

        await enqueueWebhookForRetry({
            event: { ...FAILED_EVENT, livemode: true },
            errorMessage: 'boom'
        });

        const [values] = db.values.mock.calls[0] as [Record<string, unknown>];
        expect(values.livemode).toBe(true);
    });

    it('never stores an empty error, since the column is NOT NULL', async () => {
        const db = createDbStub();
        mockGetDb.mockReturnValue(db);

        await enqueueWebhookForRetry({ event: FAILED_EVENT, errorMessage: '   ' });

        const [values] = db.values.mock.calls[0] as [Record<string, unknown>];
        expect(values.error).toBe('Unknown webhook failure');
    });

    it('does not queue a second row when an unresolved entry already exists', async () => {
        const db = createDbStub({ existingDeadLetterRows: [{ id: 'dl-1' }] });
        mockGetDb.mockReturnValue(db);

        const outcome = await enqueueWebhookForRetry({
            event: FAILED_EVENT,
            errorMessage: 'still failing'
        });

        // A duplicate row would silently triple the attempt budget: each copy
        // carries its own independent countdown to the give-up point.
        expect(outcome).toBe('already-queued');
        expect(db.insert).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalledWith(billingWebhookDeadLetter);
        expect(db.set).toHaveBeenCalledWith({ error: 'still failing' });
    });

    it('leaves the existing attempt count untouched when refreshing', async () => {
        const db = createDbStub({ existingDeadLetterRows: [{ id: 'dl-1' }] });
        mockGetDb.mockReturnValue(db);

        await enqueueWebhookForRetry({ event: FAILED_EVENT, errorMessage: 'still failing' });

        const [update] = db.set.mock.calls[0] as [Record<string, unknown>];
        expect(update).not.toHaveProperty('attempts');
        expect(update).not.toHaveProperty('resolvedAt');
    });

    it('swallows its own failure rather than breaking the error handler that called it', async () => {
        mockGetDb.mockImplementation(() => {
            throw new Error('database unavailable');
        });

        await expect(
            enqueueWebhookForRetry({ event: FAILED_EVENT, errorMessage: 'original failure' })
        ).resolves.toBe('failed');
    });
});

describe('markEventFailedByProviderId — the single choke point', () => {
    it('increments attempts in the same UPDATE that flips the status', async () => {
        const db = createDbStub({ updateReturning: [FAILED_EVENT] });
        mockGetDb.mockReturnValue(db);

        await markEventFailedByProviderId({
            providerEventId: 'mp-evt-4242',
            errorMessage: 'MercadoPago timed out'
        });

        expect(db.update).toHaveBeenCalledWith(billingWebhookEvents);
        const [update] = db.set.mock.calls[0] as [Record<string, unknown>];
        expect(update.status).toBe('failed');
        expect(update.error).toBe('MercadoPago timed out');
        // The counter had NO writer before HOS-717. Asserting the key exists is
        // what makes a regression back to the inert column fail here.
        expect(update).toHaveProperty('attempts');
    });

    it('bumps the counter in SQL, coalescing NULL so it cannot stick at NULL', async () => {
        const db = createDbStub({ updateReturning: [FAILED_EVENT] });
        mockGetDb.mockReturnValue(db);

        await markEventFailedByProviderId({
            providerEventId: 'mp-evt-4242',
            errorMessage: 'boom'
        });

        const [update] = db.set.mock.calls[0] as [Record<string, unknown>];
        const fragment = update.attempts as { __sql?: string };
        expect(fragment.__sql).toContain('coalesce');
        expect(fragment.__sql).toContain('+ 1');
    });

    it('queues the event for recovery once the status change actually happened', async () => {
        const db = createDbStub({ updateReturning: [FAILED_EVENT] });
        mockGetDb.mockReturnValue(db);

        await markEventFailedByProviderId({
            providerEventId: 'mp-evt-4242',
            errorMessage: 'MercadoPago timed out'
        });

        expect(db.insert).toHaveBeenCalledWith(billingWebhookDeadLetter);
    });

    it('does not queue anything when no pending row matched', async () => {
        // Second call for an already-failed event: the `status = 'pending'`
        // guard matches nothing, so neither the counter nor the queue moves.
        const db = createDbStub({ updateReturning: [] });
        mockGetDb.mockReturnValue(db);

        await markEventFailedByProviderId({
            providerEventId: 'mp-evt-4242',
            errorMessage: 'MercadoPago timed out'
        });

        expect(db.insert).not.toHaveBeenCalled();
    });

    it('does not queue anything when the status UPDATE itself throws', async () => {
        const db = createDbStub();
        db.returning.mockRejectedValueOnce(new Error('connection reset'));
        mockGetDb.mockReturnValue(db);

        await expect(
            markEventFailedByProviderId({
                providerEventId: 'mp-evt-4242',
                errorMessage: 'MercadoPago timed out'
            })
        ).resolves.toBeUndefined();

        expect(db.insert).not.toHaveBeenCalled();
    });
});
