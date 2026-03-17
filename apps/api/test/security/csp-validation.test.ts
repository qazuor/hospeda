/**
 * CSP Validation Tests for API Security Middleware
 *
 * Validates that the API's Content Security Policy configuration is correct
 * for both standard routes and documentation routes.
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { securityHeadersMiddleware } from '../../src/middlewares/security';

// Mock environment with security enabled
vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'production',
        API_SECURITY_ENABLED: true,
        API_SECURITY_HEADERS_ENABLED: true,
        API_SECURITY_STRICT_TRANSPORT_SECURITY: 'max-age=31536000; includeSubDomains',
        API_SECURITY_X_FRAME_OPTIONS: 'SAMEORIGIN',
        API_SECURITY_X_CONTENT_TYPE_OPTIONS: 'nosniff',
        API_SECURITY_X_XSS_PROTECTION: '0',
        API_SECURITY_REFERRER_POLICY: 'strict-origin-when-cross-origin',
        HOSPEDA_TESTING_ORIGIN_VERIFICATION: false
    };

    return {
        validateApiEnv: vi.fn(),
        env: mockEnv,
        getSecurityConfig: () => ({
            enabled: mockEnv.API_SECURITY_ENABLED,
            headersEnabled: mockEnv.API_SECURITY_HEADERS_ENABLED,
            strictTransportSecurity: mockEnv.API_SECURITY_STRICT_TRANSPORT_SECURITY,
            xFrameOptions: mockEnv.API_SECURITY_X_FRAME_OPTIONS,
            xContentTypeOptions: mockEnv.API_SECURITY_X_CONTENT_TYPE_OPTIONS,
            xXssProtection: mockEnv.API_SECURITY_X_XSS_PROTECTION,
            referrerPolicy: mockEnv.API_SECURITY_REFERRER_POLICY
        }),
        getCorsConfig: () => ({
            origins: ['http://localhost:4321', 'http://localhost:3000']
        })
    };
});

/** Helper to parse a CSP header string into a directive map */
const parseCsp = (cspHeader: string): Record<string, string> => {
    const directives: Record<string, string> = {};
    for (const part of cspHeader.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const spaceIndex = trimmed.indexOf(' ');
        if (spaceIndex === -1) {
            directives[trimmed] = '';
        } else {
            directives[trimmed.slice(0, spaceIndex)] = trimmed.slice(spaceIndex + 1);
        }
    }
    return directives;
};

describe('CSP Validation', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(securityHeadersMiddleware);
        app.get('/api/v1/public/test', (c) => c.json({ ok: true }));
        app.get('/api/v1/admin/test', (c) => c.json({ ok: true }));
        app.get('/docs', (c) => c.json({ docs: true }));
        app.get('/docs/reference', (c) => c.json({ reference: true }));
    });

    describe('Non-docs routes (strict CSP)', () => {
        it('should not include unsafe-inline in script-src', async () => {
            const res = await app.request('/api/v1/public/test');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            const directives = parseCsp(csp!);
            expect(directives['script-src']).not.toContain('unsafe-inline');
        });

        it('should include upgrade-insecure-requests directive', async () => {
            const res = await app.request('/api/v1/public/test');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            expect(csp).toContain('upgrade-insecure-requests');
        });

        it('should set object-src to none', async () => {
            const res = await app.request('/api/v1/public/test');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            const directives = parseCsp(csp!);
            expect(directives['object-src']).toBe("'none'");
        });

        it('should restrict font-src to self only without data: or https:', async () => {
            const res = await app.request('/api/v1/public/test');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            const directives = parseCsp(csp!);
            expect(directives['font-src']).toBe("'self'");
            expect(directives['font-src']).not.toContain('data:');
            expect(directives['font-src']).not.toContain('https:');
        });

        it('should include non-CSP security headers', async () => {
            const res = await app.request('/api/v1/admin/test');

            expect(res.headers.get('Strict-Transport-Security')).toBe(
                'max-age=31536000; includeSubDomains'
            );
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
            expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
            expect(res.headers.get('X-XSS-Protection')).toBe('0');
            expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        });
    });

    describe('Docs routes (permissive CSP for Swagger/Scalar)', () => {
        it('should include unsafe-inline in script-src for docs', async () => {
            const res = await app.request('/docs');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            const directives = parseCsp(csp!);
            expect(directives['script-src']).toContain("'unsafe-inline'");
        });

        it('should include unsafe-inline in style-src for docs', async () => {
            const res = await app.request('/docs');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            const directives = parseCsp(csp!);
            expect(directives['style-src']).toContain("'unsafe-inline'");
        });

        it('should include upgrade-insecure-requests directive for docs', async () => {
            const res = await app.request('/docs');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            expect(csp).toContain('upgrade-insecure-requests');
        });

        it('should set object-src to none for docs', async () => {
            const res = await app.request('/docs/reference');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            const directives = parseCsp(csp!);
            expect(directives['object-src']).toBe("'none'");
        });

        it('should include non-CSP security headers for docs', async () => {
            const res = await app.request('/docs');

            expect(res.headers.get('Strict-Transport-Security')).toBe(
                'max-age=31536000; includeSubDomains'
            );
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
            expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
            expect(res.headers.get('X-XSS-Protection')).toBe('0');
            expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        });

        it('should allow CDN sources for Swagger/Scalar in script-src', async () => {
            const res = await app.request('/docs');
            const csp = res.headers.get('Content-Security-Policy');

            expect(csp).not.toBeNull();
            const directives = parseCsp(csp!);
            expect(directives['script-src']).toContain('cdn.jsdelivr.net');
            expect(directives['script-src']).toContain('unpkg.com');
        });
    });
});
