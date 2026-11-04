/**
 * Tests for the shared contact schema (`ContactInfoSchema`).
 *
 * Pins the HOS-190 fix: `mobilePhone` used to be the only required field on
 * an otherwise fully-optional schema. A legacy accommodation (or any other
 * entity deriving from `ContactInfoSchema` / `BaseContactFields`) persisted
 * without a `mobilePhone` value 500'd on read, fail-closed-locking the owner
 * out of both viewing and editing the record. `mobilePhone` is now
 * `.optional()`, matching `homePhone` / `workPhone` / `whatsapp`.
 *
 * @module test/common/contact.schema
 */
import { describe, expect, it } from 'vitest';
import { ContactInfoSchema } from '../../src/common/contact.schema.js';
import { AccommodationUpdateHttpSchema } from '../../src/entities/accommodation/accommodation.http.schema.js';
import { ExperienceUpdateHttpSchema } from '../../src/entities/experience/experience.http.schema.js';
import { VenueUpdateHttpSchema } from '../../src/entities/venue/venue.http.schema.js';

describe('ContactInfoSchema', () => {
    it.each([
        '3442 45-2345',
        '3442452345',
        '(3442) 45-2345',
        '03442 452345',
        '3442 15 45-2345',
        '+54 9 3442 45-2345',
        '+5493442452345',
        '54 3442 452345'
    ])('accepts common Argentine phone format %s on all phone fields', (phone) => {
        const result = ContactInfoSchema.safeParse({
            homePhone: phone,
            workPhone: phone,
            mobilePhone: phone,
            whatsapp: phone
        });
        expect(result.success).toBe(true);
    });

    it.each([
        '123',
        '+54',
        '344245234567890123',
        '3442 ABC-2345'
    ])('rejects invalid phone format %s with a human localized key', (phone) => {
        const result = ContactInfoSchema.safeParse({ mobilePhone: phone });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('zodError.common.contact.phone.argentina');
        }
    });

    it.each([
        '3442 45-2345',
        '03442 452345',
        '+54 9 3442 45-2345'
    ])('accepts %s through the accommodation API write schema', (phone) => {
        expect(AccommodationUpdateHttpSchema.safeParse({ phone, whatsapp: phone }).success).toBe(
            true
        );
    });

    it.each([
        ['venue', VenueUpdateHttpSchema],
        ['experience', ExperienceUpdateHttpSchema]
    ] as const)('uses the shared phone validator for the %s editor API', (_entity, schema) => {
        expect(schema.safeParse({ phone: '3442 45-2345' }).success).toBe(true);
        expect(schema.safeParse({ phone: '3442 invalid' }).success).toBe(false);
    });

    it('accepts a payload with no mobilePhone (HOS-190 regression)', () => {
        const result = ContactInfoSchema.safeParse({ personalEmail: 'a@b.com' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mobilePhone).toBeUndefined();
            expect(result.data.personalEmail).toBe('a@b.com');
        }
    });

    it('accepts an entirely empty object (every field is optional)', () => {
        const result = ContactInfoSchema.safeParse({});

        expect(result.success).toBe(true);
    });

    it('still validates mobilePhone format when it is provided', () => {
        const result = ContactInfoSchema.safeParse({ mobilePhone: 'not-a-phone-number' });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('zodError.common.contact.phone.argentina');
        }
    });

    it('accepts a valid mobilePhone', () => {
        const result = ContactInfoSchema.safeParse({ mobilePhone: '+15550123456' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mobilePhone).toBe('+15550123456');
        }
    });
});
