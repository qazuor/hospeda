import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import esAccount from '../../../../packages/i18n/src/locales/es/account.json';
import es from '../../../../packages/i18n/src/locales/es/notifications.json';
import { buildOutboxSenderRender } from '../../src/cron/jobs/email-outbox-sender.job.js';

function row(template: string, payload: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-partner-test',
        recipientUserId: null,
        recipientEmail: 'partner@example.test',
        template,
        channel: 'email',
        payload,
        sendAfter: null,
        status: 'processing',
        dedupKey: 'partner-test',
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

describe('partner application sender renderers', () => {
    it('renders both partner mail templates with an injected secret issuer', async () => {
        const issuePartnerClaimSecret = vi.fn(async () => ({ secret: 'test-secret' }));
        const render = buildOutboxSenderRender({
            siteUrl: 'https://hospeda.test',
            issuePartnerClaimSecret
        });
        const claim = await render({
            row: row('verticals.partner-claim-notice', {
                partnerId: 'partner-1',
                partnerName: 'Casa',
                locale: 'es'
            })
        });
        const rejected = await render({
            row: row('verticals.partner-application-rejected', {
                applicationId: 'application-1',
                reapplyAfter: '2026-12-01T00:00:00.000Z',
                locale: 'es'
            })
        });
        expect(renderToStaticMarkup(claim.react)).toContain('test-secret');
        expect(renderToStaticMarkup(rejected.react)).toContain('noviembre');
        expect(issuePartnerClaimSecret).toHaveBeenCalledTimes(1);
    });

    it('validates a claim payload before the default issuer can access the database', async () => {
        const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
        await expect(render({ row: row('verticals.partner-claim-notice', {}) })).rejects.toThrow(
            TypeError
        );
    });

    it('renders the manual installment opened mail through the production sender', async () => {
        // Arrange
        const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
        // Act
        const result = await render({
            row: row('billing.manual-installment-opened', {
                manualPaymentId: 'manual-payment',
                subscriptionId: 'subscription',
                locale: 'es',
                planSlug: 'partner-gold',
                planName: 'Gold',
                amountMinor: 3_000_000,
                currency: 'ARS',
                dueAt: '2026-10-16T02:00:00.000Z',
                firstInstallment: true
            })
        });
        const html = renderToStaticMarkup(result.react);
        // Assert
        expect(html).toContain('href="https://hospeda.test/es/mi-cuenta/partner/"');
        expect(html).toContain(esAccount.partner.installment.howToPay);
        expect(result.subject).toBe(es.manualInstallmentOpened.subject);
    });
});
