import { EventCategoryEnum } from '@repo/types/src/enums/event-category.enum';
import { z } from 'zod';

export const EventCategoryEnumSchema = z.enum(
    Object.values(EventCategoryEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.eventCategory.invalid' })
    }
);
