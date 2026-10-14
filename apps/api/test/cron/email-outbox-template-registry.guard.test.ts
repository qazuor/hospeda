/**
 * TEST:1675:2 production sender render coverage. The static enqueue registry guard
 * for run 2 of HOS-1675 will live in this file.
 */
import type { EmailOutboxRow } from '@repo/db';
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

describe('TEST:1675:2 AC:1675:1 the four pending templates render through the production sender', () => {
    const readListingNames = async ({ ids }: { readonly ids: readonly string[] }) =>
        new Map(ids.map((id) => [id, 'Cabañas del Río'] as const));
    const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test', readListingNames });

    it.each([
        [
            'billing.signup-declined',
            {
                subscriptionId: 'private-subscription',
                vertical: 'accommodation',
                declineReason: null
            },
            'No se te cobró nada'
        ],
        [
            'billing.grace-started',
            {
                subscriptionId: 'private-grace-subscription',
                vertical: 'gastronomy',
                graceEndsAt: '2026-10-20T02:00:00.000Z'
            },
            'Tu servicio sigue activo'
        ],
        [
            'billing.payment-credited',
            {
                paymentId: 'private-payment',
                subscriptionId: 'private-payment-subscription',
                amountMinor: 1800000,
                currency: 'ARS',
                receiptId: 'private-receipt',
                receiptNumber: 42
            },
            'comprobante no fiscal'
        ],
        [
            'verticals.listing-content-edited-by-support',
            {
                vertical: 'experience',
                listingId: 'private-listing',
                listingName: 'Kayak al atardecer',
                editedAt: '2026-10-20T12:00:00.000Z',
                parts: ['texts']
            },
            'No se publicó, no se destacó ni se borró por eso'
        ]
    ])('renders %s with a subject, distinctive body and no payload identifiers', async (template, payload, phrase) => {
        const result = await render({ row: row(template, payload) });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject.trim()).not.toBe('');
        expect(html).toContain(phrase);
        for (const value of Object.values(payload)) {
            if (typeof value === 'string' && value.startsWith('private-'))
                expect(html).not.toContain(value);
        }
    });
});
