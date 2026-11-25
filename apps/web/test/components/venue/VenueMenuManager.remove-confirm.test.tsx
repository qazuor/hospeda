/**
 * @file VenueMenuManager.remove-confirm.test.tsx
 * @description Regression tests (HOS-2429): removing a menu section or a dish
 * used to act instantly. Both ask first through the kit Repeater's dialog;
 * cancelling leaves the draft intact. Also pins the save-bar model the carta
 * moved to (HOS-2487): the bar shows only on a dirty draft, and «Descartar»
 * restores the stored carta.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueMenuManager } from '../../../src/components/venue/VenueMenuManager.client';

vi.mock('../../../src/components/venue/VenueMenuManager.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/lib/i18n')>()),
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test',
    isLoggingEnabled: () => false
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { get: vi.fn(), getProtected: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('../../../src/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

import { apiClient } from '../../../src/lib/api/client';
import { getEntitlementsCached } from '../../../src/lib/entitlements-cache';

const mockEntitlements = vi.mocked(getEntitlementsCached);

const ENTITLED = {
    entitlements: { manage_venue_menu: 1 },
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

async function renderLoaded(): Promise<void> {
    vi.mocked(apiClient.getProtected).mockResolvedValue(LOADED_MENU as never);
    render(
        <VenueMenuManager
            listingId="22222222-2222-4222-8222-222222222222"
            locale="es"
            upsellPlans={{ menu: 'Plan X', itemPhotos: 'Plan Fotos', translations: 'Plan T' }}
        />
    );
    await waitFor(() => expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument());
}

/** Clicks a row's «Quitar» and answers its dialog. */
async function removeAndAnswer(rowLabel: string, answer: string): Promise<void> {
    fireEvent.click(screen.getByRole('button', { name: `Quitar ${rowLabel}` }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: answer }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

function mirrorFreshRead(): void {
    mockFreshEntitlements.mockImplementation((input: { vertical: string }) =>
        mockEntitlements(input as never)
    );
    mockEntitlements.mockResolvedValue(ENTITLED as never);
}

describe('VenueMenuManager removal confirmations (HOS-2429)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mirrorFreshRead();
    });

    it('keeps the dish when the user cancels the confirmation', async () => {
        await renderLoaded();

        await removeAndAnswer('Empanadas', 'Cancelar');

        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
    });

    it('removes the dish only after the user confirms', async () => {
        await renderLoaded();

        fireEvent.click(screen.getByRole('button', { name: 'Quitar Empanadas' }));
        expect(await screen.findByRole('alertdialog', { name: 'Quitar plato' })).toHaveTextContent(
            '¿Quitar este plato de la carta?'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Quitar plato' }));

        await waitFor(() => expect(screen.queryByDisplayValue('Empanadas')).toBeNull());
        expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
    });

    it('keeps the whole section when the user cancels', async () => {
        await renderLoaded();

        fireEvent.click(screen.getByRole('button', { name: 'Quitar Entradas' }));
        expect(await screen.findByRole('alertdialog', { name: 'Quitar sección' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
        expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
    });

    it('removes the section and its dishes after the user confirms', async () => {
        await renderLoaded();

        await removeAndAnswer('Entradas', 'Quitar sección');

        expect(screen.queryByDisplayValue('Entradas')).toBeNull();
        expect(screen.queryByDisplayValue('Empanadas')).toBeNull();
    });
});

describe('VenueMenuManager save bar (HOS-2487)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mirrorFreshRead();
    });

    it('has no own save button and shows the bar only once the draft changes', async () => {
        await renderLoaded();

        expect(screen.queryByRole('button', { name: 'Guardar carta' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Agregar sección' }));

        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    });

    it('«Descartar» restores the stored carta and hides the bar', async () => {
        await renderLoaded();
        await removeAndAnswer('Empanadas', 'Quitar plato');
        expect(screen.queryByDisplayValue('Empanadas')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
    });

    it('a saved draft is the new baseline: the bar leaves after the save', async () => {
        vi.mocked(apiClient.put).mockResolvedValue({ ok: true, data: LOADED_MENU.data } as never);
        await renderLoaded();
        await removeAndAnswer('Empanadas', 'Quitar plato');

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
        expect(vi.mocked(apiClient.put).mock.calls[0]?.[0]).toEqual({
            path: '/api/v1/protected/venues/22222222-2222-4222-8222-222222222222/menu',
            body: {
                sections: [
                    {
                        name: 'Entradas',
                        description: null,
                        nameI18n: null,
                        descriptionI18n: null,
                        items: []
                    }
                ]
            }
        });
        // «Cambios guardados» shows for a moment: the draft is no longer dirty.
        expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
        expect(document.querySelector('[data-status]')).toHaveAttribute('data-status', 'saved');
    });
});
