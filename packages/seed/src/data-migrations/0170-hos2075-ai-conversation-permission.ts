/**
 * @fileoverview HOS-2075 grants the staff read of listing AI chat conversations
 * (`aiConversation.viewAny`) to SUPER_ADMIN only. Run `db:migrate` (0203) first or
 * the new enum value fails with `invalid input value for enum permission_enum`.
 * The baseline (`rolePermissions.seed.ts`) carries the same grant for fresh DBs.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0170-hos2075-ai-conversation-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Exact grant paired with structural migration 0203 (SUPER_ADMIN only). */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.AI_CONVERSATION_VIEW_ANY }
];

/** Inserts the grant without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-2075 SUPER_ADMIN-only role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
