/**
 * @file VenueEventsManager.past.test.tsx
 * @description HOS-2254: the agenda editor groups the events the API reports
 * as past under a collapsed «Pasados» section, lets the owner duplicate them
 * into a live draft (date cleared) or remove them (one or all), keeps them out
 * of the live ceiling, and still re-sends the ones that were not removed.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueEventsManager } from '../../../src/components/venue/VenueEventsManager.client';
import { describeAgendaSaveError } from '../../../src/lib/venue/venue-event-draft';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string, count: number) => `${key}:${count}`
    })
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { get: vi.fn(), getProtected: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

import { apiClient } from '../../../src/lib/api/client';

const mockGet = vi.mocked(apiClient.getProtected);
const mockPut = vi.mocked(apiClient.put);

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;

const row = (n: number, over: Record<string, unknown>) => ({
    id: id(n),
    title: `Evento ${n}`,
    description: null,
    recurrence: 'once',
    date: '2026-11-20',
    weekday: null,
    startTime: '21:00',
    endTime: '23:00',
    isActive: true,
    isPast: false,
    ...over
});

function load(events: Array<Record<string, unknown>>) {
    mockGet.mockResolvedValue({ ok: true as const, data: { events } } as never);
    mockPut.mockResolvedValue({ ok: true as const, data: { events: [] } } as never);
    render(
        <VenueEventsManager
            listingId="22222222-2222-4222-8222-222222222222"
            locale="es"
            weekdayLabels={WEEKDAYS}
            sectionState="available"
        />
    );
}

async function savedEvents(): Promise<Array<Record<string, unknown>>> {
    fireEvent.click(await screen.findByText('Guardar agenda'));
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    return (mockPut.mock.calls[0]?.[0].body as { events: Array<Record<string, unknown>> }).events;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('VenueEventsManager: past events (HOS-2254)', () => {
    it('shows past events only inside the collapsed «Pasados» group, live ones as cards', async () => {
        load([row(1, {}), row(2, { title: 'Viejo', date: '2026-10-01', isPast: true })]);

        const group = await screen.findByTestId('venue-events-past');

        expect(group.tagName).toBe('DETAILS');
        expect(group.hasAttribute('open')).toBe(false);
        expect(within(group).getByText('Viejo')).toBeTruthy();
        expect(within(group).queryByText('Evento 1')).toBeNull();
        expect(screen.getAllByLabelText('Título')).toHaveLength(1);
    });

    it('does not render the group at all when nothing is past', async () => {
        load([row(1, {})]);

        await screen.findByText('Guardar agenda');

        expect(screen.queryByTestId('venue-events-past')).toBeNull();
    });

    it('duplicates a past event into a live draft with an empty date, no id, and focuses the date', async () => {
        load([row(2, { title: 'Viejo', date: '2026-10-01', isPast: true })]);
        const group = await screen.findByTestId('venue-events-past');

        fireEvent.click(within(group).getByText('Duplicar'));

        const dateInput = (await screen.findByLabelText('Fecha')) as HTMLInputElement;
        expect(dateInput.value).toBe('');
        expect(document.activeElement).toBe(dateInput);
        expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Viejo');
        // The original past event is still there until removed.
        expect(within(screen.getByTestId('venue-events-past')).getByText('Viejo')).toBeTruthy();
    });

    it('removes one past event: it is not sent on save, the others are', async () => {
        load([
            row(1, {}),
            row(2, { title: 'Viejo A', date: '2026-10-01', isPast: true }),
            row(3, { title: 'Viejo B', date: '2026-10-02', isPast: true })
        ]);
        const group = await screen.findByTestId('venue-events-past');

        fireEvent.click(within(group).getAllByText('Quitar')[0] as HTMLElement);
        const events = await savedEvents();

        expect(events.map((e) => e.id)).toEqual([id(1), id(3)]);
    });

    it('re-sends past events untouched when the owner removes nothing', async () => {
        load([row(1, {}), row(2, { title: 'Viejo', date: '2026-10-01', isPast: true })]);

        const events = await savedEvents();

        expect(events.map((e) => e.id)).toEqual([id(1), id(2)]);
    });

    it('«Borrar todos los pasados» removes every past event after confirming, and none of the live ones', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        load([
            row(1, {}),
            row(2, { date: '2026-10-01', isPast: true }),
            row(3, { date: '2026-10-02', isPast: true })
        ]);

        fireEvent.click(await screen.findByText('Borrar todos los pasados'));
        const events = await savedEvents();

        expect(events.map((e) => e.id)).toEqual([id(1)]);
        expect(screen.queryByTestId('venue-events-past')).toBeNull();
    });

    it('keeps everything when the owner declines the confirmation', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        load([row(2, { date: '2026-10-01', isPast: true })]);

        fireEvent.click(await screen.findByText('Borrar todos los pasados'));

        expect(screen.getByTestId('venue-events-past')).toBeTruthy();
    });

    it('past events do not count against the ceiling: 30 live plus past still lets the owner add', async () => {
        const live = Array.from({ length: 29 }, (_, i) => row(100 + i, {}));
        load([...live, row(2, { date: '2026-10-01', isPast: true })]);

        const add = (await screen.findByText('Agregar evento')) as HTMLButtonElement;

        expect(add.disabled).toBe(false);
    });
});

describe('VenueEventsManager: save errors and date hint (HOS-2254)', () => {
    it('explains a 400 newPast with the offending new entries, not the generic error', async () => {
        load([]);
        mockPut.mockResolvedValue({
            ok: false as const,
            error: { status: 400, message: 'zodError.venue.events.newPast' }
        } as never);
        fireEvent.click(await screen.findByText('Agregar evento'));
        fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Brindis' } });
        fireEvent.click(screen.getByLabelText('Un solo día'));
        fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '20:00' } });

        fireEvent.click(screen.getByText('Guardar agenda'));

        expect(await screen.findByText(/fecha pasada: Brindis/)).toBeTruthy();
        expect(screen.queryByText('No se pudo guardar la agenda.')).toBeNull();
    });

    it('maps the 100 total cap and the live cap to their own messages', () => {
        const t = (_key: string, fallback?: string) => fallback ?? _key;
        const total = describeAgendaSaveError({
            message: 'zodError.venue.events.maxTotal',
            entries: [],
            t
        });
        const live = describeAgendaSaveError({
            message: 'zodError.venue.events.max',
            entries: [],
            t
        });
        expect(total).toContain('en total');
        expect(live).not.toContain('en total');
        expect(describeAgendaSaveError({ message: 'other', entries: [], t })).toBeNull();
    });

    it('sets min on the date of a new entry and not on a stored one', async () => {
        load([row(1, {})]);
        fireEvent.click(await screen.findByText('Agregar evento'));
        fireEvent.click(screen.getAllByLabelText('Un solo día')[1] as HTMLElement);

        const dates = screen.getAllByLabelText('Fecha') as HTMLInputElement[];

        expect(dates[0]?.getAttribute('min')).toBeNull();
        expect(dates[1]?.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
