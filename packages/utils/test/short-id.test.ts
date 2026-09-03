/**
 * Tests for the short-id generator (HOS-981).
 *
 * @module test/short-id
 */

import { describe, expect, it } from 'vitest';
import {
    generateShortId,
    isShortId,
    SHORT_ID_ALPHABET,
    SHORT_ID_DEFAULT_LENGTH,
    SHORT_ID_MAX_LENGTH,
    SHORT_ID_MIN_LENGTH
} from '../src/short-id';

/**
 * The characters this alphabet exists to exclude. If any of them ever shows up
 * in a generated id, a person copying a printed URL by hand will produce a 404
 * that looks like a broken QR code.
 */
const AMBIGUOUS_CHARACTERS = ['0', 'O', 'o', '1', 'l', 'I', 'U', 'u'];

describe('SHORT_ID_ALPHABET', () => {
    it('excludes every ambiguous character', () => {
        for (const char of AMBIGUOUS_CHARACTERS) {
            expect(SHORT_ID_ALPHABET).not.toContain(char);
        }
    });

    it('is URL-safe: only unreserved alphanumerics', () => {
        expect(SHORT_ID_ALPHABET).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('has no duplicate characters', () => {
        expect(new Set(SHORT_ID_ALPHABET).size).toBe(SHORT_ID_ALPHABET.length);
    });
});

describe('generateShortId', () => {
    it('produces an id of the default length when none is given', () => {
        const id = generateShortId();

        expect(id).toHaveLength(SHORT_ID_DEFAULT_LENGTH);
    });

    it('honours an explicit length', () => {
        for (const length of [SHORT_ID_MIN_LENGTH, 8, 12, SHORT_ID_MAX_LENGTH]) {
            expect(generateShortId({ length })).toHaveLength(length);
        }
    });

    it('only ever emits characters from the alphabet', () => {
        const forbidden = new RegExp(`[^${SHORT_ID_ALPHABET}]`);

        for (let i = 0; i < 500; i++) {
            expect(generateShortId({ length: 16 })).not.toMatch(forbidden);
        }
    });

    /**
     * Not a proof of uniqueness — a collision is possible in principle. What is
     * pinned here is that the generator is actually random rather than, say,
     * returning a constant or a counter with a fixed prefix, which a shape-only
     * assertion would happily accept.
     */
    it('does not collide across 20000 generations at the default length', () => {
        const seen = new Set<string>();

        for (let i = 0; i < 20000; i++) {
            seen.add(generateShortId());
        }

        expect(seen.size).toBe(20000);
    });

    it('rejects a length outside the allowed range', () => {
        expect(() => generateShortId({ length: SHORT_ID_MIN_LENGTH - 1 })).toThrow(RangeError);
        expect(() => generateShortId({ length: SHORT_ID_MAX_LENGTH + 1 })).toThrow(RangeError);
        expect(() => generateShortId({ length: 0 })).toThrow(RangeError);
        expect(() => generateShortId({ length: -8 })).toThrow(RangeError);
    });

    it('rejects a non-integer length', () => {
        expect(() => generateShortId({ length: 8.5 })).toThrow(RangeError);
        expect(() => generateShortId({ length: Number.NaN })).toThrow(RangeError);
    });
});

describe('isShortId', () => {
    it('accepts what the generator produces', () => {
        for (let i = 0; i < 200; i++) {
            expect(isShortId({ value: generateShortId() })).toBe(true);
        }
    });

    it('rejects a value carrying an ambiguous character', () => {
        expect(isShortId({ value: 'abcdefg0' })).toBe(false);
        expect(isShortId({ value: 'abcdefgl' })).toBe(false);
        expect(isShortId({ value: 'abcdefgI' })).toBe(false);
    });

    it('rejects a value carrying a non-URL-safe character', () => {
        expect(isShortId({ value: 'abcd-efg' })).toBe(false);
        expect(isShortId({ value: 'abcd/efg' })).toBe(false);
        expect(isShortId({ value: 'abcd efg' })).toBe(false);
    });

    it('rejects lengths outside the allowed range', () => {
        expect(isShortId({ value: '' })).toBe(false);
        expect(isShortId({ value: 'abc' })).toBe(false);
        expect(isShortId({ value: 'a'.repeat(SHORT_ID_MAX_LENGTH + 1) })).toBe(false);
    });
});
