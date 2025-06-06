import type { AccommodationId, DestinationId } from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { DestinationModel } from '../../../models/destination/destination.model';
import { AccommodationService } from '../../../services/accommodation/accommodation.service';
import type * as LoggerModule from '../../../utils/logger';
import { getMockAccommodation } from '../../mockData';

vi.mock('../../../utils/logger', async (importOriginal) => {
    const actual: typeof LoggerModule = await importOriginal();
    return {
        ...actual,
        dbLogger: {
            info: vi.fn(),
            error: vi.fn(),
            permission: vi.fn()
        }
    };
});

vi.mock('../../../models/accommodation/accommodation.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        AccommodationModel: {
            ...((actual as Record<string, unknown>).AccommodationModel ?? {}),
            search: vi.fn()
        }
    };
});

vi.mock('../../../models/destination/destination.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        DestinationModel: {
            ...((actual as Record<string, unknown>).DestinationModel ?? {}),
            list: vi.fn()
        }
    };
});

describe('accommodation.service.getForHome', () => {
    it('should return the top N accommodations for each destination, ordered by averageRating desc', async () => {
        // Arrange
        const destinationId1 = 'dest-1' as DestinationId;
        const destinationId2 = 'dest-2' as DestinationId;
        const accommodation1 = getMockAccommodation({
            id: 'acc-1' as AccommodationId,
            destinationId: destinationId1,
            averageRating: 4.9
        });
        const accommodation2 = getMockAccommodation({
            id: 'acc-2' as AccommodationId,
            destinationId: destinationId1,
            averageRating: 4.7
        });
        const accommodation3 = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            destinationId: destinationId2,
            averageRating: 4.8
        });
        const accommodation4 = getMockAccommodation({
            id: 'acc-4' as AccommodationId,
            destinationId: destinationId2,
            averageRating: 4.6
        });
        (DestinationModel.list as Mock).mockResolvedValue([
            { id: destinationId1 },
            { id: destinationId2 }
        ]);
        (AccommodationModel.search as Mock).mockImplementation(({ destinationId }) => {
            if (destinationId === destinationId1) {
                return Promise.resolve([accommodation1, accommodation2]);
            }
            if (destinationId === destinationId2) {
                return Promise.resolve([accommodation3, accommodation4]);
            }
            return Promise.resolve([]);
        });
        const limitAccommodationByDestination = 2;
        // Act
        const result = await AccommodationService.getForHome({ limitAccommodationByDestination });
        // Assert
        expect(result.accommodationsByDestination).toEqual({
            [destinationId1]: [accommodation1, accommodation2],
            [destinationId2]: [accommodation3, accommodation4]
        });
    });

    it('should return an empty array for destinations with no accommodations', async () => {
        // Arrange
        const destinationId1 = 'dest-1' as DestinationId;
        const destinationId2 = 'dest-2' as DestinationId;
        (DestinationModel.list as Mock).mockResolvedValue([
            { id: destinationId1 },
            { id: destinationId2 }
        ]);
        (AccommodationModel.search as Mock).mockImplementation(() => Promise.resolve([]));
        const limitAccommodationByDestination = 2;
        // Act
        const result = await AccommodationService.getForHome({ limitAccommodationByDestination });
        // Assert
        expect(result.accommodationsByDestination).toEqual({
            [destinationId1]: [],
            [destinationId2]: []
        });
    });

    it('should use all destinations in the system if destinationIds is not provided', async () => {
        // Arrange
        const destinationId1 = 'dest-1' as DestinationId;
        const destinationId2 = 'dest-2' as DestinationId;
        const accommodation1 = getMockAccommodation({
            id: 'acc-1' as AccommodationId,
            destinationId: destinationId1,
            averageRating: 4.9
        });
        const accommodation2 = getMockAccommodation({
            id: 'acc-2' as AccommodationId,
            destinationId: destinationId2,
            averageRating: 4.8
        });
        (DestinationModel.list as Mock).mockResolvedValue([
            { id: destinationId1 },
            { id: destinationId2 }
        ]);
        (AccommodationModel.search as Mock).mockImplementation(({ destinationId }) => {
            if (destinationId === destinationId1) {
                return Promise.resolve([accommodation1]);
            }
            if (destinationId === destinationId2) {
                return Promise.resolve([accommodation2]);
            }
            return Promise.resolve([]);
        });
        const limitAccommodationByDestination = 1;
        // Act
        const result = await AccommodationService.getForHome({ limitAccommodationByDestination });
        // Assert
        expect(result.accommodationsByDestination).toEqual({
            [destinationId1]: [accommodation1],
            [destinationId2]: [accommodation2]
        });
    });

    it('should respect the limitAccommodationByDestination parameter for each destination', async () => {
        // Arrange
        const destinationId1 = 'dest-1' as DestinationId;
        const destinationId2 = 'dest-2' as DestinationId;
        const accommodation1 = getMockAccommodation({
            id: 'acc-1' as AccommodationId,
            destinationId: destinationId1,
            averageRating: 4.9
        });
        const accommodation2 = getMockAccommodation({
            id: 'acc-2' as AccommodationId,
            destinationId: destinationId1,
            averageRating: 4.7
        });
        const accommodation3 = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            destinationId: destinationId1,
            averageRating: 4.5
        });
        const accommodation4 = getMockAccommodation({
            id: 'acc-4' as AccommodationId,
            destinationId: destinationId2,
            averageRating: 4.8
        });
        const accommodation5 = getMockAccommodation({
            id: 'acc-5' as AccommodationId,
            destinationId: destinationId2,
            averageRating: 4.6
        });
        (DestinationModel.list as Mock).mockResolvedValue([
            { id: destinationId1 },
            { id: destinationId2 }
        ]);
        (AccommodationModel.search as Mock).mockImplementation(({ destinationId }) => {
            if (destinationId === destinationId1) {
                return Promise.resolve([accommodation1, accommodation2, accommodation3]);
            }
            if (destinationId === destinationId2) {
                return Promise.resolve([accommodation4, accommodation5]);
            }
            return Promise.resolve([]);
        });
        const limitAccommodationByDestination = 2;
        // Act
        const result = await AccommodationService.getForHome({ limitAccommodationByDestination });
        // Assert
        expect(result.accommodationsByDestination).toEqual({
            [destinationId1]: [accommodation1, accommodation2],
            [destinationId2]: [accommodation4, accommodation5]
        });
    });

    it('should return an empty object if there are no destinations in the system', async () => {
        // Arrange
        (DestinationModel.list as Mock).mockResolvedValue([]);
        const limitAccommodationByDestination = 2;
        // Act
        const result = await AccommodationService.getForHome({ limitAccommodationByDestination });
        // Assert
        expect(result.accommodationsByDestination).toEqual({});
    });

    it('should work correctly if destinationIds is an empty array (return empty object)', async () => {
        // Arrange
        const limitAccommodationByDestination = 2;
        // Act
        const result = await AccommodationService.getForHome({
            limitAccommodationByDestination,
            destinationIds: []
        });
        // Assert
        expect(result.accommodationsByDestination).toEqual({});
    });
});
