import { describe, expect, it } from 'vitest';
import { resolvePartnerLogoLink } from '../../src/lib/partner-logo-link';

const partner = { name: 'Acme', logoPath: '/a.png', aspectRatio: 3.5, slug: 'acme' };

describe('resolvePartnerLogoLink', () => {
    it('keeps the internal page destination dark until V7', () => {
        const link = resolvePartnerLogoLink({ partner, locale: 'es' });

        expect(link.href).toBeUndefined();
        expect(link.destination).not.toBe('OWN_PAGE');
    });

    it('uses only the safe external site when one is available', () => {
        const link = resolvePartnerLogoLink({
            partner: { ...partner, url: 'https://acme.example.com' },
            locale: 'es'
        });

        expect(link.href).toBe('https://acme.example.com');
        expect(link.destination).toBe('EXTERNAL');
        expect(link.rel).toBe('sponsored nofollow noopener');
        expect(link.target).toBe('_blank');
    });

    it('returns no link when the external URL is unsafe', () => {
        const link = resolvePartnerLogoLink({
            partner: { ...partner, url: 'javascript:alert(1)' },
            locale: 'es'
        });

        expect(link.href).toBeUndefined();
        expect(link.destination).toBeUndefined();
    });
});
