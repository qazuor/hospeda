/**
 * @file formatEventDate.test.ts
 * @description Unit tests for the shared event card date formatter, covering
 * both EXACT (day-precision, pre-existing) and MONTH (HOS-280, month-only)
 * date precision.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatEventDate } from '../../../../../src/components/shared/cards/utils/formatEventDate';

describe('formatEventDate — EXACT precision (default, unchanged behavior)', () => {
    it('short mode returns long-form start/end labels with a day number', () => {
        // Midday UTC times, well clear of any realistic timezone's midnight
        // boundary, so this assertion doesn't depend on the runtime TZ.
        const result = formatEventDate({
            start: '2026-08-14T12:00:00Z',
            end: '2026-08-16T12:00:00Z',
            locale: 'es',
            mode: 'short'
        });

        expect(result.mode).toBe('short');
        if (result.mode !== 'short') throw new Error('unreachable');
        expect(result.startLabel).toContain('14');
        expect(result.startLabel.toLowerCase()).toContain('agosto');
        expect(result.endLabel).toContain('16');
    });

    it('compact mode returns a day + month dateLine', () => {
        const result = formatEventDate({
            start: '2026-08-14T12:00:00Z',
            locale: 'es',
            mode: 'compact'
        });

        expect(result.mode).toBe('compact');
        if (result.mode === 'short') throw new Error('unreachable');
        expect(result.dateLine).toBe('14 AGO');
    });

    it('defaults precision to EXACT when omitted', () => {
        const withPrecision = formatEventDate({
            start: '2026-08-14T12:00:00Z',
            locale: 'es',
            mode: 'compact',
            precision: 'EXACT'
        });
        const withoutPrecision = formatEventDate({
            start: '2026-08-14T12:00:00Z',
            locale: 'es',
            mode: 'compact'
        });

        expect(withoutPrecision).toEqual(withPrecision);
    });
});

describe('formatEventDate — MONTH precision (HOS-280)', () => {
    describe('mode: short', () => {
        it('returns a month-year label with no day and no end label when there is no end date', () => {
            const result = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                locale: 'es',
                mode: 'short',
                precision: 'MONTH'
            });

            expect(result.mode).toBe('short');
            if (result.mode !== 'short') throw new Error('unreachable');
            expect(result.startLabel).not.toMatch(/\b1\b/);
            expect(result.startLabel.toLowerCase()).toContain('febrero');
            expect(result.startLabel).toContain('2027');
            expect(result.endLabel).toBeNull();
        });

        it('formats both start and end as independent month-year labels', () => {
            const result = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                end: '2027-03-01T00:00:00.000Z',
                locale: 'es',
                mode: 'short',
                precision: 'MONTH'
            });

            expect(result.mode).toBe('short');
            if (result.mode !== 'short') throw new Error('unreachable');
            expect(result.startLabel.toLowerCase()).toContain('febrero');
            expect(result.endLabel?.toLowerCase()).toContain('marzo');
        });

        it('formats en/pt locales without a day number', () => {
            const en = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                locale: 'en',
                mode: 'short',
                precision: 'MONTH'
            });
            expect(en.mode).toBe('short');
            if (en.mode !== 'short') throw new Error('unreachable');
            expect(en.startLabel).toBe('February 2027');

            const pt = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                locale: 'pt',
                mode: 'short',
                precision: 'MONTH'
            });
            expect(pt.mode).toBe('short');
            if (pt.mode !== 'short') throw new Error('unreachable');
            expect(pt.startLabel.toLowerCase()).toContain('fevereiro');
        });
    });

    describe('mode: compact', () => {
        it('shows only the month abbreviation — no day number, no time line', () => {
            const result = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                locale: 'es',
                mode: 'compact',
                precision: 'MONTH'
            });

            expect(result.mode).toBe('compact');
            if (result.mode === 'short') throw new Error('unreachable');
            expect(result.dateLine).toBe('FEB');
            expect(result.timeLine).toBeNull();
            expect(result.monthAbbr).toBeNull();
        });

        it('ignores the end date entirely (card tiles show the start month only)', () => {
            const result = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                end: '2027-03-01T00:00:00.000Z',
                locale: 'es',
                mode: 'compact',
                precision: 'MONTH'
            });

            expect(result.mode).toBe('compact');
            if (result.mode === 'short') throw new Error('unreachable');
            expect(result.dateLine).toBe('FEB');
            expect(result.timeLine).toBeNull();
        });
    });

    describe('mode: rangeWithTime', () => {
        it('shows only the month abbreviation in both dateLine and monthAbbr, with no time line', () => {
            const result = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                locale: 'es',
                mode: 'rangeWithTime',
                precision: 'MONTH'
            });

            expect(result.mode).toBe('rangeWithTime');
            if (result.mode === 'short') throw new Error('unreachable');
            expect(result.dateLine).toBe('FEB');
            expect(result.monthAbbr).toBe('FEB');
            expect(result.timeLine).toBeNull();
        });
    });

    describe('timezone robustness (BETA-88-style regression guard)', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('does not shift the month backward under a non-UTC runtime timezone', () => {
            // '2027-02-01T00:00:00.000Z' is the MONTH-precision storage
            // placeholder for "February 2027". Under Argentina's UTC-3 offset,
            // naive Intl formatting without forcing timeZone: 'UTC' would
            // render this as January 31 (2027-01-31T21:00 local) — shifting
            // the reported month back by one. This must never happen for
            // MONTH-precision events since the day is meaningless but the
            // month must be exact.
            vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires');

            const compact = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                locale: 'es',
                mode: 'compact',
                precision: 'MONTH'
            });
            expect(compact.mode).toBe('compact');
            if (compact.mode === 'short') throw new Error('unreachable');
            expect(compact.dateLine).toBe('FEB');

            const short = formatEventDate({
                start: '2027-02-01T00:00:00.000Z',
                locale: 'es',
                mode: 'short',
                precision: 'MONTH'
            });
            expect(short.mode).toBe('short');
            if (short.mode !== 'short') throw new Error('unreachable');
            expect(short.startLabel.toLowerCase()).toContain('febrero');
        });
    });
});
