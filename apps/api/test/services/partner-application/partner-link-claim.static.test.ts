import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** TEST:V7:9 protects constant-time digest comparison; text hash comparisons would leak timing. */
describe('partner link claim constant-time verification', () => {
    it('hashes with the shared helper and compares fixed-length digests using timingSafeEqual', () => {
        const source = readFileSync(
            new URL(
                '../../../src/services/partner-application/partner-link-claim.service.ts',
                import.meta.url
            ),
            'utf8'
        );
        expect(source).toContain('timingSafeEqual');
        expect(source).toContain('hashPartnerClaimSecret');
        expect(source).not.toMatch(/computedHex\s*(?:===|!==)|storedHex\s*(?:===|!==)/);
    });
});
