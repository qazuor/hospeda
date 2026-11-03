import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
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
});
