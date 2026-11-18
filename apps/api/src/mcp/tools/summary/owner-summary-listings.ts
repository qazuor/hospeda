/**
 * @file owner-summary-listings.ts
 * @description The listing half of `get_owner_summary` (HOS-2331): counts per
 * publication state and the drafts that are not ready to publish.
 *
 * Both are computed over the rows `readMyListingRows` already loaded (the same
 * service calls `list_my_listings` makes, so the counts match its listings by
 * construction, AC-C29). Completeness runs the publish rules in batch
 * (`evaluateListingsPublishCompleteness`): one media query per vertical, never
 * one per listing (AC-C32).
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { evaluateListingsPublishCompleteness } from '../../../services/listing-publication/listing-publish-completeness-batch';
import { env } from '../../../utils/env';
import { buildPortalUrl } from '../../portal/build-portal-url';
import type { MyListingRows } from '../listing/list-my-listings';
import { editorLink, firstMissingSection } from '../listing/listing-refusal-actions';
import { LISTING_TOOL_VERTICALS, type ListingToolVertical } from '../listing/listing-services';
import {
    type AttentionItem,
    isOwnerSummaryStatus,
    type OwnerSummaryStatus,
    type VerticalListingCounts
} from './owner-summary-types';

/** The fields of a stored listing the counts read. */
interface CountedRow {
    readonly id: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
}

/**
 * Counts one vertical's rows per publication state. Purged listings are not
 * counted (spec §6.6).
 *
 * @param args - The rows read and the owner's total in the vertical
 * @returns The counts, flagged `partial` when the read did not cover every listing
 */
export function countListingsByStatus({
    rows,
    total
}: {
    readonly rows: readonly CountedRow[];
    readonly total: number;
}): VerticalListingCounts {
    // Typed as a full Record: a new counted state fails to compile here until it is added.
    const byStatus: Record<OwnerSummaryStatus, number> = {
        [PublicationStatusEnum.DRAFT]: 0,
        [PublicationStatusEnum.PUBLISHED]: 0,
        [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: 0,
        [PublicationStatusEnum.ARCHIVED]: 0,
        [PublicationStatusEnum.MODERATED]: 0
    };
    let counted = 0;
    for (const row of rows) {
        if (isOwnerSummaryStatus(row.publicationStatus)) {
            byStatus[row.publicationStatus] += 1;
            counted += 1;
        }
    }
    const counts: VerticalListingCounts = { total: counted, byStatus };
    return rows.length < total ? { ...counts, partial: true } : counts;
}

/**
 * Counts every vertical.
 *
 * @param args - The owner's rows
 * @returns The counts per vertical, all three present
 */
export function countAllListings({
    rows
}: {
    readonly rows: MyListingRows;
}): Readonly<Record<ListingToolVertical, VerticalListingCounts>> {
    return {
        [VerticalEnum.ACCOMMODATION]: countListingsByStatus(rows[VerticalEnum.ACCOMMODATION]),
        [VerticalEnum.VENUE]: countListingsByStatus(rows[VerticalEnum.VENUE]),
        [VerticalEnum.EXPERIENCE]: countListingsByStatus(rows[VerticalEnum.EXPERIENCE])
    };
}

/** The requirements that mean "no main photo", per vertical's rules. */
const PHOTO_REQUIREMENTS: ReadonlySet<string> = new Set(['mainImage', 'media.featuredImage']);

/** Builds a portal URL from the configured site URL. */
function portalUrl(destination: Parameters<typeof buildPortalUrl>[0]['destination']): string {
    return buildPortalUrl({ destination, siteUrl: env.HOSPEDA_SITE_URL });
}

/**
 * Turns one draft's unmet requirements into attention items: `missing_photos`
 * (to the editor's photos section) when the main photo is missing, and
 * `incomplete` (to the section of the first other requirement, or the hub)
 * when anything else is. A draft never yields the same item twice.
 */
function draftItems(args: {
    readonly vertical: ListingToolVertical;
    readonly row: CountedRow;
    readonly missing: readonly string[];
}): AttentionItem[] {
    const { vertical, row, missing } = args;
    const listing = { id: row.id, vertical, name: row.name };
    const ref = { vertical, id: row.id };
    const items: AttentionItem[] = [];
    const rest = missing.filter((item) => !PHOTO_REQUIREMENTS.has(item));
    if (rest.length > 0) {
        items.push({
            kind: 'incomplete',
            listing,
            missing: rest,
            actionUrl: portalUrl(
                editorLink({ ref, section: firstMissingSection({ vertical, missing: rest }) })
            )
        });
    }
    if (rest.length < missing.length) {
        items.push({
            kind: 'missing_photos',
            listing,
            actionUrl: portalUrl(
                editorLink({
                    ref,
                    section: firstMissingSection({
                        vertical,
                        missing: missing.filter((item) => PHOTO_REQUIREMENTS.has(item))
                    })
                })
            )
        });
    }
    return items;
}

/**
 * The drafts that are not ready to publish, as attention items. Only `DRAFT`
 * listings are evaluated (spec §6.6), in batch per vertical.
 *
 * @param args - The owner's rows
 * @returns The `incomplete` and `missing_photos` items, in listing order
 */
export async function readDraftAttention({
    rows
}: {
    readonly rows: MyListingRows;
}): Promise<readonly AttentionItem[]> {
    const isDraft = (row: CountedRow): boolean =>
        row.publicationStatus === PublicationStatusEnum.DRAFT;
    const accommodationDrafts = rows[VerticalEnum.ACCOMMODATION].rows.filter(isDraft);
    const venueDrafts = rows[VerticalEnum.VENUE].rows.filter(isDraft);
    const experienceDrafts = rows[VerticalEnum.EXPERIENCE].rows.filter(isDraft);
    const [accommodation, venue, experience] = await Promise.all([
        evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.ACCOMMODATION,
            listings: accommodationDrafts
        }),
        evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.VENUE,
            listings: venueDrafts
        }),
        evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.EXPERIENCE,
            listings: experienceDrafts
        })
    ]);
    const missingByVertical = {
        [VerticalEnum.ACCOMMODATION]: { drafts: accommodationDrafts, missing: accommodation },
        [VerticalEnum.VENUE]: { drafts: venueDrafts, missing: venue },
        [VerticalEnum.EXPERIENCE]: { drafts: experienceDrafts, missing: experience }
    };
    const items: AttentionItem[] = [];
    for (const vertical of LISTING_TOOL_VERTICALS) {
        const { drafts, missing } = missingByVertical[vertical];
        for (const row of drafts) {
            const unmet = missing.get(row.id);
            if (unmet !== undefined && unmet.length > 0) {
                items.push(...draftItems({ vertical, row, missing: unmet }));
            }
        }
    }
    return items;
}
