/**
 * @fileoverview
 * Test suite for the AccommodationService.getTopRated method.
 * Covers success, permissions, validation, and model error propagation.
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
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
        model = createModelMock(['findTopRated']) as any;
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        vi.clearAllMocks();
    });

    it('returns mapped top-rated accommodations with required fields', async () => {
        // Arrange
        const actor = createListActor();
        const base = createAccommodationWithMockIds({
            averageRating: 5,
            reviewsCount: 25,
            isFeatured: true
        });
        const items = [base];
        (model.findTopRated as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(items);

        // Act
        const result = await service.getTopRated(actor, { limit: 5 });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
        expect(result.data?.accommodations).toBeDefined();
        expect(Array.isArray(result.data?.accommodations)).toBe(true);
        const first = result.data?.accommodations?.[0];
        expect(first?.name).toBe(base.name);
        expect(first?.slug).toBe(base.slug);
        expect(first?.summary).toBe(base.summary);
        expect(first?.price).toEqual(base.price);
        expect(first?.type).toBe(base.type);
        expect(first?.isFeatured).toBe(true);
        // Note: amenities and features are not part of the new schema structure
        // They are handled through relations in the database
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
        const result = await service.getTopRated(actor, { limit: 10 });

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
