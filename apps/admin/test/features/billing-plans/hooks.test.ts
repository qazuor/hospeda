/**
 * Tests for billing-plans hooks — T-012
 *
 * Verifies that:
 * - transformPlanRecord (via usePlansQuery) parses a real BillingPlanResponse
 *   shaped record without 502-ing.
 * - The schema rejects a legacy QZPay record (missing id, using active/metadata)
 *   and surfaces it as a query error.
 * - usePlansQuery succeeds and returns the parsed items when the API returns the
 *   correct BillingPlanResponse envelope.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { usePlansQuery } from '../../../src/features/billing-plans/hooks';
import { createTestWrapper } from '../../helpers/create-test-wrapper';
import { server } from '../../mocks/server';

const API_BASE = 'http://localhost:3001';

/** Minimal valid AdminBillingPlanResponse fixture (admin list shape, SPEC-168) */
const validPlanRecord = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    slug: 'owner-basico',
    name: 'Básico Propietario',
    description: 'Plan básico para propietarios.',
    category: 'owner' as const,
    monthlyPriceArs: 150000,
    annualPriceArs: 1500000,
    monthlyPriceUsdRef: 12,
    hasTrial: true,
    trialDays: 14,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['can_list_accommodation', 'can_contact_tourists'],
    limits: { max_accommodations: 5, max_photos: 20 },
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    // Admin list-only fields (SPEC-168)
    isDeleted: false,
    activeSubscriptionCount: 3
};

/** Valid API list envelope */
function makePlanListResponse(items: unknown[] = [validPlanRecord]) {
    return {
        success: true,
        data: {
            items,
            pagination: {
                page: 1,
                pageSize: 20,
                total: items.length,
                totalPages: 1
            }
        },
        metadata: { timestamp: '2024-01-15T00:00:00.000Z', requestId: 'test-req' }
    };
}

describe('billing-plans/hooks — T-012 (transformPlanRecord aligned to DB shape)', () => {
    describe('usePlansQuery — success path', () => {
        it('should parse a valid BillingPlanResponse record without throwing', async () => {
            // Arrange
            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans`, () => {
                    return HttpResponse.json(makePlanListResponse());
                })
            );

            // Act
            const { result } = renderHook(() => usePlansQuery(), {
                wrapper: createTestWrapper()
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(result.current.data?.items).toHaveLength(1);
            const item = result.current.data?.items[0];
            expect(item?.id).toBe(validPlanRecord.id);
            expect(item?.slug).toBe(validPlanRecord.slug);
            expect(item?.isActive).toBe(true);
            expect(item?.category).toBe('owner');
            expect(item?.entitlements).toEqual(validPlanRecord.entitlements);
        });

        it('should convert limits Record<string, number> to { key, value }[] array', async () => {
            // Arrange
            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans`, () => {
                    return HttpResponse.json(makePlanListResponse());
                })
            );

            // Act
            const { result } = renderHook(() => usePlansQuery(), {
                wrapper: createTestWrapper()
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert — limits converted from Record to array
            const limits = result.current.data?.items[0]?.limits ?? [];
            expect(Array.isArray(limits)).toBe(true);
            expect(limits).toContainEqual({ key: 'max_accommodations', value: 5 });
            expect(limits).toContainEqual({ key: 'max_photos', value: 20 });
        });

        it('should return empty items when the API items array is empty', async () => {
            // Arrange
            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans`, () => {
                    return HttpResponse.json(makePlanListResponse([]));
                })
            );

            // Act
            const { result } = renderHook(() => usePlansQuery(), {
                wrapper: createTestWrapper()
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(result.current.data?.items).toHaveLength(0);
        });
    });

    describe('usePlansQuery — error path (legacy QZPay shape triggers 502)', () => {
        it('should set isError when the API returns a legacy QZPay-shaped record', async () => {
            // Arrange — record with old `active` + `metadata` shape (missing id UUID,
            // isActive, slug at top level, etc.)
            const legacyRecord = {
                // Missing id (uuid), using QZPay's plan structure without the DB columns
                name: 'Old shape plan',
                description: 'Legacy',
                active: true, // old field name (was `isActive`)
                entitlements: [],
                limits: {},
                metadata: {
                    slug: 'owner-basico',
                    category: 'owner',
                    isDefault: false,
                    sortOrder: 0
                },
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-15T00:00:00.000Z'
                // Missing: id (uuid), isActive, annualPriceArs, monthlyPriceArs, etc.
            };

            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans`, () => {
                    return HttpResponse.json(makePlanListResponse([legacyRecord]));
                })
            );

            // Act
            const { result } = renderHook(() => usePlansQuery(), {
                wrapper: createTestWrapper()
            });

            await waitFor(() => expect(result.current.isError).toBe(true));

            // Assert — should surface as an error (not silently succeed)
            expect(result.current.data).toBeUndefined();
            expect(result.current.error).toBeTruthy();
        });

        it('should set isError when the response envelope is malformed', async () => {
            // Arrange — API returns bare array instead of { success, data: { items } }
            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans`, () => {
                    return HttpResponse.json({ success: true, data: [] }); // missing items key
                })
            );

            // Act
            const { result } = renderHook(() => usePlansQuery(), {
                wrapper: createTestWrapper()
            });

            await waitFor(() => expect(result.current.isError).toBe(true));
        });
    });

    describe('usePlansQuery — filter params forwarding', () => {
        it('should append filter params to the query string', async () => {
            // Arrange
            let capturedUrl = '';
            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans`, ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(makePlanListResponse([]));
                })
            );

            // Act
            const { result } = renderHook(
                () => usePlansQuery({ category: 'owner', page: 2, pageSize: 10 }),
                { wrapper: createTestWrapper() }
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(capturedUrl).toContain('category=owner');
            expect(capturedUrl).toContain('page=2');
            expect(capturedUrl).toContain('pageSize=10');
        });

        it('should not append "all" or empty values to the query string', async () => {
            // Arrange
            let capturedUrl = '';
            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans`, ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(makePlanListResponse([]));
                })
            );

            // Act
            const { result } = renderHook(() => usePlansQuery({ category: 'all', search: '' }), {
                wrapper: createTestWrapper()
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(capturedUrl).not.toContain('category=');
            expect(capturedUrl).not.toContain('search=');
        });
    });
});
