import { AccommodationTypeEnum } from '@repo/types/enums/accommodation-type.enum';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { getAccommodationsCategoriesOutputSchema } from '../../../services/homepage/homepage.schemas';
import { homepageService } from '../../../services/homepage/homepage.service';

describe('homepageService.getAccommodationsCategories', () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should return only categories with at least one accommodation', async () => {
        const counts: Record<string, number> = {
            [AccommodationTypeEnum.HOTEL]: 3,
            [AccommodationTypeEnum.CABIN]: 0,
            [AccommodationTypeEnum.HOSTEL]: 2,
            [AccommodationTypeEnum.APARTMENT]: 0
        };
        vi.spyOn(AccommodationModel, 'count').mockImplementation(
            async (params) => counts[params?.type as string] ?? 0
        );
        const result = await homepageService.getAccommodationsCategories();
        expect(result).toEqual(
            getAccommodationsCategoriesOutputSchema.parse({
                categories: [AccommodationTypeEnum.HOTEL, AccommodationTypeEnum.HOSTEL]
            })
        );
    });

    it('should return an empty array if no category has accommodations', async () => {
        vi.spyOn(AccommodationModel, 'count').mockResolvedValue(0);
        const result = await homepageService.getAccommodationsCategories();
        expect(result).toEqual(getAccommodationsCategoriesOutputSchema.parse({ categories: [] }));
    });
});
