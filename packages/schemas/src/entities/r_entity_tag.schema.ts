import { z } from 'zod';
import { EntityTypeEnumSchema } from '../enums.schema';

/**
 * Zod schema entity/tag relationship.
 */
export const EntityTagRelationSchema = z.object({
    entityId: z.string().uuid({ message: 'error:common.entity_tag.entityId.invalid' }),
    entityType: EntityTypeEnumSchema,
    tagId: z.string().uuid({ message: 'error:common.entity_tag.tagId.invalid' })
});

export type EntityTagRelationInput = z.infer<typeof EntityTagRelationSchema>;
