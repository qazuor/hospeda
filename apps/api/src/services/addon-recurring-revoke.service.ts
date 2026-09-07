/**
 * Mirroring a TERMINAL MercadoPago preapproval onto a recurring add-on purchase
 * (HOS-847 PR 6 — the inbound half of cancellation).
 *
 * ## Why this is not the same job as `addon-preapproval-cancel.ts`
 *
 * That module runs when WE decide an add-on ends and have to make MercadoPago
 * agree. This one runs when MERCADOPAGO decides — the buyer cancelled the
 * preapproval from MP's own site or app, or MP finished it after exhausting its
 * retries — and we have to make the platform agree. Opposite directions, and the
 * two must not be confused: calling `subscriptions.cancel()` back at a
 * preapproval MP has already reported terminal is redundant, and the HOS-753
 * static guard names that case explicitly as one it deliberately does not flag.
 *
 * ## And why this one revokes IMMEDIATELY while the in-app cancel does not
 *
 * `addon-soft-cancel.ts` keeps the benefit until `current_period_end`, because
 * the customer paid for that period and Hospeda is the one that stopped the
 * charging on their behalf. Here there is no paid period left to honour: the
 * buyer (or MercadoPago) killed the subscription AT THE PROVIDER, where the
 * money lives. Both events read as "cancelled" in a log line and mean opposite
 * things about what the customer still owns — do not unify them.
 *
 * ## Marking the row is NOT revoking the benefit
 *
 * `loadEntitlements` reads QZPay's `billing_customer_entitlements` /
 * `billing_customer_limits`, never `billing_addon_purchases`. A purchase row set
 * to `canceled` without a `revokeBySource` call therefore keeps the customer's
 * feature or limit alive forever, and looks correct in every admin view. So the
 * revocation runs FIRST and the row is written only if it succeeded — the
 * inverse ordering of the outbound path, for the same reason: whichever half can
 * silently leave a benefit granted must not be the half that gets skipped.
 *
 * @module services/addon-recurring-revoke.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas/billing';
import { AddonCatalogService } from '@repo/service-core';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { apiLogger } from '../utils/logger.js';
import { revokeAddonForSubscriptionCancellation } from './addon-lifecycle.service.js';
import type { RecurringAddonPurchaseRow } from './addon-recurring-period.js';

/** DB-backed catalog used to resolve the add-on definition by slug. */
const catalogService = new AddonCatalogService();

/**
 * QZPay-vocabulary preapproval statuses that mean "this will never charge
 * again".
 *
 * `paused` is NOT here, on purpose: MercadoPago's pause is reversible, and
 * revoking a benefit the buyer can resume with one tap would be harsher than
 * anything the plan-side flow does. Plan OQ-3 keeps add-ons out of dunning for
 * the same reason.
 */
const TERMINAL_PROVIDER_STATUSES: ReadonlySet<string> = new Set(['canceled', 'finished']);

/** Local purchase statuses that are already terminal — nothing left to revoke. */
const TERMINAL_PURCHASE_STATUSES: ReadonlySet<string> = new Set([
    'canceled',
    'expired',
    'refunded'
]);

/**
 * Whether a provider status means the preapproval is finished for good.
 *
 * @param providerStatus - QZPay-normalized preapproval status.
 * @returns `true` when the add-on's benefit should be revoked locally.
 */
export function isTerminalProviderStatus(providerStatus: string): boolean {
    return TERMINAL_PROVIDER_STATUSES.has(providerStatus);
}

/** Input for {@link revokeRecurringAddonForProviderTerminal}. */
export interface RevokeRecurringAddonInput {
    /** Resolved qzpay billing facade. */
    readonly billing: QZPayBilling;
    /** The purchase row the preapproval belongs to. */
    readonly purchase: RecurringAddonPurchaseRow;
    /** The terminal provider status being mirrored, for logs. */
    readonly providerStatus: string;
    /** For log correlation (`webhook`, `cron`, ...). */
    readonly triggerSource: string;
}

/** What {@link revokeRecurringAddonForProviderTerminal} did. */
export type RevokeRecurringAddonOutcome =
    /** Grants revoked and the row written `canceled`. */
    | { readonly kind: 'revoked' }
    /** The row was already terminal — a redelivery, not an error. */
    | { readonly kind: 'already-terminal'; readonly status: string };

/**
 * Revoke a recurring add-on because MercadoPago reported its preapproval
 * terminal.
 *
 * **Throws** when the QZPay revocation fails. That is deliberate: the caller
 * (`routeAddonPreapprovalEvent`) already consumes and captures such failures so
 * the event can never fall through to the plan handler, and a thrown error keeps
 * the purchase row `active` — visible to PR 7's reconciler — instead of writing
 * a `canceled` row over an entitlement that is still granted.
 *
 * **Idempotent.** A redelivered `preapproval.updated` finds the row already
 * terminal and returns without touching QZPay or the row.
 *
 * @param input - Billing facade, the purchase row, the provider status and a trigger source.
 * @returns Whether the add-on was revoked now or was already terminal.
 * @throws When QZPay refuses to revoke the entitlement or limit.
 *
 * @example
 * ```ts
 * if (isTerminalProviderStatus(mpSubscription.status)) {
 *     await revokeRecurringAddonForProviderTerminal({
 *         billing, purchase, providerStatus: mpSubscription.status, triggerSource
 *     });
 * }
 * ```
 */
export async function revokeRecurringAddonForProviderTerminal(
    input: RevokeRecurringAddonInput
): Promise<RevokeRecurringAddonOutcome> {
    const { billing, purchase, providerStatus, triggerSource } = input;

    if (TERMINAL_PURCHASE_STATUSES.has(purchase.status)) {
        apiLogger.info(
            {
                purchaseId: purchase.id,
                customerId: purchase.customerId,
                addonSlug: purchase.addonSlug,
                mpSubscriptionId: purchase.mpSubscriptionId,
                purchaseStatus: purchase.status,
                providerStatus,
                triggerSource
            },
            'HOS-847: add-on purchase is already terminal — nothing to revoke for this provider event'
        );

        return { kind: 'already-terminal', status: purchase.status };
    }

    // NOT_FOUND → undefined, which `revokeAddonForSubscriptionCancellation`
    // treats as the retired/unknown add-on path (best-effort on both channels).
    const catalogResult = await catalogService.getBySlug(purchase.addonSlug);
    const addonDef = catalogResult.success ? catalogResult.data : undefined;

    // Revoke FIRST. If this throws, the row stays as it is — an add-on that
    // still looks owned but whose benefit is genuinely still granted, which is
    // consistent and recoverable. The inverse (row canceled, benefit granted) is
    // neither, because nothing downstream reads this table to decide access.
    await revokeAddonForSubscriptionCancellation({
        customerId: purchase.customerId,
        purchase: { id: purchase.id, addonSlug: purchase.addonSlug },
        addonDef,
        billing
    });

    await getDb()
        .update(billingAddonPurchases)
        .set({
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingAddonPurchases.id, purchase.id),
                // `pending` is included because a buyer can abandon MercadoPago's
                // authorization page and then cancel the preapproval outright:
                // the purchase never reached `active`, and leaving it `pending`
                // forever would keep the abandoned-checkout sweeps chasing it.
                inArray(billingAddonPurchases.status, ['active', 'pending']),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    clearEntitlementCache(purchase.customerId);

    apiLogger.info(
        {
            purchaseId: purchase.id,
            customerId: purchase.customerId,
            addonSlug: purchase.addonSlug,
            mpSubscriptionId: purchase.mpSubscriptionId,
            providerStatus,
            triggerSource
        },
        'HOS-847: add-on grants revoked and purchase marked canceled after MercadoPago reported the preapproval terminal'
    );

    return { kind: 'revoked' };
}
