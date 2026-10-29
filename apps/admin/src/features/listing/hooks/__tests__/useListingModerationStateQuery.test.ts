import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    buildListingModerationStatePath,
    useListingModerationStateQuery
} from '../useListingModerationStateQuery';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn((options: unknown) => options) }));
vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

describe('TEST:1760:3b moderation state query contract', () => {
    beforeEach(() => vi.clearAllMocks());
    it('uses the plural route and query key, then validates the response schema', async () => {
        vi.mocked(fetchApi).mockResolvedValue({
            data: { data: { publicationStatus: 'PUBLISHED', fixRequest: null } }
        } as never);
        const query = useListingModerationStateQuery({
            vertical: 'venue',
            id: 'listing-id'
        }) as unknown as { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> };
        expect(buildListingModerationStatePath({ vertical: 'venue', id: 'listing-id' })).toBe(
            '/api/v1/admin/venues/listing-id/moderation'
        );
        expect(query.queryKey).toEqual(['venues', 'listing-id', 'moderation']);
        await expect(query.queryFn()).resolves.toEqual({
            publicationStatus: 'PUBLISHED',
            fixRequest: null
        });
        expect(fetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/venues/listing-id/moderation',
            method: 'GET'
        });
    });
    it('rejects malformed response data', async () => {
        vi.mocked(fetchApi).mockResolvedValue({
            data: { data: { publicationStatus: 'PUBLISHED', fixRequest: { suggestedDate: null } } }
        } as never);
        const query = useListingModerationStateQuery({
            vertical: 'accommodation',
            id: 'listing-id'
        }) as unknown as { queryFn: () => Promise<unknown> };
        await expect(query.queryFn()).rejects.toThrow();
    });
});
