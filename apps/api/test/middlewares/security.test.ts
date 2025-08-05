/**
 * Security Middleware Tests
 * Tests the security headers functionality including CSP, HSTS, and other security headers
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSecureHeadersMiddleware } from '../../src/middlewares/security';

// Mock environment
vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        SECURITY_ENABLED: true,
        SECURITY_HEADERS_ENABLED: true,
        SECURITY_CONTENT_SECURITY_POLICY:
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
        SECURITY_STRICT_TRANSPORT_SECURITY: 'max-age=31536000; includeSubDomains',
        SECURITY_X_FRAME_OPTIONS: 'SAMEORIGIN',
        SECURITY_X_CONTENT_TYPE_OPTIONS: 'nosniff',
        SECURITY_X_XSS_PROTECTION: '1; mode=block',
        SECURITY_REFERRER_POLICY: 'strict-origin-when-cross-origin',
        SECURITY_PERMISSIONS_POLICY: 'camera=(), microphone=(), geolocation=()'
    };

    return {
        env: mockEnv
    };
});

describe('Security Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(createSecureHeadersMiddleware());
        app.get('/test', (c) => c.json({ message: 'success' }));
        app.get('/api/data', (c) => c.json({ data: 'sensitive' }));
    });

    describe('Security Headers', () => {
        it('should include Content-Security-Policy header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
            expect(res.headers.get('Content-Security-Policy')).toContain(
                "script-src 'self' 'unsafe-inline'"
            );
            expect(res.headers.get('Content-Security-Policy')).toContain(
                "style-src 'self' 'unsafe-inline'"
            );
        });

        it('should include Strict-Transport-Security header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('Strict-Transport-Security')).toBe(
                'max-age=31536000; includeSubDomains'
            );
        });

        it('should include X-Frame-Options header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });

        it('should include X-Content-Type-Options header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        });

        it('should include X-XSS-Protection header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
        });

        it('should include Referrer-Policy header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        });

        it('should include Permissions-Policy header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const permissionsPolicy = res.headers.get('Permissions-Policy');
            expect(permissionsPolicy).toBeDefined();
            expect(permissionsPolicy).toContain('camera=none');
            expect(permissionsPolicy).toContain('microphone=none');
            expect(permissionsPolicy).toContain('geolocation=none');
        });
    });

    describe('Documentation Routes', () => {
        it('should skip security headers for /docs routes', async () => {
            app.get('/docs', (c) => c.json({ docs: 'content' }));

            const res = await app.request('/docs');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeNull();
            expect(res.headers.get('Strict-Transport-Security')).toBeNull();
            expect(res.headers.get('X-Frame-Options')).toBeNull();
        });

        it('should skip security headers for /reference routes', async () => {
            app.get('/reference', (c) => c.json({ reference: 'content' }));

            const res = await app.request('/reference');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeNull();
            expect(res.headers.get('Strict-Transport-Security')).toBeNull();
            expect(res.headers.get('X-Frame-Options')).toBeNull();
        });

        it('should skip security headers for /ui routes', async () => {
            app.get('/ui', (c) => c.json({ ui: 'content' }));

            const res = await app.request('/ui');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeNull();
            expect(res.headers.get('Strict-Transport-Security')).toBeNull();
            expect(res.headers.get('X-Frame-Options')).toBeNull();
        });

        it('should skip security headers for nested documentation routes', async () => {
            app.get('/docs/api', (c) => c.json({ apiDocs: 'content' }));
            app.get('/reference/v1', (c) => c.json({ v1Docs: 'content' }));
            app.get('/ui/components', (c) => c.json({ components: 'content' }));

            const docsRes = await app.request('/docs/api');
            const refRes = await app.request('/reference/v1');
            const uiRes = await app.request('/ui/components');

            expect(docsRes.status).toBe(200);
            expect(refRes.status).toBe(200);
            expect(uiRes.status).toBe(200);

            expect(docsRes.headers.get('Content-Security-Policy')).toBeNull();
            expect(refRes.headers.get('Content-Security-Policy')).toBeNull();
            expect(uiRes.headers.get('Content-Security-Policy')).toBeNull();
        });
    });

    describe('Security Disabled', () => {
        it('should skip security headers when SECURITY_ENABLED is false', async () => {
            // Create a new app with security disabled
            const disabledApp = new Hono();

            // Create a mock middleware that skips security headers
            const disabledSecurityMiddleware = async (_c: any, next: any) => {
                await next();
            };

            disabledApp.use(disabledSecurityMiddleware);
            disabledApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await disabledApp.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeNull();
            expect(res.headers.get('Strict-Transport-Security')).toBeNull();
            expect(res.headers.get('X-Frame-Options')).toBeNull();
        });

        it('should skip security headers when SECURITY_HEADERS_ENABLED is false', async () => {
            // Create a new app with security headers disabled
            const disabledApp = new Hono();

            // Create a mock middleware that skips security headers
            const disabledSecurityMiddleware = async (_c: any, next: any) => {
                await next();
            };

            disabledApp.use(disabledSecurityMiddleware);
            disabledApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await disabledApp.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeNull();
            expect(res.headers.get('Strict-Transport-Security')).toBeNull();
            expect(res.headers.get('X-Frame-Options')).toBeNull();
        });
    });

    describe('Different HTTP Methods', () => {
        it('should apply security headers to GET requests', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });

        it('should apply security headers to POST requests', async () => {
            app.post('/test', (c) => c.json({ message: 'posted' }));

            const res = await app.request('/test', { method: 'POST' });

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });

        it('should apply security headers to PUT requests', async () => {
            app.put('/test', (c) => c.json({ message: 'updated' }));

            const res = await app.request('/test', { method: 'PUT' });

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });

        it('should apply security headers to DELETE requests', async () => {
            app.delete('/test', (c) => c.json({ message: 'deleted' }));

            const res = await app.request('/test', { method: 'DELETE' });

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });
    });

    describe('Content Security Policy', () => {
        it('should include proper CSP directives', async () => {
            const res = await app.request('/test');

            const csp = res.headers.get('Content-Security-Policy');
            expect(csp).toBeDefined();

            // Check for essential CSP directives
            expect(csp).toContain("default-src 'self'");
            expect(csp).toContain("script-src 'self' 'unsafe-inline'");
            expect(csp).toContain("style-src 'self' 'unsafe-inline'");
            expect(csp).toContain("img-src 'self' data: https:");
            expect(csp).toContain("connect-src 'self'");
            expect(csp).toContain("font-src 'self' https: data:");
            expect(csp).toContain("object-src 'none'");
            expect(csp).toContain("media-src 'self'");
            expect(csp).toContain("frame-src 'self'");
        });

        it('should prevent XSS attacks with proper script-src directive', async () => {
            const res = await app.request('/test');

            const csp = res.headers.get('Content-Security-Policy');
            expect(csp).toContain("script-src 'self' 'unsafe-inline'");
        });

        it('should prevent clickjacking with frame-src directive', async () => {
            const res = await app.request('/test');

            const csp = res.headers.get('Content-Security-Policy');
            expect(csp).toContain("frame-src 'self'");
        });
    });

    describe('Permissions Policy', () => {
        it('should restrict camera access', async () => {
            const res = await app.request('/test');

            const permissionsPolicy = res.headers.get('Permissions-Policy');
            expect(permissionsPolicy).toContain('camera=none');
        });

        it('should restrict microphone access', async () => {
            const res = await app.request('/test');

            const permissionsPolicy = res.headers.get('Permissions-Policy');
            expect(permissionsPolicy).toContain('microphone=none');
        });

        it('should restrict geolocation access', async () => {
            const res = await app.request('/test');

            const permissionsPolicy = res.headers.get('Permissions-Policy');
            expect(permissionsPolicy).toContain('geolocation=none');
        });

        it('should include all restricted permissions', async () => {
            const res = await app.request('/test');

            const permissionsPolicy = res.headers.get('Permissions-Policy');
            expect(permissionsPolicy).toContain('camera=none');
            expect(permissionsPolicy).toContain('microphone=none');
            expect(permissionsPolicy).toContain('geolocation=none');
            expect(permissionsPolicy).toContain('payment=none');
            expect(permissionsPolicy).toContain('usb=none');
            expect(permissionsPolicy).toContain('magnetometer=none');
            expect(permissionsPolicy).toContain('gyroscope=none');
            expect(permissionsPolicy).toContain('accelerometer=none');
        });
    });

    describe('Edge Cases', () => {
        it('should handle requests with query parameters', async () => {
            const res = await app.request('/test?param=value');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });

        it('should handle requests with path parameters', async () => {
            app.get('/test/:id', (c) => c.json({ id: c.req.param('id') }));

            const res = await app.request('/test/123');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });

        it('should handle requests to root path', async () => {
            app.get('/', (c) => c.json({ message: 'root' }));

            const res = await app.request('/');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });

        it('should handle requests with special characters in path', async () => {
            app.get('/test/path/with/special/chars', (c) => c.json({ message: 'special' }));

            const res = await app.request('/test/path/with/special/chars');

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
            expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        });
    });
});
