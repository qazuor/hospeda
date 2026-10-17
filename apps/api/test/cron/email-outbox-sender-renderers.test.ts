import type { EmailOutboxRow } from '@repo/db';
import { NotificationType, OUTBOX_MAIL_RENDERERS, PROMO_ENDING_SUBJECT } from '@repo/notifications';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';
import { LISTING_ARCHIVED_TEMPLATE } from '@repo/verticals';
import { createElement, type ReactElement } from 'react';
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
        {
            template: NotificationType.TRIAL_ENDING_2D,
            payload: {
                campaign: 'PRE_EXPIRY',
                milestone: 'pre:-2d',
                offsetDays: 2,
                targetDate: '2026-10-10',
                recipientName: 'Ana',
                verticals: ['accommodation', 'gastronomy', 'experience']
            }
        },
        {
            template: NotificationType.TRIAL_ENDING_TODAY,
            payload: {
                campaign: 'PRE_EXPIRY',
                milestone: 'pre:0d',
                offsetDays: 0,
                targetDate: '2026-10-10',
                recipientName: 'Ana',
                verticals: ['accommodation']
            }
        },
        {
            template: NotificationType.TRIAL_WIN_BACK_15D,
            payload: {
                campaign: 'RECOVERY',
                milestone: 'rec:+15d',
                offsetDays: 15,
                targetDate: '2026-10-10',
                recipientName: 'Ana',
                verticals: ['experience']
            }
        }
    ])('renders $template with a subject, body, and site link', async ({ template, payload }) => {
        const result = await render({ row: row(template, payload) });
        const html = renderToStaticMarkup(result.react);

        expect(result.subject.trim()).not.toBe('');
        expect(html.trim()).not.toBe('');
        expect(html).toContain('https://hospeda.test/es/planes/');
    });

    it('keeps rendering a template from the shared registry', async () => {
        const registry = OUTBOX_MAIL_RENDERERS as Record<
            string,
            (input: { readonly row: EmailOutboxRow }) =>
                | Promise<{
                      readonly subject: string;
                      readonly react: ReactElement;
                  }>
                | {
                      readonly subject: string;
                      readonly react: ReactElement;
                  }
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

    it.each([
        {
            template: 'billing.signup-confirmed',
            payload: {
                subscriptionId,
                vertical: 'accommodation',
                planName: 'Plan premium',
                firstChargeDate: '2026-10-08'
            },
            expected: ['Mercado Pago', 'ya pagaste', '8 de octubre de 2026', 'Plan premium']
        },
        {
            template: 'billing.before-cancel',
            payload: { subscriptionId },
            expected: ['Mercado Pago', 'cancelación', 'No se hará ningún cobro']
        },
        {
            template: 'billing.signup-incomplete',
            payload: {
                subscriptionId,
                vertical: 'gastronomy',
                paymentMethod: 'CARD',
                windowEndsAt: null,
                closedCourtesyMonths: 2
            },
            expected: ['Gastronomía', '2 meses de cortesía', 'volver a suscribirte']
        },
        {
            template: 'billing.arrears-suspension',
            payload: {
                subscriptionId,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                touristVipLost: true,
                oneTimeAddons: [{ name: 'Destacado', remainingDays: 10 }],
                promoLost: true
            },
            expected: [
                'volvé a suscribirte con una tarjeta que funcione',
                'Si tenías una promo, al volver la perdés.',
                'Turista VIP',
                'a «Destacado» le quedan 10 días.'
            ]
        },
        {
            // AC:B7:31: the email S2's and S7's clause sends before cancelling an inherited VIP.
            template: 'billing.tourist-vip-inherited-cancel',
            payload: { subscriptionId },
            expected: [
                'Tu plan ya te da los beneficios de Turista VIP',
                'No se te va a volver a cobrar',
                'lo ya pagado no se reembolsa',
                'Mercado Pago'
            ]
        },
        {
            // HOS-1545 AC:B5:27: the email A5 sends before cancelling an orphaned addon's charge.
            template: 'billing.addon-cancelled',
            payload: { subscriptionId },
            expected: [
                'Lo que este addon complementaba ya no está activo',
                'No se te va a volver a cobrar',
                'Mercado Pago'
            ]
        },
        {
            // HOS-1683 AC:1683:2: S16's and S1's notice before cancelling the signup's authorization.
            template: 'billing.first-charge-declined-cancel',
            payload: { subscriptionId },
            expected: ['El primer cobro de tu suscripción fue rechazado', 'Mercado Pago']
        },
        {
            // HOS-1683 AC:1683:2: S36's notice before cancelling a revoked subscription.
            template: 'billing.revocation-cancel',
            payload: { subscriptionId },
            expected: ['Registramos la revocación que pediste', 'Mercado Pago']
        },
        {
            template: 'billing.permanent-grant-cancel',
            payload: { subscriptionId },
            expected: ['Te otorgamos acceso permanente sin costo en Hospeda', 'Mercado Pago']
        },
        {
            template: 'billing.permanent-grant-addon-cancel',
            payload: { subscriptionId },
            expected: [
                'Te otorgamos acceso permanente sin costo en Hospeda y tu addon queda incluido',
                'Mercado Pago'
            ]
        },
        {
            template: 'billing.direct-cancellation',
            payload: { subscriptionId },
            expected: ['Diste de baja tu suscripción y el servicio terminó hoy', 'Mercado Pago']
        },
        {
            // HOS-1683 AC:1683:2: REJECTION_REVIVED's notice before cancelling a live authorization.
            template: 'billing.closed-subscription-authorization-cancel',
            payload: { subscriptionId },
            expected: ['una suscripción tuya que ya no se renueva', 'Mercado Pago']
        },
        {
            // HOS-1683 AC:1683:2: S11's notice before cancelling the automatic charge.
            template: 'billing.scheduled-cancellation',
            payload: { subscriptionId },
            expected: [
                'El servicio sigue hasta el final del período que ya pagaste',
                'Mercado Pago'
            ]
        }
    ])('renders $template through the production sender', async ({
        template,
        payload,
        expected
    }) => {
        const result = await render({ row: row(template, payload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        for (const phrase of expected) expect(html).toContain(phrase);
        expect(html).not.toContain(subscriptionId);
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
        {
            template: PRICE_ALERT_CLOSED_TEMPLATE,
            payload: { vertical: 'accommodation', listingId, alertId: 'alert-1' },
            expected: ['se cerró porque esa ficha ya no existe']
        },
        {
            template: LISTING_PURGED_TEMPLATE,
            payload: { vertical: 'accommodation', listingId, bySupport: true },
            expected: ['Se borró tu ficha Cabañas del Río.', 'a pedido tuyo', 'no vuelve']
        },
        {
            template: LISTING_MODERATED_TEMPLATE,
            payload: { vertical: 'gastronomy', listingId, reason: 'Fotos', fixRequestOpen: false },
            expected: ['Motivo: Fotos', 'levante la moderación', 'destaques recurrentes']
        },
        {
            template: LISTING_FIX_REQUESTED_TEMPLATE,
            payload: { vertical: 'experience', listingId, reason: 'Horario', fixRequestOpen: true },
            expected: ['Motivo: Horario', 'Tu ficha sigue a la vista', '/es/mi-cuenta/comercio/']
        },
        {
            template: LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE,
            payload: {
                vertical: 'accommodation',
                listingId,
                reason: 'Ok',
                returnedTo: 'DRAFT',
                fixRequestOpen: true
            },
            expected: ['Volvió a borrador', 'El pedido de arreglo sigue abierto']
        },
        {
            template: LISTING_MODERATION_LIFTED_TEMPLATE,
            payload: {
                vertical: 'accommodation',
                listingId,
                reason: 'Ok',
                returnedTo: 'PUBLISHED',
                fixRequestOpen: false
            },
            expected: ['Volvió a estar publicada']
        },
        {
            template: LISTING_RESTITUTION_TEMPLATE,
            payload: {
                vertical: 'accommodation',
                restoredListingIds: [listingId],
                notRestoredListingIds: [],
                criterion: 'LAST_FELL_FIRST_BACK'
            },
            expected: ['Volvieron estas fichas: Cabañas del Río.', 'cayó al final']
        }
    ])('renders $template through the production sender', async ({
        template,
        payload,
        expected
    }) => {
        const result = await render({ row: row(template, payload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        for (const phrase of expected) expect(html).toContain(phrase);
        expect(html).not.toContain(listingId);
    });
});

describe('TEST:V6:36 the production outbox sender renders the on-archive notice', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    const listingId = '3f0d3c2e-5a7b-4c1d-9e8f-0a1b2c3d4e5f';

    it('renders verticals.listing-archived through the production sender', async () => {
        const result = await render({
            row: row(LISTING_ARCHIVED_TEMPLATE, {
                vertical: 'gastronomy',
                listingId,
                transition: 'PB4',
                deletionAnnouncedAt: '2027-01-08T02:00:00.000Z',
                listingAddonCount: 1
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        expect(result.subject).toContain('gastronomía');
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
                vertical: 'gastronomy',
                listingId,
                transition: 'PB5',
                archiveAt: '2027-01-12T02:00:00.000Z'
            },
            subject: 'Tu ficha de gastronomía se va a archivar por inactividad',
            body: '11 de enero de 2027'
        },
        {
            template: 'verticals.listing-retention-before-deletion',
            payload: {
                vertical: 'gastronomy',
                listingId,
                deletionAt: '2027-01-12T02:00:00.000Z'
            },
            subject: 'El contenido de tu ficha de gastronomía se va a borrar',
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
