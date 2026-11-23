/** Tests for the baseline security response headers (HOS-2572 adds COOP). */
import { describe, expect, it } from 'vitest';
import {
    applySecurityHeaders,
    isCoopExemptPath,
    SECURITY_HEADER_VALUES
} from '@/lib/security-headers';

describe('applySecurityHeaders', () => {
    it('should set Cross-Origin-Opener-Policy to same-origin', () => {
        // Arrange
        const headers = new Headers();

        // Act
        applySecurityHeaders({ headers, pathname: '/es/' });

        // Assert
        expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });

    it('should keep the existing baseline headers', () => {
        // Arrange
        const headers = new Headers();

        // Act
        applySecurityHeaders({ headers, pathname: '/es/alojamientos/' });

        // Assert
        for (const [name, value] of Object.entries(SECURITY_HEADER_VALUES)) {
            expect(headers.get(name)).toBe(value);
        }
        expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    });

    it('should override a COOP value set earlier in the pipeline', () => {
        // Arrange
        const headers = new Headers({ 'Cross-Origin-Opener-Policy': 'unsafe-none' });

        // Act
        applySecurityHeaders({ headers, pathname: '/es/' });

        // Assert
        expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });

    it.each([
        '/es/auth/signin',
        '/en/auth/consent',
        '/pt/auth/',
        '/es/auth'
    ])('should send no COOP on the auth page %s (cross-origin OAuth popups)', (pathname) => {
        // Arrange
        const headers = new Headers({ 'Cross-Origin-Opener-Policy': 'same-origin' });

        // Act
        applySecurityHeaders({ headers, pathname });

        // Assert
        expect(headers.get('Cross-Origin-Opener-Policy')).toBeNull();
        expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
});

describe('isCoopExemptPath', () => {
    it.each([
        ['/es/auth/consent', true],
        ['/en/auth/signin', true],
        ['/es/', false],
        ['/es/authors/', false],
        ['/es/mi-cuenta/auth/', false]
    ])('%s → %s', (pathname, expected) => {
        expect(isCoopExemptPath({ pathname })).toBe(expected);
    });
});
