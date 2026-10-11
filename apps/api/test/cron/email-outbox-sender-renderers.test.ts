import type { EmailOutboxRow } from '@repo/db';
import { NotificationType, OUTBOX_MAIL_RENDERERS } from '@repo/notifications';
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
