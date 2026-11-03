import { and, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { getDb } from '../client.ts';
import type { DrizzleClient } from '../types.ts';

/** Default liveness period for a cooperative background run. */
export const RUN_LEASE_TTL_MS = 5 * 60_000;

/** Table columns used by the table-agnostic run lease helper. */
export interface RunLeaseDescriptor {
    readonly table: PgTable;
    readonly id: PgColumn;
    readonly leaseUntil: PgColumn;
    readonly outcome: PgColumn;
}

function payload(
    lease: RunLeaseDescriptor,
    column: PgColumn,
    value: unknown,
    set: Readonly<Record<string, unknown>> = {}
) {
    const key = Object.entries(getTableColumns(lease.table)).find(
        ([, candidate]) => candidate === column
    )?.[0];
    if (!key) throw new Error('Run lease descriptor column is not part of its table');
    // Drizzle loses the specific table's property-key type through this generic descriptor.
    return { [key]: value, ...set } as never;
}

/**
 * Extends a run lease only while its outcome remains open.
 * Another job can adopt this helper by providing a table with `lease_until timestamptz`
 * and `outcome varchar` columns, plus its identity column.
 */
export async function extendRunLease(input: {
    readonly lease: RunLeaseDescriptor;
    readonly id: string;
    readonly ttlMs?: number;
    readonly set?: Readonly<Record<string, unknown>>;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    const db = input.tx ?? getDb();
    const leaseValue = sql`now() + (${input.ttlMs ?? RUN_LEASE_TTL_MS} * interval '1 millisecond')`;
    const [updated] = await db
        .update(input.lease.table)
        .set(payload(input.lease, input.lease.leaseUntil, leaseValue, input.set))
        .where(and(eq(input.lease.id, input.id), isNull(input.lease.outcome)))
        .returning({ id: input.lease.id });
    return updated !== undefined;
}

/** Finds open rows and computes lease liveness in PostgreSQL; NULL is expired. */
export async function findOpenRunsWithLease(input: {
    readonly lease: RunLeaseDescriptor;
    readonly tx?: DrizzleClient;
}): Promise<ReadonlyArray<Record<string, unknown> & { readonly leaseLive: boolean }>> {
    const db = input.tx ?? getDb();
    return db
        .select({
            ...getTableColumns(input.lease.table),
            leaseLive: sql<boolean>`COALESCE(${input.lease.leaseUntil} > now(), false)`
        })
        .from(input.lease.table)
        .where(isNull(input.lease.outcome));
}

/** Closes an open run once, returning null when another actor already closed it. */
export async function closeRunIfOpen(input: {
    readonly lease: RunLeaseDescriptor;
    readonly id: string;
    readonly outcome: string;
    readonly set?: Readonly<Record<string, unknown>>;
    readonly tx?: DrizzleClient;
}): Promise<Record<string, unknown> | null> {
    const db = input.tx ?? getDb();
    const [row] = await db
        .update(input.lease.table)
        .set(payload(input.lease, input.lease.outcome, input.outcome, input.set))
        .where(and(eq(input.lease.id, input.id), isNull(input.lease.outcome)))
        .returning();
    return row ?? null;
}
