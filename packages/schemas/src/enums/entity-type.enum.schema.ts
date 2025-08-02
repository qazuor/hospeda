import { EntityTypeEnum } from '@repo/types';
import { z } from 'zod';

export const EntityTypeEnumSchema = z.nativeEnum(EntityTypeEnum, {
    error: () => ({ message: 'zodError.enums.entityType.invalid' })
});
