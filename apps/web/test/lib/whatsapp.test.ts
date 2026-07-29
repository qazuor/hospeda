/**
 * @file whatsapp.test.ts
 * @description Behaviour tests for the single wa.me link builder (HOS-289).
 *
 * These assert the produced URL, not the sanitizing expression that produces it
 * — the tests they replace asserted `src.toContain("startsWith('+')")`, which
 * pinned the defect as if it were a feature.
 */

import { describe, expect, it } from 'vitest';
import { buildWhatsAppLink } from '@/lib/whatsapp';

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
