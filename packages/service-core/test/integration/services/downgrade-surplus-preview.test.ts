import { getDb, listingPublicationModel } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS, selectSurplusToLower } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { previewDowngradeSurplus } from '../../../src/services/billing/subscription/downgrade-surplus-preview.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    retirePlanChanges,
    seedPlanChange,
    seedPlanChangePublications,
    seedPlanChangeTargetWithLimit
} from './support/plan-change-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:15 downgrade surplus preview', () => {
    it('uses target limit, V6 recency, keep choice, publication states and owner scope', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const target = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 2
        });
        const listingIds = await seedPlanChangePublications({
            userId: seeded.user.id,
            statuses: [
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.DRAFT,
                PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                PublicationStatusEnum.ARCHIVED,
                PublicationStatusEnum.MODERATED,
                PublicationStatusEnum.PURGED
            ]
        });
        const other = await seedPlanChange({ rankRelation: 'HIGHER' });
        await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: other.planVersionId,
            targetLimit: 0
        });
        await seedPlanChangePublications({
            userId: other.user.id,
            statuses: [PublicationStatusEnum.PUBLISHED]
        });

        const preview = await previewDowngradeSurplus({
            userId: seeded.user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            targetPlanVersionId: target.planVersionId
        });
        expect(preview).toMatchObject({
            applicable: true,
            limitKey: PUBLICATION_LIMIT_KEYS.accommodation,
            targetLimit: 2,
            publishedCount: 3,
            surplusCount: 1,
            willLower: [{ id: listingIds[2] }],
            criterion: 'MOST_RECENTLY_PUBLISHED_FIRST',
            criterionI18nKey: 'listing.notices.surplus.criterion'
        });

        const selected = await previewDowngradeSurplus({
            userId: seeded.user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            targetPlanVersionId: target.planVersionId,
            keepListingIds: new Set([listingIds[2]!])
        });
        const rows = await listingPublicationModel.listByOwner({
            tx: getDb(),
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId: seeded.user.id
        });
        const published = rows.filter(
            (row) => row.publicationStatus === PublicationStatusEnum.PUBLISHED
        );
        const instants = await listingPublicationModel.readPublicationInstants({
            tx: getDb(),
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: published.map((row) => row.id)
        });
        const expected = selectSurplusToLower({
            published: published.map((row) => ({
                id: row.id,
                createdAt: row.createdAt,
                publishedAt: instants.get(row.id) ?? null
            })),
            limit: 2,
            keep: new Set([listingIds[2]!])
        });
        expect(selected).toMatchObject({ applicable: true, surplusCount: 1 });
        if (!selected.applicable) throw new Error('Listing vertical preview was not applicable');
        expect(selected.willLower.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
        expect(selected.willLower).toEqual([{ id: listingIds[1] }]);
    });

    it('returns a null target limit without surplus and marks non-listing verticals inapplicable', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const noLimit = await previewDowngradeSurplus({
            userId: seeded.user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            targetPlanVersionId: seeded.targetPlanVersionId
        });
        expect(noLimit).toMatchObject({
            applicable: true,
            targetLimit: null,
            publishedCount: 0,
            surplusCount: 0,
            willLower: []
        });
        const tourist = await previewDowngradeSurplus({
            userId: seeded.user.id,
            vertical: VerticalEnum.TOURIST,
            targetPlanVersionId: crypto.randomUUID()
        });
        expect(tourist).toEqual({ applicable: false });
    });
});
