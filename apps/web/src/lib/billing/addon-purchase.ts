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

/** Mint one client order identity when opening a purchase summary. */
export function mintOrderRequestId(): string {
    return crypto.randomUUID();
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
