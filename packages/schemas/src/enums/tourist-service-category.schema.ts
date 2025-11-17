import { z } from 'zod';
import { TouristServiceCategoryEnum } from './tourist-service-category.enum';

export const TouristServiceCategorySchema = z.nativeEnum(TouristServiceCategoryEnum, {
    message: 'zodError.enums.touristServiceCategory.invalid'
});
