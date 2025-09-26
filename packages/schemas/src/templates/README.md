# Entity Schema Templates

This directory contains standardized templates for creating entity schemas that follow the migration patterns established in Phase 0 analysis.

## 📁 Template Structure

### `entity-template.schema.ts`
Complete entity schema template with:
- ✅ **Base-first inheritance** using `BaseAuditSchema`
- ✅ **Flat filter patterns** replacing nested filter objects
- ✅ **Consistent error keys** using `zodError.*` pattern
- ✅ **OpenAPI integration** with comprehensive metadata
- ✅ **Compile-time validation** to ensure pattern compliance
- ✅ **TypeScript type exports** for service layer consumption

## 🚀 Usage Instructions

### 1. Copy the Template
```bash
cp packages/schemas/src/templates/entity-template.schema.ts packages/schemas/src/{entity-name}/{entity-name}.schema.ts
```

### 2. Replace Placeholders
In your copied file, replace all instances of:
- `Entity` → Your entity name (e.g., `Accommodation`, `User`, `Booking`)
- `entity` → Lowercase entity name (e.g., `accommodation`, `user`, `booking`)

### 3. Define Entity-Specific Fields
Replace `EntitySpecificSchema` with your actual fields:

```typescript
// Example for Accommodation entity
export const AccommodationSpecificSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'zodError.required' })
    .max(255, { message: 'zodError.maxLength' })
    .describe('Accommodation name'),
  description: z
    .string()
    .optional()
    .describe('Detailed description'),
  address: z
    .string()
    .min(1, { message: 'zodError.required' })
    .describe('Full address'),
  maxGuests: z
    .number()
    .int({ message: 'zodError.integer' })
    .positive({ message: 'zodError.positive' })
    .describe('Maximum number of guests'),
  pricePerNight: z
    .number()
    .positive({ message: 'zodError.positive' })
    .describe('Price per night in cents'),
  status: z
    .enum(['draft', 'published', 'suspended'], { 
      message: 'zodError.invalidEnum' 
    })
    .default('draft')
    .describe('Accommodation status'),
});
```

### 4. Update Search Schema
Add entity-specific search filters to the `SearchEntitySchema`:

```typescript
export const SearchAccommodationSchema = BaseSearchSchema.extend({
  // Flat filter structure (migrated from nested patterns)
  name: z
    .string()
    .optional()
    .describe('Filter by accommodation name (partial match)'),
  status: z
    .enum(['draft', 'published', 'suspended'])
    .optional()
    .describe('Filter by accommodation status'),
  maxGuests: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Filter by minimum guest capacity'),
  minPrice: z
    .number()
    .positive()
    .optional()
    .describe('Filter by minimum price per night'),
  maxPrice: z
    .number()
    .positive()
    .optional()
    .describe('Filter by maximum price per night'),
  city: z
    .string()
    .optional()
    .describe('Filter by city'),
}).describe('Accommodation search parameters');
```

### 5. Update OpenAPI Metadata
Replace the template metadata with your entity-specific details:

```typescript
const accommodationMetadata: OpenApiSchemaMetadata = {
  ref: 'Accommodation',
  title: 'Accommodation',
  description: 'Tourism accommodation listing',
  example: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Cozy Mountain Cabin',
    description: 'A beautiful cabin with mountain views',
    address: '123 Mountain View Rd, Alpine, CO',
    maxGuests: 4,
    pricePerNight: 15000, // $150.00 in cents
    status: 'published',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
  },
  fields: {
    // ... field-specific metadata
  },
};
```

### 6. Add to Barrel Exports
Update `packages/schemas/src/index.ts`:

```typescript
// Entity schemas
export * from './accommodation/accommodation.schema.js';
```

## ✅ Validation Patterns

### Pattern Compliance
The template includes compile-time validation to ensure:

- **Audit Fields**: Main schema includes `id`, `createdAt`, `updatedAt`, `deletedAt`
- **Clean Creation**: Create schema excludes all audit fields
- **Pagination Support**: Search schema includes pagination parameters
- **Error Key Consistency**: All validation messages use `zodError.*` pattern

### Migration Validation
Each entity created from this template supports:

1. **Flat Filters**: No nested filter objects (migrated pattern)
2. **Base Schema Inheritance**: Consistent audit and search patterns
3. **OpenAPI Integration**: Comprehensive API documentation
4. **Type Safety**: Full TypeScript integration

## 📋 Entities Requiring Migration

Based on Phase 0 analysis, these 14 entities need schema migration using this template:

1. **accommodation** - Tourism listings with complex search filters
2. **booking** - Reservation management with date-based filters  
3. **user** - User profiles with role-based filters
4. **property** - Property management with location filters
5. **review** - Review system with rating filters
6. **payment** - Payment processing with status filters
7. **notification** - Notification system with type filters
8. **media** - Media management with type/size filters
9. **location** - Location management with geographic filters
10. **amenity** - Amenity catalog with category filters
11. **availability** - Availability calendar with date filters
12. **pricing** - Dynamic pricing with date/guest filters
13. **promotion** - Promotion management with validity filters
14. **analytics** - Analytics data with metric filters

## 🔄 Migration Workflow

For each entity:

1. **Backup**: Ensure `backup-pre-phase-1` branch exists
2. **Template**: Copy and customize the entity template
3. **Validation**: Run `pnpm validate-phase-1` to verify patterns
4. **Testing**: Ensure all tests pass after schema changes
5. **Integration**: Update service layer to use new schemas

## 🚨 Common Issues

### Import Paths
- Always use `.js` extensions: `import { ... } from './base.schema.js'`
- Use relative paths for internal imports
- Use `@repo/schemas` for external consumption

### Error Messages
- Use `zodError.*` pattern consistently
- Standard keys: `required`, `invalid`, `minLength`, `maxLength`, `positive`, `integer`, `invalidEnum`
- Avoid custom error messages unless absolutely necessary

### OpenAPI Integration
- Always provide `ref`, `description`, `example`, and `fields`
- Use descriptive examples that match your domain
- Include format hints for special fields (`uuid`, `date-time`, `email`)

## 📚 Additional Resources

- [Phase 0 Analysis](../../../docs/migration/phase-0-analysis.md) - Complete migration analysis
- [Base Schema Documentation](../common/README.md) - Base schema patterns
- [OpenAPI Utils](../utils/README.md) - OpenAPI integration helpers
- [Migration Guide](../../../docs/migration/README.md) - Overall migration strategy