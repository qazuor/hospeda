import { z } from 'zod';
import { FeaturedStatusEnum } from './featured-status.enum';

export const FeaturedStatusSchema = z.nativeEnum(FeaturedStatusEnum, {
    message: 'zodError.enums.featuredStatus.invalid'
});
