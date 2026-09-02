/**
 * Supersede a Hospeda-owned trial when the customer's own paid subscription
 * activates (HOS-1012 T-022).
 *
 * Since HOS-1012 the free trial is a local `billing_subscriptions` row with
 * `status='trialing'` and `mp_subscription_id = NULL`, minted when the host
 * publishes their first listing. When that host later decides to pay, the
 * checkout creates its OWN `pending_provider` row (unchanged) and MercadoPago
 * activates it by webhook. For the length of that webhook the customer owns
 * TWO rows that grant entitlements.
 *
 * ### Supersede, do not mutate
 *
 * The trial row is moved to a terminal state; it is never turned INTO the paid
 * one. Mutating it would require it to acquire an `mp_subscription_id` mid-life,
 * which is precisely the correlation problem HOS-937 spent ~4.750 lines solving.
 * Rows keep their provenance: the trial dies, the new row lives.
 *
 * ### The overlap must not outlive the transaction
 *
 * `loadEntitlements` (`middlewares/entitlement.ts`) picks the FIRST
 * entitlement-granting accommodation subscription it finds, so two live rows
 * resolve a nondeterministic plan — the customer sees one plan or the other
 * depending on the order the query happens to return. This function therefore
 * takes the ACTIVATION'S transaction handle and does its writes inside it: the
 * supersede and the activation commit together or not at all, and no committed
 * state ever shows both rows granting.
 *
 * `TrialService.reconcileDuplicateSubscriptions` exists as a backstop and is
 * NOT the design. Reaching one row because a reconciler ran later is a
 * different (and worse) guarantee than reaching it because the transaction
 * could not commit otherwise.
 *
 * ### Why only rows with `mp_subscription_id = NULL`
 *
 * A trialing row that DOES carry a preapproval belongs to MercadoPago: ending
 * it locally would leave a live preapproval charging a card for a subscription
 * Hospeda thinks is over. Those are HOS-114's business
 * (`reactivation-supersession-complete.ts`), which cancels at the provider
 * after the transaction and has a reconcile cron behind it precisely because a
 * provider call cannot be made transactional. This function deliberately does
 * not touch them.
 *
 * @module services/billing/trial-supersede-on-activation
 */

import {
    and,
    billingSubscriptionEvents,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    isNull,
    ne,
    or
} from '@repo/db';
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';

/**
 * The terminal status a superseded trial lands on.
 *
 * `expired` and not `cancelled`, for two reasons. `trialing -> expired` is the
 * transition table's documented "direct status expiry without a provider
 * cancel" edge, which is exactly what this is — there is no provider to cancel
 * at. And `expired` is genuinely terminal (no outgoing edges), whereas
 * `cancelled -> active` is a live edge, so a cancelled row is one reactivation
 * away from granting entitlements again.
 */
export const SUPERSEDED_TRIAL_STATUS = SubscriptionStatusEnum.EXPIRED;

/** One trial row this activation superseded. */
export interface SupersededTrialRow {
    /** The superseded `billing_subscriptions.id`. */
    readonly id: string;
    /** The status it held before being superseded (always `trialing`). */
    readonly previousStatus: string;
}

/**
 * Input for {@link supersedeLocalTrialsOnActivation}.
 */
export interface SupersedeLocalTrialsInput {
    /**
     * The ALREADY-OPEN activation transaction. This is not an optimization and
     * not a `db` override: passing anything other than the handle that writes
     * the activation reintroduces the very overlap this exists to prevent.
     */
    readonly tx: DrizzleClient;
    /** The row being activated — excluded from the sweep, never superseded. */
    readonly activatedSubscriptionId: string;
    /** Billing customer that owns both rows. */
    readonly customerId: string;
    /**
     * The activated row's `product_domain`. `null`/`undefined` reads as
     * accommodation, the same asymmetry `subscriptionMatchesDomain()` applies:
     * the column post-dates most rows, so accommodation fails open and every
     * other domain fails closed.
     */
    readonly productDomain: string | null | undefined;
    /** Clock injection for deterministic tests. */
    readonly now?: Date;
    /** MercadoPago event id, recorded verbatim on the audit row. */
    readonly providerEventId: string;
    /** Caller identifier for the audit row and logs (`'webhook'`, `'polling'`, ...). */
    readonly source: string;
}

/**
 * Result of {@link supersedeLocalTrialsOnActivation}.
 */
export interface SupersedeLocalTrialsResult {
    /** Every trial row this call ended. Empty on the overwhelmingly common path. */
    readonly superseded: readonly SupersededTrialRow[];
}

/**
 * End every Hospeda-owned trial the customer holds in the activated row's
 * product domain, inside the activation's own transaction.
 *
 * Selects `FOR UPDATE` so two concurrent activations cannot both decide they
 * are the one superseding the same trial. Writes, per row, the terminal status
 * plus `trial_converted = true` (this trial ended BY converting — the opposite
 * of what `expireLocalTrial` stamps) and one `TRIAL_SUPERSEDED_BY_PAID` audit
 * event.
 *
 * Errors are NOT swallowed. A supersede that cannot be written must take the
 * activation down with it: committing the activation alone is the two-granting-
 * rows state, which is the entire failure mode this prevents.
 *
 * @param input - See {@link SupersedeLocalTrialsInput}.
 * @returns The rows that were superseded.
 */
export async function supersedeLocalTrialsOnActivation(
    input: SupersedeLocalTrialsInput
): Promise<SupersedeLocalTrialsResult> {
    const { tx, activatedSubscriptionId, customerId, providerEventId, source } = input;
    const now = input.now ?? new Date();
    const domain = input.productDomain ?? ProductDomainEnum.ACCOMMODATION;

    // Accommodation fails OPEN (a NULL column counts as accommodation); every
    // other vertical fails CLOSED. Same asymmetry, same reason, as
    // `subscriptionMatchesDomain()` — mirrored here in SQL because the sweep
    // must not load every subscription the customer has ever had.
    const domainMatches =
        domain === ProductDomainEnum.ACCOMMODATION
            ? or(
                  isNull(billingSubscriptions.productDomain),
                  eq(billingSubscriptions.productDomain, ProductDomainEnum.ACCOMMODATION)
              )
            : eq(billingSubscriptions.productDomain, domain);

    const candidates = await tx
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, customerId),
                // The activated row is excluded by id AND, redundantly, by the
                // NULL-provider filter below — it was found by its preapproval
                // id, so it can never be provider-less. Both are kept: the id
                // exclusion states the intent, the NULL filter enforces the
                // scope.
                ne(billingSubscriptions.id, activatedSubscriptionId),
                eq(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING),
                isNull(billingSubscriptions.mpSubscriptionId),
                isNull(billingSubscriptions.deletedAt),
                domainMatches
            )
        )
        .for('update');

    if (candidates.length === 0) {
        return { superseded: [] };
    }

    const superseded: SupersededTrialRow[] = [];

    for (const candidate of candidates) {
        await tx
            .update(billingSubscriptions)
            .set({
                status: SUPERSEDED_TRIAL_STATUS,
                // `trial_converted` records HOW the trial ended. This one ended
                // because the host paid, which is the outcome the whole trial
                // exists to produce.
                trialConverted: true,
                trialConvertedAt: now,
                updatedAt: now
            })
            .where(eq(billingSubscriptions.id, candidate.id));

        await tx.insert(billingSubscriptionEvents).values({
            subscriptionId: candidate.id,
            eventType: BILLING_EVENT_TYPES.TRIAL_SUPERSEDED_BY_PAID,
            previousStatus: candidate.status,
            newStatus: SUPERSEDED_TRIAL_STATUS,
            triggerSource: source,
            providerEventId,
            metadata: {
                supersededBySubscriptionId: activatedSubscriptionId,
                productDomain: domain
            }
        });

        superseded.push({ id: candidate.id, previousStatus: candidate.status });
    }

    apiLogger.info(
        {
            customerId,
            activatedSubscriptionId,
            productDomain: domain,
            supersededIds: superseded.map((row) => row.id),
            source
        },
        'HOS-1012: superseded local trial(s) inside the activation transaction'
    );

    return { superseded };
}
