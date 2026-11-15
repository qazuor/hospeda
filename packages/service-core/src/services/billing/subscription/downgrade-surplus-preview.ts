import { and, eq, getDb, listingPublicationModel, planVersionLimits } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    PUBLICATION_LIMIT_KEYS,
    type PublicationVertical,
    selectSurplusToLower
} from '@repo/verticals';

/** Typed preview of the listing surplus for a requested downgrade. */
export type DowngradeSurplusPreview =
    | { readonly applicable: false }
    | {
          readonly applicable: true;
          readonly limitKey: string;
          readonly targetLimit: number | null;
          readonly publishedCount: number;
          readonly surplusCount: number;
          readonly willLower: readonly { readonly id: string }[];
          readonly criterion: 'MOST_RECENTLY_PUBLISHED_FIRST';
          readonly criterionI18nKey: 'listing.notices.surplus.criterion';
      };

/** Reads the destination limit and applies V6's published-listing ordering. */
export async function previewDowngradeSurplus(input: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly targetPlanVersionId: string;
    readonly keepListingIds?: ReadonlySet<string>;
}): Promise<DowngradeSurplusPreview> {
    if (!isPublicationVertical(input.vertical)) return { applicable: false };
    const limitKey = PUBLICATION_LIMIT_KEYS[input.vertical];
    const db = getDb();
    const [limitRow] = await db
        .select({ value: planVersionLimits.value })
        .from(planVersionLimits)
        .where(
            and(
                eq(planVersionLimits.planVersionId, input.targetPlanVersionId),
                eq(planVersionLimits.key, limitKey)
            )
        )
        .limit(1);
    const targetLimit = limitRow?.value ?? null;
    const listings = await listingPublicationModel.listByOwner({
        tx: db,
        vertical: input.vertical,
        ownerId: input.userId
    });
    const published = listings.filter(
        (row) => row.publicationStatus === PublicationStatusEnum.PUBLISHED
    );
    const instants = await listingPublicationModel.readPublicationInstants({
        tx: db,
        vertical: input.vertical,
        listingIds: published.map((row) => row.id)
    });
    const willLower =
        targetLimit === null
            ? []
            : selectSurplusToLower({
                  published: published.map((row) => ({
                      id: row.id,
                      createdAt: row.createdAt,
                      publishedAt: instants.get(row.id) ?? null
                  })),
                  limit: targetLimit,
                  keep: input.keepListingIds
              });
    return {
        applicable: true,
        limitKey,
        targetLimit,
        publishedCount: published.length,
        surplusCount: willLower.length,
        willLower: willLower.map(({ id }) => ({ id })),
        criterion: 'MOST_RECENTLY_PUBLISHED_FIRST',
        criterionI18nKey: 'listing.notices.surplus.criterion'
    };
}

function isPublicationVertical(vertical: VerticalEnum): vertical is PublicationVertical {
    return (
        vertical === VerticalEnum.ACCOMMODATION ||
        vertical === VerticalEnum.VENUE ||
        vertical === VerticalEnum.EXPERIENCE
    );
}
