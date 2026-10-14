import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingRenewalRenderers } from '../../../src/services/outbox/billing-renewal-renderers.js';
import { RENEWAL_UPCOMING_SUBJECT } from '../../../src/templates/billing/renewal-upcoming.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingRenewalRenderers({ siteUrl: 'https://hospeda.test' });
const subscriptionId = 'private-subscription-id';

describe('HOS-1622 TEST:B13a:13 AC:B13a:13 the renewal notice renders', () => {
    it('renders the exact subject, customer date and approved copy without identifiers', async () => {
        const result = await renderers['billing.renewal-upcoming']!({
            row: row({
                template: 'billing.renewal-upcoming',
                payload: {
                    subscriptionId,
                    vertical: 'accommodation',
                    planName: 'Plan premium',
                    renewalDate: '2026-10-20',
                    daysBefore: 5,
                    deadlinesVersion: 1
                }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(RENEWAL_UPCOMING_SUBJECT);
        expect(html).toContain('Plan premium');
        expect(html).toContain('20 de octubre de 2026');
        expect(html).toContain('Mercado Pago');
        expect(html).toContain('darte de baja');
        expect(html).not.toContain(subscriptionId);
    });

    it('uses singular preview text one day before renewal', async () => {
        const result = await renderers['billing.renewal-upcoming']!({
            row: row({
                template: 'billing.renewal-upcoming',
                payload: {
                    subscriptionId,
                    planName: 'Plan premium',
                    renewalDate: '2026-10-20',
                    daysBefore: 1
                }
            })
        });
        expect(renderToStaticMarkup(result.react)).toContain(
            'Falta 1 día para la renovación de tu plan'
        );
    });

    it.each([
        ['empty payload', {}],
        [
            'malformed date',
            { subscriptionId, planName: 'Plan', renewalDate: '20-10-2026', daysBefore: 5 }
        ],
        [
            'zero days',
            { subscriptionId, planName: 'Plan', renewalDate: '2026-10-20', daysBefore: 0 }
        ],
        ['empty plan', { subscriptionId, planName: '', renewalDate: '2026-10-20', daysBefore: 5 }]
    ])('rejects %s', (_label, payload) => {
        expect(() =>
            renderers['billing.renewal-upcoming']!({
                row: row({ template: 'billing.renewal-upcoming', payload })
            })
        ).toThrow(TypeError);
    });
});
