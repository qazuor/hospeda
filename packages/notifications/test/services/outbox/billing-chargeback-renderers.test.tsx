import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingChargebackRenderers } from '../../../src/services/outbox/billing-chargeback-renderers.js';
import { CHARGEBACK_SUSPENSION_SUBJECT } from '../../../src/templates/billing/index.js';
import { row } from './outbox-batch.harness.js';

const template = 'billing.chargeback-suspension';
const renderer = createBillingChargebackRenderers({
    subscriptionUrl: 'https://hospeda.test/es/mi-cuenta/suscripcion/'
})[template]!;
const payload = {
    subscriptionId: '8b17fa49-59f3-4a13-a0d5-fd42e6bac482',
    vertical: 'accommodation',
    paymentMethod: 'CARD',
    touristVipLost: false,
    oneTimeAddons: [],
    chargedBackPayment: { amountMinor: 10_000, currency: 'ARS', chargedOn: '2026-11-19' }
};

function textLines(courtesyEnded: boolean): string[] {
    const rendered = renderer({ row: row({ template, payload: { ...payload, courtesyEnded } }) });
    const html = renderToStaticMarkup(rendered.react);
    return [...html.matchAll(/<p[^>]*>(.*?)<\/p>/g)].map((match) => stripTags(match[1]!));
}

/** Removes tags until none is left, so a nested fragment cannot survive one pass. */
function stripTags(markup: string): string {
    let text = markup;
    let previous: string;
    do {
        previous = text;
        text = text.replace(/<[^>]*>/g, '');
    } while (text !== previous);
    return text.replace(/[<>]/g, '');
}

describe('TEST:B7:7 AC:B7:10 chargeback outbox renderer', () => {
    it('renders its subject, formatted amount, date, and the exact courtesy variant', () => {
        const result = renderer({
            row: row({ template, payload: { ...payload, courtesyEnded: true } })
        });
        expect(result.subject).toBe(CHARGEBACK_SUSPENSION_SUBJECT);
        const withCourtesy = textLines(true);
        const withoutCourtesy = textLines(false);
        const commonStart = [
            'Hospeda',
            'Turismo en el Litoral',
            'Tu suscripción de Alojamiento se suspendió.',
            'Desconociste el cargo de $100,00 del día 19 de noviembre de 2026 en tu banco. Mientras se resuelve, suspendimos el servicio. Si fue un error, podés volver a suscribirte desde acá: https://hospeda.test/es/mi-cuenta/suscripcion/'
        ];
        const commonEnd = [
            'Ya no se te va a cobrar: cancelamos la autorización de cobro.',
            'Una persona de nuestro equipo sigue el caso.',
            'Hospeda - Turismo en el Litoral',
            'Plataforma de alojamientos turísticos en Concepción del Uruguay y la región del Litoral argentino'
        ];
        expect(withCourtesy).toEqual([
            ...commonStart,
            'La cortesía que tenías terminó hoy.',
            ...commonEnd
        ]);
        expect(withoutCourtesy).toEqual([...commonStart, ...commonEnd]);
    });

    it('rejects incomplete payloads', () => {
        expect(() => renderer({ row: row({ template, payload: { ...payload } }) })).toThrow(
            TypeError
        );
    });
});
