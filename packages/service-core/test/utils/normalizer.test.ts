/**
 * Unit tests for normalizer utilities.
 *
 * Covers normalizePhoneNumber, normalizeContactInfo, normalizeAdminInfo.
 */

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
    it('should keep number that already starts with +', () => {
        expect(normalizePhoneNumber('+541155550002')).toBe('+541155550002');
    });

    it('should strip formatting characters from international number', () => {
        expect(normalizePhoneNumber('+54 11 5555-0002')).toBe('+541155550002');
    });

    it('should prefix with + when number starts with 54 (country code)', () => {
        expect(normalizePhoneNumber('541155550002')).toBe('+541155550002');
    });

    it('should prefix with +54 when number starts with 11 (Argentine mobile)', () => {
        expect(normalizePhoneNumber('11 5555-0002')).toBe('+541155550002');
    });

    it('should prefix with +54 when number starts with 15 (Argentine mobile alt)', () => {
        expect(normalizePhoneNumber('155550002')).toBe('+54155550002');
    });

    it('should default to +54 prefix for other number formats', () => {
        expect(normalizePhoneNumber('9876543210')).toBe('+549876543210');
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
        expect(result.mobilePhone).toBe('+541155550001');
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
            personalEmail: ' PERSONAL@TEST.COM ',
            workEmail: ' WORK@TEST.COM ',
            otherField: 'preserved'
        }) as Record<string, unknown>;

        expect(result.mobilePhone).toBe('+541111111111');
        expect(result.homePhone).toBe('+541122222222');
        expect(result.workPhone).toBe('+541133333333');
        expect(result.personalEmail).toBe('personal@test.com');
        expect(result.workEmail).toBe('work@test.com');
        expect(result.otherField).toBe('preserved');
    });

    it('should not normalize fields that are not strings', () => {
        const result = normalizeContactInfo({
            mobilePhone: 123456,
            homePhone: null
        }) as Record<string, unknown>;
        expect(result.mobilePhone).toBe(123456);
        expect(result.homePhone).toBeNull();
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
