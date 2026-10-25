/** HOS-1770: stored accommodation values must not discard the admin list page. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEntityApi } from '@/components/entity-list/api/createEntityApi';
import { accommodationsConfig } from '@/features/accommodations/config/accommodations.config';
import { meAccommodationsConfig } from '@/features/accommodations/config/me-accommodations.config';
import { fetchApi } from '@/lib/api/client';
import { mockAccommodation } from '../fixtures/accommodation.fixture';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const UUID_A = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const UUID_B = '0b6f1d0e-53a1-4f0e-9b57-6a1c2d3e4f50';
const UUID_C = '6d1c9a52-3f4b-4e8e-8a47-1b2c3d4e5f60';
const pagination = {
    page: 1,
    pageSize: 20,
    total: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
};

const normal = {
    ...mockAccommodation,
    id: UUID_A,
    name: 'Normal accommodation',
    destinationId: UUID_B,
    ownerId: UUID_C,
    price: { price: 100, currency: 'ARS' },
    location: { street: 'Valid Street', number: '10' }
};
const historical = {
    ...normal,
    id: UUID_B,
    name: 'AB',
    price: { price: 0, currency: 'ARS' },
    location: { street: 'A' }
};

const cases = [
    { name: 'accommodationsConfig', config: accommodationsConfig },
    { name: 'meAccommodationsConfig', config: meAccommodationsConfig }
] as const;

describe('TEST:1770:4 admin accommodation lists keep historical rows', () => {
    beforeEach(() => vi.mocked(fetchApi).mockReset());

    it.each(
        cases
    )('$name resolves both rows when one has stored values outside write bounds', async ({
        config
    }) => {
        // Arrange
        vi.mocked(fetchApi).mockResolvedValue({
            data: { success: true, data: { items: [historical, normal], pagination } },
            status: 200
        } as never);
        const api = createEntityApi({
            endpoint: config.apiEndpoint,
            itemSchema: config.listItemSchema as never
        });

        // Act
        const result = await api.getEntities({ page: 1, pageSize: 20 });

        // Assert
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({
            id: UUID_B,
            name: 'AB',
            price: { price: 0 },
            location: { street: 'A' }
        });
        expect(result.data[1]).toMatchObject({ id: UUID_A });
    });
});
