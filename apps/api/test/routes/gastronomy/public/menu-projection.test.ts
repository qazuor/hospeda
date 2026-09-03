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
import type { GastronomyMenuItemPublic, GastronomyMenuSectionPublic } from '@repo/schemas';
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

const PHOTO_URL = 'https://res.cloudinary.com/x/empanada.jpg';

/** One dish CARRYING a photo — the only fixture the HOS-1045 gate can be seen with. */
const ITEM_WITH_PHOTO: GastronomyMenuItemPublic = {
    id: '33333333-3333-4333-8333-333333333333',
    sectionId: SECTION.id,
    gastronomyId: SECTION.gastronomyId,
    name: 'Empanada de carne',
    description: null,
    priceCents: 250_000,
    isAvailable: true,
    photoUrl: PHOTO_URL,
    photoAlt: 'Empanada recién horneada',
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date()
};

/**
 * The section as it comes OUT of the database: the public type omits
 * `photoPublicId`, the ROW carries it, and this gate is what removes it. Typed
 * through the intersection rather than by widening the fixture to `any`, so the
 * cast asserts exactly the one extra column and nothing else.
 */
const SECTION_WITH_PHOTO = {
    ...SECTION,
    items: [{ ...ITEM_WITH_PHOTO, photoPublicId: 'hospeda/dev/empanada' }]
} as unknown as GastronomyMenuSectionPublic;

describe('applyGastronomyMenuManagementGate', () => {
    it('withholds the file and the structured carta when the owner is not entitled', () => {
        const result = applyGastronomyMenuManagementGate({
            gastronomy: {
                menuFileUrl: 'https://res.cloudinary.com/x/menu.jpg',
                menuFileKind: 'image'
            },
            menuSections: [SECTION],
            ownerGrantsMenuManagement: false,
            ownerGrantsMenuItemPhotos: true
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
            ownerGrantsMenuManagement: true,
            ownerGrantsMenuItemPhotos: true
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
            ownerGrantsMenuManagement: true,
            ownerGrantsMenuItemPhotos: true
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
            ownerGrantsMenuManagement: true,
            ownerGrantsMenuItemPhotos: true
        });

        expect(result.menuSections).toBeUndefined();
    });

    // ── HOS-1045: the per-dish photo, a NARROWER gate over the same payload ──

    it('publishes the dish photo when the owner is entitled to photos', () => {
        const result = applyGastronomyMenuManagementGate({
            gastronomy: { menuFileUrl: null, menuFileKind: null },
            menuSections: [SECTION_WITH_PHOTO],
            ownerGrantsMenuManagement: true,
            ownerGrantsMenuItemPhotos: true
        });

        const item = result.menuSections?.[0]?.items[0];
        expect(item?.photoUrl).toBe(PHOTO_URL);
        expect(item?.photoAlt).toBe('Empanada recién horneada');
        // The dish's OTHER fields must survive the projection untouched — a
        // mutation that rebuilt the item from a subset of its keys would pass
        // the two assertions above and silently drop the price.
        expect(item?.name).toBe('Empanada de carne');
        expect(item?.priceCents).toBe(250_000);
    });

    it('withholds the dish photo from a carta-entitled owner who is NOT photo-entitled', () => {
        // The `-pro` case, and the reason the two grants are separate
        // parameters: the carta is published, each dish without its picture.
        // `ownerGrantsMenuManagement` stays TRUE here, so a mutation that made
        // the photo follow the carta's grant fails this case and only this one.
        const result = applyGastronomyMenuManagementGate({
            gastronomy: { menuFileUrl: null, menuFileKind: null },
            menuSections: [SECTION_WITH_PHOTO],
            ownerGrantsMenuManagement: true,
            ownerGrantsMenuItemPhotos: false
        });

        const item = result.menuSections?.[0]?.items[0];
        expect(result.menuSections).toHaveLength(1);
        expect(item?.name).toBe('Empanada de carne');
        expect(item?.photoUrl).toBeNull();
        expect(item?.photoAlt).toBeNull();
    });

    it('never publishes photoPublicId, entitled or not', () => {
        // `GastronomyMenuItemPublicSchema` omits it; this asserts the omission
        // is TRUE AT RUNTIME, which the type alone cannot say — the sections
        // reaching this gate are raw rows and do carry the column.
        //
        // Asserted with `toHaveProperty`, not `toBeUndefined`: reading a key
        // that was never copied and reading one copied as `undefined` both give
        // `undefined`, and only the first is what the omission promises.
        for (const grantsPhotos of [true, false]) {
            const result = applyGastronomyMenuManagementGate({
                gastronomy: { menuFileUrl: null, menuFileKind: null },
                menuSections: [SECTION_WITH_PHOTO],
                ownerGrantsMenuManagement: true,
                ownerGrantsMenuItemPhotos: grantsPhotos
            });

            const item = result.menuSections?.[0]?.items[0];
            expect(item).toBeDefined();
            expect(item).not.toHaveProperty('photoPublicId');
        }
    });
});
