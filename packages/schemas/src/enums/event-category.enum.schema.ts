import { EventCategoryEnum } from '@repo/types';
import { z } from 'zod';

export const EventCategoryEnumSchema = z.nativeEnum(EventCategoryEnum, {
    errorMap: () => ({ message: 'zodError.enums.eventCategory.invalid' })
});
