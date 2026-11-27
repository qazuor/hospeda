/**
 * The photo allowance of one owned listing (HOS-2495): the cap step 7 enforces,
 * how many gallery photos count toward it, how many approved photos the public
 * page hides, and — when it adds up — where the cap comes from.
 *
 * The cap is read from the SAME ports step 7 reads (the cached effective set,
 * then the pre-trial DRAFT fallback, then 0), so the number the editor shows is
 * the number the server enforces. The breakdown is a fresh fold and may
 * disagree with a cached snapshot; it is then dropped (`null`) and logged, never
 * shown half-right.
 *
 * @module utils/listing-access/photo-allowance
 */
import { accommodationMediaModel, experienceMediaModel, venueMediaModel } from '@repo/db';
import {
    isUnlimitedLimit,
    LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL,
    type ListingPhotoAllowance,
    ModerationStatusEnum,
    PublicationStatusEnum,
    partitionGalleryByCap,
    VerticalEnum
} from '@repo/schemas';
import { isPreTrialDraftLimitKey } from '@repo/verticals';
import { apiLogger } from '../logger';
import type { ListingPhotoVertical } from './photo-limit';
import { getListingAccessPorts } from './ports';

type Contribution = NonNullable<ListingPhotoAllowance['breakdown']>['contributions'][number];

/** The most rows one gallery read returns (`BaseModelImpl` page cap). */
const GALLERY_READ_PAGE_SIZE = 200;

/** Visible non-featured rows of a listing, in `sort_order`, any moderation state. */
async function readGallery({
    vertical,
    listingId
}: {
    readonly vertical: ListingPhotoVertical;
    readonly listingId: string;
}): Promise<{
    readonly used: number;
    readonly rows: readonly { readonly moderationState: string }[];
}> {
    const filter = {
        state: 'visible',
        isFeatured: false,
        pageSize: GALLERY_READ_PAGE_SIZE
    } as const;
    const { items, total } =
        vertical === VerticalEnum.VENUE
            ? await venueMediaModel.findByVenue({ venueId: listingId, ...filter })
            : vertical === VerticalEnum.EXPERIENCE
              ? await experienceMediaModel.findByExperience({ experienceId: listingId, ...filter })
              : await accommodationMediaModel.findByAccommodation({
                    accommodationId: listingId,
                    ...filter
                });
    return { used: total, rows: items };
}

/** The cap step 7 would use for a gallery write on this listing, and its source. */
async function readCap({
    vertical,
    ownerId,
    publicationStatus,
    key
}: {
    readonly vertical: ListingPhotoVertical;
    readonly ownerId: string;
    readonly publicationStatus: PublicationStatusEnum | null;
    readonly key: string;
}): Promise<{ readonly raw: number; readonly source: ListingPhotoAllowance['source'] }> {
    const ports = getListingAccessPorts();
    const effective = await ports.effectiveSet({ userId: ownerId, vertical });
    const fromSet = effective.limits.get({ key, userId: ownerId, vertical });
    if (fromSet !== undefined) return { raw: fromSet, source: 'EFFECTIVE_SET' };
    if (
        publicationStatus === PublicationStatusEnum.DRAFT &&
        isPreTrialDraftLimitKey({ vertical, key })
    ) {
        const draft = (await ports.preTrialDraftLimits({ userId: ownerId, vertical })).get(key);
        if (draft !== undefined) return { raw: draft, source: 'PRE_TRIAL_DRAFT' };
    }
    return { raw: 0, source: 'EFFECTIVE_SET' };
}

/** Whether the contributions add up to the cap step 7 reads (AC-5). */
function addsUp({
    contributions,
    total,
    raw
}: {
    readonly contributions: readonly Contribution[];
    readonly total: number;
    readonly raw: number;
}): boolean {
    if (isUnlimitedLimit({ value: raw })) {
        return (
            isUnlimitedLimit({ value: total }) &&
            contributions.some(({ value }) => value === 'unlimited')
        );
    }
    if (total !== raw) return false;
    if (contributions.some(({ value }) => value === 'unlimited')) return false;
    const sum = contributions.reduce(
        (acc, { value }) => acc + (typeof value === 'number' ? value : 0),
        0
    );
    return sum === raw;
}

/** The breakdown of the cap, or `null` when it does not add up or cannot be read. */
async function readBreakdown({
    vertical,
    listingId,
    ownerId,
    key,
    raw,
    source
}: {
    readonly vertical: ListingPhotoVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly key: ListingPhotoAllowance['limitKey'];
    readonly raw: number;
    readonly source: ListingPhotoAllowance['source'];
}): Promise<ListingPhotoAllowance['breakdown']> {
    if (source === 'PRE_TRIAL_DRAFT') {
        if (raw <= 0) return { contributions: [] };
        return {
            contributions: [
                {
                    kind: 'PRE_TRIAL_DRAFT',
                    value: isUnlimitedLimit({ value: raw }) ? 'unlimited' : raw,
                    sources: 1
                }
            ]
        };
    }
    try {
        const breakdowns = await getListingAccessPorts().limitBreakdown({
            userId: ownerId,
            vertical,
            keys: [key]
        });
        const breakdown = breakdowns.get(key);
        const total = breakdown?.total ?? 0;
        const contributions = breakdown?.contributions ?? [];
        if (addsUp({ contributions, total, raw })) return { contributions: [...contributions] };
        apiLogger.warn(
            { vertical, listingId, cap: raw, breakdownTotal: total },
            'Photo allowance breakdown disagrees with the enforced cap'
        );
        return null;
    } catch (error) {
        apiLogger.warn(
            { vertical, listingId, cap: raw, error: String(error) },
            'Photo allowance breakdown could not be resolved'
        );
        return null;
    }
}

/**
 * Resolves the photo allowance of one listing for its owner's editor.
 *
 * @param input.vertical - The listing vertical.
 * @param input.listingId - The listing id (access already verified by the route).
 * @param input.ownerId - The listing owner: the subject step 7 reads.
 * @param input.publicationStatus - The listing status (DRAFT enables the pre-trial fallback).
 * @returns The allowance, shaped as `ListingPhotoAllowanceSchema`.
 */
export async function resolveListingPhotoAllowance({
    vertical,
    listingId,
    ownerId,
    publicationStatus
}: {
    readonly vertical: ListingPhotoVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly publicationStatus: PublicationStatusEnum | null;
}): Promise<ListingPhotoAllowance> {
    const limitKey = LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[vertical];
    const [{ raw, source }, gallery] = await Promise.all([
        readCap({ vertical, ownerId, publicationStatus, key: limitKey }),
        readGallery({ vertical, listingId })
    ]);
    const unlimited = isUnlimitedLimit({ value: raw });
    const finiteCap = unlimited ? null : Math.max(raw, 0);
    const approved = gallery.rows.filter(
        ({ moderationState }) => moderationState === ModerationStatusEnum.APPROVED
    );
    const hiddenCount = partitionGalleryByCap({ items: approved, cap: finiteCap }).hidden.length;
    const breakdown = await readBreakdown({
        vertical,
        listingId,
        ownerId,
        key: limitKey,
        raw,
        source
    });
    const common = {
        limitKey,
        source,
        used: gallery.used,
        hiddenCount,
        breakdown
    } as const;
    if (finiteCap === null) {
        return { ...common, status: 'UNLIMITED', cap: null, coverAllowed: true };
    }
    if (finiteCap === 0) {
        return { ...common, status: 'NONE', cap: 0, coverAllowed: false };
    }
    return { ...common, status: 'LIMITED', cap: finiteCap, coverAllowed: true };
}
