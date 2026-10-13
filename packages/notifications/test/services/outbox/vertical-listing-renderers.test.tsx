import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
    createVerticalListingRenderers,
    type ListingNamesReader
} from '../../../src/services/outbox/vertical-listing-renderers.js';
import { row } from './outbox-batch.harness.js';

const LISTING_ID = '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';
const OTHER_ID = '9a1c5d2e-1b3f-4c7a-8e6d-0f2b4c6d8e10';
const ALERT_ID = 'c4d5e6f7-0a1b-4c2d-8e3f-5a6b7c8d9e0f';
const NAMES: Readonly<Record<string, string>> = {
    [LISTING_ID]: 'Cabañas del Río',
    [OTHER_ID]: 'Parrilla La Costa'
};

function buildRenderers(reader?: ListingNamesReader) {
    const readListingNames: ListingNamesReader =
        reader ??
        vi.fn(async ({ ids }) => {
            const found = new Map<string, string>();
            for (const id of ids) {
                const name = NAMES[id];
                if (name) found.set(id, name);
            }
            return found;
        });
    return {
        readListingNames,
        renderers: createVerticalListingRenderers({
            siteUrl: 'https://hospeda.test/',
            readListingNames
        })
    };
}

async function render(template: string, payload: Record<string, unknown>) {
    const { renderers, readListingNames } = buildRenderers();
    const renderer = renderers[template];
    if (!renderer) throw new Error(`no renderer for ${template}`);
    const result = await renderer({ row: row({ template, payload }) });
    return { subject: result.subject, html: renderToStaticMarkup(result.react), readListingNames };
}

describe('vertical listing notice renderers (HOS-1492, AC:V8a:5 and AC:V8a:6)', () => {
    it('TEST:V8a:6 row 27: the closed price alert says the listing no longer exists, never why', async () => {
        const { subject, html, readListingNames } = await render('verticals.price-alert-closed', {
            vertical: 'accommodation',
            listingId: LISTING_ID,
            alertId: ALERT_ID
        });

        expect(subject).toBe('Tu alerta de precio se cerró');
        expect(html).toContain('Cabañas del Río');
        expect(html).toContain('se cerró porque esa ficha ya no existe');
        expect(html).not.toContain('inactividad');
        expect(html).not.toContain('borró');
        expect(html).not.toContain(ALERT_ID);
        expect(readListingNames).toHaveBeenCalledWith({
            vertical: 'accommodation',
            ids: [LISTING_ID]
        });
    });

    it('TEST:V8a:7 row 31: the purge confirmation says it was deleted, what, and that it does not come back', async () => {
        const { subject, html } = await render('verticals.listing-purged', {
            vertical: 'gastronomy',
            listingId: OTHER_ID,
            bySupport: false
        });

        expect(subject).toBe('Se borró tu ficha');
        expect(html).toContain('Se borró tu ficha Parrilla La Costa.');
        expect(html).toContain('los textos, las fotos, las preguntas frecuentes y los horarios');
        expect(html).toContain('La ficha no vuelve');
        expect(html).not.toContain('a pedido tuyo');
    });

    it('TEST:V8a:7 row 31: deleted by support, it adds the at-your-request line and uses the carried name', async () => {
        const reader = vi.fn<ListingNamesReader>(async () => new Map());
        const { renderers } = buildRenderers(reader);

        const result = await renderers['verticals.listing-purged']!({
            row: row({
                template: 'verticals.listing-purged',
                payload: {
                    vertical: 'experience',
                    listingId: LISTING_ID,
                    listingName: 'Kayak al atardecer',
                    bySupport: true
                }
            })
        });
        const html = renderToStaticMarkup(result.react);

        expect(html).toContain('Kayak al atardecer');
        expect(html).toContain('Soporte la borró a pedido tuyo.');
        expect(reader).not.toHaveBeenCalled();
    });

    it('TEST:V8a:7 row 24: the moderated notice says the reason, hidden until lifted, what is allowed, and the recurring add-ons', async () => {
        const { subject, html } = await render('verticals.listing-moderated', {
            vertical: 'accommodation',
            listingId: LISTING_ID,
            reason: 'Fotos que no son del lugar',
            fixRequestOpen: false
        });

        expect(subject).toBe('Tu ficha está moderada');
        expect(html).toContain('Cabañas del Río');
        expect(html).toContain('Motivo: Fotos que no son del lugar');
        expect(html).toContain('hasta que un administrador levante la moderación');
        expect(html).toContain('podés verla, exportarla, editarla');
        expect(html).toContain('y borrarla');
        expect(html).toContain('no podés es publicarla');
        expect(html).toContain('destaques recurrentes sobre esta ficha, se siguen cobrando');
        expect(html).toContain('https://hospeda.test/es/mi-cuenta/suscripcion/');
    });

    it('TEST:V8a:7 row 30: the fix request says the reason, the suggested date, that it stays visible, and where to report it', async () => {
        const { subject, html } = await render('verticals.listing-fix-requested', {
            vertical: 'gastronomy',
            listingId: OTHER_ID,
            reason: 'Falta el horario del domingo',
            suggestedDate: '2026-10-20',
            fixRequestOpen: true
        });

        expect(subject).toBe('Te pedimos un arreglo en tu ficha');
        expect(html).toContain('Parrilla La Costa');
        expect(html).toContain('Motivo: Falta el horario del domingo');
        expect(html).toContain('Fecha sugerida para arreglarlo: 20 de octubre de 2026.');
        expect(html).toContain('Tu ficha sigue a la vista');
        expect(html).toContain('ya lo corregiste');
        expect(html).toContain('href="https://hospeda.test/es/mi-cuenta/comercio/"');
    });

    it('TEST:V8a:7 row 30: without a suggested date the fix request omits that line', async () => {
        const { html } = await render('verticals.listing-fix-requested', {
            vertical: 'accommodation',
            listingId: LISTING_ID,
            reason: 'Falta el horario',
            fixRequestOpen: true
        });

        expect(html).not.toContain('Fecha sugerida');
        expect(html).toContain('href="https://hospeda.test/es/mi-cuenta/propiedades/"');
    });

    it('TEST:V8a:7 row 30: a level change down to a moderation says what row 24 says and that the request stays open', async () => {
        const { subject, html } = await render('verticals.listing-moderation-level-changed', {
            vertical: 'accommodation',
            listingId: LISTING_ID,
            reason: 'No se corrigió a tiempo',
            fixRequestOpen: true
        });

        expect(subject).toBe('Cambió la moderación de tu ficha');
        expect(html).toContain('Motivo: No se corrigió a tiempo');
        expect(html).toContain('hasta que un administrador levante la moderación');
        expect(html).toContain('no podés es publicarla');
        expect(html).toContain('El pedido de arreglo sigue abierto');
    });

    it('TEST:V8a:7 row 30: a level change back to a fix request says where the listing went back to', async () => {
        const { html } = await render('verticals.listing-moderation-level-changed', {
            vertical: 'accommodation',
            listingId: LISTING_ID,
            reason: 'Ya está mejor',
            returnedTo: 'PUBLISHED',
            fixRequestOpen: true
        });

        expect(html).toContain('volvió a quedar sólo con un pedido de arreglo');
        expect(html).toContain('Volvió a estar publicada');
        expect(html).not.toContain('levante la moderación');
        expect(html).toContain('El pedido de arreglo sigue abierto');
    });

    it('TEST:V8a:7 row 30: lifted back to draft, it says publishing is the owner call', async () => {
        const { subject, html } = await render('verticals.listing-moderation-lifted', {
            vertical: 'experience',
            listingId: LISTING_ID,
            reason: 'Resuelto',
            returnedTo: 'DRAFT',
            fixRequestOpen: false
        });

        expect(subject).toBe('Se levantó la moderación de tu ficha');
        expect(html).toContain('Cabañas del Río');
        expect(html).toContain('Volvió a borrador. Publicarla es decisión tuya');
    });

    it('TEST:V8a:7 row 30: lifted back to published, it says it is visible again', async () => {
        const { html } = await render('verticals.listing-moderation-lifted', {
            vertical: 'accommodation',
            listingId: LISTING_ID,
            reason: 'Resuelto',
            returnedTo: 'PUBLISHED',
            fixRequestOpen: false
        });

        expect(html).toContain('Volvió a estar publicada');
        expect(html).not.toContain('Publicarla es decisión tuya');
    });

    it('TEST:V8a:7 row 19: the restitution says which came back, which did not, the criterion, and nothing is deleted', async () => {
        const { subject, html, readListingNames } = await render('verticals.listing-restitution', {
            vertical: 'accommodation',
            restoredListingIds: [LISTING_ID],
            notRestoredListingIds: [OTHER_ID],
            criterion: 'LAST_FELL_FIRST_BACK'
        });

        expect(subject).toBe('Tus fichas volvieron a publicarse');
        expect(html).toContain('Volvieron estas fichas: Cabañas del Río.');
        expect(html).toContain('Estas fichas no entraron: Parrilla La Costa.');
        expect(html).toContain('Vuelve primero la ficha que cayó al final, hasta llenar el cupo.');
        expect(html).toContain(
            'Las fichas del sistema anterior que nunca se publicaron acá van primero'
        );
        expect(html).toContain('siguen ahí: no se borra ninguna');
        expect(readListingNames).toHaveBeenCalledTimes(2);
    });

    it.each([
        ['verticals.price-alert-closed', { vertical: 'accommodation', alertId: ALERT_ID }],
        ['verticals.price-alert-closed', { vertical: 'accommodation', listingId: LISTING_ID }],
        ['verticals.listing-purged', { vertical: 'accommodation', bySupport: false }],
        ['verticals.listing-purged', { vertical: 'accommodation', listingId: LISTING_ID }],
        [
            'verticals.listing-purged',
            { vertical: 'partner', listingId: LISTING_ID, bySupport: false }
        ],
        [
            'verticals.listing-moderated',
            { vertical: 'accommodation', reason: 'x', fixRequestOpen: false }
        ],
        ['verticals.listing-moderated', { vertical: 'accommodation', listingId: LISTING_ID }],
        [
            'verticals.listing-fix-requested',
            {
                vertical: 'accommodation',
                listingId: LISTING_ID,
                reason: 'x',
                suggestedDate: '20/10'
            }
        ],
        [
            'verticals.listing-moderation-level-changed',
            { vertical: 'accommodation', listingId: LISTING_ID, reason: 'x' }
        ],
        [
            'verticals.listing-moderation-level-changed',
            {
                vertical: 'accommodation',
                listingId: LISTING_ID,
                reason: 'x',
                returnedTo: 'MODERATED',
                fixRequestOpen: true
            }
        ],
        [
            'verticals.listing-moderation-lifted',
            { vertical: 'accommodation', listingId: LISTING_ID, reason: 'x', fixRequestOpen: false }
        ],
        [
            'verticals.listing-restitution',
            {
                vertical: 'accommodation',
                restoredListingIds: [LISTING_ID],
                criterion: 'LAST_FELL_FIRST_BACK'
            }
        ],
        [
            'verticals.listing-restitution',
            {
                vertical: 'accommodation',
                restoredListingIds: [LISTING_ID],
                notRestoredListingIds: []
            }
        ]
    ])('rejects an incomplete payload for %s (%#)', async (template, payload) => {
        const { renderers } = buildRenderers();

        await expect(
            Promise.resolve().then(() => renderers[template]!({ row: row({ template, payload }) }))
        ).rejects.toThrow(TypeError);
    });

    it.each([
        [
            'verticals.price-alert-closed',
            { vertical: 'accommodation', listingId: 'missing', alertId: ALERT_ID }
        ],
        [
            'verticals.listing-purged',
            { vertical: 'accommodation', listingId: 'missing', bySupport: false }
        ],
        [
            'verticals.listing-restitution',
            {
                vertical: 'accommodation',
                restoredListingIds: [LISTING_ID, 'missing'],
                notRestoredListingIds: [],
                criterion: 'LAST_FELL_FIRST_BACK'
            }
        ]
    ])('throws when a listing has no name for %s', async (template, payload) => {
        const { renderers } = buildRenderers();

        await expect(
            Promise.resolve().then(() => renderers[template]!({ row: row({ template, payload }) }))
        ).rejects.toThrow('no tiene nombre');
    });
});
