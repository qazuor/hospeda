# 🔧 Advanced Schema Patterns

> **For**: Advanced schema implementation patterns and edge cases  
> **Companion**: Read alongside main README.md  

## 🎯 Advanced Patterns

### Complex Validation Rules

#### Cross-Field Validation

```typescript
export const EntitySchema = z.object({
    startDate: z.date(),
    endDate: z.date(),
    isActive: z.boolean()
}).refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"]
});
```

#### Conditional Fields

```typescript
export const EntitySchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('BASIC'),
        name: z.string()
    }),
    z.object({
        type: z.literal('PREMIUM'),
        name: z.string(),
        premiumFeatures: z.array(z.string())
    })
]);
```

### Nested Object Handling

When domain requires nested but HTTP is flat:

```typescript
// Domain schema (nested for business logic)
export const EntitySchema = z.object({
    location: z.object({
        country: z.string(),
        city: z.string(),
        coordinates: z.object({
            lat: z.number(),
            lng: z.number()
        })
    })
});

// HTTP schema (flat for query params)
export const EntityHttpSchema = z.object({
    country: z.string().optional(),
    city: z.string().optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional()
});

// Conversion function handles the mapping
export const httpToDomainEntity = (http: EntityHttp): EntityCreateInput => ({
    location: {
        country: http.country || '',
        city: http.city || '',
        coordinates: {
            lat: http.latitude || 0,
            lng: http.longitude || 0
        }
    }
});
```

### Dynamic Schema Generation

For entities with configurable fields:

```typescript
export const createEntitySchema = (additionalFields: Record<string, z.ZodTypeAny>) => {
    return BaseEntitySchema.extend(additionalFields);
};

// Usage
const CustomEntitySchema = createEntitySchema({
    customField: z.string().optional(),
    metadata: z.record(z.string(), z.unknown())
});
```

## 🔧 Performance Optimization

### Lazy Schema Loading

For large schemas that aren't always needed:

```typescript
// Heavy schema that's only needed sometimes
const createHeavySchema = () => z.object({
    // Complex validation logic
});

let heavySchema: z.ZodTypeAny | null = null;

export const getHeavySchema = () => {
    if (!heavySchema) {
        heavySchema = createHeavySchema();
    }
    return heavySchema;
};
```

### Schema Caching

For computed schemas:

```typescript
const schemaCache = new Map<string, z.ZodTypeAny>();

export const getCachedSchema = (key: string, factory: () => z.ZodTypeAny) => {
    if (!schemaCache.has(key)) {
        schemaCache.set(key, factory());
    }
    return schemaCache.get(key)!;
};
```

## 🧪 Testing Advanced Patterns

### Property-Based Testing

```typescript
import { faker } from '@faker-js/faker';

const generateValidEntity = () => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    email: faker.internet.email(),
    isActive: faker.datatype.boolean()
});

describe('EntitySchema Property Tests', () => {
    it('should validate 100 random valid entities', () => {
        for (let i = 0; i < 100; i++) {
            const entity = generateValidEntity();
            expect(() => EntitySchema.parse(entity)).not.toThrow();
        }
    });
});
```

### Error Message Testing

```typescript
describe('EntitySchema Error Messages', () => {
    it('should provide i18n error keys', () => {
        try {
            EntitySchema.parse({ email: 'invalid-email' });
        } catch (error) {
            expect(error.errors[0].message).toBe('validation.entity.email.invalid');
        }
    });
});
```

## 🔄 Migration Strategies

### Gradual Schema Updates

When updating schemas without breaking existing code:

```typescript
// Step 1: Add optional field
export const EntitySchemaV1_1 = EntitySchema.extend({
    newField: z.string().optional()
});

// Step 2: Make field required (after data migration)
export const EntitySchemaV2 = EntitySchema.extend({
    newField: z.string()
});

// Step 3: Remove old version
export const EntitySchema = EntitySchemaV2;
```

### Schema Evolution

Track schema changes for API versioning:

```typescript
export const EntitySchemaVersions = {
    'v1.0': EntitySchemaV1,
    'v1.1': EntitySchemaV1_1,
    'v2.0': EntitySchemaV2
} as const;

export const getCurrentEntitySchema = (version: string = 'v2.0') => {
    return EntitySchemaVersions[version as keyof typeof EntitySchemaVersions];
};
```

## 🚀 Production Considerations

### Error Handling

Centralized error transformation:

```typescript
export const handleSchemaError = (error: z.ZodError, context: string) => {
    const transformedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        context
    }));
    
    return {
        type: 'VALIDATION_ERROR',
        errors: transformedErrors,
        timestamp: new Date().toISOString()
    };
};
```

### Performance Monitoring

Track schema validation performance:

```typescript
export const withSchemaMetrics = <T>(schema: z.ZodType<T>, name: string) => {
    return {
        parse: (data: unknown) => {
            const start = performance.now();
            try {
                const result = schema.parse(data);
                const duration = performance.now() - start;
                
                // Log metrics
                console.debug(`Schema ${name} validation: ${duration}ms`);
                
                return result;
            } catch (error) {
                const duration = performance.now() - start;
                console.warn(`Schema ${name} validation failed: ${duration}ms`);
                throw error;
            }
        },
        safeParse: (data: unknown) => {
            const start = performance.now();
            const result = schema.safeParse(data);
            const duration = performance.now() - start;
            
            console.debug(`Schema ${name} safe validation: ${duration}ms, success: ${result.success}`);
            
            return result;
        }
    };
};
```

### Memory Management

For high-throughput scenarios:

```typescript
// Reuse schema instances
const ENTITY_SCHEMA = EntitySchema;
const ENTITY_CREATE_SCHEMA = EntityCreateInputSchema;

// Use .safeParse() for non-throwing validation
const validateEntity = (data: unknown) => {
    const result = ENTITY_SCHEMA.safeParse(data);
    if (!result.success) {
        return { error: result.error, data: null };
    }
    return { error: null, data: result.data };
};
```

## 📊 Schema Analytics

### Validation Success Rates

Track which fields fail validation most often:

```typescript
interface ValidationStats {
    totalValidations: number;
    successfulValidations: number;
    fieldErrors: Record<string, number>;
}

const schemaStats = new Map<string, ValidationStats>();

export const trackValidation = (schemaName: string, result: z.SafeParseReturnType<any, any>) => {
    const stats = schemaStats.get(schemaName) || {
        totalValidations: 0,
        successfulValidations: 0,
        fieldErrors: {}
    };
    
    stats.totalValidations++;
    
    if (result.success) {
        stats.successfulValidations++;
    } else {
        result.error.errors.forEach(err => {
            const field = err.path.join('.');
            stats.fieldErrors[field] = (stats.fieldErrors[field] || 0) + 1;
        });
    }
    
    schemaStats.set(schemaName, stats);
};
```

## 🛡️ Security Considerations

### Input Sanitization

Combine with sanitization for user input:

```typescript
import DOMPurify from 'dompurify';

export const SanitizedStringSchema = z.string().transform((val) => {
    return DOMPurify.sanitize(val);
});

export const EntitySchema = z.object({
    name: SanitizedStringSchema.min(1).max(100),
    description: SanitizedStringSchema.max(1000).optional()
});
```

### Rate Limiting by Schema

Different limits for different operations:

```typescript
const SCHEMA_RATE_LIMITS = {
    'user-create': { requests: 5, window: '1m' },
    'user-update': { requests: 20, window: '1m' },
    'user-search': { requests: 100, window: '1m' }
} as const;

export const getSchemaRateLimit = (schemaName: string) => {
    return SCHEMA_RATE_LIMITS[schemaName as keyof typeof SCHEMA_RATE_LIMITS];
};
```

## 🔍 Debugging

### Schema Introspection

Analyze schema structure at runtime:

```typescript
export const analyzeSchema = (schema: z.ZodTypeAny, path: string = '') => {
    const analysis = {
        type: schema._def.typeName,
        path,
        required: true,
        children: [] as any[]
    };
    
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        for (const [key, childSchema] of Object.entries(shape)) {
            analysis.children.push(analyzeSchema(childSchema as z.ZodTypeAny, `${path}.${key}`));
        }
    }
    
    if (schema instanceof z.ZodOptional) {
        analysis.required = false;
        analysis.children.push(analyzeSchema(schema._def.innerType, path));
    }
    
    return analysis;
};

// Usage
const entityAnalysis = analyzeSchema(EntitySchema);
console.log(JSON.stringify(entityAnalysis, null, 2));
```

### Validation Debugging

Detailed error reporting:

```typescript
export const debugValidation = (schema: z.ZodTypeAny, data: unknown, context: string = '') => {
    const result = schema.safeParse(data);
    
    if (!result.success) {
        console.group(`🔍 Validation Debug: ${context}`);
        console.log('📥 Input data:', data);
        console.log('📋 Schema:', schema._def);
        console.log('❌ Errors:', result.error.errors);
        
        result.error.errors.forEach((err, index) => {
            console.group(`Error ${index + 1}:`);
            console.log('Path:', err.path);
            console.log('Message:', err.message);
            console.log('Code:', err.code);
            console.log('Received:', err.received);
            console.groupEnd();
        });
        
        console.groupEnd();
    }
    
    return result;
};
```

This covers the advanced patterns and considerations for working with schemas in production environments.
