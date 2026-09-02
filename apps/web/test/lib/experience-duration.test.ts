/**
 * @file experience-duration.test.ts
 * @description `formatDurationMinutes` (HOS-898) — the arithmetic that turns a
 * stored minute count into the string the ficha shows.
 *
 * This is the whole reason the column is a number rather than free text, so the
 * unit choices are pinned here rather than left to the reader of the hero: days
 * only above 24 h, zero components dropped, and nothing at all for a value that
 * is not a duration.
 *
 * The unit LABELS are injected, so these assertions test the arithmetic and not
 * the i18n bundle. Whether the real labels exist in es/en/pt is enforced
 * elsewhere, by `pnpm check:i18n-keys`.
 */

import { describe, expect, it } from 'vitest';
import { formatDurationMinutes } from '@/lib/experience-duration';

const labels = { day: 'd', hour: 'h', minute: 'min' } as const;

const format = (totalMinutes: number | null): string | null =>
    formatDurationMinutes({ totalMinutes, labels, locale: 'es' });

describe('formatDurationMinutes', () => {
    it('renders minutes alone below an hour', () => {
        expect(format(45)).toBe('45 min');
    });

    it('renders hours and minutes together', () => {
        expect(format(150)).toBe('2 h 30 min');
    });

    it('drops a zero minutes component', () => {
        // "2 h 0 min" is precision nobody asked an excursion for.
        expect(format(120)).toBe('2 h');
    });

    it('drops a zero hours component', () => {
        expect(format(1440 + 30)).toBe('1 d');
    });

    it('switches to days at 24 hours, not before', () => {
        // 1439 is one minute short of a day and must still read in hours: a
        // three-day trip rendered as "72 h" is right and useless, and the
        // inverse — a 23-hour outing as "0 d 23 h" — is worse.
        expect(format(1439)).toBe('23 h 59 min');
        expect(format(1440)).toBe('1 d');
        expect(format(4320)).toBe('3 d');
    });

    it('shows days with their leftover hours', () => {
        expect(format(1440 + 180)).toBe('1 d 3 h');
    });

    it('renders nothing for a value that is not a duration', () => {
        // `null` is "not declared"; 0 and a negative are a corrupt row. All
        // three must return null, because the view's gate is a presence check
        // and "0 min" would read as a declared duration of no time at all.
        expect(format(null)).toBeNull();
        expect(format(0)).toBeNull();
        expect(format(-30)).toBeNull();
        expect(format(Number.NaN)).toBeNull();
        expect(format(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it('formats the numbers for the locale rather than interpolating them raw', () => {
        // 100 days is beyond what the schema accepts, but the formatter is pure
        // and this is the cheapest way to prove the Intl call is real: es-AR
        // groups thousands with a dot, en-US with a comma.
        const es = formatDurationMinutes({ totalMinutes: 1_440_000, labels, locale: 'es-AR' });
        const en = formatDurationMinutes({ totalMinutes: 1_440_000, labels, locale: 'en-US' });

        expect(es).toBe('1.000 d');
        expect(en).toBe('1,000 d');
    });

    it('uses the labels it is handed, not hard-coded Spanish', () => {
        const english = formatDurationMinutes({
            totalMinutes: 150,
            labels: { day: 'days', hour: 'hrs', minute: 'mins' },
            locale: 'en'
        });

        expect(english).toBe('2 hrs 30 mins');
    });
});
