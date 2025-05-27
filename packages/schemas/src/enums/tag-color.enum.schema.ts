import { TagColorEnum } from '@repo/types/src/enums/tag-color.enum';
import { z } from 'zod';

export const TagColorEnumSchema = z.enum(Object.values(TagColorEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.tagColor.invalid' })
});
