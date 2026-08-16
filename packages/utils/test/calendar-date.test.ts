/**
 * @file calendar-date.test.ts
 * @description Regression suite for the "everything shows one day early" bug family
 * (smoke agosto 2026: H-09, H-63, H-73, H-84).
 *
 * DETERMINISM CONTRACT — read before adding a case here.
 *
 * This suite must never depend on the runner's clock or the runner's timezone.
 * The repo already carries two clock-dependent suites that flake (one fails when
 * CI crosses midnight in Argentina), and a timezone bug is exactly the kind of
 * thing people "fix" with a test that only passes on their laptop.
 *
 * Two rules keep it honest:
 *   1. Never call `new Date()` with no argument. Every instant here is a literal.
 *   2. Never rely on the ambient timezone to express "read from Argentina".
 *      Pass `timeZone` explicitly to `Intl`/`toLocaleDateString` in the
 *      assertion instead. The bug then reproduces identically on a UTC CI
 *      runner and on a UTC-3 laptop, which is the whole point.
 */

import { describe, expect, it } from 'vitest';
import { formatCalendarDate, getCalendarDateParts, parseCalendarDate } from '../src/calendar-date';

/** The timezone every operator of this project actually reads the screen in. */
const ARGENTINA = 'America/Argentina/Buenos_Aires';

/** A timezone AHEAD of UTC, to prove the fix is not "subtract nothing in UTC-3". */
const TOKYO = 'Asia/Tokyo';

describe('getCalendarDateParts', () => {
    it('reads a bare YYYY-MM-DD as the day it names', () => {
        expect(getCalendarDateParts({ value: '2026-08-13' })).toEqual({
            year: 2026,
            month: 8,
            day: 13
        });
    });

    it('reads a UTC-midnight instant as the day it names', () => {
        // This is what all 13 admin date pickers write: `new Date('2026-08-13').toISOString()`.
        expect(getCalendarDateParts({ value: '2026-08-13T00:00:00.000Z' })).toEqual({
            year: 2026,
            month: 8,
            day: 13
        });
    });

    it('reads a mid-day instant as the same day', () => {
        // H-73's control batch, loaded through the API at noon UTC instead of
        // through the form. It rendered correctly by luck; it must keep doing so.
        expect(getCalendarDateParts({ value: '2026-08-13T12:00:00.000Z' })).toEqual({
            year: 2026,
            month: 8,
            day: 13
        });
    });

    it('accepts a Date instance', () => {
        expect(getCalendarDateParts({ value: new Date('2026-08-13T00:00:00.000Z') })).toEqual({
            year: 2026,
            month: 8,
            day: 13
        });
    });

    it('rejects a day that does not exist', () => {
        // The local-time constructor would silently roll this into March.
        expect(getCalendarDateParts({ value: '2026-02-31' })).toBeNull();
    });

    it('rejects malformed input instead of guessing', () => {
        expect(getCalendarDateParts({ value: '' })).toBeNull();
        expect(getCalendarDateParts({ value: 'ayer' })).toBeNull();
        expect(getCalendarDateParts({ value: '13/08/2026' })).toBeNull();
        expect(getCalendarDateParts({ value: new Date('nope') })).toBeNull();
    });
});

describe('formatCalendarDate — the regression', () => {
    /**
     * H-09 / H-63: `host_trade_benefit_usages.serviced_at` is a Postgres `date`,
     * so it travels as a bare `YYYY-MM-DD`.
     */
    it('H-63: a bare YYYY-MM-DD service date does not slip to the previous day', () => {
        const stored = '2026-08-13';

        // The bug, reproduced deterministically: this is `UsagesTable.tsx`'s
        // `new Date(value).toLocaleDateString()`, read from Argentina.
        expect(new Date(stored).toLocaleDateString('es-AR', { timeZone: ARGENTINA })).toBe(
            '12/8/2026'
        );

        // The fix: the day it names, whoever is reading.
        expect(formatCalendarDate({ value: stored, locale: 'es-AR' })).toBe('13/8/2026');
    });

    /**
     * H-73 / H-84: `partner_mentions.mentioned_at` and
     * `billing_promo_codes.starts_at` are `timestamptz`, not `date`. H-84 proved
     * the column type was never the cause — the date picker pinning the instant
     * to midnight UTC is.
     */
    it('H-84: a timestamptz pinned to midnight UTC does not slip either', () => {
        const stored = '2026-08-13T00:00:00.000Z';

        expect(new Date(stored).toLocaleDateString('es-AR', { timeZone: ARGENTINA })).toBe(
            '12/8/2026'
        );

        expect(formatCalendarDate({ value: stored, locale: 'es-AR' })).toBe('13/8/2026');
    });

    it('gives the same answer east of UTC, where the naive read happens to be right', () => {
        // Guards against a "fix" that just shifts everything forward one day:
        // in Tokyo the naive read was already correct, and must stay correct.
        const stored = '2026-08-13T00:00:00.000Z';

        expect(new Date(stored).toLocaleDateString('es-AR', { timeZone: TOKYO })).toBe('13/8/2026');
        expect(formatCalendarDate({ value: stored, locale: 'es-AR' })).toBe('13/8/2026');
    });

    it('does not depend on the caller passing a timezone', () => {
        // The production call sites do not pass one. The helper must pin the
        // timezone itself, so the answer cannot drift with the browser, the
        // container, or the CI runner.
        const stored = '2026-08-13T00:00:00.000Z';
        const expected = '13/8/2026';

        expect(formatCalendarDate({ value: stored, locale: 'es-AR' })).toBe(expected);
        expect(
            formatCalendarDate({ value: stored, locale: 'es-AR', options: { timeZone: TOKYO } })
        ).toBe(expected);
        expect(
            formatCalendarDate({ value: stored, locale: 'es-AR', options: { timeZone: ARGENTINA } })
        ).toBe(expected);
    });

    it('honours format options other than timezone', () => {
        expect(
            formatCalendarDate({
                value: '2026-08-13',
                locale: 'es-AR',
                options: { day: 'numeric', month: 'long', year: 'numeric' }
            })
        ).toBe('13 de agosto de 2026');
    });

    it('returns null for a value that names no day, instead of "Invalid Date"', () => {
        expect(formatCalendarDate({ value: '2026-02-31', locale: 'es-AR' })).toBeNull();
        expect(formatCalendarDate({ value: '', locale: 'es-AR' })).toBeNull();
    });

    it('crosses a year boundary without slipping', () => {
        // The worst-looking version of the bug: 1 de enero reads as 31 de
        // diciembre of the previous YEAR.
        const stored = '2027-01-01T00:00:00.000Z';

        expect(new Date(stored).toLocaleDateString('es-AR', { timeZone: ARGENTINA })).toBe(
            '31/12/2026'
        );
        expect(formatCalendarDate({ value: stored, locale: 'es-AR' })).toBe('1/1/2027');
    });
});

describe('parseCalendarDate', () => {
    it('returns local midnight of the day it names, for a bare date', () => {
        const parsed = parseCalendarDate({ value: '2026-08-13' });

        // Asserted on local components on purpose: this holds in every timezone,
        // so the assertion itself cannot flake.
        expect(parsed?.getFullYear()).toBe(2026);
        expect(parsed?.getMonth()).toBe(7);
        expect(parsed?.getDate()).toBe(13);
        expect(parsed?.getHours()).toBe(0);
    });

    it('returns local midnight of the day it names, for a UTC-midnight instant', () => {
        const parsed = parseCalendarDate({ value: '2026-08-13T00:00:00.000Z' });

        expect(parsed?.getFullYear()).toBe(2026);
        expect(parsed?.getMonth()).toBe(7);
        expect(parsed?.getDate()).toBe(13);
    });

    it('rejects an impossible day rather than rolling it into the next month', () => {
        expect(parseCalendarDate({ value: '2026-02-31' })).toBeNull();
    });
});
