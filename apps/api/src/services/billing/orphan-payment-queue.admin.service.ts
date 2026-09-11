/**
 * Orphan-payment queue READER (HOS-1001).
 *
 * ## Why this file exists
 *
 * `billing_orphan_payments` was, until HOS-1001, a write-only table. HOS-714
 * built the queue and the writer, gave it `status` / `resolutionNote` /
 * `resolvedById` / `resolvedAt` columns for triage, and stopped there: no
 * endpoint and no screen ever read a row back. A queue nobody reads does not
 * make a stranded payment recoverable — it moves it from one place nobody looks
 * at (the logs) to another.
 *
 * These two functions are that reader. They are deliberately a SIBLING of
 * `orphan-payment-queue.service.ts` rather than an addition to it: the writer
 * runs inside webhook and cron hot paths and must never throw, while everything
 * here runs behind an admin route and throws `HTTPException` the way the rest of
 * the admin surface does. Same table, opposite contracts.
 *
 * ## Where it is surfaced
 *
 * Under `/api/v1/admin/billing/reconciliation/orphan-queue`, alongside the
 * HOS-765 rescue tool and gated on the same
 * {@link PermissionEnum.BILLING_RECONCILIATION_MANAGE}. That is the natural home
 * and not an arbitrary one: a queue row says "here is a payment that needs
 * booking", the neighbouring `POST /backfill-payment` is the verb that books it,
 * and both are the same operator in the same sitting.
 *
 * @module services/billing/orphan-payment-queue.admin
 */

import { and, billingOrphanPayments, count, desc, eq, getDb } from '@repo/db';
import type {
    OrphanPaymentQueueItem,
    OrphanPaymentQueueReport,
    OrphanPaymentQueueSearch,
    OrphanPaymentResolution,
    ResolveOrphanPaymentResponse
} from '@repo/schemas';
import { OrphanPaymentQueueItemSchema } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { AuditEventType, auditLog } from '../../utils/audit-logger.js';
import { apiLogger } from '../../utils/logger.js';

/**
 * Build the `WHERE` for a queue listing from validated filters.
 *
 * `status` always contributes a clause: the search schema defaults it to
 * `unresolved` rather than leaving it optional, so "no filters" means "the
 * outstanding work" and never "every row ever queued".
 *
 * @param filters - The parsed query parameters.
 * @returns The conjunction to hand to Drizzle, always non-empty.
 */
function buildQueueFilter(filters: OrphanPaymentQueueSearch): SQL {
    const clauses: SQL[] = [eq(billingOrphanPayments.status, filters.status)];

    if (filters.flow) {
        clauses.push(eq(billingOrphanPayments.flow, filters.flow));
    }
    if (filters.reason) {
        clauses.push(eq(billingOrphanPayments.reason, filters.reason));
    }
    if (filters.livemode !== undefined) {
        clauses.push(eq(billingOrphanPayments.livemode, filters.livemode));
    }

    // `and()` of a non-empty list is always defined; the cast documents that
    // rather than adding an unreachable branch.
    return and(...clauses) as SQL;
}

/**
 * Narrow one raw row to the response shape, or refuse the whole listing.
 *
 * `flow`, `reason` and `status` are `varchar` columns whose closed vocabulary is
 * enforced only by the writer's types. A row carrying something outside those
 * enums means somebody wrote to this table by a path that does not go through
 * `recordOrphanPayment`, and the honest answer is to fail the request rather
 * than render a payment under a category the screen does not understand.
 *
 * @param row - One `billing_orphan_payments` row.
 * @returns The validated queue item.
 * @throws {HTTPException} 500 when the row's vocabulary is unrecognised.
 */
function toQueueItem(row: typeof billingOrphanPayments.$inferSelect): OrphanPaymentQueueItem {
    const parsed = OrphanPaymentQueueItemSchema.safeParse({
        id: row.id,
        provider: row.provider,
        providerPaymentId: row.providerPaymentId,
        flow: row.flow,
        reason: row.reason,
        subscriptionId: row.subscriptionId,
        customerId: row.customerId,
        amountInCents: row.amount,
        currency: row.currency,
        livemode: row.livemode,
        observedStatus: row.observedStatus,
        source: row.source,
        status: row.status,
        resolutionNote: row.resolutionNote,
        resolvedById: row.resolvedById,
        resolvedAt: row.resolvedAt,
        metadata: row.metadata,
        detectedAt: row.detectedAt
    });

    if (!parsed.success) {
        apiLogger.error(
            {
                orphanPaymentId: row.id,
                flow: row.flow,
                reason: row.reason,
                status: row.status,
                issues: parsed.error.issues
            },
            'Orphan payment queue row carries a vocabulary the reader does not recognise',
            { capture: true }
        );
        throw new HTTPException(500, {
            message: 'Orphan payment queue contains a row with an unrecognised flow/reason/status'
        });
    }

    return parsed.data;
}

/**
 * List the orphan-payment queue for an operator.
 *
 * Ordered newest incident first (`detected_at DESC`, the column that carries an
 * index for exactly this) — a stranded charge is most actionable while the payer
 * still remembers making it.
 *
 * Read-only and purely local: unlike the divergence report next door, this
 * touches no third party and costs no paced calls, which is why the route that
 * wraps it can carry an ordinary admin rate limit.
 *
 * @param params - The validated query parameters.
 * @returns Items for the requested page, its pagination, and the unfiltered
 *   count of rows still unresolved.
 */
export async function listOrphanPaymentQueue(params: {
    readonly filters: OrphanPaymentQueueSearch;
}): Promise<OrphanPaymentQueueReport> {
    const { filters } = params;
    const db = getDb();
    const where = buildQueueFilter(filters);

    const [rows, totalRows, unresolvedRows] = await Promise.all([
        db
            .select()
            .from(billingOrphanPayments)
            .where(where)
            .orderBy(desc(billingOrphanPayments.detectedAt))
            .limit(filters.pageSize)
            .offset((filters.page - 1) * filters.pageSize),
        db.select({ value: count() }).from(billingOrphanPayments).where(where),
        // Deliberately NOT scoped by `where`: this is the badge number, and it
        // must not shrink because the operator narrowed the list to one flow.
        db
            .select({ value: count() })
            .from(billingOrphanPayments)
            .where(eq(billingOrphanPayments.status, 'unresolved'))
    ]);

    const total = totalRows[0]?.value ?? 0;
    const totalPages = Math.ceil(total / filters.pageSize);

    return {
        items: rows.map(toQueueItem),
        pagination: {
            page: filters.page,
            pageSize: filters.pageSize,
            total,
            totalPages,
            hasNextPage: filters.page < totalPages,
            hasPreviousPage: filters.page > 1
        },
        unresolvedTotal: unresolvedRows[0]?.value ?? 0
    };
}

/**
 * Record an operator's verdict on one queued payment.
 *
 * The `UPDATE` is guarded on `status = 'unresolved'` in the statement itself
 * rather than by a read-then-write: two operators triaging the same backlog is
 * the expected case, and a check-then-set would let the second one silently
 * overwrite the first one's note. A zero-row update means somebody got there
 * first, and that answers 409 — not a success the caller would misread as
 * "your note was saved".
 *
 * Never reopens a row. Moving a triaged payment back to `unresolved` is a
 * decision with consequences of its own and does not belong behind the same
 * button as closing one; the schema's resolution enum excludes it.
 *
 * @param params - Row id, verdict, the operator's note and their actor id.
 * @returns The row's new state, echoed for the operator to verify.
 * @throws {HTTPException} 404 when no such row exists; 409 when it is already
 *   resolved or dismissed.
 */
export async function resolveOrphanPayment(params: {
    readonly orphanPaymentId: string;
    readonly resolution: OrphanPaymentResolution;
    readonly note: string;
    readonly actorId: string;
}): Promise<ResolveOrphanPaymentResponse> {
    const { orphanPaymentId, resolution, note, actorId } = params;
    const db = getDb();
    const resolvedAt = new Date();

    const updated = await db
        .update(billingOrphanPayments)
        .set({
            status: resolution,
            resolutionNote: note,
            resolvedById: actorId,
            resolvedAt,
            updatedAt: resolvedAt
        })
        .where(
            and(
                eq(billingOrphanPayments.id, orphanPaymentId),
                eq(billingOrphanPayments.status, 'unresolved')
            )
        )
        .returning({
            id: billingOrphanPayments.id,
            providerPaymentId: billingOrphanPayments.providerPaymentId,
            amount: billingOrphanPayments.amount,
            currency: billingOrphanPayments.currency,
            flow: billingOrphanPayments.flow,
            reason: billingOrphanPayments.reason,
            livemode: billingOrphanPayments.livemode
        });

    const row = updated[0];
    if (!row) {
        // Nothing was updated: either the id is unknown, or the row was already
        // triaged. Tell those two apart, because the operator's next move is
        // completely different — retype the id, or go read someone else's note.
        const existing = await db
            .select({ status: billingOrphanPayments.status })
            .from(billingOrphanPayments)
            .where(eq(billingOrphanPayments.id, orphanPaymentId))
            .limit(1);

        if (existing.length === 0) {
            throw new HTTPException(404, { message: 'Orphan payment not found' });
        }
        throw new HTTPException(409, {
            message: `Orphan payment is already ${existing[0]?.status}`
        });
    }

    const auditedAt = new Date();
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId,
        action: 'update',
        resourceType: 'billing_orphan_payment',
        resourceId: orphanPaymentId,
        metadata: {
            reconcileAction: 'resolve-orphan-payment',
            resolution,
            note,
            providerPaymentId: row.providerPaymentId,
            amountInCents: row.amount,
            currency: row.currency,
            flow: row.flow,
            reason: row.reason,
            livemode: row.livemode,
            auditedAt: auditedAt.toISOString()
        }
    });

    apiLogger.info(
        {
            orphanPaymentId,
            resolution,
            actorId,
            providerPaymentId: row.providerPaymentId,
            amountInCents: row.amount,
            currency: row.currency,
            livemode: row.livemode
        },
        'Orphan payment triaged by an operator'
    );

    return {
        orphanPaymentId,
        status: resolution,
        providerPaymentId: row.providerPaymentId,
        resolvedAt,
        auditedAt
    };
}
