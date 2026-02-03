/**
 * UsageMeters Component Tests
 *
 * Tests for the UsageMeters billing component
 */

import type { QZPayCustomerLimit } from '@qazuor/qzpay-core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageMeters } from '../../../src/components/billing/UsageMeters';

// Mock @qazuor/qzpay-react hooks
vi.mock('@qazuor/qzpay-react', () => ({
    useLimits: vi.fn(),
    useCurrentCustomer: vi.fn()
}));

import { useCurrentCustomer, useLimits } from '@qazuor/qzpay-react';

describe('UsageMeters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show auth required message when no customer', () => {
        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([null, vi.fn()]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: null,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(
            screen.getByText('Necesitás estar autenticado para ver el uso de recursos')
        ).toBeInTheDocument();
    });

    it('should render loading state', () => {
        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: null,
            isLoading: true,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Uso de Recursos')).toBeInTheDocument();
        expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('should render error state', () => {
        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: null,
            isLoading: false,
            error: new Error('Failed to load limits')
        });

        render(<UsageMeters />);

        expect(screen.getByText('Failed to load limits')).toBeInTheDocument();
    });

    it('should render unlimited state when no active limits', () => {
        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: [],
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Recursos Ilimitados')).toBeInTheDocument();
        expect(
            screen.getByText('Tu plan incluye uso ilimitado de todos los recursos')
        ).toBeInTheDocument();
    });

    it('should render unlimited state when all limits are -1', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'accommodations',
                customerId: 'cus_123',
                currentValue: 0,
                maxValue: -1,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Recursos Ilimitados')).toBeInTheDocument();
    });

    it('should render active limits with green progress bar (<60%)', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'accommodations',
                customerId: 'cus_123',
                currentValue: 5,
                maxValue: 10,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Accommodations')).toBeInTheDocument();
        expect(screen.getByText('5 / 10')).toBeInTheDocument();
        expect(screen.getByText('50% usado')).toBeInTheDocument();

        // Should NOT show warnings
        expect(screen.queryByText('Acercándose al límite')).not.toBeInTheDocument();
        expect(screen.queryByText('Límite alcanzado')).not.toBeInTheDocument();
    });

    it('should render yellow warning when approaching limit (60-80%)', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'photos',
                customerId: 'cus_123',
                currentValue: 7,
                maxValue: 10,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Photos')).toBeInTheDocument();
        expect(screen.getByText('70% usado')).toBeInTheDocument();
        expect(screen.getByText('Acercándose al límite')).toBeInTheDocument();
        expect(screen.getByText(/Estás usando el 70% de tu capacidad/)).toBeInTheDocument();
    });

    it('should render red warning when at limit (>=80%)', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'bookings',
                customerId: 'cus_123',
                currentValue: 9,
                maxValue: 10,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Bookings')).toBeInTheDocument();
        expect(screen.getByText('90% usado')).toBeInTheDocument();
        expect(screen.getByText('Límite alcanzado')).toBeInTheDocument();
        expect(screen.getByText(/Alcanzaste el límite de tu plan/)).toBeInTheDocument();
    });

    it('should show upgrade CTA when any limit >= 60%', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'accommodations',
                customerId: 'cus_123',
                currentValue: 6,
                maxValue: 10,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('¿Necesitás más capacidad?')).toBeInTheDocument();
        expect(
            screen.getByText('Mejorá tu plan y obtené acceso a más recursos')
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            '/precios/propietarios'
        );
    });

    it('should handle multiple limits', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'accommodations',
                customerId: 'cus_123',
                currentValue: 3,
                maxValue: 10,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            },
            {
                limitKey: 'photos',
                customerId: 'cus_123',
                currentValue: 50,
                maxValue: 100,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            },
            {
                limitKey: 'featured_days',
                customerId: 'cus_123',
                currentValue: 8,
                maxValue: 10,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Accommodations')).toBeInTheDocument();
        expect(screen.getByText('Photos')).toBeInTheDocument();
        expect(screen.getByText('Featured Days')).toBeInTheDocument();

        expect(screen.getByText('30% usado')).toBeInTheDocument();
        expect(screen.getByText('50% usado')).toBeInTheDocument();
        expect(screen.getByText('80% usado')).toBeInTheDocument();
    });

    it('should use custom customer ID when provided', () => {
        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_default' },
            vi.fn()
        ]);

        const mockUseLimits = useLimits as ReturnType<typeof vi.fn>;
        mockUseLimits.mockReturnValue({
            data: [],
            isLoading: false,
            error: null
        });

        render(<UsageMeters customerId="cus_custom" />);

        expect(mockUseLimits).toHaveBeenCalledWith({
            customerId: 'cus_custom'
        });
    });

    it('should cap percentage at 100%', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'overused',
                customerId: 'cus_123',
                currentValue: 15,
                maxValue: 10,
                resetAt: null,
                source: 'manual',
                sourceId: null
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        // Should show 100% not 150%
        expect(screen.getByText('100% usado')).toBeInTheDocument();
    });

    it('should format snake_case limit keys to Title Case', () => {
        const mockLimits: QZPayCustomerLimit[] = [
            {
                limitKey: 'total_active_listings',
                customerId: 'cus_123',
                currentValue: 5,
                maxValue: 10,
                resetAt: null,
                source: 'subscription',
                sourceId: 'sub_123'
            }
        ];

        (useCurrentCustomer as ReturnType<typeof vi.fn>).mockReturnValue([
            { id: 'cus_123' },
            vi.fn()
        ]);
        (useLimits as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockLimits,
            isLoading: false,
            error: null
        });

        render(<UsageMeters />);

        expect(screen.getByText('Total Active Listings')).toBeInTheDocument();
    });
});
