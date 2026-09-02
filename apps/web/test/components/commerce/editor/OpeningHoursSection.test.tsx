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
            errors={{}}
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

        // Monday is absent from `seeded.days`, so it renders at `dayOf()`'s
        // default — CLOSED since HOS-906 — and this click UNchecks it.
        fireEvent.click(screen.getByLabelText('Lun cerrado'));

        const emitted = lastEmitted(onChange);
        expect(emitted.days.mon.closed).toBe(false);
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
        // HOS-906: an untouched day now defaults to CLOSED, which hides the
        // add-shift control — seed Monday explicitly as open-with-no-shifts
        // (the legitimate in-progress state while the host is building it)
        // to reach the button this test exercises.
        const openNoShifts = {
            timezone: 'America/Argentina/Buenos_Aires',
            days: { mon: { closed: false, shifts: [] } }
        } as unknown as OpeningHours;
        const { onChange } = renderSection({ value: openNoShifts });

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
        // HOS-906: Tuesday must be seeded explicitly OPEN — an untouched day
        // now defaults to closed too, which would hide BOTH add-shift buttons
        // and defeat the "open day still shows it" half of this assertion.
        const closed = {
            timezone: 'America/Argentina/Buenos_Aires',
            days: {
                mon: { closed: true, shifts: [] },
                tue: { closed: false, shifts: [{ open: '09:00', close: '18:00' }] }
            }
        } as unknown as OpeningHours;
        renderSection({ value: closed });

        expect(screen.queryByLabelText('Agregar turno Lun')).toBeNull();
        expect(screen.getByLabelText('Agregar turno Mar')).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // HOS-814 — a rejected schedule must MARK a control, not just raise a toast
    //
    // Before this, the section was handed `fieldErrors.openingHours`, a key Zod
    // never produces: it reports at the deepest path
    // (`openingHours.days.mon.shifts.0.close`). So a rejected schedule rendered
    // no message and marked no input, while the toast told the user to review
    // fields that carried no mark anywhere on the page.
    //
    // These assert the MARK and the ASSOCIATION, never just that some text is
    // on screen — a message floating in the document with no `aria-describedby`
    // pointing at it is the bug this closes, and it would satisfy a getByText.
    // -----------------------------------------------------------------------

    it('surfaces the aggregate section error', () => {
        renderSection({ errors: { openingHours: 'Horario inválido' } });

        expect(screen.getByText('Horario inválido')).toBeInTheDocument();
    });

    it('marks the group and points its first control at the aggregate message', () => {
        // No per-shift entry: the rejection is of the object itself, so the
        // aggregate copy is the only message there is.
        renderSection({ errors: { openingHours: 'Horario inválido' } });

        // The group's first control is the one carrying the derived field id,
        // and the one `focusFirstInvalidField` lands on.
        const firstControl = screen.getByLabelText('Lun cerrado');
        expect(firstControl).toHaveAttribute('aria-invalid', 'true');

        const describedBy = firstControl.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(document.getElementById(describedBy as string)).toHaveTextContent(
            'Horario inválido'
        );
    });

    it('marks the exact close input that Zod rejected, with the message attached', () => {
        const value = {
            timezone: 'America/Argentina/Buenos_Aires',
            days: { mon: { closed: false, shifts: [{ open: '22:00', close: '22:00' }] } }
        } as unknown as OpeningHours;

        renderSection({
            value,
            errors: {
                openingHours: 'La hora de cierre no puede ser igual a la de apertura',
                'openingHours.days.mon.shifts.0.close':
                    'La hora de cierre no puede ser igual a la de apertura'
            }
        });

        const closeInput = screen.getByLabelText('Lun cierre 1');
        expect(closeInput).toHaveAttribute('aria-invalid', 'true');

        const describedBy = closeInput.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(document.getElementById(describedBy as string)).toHaveTextContent(
            'La hora de cierre no puede ser igual a la de apertura'
        );

        // The sibling bound is NOT marked — a blanket mark on the whole row
        // would pass the assertions above while telling the user nothing.
        expect(screen.getByLabelText('Lun apertura 1')).not.toHaveAttribute('aria-invalid');
    });

    it('shows the message ONCE, and points the group at the specific one', () => {
        const value = {
            timezone: 'America/Argentina/Buenos_Aires',
            days: { mon: { closed: false, shifts: [{ open: '22:00', close: '22:00' }] } }
        } as unknown as OpeningHours;
        const message = 'La hora de cierre no puede ser igual a la de apertura';

        renderSection({
            value,
            // Exactly what `useZodForm` produces once `aggregateFields` rolls up:
            // the nested entry AND a copy under the bare key.
            errors: {
                openingHours: message,
                'openingHours.days.mon.shifts.0.close': message
            }
        });

        // The aggregate copy would repeat the sentence verbatim at the foot of
        // the section. Only the shift-level one is rendered.
        expect(screen.getAllByText(message)).toHaveLength(1);

        // ...and the group's focus target is described by THAT message, not by
        // an aggregate element that is no longer in the document.
        const groupDescribedBy = screen
            .getByLabelText('Lun cerrado')
            .getAttribute('aria-describedby');
        const closeDescribedBy = screen
            .getByLabelText('Lun cierre 1')
            .getAttribute('aria-describedby');

        expect(groupDescribedBy).toBeTruthy();
        expect(groupDescribedBy).toBe(closeDescribedBy);

        // The id must actually resolve to the message — a matching pair of
        // dangling ids would satisfy the equality above and announce nothing.
        expect(document.getElementById(groupDescribedBy as string)).toHaveTextContent(message);
    });

    it('leaves every control unmarked when the schedule is valid', () => {
        const value = {
            timezone: 'America/Argentina/Buenos_Aires',
            days: { mon: { closed: false, shifts: [{ open: '22:00', close: '02:00' }] } }
        } as unknown as OpeningHours;

        renderSection({ value, errors: {} });

        expect(screen.getByLabelText('Lun cierre 1')).not.toHaveAttribute('aria-invalid');
        expect(screen.getByLabelText('Lun cerrado')).not.toHaveAttribute('aria-invalid');
        expect(screen.getByLabelText('Lun cerrado')).not.toHaveAttribute('aria-describedby');
    });

    // -----------------------------------------------------------------------
    // HOS-825 — the add/remove controls carry the section's own button styling
    //
    // The CSS-module class name is hashed at build time, so asserting a literal
    // is impossible; asserting that a class was applied AT ALL is what separates
    // "styled by the site" from the bare browser chrome that was there before.
    // The accessible names are re-asserted because they are what makes the
    // icon-only buttons usable, and restyling is exactly when they get lost.
    // -----------------------------------------------------------------------

    it('styles the add and remove shift buttons and keeps their accessible names', () => {
        const value = {
            timezone: 'America/Argentina/Buenos_Aires',
            days: { mon: { closed: false, shifts: [{ open: '09:00', close: '18:00' }] } }
        } as unknown as OpeningHours;

        renderSection({ value });

        const removeButton = screen.getByLabelText('Quitar turno Lun 1');
        const addButton = screen.getByLabelText('Agregar turno Lun');

        expect(removeButton.className).not.toBe('');
        expect(addButton.className).not.toBe('');
        expect(removeButton).toHaveAttribute('type', 'button');
        expect(addButton).toHaveAttribute('type', 'button');
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-openingHours')).not.toBeNull();
    });
});
