import type { EmailOutboxRow } from '@repo/db';
import { NotificationType, OUTBOX_MAIL_RENDERERS, PROMO_ENDING_SUBJECT } from '@repo/notifications';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';
import { LISTING_ARCHIVED_TEMPLATE } from '@repo/verticals';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    LISTING_FIX_REQUESTED_TEMPLATE,
    LISTING_MODERATED_TEMPLATE,
    LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE,
    LISTING_MODERATION_LIFTED_TEMPLATE
} from '../../../../packages/verticals/src/publication/moderation-notices';
import { LISTING_RESTITUTION_TEMPLATE } from '../../../../packages/verticals/src/publication/publication-notices';
import {
    LISTING_PURGED_TEMPLATE,
    PRICE_ALERT_CLOSED_TEMPLATE
} from '../../../../packages/verticals/src/publication/purge-notices';
import { buildOutboxSenderRender } from '../../src/cron/jobs/email-outbox-sender.job.js';

function row(template: string, payload: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-test',
        recipientUserId: 'user-test',
        recipientEmail: 'ana@example.test',
        template,
        channel: 'email',
        payload,
        sendAfter: null,
        status: 'processing',
        dedupKey: 'dedup-test',
        lockedBy: 'test',
        lockedUntil: new Date('2026-10-07T12:05:00.000Z'),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: new Date('2026-10-07T12:00:00.000Z'),
        updatedAt: new Date('2026-10-07T12:00:00.000Z')
    };
}
describe('TEST:V4:22 the production outbox sender renders the trial campaign mails', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    it.each([
        [
            NotificationType.TRIAL_ENDING_2D,
            'PRE_EXPIRY',
            'pre:-2d',
            2,
            ['accommodation', 'venue', 'experience']
        ],
        [NotificationType.TRIAL_ENDING_TODAY, 'PRE_EXPIRY', 'pre:0d', 0, ['accommodation']],
        [NotificationType.TRIAL_WIN_BACK_15D, 'RECOVERY', 'rec:+15d', 15, ['experience']]
    ] as const)('renders %s with a subject, body, and site link', async (template, campaign, milestone, offsetDays, verticals) => {
        const payload = {
            campaign,
            milestone,
            offsetDays,
            targetDate: '2026-10-10',
            recipientName: 'Ana',
            verticals
        };
        const result = await render({ row: row(template, payload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        expect(html.trim()).not.toBe('');
        expect(html).toContain('https://hospeda.test/es/planes/');
    });
    it('keeps rendering a template from the shared registry', async () => {
        const registry = OUTBOX_MAIL_RENDERERS as Record<
            string,
            (typeof OUTBOX_MAIL_RENDERERS)[string]
        >;
        const template = 'test-existing-shared-template';
        const previous = registry[template];
        registry[template] = () => ({
            subject: 'Shared subject',
            react: createElement('p', null, 'Shared body')
        });
        try {
            const result = await buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' })({
                row: row(template, {})
            });
            expect(result.subject).toBe('Shared subject');
            expect(renderToStaticMarkup(result.react)).toContain('Shared body');
        } finally {
            if (previous) registry[template] = previous;
            else delete registry[template];
        }
    });
});

describe('TEST:B3:34 the production outbox sender renders signup notices', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    const subscriptionId = '8b17fa49-59f3-4a13-a0d5-fd42e6bac482';

    const payloadFor = (template: string): Record<string, unknown> => {
        if (template === 'billing.signup-confirmed')
            return {
                subscriptionId,
                vertical: 'accommodation',
                planName: 'Plan premium',
                firstPayment: { amountMinor: 1800000, currency: 'ARS' },
                nextChargeDate: '2026-11-08'
            };
        if (template === 'billing.signup-incomplete')
            return {
                subscriptionId,
                vertical: 'venue',
                paymentMethod: 'CARD',
                windowEndsAt: null,
                closedCourtesyMonths: 2
            };
        if (template === 'billing.arrears-suspension')
            return {
                subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: true,
                oneTimeAddons: [{ name: 'Destacado', remainingDays: 10 }],
                promoLost: true
            };
        if (template === 'billing.scheduled-cancellation')
            return { subscriptionId, serviceEndsAt: '2026-10-12T12:00:00.000Z' };
        return { subscriptionId };
    };

    it.each([
        [
            'billing.signup-confirmed',
            ['Ya cobramos el primer pago', '8 de noviembre de 2026', 'Plan premium']
        ],
        ['billing.before-cancel', ['Mercado Pago', 'cancelación', 'No se hará ningún cobro']],
        [
            'billing.signup-incomplete',
            ['Comer y salir', '2 meses de cortesía', 'volver a suscribirte']
        ],
        [
            'billing.arrears-suspension',
            [
                'volvé a suscribirte con una tarjeta que funcione',
                'Si tenías una promo, al volver la perdés.',
                'Turista VIP',
                'a «Destacado» le quedan 10 días.'
            ]
        ],
        [
            'billing.tourist-vip-inherited-cancel',
            [
                'Tu plan ya te da los beneficios de Turista VIP',
                'No se te va a volver a cobrar',
                'lo ya pagado no se reembolsa',
                'Mercado Pago'
            ]
        ],
        [
            'billing.addon-cancelled',
            [
                'Lo que este addon complementaba ya no está activo',
                'No se te va a volver a cobrar',
                'Mercado Pago'
            ]
        ],
        [
            'billing.first-charge-declined-cancel',
            ['El primer cobro de tu suscripción fue rechazado', 'Mercado Pago']
        ],
        ['billing.revocation-cancel', ['Registramos la revocación que pediste', 'Mercado Pago']],
        [
            'billing.permanent-grant-cancel',
            ['Te otorgamos acceso permanente sin costo en Hospeda', 'Mercado Pago']
        ],
        [
            'billing.permanent-grant-addon-cancel',
            [
                'Te otorgamos acceso permanente sin costo en Hospeda y tu addon queda incluido',
                'Mercado Pago'
            ]
        ],
        [
            'billing.direct-cancellation',
            ['Diste de baja tu suscripción y el servicio terminó hoy', 'Mercado Pago']
        ],
        [
            'billing.succession-predecessor-cancel',
            ['Tu nuevo plan ya está activo', 'parte del cambio que pediste']
        ],
        [
            'billing.closed-subscription-authorization-cancel',
            ['una suscripción tuya que ya no se renueva', 'Mercado Pago']
        ],
        [
            'billing.scheduled-cancellation',
            ['El servicio sigue hasta el 12 de octubre de 2026.', 'Mercado Pago']
        ]
    ] as const)('renders %s through the production sender', async (template, expected) => {
        const result = await render({ row: row(template, payloadFor(template)) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        for (const phrase of expected) expect(html).toContain(phrase);
        expect(html).not.toContain(subscriptionId);
    });

    it('renders scheduled cancellation without a service end date using the existing copy', async () => {
        const result = await render({
            row: row('billing.scheduled-cancellation', { subscriptionId })
        });
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('El servicio sigue hasta el final del período que ya pagaste.');
        expect(html).not.toContain('El servicio sigue hasta el 12 de octubre');
    });
});

describe('TEST:1683:4 AC:1683:2 every before-cancel template renders through the production sender', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    const subscriptionId = '8b17fa49-59f3-4a13-a0d5-fd42e6bac482';
    const arrearsPayload = {
        subscriptionId,
        vertical: 'accommodation',
        paymentMethod: 'CARD',
        touristVipLost: true,
        oneTimeAddons: [{ name: 'Destacado', remainingDays: 10 }],
        promoLost: true
    };
    const payloadOf = (kind: string) =>
        kind === 'ARREARS_SUSPENSION' ? arrearsPayload : { subscriptionId };

    it.each(
        Object.entries(BEFORE_CANCEL_TEMPLATE_BY_KIND)
    )('%s renders %s with a subject (a kind without a renderer turns this red, Coord-283)', async (kind, template) => {
        // Act
        const result = await render({ row: row(template, payloadOf(kind)) });

        // Assert
        expect(result.subject.trim()).not.toBe('');
        expect(renderToStaticMarkup(result.react)).not.toContain(subscriptionId);
    });

    it('only AUTHORIZATION_EXPIRED says the pending authorization expired', async () => {
        // Act
        const saying: string[] = [];
        for (const [kind, template] of Object.entries(BEFORE_CANCEL_TEMPLATE_BY_KIND)) {
            const result = await render({ row: row(template, payloadOf(kind)) });
            if (result.subject === 'Tu autorización pendiente venció') saying.push(kind);
        }

        // Assert
        expect(saying).toStrictEqual(['AUTHORIZATION_EXPIRED']);
    });
});

describe('TEST:1623:4 AC:B13a:17 paid-after-cancellation renders through the production sender', () => {
    it('renders the enqueued notice with the market date and addon consequence', async () => {
        const result = await buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' })({
            row: row('billing.paid-after-cancellation', {
                subscriptionId: 'private-paid-subscription',
                vertical: 'venue',
                serviceEndsAt: '2026-10-20T02:00:00.000Z',
                recurringAddonsCut: true
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('El cobro de tus complementos recurrentes');
        expect(html).toContain('19 de octubre de 2026');
        expect(html).not.toContain('private-paid-subscription');
    });
});

describe('TEST:V8a:6 / TEST:V8a:7 the production outbox sender renders the listing notices (HOS-1492)', () => {
    const listingId = '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';
    const readListingNames = async ({ ids }: { readonly ids: readonly string[] }) =>
        new Map(ids.map((id) => [id, 'Cabañas del Río'] as const));
    const render = buildOutboxSenderRender({
        siteUrl: 'https://hospeda.test',
        readListingNames
    });

    it('registers every template constant that @repo/verticals enqueues', () => {
        expect([
            PRICE_ALERT_CLOSED_TEMPLATE,
            LISTING_PURGED_TEMPLATE,
            LISTING_MODERATED_TEMPLATE,
            LISTING_FIX_REQUESTED_TEMPLATE,
            LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE,
            LISTING_MODERATION_LIFTED_TEMPLATE,
            LISTING_RESTITUTION_TEMPLATE
        ]).toEqual([
            'verticals.price-alert-closed',
            'verticals.listing-purged',
            'verticals.listing-moderated',
            'verticals.listing-fix-requested',
            'verticals.listing-moderation-level-changed',
            'verticals.listing-moderation-lifted',
            'verticals.listing-restitution'
        ]);
    });

    it.each([
        [
            PRICE_ALERT_CLOSED_TEMPLATE,
            { vertical: 'accommodation', alertId: 'alert-1' },
            'se cerró porque esa ficha ya no existe'
        ],
        [
            LISTING_PURGED_TEMPLATE,
            { vertical: 'accommodation', bySupport: true },
            'Se borró tu ficha Cabañas del Río.|a pedido tuyo|no vuelve'
        ],
        [
            LISTING_MODERATED_TEMPLATE,
            { vertical: 'venue', reason: 'Fotos', fixRequestOpen: false },
            'Motivo: Fotos|levante la moderación|destaques recurrentes'
        ],
        [
            LISTING_FIX_REQUESTED_TEMPLATE,
            { vertical: 'experience', reason: 'Horario', fixRequestOpen: true },
            'Motivo: Horario|Tu ficha sigue a la vista|/es/mi-cuenta/comercio/'
        ],
        [
            LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE,
            { vertical: 'accommodation', reason: 'Ok', returnedTo: 'DRAFT', fixRequestOpen: true },
            'Volvió a borrador|El pedido de arreglo sigue abierto'
        ],
        [
            LISTING_MODERATION_LIFTED_TEMPLATE,
            {
                vertical: 'accommodation',
                reason: 'Ok',
                returnedTo: 'PUBLISHED',
                fixRequestOpen: false
            },
            'Volvió a estar publicada'
        ],
        [
            LISTING_MODERATION_LIFTED_TEMPLATE,
            {
                vertical: 'accommodation',
                reason: 'Ok',
                returnedTo: 'UNPUBLISHED_BY_BILLING',
                quotaFull: true,
                fixRequestOpen: false
            },
            'Quedó aprobada, pero tu cupo está lleno|despublicá otra ficha y publicá esta'
        ],
        [
            LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE,
            {
                vertical: 'accommodation',
                reason: 'Ok',
                returnedTo: 'UNPUBLISHED_BY_BILLING',
                quotaFull: true,
                fixRequestOpen: true
            },
            'Sigue sin publicar porque tu cupo está lleno|despublicá otra ficha y publicá esta'
        ],
        [
            LISTING_MODERATION_LIFTED_TEMPLATE,
            {
                vertical: 'accommodation',
                reason: 'Ok',
                returnedTo: 'UNPUBLISHED_BY_BILLING',
                fixRequestOpen: false
            },
            'porque hoy tu suscripción no tiene lugar para ella'
        ],
        [
            LISTING_RESTITUTION_TEMPLATE,
            {
                vertical: 'accommodation',
                restoredListingIds: [listingId],
                notRestoredListingIds: [],
                criterion: 'LAST_FELL_FIRST_BACK'
            },
            'Volvieron estas fichas: Cabañas del Río.|publicaste más recientemente'
        ]
    ] as const)('renders %s through the production sender', async (template, payload, expected) => {
        const noticePayload =
            template === LISTING_RESTITUTION_TEMPLATE ? payload : { listingId, ...payload };
        const result = await render({ row: row(template, noticePayload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        for (const phrase of expected.split('|')) expect(html).toContain(phrase);
        expect(html).not.toContain(listingId);
    });

    it('never says the listing was approved when the lift left a fix request (HOS-1997)', async () => {
        const result = await render({
            row: row(LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE, {
                vertical: 'accommodation',
                listingId,
                reason: 'Ok',
                returnedTo: 'UNPUBLISHED_BY_BILLING',
                quotaFull: true,
                fixRequestOpen: true
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(html).not.toContain('aprobada');
        expect(html).toContain('El pedido de arreglo sigue abierto');
    });

    it('gives no unpublish advice for a quota-less lift (no quotaFull flag)', async () => {
        const result = await render({
            row: row(LISTING_MODERATION_LIFTED_TEMPLATE, {
                vertical: 'accommodation',
                listingId,
                reason: 'Ok',
                returnedTo: 'UNPUBLISHED_BY_BILLING',
                fixRequestOpen: false
            })
        });
        expect(renderToStaticMarkup(result.react)).not.toContain('despublicá otra ficha');
    });
});

describe('TEST:V6:36 the production outbox sender renders the on-archive notice', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    const listingId = '3f0d3c2e-5a7b-4c1d-9e8f-0a1b2c3d4e5f';

    it('renders verticals.listing-archived through the production sender', async () => {
        const result = await render({
            row: row(LISTING_ARCHIVED_TEMPLATE, {
                vertical: 'venue',
                listingId,
                transition: 'PB4',
                deletionAnnouncedAt: '2027-01-08T02:00:00.000Z',
                listingAddonCount: 1
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        expect(result.subject).toContain('Comer y salir');
        expect(html).toContain('7 de enero de 2027');
        expect(html).not.toContain(listingId);
    });
});

describe('TEST:V9b:10 the production outbox sender renders retention notices', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    const listingId = 'retention-listing-private';

    it.each([
        {
            template: 'verticals.listing-retention-before-archive',
            payload: {
                vertical: 'venue',
                listingId,
                transition: 'PB5',
                archiveAt: '2027-01-12T02:00:00.000Z'
            },
            subject: 'Tu ficha de Comer y salir se va a archivar por inactividad',
            body: '11 de enero de 2027'
        },
        {
            template: 'verticals.listing-retention-before-deletion',
            payload: {
                vertical: 'venue',
                listingId,
                deletionAt: '2027-01-12T02:00:00.000Z'
            },
            subject: 'El contenido de tu ficha de Comer y salir se va a borrar',
            body: '11 de enero de 2027'
        }
    ])('renders $template through the production sender', async ({
        template,
        payload,
        subject,
        body
    }) => {
        const result = await render({ row: row(template, payload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(subject);
        expect(html).toContain(body);
        expect(html).not.toContain(listingId);
    });
});

describe('TEST:B9b:5 AC:B9b:5 the production sender renders promo-ending mail', () => {
    it('(a) resolves billing.promo-ending through its registered renderer', async () => {
        const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
        const result = await render({
            row: row('billing.promo-ending', {
                subscriptionId: 'sub-private',
                redemptionId: 'redemption-private',
                vertical: 'accommodation',
                planName: 'Plan premium',
                lastDiscountedChargeDate: '2026-10-20',
                amountAfterMinor: 80000,
                currency: 'ARS',
                daysBefore: 7,
                deadlinesVersion: 1
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(PROMO_ENDING_SUBJECT);
        expect(html).toContain('20 de octubre de 2026');
        expect(html).toContain('$800,00');
    });
});
