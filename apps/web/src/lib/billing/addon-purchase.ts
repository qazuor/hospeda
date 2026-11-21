/** Pure purchase-screen decisions; publication status comes from the verticals read. */
import type {
    AddonPurchaseReadResponseSchema,
    AddonPurchaseResponseSchema,
    ListingNoticesItem,
    PublicationStatusEnum
} from '@repo/schemas';
import type { z } from 'zod';

/**
 * The offers the web screen sells: recurring addons, paid at the provider checkout, and
 * one-time (`UNA_VEZ`) addons, paid on a Mercado Pago payment page (HOS-2179 D-4). Any other
 * charge kind the API might add is left out until the screen knows how to sell it.
 */
export function purchasableOffers<T extends { readonly chargeKind: 'UNA_VEZ' | 'PERIODICO' }>(
    offers: readonly T[]
): T[] {
    return offers.filter(
        (offer) => offer.chargeKind === 'PERIODICO' || offer.chargeKind === 'UNA_VEZ'
    );
}

/**
 * Warn before confirming a paid boost for a hidden listing: a recurring one keeps charging,
 * and a one-time one runs its days anyway (HOS-2290 AC-5, DEC-ADDON-001).
 */
export function hiddenListingNoticeKind(input: {
    readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
    readonly publicationStatus: PublicationStatusEnum;
    readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
    readonly free: boolean;
}): 'RECURRING' | 'ONE_TIME' | null {
    if (input.scopeType !== 'LISTING' || input.publicationStatus === 'PUBLISHED' || input.free)
        return null;
    return input.chargeKind === 'UNA_VEZ' ? 'ONE_TIME' : 'RECURRING';
}

/**
 * The copy of a purchase still being confirmed (HOS-2179 P-1): a one-time payment is
 * "being confirmed" and, once the screen stops asking, "we will email you" (the activation mail
 * of HOS-2405); a recurring checkout keeps its generic copy.
 */
export function processingCopyKey(input: {
    readonly chargeKind: 'UNA_VEZ' | 'PERIODICO' | null;
    readonly exhausted: boolean;
}): string {
    if (input.chargeKind !== 'UNA_VEZ') return 'billing.addonPurchase.processing';
    return input.exhausted
        ? 'billing.addonPurchase.waitingPaymentMail'
        : 'billing.addonPurchase.waitingPayment';
}

/**
 * The copy of a purchase that ended without activating: a one-time page that expired with no
 * approved payment, any other unpaid one-time end, or a recurring checkout that closed.
 */
export function closedCopyKey(input: {
    readonly read: {
        readonly status: z.infer<typeof AddonPurchaseReadResponseSchema>['status'];
        readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
    } | null;
}): string {
    if (input.read?.chargeKind !== 'UNA_VEZ') return 'billing.addonPurchase.closed';
    return input.read.status === 'ABANDONED'
        ? 'billing.addonPurchase.pageExpired'
        : 'billing.addonPurchase.paymentNotConfirmed';
}

/** Keep only owned listing notices from compatible verticals that permit a boost. */
export function eligibleTargets<
    T extends ListingNoticesItem & { readonly vertical: string }
>(input: { readonly items: readonly T[]; readonly compatibleVerticals: readonly string[] }): T[] {
    return input.items.filter(
        (item) =>
            input.compatibleVerticals.includes(item.vertical) &&
            item.publicationStatus !== 'PURGED' &&
            item.publicationStatus !== 'MODERATED'
    );
}

/** Minimal offer shape needed to localize an addon's display copy. */
interface AddonCopySource {
    readonly slug: string;
    readonly name: string;
    readonly description: string | null;
}

type CopyTranslator = (key: string, fallback?: string) => string;

/**
 * Localized addon name: `billing.addon.<slug>.name`, falling back to the catalog name
 * (the same slug-keyed pattern as `getPlanName`).
 */
export function getAddonName(input: {
    readonly offer: AddonCopySource;
    readonly t: CopyTranslator;
}): string {
    return input.t(`billing.addon.${input.offer.slug}.name`, input.offer.name);
}

/** Localized addon description, or `null` when neither a translation nor a catalog text exists. */
export function getAddonDescription(input: {
    readonly offer: AddonCopySource;
    readonly t: CopyTranslator;
}): string | null {
    const { offer, t } = input;
    if (!offer.description) {
        const key = `billing.addon.${offer.slug}.description`;
        const translated = t(key, '');
        return translated || null;
    }
    return t(`billing.addon.${offer.slug}.description`, offer.description);
}

/** Mint one client order identity when opening a purchase summary. */
export function mintOrderRequestId(): string {
    return crypto.randomUUID();
}

/** Reasons after which the server has released the order identity: retry needs a new one. */
const ORDER_RELEASED_REASONS: readonly string[] = ['PROVIDER_REJECTED', 'PROVIDER_BUSY'];

/**
 * HOS-2321: whether a failed purchase answer means the order identity is spent. The provider
 * refused the creation (or the server says the id was abandoned), so replaying the same
 * `orderRequestId` can only return the abandoned attempt and never a fresh checkout.
 */
export function orderIdentityReleased(input: {
    readonly error: { readonly code?: string; readonly reason?: string } | null | undefined;
}): boolean {
    const { error } = input;
    if (!error) return false;
    return (
        error.code === 'ADDON_ORDER_REQUEST_ABANDONED' ||
        (error.reason !== undefined && ORDER_RELEASED_REASONS.includes(error.reason))
    );
}

/**
 * One screen decision from a purchase response or a fresh owner-only read. A response with
 * neither a link nor `processing` is a replay of a purchase that is no longer waiting (paid, or
 * ended): `SETTLED` tells the screen to read it rather than send the owner to pay again.
 */
export function purchaseStateFrom(input: {
    readonly response?: z.infer<typeof AddonPurchaseResponseSchema>;
    readonly read?: z.infer<typeof AddonPurchaseReadResponseSchema>;
}): 'REDIRECT' | 'PROCESSING' | 'SETTLED' | 'ACTIVE' | 'CLOSED' | 'REFUSED' {
    if (input.read) {
        if (input.read.status === 'ACTIVE') return 'ACTIVE';
        if (input.read.status === 'PENDING_AUTHORIZATION') return 'PROCESSING';
        return 'CLOSED';
    }
    const response = input.response;
    if (!response) return 'REFUSED';
    if (response.outcome === 'PENDING_ELSEWHERE' || response.processing) return 'PROCESSING';
    if (response.checkoutUrl) return 'REDIRECT';
    return 'SETTLED';
}

/** A live principal subscription an owner can hang a recurring addon on. */
export interface AddonSubscriptionTarget {
    readonly id: string;
    readonly vertical: string;
    readonly planName: string;
}

/**
 * Keep the owner's ACTIVE principal subscriptions whose vertical the addon is compatible with.
 * `VERTICAL_SUBSCRIPTION` addons are purchased against a subscription id, never a listing id.
 */
export function eligibleSubscriptionTargets(input: {
    readonly subscriptions: readonly {
        readonly id: string;
        readonly vertical: string;
        readonly status: string;
        readonly plan: { readonly name: string };
    }[];
    readonly compatibleVerticals: readonly string[];
}): AddonSubscriptionTarget[] {
    return input.subscriptions
        .filter(
            (item) => item.status === 'ACTIVE' && input.compatibleVerticals.includes(item.vertical)
        )
        .map((item) => ({ id: item.id, vertical: item.vertical, planName: item.plan.name }));
}

/** The slice of an owner's live recurring addon needed to tell what is already bought. */
export interface ActiveAddonInstance {
    readonly slug: string;
    readonly status: string;
    readonly targetId: string | null;
}

/**
 * HOS-2362: whether the owner already holds an ACTIVE instance of this addon on this target.
 * Mirrors the API rule (one live recurring instance per owner + product + target, refused as
 * `ALREADY_ACTIVE`), so the screen never offers a purchase the server will refuse.
 * A pending instance is not "active": the API answers that one differently.
 */
export function isAddonActiveOnTarget(input: {
    readonly active: readonly ActiveAddonInstance[];
    readonly slug: string;
    readonly targetId: string | null;
}): boolean {
    return input.active.some(
        (item) =>
            item.status === 'ACTIVE' && item.slug === input.slug && item.targetId === input.targetId
    );
}

/**
 * HOS-2362: whether an offer has nothing left to buy. Untargeted addons (USER/GLOBAL) are
 * covered by one active instance; a subscription-scoped addon is covered only when every
 * compatible live subscription already has it. Listing-scoped offers are decided per listing
 * in the picker, so they are never covered at offer level.
 */
export function isOfferFullyActive(input: {
    readonly offer: {
        readonly slug: string;
        readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
        readonly compatibleVerticals: readonly string[];
    };
    readonly active: readonly ActiveAddonInstance[];
    readonly subscriptionTargets: readonly AddonSubscriptionTarget[] | null;
}): boolean {
    const { offer, active, subscriptionTargets } = input;
    if (offer.scopeType === 'USER' || offer.scopeType === 'GLOBAL')
        return isAddonActiveOnTarget({ active, slug: offer.slug, targetId: null });
    if (offer.scopeType === 'VERTICAL_SUBSCRIPTION') {
        const eligible = (subscriptionTargets ?? []).filter((item) =>
            offer.compatibleVerticals.includes(item.vertical)
        );
        return (
            eligible.length > 0 &&
            eligible.every((item) =>
                isAddonActiveOnTarget({ active, slug: offer.slug, targetId: item.id })
            )
        );
    }
    return false;
}
