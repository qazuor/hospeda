# Creating Endpoints

Step-by-step tutorial for creating new API endpoints.

---

## Overview

This guide walks you through creating a complete CRUD endpoint for a new entity, following Hospeda's architecture patterns.

**Time**: ~30 minutes  
**Prerequisites**: Local environment setup

---

## The Entity Creation Flow

```text
1. Define Zod Schema (@repo/schemas)
   ↓
2. Create Database Schema (@repo/db/schemas)
   ↓
3. Generate & Run Migration
   ↓
4. Create Model (@repo/db/models)
   ↓
5. Create Service (@repo/service-core)
   ↓
6. Create Routes (apps/api/routes)
   ↓
7. Register Routes
   ↓
8. Test Endpoints
```

---

## Step 1: Define Zod Schema

**File**: `packages/schemas/src/entities/product/product.schema.ts`

```typescript
import { z } from 'zod';
import { auditFieldsSchema } from '../../common/audit.schema';

// Base product schema
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  isActive: z.boolean().default(true),
  ...auditFieldsSchema.shape
});

// Create schema (no id, no audit fields)
export const createProductSchema = productSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true
});

// Update schema (all fields optional except id)
export const updateProductSchema = productSchema
  .partial()
  .required({ id: true });

// Search/filter schema
export const searchProductSchema = z.object({
  name: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  isActive: z.boolean().optional()
});

// Infer types from schemas
export type Product = z.infer<typeof productSchema>;
export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type SearchProduct = z.infer<typeof searchProductSchema>;
```

**File**: `packages/schemas/src/entities/product/index.ts`

```typescript
export * from './product.schema';
export * from './product.crud.schema';
```

---

## Step 2: Create Database Schema

**File**: `packages/db/src/schemas/product.dbschema.ts`

```typescript
import { pgTable, text, numeric, integer, boolean } from 'drizzle-orm/pg-core';
import { auditFields } from '../common/audit.fields';

export const products = pgTable('products', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...auditFields
});
```

**Add to barrel export** (`packages/db/src/schemas/index.ts`):

```typescript
export * from './product.dbschema';
```

---

## Step 3: Generate & Run Migration

```bash
# Generate migration
pnpm db:generate

# Review generated SQL in drizzle/ folder

# Run migration
pnpm db:migrate

# Verify in Drizzle Studio
pnpm db:studio
```

---

## Step 4: Create Model

**File**: `packages/db/src/models/product.model.ts`

```typescript
import { BaseModel } from '../base/base.model';
import { products } from '../schemas/product.dbschema';
import type { Product } from '@repo/schemas';

export class ProductModel extends BaseModel<typeof products> {
  constructor() {
    super({
      table: products,
      entityName: 'product'
    });
  }

  // Add custom methods if needed
  async findByPriceRange(params: {
    minPrice: number;
    maxPrice: number;
  }): Promise<Product[]> {
    const { minPrice, maxPrice } = params;
    
    return this.db
      .select()
      .from(this.table)
      .where(
        and(
          gte(this.table.price, minPrice.toString()),
          lte(this.table.price, maxPrice.toString())
        )
      )
      .execute();
  }
}
```

**Add to barrel export** (`packages/db/src/models/index.ts`):

```typescript
export * from './product.model';
```

---

## Step 5: Create Service

**File**: `packages/service-core/src/services/product/product.service.ts`

```typescript
import { BaseCrudService } from '../base/base-crud.service';
import { ProductModel } from '@repo/db';
import type {
  Product,
  CreateProduct,
  UpdateProduct,
  SearchProduct
} from '@repo/schemas';
import type { ServiceResult } from '../../types/service-result';

export class ProductService extends BaseCrudService<
  Product,
  CreateProduct,
  UpdateProduct,
  SearchProduct
> {
  protected model: ProductModel;

  constructor(context?: any) {
    const model = new ProductModel();
    super(model);
    this.model = model;
  }

  // Add custom business logic methods
  async adjustStock(params: {
    id: string;
    quantity: number;
  }): Promise<ServiceResult<Product>> {
    try {
      const product = await this.findById({ id: params.id });
      
      if (!product.success) {
        return product;
      }

      const newStock = product.data.stock + params.quantity;
      
      if (newStock < 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Insufficient stock'
          }
        };
      }

      return this.update({
        id: params.id,
        stock: newStock
      });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
```

**Add to barrel export** (`packages/service-core/src/services/index.ts`):

```typescript
export * from './product/product.service';
```

---

## Step 6: Create Routes

### Create route folder

```bash
mkdir -p apps/api/src/routes/product
```

### List Route

**File**: `apps/api/src/routes/product/list.ts`

```typescript
import { createListRoute } from '../../utils/route-factory';
import { ProductService } from '@repo/service-core';
import { productSchema, searchProductSchema } from '@repo/schemas';
import { z } from 'zod';

export const listProductsRoute = createListRoute({
  method: 'get',
  path: '/',
  summary: 'List products',
  description: 'Returns paginated list of products',
  tags: ['Products'],
  querySchema: searchProductSchema.optional(),
  responseSchema: z.array(productSchema),
  handler: async (c, params, body, query) => {
    const service = new ProductService(c);
    const result = await service.findAll(query);

    return {
      data: result.data,
      pagination: result.pagination
    };
  },
  options: { skipAuth: true } // Public endpoint
});
```

### Create Route

**File**: `apps/api/src/routes/product/create.ts`

```typescript
import { createOpenApiRoute } from '../../utils/route-factory';
import { ProductService } from '@repo/service-core';
import { createProductSchema, productSchema } from '@repo/schemas';

export const createProductRoute = createOpenApiRoute({
  method: 'post',
  path: '/',
  summary: 'Create product',
  description: 'Creates a new product',
  tags: ['Products'],
  requestBody: createProductSchema,
  responseSchema: productSchema,
  handler: async (c, params, body) => {
    const service = new ProductService(c);
    const result = await service.create(body);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  }
  // Auth required by default
});
```

### Get By ID Route

**File**: `apps/api/src/routes/product/getById.ts`

```typescript
import { createOpenApiRoute } from '../../utils/route-factory';
import { ProductService } from '@repo/service-core';
import { productSchema } from '@repo/schemas';
import { z } from 'zod';

export const getProductByIdRoute = createOpenApiRoute({
  method: 'get',
  path: '/:id',
  summary: 'Get product by ID',
  description: 'Returns a single product',
  tags: ['Products'],
  requestParams: {
    id: z.string().uuid()
  },
  responseSchema: productSchema,
  handler: async (c, params) => {
    const service = new ProductService(c);
    const result = await service.findById({ id: params.id });

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  },
  options: { skipAuth: true }
});
```

### Update Route

**File**: `apps/api/src/routes/product/update.ts`

```typescript
import { createOpenApiRoute } from '../../utils/route-factory';
import { ProductService } from '@repo/service-core';
import { updateProductSchema, productSchema } from '@repo/schemas';
import { z } from 'zod';

export const updateProductRoute = createOpenApiRoute({
  method: 'patch',
  path: '/:id',
  summary: 'Update product',
  description: 'Updates an existing product',
  tags: ['Products'],
  requestParams: {
    id: z.string().uuid()
  },
  requestBody: updateProductSchema.omit({ id: true }),
  responseSchema: productSchema,
  handler: async (c, params, body) => {
    const service = new ProductService(c);
    const result = await service.update({
      id: params.id,
      ...body
    });

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  }
});
```

### Delete Route

**File**: `apps/api/src/routes/product/delete.ts`

```typescript
import { createOpenApiRoute } from '../../utils/route-factory';
import { ProductService } from '@repo/service-core';
import { z } from 'zod';

export const deleteProductRoute = createOpenApiRoute({
  method: 'delete',
  path: '/:id',
  summary: 'Delete product',
  description: 'Soft deletes a product',
  tags: ['Products'],
  requestParams: {
    id: z.string().uuid()
  },
  responseSchema: z.object({
    id: z.string(),
    deletedAt: z.string()
  }),
  handler: async (c, params) => {
    const service = new ProductService(c);
    const result = await service.delete({ id: params.id });

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  }
});
```

### Index File (Register Routes)

**File**: `apps/api/src/routes/product/index.ts`

```typescript
import { createRouter } from '../../utils/create-app';
import { listProductsRoute } from './list';
import { createProductRoute } from './create';
import { getProductByIdRoute } from './getById';
import { updateProductRoute } from './update';
import { deleteProductRoute } from './delete';

const router = createRouter();

// Register routes
router.route('/', listProductsRoute);
router.route('/', createProductRoute);
router.route('/', getProductByIdRoute);
router.route('/', updateProductRoute);
router.route('/', deleteProductRoute);

export default router;
```

---

## Step 7: Register Routes in Main App

**File**: `apps/api/src/routes/index.ts`

```typescript
import type { Hono } from 'hono';
import productRoutes from './product';

export const registerRoutes = (app: Hono) => {
  // ... existing routes ...
  app.route('/api/v1/products', productRoutes);
};
```

---

## Step 8: Test Endpoints

### Start API

```bash
pnpm dev
```

### Test with cURL

```bash
# List products
curl http://localhost:3001/api/v1/products

# Create product (needs auth token)
curl -X POST http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":99.99,"stock":10}'

# Get by ID
curl http://localhost:3001/api/v1/products/PRODUCT_ID

# Update (needs auth token)
curl -X PATCH http://localhost:3001/api/v1/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":89.99}'

# Delete (needs auth token)
curl -X DELETE http://localhost:3001/api/v1/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test with Swagger UI

1. Visit <http://localhost:3001/ui>
2. Find "Products" section
3. Try out each endpoint

---

## Common Patterns

### Making an Endpoint Public

```typescript
options: { skipAuth: true }
```

### Adding Custom Validation

```typescript
requestBody: createProductSchema.refine(
  (data) => data.price > 0,
  { message: 'Price must be positive' }
)
```

### Custom Rate Limiting

```typescript
options: {
  customRateLimit: {
    requests: 5,
    windowMs: 60000
  }
}
```

### Response Caching

```typescript
options: {
  cacheTTL: 300 // 5 minutes
}
```

---

## Troubleshooting

### Error: Table not found

**Solution**: Run migrations:

```bash
pnpm db:migrate
```

### Error: Module not found

**Solution**: Rebuild packages:

```bash
pnpm build
```

### Error: Schema validation failed

**Solution**: Check schema definitions match between:

- `@repo/schemas` (Zod)
- `@repo/db/schemas` (Drizzle)

### Error: Service not working

**Solution**: Ensure barrel exports are updated:

- `packages/schemas/src/entities/product/index.ts`
- `packages/db/src/models/index.ts`
- `packages/service-core/src/services/index.ts`

---

## Next Steps

- [Route Factories Guide](route-factories.md) - Learn factory patterns in depth
- [Middleware System](middleware.md) - Add custom middleware
- [Actor System](actor-system.md) - Implement authorization
- [Testing Guide](../testing.md) - Write tests for your endpoints

---

⬅️ Back to [Development Guide](README.md)
