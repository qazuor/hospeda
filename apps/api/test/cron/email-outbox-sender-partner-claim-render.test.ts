import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../packages/i18n/src/locales/en/notifications.json';
import es from '../../../../packages/i18n/src/locales/es/notifications.json';
import pt from '../../../../packages/i18n/src/locales/pt/notifications.json';
import { buildOutboxSenderRender } from '../../src/cron/jobs/email-outbox-sender.job.js';

const locales = { es, en, pt } as const;
const secret = 's3cr3t/+=x';
const partnerName = 'Hostería & Cía';

function row(locale: keyof typeof locales): EmailOutboxRow {
    return {
        id: 'outbox-partner-claim-render-test',
        recipientUserId: null,
        recipientEmail: 'partner@example.test',
        template: 'verticals.partner-claim-notice',
        channel: 'email',
        payload: { partnerId: 'partner-1', partnerName, locale },
        sendAfter: null,
        status: 'processing',
        dedupKey: 'partner-claim-render-test',
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

function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll("'", '&#x27;');
}

async function renderClaimNotice(locale: keyof typeof locales) {
    const issuePartnerClaimSecret = vi.fn(async () => ({ secret }));
    const render = buildOutboxSenderRender({
        siteUrl: 'https://hospeda.test',
        issuePartnerClaimSecret
    });
    const result = await render({ row: row(locale) });
    return {
        html: renderToStaticMarkup(result.react),
        result,
        issuePartnerClaimSecret,
        source: locales[locale].partnerApplication.claimNotice
    };
}

describe('HOS-2040 TEST:V7:11 the claim notice renders its link, the Partner name and its language', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('renders the %s claim link with the locale prefix and the encoded secret', async (locale) => {
        // Arrange
        const { html } = await renderClaimNotice(locale);

        // Act
        const expectedLink = `https://hospeda.test/${locale}/partners/reclamar/#partner=partner-1&amp;secret=${encodeURIComponent(secret)}`;

        // Assert
        expect(html.includes(expectedLink)).toBe(true);
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('renders the Partner name inside the %s heading and preview', async (locale) => {
        // Arrange
        const { html, source } = await renderClaimNotice(locale);

        // Act
        const expectedHeading = escapeHtml(source.heading.replace('{{partnerName}}', partnerName));
        const expectedPreview = escapeHtml(source.preview.replace('{{partnerName}}', partnerName));

        // Assert
        expect(html).toContain(expectedHeading);
        expect(html).toContain(expectedPreview);
        expect(html.includes('{{partnerName}}')).toBe(false);
    });

    it.each(['es', 'en', 'pt'] as const)('uses only the %s copy', async (locale) => {
        // Arrange
        const { html, result, source } = await renderClaimNotice(locale);
        const otherLocales = (['es', 'en', 'pt'] as const).filter((other) => other !== locale);

        // Act
        const otherBodies = otherLocales.map((other) =>
            escapeHtml(locales[other].partnerApplication.claimNotice.body)
        );

        // Assert
        expect(result.subject).toBe(source.subject);
        expect(html.includes(escapeHtml(source.body))).toBe(true);
        expect(html.includes(escapeHtml(source.cta))).toBe(true);
        expect(otherBodies.map((body) => html.includes(body))).toEqual([false, false]);
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('asks the issuer for that Partner once', async (locale) => {
        // Arrange
        const { issuePartnerClaimSecret } = await renderClaimNotice(locale);

        // Act
        const callCount = issuePartnerClaimSecret.mock.calls.length;

        // Assert
        expect(issuePartnerClaimSecret).toHaveBeenCalledExactlyOnceWith({ partnerId: 'partner-1' });
        expect(callCount).toBe(1);
    });
});
