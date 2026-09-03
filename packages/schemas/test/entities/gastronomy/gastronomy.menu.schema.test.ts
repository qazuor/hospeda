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
