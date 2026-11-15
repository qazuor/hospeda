import { domainEventModel, PartnerModel, type SearchPartnerFilters } from '@repo/db';
import type { PartnerOwnerPresence } from '@repo/schemas';
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
 * Read the effective presence keys used by every Partner surface.
 * AC:V8b:1; V7 §1.6 (V/18 §1.6).
 */
export async function readPartnerPresenceKeys(args: {
    readonly userId: string;
}): Promise<{ readonly publicPage: boolean; readonly carousel: boolean }> {
    const set = await getListingAccessPorts().effectiveSet({
        userId: args.userId,
        vertical: VerticalEnum.PARTNER
    });
    return {
        publicPage:
            set.entitlements.get({
                key: EntitlementKeyEnum.PARTNER_PUBLIC_PAGE,
                userId: args.userId,
                vertical: VerticalEnum.PARTNER
            }) !== undefined,
        carousel:
            set.entitlements.get({
                key: EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE,
                userId: args.userId,
                vertical: VerticalEnum.PARTNER
            }) !== undefined
    };
}

/** Read an owner's explanation from the same effective keys as public surfaces. AC:V8b:1; V7 §1.6. */
export async function readOwnerPartnerPresence(args: {
    readonly partner: {
        readonly id: string;
        readonly ownerUserId: string | null;
        readonly presenceModerated: boolean;
    };
}): Promise<PartnerOwnerPresence> {
    const { partner } = args;
    if (!partner.ownerUserId)
        return {
            publicPage: 'hidden',
            carousel: 'hidden',
            moderated: partner.presenceModerated,
            moderationReason: partner.presenceModerated ? await moderationReason(partner.id) : null
        };
    const keys = await readPartnerPresenceKeys({ userId: partner.ownerUserId });
    return {
        publicPage: keys.publicPage && !partner.presenceModerated ? 'visible' : 'hidden',
        carousel: keys.carousel && !partner.presenceModerated ? 'visible' : 'hidden',
        moderated: partner.presenceModerated,
        moderationReason: partner.presenceModerated ? await moderationReason(partner.id) : null
    };
}

async function moderationReason(partnerId: string): Promise<string | null> {
    const events = await domainEventModel.findByEntity({
        entityType: 'partner',
        entityId: partnerId
    });
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (
            event?.eventType === 'partner.presence_moderation_changed' &&
            event.changes.some(
                (change) => change.field === 'presence_moderated' && change.new === true
            )
        )
            return event.reason ?? null;
    }
    return null;
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
    if (!(await readPartnerPresenceKeys({ userId: candidate.ownerUserId })).publicPage) {
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
    const keysByOwner = new Map<
        string,
        Promise<{ readonly publicPage: boolean; readonly carousel: boolean }>
    >();
    const visible: PartnerCarouselItem[] = [];
    for (const candidate of candidates) {
        const ownerId = candidate.ownerUserId;
        if (!ownerId) continue;
        let keys = keysByOwner.get(ownerId);
        if (!keys) {
            keys = readPartnerPresenceKeys({ userId: ownerId });
            keysByOwner.set(ownerId, keys);
        }
        const ownerKeys = await keys;
        if (ownerKeys.carousel) {
            visible.push(
                PartnerCarouselItemSchema.parse({
                    ...candidate,
                    hasPublicPage: ownerKeys.publicPage
                })
            );
        }
    }
    const offset = (args.page - 1) * args.pageSize;
    return {
        items: visible.slice(offset, offset + args.pageSize),
        total: visible.length
    };
}
