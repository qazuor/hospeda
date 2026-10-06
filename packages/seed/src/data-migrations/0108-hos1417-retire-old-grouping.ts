/**
 * @fileoverview
 * Data migration: 0108-hos1417-retire-old-grouping
 *
 * Converges already-seeded partners and role grants with the HOS-1417 baseline.
 * The structural migration does the same cleanup before recreating pg enums;
 * this repeat is safe after db:migrate and repairs databases seeded later.
 */
import { rolePermission, sql, userPermission } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0108-hos1417-retire-old-grouping',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    await ctx.db.execute(sql`UPDATE partners SET type = 'business' WHERE type::text = 'commerce'`);
    await ctx.db.execute(
        sql`UPDATE alliance_leads SET partner_type = 'business' WHERE partner_type = 'commerce'`
    );
    // Both grant tables have composite primary keys, unsupported by safeDelete.
    await ctx.db.delete(rolePermission).where(sql`
        ${rolePermission.role}::text = 'COMMERCE_OWNER'
        OR ${rolePermission.permission}::text IN
            ('commerce.editOwn', 'commerce.create', 'commerce.viewAll', 'commerce.editAll',
             'commerce.delete', 'commerce.moderateReview', 'commerce.moderationChange')
    `);
    await ctx.db.delete(userPermission).where(sql`
        ${userPermission.permission}::text IN
            ('commerce.editOwn', 'commerce.create', 'commerce.viewAll', 'commerce.editAll',
             'commerce.delete', 'commerce.moderateReview', 'commerce.moderationChange')
    `);
    return { summary: 'Retired old partner types and obsolete role grants.' };
}
