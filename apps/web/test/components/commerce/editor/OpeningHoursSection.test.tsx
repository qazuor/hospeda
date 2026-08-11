/**
 * @file OpeningHoursSection.test.tsx
 * @description Unit coverage for the commerce editor's opening-hours section
 * (HOS-258).
 *
 * The section is fully controlled and rebuilds the COMPLETE `OpeningHours` on
 * every edit, so most of the value here is asserting that an edit to one day
 * never drops the others or the timezone.
 *
 * @module test/components/commerce/editor/OpeningHoursSection
 */
import type { OpeningHours } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpeningHoursSection } from '../../../../src/components/commerce/editor/OpeningHoursSection.client';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

/** An OpeningHours with Tuesday already configured and a non-default timezone. */
const seeded = {
    timezone: 'America/Montevideo',
    days: {
        tue: { closed: false, shifts: [{ open: '10:00', close: '14:00' }] }
    }
} as unknown as OpeningHours;

function renderSection(overrides: Partial<React.ComponentProps<typeof OpeningHoursSection>> = {}): {
    onChange: ReturnType<typeof vi.fn>;
} {
    const onChange = vi.fn();
    render(
        <OpeningHoursSection
            locale="es"
            value={null}
            onChange={onChange}
            {...overrides}
        />
    );
    return { onChange };
}

/** The OpeningHours emitted by the most recent onChange call. */
function lastEmitted(onChange: ReturnType<typeof vi.fn>): {
    timezone: string;
    days: Record<string, { closed: boolean; shifts: Array<{ open: string; close: string }> }>;
} {
    return onChange.mock.calls.at(-1)?.[0];
}

describe('OpeningHoursSection', () => {
    it('renders one row per ISO weekday', () => {
        renderSection();

        for (const label of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    it('marks a day closed and clears its shifts', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByLabelText('Mar cerrado'));

        expect(lastEmitted(onChange).days.tue).toEqual({ closed: true, shifts: [] });
    });

    it('preserves the other days when one is edited', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByLabelText('Lun cerrado'));

        const emitted = lastEmitted(onChange);
        expect(emitted.days.mon.closed).toBe(true);
        // Editing Monday must not wipe Tuesday's configured shift.
        expect(emitted.days.tue).toEqual({
            closed: false,
            shifts: [{ open: '10:00', close: '14:00' }]
        });
    });

    it('emits all seven days on every edit, not just the touched one', () => {
        const { onChange } = renderSection();

        fireEvent.click(screen.getByLabelText('Vie cerrado'));

        expect(Object.keys(lastEmitted(onChange).days).sort()).toEqual(
            ['fri', 'mon', 'sat', 'sun', 'thu', 'tue', 'wed'].sort()
        );
    });

    it('preserves a non-default timezone', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByLabelText('Lun cerrado'));

        expect(lastEmitted(onChange).timezone).toBe('America/Montevideo');
    });

    it('defaults the timezone when the listing had none', () => {
        const { onChange } = renderSection();

        fireEvent.click(screen.getByLabelText('Lun cerrado'));

        expect(lastEmitted(onChange).timezone).toBe('America/Argentina/Buenos_Aires');
    });

    it('adds a shift with sensible default hours', () => {
        const { onChange } = renderSection();

        fireEvent.click(screen.getByLabelText('Agregar turno Lun'));

        expect(lastEmitted(onChange).days.mon.shifts).toEqual([{ open: '09:00', close: '18:00' }]);
    });

    it('edits the open and close times of an existing shift', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.change(screen.getByLabelText('Mar apertura 1'), { target: { value: '11:30' } });
        expect(lastEmitted(onChange).days.tue.shifts).toEqual([{ open: '11:30', close: '14:00' }]);

        fireEvent.change(screen.getByLabelText('Mar cierre 1'), { target: { value: '20:00' } });
        expect(lastEmitted(onChange).days.tue.shifts).toEqual([{ open: '10:00', close: '20:00' }]);
    });

    it('removes a shift', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByLabelText('Quitar turno Mar 1'));

        expect(lastEmitted(onChange).days.tue.shifts).toEqual([]);
    });

    it('hides the shift controls for a closed day', () => {
        const closed = {
            timezone: 'America/Argentina/Buenos_Aires',
            days: { mon: { closed: true, shifts: [] } }
        } as unknown as OpeningHours;
        renderSection({ value: closed });

        expect(screen.queryByLabelText('Agregar turno Lun')).toBeNull();
        expect(screen.getByLabelText('Agregar turno Mar')).toBeInTheDocument();
    });

    it('surfaces the section error', () => {
        renderSection({ error: 'Horario inválido' });

        expect(screen.getByText('Horario inválido')).toBeInTheDocument();
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-openingHours')).not.toBeNull();
    });
});
