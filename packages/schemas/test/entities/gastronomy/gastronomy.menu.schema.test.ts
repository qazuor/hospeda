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
    GastronomyMenuItemPublicSchema,
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

describe('the per-dish photo (HOS-1045)', () => {
    /** A carta document carrying exactly one dish, with the given photo fields. */
    const withPhoto = (photo: Record<string, unknown>) => ({
        sections: [{ name: 'Entradas', items: [{ name: 'Empanada', ...photo }] }]
    });

    it('accepts a dish photo and carries all three fields through', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse(
            withPhoto({
                photoUrl: 'https://res.cloudinary.com/hospeda/empanada.jpg',
                photoPublicId: 'hospeda/dev/gastronomies/x/empanada',
                photoAlt: 'Empanada recién horneada'
            })
        );

        expect(parsed.success).toBe(true);
        const item = parsed.success ? parsed.data.sections[0]?.items[0] : undefined;
        expect(item?.photoUrl).toBe('https://res.cloudinary.com/hospeda/empanada.jpg');
        // `photoPublicId` is asserted alongside the URL because it is what a
        // cleanup needs to DESTROY the asset rather than merely forget it. A
        // schema that dropped it would look identical on the public page and
        // leak a billed asset per replaced photo.
        expect(item?.photoPublicId).toBe('hospeda/dev/gastronomies/x/empanada');
        expect(item?.photoAlt).toBe('Empanada recién horneada');
    });

    it('accepts a dish with NO photo — the ordinary case', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse(withPhoto({ photoUrl: null }));

        expect(parsed.success).toBe(true);
    });

    it.each([
        ['javascript:', 'javascript:alert(document.cookie)'],
        ['data:', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
        ['vbscript:', 'vbscript:msgbox(1)']
    ])('REJECTS a %s photo URL', (_label, hostile) => {
        // The reason `photoUrl` uses `mediaAssetUrl` and not `z.string().url()`:
        // the latter accepts all three of these, and this value is written
        // straight into an `<img src>` on a public page. This is the write-side
        // half of the two-sided guard (`resolveSafeExternalUrl` is the read
        // half) — and it is the half that stops the row being written at all.
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse(
            withPhoto({ photoUrl: hostile })
        );

        expect(parsed.success).toBe(false);
    });

    it('rejects alt text past its ceiling', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse(
            withPhoto({
                photoUrl: 'https://res.cloudinary.com/hospeda/empanada.jpg',
                photoAlt: 'a'.repeat(201)
            })
        );

        expect(parsed.success).toBe(false);
    });

    it('keeps photoPublicId OUT of the public projection', () => {
        // `GastronomyMenuItemPublicSchema` omits it deliberately — a derived
        // schema accepts everything it does not name, so this asserts the
        // decision was taken rather than inherited. Checked with `in`, not
        // `toBeUndefined`: a key copied as `undefined` and a key never copied
        // both read as `undefined`, and only the second is the omission.
        const parsed = GastronomyMenuItemPublicSchema.safeParse({
            id: '33333333-3333-4333-8333-333333333333',
            sectionId: '11111111-1111-4111-8111-111111111111',
            gastronomyId: '22222222-2222-4222-8222-222222222222',
            name: 'Empanada',
            description: null,
            priceCents: 250_000,
            isAvailable: true,
            photoUrl: 'https://res.cloudinary.com/hospeda/empanada.jpg',
            photoPublicId: 'hospeda/dev/gastronomies/x/empanada',
            photoAlt: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        expect(parsed.success).toBe(true);
        const data = (parsed.success ? parsed.data : {}) as Record<string, unknown>;
        expect('photoPublicId' in data).toBe(false);
        // The sibling fields DO survive — without this the assertion above
        // would also pass on a schema that dropped the whole photo.
        expect(data.photoUrl).toBe('https://res.cloudinary.com/hospeda/empanada.jpg');
    });
});

describe('GastronomyMenuReplacePayloadSchema — translations (HOS-1043)', () => {
    it('accepts a section and dish carrying a full {es,en,pt} translation', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [
                {
                    name: 'Entradas',
                    nameI18n: { es: 'Entradas', en: 'Starters', pt: 'Entradas' },
                    items: [
                        {
                            name: 'Empanada de carne',
                            nameI18n: {
                                es: 'Empanada de carne',
                                en: 'Beef empanada',
                                pt: 'Empanada de carne'
                            },
                            description: 'Con salsa criolla',
                            descriptionI18n: {
                                es: 'Con salsa criolla',
                                en: 'With criolla sauce',
                                pt: 'Com molho crioulo'
                            }
                        }
                    ]
                }
            ]
        });

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.sections[0]?.nameI18n).toEqual({
            es: 'Entradas',
            en: 'Starters',
            pt: 'Entradas'
        });
    });

    it('accepts a document with no translations at all — the ordinary `-pro` case', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [{ name: 'Entradas', items: [{ name: 'Empanada' }] }]
        });

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.sections[0]?.nameI18n).toBeUndefined();
    });

    it('rejects a translation missing the Portuguese leg — all three locales travel together', () => {
        const parsed = GastronomyMenuReplacePayloadSchema.safeParse({
            sections: [
                {
                    name: 'Entradas',
                    items: [
                        {
                            name: 'Empanada',
                            nameI18n: { es: 'Empanada', en: 'Empanada' }
                        }
                    ]
                }
            ]
        });

        expect(parsed.success).toBe(false);
    });

    it('never publishes photoPublicId alongside a translation, entitled or not', () => {
        // Guards against a mutation that made the translation gate accidentally
        // widen the public projection's own omission.
        const parsed = GastronomyMenuItemPublicSchema.safeParse({
            id: '33333333-3333-4333-8333-333333333333',
            sectionId: '11111111-1111-4111-8111-111111111111',
            gastronomyId: '22222222-2222-4222-8222-222222222222',
            name: 'Empanada',
            description: null,
            nameI18n: { es: 'Empanada', en: 'Empanada', pt: 'Empanada' },
            descriptionI18n: null,
            priceCents: 250_000,
            isAvailable: true,
            photoUrl: null,
            photoPublicId: 'hospeda/dev/gastronomies/x/empanada',
            photoAlt: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        expect(parsed.success).toBe(true);
        const data = (parsed.success ? parsed.data : {}) as Record<string, unknown>;
        expect('photoPublicId' in data).toBe(false);
        expect(data.nameI18n).toEqual({ es: 'Empanada', en: 'Empanada', pt: 'Empanada' });
    });
});
