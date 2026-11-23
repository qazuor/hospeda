/**
 * @file HoursEditor.test.tsx
 * @description The kit weekly hours editor (HOS-2491): pure week helpers,
 * localized day names and the 44px controls it renders.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    copyHoursDayToAll,
    HOURS_WEEKDAYS,
    HoursEditor,
    type HoursWeek,
    removeHoursSlot,
    toggleHoursDay,
    weekdayName
} from '@/components/account/ui/HoursEditor';

const CLOSED = { closed: true, slots: [] } as const;

function week(overrides: Partial<HoursWeek> = {}): HoursWeek {
    const base: HoursWeek = {
        mon: CLOSED,
        tue: CLOSED,
        wed: CLOSED,
        thu: CLOSED,
        fri: CLOSED,
        sat: CLOSED,
        sun: CLOSED
    };
    return { ...base, ...overrides };
}

describe('HoursEditor helpers', () => {
    it('opens a closed day with exactly one slot', () => {
        expect(toggleHoursDay({ week: week(), day: 'mon', open: true }).mon).toEqual({
            closed: false,
            slots: [{ open: '09:00', close: '18:00' }]
        });
    });

    it('keeps existing slots when a day is reopened', () => {
        const start = week({ mon: { closed: true, slots: [{ open: '08:00', close: '12:00' }] } });

        expect(toggleHoursDay({ week: start, day: 'mon', open: true }).mon.slots).toEqual([
            { open: '08:00', close: '12:00' }
        ]);
    });

    it('closes the day when its last slot is removed, not before', () => {
        const start = week({
            tue: {
                closed: false,
                slots: [
                    { open: '08:00', close: '12:00' },
                    { open: '16:00', close: '20:00' }
                ]
            }
        });

        const once = removeHoursSlot({ week: start, day: 'tue', index: 0 });
        expect(once.tue).toEqual({ closed: false, slots: [{ open: '16:00', close: '20:00' }] });
        expect(removeHoursSlot({ week: once, day: 'tue', index: 0 }).tue).toEqual(CLOSED);
    });

    it('copies a day to every day with fresh slot objects', () => {
        const start = week({ wed: { closed: false, slots: [{ open: '10:00', close: '14:00' }] } });

        const copied = copyHoursDayToAll({ week: start, day: 'wed' });
        for (const day of HOURS_WEEKDAYS) {
            expect(copied[day]).toEqual(start.wed);
        }
        expect(copied.mon.slots[0]).not.toBe(start.wed.slots[0]);
    });

    it.each([
        ['es', 'Lunes', 'Domingo'],
        ['en', 'Monday', 'Sunday'],
        ['pt', 'Segunda-feira', 'Domingo']
    ] as const)('names the weekdays in %s through Intl', (locale, monday, sunday) => {
        expect(weekdayName({ locale, day: 'mon' })).toBe(monday);
        expect(weekdayName({ locale, day: 'sun' })).toBe(sunday);
    });
});

describe('HoursEditor', () => {
    it('renders labelled time inputs and reports a slot edit for the whole week', () => {
        const onChange = vi.fn();
        render(
            <HoursEditor
                locale="es"
                idBase="h"
                value={week({ fri: { closed: false, slots: [{ open: '09:00', close: '18:00' }] } })}
                onChange={onChange}
            />
        );

        const open = screen.getByLabelText('Viernes, apertura de la franja 1');
        expect(open).toHaveAttribute('type', 'time');
        expect(open).toHaveAttribute('id', 'h-fri-0-open');

        fireEvent.change(open, { target: { value: '10:00' } });

        const next = onChange.mock.calls.at(-1)?.[0] as HoursWeek;
        expect(next.fri.slots).toEqual([{ open: '10:00', close: '18:00' }]);
        expect(next.mon).toEqual(CLOSED);
    });

    it('shows the visible open/closed state next to each switch', () => {
        render(
            <HoursEditor
                locale="es"
                idBase="h"
                value={week({ sat: { closed: false, slots: [{ open: '09:00', close: '13:00' }] } })}
                onChange={vi.fn()}
            />
        );

        expect(screen.getAllByText('Cerrado')).toHaveLength(6);
        expect(screen.getAllByText('Abierto')).toHaveLength(1);
    });
});
