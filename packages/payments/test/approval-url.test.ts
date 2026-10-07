/**
 * TEST:B1:6 (AC:B1:6, INV:D10), unit half: `sanitizeApprovalUrl`, the one way
 * GUARD:G10 lets code outside this package read an approval link. EX-37 measured
 * the provider's link arriving with `activation=true`, which breaks the page;
 * the same link without it works. The static half (the guard and its mutation)
 * is `scripts/__tests__/check-approval-url-sanitized.test.ts`.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    ApprovalUrlRejectedError,
    BROKEN_APPROVAL_PARAMETER,
    FakePaymentProvider,
    sanitizeApprovalUrl
} from '../src/index';

/** The reason a sanitization refuses with, or `undefined` when it accepts. */
function rejectionOf(approvalUrl: string): string | undefined {
    try {
        sanitizeApprovalUrl({ approvalUrl });
        return undefined;
    } catch (error) {
        return error instanceof ApprovalUrlRejectedError ? error.reason : 'OTHER';
    }
}

describe('sanitizeApprovalUrl', () => {
    it('names the parameter EX-37 measured', () => {
        expect(BROKEN_APPROVAL_PARAMETER).toBe('activation');
    });

    it.each([
        [
            'trailing, as measured',
            'https://pay.example/subscriptions/approve?id=2c93808&activation=true',
            'https://pay.example/subscriptions/approve?id=2c93808'
        ],
        [
            'leading',
            'https://pay.example/approve?activation=true&id=abc',
            'https://pay.example/approve?id=abc'
        ],
        [
            'the only one',
            'https://pay.example/approve?activation=true',
            'https://pay.example/approve'
        ],
        [
            'repeated, with any value',
            'https://pay.example/a?activation=1&x=2&activation=false',
            'https://pay.example/a?x=2'
        ],
        [
            'percent-encoded name',
            'https://pay.example/a?%61ctivation=true&x=2',
            'https://pay.example/a?x=2'
        ]
    ])('removes the activation parameter (%s)', (_case, raw, expected) => {
        // Act
        const { url } = sanitizeApprovalUrl({ approvalUrl: raw });

        // Assert
        expect(url).toBe(expected);
        expect(new URL(url).searchParams.has('activation')).toBe(false);
    });

    it('keeps every other pair byte for byte, in order, and the fragment', () => {
        const raw = 'https://pay.example/a?b=x%20y&c=1+2&activation=true&d=%7E#frag';
        expect(sanitizeApprovalUrl({ approvalUrl: raw }).url).toBe(
            'https://pay.example/a?b=x%20y&c=1+2&d=%7E#frag'
        );
    });

    it('keeps a parameter that only starts with the same letters', () => {
        const raw = 'https://pay.example/a?activation_code=7&reactivation=true';
        expect(sanitizeApprovalUrl({ approvalUrl: raw }).url).toBe(raw);
    });

    it('leaves a link without the parameter as it is', () => {
        const raw = 'https://pay.example/approve?id=abc';
        expect(sanitizeApprovalUrl({ approvalUrl: raw }).url).toBe(raw);
    });

    it.each([
        ['an empty string', '', 'NOT_A_URL'],
        ['a relative path', '/approve?id=1', 'NOT_A_URL'],
        ['plain text', 'not a link', 'NOT_A_URL'],
        ['http', 'http://pay.example/approve?id=1', 'NOT_HTTPS'],
        ['a script', 'javascript:alert(1)', 'NOT_HTTPS']
    ])('refuses %s', (_case, raw, reason) => {
        expect(rejectionOf(raw)).toBe(reason);
    });

    it('takes the authorize result itself, so the raw field is never read by the caller', async () => {
        // Arrange
        const fake = new FakePaymentProvider({
            clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') })
        });
        const result = await fake.authorize({
            reference: 'juan',
            amount: { amountMinor: 1_800_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'Plan Anfitrión mensual',
            returnUrl: 'https://hospeda.test/return'
        });

        // Act
        const { url } = sanitizeApprovalUrl(result);

        // Assert
        expect(url).toContain(result.authorizationId);
        expect(new URL(url).protocol).toBe('https:');
    });
});
