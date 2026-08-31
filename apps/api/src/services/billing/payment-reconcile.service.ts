/**
 * Operator-driven rescue of an orphan payment or preapproval (HOS-765).
 *
 * The two write verbs HOS-276 asked for and never got:
 *
 * - {@link forceLinkPreapproval} — bind a MercadoPago preapproval to a local
 *   subscription.
 * - {@link backfillPayment} — write the `billing_payments` row for a charge that
 *   already settled and was never recorded.
 *
 * ## What replaces the old recovery path
 *
 * Until now the only way to rescue a link was to call
 * `POST /protected/billing/subscriptions/link-preapproval` **from the affected
 * customer's own authenticated session**. It worked, and it was wrong on three
 * counts: it needed that person's session, it had no screen, and it left no
 * trace that an operator had intervened. And the payment half had no path at
 * all — the webhooks had already answered 200, so MercadoPago never retried.
 *
 * These functions are the replacement. They are ADMIN-tier, they take the
 * operator's actor id, and **every call writes an audit entry before returning**
 * (`AuditEventType.BILLING_MUTATION`, which
 * `apps/api/src/lib/audit-log-sink.ts` persists to `audit_log_entries`). That
 * is not decoration: these verbs move a real charge onto a real person's
 * subscription, and "who decided this, and why" has to outlive the session that
 * decided it.
 *
 * ## They refuse rather than guess
 *
 * Neither function searches for a target. Both take an explicit
 * `localSubscriptionId` that an operator typed after reading the divergence
 * report's evidence, and both refuse (409) rather than overwrite an existing
 * binding. The linking heuristics live in `link-preapproval.service.ts` and are
 * deliberately NOT reused here: those tiers exist to decide automatically from
 * weak signals, and the entire reason this module exists is that the weak
 * signals were not good enough.
 *
 * @module services/billing/payment-reconcile
 */

import type { QZPayBilling, QZPayCurrency } from '@qazuor/qzpay-core';
import type { Major } from '@repo/billing';
import { toCentavos } from '@repo/billing';
import {
    and,
    billingPayments,
    billingPendingCheckoutModel,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    inArray,
    isNull
} from '@repo/db';
import type { BackfillPaymentResponse, ForceLinkPreapprovalResponse } from '@repo/schemas';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { AuditEventType, auditLog } from '../../utils/audit-logger.js';
import { apiLogger } from '../../utils/logger.js';
import {
    fetchPaymentById,
    fetchPreapprovalById,
    type MpPacedClient
} from '../../utils/mp-reconciliation-search.js';

/** Provider key every MercadoPago row in this repo is written under. */
const MP_PROVIDER_KEY = 'mercadopago';

/**
 * Local statuses a force-link is allowed to write onto.
 *
 * `abandoned` is included on purpose and is most of the point: the reaper marks
 * a slow Path C checkout abandoned WITHOUT cancelling any preapproval (there was
 * none to cancel yet), so the row an operator most often needs to rescue is
 * precisely an abandoned one. Every other status — `active`, `trialing`,
 * `cancelled` — is either already correct or deliberately terminal, and binding
 * a preapproval onto it would be a silent state change rather than a repair.
 */
const LINKABLE_STATUSES = [
    SubscriptionStatusEnum.PENDING_PROVIDER,
    SubscriptionStatusEnum.ABANDONED
] as const;

/** Common input for both rescue verbs. */
interface ReconcileActorContext {
    /** The staff user performing the action. Recorded verbatim in the audit row. */
    readonly actorId: string;
    /** The operator's own justification. Required; see the schema's JSDoc. */
    readonly reason: string;
}

/**
 * Look up a local subscription, or 404.
 *
 * 404 rather than a softer code for a missing id: per the API error contract, a
 * resource that does not exist and a resource the caller may not see answer
 * identically, so nothing here leaks whether an id is real.
 */
async function requireLocalSubscription(params: {
    readonly db: DrizzleClient;
    readonly localSubscriptionId: string;
}): Promise<{
    readonly id: string;
    readonly customerId: string;
    readonly status: string;
    readonly mpSubscriptionId: string | null;
    readonly livemode: boolean | null;
}> {
    const [row] = await params.db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
            livemode: billingSubscriptions.livemode
        })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, params.localSubscriptionId))
        .limit(1);

    if (!row) {
        throw new HTTPException(404, { message: 'Local subscription not found' });
    }
    return row;
}

/**
 * Bind a MercadoPago preapproval to a local subscription, by operator decision.
 *
 * Refuses (409) when either side is already bound to something else. Idempotent
 * for the exact same pair, which reports `'already-linked'` so a double click
 * does not read as a second binding in the audit trail.
 *
 * The MercadoPago preapproval is re-read live before the write. Not
 * belt-and-braces: an operator acts off a report that may be minutes old, and
 * binding a preapproval that MercadoPago has since cancelled would write a link
 * to nothing.
 *
 * @param input - Preapproval, target subscription, operator context and clients.
 * @returns What the call did, plus the resulting local status.
 * @throws {HTTPException} 404 when either side is unknown; 409 on a conflicting
 *   binding or a non-linkable local status.
 */
export async function forceLinkPreapproval(
    input: ReconcileActorContext & {
        readonly preapprovalId: string;
        readonly localSubscriptionId: string;
        readonly client: MpPacedClient;
        readonly db?: DrizzleClient;
    }
): Promise<ForceLinkPreapprovalResponse> {
    const { preapprovalId, localSubscriptionId, actorId, reason, client } = input;
    const db = input.db ?? getDb();

    // 1. The preapproval must still exist on MercadoPago's side.
    const preapproval = await fetchPreapprovalById({ client, preapprovalId });
    if (!preapproval) {
        throw new HTTPException(404, { message: 'Preapproval not found at MercadoPago' });
    }

    // 2. Nobody else may already own it.
    const [claimedBy] = await db
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.mpSubscriptionId, preapprovalId))
        .limit(1);

    const target = await requireLocalSubscription({ db, localSubscriptionId });

    if (claimedBy) {
        if (claimedBy.id === localSubscriptionId) {
            return {
                outcome: 'already-linked',
                preapprovalId,
                localSubscriptionId,
                localSubscriptionStatus: target.status,
                auditedAt: recordReconcileAudit({
                    actorId,
                    reason,
                    action: 'force-link',
                    resourceId: preapprovalId,
                    metadata: {
                        localSubscriptionId,
                        outcome: 'already-linked',
                        mpStatus: preapproval.status
                    }
                })
            };
        }
        throw new HTTPException(409, {
            message: 'Preapproval is already linked to a different local subscription'
        });
    }

    // 3. The target must not already carry a DIFFERENT preapproval. Overwriting
    //    one would silently orphan the charge it currently explains.
    if (target.mpSubscriptionId && target.mpSubscriptionId !== preapprovalId) {
        throw new HTTPException(409, {
            message: 'Local subscription already carries a different preapproval'
        });
    }

    if (!LINKABLE_STATUSES.some((status) => status === target.status)) {
        throw new HTTPException(409, {
            message: `Local subscription status "${target.status}" cannot receive a preapproval link`
        });
    }

    // 4. Compare-and-set, so a concurrent webhook cannot be clobbered. The
    //    status flip to `pending_provider` revives an abandoned row so the
    //    subsequent provider webhook's transition into active/trialing is legal.
    const [updated] = await db
        .update(billingSubscriptions)
        .set({
            mpSubscriptionId: preapprovalId,
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingSubscriptions.id, localSubscriptionId),
                isNull(billingSubscriptions.mpSubscriptionId),
                inArray(billingSubscriptions.status, [...LINKABLE_STATUSES])
            )
        )
        .returning({ id: billingSubscriptions.id, status: billingSubscriptions.status });

    if (!updated) {
        // Lost the race to a concurrent linking attempt for the same row.
        throw new HTTPException(409, {
            message: 'Local subscription changed while linking; re-read the report and retry'
        });
    }

    // 5. Drop the customer's cached entitlement set.
    //
    //    Both the statuses this link can write ONTO (`abandoned`,
    //    `pending_provider`) and the status it writes are non-entitling, so on
    //    paper nothing cached changed. The call is here anyway, and deliberately:
    //    it is one cache eviction against the failure mode where an operator
    //    rescues a subscription and the customer still cannot use their account
    //    until a 5-minute TTL lapses. The HOS-453 guard exists precisely because
    //    writers to this table shipped without anyone MAKING this decision, so
    //    making it in the safe direction is the point rather than a shortcut.
    clearEntitlementCache(target.customerId);

    // 6. Retire the correlation row, best-effort. A failure here leaves a stale
    //    pending checkout, which the reaper handles; it must not fail a link that
    //    has already been written.
    try {
        const checkout = await billingPendingCheckoutModel.findByLocalSubscriptionId({
            localSubscriptionId
        });
        if (checkout) {
            await billingPendingCheckoutModel.markLinked({ id: checkout.id });
        }
    } catch (err) {
        apiLogger.warn(
            {
                preapprovalId,
                localSubscriptionId,
                error: err instanceof Error ? err.message : String(err)
            },
            'HOS-765 force-link: could not retire the pending checkout (link already written)'
        );
    }

    const auditedAt = recordReconcileAudit({
        actorId,
        reason,
        action: 'force-link',
        resourceId: preapprovalId,
        metadata: {
            localSubscriptionId,
            outcome: 'linked',
            previousStatus: target.status,
            mpStatus: preapproval.status,
            mpNextPaymentDate: preapproval.nextPaymentDate
        }
    });

    apiLogger.info(
        { actorId, preapprovalId, localSubscriptionId, previousStatus: target.status },
        'HOS-765 force-link: preapproval bound to local subscription by operator'
    );

    return {
        outcome: 'linked',
        preapprovalId,
        localSubscriptionId,
        localSubscriptionStatus: updated.status ?? SubscriptionStatusEnum.PENDING_PROVIDER,
        auditedAt
    };
}

/**
 * Write the `billing_payments` row for a MercadoPago charge that already settled.
 *
 * Only an APPROVED payment is eligible. A pending or rejected charge has not
 * moved money, so recording it would put a liability in the ledger that does not
 * exist — the opposite of the hole this closes.
 *
 * Idempotent on the MercadoPago payment id: a second call reports
 * `'already-recorded'` and writes nothing. That check reads across ALL
 * `billing_payments` rows including soft-deleted ones, because a row that was
 * written and later soft-deleted is still a payment the system knows about, and
 * backfilling over it would duplicate the charge.
 *
 * @param input - MercadoPago payment, target subscription, operator context.
 * @returns What the call did, plus the amount actually recorded.
 * @throws {HTTPException} 404 when the payment or subscription is unknown;
 *   422 when the payment is not approved; 409 when it belongs elsewhere.
 */
export async function backfillPayment(
    input: ReconcileActorContext & {
        readonly mpPaymentId: string;
        readonly localSubscriptionId: string;
        readonly billing: QZPayBilling;
        readonly client: MpPacedClient;
        readonly db?: DrizzleClient;
    }
): Promise<BackfillPaymentResponse> {
    const { mpPaymentId, localSubscriptionId, actorId, reason, billing, client } = input;
    const db = input.db ?? getDb();

    const payment = await fetchPaymentById({ client, mpPaymentId });
    if (!payment) {
        throw new HTTPException(404, { message: 'Payment not found at MercadoPago' });
    }
    if (payment.status !== 'approved') {
        throw new HTTPException(422, {
            message: `Payment status is "${payment.status}"; only an approved payment can be backfilled`
        });
    }

    const target = await requireLocalSubscription({ db, localSubscriptionId });

    // The payment names a preapproval that a DIFFERENT subscription owns: that
    // is the one correlation signal strong enough to veto on, so it does.
    if (payment.preapprovalId && target.mpSubscriptionId !== payment.preapprovalId) {
        const [owner] = await db
            .select({ id: billingSubscriptions.id })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.mpSubscriptionId, payment.preapprovalId))
            .limit(1);
        if (owner && owner.id !== localSubscriptionId) {
            throw new HTTPException(409, {
                message: 'This payment names a preapproval owned by a different local subscription'
            });
        }
    }

    const amountInCents = toCentavos(payment.transactionAmount as Major);

    // Idempotency across every row, soft-deleted included — see the JSDoc.
    const existing = await db
        .select({
            id: billingPayments.id,
            providerPaymentIds: billingPayments.providerPaymentIds
        })
        .from(billingPayments)
        .where(eq(billingPayments.subscriptionId, localSubscriptionId));

    const alreadyRecorded = existing.find((row) => {
        const ids = row.providerPaymentIds;
        if (!ids || typeof ids !== 'object' || Array.isArray(ids)) {
            return false;
        }
        return Object.values(ids as Record<string, unknown>).includes(mpPaymentId);
    });

    if (alreadyRecorded) {
        return {
            outcome: 'already-recorded',
            mpPaymentId,
            localSubscriptionId,
            billingPaymentId: alreadyRecorded.id,
            amountInCents,
            currency: payment.currencyId,
            auditedAt: recordReconcileAudit({
                actorId,
                reason,
                action: 'backfill-payment',
                resourceId: mpPaymentId,
                metadata: {
                    localSubscriptionId,
                    outcome: 'already-recorded',
                    billingPaymentId: alreadyRecorded.id
                }
            })
        };
    }

    const recorded = await billing.payments.record({
        id: crypto.randomUUID(),
        customerId: target.customerId,
        amount: amountInCents,
        // MercadoPago reports a plain ISO-4217 string; qzpay narrows it to its own
        // union. Asserted here, once, at the single boundary where the provider's
        // value enters the typed API — the same crossing `payment-logic.ts` makes.
        currency: payment.currencyId as QZPayCurrency,
        status: 'succeeded',
        provider: MP_PROVIDER_KEY,
        providerPaymentId: mpPaymentId,
        subscriptionId: localSubscriptionId,
        metadata: {
            // Marks the row as reconstructed rather than observed. Anything
            // auditing the ledger later must be able to tell a charge the system
            // saw live from one a human reconstructed after the fact.
            source: 'hos-765-admin-backfill',
            backfilledBy: actorId,
            backfillReason: reason,
            mpPreapprovalId: payment.preapprovalId,
            mpPayerEmail: payment.payerEmail,
            mpDateApproved: payment.dateApproved
        }
    });

    const auditedAt = recordReconcileAudit({
        actorId,
        reason,
        action: 'backfill-payment',
        resourceId: mpPaymentId,
        metadata: {
            localSubscriptionId,
            outcome: 'recorded',
            billingPaymentId: recorded.id,
            amountInCents,
            currency: payment.currencyId,
            mpPreapprovalId: payment.preapprovalId,
            mpPayerEmail: payment.payerEmail
        }
    });

    apiLogger.info(
        { actorId, mpPaymentId, localSubscriptionId, amountInCents, billingPaymentId: recorded.id },
        'HOS-765 backfill: billing_payments row reconstructed by operator'
    );

    return {
        outcome: 'recorded',
        mpPaymentId,
        localSubscriptionId,
        billingPaymentId: recorded.id,
        amountInCents,
        currency: payment.currencyId,
        auditedAt
    };
}

/**
 * Write the operator audit entry for a rescue action.
 *
 * Emitted through `auditLog` rather than a bespoke table so it lands in
 * `audit_log_entries` alongside every other privileged billing mutation, and is
 * therefore visible in the existing admin audit screen without a second reader.
 * `BILLING_MUTATION` is a CRITICAL audit event, so these rows are retained at
 * the strictest tier the logger has.
 *
 * `action` is `'create'` for both verbs on purpose: at the ledger level both
 * bring into existence something that was missing, and the specific verb travels
 * in `metadata.reconcileAction` where it can be read without inventing a new
 * enum member the shared audit schema does not have.
 *
 * @param params - Actor, justification, verb, target id and structured context.
 * @returns The instant the audit entry was written, echoed to the caller.
 */
function recordReconcileAudit(params: {
    readonly actorId: string;
    readonly reason: string;
    readonly action: 'force-link' | 'backfill-payment';
    readonly resourceId: string;
    readonly metadata: Record<string, unknown>;
}): Date {
    const auditedAt = new Date();

    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId: params.actorId,
        action: 'create',
        resourceType: 'billing_reconciliation',
        resourceId: params.resourceId,
        metadata: {
            reconcileAction: params.action,
            reason: params.reason,
            auditedAt: auditedAt.toISOString(),
            ...params.metadata
        }
    });

    return auditedAt;
}
