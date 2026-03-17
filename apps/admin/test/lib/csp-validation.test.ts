/**
 * @file CSP directive security validation tests for the admin app.
 * @description Validates that the admin CSP directives produced by buildCspDirectives
 * contain all required security properties for production readiness.
 */

import { describe, expect, it } from 'vitest';
import { buildCspDirectives } from '../../src/lib/csp-helpers';

const TEST_NONCE = 'test-nonce-validation';

describe('Admin CSP security validation', () => {
    const csp = buildCspDirectives({ nonce: TEST_NONCE, sentryDsn: '' });

    it('should include upgrade-insecure-requests directive', () => {
        expect(csp).toContain('upgrade-insecure-requests');
    });

    it('should include object-src none directive', () => {
        expect(csp).toContain("object-src 'none'");
    });

    it('should include frame-ancestors directive', () => {
        expect(csp).toContain('frame-ancestors');
    });

    it('should include base-uri self directive', () => {
        expect(csp).toContain("base-uri 'self'");
    });

    it('should include default-src self directive', () => {
        expect(csp).toContain("default-src 'self'");
    });

    it('should include form-action directive', () => {
        expect(csp).toContain("form-action 'self'");
    });

    it('should include nonce-based script-src', () => {
        expect(csp).toContain(`'nonce-${TEST_NONCE}'`);
    });

    it('should include strict-dynamic for trusted script loading', () => {
        expect(csp).toContain("'strict-dynamic'");
    });
});
