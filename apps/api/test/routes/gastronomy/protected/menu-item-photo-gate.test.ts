/**
 * Unit tests for the write-side per-dish photo gate (HOS-1045).
 *
 * `menuPayloadCarriesItemPhoto` is what decides whether `PUT .../menu` needs
 * `MENU_ITEM_PHOTOS` on top of the `MANAGE_GASTRONOMY_MENU` the route already
 * requires. Tested directly rather than through the route, because the point of
 * the function is the shape of the BODY and a route test would spend its effort
 * on a Hono context and a subscription fixture instead.
 *
 * Every case is mutation-sensitive against the two failures that matter: a gate
 * that always says `true` refuses every `-pro` carta (the negative cases catch
 * it), and one that always says `false` hands the premium capability to every
 * tier (the positive cases catch it).
 *
 * AAA pattern throughout.
 */
import { describe, expect, it } from 'vitest';
import { menuPayloadCarriesItemPhoto } from '../../../../src/routes/gastronomy/protected/menu-item-photo-gate';

const PHOTO_URL = 'https://res.cloudinary.com/x/empanada.jpg';

/** A carta document with the given items in its single section. */
function documentWithItems(items: readonly unknown[]): unknown {
    return { sections: [{ name: 'Entradas', description: null, items }] };
}

describe('menuPayloadCarriesItemPhoto', () => {
    it('finds a photo on the only dish', () => {
        expect(
            menuPayloadCarriesItemPhoto(
                documentWithItems([{ name: 'Empanada', photoUrl: PHOTO_URL }])
            )
        ).toBe(true);
    });

    it('finds a photo on the LAST dish of the LAST section', () => {
        // The realistic near-miss: an owner adds one picture to the dessert
        // they are proud of and nothing else. A gate that inspected only the
        // first item, or only the first section, would let it through and the
        // photo would be published on a `-pro` plan.
        const body = {
            sections: [
                { name: 'Entradas', items: [{ name: 'Empanada' }] },
                {
                    name: 'Postres',
                    items: [{ name: 'Flan' }, { name: 'Tiramisú', photoUrl: PHOTO_URL }]
                }
            ]
        };

        expect(menuPayloadCarriesItemPhoto(body)).toBe(true);
    });

    it('does NOT fire on a carta with no photos at all', () => {
        const body = {
            sections: [
                { name: 'Entradas', items: [{ name: 'Empanada', photoUrl: null }] },
                { name: 'Principales', items: [{ name: 'Milanesa' }] }
            ]
        };

        expect(menuPayloadCarriesItemPhoto(body)).toBe(false);
    });

    it('does NOT fire on an empty string or on whitespace', () => {
        // `''` is what the editor sends for "cleared", and the service stores
        // it as NULL. Refusing that save would mean an owner who REMOVED their
        // photos still could not save the carta without them — the exact
        // trapdoor the upsell must leave open.
        expect(menuPayloadCarriesItemPhoto(documentWithItems([{ photoUrl: '' }]))).toBe(false);
        expect(menuPayloadCarriesItemPhoto(documentWithItems([{ photoUrl: '   ' }]))).toBe(false);
    });

    it('does NOT fire on alt text or a public id without a URL', () => {
        // Metadata about a photo is not a photo. A stray alt left behind by a
        // client that cleared the URL and nothing else must not make the save
        // unsavable, because the editor offers no way to clear it separately.
        expect(
            menuPayloadCarriesItemPhoto(
                documentWithItems([{ photoAlt: 'Empanada', photoPublicId: 'hospeda/dev/x' }])
            )
        ).toBe(false);
    });

    it('does NOT fire on the empty document that DELETES the carta', () => {
        expect(menuPayloadCarriesItemPhoto({ sections: [] })).toBe(false);
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
            { sections: [{ items: [{ photoUrl: 12 }] }] }
        ]) {
            expect(menuPayloadCarriesItemPhoto(body)).toBe(false);
        }
    });
});
