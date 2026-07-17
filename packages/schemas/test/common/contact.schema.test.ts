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

describe('ContactInfoSchema', () => {
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
            expect(result.error.issues[0]?.message).toBe(
                'zodError.common.contact.mobilePhone.international'
            );
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
