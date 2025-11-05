/**
 * API Schema Patterns Example
 *
 * Demonstrates:
 * - Request validation (params, query, body)
 * - Response formatting (success, error, paginated)
 * - Complete Hono routes with zValidator
 * - Error handling patterns
 * - Type safety throughout
 *
 * @example
 * ```typescript
 * // Full working Hono application with type-safe routes
 * import { app } from './api-schema';
 *
 * // Start server
 * const port = 3000;
 * console.log(`Server running at http://localhost:${port}`);
 * ```
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// ============================================================================
// 1. REQUEST SCHEMAS
// ============================================================================

/**
 * Path parameter schema for product ID
 *
 * @example
 * ```typescript
 * // GET /products/:id
 * const params = pathParamsSchema.parse({ id: 'prod-123' });
 * ```
 */
export const pathParamsSchema = z.object({
  id: z.string().uuid('Product ID must be a valid UUID'),
});

export type PathParams = z.infer<typeof pathParamsSchema>;

/**
 * Query parameter schema for product list filtering
 *
 * Includes:
 * - Pagination (page, pageSize)
 * - Filtering (category, minPrice, maxPrice, inStock)
 * - Sorting (sortBy, sortOrder)
 * - Search (q)
 *
 * @example
 * ```typescript
 * // GET /products?page=1&category=electronics&minPrice=100
 * const query = queryParamsSchema.parse({
 *   page: '1',
 *   category: 'electronics',
 *   minPrice: '100',
 * });
 * ```
 */
export const queryParamsSchema = z.object({
  // Pagination
  page: z.coerce
    .number()
    .int()
    .min(1, 'Page must be at least 1')
    .default(1)
    .optional(),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(20)
    .optional(),

  // Filtering
  category: z
    .enum(['electronics', 'clothing', 'home', 'sports', 'books'])
    .optional(),
  minPrice: z.coerce.number().min(0, 'Minimum price cannot be negative').optional(),
  maxPrice: z.coerce.number().min(0, 'Maximum price cannot be negative').optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),

  // Sorting
  sortBy: z.enum(['name', 'price', 'createdAt', 'updatedAt']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),

  // Search
  q: z.string().max(100, 'Search query too long').optional(),
}).refine(
  (data) => {
    if (data.minPrice !== undefined && data.maxPrice !== undefined) {
      return data.minPrice <= data.maxPrice;
    }
    return true;
  },
  {
    message: 'Minimum price must be less than or equal to maximum price',
    path: ['minPrice'],
  }
);

export type QueryParams = z.infer<typeof queryParamsSchema>;

/**
 * Request body schema for creating a product
 *
 * @example
 * ```typescript
 * // POST /products
 * const body = createProductSchema.parse({
 *   name: 'Gaming Laptop',
 *   description: 'High-performance gaming laptop',
 *   price: 1299.99,
 *   category: 'electronics',
 *   stock: 10,
 *   images: ['https://example.com/image1.jpg'],
 * });
 * ```
 */
export const createProductSchema = z.object({
  name: z
    .string()
    .min(3, 'Product name must be at least 3 characters')
    .max(100, 'Product name cannot exceed 100 characters')
    .trim(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description cannot exceed 1000 characters')
    .trim(),
  price: z
    .number()
    .positive('Price must be positive')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),
  category: z.enum(['electronics', 'clothing', 'home', 'sports', 'books']),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .min(1, 'At least one image is required')
    .max(10, 'Cannot upload more than 10 images'),
  tags: z.array(z.string().trim()).max(10, 'Cannot have more than 10 tags').optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ============================================================================
// 2. RESPONSE SCHEMAS
// ============================================================================

/**
 * Product entity schema (matches database model)
 */
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  category: z.enum(['electronics', 'clothing', 'home', 'sports', 'books']),
  stock: z.number(),
  images: z.array(z.string()),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Product = z.infer<typeof productSchema>;

/**
 * Success response wrapper
 *
 * @template T - Type of data being returned
 *
 * @example
 * ```typescript
 * const response: SuccessResponse<Product> = {
 *   success: true,
 *   data: product,
 * };
 * ```
 */
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export type SuccessResponse<T> = {
  success: true;
  data: T;
};

/**
 * Error response wrapper
 *
 * @example
 * ```typescript
 * const response: ErrorResponse = {
 *   success: false,
 *   error: {
 *     code: 'VALIDATION_ERROR',
 *     message: 'Invalid product data',
 *     details: { field: 'price', issue: 'Must be positive' },
 *   },
 * };
 * ```
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Pagination metadata schema
 */
export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Paginated response wrapper
 *
 * @template T - Type of items being returned
 *
 * @example
 * ```typescript
 * const response: PaginatedResponse<Product> = {
 *   success: true,
 *   data: [product1, product2],
 *   pagination: {
 *     page: 1,
 *     pageSize: 20,
 *     total: 45,
 *     totalPages: 3,
 *   },
 * };
 * ```
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: paginationMetaSchema,
  });

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pagination: PaginationMeta;
};

// ============================================================================
// 3. COMPLETE HONO APPLICATION
// ============================================================================

/**
 * Create Hono application with type-safe routes
 *
 * @example
 * ```typescript
 * const app = createProductAPI();
 * ```
 */
export function createProductAPI(): Hono {
  const app = new Hono();

  /**
   * GET /products - List products with filters and pagination
   *
   * @route GET /products
   * @query {QueryParams} - Filter and pagination parameters
   * @returns {PaginatedResponse<Product>} - Paginated list of products
   *
   * @example
   * ```bash
   * curl "http://localhost:3000/products?page=1&category=electronics&minPrice=100"
   * ```
   */
  app.get('/products', zValidator('query', queryParamsSchema), (c) => {
    const query = c.req.valid('query');

    // Simulate database query
    const mockProducts: Product[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Gaming Laptop',
        description: 'High-performance gaming laptop with RTX 4080',
        price: 1299.99,
        category: 'electronics',
        stock: 10,
        images: ['https://example.com/laptop1.jpg'],
        tags: ['gaming', 'laptop', 'high-performance'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with 6 buttons',
        price: 29.99,
        category: 'electronics',
        stock: 50,
        images: ['https://example.com/mouse1.jpg'],
        tags: ['mouse', 'wireless', 'ergonomic'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Apply filters
    let filtered = mockProducts;

    if (query.category) {
      filtered = filtered.filter((p) => p.category === query.category);
    }

    if (query.minPrice !== undefined) {
      filtered = filtered.filter((p) => p.price >= query.minPrice!);
    }

    if (query.maxPrice !== undefined) {
      filtered = filtered.filter((p) => p.price <= query.maxPrice!);
    }

    if (query.inStock !== undefined) {
      filtered = filtered.filter((p) => (query.inStock ? p.stock > 0 : p.stock === 0));
    }

    if (query.q) {
      const searchLower = query.q.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (query.sortBy && query.sortOrder) {
      filtered.sort((a, b) => {
        const aVal = a[query.sortBy!];
        const bVal = b[query.sortBy!];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return query.sortOrder === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return query.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    // Apply pagination
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedData = filtered.slice(start, end);

    const response: PaginatedResponse<Product> = {
      success: true,
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };

    return c.json(response, 200);
  });

  /**
   * POST /products - Create a new product
   *
   * @route POST /products
   * @body {CreateProductInput} - Product data
   * @returns {SuccessResponse<Product>} - Created product
   *
   * @example
   * ```bash
   * curl -X POST http://localhost:3000/products \
   *   -H "Content-Type: application/json" \
   *   -d '{"name":"Gaming Laptop","description":"High-performance","price":1299.99,"category":"electronics","stock":10,"images":["https://example.com/img.jpg"]}'
   * ```
   */
  app.post('/products', zValidator('json', createProductSchema), (c) => {
    const body = c.req.valid('json');

    // Simulate product creation
    const newProduct: Product = {
      id: crypto.randomUUID(),
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response: SuccessResponse<Product> = {
      success: true,
      data: newProduct,
    };

    return c.json(response, 201);
  });

  /**
   * GET /products/:id - Retrieve a single product
   *
   * @route GET /products/:id
   * @param {string} id - Product UUID
   * @returns {SuccessResponse<Product>} - Product details
   *
   * @example
   * ```bash
   * curl http://localhost:3000/products/550e8400-e29b-41d4-a716-446655440001
   * ```
   */
  app.get('/products/:id', zValidator('param', pathParamsSchema), (c) => {
    const params = c.req.valid('param');

    // Simulate database lookup
    const mockProduct: Product = {
      id: params.id,
      name: 'Gaming Laptop',
      description: 'High-performance gaming laptop with RTX 4080',
      price: 1299.99,
      category: 'electronics',
      stock: 10,
      images: ['https://example.com/laptop1.jpg'],
      tags: ['gaming', 'laptop', 'high-performance'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Simulate not found scenario
    if (params.id === '00000000-0000-0000-0000-000000000000') {
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found',
          details: { productId: params.id },
        },
      };
      return c.json(errorResponse, 404);
    }

    const response: SuccessResponse<Product> = {
      success: true,
      data: mockProduct,
    };

    return c.json(response, 200);
  });

  return app;
}

// ============================================================================
// 4. ERROR HANDLING
// ============================================================================

/**
 * Create Hono application with complete error handling
 *
 * @example
 * ```typescript
 * const app = createProductAPIWithErrorHandling();
 * ```
 */
export function createProductAPIWithErrorHandling(): Hono {
  const app = createProductAPI();

  /**
   * Validation error middleware
   * Catches Zod validation errors and formats them consistently
   */
  app.onError((err, c) => {
    console.error('Error:', err);

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: {
            issues: err.message,
          },
        },
      };
      return c.json(errorResponse, 400);
    }

    // Handle generic errors
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: {
          message: err.message,
        },
      },
    };

    return c.json(errorResponse, 500);
  });

  /**
   * Not found handler
   */
  app.notFound((c) => {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: {
          path: c.req.path,
          method: c.req.method,
        },
      },
    };

    return c.json(errorResponse, 404);
  });

  return app;
}

// ============================================================================
// 5. TYPE SAFETY DEMONSTRATION
// ============================================================================

/**
 * Type-safe handler example with RO-RO pattern
 *
 * @param input - Request input
 * @returns Handler output
 *
 * @example
 * ```typescript
 * const result = await handleCreateProduct({
 *   body: createProductInput,
 * });
 * ```
 */
export async function handleCreateProduct(input: {
  body: CreateProductInput;
}): Promise<SuccessResponse<Product>> {
  const { body } = input;

  // Type-safe product creation
  const product: Product = {
    id: crypto.randomUUID(),
    name: body.name,
    description: body.description,
    price: body.price,
    category: body.category,
    stock: body.stock,
    images: body.images,
    tags: body.tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Type-safe response
  return {
    success: true,
    data: product,
  };
}

/**
 * Type-safe error handler with RO-RO pattern
 *
 * @param input - Error input
 * @returns Error response
 *
 * @example
 * ```typescript
 * const errorResponse = handleError({
 *   code: 'NOT_FOUND',
 *   message: 'Product not found',
 *   details: { productId: '123' },
 * });
 * ```
 */
export function handleError(input: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}): ErrorResponse {
  const { code, message, details } = input;

  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// Export configured app
export const app = createProductAPIWithErrorHandling();
