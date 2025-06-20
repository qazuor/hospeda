import { EntityTypeEnum } from '@repo/types';
import { z } from 'zod';

export const EntityTypeEnumSchema = z.nativeEnum(EntityTypeEnum, {
    errorMap: () => ({ message: 'zodError.enums.entityType.invalid' })
});
