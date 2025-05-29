# @hospeda/db

Este paquete contiene la definición y organización de los esquemas de base de datos para el monorepo Hospeda, utilizando Drizzle ORM y tipado fuerte alineado con el package `types`.

## Orderable Columns Pattern (Reusable for All Models)

This pattern provides a robust, type-safe way to define which columns of a model can be used for ordering (sorting) in list queries, and ensures that both the allowed values and the Drizzle column references are always in sync.

**Steps to replicate for any model:**

1. **Define** the list of orderable column names as a readonly tuple (e.g., `['name', 'createdAt', ...] as const`).
2. **Use** the `createOrderableColumnsAndMapping` utility to generate:
   - A readonly array of allowed column names for UI/validation.
   - A type union of allowed column names for strong typing.
   - A mapping from column name to Drizzle column reference for queries.
3. **Export:**
   - The array (for dropdowns, validation, etc.).
   - The type (for params, DTOs, etc.).
   - The mapping (for use in `getOrderableColumn` and query building).
4. **Use the type** in your pagination/search params:

   ```ts
   type MyOrderByColumn = typeof myOrderable.type;
   type MyPaginationParams = PaginationParams<MyOrderByColumn>;
   ```

5. **Use the mapping and `getOrderableColumn`** in your list/search methods to resolve the correct Drizzle column reference, with fallback and error handling.

**Example:**

```ts
const myOrderable = createOrderableColumnsAndMapping(
  ['name', 'createdAt'] as const,
  myTable
);
export const MY_ORDERABLE_COLUMNS = myOrderable.columns;
export type MyOrderByColumn = typeof myOrderable.type;
const myOrderableColumns = myOrderable.mapping;

// In your model method:
const col = getOrderableColumn(myOrderableColumns, orderBy, myTable.createdAt);
const orderExpr = order === 'desc' ? desc(col) : asc(col);
```

**Best practices:**

- Always use the type for params, not just `string`.
- Export the array for UI and validation.
- Keep the mapping internal to the model.
- Add/rename columns in the tuple and mapping only, never in multiple places.

See `TagModel` for a full implementation.

## Estructura de carpetas

- **accommodation/**: Esquemas relacionados con alojamientos, amenities y features.
- **destination/**: Esquemas de destinos y atracciones.
- **event/**: Esquemas de eventos y sus relaciones.
- **post/**: Esquemas de publicaciones y sponsors.
- **tag/**: Esquemas de tags y relaciones con entidades.
- **user/**: Esquemas de usuarios, roles, permisos y relaciones.
- **enums.dbschema.ts**: Definiciones de enums reutilizables en los esquemas.
- **index.ts**: Reexporta todos los esquemas principales para facilitar su importación.

## Convenciones

- Todos los esquemas están fuertemente tipados y alineados con los tipos del package `types`.
- Se utiliza Drizzle ORM para la definición de tablas y relaciones.
- Los archivos `index.ts` en cada carpeta reexportan los esquemas de esa entidad.
- El `index.ts` principal reexporta todos los esquemas del package.

## Tablas y columnas

### accommodation/accommodations

- id: uuid (PK)
- slug: text (unique, not null)
- name: text (not null)
- summary: text (not null)
- type: enum (AccommodationTypePgEnum, not null)
- description: text (not null)
- contactInfo: jsonb<object>
- socialNetworks: jsonb<object>
- price: jsonb<object>
- location: jsonb<object>
- media: jsonb<object>
- isFeatured: jsonb<boolean>
- ownerId: uuid (FK users.id, set null)
- destinationId: uuid (FK destinations.id, set null)
- visibility: enum (VisibilityPgEnum, not null, default PUBLIC)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### accommodation/amenities

- id: uuid (PK)
- name: text (not null)
- description: text
- icon: text
- isBuiltin: jsonb<boolean> (not null)
- type: enum (AmenitiesTypePgEnum, not null)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### accommodation/features

- id: uuid (PK)
- name: text (not null)
- description: text
- icon: text
- isBuiltin: jsonb<boolean> (not null)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### accommodation/accommodation_faqs

- id: uuid (PK)
- accommodationId: uuid (FK accommodations.id, cascade, not null)
- question: text (not null)
- answer: text (not null)
- category: text
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### accommodation/accommodation_ia_data

- id: uuid (PK)
- accommodationId: uuid (FK accommodations.id, cascade, not null)
- title: text (not null)
- content: text (not null)
- category: text
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### accommodation/accommodation_reviews

- id: uuid (PK)
- accommodationId: uuid (FK accommodations.id, cascade, not null)
- userId: uuid (FK users.id, cascade, not null)
- title: text
- content: text
- rating: jsonb<object> (not null)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### accommodation/r_accommodation_amenity

- accommodationId: uuid (FK accommodations.id, cascade, PK)
- amenityId: uuid (FK amenities.id, cascade, PK)
- isOptional: boolean (not null, default false)
- additionalCost: jsonb<object>
- additionalCostPercent: doublePrecision

### accommodation/r_accommodation_feature

- accommodationId: uuid (FK accommodations.id, cascade, PK)
- featureId: uuid (FK features.id, cascade, PK)
- hostReWriteName: text
- comments: text

### destination/destinations

- id: uuid (PK)
- slug: text (unique, not null)
- name: text (not null)
- summary: text (not null)
- description: text (not null)
- location: jsonb<object> (not null)
- media: jsonb<object> (not null)
- isFeatured: jsonb<boolean>
- visibility: enum (VisibilityPgEnum, not null, default PUBLIC)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### destination/attractions

- id: uuid (PK)
- name: text (not null)
- slug: text (not null)
- description: text (not null)
- icon: text (not null)
- destinationId: uuid (FK destinations.id, cascade)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)

### destination/destination_reviews

- id: uuid (PK)
- userId: uuid (FK users.id, cascade, not null)
- destinationId: uuid (FK destinations.id, cascade, not null)
- title: text
- content: text
- rating: jsonb<object> (not null)
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### destination/r_destination_attraction

- destinationId: uuid (FK destinations.id, cascade, PK)
- attractionId: uuid (FK attractions.id, cascade, PK)

### event/events

- id: uuid (PK)
- slug: text (unique, not null)
- summary: text (not null)
- description: text
- media: jsonb<object>
- category: enum (EventCategoryPgEnum, not null)
- date: jsonb<object> (not null)
- authorId: uuid (FK users.id, set null)
- locationId: uuid
- organizerId: uuid
- pricing: jsonb<object>
- contact: jsonb<object>
- visibility: enum (VisibilityPgEnum, not null, default PUBLIC)
- isFeatured: jsonb<boolean>
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### event/event_locations

- id: uuid (PK)
- street: text
- number: text
- floor: text
- apartment: text
- neighborhood: text
- city: text (not null)
- department: text
- placeName: text
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### event/event_organizers

- id: uuid (PK)
- name: text (not null)
- logo: text
- contactInfo: jsonb<object>
- social: jsonb<object>
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### post/posts

- id: uuid (PK)
- slug: text (unique, not null)
- category: enum (PostCategoryPgEnum, not null)
- title: text (not null)
- summary: text (not null)
- content: text (not null)
- media: jsonb<object>
- authorId: uuid (FK users.id, set null)
- sponsorshipId: uuid
- relatedDestinationId: uuid (FK destinations.id, set null)
- relatedEventId: uuid (FK events.id, set null)
- visibility: enum (VisibilityPgEnum, not null, default PUBLIC)
- isFeatured: jsonb<boolean>
- isNews: jsonb<boolean>
- isFeaturedInWebsite: jsonb<boolean>
- expiresAt: timestamp
- likes: jsonb<number>
- comments: jsonb<number>
- shares: jsonb<number>
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### post/post_sponsors

- id: uuid (PK)
- name: text (not null)
- type: enum (ClientTypePgEnum, not null)
- description: text (not null)
- logo: jsonb<object>
- contact: jsonb<object>
- social: jsonb<object>
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### post/post_sponsorships

- id: uuid (PK)
- sponsorId: uuid (FK post_sponsors.id, cascade, not null)
- postId: uuid (FK posts.id, cascade, not null)
- message: text
- description: text (not null)
- paid: jsonb<object> (not null)
- paidAt: timestamp
- fromDate: timestamp
- toDate: timestamp
- isHighlighted: jsonb<boolean>
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)

### tag/tags

- id: uuid (PK)
- name: text (not null)
- color: enum (TagColorPgEnum, not null)
- icon: text
- notes: text
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### tag/r_entity_tag

- tagId: uuid (FK tags.id, cascade, PK)
- entityId: uuid (PK)
- entityType: enum (EntityTypePgEnum, PK)

### user/users

- id: uuid (PK)
- userName: text (unique, not null)
- password: text (not null)
- firstName: text
- lastName: text
- birthDate: timestamp
- emailVerified: boolean (not null, default false)
- phoneVerified: boolean (not null, default false)
- contactInfo: jsonb<ContactInfoType>
- location: jsonb<FullLocationType>
- socialNetworks: jsonb<SocialNetworkType[]>
- roleId: uuid (FK roles.id, cascade, not null)
- profile: jsonb<UserProfile>
- settings: jsonb<UserSettingsType> (not null)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### user/roles

- id: uuid (PK)
- name: text (unique, not null)
- description: text (not null)
- isBuiltIn: boolean (not null)
- isDeprecated: boolean (not null, default false)
- isDefault: boolean (not null, default false)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### user/permissions

- id: uuid (PK)
- name: text (unique, not null)
- description: text (not null)
- isBuiltIn: boolean (not null)
- isDeprecated: boolean (not null, default false)
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

### user/r_user_role

- userId: uuid (FK users.id, cascade, PK)
- roleId: uuid (FK roles.id, cascade, PK)

### user/r_user_permission

- userId: uuid (FK users.id, cascade, PK)
- permissionId: uuid (FK permissions.id, cascade, PK)

### user/r_role_permission

- roleId: uuid (FK roles.id, cascade, PK)
- permissionId: uuid (FK permissions.id, cascade, PK)

### user/user_bookmarks

- id: uuid (PK)
- userId: uuid (FK users.id, cascade, not null)
- entityId: uuid (not null)
- entityType: enum (EntityTypePgEnum, not null)
- name: text
- description: text
- lifecycle: enum (LifecycleStatusPgEnum, not null, default ACTIVE)
- adminInfo: jsonb<AdminInfoType>
- createdAt: timestamp (not null, default now)
- updatedAt: timestamp (not null, default now)
- createdById: uuid (FK users.id, set null)
- updatedById: uuid (FK users.id, set null)
- deletedAt: timestamp
- deletedById: uuid (FK users.id, set null)

---

## Diagrama de relaciones (Mermaid)

```mermaiderDiagram
  users ||--o{ accommodations : "ownerId"
  users ||--o{ accommodations : "createdById/updatedById/deletedById"
  users ||--o{ amenities : "createdById/updatedById/deletedById"
  users ||--o{ features : "createdById/updatedById/deletedById"
  users ||--o{ roles : "createdById/updatedById/deletedById"
  users ||--o{ permissions : "createdById/updatedById/deletedById"
  users ||--o{ user_bookmarks : "createdById/updatedById/deletedById"
  users ||--o{ user_bookmarks : "userId"
  users ||--o{ tags : "createdById/updatedById/deletedById"
  users ||--o{ destinations : "createdById/updatedById/deletedById"
  users ||--o{ attractions : "createdById/updatedById"
  users ||--o{ events : "createdById/updatedById/deletedById"
  users ||--o{ posts : "createdById/updatedById/deletedById"
  users ||--o{ accommodation_reviews : "userId"
  users ||--o{ destination_reviews : "userId"

  accommodations ||--o{ accommodation_faqs : "id"
  accommodations ||--o{ accommodation_ia_data : "id"
  accommodations ||--o{ accommodation_reviews : "id"
  accommodations ||--o{ r_accommodation_amenity : "id"
  accommodations ||--o{ r_accommodation_feature : "id"
  accommodations }o--|| destinations : "destinationId"
  accommodations }o--|| users : "ownerId"
  amenities ||--o{ r_accommodation_amenity : "id"
  features ||--o{ r_accommodation_feature : "id"

  destinations ||--o{ attractions : "id"
  destinations ||--o{ destination_reviews : "id"
  destinations ||--o{ r_destination_attraction : "id"
  attractions ||--o{ r_destination_attraction : "id"

events ||--o{ posts : "relatedEventId"
  events ||--o{ event_locations : "locationId"
  events ||--o{ event_organizers : "organizerId"

  posts ||--o{ post_sponsorships : "id"
  posts ||--o{ post_sponsors : "sponsorshipId"
  post_sponsors ||--o{ post_sponsorships : "id"

  roles ||--o{ users : "roleId"
  roles ||--o{ r_user_role : "id"
  roles ||--o{ r_role_permission : "id"
  permissions ||--o{ r_user_permission : "id"
  permissions ||--o{ r_role_permission : "id"
  users ||--o{ r_user_role : "id"
  users ||--o{ r_user_permission : "id"

  tags ||--o{ r_entity_tag : "id"
```

---

Este README se irá actualizando a medida que se agreguen modelos, servicios y seeds, así como instrucciones de uso y ejemplos.
