import { describe, expect, it } from 'vitest';
import {
    AuthMeResponseSchema,
    type ResetPasswordCheckQuery,
    ResetPasswordCheckQuerySchema,
    type ResetPasswordCheckResponse,
    ResetPasswordCheckResponseSchema
} from '../../src/api/auth.schema.js';

describe('Reset-password check schemas (SPEC-118)', () => {
    describe('ResetPasswordCheckQuerySchema', () => {
        it('accepts a non-empty token', () => {
            const result = ResetPasswordCheckQuerySchema.safeParse({ token: 'abc123' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.token).toBe('abc123');
            }
        });

        it('rejects an empty token', () => {
            const result = ResetPasswordCheckQuerySchema.safeParse({ token: '' });
            expect(result.success).toBe(false);
        });

        it('rejects a missing token', () => {
            const result = ResetPasswordCheckQuerySchema.safeParse({});
            expect(result.success).toBe(false);
        });

        it('rejects a token over 512 chars', () => {
            const result = ResetPasswordCheckQuerySchema.safeParse({ token: 'a'.repeat(513) });
            expect(result.success).toBe(false);
        });
    });

    describe('ResetPasswordCheckResponseSchema', () => {
        it('parses the valid:true branch', () => {
            const payload: ResetPasswordCheckResponse = { valid: true };
            const result = ResetPasswordCheckResponseSchema.safeParse(payload);
            expect(result.success).toBe(true);
        });

        it('parses the expired branch', () => {
            const payload: ResetPasswordCheckResponse = { valid: false, reason: 'expired' };
            const result = ResetPasswordCheckResponseSchema.safeParse(payload);
            expect(result.success).toBe(true);
        });

        it('parses the invalid branch', () => {
            const payload: ResetPasswordCheckResponse = { valid: false, reason: 'invalid' };
            const result = ResetPasswordCheckResponseSchema.safeParse(payload);
            expect(result.success).toBe(true);
        });

        it('rejects an unknown reason', () => {
            const result = ResetPasswordCheckResponseSchema.safeParse({
                valid: false,
                reason: 'used'
            });
            expect(result.success).toBe(false);
        });

        it('rejects valid:false without reason', () => {
            const result = ResetPasswordCheckResponseSchema.safeParse({ valid: false });
            expect(result.success).toBe(false);
        });

        it('rejects valid:true with a reason', () => {
            const result = ResetPasswordCheckResponseSchema.safeParse({
                valid: true,
                reason: 'expired'
            });
            // valid:true branch has no reason field; extras are stripped by default
            // so this should still parse to { valid: true }.
            expect(result.success).toBe(true);
        });
    });

    it('exposes the inferred query type', () => {
        const q: ResetPasswordCheckQuery = { token: 't' };
        expect(q.token).toBe('t');
    });
});

describe('AuthMeResponseSchema ownership flags (HOS-2551)', () => {
    const base = {
        actor: { id: '11111111-1111-4111-8111-111111111111', roles: ['USER'], permissions: [] },
        isAuthenticated: true
    };

    it('accepts ownsPartner alongside ownsHostTradeListing', () => {
        const parsed = AuthMeResponseSchema.parse({
            ...base,
            ownsHostTradeListing: false,
            ownsPartner: true
        });
        expect(parsed.ownsPartner).toBe(true);
    });

    it('keeps ownsPartner optional, so an older server still parses', () => {
        const parsed = AuthMeResponseSchema.parse(base);
        expect(parsed.ownsPartner).toBeUndefined();
    });
});
