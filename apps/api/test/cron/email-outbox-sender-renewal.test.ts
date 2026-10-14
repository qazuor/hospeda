import type { EmailOutboxRow } from '@repo/db';
import { RENEWAL_UPCOMING_SUBJECT } from '@repo/notifications';
import { RENEWAL_UPCOMING_TEMPLATE } from '@repo/service-core';
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

describe('HOS-1622 TEST:B13a:13 AC:B13a:13 the renewal notice renders through the production sender', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    const payload = {
        subscriptionId: 'private-subscription-id',
        vertical: 'accommodation',
        planName: 'Plan premium',
        renewalDate: '2026-10-20',
        daysBefore: 5,
        deadlinesVersion: 1
    };

    it('renders the service-core template with the expected subject and date', async () => {
        const result = await render({ row: row(RENEWAL_UPCOMING_TEMPLATE, payload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(RENEWAL_UPCOMING_SUBJECT);
        expect(html).toContain('20 de octubre de 2026');
        expect(html).not.toContain(payload.subscriptionId);
    });

    it('has a renderer for the exact template enqueued by service-core', async () => {
        await expect(
            render({ row: row(RENEWAL_UPCOMING_TEMPLATE, payload) })
        ).resolves.toMatchObject({ subject: RENEWAL_UPCOMING_SUBJECT });
    });
});
