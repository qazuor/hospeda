import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingCancellationNoticeRenderers } from '../../../src/services/outbox/billing-cancellation-notice-renderers.js';
import { SCHEDULED_CANCELLATION_SUBJECT } from '../../../src/templates/billing/scheduled-cancellation.js';
import { row } from './outbox-batch.harness.js';

const subscriptionUrl = 'https://hospeda.test/es/mi-cuenta/suscripcion/';
const renderers = createBillingCancellationNoticeRenderers({ subscriptionUrl });
const subscriptionId = 'private-subscription-id';

async function render(template: string, payload: Record<string, unknown>) {
    const result = await renderers[template]!({ row: row({ template, payload }) });
    return { subject: result.subject, html: renderToStaticMarkup(result.react) };
}

/**
 * Wording the code does not back (HOS-2580 §A): no free plan, no reactivation, and no
 * claim that the holder asked for the cancellation (an admin can schedule it too).
 */
const UNBACKED = /plan gratuito|reactiv|pediste|diste de baja|quer[ií]as darte/i;

describe('HOS-2580 §B billing.scheduled-cancellation', () => {
    it('names the plan, shows the callout, the after-copy and the button', async () => {
        // Arrange
        const payload = {
            subscriptionId,
            serviceEndsAt: '2026-10-12T12:00:00.000Z',
            planName: 'Plan Profesional',
            vertical: 'accommodation'
        };

        // Act
        const { subject, html } = await render('billing.scheduled-cancellation', payload);

        // Assert
        expect(subject).toBe(SCHEDULED_CANCELLATION_SUBJECT);
        expect(html).toContain(
            'Tu plan <strong>Plan Profesional</strong> tiene la baja programada'
        );
        expect(html).toContain('El servicio sigue hasta el 12 de octubre de 2026.');
        for (const label of ['Plan', 'Servicio hasta', 'Estado', 'Baja programada'])
            expect(html).toContain(label);
        expect(html).toContain('tus avisos dejan de estar publicados');
        expect(html).toContain('podés volver a contratar un plan');
        expect(html).toContain(`href="${subscriptionUrl}"`);
        expect(html).toContain('Puede llegarte un correo de Mercado Pago');
        expect(html).not.toMatch(UNBACKED);
        expect(html).not.toContain(subscriptionId);
    });

    it('speaks about the plan, not listings, for a vertical without listings', async () => {
        const { html } = await render('billing.scheduled-cancellation', {
            subscriptionId,
            serviceEndsAt: '2026-10-12T12:00:00.000Z',
            planName: 'Turista VIP',
            vertical: 'tourist'
        });
        expect(html).toContain('dejás de tener lo que incluye tu plan');
        expect(html).not.toContain('avisos');
    });

    it('still renders a row queued before HOS-2580, without plan or end date', async () => {
        const { html } = await render('billing.scheduled-cancellation', { subscriptionId });
        expect(html).toContain('Tu suscripción tiene la baja programada');
        expect(html).toContain('El servicio sigue hasta el final del período que ya pagaste.');
        expect(html).toContain('Final del período pagado');
        expect(html).not.toMatch(UNBACKED);
    });

    it.each([
        { subscriptionId, planName: 42 },
        { subscriptionId, vertical: 7 },
        { subscriptionId, serviceEndsAt: 'yesterday' }
    ])('rejects a malformed payload %o', async (payload) => {
        expect(() =>
            renderers['billing.scheduled-cancellation']!({
                row: row({ template: 'billing.scheduled-cancellation', payload })
            })
        ).toThrow(TypeError);
    });
});

describe('HOS-2580 §C billing.access-ending', () => {
    const payload = {
        subscriptionId,
        vertical: 'accommodation',
        planName: 'Plan Profesional',
        serviceEndsAt: '2026-12-15T15:00:00.000Z',
        daysRemaining: 5
    };

    it('renders the days left, the callout, the after-copy and the button', async () => {
        const { subject, html } = await render('billing.access-ending', payload);
        expect(subject).toBe('Tu acceso termina en 5 días');
        expect(html).toContain('Plan Profesional');
        expect(html).toContain('15 de diciembre de 2026');
        expect(html).toContain('Días restantes');
        expect(html).toContain('tus avisos dejan de estar publicados');
        expect(html).toContain(`href="${subscriptionUrl}"`);
        expect(html).not.toMatch(UNBACKED);
        expect(html).not.toContain(subscriptionId);
    });

    it('uses the singular subject on the last day', async () => {
        const { subject } = await render('billing.access-ending', { ...payload, daysRemaining: 1 });
        expect(subject).toBe('Tu acceso termina mañana');
    });

    it.each([
        { ...payload, planName: '' },
        { ...payload, daysRemaining: 0 },
        { ...payload, daysRemaining: 2.5 },
        { ...payload, serviceEndsAt: null },
        { ...payload, vertical: undefined }
    ])('rejects a malformed payload %o', (bad) => {
        expect(() =>
            renderers['billing.access-ending']!({
                row: row({ template: 'billing.access-ending', payload: bad })
            })
        ).toThrow(TypeError);
    });
});
