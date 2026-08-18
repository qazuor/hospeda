/**
 * @file OccupancyEventDetailsDialog.test.tsx
 * @description Tests for the read-only "why is this day blocked?" dialog.
 *
 * The dialog exists because H-131 filled hosts' calendars with imported contact
 * birthdays, and the calendar could not answer "what is this?". The information
 * was technically on screen — the bar renders the event title — but a one-day
 * block is a seventh of the calendar wide, so the label was truncated, and the
 * full text lived only in a native `title` tooltip, which a phone never shows.
 *
 * These tests assert the dialog SAYS the three things a confused host needs:
 * what the event is called, which calendar it came from, and which days it
 * covers. They read rendered text rather than props, since a prop that never
 * reaches the DOM is exactly the failure being fixed.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OccupancyEventDetailsDialog } from '@/components/host/editor/OccupancyEventDetailsDialog.client';

vi.mock('@/components/host/editor/CalendarSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

/** Mirrors the real `t`: fallback wins, `{{param}}` placeholders interpolated. */
const t = (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return base.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(params[name] ?? ''));
};

/** Deterministic formatter — locale formatting is not what these tests assert. */
const formatDateKey = (dateKey: string) => `día ${dateKey}`;

/** The production shape: a Google contact birthday imported as occupancy. */
const birthday = {
    startKey: '2026-09-12',
    endKey: '2026-09-12',
    title: 'Delfina Asrilevich - Cumpleaños',
    sourceLabel: 'Google Calendar'
};

function renderDialog(overrides: Partial<Parameters<typeof OccupancyEventDetailsDialog>[0]> = {}) {
    const onClose = vi.fn();
    render(
        <OccupancyEventDetailsDialog
            isOpen
            t={t}
            event={birthday}
            formatDateKey={formatDateKey}
            onClose={onClose}
            {...overrides}
        />
    );
    return { onClose };
}

describe('OccupancyEventDetailsDialog', () => {
    it('names the event that blocked the day', () => {
        renderDialog();

        // The whole point: the host reads "Delfina Asrilevich - Cumpleaños"
        // instead of a coloured sliver they cannot identify.
        expect(screen.getByText('Delfina Asrilevich - Cumpleaños')).toBeInTheDocument();
    });

    it('names the calendar it came from, in words rather than by colour', () => {
        renderDialog();

        expect(screen.getByText('Origen')).toBeInTheDocument();
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    });

    it('shows a single date for a one-day block', () => {
        renderDialog();

        expect(screen.getByText('día 2026-09-12')).toBeInTheDocument();
        // No range separator when start and end are the same day.
        expect(screen.queryByText(/al día/)).not.toBeInTheDocument();
    });

    it('shows both ends for a multi-day block', () => {
        renderDialog({
            event: { ...birthday, startKey: '2026-09-12', endKey: '2026-09-15' }
        });

        expect(screen.getByText('día 2026-09-12 al día 2026-09-15')).toBeInTheDocument();
    });

    it('says so explicitly when the provider gave no title', () => {
        // Airbnb/Booking feeds routinely expose no SUMMARY. An empty line would
        // read as a rendering bug; naming the absence does not.
        renderDialog({ event: { ...birthday, title: null, sourceLabel: 'Airbnb' } });

        expect(screen.getByText('Sin título en el calendario de origen')).toBeInTheDocument();
    });

    it('treats a whitespace-only title as no title', () => {
        renderDialog({ event: { ...birthday, title: '   ' } });

        expect(screen.getByText('Sin título en el calendario de origen')).toBeInTheDocument();
    });

    it('explains why the block cannot be edited here and what to do instead', () => {
        renderDialog();

        // Without this, the dialog answers "what is it?" and leaves the host
        // stuck on "so how do I get rid of it?".
        expect(screen.getByText(/desconectá ese calendario/)).toBeInTheDocument();
    });

    it('renders nothing when there is no event', () => {
        const { container } = render(
            <OccupancyEventDetailsDialog
                isOpen
                t={t}
                event={null}
                formatDateKey={formatDateKey}
                onClose={vi.fn()}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('closes from both the header icon and the footer button', async () => {
        const { onClose } = renderDialog();
        const user = userEvent.setup();

        // Two controls share the name "Cerrar" — the header's icon button and
        // the footer's. That is deliberate: they perform the same action, so
        // giving them different names would be the confusing option. Assert
        // both work rather than picking one by index and hoping.
        const closeButtons = screen.getAllByRole('button', { name: 'Cerrar' });
        expect(closeButtons).toHaveLength(2);

        for (const button of closeButtons) {
            await user.click(button);
        }

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('offers no way to edit or delete — an imported block is not editable here', () => {
        renderDialog();

        // A sync row deleted here would be rewritten by the next reconcile, so
        // offering the action at all would be a lie.
        expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Guardar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
});
