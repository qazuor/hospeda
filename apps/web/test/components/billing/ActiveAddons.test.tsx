/**
 * ActiveAddons Component Tests
 *
 * Tests for the ActiveAddons billing component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveAddons } from '../../../src/components/billing/ActiveAddons';
import type { ActiveAddonPurchase } from '../../../src/components/billing/ActiveAddons';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ActiveAddons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should render loading state initially', () => {
        // Mock pending fetch
        mockFetch.mockImplementation(
            () =>
                new Promise(() => {
                    /* never resolves */
                })
        );

        render(<ActiveAddons apiUrl="/api/v1" />);

        expect(screen.getByText('Complementos Activos')).toBeInTheDocument();
        expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('should render empty state when no addons', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: []
            })
        });

        render(<ActiveAddons apiUrl="/api/v1" />);

        await waitFor(() => {
            expect(screen.getByText('No tenés complementos activos')).toBeInTheDocument();
        });

        expect(screen.getByText('Agregá complementos para potenciar tu plan')).toBeInTheDocument();
        expect(screen.getByText('Ver complementos disponibles')).toBeInTheDocument();
    });

    it('should render error state on fetch failure', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                error: {
                    message: 'Network error'
                }
            })
        });

        render(<ActiveAddons apiUrl="/api/v1" />);

        await waitFor(() => {
            expect(screen.getByText('Error al cargar los complementos')).toBeInTheDocument();
        });
    });

    it('should render active addons', async () => {
        const mockAddons: ActiveAddonPurchase[] = [
            {
                id: 'addon_1',
                addonId: 'extra_photos',
                name: 'Fotos Extra',
                description: '10 fotos adicionales',
                status: 'active',
                expiresAt: '2026-12-31T23:59:59Z',
                quantity: 1
            },
            {
                id: 'addon_2',
                addonId: 'featured_listing',
                name: 'Destacado Premium',
                description: 'Tu alojamiento destacado por 30 días',
                status: 'expiring_soon',
                expiresAt: '2026-02-15T23:59:59Z',
                quantity: 2
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: mockAddons
            })
        });

        render(<ActiveAddons apiUrl="/api/v1" />);

        await waitFor(() => {
            expect(screen.getByText('Fotos Extra')).toBeInTheDocument();
        });

        expect(screen.getByText('10 fotos adicionales')).toBeInTheDocument();
        expect(screen.getByText('Destacado Premium')).toBeInTheDocument();
        expect(screen.getByText('Tu alojamiento destacado por 30 días')).toBeInTheDocument();
        expect(screen.getByText('Activo')).toBeInTheDocument();
        expect(screen.getByText('Por vencer')).toBeInTheDocument();
    });

    it('should render expired addon with warning', async () => {
        const mockAddons: ActiveAddonPurchase[] = [
            {
                id: 'addon_1',
                addonId: 'expired_addon',
                name: 'Addon Vencido',
                description: 'Este addon está vencido',
                status: 'expired',
                expiresAt: '2025-01-01T00:00:00Z',
                quantity: 1
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: mockAddons
            })
        });

        render(<ActiveAddons apiUrl="/api/v1" />);

        await waitFor(() => {
            expect(screen.getByText('Addon Vencido')).toBeInTheDocument();
        });

        expect(screen.getByText('Vencido')).toBeInTheDocument();
        expect(screen.getByText('Venció el:')).toBeInTheDocument();
        expect(screen.getByText(/Este complemento ha vencido/)).toBeInTheDocument();
    });

    it('should show quantity when greater than 1', async () => {
        const mockAddons: ActiveAddonPurchase[] = [
            {
                id: 'addon_1',
                addonId: 'multi_addon',
                name: 'Multiple Units',
                description: null,
                status: 'active',
                expiresAt: '2026-12-31T23:59:59Z',
                quantity: 5
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: mockAddons
            })
        });

        render(<ActiveAddons apiUrl="/api/v1" />);

        await waitFor(() => {
            expect(screen.getByText('Multiple Units')).toBeInTheDocument();
        });

        expect(screen.getByText('Cantidad:')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should use default API URL when not provided', async () => {
        const originalEnv = import.meta.env.PUBLIC_API_URL;

        // Set environment variable
        import.meta.env.PUBLIC_API_URL = 'http://localhost:3001';

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: []
            })
        });

        render(<ActiveAddons />);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('http://localhost:3001'),
            expect.any(Object)
        );

        // Restore
        import.meta.env.PUBLIC_API_URL = originalEnv;
    });

    it('should include credentials in fetch request', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: []
            })
        });

        render(<ActiveAddons apiUrl="/api/v1" />);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                credentials: 'include'
            })
        );
    });
});
