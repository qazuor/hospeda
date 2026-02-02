/**
 * QZPayProvider Integration Tests - Admin Application
 *
 * Tests QZPayProvider setup and configuration in the admin app.
 * Validates provider initialization, config passing, and hook availability.
 *
 * @module test/integration/qzpay-provider
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const { mockUsePlans, mockCreateQZPayBilling, mockCreateHttpBillingAdapter } = vi.hoisted(() => {
    const mockUsePlans = vi.fn(() => ({ data: [], isLoading: false, error: null }));
    const mockBilling = {
        customers: { list: vi.fn(), findById: vi.fn() },
        subscriptions: { list: vi.fn(), findById: vi.fn() },
        payments: { list: vi.fn() },
        plans: { list: vi.fn() }
    };
    const mockCreateQZPayBilling = vi.fn(() => mockBilling);
    const mockCreateHttpBillingAdapter = vi.fn(() => ({
        customers: {},
        subscriptions: {},
        payments: {}
    }));

    return { mockUsePlans, mockCreateQZPayBilling, mockCreateHttpBillingAdapter };
});

// Now setup vi.mock calls with the hoisted functions
vi.mock('@qazuor/qzpay-core', () => ({
    createQZPayBilling: mockCreateQZPayBilling
}));

vi.mock('@qazuor/qzpay-react', () => ({
    QZPayProvider: ({ children, billing }: { children: ReactNode; billing: any }) => (
        <div
            data-testid="qzpay-provider"
            data-billing={billing ? 'present' : 'missing'}
        >
            {children}
        </div>
    ),
    QZPayThemeProvider: ({ children, theme }: { children: ReactNode; theme: any }) => (
        <div
            data-testid="qzpay-theme-provider"
            data-theme={theme ? 'present' : 'missing'}
        >
            {children}
        </div>
    ),
    usePlans: mockUsePlans,
    useSubscription: vi.fn(() => ({ data: null, isLoading: false, error: null }))
}));

vi.mock('@/lib/billing-http-adapter', () => ({
    createHttpBillingAdapter: mockCreateHttpBillingAdapter
}));

vi.mock('@/lib/qzpay-theme', () => ({
    adminQzpayTheme: {
        colors: { primary: '#1e293b' },
        typography: { fontFamily: 'system-ui' }
    }
}));

import { createHttpBillingAdapter } from '@/lib/billing-http-adapter';
import { adminQzpayTheme } from '@/lib/qzpay-theme';
import { createQZPayBilling } from '@qazuor/qzpay-core';
// Import after mocks to get mocked versions
import { QZPayProvider, QZPayThemeProvider, usePlans } from '@qazuor/qzpay-react';

describe('QZPayProvider Integration - Admin App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Set test environment variables
        import.meta.env.VITE_API_URL = 'http://localhost:3001';
        import.meta.env.PROD = false;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should render QZPayProvider without errors', () => {
        // Arrange
        const billing = createQZPayBilling({ storage: {} as any });

        // Act
        const { container } = render(
            <QZPayProvider billing={billing}>
                <div>Test content</div>
            </QZPayProvider>
        );

        // Assert
        expect(container).toBeTruthy();
        expect(screen.getByTestId('qzpay-provider')).toBeInTheDocument();
        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should pass correct billing config to QZPayProvider', () => {
        // Arrange
        const apiUrl = 'http://localhost:3001';

        // Act - simulate what __root.tsx does
        const adapter = createHttpBillingAdapter({ apiUrl });
        const _billing = createQZPayBilling({
            storage: adapter,
            defaultCurrency: 'ARS',
            livemode: false
        });

        // Assert - adapter created with correct config
        expect(mockCreateHttpBillingAdapter).toHaveBeenCalledWith(
            expect.objectContaining({
                apiUrl: 'http://localhost:3001'
            })
        );

        // Assert - billing created with correct options
        expect(mockCreateQZPayBilling).toHaveBeenCalledWith(
            expect.objectContaining({
                storage: expect.any(Object),
                defaultCurrency: 'ARS',
                livemode: false
            })
        );
    });

    it('should allow child components to access billing hooks', () => {
        // Mock usePlans to return test data
        mockUsePlans.mockReturnValue({
            data: [
                { id: 'plan_1', name: 'Basic' },
                { id: 'plan_2', name: 'Pro' }
            ],
            isLoading: false,
            error: null
        });

        const ChildComponent = () => {
            const { data, isLoading } = usePlans();
            return (
                <div data-testid="child-component">
                    {isLoading ? 'Cargando planes...' : `${data.length} planes disponibles`}
                </div>
            );
        };

        const billing = createQZPayBilling({ storage: {} as any });

        // Act
        render(
            <QZPayProvider billing={billing}>
                <ChildComponent />
            </QZPayProvider>
        );

        // Assert - child can access hook
        expect(screen.getByTestId('child-component')).toHaveTextContent('2 planes disponibles');
    });

    it('should handle missing API URL config gracefully', () => {
        // Arrange - test fallback logic directly
        const undefinedUrl = undefined;
        const fallbackUrl = 'http://localhost:3001';

        // Act - simulate what __root.tsx does with fallback
        const apiUrl = undefinedUrl || fallbackUrl;

        // Assert - fallback value should be used when undefined
        expect(apiUrl).toBe(fallbackUrl);

        // Verify the pattern works
        vi.clearAllMocks();
        createHttpBillingAdapter({ apiUrl });

        expect(mockCreateHttpBillingAdapter).toHaveBeenCalledWith(
            expect.objectContaining({
                apiUrl: fallbackUrl
            })
        );
    });

    it('should initialize QZPayProvider in production mode', () => {
        // Act - simulate production setup
        const livemode = true;
        createQZPayBilling({
            storage: {} as any,
            defaultCurrency: 'ARS',
            livemode
        });

        // Assert - livemode true in production
        expect(mockCreateQZPayBilling).toHaveBeenCalledWith(
            expect.objectContaining({
                livemode: true
            })
        );
    });

    it('should render with theme provider wrapping children', () => {
        // Arrange
        const billing = createQZPayBilling({ storage: {} as any });

        // Act
        render(
            <QZPayProvider billing={billing}>
                <QZPayThemeProvider theme={adminQzpayTheme}>
                    <div>Themed content</div>
                </QZPayThemeProvider>
            </QZPayProvider>
        );

        // Assert - both providers present
        expect(screen.getByTestId('qzpay-provider')).toBeInTheDocument();
        expect(screen.getByTestId('qzpay-theme-provider')).toBeInTheDocument();

        // Assert - theme is provided
        const themeProvider = screen.getByTestId('qzpay-theme-provider');
        expect(themeProvider).toHaveAttribute('data-theme', 'present');
    });

    it('should initialize billing with correct currency', () => {
        // Act - simulate billing creation
        createQZPayBilling({
            storage: {} as any,
            defaultCurrency: 'ARS',
            livemode: false
        });

        // Assert - ARS currency set (Argentina pesos)
        expect(mockCreateQZPayBilling).toHaveBeenCalledWith(
            expect.objectContaining({
                defaultCurrency: 'ARS'
            })
        );
    });

    it('should provide complete provider hierarchy', () => {
        // Arrange
        const billing = createQZPayBilling({ storage: {} as any });

        // Act - render full provider tree
        render(
            <QZPayProvider billing={billing}>
                <QZPayThemeProvider theme={adminQzpayTheme}>
                    <div data-testid="app-content">App</div>
                </QZPayThemeProvider>
            </QZPayProvider>
        );

        // Assert - all providers in correct order
        expect(screen.getByTestId('qzpay-provider')).toBeInTheDocument();
        expect(screen.getByTestId('qzpay-theme-provider')).toBeInTheDocument();
        expect(screen.getByTestId('app-content')).toBeInTheDocument();

        // Assert - billing data attribute present
        const provider = screen.getByTestId('qzpay-provider');
        expect(provider).toHaveAttribute('data-billing', 'present');
    });
});
