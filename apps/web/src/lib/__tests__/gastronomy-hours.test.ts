/**
 * @file gastronomy-hours.test.ts
 * @description Regression tests for the gastronomy opening-hours pipeline
 * (Bug B8). Covers:
 * - `computeOpenNowStatus` across single- and multi-shift days.
 * - `normalizeOpeningHours` (via the exported `toGastronomyCardProps`) reading
 *   the real API schema shape `{ days: { mon: { closed, shifts } } }` and
 *   preserving every shift.
 */

import type { GastronomyOpeningHoursEntry } from '@/data/types';
import { toGastronomyCardProps } from '@/lib/api/transforms';
import { computeOpenNowStatus } from '@/lib/gastronomy-hours';
import { describe, expect, it } from 'vitest';

// 2024-01-15 is a Monday → getDay() === 1 → day key 'monday'.
const mondayAt = (hours: number, minutes = 0): Date => new Date(2024, 0, 15, hours, minutes, 0, 0);

const openDay = (
    shifts: ReadonlyArray<{ open: string; close: string }>
): GastronomyOpeningHoursEntry => ({ isOpen: shifts.length > 0, shifts });

describe('computeOpenNowStatus', () => {
    it('returns null when there is no entry for today', () => {
        expect(computeOpenNowStatus({}, mondayAt(13))).toBeNull();
    });

    it('returns false for a closed day', () => {
        const hours = { monday: { isOpen: false, shifts: [] } };
        expect(computeOpenNowStatus(hours, mondayAt(13))).toBe(false);
    });

    it('returns false for an open day with no shifts', () => {
        const hours = { monday: { isOpen: true, shifts: [] } };
        expect(computeOpenNowStatus(hours, mondayAt(13))).toBe(false);
    });

    it('returns true when the current time is inside a single shift', () => {
        const hours = { monday: openDay([{ open: '09:00', close: '18:00' }]) };
        expect(computeOpenNowStatus(hours, mondayAt(13))).toBe(true);
    });

    it('returns false before the shift opens and after it closes', () => {
        const hours = { monday: openDay([{ open: '09:00', close: '18:00' }]) };
        expect(computeOpenNowStatus(hours, mondayAt(8))).toBe(false);
        expect(computeOpenNowStatus(hours, mondayAt(18))).toBe(false);
    });

    describe('split schedule (multiple shifts)', () => {
        const splitDay = {
            monday: openDay([
                { open: '12:00', close: '15:00' },
                { open: '20:00', close: '23:59' }
            ])
        };

        it('is open during the midday shift', () => {
            expect(computeOpenNowStatus(splitDay, mondayAt(13))).toBe(true);
        });

        it('is CLOSED between shifts (afternoon gap)', () => {
            expect(computeOpenNowStatus(splitDay, mondayAt(17))).toBe(false);
        });

        it('is open again during the night shift', () => {
            expect(computeOpenNowStatus(splitDay, mondayAt(21))).toBe(true);
        });
    });
});

describe('normalizeOpeningHours (via toGastronomyCardProps)', () => {
    const baseItem = {
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'la-parrilla',
        name: 'La Parrilla',
        type: 'PARRILLA'
    };

    it('reads the nested days map and preserves every shift', () => {
        const card = toGastronomyCardProps({
            item: {
                ...baseItem,
                openingHours: {
                    timezone: 'America/Argentina/Buenos_Aires',
                    days: {
                        mon: {
                            closed: false,
                            shifts: [
                                { open: '12:00', close: '15:00' },
                                { open: '20:00', close: '23:59' }
                            ]
                        },
                        tue: { closed: true, shifts: [] }
                    }
                }
            }
        });

        expect(card.openingHours).not.toBeNull();
        expect(card.openingHours?.monday).toEqual({
            isOpen: true,
            shifts: [
                { open: '12:00', close: '15:00' },
                { open: '20:00', close: '23:59' }
            ]
        });
        expect(card.openingHours?.tuesday).toEqual({ isOpen: false, shifts: [] });
    });

    it('returns null when openingHours is absent', () => {
        const card = toGastronomyCardProps({ item: baseItem });
        expect(card.openingHours).toBeNull();
    });

    it('returns null for the legacy top-level shape (no days key)', () => {
        const card = toGastronomyCardProps({
            item: {
                ...baseItem,
                openingHours: { monday: { isOpen: true, open: '09:00', close: '18:00' } }
            }
        });
        expect(card.openingHours).toBeNull();
    });
});
