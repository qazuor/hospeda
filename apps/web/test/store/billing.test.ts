/**
 * Tests for billing Nanostore
 */

import { useStore } from '@nanostores/react';
import type { QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
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
        id: overrides.id || 'cus_test123',
        externalId: overrides.externalId || 'ext_123',
        email: overrides.email || 'test@example.com',
        name: overrides.name || 'Test User',
        phone: overrides.phone || null,
        providerCustomerIds: overrides.providerCustomerIds || {},
        metadata: overrides.metadata || {},
        livemode: overrides.livemode !== undefined ? overrides.livemode : false,
        createdAt: overrides.createdAt || new Date('2024-01-01'),
        updatedAt: overrides.updatedAt || new Date('2024-01-01'),
        deletedAt: overrides.deletedAt !== undefined ? overrides.deletedAt : null
    };
}

/**
 * Factory function to create mock subscription with all required fields
 */
function createMockSubscription(overrides: Partial<QZPaySubscription> = {}): QZPaySubscription {
    return {
        id: overrides.id || 'sub_test123',
        customerId: overrides.customerId || 'cus_test123',
        planId: overrides.planId || 'plan_professional',
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
        createdAt: overrides.createdAt || new Date('2024-01-01'),
        updatedAt: overrides.updatedAt || new Date('2024-01-01'),
        deletedAt: overrides.deletedAt !== undefined ? overrides.deletedAt : null
    };
}

describe('billing store atoms', () => {
    beforeEach(() => {
        // Reset store before each test
        resetBillingStore();
    });

    describe('initialization', () => {
        it('should initialize billingCustomer as null', () => {
            expect(billingCustomer.get()).toBeNull();
        });

        it('should initialize billingSubscription as null', () => {
            expect(billingSubscription.get()).toBeNull();
        });

        it('should initialize billingEntitlements as empty object', () => {
            expect(billingEntitlements.get()).toEqual({});
        });

        it('should initialize billingLimits as empty object', () => {
            expect(billingLimits.get()).toEqual({});
        });

        it('should initialize billingIsLoading as false', () => {
            expect(billingIsLoading.get()).toBe(false);
        });
    });

    describe('updateBillingCustomer', () => {
        it('should update customer with valid data', () => {
            const mockCustomer = createMockCustomer();

            updateBillingCustomer(mockCustomer);

            expect(billingCustomer.get()).toEqual(mockCustomer);
        });

        it('should update customer to null', () => {
            const mockCustomer = createMockCustomer();

            updateBillingCustomer(mockCustomer);
            expect(billingCustomer.get()).toEqual(mockCustomer);

            updateBillingCustomer(null);
            expect(billingCustomer.get()).toBeNull();
        });
    });

    describe('updateBillingSubscription', () => {
        it('should update subscription with valid data', () => {
            const mockSubscription = createMockSubscription();

            updateBillingSubscription(mockSubscription);

            expect(billingSubscription.get()).toEqual(mockSubscription);
        });

        it('should update subscription to null', () => {
            const mockSubscription = createMockSubscription();

            updateBillingSubscription(mockSubscription);
            expect(billingSubscription.get()).toEqual(mockSubscription);

            updateBillingSubscription(null);
            expect(billingSubscription.get()).toBeNull();
        });
    });

    describe('updateBillingEntitlements', () => {
        it('should update entitlements with feature flags', () => {
            const mockEntitlements = {
                can_create_accommodation: true,
                can_access_analytics: false,
                can_use_advanced_search: true
            };

            updateBillingEntitlements(mockEntitlements);

            expect(billingEntitlements.get()).toEqual(mockEntitlements);
        });

        it('should replace existing entitlements', () => {
            const initialEntitlements = {
                feature_a: true,
                feature_b: false
            };

            const newEntitlements = {
                feature_c: true
            };

            updateBillingEntitlements(initialEntitlements);
            expect(billingEntitlements.get()).toEqual(initialEntitlements);

            updateBillingEntitlements(newEntitlements);
            expect(billingEntitlements.get()).toEqual(newEntitlements);
        });

        it('should handle empty entitlements object', () => {
            updateBillingEntitlements({});

            expect(billingEntitlements.get()).toEqual({});
        });
    });

    describe('updateBillingLimits', () => {
        it('should update limits with usage data', () => {
            const mockLimits = {
                accommodations: { current: 3, max: 10, remaining: 7 },
                photos: { current: 45, max: 100, remaining: 55 }
            };

            updateBillingLimits(mockLimits);

            expect(billingLimits.get()).toEqual(mockLimits);
        });

        it('should replace existing limits', () => {
            const initialLimits = {
                feature_a: { current: 5, max: 10, remaining: 5 }
            };

            const newLimits = {
                feature_b: { current: 2, max: 5, remaining: 3 }
            };

            updateBillingLimits(initialLimits);
            expect(billingLimits.get()).toEqual(initialLimits);

            updateBillingLimits(newLimits);
            expect(billingLimits.get()).toEqual(newLimits);
        });

        it('should handle empty limits object', () => {
            updateBillingLimits({});

            expect(billingLimits.get()).toEqual({});
        });

        it('should handle zero remaining limits', () => {
            const mockLimits = {
                storage: { current: 100, max: 100, remaining: 0 }
            };

            updateBillingLimits(mockLimits);

            const storedLimits = billingLimits.get();
            expect(storedLimits.storage?.remaining).toBe(0);
        });
    });

    describe('setBillingIsLoading', () => {
        it('should set loading to true', () => {
            setBillingIsLoading(true);

            expect(billingIsLoading.get()).toBe(true);
        });

        it('should set loading to false', () => {
            setBillingIsLoading(true);
            expect(billingIsLoading.get()).toBe(true);

            setBillingIsLoading(false);
            expect(billingIsLoading.get()).toBe(false);
        });
    });

    describe('resetBillingStore', () => {
        it('should reset all atoms to default values', () => {
            // Set some data
            const mockCustomer = createMockCustomer();
            const mockSubscription = createMockSubscription();

            updateBillingCustomer(mockCustomer);
            updateBillingSubscription(mockSubscription);
            updateBillingEntitlements({ feature: true });
            updateBillingLimits({ limit: { current: 1, max: 10, remaining: 9 } });
            setBillingIsLoading(true);

            // Verify data was set
            expect(billingCustomer.get()).not.toBeNull();
            expect(billingSubscription.get()).not.toBeNull();
            expect(Object.keys(billingEntitlements.get()).length).toBeGreaterThan(0);
            expect(Object.keys(billingLimits.get()).length).toBeGreaterThan(0);
            expect(billingIsLoading.get()).toBe(true);

            // Reset
            resetBillingStore();

            // Verify all reset
            expect(billingCustomer.get()).toBeNull();
            expect(billingSubscription.get()).toBeNull();
            expect(billingEntitlements.get()).toEqual({});
            expect(billingLimits.get()).toEqual({});
            expect(billingIsLoading.get()).toBe(false);
        });
    });
});

describe('React integration with useStore', () => {
    beforeEach(() => {
        resetBillingStore();
    });

    it('should read billingCustomer updates in React component', () => {
        const { result } = renderHook(() => useStore(billingCustomer));

        expect(result.current).toBeNull();

        const mockCustomer = createMockCustomer({
            id: 'cus_react123',
            email: 'react@example.com',
            name: 'React User'
        });

        act(() => {
            updateBillingCustomer(mockCustomer);
        });

        expect(result.current).toEqual(mockCustomer);
    });

    it('should read billingSubscription updates in React component', () => {
        const { result } = renderHook(() => useStore(billingSubscription));

        expect(result.current).toBeNull();

        const mockSubscription = createMockSubscription({
            id: 'sub_react123',
            customerId: 'cus_react123',
            planId: 'plan_basic'
        });

        act(() => {
            updateBillingSubscription(mockSubscription);
        });

        expect(result.current).toEqual(mockSubscription);
    });

    it('should read billingEntitlements updates in React component', () => {
        const { result } = renderHook(() => useStore(billingEntitlements));

        expect(result.current).toEqual({});

        const mockEntitlements = {
            feature_x: true,
            feature_y: false
        };

        act(() => {
            updateBillingEntitlements(mockEntitlements);
        });

        expect(result.current).toEqual(mockEntitlements);
    });

    it('should read billingLimits updates in React component', () => {
        const { result } = renderHook(() => useStore(billingLimits));

        expect(result.current).toEqual({});

        const mockLimits = {
            api_calls: { current: 100, max: 1000, remaining: 900 }
        };

        act(() => {
            updateBillingLimits(mockLimits);
        });

        expect(result.current).toEqual(mockLimits);
    });

    it('should read billingIsLoading updates in React component', () => {
        const { result } = renderHook(() => useStore(billingIsLoading));

        expect(result.current).toBe(false);

        act(() => {
            setBillingIsLoading(true);
        });

        expect(result.current).toBe(true);

        act(() => {
            setBillingIsLoading(false);
        });

        expect(result.current).toBe(false);
    });

    it('should handle resetBillingStore in React component', () => {
        const customerHook = renderHook(() => useStore(billingCustomer));
        const entitlementsHook = renderHook(() => useStore(billingEntitlements));
        const loadingHook = renderHook(() => useStore(billingIsLoading));

        const mockCustomer = createMockCustomer({
            id: 'cus_reset123',
            email: 'reset@example.com',
            name: 'Reset User'
        });

        act(() => {
            updateBillingCustomer(mockCustomer);
            updateBillingEntitlements({ feature: true });
            setBillingIsLoading(true);
        });

        expect(customerHook.result.current).toEqual(mockCustomer);
        expect(entitlementsHook.result.current).toEqual({ feature: true });
        expect(loadingHook.result.current).toBe(true);

        act(() => {
            resetBillingStore();
        });

        expect(customerHook.result.current).toBeNull();
        expect(entitlementsHook.result.current).toEqual({});
        expect(loadingHook.result.current).toBe(false);
    });
});
