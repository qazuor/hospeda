import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingSignupRenderers } from '../../../src/services/outbox/billing-signup-renderers.js';
import { row } from './outbox-batch.harness.js';

const template = 'billing.addon-listing-purged-cancel';

describe('A6 before-cancel outbox renderer', () => {
    it('renders the provisional purged-listing copy and requires a subscription id', async () => {
        const renderer = createBillingSignupRenderers({ siteUrl: 'https://hospeda.test' })[
            template
        ];
        if (!renderer) throw new Error('A6 renderer missing');
        const rendered = await renderer({
            row: row({ template, payload: { subscriptionId: crypto.randomUUID() } })
        });
        const html = renderToStaticMarkup(rendered.react);
        expect(rendered.subject).toBe('Cancelamos el cobro del addon de una ficha que borraste');
        expect(html).toContain('El addon se consumió con la ficha');
        expect(html).toContain('cancelamos su cobro en Mercado Pago');
        expect(() => renderer({ row: row({ template, payload: {} }) })).toThrow(TypeError);
    });
});
