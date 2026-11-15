import { describe, expect, it } from 'vitest';
import {
    PartnerApplicationApproveSchema,
    PartnerApplicationCancelWaitSchema,
    PartnerApplicationSubmitSchema
} from '../partner-application.schema.js';

describe('partner application schemas', () => {
    it('accepts valid email and trims surrounding spaces', () => {
        expect(
            PartnerApplicationSubmitSchema.parse({ email: '  Person@example.test  ' }).email
        ).toBe('Person@example.test');
    });

    it('rejects malformed email', () => {
        expect(PartnerApplicationSubmitSchema.safeParse({ email: 'invalid' }).success).toBe(false);
    });

    it('rejects a blank or whitespace-only cancellation reason', () => {
        expect(PartnerApplicationCancelWaitSchema.safeParse({ reason: '' }).success).toBe(false);
        expect(PartnerApplicationCancelWaitSchema.safeParse({ reason: '   ' }).success).toBe(false);
    });

    it('accepts a valid approval body', () => {
        expect(
            PartnerApplicationApproveSchema.safeParse({
                name: 'Example Partner',
                type: 'business',
                reason: 'Reviewed'
            }).success
        ).toBe(true);
    });

    it('rejects whitespace-only reason, invalid type, and empty name on approval', () => {
        expect(
            PartnerApplicationApproveSchema.safeParse({
                name: 'Example',
                type: 'business',
                reason: '   '
            }).success
        ).toBe(false);
        expect(
            PartnerApplicationApproveSchema.safeParse({
                name: 'Example',
                type: 'invalid',
                reason: 'Reviewed'
            }).success
        ).toBe(false);
        expect(
            PartnerApplicationApproveSchema.safeParse({
                name: '',
                type: 'business',
                reason: 'Reviewed'
            }).success
        ).toBe(false);
    });
});
