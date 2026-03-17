/**
 * @file CSP header integration tests for the admin app.
 * @description Validates that buildCspDirectives produces valid CSP syntax
 * with all required directives for the admin panel.
 */

import { describe, expect, it } from 'vitest';
import { buildCspDirectives } from '../../src/lib/csp-helpers';

describe('Admin CSP header integration', () => {
    const TEST_NONCE = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

    it('should produce valid CSP syntax with semicolon-separated directives', () => {
        // Arrange & Act
        const csp = buildCspDirectives({ nonce: TEST_NONCE, sentryDsn: '' });

        // Assert - valid CSP is semicolon-separated directives
        const directives = csp.split('; ');
        expect(directives.length).toBeGreaterThan(5);

        // Each directive should have a directive name followed by values (or be standalone like upgrade-insecure-requests)
        for (const directive of directives) {
            expect(directive.trim().length).toBeGreaterThan(0);
        }
    });

    it('should include the nonce in script-src', () => {
        // Arrange & Act
        const csp = buildCspDirectives({ nonce: TEST_NONCE, sentryDsn: '' });

        // Assert
        expect(csp).toContain(`'nonce-${TEST_NONCE}'`);

        // Verify it appears specifically within script-src
        const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
        expect(scriptSrc).toBeDefined();
        expect(scriptSrc).toContain(`'nonce-${TEST_NONCE}'`);
    });

    it('should include upgrade-insecure-requests directive', () => {
        // Arrange & Act
        const csp = buildCspDirectives({ nonce: TEST_NONCE, sentryDsn: '' });

        // Assert
        const directives = csp.split('; ');
        expect(directives).toContain('upgrade-insecure-requests');
    });

    it('should include media-src self directive', () => {
        // Arrange & Act
        const csp = buildCspDirectives({ nonce: TEST_NONCE, sentryDsn: '' });

        // Assert
        expect(csp).toContain("media-src 'self'");
    });

    it('should include specific MercadoPago subdomains in connect-src', () => {
        // Arrange & Act
        const csp = buildCspDirectives({ nonce: TEST_NONCE, sentryDsn: '' });

        // Assert - specific subdomains
        expect(csp).toContain('https://api.mercadopago.com');
        expect(csp).toContain('https://sdk.mercadopago.com');
        expect(csp).toContain('https://www.mercadopago.com');

        // Assert - no wildcard
        expect(csp).not.toContain('*.mercadopago.com');
    });

    it('should produce different CSP strings for different nonces', () => {
        // Arrange
        const nonceA = 'nonce-alpha-123456';
        const nonceB = 'nonce-beta-789012';

        // Act
        const cspA = buildCspDirectives({ nonce: nonceA, sentryDsn: '' });
        const cspB = buildCspDirectives({ nonce: nonceB, sentryDsn: '' });

        // Assert
        expect(cspA).not.toBe(cspB);
        expect(cspA).toContain(`'nonce-${nonceA}'`);
        expect(cspB).toContain(`'nonce-${nonceB}'`);
    });
});
