/**
 * @file account-layout-owner-nav.test.ts
 * @description Source-level + engine-integration tests for the AccountLayout
 * sidebar navigation (HOS-131 T-007 refactor of SPEC-206 PR2's owner
 * conversations nav coverage).
 *
 * `AccountLayout.astro` no longer hardcodes per-item labels/sections — it
 * renders `getNavForSurface({ surface: 'sidebar' })` gated server-side by
 * `isVisibleByRole` (HOS-131 D-4). Behavior coverage below (which
 * groups/items a given role sees) exercises those same engine functions the
 * layout calls, instead of string-matching literal labels that no longer
 * live in the Astro source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import { getNavForSurface, type NavGroup } from '../../src/config/navigation';
import { isVisibleByRole } from '../../src/lib/nav-gating';

const source = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

/** Computes the sidebar nav groups exactly as `AccountLayout.astro` does for a given role. */
function sidebarGroupsForRole(role: string | null): readonly NavGroup[] {
    return getNavForSurface({
        surface: 'sidebar',
        visibility: (node) => isVisibleByRole(node, role)
    }).groups;
}

describe('AccountLayout — sidebar wiring (HOS-131 T-007)', () => {
    it('renders navigation from the single-source config via getNavForSurface', () => {
        expect(source).toContain("import { getNavForSurface } from '@/config/navigation';");
        expect(source).toContain("surface: 'sidebar'");
    });

    it('gates server-side via isVisibleByRole (HOS-131 D-4), not the scattered role helpers', () => {
        expect(source).toContain(
            "import { isDoorVisible, isVisibleByRole, resolveDoorLabelKey } from '@/lib/nav-gating';"
        );
        expect(source).not.toContain('isHostRole');
        expect(source).not.toContain('isCommerceOwnerRole');
    });

    it('wires data-tour from the config item, not a local getTourTarget mapping', () => {
        expect(source).toContain('item.tourTarget');
        expect(source).not.toContain('function getTourTarget');
    });
});

describe('AccountLayout — sidebar role gating (HOS-131 AC-1/AC-2)', () => {
    it('a HOST role sees the anfitrion group', () => {
        const groups = sidebarGroupsForRole(RoleEnum.HOST);
        expect(groups.map((group) => group.id)).toContain('anfitrion');
    });

    it('a plain tourist (USER) role does NOT see the anfitrion group', () => {
        const groups = sidebarGroupsForRole(RoleEnum.USER);
        expect(groups.map((group) => group.id)).not.toContain('anfitrion');
    });

    it('"Mis alojamientos" (properties) renders under the anfitrion group for a HOST role (AC-2)', () => {
        const groups = sidebarGroupsForRole(RoleEnum.HOST);
        const anfitrion = groups.find((group) => group.id === 'anfitrion');
        expect(anfitrion?.items.some((item) => item.id === 'properties')).toBe(true);
    });

    it('the owner conversations entry (ownerMessages) is present under anfitrion for a HOST role', () => {
        const groups = sidebarGroupsForRole(RoleEnum.HOST);
        const anfitrion = groups.find((group) => group.id === 'anfitrion');
        expect(anfitrion?.items.some((item) => item.id === 'ownerMessages')).toBe(true);
    });

    it('uses i18n keys for every rendered label (no hardcoded strings, AC-8)', () => {
        const groups = sidebarGroupsForRole(RoleEnum.HOST);
        for (const group of groups) {
            expect(group.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
            for (const item of group.items) {
                expect(item.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
            }
        }
    });
});
