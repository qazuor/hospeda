import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LatePaymentRefundMailCopy } from '../../../src/services/outbox/billing-late-payment-refund-renderers.js';
import { createBillingLatePaymentRefundRenderers } from '../../../src/services/outbox/billing-late-payment-refund-renderers.js';

const payload = {
    refundId: 'refund-1',
    paymentId: 'payment-1',
    addonInstanceId: 'instance-1',
    locale: 'pt',
    addonSlug: 'visibility-boost-7d',
    addonName: 'Stored boost',
    amountMinor: 10000,
    currency: 'ARS'
};

function row(value: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-test',
        recipientUserId: 'user-test',
        recipientEmail: 'a@example.test',
        template: 'billing.late-payment-refunded',
        channel: 'email',
        payload: value,
        sendAfter: null,
        status: 'processing',
        dedupKey: 'dedup',
        lockedBy: 'test',
        lockedUntil: new Date(),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

function copy(): LatePaymentRefundMailCopy {
    return {
        subject: 'Subject',
        preview: 'Preview',
        heading: 'Heading',
        paragraphs: ['First paragraph', 'Second paragraph']
    };
}

function render(value: Record<string, unknown>, resolveCopy = vi.fn(copy)) {
    const renderer = createBillingLatePaymentRefundRenderers({ resolveCopy })[
        'billing.late-payment-refunded'
    ];
    if (!renderer) throw new Error('Renderer missing');
    return { result: renderer({ row: row(value) }), resolveCopy };
}

describe('HOS-2179 D3 late payment refunded renderer', () => {
    it('hands only the copy facts to the resolver and renders its copy', () => {
        // Arrange
        // Act
        const { result, resolveCopy } = render(payload);
        // Assert
        expect(resolveCopy).toHaveBeenCalledWith({
            locale: 'pt',
            addonSlug: 'visibility-boost-7d',
            addonName: 'Stored boost',
            amountMinor: 10000,
            currency: 'ARS'
        });
        if (result instanceof Promise) throw new Error('Expected a synchronous render');
        expect(result.subject).toBe('Subject');
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('Heading');
        expect(html).toContain('First paragraph');
        expect(html).toContain('Second paragraph');
    });

    it.each([
        ['an unknown locale', { ...payload, locale: 'fr' }],
        ['a zero amount', { ...payload, amountMinor: 0 }],
        ['a fractional amount', { ...payload, amountMinor: 10.5 }],
        ['a lower-case currency', { ...payload, currency: 'ars' }],
        ['a missing add-on slug', { ...payload, addonSlug: '' }],
        ['an unexpected field', { ...payload, payerEmail: 'payer@example.test' }]
    ])('rejects %s', (_label, invalid) => {
        // Arrange
        // Act
        const act = () => render(invalid);
        // Assert
        expect(act).toThrow(TypeError);
    });
});
