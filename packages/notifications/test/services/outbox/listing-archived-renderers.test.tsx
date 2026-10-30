import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createListingArchivedRenderers } from '../../../src/services/outbox/listing-archived-renderers.js';
import { row } from './outbox-batch.harness.js';

const template = 'verticals.listing-archived';
const renderers = createListingArchivedRenderers({ siteUrl: 'https://hospeda.test' });
const listingId = '3f0d3c2e-5a7b-4c1d-9e8f-0a1b2c3d4e5f';
const NOTHING_DELETED = 'no borramos nada';
const SELF_RESTORE = 'Vuelve a publicarse sola';
const ADDONS = 'Los destaques que tengas sobre esta ficha';
const BACK_TO_DRAFT = 'pasarla a borrador cuando quieras, sin pagar';

function payload(overrides: Record<string, unknown> = {}) {
    return {
        vertical: 'accommodation',
        listingId,
        transition: 'PB4',
        deletionAnnouncedAt: '2027-01-08T15:00:00.000Z',
        listingAddonCount: 0,
        ...overrides
    };
}

async function render(data: Record<string, unknown>) {
    const result = await renderers[template]!({ row: row({ template, payload: data }) });
    return { subject: result.subject, html: renderToStaticMarkup(result.react) };
}

describe('TEST:V6:36 the on-archive notice template', () => {
    it('TEST:V6:36 PB4 with an addon names every promise and the deletion date', async () => {
        const { subject, html } = await render(payload({ listingAddonCount: 1 }));
        expect(subject).toBe('Archivamos tu ficha de alojamiento por inactividad');
        expect(html).toContain(NOTHING_DELETED);
        expect(html).toContain(SELF_RESTORE);
        expect(html).toContain(ADDONS);
        expect(html).toContain(BACK_TO_DRAFT);
        expect(html).toContain('8 de enero de 2027');
        expect(html).not.toContain(listingId);
    });

    it('TEST:V6:36 PB5 without addons leaves out the self-restore and addon paragraphs', async () => {
        const { subject, html } = await render(
            payload({ vertical: 'experience', transition: 'PB5' })
        );
        expect(subject).toBe('Archivamos tu ficha de experiencias por inactividad');
        expect(html).toContain(NOTHING_DELETED);
        expect(html).toContain(BACK_TO_DRAFT);
        expect(html).not.toContain(SELF_RESTORE);
        expect(html).not.toContain(ADDONS);
        expect(html).not.toContain(listingId);
    });

    it('TEST:V6:36 names the market day of the announced instant, not the UTC day', async () => {
        const { html } = await render(payload({ deletionAnnouncedAt: '2027-01-08T02:00:00.000Z' }));
        expect(html).toContain('7 de enero de 2027');
        expect(html).not.toContain('8 de enero de 2027');
    });

    it.each([
        ['no deletion instant', { deletionAnnouncedAt: undefined }],
        ['a date without time', { deletionAnnouncedAt: '2027-01-08' }],
        ['an unknown transition', { transition: 'PB9' }],
        ['an unknown vertical', { vertical: 'tourist' }],
        ['no listing id', { listingId: undefined }],
        ['a negative addon count', { listingAddonCount: -1 }],
        ['a fractional addon count', { listingAddonCount: 1.5 }]
    ])('TEST:V6:36 rejects a payload with %s', async (_label, overrides) => {
        await expect(render(payload(overrides))).rejects.toThrow(TypeError);
    });
});
