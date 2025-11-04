import type { Product, ProductIdType } from '@repo/schemas';
import { ProductTypeEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Factory to create mock products for testing
 */
export function createMockProduct(overrides?: Partial<Product>): Product {
    const defaults: Product = {
        id: getMockId('product', 'p1') as ProductIdType,
        name: 'Test Product',
        type: ProductTypeEnum.LISTING_PLAN,
        description: 'A test product for listing plans',
        metadata: {},
        lifecycleState: 'published',
        adminInfo: null,
        isActive: true,
        isDeleted: false,

        // Base audit fields
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: getMockId('user') as string,
        updatedById: getMockId('user') as string,
        deletedAt: null,
        deletedById: null
    };

    return { ...defaults, ...overrides };
}

/**
 * Factory to create multiple mock products
 */
export function createMockProducts(count: number, overrides?: Partial<Product>): Product[] {
    return Array.from({ length: count }, (_, i) =>
        createMockProduct({
            ...overrides,
            id: getMockId('product', `p${i + 1}`) as ProductIdType,
            name: `Test Product ${i + 1}`
        })
    );
}
