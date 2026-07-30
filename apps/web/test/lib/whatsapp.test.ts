/**
 * @file whatsapp.test.ts
 * @description Behaviour tests for the single wa.me link builder (HOS-289).
 *
 * These assert the produced URL, not the sanitizing expression that produces it
 * — the tests they replace asserted `src.toContain("startsWith('+')")`, which
 * pinned the defect as if it were a feature.
 */

import { InternationalPhoneRegex } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildWhatsAppLink, E164_MAX_DIGITS, E164_MIN_DIGITS } from '@/lib/whatsapp';

describe('buildWhatsAppLink', () => {
    describe('phone normalisation', () => {
        it('drops the leading + that stops wa.me resolving the recipient (HOS-289)', () => {
            const { url } = buildWhatsAppLink({ phone: '+543442453797' });

            expect(url).toBe('https://wa.me/543442453797');
        });

        it('drops separators, spaces and parentheses', () => {
            const { url } = buildWhatsAppLink({ phone: '+54 (9) 3442-45 3797' });

            expect(url).toBe('https://wa.me/5493442453797');
        });

        it('never emits a + in the phone segment, whatever the input shape', () => {
            const inputs = ['+543442453797', '00543442453797', '54+3442453797', '+ 54 3442453797'];

            for (const phone of inputs) {
                const { url } = buildWhatsAppLink({ phone });
                expect(url).not.toContain('+');
                expect(url).not.toContain('%2B');
            }
        });

        it('applies no country-code heuristic', () => {
            // Deliberate product decision (HOS-289): unlike the admin panel's
            // WhatsAppLinkCell, web never prepends the Argentinian `549`.
            const { url } = buildWhatsAppLink({ phone: '3442453797' });

            expect(url).toBe('https://wa.me/3442453797');
        });
    });

    describe('unusable input', () => {
        it.each([
            '',
            '   ',
            '+',
            '-- ()',
            'sin numero'
        ])('returns null instead of a dead link for %j', (phone) => {
            expect(buildWhatsAppLink({ phone }).url).toBeNull();
        });
    });

    describe('E.164 length sanity (HOS-289 follow-up)', () => {
        // A LENGTH check only: no digit is ever added, removed or reordered, so
        // the "strip the + and nothing else" decision is untouched.
        it('accepts the shortest plausible E.164 number (7 digits)', () => {
            expect(buildWhatsAppLink({ phone: '1234567' }).url).toBe('https://wa.me/1234567');
        });

        it('rejects one digit below the lower bound (6 digits)', () => {
            expect(buildWhatsAppLink({ phone: '123456' }).url).toBeNull();
        });

        it('accepts the longest E.164 number (15 digits)', () => {
            expect(buildWhatsAppLink({ phone: '123456789012345' }).url).toBe(
                'https://wa.me/123456789012345'
            );
        });

        it('rejects one digit above the upper bound (16 digits)', () => {
            expect(buildWhatsAppLink({ phone: '1234567890123456' }).url).toBeNull();
        });

        it('stays in sync with the write regex it mirrors', () => {
            // The bounds are local literals so `@repo/schemas` never reaches the
            // browser bundle. This is what stops them silently desyncing: derive
            // the accepted digit range of InternationalPhoneRegex empirically and
            // pin the module's constants to it. Widening the write regex without
            // widening the render-time gate turns THIS red.
            const accepted: number[] = [];
            for (let digits = 1; digits <= 25; digits += 1) {
                if (InternationalPhoneRegex.test(`+${'1'.repeat(digits)}`)) accepted.push(digits);
            }

            expect(Math.min(...accepted)).toBe(E164_MIN_DIGITS);
            expect(Math.max(...accepted)).toBe(E164_MAX_DIGITS);
        });
    });

    describe('non-phone shape (HOS-289 follow-up)', () => {
        // A digit-count bound alone is PROBABILISTIC protection against a pasted
        // URL: it only rejects the ones whose digits happen to fall outside
        // 7..15. Letters, `/` and `:` are structural evidence instead.
        it('rejects a wa.me short link whose code is UNLUCKILY in range', () => {
            // 8 digits after stripping — inside 7..15, so the length check passes
            // it. Without the shape gate this mints a live chat with whoever owns
            // +1 234 5678: a SILENT failure, not a dead link.
            const { url } = buildWhatsAppLink({ phone: 'https://wa.me/message/AB12345678' });

            expect(url).toBeNull();
        });

        it('rejects a wa.me short link whose code happens to be out of range', () => {
            // The shape operators actually type, observed under
            // `socialNetworks.whatsapp` in seed data
            // (accommodation/uruguay/103-*) — a field no call site feeds to this
            // builder, so it illustrates the shape rather than a reachable input.
            const { url } = buildWhatsAppLink({ phone: 'https://wa.me/message/CWFRH6N5FURTC1' });

            expect(url).toBeNull();
        });

        it.each([
            'wa.me/5493442453797',
            'tel:+543442453797',
            'whatsapp: 543442453797'
        ])('rejects %j', (phone) => {
            expect(buildWhatsAppLink({ phone }).url).toBeNull();
        });

        it('still accepts every human phone format the app stores', () => {
            for (const phone of ['+54 9 3442 45-3797', '3442453797', '+54 (9) 3442-45 3797']) {
                expect(buildWhatsAppLink({ phone }).url).not.toBeNull();
            }
        });
    });

    describe('prefilled message', () => {
        it('encodes the message as the text query parameter', () => {
            const { url } = buildWhatsAppLink({
                phone: '+543442453797',
                message: 'Hola, me interesa Cabaña & Río'
            });

            expect(url).toBe(
                'https://wa.me/543442453797?text=Hola%2C%20me%20interesa%20Caba%C3%B1a%20%26%20R%C3%ADo'
            );
        });

        it('omits the query string entirely when there is no message', () => {
            const { url } = buildWhatsAppLink({ phone: '543442453797' });

            expect(url).toBe('https://wa.me/543442453797');
        });

        it('omits the query string when the message is blank', () => {
            const { url } = buildWhatsAppLink({ phone: '543442453797', message: '   ' });

            expect(url).toBe('https://wa.me/543442453797');
        });
    });
});
