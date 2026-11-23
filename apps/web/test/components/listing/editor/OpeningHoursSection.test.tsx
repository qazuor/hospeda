/**
 * @file OpeningHoursSection.test.tsx
 * @description The listing editor's opening-hours section on the kit
 * `HoursEditor` (HOS-258, HOS-2491).
 *
 * The section is fully controlled and rebuilds the COMPLETE `OpeningHours` on
 * every edit, so most of the value here is asserting that an edit to one day
 * never drops the others or the timezone, and that the errors land on the
 * exact control (HOS-814).
 *
 * @module test/components/listing/editor/OpeningHoursSection
 */

import type { OpeningHours } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    fromHoursWeek,
    OpeningHoursSection,
    toHoursWeek
} from '@/components/listing/editor/OpeningHoursSection.client';

/** Tuesday configured and a non-default timezone. */
const seeded = {
    timezone: 'America/Montevideo',
    days: { tue: { closed: false, shifts: [{ open: '10:00', close: '14:00' }] } }
} as unknown as OpeningHours;

type Emitted = {
    timezone: string;
    days: Record<string, { closed: boolean; shifts: Array<{ open: string; close: string }> }>;
};

function renderSection(overrides: Partial<React.ComponentProps<typeof OpeningHoursSection>> = {}): {
    onChange: ReturnType<typeof vi.fn>;
} {
    const onChange = vi.fn();
    render(
        <OpeningHoursSection
            locale="es"
            vertical="venue"
            value={null}
            errors={{}}
            onChange={onChange}
            {...overrides}
        />
    );
    return { onChange };
}

function lastEmitted(onChange: ReturnType<typeof vi.fn>): Emitted {
    return onChange.mock.calls.at(-1)?.[0];
}

describe('OpeningHoursSection', () => {
    it('renders one kit Section with the horarios help anchor and seven days', () => {
        renderSection();

        expect(screen.getByRole('region', { name: 'Horarios de atención' })).toHaveAttribute(
            'data-help',
            'section:venue.horarios'
        );
        expect(screen.getAllByRole('switch')).toHaveLength(7);
        for (const day of [
            'Lunes',
            'Martes',
            'Miércoles',
            'Jueves',
            'Viernes',
            'Sábado',
            'Domingo'
        ]) {
            expect(screen.getByText(day)).toBeInTheDocument();
        }
    });

    it('reads a day nobody configured as closed (HOS-906)', () => {
        renderSection({ value: seeded });

        expect(screen.getByRole('switch', { name: 'Lunes abierto' })).toHaveAttribute(
            'aria-checked',
            'false'
        );
        expect(screen.getByRole('switch', { name: 'Martes abierto' })).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    it('opens a closed day with one default slot (HOS-2446)', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByRole('switch', { name: 'Lunes abierto' }));

        expect(lastEmitted(onChange).days.mon).toEqual({
            closed: false,
            shifts: [{ open: '09:00', close: '18:00' }]
        });
    });

    it('closes an open day and clears its slots', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByRole('switch', { name: 'Martes abierto' }));

        expect(lastEmitted(onChange).days.tue).toEqual({ closed: true, shifts: [] });
    });

    it('emits all seven days and keeps the timezone on every edit', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.change(screen.getByLabelText('Martes, cierre de la franja 1'), {
            target: { value: '15:00' }
        });

        const emitted = lastEmitted(onChange);
        expect(Object.keys(emitted.days)).toEqual([
            'mon',
            'tue',
            'wed',
            'thu',
            'fri',
            'sat',
            'sun'
        ]);
        expect(emitted.timezone).toBe('America/Montevideo');
        expect(emitted.days.tue?.shifts).toEqual([{ open: '10:00', close: '15:00' }]);
        expect(emitted.days.mon).toEqual({ closed: true, shifts: [] });
    });

    it('defaults the timezone when the listing had none', () => {
        const { onChange } = renderSection();

        fireEvent.click(screen.getByRole('switch', { name: 'Lunes abierto' }));

        expect(lastEmitted(onChange).timezone).toBe('America/Argentina/Buenos_Aires');
    });

    it('adds a slot to an open day', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByRole('button', { name: 'Agregar franja a Martes' }));

        expect(lastEmitted(onChange).days.tue?.shifts).toEqual([
            { open: '10:00', close: '14:00' },
            { open: '09:00', close: '18:00' }
        ]);
    });

    it('closes the day when its last slot is removed', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(screen.getByRole('button', { name: 'Quitar la franja 1 de Martes' }));

        expect(lastEmitted(onChange).days.tue).toEqual({ closed: true, shifts: [] });
    });

    it('copies one day to the whole week, each with its own slot objects', () => {
        const { onChange } = renderSection({ value: seeded });

        fireEvent.click(
            screen.getByRole('button', { name: 'Copiar a todos los días el horario de Martes' })
        );

        const emitted = lastEmitted(onChange);
        for (const day of Object.values(emitted.days)) {
            expect(day).toEqual({ closed: false, shifts: [{ open: '10:00', close: '14:00' }] });
        }
        expect(emitted.days.mon?.shifts[0]).not.toBe(emitted.days.tue?.shifts[0]);
        expect(emitted.timezone).toBe('America/Montevideo');
    });

    it('hides the slot controls of a closed day', () => {
        renderSection({ value: seeded });

        expect(screen.queryByRole('button', { name: 'Agregar franja a Lunes' })).toBeNull();
        expect(screen.queryByLabelText('Lunes, apertura de la franja 1')).toBeNull();
    });

    it('puts the field id on Monday’s switch and describes it with the aggregate error', () => {
        renderSection({ errors: { openingHours: 'Revisá los horarios.' } });

        const first = screen.getByRole('switch', { name: 'Lunes abierto' });
        expect(first).toHaveAttribute('id', 'ce-openingHours');
        expect(first).toHaveAccessibleDescription('Revisá los horarios.');
    });

    it('marks the exact bound Zod rejected and shows the message once', () => {
        renderSection({
            value: seeded,
            errors: {
                openingHours: 'El cierre debe ser posterior a la apertura.',
                'openingHours.days.tue.shifts.0.close':
                    'El cierre debe ser posterior a la apertura.'
            }
        });

        const close = screen.getByLabelText('Martes, cierre de la franja 1');
        expect(close).toHaveAttribute('aria-invalid', 'true');
        expect(close).toHaveAccessibleDescription('El cierre debe ser posterior a la apertura.');
        expect(screen.getByLabelText('Martes, apertura de la franja 1')).not.toHaveAttribute(
            'aria-invalid',
            'true'
        );
        expect(screen.getAllByText('El cierre debe ser posterior a la apertura.')).toHaveLength(1);
    });

    it('round-trips a stored schedule through the kit week', () => {
        expect(fromHoursWeek({ week: toHoursWeek(seeded), previous: seeded })).toEqual({
            timezone: 'America/Montevideo',
            days: {
                mon: { closed: true, shifts: [] },
                tue: { closed: false, shifts: [{ open: '10:00', close: '14:00' }] },
                wed: { closed: true, shifts: [] },
                thu: { closed: true, shifts: [] },
                fri: { closed: true, shifts: [] },
                sat: { closed: true, shifts: [] },
                sun: { closed: true, shifts: [] }
            }
        });
    });
});

describe('OpeningHoursSection — an error no slot can show (HOS-2491 review)', () => {
    /** Legacy data: Monday open with no slots, the state the schema rejects. */
    const openWithNoSlots = {
        timezone: 'America/Argentina/Buenos_Aires',
        days: { mon: { closed: false, shifts: [] } }
    } as unknown as OpeningHours;

    it('shows the aggregate message when the error is on a day, not on a slot', () => {
        renderSection({
            value: openWithNoSlots,
            errors: {
                openingHours: 'Un día abierto necesita al menos una franja.',
                'openingHours.days.mon.closed': 'Un día abierto necesita al menos una franja.'
            }
        });

        expect(screen.getByText('Un día abierto necesita al menos una franja.')).toBeVisible();
        const first = screen.getByRole('switch', { name: 'Lunes abierto' });
        expect(first).toHaveAttribute('aria-invalid', 'true');
        expect(first).toHaveAccessibleDescription('Un día abierto necesita al menos una franja.');
    });

    it('shows the aggregate message when the failing slot belongs to a closed day', () => {
        renderSection({
            value: seeded,
            errors: {
                openingHours: 'Revisá los horarios.',
                'openingHours.days.wed.shifts.0.close': 'Revisá los horarios.'
            }
        });

        expect(screen.getByText('Revisá los horarios.')).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Lunes abierto' })).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('leaves Monday’s switch valid when a visible slot carries the message', () => {
        renderSection({
            value: seeded,
            errors: {
                openingHours: 'El cierre debe ser posterior a la apertura.',
                'openingHours.days.tue.shifts.0.close':
                    'El cierre debe ser posterior a la apertura.'
            }
        });

        expect(screen.getByRole('switch', { name: 'Lunes abierto' })).not.toHaveAttribute(
            'aria-invalid'
        );
    });
});

describe('OpeningHoursSection in other locales (HOS-2436, HOS-2491)', () => {
    it.each([
        ['en', 'Opening hours', 'Monday', 'Tuesday, slot 1 closing time', 'Add slot to Tuesday'],
        [
            'pt',
            'Horário de funcionamento',
            'Segunda-feira',
            'Terça-feira, fechamento do horário 1',
            'Adicionar horário em Terça-feira'
        ]
    ] as const)('renders day names and aria-labels in %s', (locale, title, monday, close, add) => {
        renderSection({ locale, value: seeded });

        expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
        expect(screen.getByText(monday)).toBeInTheDocument();
        expect(screen.getByLabelText(close)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: add })).toBeInTheDocument();
    });

    it('leaks no Spanish into the English accessible names', () => {
        renderSection({ locale: 'en', value: seeded });

        const names = [...screen.getAllByRole('switch'), ...screen.getAllByRole('button')].map(
            (element) => element.getAttribute('aria-label') ?? element.textContent ?? ''
        );
        for (const name of names) {
            expect(name).not.toMatch(/Lunes|Martes|apertura|cierre|franja|Agregar|Quitar/);
        }
    });
});
