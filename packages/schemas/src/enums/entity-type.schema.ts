import { z } from 'zod';
import { EntityTypeEnum } from './entity-type.enum.js';

export const EntityTypeEnumSchema = z.nativeEnum(EntityTypeEnum, {
    error: () => ({ message: 'zodError.enums.entityType.invalid' })
});
