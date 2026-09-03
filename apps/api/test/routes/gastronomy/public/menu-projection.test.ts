/**
 * Unit tests for the public gastronomy menu-management gate (HOS-895 PR2).
 *
 * `applyGastronomyMenuManagementGate` is the ONE place that decides whether
 * `menuFileUrl` / `menuFileKind` / `menuSections` leave the API for an
 * unentitled owner's listing. Tested directly, rather than through the full
 * `getBySlug` route + `GastronomyPublicSchema` validation, because building a
 * schema-valid fixture for the whole listing would exercise Zod, not this
 * withholding rule.
 *
 * AAA pattern throughout. Each assertion is mutation-sensitive: withheld
 * fields are compared against a NON-empty source so a mutation that always
 * returns "withheld" (or always "granted") fails at least one case.
 */
import type { GastronomyMenuSectionPublic } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { applyGastronomyMenuManagementGate } from '../../../../src/routes/gastronomy/public/menu-projection';

const SECTION: GastronomyMenuSectionPublic = {
    id: '11111111-1111-4111-8111-111111111111',
    gastronomyId: '22222222-2222-4222-8222-222222222222',
    name: 'Entradas',
    description: null,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: []
};

describe('applyGastronomyMenuManagementGate', () => {
    it('withholds the file and the structured carta when the owner is not entitled', () => {
        const result = applyGastronomyMenuManagementGate({
            gastronomy: {
                menuFileUrl: 'https://res.cloudinary.com/x/menu.jpg',
                menuFileKind: 'image'
            },
            menuSections: [SECTION],
            ownerGrantsMenuManagement: false
        });

        expect(result.menuFileUrl).toBeNull();
        expect(result.menuFileKind).toBeNull();
        expect(result.menuSections).toBeUndefined();
    });

    it('passes the file and the structured carta through when the owner is entitled', () => {
        const result = applyGastronomyMenuManagementGate({
            gastronomy: {
                menuFileUrl: 'https://res.cloudinary.com/x/menu.pdf',
                menuFileKind: 'pdf'
            },
            menuSections: [SECTION],
            ownerGrantsMenuManagement: true
        });

        expect(result.menuFileUrl).toBe('https://res.cloudinary.com/x/menu.pdf');
        expect(result.menuFileKind).toBe('pdf');
        expect(result.menuSections).toEqual([SECTION]);
    });

    it('reports an entitled owner with no file as null, not withheld', () => {
        // Distinguishes "nothing uploaded" from "withheld" — both look like
        // `null` on the wire, but only one should ever be produced by a TRUE
        // grant. This case pins that an entitled owner with nothing set gets
        // the honest `null`, not an accidental non-null leftover.
        const result = applyGastronomyMenuManagementGate({
            gastronomy: { menuFileUrl: null, menuFileKind: null },
            menuSections: [],
            ownerGrantsMenuManagement: true
        });

        expect(result.menuFileUrl).toBeNull();
        expect(result.menuFileKind).toBeNull();
        expect(result.menuSections).toBeUndefined();
    });

    it('reports menuSections as undefined, never an empty array, when there is nothing to show', () => {
        // GastronomyPublicSchema's `.optional()` convention: absent means "not
        // loaded / nothing to show", distinct from an empty array meaning
        // "loaded, and there are none" — the same convention amenities/features
        // already use on this schema.
        const result = applyGastronomyMenuManagementGate({
            gastronomy: { menuFileUrl: undefined, menuFileKind: undefined },
            menuSections: [],
            ownerGrantsMenuManagement: true
        });

        expect(result.menuSections).toBeUndefined();
    });
});
