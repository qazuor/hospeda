import { describe, expect, it } from 'vitest';
import { ContactSubmitSchema, ContactTypeEnumSchema } from '../../src/contact/submit.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_GENERAL = {
    firstName: 'Ana',
    lastName: 'López',
    email: 'ana@example.com',
    message: 'Quisiera consultar sobre disponibilidad general para enero.',
    type: 'general' as const
};

const VALID_ACCOMMODATION = {
    ...VALID_GENERAL,
    type: 'accommodation' as const,
    accommodationId: VALID_UUID
};

// ---------------------------------------------------------------------------
// ContactSubmitSchema
// ---------------------------------------------------------------------------

describe('ContactSubmitSchema', () => {
    describe('happy path — general inquiry', () => {
        it('should accept a valid general inquiry without accommodationId', () => {
            // Arrange
            const input = { ...VALID_GENERAL };

            // Act
            const result = ContactSubmitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('general');
                expect(result.data.accommodationId).toBeUndefined();
            }
        });

        it('should accept a general inquiry with honeypot website field empty', () => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL, website: '' });
            expect(result.success).toBe(true);
        });

        it('should accept a general inquiry with honeypot website field populated (schema allows it)', () => {
            // The schema does not reject it — the API handler discards the request silently
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                website: 'https://bot.example.com'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.website).toBe('https://bot.example.com');
            }
        });

        it('should accept message at exactly 10 characters (minimum)', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                message: '1234567890'
            });
            expect(result.success).toBe(true);
        });

        it('should accept message at exactly 2000 characters (maximum)', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                message: 'x'.repeat(2000)
            });
            expect(result.success).toBe(true);
        });
    });

    describe('happy path — accommodation inquiry', () => {
        it('should accept a valid accommodation inquiry with accommodationId', () => {
            // Arrange
            const input = { ...VALID_ACCOMMODATION };

            // Act
            const result = ContactSubmitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('accommodation');
                expect(result.data.accommodationId).toBe(VALID_UUID);
            }
        });
    });

    describe('accommodationId is optional regardless of type', () => {
        // Historical note: pre-2026-05 the schema enforced
        //   type === 'accommodation' → accommodationId required.
        // The contact form expansion (9 categories) removed that
        // constraint — `accommodation` is now a DEPRECATED legacy
        // value kept for schema-compat, and the form no longer
        // surfaces an accommodation-specific flow. accommodationId
        // is plain-optional now.
        it('should accept type=accommodation without accommodationId', () => {
            const input = {
                ...VALID_GENERAL,
                type: 'accommodation' as const
                // accommodationId intentionally absent
            };
            const result = ContactSubmitSchema.safeParse(input);
            expect(result.success).toBe(true);
        });

        it('should accept type=general without accommodationId', () => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL });
            expect(result.success).toBe(true);
        });

        it('should accept type=accommodation with a valid UUID accommodationId', () => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_ACCOMMODATION });
            expect(result.success).toBe(true);
        });

        it('should reject type=accommodation with a malformed UUID accommodationId', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_ACCOMMODATION,
                accommodationId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('firstName validation', () => {
        it('should reject an empty firstName', () => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL, firstName: '' });
            expect(result.success).toBe(false);
        });

        it('should reject firstName exceeding 100 characters', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                firstName: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });

        it('should accept firstName at exactly 100 characters', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                firstName: 'a'.repeat(100)
            });
            expect(result.success).toBe(true);
        });
    });

    describe('lastName validation', () => {
        it('should reject an empty lastName', () => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL, lastName: '' });
            expect(result.success).toBe(false);
        });

        it('should reject lastName exceeding 100 characters', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                lastName: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('email validation', () => {
        it('should reject an invalid email address', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                email: 'not-an-email'
            });
            expect(result.success).toBe(false);
        });

        it('should reject email without domain part', () => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL, email: 'user@' });
            expect(result.success).toBe(false);
        });
    });

    describe('message validation', () => {
        it('should reject message with fewer than 10 characters', () => {
            // Arrange
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                message: 'Short'
            });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.path.includes('message'))).toBe(true);
            }
        });

        it('should reject an empty message', () => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL, message: '' });
            expect(result.success).toBe(false);
        });

        it('should reject message exceeding 2000 characters', () => {
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                message: 'x'.repeat(2001)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('type validation', () => {
        it('should reject an unknown type value', () => {
            // `support` is now a VALID enum value (added with the 9-category
            // expansion). Use a clearly bogus string instead.
            const result = ContactSubmitSchema.safeParse({
                ...VALID_GENERAL,
                type: 'this-is-not-a-valid-contact-type' as 'general'
            });
            expect(result.success).toBe(false);
        });

        it('should reject when type is missing', () => {
            const { type: _type, ...rest } = VALID_GENERAL;
            const result = ContactSubmitSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });

    describe('contribution types (SPEC-191, additive-only)', () => {
        const CONTRIBUTION_TYPES = [
            'report_destination_info',
            'photo_submission',
            'editor_application'
        ] as const;

        /**
         * The nine pre-SPEC-191 types plus the deprecated legacy value.
         * Frozen here on purpose: if any of these stops parsing, the
         * additive-only compatibility policy has been violated.
         */
        const PRE_EXISTING_TYPES = [
            'general',
            'support',
            'publish_accommodation',
            'subscriptions',
            'suggestions',
            'report',
            'press',
            'partnerships',
            'event_submission',
            'accommodation'
        ] as const;

        it.each(CONTRIBUTION_TYPES)('should accept the new contribution type "%s"', (type) => {
            const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL, type });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe(type);
            }
        });

        it.each(PRE_EXISTING_TYPES)(
            'should still accept the pre-existing type "%s" (historic-fixture compat)',
            (type) => {
                const result = ContactSubmitSchema.safeParse({ ...VALID_GENERAL, type });
                expect(result.success).toBe(true);
            }
        );

        it('should keep the pre-existing enum values in their original order (additive append only)', () => {
            // Guards against reordering/removal: the first ten options must be
            // exactly the pre-SPEC-191 list, with the new types appended after.
            expect(ContactTypeEnumSchema.options.slice(0, PRE_EXISTING_TYPES.length)).toEqual([
                ...PRE_EXISTING_TYPES
            ]);
            expect(ContactTypeEnumSchema.options.slice(PRE_EXISTING_TYPES.length)).toEqual([
                ...CONTRIBUTION_TYPES
            ]);
        });
    });

    describe('required fields', () => {
        it('should reject when firstName is missing', () => {
            const { firstName: _fn, ...rest } = VALID_GENERAL;
            const result = ContactSubmitSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when lastName is missing', () => {
            const { lastName: _ln, ...rest } = VALID_GENERAL;
            const result = ContactSubmitSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when email is missing', () => {
            const { email: _em, ...rest } = VALID_GENERAL;
            const result = ContactSubmitSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when message is missing', () => {
            const { message: _msg, ...rest } = VALID_GENERAL;
            const result = ContactSubmitSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });
});
