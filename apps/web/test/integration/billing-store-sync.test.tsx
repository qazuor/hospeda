/**
 * Billing Store Synchronization Integration Tests
 *
 * Tests nanostore billing state synchronization across components.
 * Validates that state updates propagate correctly and components
 * re-render when store values change.
 *
 * @module test/integration/billing-store-sync
 */

import { useStore } from '@nanostores/react';
import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import store directly
import {
    billingCustomer,
    billingEntitlements,
    billingIsLoading,
    billingLimits,
    billingSubscription,
    resetBillingStore,
    setBillingIsLoading,
    updateBillingCustomer,
    updateBillingEntitlements,
    updateBillingLimits,
    updateBillingSubscription
} from '../../src/store/billing';

/**
 * Factory function to create mock customer with all required fields
 */
function createMockCustomer(overrides: Partial<QZPayCustomer> = {}): QZPayCustomer {
    return {
        id: overrides.id || 'cus_test_123',
        externalId: overrides.externalId || 'ext_123',
        email: overrides.email || 'test@hospeda.com',
        name: overrides.name || 'Test User',
        phone: overrides.phone || null,
        providerCustomerIds: overrides.providerCustomerIds || {},
        metadata: overrides.metadata || {},
        livemode: overrides.livemode !== undefined ? overrides.livemode : false,
        createdAt: overrides.createdAt || new Date(),
        updatedAt: overrides.updatedAt || new Date(),
        deletedAt: overrides.deletedAt !== undefined ? overrides.deletedAt : null
    };
}

/**
 * Factory function to create mock subscription with all required fields
 */
function createMockSubscription(overrides: Partial<QZPaySubscription> = {}): QZPaySubscription {
    return {
        id: overrides.id || 'sub_test_456',
        customerId: overrides.customerId || 'cus_test_123',
        planId: overrides.planId || 'plan_basic',
        status: overrides.status || 'active',
        interval: overrides.interval || 'month',
        intervalCount: overrides.intervalCount || 1,
        quantity: overrides.quantity || 1,
        currentPeriodStart: overrides.currentPeriodStart || new Date('2024-01-01'),
        currentPeriodEnd: overrides.currentPeriodEnd || new Date('2024-02-01'),
        trialStart: overrides.trialStart !== undefined ? overrides.trialStart : null,
        trialEnd: overrides.trialEnd !== undefined ? overrides.trialEnd : null,
        cancelAt: overrides.cancelAt !== undefined ? overrides.cancelAt : null,
        canceledAt: overrides.canceledAt !== undefined ? overrides.canceledAt : null,
        cancelAtPeriodEnd:
            overrides.cancelAtPeriodEnd !== undefined ? overrides.cancelAtPeriodEnd : false,
        providerSubscriptionIds: overrides.providerSubscriptionIds || {},
        promoCodeId: overrides.promoCodeId,
        metadata: overrides.metadata || {},
        livemode: overrides.livemode !== undefined ? overrides.livemode : false,
        createdAt: overrides.createdAt || new Date(),
        updatedAt: overrides.updatedAt || new Date(),
        deletedAt: overrides.deletedAt !== undefined ? overrides.deletedAt : null
    };
}

describe('Billing Store Synchronization - Integration Tests', () => {
    // Reset store before each test
    beforeEach(() => {
        resetBillingStore();
        vi.clearAllMocks();
    });

    afterEach(() => {
        resetBillingStore();
        vi.clearAllMocks();
    });

    it('should have correct initial state with default values', () => {
        // Arrange & Act - read initial values
        const customer = billingCustomer.get();
        const subscription = billingSubscription.get();
        const entitlements = billingEntitlements.get();
        const limits = billingLimits.get();
        const isLoading = billingIsLoading.get();

        // Assert
        expect(customer).toBeNull();
        expect(subscription).toBeNull();
        expect(entitlements).toEqual({});
        expect(limits).toEqual({});
        expect(isLoading).toBe(false);
    });

    it('should update customer ID in store', () => {
        // Arrange
        const mockCustomer = createMockCustomer();

        // Act
        act(() => {
            updateBillingCustomer(mockCustomer);
        });

        // Assert
        const storedCustomer = billingCustomer.get();
        expect(storedCustomer).toEqual(mockCustomer);
        expect(storedCustomer?.id).toBe('cus_test_123');
        expect(storedCustomer?.email).toBe('test@hospeda.com');
    });

    it('should update subscription data in store', () => {
        // Arrange
        const mockSubscription = createMockSubscription();

        // Act
        act(() => {
            updateBillingSubscription(mockSubscription);
        });

        // Assert
        const storedSubscription = billingSubscription.get();
        expect(storedSubscription).toEqual(mockSubscription);
        expect(storedSubscription?.id).toBe('sub_test_456');
        expect(storedSubscription?.status).toBe('active');
    });

    it('should allow multiple components to read same atom value', () => {
        // Arrange - component that reads customer
        const ComponentA = () => {
            const customer = useStore(billingCustomer);
            return <div data-testid="component-a">{customer?.id || 'no-customer'}</div>;
        };

        const ComponentB = () => {
            const customer = useStore(billingCustomer);
            return <div data-testid="component-b">{customer?.id || 'no-customer'}</div>;
        };

        // Act - render both components
        render(
            <>
                <ComponentA />
                <ComponentB />
            </>
        );

        // Initially both show no customer
        expect(screen.getByTestId('component-a')).toHaveTextContent('no-customer');
        expect(screen.getByTestId('component-b')).toHaveTextContent('no-customer');

        // Update customer
        const mockCustomer = createMockCustomer({
            id: 'cus_shared_test',
            email: 'shared@hospeda.com'
        });

        act(() => {
            updateBillingCustomer(mockCustomer);
        });

        // Assert - both components should show same value
        expect(screen.getByTestId('component-a')).toHaveTextContent('cus_shared_test');
        expect(screen.getByTestId('component-b')).toHaveTextContent('cus_shared_test');
    });

    it('should trigger re-renders in subscribed components when store updates', async () => {
        // Arrange - component that subscribes to loading state
        const renderSpy = vi.fn();
        const LoadingComponent = () => {
            const isLoading = useStore(billingIsLoading);
            renderSpy();
            return <div data-testid="loading-indicator">{isLoading ? 'Cargando...' : 'Listo'}</div>;
        };

        // Act - initial render
        render(<LoadingComponent />);
        const initialRenderCount = renderSpy.mock.calls.length;

        // Assert initial state
        expect(screen.getByTestId('loading-indicator')).toHaveTextContent('Listo');

        // Update loading state
        act(() => {
            setBillingIsLoading(true);
        });

        // Assert - component re-rendered with new value
        await waitFor(() => {
            expect(screen.getByTestId('loading-indicator')).toHaveTextContent('Cargando...');
        });
        expect(renderSpy.mock.calls.length).toBeGreaterThan(initialRenderCount);

        // Update again
        act(() => {
            setBillingIsLoading(false);
        });

        await waitFor(() => {
            expect(screen.getByTestId('loading-indicator')).toHaveTextContent('Listo');
        });
    });

    it('should clear all billing state when reset', () => {
        // Arrange - populate store with data
        const mockCustomer = createMockCustomer({
            id: 'cus_to_clear',
            email: 'clear@hospeda.com'
        });

        const mockSubscription = createMockSubscription({
            id: 'sub_to_clear',
            customerId: 'cus_to_clear',
            planId: 'plan_test'
        });

        act(() => {
            updateBillingCustomer(mockCustomer);
            updateBillingSubscription(mockSubscription);
            updateBillingEntitlements({ can_create_accommodation: true });
            updateBillingLimits({ accommodations: { current: 5, max: 10, remaining: 5 } });
            setBillingIsLoading(true);
        });

        // Verify data is set
        expect(billingCustomer.get()).toEqual(mockCustomer);
        expect(billingSubscription.get()).toEqual(mockSubscription);

        // Act - reset all
        act(() => {
            resetBillingStore();
        });

        // Assert - all values reset to defaults
        expect(billingCustomer.get()).toBeNull();
        expect(billingSubscription.get()).toBeNull();
        expect(billingEntitlements.get()).toEqual({});
        expect(billingLimits.get()).toEqual({});
        expect(billingIsLoading.get()).toBe(false);
    });

    it('should persist store state across component unmount and remount', () => {
        // Arrange - component that displays customer
        const CustomerDisplay = () => {
            const customer = useStore(billingCustomer);
            return <div data-testid="customer-display">{customer?.email || 'sin email'}</div>;
        };

        // Act - render, set customer, unmount
        const { unmount } = render(<CustomerDisplay />);

        const mockCustomer = createMockCustomer({
            id: 'cus_persistent',
            email: 'persistent@hospeda.com'
        });

        act(() => {
            updateBillingCustomer(mockCustomer);
        });

        expect(screen.getByTestId('customer-display')).toHaveTextContent('persistent@hospeda.com');

        // Unmount component
        unmount();

        // Re-mount component
        render(<CustomerDisplay />);

        // Assert - state should persist
        expect(screen.getByTestId('customer-display')).toHaveTextContent('persistent@hospeda.com');
        expect(billingCustomer.get()?.email).toBe('persistent@hospeda.com');
    });

    it('should update entitlements map correctly', () => {
        // Arrange
        const entitlements = {
            can_create_accommodation: true,
            can_access_analytics: false,
            can_use_advanced_search: true
        };

        // Act
        act(() => {
            updateBillingEntitlements(entitlements);
        });

        // Assert
        const storedEntitlements = billingEntitlements.get();
        expect(storedEntitlements).toEqual(entitlements);
        expect(storedEntitlements.can_create_accommodation).toBe(true);
        expect(storedEntitlements.can_access_analytics).toBe(false);
    });

    it('should update limits map correctly', () => {
        // Arrange
        const limits = {
            accommodations: { current: 3, max: 10, remaining: 7 },
            photos: { current: 45, max: 100, remaining: 55 }
        };

        // Act
        act(() => {
            updateBillingLimits(limits);
        });

        // Assert
        const storedLimits = billingLimits.get();
        expect(storedLimits).toEqual(limits);
        expect(storedLimits.accommodations?.current).toBe(3);
        expect(storedLimits.photos?.remaining).toBe(55);
    });

    it('should handle null values when clearing customer', () => {
        // Arrange - set customer first
        const mockCustomer = createMockCustomer({
            id: 'cus_to_null',
            email: 'tonull@hospeda.com'
        });

        act(() => {
            updateBillingCustomer(mockCustomer);
        });

        expect(billingCustomer.get()).toEqual(mockCustomer);

        // Act - set to null
        act(() => {
            updateBillingCustomer(null);
        });

        // Assert
        expect(billingCustomer.get()).toBeNull();
    });
});
