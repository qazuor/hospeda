/**
 * The venue-agenda payload schema (HOS-1042).
 *
 * The refinement in this schema is the ONLY thing standing between the two
 * recurrence shapes and a database full of entries no renderer can place, so
 * most of what follows is about it. An entry is either dated or weekly, and:
 *
 *  1. A `once` entry with no `date` is REJECTED — there would be no day to put
 *     it on, and the column is nullable precisely so both shapes can share one
 *     table, which means the database will not catch this.
 *  2. A `weekly` entry with no `weekday` is rejected for the mirror reason.
 *  3. An entry carrying BOTH is rejected. This is the shape a client produces
 *     by toggling the recurrence control without clearing the other field, and
 *     it is the most likely real bug: nothing about it looks wrong.
 *  4. Weekday `0` (Sunday) parses. It is falsy, and every `||` between here and
 *     the database would silently turn it into "no day at all".
 *
 * Plus the two decisions that are easy to "simplify" away later:
 *
 *  5. An EMPTY `events` array parses. It is the venue that stopped doing live
 *     music saying "take the agenda down"; rejecting it leaves them no way to.
 *  6. An `endTime` EARLIER than `startTime` parses. "Cena show, de 22 a 02" is
 *     an ordinary announcement and the one case where that is correct rather
 *     than a typo. Only a zero-length event is refused.
 *
 * @module test/entities/gastronomy/gastronomy.event.schema
 */
import { describe, expect, it } from 'vitest';
import {
    GASTRONOMY_EVENTS_MAX_ENTRIES,
    GastronomyEventInputSchema,
    GastronomyEventsReplacePayloadSchema
} from '../../../src/entities/gastronomy/subtypes/gastronomy.event.schema.js';

/** A valid weekly happy hour, the shape most of these tests vary from. */
const WEEKLY_HAPPY_HOUR = {
    title: 'Happy hour',
    recurrence: 'weekly' as const,
    weekday: 4,
    startTime: '18:00',
    endTime: '20:00'
};

/** A valid one-off, for the dated half of the refinement. */
const ONE_OFF_SHOW = {
    title: 'Cena show',
    recurrence: 'once' as const,
    date: '2026-09-12',
    startTime: '22:00'
};

describe('GastronomyEventInputSchema — the recurrence refinement (HOS-1042)', () => {
    it('accepts a weekly entry carrying a weekday and no date', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse(WEEKLY_HAPPY_HOUR);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts a one-off entry carrying a date and no weekday', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse(ONE_OFF_SHOW);

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a one-off entry with no date, naming the date field', () => {
        // The path matters as much as the refusal: the editor hangs the message
        // on a field, and an issue reported at the object root would surface as
        // a form that is invalid with nothing highlighted.
        // Arrange
        const { date: _omitted, ...withoutDate } = ONE_OFF_SHOW;

        // Act
        const result = GastronomyEventInputSchema.safeParse(withoutDate);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error?.issues.some((i) => i.path.includes('date'))).toBe(true);
    });

    it('rejects a weekly entry with no weekday, naming the weekday field', () => {
        // Arrange
        const { weekday: _omitted, ...withoutWeekday } = WEEKLY_HAPPY_HOUR;

        // Act
        const result = GastronomyEventInputSchema.safeParse(withoutWeekday);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error?.issues.some((i) => i.path.includes('weekday'))).toBe(true);
    });

    it('rejects an entry carrying BOTH a date and a weekday', () => {
        // The shape a client produces by flipping the recurrence control
        // without clearing the field it just stopped using. Nothing about the
        // resulting object looks wrong, which is exactly why it needs a test.
        // Arrange
        const both = { ...WEEKLY_HAPPY_HOUR, date: '2026-09-12' };

        // Act
        const result = GastronomyEventInputSchema.safeParse(both);

        // Assert
        expect(result.success).toBe(false);
    });

    it('accepts weekday 0 — Sunday is falsy and must survive anyway', () => {
        // Arrange
        const sunday = { ...WEEKLY_HAPPY_HOUR, weekday: 0 };

        // Act
        const result = GastronomyEventInputSchema.safeParse(sunday);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.weekday).toBe(0);
    });

    it('rejects a weekday outside 0-6', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse({
            ...WEEKLY_HAPPY_HOUR,
            weekday: 7
        });

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('GastronomyEventInputSchema — times (HOS-1042)', () => {
    it('accepts an end time EARLIER than the start — a show that crosses midnight', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse({
            ...ONE_OFF_SHOW,
            startTime: '22:00',
            endTime: '02:00'
        });

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects an end time EQUAL to the start — a zero-length event', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse({
            ...ONE_OFF_SHOW,
            startTime: '22:00',
            endTime: '22:00'
        });

        // Assert
        expect(result.success).toBe(false);
    });

    it('accepts an omitted end time — "desde las 21" is a real announcement', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse(ONE_OFF_SHOW);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.endTime).toBeUndefined();
    });

    it('rejects a time carrying seconds, so two spellings of one instant cannot coexist', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse({
            ...WEEKLY_HAPPY_HOUR,
            startTime: '18:00:00'
        });

        // Assert
        expect(result.success).toBe(false);
    });

    it('rejects a 24-hour clock past 23:59', () => {
        // Act
        const result = GastronomyEventInputSchema.safeParse({
            ...WEEKLY_HAPPY_HOUR,
            startTime: '24:00'
        });

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('GastronomyEventsReplacePayloadSchema (HOS-1042)', () => {
    it('accepts an EMPTY agenda — that is how a venue takes it down', () => {
        // Act
        const result = GastronomyEventsReplacePayloadSchema.safeParse({ events: [] });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.events).toEqual([]);
    });

    it('defaults isActive to true, so a new entry is published without saying so', () => {
        // Act
        const result = GastronomyEventsReplacePayloadSchema.safeParse({
            events: [WEEKLY_HAPPY_HOUR]
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.events[0]?.isActive).toBe(true);
    });

    it('refuses an agenda longer than the ceiling', () => {
        // The ceiling exists so ONE request cannot write an unbounded number of
        // rows in one transaction — not as a product tier, which is the
        // entitlement's job.
        // Arrange
        const tooMany = Array.from({ length: GASTRONOMY_EVENTS_MAX_ENTRIES + 1 }, () => ({
            ...WEEKLY_HAPPY_HOUR
        }));

        // Act
        const result = GastronomyEventsReplacePayloadSchema.safeParse({ events: tooMany });

        // Assert
        expect(result.success).toBe(false);
    });

    it('accepts exactly the ceiling', () => {
        // Guards the boundary from the off-by-one that would make the test
        // above pass while refusing a legitimate agenda.
        // Arrange
        const atLimit = Array.from({ length: GASTRONOMY_EVENTS_MAX_ENTRIES }, () => ({
            ...WEEKLY_HAPPY_HOUR
        }));

        // Act
        const result = GastronomyEventsReplacePayloadSchema.safeParse({ events: atLimit });

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects the whole document when ONE entry has a broken recurrence', () => {
        // The refinement runs per entry, and a payload that half-parsed would
        // be worse than one that failed: the owner would save four events and
        // silently lose the fifth.
        // Arrange
        const { weekday: _omitted, ...broken } = WEEKLY_HAPPY_HOUR;

        // Act
        const result = GastronomyEventsReplacePayloadSchema.safeParse({
            events: [WEEKLY_HAPPY_HOUR, broken]
        });

        // Assert
        expect(result.success).toBe(false);
    });
});
