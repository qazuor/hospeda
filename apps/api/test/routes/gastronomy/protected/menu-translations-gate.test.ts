/**
 * Unit tests for the write-side carta translations gate (HOS-1043).
 *
 * `menuPayloadCarriesTranslations` is what decides whether `PUT .../menu` needs
 * `MULTILINGUAL_GASTRONOMY_MENU` on top of the `MANAGE_GASTRONOMY_MENU` the
 * route already requires. Tested directly rather than through the route, for
 * the same reason `menuPayloadCarriesItemPhoto`'s own test file gives: the
 * point of the function is the shape of the BODY.
 *
 * Every case is mutation-sensitive against the two failures that matter: a
 * gate that always says `true` refuses every `-pro` carta (the negative cases
 * catch it), and one that always says `false` hands the premium capability to
 * every tier (the positive cases catch it).
 *
 * AAA pattern throughout.
 */
import { describe, expect, it } from 'vitest';
import { menuPayloadCarriesTranslations } from '../../../../src/routes/gastronomy/protected/menu-translations-gate';

const NAME_I18N = { es: 'Empanada de carne', en: 'Beef empanada', pt: 'Empanada de carne' };

/** A carta document with the given items in its single section. */
function documentWithItems(items: readonly unknown[]): unknown {
    return { sections: [{ name: 'Entradas', description: null, items }] };
}

describe('menuPayloadCarriesTranslations', () => {
    it('finds a translated name on the only dish', () => {
        expect(
            menuPayloadCarriesTranslations(
                documentWithItems([{ name: 'Empanada', nameI18n: NAME_I18N }])
            )
        ).toBe(true);
    });

    it('finds a translated description on the LAST dish of the LAST section', () => {
        // The realistic near-miss: an owner translates only the dessert they
        // are proud of. A gate that inspected only the first item, or only the
        // first section, would let it through and the translation would be
        // published on a `-pro` plan.
        const body = {
            sections: [
                { name: 'Entradas', items: [{ name: 'Empanada' }] },
                {
                    name: 'Postres',
                    items: [
                        { name: 'Flan' },
                        {
                            name: 'Tiramisú',
                            descriptionI18n: { es: 'Con café', en: 'With coffee', pt: 'Com café' }
                        }
                    ]
                }
            ]
        };

        expect(menuPayloadCarriesTranslations(body)).toBe(true);
    });

    it('finds a translated section heading with no translated dishes', () => {
        const body = {
            sections: [
                {
                    name: 'Entradas',
                    nameI18n: { es: 'Entradas', en: 'Starters', pt: 'Entradas' },
                    items: [{ name: 'Empanada' }]
                }
            ]
        };

        expect(menuPayloadCarriesTranslations(body)).toBe(true);
    });

    it('does NOT fire on a carta with no translations at all', () => {
        const body = {
            sections: [
                { name: 'Entradas', items: [{ name: 'Empanada', nameI18n: null }] },
                { name: 'Principales', items: [{ name: 'Milanesa' }] }
            ]
        };

        expect(menuPayloadCarriesTranslations(body)).toBe(false);
    });

    it('does NOT fire when nameI18n/descriptionI18n are explicitly null', () => {
        // `null` is what the editor sends for "cleared". Refusing that save
        // would mean an owner who REMOVED their translations still could not
        // save the carta without them.
        expect(
            menuPayloadCarriesTranslations(
                documentWithItems([{ nameI18n: null, descriptionI18n: null }])
            )
        ).toBe(false);
    });

    it('does NOT fire on the empty document that DELETES the carta', () => {
        expect(menuPayloadCarriesTranslations({ sections: [] })).toBe(false);
    });

    it('answers false rather than throwing on a malformed body', () => {
        // A gate that threw on a shape it did not expect would be a gate a
        // caller could switch off by sending that shape. Every one of these
        // reaches the route factory's own validation instead, which refuses
        // them as a 400.
        for (const body of [
            null,
            undefined,
            'sections',
            42,
            {},
            { sections: 'nope' },
            { sections: [null] },
            { sections: [{ items: 'nope' }] },
            { sections: [{ items: [null, 7, 'x'] }] },
            { sections: [{ items: [{ nameI18n: 'not-an-object' }] }] }
        ]) {
            expect(menuPayloadCarriesTranslations(body)).toBe(false);
        }
    });
});
