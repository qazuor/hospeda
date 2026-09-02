/**
 * Admin orphan-payment queue routes (HOS-1001).
 *
 * Routes, mounted alongside the HOS-765 rescue tool under
 * `/api/v1/admin/billing/reconciliation`:
 *
 * - `GET  /orphan-queue`         — payments the platform took and could not book.
 * - `POST /orphan-queue/resolve` — record what a human decided about one.
 *
 * ## Why these belong next to the rescue tool
 *
 * `billing_orphan_payments` had a writer and no reader. Every row it holds is a
 * charge that needs exactly the verb the neighbouring `POST /backfill-payment`
 * performs, decided by exactly the operator that endpoint already assumes, under
 * exactly the permission it already requires. Giving the queue its own screen,
 * its own permission and its own audit vocabulary would have split one job
 * across two surfaces.
 *
 * ## Rate limits are ORDINARY here, unlike the neighbours
 *
 * `GET /divergences` is throttled to 6/min because a single call is a paced,
 * multi-second sweep of MercadoPago. This listing reads one indexed local table
 * and calls nothing external, so it gets the normal admin allowance and a
 * dashboard may poll it — which is the point of a queue with a badge.
 *
 * The resolve verb is throttled to match its siblings: it is a deliberate
 * human decision about money, not something anything should issue in a loop.
 *
 * @module routes/billing/admin/orphan-payment-queue
 */

import {
    OrphanPaymentQueueReportSchema,
    OrphanPaymentQueueSearchSchema,
    PermissionEnum,
    ResolveOrphanPaymentRequestSchema,
    ResolveOrphanPaymentResponseSchema
} from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../middlewares/actor';
import {
    listOrphanPaymentQueue,
    resolveOrphanPayment
} from '../../../services/billing/orphan-payment-queue.admin.service';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Resolve the acting staff user id, or refuse.
 *
 * Mirrors the sibling rescue routes: closing a queued payment is only meaningful
 * attached to a person, because the audit row's whole value is that it names who
 * decided the customer was (or was not) made whole.
 *
 * @param c - The request context.
 * @returns The authenticated staff actor id.
 * @throws {HTTPException} 401 when the context carries no identified actor.
 */
function requireActorId(c: Context): string {
    const actor = getActorFromContext(c);
    if (!actor?.id) {
        throw new HTTPException(401, { message: 'Authenticated staff actor required' });
    }
    return actor.id;
}

/**
 * GET /api/v1/admin/billing/reconciliation/orphan-queue
 *
 * Read-only listing of `billing_orphan_payments`. Defaults to the unresolved
 * rows — the outstanding work — and always reports the unfiltered unresolved
 * count so a narrowed view cannot hide an open incident.
 */
export const adminBillingOrphanQueueRoute = createAdminRoute({
    method: 'get',
    path: '/orphan-queue',
    summary: 'List queued orphan payments awaiting triage (admin)',
    description:
        'Lists payments a provider confirmed and Hospeda could not book — either because the subscription could not take them (HOS-714) or because the billing_payments write itself failed (HOS-1001). Read-only and purely local: costs no MercadoPago calls. Defaults to unresolved rows and always reports the unfiltered unresolved total.',
    tags: ['Billing', 'Reconciliation'],
    requiredPermissions: [PermissionEnum.BILLING_RECONCILIATION_MANAGE],
    requestQuery: OrphanPaymentQueueSearchSchema.shape,
    responseSchema: OrphanPaymentQueueReportSchema,
    handler: async (_c: Context, _params: unknown, _body: unknown, query: unknown) => {
        const filters = OrphanPaymentQueueSearchSchema.parse(query ?? {});

        return await listOrphanPaymentQueue({ filters });
    }
});

/**
 * POST /api/v1/admin/billing/reconciliation/orphan-queue/resolve
 *
 * Records an operator's verdict on one queued payment. Refuses (409) a row
 * somebody else already triaged rather than overwriting their note.
 */
export const adminBillingResolveOrphanPaymentRoute = createAdminRoute({
    method: 'post',
    path: '/orphan-queue/resolve',
    summary: 'Record the verdict on a queued orphan payment (admin)',
    description:
        'Closes one billing_orphan_payments row as resolved (the money was accounted for) or dismissed (nothing was owed), with a required operator note. Refuses (409) a row already triaged by someone else and (404) an unknown id. Never reopens a row. Writes an audit entry naming the operator and their note.',
    tags: ['Billing', 'Reconciliation'],
    requiredPermissions: [PermissionEnum.BILLING_RECONCILIATION_MANAGE],
    requestBody: ResolveOrphanPaymentRequestSchema,
    responseSchema: ResolveOrphanPaymentResponseSchema,
    options: {
        customRateLimit: { requests: 10, windowMs: 60_000 }
    },
    handler: async (c: Context, _params: unknown, body: unknown) => {
        const payload = ResolveOrphanPaymentRequestSchema.parse(body);
        const actorId = requireActorId(c);

        apiLogger.info(
            { orphanPaymentId: payload.orphanPaymentId, resolution: payload.resolution, actorId },
            'HOS-1001 admin is triaging a queued orphan payment'
        );

        return await resolveOrphanPayment({
            orphanPaymentId: payload.orphanPaymentId,
            resolution: payload.resolution,
            note: payload.note,
            actorId
        });
    }
});
