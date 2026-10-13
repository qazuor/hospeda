import type { EmailOutboxRow } from '@repo/db';
import { NotificationType, OUTBOX_MAIL_RENDERERS } from '@repo/notifications';
import { LISTING_ARCHIVED_TEMPLATE } from '@repo/verticals';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
