import { EntityTypeEnum } from '@repo/types';
import { z } from 'zod';

export const EntityTypeEnumSchema = z.enum(Object.values(EntityTypeEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.entityType.invalid' })
});
