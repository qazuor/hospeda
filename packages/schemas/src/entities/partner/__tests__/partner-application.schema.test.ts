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
                typeId: '00000000-0000-4000-a000-000000000009',
                reason: 'Reviewed'
            }).success
        ).toBe(true);
    });

    it('rejects whitespace-only reason, a non-uuid typeId, and empty name on approval', () => {
        expect(
            PartnerApplicationApproveSchema.safeParse({
                name: 'Example',
                typeId: '00000000-0000-4000-a000-000000000009',
                reason: '   '
            }).success
        ).toBe(false);
        expect(
            PartnerApplicationApproveSchema.safeParse({
                name: 'Example',
                typeId: 'business',
                reason: 'Reviewed'
            }).success
        ).toBe(false);
        expect(
            PartnerApplicationApproveSchema.safeParse({
                name: '',
                typeId: '00000000-0000-4000-a000-000000000009',
                reason: 'Reviewed'
            }).success
        ).toBe(false);
    });
});
