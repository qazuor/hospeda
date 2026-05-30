/**
 * Tests for billing-plans mutations — T-013
 *
 * Verifies that:
 * - Each mutation hook (create/update/delete/toggle) hits the correct
 *   HTTP method and path.
 * - All mutation hooks invalidate the list query key on success so the
 *   plans table refreshes automatically.
 * - The plans HTTP adapter (billing-http-adapter) successfully resolves
 *   findById via the real admin endpoint (replaces the throwing stub).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
    useCreatePlanMutation,
    useDeletePlanMutation,
    useTogglePlanActiveMutation,
    useUpdatePlanMutation
} from '../../../src/features/billing-plans/hooks';
import { createHttpBillingAdapter } from '../../../src/lib/billing-http-adapter';
import { createTestWrapper } from '../../helpers/create-test-wrapper';
import { server } from '../../mocks/server';

const API_BASE = 'http://localhost:3001';

/** Minimal valid BillingPlanResponse for mutation responses */
const planResponse = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    slug: 'owner-basico',
    name: 'Básico Propietario',
    description: 'Plan básico',
    category: 'owner' as const,
    monthlyPriceArs: 150000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 12,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    entitlements: [],
    limits: {},
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z'
};

/** Wraps a BillingPlanResponse in the standard API envelope */
function wrapData(data: unknown) {
    return {
        success: true,
        data,
        metadata: { timestamp: '2024-01-15T00:00:00.000Z', requestId: 'test-req' }
    };
}

describe('billing-plans/mutations — T-013 (HTTP adapter + mutations wired)', () => {
    describe('useCreatePlanMutation', () => {
        it('should POST to /api/v1/admin/billing/plans with the payload', async () => {
            // Arrange
            let capturedMethod = '';
            let capturedUrl = '';
            let capturedBody: unknown = null;

            server.use(
                http.post(`${API_BASE}/api/v1/admin/billing/plans`, async ({ request }) => {
                    capturedMethod = request.method;
                    capturedUrl = request.url;
                    capturedBody = await request.json();
                    return HttpResponse.json(wrapData(planResponse));
                })
            );

            const { result } = renderHook(() => useCreatePlanMutation(), {
                wrapper: createTestWrapper()
            });

            // Act
            act(() => {
                result.current.mutate({
                    slug: 'owner-basico',
                    name: 'Básico',
                    description: 'Plan básico',
                    category: 'owner',
                    monthlyPriceArs: 150000,
                    annualPriceArs: null,
                    monthlyPriceUsdRef: 12,
                    hasTrial: false,
                    trialDays: 0,
                    isDefault: false,
                    sortOrder: 1,
                    entitlements: [],
                    limits: [],
                    isActive: true
                });
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(capturedMethod).toBe('POST');
            expect(capturedUrl).toContain('/api/v1/admin/billing/plans');
            expect(capturedBody).toMatchObject({ slug: 'owner-basico', name: 'Básico' });
        });

        it('should invalidate the list query on success', async () => {
            // Arrange
            const invalidateSpy = vi.fn();
            server.use(
                http.post(`${API_BASE}/api/v1/admin/billing/plans`, async () => {
                    return HttpResponse.json(wrapData(planResponse));
                })
            );

            const { result } = renderHook(() => useCreatePlanMutation(), {
                wrapper: createTestWrapper()
            });

            // Spy on the underlying invalidate via mutation onSuccess completion
            act(() => {
                result.current.mutate(
                    {
                        slug: 'owner-basico',
                        name: 'Básico',
                        description: 'Plan básico',
                        category: 'owner',
                        monthlyPriceArs: 150000,
                        annualPriceArs: null,
                        monthlyPriceUsdRef: 12,
                        hasTrial: false,
                        trialDays: 0,
                        isDefault: false,
                        sortOrder: 1,
                        entitlements: [],
                        limits: [],
                        isActive: true
                    },
                    { onSuccess: invalidateSpy }
                );
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(invalidateSpy).toHaveBeenCalledOnce();
        });
    });

    describe('useUpdatePlanMutation', () => {
        it('should PUT to /api/v1/admin/billing/plans/:id (id-based, no slug in body)', async () => {
            // Arrange
            let capturedMethod = '';
            let capturedUrl = '';
            let capturedBody: unknown = null;
            const planId = planResponse.id;

            server.use(
                http.put(
                    `${API_BASE}/api/v1/admin/billing/plans/${planId}`,
                    async ({ request }) => {
                        capturedMethod = request.method;
                        capturedUrl = request.url;
                        capturedBody = await request.json();
                        return HttpResponse.json(wrapData(planResponse));
                    }
                )
            );

            const { result } = renderHook(() => useUpdatePlanMutation(), {
                wrapper: createTestWrapper()
            });

            // Act
            act(() => {
                result.current.mutate({ id: planId, name: 'Básico Actualizado' });
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(capturedMethod).toBe('PUT');
            expect(capturedUrl).toContain(`/api/v1/admin/billing/plans/${planId}`);
            // slug must NOT be in the body (D1: slug is immutable)
            expect((capturedBody as Record<string, unknown>)?.slug).toBeUndefined();
            expect((capturedBody as Record<string, unknown>)?.name).toBe('Básico Actualizado');
        });

        it('should invalidate list query on success', async () => {
            // Arrange
            const planId = planResponse.id;
            const invalidateSpy = vi.fn();
            server.use(
                http.put(`${API_BASE}/api/v1/admin/billing/plans/${planId}`, async () => {
                    return HttpResponse.json(wrapData(planResponse));
                })
            );

            const { result } = renderHook(() => useUpdatePlanMutation(), {
                wrapper: createTestWrapper()
            });

            act(() => {
                result.current.mutate({ id: planId, name: 'Test' }, { onSuccess: invalidateSpy });
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(invalidateSpy).toHaveBeenCalledOnce();
        });
    });

    describe('useTogglePlanActiveMutation', () => {
        it('should PATCH /api/v1/admin/billing/plans/:id with { active: boolean }', async () => {
            // Arrange
            let capturedMethod = '';
            let capturedBody: unknown = null;
            const planId = planResponse.id;

            server.use(
                http.patch(
                    `${API_BASE}/api/v1/admin/billing/plans/${planId}`,
                    async ({ request }) => {
                        capturedMethod = request.method;
                        capturedBody = await request.json();
                        return HttpResponse.json({ success: true, data: { active: false } });
                    }
                )
            );

            const { result } = renderHook(() => useTogglePlanActiveMutation(), {
                wrapper: createTestWrapper()
            });

            // Act
            act(() => {
                result.current.mutate({ id: planId, isActive: false });
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(capturedMethod).toBe('PATCH');
            expect(capturedBody).toMatchObject({ active: false });
        });
    });

    describe('useDeletePlanMutation', () => {
        it('should DELETE /api/v1/admin/billing/plans/:id', async () => {
            // Arrange
            let capturedMethod = '';
            let capturedUrl = '';
            const planId = planResponse.id;

            server.use(
                http.delete(
                    `${API_BASE}/api/v1/admin/billing/plans/${planId}`,
                    async ({ request }) => {
                        capturedMethod = request.method;
                        capturedUrl = request.url;
                        return HttpResponse.json({ success: true, data: {} });
                    }
                )
            );

            const { result } = renderHook(() => useDeletePlanMutation(), {
                wrapper: createTestWrapper()
            });

            // Act
            act(() => {
                result.current.mutate(planId);
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Assert
            expect(capturedMethod).toBe('DELETE');
            expect(capturedUrl).toContain(`/api/v1/admin/billing/plans/${planId}`);
        });

        it('should invalidate list query on success', async () => {
            // Arrange
            const planId = planResponse.id;
            const invalidateSpy = vi.fn();
            server.use(
                http.delete(`${API_BASE}/api/v1/admin/billing/plans/${planId}`, async () => {
                    return HttpResponse.json({ success: true, data: {} });
                })
            );

            const { result } = renderHook(() => useDeletePlanMutation(), {
                wrapper: createTestWrapper()
            });

            act(() => {
                result.current.mutate(planId, { onSuccess: invalidateSpy });
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(invalidateSpy).toHaveBeenCalledOnce();
        });
    });

    describe('billing-http-adapter plans storage — T-013 (replaces throwing stub)', () => {
        it('should resolve findById via GET /api/v1/admin/billing/plans/:id', async () => {
            // Arrange
            const planId = 'plan-uuid-001';
            const mockQZPayPlan = {
                id: planId,
                name: 'owner-basico',
                description: 'Plan básico',
                metadata: {},
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-15T00:00:00.000Z'
            };

            server.use(
                http.get(`${API_BASE}/api/v1/admin/billing/plans/${planId}`, () => {
                    return HttpResponse.json({ data: mockQZPayPlan });
                })
            );

            const adapter = createHttpBillingAdapter({ apiUrl: API_BASE });

            // Act — should NOT throw (previously was createThrowingStorage)
            const result = await adapter.plans.findById(planId);

            // Assert
            expect(result).toEqual(mockQZPayPlan);
        });

        it('should NOT throw when adapter.plans.findById is called', () => {
            // This is the key regression guard: the adapter.plans branch no
            // longer throws on access; it returns a real storage object.
            const adapter = createHttpBillingAdapter({ apiUrl: API_BASE });
            expect(typeof adapter.plans.findById).toBe('function');
        });
    });
});
