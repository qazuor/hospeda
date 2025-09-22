# Adding New Services to Hospeda

This guide walks you through adding a new service to the Hospeda service layer architecture.

## 📋 Prerequisites

- Understanding of the [Architecture Overview](../architecture/README.md)
- Familiarity with TypeScript and Zod
- Knowledge of the [Development Patterns](./patterns.md)

## 🛠️ Step-by-Step Process

### 1. Define Types (`packages/types/src/{entity}/`)

Create the TypeScript types for your entity:

```typescript
// packages/types/src/example/example.types.ts
export type Example = {
    id: string;
    name: string;
    description: string;
    // ... other fields
    createdAt: Date;
    updatedAt: Date;
};

export type ExampleCreateInput = Omit<Example, 'id' | 'createdAt' | 'updatedAt'>;
export type ExampleUpdateInput = Partial<ExampleCreateInput>;
```

Update the main export:
```typescript
// packages/types/src/index.ts
export * from './example/example.types.js';
```

### 2. Create Zod Schemas (`packages/schemas/src/{entity}/`)

Define validation schemas:

```typescript
// packages/schemas/src/entities/example/example.schema.ts
import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ExampleIdSchema } from '../../common/id.schema.js';

export const ExampleSchema = z.object({
    id: ExampleIdSchema,
    ...BaseAuditFields,
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(500),
    // ... other fields
});

export type Example = z.infer<typeof ExampleSchema>;
```

Create CRUD schemas:
```typescript
// packages/schemas/src/entities/example/example.crud.schema.ts
import { ExampleSchema } from './example.schema.js';

export const ExampleCreateInputSchema = ExampleSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    // ... other auto-generated fields
});

export const ExampleUpdateInputSchema = ExampleCreateInputSchema.partial();

export type ExampleCreateInput = z.infer<typeof ExampleCreateInputSchema>;
export type ExampleUpdateInput = z.infer<typeof ExampleUpdateInputSchema>;
```

Update schema exports:
```typescript
// packages/schemas/src/entities/example/index.ts
export * from './example.schema.js';
export * from './example.crud.schema.js';
export * from './example.query.schema.js';

// packages/schemas/src/entities/index.ts
export * from './example/index.js';
```

### 3. Add Database Schema (`packages/db/src/schemas/{entity}/`)

Define the database table:

```typescript
// packages/db/src/schemas/example/example.schema.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const exampleTable = pgTable('examples', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    // ... other fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ExampleRow = typeof exampleTable.$inferSelect;
export type ExampleInsert = typeof exampleTable.$inferInsert;
```

Update database exports:
```typescript
// packages/db/src/schemas/index.ts
export * from './example/example.schema.js';
```

### 4. Create Database Model (`packages/db/src/models/`)

Implement the data access layer:

```typescript
// packages/db/src/models/example.model.ts
import type { Example, ExampleCreateInput, ExampleUpdateInput } from '@repo/schemas';
import { BaseModel } from './base.model.js';
import { exampleTable } from '../schemas/example/example.schema.js';

export class ExampleModel extends BaseModel<Example> {
    protected table = exampleTable;
    protected entityName = 'example';

    // Override findAll for custom search logic
    async findAll(options: { q?: string; page?: number; pageSize?: number } = {}) {
        const { q, ...paginationOptions } = options;
        
        let query = this.db.select().from(this.table);
        
        if (q) {
            query = query.where(
                or(
                    ilike(this.table.name, `%${q}%`),
                    ilike(this.table.description, `%${q}%`)
                )
            );
        }
        
        return this.applyPagination(query, paginationOptions);
    }
}
```

Update model exports:
```typescript
// packages/db/src/models/index.ts
export * from './example.model.js';
```

### 5. Create Service (`packages/service-core/src/services/`)

Implement the business logic:

```typescript
// packages/service-core/src/services/example/example.service.ts
import type { 
    Example, 
    ExampleCreateInput, 
    ExampleUpdateInput,
    ExampleSearchInput 
} from '@repo/schemas';
import { BaseCrudService } from '../base-crud.service.js';
import { ExampleModel } from '@repo/db';
import type { ServiceContext } from '../types.js';

export class ExampleService extends BaseCrudService<
    Example,
    ExampleModel,
    ExampleCreateInput,
    ExampleUpdateInput,
    ExampleSearchInput
> {
    constructor(ctx: ServiceContext, model?: ExampleModel) {
        super(ctx, model || new ExampleModel(ctx.db));
    }

    // Add custom business logic here
    async getByCategory(category: string): Promise<Example[]> {
        return this.runWithLoggingAndValidation(
            'getByCategory',
            { category },
            async () => {
                // Custom business logic
                return this.model.findAll({ 
                    where: { category } 
                });
            }
        );
    }
}
```

Update service exports:
```typescript
// packages/service-core/src/services/index.ts
export * from './example/example.service.js';
```

### 6. Create API Routes (`apps/api/src/routes/`)

Create the HTTP endpoints:

```typescript
// apps/api/src/routes/example/index.ts
import { createCRUDRoute, createListRoute } from '../../lib/route-factory.js';
import { ExampleService } from '@repo/service-core';
import { 
    ExampleCreateInputSchema,
    ExampleUpdateInputSchema,
    ExampleSearchSchema
} from '@repo/schemas';

// CRUD routes
export const exampleCRUDRoute = createCRUDRoute({
    service: ExampleService,
    schemas: {
        create: ExampleCreateInputSchema,
        update: ExampleUpdateInputSchema
    },
    permissions: {
        create: ['EXAMPLE_CREATE'],
        read: ['EXAMPLE_READ'],
        update: ['EXAMPLE_UPDATE'],
        delete: ['EXAMPLE_DELETE']
    }
});

// List/search routes
export const exampleListRoute = createListRoute({
    service: ExampleService,
    schema: ExampleSearchSchema,
    permissions: {
        list: ['EXAMPLE_READ']
    }
});
```

Register routes in the main app:
```typescript
// apps/api/src/index.ts
import { exampleCRUDRoute, exampleListRoute } from './routes/example/index.js';

// Register routes
app.route('/examples', exampleListRoute);
app.route('/examples', exampleCRUDRoute);
```

### 7. Create Test Factory (`packages/service-core/test/factories/`)

Create mock data generators:

```typescript
// packages/service-core/test/factories/exampleFactory.ts
import type { Example, ExampleCreateInput, ExampleUpdateInput } from '@repo/schemas';
import { getMockId } from './utilsFactory';

const baseExample: Example = {
    id: getMockId('example'),
    name: 'Mock Example',
    description: 'A mock example for testing',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user'),
    updatedById: getMockId('user'),
};

export const createMockExample = (overrides: Partial<Example> = {}): Example => ({
    ...baseExample,
    id: getMockId('example'),
    ...overrides
});

export const createMockExampleCreateInput = (
    overrides: Partial<ExampleCreateInput> = {}
): ExampleCreateInput => ({
    name: 'New Example',
    description: 'A new example for testing',
    ...overrides
});

export const createMockExampleUpdateInput = (
    overrides: Partial<ExampleUpdateInput> = {}
): ExampleUpdateInput => ({
    name: 'Updated Example',
    ...overrides
});
```

### 8. Write Tests

Create comprehensive tests:

```typescript
// packages/service-core/test/services/example/create.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleService } from '../../../src/services/example/example.service.js';
import { createMockExampleCreateInput } from '../../factories/exampleFactory.js';
import { createServiceTestInstance } from '../../utils/test-utils.js';

describe('ExampleService.create', () => {
    let service: ExampleService;

    beforeEach(() => {
        service = createServiceTestInstance(ExampleService);
    });

    it('should create an example successfully', async () => {
        const input = createMockExampleCreateInput();
        const result = await service.create(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject(input);
    });

    // Add more test cases...
});
```

## 🧪 Testing Your Service

### 1. Run Unit Tests
```bash
# Test specific service
pnpm test --filter=service-core -- example

# Test all services
pnpm test --filter=service-core
```

### 2. Test API Endpoints
```bash
# Start the API
pnpm dev --filter=api

# Test with curl or your preferred HTTP client
curl -X POST http://localhost:3000/examples \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Example", "description": "Testing the API"}'
```

### 3. Database Migration
```bash
# Generate migration for new table
pnpm db:generate

# Apply migration
pnpm db:migrate
```

## 📝 Best Practices

### Type Safety
- Always use named exports
- Define explicit input/output types for all functions
- Leverage Zod for runtime validation

### Error Handling
- Use `ServiceError` with appropriate `ServiceErrorCode`
- Wrap business logic with `runWithLoggingAndValidation`
- Return standardized `{ success, data?, error? }` responses

### Testing
- Test both success and error cases
- Use factories for consistent mock data
- Mock external dependencies

### Performance
- Implement proper pagination in `findAll`
- Add database indexes for search fields
- Consider caching for read-heavy operations

## 🔍 Common Patterns

### Search Implementation
```typescript
async findAll(options: ExampleSearchOptions = {}) {
    const { q, category, ...paginationOptions } = options;
    
    let query = this.db.select().from(this.table);
    
    if (q) {
        query = query.where(
            or(
                ilike(this.table.name, `%${q}%`),
                ilike(this.table.description, `%${q}%`)
            )
        );
    }
    
    if (category) {
        query = query.where(eq(this.table.category, category));
    }
    
    return this.applyPagination(query, paginationOptions);
}
```

### Custom Validation
```typescript
async create(input: ExampleCreateInput): Promise<ServiceResponse<Example>> {
    return this.runWithLoggingAndValidation(
        'create',
        input,
        async () => {
            // Custom validation
            if (await this.nameExists(input.name)) {
                throw new ServiceError(
                    ServiceErrorCode.DUPLICATE_RESOURCE,
                    'Example name already exists'
                );
            }
            
            return super.create(input);
        }
    );
}
```

### Permission Checks
```typescript
async update(id: string, input: ExampleUpdateInput): Promise<ServiceResponse<Example>> {
    return this.runWithLoggingAndValidation(
        'update',
        { id, input },
        async () => {
            const existing = await this.findById(id);
            
            // Check ownership or admin permissions
            if (existing.ownerId !== this.ctx.actor.id && 
                !this.ctx.actor.permissions.includes('EXAMPLE_UPDATE_ALL')) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Not authorized to update this example'
                );
            }
            
            return super.update(id, input);
        }
    );
}
```

## 🚀 Next Steps

After implementing your service:

1. **Add to API Documentation**: Update `/docs/api/service-catalog.md`
2. **Update Architecture Docs**: Document any new patterns in `/docs/architecture/`
3. **Add Integration Tests**: Test the full API flow
4. **Consider Caching**: Implement Redis caching if needed
5. **Monitor Performance**: Add logging and metrics

## 📚 Additional Resources

- [Development Patterns](./patterns.md)
- [Testing Guide](./testing.md)
- [API Documentation](../api/service-catalog.md)
- [Architecture Overview](../architecture/README.md)