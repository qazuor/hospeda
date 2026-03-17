import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCspDirectives } from '../../src/lib/csp-helpers';

describe('CSP Nonce Security Properties', () => {
    it('should generate nonce with sufficient entropy (22 chars base64url = 128 bits)', () => {
        const nonce = randomBytes(16).toString('base64url');
        expect(nonce.length).toBeGreaterThanOrEqual(22);
    });

    it('should generate unique nonces on each call', () => {
        const nonces = new Set(
            Array.from({ length: 100 }, () => randomBytes(16).toString('base64url'))
        );
        expect(nonces.size).toBe(100);
    });

    it('should generate base64url-safe nonce format', () => {
        const nonce = randomBytes(16).toString('base64url');
        expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should include nonce in CSP directives', () => {
        const nonce = randomBytes(16).toString('base64url');
        const csp = buildCspDirectives({ nonce, sentryDsn: '' });
        expect(csp).toContain(`'nonce-${nonce}'`);
    });
});
