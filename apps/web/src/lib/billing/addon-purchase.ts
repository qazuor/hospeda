/** Pure purchase-screen decisions; publication status comes from the verticals read. */
import type {
    AddonPurchaseReadResponseSchema,
    AddonPurchaseResponseSchema,
    ListingNoticesItem,
    PublicationStatusEnum
} from '@repo/schemas';
import type { z } from 'zod';

/** Only recurring addons can be purchased from the web screen. */
export function purchasableOffers<T extends { readonly chargeKind: 'UNA_VEZ' | 'PERIODICO' }>(
    offers: readonly T[]
): T[] {
    return offers.filter((offer) => offer.chargeKind === 'PERIODICO');
}

/** Warn before confirming a paid recurring boost for a hidden listing. */
export function hiddenListingNoticeKind(input: {
    readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
    readonly publicationStatus: PublicationStatusEnum;
    readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
    readonly free: boolean;
}): 'RECURRING' | null {
    if (
        input.scopeType !== 'LISTING' ||
        input.publicationStatus === 'PUBLISHED' ||
        input.free ||
        input.chargeKind !== 'PERIODICO'
    )
        return null;
    return 'RECURRING';
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

/** One screen decision from a purchase response or a fresh owner-only read. */
export function purchaseStateFrom(input: {
    readonly response?: z.infer<typeof AddonPurchaseResponseSchema>;
    readonly read?: z.infer<typeof AddonPurchaseReadResponseSchema>;
}): 'REDIRECT' | 'PROCESSING' | 'ACTIVE' | 'CLOSED' | 'REFUSED' {
    if (input.read) {
        if (input.read.status === 'ACTIVE') return 'ACTIVE';
        if (input.read.status === 'PENDING_AUTHORIZATION') return 'PROCESSING';
        return 'CLOSED';
    }
    const response = input.response;
    if (!response) return 'REFUSED';
    if (
        response.order?.outcome === 'ORDER_DECLINED' ||
        response.order?.outcome === 'ORDER_REJECTED' ||
        response.order?.outcome === 'NOT_APPROVED'
    )
        return 'REFUSED';
    if (response.order?.outcome === 'ACTIVATED') return 'ACTIVE';
    if (response.order?.outcome === 'ORDER_ALREADY_PLACED' && !response.processing) return 'ACTIVE';
    if (response.outcome === 'PENDING_ELSEWHERE' || response.processing) return 'PROCESSING';
    if (response.checkoutUrl) return 'REDIRECT';
    return 'PROCESSING';
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
