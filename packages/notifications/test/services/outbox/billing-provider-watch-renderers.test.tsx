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
        expect(html).toContain('Devolvió otro valor');
        expect(html).toContain('Esperaba');
        expect(html).toContain('Obtuvo');
        // Provider values are shown verbatim, in cells the Spanish-only check exempts
        expect(html).toMatch(/data-raw-value="true"[^>]*>\{&quot;results&quot;:2\}</);
        expect(html).toMatch(/data-raw-value="true"[^>]*>\{&quot;results&quot;:5\}</);
        expect(html).toContain('RP7');
        expect(html).toContain('Cambió la forma de la respuesta (get)');
        expect(html).toContain('removed: payer_email (string)');
        expect(html).toContain('No ajustó nada');
    });

    it('says a measurement has no accepted shape yet', async () => {
        const result = await renderer({
            row: row({
                template: PROVIDER_WATCH_ALERT_TEMPLATE,
                payload: {
                    ...payload,
                    alerts: [
                        {
                            measurementId: 'M7',
                            kind: 'shape_baseline_missing',
                            expected: 'null',
                            obtained: '{"get":{"$":"object"}}',
                            details: ['no accepted baseline for this measurement']
                        }
                    ]
                }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('M7');
        expect(html).toContain('No tiene una forma de respuesta aceptada');
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

    it('says how many more changes the mail does not show', async () => {
        const render = async (omitted: number) => {
            const result = await renderer({
                row: row({
                    template: PROVIDER_WATCH_ALERT_TEMPLATE,
                    payload: { ...payload, omitted }
                })
            });
            return renderToStaticMarkup(result.react);
        };
        expect(await render(30)).toContain('30 cambios más no se muestran');
        expect(await render(1)).toContain('1 cambio más no se muestra');
        expect(await render(0)).not.toContain('no se muestra');
    });

    it('renders a payload written before the field existed as nothing omitted', async () => {
        const result = await renderer({
            row: row({ template: PROVIDER_WATCH_ALERT_TEMPLATE, payload })
        });
        expect(renderToStaticMarkup(result.react)).not.toContain('no se muestra');
    });

    it('names the errored measurement, its error and that the run failed (HOS-2385)', async () => {
        const result = await renderer({
            row: row({
                template: PROVIDER_WATCH_ALERT_TEMPLATE,
                payload: {
                    ...payload,
                    run: {
                        outcome: 'failed',
                        reason: 'order-search could not be read: bad paging'
                    },
                    alerts: [
                        {
                            measurementId: 'order-search',
                            kind: 'measurement_errored',
                            expected: '{"results":1}',
                            obtained: 'null',
                            details: ['bad paging.total']
                        }
                    ]
                }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(
            'Vigilancia del proveedor (cuenta de pruebas): la corrida falló, 1 alerta'
        );
        expect(html).toContain('order-search');
        expect(html).toContain('No se pudo medir');
        expect(html).toContain('bad paging.total');
        expect(html).toContain('La corrida falló');
        expect(html).toContain('order-search could not be read: bad paging');
    });

    it('renders a failed run that has no alert at all (HOS-2385)', async () => {
        const result = await renderer({
            row: row({
                template: PROVIDER_WATCH_ALERT_TEMPLATE,
                payload: { ...payload, alerts: [], run: { outcome: 'aborted', reason: 'GUARD' } }
            })
        });
        expect(result.subject).toContain('la corrida se abortó');
        expect(renderToStaticMarkup(result.react)).toContain('GUARD');
    });

    it.each([
        ['a negative omitted count', { ...payload, omitted: -1 }],
        ['an empty payload', {}],
        ['no alerts and no failed run', { ...payload, alerts: [] }],
        ['an unknown account', { ...payload, account: 'staging' }]
    ])('rejects %s', (_name, bad) => {
        expect(() =>
            renderer({ row: row({ template: PROVIDER_WATCH_ALERT_TEMPLATE, payload: bad }) })
        ).toThrow(TypeError);
    });
});

describe('HOS-2565 provider watch alert: finishedAt', () => {
    it('falls back to the raw string when finishedAt is not a real instant', async () => {
        // The payload schema rejects a bad instant, so exercise the template directly.
        const { ProviderWatchAlert } = await import(
            '../../../src/templates/billing/provider-watch-alert.js'
        );
        const html = renderToStaticMarkup(
            ProviderWatchAlert({ account: 'sandbox', finishedAt: 'ayer a la tarde', alerts: [] })
        );
        expect(html).toContain('ayer a la tarde');
        expect(html).not.toMatch(/el\s+y encontró/);
    });
});
