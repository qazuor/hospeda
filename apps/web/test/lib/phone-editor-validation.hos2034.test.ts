/**
 * @file phone-editor-validation.hos2034.test.ts
 * @description HOS-2034: the editors reject too-short Argentine input while the
 * shared schema keeps accepting stored legacy values.
 */

import { ContactInfoSchema, VenueOwnerUpdateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { AccommodationContactSchema } from '@/components/host/editor/accommodation-edit-form.schema';
import { composePhoneValue, DEFAULT_PHONE_COUNTRY } from '@/lib/phone-countries';
import { isStrictEditorPhone, refineStrictContactPhone } from '@/lib/phone-editor-validation';

const compose = (number: string) => composePhoneValue({ country: DEFAULT_PHONE_COUNTRY, number });

describe('editor strict Argentine phone rule', () => {
    it.each([
        '344245',
        '3442 4523',
        '03442 4523'
    ])('rejects the too-short %s in the accommodation form (phone and whatsapp)', (typed) => {
        const composed = compose(typed);
        // shared schema keeps its legacy E.164 fallback (never tightened)
        expect(ContactInfoSchema.safeParse({ mobilePhone: composed }).success).toBe(true);
        const result = AccommodationContactSchema.safeParse({
            phone: composed,
            whatsapp: composed
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toEqual(expect.arrayContaining(['phone', 'whatsapp']));
        }
    });

    it.each([
        '3442 45-2345',
        '03442 452345',
        '3442 15 45-2345',
        '+54 9 3442 45-2345',
        ''
    ])('accepts the full number %j in the accommodation form', (typed) => {
        const composed = typed ? compose(typed) : '';
        expect(
            AccommodationContactSchema.safeParse({ phone: composed, whatsapp: composed }).success
        ).toBe(true);
    });

    it('lets non-Argentine input through to the shared schema', () => {
        expect(isStrictEditorPhone('+598 99 123 456')).toBe(true);
    });

    it('rejects a too-short phone in the venue/experience editor schema', () => {
        const schema = VenueOwnerUpdateInputSchema.superRefine(refineStrictContactPhone);
        const bad = schema.safeParse({ contactInfo: { mobilePhone: compose('344245') } });
        expect(bad.success).toBe(false);
        if (!bad.success) {
            expect(bad.error.issues.map((i) => i.path.join('.'))).toContain(
                'contactInfo.mobilePhone'
            );
        }
        expect(
            schema.safeParse({ contactInfo: { mobilePhone: compose('3442 45-2345') } }).success
        ).toBe(true);
        expect(schema.safeParse({ contactInfo: { mobilePhone: null } }).success).toBe(true);
    });
});

describe('HOS-2042 optional landline (contactInfo.workPhone) uses the same rule', () => {
    it('rejects a too-short landline in the accommodation form and accepts a real one', () => {
        const bad = AccommodationContactSchema.safeParse({
            landlinePhone: compose('344245')
        });
        expect(bad.success).toBe(false);
        if (!bad.success) {
            expect(bad.error.issues.map((i) => i.path.join('.'))).toContain('landlinePhone');
        }
        expect(
            AccommodationContactSchema.safeParse({ landlinePhone: compose('3442 45-2345') }).success
        ).toBe(true);
        expect(AccommodationContactSchema.safeParse({ landlinePhone: '' }).success).toBe(true);
    });

    it('rejects a too-short landline in the venue/experience editor schema', () => {
        const schema = VenueOwnerUpdateInputSchema.superRefine(refineStrictContactPhone);
        const bad = schema.safeParse({ contactInfo: { workPhone: compose('344245') } });
        expect(bad.success).toBe(false);
        if (!bad.success) {
            expect(bad.error.issues.map((i) => i.path.join('.'))).toContain(
                'contactInfo.workPhone'
            );
        }
        expect(
            schema.safeParse({ contactInfo: { workPhone: compose('3442 45-2345') } }).success
        ).toBe(true);
        expect(schema.safeParse({ contactInfo: { workPhone: null } }).success).toBe(true);
    });
});
