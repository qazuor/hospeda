/**
 * Owner decision 17 (Mi cuenta UI epic): every exclusive deal carries the
 * public slug of the accommodation it targets, read in ONE query per page.
 */
import type { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import { PermissionEnum, TouristAudienceEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachAccommodationSlugs } from '../../../src/services/owner-promotion/ownerPromotion.exclusive-deals';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const ACC_A = '11111111-1111-4111-8111-111111111111';
const ACC_B = '22222222-2222-4222-8222-222222222222';
const ACC_GONE = '33333333-3333-4333-8333-333333333333';

const deal = (overrides: Record<string, unknown>) =>
    ({
        id: `deal-${String(overrides.entityId ?? overrides.accommodationId ?? 'wide')}`,
        entityId: null,
        accommodationId: null,
        ...overrides
    }) as never;

const accommodation = (id: string, slug: string, overrides: Record<string, unknown> = {}) => ({
    id,
    slug,
    publicationStatus: 'PUBLISHED',
    deletedAt: null,
    ...overrides
});

describe('attachAccommodationSlugs', () => {
    let findByIds: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        findByIds = vi.fn();
    });

    it('reads every target in one query and keeps the order', async () => {
        // Arrange
        findByIds.mockResolvedValue([
            accommodation(ACC_B, 'cabana-b'),
            accommodation(ACC_A, 'casa-a')
        ]);
        const items = [
            deal({ entityId: ACC_A }),
            deal({ accommodationId: ACC_B }),
            deal({ entityId: ACC_A, id: 'second-a' })
        ];

        // Act
        const result = await attachAccommodationSlugs({
            items,
            accommodationModel: { findByIds } as unknown as AccommodationModel
        });

        // Assert
        expect(findByIds).toHaveBeenCalledTimes(1);
        expect(findByIds.mock.calls[0]?.[0]).toEqual([ACC_A, ACC_B]);
        expect(result.map((row) => row.accommodationSlug)).toEqual([
            'casa-a',
            'cabana-b',
            'casa-a'
        ]);
    });

    it('gives null to an owner-wide deal, without a query when nothing targets one', async () => {
        const result = await attachAccommodationSlugs({
            items: [deal({})],
            accommodationModel: { findByIds } as unknown as AccommodationModel
        });
        expect(result[0]?.accommodationSlug).toBeNull();
        expect(findByIds).not.toHaveBeenCalled();
    });

    it('never links to an accommodation that is not public any more', async () => {
        findByIds.mockResolvedValue([
            accommodation(ACC_A, 'draft', { publicationStatus: 'DRAFT' }),
            accommodation(ACC_B, 'deleted', { deletedAt: new Date() })
        ]);
        const result = await attachAccommodationSlugs({
            items: [
                deal({ entityId: ACC_A }),
                deal({ entityId: ACC_B }),
                deal({ entityId: ACC_GONE })
            ],
            accommodationModel: { findByIds } as unknown as AccommodationModel
        });
        expect(result.map((row) => row.accommodationSlug)).toEqual([null, null, null]);
    });
});

describe('OwnerPromotionService.findExclusiveDeals carries the slug', () => {
    it('returns each deal with accommodationSlug', async () => {
        const modelMock = createModelMock([]);
        modelMock.findAll.mockResolvedValue({ items: [deal({ entityId: ACC_A })], total: 1 });
        const findByIds = vi.fn().mockResolvedValue([accommodation(ACC_A, 'casa-a')]);
        const service = new OwnerPromotionService({
            logger: createLoggerMock(),
            model: modelMock as unknown as OwnerPromotionModel,
            accommodationModel: { findById: vi.fn(), findByIds } as unknown as AccommodationModel
        });

        const result = await service.findExclusiveDeals(
            createActor({ permissions: [PermissionEnum.ACCESS_API_PUBLIC] }),
            { page: 1, pageSize: 20 },
            [TouristAudienceEnum.PLUS]
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.total).toBe(1);
        expect(result.data?.items[0]?.accommodationSlug).toBe('casa-a');
    });
});
