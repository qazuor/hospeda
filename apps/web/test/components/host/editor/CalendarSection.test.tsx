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
 */

import { OccupancySourceEnum } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarSectionProps } from '@/components/host/editor/CalendarSection.client';
import { CalendarSection } from '@/components/host/editor/CalendarSection.client';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockList, mockBatchToggle } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockBatchToggle: vi.fn()
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
        batchToggle: mockBatchToggle
    }
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

    it('renders a MANUAL-occupied day as enabled and labeled with its source', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));
        render(<CalendarSection {...defaultProps} />);

        const occupiedDay = await screen.findByRole('button', {
            name: /20 de julio de 2026 — Ocupado — Manual/i
        });
        expect(occupiedDay).not.toBeDisabled();
        expect(occupiedDay).toHaveClass('dayOccupied');
        expect(occupiedDay).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders a sync-sourced (Google Calendar) day as disabled and non-togglable', async () => {
        mockList.mockReturnValue(makeListOk([GOOGLE_ROW]));
        render(<CalendarSection {...defaultProps} />);

        const syncDay = await screen.findByRole('button', {
            name: /22 de julio de 2026 — Ocupado — Google Calendar/i
        });
        expect(syncDay).toBeDisabled();
        expect(syncDay).toHaveClass('daySync');

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

    it('selecting an occupied MANUAL day and clicking "Liberar" issues a batch unblock call', async () => {
        mockList.mockReturnValue(makeListOk([MANUAL_ROW]));
        mockBatchToggle.mockReturnValue(makeBatchOk([]));

        const user = userEvent.setup();
        render(<CalendarSection {...defaultProps} />);

        const occupiedDay = await screen.findByRole('button', {
            name: /20 de julio de 2026 — Ocupado — Manual/i
        });

        await user.click(occupiedDay);
        await user.click(occupiedDay);

        expect(await screen.findByText('1 día seleccionado')).toBeInTheDocument();

        const unblockButton = screen.getByRole('button', { name: 'Liberar' });
        await user.click(unblockButton);

        await waitFor(() => {
            expect(mockBatchToggle).toHaveBeenCalledWith({
                id: ACC_ID,
                dates: ['2026-07-20'],
                isBlocked: false,
                note: undefined
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
