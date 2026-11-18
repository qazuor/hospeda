/**
 * @file venue-hours.detail.test.ts
 * @description HOS-2257 AC-1..AC-7: detailed open status (open / opens later today / closed).
 * Dates are wall-clock `Date`s built from components (local getters mirror the venue clock).
 */
import { describe, expect, it } from 'vitest';
import type { VenueOpeningHoursEntry } from '../../../src/data/types';
import { computeOpenStatusDetail } from '../../../src/lib/venue-hours';

type Hours = Record<string, VenueOpeningHoursEntry>;

/** Friday 2024-01-05 at the given time. */
const friday = (h: number, m = 0) => new Date(2024, 0, 5, h, m);
/** Saturday 2024-01-06 at the given time. */
const saturday = (h: number, m = 0) => new Date(2024, 0, 6, h, m);

const DAY: Hours = { friday: { isOpen: true, shifts: [{ open: '09:00', close: '18:00' }] } };
const NIGHT: Hours = { friday: { isOpen: true, shifts: [{ open: '23:00', close: '05:00' }] } };

describe('computeOpenStatusDetail', () => {
    it('AC-1 open inside a shift', () => {
        expect(computeOpenStatusDetail(DAY, friday(12))).toEqual({ status: 'open' });
    });
    it('AC-2 opens later today before the shift', () => {
        expect(computeOpenStatusDetail(DAY, friday(7))).toEqual({
            status: 'opensToday',
            opensAt: '09:00'
        });
    });
    it('AC-3 closed after the last shift', () => {
        expect(computeOpenStatusDetail(DAY, friday(20))).toEqual({ status: 'closed' });
    });
    it('AC-4 overnight shift: opens at 23:00, open at 23:30 and after midnight', () => {
        expect(computeOpenStatusDetail(NIGHT, friday(22))).toEqual({
            status: 'opensToday',
            opensAt: '23:00'
        });
        expect(computeOpenStatusDetail(NIGHT, friday(23, 30))).toEqual({ status: 'open' });
        expect(computeOpenStatusDetail(NIGHT, saturday(2))).toEqual({ status: 'open' });
    });
    it('AC-5 picks the next shift of today', () => {
        const hours: Hours = {
            friday: {
                isOpen: true,
                shifts: [
                    { open: '20:00', close: '00:00' },
                    { open: '12:00', close: '15:00' }
                ]
            }
        };
        expect(computeOpenStatusDetail(hours, friday(16))).toEqual({
            status: 'opensToday',
            opensAt: '20:00'
        });
    });
    it('AC-6 closed today stays closed even if tomorrow opens', () => {
        const hours: Hours = {
            friday: { isOpen: false, shifts: [] },
            saturday: { isOpen: true, shifts: [{ open: '09:00', close: '18:00' }] }
        };
        expect(computeOpenStatusDetail(hours, friday(12))).toEqual({ status: 'closed' });
    });
    it('AC-7 no entry for today gives null', () => {
        expect(computeOpenStatusDetail(DAY, saturday(12))).toBeNull();
        expect(computeOpenStatusDetail({}, friday(12))).toBeNull();
    });
    it('R-3 degenerate or malformed shifts never yield an opening time', () => {
        const hours: Hours = {
            friday: {
                isOpen: true,
                shifts: [
                    { open: 'xx', close: '10:00' },
                    { open: '', close: '' }
                ]
            }
        };
        expect(computeOpenStatusDetail(hours, friday(7))).toEqual({ status: 'closed' });
    });
});
