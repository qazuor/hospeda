import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    generatePartnerClaimSecret,
    hashPartnerClaimSecret
} from '../../../src/utils/partner-application/partner-claim-secret.js';

describe('partner claim secret', () => {
    it('generates independent 32-byte secrets and hashes with SHA-256 hex', () => {
        const first = generatePartnerClaimSecret();
        const second = generatePartnerClaimSecret();
        expect(Buffer.from(first.secret, 'base64url')).toHaveLength(32);
        expect(first.secret).not.toBe(second.secret);
        expect(hashPartnerClaimSecret({ secret: first.secret })).toBe(
            createHash('sha256').update(first.secret, 'utf8').digest('hex')
        );
    });
});
