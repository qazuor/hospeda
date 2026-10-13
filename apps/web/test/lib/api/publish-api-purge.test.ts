/**
 * @file publish-api-purge.test.ts
 * @description `publishApi.purge` is the owner's delete button (HOS-1477,
 * AC:V6:25): it must run PB12 — `POST /protected/{plural}/{id}/purge` — on the
 * three verticals, and never fall back to the retired `DELETE /protected/{plural}/{id}`
 * door, which no longer exists (it answers 404).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { publishApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        postProtected: vi.fn(),
        delete: vi.fn()
    }
}));

const CASES = [
    { vertical: 'accommodation', plural: 'accommodations' },
    { vertical: 'gastronomy', plural: 'gastronomies' },
    { vertical: 'experience', plural: 'experiences' }
] as const;

describe('publishApi.purge (owner PB12)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(CASES)('POSTs to the $vertical purge route', async ({ vertical, plural }) => {
        // Arrange
        vi.mocked(apiClient.postProtected).mockResolvedValue({
            ok: true,
            data: { purged: true }
        });

        // Act
        const result = await publishApi.purge({ vertical, id: 'listing-1' });

        // Assert
        expect(apiClient.postProtected).toHaveBeenCalledTimes(1);
        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `/api/v1/protected/${plural}/listing-1/purge`
        });
        expect(apiClient.delete).not.toHaveBeenCalled();
        expect(result.ok).toBe(true);
    });
});
