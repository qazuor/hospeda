/**
 * SSR Integration Tests for BillingIsland Component
 *
 * Tests SSR compatibility and hydration safety of the BillingIsland wrapper.
 * Ensures component renders correctly during server-side rendering and
 * handles hydration without errors.
 *
 * @module test/integration/billing-island-ssr
 */

import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock qzpay-react to prevent SSR issues with real implementation
vi.mock('@qazuor/qzpay-react', () => ({
    QZPayProvider: ({ children }: { children: ReactNode }) => (
        <div data-testid="qzpay-provider">{children}</div>
    ),
    QZPayThemeProvider: ({ children }: { children: ReactNode }) => (
        <div data-testid="qzpay-theme-provider">{children}</div>
    ),
    usePlans: vi.fn(() => ({ data: [], isLoading: false, error: null })),
    useSubscription: vi.fn(() => ({ data: null, isLoading: false, error: null })),
    useCurrentCustomer: vi.fn(() => [null, vi.fn()]),
    useLimits: vi.fn(() => ({ data: [], isLoading: false, error: null })),
    useEntitlements: vi.fn(() => ({ data: [], isLoading: false, error: null })),
    useInvoices: vi.fn(() => ({ data: [], isLoading: false, error: null })),
    useAddons: vi.fn(() => ({ data: [], isLoading: false, error: null })),
    qzpayDefaultTheme: {},
    qzpayMergeTheme: vi.fn((base, overrides) => ({ ...base, ...overrides }))
}));

// Mock billing-http-adapter
vi.mock('../../src/lib/billing-http-adapter', () => ({
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

// Mock qzpay-core
vi.mock('@qazuor/qzpay-core', () => ({
    createQZPayBilling: vi.fn(() => ({
        customers: {},
        subscriptions: {},
        payments: {}
    }))
}));

// Mock qzpay-theme
vi.mock('../../src/lib/qzpay-theme', () => ({
    hospedaQzpayTheme: {
        colors: { primary: '#14b8a6' },
        typography: { fontFamily: 'Inter' }
    }
}));

// Import component after mocks are set up
import { BillingIsland } from '../../src/components/billing/BillingIsland';

describe('BillingIsland - SSR Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should render to string without errors during SSR', () => {
        // Arrange
        const TestComponent = () => (
            <BillingIsland apiUrl="/api/v1">
                <div>Test content</div>
            </BillingIsland>
        );

        // Act - renderToString simulates SSR
        const renderSSR = () => renderToString(<TestComponent />);

        // Assert - should not throw
        expect(renderSSR).not.toThrow();
        const html = renderSSR();
        expect(html).toBeTruthy();
        expect(typeof html).toBe('string');
    });

    it('should not access window or document during SSR', () => {
        // Arrange - spy on global objects
        const originalWindow = global.window;
        const originalDocument = global.document;

        // @ts-expect-error - Temporarily delete window/document to simulate SSR environment
        global.window = undefined;
        // @ts-expect-error
        global.document = undefined;

        const TestComponent = () => (
            <BillingIsland apiUrl="/api/v1">
                <div>Test content</div>
            </BillingIsland>
        );

        // Act & Assert - should render without accessing window/document
        expect(() => renderToString(<TestComponent />)).not.toThrow();

        // Cleanup - restore globals
        global.window = originalWindow as any;
        global.document = originalDocument as any;
    });

    it('should render skeleton instead of children during SSR', () => {
        // Arrange
        const childText = 'Billing Island Child Content';
        const TestComponent = () => (
            <BillingIsland
                apiUrl="/api/v1"
                customerId="cus_123"
            >
                <div data-testid="child-content">{childText}</div>
            </BillingIsland>
        );

        // Act
        const html = renderToString(<TestComponent />);

        // Assert - should show skeleton, NOT children during SSR
        expect(html).toContain('billing-island-skeleton');
        expect(html).not.toContain(childText);
    });

    it('should provide loading skeleton during SSR', () => {
        // Arrange
        const TestComponent = () => (
            <BillingIsland apiUrl="/api/v1">
                <div>Content that should not appear during SSR</div>
            </BillingIsland>
        );

        // Act
        const html = renderToString(<TestComponent />);

        // Assert - should show skeleton
        expect(html).toContain('billing-island-skeleton');
        expect(html).toContain('animate-pulse');
        expect(html).toContain('role="status"');
        expect(html).toContain('Loading billing...');
    });

    it('should hydrate without errors after SSR', () => {
        // Arrange - first render on server
        const TestComponent = () => (
            <BillingIsland
                apiUrl="/api/v1"
                customerId="cus_test"
                livemode={false}
            >
                <div data-testid="test-child">Test Child</div>
            </BillingIsland>
        );

        const serverHtml = renderToString(<TestComponent />);
        expect(serverHtml).toBeTruthy();

        // Act - now render on client (hydration)
        const renderClient = () => render(<TestComponent />);

        // Assert - hydration should not throw
        expect(renderClient).not.toThrow();
        const { container } = renderClient();
        expect(container).toBeTruthy();
    });

    it('should handle missing customerId during SSR', () => {
        // Arrange
        const TestComponent = () => (
            <BillingIsland apiUrl="/api/v1">
                <div>Anonymous user content</div>
            </BillingIsland>
        );

        // Act
        const renderSSR = () => renderToString(<TestComponent />);

        // Assert - should not throw with missing customerId
        expect(renderSSR).not.toThrow();
        const html = renderSSR();
        expect(html).toContain('billing-island-skeleton');
    });

    it('should handle getAuthToken function during SSR', () => {
        // Arrange
        const mockGetAuthToken = vi.fn(async () => 'mock-token');
        const TestComponent = () => (
            <BillingIsland
                apiUrl="/api/v1"
                customerId="cus_123"
                getAuthToken={mockGetAuthToken}
            >
                <div>Authenticated content</div>
            </BillingIsland>
        );

        // Act
        const renderSSR = () => renderToString(<TestComponent />);

        // Assert - should not throw with getAuthToken
        expect(renderSSR).not.toThrow();
        const html = renderSSR();
        expect(html).toBeTruthy();
    });

    it('should render with all props during SSR', () => {
        // Arrange
        const mockGetAuthToken = vi.fn(async () => 'token');
        const TestComponent = () => (
            <BillingIsland
                apiUrl="https://api.hospeda.com/v1"
                customerId="cus_complete_test"
                livemode={true}
                getAuthToken={mockGetAuthToken}
            >
                <div>Full props test</div>
            </BillingIsland>
        );

        // Act
        const renderSSR = () => renderToString(<TestComponent />);

        // Assert
        expect(renderSSR).not.toThrow();
        const html = renderSSR();
        expect(html).toContain('billing-island-skeleton');
        // Children are NOT rendered during SSR, only after hydration
        expect(html).not.toContain('Full props test');
    });
});
