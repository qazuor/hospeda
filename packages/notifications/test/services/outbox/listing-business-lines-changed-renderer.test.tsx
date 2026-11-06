import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
    createVerticalListingRenderers,
    type ListingNamesReader
} from '../../../src/services/outbox/vertical-listing-renderers.js';
import { LISTING_BUSINESS_LINES_CHANGED_SUBJECT } from '../../../src/templates/verticals/index.js';
import { row } from './outbox-batch.harness.js';

const LISTING_ID = '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';
const TEMPLATE = 'verticals.listing-business-lines-changed';

function buildRenderers(reader?: ListingNamesReader) {
    const readListingNames =
        reader ?? vi.fn(async () => new Map<string, string>([[LISTING_ID, 'Parrilla La Costa']]));
    return {
        readListingNames,
        renderers: createVerticalListingRenderers({
            siteUrl: 'https://hospeda.test/',
            readListingNames
        })
    };
}

const basePayload = {
    vertical: 'venue' as const,
    listingId: LISTING_ID,
    listingName: 'Parrilla La Costa',
    changedAt: '2026-10-20T02:00:00.000Z',
    addedLines: ['Rubro A'],
    removedLines: ['Rubro B'],
    shownSections: ['Sección C'],
    hiddenSections: ['Sección D']
};

async function render(payload: Record<string, unknown>, reader?: ListingNamesReader) {
    const { renderers, readListingNames } = buildRenderers(reader);
    const result = await renderers[TEMPLATE]!({
        row: row({ template: TEMPLATE, payload })
    });
    return { subject: result.subject, html: renderToStaticMarkup(result.react), readListingNames };
}

describe('TEST:7.3:4 the business-lines change notice renders', () => {
    it('renders the subject, the market date and the four label lists', async () => {
        const { subject, html } = await render(basePayload);

        expect(subject).toBe(LISTING_BUSINESS_LINES_CHANGED_SUBJECT);
        expect(html).toContain('Parrilla La Costa');
        expect(html).toContain('19 de octubre de 2026');
        expect(html).toContain('Agregó: Rubro A.');
        expect(html).toContain('Quitó: Rubro B.');
        expect(html).toContain('Ahora se ven en tu ficha: Sección C.');
        expect(html).toContain('Dejan de verse: Sección D.');
    });

    it('reads a missing carried name by vertical and listing id', async () => {
        const reader = vi.fn<ListingNamesReader>(
            async () => new Map([[LISTING_ID, 'Nombre desde lector']])
        );
        const { html, readListingNames } = await render(
            { ...basePayload, listingName: null },
            reader
        );

        expect(html).toContain('Nombre desde lector');
        expect(readListingNames).toHaveBeenCalledWith({ vertical: 'venue', ids: [LISTING_ID] });
    });

    it('omits a line whose list is empty', async () => {
        const { html } = await render({ ...basePayload, addedLines: [], removedLines: [] });

        expect(html).not.toContain('Agregó:');
        expect(html).not.toContain('Quitó:');
        expect(html).toContain('Ahora se ven en tu ficha: Sección C.');
    });

    it('links Mi Cuenta for the vertical and the contact page', async () => {
        const { html } = await render(basePayload);

        expect(html).toContain('https://hospeda.test/es/mi-cuenta/comercio/');
        expect(html).toContain('https://hospeda.test/es/contacto/');
    });

    it('rejects an invalid changedAt and a list that is not an array', async () => {
        await expect(
            render({ ...basePayload, changedAt: 'not-an-instant' })
        ).rejects.toBeInstanceOf(TypeError);
        await expect(render({ ...basePayload, addedLines: 'Rubro A' })).rejects.toBeInstanceOf(
            TypeError
        );
    });
});
