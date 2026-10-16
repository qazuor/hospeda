import type { EmailOutboxRow } from '@repo/db';
import {
    DUPLICATE_CHARGE_DETECTED_SUBJECT,
    MARK_ESCALATED_SUBJECT,
    RECONCILIATION_SUMMARY_SUBJECT
} from '@repo/notifications';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildOutboxSenderRender } from '../../src/cron/jobs/email-outbox-sender.job.js';

function row(template: string, payload: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-test',
        recipientUserId: 'user-test',
        recipientEmail: 'staff@example.test',
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

describe('TEST:1607:10 reconciliation renderers are registered in the production sender', () => {
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
    const summary = {
        windowId: 'private-window-id',
        coversFrom: '2026-10-01T00:00:00.000Z',
        closesAt: '2026-10-02T00:00:00.000Z',
        windowMinutes: 60,
        totals: { events: 100 },
        marks: [
            {
                reason: 'RECONCILIATION_REQUIRED',
                subjectType: 'subscription',
                subjectId: 'visible-subscription',
                count: 100
            }
        ],
        escalations: [],
        underCharges: [],
        pauseGifts: [],
        omitted: { marks: 0, escalations: 0, underCharges: 0, pauseGifts: 0 }
    };

    it('renders each registered template with the exported subject and excludes hidden payload fields', async () => {
        const cases = [
            [
                'billing.reconciliation-summary',
                summary,
                RECONCILIATION_SUMMARY_SUBJECT,
                ['100 veces', 'visible-subscription'],
                ['private-window-id']
            ],
            [
                'billing.duplicate-charge-detected',
                {
                    markId: 'mark-1',
                    subjectType: 'subscription',
                    subjectId: 'visible-subscription',
                    reason: 'COBRO_DUPLICADO',
                    openedAt: '2026-10-01T00:00:00.000Z',
                    paymentId: null,
                    privateToken: 'private-token'
                },
                DUPLICATE_CHARGE_DETECTED_SUBJECT,
                ['mark-1', 'visible-subscription'],
                ['private-token']
            ],
            [
                'billing.mark-escalated',
                {
                    markId: 'mark-2',
                    subjectType: 'addon_instance',
                    subjectId: 'visible-addon',
                    reason: 'RECONCILIATION_REQUIRED',
                    placedAt: '2026-09-01T00:00:00.000Z',
                    escalatedAt: '2026-09-08T00:00:00.000Z',
                    escalationDays: 7,
                    privateToken: 'private-token'
                },
                MARK_ESCALATED_SUBJECT,
                ['mark-2', 'visible-addon'],
                ['private-token']
            ]
        ] as const;
        for (const [template, payload, subject, includes, excludes] of cases) {
            const result = await render({ row: row(template, payload) });
            const html = renderToStaticMarkup(result.react);
            expect(result.subject).toBe(subject);
            for (const text of includes) expect(html).toContain(text);
            for (const text of excludes) expect(html).not.toContain(text);
        }
    });

    it('routes an invalid payload to the registered renderer, which rejects it with TypeError', async () => {
        await expect(render({ row: row('billing.mark-escalated', {}) })).rejects.toThrow(TypeError);
    });
});
