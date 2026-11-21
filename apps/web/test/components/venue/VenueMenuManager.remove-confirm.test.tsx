/**
 * @file VenueMenuManager.remove-confirm.test.tsx
 * @description Regression tests (HOS-2429): removing a menu section or a dish
 * used to act instantly. Both now ask first; cancelling leaves the draft intact.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueMenuManager } from '../../../src/components/venue/VenueMenuManager.client';

vi.mock('../../../src/components/venue/VenueMenuManager.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'https://api.test' }));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { get: vi.fn(), getProtected: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('../../../src/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: vi.fn()
}));

import { showConfirmationDialog } from '@/lib/forms/show-confirmation-dialog';
import { apiClient } from '../../../src/lib/api/client';
import { getEntitlementsCached } from '../../../src/lib/entitlements-cache';

const mockEntitlements = vi.mocked(getEntitlementsCached);
const mockConfirm = vi.mocked(showConfirmationDialog);

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

describe('VenueMenuManager removal confirmations (HOS-2429)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFreshEntitlements.mockImplementation((input: { vertical: string }) =>
            mockEntitlements(input as never)
        );
        mockEntitlements.mockResolvedValue(ENTITLED as never);
    });

    it('keeps the dish when the user cancels the confirmation', async () => {
        mockConfirm.mockResolvedValue(false);
        await renderLoaded();

        const removeButtons = screen.getAllByRole('button', { name: 'Quitar' });
        // Section "Quitar" comes first in the DOM, the dish one second.
        fireEvent.click(removeButtons[1] as HTMLElement);

        await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
    });

    it('removes the dish only after the user confirms', async () => {
        mockConfirm.mockResolvedValue(true);
        await renderLoaded();

        fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[1] as HTMLElement);

        await waitFor(() => expect(screen.queryByDisplayValue('Empanadas')).toBeNull());
        expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
    });

    it('keeps the whole section when the user cancels', async () => {
        mockConfirm.mockResolvedValue(false);
        await renderLoaded();

        fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0] as HTMLElement);

        await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
        expect(mockConfirm.mock.calls[0]?.[0].title).toBe('Quitar sección');
        expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
    });

    it('removes the section and its dishes after the user confirms', async () => {
        mockConfirm.mockResolvedValue(true);
        await renderLoaded();

        fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0] as HTMLElement);

        await waitFor(() => expect(screen.queryByDisplayValue('Entradas')).toBeNull());
        expect(screen.queryByDisplayValue('Empanadas')).toBeNull();
    });
});
