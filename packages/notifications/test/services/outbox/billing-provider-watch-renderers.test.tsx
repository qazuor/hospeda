import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    createBillingProviderWatchRenderers,
    PROVIDER_WATCH_ALERT_TEMPLATE
} from '../../../src/services/outbox/billing-provider-watch-renderers.js';
import { row } from './outbox-batch.harness.js';

const renderer = createBillingProviderWatchRenderers()[PROVIDER_WATCH_ALERT_TEMPLATE]!;

const payload = {
    account: 'sandbox',
    finishedAt: '2026-11-17T12:00:00.000Z',
    alerts: [
        {
            measurementId: 'M4',
            kind: 'value_changed',
            expected: '{"results":2}',
            obtained: '{"results":5}',
            details: []
        },
        {
            measurementId: 'RP7',
            kind: 'shape_changed',
            label: 'get',
            expected: '{"payer_email":"string"}',
            obtained: '{"payer_mail":"string"}',
            details: ['removed: payer_email (string)', 'added: payer_mail (string)']
        }
    ]
};

describe('HOS-1512 provider watch alert mail', () => {
    it('says which measurement changed, what it expected and what it obtained', async () => {
        const result = await renderer({
            row: row({ template: PROVIDER_WATCH_ALERT_TEMPLATE, payload })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe('Vigilancia del proveedor (cuenta de pruebas): 2 cambios');
        expect(html).toContain('M4');
        expect(html).toContain('devolvió otro valor');
        expect(html).toContain('Esperaba: {&quot;results&quot;:2}');
        expect(html).toContain('Obtuvo: {&quot;results&quot;:5}');
        expect(html).toContain('RP7');
        expect(html).toContain('cambió la forma de la respuesta (get)');
        expect(html).toContain('removed: payer_email (string)');
        expect(html).toContain('No ajustó nada');
    });

    it('names production and uses the singular for one change', async () => {
        const result = await renderer({
            row: row({
                template: PROVIDER_WATCH_ALERT_TEMPLATE,
                payload: { ...payload, account: 'production', alerts: [payload.alerts[0]] }
            })
        });
        expect(result.subject).toBe('Vigilancia del proveedor (producción): 1 cambio');
    });

    it.each([
        ['an empty payload', {}],
        ['no alerts', { ...payload, alerts: [] }],
        ['an unknown account', { ...payload, account: 'staging' }]
    ])('rejects %s', (_name, bad) => {
        expect(() =>
            renderer({ row: row({ template: PROVIDER_WATCH_ALERT_TEMPLATE, payload: bad }) })
        ).toThrow(TypeError);
    });
});
