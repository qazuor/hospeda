import { EntityTypeEnum } from '@repo/types/src/enums/entity-type.enum';
import { z } from 'zod';

export const EntityTypeEnumSchema = z.enum(Object.values(EntityTypeEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.entityType.invalid' })
});
