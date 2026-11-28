import { describe, expect, it } from 'vitest';
import {
    buildDirectEmailOptOutUrl,
    DirectEmailTokenError,
    generateDirectEmailOptOutToken,
    maskEmail,
    verifyDirectEmailOptOutToken
} from '../../../src/services/direct-email/direct-email-token.helpers.js';
import {
    generateUnsubscribeToken,
    generateVerificationToken
} from '../../../src/services/newsletter/newsletter-token.helpers.js';

const SECRET = 'a'.repeat(32);
const PREV_SECRET = 'b'.repeat(32);

describe('direct email opt-out token', () => {
    it('round-trips and lowercases the address', () => {
        // Arrange
        const token = generateDirectEmailOptOutToken({ email: 'Ana@Example.COM', secret: SECRET });

        // Act
        const result = verifyDirectEmailOptOutToken({ token, secret: SECRET });

        // Assert
        expect(result).toEqual({ email: 'ana@example.com' });
    });

    it('is deterministic for the same address and secret', () => {
        const a = generateDirectEmailOptOutToken({ email: 'a@b.com', secret: SECRET });
        const b = generateDirectEmailOptOutToken({ email: 'A@B.com', secret: SECRET });
        expect(a).toBe(b);
    });

    it('rejects a token forged for another address (payload swapped, signature kept)', () => {
        // Arrange
        const token = generateDirectEmailOptOutToken({
            email: 'victim@example.com',
            secret: SECRET
        });
        const signature = token.split('.')[1];
        const forgedPayload = Buffer.from('other@example.com', 'utf8').toString('base64url');

        // Act / Assert
        expect(() =>
            verifyDirectEmailOptOutToken({ token: `${forgedPayload}.${signature}`, secret: SECRET })
        ).toThrow(DirectEmailTokenError);
    });

    it('rejects a token signed with another secret', () => {
        const token = generateDirectEmailOptOutToken({ email: 'a@b.com', secret: PREV_SECRET });
        expect(() => verifyDirectEmailOptOutToken({ token, secret: SECRET })).toThrow(
            DirectEmailTokenError
        );
    });

    it('accepts a token signed with the previous secret during rotation', () => {
        const token = generateDirectEmailOptOutToken({ email: 'a@b.com', secret: PREV_SECRET });
        expect(
            verifyDirectEmailOptOutToken({ token, secret: SECRET, secretPrev: PREV_SECRET })
        ).toEqual({ email: 'a@b.com' });
    });

    it.each(['', 'nodot', '.sig', 'payload.', '!!!.???'])('rejects malformed token %j', (token) => {
        expect(() => verifyDirectEmailOptOutToken({ token, secret: SECRET })).toThrow(
            DirectEmailTokenError
        );
    });

    it('refuses to sign without a secret', () => {
        expect(() => generateDirectEmailOptOutToken({ email: 'a@b.com', secret: '' })).toThrow(
            DirectEmailTokenError
        );
    });

    it('does not accept newsletter tokens (domain separation)', () => {
        // Arrange
        const unsubscribe = generateUnsubscribeToken({
            subscriberId: '11111111-1111-1111-1111-111111111111',
            channel: 'email',
            secret: SECRET
        });
        const verification = generateVerificationToken({
            subscriberId: '11111111-1111-1111-1111-111111111111',
            channel: 'email',
            secret: SECRET
        });

        // Act / Assert
        expect(() => verifyDirectEmailOptOutToken({ token: unsubscribe, secret: SECRET })).toThrow(
            DirectEmailTokenError
        );
        expect(() => verifyDirectEmailOptOutToken({ token: verification, secret: SECRET })).toThrow(
            DirectEmailTokenError
        );
    });

    it('does not let a direct email token pass as a newsletter token payload', () => {
        // A direct email signature covers the prefixed message, never the payload segment
        // a newsletter verifier would check.
        const token = generateDirectEmailOptOutToken({ email: 'a@b.com', secret: SECRET });
        expect(token.split('.')).toHaveLength(2);
        expect(token.split('.')[0]).toBe(Buffer.from('a@b.com').toString('base64url'));
    });
});

describe('maskEmail and buildDirectEmailOptOutUrl', () => {
    it('masks the local part', () => {
        expect(maskEmail('juan@example.com')).toBe('j***@example.com');
        expect(maskEmail('invalid')).toBe('***');
    });

    it('builds the web page URL with an encoded token and no double slash', () => {
        expect(
            buildDirectEmailOptOutUrl({ siteUrl: 'https://hospeda.com.ar/', token: 'a.b' })
        ).toBe('https://hospeda.com.ar/es/correos/baja/?token=a.b');
    });
});
