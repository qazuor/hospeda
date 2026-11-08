/** Pure purchase-screen decisions; publication status comes from the verticals read. */
import type {
    AddonPurchaseReadResponseSchema,
    AddonPurchaseResponseSchema,
    ListingNoticesItem,
    PublicationStatusEnum
} from '@repo/schemas';
import type { z } from 'zod';

/** The warning copy variant before confirming a paid hidden-listing boost. */
export function hiddenListingNoticeKind(input: {
    readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
    readonly publicationStatus: PublicationStatusEnum;
    readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
    readonly free: boolean;
}): 'RECURRING' | 'ONE_TIME' | null {
    if (input.scopeType !== 'LISTING' || input.publicationStatus === 'PUBLISHED' || input.free)
        return null;
    return input.chargeKind === 'PERIODICO' ? 'RECURRING' : 'ONE_TIME';
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
    if (response.outcome === 'PENDING_ELSEWHERE' || response.processing) return 'PROCESSING';
    if (response.checkoutUrl) return 'REDIRECT';
    return 'PROCESSING';
}
