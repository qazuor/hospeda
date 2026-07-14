/**
 * @file accommodation-occupancy-api.test.ts
 * @description Unit tests for the accommodationOccupancyApi endpoint wrappers
 * (HOS-43 Phase 1).
 *
 * Mirrors the style of accommodation-media-api.test.ts: mock `apiClient` at
 * the module level and assert on the call shape for each wrapper function.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { accommodationOccupancyApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        getProtected: vi.fn(),
        patch: vi.fn()
    }
}));

const ACC_ID = 'acc-uuid-123';

describe('accommodationOccupancyApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── list ────────────────────────────────────────────────────────────────

    describe('list', () => {
        it('calls getProtected with the correct path and no range', async () => {
            vi.mocked(apiClient.getProtected).mockResolvedValue({
                ok: true,
                data: { occupancy: [] }
            });

            await accommodationOccupancyApi.list({ id: ACC_ID });

            expect(apiClient.getProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/occupancy`,
                params: { from: undefined, to: undefined },
                cookieHeader: undefined
            });
        });

        it('forwards a from/to range', async () => {
            vi.mocked(apiClient.getProtected).mockResolvedValue({
                ok: true,
                data: { occupancy: [] }
            });

            await accommodationOccupancyApi.list({
                id: ACC_ID,
                from: '2026-07-01',
                to: '2026-08-01'
            });

            expect(apiClient.getProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/occupancy`,
                params: { from: '2026-07-01', to: '2026-08-01' },
                cookieHeader: undefined
            });
        });

        it('forwards a cookieHeader for SSR callers', async () => {
            vi.mocked(apiClient.getProtected).mockResolvedValue({
                ok: true,
                data: { occupancy: [] }
            });

            const cookieHeader = 'session=abc123';
            await accommodationOccupancyApi.list({ id: ACC_ID, cookieHeader });

            expect(apiClient.getProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/occupancy`,
                params: { from: undefined, to: undefined },
                cookieHeader
            });
        });
    });

    // ── batchToggle ─────────────────────────────────────────────────────────

    describe('batchToggle', () => {
        it('calls patch with the batch path and a block body', async () => {
            vi.mocked(apiClient.patch).mockResolvedValue({
                ok: true,
                data: { occupancy: [] }
            });

            await accommodationOccupancyApi.batchToggle({
                id: ACC_ID,
                dates: ['2026-07-10', '2026-07-11'],
                isBlocked: true,
                note: 'Reserved off-platform'
            });

            expect(apiClient.patch).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/occupancy/batch`,
                body: {
                    accommodationId: ACC_ID,
                    dates: ['2026-07-10', '2026-07-11'],
                    isBlocked: true,
                    note: 'Reserved off-platform'
                }
            });
        });

        it('calls patch with an unblock body and no note', async () => {
            vi.mocked(apiClient.patch).mockResolvedValue({
                ok: true,
                data: { occupancy: [] }
            });

            await accommodationOccupancyApi.batchToggle({
                id: ACC_ID,
                dates: ['2026-07-10'],
                isBlocked: false
            });

            expect(apiClient.patch).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/occupancy/batch`,
                body: {
                    accommodationId: ACC_ID,
                    dates: ['2026-07-10'],
                    isBlocked: false,
                    note: undefined
                }
            });
        });

        it('embeds accommodationId in both the path and the body', async () => {
            vi.mocked(apiClient.patch).mockResolvedValue({ ok: true, data: { occupancy: [] } });

            await accommodationOccupancyApi.batchToggle({
                id: 'specific-uuid',
                dates: ['2026-07-10'],
                isBlocked: true
            });

            const callArgs = vi.mocked(apiClient.patch).mock.calls[0]?.[0];
            expect(callArgs?.path).toMatch(/\/specific-uuid\/occupancy\/batch$/);
            expect((callArgs?.body as { accommodationId: string }).accommodationId).toBe(
                'specific-uuid'
            );
        });
    });
});
