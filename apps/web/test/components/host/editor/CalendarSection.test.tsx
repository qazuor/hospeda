/**
 * @file CalendarSection.test.tsx
 * @description Tests for the occupancy calendar section (HOS-43 Phase 1).
 *
 * Covers:
 * - Renders free vs occupied (MANUAL and sync-sourced) days from fetched data
 * - Clicking a free day twice (click-start, click-end on itself) selects it
 *   and applying "Bloquear" issues a batch block call
 * - Clicking an occupied MANUAL day twice and applying "Liberar" issues a
 *   batch unblock call
 * - A sync-sourced day (Google Calendar) is disabled and never togglable
 * - i18n keys resolve to human text, never leaking a raw dotted key
 *
 * HOS-162 bar prototype: occupancy is drawn as source-colored spanning event
 * bars overlaid on each week (see occupancy-bar-layout.ts), so the day cells
 * themselves no longer carry the `dayOccupied`/`daySync` background — the
 * occupancy assertions target the `.barManual`/`.barGoogle`/`.barBooking`
 * bars instead, while interaction (togglable MANUAL / disabled sync) is
 * unchanged.
 */

import { OccupancySourceEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarSectionProps } from '@/components/host/editor/CalendarSection.client';
import { CalendarSection } from '@/components/host/editor/CalendarSection.client';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockList, mockBatchToggle, mockUpdateEvent } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockBatchToggle: vi.fn(),
    mockUpdateEvent: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        // Minimal es-only stand-in, just good enough to assert on in tests.
        tPlural: (_key: string, count: number) =>
            count === 1 ? `${count} día seleccionado` : `${count} días seleccionados`
    })
}));

vi.mock('@/components/host/editor/CalendarSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationOccupancyApi: {
        list: mockList,
        batchToggle: mockBatchToggle,
        updateEvent: mockUpdateEvent
    }
}));

// The edit dialog renders the real shared Dialog (portal) — stub its CSS module.
vi.mock('@/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// The Google-sync panel (HOS-157) is gated + covered by its own test; render
// nothing here so this suite stays focused on the manual occupancy grid and
// never touches the entitlements hook / calendar-sync API.
vi.mock('@/components/host/editor/PlanEntitlementGate.client', () => ({
    PlanEntitlementGate: () => null
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACC_ID = 'acc-uuid-123';
// Fixed "today" so month navigation / past-day disabling is deterministic.
// 2026-07-15 is a Wednesday.
const TODAY = new Date(2026, 6, 15);

const MANUAL_ROW = {
    id: 'occ-manual-1',
    accommodationId: ACC_ID,
    date: '2026-07-20',
    isBlocked: true,
    source: OccupancySourceEnum.MANUAL,
    externalEventId: null,
    note: null,
    createdById: 'user-1',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z')
};

const GOOGLE_ROW = {
    id: 'occ-google-1',
    accommodationId: ACC_ID,
    date: '2026-07-22',
    isBlocked: true,
    source: OccupancySourceEnum.GOOGLE_CALENDAR,
    externalEventId: 'gcal-evt-1',
    note: null,
    createdById: 'system',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z')
};

// Same `date` as MANUAL_ROW, different `source` — a valid state under the
// HOS-162 source-scoped unique index `(accommodationId, date, source)`.
const AIRBNB_ROW_SAME_DATE_AS_MANUAL = {
    id: 'occ-airbnb-1',
    accommodationId: ACC_ID,
    date: '2026-07-20',
    isBlocked: true,
    source: OccupancySourceEnum.AIRBNB,
    externalEventId: 'airbnb-evt-1',
    note: null,
    createdById: 'system',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z')
};

const BOOKING_ROW = {
    id: 'occ-booking-1',
    accommodationId: ACC_ID,
    date: '2026-07-24',
    isBlocked: true,
    source: OccupancySourceEnum.BOOKING,
    externalEventId: 'booking-evt-1',
    note: null,
    createdById: 'system',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z')
};

const defaultProps: CalendarSectionProps = {
    locale: 'es',
    accommodationId: ACC_ID
};

function makeListOk(occupancy: unknown[] = []) {
    return Promise.resolve({ ok: true as const, data: { occupancy } });
}

function makeBatchOk(occupancy: unknown[] = []) {
    return Promise.resolve({ ok: true as const, data: { occupancy } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Only fake `Date` (not timers) so Testing Library's async polling
        // (`waitFor`/`findBy*`, which rely on real setTimeout) keeps working.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(TODAY);
        mockList.mockReturnValue(makeListOk([]));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the section title and description', async () => {
        render(<CalendarSection {...defaultProps} />);
        expect(screen.getByText('Calendario de ocupación')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Marcá los días en los que tu alojamiento está ocupado. Esas fechas no aparecerán disponibles en las búsquedas.'
            )
        ).toBeInTheDocument();
        await waitFor(() => expect(mockList).toHaveBeenCalled());
    });

    it('renders a free day as an enabled button labeled "Libre"', async () => {
        mockList.mockReturnValue(makeListOk([]));
        render(<CalendarSection {...defaultProps} />);

        const freeDay = await screen.findByRole('button', {
            name: /25 de julio de 2026 — Libre/i
        });
        expect(freeDay).not.toBeDisabled();
    });

    it('renders a MANUAL-occupied day as disabled (edited via its bar, not the cell) with a manual bar', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));
        render(<CalendarSection {...defaultProps} />);

        const occupiedDay = await screen.findByRole('button', {
            name: /20 de julio de 2026 — Ocupado — Manual/i
        });
        // HOS-175 interaction model: occupied days are inert at the cell — the
        // manual event is edited/removed by clicking its bar, not the cell.
        expect(occupiedDay).toBeDisabled();
        expect(occupiedDay).not.toHaveAttribute('aria-pressed');
        // Bar mode (HOS-162): occupancy renders as a source-colored span bar,
        // not a per-cell background/dot — the cell itself stays neutral.
        expect(document.querySelector('.barManual')).toBeInTheDocument();
    });

    it('renders a sync-sourced (Google Calendar) day as disabled and non-togglable', async () => {
        mockList.mockReturnValue(makeListOk([GOOGLE_ROW]));
        render(<CalendarSection {...defaultProps} />);

        const syncDay = await screen.findByRole('button', {
            name: /22 de julio de 2026 — Ocupado — Google Calendar/i
        });
        expect(syncDay).toBeDisabled();
        // Bar mode (HOS-162): the sync day is read-only (disabled) and its
        // occupancy shows as a Google-colored span bar.
        expect(document.querySelector('.barGoogle')).toBeInTheDocument();

        const user = userEvent.setup();
        await user.click(syncDay);

        // Disabled native buttons never fire onClick — no selection UI appears.
        expect(screen.queryByText(/1 día seleccionado/)).not.toBeInTheDocument();
    });

    it('selecting a free day and clicking "Bloquear" issues a batch block call', async () => {
        mockList.mockReturnValue(makeListOk([]));
        mockBatchToggle.mockReturnValue(makeBatchOk([{ ...MANUAL_ROW, date: '2026-07-25' }]));

        const user = userEvent.setup();
        render(<CalendarSection {...defaultProps} />);

        const freeDay = await screen.findByRole('button', {
            name: /25 de julio de 2026 — Libre/i
        });

        // Click start, then click the same day again -> single-day selection.
        await user.click(freeDay);
        await user.click(freeDay);

        expect(await screen.findByText('1 día seleccionado')).toBeInTheDocument();

        const blockButton = screen.getByRole('button', { name: 'Bloquear' });
        await user.click(blockButton);

        await waitFor(() => {
            expect(mockBatchToggle).toHaveBeenCalledWith({
                id: ACC_ID,
                dates: ['2026-07-25'],
                isBlocked: true,
                note: undefined
            });
        });
    });

    it('does not start a selection when an occupied day is clicked (occupied days are inert)', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));

        const user = userEvent.setup();
        render(<CalendarSection {...defaultProps} />);

        const occupiedDay = await screen.findByRole('button', {
            name: /20 de julio de 2026 — Ocupado — Manual/i
        });

        // HOS-175: the cell is disabled — clicking it never starts a selection,
        // so the block/unblock action bar never appears. Removing/editing the
        // manual event happens via its bar's edit dialog instead.
        await user.click(occupiedDay);
        expect(screen.queryByText(/1 día seleccionado/)).not.toBeInTheDocument();
        expect(mockBatchToggle).not.toHaveBeenCalled();
    });

    it('a date with MANUAL + AIRBNB rows renders occupied+disabled and shows the MANUAL source by priority (HOS-162)', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW, AIRBNB_ROW_SAME_DATE_AS_MANUAL]));
        render(<CalendarSection {...defaultProps} />);

        const occupiedDay = await screen.findByRole('button', {
            name: /20 de julio de 2026 — Ocupado — Manual/i
        });
        // HOS-175: occupied days are inert at the cell regardless of source mix.
        expect(occupiedDay).toBeDisabled();
        // Bar mode (HOS-162): occupancy renders as a source-colored span bar,
        // not a per-cell background/dot — the cell itself stays neutral.
        expect(document.querySelector('.barManual')).toBeInTheDocument();

        // Never shows the lower-priority Airbnb source once MANUAL wins.
        expect(
            screen.queryByRole('button', { name: /20 de julio de 2026 — Ocupado — Airbnb/i })
        ).not.toBeInTheDocument();
    });

    it('a date with only a BOOKING row renders occupied and disabled (read-only, no MANUAL row)', async () => {
        mockList.mockReturnValue(makeListOk([BOOKING_ROW]));
        render(<CalendarSection {...defaultProps} />);

        const syncDay = await screen.findByRole('button', {
            name: /24 de julio de 2026 — Ocupado — Booking\.com/i
        });
        expect(syncDay).toBeDisabled();
        // Bar mode (HOS-162): read-only sync day, occupancy shown as a
        // Booking-colored span bar.
        expect(document.querySelector('.barBooking')).toBeInTheDocument();
    });

    it('opens the edit dialog when a MANUAL event bar is clicked', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));
        const user = userEvent.setup();
        render(<CalendarSection {...defaultProps} />);

        const bar = await screen.findByRole('button', { name: /Editar bloqueo/i });
        await user.click(bar);

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Eliminar bloqueo' })).toBeInTheDocument();
    });

    it('saving an edit calls updateEvent with the old + new range and note', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));
        mockUpdateEvent.mockReturnValue(makeBatchOk([]));
        const user = userEvent.setup();
        render(<CalendarSection {...defaultProps} />);

        await user.click(await screen.findByRole('button', { name: /Editar bloqueo/i }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        // Change only the text (dates untouched) for a deterministic assertion.
        const textInput = screen.getByPlaceholderText('Ej: reservado fuera de la plataforma');
        fireEvent.change(textInput, { target: { value: 'Reserva directa' } });
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => {
            expect(mockUpdateEvent).toHaveBeenCalledWith({
                id: ACC_ID,
                oldStartDate: '2026-07-20',
                oldEndDate: '2026-07-20',
                newStartDate: '2026-07-20',
                newEndDate: '2026-07-20',
                note: 'Reserva directa'
            });
        });
    });

    it('deleting from the edit dialog unblocks the event range', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));
        mockBatchToggle.mockReturnValue(makeBatchOk([]));
        const user = userEvent.setup();
        render(<CalendarSection {...defaultProps} />);

        await user.click(await screen.findByRole('button', { name: /Editar bloqueo/i }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Eliminar bloqueo' }));

        await waitFor(() => {
            expect(mockBatchToggle).toHaveBeenCalledWith({
                id: ACC_ID,
                dates: ['2026-07-20'],
                isBlocked: false
            });
        });
    });

    it('never leaks a raw i18n key into the rendered output', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));
        render(<CalendarSection {...defaultProps} />);

        await waitFor(() => expect(mockList).toHaveBeenCalled());
        expect(document.body.textContent).not.toMatch(/host\.properties\.editor\.calendar/);
    });
});
