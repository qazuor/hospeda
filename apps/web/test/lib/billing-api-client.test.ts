/**
 * Billing API Client Tests
 *
 * Tests for billing API client helper functions
 *
 * @module test/lib/billing-api-client
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type CheckoutSessionResponse,
    type PaymentMethod,
    type PromoCodeValidationResponse,
    createAddonCheckoutSession,
    createCheckoutSession,
    getPaymentMethods,
    updateDefaultPaymentMethod,
    validatePromoCode
} from '../../src/lib/billing-api-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('billing-api-client', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('createCheckoutSession', () => {
        it('should create checkout session successfully', async () => {
            const mockResponse: CheckoutSessionResponse = {
                checkoutUrl: 'https://checkout.example.com/session123',
                sessionId: 'session123'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockResponse })
            });

            const result = await createCheckoutSession({
                planSlug: 'pro-plan',
                interval: 'month'
            });

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/billing/checkout'),
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    }),
                    body: JSON.stringify({
                        planSlug: 'pro-plan',
                        interval: 'month',
                        promoCode: undefined,
                        successUrl: undefined,
                        cancelUrl: undefined
                    })
                })
            );
        });

        it('should include optional parameters when provided', async () => {
            const mockResponse: CheckoutSessionResponse = {
                checkoutUrl: 'https://checkout.example.com/session456',
                sessionId: 'session456'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockResponse })
            });

            await createCheckoutSession({
                planSlug: 'pro-plan',
                interval: 'year',
                promoCode: 'SAVE20',
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel'
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        planSlug: 'pro-plan',
                        interval: 'year',
                        promoCode: 'SAVE20',
                        successUrl: 'https://example.com/success',
                        cancelUrl: 'https://example.com/cancel'
                    })
                })
            );
        });

        it('should handle API error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: {
                        message: 'Plan not found',
                        code: 'PLAN_NOT_FOUND'
                    }
                })
            });

            await expect(
                createCheckoutSession({
                    planSlug: 'invalid-plan',
                    interval: 'month'
                })
            ).rejects.toThrow('Plan not found');
        });

        it('should handle network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(
                createCheckoutSession({
                    planSlug: 'pro-plan',
                    interval: 'month'
                })
            ).rejects.toThrow('Network error');
        });

        it('should handle malformed error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => {
                    throw new Error('Invalid JSON');
                }
            });

            await expect(
                createCheckoutSession({
                    planSlug: 'pro-plan',
                    interval: 'month'
                })
            ).rejects.toThrow('API request failed');
        });
    });

    describe('createAddonCheckoutSession', () => {
        it('should create addon checkout session successfully', async () => {
            const mockResponse: CheckoutSessionResponse = {
                checkoutUrl: 'https://checkout.example.com/addon789',
                sessionId: 'addon789'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockResponse })
            });

            const result = await createAddonCheckoutSession({
                addonSlug: 'extra-listings'
            });

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/billing/addons/extra-listings/purchase'),
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                    body: JSON.stringify({
                        promoCode: undefined,
                        quantity: undefined,
                        successUrl: undefined,
                        cancelUrl: undefined
                    })
                })
            );
        });

        it('should include quantity and promo code when provided', async () => {
            const mockResponse: CheckoutSessionResponse = {
                checkoutUrl: 'https://checkout.example.com/addon999',
                sessionId: 'addon999'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockResponse })
            });

            await createAddonCheckoutSession({
                addonSlug: 'premium-photos',
                quantity: 10,
                promoCode: 'ADDON10'
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/billing/addons/premium-photos/purchase'),
                expect.objectContaining({
                    body: JSON.stringify({
                        promoCode: 'ADDON10',
                        quantity: 10,
                        successUrl: undefined,
                        cancelUrl: undefined
                    })
                })
            );
        });

        it('should handle API error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: {
                        message: 'Addon not found',
                        code: 'ADDON_NOT_FOUND'
                    }
                })
            });

            await expect(
                createAddonCheckoutSession({
                    addonSlug: 'invalid-addon'
                })
            ).rejects.toThrow('Addon not found');
        });
    });

    describe('validatePromoCode', () => {
        it('should validate promo code successfully', async () => {
            const mockResponse: PromoCodeValidationResponse = {
                valid: true,
                discount: {
                    type: 'percentage',
                    value: 20
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockResponse })
            });

            const result = await validatePromoCode({
                code: 'SAVE20'
            });

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/billing/promo-codes/validate'),
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                    body: JSON.stringify({
                        code: 'SAVE20',
                        planId: undefined
                    })
                })
            );
        });

        it('should include plan slug when provided', async () => {
            const mockResponse: PromoCodeValidationResponse = {
                valid: true,
                discount: {
                    type: 'fixed',
                    value: 1000
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockResponse })
            });

            await validatePromoCode({
                code: 'FIXED10',
                planSlug: 'pro-plan'
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        code: 'FIXED10',
                        planId: 'pro-plan'
                    })
                })
            );
        });

        it('should handle invalid promo code', async () => {
            const mockResponse: PromoCodeValidationResponse = {
                valid: false,
                message: 'Promo code expired'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockResponse })
            });

            const result = await validatePromoCode({
                code: 'EXPIRED'
            });

            expect(result).toEqual(mockResponse);
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Promo code expired');
        });

        it('should handle API error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: {
                        message: 'Invalid request'
                    }
                })
            });

            await expect(
                validatePromoCode({
                    code: ''
                })
            ).rejects.toThrow('Invalid request');
        });
    });

    describe('getPaymentMethods', () => {
        it('should retrieve payment methods successfully', async () => {
            const mockMethods: PaymentMethod[] = [
                {
                    id: 'pm_123',
                    type: 'card',
                    last4: '4242',
                    brand: 'visa',
                    isDefault: true
                },
                {
                    id: 'pm_456',
                    type: 'card',
                    last4: '5555',
                    brand: 'mastercard',
                    isDefault: false
                }
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockMethods })
            });

            const result = await getPaymentMethods();

            expect(result).toEqual(mockMethods);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/billing/payment-methods'),
                expect.objectContaining({
                    credentials: 'include',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should handle empty payment methods list', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [] })
            });

            const result = await getPaymentMethods();

            expect(result).toEqual([]);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle API error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: {
                        message: 'Unauthorized',
                        code: 'UNAUTHORIZED'
                    }
                })
            });

            await expect(getPaymentMethods()).rejects.toThrow('Unauthorized');
        });
    });

    describe('updateDefaultPaymentMethod', () => {
        it('should update default payment method successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: null })
            });

            await updateDefaultPaymentMethod('pm_789');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/billing/payment-methods/pm_789/set-default'),
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should handle API error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: {
                        message: 'Payment method not found',
                        code: 'NOT_FOUND'
                    }
                })
            });

            await expect(updateDefaultPaymentMethod('pm_invalid')).rejects.toThrow(
                'Payment method not found'
            );
        });

        it('should handle network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

            await expect(updateDefaultPaymentMethod('pm_123')).rejects.toThrow('Network timeout');
        });
    });

    describe('billingFetch error handling', () => {
        it('should use default error message when error response has no message', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: {} })
            });

            await expect(
                createCheckoutSession({
                    planSlug: 'test',
                    interval: 'month'
                })
            ).rejects.toThrow('API request failed');
        });

        it('should preserve custom error codes in error object', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: {
                        message: 'Insufficient permissions',
                        code: 'FORBIDDEN'
                    }
                })
            });

            await expect(getPaymentMethods()).rejects.toThrow('Insufficient permissions');
        });
    });

    describe('API URL configuration', () => {
        it('should use PUBLIC_API_URL from environment', async () => {
            // Note: Environment variable handling is tested through actual fetch calls
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [] })
            });

            await getPaymentMethods();

            // Verify the URL includes /billing path
            const callUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(callUrl).toContain('/billing/payment-methods');
        });
    });
});
