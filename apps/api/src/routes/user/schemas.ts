import { z } from '@hono/zod-openapi';
import { UserCreateInputSchema, UserSchema, UserUpdateInputSchema } from '@repo/schemas';

/**
 * User API schemas
 * Uses real schemas from @repo/schemas with OpenAPI wrappers
 */

/**
 * User response schema for API
 * Uses real UserSchema from @repo/schemas but omits circular dependencies
 */
export const userResponseSchema = z
    .object(UserSchema.omit({ bookmarks: true }).shape)
    .openapi('UserResponse');

/**
 * User creation schema for API input
 * Uses real UserCreateInputSchema from @repo/schemas with OpenAPI wrapper
 */
export const userCreateSchema = z.object(UserCreateInputSchema.shape).openapi('UserCreate');

/**
 * User update schema for API input
 * Uses real UserUpdateInputSchema from @repo/schemas with OpenAPI wrapper
 */
export const userUpdateSchema = z.object(UserUpdateInputSchema.shape).openapi('UserUpdate');

/**
 * Legacy schema for backward compatibility
 * @deprecated Use userResponseSchema instead
 */
export const UserSchema_deprecated = userResponseSchema;

/**
 * User list schema for API responses
 */
export const userListSchema = z.array(userResponseSchema).openapi('UserList');

/**
 * Parameter schemas for route validation
 */
export const ParamsSchema = z.object({
    id: z
        .string()
        .min(1, 'User ID is required')
        .openapi({
            param: {
                name: 'id',
                in: 'path'
            },
            example: 'usr_1234567890'
        })
});

// Export with original names for backward compatibility
export { userListSchema as UserListSchema, userResponseSchema as UserSchema };
