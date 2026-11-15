import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingSignupRenderers } from '../../../src/services/outbox/billing-signup-renderers.js';
import { SUCCESSOR_CUT_CANCEL_SUBJECT } from '../../../src/templates/billing/index.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingSignupRenderers({ siteUrl: 'https://hospeda.test' });
const subscriptionId = '8b17fa49-59f3-4a13-a0d5-fd42e6bac482';

describe('billing successor cut renderer', () => {
    it('renders the S31 notice and requires subscriptionId', () => {
        const template = 'billing.successor-cut-cancel';
        const result = renderers[template]!({
            row: row({ template, payload: { subscriptionId } })
        });
        const html = renderToStaticMarkup(result.react);

        expect(result.subject).toBe(SUCCESSOR_CUT_CANCEL_SUBJECT);
        expect(html).toContain(SUCCESSOR_CUT_CANCEL_SUBJECT);
        expect(html).toContain('Registramos una disputa de pago sobre tu suscripción anterior.');
        expect(html).toContain('cancelamos también el cambio de plan que habías iniciado');
        expect(() => renderers[template]!({ row: row({ template, payload: {} }) })).toThrow(
            TypeError
        );
    });
});
