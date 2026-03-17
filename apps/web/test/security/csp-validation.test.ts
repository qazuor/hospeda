/**
 * @file CSP directive validation tests for the web app middleware.
 * @description Validates that CSP directives in the web middleware contain
 * required security properties. Reads the source file directly since the
 * CSP directives are defined inline in the middleware (not exported).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const middlewareSrc = readFileSync(resolve(__dirname, '../../src/middleware.ts'), 'utf8');

describe('Web CSP directive validation', () => {
    it('should include upgrade-insecure-requests directive', () => {
        expect(middlewareSrc).toContain('upgrade-insecure-requests');
    });

    it('should include object-src none directive', () => {
        expect(middlewareSrc).toContain("object-src 'none'");
    });

    it('should include frame-ancestors directive', () => {
        expect(middlewareSrc).toContain('frame-ancestors');
    });

    it('should include base-uri self directive', () => {
        expect(middlewareSrc).toContain("base-uri 'self'");
    });

    it('should not include https: wildcard in script-src', () => {
        // Extract the script-src line from the directives array
        const scriptSrcMatch = middlewareSrc.match(/script-src[^"']*/g);
        // The web app CSP should NOT have a bare 'https:' in script-src
        // (unlike the admin app which uses it as a CSP2 fallback with nonce+strict-dynamic)
        const webScriptSrcLines = scriptSrcMatch?.filter((line) => !line.includes('nonce-'));
        for (const line of webScriptSrcLines ?? []) {
            expect(line).not.toMatch(/\bhttps:\b/);
        }
    });

    it('should include default-src self directive', () => {
        expect(middlewareSrc).toContain("default-src 'self'");
    });

    it('should include form-action directive', () => {
        expect(middlewareSrc).toContain("form-action 'self'");
    });

    it('should use Report-Only mode in Phase 1', () => {
        expect(middlewareSrc).toContain('Content-Security-Policy-Report-Only');
    });
});
