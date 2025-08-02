import { EventCategoryEnum } from '@repo/types';
import { z } from 'zod';

export const EventCategoryEnumSchema = z.nativeEnum(EventCategoryEnum, {
    error: () => ({ message: 'zodError.enums.eventCategory.invalid' })
});
