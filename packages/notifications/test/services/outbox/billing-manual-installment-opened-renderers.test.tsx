import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ManualInstallmentMailCopy } from '../../../src/services/outbox/billing-manual-installment-opened-renderers.js';
import { createBillingManualInstallmentOpenedRenderers } from '../../../src/services/outbox/billing-manual-installment-opened-renderers.js';

const payload = {
    manualPaymentId: 'manual-payment',
    subscriptionId: 'subscription',
    locale: 'en',
    planSlug: 'partner-gold',
    planName: 'Stored Gold',
    amountMinor: 3_000_000,
    currency: 'ARS',
    dueAt: '2026-10-16T02:00:00.000Z',
    firstInstallment: true
};

function row(value: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-test',
        recipientUserId: 'user-test',
        recipientEmail: 'a@example.test',
        template: 'billing.manual-installment-opened',
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

function copy(): ManualInstallmentMailCopy {
    return {
        subject: 'Subject',
        preview: 'Preview',
        heading: 'Heading',
        paragraphs: ['First', 'Second'],
        cta: 'Open'
    };
}

function render(payloadValue: Record<string, unknown>, resolveCopy = vi.fn(copy)) {
    const renderer = createBillingManualInstallmentOpenedRenderers({
        siteUrl: 'https://hospeda.test/',
        resolveCopy
    })['billing.manual-installment-opened'];
    if (!renderer) throw new Error('Renderer missing');
    return { result: renderer({ row: row(payloadValue) }), resolveCopy };
}

describe('HOS-2130 manual installment opened renderer', () => {
    it('rejects a payload without a due date', () => {
        // Arrange
        const { dueAt: _dueAt, ...invalid } = payload;
        // Act
        const act = () => render(invalid);
        // Assert
        expect(act).toThrow(TypeError);
    });

    it('rejects an unknown locale', () => {
        // Arrange
        const invalid = { ...payload, locale: 'fr' };
        // Act
        const act = () => render(invalid);
        // Assert
        expect(act).toThrow(TypeError);
    });

    it('rejects an amount without its currency', () => {
        // Arrange
        const invalid = { ...payload, currency: null };
        // Act
        const act = () => render(invalid);
        // Assert
        expect(act).toThrow(TypeError);
    });

    it('accepts an installment whose amount is unknown', () => {
        // Arrange
        const unknownAmount = { ...payload, amountMinor: null, currency: null };
        // Act
        const { result } = render(unknownAmount);
        // Assert
        expect(renderToStaticMarkup(result.react)).toContain('Heading');
    });

    it('passes the parsed facts to the copy resolver', () => {
        // Arrange
        const resolveCopy = vi.fn(copy);
        // Act
        render(payload, resolveCopy);
        // Assert
        expect(resolveCopy).toHaveBeenCalledWith({
            locale: 'en',
            planSlug: 'partner-gold',
            planName: 'Stored Gold',
            amountMinor: 3_000_000,
            currency: 'ARS',
            dueAt: new Date(payload.dueAt),
            firstInstallment: true
        });
    });

    it("links to the partner account page in the recipient's locale", () => {
        // Arrange
        const { result } = render(payload);
        // Act
        const html = renderToStaticMarkup(result.react);
        // Assert
        expect(html.indexOf('href="https://hospeda.test/en/mi-cuenta/partner/"')).toBeGreaterThan(
            -1
        );
    });

    it('renders the subject, heading and every paragraph', () => {
        // Arrange
        const { result } = render(payload);
        // Act
        const html = renderToStaticMarkup(result.react);
        // Assert
        expect(result.subject).toBe('Subject');
        expect(html).toContain('Heading');
        expect(html).toContain('First');
        expect(html).toContain('Second');
    });
});
