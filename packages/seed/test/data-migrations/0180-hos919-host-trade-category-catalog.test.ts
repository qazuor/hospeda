/**
 * @fileoverview
 * Unit coverage for data-migration 0180 (HOS-919): its static contract (meta,
 * legacy map, permission grants) and the no-drift guarantee against the seed
 * baseline. The behaviour against a real database lives in
 * `0180-hos919-host-trade-category-catalog.integration.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HostTradeCategoryEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0180-hos919-host-trade-category-catalog.js';
import requiredManifest from '../../src/manifest-required.json';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const catalogSlugs = new Set(
    requiredManifest.hostTradeCategories.map(
        (file) =>
            (
                JSON.parse(
                    readFileSync(join(__dirname, '../../src/data/hostTradeCategory', file), 'utf-8')
                ) as { slug: string }
            ).slug
    )
);

const CATEGORY_PERMISSIONS = [
    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
    PermissionEnum.HOST_TRADE_CATEGORY_CREATE,
    PermissionEnum.HOST_TRADE_CATEGORY_UPDATE,
    PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
    PermissionEnum.HOST_TRADE_CATEGORY_RESTORE
];

describe('0180 meta', () => {
    it('is a required, non-destructive migration', () => {
        expect(migration.meta.name).toBe('0180-hos919-host-trade-category-catalog');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
    });

    it('declares exactly the two legacy columns it reads (HOS-433)', () => {
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'host_trades', column: 'category' },
            { table: 'alliance_leads', column: 'category' }
        ]);
    });
});

describe('0180 legacy category map (spec 5.5)', () => {
    it('covers every value of the legacy enum, and nothing else', () => {
        expect(Object.keys(migration.LEGACY_CATEGORY_TO_SLUGS).sort()).toEqual(
            Object.values(HostTradeCategoryEnum).sort()
        );
    });

    it('only targets slugs that exist in the catalog baseline', () => {
        for (const [legacy, slugs] of Object.entries(migration.LEGACY_CATEGORY_TO_SLUGS)) {
            for (const slug of slugs) {
                expect(catalogSlugs.has(slug), `${legacy} -> ${slug}`).toBe(true);
            }
        }
    });

    it('maps the documented non-1:1 cases', () => {
        const map = migration.LEGACY_CATEGORY_TO_SLUGS;
        expect(map.GAS).toEqual(['gas-instalacion']);
        expect(map.LIMPIEZA).toEqual(['limpieza-domicilio']);
        expect(map.PLAGAS).toEqual(['control-plagas']);
        expect(map.INTERNET).toEqual(['internet-tv']);
        expect(map.PILETA_JARDIN).toEqual(['piletas', 'parque-jardineria']);
    });
});

describe('0180 permission grants', () => {
    it('grants the five category permissions to SUPER_ADMIN and ADMIN only', () => {
        expect(migration.GRANTS).toHaveLength(10);
        for (const role of [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]) {
            const granted = migration.GRANTS.filter((g) => g.role === role).map(
                (g) => g.permission
            );
            expect(granted.sort()).toEqual([...CATEGORY_PERMISSIONS].sort());
        }
        expect(new Set(migration.GRANTS.map((g) => g.role))).toEqual(
            new Set([RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN])
        );
    });

    it('matches the seed baseline in both directions (no drift)', () => {
        for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
            const inBaseline = (permissions ?? []).filter((p) => CATEGORY_PERMISSIONS.includes(p));
            const inMigration = migration.GRANTS.filter((g) => g.role === role).map(
                (g) => g.permission
            );
            expect(inBaseline.sort(), `role ${role}`).toEqual(inMigration.sort());
        }
    });
});
