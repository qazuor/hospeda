import type { PermissionType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for permission entity.
 */
export const PermissionSchema: z.ZodType<PermissionType> = BaseEntitySchema.extend({
    description: z.string({ required_error: 'error:permission.descriptionRequired' }),
    isBuiltin: z.boolean({ required_error: 'error:permission.isBuiltinRequired' })
});
