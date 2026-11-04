import { PartnerModel, type SearchPartnerFilters } from '@repo/db';
import {
    EntitlementKeyEnum,
    type PartnerCarouselItem,
    PartnerCarouselItemSchema,
    type PartnerPublic,
    PartnerPublicSchema,
    VerticalEnum
} from '@repo/schemas';
import { getListingAccessPorts } from '../../utils/listing-access/ports';

const partnerModel = new PartnerModel();

/**
 * Check a partner owner's effective set for one presence key.
 * AC:V7:13; V7 §1.6 (V/18 §1.6).
 */
async function hasPresenceKey(args: {
    readonly userId: string;
    readonly key: EntitlementKeyEnum;
}): Promise<boolean> {
    const set = await getListingAccessPorts().effectiveSet({
        userId: args.userId,
        vertical: VerticalEnum.PARTNER
    });
    return (
        set.entitlements.get({
            key: args.key,
            userId: args.userId,
            vertical: VerticalEnum.PARTNER
        }) !== undefined
    );
}

/**
 * Read a public partner page when its owner has the page key.
 * AC:V7:13; V7 §1.6 (V/18 §1.6).
 */
export async function getPublicPartnerPage(args: {
    readonly slug: string;
}): Promise<{ readonly partner: PartnerPublic } | null> {
    const candidate = await partnerModel.findPresenceCandidateBySlug({ slug: args.slug });
    if (!candidate?.ownerUserId) return null;
    if (
        !(await hasPresenceKey({
            userId: candidate.ownerUserId,
            key: EntitlementKeyEnum.PARTNER_PUBLIC_PAGE
        }))
    ) {
        return null;
    }
    return { partner: PartnerPublicSchema.parse(candidate) };
}

/**
 * List carousel candidates whose owners hold the carousel presence key.
 * AC:V7:13; V7 §1.6 (V/18 §1.6).
 */
export async function listCarouselPartners(args: {
    readonly filters: SearchPartnerFilters;
    readonly page: number;
    readonly pageSize: number;
}): Promise<{ readonly items: PartnerCarouselItem[]; readonly total: number }> {
    const candidates = await partnerModel.findPresenceCandidates({ filters: args.filters });
    const keysByOwner = new Map<string, Promise<{ carousel: boolean; page: boolean }>>();
    const visible: PartnerCarouselItem[] = [];
    for (const candidate of candidates) {
        const ownerId = candidate.ownerUserId;
        if (!ownerId) continue;
        let keys = keysByOwner.get(ownerId);
        if (!keys) {
            keys = getListingAccessPorts()
                .effectiveSet({ userId: ownerId, vertical: VerticalEnum.PARTNER })
                .then((set) => ({
                    carousel:
                        set.entitlements.get({
                            key: EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE,
                            userId: ownerId,
                            vertical: VerticalEnum.PARTNER
                        }) !== undefined,
                    page:
                        set.entitlements.get({
                            key: EntitlementKeyEnum.PARTNER_PUBLIC_PAGE,
                            userId: ownerId,
                            vertical: VerticalEnum.PARTNER
                        }) !== undefined
                }));
            keysByOwner.set(ownerId, keys);
        }
        const ownerKeys = await keys;
        if (ownerKeys.carousel) {
            visible.push(
                PartnerCarouselItemSchema.parse({ ...candidate, hasPublicPage: ownerKeys.page })
            );
        }
    }
    const offset = (args.page - 1) * args.pageSize;
    return {
        items: visible.slice(offset, offset + args.pageSize),
        total: visible.length
    };
}
