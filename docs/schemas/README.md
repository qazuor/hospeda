# 📖 Schema Implementation Guide

> **Last Updated**: October 17, 2025  
> **For**: Hospeda Monorepo Developers  
> **Purpose**: Complete guide for working with @repo/schemas  

## 🎯 Overview

This guide covers how to create, use, and maintain schemas in the Hospeda monorepo. All schemas are centralized in `@repo/schemas` as the single source of truth.

## 🏗️ Architecture

### Core Principles

1. **Single Source of Truth**: `@repo/schemas` is authoritative for all validation
2. **Flat Pattern**: All entity filters use flat structure (no nested objects)
3. **HTTP ↔ Domain Separation**: Clear distinction between HTTP and domain schemas
4. **Type Safety**: Compile-time validation with TypeScript
5. **Reusability**: Compose schemas using `pick()`, `omit()`, `extend()`, `merge()`

### Schema Types

Every entity has 4 schema files:

```
packages/schemas/src/entities/[entity]/
├── [entity].schema.ts        # Core domain schema
├── [entity].crud.schema.ts   # CRUD operations (create, update, delete)
├── [entity].query.schema.ts  # Search/filtering (flat pattern)
└── [entity].http.schema.ts   # HTTP-specific (query coercion, conversion functions)
```

## 📋 Entity Schema Structure

### 1. Domain Schema (`[entity].schema.ts`)

The main entity definition:

```typescript
import { z } from 'zod';
import { UuidSchema, BaseAuditSchema } from '../../common/base.schema.js';

/**
 * Main entity domain schema
 * Complete definition with all fields and validation rules
 */
export const EntitySchema = z.object({
    id: UuidSchema,
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    isActive: z.boolean().default(true),
    ...BaseAuditSchema.shape
});

export type Entity = z.infer<typeof EntitySchema>;
```

### 2. CRUD Schema (`[entity].crud.schema.ts`)

Create, update, and delete operations:

```typescript
import { z } from 'zod';
import { EntitySchema } from './entity.schema.js';

/**
 * Entity creation input schema
 * Omits auto-generated fields (id, timestamps)
 */
export const EntityCreateInputSchema = EntitySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true
});

export type EntityCreateInput = z.infer<typeof EntityCreateInputSchema>;

/**
 * Entity update input schema
 * All fields optional for partial updates
 */
export const EntityUpdateInputSchema = EntityCreateInputSchema.partial();

export type EntityUpdateInput = z.infer<typeof EntityUpdateInputSchema>;
```

### 3. Query Schema (`[entity].query.schema.ts`)

Search and filtering (FLAT pattern):

```typescript
import { z } from 'zod';
import { BaseSearchSchema } from '../../common/base.schema.js';

/**
 * Entity search schema (FLAT pattern)
 * All filters at top level for HTTP compatibility
 */
export const EntitySearchSchema = BaseSearchSchema.extend({
    // Text search
    name: z.string().optional(),
    slug: z.string().optional(),
    
    // Boolean filters
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    
    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    
    // Relationship filters
    categoryId: UuidSchema.optional(),
    ownerId: UuidSchema.optional()
});

export type EntitySearch = z.infer<typeof EntitySearchSchema>;
```

### 4. HTTP Schema (`[entity].http.schema.ts`)

HTTP-specific coercion and conversion:

```typescript
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';

/**
 * HTTP search schema with query string coercion
 * Maps 1:1 with domain search but handles string → type conversion
 */
export const EntitySearchHttpSchema = BaseHttpSearchSchema.extend({
    name: z.string().optional(),
    slug: z.string().optional(),
    isActive: createBooleanQueryParam('Filter by active status'),
    isFeatured: createBooleanQueryParam('Filter by featured status'),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    categoryId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional()
});

export type EntitySearchHttp = z.infer<typeof EntitySearchHttpSchema>;

/**
 * HTTP to Domain conversion function
 * REQUIRED: Maps all HTTP fields to domain fields
 */
export const httpToDomainEntitySearch = (httpParams: EntitySearchHttp): EntitySearch => ({
    // Base pagination/sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,
    
    // Entity-specific filters
    name: httpParams.name,
    slug: httpParams.slug,
    isActive: httpParams.isActive,
    isFeatured: httpParams.isFeatured,
    createdAfter: httpParams.createdAfter,
    createdBefore: httpParams.createdBefore,
    categoryId: httpParams.categoryId,
    ownerId: httpParams.ownerId
});
```

## 🔧 Implementation Patterns

### Adding New Entity

1. **Create directory structure**:

   ```bash
   mkdir packages/schemas/src/entities/newEntity
   cd packages/schemas/src/entities/newEntity
   ```

2. **Create all 4 schema files** following the templates above

3. **Add to barrel exports**:

   ```typescript
   // packages/schemas/src/entities/newEntity/index.ts
   export * from './newEntity.schema.js';
   export * from './newEntity.crud.schema.js';
   export * from './newEntity.query.schema.js';
   export * from './newEntity.http.schema.js';
   
   // packages/schemas/src/entities/index.ts
   export * from './newEntity/index.js';
   ```

4. **Test the schemas**:

   ```bash
   pnpm test --filter=@repo/schemas
   pnpm build --filter=@repo/schemas
   ```

### API Route Integration

Use schemas in API routes:

```typescript
// apps/api/src/routes/entity/list.ts
import { EntitySearchHttpSchema, EntityListItemSchema } from '@repo/schemas';
import { createListRoute } from '../../utils/route-factory';

export const entityListRoute = createListRoute({
    method: 'get',
    path: '/entities',
    summary: 'List entities',
    tags: ['Entities'],
    requestQuery: EntitySearchHttpSchema.shape,  // ✅ Use .shape for route factory
    responseSchema: EntityListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        // Handler implementation
    }
});
```

### Service Layer Integration

Use conversion functions in services:

```typescript
// packages/service-core/src/services/entity/entity.service.ts
import { httpToDomainEntitySearch } from '@repo/schemas';

export class EntityService extends BaseCrudService {
    async search(actor: Actor, httpParams: EntitySearchHttp) {
        // Convert HTTP params to domain params
        const domainParams = httpToDomainEntitySearch(httpParams);
        
        // Use domain params in repository layer
        return await this.model.findAll(domainParams);
    }
}
```

## 🧪 Testing Schemas

### Unit Tests

Create comprehensive tests:

```typescript
// packages/schemas/test/entities/entity/entity.schema.test.ts
import { describe, it, expect } from 'vitest';
import { EntitySchema, EntitySearchSchema } from '../../../src/entities/entity';

describe('EntitySchema', () => {
    it('should validate valid entity', () => {
        const validEntity = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test Entity',
            slug: 'test-entity',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        expect(() => EntitySchema.parse(validEntity)).not.toThrow();
    });
    
    it('should reject invalid entity', () => {
        const invalidEntity = {
            id: 'invalid-uuid',
            name: '',  // Too short
            isActive: 'not-boolean'
        };
        
        expect(() => EntitySchema.parse(invalidEntity)).toThrow();
    });
});
```

### HTTP Conversion Tests

Test conversion functions:

```typescript
describe('httpToDomainEntitySearch', () => {
    it('should convert all HTTP fields to domain fields', () => {
        const httpParams = {
            page: 1,
            pageSize: 20,
            isActive: true,
            name: 'test'
        };
        
        const domainParams = httpToDomainEntitySearch(httpParams);
        
        expect(domainParams.page).toBe(1);
        expect(domainParams.isActive).toBe(true);
        expect(domainParams.name).toBe('test');
    });
});
```

## ⚠️ Common Pitfalls

### 1. Nested vs Flat Patterns

❌ **Wrong** (nested):

```typescript
export const EntitySearchSchema = BaseSearchSchema.extend({
    filters: z.object({
        isActive: z.boolean().optional(),
        category: z.string().optional()
    }).optional()
});
```

✅ **Correct** (flat):

```typescript
export const EntitySearchSchema = BaseSearchSchema.extend({
    isActive: z.boolean().optional(),
    category: z.string().optional()
});
```

### 2. Missing HTTP Conversion

❌ **Wrong** (no conversion function):

```typescript
// Using HTTP schema directly in service
const result = await entityService.search(httpParams);
```

✅ **Correct** (with conversion):

```typescript
// Convert HTTP to domain first
const domainParams = httpToDomainEntitySearch(httpParams);
const result = await entityService.search(domainParams);
```

### 3. Inline Schemas in Routes

❌ **Wrong** (inline schema):

```typescript
requestQuery: HttpPaginationSchema.extend({
    isActive: z.boolean().optional()
}).shape
```

✅ **Correct** (predefined schema):

```typescript
requestQuery: EntitySearchHttpSchema.shape
```

## 🔧 Utilities and Helpers

### Base Schemas

Common schemas available for reuse:

```typescript
import {
    UuidSchema,           // UUID validation
    BaseAuditSchema,      // createdAt, updatedAt, deletedAt
    BaseSearchSchema,     // page, pageSize, sortBy, sortOrder, q
    BaseHttpSearchSchema  // HTTP version with coercion
} from '@repo/schemas';
```

### HTTP Field Factories

Helper functions for HTTP schemas:

```typescript
import {
    createBooleanQueryParam,  // Converts string → boolean
    createArrayQueryParam,    // Converts comma-separated → array
    createNumberQueryParam    // Converts string → number
} from '@repo/schemas';

// Usage:
export const MyHttpSchema = z.object({
    isActive: createBooleanQueryParam('Filter by active status'),
    tags: createArrayQueryParam(z.string(), 'Filter by tags'),
    minPrice: createNumberQueryParam('Minimum price filter')
});
```

### OpenAPI Metadata

Add rich documentation:

```typescript
export const EntitySchema = z.object({
    name: z.string()
        .min(1, { message: 'validation.entity.name.required' })
        .max(100, { message: 'validation.entity.name.too_long' })
        .describe('Entity name (required, 1-100 characters)')
});
```

## 🚀 Best Practices

### 1. Schema Composition

Reuse existing schemas:

```typescript
// ✅ Good: Reuse and extend
export const EntityWithOwnerSchema = EntitySchema.extend({
    owner: UserSchema.pick({ id: true, name: true, email: true })
});

// ✅ Good: Partial updates
export const EntityPatchSchema = EntityCreateInputSchema.partial();
```

### 2. Error Messages

Use i18n keys for error messages:

```typescript
export const EntitySchema = z.object({
    email: z.string()
        .email({ message: 'validation.entity.email.invalid' })
        .describe('Entity email address')
});
```

### 3. Enum Consistency

Always use enum schemas:

```typescript
// ✅ Good: Use enum schema
import { LifecycleStatusEnumSchema } from '../../enums';

export const EntitySchema = z.object({
    status: LifecycleStatusEnumSchema.default('ACTIVE')
});

// ❌ Bad: Hardcode values
export const EntitySchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});
```

## 🔄 Migration and Maintenance

### Updating Existing Schemas

1. **Analyze impact**: Check all usages before changes
2. **Backward compatibility**: Use `.optional()` for new fields
3. **Test thoroughly**: Update tests and run full test suite
4. **Update conversion functions**: Ensure HTTP↔Domain mapping is complete

### Schema Versioning

For breaking changes:

```typescript
// Create new version alongside old
export const EntitySchemaV2 = EntitySchema.extend({
    newRequiredField: z.string()
});

// Deprecate old version
/** @deprecated Use EntitySchemaV2 */
export const EntitySchema = EntitySchemaV1;
```

## 📚 Reference

### Key Files

- `packages/schemas/src/common/base.schema.ts` - Base schemas and utilities
- `packages/schemas/src/api/http/base-http.schema.ts` - HTTP coercion helpers
- `packages/schemas/src/utils/openapi.utils.ts` - OpenAPI metadata tools
- `packages/schemas/src/enums/` - All enum schemas

### Commands

```bash
# Build schemas
pnpm build --filter=@repo/schemas

# Test schemas
pnpm test --filter=@repo/schemas

# Check for inline schemas
grep -r "z\.object\|\.extend(" apps/

# Validate migration completion
pnpm build && pnpm test
```

## 💡 Need Help?

1. **Check existing entities**: Look at `accommodation`, `user`, or `feature` for examples
2. **Review tests**: `packages/schemas/test/entities/` for test patterns
3. **Check build errors**: TypeScript will catch schema inconsistencies
4. **Run validation**: Use the provided scripts to verify implementation
