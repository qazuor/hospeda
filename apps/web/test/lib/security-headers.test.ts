/** Tests for the baseline security response headers (HOS-2572 adds COOP). */
import { describe, expect, it } from 'vitest';
import { applySecurityHeaders, SECURITY_HEADER_VALUES } from '@/lib/security-headers';

describe('applySecurityHeaders', () => {
    it('should set Cross-Origin-Opener-Policy to same-origin', () => {
        // Arrange
        const headers = new Headers();

        // Act
        applySecurityHeaders({ headers });

        // Assert
        expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });

    it('should keep the existing baseline headers', () => {
        // Arrange
        const headers = new Headers();

        // Act
        applySecurityHeaders({ headers });

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
        applySecurityHeaders({ headers });

        // Assert
        expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });
});
