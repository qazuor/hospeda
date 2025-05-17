import { z } from 'zod';
import { BaseEntitySchema } from '../common.schema.js';
import { omittedBaseEntityFieldsForActions } from '../utils/utils.js';

/**
 * Zod schema for permission entity.
 */
export const PermissionSchema = BaseEntitySchema.extend({
    description: z
        .string()
        .min(3, 'error:user.permission.description.min_lenght')
        .max(100, 'error:user.permission.description.max_lenght'),
    isBuiltIn: z.boolean({
        required_error: 'error:user.permission.isBuiltIn.required',
        invalid_type_error: 'error:user.permission.isBuiltIn.invalid_type'
    }),
    isDeprecated: z
        .boolean({
            required_error: 'error:user.permission.isDeprecated.required',
            invalid_type_error: 'error:user.permission.isDeprecated.invalid_type'
        })
        .optional()
});

export type PermissionInput = z.infer<typeof PermissionSchema>;

export const PermissionCreateSchema = PermissionSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof PermissionSchema.shape,
        true
    >
);

export const PermissionUpdateSchema = PermissionSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof PermissionSchema.shape,
        true
    >
).partial();
