/**
 * @file resolve-provider-contact.test.ts
 * @description The channel and link a provider's free-text `contact` resolves to (HOS-2472).
 */

import { describe, expect, it } from 'vitest';
import { resolveProviderContact } from '../../../../src/components/host/host-trades/resolve-provider-contact';

describe('resolveProviderContact', () => {
    it('resolves an e-mail address to a mailto link', () => {
        const result = resolveProviderContact({ contact: ' plomero@example.com ' });
        expect(result).toEqual({
            channel: 'email',
            href: 'mailto:plomero@example.com',
            display: 'plomero@example.com'
        });
    });

    it('keeps an existing mailto link and strips the scheme from the display value', () => {
        const result = resolveProviderContact({ contact: 'mailto:a@b.com' });
        expect(result.channel).toBe('email');
        expect(result.href).toBe('mailto:a@b.com');
        expect(result.display).toBe('a@b.com');
    });

    it('resolves a phone number to a tel link without spaces or dashes', () => {
        const result = resolveProviderContact({ contact: '+54 3442 56-7890' });
        expect(result.channel).toBe('phone');
        expect(result.href).toBe('tel:+543442567890');
    });

    it('resolves a bare wa.me value to an https WhatsApp link', () => {
        const result = resolveProviderContact({ contact: 'wa.me/5493442567890' });
        expect(result).toMatchObject({
            channel: 'whatsapp',
            href: 'https://wa.me/5493442567890',
            display: '+54 9 3442 567890'
        });
    });

    it('formats query-string recipients but keeps invitation URLs intact', () => {
        expect(resolveProviderContact({ contact: 'wa.me/5491155555555' }).display).toBe(
            '+54 9 11 5555-5555'
        );
        expect(
            resolveProviderContact({ contact: 'https://api.whatsapp.com/send?phone=5493442567890' })
                .display
        ).toBe('+54 9 3442 567890');
        expect(
            resolveProviderContact({ contact: 'https://chat.whatsapp.com/InviteCode' }).display
        ).toBe('https://chat.whatsapp.com/InviteCode');
    });

    it('resolves any other https link to the web channel', () => {
        const result = resolveProviderContact({ contact: 'https://example.com/contacto' });
        expect(result).toMatchObject({ channel: 'web', href: 'https://example.com/contacto' });
    });
});
