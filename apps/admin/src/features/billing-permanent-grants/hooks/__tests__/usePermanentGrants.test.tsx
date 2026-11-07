// @vitest-environment jsdom

import { VerticalEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    buildLivePermanentGrantPath,
    buildPermanentGrantAnchorPath,
    buildPermanentGrantAnchorPreviewPath,
    buildPermanentGrantPath,
    buildPermanentGrantPreviewPath,
    buildPermanentGrantRevocationPath,
    useLivePermanentGrant,
    usePermanentGrant,
    usePermanentGrantAnchor,
    usePermanentGrantAnchorPreview,
    usePermanentGrantPreview,
    usePermanentGrantRevocation,
    usePermanentGrantRevocationPreview
} from '../usePermanentGrants';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const api = vi.mocked(fetchApi);
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const grantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const anchor = {
    vertical: VerticalEnum.ACCOMMODATION,
    planId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    floorPlanVersionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
};
const body = {
    beneficiaryUserId: userId,
    reason: 'pedido',
    includesAddons: true,
    anchors: [anchor]
};

function setup() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { wrapper, invalidate };
}
beforeEach(() => {
    vi.clearAllMocks();
    api.mockResolvedValue({ data: { data: {} }, status: 200 });
});

describe('AC:B13a:6 — grant API hooks (support)', () => {
    it('uses the exact registered paths for all six endpoints', () => {
        expect(buildLivePermanentGrantPath(userId)).toBe(
            `/api/v1/admin/billing-permanent-grants/by-beneficiary/${userId}`
        );
        expect(buildPermanentGrantPath()).toBe('/api/v1/admin/billing-permanent-grants');
        expect(buildPermanentGrantPreviewPath()).toBe(
            '/api/v1/admin/billing-permanent-grants/preview'
        );
        expect(buildPermanentGrantAnchorPath(grantId)).toBe(
            `/api/v1/admin/billing-permanent-grants/${grantId}/anchors`
        );
        expect(buildPermanentGrantAnchorPreviewPath(grantId)).toBe(
            `/api/v1/admin/billing-permanent-grants/${grantId}/anchors/preview`
        );
        expect(buildPermanentGrantRevocationPath(grantId)).toBe(
            `/api/v1/admin/billing-permanent-grants/${grantId}/revocation`
        );
    });

    it('reads the live grant with GET and does not preview when disabled', async () => {
        const { wrapper } = setup();
        renderHook(() => useLivePermanentGrant({ userId, enabled: true }), { wrapper });
        renderHook(() => usePermanentGrantPreview({ body, enabled: false }), { wrapper });
        renderHook(
            () =>
                usePermanentGrantAnchorPreview({
                    permanentGrantId: grantId,
                    body: anchor,
                    enabled: false
                }),
            { wrapper }
        );
        renderHook(
            () => usePermanentGrantRevocationPreview({ permanentGrantId: grantId, enabled: false }),
            { wrapper }
        );
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith({ path: buildLivePermanentGrantPath(userId) })
        );
        expect(api).toHaveBeenCalledTimes(1);
    });

    it('previews grant and anchor by POST with the exact body, and revocation by GET', async () => {
        const { wrapper } = setup();
        renderHook(() => usePermanentGrantPreview({ body, enabled: true }), { wrapper });
        renderHook(
            () =>
                usePermanentGrantAnchorPreview({
                    permanentGrantId: grantId,
                    body: anchor,
                    enabled: true
                }),
            { wrapper }
        );
        renderHook(
            () => usePermanentGrantRevocationPreview({ permanentGrantId: grantId, enabled: true }),
            { wrapper }
        );
        await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
        expect(api).toHaveBeenCalledWith({
            path: buildPermanentGrantPreviewPath(),
            method: 'POST',
            body
        });
        expect(api).toHaveBeenCalledWith({
            path: buildPermanentGrantAnchorPreviewPath(grantId),
            method: 'POST',
            body: anchor
        });
        expect(api).toHaveBeenCalledWith({ path: buildPermanentGrantRevocationPath(grantId) });
    });

    it('posts all acts and invalidates their preview and the live grant', async () => {
        const { wrapper, invalidate } = setup();
        const grant = renderHook(() => usePermanentGrant(), { wrapper });
        const anchored = renderHook(() => usePermanentGrantAnchor(), { wrapper });
        const revoked = renderHook(() => usePermanentGrantRevocation(), { wrapper });
        await act(async () => {
            await grant.result.current.mutateAsync(body);
        });
        await act(async () => {
            await anchored.result.current.mutateAsync({
                permanentGrantId: grantId,
                userId,
                body: anchor
            });
        });
        await act(async () => {
            await revoked.result.current.mutateAsync({
                permanentGrantId: grantId,
                userId,
                reason: '  pedido  '
            });
        });
        expect(api).toHaveBeenCalledWith({ path: buildPermanentGrantPath(), method: 'POST', body });
        expect(api).toHaveBeenCalledWith({
            path: buildPermanentGrantAnchorPath(grantId),
            method: 'POST',
            body: anchor
        });
        expect(api).toHaveBeenCalledWith({
            path: buildPermanentGrantRevocationPath(grantId),
            method: 'POST',
            body: { reason: 'pedido' }
        });
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: ['billing-permanent-grants', 'live', userId]
        });
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: ['billing-permanent-grants', 'grant-preview', body]
        });
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: ['billing-permanent-grants', 'anchor-preview', grantId, anchor]
        });
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: ['billing-permanent-grants', 'revocation-preview', grantId]
        });
    });
});
