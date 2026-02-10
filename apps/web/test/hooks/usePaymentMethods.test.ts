/**
 * usePaymentMethods Hook Tests
 *
 * Tests for the usePaymentMethods custom hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaymentMethods } from '../../src/hooks/usePaymentMethods';
import type { PaymentMethod } from '../../src/lib/billing-api-client';

// Mock billing-api-client
vi.mock('../../src/lib/billing-api-client', () => ({
    getPaymentMethods: vi.fn(),
    updateDefaultPaymentMethod: vi.fn()
}));

// Mock @qazuor/qzpay-react
vi.mock('@qazuor/qzpay-react', () => ({
    useQZPay: vi.fn(() => null)
}));

import { getPaymentMethods, updateDefaultPaymentMethod } from '../../src/lib/billing-api-client';

const mockGetPaymentMethods = vi.mocked(getPaymentMethods);
const mockUpdateDefaultPaymentMethod = vi.mocked(updateDefaultPaymentMethod);

describe('usePaymentMethods', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should initialize with loading state', () => {
        mockGetPaymentMethods.mockImplementation(
            () =>
                new Promise(() => {
                    /* never resolves */
                })
        );

        const { result } = renderHook(() => usePaymentMethods());

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBe(null);
        expect(result.current.error).toBe(null);
        expect(result.current.isSettingDefault).toBe(false);
    });

    it('should fetch payment methods on mount', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: false
            }
        ];

        mockGetPaymentMethods.mockResolvedValue(mockMethods);

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockMethods);
        expect(result.current.error).toBe(null);
        expect(mockGetPaymentMethods).toHaveBeenCalledOnce();
    });

    it('should handle fetch error', async () => {
        const errorMessage = 'Network error';
        mockGetPaymentMethods.mockRejectedValue(new Error(errorMessage));

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(null);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe(errorMessage);
    });

    it('should handle non-Error fetch rejection', async () => {
        mockGetPaymentMethods.mockRejectedValue('String error');

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(null);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Failed to fetch payment methods');
    });

    it('should refetch payment methods when refetch is called', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ];

        mockGetPaymentMethods.mockResolvedValue(mockMethods);

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockGetPaymentMethods).toHaveBeenCalledOnce();

        // Call refetch
        await result.current.refetch();

        await waitFor(() => {
            expect(mockGetPaymentMethods).toHaveBeenCalledTimes(2);
        });
    });

    it('should set payment method as default', async () => {
        const initialMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: false
            }
        ];

        const updatedMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: false
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: true
            }
        ];

        mockGetPaymentMethods
            .mockResolvedValueOnce(initialMethods)
            .mockResolvedValueOnce(updatedMethods);
        mockUpdateDefaultPaymentMethod.mockResolvedValue();

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(initialMethods);

        // Call setDefault
        await result.current.setDefault('pm_2');

        // Wait for the refetch to complete and data to be updated
        await waitFor(() => {
            expect(result.current.isSettingDefault).toBe(false);
            expect(result.current.data).toEqual(updatedMethods);
        });

        expect(mockUpdateDefaultPaymentMethod).toHaveBeenCalledWith('pm_2');
        expect(result.current.error).toBe(null);
    });

    it('should set isSettingDefault during setDefault operation', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ];

        mockGetPaymentMethods.mockResolvedValue(mockMethods);

        let resolveUpdate: () => void;
        const updatePromise = new Promise<void>((resolve) => {
            resolveUpdate = resolve;
        });

        mockUpdateDefaultPaymentMethod.mockReturnValue(updatePromise);

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Start setDefault
        const setDefaultPromise = result.current.setDefault('pm_1');

        await waitFor(() => {
            expect(result.current.isSettingDefault).toBe(true);
        });

        // Resolve the update
        resolveUpdate!();
        await setDefaultPromise;

        await waitFor(() => {
            expect(result.current.isSettingDefault).toBe(false);
        });
    });

    it('should handle setDefault error', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ];

        const errorMessage = 'Update failed';

        mockGetPaymentMethods.mockResolvedValue(mockMethods);
        mockUpdateDefaultPaymentMethod.mockRejectedValue(new Error(errorMessage));

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Call setDefault and expect it to throw
        await expect(result.current.setDefault('pm_1')).rejects.toThrow(errorMessage);

        await waitFor(() => {
            expect(result.current.error).toBeInstanceOf(Error);
        });

        expect(result.current.error?.message).toBe(errorMessage);
        expect(result.current.isSettingDefault).toBe(false);
    });

    it('should handle non-Error setDefault rejection', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ];

        mockGetPaymentMethods.mockResolvedValue(mockMethods);
        mockUpdateDefaultPaymentMethod.mockRejectedValue('String error');

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Call setDefault and expect it to throw
        await expect(result.current.setDefault('pm_1')).rejects.toThrow(
            'Failed to update default payment method'
        );

        await waitFor(() => {
            expect(result.current.error?.message).toBe('Failed to update default payment method');
        });
    });

    it('should clear error on successful refetch after error', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ];

        mockGetPaymentMethods
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(mockMethods);

        const { result } = renderHook(() => usePaymentMethods());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeInstanceOf(Error);

        // Refetch
        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.error).toBe(null);
        });

        expect(result.current.data).toEqual(mockMethods);
    });

    it('should expose all expected interface properties', () => {
        mockGetPaymentMethods.mockResolvedValue([]);

        const { result } = renderHook(() => usePaymentMethods());

        expect(result.current).toHaveProperty('data');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).toHaveProperty('error');
        expect(result.current).toHaveProperty('refetch');
        expect(result.current).toHaveProperty('setDefault');
        expect(result.current).toHaveProperty('isSettingDefault');

        expect(typeof result.current.refetch).toBe('function');
        expect(typeof result.current.setDefault).toBe('function');
    });
});
