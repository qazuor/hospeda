/**
 * Unit tests for normalizer utilities.
 *
 * Covers normalizePhoneNumber, normalizeContactInfo, normalizeAdminInfo.
 */

import { ContactInfoSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeAdminInfo,
    normalizeContactInfo,
    normalizePhoneNumber
} from '../../src/utils/normalizer';

// ---------------------------------------------------------------------------
// normalizePhoneNumber
// ---------------------------------------------------------------------------

describe('normalizePhoneNumber()', () => {
    it.each([
        ['3442 45-2345', '+543442452345'],
        ['3442452345', '+543442452345'],
        ['(3442) 45-2345', '+543442452345'],
        ['03442 452345', '+543442452345'],
        ['3442 15 45-2345', '+5493442452345'],
        ['+54 9 3442 45-2345', '+5493442452345'],
        ['+5493442452345', '+5493442452345'],
        ['54 3442 452345', '+543442452345']
    ])('normalizes Argentine format %s to %s', (phone, expected) =>
        expect(normalizePhoneNumber(phone, false)).toBe(expected));

    it('should keep number that already starts with +', () => {
        expect(normalizePhoneNumber('+541155550002', false)).toBe('+541155550002');
    });

    it.each([
        '+65 6123 4567',
        '+1 555123456'
    ])('preserves non-Argentine international number %s', (phone) => {
        expect(normalizePhoneNumber(phone)).toBe(phone.replace(/\s/g, ''));
    });

    it.each([
        ['011 15 2345-6789', '+5491123456789'],
        ['0223 15 412-3456', '+5492234123456']
    ])('normalizes domestic mobile %s without trunk/15', (phone, expected) => {
        expect(normalizePhoneNumber(phone)).toBe(expected);
    });

    it('preserves the HOS-1027 international mobile canonical', () => {
        expect(normalizePhoneNumber('+54 9344 4123456')).toBe('+5493444123456');
    });

    it('should strip formatting characters from international number', () => {
        expect(normalizePhoneNumber('+54 11 5555-0002', false)).toBe('+541155550002');
    });

    it('should prefix with + when number starts with 54 (country code)', () => {
        expect(normalizePhoneNumber('541155550002', false)).toBe('+541155550002');
    });

    it('should prefix with +54 when number starts with 11 (Argentine mobile)', () => {
        expect(normalizePhoneNumber('11 5555-0002', false)).toBe('+541155550002');
    });

    it('should prefix with +54 when number starts with 15 (Argentine mobile alt)', () => {
        expect(normalizePhoneNumber('155550002', false)).toBe('+54155550002');
    });

    it('uses the field meaning for an ambiguous bare number', () => {
        expect(normalizePhoneNumber('3442452345', false)).toBe('+543442452345');
        expect(normalizePhoneNumber('3442452345', true)).toBe('+5493442452345');
    });
});

describe('normalizePhoneNumber() output always passes the validator (HOS-2034)', () => {
    const inputs = [
        '3442 45-2345',
        '3442452345',
        '(3442) 45-2345',
        '03442 452345',
        '3442 15 45-2345',
        '+54 9 3442 45-2345',
        '+5493442452345',
        '54 3442 452345',
        '3415123456',
        '+54 3415 123456',
        '+54115550002',
        '+549345704627',
        '+54934515732848',
        '+65 6123 4567',
        '+1 5551234567'
    ];

    it.each(inputs)('%s', (input) => {
        for (const field of ['mobilePhone', 'homePhone', 'workPhone', 'whatsapp'] as const) {
            const out = normalizeContactInfo({ [field]: input }) as Record<string, string>;
            expect(ContactInfoSchema.safeParse({ [field]: input }).success).toBe(true);
            expect(ContactInfoSchema.safeParse({ [field]: out[field] }).success).toBe(true);
            expect((normalizeContactInfo(out) as Record<string, string>)[field]).toBe(out[field]);
        }
    });

    it('does not strip a 15 from an international number of the right length', () => {
        expect(normalizePhoneNumber('+54 3415 123456', false)).toBe('+543415123456');
        expect(normalizePhoneNumber('+54 3415 123456', true)).toBe('+5493415123456');
    });
});

// ---------------------------------------------------------------------------
// normalizeContactInfo
// ---------------------------------------------------------------------------

describe('normalizeContactInfo()', () => {
    it('should return non-object input as-is', () => {
        expect(normalizeContactInfo(null)).toBeNull();
        expect(normalizeContactInfo('string')).toBe('string');
        expect(normalizeContactInfo(42)).toBe(42);
    });

    it('should normalize mobilePhone', () => {
        const result = normalizeContactInfo({ mobilePhone: '+54 11 5555-0001' }) as Record<
            string,
            unknown
        >;
        expect(result.mobilePhone).toBe('+5491155550001');
    });

    it('should normalize homePhone', () => {
        // Arrange — homePhone branch (line 74-76 uncovered)
        const result = normalizeContactInfo({ homePhone: '541155550002' }) as Record<
            string,
            unknown
        >;
        expect(result.homePhone).toBe('+541155550002');
    });

    it('should normalize workPhone', () => {
        // Arrange — workPhone branch (line 77-79 uncovered)
        const result = normalizeContactInfo({ workPhone: '11 5555-0003' }) as Record<
            string,
            unknown
        >;
        expect(result.workPhone).toBe('+541155550003');
    });

    it('should normalize whatsapp', () => {
        const result = normalizeContactInfo({ whatsapp: '11 5555-0004' }) as Record<
            string,
            unknown
        >;
        expect(result.whatsapp).toBe('+5491155550004');
    });

    it('uses mobile canonical for mobilePhone and whatsapp and landline canonical for homePhone', () => {
        const result = normalizeContactInfo({
            homePhone: '3442 45-2345',
            mobilePhone: '3442 45-2345',
            whatsapp: '3442 45-2345'
        }) as Record<string, unknown>;
        expect(result.homePhone).toBe('+543442452345');
        expect(result.mobilePhone).toBe('+5493442452345');
        expect(result.whatsapp).toBe('+5493442452345');
    });

    it('should normalize mobilePhone and whatsapp to the exact same value when given the same input (regression HOS-1027)', () => {
        // Arrange — a single submit with the same number typed in both fields, one with a
        // separating space (as composePhoneValue produces) and the other without, mirroring
        // what was measured in staging before the fix.
        const result = normalizeContactInfo({
            mobilePhone: '+543442453797',
            whatsapp: '+54 3442453797'
        }) as Record<string, unknown>;

        expect(result.whatsapp).toBe(result.mobilePhone);
    });

    it('should normalize personalEmail to lowercase trimmed', () => {
        const result = normalizeContactInfo({ personalEmail: '  USER@EXAMPLE.COM  ' }) as Record<
            string,
            unknown
        >;
        expect(result.personalEmail).toBe('user@example.com');
    });

    it('should normalize workEmail to lowercase trimmed', () => {
        // Arrange — workEmail branch (line 85-87 uncovered)
        const result = normalizeContactInfo({ workEmail: '  WORK@EXAMPLE.COM  ' }) as Record<
            string,
            unknown
        >;
        expect(result.workEmail).toBe('work@example.com');
    });

    it('should normalize all fields simultaneously', () => {
        const result = normalizeContactInfo({
            mobilePhone: '+54 11 1111-1111',
            homePhone: '+54 11 2222-2222',
            workPhone: '+54 11 3333-3333',
            whatsapp: '+54 11 4444-4444',
            personalEmail: ' PERSONAL@TEST.COM ',
            workEmail: ' WORK@TEST.COM ',
            otherField: 'preserved'
        }) as Record<string, unknown>;

        expect(result.mobilePhone).toBe('+5491111111111');
        expect(result.homePhone).toBe('+541122222222');
        expect(result.workPhone).toBe('+541133333333');
        expect(result.whatsapp).toBe('+5491144444444');
        expect(result.personalEmail).toBe('personal@test.com');
        expect(result.workEmail).toBe('work@test.com');
        expect(result.otherField).toBe('preserved');
    });

    it('should not normalize fields that are not strings', () => {
        const result = normalizeContactInfo({
            mobilePhone: 123456,
            homePhone: null,
            whatsapp: undefined
        }) as Record<string, unknown>;
        expect(result.mobilePhone).toBe(123456);
        expect(result.homePhone).toBeNull();
        expect(result.whatsapp).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// normalizeAdminInfo
// ---------------------------------------------------------------------------

describe('normalizeAdminInfo()', () => {
    it('should return undefined for null/non-object input', () => {
        expect(normalizeAdminInfo(null)).toBeUndefined();
        expect(normalizeAdminInfo('string')).toBeUndefined();
        expect(normalizeAdminInfo(42)).toBeUndefined();
    });

    it('should return undefined when both notes and favorite are absent', () => {
        expect(normalizeAdminInfo({})).toBeUndefined();
        expect(normalizeAdminInfo({ otherField: 'x' })).toBeUndefined();
    });

    it('should include notes when present', () => {
        const result = normalizeAdminInfo({ notes: 'A note' });
        expect(result?.notes).toBe('A note');
        expect(result?.favorite).toBe(false);
    });

    it('should preserve boolean favorite value', () => {
        const result = normalizeAdminInfo({ favorite: true });
        expect(result?.favorite).toBe(true);
        expect(result?.notes).toBeUndefined();
    });

    it('should default favorite to false when it is not a boolean', () => {
        const result = normalizeAdminInfo({ notes: 'Note', favorite: 'yes' });
        expect(result?.favorite).toBe(false);
    });
});
