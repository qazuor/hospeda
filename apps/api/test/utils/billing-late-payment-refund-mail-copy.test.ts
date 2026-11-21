import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import enBilling from '../../../../packages/i18n/src/locales/en/billing.json';
import enNotifications from '../../../../packages/i18n/src/locales/en/notifications.json';
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json';
import esNotifications from '../../../../packages/i18n/src/locales/es/notifications.json';
import ptBilling from '../../../../packages/i18n/src/locales/pt/billing.json';
import ptNotifications from '../../../../packages/i18n/src/locales/pt/notifications.json';
import { buildOutboxSenderRender } from '../../src/cron/jobs/email-outbox-sender.job.js';
import { resolveLatePaymentRefundMailCopy } from '../../src/utils/billing-late-payment-refund-mail-copy.js';

const locales = {
    es: { notifications: esNotifications, billing: esBilling },
    en: { notifications: enNotifications, billing: enBilling },
    pt: { notifications: ptNotifications, billing: ptBilling }
} as const;

const base = {
    locale: 'es' as const,
    addonSlug: 'visibility-boost-7d',
    addonName: 'Stored name',
    amountMinor: 1_500_000,
    currency: 'ARS'
};

function row(payload: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-late-refund',
        recipientUserId: 'user-1',
        recipientEmail: 'owner@example.test',
        template: 'billing.late-payment-refunded',
        channel: 'email',
        payload,
        sendAfter: null,
        status: 'processing',
        dedupKey: 'late-refund',
        lockedBy: 'test',
        lockedUntil: new Date('2026-11-20T12:05:00.000Z'),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: new Date('2026-11-20T12:00:00.000Z'),
        updatedAt: new Date('2026-11-20T12:00:00.000Z')
    };
}

const normalize = (value: string | undefined) => value?.replace(/ | /g, ' ');

describe('HOS-2179 D3 late payment refunded mail copy', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('renders the %s mail through the production sender with the product and the amount', async (locale) => {
        // Arrange
        const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
        const copy = locales[locale];
        const product = copy.billing.addon['visibility-boost-7d'].name;

        // Act
        const result = await render({
            row: row({
                refundId: 'refund-1',
                paymentId: 'payment-1',
                addonInstanceId: 'instance-1',
                ...base,
                locale
            })
        });
        const html = renderToStaticMarkup(result.react);

        // Assert
        expect(result.subject).toBe(copy.notifications.latePaymentRefunded.subject);
        expect(html).toContain(copy.notifications.latePaymentRefunded.heading);
        expect(html).toContain(
            copy.notifications.latePaymentRefunded.intro
                .replace('{{product}}', product)
                .replaceAll('&', '&amp;')
        );
        expect(html).toContain(copy.notifications.latePaymentRefunded.timing);
        expect(html).toContain(copy.notifications.latePaymentRefunded.closing);
        expect(html).not.toContain('{{');
    });

    it.each([
        ['es', 'Te devolvimos $ 15.000.'],
        ['en', 'We refunded ARS 15,000.'],
        ['pt', 'Devolvemos ARS 15.000.']
    ] as const)('formats the exact amount in %s', (locale, expected) => {
        // Arrange
        // Act
        const copy = resolveLatePaymentRefundMailCopy({ ...base, locale });
        // Assert
        expect(normalize(copy.paragraphs[1])).toBe(expected);
    });

    it('keeps the cents and the currency of the payment', () => {
        // Arrange
        // Act
        const cents = resolveLatePaymentRefundMailCopy({ ...base, amountMinor: 1_500_050 });
        const usd = resolveLatePaymentRefundMailCopy({ ...base, locale: 'en', currency: 'USD' });
        // Assert
        expect(normalize(cents.paragraphs[1])).toBe('Te devolvimos $ 15.000,50.');
        expect(normalize(usd.paragraphs[1])).toBe('We refunded $15,000.');
    });

    it('names the add-on from the catalog copy and falls back to the stored name', () => {
        // Arrange
        // Act
        const catalog = resolveLatePaymentRefundMailCopy(base);
        const fallback = resolveLatePaymentRefundMailCopy({ ...base, addonSlug: 'not-an-addon' });
        // Assert
        expect(catalog.paragraphs[0]).toContain(esBilling.addon['visibility-boost-7d'].name);
        expect(fallback.paragraphs[0]).toContain('Stored name');
    });
});
