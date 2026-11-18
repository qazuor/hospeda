/**
 * @fileoverview
 * Unit coverage for data-migration 0181 (HOS-2336): its static contract (meta,
 * legacy map, permission grants) and the no-drift guarantee against the seed
 * baseline. The behaviour against a real database lives in
 * `0181-hos2336-partner-types-catalog.integration.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PartnerTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0181-hos2336-partner-types-catalog.js';
import requiredManifest from '../../src/manifest-required.json';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const catalogSlugs = new Set(
    requiredManifest.partnerTypes.map(
        (file) =>
            (
                JSON.parse(
                    readFileSync(join(__dirname, '../../src/data/partnerType', file), 'utf-8')
                ) as { slug: string }
            ).slug
    )
);

const PARTNER_TYPE_PERMISSIONS = [
    PermissionEnum.PARTNER_TYPE_VIEW,
    PermissionEnum.PARTNER_TYPE_CREATE,
    PermissionEnum.PARTNER_TYPE_UPDATE,
    PermissionEnum.PARTNER_TYPE_DELETE,
    PermissionEnum.PARTNER_TYPE_RESTORE
];

describe('0181 meta', () => {
    it('is a required, non-destructive migration', () => {
        expect(migration.meta.name).toBe('0181-hos2336-partner-types-catalog');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
    });

    it('declares the legacy column it reads (HOS-433)', () => {
        expect(migration.meta.requiresColumns).toEqual([{ table: 'partners', column: 'type' }]);
    });
});

describe('0181 legacy type map', () => {
    it('covers every value of the legacy enum, and nothing else', () => {
        expect(Object.keys(migration.LEGACY_PARTNER_TYPE_TO_SLUG).sort()).toEqual(
            Object.values(PartnerTypeEnum).sort()
        );
    });

    it('only targets slugs that exist in the catalog baseline', () => {
        for (const [legacy, slug] of Object.entries(migration.LEGACY_PARTNER_TYPE_TO_SLUG)) {
            expect(catalogSlugs.has(slug), `${legacy} -> ${slug}`).toBe(true);
        }
    });
});

describe('0181 permission grants', () => {
    it('grants the five partnerType permissions to SUPER_ADMIN and ADMIN only', () => {
        expect(migration.GRANTS).toHaveLength(10);
        for (const role of [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]) {
            const granted = migration.GRANTS.filter((g) => g.role === role).map(
                (g) => g.permission
            );
            expect(granted.sort()).toEqual([...PARTNER_TYPE_PERMISSIONS].sort());
        }
    });

    it('matches the seed baseline in both directions (no drift)', () => {
        for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
            const inBaseline = (permissions ?? []).filter((p) =>
                PARTNER_TYPE_PERMISSIONS.includes(p)
            );
            const inMigration = migration.GRANTS.filter((g) => g.role === role).map(
                (g) => g.permission
            );
            expect(inBaseline.sort(), `role ${role}`).toEqual(inMigration.sort());
        }
    });
});
