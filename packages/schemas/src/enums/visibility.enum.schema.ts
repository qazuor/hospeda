import { VisibilityEnum } from '@repo/types/src/enums/visibility.enum';
import { z } from 'zod';

export const VisibilityEnumSchema = z.enum(Object.values(VisibilityEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.visibility.invalid' })
});
