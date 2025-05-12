import type { EntityTagType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for tag assignment to an entity.
 */
export const rEntityTagsSchema: z.ZodType<EntityTagType> = BaseEntitySchema.extend({
    tagId: z.string().uuid({ message: 'error:entityTag.tagIdInvalid' }),
    entityId: z.string().uuid({ message: 'error:entityTag.entityIdInvalid' }),
    entityType: z.string({ required_error: 'error:entityTag.entityTypeRequired' })
});
