/**
 * @file VenueSectionLocked.test.tsx
 * @description The proactive `locked` treatment of the three venue section
 * managers (HOS-1854, AC:5:2).
 *
 * Before this leaf each manager rendered an editable form for every owner and
 * learned about the plan only from a 403 on save. The section state now arrives
 * from the page, so what these tests hold is the three properties that
 * distinguish the proactive state from the reactive one:
 *
 * 1. **No editable control at all** — not a disabled form, a read-only view.
 *    The data is still there, which is the point of DEC-FAC-025.
 * 2. **The upsell is on the FIRST render** — asserted with `put` never called,
 *    so a component that still waits for the refusal fails here.
 * 3. **"Vaciar" sends the `delete` intent** — an empty replacement payload (and
 *    the file DELETE on the carta) — never the items it just showed.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueDailySpecialsManager } from '@/components/venue/VenueDailySpecialsManager.client';
import { VenueEventsManager } from '@/components/venue/VenueEventsManager.client';
import { VenueMenuManager } from '@/components/venue/VenueMenuManager.client';
import { apiClient } from '@/lib/api/client';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import { getEntitlementsCached } from '@/lib/entitlements-cache';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string) => key
    })
}));

vi.mock('@/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);
const mockEntitlements = vi.mocked(getEntitlementsCached);

const LISTING_ID = '22222222-2222-4222-8222-222222222222';

/** Every venue capability held, so the locked state is the only reason to read. */
const ENTITLED: EntitlementsData = {
    entitlements: {
        manage_venue_menu: 1,
        manage_venue_daily_special: 1,
        manage_venue_events: 1
    },
    limits: {},
    hasLiveNonTrialTitle: false,
    failed: false
};

const LOADED_MENU = {
    ok: true as const,
    data: {
        sections: [
            {
                name: 'Entradas',
                description: null,
                items: [
                    {
                        name: 'Empanadas',
                        description: 'De carne cortada a cuchillo',
                        priceCents: 250_000,
                        isAvailable: true,
                        photoUrl: null,
                        photoPublicId: null,
                        photoAlt: null
                    }
                ]
            }
        ],
        file: { url: 'https://res.cloudinary.com/demo/carta.pdf', kind: 'pdf' as const }
    }
};

const LOADED_SPECIALS = {
    ok: true as const,
    data: {
        specials: [
            {
                title: 'Milanesa a la napolitana',
                description: 'Con puré',
                priceCents: 1_850_000,
                validFrom: '2026-09-03',
                validUntil: '2026-09-03'
            }
        ]
    }
};

const LOADED_EVENTS = {
    ok: true as const,
    data: {
        events: [
            {
                title: 'Música en vivo',
                description: 'Cada viernes',
                recurrence: 'weekly' as const,
                date: null,
                weekday: 5,
                startTime: '21:00',
                endTime: '23:00',
                isActive: true
            }
        ]
    }
};

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements.mockResolvedValue(ENTITLED);
    mockFreshEntitlements.mockResolvedValue(ENTITLED);
    mockPut.mockResolvedValue({ ok: true, data: {} } as never);
    mockDelete.mockResolvedValue({ ok: true, data: { success: true } } as never);
});

/** Opens the confirmation and presses its destructive CTA. */
async function confirmVaciar(): Promise<void> {
    fireEvent.click(screen.getByTestId('venue-section-vaciar'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vaciar la sección' }));
}

describe('VenueMenuManager — a locked section is read-only and can be emptied (TEST:5.2:1)', () => {
    it('shows the stored carta without inputs, the upsell on the first render, and sends an empty PUT', async () => {
        mockGet.mockResolvedValue(LOADED_MENU as never);

        const { container } = render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
            />
        );

        // FIRST render: the upsell is already there, without waiting for the
        // document load and without any refusal (no PUT has run).
        expect(screen.getByTestId('venue-section-locked-notice')).toBeInTheDocument();
        expect(mockPut).not.toHaveBeenCalled();

        // The data is still visible — this is a lock, not a delete.
        expect(await screen.findByText('Empanadas')).toBeInTheDocument();
        expect(screen.getByText('Ver el PDF')).toBeInTheDocument();

        // Not a disabled form: no editable control and no Save exist at all.
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(container.querySelector('input')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Guardar carta' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Agregar plato' })).toBeNull();

        // Proactive: the refusal was never needed.
        expect(screen.getByTestId('venue-section-locked-notice')).toHaveTextContent(
            /plan Profesional/
        );
        expect(mockPut).not.toHaveBeenCalled();

        await confirmVaciar();

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledWith({
                path: `/api/v1/protected/venues/${LISTING_ID}/menu`,
                body: { sections: [] }
            });
        });
        // The uploaded file is a separate document and is deleted too.
        expect(mockDelete).toHaveBeenCalledWith({
            path: `/api/v1/protected/venues/${LISTING_ID}/menu-file`
        });

        // And no save with items slipped through afterwards.
        const bodies = mockPut.mock.calls.map(
            (call) => (call[0] as { body: { sections: unknown[] } }).body
        );
        expect(bodies.every((body) => body.sections.length === 0)).toBe(true);
    });

    it('does not call a file-only carta empty', async () => {
        mockGet.mockResolvedValue({
            ok: true as const,
            data: {
                sections: [],
                file: { url: 'https://res.cloudinary.com/demo/carta.pdf', kind: 'pdf' as const }
            }
        } as never);

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
            />
        );

        // The uploaded file IS data: showing it and "No data loaded" together
        // was a contradiction, and hid the "Vaciar" the file justifies.
        expect(await screen.findByText('Ver el PDF')).toBeInTheDocument();
        expect(screen.queryByText('No hay datos cargados en esta sección.')).toBeNull();
        expect(screen.getByTestId('venue-section-vaciar')).toBeInTheDocument();
    });

    it('does not call a link-only carta empty and shows the link read-only', async () => {
        mockGet.mockResolvedValue({
            ok: true as const,
            data: { sections: [], file: null }
        } as never);

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
                menuUrl="https://menu.example/carta"
            />
        );

        // `menuUrl` belongs to the `menu` section: the count adds it, so the
        // view must show it and the empty state must not deny it.
        expect(screen.getByRole('link', { name: 'Enlace al menú' })).toHaveAttribute(
            'href',
            'https://menu.example/carta'
        );
        expect(screen.queryByText('No hay datos cargados en esta sección.')).toBeNull();
        expect(screen.getByTestId('venue-section-vaciar')).toBeInTheDocument();
    });

    it('shows the empty message only when there are no dishes, file or link', async () => {
        mockGet.mockResolvedValue({
            ok: true as const,
            data: { sections: [], file: null }
        } as never);

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
            />
        );

        expect(
            await screen.findByText('No hay datos cargados en esta sección.')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('venue-section-vaciar')).toBeNull();
    });

    it('uses a non-actionable message when the locked file cannot be opened', async () => {
        mockGet.mockResolvedValue({
            ok: true as const,
            data: {
                sections: [],
                file: { url: 'javascript:alert(1)', kind: 'pdf' as const }
            }
        } as never);

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
            />
        );

        // There is no delete or upload control in `locked`, so the message
        // cannot tell the owner to do something the page does not offer.
        expect(await screen.findByText('No se puede abrir este archivo.')).toBeInTheDocument();
        expect(screen.queryByText(/Eliminalo y subilo de nuevo/)).toBeNull();
    });
});

describe('VenueDailySpecialsManager — a locked section is read-only and can be emptied (TEST:5.2:1)', () => {
    it('shows the stored specials without inputs, the upsell on the first render, and sends an empty PUT', async () => {
        mockGet.mockResolvedValue(LOADED_SPECIALS as never);

        const { container } = render(
            <VenueDailySpecialsManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
            />
        );

        // FIRST render: the upsell does not wait for the load or a refusal.
        expect(screen.getByTestId('venue-section-locked-notice')).toBeInTheDocument();
        expect(mockPut).not.toHaveBeenCalled();

        expect(await screen.findByText('Milanesa a la napolitana')).toBeInTheDocument();

        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(container.querySelector('input')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Guardar menú del día' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Agregar plato del día' })).toBeNull();

        expect(screen.getByTestId('venue-section-locked-notice')).toHaveTextContent(
            /plan Profesional/
        );
        expect(mockPut).not.toHaveBeenCalled();

        await confirmVaciar();

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledWith({
                path: `/api/v1/protected/venues/${LISTING_ID}/daily-specials`,
                body: { specials: [] }
            });
        });

        const bodies = mockPut.mock.calls.map(
            (call) => (call[0] as { body: { specials: unknown[] } }).body
        );
        expect(bodies.every((body) => body.specials.length === 0)).toBe(true);
    });
});

describe('VenueEventsManager — a locked section is read-only and can be emptied (TEST:5.2:1)', () => {
    it('shows the stored agenda without inputs, the upsell on the first render, and sends an empty PUT', async () => {
        mockGet.mockResolvedValue(LOADED_EVENTS as never);

        const { container } = render(
            <VenueEventsManager
                listingId={LISTING_ID}
                locale="es"
                weekdayLabels={WEEKDAYS}
                sectionState="locked"
            />
        );

        // FIRST render: the upsell does not wait for the load or a refusal.
        expect(screen.getByTestId('venue-section-locked-notice')).toBeInTheDocument();
        expect(mockPut).not.toHaveBeenCalled();

        expect(await screen.findByText('Música en vivo')).toBeInTheDocument();

        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(container.querySelector('input')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Guardar agenda' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Agregar evento' })).toBeNull();

        expect(screen.getByTestId('venue-section-locked-notice')).toHaveTextContent(
            /plan Profesional/
        );
        expect(mockPut).not.toHaveBeenCalled();

        await confirmVaciar();

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledWith({
                path: `/api/v1/protected/venues/${LISTING_ID}/events`,
                body: { events: [] }
            });
        });

        const bodies = mockPut.mock.calls.map(
            (call) => (call[0] as { body: { events: unknown[] } }).body
        );
        expect(bodies.every((body) => body.events.length === 0)).toBe(true);
    });
});
