import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { publishApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/client', () => ({ apiClient: { postProtected: vi.fn() } }));

describe('publishApi.publish (TEST:1729:1)', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        ['accommodation', 'accommodations'],
        ['venue', 'gastronomies'],
        ['experience', 'experiences']
    ] as const)('posts %s to its exact publish path without a body', async (vertical, plural) => {
        await publishApi.publish({ vertical, id: 'listing-1' });
        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: `/api/v1/protected/${plural}/listing-1/publish`
        });
    });
});
