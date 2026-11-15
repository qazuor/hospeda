import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingPlanMigrationRenderers } from '../../../src/services/outbox/billing-plan-migration-renderers.js';
import { formatCurrency, formatDate } from '../../../src/templates/utils/index.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingPlanMigrationRenderers({ siteUrl: 'https://hospeda.test' });
const currentAmountMinor = 123456;
const newAmountMinor = 234567;
const currency = 'ARS';
const applicationDate = '2026-12-20';
const currentAmount = formatCurrency({ amount: currentAmountMinor, currency });
const newAmount = formatCurrency({ amount: newAmountMinor, currency });
const formattedDate = formatDate({ dateString: applicationDate });
const base = {
    planName: 'Plan Inicial',
    targetPlanName: 'Plan Destino',
    direction: 'UP',
    currentAmountMinor,
    newAmountMinor,
    currency,
    applicationDate,
    losesPromo: true
};

function render(template: string, payload: Record<string, unknown>) {
    const result = renderers[template]!({ row: row({ template, payload }) });
    return { subject: result.subject, html: renderToStaticMarkup(result.react) };
}

describe('TEST:B12:3 AC:B12:3 el aviso, sus correos y la fecha de cada cliente', () => {
    it('announces the scheduled plan, amounts, date and customer choices', () => {
        const { subject, html } = render('billing.plan-migration-announced', {
            ...base,
            variant: 'SCHEDULED'
        });
        expect(subject).toBe('Tu plan deja de venderse');
        expect(html).toContain('Plan Inicial deja de venderse');
        expect(html).toContain('plan Plan Destino');
        expect(html).toContain('subida de precio');
        expect(html).toContain(currentAmount);
        expect(html).toContain(newAmount);
        expect(html).toContain(formattedDate);
        expect(html).toContain('perdés tu promoción actual');
        expect(html).toContain('Podés darte de baja o elegir otro plan antes');
        expect(html).toContain('Mercado Pago también te va a avisar del cambio de monto');
    });

    it('announces the waiting plan without assigning a date yet', () => {
        const { subject, html } = render('billing.plan-migration-announced', {
            ...base,
            variant: 'WAITING',
            direction: 'DOWN',
            applicationDate: null,
            losesPromo: false
        });
        expect(subject).toBe('Tu plan deja de venderse');
        expect(html).toContain('bajada de precio');
        expect(html).toContain(currentAmount);
        expect(html).toContain(newAmount);
        expect(html).toContain('Te avisamos la fecha cuando tu suscripción vuelva a estar activa.');
        expect((html.match(new RegExp(formattedDate, 'g')) ?? []).length).toBe(0);
    });

    it.each([30, 7])('reminds the customer %i days before their own date', (daysBefore) => {
        const { subject, html } = render('billing.plan-migration-upcoming', {
            ...base,
            daysBefore
        });
        expect(subject).toBe('Se acerca el cambio de tu plan');
        expect(html).toContain(`Faltan ${daysBefore} días`);
        expect(html).toContain('Plan Inicial');
        expect(html).toContain('Plan Destino');
        expect(html).toContain(currentAmount);
        expect(html).toContain(newAmount);
        expect(html).toContain(formattedDate);
        expect(html).toContain('perdés tu promoción actual');
        expect(html).toContain('Podés darte de baja o elegir otro plan antes');
    });

    it('tells only card payers that Mercado Pago also announces the amount change', () => {
        const phrase = 'Mercado Pago también te va a mandar un aviso del cambio de monto';
        const occurrences = (html: string) => (html.match(new RegExp(phrase, 'g')) ?? []).length;
        const card = render('billing.plan-migration-upcoming', {
            ...base,
            daysBefore: 7,
            providerNotifies: true
        });
        expect(occurrences(card.html)).toBe(1);
        const manual = render('billing.plan-migration-upcoming', {
            ...base,
            daysBefore: 7,
            providerNotifies: false
        });
        expect(occurrences(manual.html)).toBe(0);
        const absent = render('billing.plan-migration-upcoming', { ...base, daysBefore: 7 });
        expect(occurrences(absent.html)).toBe(0);
    });
});

describe('TEST:B12:6 AC:B12:6 la que no tiene su ciclo en el destino queda PARA_RESOLVER y recibe sólo el correo del anuncio diciendo que la van a contactar', () => {
    it('renders TO_RESOLVE with contact copy and zero dates or new prices', () => {
        const { subject, html } = render('billing.plan-migration-announced', {
            variant: 'TO_RESOLVE',
            planName: 'Plan Inicial',
            newAmountMinor,
            currency,
            applicationDate
        });
        expect(subject).toBe('Tu plan deja de venderse');
        expect(html).toContain('Plan Inicial deja de venderse');
        expect(html).toContain('Te vamos a contactar para elegir con vos cómo seguir con tu plan.');
        expect((html.match(new RegExp(formattedDate, 'g')) ?? []).length).toBe(0);
        expect(html.split(newAmount).length - 1).toBe(0);
        expect((html.match(/precio nuevo/g) ?? []).length).toBe(0);
    });
});

describe('TEST:B12:7 AC:B12:7 a cada pendiente le sale ya no cambia nada y a quien ya empezó le sale su precio nuevo y fecha', () => {
    it('renders the literal NOTHING_CHANGES cancellation', () => {
        const { subject, html } = render('billing.plan-migration-cancelled', {
            variant: 'NOTHING_CHANGES',
            planName: 'Plan Inicial'
        });
        expect(subject).toBe('Cancelamos el cambio de tu plan');
        expect(html).toContain('ya no cambia nada');
        expect((html.match(new RegExp(formattedDate, 'g')) ?? []).length).toBe(0);
    });

    it('explains ALREADY_STARTED with the formatted new price and date', () => {
        const { subject, html } = render('billing.plan-migration-cancelled', {
            variant: 'ALREADY_STARTED',
            planName: 'Plan Inicial',
            newAmountMinor,
            currency,
            applicationDate
        });
        expect(subject).toBe('Cancelamos el cambio de tu plan');
        expect(html).toContain('La cancelación no alcanza');
        expect(html).toContain('porque tu cambio ya empezó');
        expect(html).toContain(newAmount);
        expect(html).toContain(formattedDate);
    });
});

describe('plan migration payload validation', () => {
    it.each([
        [
            'announced missing field',
            'billing.plan-migration-announced',
            { variant: 'TO_RESOLVE' },
            'Faltan datos requeridos del anuncio de migración'
        ],
        [
            'announced wrong type',
            'billing.plan-migration-announced',
            { ...base, variant: 'SCHEDULED', losesPromo: 'yes' },
            'Faltan datos requeridos del anuncio de migración'
        ],
        [
            'upcoming missing field',
            'billing.plan-migration-upcoming',
            { ...base, daysBefore: 7, currency: undefined },
            'Faltan datos requeridos del recordatorio de migración'
        ],
        [
            'upcoming wrong type',
            'billing.plan-migration-upcoming',
            { ...base, daysBefore: '7' },
            'Faltan datos requeridos del recordatorio de migración'
        ],
        [
            'cancelled missing field',
            'billing.plan-migration-cancelled',
            { variant: 'NOTHING_CHANGES' },
            'Faltan datos requeridos de la cancelación de migración'
        ],
        [
            'cancelled wrong type',
            'billing.plan-migration-cancelled',
            {
                variant: 'ALREADY_STARTED',
                planName: 'Plan Inicial',
                newAmountMinor: '100',
                currency,
                applicationDate
            },
            'Faltan datos requeridos de la cancelación de migración'
        ]
    ])('rejects %s with its template TypeError', (_label, template, payload, message) => {
        expect(() => render(template, payload)).toThrow(new TypeError(message));
    });

    it.each([
        [
            'scheduled date',
            'billing.plan-migration-announced',
            { ...base, variant: 'SCHEDULED', applicationDate: undefined }
        ],
        [
            'scheduled amount',
            'billing.plan-migration-announced',
            { ...base, variant: 'SCHEDULED', newAmountMinor: undefined }
        ],
        [
            'waiting plan',
            'billing.plan-migration-announced',
            { ...base, variant: 'WAITING', targetPlanName: undefined }
        ],
        ['to resolve plan', 'billing.plan-migration-announced', { variant: 'TO_RESOLVE' }],
        ['upcoming days', 'billing.plan-migration-upcoming', { ...base, daysBefore: 0 }],
        [
            'upcoming currency',
            'billing.plan-migration-upcoming',
            { ...base, daysBefore: 7, currency: '' }
        ],
        [
            'nothing changes plan',
            'billing.plan-migration-cancelled',
            { variant: 'NOTHING_CHANGES' }
        ],
        [
            'already started date',
            'billing.plan-migration-cancelled',
            { variant: 'ALREADY_STARTED', planName: 'Plan Inicial', newAmountMinor, currency }
        ],
        [
            'already started amount',
            'billing.plan-migration-cancelled',
            { variant: 'ALREADY_STARTED', planName: 'Plan Inicial', applicationDate, currency }
        ]
    ])('rejects missing or invalid %s with TypeError', (_label, template, payload) => {
        expect(() => render(template, payload)).toThrow(TypeError);
    });

    it.each([
        ['billing.plan-migration-announced', { ...base, variant: 'UNKNOWN' }],
        ['billing.plan-migration-cancelled', { planName: 'Plan Inicial', variant: 'UNKNOWN' }]
    ])('rejects an unknown variant in %s with TypeError', (template, payload) => {
        expect(() => render(template, payload)).toThrow(TypeError);
    });
});

describe('AC:B12:9 el anuncio del aumento', () => {
    it('renders the increase subject and every increase phrase with the real amounts', () => {
        const { subject, html } = render('billing.plan-migration-announced', {
            ...base,
            variant: 'SCHEDULED',
            reason: 'PRICE_INCREASE'
        });
        expect(subject).toBe('Cambia el precio de tu plan');
        expect(html).toContain('El precio de tu plan Plan Inicial va a aumentar.');
        expect(html).toContain(`Tu precio actual es ${currentAmount}.`);
        expect(html).toContain(`El precio nuevo será ${newAmount}.`);
        expect(html).toContain('El nuevo precio se aplica desde tu cobro del');
        expect(html).toContain(formattedDate);
        expect(html).toContain('Hasta esa fecha seguís pagando tu precio actual.');
        expect(html).toContain(
            'Si no estás de acuerdo, podés cancelar tu suscripción antes de esa fecha.'
        );
        expect(html).toContain('Mercado Pago también te va a avisar del cambio de monto.');
    });

    it('renders the waiting increase without a date', () => {
        const { subject, html } = render('billing.plan-migration-announced', {
            ...base,
            variant: 'WAITING',
            applicationDate: null,
            reason: 'PRICE_INCREASE'
        });
        expect(subject).toBe('Cambia el precio de tu plan');
        expect(html).toContain(`Tu precio actual es ${currentAmount}.`);
        expect(html).toContain(`El precio nuevo será ${newAmount}.`);
        expect(html).toContain('Te avisamos la fecha cuando tu suscripción vuelva a estar activa.');
        expect(html).toContain('Hasta esa fecha seguís pagando tu precio actual.');
        expect((html.match(new RegExp(formattedDate, 'g')) ?? []).length).toBe(0);
    });

    it('keeps the retirement subject when no reason is present', () => {
        const { subject } = render('billing.plan-migration-announced', {
            ...base,
            variant: 'SCHEDULED'
        });
        expect(subject).toBe('Tu plan deja de venderse');
    });
});

describe('AC:B12:9 el recordatorio del aumento', () => {
    const providerPhrase = 'Mercado Pago también te va a mandar un aviso del cambio de monto';
    const occurrences = (html: string, phrase: string) =>
        (html.match(new RegExp(phrase, 'g')) ?? []).length;

    it('dice el plazo del aumento, los dos precios y la fecha de ese cliente, y permite cancelar', () => {
        const { subject, html } = render('billing.plan-migration-upcoming', {
            ...base,
            daysBefore: 7,
            reason: 'PRICE_INCREASE'
        });
        expect(subject).toBe('Se acerca el cambio de precio de tu plan');
        expect(html).toContain(
            'Faltan 7 días para el cambio de precio de tu plan Plan Inicial: se aplica desde tu cobro del'
        );
        expect(html).toContain(formattedDate);
        expect(html).toContain(`Tu precio actual es ${currentAmount}.`);
        expect(html).toContain(`El precio nuevo será ${newAmount}.`);
        expect(html).toContain(
            'Si no estás de acuerdo, podés cancelar tu suscripción antes de esa fecha.'
        );
        expect(occurrences(html, 'subida de precio')).toBe(0);
        expect(occurrences(html, 'bajada de precio')).toBe(0);
        expect(occurrences(html, 'perdés tu promoción actual')).toBe(0);
    });

    it('sólo el tarjetahabiente recibe la frase de Mercado Pago', () => {
        const card = render('billing.plan-migration-upcoming', {
            ...base,
            daysBefore: 7,
            providerNotifies: true,
            reason: 'PRICE_INCREASE'
        });
        expect(occurrences(card.html, providerPhrase)).toBe(1);
        const manual = render('billing.plan-migration-upcoming', {
            ...base,
            daysBefore: 7,
            providerNotifies: false,
            reason: 'PRICE_INCREASE'
        });
        expect(occurrences(manual.html, providerPhrase)).toBe(0);
    });
});

describe('AC:B12:9 la cancelación del aumento', () => {
    it('renders the increase NOTHING_CHANGES subject and literal copy', () => {
        const { subject, html } = render('billing.plan-migration-cancelled', {
            variant: 'NOTHING_CHANGES',
            planName: 'Plan Inicial',
            reason: 'PRICE_INCREASE'
        });
        expect(subject).toBe('Cancelamos el cambio de precio de tu plan');
        expect(html).toContain(
            'Cancelamos el aumento de precio de tu plan Plan Inicial: ya no cambia nada.'
        );
    });

    it('renders the increase ALREADY_STARTED copy with the formatted date and amount', () => {
        const { subject, html } = render('billing.plan-migration-cancelled', {
            variant: 'ALREADY_STARTED',
            planName: 'Plan Inicial',
            newAmountMinor,
            currency,
            applicationDate,
            reason: 'PRICE_INCREASE'
        });
        expect(subject).toBe('Cancelamos el cambio de precio de tu plan');
        expect(html).toContain(
            'El aumento de tu plan Plan Inicial ya empezó a aplicarse y la cancelación no lo alcanza'
        );
        expect(html).toContain(`desde el ${formattedDate} pagás ${newAmount}.`);
    });

    it('keeps the retirement subject and copy when no reason is present', () => {
        const nothing = render('billing.plan-migration-cancelled', {
            variant: 'NOTHING_CHANGES',
            planName: 'Plan Inicial'
        });
        expect(nothing.subject).toBe('Cancelamos el cambio de tu plan');
        expect(nothing.html).toContain(
            'Cancelamos la migración de tu plan Plan Inicial: ya no cambia nada.'
        );
        const started = render('billing.plan-migration-cancelled', {
            variant: 'ALREADY_STARTED',
            planName: 'Plan Inicial',
            newAmountMinor,
            currency,
            applicationDate
        });
        expect(started.subject).toBe('Cancelamos el cambio de tu plan');
        expect(started.html).toContain(
            'La cancelación no alcanza a tu plan Plan Inicial porque tu cambio ya empezó.'
        );
    });
});
