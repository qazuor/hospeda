/**
 * Unit tests for newsletter HMAC token helpers (SPEC-101 T-101-10).
 *
 * Pure function tests — no DB, no env, no mocks. Each suite covers the
 * acceptance criteria from the task spec:
 *   - happy paths (round-trip)
 *   - tampered payload / signature
 *   - TTL: valid, expired, future-issued
 *   - unsubscribe token determinism
 *   - HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV rotation fallback
 */

import { describe, expect, it } from 'vitest';
import {
    InvalidTokenError,
    TokenExpiredError,
    generateUnsubscribeToken,
    generateVerificationToken,
    verifyUnsubscribeToken,
    verifyVerificationToken
} from '../../../src/services/newsletter/newsletter-token.helpers.js';

const SECRET = 'a'.repeat(32);
const PREV_SECRET = 'b'.repeat(32);
const SUBSCRIBER_ID = '11111111-1111-1111-1111-111111111111';

describe('newsletter token helpers', () => {
    // --------------------------------------------------------------------
    // Verification token
    // --------------------------------------------------------------------

    describe('generateVerificationToken / verifyVerificationToken', () => {
        it('round-trips a valid token', () => {
            const issuedAt = new Date('2026-05-12T12:00:00Z');
            const token = generateVerificationToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                issuedAt,
                secret: SECRET
            });

            const payload = verifyVerificationToken({
                token,
                secret: SECRET,
                now: new Date('2026-05-12T13:00:00Z')
            });

            expect(payload.subscriberId).toBe(SUBSCRIBER_ID);
            expect(payload.channel).toBe('email');
        });

        it('rejects a token issued more than ttlHours ago', () => {
            const issuedAt = new Date('2026-05-09T12:00:00Z');
            const token = generateVerificationToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                issuedAt,
                secret: SECRET
            });

            // 73 hours later -> expired (default TTL is 72h).
            expect(() =>
                verifyVerificationToken({
                    token,
                    secret: SECRET,
                    now: new Date('2026-05-12T13:00:00Z')
                })
            ).toThrow(TokenExpiredError);
        });

        it('respects a custom ttlHours window', () => {
            const issuedAt = new Date('2026-05-12T10:00:00Z');
            const token = generateVerificationToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                issuedAt,
                secret: SECRET
            });

            // ttl=1h, 2h elapsed -> expired
            expect(() =>
                verifyVerificationToken({
                    token,
                    secret: SECRET,
                    now: new Date('2026-05-12T12:00:00Z'),
                    ttlHours: 1
                })
            ).toThrow(TokenExpiredError);
        });

        it('rejects a token whose signature does not match the secret', () => {
            const token = generateVerificationToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: SECRET
            });

            expect(() => verifyVerificationToken({ token, secret: 'a-different-secret' })).toThrow(
                InvalidTokenError
            );
        });

        it('rejects a tampered payload segment', () => {
            const token = generateVerificationToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: SECRET
            });

            const [, sig] = token.split('.');
            const tampered = `${Buffer.from('{"sid":"x","ch":"email","iat":1}', 'utf8').toString(
                'base64url'
            )}.${sig}`;

            expect(() => verifyVerificationToken({ token: tampered, secret: SECRET })).toThrow(
                InvalidTokenError
            );
        });

        it('rejects a malformed token (no dot separator)', () => {
            expect(() =>
                verifyVerificationToken({ token: 'no-dot-separator', secret: SECRET })
            ).toThrow(InvalidTokenError);
            expect(() => verifyVerificationToken({ token: '', secret: SECRET })).toThrow(
                InvalidTokenError
            );
        });

        it('rejects a token whose iat is more than a minute in the future', () => {
            const issuedAt = new Date('2026-05-12T13:00:00Z');
            const token = generateVerificationToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                issuedAt,
                secret: SECRET
            });

            // Clock 10 minutes behind issuance -> reject as invalid (not expired).
            expect(() =>
                verifyVerificationToken({
                    token,
                    secret: SECRET,
                    now: new Date('2026-05-12T12:50:00Z')
                })
            ).toThrow(InvalidTokenError);
        });

        it('accepts a token signed with the previous secret during rotation', () => {
            const token = generateVerificationToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: PREV_SECRET
            });

            const payload = verifyVerificationToken({
                token,
                secret: SECRET,
                secretPrev: PREV_SECRET
            });
            expect(payload.subscriberId).toBe(SUBSCRIBER_ID);
        });

        it('throws when the secret is empty at generation time', () => {
            expect(() =>
                generateVerificationToken({
                    subscriberId: SUBSCRIBER_ID,
                    channel: 'email',
                    secret: ''
                })
            ).toThrow(InvalidTokenError);
        });
    });

    // --------------------------------------------------------------------
    // Unsubscribe token
    // --------------------------------------------------------------------

    describe('generateUnsubscribeToken / verifyUnsubscribeToken', () => {
        it('round-trips a valid token', () => {
            const token = generateUnsubscribeToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: SECRET
            });
            const payload = verifyUnsubscribeToken({ token, secret: SECRET });
            expect(payload.subscriberId).toBe(SUBSCRIBER_ID);
            expect(payload.channel).toBe('email');
        });

        it('is deterministic: same input produces the same token', () => {
            const t1 = generateUnsubscribeToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: SECRET
            });
            const t2 = generateUnsubscribeToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: SECRET
            });
            expect(t1).toBe(t2);
        });

        it('changes with the secret (rotated secret invalidates old tokens)', () => {
            const t1 = generateUnsubscribeToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: SECRET
            });
            const t2 = generateUnsubscribeToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: PREV_SECRET
            });
            expect(t1).not.toBe(t2);
        });

        it('accepts a token signed with the previous secret during rotation', () => {
            const token = generateUnsubscribeToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: PREV_SECRET
            });
            const payload = verifyUnsubscribeToken({
                token,
                secret: SECRET,
                secretPrev: PREV_SECRET
            });
            expect(payload.subscriberId).toBe(SUBSCRIBER_ID);
        });

        it('rejects a tampered token', () => {
            const token = generateUnsubscribeToken({
                subscriberId: SUBSCRIBER_ID,
                channel: 'email',
                secret: SECRET
            });
            const [payload] = token.split('.');
            const tampered = `${payload}.AAAA`; // garbage signature

            expect(() => verifyUnsubscribeToken({ token: tampered, secret: SECRET })).toThrow(
                InvalidTokenError
            );
        });

        it('rejects an unknown channel in the payload', () => {
            // Manually craft a token with an invalid channel to make sure the
            // channel guard fires.
            const fakePayload = Buffer.from(
                JSON.stringify({ sid: SUBSCRIBER_ID, ch: 'sms' }),
                'utf8'
            ).toString('base64url');
            const { createHmac } = require('node:crypto') as typeof import('node:crypto');
            const sig = createHmac('sha256', SECRET).update(fakePayload).digest('base64url');
            const token = `${fakePayload}.${sig}`;

            expect(() => verifyUnsubscribeToken({ token, secret: SECRET })).toThrow(
                InvalidTokenError
            );
        });
    });
});
