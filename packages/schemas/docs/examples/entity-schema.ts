/**
 * Complete Entity Schema Example - Product
 *
 * Demonstrates a complete entity schema set with:
 * - Base schema with all fields
 * - CRUD schemas (create, update)
 * - Query schemas (search, filter)
 * - HTTP schemas (request, response)
 * - Relations
 * - Type inference
 * - Usage in service and API route
 *
 * @module examples/entity-schema
 */

import { z } from 'zod';

// =============================================================================
// 1. BASE PRODUCT SCHEMA
// =============================================================================

/**
 * Product status enumeration
 */
export const ProductStatusEnum = z.enum([
  'draft',
  'published',
  'archived',
  'out_of_stock',
]);

export type ProductStatus = z.infer<typeof ProductStatusEnum>;

/**
 * Product category enumeration
 */
export const ProductCategoryEnum = z.enum([
  'accommodation',
  'experience',
  'tour',
  'service',
  'merchandise',
]);

export type ProductCategory = z.infer<typeof ProductCategoryEnum>;

/**
 * Base Product Schema
 *
 * Complete entity structure with all fields and validations
 */
export const BaseProductSchema = z.object({
  /**
   * Unique identifier (UUID)
   */
  id: z.string().uuid(),

  /**
   * Product name
   */
  name: z.string().min(3).max(200),

  /**
   * URL-friendly slug
   */
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .min(3)
    .max(200),

  /**
   * Detailed product description
   */
  description: z.string().min(20).max(5000),

  /**
   * Short description for cards/lists
   */
  shortDescription: z.string().max(200).optional(),

  /**
   * Product category
   */
  category: ProductCategoryEnum,

  /**
   * Product tags for search
   */
  tags: z.array(z.string()).default([]),

  /**
   * Price in cents (to avoid floating point issues)
   */
  price: z.number().int().positive(),

  /**
   * Currency code (ISO 4217)
   */
  currency: z.string().length(3).toUpperCase().default('ARS'),

  /**
   * Compare at price (for showing discounts)
   */
  compareAtPrice: z.number().int().positive().nullable(),

  /**
   * Available stock quantity
   */
  stock: z.number().int().nonnegative(),

  /**
   * SKU (Stock Keeping Unit)
   */
  sku: z.string().optional(),

  /**
   * Product images
   */
  images: z.array(z.string().url()).min(1).max(10),

  /**
   * Featured image (first in array)
   */
  featuredImage: z.string().url(),

  /**
   * Vendor/seller ID
   */
  vendorId: z.string().uuid(),

  /**
   * Product status
   */
  status: ProductStatusEnum.default('draft'),

  /**
   * Whether product is featured
   */
  isFeatured: z.boolean().default(false),

  /**
   * Sort priority
   */
  sortOrder: z.number().int().default(0),

  /**
   * Average rating (0-5)
   */
  averageRating: z.number().min(0).max(5).default(0),

  /**
   * Number of reviews
   */
  reviewCount: z.number().int().nonnegative().default(0),

  /**
   * SEO metadata
   */
  seo: z.object({
    title: z.string().max(60).optional(),
    description: z.string().max(160).optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),

  /**
   * Creation timestamp
   */
  createdAt: z.date(),

  /**
   * Last update timestamp
   */
  updatedAt: z.date(),

  /**
   * Soft delete timestamp
   */
  deletedAt: z.date().nullable(),

  /**
   * Created by user ID
   */
  createdBy: z.string().uuid().nullable(),

  /**
   * Updated by user ID
   */
  updatedBy: z.string().uuid().nullable(),
});

/**
 * Product type inferred from base schema
 */
export type ProductType = z.infer<typeof BaseProductSchema>;

// =============================================================================
// 2. CREATE PRODUCT SCHEMA
// =============================================================================

/**
 * Create Product Schema
 *
 * Omits auto-generated fields (id, timestamps, ratings)
 */
export const CreateProductSchema = BaseProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  createdBy: true,
  updatedBy: true,
  averageRating: true,
  reviewCount: true,
}).extend({
  /**
   * Override featured image to make it optional
   * (will default to first image in array)
   */
  featuredImage: z.string().url().optional(),
});

/**
 * Create Product input type
 */
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

/**
 * Create Product with validation
 *
 * Adds business rule: published products must have all required fields
 */
export const CreateProductWithValidationSchema = CreateProductSchema.refine(
  (data) => {
    if (data.status === 'published') {
      // Ensure all required fields are present
      return (
        data.name &&
        data.description &&
        data.price > 0 &&
        data.images.length > 0 &&
        data.stock > 0
      );
    }
    return true;
  },
  {
    message: 'Published products must have all required fields',
    path: ['status'],
  }
);

// =============================================================================
// 3. UPDATE PRODUCT SCHEMA
// =============================================================================

/**
 * Update Product Schema
 *
 * Allows partial updates. Immutable fields are omitted.
 */
export const UpdateProductSchema = BaseProductSchema.omit({
  id: true,
  createdAt: true,
  createdBy: true,
  deletedAt: true,
  averageRating: true,
  reviewCount: true,
}).partial();

/**
 * Update Product input type
 */
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

/**
 * Update Product with status transition validation
 */
export const UpdateProductWithValidationSchema = UpdateProductSchema.extend({
  _currentStatus: ProductStatusEnum,
}).refine(
  (data) => {
    // Cannot unpublish products (only archive)
    if (data._currentStatus === 'published' && data.status === 'draft') {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot move published products back to draft',
    path: ['status'],
  }
);

// =============================================================================
// 4. SEARCH PRODUCT SCHEMA
// =============================================================================

/**
 * Product Filter Schema
 *
 * Filters for searching products
 */
export const ProductFilterSchema = z.object({
  /**
   * Text search in name, description
   */
  q: z.string().trim().min(2).optional(),

  /**
   * Filter by category
   */
  category: ProductCategoryEnum.optional(),

  /**
   * Filter by status
   */
  status: ProductStatusEnum.optional(),

  /**
   * Filter by vendor
   */
  vendorId: z.string().uuid().optional(),

  /**
   * Filter by tags (OR logic)
   */
  tags: z.array(z.string()).optional(),

  /**
   * Price range (in cents)
   */
  minPrice: z.number().int().nonnegative().optional(),
  maxPrice: z.number().int().positive().optional(),

  /**
   * Rating filter
   */
  minRating: z.number().min(0).max(5).optional(),

  /**
   * Only featured products
   */
  isFeatured: z.boolean().optional(),

  /**
   * Only in-stock products
   */
  inStock: z.boolean().optional(),
}).refine(
  (data) => {
    // Max price must be >= min price
    if (data.minPrice && data.maxPrice) {
      return data.maxPrice >= data.minPrice;
    }
    return true;
  },
  {
    message: 'Maximum price must be greater than or equal to minimum price',
    path: ['maxPrice'],
  }
);

/**
 * Product Sort Schema
 */
export const ProductSortSchema = z.object({
  sortBy: z
    .enum(['name', 'price', 'rating', 'createdAt', 'popularity'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Product Pagination Schema
 */
export const ProductPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Complete Search Product Schema
 */
export const SearchProductSchema = ProductFilterSchema
  .merge(ProductSortSchema)
  .merge(ProductPaginationSchema);

/**
 * Search Product input type
 */
export type SearchProductInput = z.infer<typeof SearchProductSchema>;

// =============================================================================
// 5. HTTP SCHEMAS (REQUEST/RESPONSE)
// =============================================================================

/**
 * Product Response Schema
 *
 * Product with nested vendor data
 */
export const ProductResponseSchema = BaseProductSchema.extend({
  vendor: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().url().nullable(),
  }),
});

/**
 * Product response type
 */
export type ProductResponse = z.infer<typeof ProductResponseSchema>;

/**
 * Product Summary Schema
 *
 * Minimal product data for lists
 */
export const ProductSummarySchema = BaseProductSchema.pick({
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  category: true,
  price: true,
  currency: true,
  compareAtPrice: true,
  featuredImage: true,
  averageRating: true,
  reviewCount: true,
  status: true,
  isFeatured: true,
});

/**
 * Product summary type
 */
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

/**
 * Success Response Wrapper
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

/**
 * Paginated Response Wrapper
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  });

/**
 * Create Product Response
 */
export const CreateProductResponseSchema = SuccessResponseSchema(ProductResponseSchema);

/**
 * List Products Response
 */
export const ListProductsResponseSchema = PaginatedResponseSchema(ProductSummarySchema);

// =============================================================================
// 6. RELATIONS SCHEMA
// =============================================================================

/**
 * Product with Vendor Schema
 */
export const ProductWithVendorSchema = BaseProductSchema.extend({
  vendor: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    logo: z.string().url().nullable(),
    website: z.string().url().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
    rating: z.number().min(0).max(5),
    reviewCount: z.number().int().nonnegative(),
  }),
});

/**
 * Product with Reviews Schema
 */
export const ProductWithReviewsSchema = BaseProductSchema.extend({
  reviews: z.array(
    z.object({
      id: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string(),
      userName: z.string(),
      userAvatar: z.string().url().nullable(),
      createdAt: z.date(),
    })
  ),
});

// =============================================================================
// 7. TYPE INFERENCE EXAMPLES
// =============================================================================

/**
 * All Product Types (exported for use in application)
 */
export type Product = z.infer<typeof BaseProductSchema>;
export type CreateProduct = z.infer<typeof CreateProductSchema>;
export type UpdateProduct = z.infer<typeof UpdateProductSchema>;
export type SearchProduct = z.infer<typeof SearchProductSchema>;
export type ProductWithVendor = z.infer<typeof ProductWithVendorSchema>;
export type ProductWithReviews = z.infer<typeof ProductWithReviewsSchema>;

// =============================================================================
// 8. SERVICE USAGE EXAMPLE
// =============================================================================

/**
 * Product Service Example
 *
 * Demonstrates schema usage in service layer
 */
export class ProductService {
  /**
   * Create new product
   */
  async create(input: CreateProductInput): Promise<Product> {
    // 1. Validate input
    const validated = CreateProductSchema.parse(input);

    // 2. Set featured image if not provided
    if (!validated.featuredImage && validated.images.length > 0) {
      validated.featuredImage = validated.images[0];
    }

    // 3. Additional business logic...
    // (e.g., check vendor exists, validate SKU uniqueness)

    // 4. Create product in database
    // const product = await this.productModel.create(validated);

    // For example purposes, return mock data
    return {
      ...validated,
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
      averageRating: 0,
      reviewCount: 0,
      featuredImage: validated.featuredImage || validated.images[0],
    };
  }

  /**
   * Update existing product
   */
  async update(id: string, input: UpdateProductInput): Promise<Product> {
    // 1. Validate input
    const validated = UpdateProductSchema.parse(input);

    // 2. Get current product
    // const current = await this.productModel.findById(id);

    // 3. Merge with updates
    // const updated = { ...current, ...validated, updatedAt: new Date() };

    // 4. Save to database
    // const product = await this.productModel.update(id, updated);

    // For example purposes, return mock data
    return {
      id,
      name: validated.name || 'Example Product',
      slug: validated.slug || 'example-product',
      description: validated.description || 'Product description',
      category: validated.category || 'merchandise',
      price: validated.price || 1000,
      currency: validated.currency || 'ARS',
      compareAtPrice: validated.compareAtPrice || null,
      stock: validated.stock || 10,
      images: validated.images || ['https://example.com/image.jpg'],
      featuredImage: validated.featuredImage || 'https://example.com/image.jpg',
      vendorId: validated.vendorId || '123e4567-e89b-12d3-a456-426614174001',
      status: validated.status || 'draft',
      isFeatured: validated.isFeatured || false,
      sortOrder: validated.sortOrder || 0,
      tags: validated.tags || [],
      averageRating: 0,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    };
  }

  /**
   * Search products
   */
  async search(input: SearchProductInput): Promise<{
    data: ProductSummary[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    // 1. Validate search params
    const validated = SearchProductSchema.parse(input);

    // 2. Build database query
    // const query = this.buildQuery(validated);

    // 3. Execute query with pagination
    // const products = await this.productModel.findMany(query);
    // const total = await this.productModel.count(query);

    // For example purposes, return mock data
    return {
      data: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Example Product',
          slug: 'example-product',
          shortDescription: 'A great product',
          category: 'merchandise' as const,
          price: 1000,
          currency: 'ARS',
          compareAtPrice: null,
          featuredImage: 'https://example.com/image.jpg',
          averageRating: 4.5,
          reviewCount: 42,
          status: 'published' as const,
          isFeatured: false,
        },
      ],
      pagination: {
        page: validated.page,
        pageSize: validated.pageSize,
        total: 1,
        totalPages: 1,
      },
    };
  }
}

// =============================================================================
// 9. API ROUTE USAGE EXAMPLE (HONO)
// =============================================================================

/**
 * Product API Routes Example
 *
 * Demonstrates schema usage in Hono API routes
 */

// Uncomment to use with Hono:
/*
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// POST /products - Create product
app.post(
  '/products',
  zValidator('json', CreateProductSchema),
  async (c) => {
    const input = c.req.valid('json');
    const productService = new ProductService();

    const product = await productService.create(input);

    return c.json({
      success: true,
      data: product,
    }, 201);
  }
);

// GET /products - List products
app.get(
  '/products',
  zValidator('query', SearchProductSchema),
  async (c) => {
    const query = c.req.valid('query');
    const productService = new ProductService();

    const result = await productService.search(query);

    return c.json({
      success: true,
      ...result,
    });
  }
);

// GET /products/:id - Get product
app.get(
  '/products/:id',
  async (c) => {
    const id = c.req.param('id');

    // Validate UUID
    const idSchema = z.string().uuid();
    const validatedId = idSchema.parse(id);

    // Get product
    // const product = await productService.findById(validatedId);

    return c.json({
      success: true,
      data: {
        // Mock product data
        id: validatedId,
        name: 'Example Product',
        // ... other fields
      },
    });
  }
);

// PATCH /products/:id - Update product
app.patch(
  '/products/:id',
  zValidator('json', UpdateProductSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const productService = new ProductService();

    const product = await productService.update(id, input);

    return c.json({
      success: true,
      data: product,
    });
  }
);

export default app;
*/

// =============================================================================
// 10. VALIDATION HELPERS
// =============================================================================

/**
 * Validate product creation
 */
export const validateProductCreation = (data: unknown) => {
  return CreateProductSchema.safeParse(data);
};

/**
 * Validate product update
 */
export const validateProductUpdate = (data: unknown) => {
  return UpdateProductSchema.safeParse(data);
};

/**
 * Validate product search
 */
export const validateProductSearch = (data: unknown) => {
  return SearchProductSchema.safeParse(data);
};

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Export all schemas and types
 */
export {
  // Base
  BaseProductSchema,
  ProductStatusEnum,
  ProductCategoryEnum,

  // CRUD
  CreateProductSchema,
  CreateProductWithValidationSchema,
  UpdateProductSchema,
  UpdateProductWithValidationSchema,

  // Query
  ProductFilterSchema,
  ProductSortSchema,
  ProductPaginationSchema,
  SearchProductSchema,

  // HTTP
  ProductResponseSchema,
  ProductSummarySchema,
  CreateProductResponseSchema,
  ListProductsResponseSchema,

  // Relations
  ProductWithVendorSchema,
  ProductWithReviewsSchema,
};
