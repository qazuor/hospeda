/**
 * Tests for the shared phone parser (`parsePhoneNumber`, `normalizeArgentinePhone`,
 * `phoneNumberSchema`). HOS-2034.
 *
 * @module test/utils/phone-number
 */
import { describe, expect, it } from 'vitest';
import {
    InternationalPhoneRegex,
    isValidPhoneNumber,
    normalizeArgentinePhone,
    parsePhoneNumber
} from '../../src/utils/utils.js';

const HUMAN_INPUTS = [
    '3442 45-2345',
    '3442452345',
    '(3442) 45-2345',
    '03442 452345',
    '3442 15 45-2345',
    '+54 9 3442 45-2345',
    '+5493442452345',
    '54 3442 452345'
] as const;

/** Legacy values the pre-HOS-2034 validator (`InternationalPhoneRegex`) accepted. */
const LEGACY_E164 = [
    '+54115550002',
    '+549345704627',
    '+54934515732848',
    '+54 11 5555-0002'.replace('-', ''),
    '+1 5551234567',
    '+65 6123 4567',
    '+5491155550001',
    '+541155550002',
    '+5 4123456',
    '+1234567',
    '+123456789012345'
] as const;

describe('canonical forms', () => {
    it.each([
        // [input, mobile field, landline field]
        ['3442 45-2345', '+5493442452345', '+543442452345'],
        ['3442452345', '+5493442452345', '+543442452345'],
        ['(3442) 45-2345', '+5493442452345', '+543442452345'],
        ['03442 452345', '+5493442452345', '+543442452345'],
        ['3442 15 45-2345', '+5493442452345', '+5493442452345'],
        ['+54 9 3442 45-2345', '+5493442452345', '+5493442452345'],
        ['+5493442452345', '+5493442452345', '+5493442452345'],
        ['54 3442 452345', '+5493442452345', '+543442452345'],
        ['011 15 2345-6789', '+5491123456789', '+5491123456789'],
        ['+54 11 2345-6789', '+5491123456789', '+541123456789'],
        ['+65 6123 4567', '+6561234567', '+6561234567']
    ])('%s -> mobile %s / landline %s', (input, mobile, landline) => {
        expect(normalizeArgentinePhone(input, true)).toBe(mobile);
        expect(normalizeArgentinePhone(input, false)).toBe(landline);
    });

    it('is idempotent on canonical forms', () => {
        for (const canonical of ['+5493442452345', '+543442452345', '+6561234567']) {
            expect(normalizeArgentinePhone(canonical, false)).toBe(canonical);
        }
        expect(normalizeArgentinePhone('+5493442452345', true)).toBe('+5493442452345');
    });
});

describe('15 / 0 handling is national-format only', () => {
    it('does not strip a 15 that is part of an international number of the right length', () => {
        // area code 3415 + number: the "15" sits at index 2 of the national part
        expect(normalizeArgentinePhone('+54 3415 123456', false)).toBe('+543415123456');
        expect(normalizeArgentinePhone('+54 9 11 1523 4567', true)).toBe('+5491115234567');
        expect(normalizeArgentinePhone('541115234567', false)).toBe('+541115234567');
    });

    it('does not strip a 15 from a 10-digit national number', () => {
        expect(parsePhoneNumber('3415123456')).toEqual({
            kind: 'argentina',
            digits: '3415123456',
            mobile: false
        });
        expect(parsePhoneNumber('1115234567')).toEqual({
            kind: 'argentina',
            digits: '1115234567',
            mobile: false
        });
    });

    it('rejects a 12-digit national number without a 15 marker', () => {
        expect(isValidPhoneNumber('344245234567')).toBe(false);
    });
});

describe('never tightened', () => {
    it.each(LEGACY_E164)('legacy %s still validates and is kept as E.164', (phone) => {
        expect(InternationalPhoneRegex.test(phone)).toBe(true);
        expect(isValidPhoneNumber(phone)).toBe(true);
        const normalized = normalizeArgentinePhone(phone, false);
        expect(isValidPhoneNumber(normalized)).toBe(true);
        expect(InternationalPhoneRegex.test(normalized)).toBe(true);
    });

    it('keeps non-54 and odd-length +54 legacy values untouched', () => {
        expect(normalizeArgentinePhone('+54934515732848', true)).toBe('+54934515732848');
        expect(normalizeArgentinePhone('+549345704627', true)).toBe('+549345704627');
        expect(normalizeArgentinePhone('+1 5551234567', true)).toBe('+15551234567');
    });
});

describe('rejections', () => {
    it.each([
        '',
        '123',
        '+54',
        '3442 ABC-2345',
        '344245234567890123',
        '+0123456789'
    ])('rejects %j', (phone) => {
        expect(isValidPhoneNumber(phone)).toBe(false);
    });
});

describe('normalize(x) always validates (validator and normalizer share one parser)', () => {
    const corpus = [...HUMAN_INPUTS, ...LEGACY_E164, '011 15 2345-6789', '3415123456'];
    it.each(corpus)('%s', (input) => {
        for (const mobile of [true, false]) {
            expect(isValidPhoneNumber(input)).toBe(true);
            const out = normalizeArgentinePhone(input, mobile);
            expect(isValidPhoneNumber(out)).toBe(true);
            // second pass changes nothing
            expect(normalizeArgentinePhone(out, mobile)).toBe(out);
        }
    });
});
