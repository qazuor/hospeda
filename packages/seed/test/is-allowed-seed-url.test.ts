import { describe, expect, it } from 'vitest';
import { ALLOWED_SEED_HOSTNAMES, isAllowedSeedUrl } from '../src/utils/is-allowed-seed-url.js';

/**
 * GAP-078-030 regression tests for the SSRF allowlist helper used by the
 * seed image upload pipeline.
 */
describe('GAP-078-030: isAllowedSeedUrl', () => {
    it('exports a frozen allowlist with the three expected hosts', () => {
        expect(ALLOWED_SEED_HOSTNAMES).toEqual([
            'images.unsplash.com',
            'images.pexels.com',
            'res.cloudinary.com'
        ]);
        // Frozen means any mutation attempt is a no-op in sloppy mode and
        // throws in strict mode; Object.isFrozen covers both reliably.
        expect(Object.isFrozen(ALLOWED_SEED_HOSTNAMES)).toBe(true);
    });

    it('allows URLs whose hostname is on the allowlist', () => {
        expect(isAllowedSeedUrl('https://images.unsplash.com/photo-123')).toBe(true);
        expect(isAllowedSeedUrl('https://images.pexels.com/photos/42/pexels-photo-42.jpeg')).toBe(
            true
        );
        expect(isAllowedSeedUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(
            true
        );
    });

    it('is case-insensitive on the hostname', () => {
        expect(isAllowedSeedUrl('https://IMAGES.UNSPLASH.COM/photo-1')).toBe(true);
        expect(isAllowedSeedUrl('https://Images.Pexels.Com/photos/x.jpg')).toBe(true);
        expect(isAllowedSeedUrl('https://RES.CLOUDINARY.COM/demo/image/upload/sample.jpg')).toBe(
            true
        );
    });

    it('rejects URLs on hosts that are not in the allowlist', () => {
        expect(isAllowedSeedUrl('https://evil.example.com/photo.jpg')).toBe(false);
        expect(isAllowedSeedUrl('https://localhost/secret')).toBe(false);
        expect(isAllowedSeedUrl('https://127.0.0.1/metadata')).toBe(false);
        // Typosquat / hostname-prefix attack: the allowlist uses exact host
        // match, not substring.
        expect(isAllowedSeedUrl('https://images.unsplash.com.attacker.example/x.jpg')).toBe(false);
        expect(isAllowedSeedUrl('https://notimages.unsplash.com/x.jpg')).toBe(false);
    });

    it('rejects non-HTTP(S) protocols even when hostname matches', () => {
        expect(isAllowedSeedUrl('ftp://images.unsplash.com/photo.jpg')).toBe(false);
        expect(isAllowedSeedUrl('file:///etc/passwd')).toBe(false);
        expect(isAllowedSeedUrl('data:image/png;base64,AAAA')).toBe(false);
        expect(isAllowedSeedUrl('javascript:void(fetch("https://images.unsplash.com/x"))')).toBe(
            false
        );
    });

    it('rejects malformed or non-URL strings', () => {
        expect(isAllowedSeedUrl('')).toBe(false);
        expect(isAllowedSeedUrl('not a url')).toBe(false);
        expect(isAllowedSeedUrl('/relative/path.jpg')).toBe(false);
        expect(isAllowedSeedUrl('images.unsplash.com/photo.jpg')).toBe(false);
    });

    it('accepts http:// on the allowlist (covers redirect targets)', () => {
        // We do not force HTTPS here because the fetch layer handles TLS
        // downgrade concerns; the allowlist's job is hostname-scoped SSRF
        // protection only.
        expect(isAllowedSeedUrl('http://images.unsplash.com/photo-1')).toBe(true);
    });
});
