# 📚 Schema Examples

> **Real-world examples** from the Hospeda codebase  
> **Purpose**: Concrete implementation examples for reference  

## 🏠 Accommodation Entity Example

Complete example showing all 4 schema files for a complex entity:

### 1. Domain Schema

```typescript
// packages/schemas/src/entities/accommodation/accommodation.schema.ts

import { z } from 'zod';
import { UuidSchema, BaseAuditSchema } from '../../common/base.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/accommodation-type.enum.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.enum.js';

/**
 * Main accommodation domain schema
 * Represents a place where guests can stay
 */
export const AccommodationSchema = z.object({
    id: UuidSchema,
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    
    // Type and status
    type: AccommodationTypeEnumSchema,
    lifecycleState: LifecycleStatusEnumSchema.default('ACTIVE'),
    
    // Pricing (nested object)
    price: z.object({
        price: z.number().min(0),
        currency: z.string().length(3)
    }),
    
    // Location (nested object)
    location: z.object({
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string(),
        coordinates: z.object({
            lat: z.string(),
            long: z.string()
        })
    }),
    
    // Extra info (nested object)
    extraInfo: z.object({
        capacity: z.number().int().min(1),
        minNights: z.number().int().min(1),
        bedrooms: z.number().int().min(0),
        bathrooms: z.number().int().min(0),
        smokingAllowed: z.boolean(),
        extraInfo: z.array(z.string())
    }),
    
    // Relationships
    destinationId: UuidSchema,
    ownerId: UuidSchema,
    
    // Features
    isFeatured: z.boolean().default(false),
    
    // Stats
    reviewsCount: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0),
    
    ...BaseAuditSchema.shape
});

export type Accommodation = z.infer<typeof AccommodationSchema>;
```

### 2. CRUD Schema

```typescript
// packages/schemas/src/entities/accommodation/accommodation.crud.schema.ts

import { z } from 'zod';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * Accommodation creation input
 * Omits auto-generated fields and allows flattened input
 */
export const AccommodationCreateInputSchema = z.object({
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(200).optional(), // Auto-generated if not provided
    description: z.string().max(5000).optional(),
    type: AccommodationSchema.shape.type,
    
    // Flattened pricing for easier HTTP input
    basePrice: z.number().min(0),
    currency: z.string().length(3),
    
    // Flattened location for easier HTTP input
    latitude: z.number(),
    longitude: z.number(),
    
    // Flattened extra info
    maxGuests: z.number().int().min(1),
    bedrooms: z.number().int().min(0),
    bathrooms: z.number().int().min(0),
    
    // Relationships
    destinationId: AccommodationSchema.shape.destinationId,
    hostId: AccommodationSchema.shape.ownerId, // Note: hostId → ownerId mapping
    
    // Optional features
    isFeatured: z.boolean().optional()
});

export type AccommodationCreateInput = z.infer<typeof AccommodationCreateInputSchema>;

/**
 * Accommodation update input (all fields optional)
 */
export const AccommodationUpdateInputSchema = AccommodationCreateInputSchema.partial();

export type AccommodationUpdateInput = z.infer<typeof AccommodationUpdateInputSchema>;
```

### 3. Query Schema (Flat Pattern)

```typescript
// packages/schemas/src/entities/accommodation/accommodation.query.schema.ts

import { z } from 'zod';
import { BaseSearchSchema } from '../../common/base.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/accommodation-type.enum.js';

/**
 * Accommodation search schema using FLAT pattern
 * All filters at top level for HTTP compatibility
 */
export const AccommodationSearchSchema = BaseSearchSchema.extend({
    // Text search
    name: z.string().optional(),
    
    // Type filters
    type: AccommodationTypeEnumSchema.optional(),
    
    // Boolean filters
    isFeatured: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    
    // Price filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    
    // Capacity filters
    minGuests: z.number().int().min(1).optional(),
    maxGuests: z.number().int().min(1).optional(),
    
    // Location filters
    destinationId: z.string().uuid().optional(),
    country: z.string().optional(),
    
    // Rating filters
    minRating: z.number().min(0).max(5).optional(),
    
    // Date filters
    availableFrom: z.date().optional(),
    availableTo: z.date().optional()
});

export type AccommodationSearch = z.infer<typeof AccommodationSearchSchema>;
```

### 4. HTTP Schema with Conversion

```typescript
// packages/schemas/src/entities/accommodation/accommodation.http.schema.ts

import { z } from 'zod';
import { 
    BaseHttpSearchSchema, 
    createBooleanQueryParam,
    createNumberQueryParam 
} from '../../api/http/base-http.schema.js';

/**
 * HTTP accommodation search with query string coercion
 */
export const AccommodationSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Text search (no coercion needed)
    name: z.string().optional(),
    
    // Enum with validation
    type: z.enum(['APARTMENT', 'HOUSE', 'ROOM', 'HOTEL']).optional(),
    
    // Boolean coercion from query strings
    isFeatured: createBooleanQueryParam('Filter by featured status'),
    isAvailable: createBooleanQueryParam('Filter by availability'),
    
    // Number coercion from query strings
    minPrice: createNumberQueryParam('Minimum price filter'),
    maxPrice: createNumberQueryParam('Maximum price filter'),
    
    minGuests: z.coerce.number().int().min(1).optional(),
    maxGuests: z.coerce.number().int().min(1).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    
    // String filters
    currency: z.string().length(3).optional(),
    destinationId: z.string().uuid().optional(),
    country: z.string().optional(),
    
    // Date coercion
    availableFrom: z.coerce.date().optional(),
    availableTo: z.coerce.date().optional()
});

export type AccommodationSearchHttp = z.infer<typeof AccommodationSearchHttpSchema>;

/**
 * HTTP accommodation creation
 */
export const AccommodationCreateHttpSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    type: z.enum(['APARTMENT', 'HOUSE', 'ROOM', 'HOTEL']),
    
    // Flat structure for forms
    basePrice: z.coerce.number().min(0),
    currency: z.string().length(3),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
    maxGuests: z.coerce.number().int().min(1),
    bedrooms: z.coerce.number().int().min(0),
    bathrooms: z.coerce.number().int().min(0),
    
    destinationId: z.string().uuid(),
    hostId: z.string().uuid(),
    isFeatured: z.coerce.boolean().optional()
});

export type AccommodationCreateHttp = z.infer<typeof AccommodationCreateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { AccommodationCreateInput, AccommodationUpdateInput } from './accommodation.crud.schema.js';
import type { AccommodationSearch } from './accommodation.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps all HTTP fields to domain fields explicitly
 */
export const httpToDomainAccommodationSearch = (
    httpParams: AccommodationSearchHttp
): AccommodationSearch => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,
    
    // Entity-specific filters (direct mapping)
    name: httpParams.name,
    type: httpParams.type,
    isFeatured: httpParams.isFeatured,
    isAvailable: httpParams.isAvailable,
    minPrice: httpParams.minPrice,
    maxPrice: httpParams.maxPrice,
    currency: httpParams.currency,
    minGuests: httpParams.minGuests,
    maxGuests: httpParams.maxGuests,
    minRating: httpParams.minRating,
    destinationId: httpParams.destinationId,
    country: httpParams.country,
    availableFrom: httpParams.availableFrom,
    availableTo: httpParams.availableTo
});

/**
 * Convert HTTP create data to domain create input
 * Handles field mapping and nested object creation
 */
export const httpToDomainAccommodationCreate = (
    httpData: AccommodationCreateHttp
): AccommodationCreateInput => ({
    // Direct field mapping
    name: httpData.name,
    description: httpData.description,
    type: httpData.type,
    basePrice: httpData.basePrice,
    currency: httpData.currency,
    maxGuests: httpData.maxGuests,
    bedrooms: httpData.bedrooms,
    bathrooms: httpData.bathrooms,
    destinationId: httpData.destinationId,
    
    // Field name mapping
    hostId: httpData.hostId, // Maps to ownerId in domain
    
    // Coordinate handling
    latitude: httpData.latitude,
    longitude: httpData.longitude,
    
    // Optional with defaults
    isFeatured: httpData.isFeatured ?? false
});
```

## 👤 User Entity Example

Simpler entity showing common patterns:

### Domain Schema

```typescript
// packages/schemas/src/entities/user/user.schema.ts

export const UserSchema = z.object({
    id: UuidSchema,
    clerkId: z.string().min(1),
    
    // Personal info
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
    
    // Profile
    avatar: z.string().url().optional(),
    bio: z.string().max(1000).optional(),
    dateOfBirth: z.date().optional(),
    
    // System fields
    role: z.enum(['guest', 'host', 'admin']).default('guest'),
    status: z.enum(['active', 'pending', 'suspended']).default('pending'),
    isEmailVerified: z.boolean().default(false),
    
    // Preferences
    languagePreference: z.string().length(2).default('en'),
    timezone: z.string().default('UTC'),
    
    ...BaseAuditSchema.shape
});
```

### Query Schema (Flat)

```typescript
// packages/schemas/src/entities/user/user.query.schema.ts

export const UserSearchSchema = BaseSearchSchema.extend({
    // Search fields (available to admin/service layer)
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    
    // Filters
    role: z.enum(['guest', 'host', 'admin']).optional(),
    status: z.enum(['active', 'pending', 'suspended']).optional(),
    isEmailVerified: z.boolean().optional(),
    languagePreference: z.string().length(2).optional(),
    
    // Date ranges
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    lastLoginAfter: z.date().optional(),
    lastLoginBefore: z.date().optional(),
    
    // Age filters (computed from dateOfBirth)
    minAge: z.number().int().min(0).optional(),
    maxAge: z.number().int().max(150).optional()
});
```

### HTTP Conversion with Privacy

```typescript
// packages/schemas/src/entities/user/user.http.schema.ts

export const UserSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Admin-only search fields (filtered at service layer)
    role: z.enum(['guest', 'host', 'admin']).optional(),
    status: z.enum(['active', 'pending', 'suspended']).optional(),
    isEmailVerified: createBooleanQueryParam('Filter by email verification'),
    languagePreference: z.string().length(2).optional(),
    
    // Date filters
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    lastLoginAfter: z.coerce.date().optional(),
    lastLoginBefore: z.coerce.date().optional(),
    
    // Age filters
    minAge: z.coerce.number().int().min(0).optional(),
    maxAge: z.coerce.number().int().max(150).optional()
    
    // Note: email, firstName, lastName deliberately excluded for privacy
});

/**
 * HTTP to domain conversion with privacy considerations
 * Only maps fields that exist in BOTH schemas for security
 */
export const httpToDomainUserSearch = (httpParams: UserSearchHttp): UserSearch => ({
    // Base fields
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,
    
    // Only fields available in HTTP schema (privacy-filtered)
    role: httpParams.role,
    status: httpParams.status,
    isEmailVerified: httpParams.isEmailVerified,
    languagePreference: httpParams.languagePreference,
    createdAfter: httpParams.createdAfter,
    createdBefore: httpParams.createdBefore,
    lastLoginAfter: httpParams.lastLoginAfter,
    lastLoginBefore: httpParams.lastLoginBefore,
    minAge: httpParams.minAge,
    maxAge: httpParams.maxAge
    
    // email, firstName, lastName not included - service layer handles these
});
```

## 🏷️ Feature Entity Example

Shows enum handling and simple structure:

```typescript
// packages/schemas/src/entities/feature/feature.schema.ts

export const FeatureSchema = z.object({
    id: UuidSchema,
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    icon: z.string().optional(),
    
    // Feature flags
    isBuiltin: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
    isPremium: z.boolean().default(false),
    requiresPayment: z.boolean().default(false),
    
    // Usage stats
    usageCount: z.number().int().min(0).default(0),
    
    ...BaseAuditSchema.shape
});

// Query schema (flat pattern)
export const FeatureSearchSchema = BaseSearchSchema.extend({
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    
    // Boolean filters (all flat)
    isAvailable: z.boolean().optional(),
    hasIcon: z.boolean().optional(),
    hasDescription: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    isPremium: z.boolean().optional(),
    requiresPayment: z.boolean().optional(),
    isUnused: z.boolean().optional()
});

// HTTP conversion (simple mapping)
export function httpToDomainFeatureSearch(httpData: FeatureSearchHttp): FeatureSearch {
    return {
        ...httpData, // Most fields map directly
        isAvailable: httpData.isAvailable,
        hasIcon: httpData.hasIcon,
        hasDescription: httpData.hasDescription,
        isPopular: httpData.isPopular,
        isPremium: httpData.isPremium,
        requiresPayment: httpData.requiresPayment,
        isUnused: httpData.isUnused
    };
}
```

## 🚀 Usage in API Routes

Example of how schemas are used in actual API routes:

```typescript
// apps/api/src/routes/accommodation/list.ts

import { 
    AccommodationSearchHttpSchema, 
    AccommodationListItemSchema,
    httpToDomainAccommodationSearch
} from '@repo/schemas';
import { createListRoute } from '../../utils/route-factory';

export const accommodationListRoute = createListRoute({
    method: 'get',
    path: '/accommodations',
    summary: 'List accommodations',
    description: 'Returns a paginated list of accommodations with filtering options',
    tags: ['Accommodations'],
    
    // Use .shape to extract Zod object shape for route factory
    requestQuery: AccommodationSearchHttpSchema.shape,
    responseSchema: AccommodationListItemSchema,
    
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        
        // Convert HTTP query params to domain search params
        const searchParams = httpToDomainAccommodationSearch(
            query as AccommodationSearchHttp
        );
        
        // Use domain params in service layer
        const result = await accommodationService.search(actor, searchParams);
        
        if (result.error) {
            throw new Error(result.error.message);
        }
        
        return result.data as never;
    },
    
    options: {
        cacheTTL: 300, // 5 minutes
        customRateLimit: {
            windowMs: 60 * 1000, // 1 minute
            max: 30 // 30 requests per minute
        }
    }
});
```

## 📊 Testing Examples

Real test examples from the codebase:

```typescript
// packages/schemas/test/entities/accommodation/accommodation.schema.test.ts

describe('AccommodationSchema', () => {
    const createValidAccommodation = () => ({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Beautiful Apartment',
        slug: 'beautiful-apartment',
        type: 'APARTMENT',
        lifecycleState: 'ACTIVE',
        price: { price: 100, currency: 'USD' },
        location: {
            country: 'US',
            coordinates: { lat: '40.7128', long: '-74.0060' }
        },
        extraInfo: {
            capacity: 4,
            minNights: 1,
            bedrooms: 2,
            bathrooms: 1,
            smokingAllowed: false,
            extraInfo: []
        },
        destinationId: '123e4567-e89b-12d3-a456-426614174001',
        ownerId: '123e4567-e89b-12d3-a456-426614174002',
        isFeatured: false,
        reviewsCount: 0,
        averageRating: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    
    it('should validate complete accommodation', () => {
        const accommodation = createValidAccommodation();
        expect(() => AccommodationSchema.parse(accommodation)).not.toThrow();
    });
    
    it('should require nested price object', () => {
        const accommodation = {
            ...createValidAccommodation(),
            price: 100 // Invalid: should be object
        };
        expect(() => AccommodationSchema.parse(accommodation)).toThrow();
    });
});

describe('httpToDomainAccommodationSearch', () => {
    it('should convert all HTTP fields to domain fields', () => {
        const httpParams: AccommodationSearchHttp = {
            page: 1,
            pageSize: 20,
            isFeatured: true,
            minPrice: 100,
            type: 'APARTMENT'
        };
        
        const domainParams = httpToDomainAccommodationSearch(httpParams);
        
        expect(domainParams.page).toBe(1);
        expect(domainParams.pageSize).toBe(20);
        expect(domainParams.isFeatured).toBe(true);
        expect(domainParams.minPrice).toBe(100);
        expect(domainParams.type).toBe('APARTMENT');
    });
});
```

These examples show real patterns used throughout the Hospeda codebase for robust, type-safe schema management.
