/**
 * @file VenueMenuLinkField.test.tsx
 * @description The menu link lives in the carta, not in price (HOS-1787 leaf
 * 5.3, TEST:5.3:1, DEC-FAC-062).
 *
 * Three properties, each one a regression this leaf exists to prevent:
 *
 * 1. `precio` renders no `#ce-menuUrl`; the carta's `available` branch renders
 *    it as an editable input.
 * 2. Saving sends `PATCH /protected/venues/:id` with `{ menuUrl }` and NOTHING
 *    else — the link is its own one-key write, never the carta document and
 *    never the whole listing form. Since owner decision 14 (superseding the
 *    separate «Guardar enlace» of DEC-FAC-062) the carta's save bar sends it:
 *    dirty tracking, «Descartar» and a partial failure told honestly.
 * 3. A `locked` carta shows the link read-only inside the upsell and mounts no
 *    editable control (HOS-1854 already owns that branch; this pins that the
 *    new field did not leak into it).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueMenuManager } from '@/components/venue/VenueMenuManager.client';
import { apiClient } from '@/lib/api/client';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import { getEntitlementsCached } from '@/lib/entitlements-cache';

vi.mock('@/lib/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/i18n')>()),
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
        getProtected: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn()
    }
}));

const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const LISTING_PATH = `/api/v1/protected/venues/${LISTING_ID}`;

const ENTITLED: EntitlementsData = {
    entitlements: { manage_venue_menu: 1 },
    limits: {},
    hasLiveNonTrialTitle: false,
    failed: false
};

const EMPTY_MENU = { ok: true as const, data: { sections: [], file: null } };

const mockGet = vi.mocked(apiClient.getProtected);
const mockPatch = vi.mocked(apiClient.patch);
const mockEntitlements = vi.mocked(getEntitlementsCached);

beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements.mockResolvedValue(ENTITLED);
    mockFreshEntitlements.mockResolvedValue(ENTITLED);
    mockGet.mockResolvedValue(EMPTY_MENU as never);
    mockPatch.mockResolvedValue({ ok: true, data: {} } as never);
});

describe('menu link placement (TEST:5.3:1)', () => {
    it('renders an editable #ce-menuUrl inside the available carta', async () => {
        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                menuUrl="https://menu.example/carta"
            />
        );

        const input = document.getElementById('ce-menuUrl') as HTMLInputElement | null;

        expect(input).not.toBeNull();
        expect(input).toHaveValue('https://menu.example/carta');
        expect(input).not.toBeDisabled();

        await waitFor(() => {
            expect(screen.getByTestId('venue-menu-link-field')).toHaveAttribute(
                'data-hydrated',
                'true'
            );
        });
    });

    it('renders the locked link read-only, with no editable control', async () => {
        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
                menuUrl="https://menu.example/carta"
            />
        );

        // The upsell still shows the stored link — the data belongs to the owner.
        expect(screen.getByRole('link', { name: 'Enlace al menú' })).toHaveAttribute(
            'href',
            'https://menu.example/carta'
        );

        // But the new field never mounts in the locked branch: one editable
        // control in that state would offer a write the plan refuses.
        expect(document.getElementById('ce-menuUrl')).toBeNull();
    });
});

describe('menu link on the carta save bar (owner decision 14)', () => {
    const mockPut = vi.mocked(apiClient.put);

    async function renderManager(menuUrl: string | null) {
        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                menuUrl={menuUrl}
            />
        );
        await waitFor(() => {
            expect(screen.getByTestId('venue-menu-link-field')).toHaveAttribute(
                'data-hydrated',
                'true'
            );
        });
        return document.getElementById('ce-menuUrl') as HTMLInputElement;
    }

    it('offers no «Guardar enlace» button: the bar appears when the link changes', async () => {
        const input = await renderManager('https://old.example/carta');
        expect(screen.queryByRole('button', { name: 'Guardar enlace' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();

        fireEvent.change(input, { target: { value: 'https://new.example/carta' } });

        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    });

    it('sends a one-key PATCH with the new link from «Guardar cambios», and no carta PUT', async () => {
        const input = await renderManager('https://old.example/carta');
        fireEvent.change(input, { target: { value: 'https://new.example/carta' } });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledTimes(1);
        });
        expect(mockPatch).toHaveBeenCalledWith({
            path: LISTING_PATH,
            body: { menuUrl: 'https://new.example/carta' }
        });
        expect(Object.keys(mockPatch.mock.calls[0]?.[0].body as Record<string, unknown>)).toEqual([
            'menuUrl'
        ]);
        expect(mockPut).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText('Cambios guardados')).toBeInTheDocument();
        });
    });

    it('clears the link with an explicit null', async () => {
        const input = await renderManager('https://old.example/carta');
        fireEvent.change(input, { target: { value: '' } });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledWith({
                path: LISTING_PATH,
                body: { menuUrl: null }
            });
        });
    });

    it('restores the stored link on «Descartar»', async () => {
        const input = await renderManager('https://old.example/carta');
        fireEvent.change(input, { target: { value: 'https://typo.example' } });

        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

        expect(input).toHaveValue('https://old.example/carta');
        expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
        expect(mockPatch).not.toHaveBeenCalled();
    });

    it('says in the bar when the link failed and keeps it dirty', async () => {
        mockPatch.mockResolvedValueOnce({ ok: false, error: { status: 500 } } as never);
        const input = await renderManager('https://old.example/carta');
        fireEvent.change(input, { target: { value: 'https://new.example/carta' } });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el enlace.');
        expect(input).toHaveValue('https://new.example/carta');
    });

    const ONE_DISH_MENU = {
        ok: true as const,
        data: {
            sections: [
                {
                    name: 'Entradas',
                    description: null,
                    items: [
                        {
                            name: 'Empanadas',
                            description: null,
                            priceCents: 250_000,
                            isAvailable: true,
                            photoUrl: null,
                            photoPublicId: null,
                            photoAlt: null
                        }
                    ]
                }
            ],
            file: null
        }
    };

    async function editBoth() {
        mockGet.mockResolvedValue(ONE_DISH_MENU as never);
        const input = await renderManager('https://old.example/carta');
        fireEvent.change(await screen.findByDisplayValue('Empanadas'), {
            target: { value: 'Empanadas de carne' }
        });
        fireEvent.change(input, { target: { value: 'https://new.example/carta' } });
        return input;
    }

    it('tells a stored carta with a failed link, and only the link stays dirty', async () => {
        mockPut.mockResolvedValueOnce({ ok: true, data: ONE_DISH_MENU.data } as never);
        mockPatch.mockResolvedValueOnce({ ok: false, error: { status: 500 } } as never);
        const input = await editBoth();

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Se guardó la carta, pero no el enlace al menú. Probá guardar de nuevo.'
        );
        // Discarding now keeps the stored dish and only restores the link.
        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
        expect(screen.getByDisplayValue('Empanadas de carne')).toBeInTheDocument();
        expect(input).toHaveValue('https://old.example/carta');
    });

    it('tells a stored link with a failed carta', async () => {
        mockPut.mockResolvedValueOnce({ ok: false, error: { status: 500 } } as never);
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} } as never);
        const input = await editBoth();

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Se guardó el enlace al menú, pero no la carta. Probá guardar de nuevo.'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
        expect(input).toHaveValue('https://new.example/carta');
        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
    });
});
