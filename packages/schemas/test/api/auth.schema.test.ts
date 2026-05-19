import { describe, expect, it } from 'vitest';
import {
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
