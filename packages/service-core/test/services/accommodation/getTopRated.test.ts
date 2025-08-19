/**
 * @fileoverview
 * Test suite for the AccommodationService.getTopRated method.
 * Covers success, permissions, validation, and model error propagation.
 */
import type { AccommodationModel } from '@repo/db';
import { type AccommodationType, PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createListActor = () => createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });

describe('AccommodationService.getTopRated', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock> &
        Partial<AccommodationModel> & {
            findTopRated: ReturnType<typeof vi.fn>;
        };

    beforeEach(() => {
        model = createModelMock(['findTopRated']) as unknown as ReturnType<
            typeof createModelMock
        > & {
            findTopRated: ReturnType<typeof vi.fn>;
        };
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        vi.clearAllMocks();
    });

    it('returns mapped top-rated accommodations with required fields', async () => {
        // Arrange
        const actor = createListActor();
        const base: AccommodationType = createAccommodationWithMockIds({
            averageRating: 5,
            reviewsCount: 25,
            isFeatured: true
        });
        const items: AccommodationType[] = [
            {
                ...base,
                amenities: [
                    {
                        accommodationId: base.id,
                        amenityId: 'amenity-1' as any,
                        isOptional: false,
                        amenity: {
                            id: 'amenity-1' as any,
                            slug: 'wifi',
                            name: 'WiFi',
                            isFeatured: false,
                            isBuiltin: true,
                            type: 'CONNECTIVITY' as any
                        }
                    }
                ],
                features: [
                    {
                        accommodationId: base.id,
                        featureId: 'feature-1' as any,
                        feature: {
                            id: 'feature-1' as any,
                            slug: 'pool',
                            name: 'Pool',
                            isFeatured: true,
                            isBuiltin: false
                        }
                    }
                ]
            }
        ];
        (model.findTopRated as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(items);

        // Act
        const result = await service.getTopRated(actor, { limit: 5 });

        // Assert
        expect(result.error).toBeUndefined();
        expect(Array.isArray(result.data)).toBe(true);
        const first = result.data?.[0];
        expect(first?.name).toBe(base.name);
        expect(first?.slug).toBe(base.slug);
        expect(first?.summary).toBe(base.summary);
        expect(first?.price).toEqual(base.price);
        expect(first?.type).toBe(base.type);
        expect(first?.isFeatured).toBe(true);
        expect(Array.isArray(first?.amenities)).toBe(true);
        expect(Array.isArray(first?.features)).toBe(true);
    });

    it('enforces list permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        vi.spyOn(permissionHelpers, 'checkCanList').mockImplementationOnce(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        });

        // Act
        const result = await service.getTopRated(actor, { limit: 3 });

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('validates input (limit must be >=1)', async () => {
        // Arrange
        const actor = createListActor();

        // Act
        const result = await service.getTopRated(actor, { limit: 0 as unknown as number });

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('propagates model errors', async () => {
        // Arrange
        const actor = createListActor();
        (model.findTopRated as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('db error')
        );

        // Act
        const result = await service.getTopRated(actor, {});

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
