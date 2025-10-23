import { z } from 'zod';
import { FeaturedTypeEnum } from './featured-type.enum';

export const FeaturedTypeSchema = z.nativeEnum(FeaturedTypeEnum, {
    message: 'zodError.enums.featuredType.invalid'
});
