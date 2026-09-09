/**
 * Carrying a subscription's DOMAIN identity onto a fresh preapproval (HOS-1287).
 *
 * ## The problem this exists for
 *
 * Two flows mint a brand-new MercadoPago preapproval to replace one that
 * failed, and both of them start from an existing `billing_subscriptions` row:
 *
 * - {@link mintRetryPreapprovalAttempt} (`preapproval-recovery.service.ts`) —
 *   the checkout that came back `cancelled` and cannot be retried on the same
 *   MercadoPago object (`payer_email` is not mutable on a preapproval).
 * - {@link replacePastDuePaymentMethod}
 *   (`past-due-payment-method-replacement.service.ts`) — the customer whose
 *   card started failing and who wants to pay with another one.
 *
 * A fresh preapproval is a fresh LOCAL row, and for every vertical except
 * accommodation and tourist that row is only half the record. The other half is
 * the bridge row (`entity_subscriptions` for gastronomy/experience,
 * `partner_subscriptions` for partner) plus the entity pointer stamped on
 * `metadata` — the SUBSCRIPTION → ENTITY direction
 * (`subscription-domain-metadata.ts`) the reconcilers read when no bridge row
 * points at a subscription that just went live. Mint without them and the new
 * subscription is charged while its listing stays dark, with nothing thrown and
 * nothing logged.
 *
 * Before HOS-1287 the two flows answered that threat in OPPOSITE ways: the
 * retry refused outright (a one-domain allowlist, 422 for everything else),
 * while the replacement went ahead silently. Both now go through this module.
 *
 * ## Why it fails CLOSED for anything it does not recognize
 *
 * The domains are NOT interchangeable and a wrong one is not a cosmetic
 * mislabel:
 *
 * - `addon` (HOS-847) borrows the owner plan's price row purely to satisfy
 *   qzpay's plan+price requirement and states its real price through
 *   `providerUnitAmountOverride`. A mint that re-derived the amount from the
 *   plan — which is exactly what both flows do — would charge the BORROWED
 *   plan price for an add-on. Unsupported, loudly.
 * - The retired pre-HOS-685 umbrella value satisfies neither `gastronomy` nor
 *   `experience` (HOS-695), and a legacy row still carrying it must go dark
 *   rather than be re-pointed at a vertical nobody ever resolved it to.
 * - An unrecognized value is a value this module has never been taught, which
 *   is the same thing as not knowing where its listing is.
 *
 * `accommodation` fails OPEN for a missing/`null` column, mirroring
 * `subscriptionMatchesDomain` (`@repo/service-core`) — the column post-dates
 * most rows, so absence means accommodation there and means accommodation here.
 *
 * @module services/billing/subscription-domain-carry-forward
 */

import {
    type CommerceVertical,
    commerceVerticalToProductDomain,
    parseCommerceVertical
} from '@repo/billing';
import { and, type DrizzleClient, entitySubscriptions, eq, partnerSubscriptions } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue, SubscriptionStatusEnum } from '@repo/schemas';
import {
    isPublishingSubscriptionStatus,
    parseSubscriptionDomainMetadata
} from './subscription-domain-metadata.js';

/**
 * What a fresh preapproval has to reproduce to stand in for the row it
 * replaces, resolved by {@link resolveSubscriptionDomainCarryForward}.
 *
 * `'no-bridge'` is not "nothing to do" — it is the positive statement that this
 * domain owns no listing and therefore has no bridge row and no entity pointer
 * (accommodation resolves its listings from `accommodations.owner_id`; tourist
 * owns no listings at all). It is a resolved outcome, never a fallback.
 */
export type SubscriptionDomainCarryForward =
    | { readonly kind: 'no-bridge'; readonly productDomain: ProductDomainValue }
    | {
          readonly kind: 'commerce';
          readonly productDomain: ProductDomainValue;
          readonly vertical: CommerceVertical;
          readonly entityId: string;
      }
    | {
          readonly kind: 'partner';
          readonly productDomain: ProductDomainValue;
          readonly partnerId: string;
      };

/**
 * Thrown when a row's domain cannot be carried onto a fresh preapproval —
 * either the domain itself is one no mint can faithfully reproduce, or the
 * entity pointer it needs is missing or disagrees with the column.
 *
 * A distinct class (rather than a bare `Error`) so each caller can map it to
 * its own contract: the retry turns it into its `unsupported` outcome, the
 * past-due replacement into a `SubscriptionCheckoutError` the route answers
 * 422 with.
 */
export class SubscriptionDomainCarryForwardError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SubscriptionDomainCarryForwardError';
    }
}

/** Domains that own no listing, and therefore no bridge row and no pointer. */
const NO_BRIDGE_DOMAINS: ReadonlySet<string> = new Set<string>([
    ProductDomainEnum.ACCOMMODATION,
    ProductDomainEnum.TOURIST
]);

/** Domains whose listing lives in `entity_subscriptions`. */
const COMMERCE_DOMAINS: ReadonlySet<string> = new Set<string>([
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE
]);

/**
 * Resolve what a fresh preapproval must reproduce to stand in for `metadata`'s
 * own row.
 *
 * @param input.productDomain - `billing_subscriptions.product_domain` as read
 *   off the source row. `null`/`undefined` resolves to accommodation (fail
 *   OPEN, matching `subscriptionMatchesDomain`).
 * @param input.metadata - That row's `billing_subscriptions.metadata`, which is
 *   where the entity pointer was stamped at checkout.
 * @param input.context - Short caller label folded into every thrown message,
 *   so a failure is traceable to the flow that raised it.
 * @returns The resolved carry-forward.
 * @throws {SubscriptionDomainCarryForwardError} For a domain no mint can
 *   reproduce (`addon`, the retired umbrella value, anything unrecognized), for
 *   a listing-owning domain whose entity pointer was never stamped, and for a
 *   pointer whose own vertical disagrees with the column — re-pointing an
 *   experience listing from a gastronomy subscription is worse than refusing.
 */
export function resolveSubscriptionDomainCarryForward(input: {
    readonly productDomain?: string | null;
    readonly metadata: unknown;
    readonly context: string;
}): SubscriptionDomainCarryForward {
    const { context } = input;
    const domain = input.productDomain ?? ProductDomainEnum.ACCOMMODATION;

    if (NO_BRIDGE_DOMAINS.has(domain)) {
        return { kind: 'no-bridge', productDomain: domain as ProductDomainValue };
    }

    const coordinates = parseSubscriptionDomainMetadata(input.metadata);

    if (COMMERCE_DOMAINS.has(domain)) {
        const entityType = coordinates?.commerceEntityType;
        const entityId = coordinates?.commerceEntityId;
        if (!entityType || !entityId) {
            throw new SubscriptionDomainCarryForwardError(
                `${context}: productDomain='${domain}' carries no commerce entity pointer on its metadata — a fresh preapproval would leave the listing with nothing pointing at it`
            );
        }

        let vertical: CommerceVertical;
        try {
            vertical = parseCommerceVertical(entityType, context);
        } catch (error) {
            throw new SubscriptionDomainCarryForwardError(
                error instanceof Error ? error.message : String(error)
            );
        }

        // The two columns encode the SAME fact from opposite ends, so a
        // disagreement means one of them is wrong and there is no way to tell
        // which. Trusting the pointer would re-point another vertical's
        // listing; trusting the column would mint against a listing that is not
        // the row's own.
        if (commerceVerticalToProductDomain(vertical) !== domain) {
            throw new SubscriptionDomainCarryForwardError(
                `${context}: the stamped entity vertical '${vertical}' does not match productDomain='${domain}'`
            );
        }

        return {
            kind: 'commerce',
            productDomain: domain as ProductDomainValue,
            vertical,
            entityId
        };
    }

    if (domain === ProductDomainEnum.PARTNER) {
        const partnerId = coordinates?.partnerId;
        if (!partnerId) {
            throw new SubscriptionDomainCarryForwardError(
                `${context}: productDomain='${domain}' carries no partnerId on its metadata — a fresh preapproval would leave the partner with nothing pointing at it`
            );
        }
        return { kind: 'partner', productDomain: domain as ProductDomainValue, partnerId };
    }

    throw new SubscriptionDomainCarryForwardError(
        `${context}: minting a fresh preapproval is not supported for productDomain='${domain}'`
    );
}

/**
 * The entity pointer to merge onto the FRESH row's own `metadata`.
 *
 * This is the half that both flows need, and for the past-due replacement it is
 * the ONLY half it may write: re-pointing a bridge row at mint time would
 * unpublish a listing whose old preapproval is still the one being paid, which
 * is precisely what that module's "the old preapproval is untouched until the
 * new one confirms authorized" invariant forbids. With the pointer stamped,
 * `recoverCommerceLinkFromSubscriptionMetadata` / `recoverPartnerLinkFrom
 * SubscriptionMetadata` re-point the bridge row when the new subscription
 * actually goes live — and only then.
 *
 * @param carryForward - The resolved carry-forward.
 * @returns The `metadata` fragment, empty for a domain that owns no listing.
 */
export function domainMetadataForCarryForward(
    carryForward: SubscriptionDomainCarryForward
): Readonly<Record<string, string>> {
    if (carryForward.kind === 'commerce') {
        return {
            commerceEntityType: carryForward.vertical,
            commerceEntityId: carryForward.entityId
        };
    }
    if (carryForward.kind === 'partner') {
        return { partnerId: carryForward.partnerId };
    }
    return {};
}

/**
 * Upsert the bridge row for a freshly-minted `pending_provider` attempt,
 * re-pointing it at that attempt — but ONLY when the row is free or already
 * points at a dead subscription.
 *
 * The SOURCE row (the `cancelled` attempt this mint replaces) never entitled
 * anything, so re-pointing takes nothing away FROM IT — but that says nothing
 * about who currently OCCUPIES the bridge row: a buyer can retry an old
 * `cancelled` checkout email long after a LATER checkout attempt for the same
 * listing went on to activate, in which case the bridge row's `subscriptionId`
 * already points at that live, paying subscription. Re-pointing it here would
 * be indistinguishable from `commerce-reconcile.service.ts`'s
 * `recoverCommerceLinkFromSubscriptionMetadata` stealing the row from an
 * incumbent — which is exactly why that function (and its partner twin,
 * `partner-reconcile.service.ts`'s `recoverPartnerLinkFromSubscriptionMetadata`)
 * read the incumbent's status before ever touching the row. This helper does
 * the same read-before-write, with the same predicate
 * ({@link isPublishingSubscriptionStatus}): a `pending_provider` retry attempt
 * must never overwrite a bridge row a publishing subscription already holds.
 *
 * This is otherwise the same upsert `subscription-checkout.service.ts`
 * performs when a buyer clicks checkout a second time, and it runs inside the
 * caller's transaction for the same reason: a `pending_provider` row must
 * never exist without its bridge row, and the incumbent read below must see
 * the same snapshot the upsert commits against.
 *
 * The status is always `pending_provider` and is not a parameter: this helper
 * only ever runs from a mint, and a bridge row pointed at a preapproval nobody
 * has authorized yet must not claim any other status.
 *
 * @param input.tx - The transaction client handed to `writeDomainLinkRow`.
 * @param input.localSubscriptionId - The freshly-created subscription row's id.
 * @param input.carryForward - The resolved carry-forward.
 * @throws {SubscriptionDomainCarryForwardError} When the bridge row is
 *   currently occupied by a subscription whose status is publishing
 *   (`isPublishingSubscriptionStatus`) — re-pointing it would unpublish a
 *   listing that is actively being paid for.
 */
export async function writeCarryForwardBridgeRow(input: {
    readonly tx: DrizzleClient;
    readonly localSubscriptionId: string;
    readonly carryForward: SubscriptionDomainCarryForward;
}): Promise<void> {
    const { tx, localSubscriptionId: subscriptionId, carryForward } = input;
    const status = SubscriptionStatusEnum.PENDING_PROVIDER;

    if (carryForward.kind === 'commerce') {
        const [incumbent] = await tx
            .select({
                subscriptionId: entitySubscriptions.subscriptionId,
                status: entitySubscriptions.status
            })
            .from(entitySubscriptions)
            .where(
                and(
                    eq(entitySubscriptions.entityType, carryForward.vertical),
                    eq(entitySubscriptions.entityId, carryForward.entityId)
                )
            )
            .limit(1);

        if (
            incumbent &&
            incumbent.subscriptionId !== subscriptionId &&
            isPublishingSubscriptionStatus(incumbent.status)
        ) {
            throw new SubscriptionDomainCarryForwardError(
                `carry-forward: entity_subscriptions row for entityType='${carryForward.vertical}' entityId='${carryForward.entityId}' is held by publishing subscription '${incumbent.subscriptionId}' (status='${incumbent.status}') — refusing to re-point it at retry attempt '${subscriptionId}'`
            );
        }

        await tx
            .insert(entitySubscriptions)
            .values({
                subscriptionId,
                productDomain: carryForward.productDomain,
                entityType: carryForward.vertical,
                entityId: carryForward.entityId,
                status
            })
            .onConflictDoUpdate({
                target: [entitySubscriptions.entityType, entitySubscriptions.entityId],
                set: {
                    subscriptionId,
                    status,
                    // HOS-1122: a restriction belongs to ONE subscription.
                    // Re-pointing the row hands the listing to another, which
                    // has its own tier and has restricted nothing.
                    planRestricted: false,
                    updatedAt: new Date()
                }
            });
        return;
    }

    if (carryForward.kind === 'partner') {
        const [incumbent] = await tx
            .select({
                subscriptionId: partnerSubscriptions.subscriptionId,
                status: partnerSubscriptions.status
            })
            .from(partnerSubscriptions)
            .where(eq(partnerSubscriptions.partnerId, carryForward.partnerId))
            .limit(1);

        if (
            incumbent &&
            incumbent.subscriptionId !== subscriptionId &&
            isPublishingSubscriptionStatus(incumbent.status)
        ) {
            throw new SubscriptionDomainCarryForwardError(
                `carry-forward: partner_subscriptions row for partnerId='${carryForward.partnerId}' is held by publishing subscription '${incumbent.subscriptionId}' (status='${incumbent.status}') — refusing to re-point it at retry attempt '${subscriptionId}'`
            );
        }

        await tx
            .insert(partnerSubscriptions)
            .values({
                subscriptionId,
                productDomain: carryForward.productDomain,
                partnerId: carryForward.partnerId,
                status
            })
            .onConflictDoUpdate({
                target: partnerSubscriptions.partnerId,
                set: { subscriptionId, status, updatedAt: new Date() }
            });
    }

    // 'no-bridge': nothing to write, by resolution rather than by omission.
}
