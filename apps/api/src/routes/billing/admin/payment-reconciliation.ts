/**
 * Admin orphan-payment rescue routes (HOS-765).
 *
 * Routes, all under `/api/v1/admin/billing/reconciliation`:
 *
 * - `GET  /divergences`      — what MercadoPago has that the local ledger does not.
 * - `POST /force-link`       — bind a preapproval to a local subscription.
 * - `POST /backfill-payment` — write the `billing_payments` row for a settled charge.
 *
 * ## Why these do not hang off `BILLING_MANAGE`
 *
 * Every one of them is gated on {@link PermissionEnum.BILLING_RECONCILIATION_MANAGE},
 * a permission that exists for this surface alone. The two write verbs put money
 * into the ledger and bind a stranger's charge to a named person's subscription;
 * folding them into the permission that also expires an add-on would mean the
 * grant that opens the small thing opens the large one too. Following the
 * precedent set by SPEC-164 for the rest of billing, the seed grants it to
 * SUPER_ADMIN only.
 *
 * The report is gated identically rather than on a softer read permission. It is
 * not a read-only convenience: it lists the payer emails of real people beside
 * the amounts they were charged, and it has no audience other than someone about
 * to act on it.
 *
 * ## The report costs paced MercadoPago calls
 *
 * `GET /divergences` sweeps MercadoPago with 350 ms between requests (an
 * empirical floor — see `utils/mp-reconciliation-search.ts`), so a wide `since`
 * takes real seconds. Its rate limit is therefore much tighter than the sibling
 * billing admin routes: this is a deliberate, expensive operator action, not
 * something a dashboard should poll.
 *
 * @module routes/billing/admin/payment-reconciliation
 */

import {
    BackfillPaymentRequestSchema,
    BackfillPaymentResponseSchema,
    BillingDivergenceReportSchema,
    BillingDivergenceSearchSchema,
    ForceLinkPreapprovalRequestSchema,
    ForceLinkPreapprovalResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../middlewares/actor';
import { getQZPayBilling } from '../../../middlewares/billing';
import {
    computeBillingDivergences,
    DEFAULT_DIVERGENCE_WINDOW_DAYS
} from '../../../services/billing/payment-divergence.service';
import {
    backfillPayment,
    forceLinkPreapproval
} from '../../../services/billing/payment-reconcile.service';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { MpPacedClient } from '../../../utils/mp-reconciliation-search';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Build the paced MercadoPago client for one request.
 *
 * A NEW instance per request on purpose: the pacing gate is per-instance, and a
 * module-level singleton shared across concurrent operator requests would
 * serialise them into one queue — turning two simultaneous reports into one that
 * takes twice as long, with no way for either caller to know why.
 *
 * @returns A client bound to the configured access token.
 * @throws {HTTPException} 503 when MercadoPago is not configured for this
 *   environment. Not a 500: nothing is broken, the integration is simply absent,
 *   and the operator needs to read that as "configure it", not "file a bug".
 */
function requireMpClient(): MpPacedClient {
    const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        throw new HTTPException(503, {
            message: 'MercadoPago access token is not configured for this environment'
        });
    }
    return new MpPacedClient({ accessToken });
}

/**
 * Resolve the acting staff user id, or refuse.
 *
 * These verbs are only meaningful attached to a person: the audit row's whole
 * value is that it names who decided. An actor without an id is a state the
 * admin middleware should already have excluded, so reaching here means
 * something upstream changed and the safe answer is to refuse rather than write
 * an anonymous money mutation.
 */
function requireActorId(c: Context): string {
    const actor = getActorFromContext(c);
    if (!actor?.id) {
        throw new HTTPException(401, { message: 'Authenticated staff actor required' });
    }
    return actor.id;
}

/**
 * GET /api/v1/admin/billing/reconciliation/divergences
 *
 * Read-only. Lists approved MercadoPago payments with no `billing_payments` row
 * and authorized preapprovals no local subscription claims, each with the local
 * rows it could belong to and the signals that proposed them.
 */
export const adminBillingDivergencesRoute = createAdminRoute({
    method: 'get',
    path: '/divergences',
    summary: 'List MercadoPago/local billing divergences (admin)',
    description:
        'Sweeps MercadoPago for approved payments with no local billing_payments row and for authorized preapprovals no local subscription points at. Read-only: it proposes candidates and never links anything. Costs paced MercadoPago calls, so the window is bounded and the response reports whether the sweep was truncated.',
    tags: ['Billing', 'Reconciliation'],
    requiredPermissions: [PermissionEnum.BILLING_RECONCILIATION_MANAGE],
    requestQuery: BillingDivergenceSearchSchema.shape,
    responseSchema: BillingDivergenceReportSchema,
    options: {
        // Far tighter than the 50/min the rest of admin billing gets: one call
        // here is a multi-second paced sweep of a third party.
        customRateLimit: { requests: 6, windowMs: 60_000 }
    },
    handler: async (c: Context, _params: unknown, _body: unknown, query: unknown) => {
        const filters = BillingDivergenceSearchSchema.parse(query ?? {});
        const client = requireMpClient();

        const since = filters.since
            ? new Date(filters.since)
            : new Date(Date.now() - DEFAULT_DIVERGENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

        apiLogger.info(
            { since: since.toISOString(), kind: filters.kind, page: filters.page },
            'HOS-765 admin requested the billing divergence report'
        );

        return await computeBillingDivergences({
            client,
            since,
            page: filters.page,
            pageSize: filters.pageSize,
            ...(filters.kind ? { kind: filters.kind } : {})
        });
    }
});

/**
 * POST /api/v1/admin/billing/reconciliation/force-link
 *
 * Binds a MercadoPago preapproval to a local subscription an operator named
 * explicitly. Refuses rather than overwriting an existing binding on either side.
 */
export const adminBillingForceLinkRoute = createAdminRoute({
    method: 'post',
    path: '/force-link',
    summary: 'Force-link a preapproval to a local subscription (admin)',
    description:
        'Binds a MercadoPago preapproval to the local subscription the operator named. Refuses (409) when either side is already bound elsewhere or the local status cannot receive a link. Writes an audit entry naming the operator and their stated reason.',
    tags: ['Billing', 'Reconciliation'],
    requiredPermissions: [PermissionEnum.BILLING_RECONCILIATION_MANAGE],
    requestBody: ForceLinkPreapprovalRequestSchema,
    responseSchema: ForceLinkPreapprovalResponseSchema,
    options: {
        customRateLimit: { requests: 10, windowMs: 60_000 }
    },
    handler: async (c: Context, _params: unknown, body: unknown) => {
        const payload = ForceLinkPreapprovalRequestSchema.parse(body);
        const actorId = requireActorId(c);
        const client = requireMpClient();

        return await forceLinkPreapproval({
            preapprovalId: payload.preapprovalId,
            localSubscriptionId: payload.localSubscriptionId,
            reason: payload.reason,
            actorId,
            client
        });
    }
});

/**
 * POST /api/v1/admin/billing/reconciliation/backfill-payment
 *
 * Writes the `billing_payments` row for a MercadoPago charge that already
 * settled and was never recorded. Only an approved payment is eligible.
 */
export const adminBillingBackfillPaymentRoute = createAdminRoute({
    method: 'post',
    path: '/backfill-payment',
    summary: 'Backfill a settled MercadoPago payment into the ledger (admin)',
    description:
        'Records a billing_payments row for an approved MercadoPago charge that was never written. Idempotent on the MercadoPago payment id. Refuses (422) a payment that is not approved and (409) one that names a preapproval another subscription owns. Writes an audit entry naming the operator and their stated reason.',
    tags: ['Billing', 'Reconciliation'],
    requiredPermissions: [PermissionEnum.BILLING_RECONCILIATION_MANAGE],
    requestBody: BackfillPaymentRequestSchema,
    responseSchema: BackfillPaymentResponseSchema,
    options: {
        customRateLimit: { requests: 10, windowMs: 60_000 }
    },
    handler: async (c: Context, _params: unknown, body: unknown) => {
        const payload = BackfillPaymentRequestSchema.parse(body);
        const actorId = requireActorId(c);
        const client = requireMpClient();

        const billing = getQZPayBilling();
        if (!billing) {
            throw new HTTPException(503, {
                message: 'Billing service is unavailable in this environment'
            });
        }

        return await backfillPayment({
            mpPaymentId: payload.mpPaymentId,
            localSubscriptionId: payload.localSubscriptionId,
            reason: payload.reason,
            actorId,
            billing,
            client
        });
    }
});

/**
 * Reconciliation router.
 * Mounted under /api/v1/admin/billing/reconciliation by admin/index.ts.
 */
export const adminBillingReconciliationRouter = createRouter();

adminBillingReconciliationRouter.route('/', adminBillingDivergencesRoute);
adminBillingReconciliationRouter.route('/', adminBillingForceLinkRoute);
adminBillingReconciliationRouter.route('/', adminBillingBackfillPaymentRoute);
