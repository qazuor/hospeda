import { describe, expect, it } from 'vitest';
import { resolvePartnerContactLink } from '@/lib/listing-contact/partner-contact-link';

describe('partner contact links', () => {
    it.each([
        ['workPhone', '+54 (3442) 12-3456', 'tel:+543442123456'],
        ['mobilePhone', '  ++54 (3442) 12+3456 ', 'tel:+543442123456'],
        ['homePhone', '(03442) 12-3456', 'tel:03442123456']
    ])('normalizes %s (%s) to a tel URI', (field, value, href) => {
        const result = resolvePartnerContactLink({ field, value });

        expect(result).toEqual({ href, channel: 'phone' });
    });

    it.each(['workEmail', 'personalEmail'])('turns %s into a mailto URI', (field) => {
        const value = ' contact+info@example.com ';

        const result = resolvePartnerContactLink({ field, value });

        expect(result).toEqual({ href: 'mailto:contact+info@example.com', channel: 'email' });
    });

    it.each([
        ['workPhone', '() --'],
        ['workPhone', '+'],
        ['workEmail', '   '],
        ['preferredPhone', 'workPhone'],
        ['whatsapp', '+543442123456'],
        ['website', 'https://example.com']
    ])('leaves %s (%s) as text', (field, value) => {
        const result = resolvePartnerContactLink({ field, value });

        expect(result).toBeUndefined();
    });
});
