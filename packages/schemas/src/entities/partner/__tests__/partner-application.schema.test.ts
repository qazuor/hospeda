import { describe, expect, it } from 'vitest';
import {
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
});
