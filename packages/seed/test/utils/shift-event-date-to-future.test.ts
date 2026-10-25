import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shiftEventDateToFuture } from '../../src/utils/shift-event-date-to-future.js';

const dataDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../src/data/event');

describe('shiftEventDateToFuture', () => {
    it('shifts a past event start and end by the same whole years', () => {
        const date = { start: '2024-06-10T10:00:00-03:00', end: '2024-06-12T10:00:00-03:00' };
        const result = shiftEventDateToFuture({ date, now: new Date('2026-01-01T00:00:00-03:00') });

        expect(result).toEqual({
            start: '2026-06-10T10:00:00-03:00',
            end: '2026-06-12T10:00:00-03:00'
        });
    });

    it('uses start as the end when end is absent', () => {
        const date = { start: '2024-02-03T09:00:00-03:00', isAllDay: true };
        const result = shiftEventDateToFuture({ date, now: new Date('2025-01-01T00:00:00-03:00') });

        expect(result).toEqual({ start: '2025-02-03T09:00:00-03:00', isAllDay: true });
    });

    it('leaves a future event intact', () => {
        const date = {
            start: '2027-02-03T09:00:00-03:00',
            end: '2027-02-04T09:00:00-03:00',
            recurrence: 'YEARLY'
        };

        expect(shiftEventDateToFuture({ date, now: new Date('2026-01-01T00:00:00-03:00') })).toBe(
            date
        );
    });

    it('adds as many years as needed', () => {
        const date = { start: '2018-01-02T09:00:00-03:00', end: '2018-01-03T09:00:00-03:00' };

        expect(
            shiftEventDateToFuture({ date, now: new Date('2026-06-01T00:00:00-03:00') })
        ).toEqual({
            start: '2027-01-02T09:00:00-03:00',
            end: '2027-01-03T09:00:00-03:00'
        });
    });

    it('leaves an event whose end equals now unchanged', () => {
        const date = { start: '2026-10-24T09:00:00-03:00', end: '2026-10-25T00:00:00-03:00' };

        expect(shiftEventDateToFuture({ date, now: new Date('2026-10-25T00:00:00-03:00') })).toBe(
            date
        );
    });

    it('moves February 29 to February 28 in a non-leap target year', () => {
        const date = { start: '2024-02-29T10:30:00-03:00', end: '2024-03-01T10:30:00-03:00' };

        expect(
            shiftEventDateToFuture({ date, now: new Date('2025-01-01T00:00:00-03:00') })
        ).toEqual({
            start: '2025-02-28T10:30:00-03:00',
            end: '2025-03-01T10:30:00-03:00'
        });
    });

    it('preserves event duration', () => {
        const date = { start: '2020-01-01T10:00:00-03:00', end: '2020-01-02T12:30:00-03:00' };
        const result = shiftEventDateToFuture({ date, now: new Date('2026-01-01T00:00:00-03:00') });

        expect(Date.parse(result.end!) - Date.parse(result.start)).toBe(
            Date.parse(date.end) - Date.parse(date.start)
        );
    });

    it('shifts all real event fixtures beyond a fixed future clock', () => {
        const files = readdirSync(dataDirectory).filter((file) => file.endsWith('.json'));
        const now = new Date('2035-01-01T00:00:00-03:00');

        expect(files).toHaveLength(23);
        for (const file of files) {
            const fixture = JSON.parse(readFileSync(join(dataDirectory, file), 'utf8')) as {
                date: { start: string; end?: string };
            };
            const shifted = shiftEventDateToFuture({ date: fixture.date, now });
            expect(Date.parse(shifted.end ?? shifted.start), file).toBeGreaterThanOrEqual(
                now.getTime()
            );
        }
    });
});
