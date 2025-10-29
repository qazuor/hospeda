# Shared Admin Schemas - Best Practices

## 📋 Overview

The shared schemas system provides reusable, consistent schema extensions for admin-specific functionality across all entities in the admin application.

## 🎯 Design Principles

### 1. **Composition over Duplication**

- Use `.extend(Schema.shape)` to compose multiple extension schemas
- Avoid duplicating field definitions across entities
- Reuse common patterns through shared schemas

### 2. **Semantic Naming**

- Extensions are named by their purpose: `AdminStatusExtension`, `OwnerExtension`
- Clear distinction between different types of extensions
- Consistent field names across all entities

### 3. **Progressive Enhancement**

- Base entity uses `@repo/schemas` as single source of truth
- Add only admin-specific extensions as needed
- Minimize the number of extensions per entity

## 🔧 Available Extensions

### **Client State Extensions**

```typescript
import { ClientStateExtensionSchema } from '@/shared/schemas';

// Fields: _isDirty, _hasUnsavedChanges, _isNew, _isSelected, _isExpanded
const EntitySchema = BaseSchema.extend(ClientStateExtensionSchema.shape);
```

### **Relation Extensions**

```typescript
import { DestinationExtensionSchema, OwnerExtensionSchema } from '@/shared/schemas';

// Adds expanded destination and owner objects
const EntitySchema = BaseSchema
    .extend(DestinationExtensionSchema.shape)
    .extend(OwnerExtensionSchema.shape);
```

### **Admin Management Extensions**

```typescript
import { AdminStatusExtensionSchema, AdminActivityExtensionSchema } from '@/shared/schemas';

// Adds admin status and activity tracking
const EntitySchema = BaseSchema
    .extend(AdminStatusExtensionSchema.shape)
    .extend(AdminActivityExtensionSchema.shape);
```

## ✅ Migration Patterns

### **Pattern 1: Simple Extension Replacement**

```typescript
// ❌ Before (duplicated)
destination: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string()
}).nullable().optional()

// ✅ After (shared)
.extend(DestinationExtensionSchema.shape)
```

### **Pattern 2: Multiple Extensions**

```typescript
// ❌ Before (mixed concerns)
export const EntitySchema = BaseSchema.extend({
    destination: z.object({...}),
    isActive: z.boolean().optional(),
    _isDirty: z.boolean().optional(),
    tags: z.array(z.string()).optional()
});

// ✅ After (separated concerns)
export const EntitySchema = BaseSchema
    .extend(DestinationExtensionSchema.shape)      // Relations
    .extend(AdminStatusExtensionSchema.shape)      // Admin management
    .extend(ClientStateExtensionSchema.shape);     // UI state
```

### **Pattern 3: Type Inference**

```typescript
// ❌ Before (manual types)
export type Entity = BaseEntity & {
    destination?: { id: string; name: string; slug: string } | null;
    isActive?: boolean;
    _isDirty?: boolean;
};

// ✅ After (inference)
export type Entity = z.infer<typeof EntitySchema>;
```

## 🚫 Anti-Patterns to Avoid

### **Don't Duplicate Field Definitions**

```typescript
// ❌ Bad - duplicating destination structure
destination: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    country: z.string()  // Different from shared schema!
}).nullable().optional()

// ✅ Good - use shared schema consistently
.extend(DestinationExtensionSchema.shape)
```

### **Don't Mix Extension Concerns**

```typescript
// ❌ Bad - mixing UI state with business logic
export const EntitySchema = BaseSchema.extend({
    _isDirty: z.boolean().optional(),        // UI concern
    isEmailVerified: z.boolean().optional(), // Business concern
    destination: z.object({...})             // Relation concern
});

// ✅ Good - separate concerns
export const EntitySchema = BaseSchema
    .extend(ClientStateExtensionSchema.shape)
    .extend(AdminStatusExtensionSchema.shape)
    .extend(DestinationExtensionSchema.shape);
```

### **Don't Create Custom Extensions Without Justification**

```typescript
// ❌ Bad - entity-specific when generic would work
customOwnerField: z.object({
    userId: z.string(),
    userName: z.string()
}).optional()

// ✅ Good - use standard owner extension
.extend(OwnerExtensionSchema.shape)
```

## 📊 Benefits

1. **Consistency**: All entities use the same field structures for relations
2. **Maintainability**: Changes to extension schemas propagate automatically
3. **Type Safety**: Shared schemas ensure consistent TypeScript types
4. **Discoverability**: Developers can find reusable patterns easily
5. **Bundle Size**: Reduced duplication leads to smaller bundle

## 🎯 When to Create New Shared Schemas

Create a new shared schema when:

- [ ] The same field structure is used in 3+ entities
- [ ] The fields represent a cohesive concern (relations, admin status, etc.)
- [ ] The structure is stable and unlikely to change frequently

Keep entity-specific extensions when:

- [ ] Fields are truly unique to one entity
- [ ] The structure might change independently
- [ ] Business logic requires entity-specific validation
