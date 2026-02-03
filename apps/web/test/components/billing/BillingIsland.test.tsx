/**
 * BillingIsland Component Tests
 *
 * @module test/components/billing/BillingIsland.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingIsland } from '../../../src/components/billing/BillingIsland';

// Hoist mock theme to ensure it's available during mock hoisting
const mockTheme = vi.hoisted(() => ({
    colors: { primary: '#14b8a6' },
    typography: { fontFamily: 'Inter' },
    spacing: { md: '1rem' },
    borderRadius: { md: '0.5rem' },
    shadows: { md: 'shadow-md' },
    transitions: { normal: '200ms' }
}));

// Mock the QZPay modules
vi.mock('@qazuor/qzpay-react', () => ({
    QZPayProvider: vi.fn(
        (props: { children: React.ReactNode }) => props.children as React.ReactElement
    ),
    QZPayThemeProvider: vi.fn(
        (props: { children: React.ReactNode }) => props.children as React.ReactElement
    )
}));

vi.mock('@qazuor/qzpay-core', () => ({
    createQZPayBilling: vi.fn(() => ({
        customers: {},
        subscriptions: {},
        payments: {},
        plans: {},
        invoices: {},
        entitlements: {},
        limits: {},
        getStorage: vi.fn(),
        getPaymentAdapter: vi.fn(),
        getLogger: vi.fn()
    }))
}));

vi.mock('../../../src/lib/billing-http-adapter', () => ({
    createHttpBillingAdapter: vi.fn(() => ({
        customers: {},
        subscriptions: {},
        payments: {},
        paymentMethods: {},
        invoices: {},
        plans: {},
        prices: {},
        promoCodes: {},
        vendors: {},
        entitlements: {},
        limits: {},
        addons: {},
        transaction: vi.fn()
    }))
}));

vi.mock('../../../src/lib/qzpay-theme', () => ({
    hospedaQzpayTheme: mockTheme,
    hospedaQzpayDarkTheme: mockTheme
}));

describe('BillingIsland', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render children inside QZPayProvider', async () => {
        render(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
            >
                <div data-testid="test-child">Test Content</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });

        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should handle missing customerId (anonymous mode)', async () => {
        render(
            <BillingIsland apiUrl="/api/v1">
                <div data-testid="test-child">Anonymous Content</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });

        expect(screen.getByText('Anonymous Content')).toBeInTheDocument();
    });

    it('should accept livemode prop', async () => {
        render(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
                livemode={true}
            >
                <div data-testid="test-child">Production Mode</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });
    });

    it('should accept getAuthToken function', async () => {
        const mockGetAuthToken = vi.fn(async () => 'test-token');

        render(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
                getAuthToken={mockGetAuthToken}
            >
                <div data-testid="test-child">Authenticated Content</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });
    });

    it('should render multiple children', async () => {
        render(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
            >
                <div data-testid="child-1">Child 1</div>
                <div data-testid="child-2">Child 2</div>
                <div data-testid="child-3">Child 3</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('child-1')).toBeInTheDocument();
        });

        expect(screen.getByTestId('child-2')).toBeInTheDocument();
        expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });

    it('should accept different API URLs', async () => {
        render(
            <BillingIsland
                apiUrl="http://localhost:3001/api/v1"
                customerId="test-customer-123"
            >
                <div data-testid="test-child">Custom API URL</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });
    });

    it('should memoize billing instance across re-renders', async () => {
        const { createQZPayBilling } = await import('@qazuor/qzpay-core');

        const { rerender } = render(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
            >
                <div data-testid="test-child">Content</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });

        const initialCallCount = (createQZPayBilling as ReturnType<typeof vi.fn>).mock.calls.length;

        // Re-render with same props
        rerender(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
            >
                <div data-testid="test-child">Content</div>
            </BillingIsland>
        );

        // Verify billing instance was not recreated
        const finalCallCount = (createQZPayBilling as ReturnType<typeof vi.fn>).mock.calls.length;
        expect(finalCallCount).toBe(initialCallCount);
    });

    it('should verify QZPayProvider is called with billing instance', async () => {
        const { QZPayProvider } = await import('@qazuor/qzpay-react');

        render(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
            >
                <div data-testid="test-child">Content</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });

        // Verify QZPayProvider was called
        expect(QZPayProvider).toHaveBeenCalled();

        // Verify it received billing instance and initialCustomer
        const providerCall = (QZPayProvider as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(providerCall).toHaveProperty('billing');
        expect(providerCall).toHaveProperty('initialCustomer');
        expect(providerCall.initialCustomer).toEqual({ id: 'test-customer-123' });
    });

    it('should apply theme correctly via QZPayThemeProvider', async () => {
        const { QZPayThemeProvider } = await import('@qazuor/qzpay-react');
        const { hospedaQzpayTheme } = await import('../../../src/lib/qzpay-theme');

        render(
            <BillingIsland
                apiUrl="/api/v1"
                customerId="test-customer-123"
            >
                <div data-testid="test-child">Content</div>
            </BillingIsland>
        );

        // Wait for hydration
        await waitFor(() => {
            expect(screen.getByTestId('test-child')).toBeInTheDocument();
        });

        // Verify QZPayThemeProvider was called with hospedaQzpayTheme
        expect(QZPayThemeProvider).toHaveBeenCalled();

        const themeProviderCall = (QZPayThemeProvider as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(themeProviderCall).toHaveProperty('theme');
        expect(themeProviderCall.theme).toBe(hospedaQzpayTheme);
    });

    it('should not throw during SSR rendering', () => {
        expect(() => {
            renderToString(
                <BillingIsland
                    apiUrl="/api/v1"
                    customerId="test-customer-123"
                >
                    <div data-testid="test-child">SSR Content</div>
                </BillingIsland>
            );
        }).not.toThrow();
    });

    // Note: The pre-hydration loading skeleton (isHydrated=false) cannot be tested
    // in jsdom because useEffect runs synchronously during render, setting isHydrated
    // to true before assertions. SSR skeleton behavior is covered by the SSR
    // integration test in test/integration/billing-island-ssr.test.tsx.
});
