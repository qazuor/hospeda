import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingGraceReminderRenderers } from '../../../src/services/outbox/billing-grace-reminder-renderers.js';
import { createBillingSignupRenderers } from '../../../src/services/outbox/billing-signup-renderers.js';
import { row } from './outbox-batch.harness.js';

const started = createBillingSignupRenderers({ siteUrl: 'https://hospeda.test' })[
    'billing.grace-started'
]!;
const reminder = createBillingGraceReminderRenderers({ siteUrl: 'https://hospeda.test' })[
    'billing.grace-reminder'
]!;
const startedPayload = {
    subscriptionId: 'private-id',
    vertical: 'venue',
    graceEndsAt: '2026-10-20T02:00:00.000Z'
};
const reminderPayload = {
    ...startedPayload,
    daysBefore: 3,
    deadlinesVersion: 1,
    paymentMethod: 'CARD'
};
const renderStarted = (payload: Record<string, unknown>) =>
    renderToStaticMarkup(
        started({
            row: row({ template: 'billing.grace-started', payload })
        }).react
    );
const renderReminder = (payload: Record<string, unknown>) =>
    renderToStaticMarkup(
        reminder({
            row: row({ template: 'billing.grace-reminder', payload })
        }).react
    );

describe('TEST:B8b:25 grace notice plan-change line', () => {
    it('adds the pending line to the complete grace-started message only for a pending successor', () => {
        const legacy = renderStarted(startedPayload);
        const pending = renderStarted({ ...startedPayload, planChangePending: true });
        expect(legacy).toBe(renderStarted({ ...startedPayload, planChangePending: false }));
        expect(legacy).toContain('No pudimos cobrar la cuota de tu suscripción de');
        expect(legacy).toContain('Tu servicio sigue activo hasta el 19 de octubre de 2026.');
        expect(legacy).toContain(
            'Si cambiás la tarjeta con la que pagás en Mercado Pago, el cobro se vuelve a intentar en el momento. No podemos asegurarte que entre.'
        );
        expect(legacy).toContain(
            'Si el cobro no entra antes del 19 de octubre de 2026, tu suscripción se suspende y vas a tener que volver a suscribirte. Mi Suscripción: https://hospeda.test/es/mi-cuenta/suscripcion/'
        );
        expect(pending).toContain('Tu cambio de plan sigue pendiente.');
        expect(pending).toContain(
            'Si el cobro no entra antes del 19 de octubre de 2026, tu suscripción se suspende y vas a tener que volver a suscribirte.'
        );
    });

    it('adds the pending line to the complete grace reminder and preserves absent payloads', () => {
        const legacy = renderReminder(reminderPayload);
        const pending = renderReminder({ ...reminderPayload, planChangePending: true });
        expect(legacy).toBe(renderReminder({ ...reminderPayload, planChangePending: false }));
        expect(legacy).toContain('Tu suscripción de');
        expect(legacy).toContain(
            'sigue en período de gracia. Faltan 3 días para el 19 de octubre de 2026, cuando termina este período.'
        );
        expect(legacy).toContain(
            'Si cambiás la tarjeta en Mercado Pago, el cobro se reintenta en el momento. No podemos garantizar que se apruebe.'
        );
        expect(legacy).toContain(
            'Si el cobro no entra antes de esa fecha, tu suscripción se suspende y vas a tener que volver a suscribirte. Mi Suscripción: https://hospeda.test/es/mi-cuenta/suscripcion/'
        );
        expect(pending).toContain('Tu cambio de plan sigue pendiente.');
        expect(pending).toContain(
            'Si el cobro no entra antes de esa fecha, tu suscripción se suspende y vas a tener que volver a suscribirte.'
        );
    });
});
