import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createListingRetentionRenderers } from '../../../src/services/outbox/listing-retention-renderers.js';
import { row } from './outbox-batch.harness.js';

const BEFORE_ARCHIVE = 'verticals.listing-retention-before-archive';
const BEFORE_DELETION = 'verticals.listing-retention-before-deletion';
const renderers = createListingRetentionRenderers({ siteUrl: 'https://hospeda.test' });
const listingId = '3f0d3c2e-5a7b-4c1d-9e8f-0a1b2c3d4e5f';

function archivePayload(overrides: Record<string, unknown> = {}) {
    return {
        vertical: 'venue',
        listingId,
        transition: 'PB4',
        archiveAt: '2027-01-12T02:00:00.000Z',
        ...overrides
    };
}

function deletionPayload(overrides: Record<string, unknown> = {}) {
    return {
        vertical: 'venue',
        listingId,
        deletionAt: '2027-01-12T02:00:00.000Z',
        ...overrides
    };
}

async function render(template: string, payload: Record<string, unknown>) {
    const result = await renderers[template]!({ row: row({ template, payload }) });
    return { subject: result.subject, html: renderToStaticMarkup(result.react) };
}

describe('TEST:V9b:10 retention notice renderers', () => {
    it('renders the before-archive subject, market date, PB4 promise, and no listing id', async () => {
        const { subject, html } = await render(BEFORE_ARCHIVE, archivePayload());
        expect(subject).toContain('gastronomía');
        expect(subject.trim()).not.toBe('');
        expect(html).toContain('11 de enero de 2027');
        expect(html).not.toContain('12 de enero de 2027');
        expect(html).toContain('recuperás la cobertura de tu plan');
        expect(html).not.toContain(listingId);
        expect(html.toLowerCase()).not.toContain('export');
    });

    it('renders the before-deletion subject, market date, and no listing id', async () => {
        const { subject, html } = await render(BEFORE_DELETION, deletionPayload());
        expect(subject).toContain('gastronomía');
        expect(subject.trim()).not.toBe('');
        expect(html).toContain('11 de enero de 2027');
        expect(html).not.toContain('12 de enero de 2027');
        expect(html).toContain('textos, fotos, preguntas frecuentes y horarios');
        expect(html).not.toContain(listingId);
        expect(html.toLowerCase()).not.toContain('export');
    });

    it('uses distinct, contract-specific paragraphs for PB4 and PB5', async () => {
        const pb4 = await render(BEFORE_ARCHIVE, archivePayload({ transition: 'PB4' }));
        const pb5 = await render(BEFORE_ARCHIVE, archivePayload({ transition: 'PB5' }));
        expect(pb4.html).toContain('Si recuperás la cobertura de tu plan antes de esa fecha');
        expect(pb4.html).not.toContain('Si publicás la ficha antes de esa fecha');
        expect(pb5.html).toContain('Si publicás la ficha antes de esa fecha');
        expect(pb5.html).not.toContain('Si recuperás la cobertura de tu plan antes de esa fecha');
        expect(pb4.html).not.toBe(pb5.html);
    });

    it.each([
        ['vertical', { vertical: undefined }],
        ['listingId', { listingId: '' }],
        ['transition', { transition: undefined }],
        ['archiveAt', { archiveAt: undefined }],
        ['archiveAt without Z', { archiveAt: '2027-01-12T02:00:00.000' }]
    ])('rejects a before-archive payload missing %s', async (_field, missing) => {
        await expect(render(BEFORE_ARCHIVE, archivePayload(missing))).rejects.toThrow(TypeError);
    });

    it.each([
        ['vertical', { vertical: undefined }],
        ['listingId', { listingId: '' }],
        ['deletionAt', { deletionAt: undefined }],
        ['deletionAt without Z', { deletionAt: '2027-01-12T02:00:00.000' }]
    ])('rejects a before-deletion payload missing %s', async (_field, missing) => {
        await expect(render(BEFORE_DELETION, deletionPayload(missing))).rejects.toThrow(TypeError);
    });
});
