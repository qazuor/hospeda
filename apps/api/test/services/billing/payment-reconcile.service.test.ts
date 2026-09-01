/**
 * Unit tests: HOS-765 `forceLinkPreapproval` / `backfillPayment` (operator
 * write verbs).
 *
 * `@repo/db` is replaced by a small in-memory query engine for
 * `billing_subscriptions`: the real `eq` / `and` / `isNull` / `inArray`
 * builders are mocked as condition-object factories, and a genuine
 * `matches()` predicate evaluates them against fixture rows, including the
 * compare-and-set `UPDATE ... WHERE` used by `forceLinkPreapproval`. The
 * `billing_payments` idempotency lookup in `backfillPayment` is different: it
 * is built with a real `drizzle-orm` `sql` tagged-template JSONB-containment
 * predicate (`providerPaymentIds @> '{"mercadopago":"<id>"}'::jsonb`), which
 * cannot be introspected generically — that query's fake `.where(...)`
 * ignores the predicate object and returns whatever the test staged in
 * `H.store.paymentLookupResult`, matching what the coordinator's fix note
 * describes. The exact SHAPE of that predicate (global, not scoped to a
 * subscription; no `deleted_at` filter) is asserted separately by the static
 * guard at the bottom of this file, since only reading the source can prove
 * a predicate's SHAPE when the runtime object itself is opaque.
 *
 * MercadoPago is never mocked at the HTTP-client level: a real
 * `MpPacedClient` is built with a `fetchImpl` stub answering
 * `/preapproval/:id` and `/v1/payments/:id`, so `fetchPreapprovalById` /
 * `fetchPaymentById` run for real.
 *
 * @module test/services/billing/payment-reconcile.service
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fake @repo/db (billing_subscriptions genuinely filtered; billing_payments
// idempotency lookup is test-staged — see file header).
// ---------------------------------------------------------------------------

const H = vi.hoisted(() => {
    interface Cond {
        readonly op: 'eq' | 'and' | 'isNull' | 'inArray';
        readonly col?: string;
        readonly val?: unknown;
        readonly conds?: Cond[];
        readonly vals?: unknown[];
    }

    const TBL = {
        billingSubscriptions: {
            id: 'id',
            customerId: 'customerId',
            status: 'status',
            mpSubscriptionId: 'mpSubscriptionId',
            livemode: 'livemode'
        },
        billingPayments: { id: 'id', providerPaymentIds: 'providerPaymentIds' }
    };

    const store = {
        subscriptions: [] as Array<Record<string, unknown>>,
        /** What the (unintrospectable) JSONB-containment lookup should "find". */
        paymentLookupResult: [] as Array<{ id: string }>
    };

    function matches(row: Record<string, unknown>, cond: Cond): boolean {
        switch (cond.op) {
            case 'eq':
                return row[cond.col as string] === cond.val;
            case 'and':
                return (cond.conds ?? []).every((c) => matches(row, c));
            case 'isNull':
                return row[cond.col as string] === null || row[cond.col as string] === undefined;
            case 'inArray':
                return (cond.vals ?? []).includes(row[cond.col as string]);
            default:
                return false;
        }
    }

    function project(
        row: Record<string, unknown>,
        projection: Record<string, string>
    ): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(projection).map(([key, marker]) => [key, row[marker]])
        );
    }

    const findByLocalSubscriptionIdMock = vi.fn();
    const markLinkedMock = vi.fn();
    const clearEntitlementCacheMock = vi.fn();
    const auditLogMock = vi.fn();

    const fakeDb = {
        select: (projection: Record<string, string>) => ({
            from: (table: unknown) => ({
                where: (cond: Cond) => {
                    if (table === TBL.billingPayments) {
                        const rows = store.paymentLookupResult;
                        return { limit: (n: number) => Promise.resolve(rows.slice(0, n)) };
                    }
                    const filtered = store.subscriptions
                        .filter((r) => matches(r, cond))
                        .map((r) => project(r, projection));
                    return { limit: (n: number) => Promise.resolve(filtered.slice(0, n)) };
                }
            })
        }),
        update: (_table: unknown) => ({
            set: (values: Record<string, unknown>) => ({
                where: (cond: Cond) => {
                    const matched = store.subscriptions.filter((r) => matches(r, cond));
                    for (const row of matched) {
                        Object.assign(row, values);
                    }
                    return {
                        returning: (projection: Record<string, string>) =>
                            Promise.resolve(matched.map((r) => project(r, projection)))
                    };
                }
            })
        })
    };

    return {
        TBL,
        store,
        fakeDb,
        findByLocalSubscriptionIdMock,
        markLinkedMock,
        clearEntitlementCacheMock,
        auditLogMock
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: (...args: unknown[]) => H.clearEntitlementCacheMock(...args)
}));
vi.mock('../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: (...args: unknown[]) => H.clearEntitlementCacheMock(...args)
}));

vi.mock('../../../src/utils/audit-logger.js', () => ({
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' },
    auditLog: (...args: unknown[]) => H.auditLogMock(...args)
}));
vi.mock('../../../src/utils/audit-logger', () => ({
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' },
    auditLog: (...args: unknown[]) => H.auditLogMock(...args)
}));

vi.mock('@repo/db', () => ({
    billingSubscriptions: H.TBL.billingSubscriptions,
    billingPayments: H.TBL.billingPayments,
    billingPendingCheckoutModel: {
        findByLocalSubscriptionId: (...args: unknown[]) => H.findByLocalSubscriptionIdMock(...args),
        markLinked: (...args: unknown[]) => H.markLinkedMock(...args)
    },
    getDb: () => H.fakeDb,
    eq: (col: string, val: unknown) => ({ op: 'eq', col, val }),
    and: (...conds: unknown[]) => ({ op: 'and', conds }),
    isNull: (col: string) => ({ op: 'isNull', col }),
    inArray: (col: string, vals: unknown[]) => ({ op: 'inArray', col, vals })
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SubscriptionStatusEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import {
    backfillPayment,
    forceLinkPreapproval
} from '../../../src/services/billing/payment-reconcile.service';
import { MpPacedClient } from '../../../src/utils/mp-reconciliation-search';

// ---------------------------------------------------------------------------
// MercadoPago fetch stub
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

function makeMpClient(params: {
    readonly preapprovals?: Record<string, Record<string, unknown>>;
    readonly payments?: Record<string, Record<string, unknown>>;
}): MpPacedClient {
    const fetchImpl = vi.fn(async (input: string | URL) => {
        const url = new URL(input.toString());
        if (url.pathname.startsWith('/preapproval/')) {
            const id = decodeURIComponent(url.pathname.slice('/preapproval/'.length));
            const body = params.preapprovals?.[id];
            return body ? jsonResponse(body) : jsonResponse(null, 404);
        }
        if (url.pathname.startsWith('/v1/payments/')) {
            const id = decodeURIComponent(url.pathname.slice('/v1/payments/'.length));
            const body = params.payments?.[id];
            return body ? jsonResponse(body) : jsonResponse(null, 404);
        }
        throw new Error(`unexpected MP path in test stub: ${url.pathname}`);
    });

    return new MpPacedClient({
        accessToken: 'TEST-token',
        fetchImpl: fetchImpl as unknown as typeof fetch,
        minIntervalMs: 0,
        sleepImpl: async () => {}
    });
}

function makeMpPreapproval(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'pa-1',
        status: 'authorized',
        reason: 'Plan mensual',
        auto_recurring: { transaction_amount: 500, currency_id: 'ARS' },
        date_created: '2026-08-10T00:00:00.000Z',
        next_payment_date: '2026-09-10T00:00:00.000Z',
        external_reference: null,
        preapproval_plan_id: null,
        payer_id: 'payer-1',
        payer_email: '',
        ...overrides
    };
}

function makeMpPayment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'pay-1',
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100,
        currency_id: 'ARS',
        date_created: '2026-08-10T00:00:00.000Z',
        date_approved: '2026-08-10T00:00:05.000Z',
        payer: { email: 'buyer@example.com', id: 'payer-1' },
        metadata: {},
        external_reference: null,
        description: null,
        ...overrides
    };
}

function makeSubscription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'sub-1',
        customerId: 'cust-1',
        status: SubscriptionStatusEnum.ABANDONED,
        mpSubscriptionId: null,
        livemode: false,
        ...overrides
    };
}

beforeEach(() => {
    H.store.subscriptions.length = 0;
    H.store.paymentLookupResult.length = 0;
    H.findByLocalSubscriptionIdMock.mockReset();
    H.markLinkedMock.mockReset();
    H.clearEntitlementCacheMock.mockReset();
    H.auditLogMock.mockReset();
    H.findByLocalSubscriptionIdMock.mockResolvedValue(null);
    H.markLinkedMock.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// forceLinkPreapproval
// ---------------------------------------------------------------------------

describe('forceLinkPreapproval', () => {
    it('happy path: links an ABANDONED subscription, flips it to pending_provider, and audits actorId + reason', async () => {
        H.store.subscriptions.push(makeSubscription({ status: SubscriptionStatusEnum.ABANDONED }));
        const client = makeMpClient({
            preapprovals: { 'pa-1': makeMpPreapproval({ id: 'pa-1' }) }
        });

        const result = await forceLinkPreapproval({
            preapprovalId: 'pa-1',
            localSubscriptionId: 'sub-1',
            actorId: 'staff-42',
            reason: 'Customer emailed a receipt matching this checkout',
            client,
            db: H.fakeDb as never
        });

        expect(result.outcome).toBe('linked');
        expect(result.localSubscriptionStatus).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);
        expect(H.store.subscriptions[0]?.mpSubscriptionId).toBe('pa-1');
        expect(H.store.subscriptions[0]?.status).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);

        expect(H.auditLogMock).toHaveBeenCalledTimes(1);
        const auditCall = H.auditLogMock.mock.calls[0]?.[0];
        expect(auditCall).toMatchObject({
            actorId: 'staff-42',
            action: 'create',
            resourceType: 'billing_reconciliation',
            resourceId: 'pa-1',
            metadata: expect.objectContaining({
                reconcileAction: 'force-link',
                reason: 'Customer emailed a receipt matching this checkout',
                outcome: 'linked'
            })
        });
    });

    it('is idempotent for the exact same pair: outcome "already-linked", no second write, but still audits', async () => {
        H.store.subscriptions.push(
            makeSubscription({
                id: 'sub-1',
                status: SubscriptionStatusEnum.PENDING_PROVIDER,
                mpSubscriptionId: 'pa-1'
            })
        );
        const client = makeMpClient({
            preapprovals: { 'pa-1': makeMpPreapproval({ id: 'pa-1' }) }
        });

        const result = await forceLinkPreapproval({
            preapprovalId: 'pa-1',
            localSubscriptionId: 'sub-1',
            actorId: 'staff-42',
            reason: 'Double-checking a report entry',
            client,
            db: H.fakeDb as never
        });

        expect(result.outcome).toBe('already-linked');
        expect(H.auditLogMock).toHaveBeenCalledTimes(1);
        expect(H.auditLogMock.mock.calls[0]?.[0]).toMatchObject({
            metadata: expect.objectContaining({ outcome: 'already-linked' })
        });
    });

    it('refuses 409 when the preapproval is already claimed by a DIFFERENT subscription', async () => {
        H.store.subscriptions.push(
            makeSubscription({ id: 'sub-OTHER', mpSubscriptionId: 'pa-1' }),
            makeSubscription({ id: 'sub-1', status: SubscriptionStatusEnum.ABANDONED })
        );
        const client = makeMpClient({
            preapprovals: { 'pa-1': makeMpPreapproval({ id: 'pa-1' }) }
        });

        await expect(
            forceLinkPreapproval({
                preapprovalId: 'pa-1',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Attempting a conflicting link',
                client,
                db: H.fakeDb as never
            })
        ).rejects.toThrow(HTTPException);

        try {
            await forceLinkPreapproval({
                preapprovalId: 'pa-1',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Attempting a conflicting link',
                client,
                db: H.fakeDb as never
            });
        } catch (err) {
            expect((err as HTTPException).status).toBe(409);
        }
    });

    it('refuses 409 when the target subscription already carries a DIFFERENT preapproval', async () => {
        H.store.subscriptions.push(
            makeSubscription({
                id: 'sub-1',
                status: SubscriptionStatusEnum.ABANDONED,
                mpSubscriptionId: 'pa-EXISTING'
            })
        );
        const client = makeMpClient({
            preapprovals: { 'pa-1': makeMpPreapproval({ id: 'pa-1' }) }
        });

        try {
            await forceLinkPreapproval({
                preapprovalId: 'pa-1',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Attempting to overwrite an existing link',
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected forceLinkPreapproval to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(409);
        }
    });

    it('refuses 409 on a non-linkable local status (active) and accepts abandoned', async () => {
        H.store.subscriptions.push(
            makeSubscription({ id: 'sub-1', status: SubscriptionStatusEnum.ACTIVE })
        );
        const client = makeMpClient({
            preapprovals: { 'pa-1': makeMpPreapproval({ id: 'pa-1' }) }
        });

        try {
            await forceLinkPreapproval({
                preapprovalId: 'pa-1',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Trying to link an already-active subscription',
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected forceLinkPreapproval to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(409);
        }
    });

    it('refuses 404 when the preapproval does not exist at MercadoPago', async () => {
        H.store.subscriptions.push(makeSubscription({ id: 'sub-1' }));
        const client = makeMpClient({ preapprovals: {} });

        try {
            await forceLinkPreapproval({
                preapprovalId: 'pa-missing',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Preapproval no longer exists',
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected forceLinkPreapproval to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(404);
        }
    });

    it('refuses 404 (never 403) when the local subscription does not exist', async () => {
        const client = makeMpClient({
            preapprovals: { 'pa-1': makeMpPreapproval({ id: 'pa-1' }) }
        });

        try {
            await forceLinkPreapproval({
                preapprovalId: 'pa-1',
                localSubscriptionId: 'sub-missing',
                actorId: 'staff-42',
                reason: 'Subscription id typo test',
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected forceLinkPreapproval to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(404);
        }
    });
});

// ---------------------------------------------------------------------------
// backfillPayment
// ---------------------------------------------------------------------------

function makeBillingMock() {
    const record = vi.fn(async (input: Record<string, unknown>) => ({
        id: 'bp-generated',
        ...input
    }));
    return { billing: { payments: { record } } as never, record };
}

describe('backfillPayment', () => {
    it('happy path: records the payment in CENTS, with provider/subscriptionId/reconstruction metadata, and audits', async () => {
        H.store.subscriptions.push(makeSubscription({ id: 'sub-1' }));
        const { billing, record } = makeBillingMock();
        const client = makeMpClient({
            payments: {
                'pay-1': makeMpPayment({ id: 'pay-1', transaction_amount: 180, status: 'approved' })
            }
        });

        const result = await backfillPayment({
            mpPaymentId: 'pay-1',
            localSubscriptionId: 'sub-1',
            actorId: 'staff-42',
            reason: 'MercadoPago sandbox smoke: settled charge never recorded',
            billing,
            client,
            db: H.fakeDb as never
        });

        expect(result.outcome).toBe('recorded');
        expect(result.amountInCents).toBe(18_000);
        expect(record).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 18_000,
                provider: 'mercadopago',
                providerPaymentId: 'pay-1',
                subscriptionId: 'sub-1',
                metadata: expect.objectContaining({
                    source: 'hos-765-admin-backfill',
                    backfilledBy: 'staff-42',
                    backfillReason: 'MercadoPago sandbox smoke: settled charge never recorded'
                })
            })
        );

        expect(H.auditLogMock).toHaveBeenCalledTimes(1);
        expect(H.auditLogMock.mock.calls[0]?.[0]).toMatchObject({
            metadata: expect.objectContaining({ outcome: 'recorded' })
        });
    });

    it('idempotency: a payment already recorded returns "already-recorded" and does NOT call billing.payments.record', async () => {
        H.store.subscriptions.push(makeSubscription({ id: 'sub-1' }));
        H.store.paymentLookupResult.push({ id: 'bp-existing' });
        const { billing, record } = makeBillingMock();
        const client = makeMpClient({
            payments: { 'pay-1': makeMpPayment({ id: 'pay-1', status: 'approved' }) }
        });

        const result = await backfillPayment({
            mpPaymentId: 'pay-1',
            localSubscriptionId: 'sub-1',
            actorId: 'staff-42',
            reason: 'Re-running the same rescue by mistake',
            billing,
            client,
            db: H.fakeDb as never
        });

        expect(result.outcome).toBe('already-recorded');
        expect(result.billingPaymentId).toBe('bp-existing');
        expect(record).not.toHaveBeenCalled();
        expect(H.auditLogMock).toHaveBeenCalledTimes(1);
    });

    it('refuses 422 on a non-approved payment (pending)', async () => {
        H.store.subscriptions.push(makeSubscription({ id: 'sub-1' }));
        const { billing, record } = makeBillingMock();
        const client = makeMpClient({
            payments: { 'pay-1': makeMpPayment({ id: 'pay-1', status: 'pending' }) }
        });

        try {
            await backfillPayment({
                mpPaymentId: 'pay-1',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Trying to record an unsettled charge',
                billing,
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected backfillPayment to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(422);
        }
        expect(record).not.toHaveBeenCalled();
    });

    it('refuses 409 when the payment names a preapproval owned by a DIFFERENT local subscription', async () => {
        H.store.subscriptions.push(
            makeSubscription({ id: 'sub-1', mpSubscriptionId: null }),
            makeSubscription({ id: 'sub-OTHER', mpSubscriptionId: 'pa-owned-elsewhere' })
        );
        const { billing, record } = makeBillingMock();
        const client = makeMpClient({
            payments: {
                'pay-1': makeMpPayment({
                    id: 'pay-1',
                    status: 'approved',
                    metadata: { preapproval_id: 'pa-owned-elsewhere' }
                })
            }
        });

        try {
            await backfillPayment({
                mpPaymentId: 'pay-1',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Testing the cross-subscription veto',
                billing,
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected backfillPayment to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(409);
        }
        expect(record).not.toHaveBeenCalled();
    });

    it('refuses 404 when the payment does not exist at MercadoPago', async () => {
        H.store.subscriptions.push(makeSubscription({ id: 'sub-1' }));
        const { billing, record } = makeBillingMock();
        const client = makeMpClient({ payments: {} });

        try {
            await backfillPayment({
                mpPaymentId: 'pay-missing',
                localSubscriptionId: 'sub-1',
                actorId: 'staff-42',
                reason: 'Testing a missing MercadoPago payment id',
                billing,
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected backfillPayment to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(404);
        }
        expect(record).not.toHaveBeenCalled();
    });

    it('refuses 404 when the local subscription does not exist', async () => {
        const { billing, record } = makeBillingMock();
        const client = makeMpClient({
            payments: { 'pay-1': makeMpPayment({ id: 'pay-1', status: 'approved' }) }
        });

        try {
            await backfillPayment({
                mpPaymentId: 'pay-1',
                localSubscriptionId: 'sub-missing',
                actorId: 'staff-42',
                reason: 'Testing a missing local subscription id',
                billing,
                client,
                db: H.fakeDb as never
            });
            throw new Error('expected backfillPayment to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(404);
        }
        expect(record).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Static guard — the backfill idempotency predicate's SHAPE (HOS-765 fix)
// ---------------------------------------------------------------------------

const SOURCE_PATH = join(__dirname, '../../../src/services/billing/payment-reconcile.service.ts');

/**
 * Extracts the idempotency-lookup block inside `backfillPayment`.
 *
 * Anchored on the `alreadyRecorded` destructuring so a matching token
 * elsewhere in the file cannot satisfy these assertions.
 */
function readIdempotencyLookupBlock(): string {
    const source = readFileSync(SOURCE_PATH, 'utf-8');
    const start = source.indexOf('const [alreadyRecorded]');
    expect(
        start,
        'alreadyRecorded lookup not found — did backfillPayment change shape?'
    ).toBeGreaterThan(-1);
    const end = source.indexOf('.limit(1);', start);
    expect(end, 'could not find the end of the alreadyRecorded lookup').toBeGreaterThan(start);
    return source.slice(start, end);
}

describe('backfillPayment idempotency predicate (HOS-765 bug fix: was scoped to one subscription)', () => {
    it('is NOT scoped by subscriptionId — a duplicate against ANOTHER subscription must still be caught', () => {
        const block = readIdempotencyLookupBlock();
        expect(block).not.toMatch(/billingPayments\.subscriptionId/);
    });

    it('matches by JSONB containment on providerPaymentIds, not by reading every row into memory', () => {
        const block = readIdempotencyLookupBlock();
        expect(block).toMatch(/providerPaymentIds\s*}\s*@>/);
    });

    it('does not filter deleted_at — a soft-deleted row still counts as recorded', () => {
        const block = readIdempotencyLookupBlock();
        expect(block).not.toMatch(/deletedAt/);
    });
});
