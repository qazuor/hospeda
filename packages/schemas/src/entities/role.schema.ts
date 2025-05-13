import { z } from 'zod';
import { BaseEntitySchema } from '../common.schema';
import { omittedBaseEntityFieldsForActions } from '../utils/utils';

/**
 * Zod schema for role entity.
 */
export const RoleSchema = BaseEntitySchema.extend({
    description: z
        .string()
        .min(3, 'error:user.role.description.min_lenght')
        .max(100, 'error:user.role.description.max_lenght'),
    isBuiltIn: z.boolean({
        required_error: 'error:user.role.isBuiltIn.required',
        invalid_type_error: 'error:user.role.isBuiltIn.invalid_type'
    }),
    isDeprecated: z
        .boolean({
            required_error: 'error:user.role.isDeprecated.required',
            invalid_type_error: 'error:user.role.isDeprecated.invalid_type'
        })
        .optional(),
    isDefault: z
        .boolean({
            required_error: 'error:user.role.isDefault.required',
            invalid_type_error: 'error:user.role.isDefault.invalid_type'
        })
        .optional(),
    permissionsIds: z
        .array(z.string().uuid({ message: 'error:user.role.permissionId.invalid' }))
        .optional()
});

export type RoleInput = z.infer<typeof RoleSchema>;

export const RoleCreateSchema = RoleSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof RoleSchema.shape,
        true
    >
);

export const RoleUpdateSchema = RoleSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof RoleSchema.shape,
        true
    >
).partial();
