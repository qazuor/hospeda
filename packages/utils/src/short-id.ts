/**
 * Short, human-transcribable identifiers (HOS-981).
 *
 * These ids end up printed inside a QR code's URL, and a QR is read by a camera
 * most of the time and by a person the rest of the time — when the sticker is
 * scuffed, the light is bad, or the phone has no camera permission. That second
 * reader is what shapes this module: the alphabet drops every character pair a
 * person confuses when copying a URL off a sticker into a browser bar.
 *
 * @module utils/short-id
 */

import { customAlphabet } from 'nanoid';

/**
 * Alphabet for short ids: digits and letters minus the ambiguous ones.
 *
 * Removed on purpose, and each removal costs entropy we can afford:
 * - `0` / `O` / `o` — indistinguishable in most print faces.
 * - `1` / `l` / `I` — the classic three-way collision; `l` vs `1` in a
 *   hand-typed URL is a 404 that looks like a broken QR.
 * - `U` / `u` — reads as `V` in condensed faces used on small labels.
 *
 * Everything left is `[A-Za-z0-9]`, so an id is URL-safe with no escaping and
 * survives being pasted into a path segment untouched. Note the alphabet is
 * case-SENSITIVE: it keeps both cases of the surviving letters, so a slug must
 * be compared case-sensitively (`a1B` and `A1b` are different ids).
 */
export const SHORT_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTVWXYZabcdefghijkmnpqrstvwxyz';

/** Default id length. */
export const SHORT_ID_DEFAULT_LENGTH = 8;

/** Smallest length this generator will produce. */
export const SHORT_ID_MIN_LENGTH = 4;

/** Largest length this generator will produce. */
export const SHORT_ID_MAX_LENGTH = 64;

/**
 * Generates a short, URL-safe, human-transcribable identifier.
 *
 * With the default length of 8 and a 54-character alphabet the space is
 * ~54^8 ≈ 7.2 × 10^13 ids, which leaves collisions negligible at any volume of
 * printed codes this platform will ever reach. The caller is still expected to
 * enforce uniqueness at the storage layer (`qr_codes.slug` is UNIQUE) — this
 * function makes a collision improbable, not impossible.
 *
 * @param input - Options object (RO-RO).
 * @param input.length - Number of characters to generate. Defaults to
 *   {@link SHORT_ID_DEFAULT_LENGTH}; must be an integer between
 *   {@link SHORT_ID_MIN_LENGTH} and {@link SHORT_ID_MAX_LENGTH}.
 * @returns The generated identifier.
 * @throws {RangeError} If `length` is not an integer within the allowed range.
 *
 * @example
 * ```ts
 * generateShortId();              // 'k7Qm2XbT'
 * generateShortId({ length: 12 });// 'R4dnW9pKvJ2s'
 * ```
 */
export function generateShortId(input: { length?: number } = {}): string {
    const length = input.length ?? SHORT_ID_DEFAULT_LENGTH;

    if (!Number.isInteger(length) || length < SHORT_ID_MIN_LENGTH || length > SHORT_ID_MAX_LENGTH) {
        throw new RangeError(
            `generateShortId: length must be an integer between ${SHORT_ID_MIN_LENGTH} and ${SHORT_ID_MAX_LENGTH}, received ${String(length)}`
        );
    }

    return customAlphabet(SHORT_ID_ALPHABET, length)();
}

/**
 * Tells whether a string could have been produced by {@link generateShortId}.
 *
 * Shape only — it says nothing about whether the id exists. Useful for
 * rejecting obviously malformed slugs before they reach a database lookup.
 *
 * @param input - Options object (RO-RO).
 * @param input.value - Candidate string.
 * @returns `true` when every character belongs to {@link SHORT_ID_ALPHABET} and
 *   the length is within the allowed range.
 */
export function isShortId(input: { value: string }): boolean {
    const { value } = input;

    if (value.length < SHORT_ID_MIN_LENGTH || value.length > SHORT_ID_MAX_LENGTH) {
        return false;
    }

    for (const char of value) {
        if (!SHORT_ID_ALPHABET.includes(char)) {
            return false;
        }
    }

    return true;
}
