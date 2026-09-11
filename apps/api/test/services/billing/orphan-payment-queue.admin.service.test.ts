/**
 * Tests for the orphan-payment queue READER (HOS-1001).
 *
 * The queue had a writer and no reader: `billing_orphan_payments` was a
 * write-only table with no endpoint and no screen, so even a correctly enqueued
 * stranded payment landed somewhere nobody could look. These tests cover the
 * half that closes that.
 *
 * Four things must hold and are asserted here:
 *
 *  1. The listing DEFAULTS to unresolved rows — the outstanding work — and
 *     reports the unfiltered unresolved count regardless of the active filter,
 *     so narrowing the view cannot hide an open incident.
 *  2. A row whose `flow`/`reason`/`status` is outside the closed vocabulary
 *     FAILS the request instead of being rendered as something it is not.
 *  3. Resolving is guarded IN THE UPDATE, so two operators triaging the same
 *     backlog cannot silently overwrite each other's note.
 *  4. Resolving writes an audit entry naming the operator and their note.
 *
 * The `@repo/db` mock here is LOCAL (it overrides the global stub in
 * `test/setup.ts`). Assertions target what THIS code hands to Drizzle — the
 * filters, the ordering, the `set` values and the guard on the update — never
 * Drizzle's own SQL behaviour, which the stub cannot model.
 *
 * @module test/services/billing/orphan-payment-queue.admin.service
 */
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The awaitable select builder the `@repo/db` mock hands back. */
interface SelectChain extends Promise<unknown[]> {
    from(): SelectChain;
    where(cond: unknown): SelectChain;
    orderBy(order: unknown): SelectChain;
    limit(n: number): SelectChain;
    offset(n: number): SelectChain;
}

const { mockAuditLog, mockLoggerError, dbState } = vi.hoisted(() => ({
    mockAuditLog: vi.fn(),
    mockLoggerError: vi.fn(),
    dbState: {
        /**
         * Results handed to consecutive `select()` chains, in call order.
         *
         * `listOrphanPaymentQueue` issues exactly three (rows, filtered count,
         * unfiltered unresolved count); `resolveOrphanPayment`'s miss path
         * issues one.
         */
        selectResults: [] as unknown[][],
        selectIndex: 0,
        /** Captured `where` conditions per select, in the same order. */
        selectWheres: [] as unknown[],
        /** Captured `orderBy` / `limit` / `offset` from the listing chain. */
        listOrder: null as unknown,
        listLimit: null as number | null,
        listOffset: null as number | null,
        /** Rows the update's `.returning()` resolves with. Empty = guard blocked it. */
        updateReturning: [] as Array<Record<string, unknown>>,
        /** Captured update `set()` values and `where()` condition. */
        updateCalls: [] as Array<{ values: unknown; where: unknown }>
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        error: mockLoggerError,
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: mockAuditLog,
    AuditEventType: { BILLING_MUTATION: 'BILLING_MUTATION' }
}));

vi.mock('@repo/db', () => {
    /**
     * A stand-in for a Drizzle select builder.
     *
     * Built as a REAL promise with the builder methods attached, rather than an
     * object carrying a `then`: the service awaits the builder without a
     * terminal call (Drizzle's builders are awaitable), so the mock has to be
     * genuinely awaitable, and a hand-rolled thenable is the shape lint
     * correctly objects to.
     *
     * The row list is consumed in CREATION order, which is the order the service
     * issues the selects in — every builder is constructed synchronously inside
     * one `Promise.all` literal, so its settle callback is queued in that order
     * and the `where()` calls all land before any of them run.
     */
    function makeSelectChain(): SelectChain {
        const chain = Promise.resolve().then(() => {
            const rows = dbState.selectResults[dbState.selectIndex] ?? [];
            dbState.selectIndex += 1;
            return rows;
        }) as SelectChain;

        chain.from = () => chain;
        chain.where = (cond: unknown) => {
            dbState.selectWheres.push(cond);
            return chain;
        };
        chain.orderBy = (order: unknown) => {
            dbState.listOrder = order;
            return chain;
        };
        chain.limit = (n: number) => {
            dbState.listLimit = n;
            return chain;
        };
        chain.offset = (n: number) => {
            dbState.listOffset = n;
            return chain;
        };

        return chain;
    }

    return {
        billingOrphanPayments: {
            id: 'ID',
            status: 'STATUS',
            flow: 'FLOW',
            reason: 'REASON',
            livemode: 'LIVEMODE',
            detectedAt: 'DETECTED_AT',
            providerPaymentId: 'PROVIDER_PAYMENT_ID',
            amount: 'AMOUNT',
            currency: 'CURRENCY'
        },
        and: (...conds: unknown[]) => ({ __and: conds }),
        count: () => ({ __count: true }),
        desc: (col: unknown) => ({ __desc: col }),
        eq: (col: unknown, value: unknown) => ({ __eq: [col, value] }),
        getDb: () => ({
            select: () => makeSelectChain(),
            update: () => ({
                set: (values: unknown) => ({
                    where: (where: unknown) => ({
                        returning: async () => {
                            dbState.updateCalls.push({ values, where });
                            return dbState.updateReturning;
                        }
                    })
                })
            })
        })
    };
});

import {
    listOrphanPaymentQueue,
    resolveOrphanPayment
} from '../../../src/services/billing/orphan-payment-queue.admin.service';

/** One well-formed `billing_orphan_payments` row, as Drizzle would return it. */
function makeRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        provider: 'mercadopago',
        providerPaymentId: 'mp-payment-42',
        flow: 'annual-upfront',
        reason: 'ledger-write-failed',
        subscriptionId: '22222222-2222-4222-8222-222222222222',
        customerId: '33333333-3333-4333-8333-333333333333',
        amount: 35_000_000,
        currency: 'ARS',
        livemode: true,
        observedStatus: 'pending_provider',
        source: 'webhook',
        status: 'unresolved',
        resolutionNote: null,
        resolvedById: null,
        resolvedAt: null,
        metadata: { ledgerWriteError: 'insert exploded' },
        detectedAt: new Date('2026-09-01T10:00:00.000Z'),
        ...overrides
    };
}

/** The search shape after `OrphanPaymentQueueSearchSchema` has applied defaults. */
function makeFilters(overrides: Record<string, unknown> = {}) {
    return {
        status: 'unresolved' as const,
        page: 1,
        pageSize: 20,
        ...overrides
    } as Parameters<typeof listOrphanPaymentQueue>[0]['filters'];
}

beforeEach(() => {
    vi.clearAllMocks();
    dbState.selectResults = [];
    dbState.selectIndex = 0;
    dbState.selectWheres.length = 0;
    dbState.listOrder = null;
    dbState.listLimit = null;
    dbState.listOffset = null;
    dbState.updateReturning = [];
    dbState.updateCalls.length = 0;
});

describe('listOrphanPaymentQueue', () => {
    it('maps a queue row onto the response shape, amount included', async () => {
        // Arrange
        dbState.selectResults = [[makeRow()], [{ value: 1 }], [{ value: 1 }]];

        // Act
        const report = await listOrphanPaymentQueue({ filters: makeFilters() });

        // Assert
        expect(report.items).toHaveLength(1);
        const item = report.items[0];
        expect(item?.providerPaymentId).toBe('mp-payment-42');
        expect(item?.flow).toBe('annual-upfront');
        expect(item?.reason).toBe('ledger-write-failed');
        // The column is already centavos; the reader never converts.
        expect(item?.amountInCents).toBe(35_000_000);
        expect(item?.livemode).toBe(true);
        expect(item?.metadata).toEqual({ ledgerWriteError: 'insert exploded' });
    });

    it('orders newest incident first and pages with page/pageSize', async () => {
        // Arrange
        dbState.selectResults = [[], [{ value: 0 }], [{ value: 0 }]];

        // Act
        await listOrphanPaymentQueue({ filters: makeFilters({ page: 3, pageSize: 10 }) });

        // Assert
        expect(dbState.listOrder).toEqual({ __desc: 'DETECTED_AT' });
        expect(dbState.listLimit).toBe(10);
        expect(dbState.listOffset).toBe(20);
    });

    it('always filters by status, so an unfiltered call means "the outstanding work"', async () => {
        // Arrange
        dbState.selectResults = [[], [{ value: 0 }], [{ value: 0 }]];

        // Act
        await listOrphanPaymentQueue({ filters: makeFilters() });

        // Assert — the listing's own WHERE carries the status clause.
        expect(dbState.selectWheres[0]).toEqual({ __and: [{ __eq: ['STATUS', 'unresolved'] }] });
    });

    it('adds flow, reason and livemode clauses only when those filters are present', async () => {
        // Arrange
        dbState.selectResults = [[], [{ value: 0 }], [{ value: 0 }]];

        // Act
        await listOrphanPaymentQueue({
            filters: makeFilters({
                status: 'resolved',
                flow: 'addon-purchase',
                reason: 'ledger-write-failed',
                livemode: false
            })
        });

        // Assert
        expect(dbState.selectWheres[0]).toEqual({
            __and: [
                { __eq: ['STATUS', 'resolved'] },
                { __eq: ['FLOW', 'addon-purchase'] },
                { __eq: ['REASON', 'ledger-write-failed'] },
                { __eq: ['LIVEMODE', false] }
            ]
        });
    });

    it('reports unresolvedTotal from an UNFILTERED count, not the filtered one', async () => {
        // A filtered badge would let an operator make an open incident vanish
        // from the screen by narrowing to another flow.
        // Arrange: 1 row matches the filter; 7 rows are unresolved overall.
        dbState.selectResults = [[makeRow()], [{ value: 1 }], [{ value: 7 }]];

        // Act
        const report = await listOrphanPaymentQueue({
            filters: makeFilters({ flow: 'addon-purchase' })
        });

        // Assert
        expect(report.pagination.total).toBe(1);
        expect(report.unresolvedTotal).toBe(7);

        // The third select's WHERE carries ONLY the unresolved clause — no
        // flow, no reason, no livemode.
        expect(dbState.selectWheres[2]).toEqual({ __eq: ['STATUS', 'unresolved'] });
    });

    it('computes pagination flags from the filtered total', async () => {
        // Arrange: 45 matching rows, page 2 of 20.
        dbState.selectResults = [[makeRow()], [{ value: 45 }], [{ value: 45 }]];

        // Act
        const report = await listOrphanPaymentQueue({ filters: makeFilters({ page: 2 }) });

        // Assert
        expect(report.pagination).toMatchObject({
            page: 2,
            pageSize: 20,
            total: 45,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: true
        });
    });

    it('refuses the whole listing when a row carries an unrecognised vocabulary', async () => {
        // A row outside the closed vocabulary means somebody wrote to this table
        // by a path that does not go through `recordOrphanPayment`. Rendering it
        // under a category the screen invented would be worse than refusing.
        // Arrange
        dbState.selectResults = [
            [makeRow({ reason: 'something-nobody-declared' })],
            [{ value: 1 }],
            [{ value: 1 }]
        ];

        // Act / Assert
        await expect(listOrphanPaymentQueue({ filters: makeFilters() })).rejects.toBeInstanceOf(
            HTTPException
        );
        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'something-nobody-declared' }),
            expect.stringContaining('vocabulary the reader does not recognise'),
            { capture: true }
        );
    });
});

describe('resolveOrphanPayment', () => {
    const ORPHAN_ID = '11111111-1111-4111-8111-111111111111';

    /** What the guarded UPDATE returns when it actually closed the row. */
    function closedRow() {
        return [
            {
                id: ORPHAN_ID,
                providerPaymentId: 'mp-payment-42',
                amount: 35_000_000,
                currency: 'ARS',
                flow: 'annual-upfront',
                reason: 'ledger-write-failed',
                livemode: true
            }
        ];
    }

    it('writes the verdict, the note and the operator onto the row', async () => {
        // Arrange
        dbState.updateReturning = closedRow();

        // Act
        const result = await resolveOrphanPayment({
            orphanPaymentId: ORPHAN_ID,
            resolution: 'resolved',
            note: 'Backfilled through the rescue tool, payment 42.',
            actorId: 'staff-1'
        });

        // Assert
        expect(result.status).toBe('resolved');
        expect(result.providerPaymentId).toBe('mp-payment-42');

        expect(dbState.updateCalls).toHaveLength(1);
        const values = dbState.updateCalls[0]?.values as Record<string, unknown>;
        expect(values.status).toBe('resolved');
        expect(values.resolutionNote).toBe('Backfilled through the rescue tool, payment 42.');
        expect(values.resolvedById).toBe('staff-1');
        expect(values.resolvedAt).toBeInstanceOf(Date);
    });

    it('guards the UPDATE on status=unresolved, not a read-then-write', async () => {
        // Two operators triaging the same backlog is the expected case; a
        // check-then-set would let the second silently overwrite the first.
        // Arrange
        dbState.updateReturning = closedRow();

        // Act
        await resolveOrphanPayment({
            orphanPaymentId: ORPHAN_ID,
            resolution: 'dismissed',
            note: 'Sandbox test charge, nothing owed.',
            actorId: 'staff-1'
        });

        // Assert
        expect(dbState.updateCalls[0]?.where).toEqual({
            __and: [{ __eq: ['ID', ORPHAN_ID] }, { __eq: ['STATUS', 'unresolved'] }]
        });
    });

    it('audits the resolution with the operator, the note and the money', async () => {
        // Arrange
        dbState.updateReturning = closedRow();

        // Act
        await resolveOrphanPayment({
            orphanPaymentId: ORPHAN_ID,
            resolution: 'resolved',
            note: 'Refunded in full via MercadoPago.',
            actorId: 'staff-7'
        });

        // Assert
        expect(mockAuditLog).toHaveBeenCalledOnce();
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: 'BILLING_MUTATION',
                actorId: 'staff-7',
                action: 'update',
                resourceType: 'billing_orphan_payment',
                resourceId: ORPHAN_ID,
                metadata: expect.objectContaining({
                    reconcileAction: 'resolve-orphan-payment',
                    resolution: 'resolved',
                    note: 'Refunded in full via MercadoPago.',
                    providerPaymentId: 'mp-payment-42',
                    amountInCents: 35_000_000,
                    livemode: true
                })
            })
        );
    });

    it('answers 404 when the id names no row at all', async () => {
        // Arrange: the guarded update matched nothing, and neither does the
        // follow-up lookup.
        dbState.updateReturning = [];
        dbState.selectResults = [[]];

        // Act / Assert
        await expect(
            resolveOrphanPayment({
                orphanPaymentId: ORPHAN_ID,
                resolution: 'resolved',
                note: 'This id does not exist.',
                actorId: 'staff-1'
            })
        ).rejects.toMatchObject({ status: 404 });
        expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('answers 409 when somebody else already triaged the row', async () => {
        // Arrange: the guarded update matched nothing BECAUSE the row is closed.
        dbState.updateReturning = [];
        dbState.selectResults = [[{ status: 'dismissed' }]];

        // Act / Assert
        await expect(
            resolveOrphanPayment({
                orphanPaymentId: ORPHAN_ID,
                resolution: 'resolved',
                note: 'Trying to close it a second time.',
                actorId: 'staff-2'
            })
        ).rejects.toMatchObject({ status: 409 });

        // Nothing was audited: no state changed, so there is nothing to record.
        expect(mockAuditLog).not.toHaveBeenCalled();
    });
});
