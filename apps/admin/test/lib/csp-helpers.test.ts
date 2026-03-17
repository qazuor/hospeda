import { describe, expect, it } from 'vitest';
import { buildCspDirectives, buildSentryReportUri } from '../../src/lib/csp-helpers';

describe('buildSentryReportUri', () => {
    it('should parse a valid DSN and return the security endpoint', () => {
        const result = buildSentryReportUri({
            dsn: 'https://abc123@o456789.ingest.sentry.io/789'
        });
        expect(result).toBe('https://o456789.ingest.sentry.io/api/789/security/?sentry_key=abc123');
    });

    it('should return null for an invalid DSN', () => {
        expect(buildSentryReportUri({ dsn: 'not-a-url' })).toBeNull();
    });

    it('should return null for a DSN missing the project ID', () => {
        expect(buildSentryReportUri({ dsn: 'https://key@host/' })).toBeNull();
    });

    it('should return null for a DSN missing the key (empty username)', () => {
        // Arrange
        const dsn = 'https://@o456.ingest.sentry.io/789';

        // Act
        const result = buildSentryReportUri({ dsn });

        // Assert
        expect(result).toBeNull();
    });
});

describe('buildCspDirectives', () => {
    it('should include the nonce in script-src', () => {
        const result = buildCspDirectives({ nonce: 'test-nonce-123', sentryDsn: '' });
        expect(result).toContain("'nonce-test-nonce-123'");
    });

    it('should include strict-dynamic in script-src', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain("'strict-dynamic'");
    });

    it('should include unsafe-eval for MercadoPago SDK', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain("'unsafe-eval'");
    });

    it('should include MercadoPago domains in connect-src', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain('https://api.mercadopago.com');
        expect(result).toContain('https://sdk.mercadopago.com');
        expect(result).toContain('https://www.mercadopago.com');
        expect(result).toContain('https://api.mercadolibre.com');
        expect(result).toContain('https://api-static.mercadopago.com');
    });

    it('should include worker-src and child-src for Sentry Replay', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain("worker-src 'self' blob:");
        expect(result).toContain('child-src blob:');
    });

    it('should include frame-src for MercadoPago', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain('frame-src https://www.mercadopago.com');
    });

    it('should include report-uri when DSN is provided', () => {
        const result = buildCspDirectives({
            nonce: 'test',
            sentryDsn: 'https://abc123@o456789.ingest.sentry.io/789'
        });
        expect(result).toContain('report-uri');
        expect(result).toContain('o456789.ingest.sentry.io/api/789/security');
    });

    it('should not include report-uri when no DSN is provided', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).not.toContain('report-uri');
    });

    it('should include frame-ancestors none', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain("frame-ancestors 'none'");
    });

    it('should include upgrade-insecure-requests directive', () => {
        // Arrange & Act
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });

        // Assert
        expect(result).toContain('upgrade-insecure-requests');
    });

    it('should include media-src self directive', () => {
        // Arrange & Act
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });

        // Assert
        expect(result).toContain("media-src 'self'");
    });

    it('should use specific MercadoPago subdomains instead of wildcard', () => {
        // Arrange & Act
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });

        // Assert - specific subdomains must be listed
        expect(result).toContain('https://api.mercadopago.com');
        expect(result).toContain('https://sdk.mercadopago.com');
        expect(result).toContain('https://www.mercadopago.com');

        // Assert - wildcard must NOT be used
        expect(result).not.toContain('*.mercadopago.com');
    });
});
