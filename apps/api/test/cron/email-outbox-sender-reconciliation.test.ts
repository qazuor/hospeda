import type { EmailOutboxRow } from '@repo/db';
import {
    DUPLICATE_CHARGE_DETECTED_SUBJECT,
    MARK_ESCALATED_SUBJECT,
    RECONCILIATION_SUMMARY_SUBJECT,
    REVOCATION_REFUND_FAILED_SUBJECT
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
            ],
            [
                'billing.revocation-refund-failed',
                {
                    refundId: 'refund-visible',
                    refundReason: 'REVOCATION',
                    sourceKind: 'payment',
                    sourceId: 'private-payment-id',
                    subjectType: null,
                    subjectId: null,
                    amountMinor: 250000,
                    currency: 'ARS',
                    failedAt: '2026-10-01T00:00:00.000Z'
                },
                REVOCATION_REFUND_FAILED_SUBJECT,
                ['refund-visible', '$2.500,00'],
                ['private-payment-id']
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
        await expect(
            render({
                row: row('billing.revocation-refund-failed', {
                    refundId: 'refund-1',
                    refundReason: 'MARK_PROPOSAL',
                    sourceKind: 'payment',
                    sourceId: 'payment-1',
                    subjectType: null,
                    subjectId: null,
                    amountMinor: 250000,
                    currency: 'ARS',
                    failedAt: '2026-10-01T00:00:00.000Z'
                })
            })
        ).rejects.toThrow(TypeError);
    });
});

describe('HOS-1971 reconciliation summary wiring in the production sender', () => {
    const payload = {
        windowId: 'w',
        coversFrom: '2026-10-01T00:00:00.000Z',
        closesAt: '2026-10-02T00:00:00.000Z',
        windowMinutes: 60,
        totals: { events: 1 },
        marks: [
            { reason: 'COBRO_DUPLICADO', subjectType: 'subscription', subjectId: 'sub-1', count: 1 }
        ],
        escalations: [],
        underCharges: [],
        pauseGifts: [],
        omitted: { marks: 0, escalations: 0, underCharges: 0, pauseGifts: 0 }
    };

    it('marks the environment in the header and links to the admin panel', async () => {
        const render = buildOutboxSenderRender({
            siteUrl: 'https://hospeda.test',
            adminUrl: 'https://admin.hospeda.test',
            environmentLabel: 'STAGING',
            readReconciliationSubjects: async () => ({
                subscriptions: new Map(),
                addonInstances: new Map(),
                openMarks: new Map()
            })
        });
        const result = await render({ row: row('billing.reconciliation-summary', payload) });
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('[STAGING] Resumen de conciliación de billing');
        expect(html).toContain('https://admin.hospeda.test/billing/reconciliation/');
    });

    it('sends the bare line when the subject lookup throws', async () => {
        const render = buildOutboxSenderRender({
            siteUrl: 'https://hospeda.test',
            readReconciliationSubjects: async () => {
                throw new Error('db down');
            }
        });
        const result = await render({ row: row('billing.reconciliation-summary', payload) });
        expect(renderToStaticMarkup(result.react)).toContain(
            'COBRO_DUPLICADO · subscription sub-1 · 1 vez'
        );
    });
});
