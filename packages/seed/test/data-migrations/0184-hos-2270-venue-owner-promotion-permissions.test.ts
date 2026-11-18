/**
 * @fileoverview
 * Unit tests for `0184-hos-2270-venue-owner-promotion-permissions.ts` (HOS-2270).
 *
 * Mocks only the insert chain: the migration is one `INSERT ... ON CONFLICT DO NOTHING`,
 * and what matters is WHICH rows it asks for and that it never overwrites.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import * as migration from '../../src/data-migrations/0184-hos-2270-venue-owner-promotion-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

function buildCtx(returned: number) {
    const values = vi.fn();
    const onConflictDoNothing = vi.fn();
    const returning = vi.fn().mockResolvedValue(new Array(returned).fill({}));
    values.mockReturnValue({ onConflictDoNothing });
    onConflictDoNothing.mockReturnValue({ returning });
    const ctx = {
        db: { insert: vi.fn().mockReturnValue({ values }) }
    } as unknown as SeedMigrationCtx;
    return { ctx, values, onConflictDoNothing };
}

const SIX = [
    PermissionEnum.OWNER_PROMOTION_CREATE,
    PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_OWN,
    PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN,
    PermissionEnum.OWNER_PROMOTION_RESTORE_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN
];

describe('0184-hos-2270-venue-owner-promotion-permissions', () => {
    it('is required and additive', () => {
        expect(migration.meta).toEqual({
            name: '0184-hos-2270-venue-owner-promotion-permissions',
            group: 'required',
            destructive: false
        });
    });

    it('asks for exactly the six own-scoped permissions, for VENUE_OWNER only, never overwriting', async () => {
        const { ctx, values, onConflictDoNothing } = buildCtx(6);

        const result = await migration.up(ctx);

        expect(values).toHaveBeenCalledWith(
            SIX.map((permission) => ({ role: RoleEnum.VENUE_OWNER, permission }))
        );
        expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
        expect(result.counts).toEqual({ granted: 6, alreadyPresent: 0 });
    });

    it('reports a second run as all already present', async () => {
        const { ctx } = buildCtx(0);

        const result = await migration.up(ctx);

        expect(result.counts).toEqual({ granted: 0, alreadyPresent: 6 });
    });

    it('dual-write: the baseline grants the same six to VENUE_OWNER and no _ANY variant', () => {
        const baseline = ROLE_PERMISSIONS[RoleEnum.VENUE_OWNER] as readonly PermissionEnum[];

        for (const permission of SIX) expect(baseline).toContain(permission);
        expect(
            baseline.filter((permission) => permission.startsWith('ownerPromotion.'))
        ).toHaveLength(6);
        expect(baseline).not.toContain(PermissionEnum.OWNER_PROMOTION_VIEW_ANY);
    });
});
