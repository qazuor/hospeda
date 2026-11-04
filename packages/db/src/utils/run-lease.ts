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

/** Shared database-clock predicate for a run whose lease is still live. */
export function liveRunPredicate(lease: RunLeaseDescriptor) {
    return and(isNull(lease.outcome), sql`${lease.leaseUntil} > now()`);
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
 * Extends a run lease only while its outcome remains open AND the lease has not expired
 * (`false` means the lease is lost and the caller must stop).
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
        .where(
            and(
                eq(input.lease.id, input.id),
                isNull(input.lease.outcome),
                // A lost lease cannot be revived: once it expired another run may take over.
                sql`${input.lease.leaseUntil} > now()`
            )
        )
        .returning({ id: input.lease.id });
    return updated !== undefined;
}

/**
 * Reads one run's liveness on the database clock: `live` (open, lease in the future),
 * `abandoned` (open, lease expired or never set), `closed` (has an outcome) or `missing`.
 * Another job can adopt this for any table with the descriptor's columns and use the lease
 * state on the database clock.
 */
export async function getRunLiveness(input: {
    readonly lease: RunLeaseDescriptor;
    readonly id: string;
    readonly tx?: DrizzleClient;
}): Promise<'live' | 'abandoned' | 'closed' | 'missing'> {
    const db = input.tx ?? getDb();
    const [row] = await db
        .select({
            outcome: input.lease.outcome,
            leaseLive: sql<boolean>`COALESCE(${liveRunPredicate(input.lease)}, false)`
        })
        .from(input.lease.table)
        .where(eq(input.lease.id, input.id))
        .limit(1);
    if (!row) return 'missing';
    if (row.outcome !== null) return 'closed';
    return row.leaseLive ? 'live' : 'abandoned';
}

/** Closes an open run once, returning null when another actor already closed it. */
export async function closeRunIfOpen(input: {
    readonly lease: RunLeaseDescriptor;
    readonly id: string;
    readonly outcome: string;
    readonly set?: Readonly<Record<string, unknown>>;
    /** Close only when the lease is expired (or unset), so a renewed lease is never closed. */
    readonly onlyIfLeaseExpired?: boolean;
    readonly tx?: DrizzleClient;
}): Promise<Record<string, unknown> | null> {
    const db = input.tx ?? getDb();
    const [row] = await db
        .update(input.lease.table)
        .set(payload(input.lease, input.lease.outcome, input.outcome, input.set))
        .where(
            and(
                eq(input.lease.id, input.id),
                isNull(input.lease.outcome),
                input.onlyIfLeaseExpired
                    ? sql`(${input.lease.leaseUntil} IS NULL OR ${input.lease.leaseUntil} <= now())`
                    : undefined
            )
        )
        .returning();
    return row ?? null;
}
