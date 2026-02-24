import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { RoleEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for users.
 * Extends base admin search with user-specific filters.
 *
 * @example
 * ```ts
 * const params = UserAdminSearchSchema.parse({
 *   page: 1,
 *   role: 'admin',
 *   search: 'john'
 * });
 * ```
 */
export const UserAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by user role */
    role: RoleEnumSchema.optional().describe('Filter by user role'),
    /** Filter by email (partial match) */
    email: z.string().optional().describe('Filter by email (partial match)'),
    /** Filter by auth provider */
    authProvider: z.string().optional().describe('Filter by authentication provider')
});

/** Inferred TypeScript type for user admin search parameters */
export type UserAdminSearch = z.infer<typeof UserAdminSearchSchema>;
