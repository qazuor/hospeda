import { describe, expect, it } from 'vitest';
import {
    HttpProductSearchSchema,
    ProductCreateHttpSchema,
    ProductUpdateHttpSchema,
    httpToDomainProductCreate,
    httpToDomainProductSearch,
    httpToDomainProductUpdate
} from '../../../src/entities/product/product.http.schema.js';
import { ProductTypeEnum } from '../../../src/enums/product-type.enum.js';

describe('Product HTTP Schema', () => {
    describe('HttpProductSearchSchema', () => {
        it('should validate HTTP search parameters with coercion', () => {
            const httpSearch = {
                page: '2',
                pageSize: '25',
                sortBy: 'name',
                sortOrder: 'desc',
                q: 'sponsorship',
                name: 'Premium',
                type: 'campaign',
                isActive: 'true'
            };

            const result = HttpProductSearchSchema.safeParse(httpSearch);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(25);
                expect(result.data.isActive).toBe(true);
                expect(result.data.type).toBe('campaign');
            }
        });

        it('should handle missing optional parameters', () => {
            const httpSearch = {
                page: '1',
                pageSize: '10'
            };

            const result = HttpProductSearchSchema.safeParse(httpSearch);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(10);
                expect(result.data.sortOrder).toBe('asc');
            }
        });

        it('should coerce date parameters', () => {
            const httpSearch = {
                createdAfter: '2023-01-01',
                createdBefore: '2023-12-31'
            };

            const result = HttpProductSearchSchema.safeParse(httpSearch);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.createdAfter).toBeInstanceOf(Date);
                expect(result.data.createdBefore).toBeInstanceOf(Date);
            }
        });
    });

    describe('ProductCreateHttpSchema', () => {
        it('should validate product creation HTTP data', () => {
            const httpData = {
                name: 'Premium Campaign Package',
                type: 'campaign',
                metadata: JSON.stringify({ tier: 'premium', channels: ['web'] })
            };

            const result = ProductCreateHttpSchema.safeParse(httpData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Premium Campaign Package');
                expect(result.data.type).toBe('campaign');
            }
        });

        it('should require name and type', () => {
            const httpData = {
                metadata: '{}'
            };

            const result = ProductCreateHttpSchema.safeParse(httpData);
            expect(result.success).toBe(false);
        });
    });

    describe('ProductUpdateHttpSchema', () => {
        it('should validate partial product updates', () => {
            const httpData = {
                name: 'Updated Product Name'
            };

            const result = ProductUpdateHttpSchema.safeParse(httpData);
            expect(result.success).toBe(true);
        });
    });

    describe('HTTP to Domain Conversion', () => {
        it('should convert HTTP search to domain search format', () => {
            const httpParams = {
                page: 2,
                pageSize: 25,
                sortBy: 'name',
                sortOrder: 'desc' as const,
                q: 'sponsorship search',
                name: 'Premium Package',
                type: ProductTypeEnum.SPONSORSHIP,
                isActive: true
            };

            const domainSearch = httpToDomainProductSearch(httpParams);

            expect(domainSearch.page).toBe(2);
            expect(domainSearch.pageSize).toBe(25);
            expect(domainSearch.sortBy).toBe('name');
            expect(domainSearch.sortOrder).toBe('desc');
            expect(domainSearch.q).toBe('sponsorship search');
            expect(domainSearch.name).toBe('Premium Package');
            expect(domainSearch.type).toBe('sponsorship');
            expect(domainSearch.isActive).toBe(true);
        });

        it('should convert HTTP create data to domain create input', () => {
            const httpData = {
                name: 'New Product',
                type: ProductTypeEnum.CAMPAIGN,
                metadata: '{"tier": "basic"}'
            };

            const domainCreate = httpToDomainProductCreate(httpData);

            expect(domainCreate.name).toBe('New Product');
            expect(domainCreate.type).toBe('campaign');
            expect(domainCreate.metadata).toEqual({ tier: 'basic' });
            expect(domainCreate.lifecycleState).toBe('ACTIVE');
        });

        it('should convert HTTP update data to domain update input', () => {
            const httpData = {
                name: 'Updated Product',
                metadata: '{"updated": true}'
            };

            const domainUpdate = httpToDomainProductUpdate(httpData);

            expect(domainUpdate.name).toBe('Updated Product');
            expect(domainUpdate.metadata).toEqual({ updated: true });
        });

        it('should handle invalid JSON metadata gracefully', () => {
            const httpData = {
                name: 'Product with bad metadata',
                type: ProductTypeEnum.CAMPAIGN,
                metadata: 'invalid json'
            };

            const domainCreate = httpToDomainProductCreate(httpData);
            expect(domainCreate.metadata).toEqual({});
        });
    });
});
