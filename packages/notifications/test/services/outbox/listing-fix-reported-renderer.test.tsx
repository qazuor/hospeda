import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createVerticalListingRenderers } from '../../../src/services/outbox/vertical-listing-renderers.js';
import { row } from './outbox-batch.harness.js';

const LISTING = '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';
const OWNER = '77777777-7777-4777-8777-777777777777';
const REQUEST = '99999999-9999-4999-8999-999999999999';
const payload = {
    vertical: 'venue',
    listingId: LISTING,
    ownerId: OWNER,
    fixRequestId: REQUEST,
    reason: 'Falta el horario del domingo',
    suggestedDate: '2026-10-20',
    requestedAt: '2026-10-10T12:00:00.000Z',
    reportedAt: '2026-10-13T12:00:00.000Z'
};

async function render(data: Record<string, unknown>) {
    const renderers = createVerticalListingRenderers({
        siteUrl: 'https://hospeda.test/',
        readListingNames: vi.fn(async () => new Map([[LISTING, 'Parrilla La Costa']]))
    });
    const result = await renderers['verticals.listing-fix-reported']!({
        row: row({ template: 'verticals.listing-fix-reported', payload: data })
    });
    return { subject: result.subject, html: renderToStaticMarkup(result.react) };
}

describe('TEST:1701:4 AC:1701:4 AC:1701:1 the fix-reported staff notice renders in Spanish', () => {
    it('renders the full notice and identifiers', async () => {
        const result = await render(payload);
        expect(result.subject).toBe('Un dueño avisó que corrigió su ficha');
        for (const text of [
            'Parrilla La Costa',
            'gastronomía',
            payload.reason,
            '20 de octubre de 2026',
            '13 de octubre de 2026',
            '10 de octubre de 2026',
            LISTING,
            OWNER,
            REQUEST,
            'El pedido sigue abierto'
        ])
            expect(result.html).toContain(text);
    });

    it('omits the suggested date line when it is null', async () => {
        const result = await render({ ...payload, suggestedDate: null });
        expect(result.html).not.toContain('Fecha sugerida');
    });

    it.each([
        ...(
            ['listingId', 'ownerId', 'fixRequestId', 'reason', 'requestedAt', 'reportedAt'] as const
        ).map((key) => ({ ...payload, [key]: undefined })),
        { ...payload, vertical: 'unknown' },
        { ...payload, reportedAt: 'yesterday' },
        Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'suggestedDate')),
        { ...payload, suggestedDate: '20/10/2026' }
    ])('rejects malformed payload %#', async (invalid) => {
        await expect(render(invalid)).rejects.toBeInstanceOf(TypeError);
    });

    it('rejects when the listing name is missing', async () => {
        const renderers = createVerticalListingRenderers({
            siteUrl: 'https://hospeda.test/',
            readListingNames: vi.fn(async () => new Map())
        });
        await expect(
            renderers['verticals.listing-fix-reported']!({
                row: row({ template: 'verticals.listing-fix-reported', payload })
            })
        ).rejects.toBeInstanceOf(TypeError);
    });
});
