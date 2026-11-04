import { describe, expect, it } from 'vitest';
import { resolvePartnerLogoLink } from '../../src/lib/partner-logo-link';

const partner = { name: 'Acme', logoPath: '/a.png', aspectRatio: 3.5, slug: 'acme' };

describe('resolvePartnerLogoLink', () => {
    it('links a partner with a page and slug internally without outbound attributes', () => {
        const link = resolvePartnerLogoLink({
            partner: { ...partner, hasPublicPage: true },
            locale: 'es'
        });

        expect(link).toEqual({ href: '/es/partners/acme/', destination: 'OWN_PAGE' });
    });

    it('uses the safe external site when the partner has no page', () => {
        const link = resolvePartnerLogoLink({
            partner: { ...partner, url: 'https://acme.example.com', hasPublicPage: false },
            locale: 'es'
        });

        expect(link.href).toBe('https://acme.example.com');
        expect(link.destination).toBe('EXTERNAL');
        expect(link.rel).toBe('sponsored nofollow noopener');
        expect(link.target).toBe('_blank');
    });

    it('fails closed when a page entitlement has no slug', () => {
        const link = resolvePartnerLogoLink({
            partner: { ...partner, slug: undefined, hasPublicPage: true },
            locale: 'es'
        });

        expect(link.href).toBeUndefined();
        expect(link.destination).toBeUndefined();
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
