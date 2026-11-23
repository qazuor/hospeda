import { describe, expect, it } from 'vitest';
import {
    computeInquiryPayloadHash,
    inquiryHashesMatch
} from '../../../src/services/conversation/inquiry-payload-hash.js';

describe('computeInquiryPayloadHash (HOS-2568)', () => {
    const base = { message: 'Hola', guestName: 'Ana', guestPhone: null };

    it('is deterministic and a 64-char hex SHA-256', () => {
        const a = computeInquiryPayloadHash({ payload: base }).hash;
        const b = computeInquiryPayloadHash({ payload: { ...base } }).hash;

        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('treats an absent phone and null phone alike', () => {
        const withNull = computeInquiryPayloadHash({ payload: base }).hash;
        const absent = computeInquiryPayloadHash({
            payload: { message: 'Hola', guestName: 'Ana' }
        }).hash;

        expect(absent).toBe(withNull);
    });

    it.each([
        ['message', { ...base, message: 'Hola!' }],
        ['name', { ...base, guestName: 'Ana B' }],
        ['phone', { ...base, guestPhone: '123' }],
        ['check-in', { ...base, checkIn: '2026-12-12' }],
        ['check-out', { ...base, checkOut: '2026-12-15' }],
        ['guests', { ...base, guests: 3 }],
        ['field boundary', { message: 'HolaAna', guestName: '', guestPhone: null }]
    ])('changes when the %s changes', (_label, other) => {
        expect(computeInquiryPayloadHash({ payload: other }).hash).not.toBe(
            computeInquiryPayloadHash({ payload: base }).hash
        );
    });
});

describe('inquiryHashesMatch (HOS-2568)', () => {
    const expected = computeInquiryPayloadHash({
        payload: { message: 'Hola', guestName: 'Ana' }
    }).hash;

    it('matches an equal hash', () => {
        expect(inquiryHashesMatch({ expected, actual: expected }).matches).toBe(true);
    });

    it.each([
        ['absent', undefined],
        ['not a string', 42],
        ['wrong length', 'abc'],
        ['tampered', `${expected.startsWith('a') ? 'b' : 'a'}${expected.slice(1)}`]
    ])('rejects a %s claim', (_label, actual) => {
        expect(inquiryHashesMatch({ expected, actual }).matches).toBe(false);
    });
});
