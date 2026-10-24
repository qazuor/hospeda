import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingGraceReminderRenderers } from '../../../src/services/outbox/billing-grace-reminder-renderers.js';
import { GRACE_REMINDER_SUBJECT } from '../../../src/templates/billing/grace-reminder.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingGraceReminderRenderers({ siteUrl: 'https://hospeda.test' });
const base = {
    subscriptionId: 'private-id',
    vertical: 'gastronomy',
    graceEndsAt: '2026-10-20T02:00:00.000Z',
    daysBefore: 3,
    deadlinesVersion: 1
};

describe('TEST:1707:5 AC:1707:5 grace reminder renderer', () => {
    it('renders configured subject, local end date, Mercado Pago retry, and subscription link without identifiers', () => {
        const result = renderers['billing.grace-reminder']!({
            row: row({ template: 'billing.grace-reminder', payload: base })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(GRACE_REMINDER_SUBJECT);
        expect(html).toContain('Gastronomía');
        expect(html).toContain('20 de octubre de 2026');
        expect(html).toContain('3 días');
        expect(html).toContain('Mercado Pago');
        expect(html).toContain('https://hospeda.test/es/mi-cuenta/suscripcion/');
        expect(html).not.toContain('private-id');
    });
    it('uses singular wording and rejects incomplete payloads', () => {
        const result = renderers['billing.grace-reminder']!({
            row: row({ template: 'billing.grace-reminder', payload: { ...base, daysBefore: 1 } })
        });
        expect(renderToStaticMarkup(result.react)).toContain('1 día');
        expect(() =>
            renderers['billing.grace-reminder']!({
                row: row({ template: 'billing.grace-reminder', payload: {} })
            })
        ).toThrow(TypeError);
    });
});
