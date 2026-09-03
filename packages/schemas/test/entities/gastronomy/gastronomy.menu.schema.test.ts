/**
 * The carta payload schema (HOS-895).
 *
 * These assert the four decisions that are easy to "simplify" away later, and
 * each one has a consequence a reader can check:
 *
 *  1. An EMPTY `sections` array parses. It is the owner who fell back to a photo
 *     saying "take the typed carta down"; rejecting it leaves them no way to.
 *  2. A `null` price parses and stays `null`. A menu that says "según pesca" is
 *     ordinary, and a default of `0` would publish the dish as free.
 *  3. `0` is a REAL price and survives as `0` — the case a `|| null` in the
 *     write path would silently turn into "a consultar".
 *  4. A section with no items parses. An owner builds the carta over several
 *     sittings, typing the headings first.
 *
 * @module test/entities/gastronomy/gastronomy.menu.schema
 */
import { describe, expect, it } from 'vitest';
import {
    GastronomyAdminCreateInputSchema,
    GastronomyOwnerCreateInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyUpdateInputSchema
} from '../../../src/entities/gastronomy/gastronomy.crud.schema.js';
import {
    GASTRONOMY_MENU_MAX_ITEMS_PER_SECTION,
    GASTRONOMY_MENU_MAX_SECTIONS,
    GastronomyMenuFileSchema,
    GastronomyMenuReplacePayloadSchema
} from '../../../src/entities/gastronomy/subtypes/gastronomy.menu.schema.js';

describe('GastronomyMenuReplacePayloadSchema (HOS-895)', () => {
    it('accepts an empty carta — that is how an owner deletes it', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({ sections: [] });

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.sections).toEqual([]);
    });

    it('accepts a section with no dishes — a carta is built over several sittings', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [{ name: 'Entradas' }]
        });

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.sections[0]?.items).toEqual([]);
    });

    it('keeps a null price as null rather than defaulting it to zero', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [
                {
                    name: 'Pescados',
                    items: [{ name: 'Pesca del día', priceCents: null }]
                }
            ]
        });

        expect(parsed.success).toBe(true);
        // Not `0`, and not absent: `null` is the value that means "a consultar",
        // and a zero here would publish the dish as free.
        expect(parsed.success && parsed.data.sections[0]?.items[0]?.priceCents).toBeNull();
    });

    it('keeps a zero price as zero — it is a real price, not "a consultar"', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [
                {
                    name: 'Menú degustación',
                    items: [{ name: 'Cortesía de la casa', priceCents: 0 }]
                }
            ]
        });

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.sections[0]?.items[0]?.priceCents).toBe(0);
    });

    it('defaults a dish to available', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [{ name: 'Postres', items: [{ name: 'Flan' }] }]
        });

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.sections[0]?.items[0]?.isAvailable).toBe(true);
    });

    it('rejects a dish with no name', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [{ name: 'Entradas', items: [{ name: '   ' }] }]
        });

        expect(parsed.success).toBe(false);
    });

    it('rejects a fractional price — the column stores integer centavos', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [{ name: 'Entradas', items: [{ name: 'Empanada', priceCents: 250.5 }] }]
        });

        expect(parsed.success).toBe(false);
    });

    it('refuses more sections than one transaction should write', () => {
        const tooMany = Array.from({ length: GASTRONOMY_MENU_MAX_SECTIONS + 1 }, (_, i) => ({
            name: `Sección ${i}`
        }));

        expect(GastronomyMenuReplacePayloadSchema.safeParse({ sections: tooMany }).success).toBe(
            false
        );
    });

    it('refuses more dishes in one section than the ceiling allows', () => {
        const items = Array.from({ length: GASTRONOMY_MENU_MAX_ITEMS_PER_SECTION + 1 }, (_, i) => ({
            name: `Plato ${i}`
        }));

        expect(
            GastronomyMenuReplacePayloadSchema.safeParse({
                sections: [{ name: 'Principales', items }]
            }).success
        ).toBe(false);
    });
});

describe('GastronomyMenuFileSchema (HOS-895)', () => {
    it('accepts an image and a pdf', () => {
        expect(
            GastronomyMenuFileSchema.safeParse({
                url: 'https://cdn.example.com/menu.jpg',
                kind: 'image'
            }).success
        ).toBe(true);
        expect(
            GastronomyMenuFileSchema.safeParse({
                url: 'https://cdn.example.com/menu.pdf',
                kind: 'pdf'
            }).success
        ).toBe(true);
    });

    it('refuses a file whose kind is unknown — the page could not decide how to render it', () => {
        expect(
            GastronomyMenuFileSchema.safeParse({
                url: 'https://cdn.example.com/menu.docx',
                kind: 'doc'
            }).success
        ).toBe(false);
    });

    it('refuses a url with no kind — half an attachment is unrepresentable by design', () => {
        expect(
            GastronomyMenuFileSchema.safeParse({ url: 'https://cdn.example.com/menu.jpg' }).success
        ).toBe(false);
    });
});

describe('the menu-file columns are not writable from a listing body (HOS-895)', () => {
    /*
     * REGRESSION ANCHOR. `menuFileUrl`, `menuFilePublicId` and `menuFileKind`
     * are written by `POST`/`DELETE /gastronomies/{id}/menu-file` and by nothing
     * else — but adding them to `GastronomySchema` made three of the four write
     * schemas accept them silently, because those three are built with
     * `.omit(...)` and therefore take every field they are not told to drop.
     * Measured before the fix: all three kept `javascript:alert(1)` verbatim.
     *
     * Two distinct consequences, which is why both columns are asserted:
     *
     *  - `menuFileUrl` reaches an `href`, and `z.string().url()` does NOT
     *    restrict the scheme — a stored-XSS sink on a public listing page
     *    (HOS-592 / F-02).
     *  - `menuFilePublicId` is the handle `DELETE /menu-file` passes to the
     *    media provider, so a body that sets it to another listing's Cloudinary
     *    id turns that route into a cross-tenant asset delete.
     *
     * The render-side gate in `CommerceMenuManager` covers the first no matter
     * how the row was written; this covers both at the boundary.
     */
    const HOSTILE = {
        name: 'La Parrilla',
        summary: 'x'.repeat(40),
        description: 'x'.repeat(60),
        type: 'PARRILLA',
        destinationId: '22222222-2222-4222-8222-222222222222',
        ownerId: '11111111-1111-4111-8111-111111111111',
        menuFileUrl: 'javascript:alert(document.cookie)',
        menuFilePublicId: 'hospeda/prod/gastronomies/somebody-elses-listing/menu-file',
        menuFileKind: 'image'
    } as const;

    it.each([
        ['GastronomyUpdateInputSchema (admin update)', GastronomyUpdateInputSchema],
        ['GastronomyAdminCreateInputSchema', GastronomyAdminCreateInputSchema],
        ['GastronomyOwnerCreateInputSchema', GastronomyOwnerCreateInputSchema],
        ['GastronomyOwnerUpdateInputSchema (owner PATCH)', GastronomyOwnerUpdateInputSchema]
    ])('%s drops every menu-file column', (_label, schema) => {
        const parsed = schema.safeParse(HOSTILE);

        // The assertion is on the PARSED OUTPUT, not on `success`. These are
        // strip-mode schemas: an unknown key does not fail the parse, it is
        // simply not carried — so `expect(parsed.success).toBe(false)` would be
        // the vacuous version of this test and would pass with the hole open.
        const data = (parsed.success ? parsed.data : {}) as Record<string, unknown>;

        expect(data.menuFileUrl).toBeUndefined();
        expect(data.menuFilePublicId).toBeUndefined();
        expect(data.menuFileKind).toBeUndefined();
    });
});
