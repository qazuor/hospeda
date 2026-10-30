import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingSignupRenderers } from '../../../src/services/outbox/billing-signup-renderers.js';
import { row } from './outbox-batch.harness.js';

const renderer = createBillingSignupRenderers({ siteUrl: 'https://hospeda.test' })[
    'billing.paid-after-cancellation'
]!;
const payload = {
    subscriptionId: 'private-subscription',
    vertical: 'venue',
    serviceEndsAt: '2026-10-20T02:00:00.000Z',
    recurringAddonsCut: true
};
const render = (data: Record<string, unknown>) =>
    renderer({
        row: row({ template: 'billing.paid-after-cancellation', payload: data })
    });

describe('TEST:1623:3 AC:B13a:17 paid-after-cancellation renderer', () => {
    it('renders the exact notice, market date, addon line, and subscription link', async () => {
        const withAddons = renderToStaticMarkup((await render(payload)).react);
        const withoutAddons = renderToStaticMarkup(
            (await render({ ...payload, recurringAddonsCut: false })).react
        );
        expect(withAddons).toContain(
            'Tu pago entró y tenés servicio hasta el 19 de octubre de 2026; tu suscripción ya estaba cancelada, así que no se renueva: si querés seguir, volvé a suscribirte.'
        );
        expect(withAddons).toContain(
            'El cobro de tus complementos recurrentes de esta suscripción también se cortó: los seguís viendo hasta el 19 de octubre de 2026.'
        );
        expect(withAddons).toContain('https://hospeda.test/es/mi-cuenta/suscripcion/');
        expect(withoutAddons).toBe(
            withAddons.replace(
                /<p[^>]*>El cobro de tus complementos recurrentes de esta suscripción también se cortó: los seguís viendo hasta el 19 de octubre de 2026\.<\/p>/,
                ''
            )
        );
    });

    it.each([
        { ...payload, serviceEndsAt: undefined },
        { ...payload, serviceEndsAt: 'not-iso' },
        { ...payload, vertical: undefined },
        { ...payload, recurringAddonsCut: 'yes' }
    ])('rejects invalid payload %#', async (invalid) => {
        expect(() => render(invalid)).toThrow(TypeError);
    });
});
