import { z } from 'zod';
import { EventCategoryEnum } from './event-category.enum.js';

export const EventCategoryEnumSchema = z.nativeEnum(EventCategoryEnum, {
    error: () => ({ message: 'zodError.enums.eventCategory.invalid' })
});
