import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0110-hos1457-v53-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

/**
 * 0110 is ledgered and frozen. A role born after it gets its grants from its own
 * data-migration (PARTNER_OWNER: 0143, HOS-1487), never by editing 0110.
 */
const ROLES_BORN_AFTER_0110: readonly RoleEnum[] = [RoleEnum.PARTNER_OWNER];

const rolesKnownTo0110 = (): RoleEnum[] =>
    Object.values(RoleEnum).filter((role) => !ROLES_BORN_AFTER_0110.includes(role));

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos1457-permissions-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** Returns a fake insert chain that records the actual write payload. */
function buildCtx(insertedRows: unknown[]): {
    ctx: SeedMigrationCtx;
    readInsertValues: () => unknown[];
} {
    let insertValues: unknown[] = [];
    const db = {
        insert: () => ({
            values: (rows: unknown[]) => {
                insertValues = rows;
                return {
                    onConflictDoNothing: () => ({ returning: () => Promise.resolve(insertedRows) })
                };
            }
        })
    } as unknown as SeedMigrationCtx['db'];
    const ctx = {
        db,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, readInsertValues: () => insertValues };
}

describe('TEST:V5:9 support — HOS-1457 permission data migration', () => {
    it('is a required additive migration with the ledger name', () => {
        expect(migration.meta).toEqual({
            name: '0110-hos1457-v53-permissions',
            group: 'required',
            destructive: false
        });
    });

    it('grants exactly the same new permission pairs as the seed baseline', () => {
        const newPermissions = new Set([
            PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
            PermissionEnum.BILLING_VIEW_OWN
        ]);
        const baseline = rolesKnownTo0110().flatMap((role) =>
            (ROLE_PERMISSIONS[role] ?? [])
                .filter((permission) => newPermissions.has(permission))
                .map((permission) => ({ role, permission }))
        );
        expect(migration.GRANTS.length).toBeGreaterThan(0);
        expect(
            [...migration.GRANTS].sort((a, b) =>
                `${a.role}|${a.permission}`.localeCompare(`${b.role}|${b.permission}`)
            )
        ).toEqual(
            baseline.sort((a, b) =>
                `${a.role}|${a.permission}`.localeCompare(`${b.role}|${b.permission}`)
            )
        );
        expect(
            new Set(migration.GRANTS.map((grant) => `${grant.role}|${grant.permission}`)).size
        ).toBe(migration.GRANTS.length);
    });

    it('grants foreign content edit and subscription inspection only to staff', () => {
        expect([...migration.STAFF_ROLES].sort()).toEqual(
            [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN].sort()
        );
        for (const grant of migration.GRANTS) {
            if (grant.permission !== PermissionEnum.BILLING_VIEW_OWN) {
                expect(migration.STAFF_ROLES).toContain(grant.role);
            }
        }
    });

    it('gives own billing to exactly the roles that hold USER_UPDATE_SELF, excluding guest and system', () => {
        const selfRoles = rolesKnownTo0110().filter((role) =>
            (ROLE_PERMISSIONS[role] ?? []).includes(PermissionEnum.USER_UPDATE_SELF)
        );
        expect([...migration.OWN_BILLING_ROLES].sort()).toEqual(selfRoles.sort());
        expect(migration.OWN_BILLING_ROLES).not.toContain(RoleEnum.GUEST);
        expect(migration.OWN_BILLING_ROLES).not.toContain(RoleEnum.SYSTEM);
    });

    it('inserts the exported grant pairs and is idempotent', async () => {
        const { ctx, readInsertValues } = buildCtx(migration.GRANTS.map((grant) => ({ ...grant })));
        const first = await migration.up(ctx);
        expect(readInsertValues()).toEqual(migration.GRANTS);
        expect(first.counts?.granted).toBe(migration.GRANTS.length);

        const { ctx: secondCtx } = buildCtx([]);
        const second = await migration.up(secondCtx);
        expect(second.counts?.granted).toBe(0);
        expect(second.counts?.alreadyPresent).toBe(migration.GRANTS.length);
    });
});
