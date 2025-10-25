import { z } from 'zod';
import { ProductTypeEnumSchema } from '../../enums/product-type.schema.js';

// HTTP parameter coercion for search
export const HttpProductSearchSchema = z
    .object({
        // Pagination parameters
        page: z.preprocess((val) => {
            if (typeof val === 'string') return Number.parseInt(val, 10);
            return val;
        }, z.number().int().positive().default(1)),

        pageSize: z.preprocess((val) => {
            if (typeof val === 'string') return Number.parseInt(val, 10);
            return val;
        }, z.number().int().positive().max(100).default(20)),

        // Sort parameters
        sortBy: z.string().default('name'),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),

        // Search and filter parameters
        q: z.string().optional(),
        name: z.string().optional(),

        type: ProductTypeEnumSchema.optional(),

        // Boolean coercion
        isActive: z.preprocess((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true';
            }
            return val;
        }, z.boolean().optional()),

        isDeleted: z.preprocess((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true';
            }
            return val;
        }, z.boolean().optional()),

        // Date coercion
        createdAfter: z.preprocess((val) => {
            if (typeof val === 'string') return new Date(val);
            return val;
        }, z.date().optional()),

        createdBefore: z.preprocess((val) => {
            if (typeof val === 'string') return new Date(val);
            return val;
        }, z.date().optional()),

        updatedAfter: z.preprocess((val) => {
            if (typeof val === 'string') return new Date(val);
            return val;
        }, z.date().optional()),

        updatedBefore: z.preprocess((val) => {
            if (typeof val === 'string') return new Date(val);
            return val;
        }, z.date().optional())
    })
    .strict();

// HTTP schemas for CRUD operations
export const ProductCreateHttpSchema = z
    .object({
        name: z.string(),
        type: ProductTypeEnumSchema,
        description: z.string().optional(),
        metadata: z.string().optional() // JSON string that will be parsed
    })
    .strict();

export const ProductUpdateHttpSchema = z
    .object({
        name: z.string().optional(),
        type: ProductTypeEnumSchema.optional(),
        description: z.string().optional(),
        metadata: z.string().optional() // JSON string that will be parsed
    })
    .strict();

export const ProductGetHttpSchema = z
    .object({
        id: z.string().uuid()
    })
    .strict();

// Type exports
export type HttpProductSearch = z.infer<typeof HttpProductSearchSchema>;
export type ProductCreateHttp = z.infer<typeof ProductCreateHttpSchema>;
export type ProductUpdateHttp = z.infer<typeof ProductUpdateHttpSchema>;
export type ProductGetHttp = z.infer<typeof ProductGetHttpSchema>;

// Conversion functions from HTTP to domain
export function httpToDomainProductSearch(httpParams: HttpProductSearch) {
    const { page, pageSize, sortBy, sortOrder, ...filters } = httpParams;

    return {
        page,
        pageSize,
        sortBy,
        sortOrder,
        ...filters
    };
}

export function httpToDomainProductCreate(httpData: ProductCreateHttp) {
    const { metadata, ...rest } = httpData;

    let parsedMetadata = {};
    if (metadata) {
        try {
            parsedMetadata = JSON.parse(metadata);
        } catch {
            // If JSON parsing fails, use empty object
            parsedMetadata = {};
        }
    }

    return {
        ...rest,
        metadata: parsedMetadata,
        lifecycleState: 'ACTIVE' as const
    };
}

export function httpToDomainProductUpdate(httpData: ProductUpdateHttp) {
    const { metadata, ...rest } = httpData;

    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadata !== undefined) {
        try {
            parsedMetadata = JSON.parse(metadata);
        } catch {
            // If JSON parsing fails, use empty object
            parsedMetadata = {};
        }
    }

    return {
        ...rest,
        ...(parsedMetadata !== undefined && { metadata: parsedMetadata })
    };
}
