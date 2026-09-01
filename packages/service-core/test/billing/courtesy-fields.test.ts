/**
 * Unit tests for courtesy-fields.ts (HOS-180).
 *
 * This module is the ONLY place that knows where a courtesy window is stored,
 * so its failure modes are the feature's failure modes. Two matter most:
 *
 * 1. A malformed or half-written window must read as ABSENT, never as live —
 *    reading garbage as a live gift hands out free entitlements.
 * 2. Clearing must DELETE the keys rather than null them, so a lapsed window
 *    can never make a later, unrelated pause derive as a courtesy.
 */
import { describe, expect, it } from 'vitest';
import {
    clearCourtesyFields,
    isCourtesyWindowLive,
    readCourtesyFields,
    writeCourtesyFields
} from '../../src/services/billing/subscription/courtesy-fields.js';

const STARTS = new Date('2026-10-01T00:00:00.000Z');
const ENDS = new Date('2026-12-01T00:00:00.000Z');

describe('readCourtesyFields', () => {
    it('reads a window written by writeCourtesyFields (round-trip)', () => {
        // Arrange
        const metadata = writeCourtesyFields({
            metadata: { unrelated: 'keep me' },
            fields: { courtesyStartsAt: STARTS, courtesyEndsAt: ENDS, courtesyCyclesGranted: 2 }
        });
        // Act
        const read = readCourtesyFields(metadata);
        // Assert
        expect(read.courtesyStartsAt?.toISOString()).toBe(STARTS.toISOString());
        expect(read.courtesyEndsAt?.toISOString()).toBe(ENDS.toISOString());
        expect(read.courtesyCyclesGranted).toBe(2);
    });

    it('parses ISO strings, which is what jsonb actually round-trips', () => {
        const read = readCourtesyFields({ courtesyEndsAt: ENDS.toISOString() });
        expect(read.courtesyEndsAt?.getTime()).toBe(ENDS.getTime());
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'nope'],
        ['a number', 7],
        ['an array', []],
        ['an empty object', {}]
    ])('returns an empty window for %s', (_label, metadata) => {
        expect(readCourtesyFields(metadata)).toEqual({
            courtesyStartsAt: null,
            courtesyEndsAt: null,
            courtesyCyclesGranted: null
        });
    });

    it('returns null for an unparseable date rather than an Invalid Date', () => {
        // An Invalid Date would compare false under `>`, which reads as "the
        // gift lapsed" and cuts a subscriber off mid-gift with no error.
        const read = readCourtesyFields({ courtesyEndsAt: 'not-a-date' });
        expect(read.courtesyEndsAt).toBeNull();
    });

    it('rejects a zero or negative cycle count — that is not a gift', () => {
        expect(readCourtesyFields({ courtesyCyclesGranted: 0 }).courtesyCyclesGranted).toBeNull();
        expect(readCourtesyFields({ courtesyCyclesGranted: -3 }).courtesyCyclesGranted).toBeNull();
        expect(readCourtesyFields({ courtesyCyclesGranted: 1.5 }).courtesyCyclesGranted).toBeNull();
    });
});

describe('writeCourtesyFields', () => {
    it('preserves unrelated metadata keys', () => {
        const result = writeCourtesyFields({
            metadata: { addons: ['extra-photos-20'], somethingElse: 1 },
            fields: { courtesyStartsAt: STARTS, courtesyEndsAt: ENDS, courtesyCyclesGranted: 1 }
        });
        expect(result.addons).toEqual(['extra-photos-20']);
        expect(result.somethingElse).toBe(1);
    });

    it('does not mutate the metadata it was given', () => {
        const original = { addons: ['a'] };
        writeCourtesyFields({
            metadata: original,
            fields: { courtesyStartsAt: STARTS, courtesyEndsAt: ENDS, courtesyCyclesGranted: 1 }
        });
        expect(original).toEqual({ addons: ['a'] });
    });
});

describe('clearCourtesyFields', () => {
    it('DELETES the keys rather than nulling them', () => {
        // A lingering key is what would make a later, unrelated pause derive as
        // a courtesy. Absence is unambiguous; a stale value is not.
        const metadata = writeCourtesyFields({
            metadata: { addons: ['a'] },
            fields: { courtesyStartsAt: STARTS, courtesyEndsAt: ENDS, courtesyCyclesGranted: 1 }
        });
        const cleared = clearCourtesyFields(metadata);
        expect('courtesyEndsAt' in cleared).toBe(false);
        expect('courtesyStartsAt' in cleared).toBe(false);
        expect('courtesyCyclesGranted' in cleared).toBe(false);
        expect(cleared.addons).toEqual(['a']);
    });

    it('leaves a cleared window reading as absent', () => {
        const cleared = clearCourtesyFields({ courtesyEndsAt: ENDS.toISOString() });
        expect(readCourtesyFields(cleared).courtesyEndsAt).toBeNull();
    });
});

describe('isCourtesyWindowLive', () => {
    const NOW = new Date('2026-11-01T00:00:00.000Z');

    it('is live inside the window', () => {
        expect(
            isCourtesyWindowLive({ fields: readCourtesyFields({ courtesyEndsAt: ENDS }), now: NOW })
        ).toBe(true);
    });

    it('is not live once the window has passed', () => {
        expect(
            isCourtesyWindowLive({
                fields: readCourtesyFields({ courtesyEndsAt: STARTS }),
                now: NOW
            })
        ).toBe(false);
    });

    it('is not live without an end date — a half-written window is not a gift', () => {
        expect(
            isCourtesyWindowLive({
                fields: readCourtesyFields({ courtesyStartsAt: STARTS }),
                now: NOW
            })
        ).toBe(false);
    });
});
