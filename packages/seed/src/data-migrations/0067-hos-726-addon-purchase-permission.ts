/**
 * @fileoverview
 * Data migration: 0067-hos-726-addon-purchase-permission
 *
 * HOS-1419 (U1.4): this migration granted a permission of the retired
 * billing system. That permission no longer exists in the permission enum, so
 * there is nothing left to grant. The file is kept (not deleted) because the
 * `seed_migrations` ledger of live environments references it by name; `up` is
 * a documented no-op.
 *
 * ## `destructive` flag decision
 *
 * `false` — it does nothing.
 */
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0067-hos-726-addon-purchase-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * No-op: the permission this migration used to grant was retired with the old
 * billing system (HOS-1419).
 *
 * @param _ctx - Unused migration context.
 * @returns A result stating that nothing was done.
 */
export async function up(_ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return {
        summary: 'No-op: the permission this migration granted was retired (HOS-1419).',
        counts: { granted: 0 }
    };
}
