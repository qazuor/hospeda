/**
 * The venue-agenda read projection (HOS-1042).
 *
 * ## Why this exists at all
 *
 * A Postgres `time` column does NOT return what was written to it. Measured
 * against this repo's own database on 2026-09-03:
 *
 * ```
 * CREATE TEMP TABLE t_probe(a time, b time);
 * INSERT INTO t_probe VALUES ('18:00','02:30');
 * SELECT a::text, b::text FROM t_probe;   ->  18:00:00 | 02:30:00
 * ```
 *
 * `GastronomyEventTimeSchema` rejects seconds on purpose — two spellings of one
 * instant is a field whose equality checks are wrong somewhere downstream — so
 * without the projection every read would fail its OWN response schema, and the
 * owner's editor would be handed a value it could not re-submit. The bug is
 * invisible in any test that never touches Postgres, which is precisely why the
 * measurement above is quoted rather than trusted to memory.
 *
 * @module test/services/gastronomy/gastronomy.events
 */
import { GastronomyEventPublicSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { projectEvent, toClockTime } from '../../../src/services/gastronomy/gastronomy.events.js';

describe('toClockTime (HOS-1042)', () => {
    it('truncates the seconds a Postgres time column appends', () => {
        expect(toClockTime('18:00:00')).toBe('18:00');
    });

    it('leaves a value already in HH:MM untouched, so it is safe to apply twice', () => {
        expect(toClockTime('18:00')).toBe('18:00');
        expect(toClockTime(toClockTime('18:00:00'))).toBe('18:00');
    });

    it('passes null through — an unstated end time is not a time', () => {
        expect(toClockTime(null)).toBeNull();
    });

    it('does not shift a time past midnight', () => {
        // The 02:30 half of the probe above. A naive "parse and reformat"
        // implementation is where a timezone would get involved and move this.
        expect(toClockTime('02:30:00')).toBe('02:30');
    });
});

describe('projectEvent (HOS-1042)', () => {
    /** A stored row exactly as Postgres hands it back. */
    const storedRow = {
        id: '33333333-3333-4333-8333-333333333333',
        gastronomyId: '22222222-2222-4222-8222-222222222222',
        title: 'Cena show',
        description: null,
        recurrence: 'once' as const,
        date: '2026-09-12',
        weekday: null,
        startTime: '22:00:00',
        endTime: '02:00:00',
        isActive: true,
        displayOrder: 0,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-09-01T00:00:00Z')
    };

    it('turns a raw stored row into one the public schema accepts', () => {
        // The assertion that would have caught the bug: the RAW row fails and
        // the projected one passes. Asserting only the projected half would
        // stay green if the schema were loosened instead of the read fixed.
        expect(GastronomyEventPublicSchema.safeParse(storedRow).success).toBe(false);
        expect(GastronomyEventPublicSchema.safeParse(projectEvent(storedRow)).success).toBe(true);
    });

    it('leaves the calendar date exactly as stored', () => {
        // A `date` column round-trips its YYYY-MM-DD verbatim (measured), which
        // is the whole reason the column is a `date` and not a `timestamp`. If
        // this ever fails, something started parsing it as an instant.
        expect(projectEvent(storedRow).date).toBe('2026-09-12');
    });

    it('keeps a null end time null rather than inventing one', () => {
        expect(projectEvent({ ...storedRow, endTime: null }).endTime).toBeNull();
    });
});
