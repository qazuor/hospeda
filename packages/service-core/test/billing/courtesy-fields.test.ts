/**
 * Unit tests for courtesy-fields.ts (HOS-180; typed columns since HOS-993).
 *
 * This module is the ONLY place that knows which columns hold a courtesy
 * window, so its failure modes are the feature's failure modes. Two matter
 * most:
 *
 * 1. A malformed or half-written window must read as ABSENT, never as live —
 *    reading garbage as a live gift hands out free entitlements, and an
 *    `Invalid Date` compares false under `>`, which reads as "the gift lapsed"
 *    and cuts a subscriber off mid-gift with no error anywhere.
 * 2. A write must name all three columns, so a `.set()` can never leave a
 *    stale start beside a fresh end.
 *
 * The storage moved from `metadata` jsonb to typed columns in HOS-993. What
 * changed here is the SHAPE the module is handed and returns; the invariants
 * above are the same ones the jsonb-backed tests pinned.
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
        const patch = writeCourtesyFields({
            courtesyStartsAt: STARTS,
            courtesyEndsAt: ENDS,
            courtesyCyclesGranted: 2
        });
        // Act
        const read = readCourtesyFields(patch);
        // Assert
        expect(read.courtesyStartsAt?.toISOString()).toBe(STARTS.toISOString());
        expect(read.courtesyEndsAt?.toISOString()).toBe(ENDS.toISOString());
        expect(read.courtesyCyclesGranted).toBe(2);
    });

    it('reads Date instances, which is what a timestamptz column returns', () => {
        const read = readCourtesyFields({ courtesyEndsAt: ENDS });
        expect(read.courtesyEndsAt?.getTime()).toBe(ENDS.getTime());
    });

    it('still parses ISO strings, for rows that did not come through Drizzle', () => {
        // A decoded JSON payload or a fixture carries strings, not Dates.
        const read = readCourtesyFields({ courtesyEndsAt: ENDS.toISOString() });
        expect(read.courtesyEndsAt?.getTime()).toBe(ENDS.getTime());
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a row with no courtesy columns', { id: 'sub-1', status: 'active' }],
        ['an empty object', {}]
    ])('returns an empty window for %s', (_label, row) => {
        expect(readCourtesyFields(row as never)).toEqual({
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

    it('returns null for an Invalid Date instance, not the instance itself', () => {
        const read = readCourtesyFields({ courtesyEndsAt: new Date('nonsense') });
        expect(read.courtesyEndsAt).toBeNull();
    });

    it('rejects a zero or negative cycle count — that is not a gift', () => {
        expect(readCourtesyFields({ courtesyCyclesGranted: 0 }).courtesyCyclesGranted).toBeNull();
        expect(readCourtesyFields({ courtesyCyclesGranted: -3 }).courtesyCyclesGranted).toBeNull();
        expect(readCourtesyFields({ courtesyCyclesGranted: 1.5 }).courtesyCyclesGranted).toBeNull();
    });

    it('reads a NULL column as an absent field, not as a gift', () => {
        // This is the shape every ungifted row in the table actually has.
        const read = readCourtesyFields({
            courtesyStartsAt: null,
            courtesyEndsAt: null,
            courtesyCyclesGranted: null
        });
        expect(read.courtesyEndsAt).toBeNull();
        expect(read.courtesyStartsAt).toBeNull();
        expect(read.courtesyCyclesGranted).toBeNull();
    });
});

describe('writeCourtesyFields', () => {
    it('names all three columns, so a .set() cannot leave a stale one behind', () => {
        const patch = writeCourtesyFields({
            courtesyStartsAt: STARTS,
            courtesyEndsAt: ENDS,
            courtesyCyclesGranted: 1
        });
        expect(Object.keys(patch).sort()).toEqual([
            'courtesyCyclesGranted',
            'courtesyEndsAt',
            'courtesyStartsAt'
        ]);
    });

    it('carries the window through unchanged', () => {
        const patch = writeCourtesyFields({
            courtesyStartsAt: STARTS,
            courtesyEndsAt: ENDS,
            courtesyCyclesGranted: 3
        });
        expect(patch.courtesyStartsAt).toBe(STARTS);
        expect(patch.courtesyEndsAt).toBe(ENDS);
        expect(patch.courtesyCyclesGranted).toBe(3);
    });

    it('does not touch any other column on the row', () => {
        // The patch is spread into a .set() alongside `status`; it must not
        // carry keys that would overwrite unrelated columns.
        const patch = writeCourtesyFields({
            courtesyStartsAt: STARTS,
            courtesyEndsAt: ENDS,
            courtesyCyclesGranted: 1
        });
        expect(patch).not.toHaveProperty('metadata');
        expect(patch).not.toHaveProperty('status');
    });
});

describe('clearCourtesyFields', () => {
    it('nulls all three columns', () => {
        // On the jsonb implementation this had to DELETE the keys, because a
        // lingering value would make a later, unrelated pause derive as a
        // courtesy. A nullable column has no such distinction: NULL IS absence.
        const cleared = clearCourtesyFields();
        expect(cleared).toEqual({
            courtesyStartsAt: null,
            courtesyEndsAt: null,
            courtesyCyclesGranted: null
        });
    });

    it('leaves a cleared window reading as absent', () => {
        expect(readCourtesyFields(clearCourtesyFields()).courtesyEndsAt).toBeNull();
    });

    it('is not live once cleared', () => {
        expect(
            isCourtesyWindowLive({
                fields: readCourtesyFields(clearCourtesyFields()),
                now: new Date('2026-11-01T00:00:00.000Z')
            })
        ).toBe(false);
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
