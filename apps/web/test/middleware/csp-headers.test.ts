/**
 * @file CSP header integration tests for the web middleware.
 * @description Validates that the CSP directives built inline in the web middleware
 * contain all required security directives and use the correct header mode.
 * Since the directives are not exported, we read the source file directly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const middlewareSrc = readFileSync(resolve(__dirname, '../../src/middleware.ts'), 'utf8');

describe('Web middleware CSP headers', () => {
    it('should include script-src directive', () => {
        expect(middlewareSrc).toContain('script-src');
    });

    it('should include style-src directive', () => {
        expect(middlewareSrc).toContain('style-src');
    });

    it('should include connect-src directive', () => {
        expect(middlewareSrc).toContain('connect-src');
    });

    it('should include upgrade-insecure-requests directive', () => {
        expect(middlewareSrc).toContain('upgrade-insecure-requests');
    });

    it('should include object-src none directive', () => {
        expect(middlewareSrc).toContain("object-src 'none'");
    });

    it('should include frame-ancestors directive', () => {
        expect(middlewareSrc).toContain('frame-ancestors');
    });

    it('should include media-src directive', () => {
        expect(middlewareSrc).toContain("media-src 'self'");
    });

    it('should use Content-Security-Policy-Report-Only (not enforcing)', () => {
        // Assert - Report-Only header must be present
        expect(middlewareSrc).toContain('Content-Security-Policy-Report-Only');

        // The CSP_HEADER_NAME variable should reference Report-Only, not the enforcing header.
        // Check that the assigned header name string is specifically Report-Only.
        const headerAssignment = middlewareSrc.match(/CSP_HEADER_NAME\s*=\s*['"]([^'"]+)['"]/);
        expect(headerAssignment).not.toBeNull();
        expect(headerAssignment?.[1]).toBe('Content-Security-Policy-Report-Only');
    });
});
