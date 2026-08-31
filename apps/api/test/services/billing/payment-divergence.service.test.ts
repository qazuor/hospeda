/**
 * Unit tests: HOS-765 `computeBillingDivergences` (read-only divergence report).
 *
 * `@repo/db` is replaced by a tiny in-memory query engine: the real `eq` /
 * `gte` / `isNotNull` builders are mocked as condition-object factories, and
 * a genuine `matches()` predicate evaluates them against fixture rows — so a
 * regression that adds/removes a WHERE filter (e.g. a `deleted_at` exclusion)
 * is actually caught, not just assumed away. The one exception is the
 * `billing_pending_checkouts` JOIN query (`loadLocalCandidates`): its join
 * conditions are real `drizzle-orm` `sql` template objects that cannot be
 * introspected generically, so that query is special-cased to return
 * already-joined fixture rows shaped exactly like the real SELECT's output —
 * the service's own `.map()` into `LocalCandidateRow` still runs for real.
 *
 * MercadoPago itself is never mocked at the HTTP-client level: a real
 * `MpPacedClient` is built with a `fetchImpl` stub that answers
 * `/v1/payments/search` and `/preapproval/search`, so `searchApprovedPayments`
 * / `searchPreapprovals` (already covered in mp-reconciliation-search.test.ts)
 * run for real here too.
 *
 * Coverage:
 * - unrecorded-payment: appears without a `billing_payments` row, absent with
 *   one — INCLUDING a soft-deleted one (the check does not filter
 *   `deleted_at`, on purpose).
 * - orphan-preapproval: appears unclaimed, absent when a local subscription
 *   already claims it.
 * - payerEmailFromPayment sourced from a LINKED PAYMENT, never from
 *   `preapproval.payer_email` (measured empty); null with no payment linked,
 *   and that null is not an error.
 * - candidates: `matchedOn` signals, a weak (`mp-plan-id`-only) candidate
 *   still surfaces, ranking puts the strongest match first.
 * - `kind` filters OUTPUT only — both MercadoPago sweeps always run.
 * - pagination fields stay coherent.
 * - money: MercadoPago pesos -> integer centavos.
 *
 * @module test/services/billing/payment-divergence.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fake @repo/db — a tiny in-memory query engine (see file header).
// ---------------------------------------------------------------------------

const H = vi.hoisted(() => {
    interface Cond {
        readonly op: 'gte' | 'eq' | 'and' | 'isNotNull' | 'isNull';
        readonly col?: string;
        readonly val?: unknown;
        readonly conds?: Cond[];
    }

    const TBL = {
        billingPayments: { createdAt: 'createdAt', providerPaymentIds: 'providerPaymentIds' },
        billingSubscriptions: { id: 'id', mpSubscriptionId: 'mpSubscriptionId' },
        billingPendingCheckouts: {
            id: 'id',
            localSubscriptionId: 'localSubscriptionId',
            customerId: 'customerId',
            payerEmail: 'payerEmail',
            nonce: 'nonce',
            mpPreapprovalPlanId: 'mpPreapprovalPlanId',
            createdAt: 'createdAt'
        },
        billingCustomers: { id: 'id', email: 'email', name: 'name', externalId: 'externalId' },
        users: { id: 'id', displayName: 'displayName' }
    };

    const store = {
        payments: [] as Array<Record<string, unknown>>,
        subscriptions: [] as Array<Record<string, unknown>>,
        localCandidateRows: [] as Array<Record<string, unknown>>
    };

    function matches(row: Record<string, unknown>, cond: Cond): boolean {
        switch (cond.op) {
            case 'gte': {
                const rowVal = row[cond.col as string];
                const a = rowVal instanceof Date ? rowVal.getTime() : rowVal;
                const b = cond.val instanceof Date ? cond.val.getTime() : cond.val;
                return (a as number) >= (b as number);
            }
            case 'eq':
                return row[cond.col as string] === cond.val;
            case 'and':
                return (cond.conds ?? []).every((c) => matches(row, c));
            case 'isNotNull':
                return row[cond.col as string] !== null && row[cond.col as string] !== undefined;
            case 'isNull':
                return row[cond.col as string] === null || row[cond.col as string] === undefined;
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

    /** Chainable join stub: innerJoin/leftJoin are ignored (see file header). */
    function joinChain(rowsGetter: () => Array<Record<string, unknown>>) {
        const chain = {
            innerJoin: () => chain,
            leftJoin: () => chain,
            where: (cond: Cond) => Promise.resolve(rowsGetter().filter((r) => matches(r, cond)))
        };
        return chain;
    }

    const fakeDb = {
        select: (projection: Record<string, string>) => ({
            from: (table: unknown) => {
                if (table === TBL.billingPendingCheckouts) {
                    return joinChain(() => store.localCandidateRows);
                }
                const rows =
                    table === TBL.billingPayments
                        ? store.payments
                        : table === TBL.billingSubscriptions
                          ? store.subscriptions
                          : [];
                return {
                    where: (cond: Cond) =>
                        Promise.resolve(
                            rows.filter((r) => matches(r, cond)).map((r) => project(r, projection))
                        )
                };
            }
        })
    };

    return { TBL, store, fakeDb, matches };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/db', () => ({
    billingCustomers: H.TBL.billingCustomers,
    billingPayments: H.TBL.billingPayments,
    billingPendingCheckouts: H.TBL.billingPendingCheckouts,
    billingSubscriptions: H.TBL.billingSubscriptions,
    users: H.TBL.users,
    getDb: () => H.fakeDb,
    gte: (col: string, val: unknown) => ({ op: 'gte', col, val }),
    isNotNull: (col: string) => ({ op: 'isNotNull', col })
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { computeBillingDivergences } from '../../../src/services/billing/payment-divergence.service';
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

function makeMpPayment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'pay-default',
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

function makeMpPreapproval(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'pa-default',
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

/** Builds a paced client whose fetchImpl serves both MP search endpoints from fixtures. */
function makeClient(params: {
    readonly payments?: readonly Record<string, unknown>[];
    readonly preapprovals?: readonly Record<string, unknown>[];
}): MpPacedClient {
    const payments = params.payments ?? [];
    const preapprovals = params.preapprovals ?? [];

    const fetchImpl = vi.fn(async (input: string | URL) => {
        const url = new URL(input.toString());
        if (url.pathname === '/v1/payments/search') {
            const offset = Number(url.searchParams.get('offset') ?? '0');
            const limit = Number(url.searchParams.get('limit') ?? '50');
            return jsonResponse({
                results: payments.slice(offset, offset + limit),
                paging: { total: payments.length }
            });
        }
        if (url.pathname === '/preapproval/search') {
            const offset = Number(url.searchParams.get('offset') ?? '0');
            const limit = Number(url.searchParams.get('limit') ?? '50');
            return jsonResponse({
                results: preapprovals.slice(offset, offset + limit),
                paging: { total: preapprovals.length }
            });
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Well inside the (since - 7 days) local lookback window used by every test below. */
const SINCE = new Date('2026-08-15T00:00:00.000Z');
const IN_WINDOW = new Date('2026-08-12T00:00:00.000Z');

function makeLocalCandidateRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        localSubscriptionId: 'sub-cand',
        localSubscriptionStatus: 'pending_provider',
        customerId: 'cust-1',
        customerEmail: 'account@example.com',
        userDisplayName: 'Jane Doe',
        customerName: null,
        pendingCheckoutId: 'pc-1',
        pendingCheckoutPayerEmail: 'checkout@example.com',
        pendingCheckoutNonce: 'nonce-abc',
        mpPreapprovalPlanId: 'plan-abc',
        createdAt: IN_WINDOW,
        ...overrides
    };
}

beforeEach(() => {
    H.store.payments.length = 0;
    H.store.subscriptions.length = 0;
    H.store.localCandidateRows.length = 0;
});

// ---------------------------------------------------------------------------
// unrecorded-payment
// ---------------------------------------------------------------------------

describe('computeBillingDivergences — unrecorded-payment', () => {
    it('reports an approved payment with no billing_payments row', async () => {
        const client = makeClient({ payments: [makeMpPayment({ id: 'pay-1' })] });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        expect(report.items).toHaveLength(1);
        expect(report.items[0]).toMatchObject({ kind: 'unrecorded-payment', mpPaymentId: 'pay-1' });
    });

    it('does not report a payment already recorded locally', async () => {
        H.store.payments.push({
            createdAt: IN_WINDOW,
            providerPaymentIds: { mercadopago: 'pay-1' }
        });
        const client = makeClient({ payments: [makeMpPayment({ id: 'pay-1' })] });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        expect(report.items).toHaveLength(0);
    });

    it('still counts a SOFT-DELETED billing_payments row as recorded (does not invent a divergence)', async () => {
        H.store.payments.push({
            createdAt: IN_WINDOW,
            providerPaymentIds: { mercadopago: 'pay-1' },
            deletedAt: new Date('2026-08-13T00:00:00.000Z')
        });
        const client = makeClient({ payments: [makeMpPayment({ id: 'pay-1' })] });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        expect(report.items).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// orphan-preapproval
// ---------------------------------------------------------------------------

describe('computeBillingDivergences — orphan-preapproval', () => {
    it('reports an authorized preapproval no local subscription claims', async () => {
        const client = makeClient({ preapprovals: [makeMpPreapproval({ id: 'pa-1' })] });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        expect(report.items).toHaveLength(1);
        expect(report.items[0]).toMatchObject({
            kind: 'orphan-preapproval',
            preapprovalId: 'pa-1'
        });
    });

    it('does not report a preapproval a local subscription already claims', async () => {
        H.store.subscriptions.push({ id: 'sub-1', mpSubscriptionId: 'pa-1' });
        const client = makeClient({ preapprovals: [makeMpPreapproval({ id: 'pa-1' })] });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        expect(report.items).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// payerEmailFromPayment — the finding that makes the tool possible
// ---------------------------------------------------------------------------

describe('computeBillingDivergences — payerEmailFromPayment attribution', () => {
    it('sources payerEmailFromPayment from a LINKED PAYMENT, never preapproval.payer_email', async () => {
        const client = makeClient({
            payments: [
                makeMpPayment({
                    id: 'pay-linked',
                    metadata: { preapproval_id: 'pa-orphan' },
                    payer: { email: 'real@buyer.com', id: 'payer-1' }
                })
            ],
            preapprovals: [makeMpPreapproval({ id: 'pa-orphan', payer_email: '' })]
        });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        const orphan = report.items.find(
            (item) => item.kind === 'orphan-preapproval' && item.preapprovalId === 'pa-orphan'
        );
        expect(orphan).toBeDefined();
        if (orphan?.kind !== 'orphan-preapproval') {
            throw new Error('expected an orphan-preapproval item');
        }
        // preapproval.payer_email is measured empty and must normalize to null.
        expect(orphan.payerEmail).toBeNull();
        expect(orphan.payerEmailFromPayment).toBe('real@buyer.com');
        expect(orphan.sourcePaymentId).toBe('pay-linked');
    });

    it('reports payerEmailFromPayment as null (not an error) when no payment is linked yet', async () => {
        const client = makeClient({
            preapprovals: [makeMpPreapproval({ id: 'pa-unattributed' })]
        });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        const orphan = report.items.find((item) => item.kind === 'orphan-preapproval');
        expect(orphan).toBeDefined();
        if (orphan?.kind !== 'orphan-preapproval') {
            throw new Error('expected an orphan-preapproval item');
        }
        expect(orphan.payerEmailFromPayment).toBeNull();
        expect(orphan.sourcePaymentId).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// candidates
// ---------------------------------------------------------------------------

describe('computeBillingDivergences — candidates', () => {
    it('matches on external-reference, payer-email and mp-plan-id, and ranks the strongest match first', async () => {
        H.store.localCandidateRows.push(
            makeLocalCandidateRow({
                localSubscriptionId: 'sub-strong',
                pendingCheckoutNonce: 'nonce-abc',
                pendingCheckoutPayerEmail: 'real@buyer.com',
                mpPreapprovalPlanId: 'plan-abc'
            }),
            // Weak candidate: matches ONLY on the shared, unreliable plan id.
            makeLocalCandidateRow({
                localSubscriptionId: 'sub-weak',
                pendingCheckoutNonce: 'some-other-nonce',
                pendingCheckoutPayerEmail: 'someone-else@example.com',
                mpPreapprovalPlanId: 'plan-abc'
            })
        );

        const client = makeClient({
            payments: [
                makeMpPayment({
                    id: 'pay-linked',
                    metadata: { preapproval_id: 'pa-1' },
                    payer: { email: 'real@buyer.com', id: 'payer-1' }
                })
            ],
            preapprovals: [
                makeMpPreapproval({
                    id: 'pa-1',
                    external_reference: 'nonce-abc',
                    preapproval_plan_id: 'plan-abc'
                })
            ]
        });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        const orphan = report.items.find((item) => item.kind === 'orphan-preapproval');
        if (orphan?.kind !== 'orphan-preapproval') {
            throw new Error('expected an orphan-preapproval item');
        }

        // A weak candidate (matched only on mp-plan-id) is NEVER dropped.
        expect(orphan.candidates).toHaveLength(2);
        // The strongest match (3 signals) is ranked first.
        expect(orphan.candidates[0]?.localSubscriptionId).toBe('sub-strong');
        expect(orphan.candidates[0]?.matchedOn).toEqual([
            'external-reference',
            'payer-email',
            'mp-plan-id'
        ]);
        expect(orphan.candidates[1]?.localSubscriptionId).toBe('sub-weak');
        expect(orphan.candidates[1]?.matchedOn).toEqual(['mp-plan-id']);
    });
});

// ---------------------------------------------------------------------------
// kind filter — both sweeps always run
// ---------------------------------------------------------------------------

describe('computeBillingDivergences — kind filter', () => {
    it('filters the OUTPUT but still runs the payment sweep, so payerEmailFromPayment stays populated', async () => {
        const client = makeClient({
            payments: [
                makeMpPayment({
                    id: 'pay-linked',
                    metadata: { preapproval_id: 'pa-1' },
                    payer: { email: 'real@buyer.com', id: 'payer-1' }
                })
            ],
            preapprovals: [makeMpPreapproval({ id: 'pa-1' })]
        });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            kind: 'orphan-preapproval',
            db: H.fakeDb as never
        });

        expect(report.items.every((item) => item.kind === 'orphan-preapproval')).toBe(true);
        const orphan = report.items[0];
        if (orphan?.kind !== 'orphan-preapproval') {
            throw new Error('expected an orphan-preapproval item');
        }
        // If the payment sweep had been skipped to honor the filter, this
        // would be null and the report would lie in the direction that makes
        // it useless.
        expect(orphan.payerEmailFromPayment).toBe('real@buyer.com');
    });

    it('kind: unrecorded-payment excludes orphan-preapproval items from the output', async () => {
        const client = makeClient({
            payments: [makeMpPayment({ id: 'pay-1' })],
            preapprovals: [makeMpPreapproval({ id: 'pa-1' })]
        });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            kind: 'unrecorded-payment',
            db: H.fakeDb as never
        });

        expect(report.items).toHaveLength(1);
        expect(report.items[0]?.kind).toBe('unrecorded-payment');
    });
});

// ---------------------------------------------------------------------------
// pagination
// ---------------------------------------------------------------------------

describe('computeBillingDivergences — pagination', () => {
    it('slices items by page/pageSize and keeps total/totalPages/hasNextPage coherent', async () => {
        const client = makeClient({
            payments: [
                makeMpPayment({ id: 'pay-1', date_created: '2026-08-14T00:00:00.000Z' }),
                makeMpPayment({ id: 'pay-2', date_created: '2026-08-13T00:00:00.000Z' }),
                makeMpPayment({ id: 'pay-3', date_created: '2026-08-12T00:00:00.000Z' })
            ]
        });

        const firstPage = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 2,
            db: H.fakeDb as never
        });

        expect(firstPage.items).toHaveLength(2);
        expect(firstPage.pagination).toEqual({
            page: 1,
            pageSize: 2,
            total: 3,
            totalPages: 2,
            hasNextPage: true,
            hasPreviousPage: false
        });

        const secondPage = await computeBillingDivergences({
            client: makeClient({
                payments: [
                    makeMpPayment({ id: 'pay-1', date_created: '2026-08-14T00:00:00.000Z' }),
                    makeMpPayment({ id: 'pay-2', date_created: '2026-08-13T00:00:00.000Z' }),
                    makeMpPayment({ id: 'pay-3', date_created: '2026-08-12T00:00:00.000Z' })
                ]
            }),
            since: SINCE,
            page: 2,
            pageSize: 2,
            db: H.fakeDb as never
        });

        expect(secondPage.items).toHaveLength(1);
        expect(secondPage.pagination).toEqual({
            page: 2,
            pageSize: 2,
            total: 3,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true
        });
    });
});

// ---------------------------------------------------------------------------
// money conversion
// ---------------------------------------------------------------------------

describe('computeBillingDivergences — money conversion', () => {
    it('converts MercadoPago pesos to integer centavos (18000 pesos -> 1800000 centavos)', async () => {
        const client = makeClient({
            payments: [makeMpPayment({ id: 'pay-1', transaction_amount: 18000 })]
        });

        const report = await computeBillingDivergences({
            client,
            since: SINCE,
            page: 1,
            pageSize: 20,
            db: H.fakeDb as never
        });

        const item = report.items[0];
        if (item?.kind !== 'unrecorded-payment') {
            throw new Error('expected an unrecorded-payment item');
        }
        expect(item.amountInCents).toBe(1_800_000);
    });
});
