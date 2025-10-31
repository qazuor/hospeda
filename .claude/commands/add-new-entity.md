# Add New Entity Command

## Purpose

Structured workflow for adding a new domain entity following the established Hospeda architecture patterns. Ensures consistent implementation across all layers (Database → Service → API → Frontend).

## Usage

```bash
/add-new-entity {entity_name}
```text

## Description

Orchestrates the complete implementation of a new domain entity following the Four-Phase Workflow with TDD principles. Creates all necessary files, follows established patterns, and ensures comprehensive testing and documentation.

---

## Execution Flow

### Phase 1: Planning (Entity Design)

#### Step 1: Domain Analysis

**Agent**: `product-technical`

**Process**:

- Analyze entity requirements and relationships
- Design database schema with proper relationships
- Plan API endpoints and service methods
- Define business rules and validation logic
- Create implementation roadmap

**Deliverable**: Entity design document with:

- Database schema definition
- Business rules specification
- API endpoint design
- Service method planning
- Validation requirements

#### Step 2: Architecture Validation

**Agent**: `architecture-validator`

**Process**:

- Validate entity fits existing architecture
- Review relationships with existing entities
- Ensure pattern consistency
- Validate naming conventions
- Approve implementation approach

### Phase 2: Implementation (TDD Workflow)

#### Step 3: Database Layer Implementation

**Agent**: `db-engineer`

**Process**:

1. **Create Database Schema**:

   ```typescript
   // packages/db/src/schemas/{entity}/{entity}.schema.ts
   export const {entity}Schema = pgTable('{entity}', {
     id: varchar('id').primaryKey().$defaultFn(() => nanoid()),
     // ... entity fields
     createdAt: timestamp('created_at').notNull().defaultNow(),
     updatedAt: timestamp('updated_at').notNull().defaultNow(),
   });
   ```

2. **Create Database Model**:

   ```typescript
   // packages/db/src/models/{entity}.model.ts
   export class {Entity}Model extends BaseModel<{Entity}> {
     protected table = {entity}Schema;
     protected entityName = '{entity}';

     // Custom methods if needed
   }
   ```

3. **Write Model Tests**:

   ```typescript
   // packages/db/test/models/{entity}.model.test.ts
   describe('{Entity}Model', () => {
     // TDD: Write tests first
   });
   ```

4. **Create Migration**:

   ```sql
   -- packages/db/migrations/{timestamp}_create_{entity}.sql
   CREATE TABLE {entity} (
     id VARCHAR PRIMARY KEY,
     -- ... fields
   );
   ```

#### Step 4: Service Layer Implementation

**Agent**: `backend-reviewer` (service focus)

**Process**:

1. **Create Zod Schemas**:

   ```typescript
   // packages/schemas/src/{entity}/index.ts
   export const create{Entity}Schema = z.object({
     // validation rules
   });
   ```

2. **Create Service**:

   ```typescript
   // packages/service-core/src/services/{entity}/{entity}.service.ts
   export class {Entity}Service extends BaseCrudService<
     {Entity}, {Entity}Model, Create{Entity}Schema, Update{Entity}Schema, Search{Entity}Schema
   > {
     constructor(ctx: ServiceContext, model?: {Entity}Model) {
       super(ctx, model || new {Entity}Model(ctx.db));
     }
   }
   ```

3. **Write Service Tests**:

   ```typescript
   // packages/service-core/test/services/{entity}.service.test.ts
   describe('{Entity}Service', () => {
     // TDD: Business logic tests
   });
   ```

#### Step 5: API Layer Implementation

**Agent**: `hono-engineer`

**Process**:

1. **Create API Routes**:

   ```typescript
   // apps/api/src/routes/{entity}/index.ts
   export const {entity}ListRoute = createListRoute({
     path: '/{entity}s',
     service: {Entity}Service,
     // configuration
   });

   export const {entity}CrudRoute = createCRUDRoute({
     path: '/{entity}s',
     service: {Entity}Service,
     // configuration
   });
   ```

2. **Write API Tests**:

   ```typescript
   // apps/api/test/routes/{entity}.test.ts
   describe('{Entity} API', () => {
     // TDD: API endpoint tests
   });
   ```

3. **Register Routes**:

   ```typescript
   // apps/api/src/app.ts
   app.route('/api/{entity}s', {entity}ListRoute);
   app.route('/api/{entity}s', {entity}CrudRoute);
   ```

#### Step 6: Frontend Implementation

**Agent**: `react-dev` or `astro-engineer`

**Process**:

1. **Create Types**:

   ```typescript
   // packages/types/src/{entity}/index.ts
   export type {Entity} = z.infer<typeof {entity}Schema>;
   ```

2. **Create Components**:

   ```typescript
   // apps/web/src/components/{entity}/{Entity}Card.tsx
   // apps/web/src/components/{entity}/{Entity}List.tsx
   // apps/web/src/components/{entity}/{Entity}Form.tsx
   ```

3. **Create API Hooks**:

   ```typescript
   // apps/web/src/hooks/use{Entity}.ts
   export const use{Entity}List = () => {
     return useQuery({
       queryKey: ['{entity}s'],
       queryFn: () => api.{entity}s.list()
     });
   };
   ```

4. **Write Component Tests**:

   ```typescript
   // apps/web/test/components/{entity}.test.tsx
   describe('{Entity} Components', () => {
     // Component behavior tests
   });
   ```

### Phase 3: Validation

#### Step 7: Quality Validation

**Command**: `/quality-check`

**Process**:

- Code quality validation
- Test coverage verification (≥ 90%)
- Security review
- Performance analysis

#### Step 8: Integration Testing

**Agent**: `qa-engineer`

**Process**:

- End-to-end workflow testing
- Integration between layers
- User acceptance criteria validation
- Error scenario testing

### Phase 4: Finalization

#### Step 9: Documentation

**Agent**: `tech-writer`

**Process**:

- API endpoint documentation
- Database schema documentation
- Component usage examples
- Integration guide updates

#### Step 10: Final Review

**Agent**: `tech-lead`

**Process**:

- Architecture consistency review
- Pattern compliance validation
- Code quality approval
- Documentation completeness

---

## Entity Implementation Patterns

### Database Layer Pattern

**Required Files**:

```text
packages/db/src/
├── schemas/{entity}/
│   ├── {entity}.schema.ts      # Drizzle schema definition
│   └── index.ts                # Schema exports
├── models/
│   ├── {entity}.model.ts       # Model extending BaseModel
│   └── index.ts                # Model exports
└── migrations/
    └── {timestamp}_create_{entity}.sql
```text

**Pattern Requirements**:

- Extend `BaseModel<T>`
- Include `id`, `createdAt`, `updatedAt` fields
- Use proper TypeScript types
- Implement custom search logic if needed

### Service Layer Pattern

**Required Files**:

```text
packages/service-core/src/services/{entity}/
├── {entity}.service.ts         # Service extending BaseCrudService
├── index.ts                    # Service exports
└── types.ts                    # Service-specific types

packages/schemas/src/{entity}/
├── create.schema.ts            # Creation validation
├── update.schema.ts            # Update validation
├── search.schema.ts            # Search validation
└── index.ts                    # Schema exports
```text

**Pattern Requirements**:

- Extend `BaseCrudService<T, TModel, TCreate, TUpdate, TSearch>`
- Use RO-RO pattern for all methods
- Implement proper error handling with `ServiceError`
- Include comprehensive business logic validation

### API Layer Pattern

**Required Files**:

```text
apps/api/src/routes/{entity}/
├── index.ts                    # Route definitions and exports
├── create.ts                   # Custom create logic if needed
├── update.ts                   # Custom update logic if needed
└── search.ts                   # Custom search logic if needed
```text

**Pattern Requirements**:

- Use route factory functions
- Implement proper authentication/authorization
- Add input validation with Zod schemas
- Include rate limiting configuration

### Frontend Layer Pattern

**Required Files**:

```text
apps/web/src/
├── components/{entity}/
│   ├── {Entity}Card.tsx        # Display component
│   ├── {Entity}List.tsx        # List component
│   ├── {Entity}Form.tsx        # Form component
│   └── index.ts                # Component exports
├── hooks/
│   ├── use{Entity}.ts          # API integration hooks
│   └── use{Entity}Form.ts      # Form management hooks
└── pages/{entity}/
    ├── index.astro             # List page
    ├── [id].astro              # Detail page
    └── create.astro            # Creation page
```text

**Pattern Requirements**:

- Use TanStack Query for data fetching
- Implement proper loading and error states
- Follow accessibility guidelines (WCAG AA)
- Include responsive design

---

## Quality Standards

### Code Quality Requirements

- ✅ **TypeScript**: Strict mode, no `any` types
- ✅ **Testing**: ≥ 90% coverage across all layers
- ✅ **Patterns**: Consistent with existing entities
- ✅ **Documentation**: Complete API and component docs

### Architecture Requirements

- ✅ **Layer Separation**: Clear Model → Service → API → Frontend
- ✅ **Error Handling**: Consistent error patterns
- ✅ **Validation**: Comprehensive input validation
- ✅ **Security**: Proper authentication and authorization

### Performance Requirements

- ✅ **Database**: Proper indexing and query optimization
- ✅ **API**: Response times < 200ms
- ✅ **Frontend**: Component optimization and lazy loading
- ✅ **Bundle**: Minimal impact on bundle size

---

## Output Format

### Success Case

```text
✅ NEW ENTITY IMPLEMENTATION COMPLETE

Entity: Reservation Management
Implementation: 4-layer architecture complete

📊 Implementation Summary:
✅ Database Layer: Schema, model, and migration created
✅ Service Layer: Business logic with 95% test coverage
✅ API Layer: 5 endpoints with authentication
✅ Frontend Layer: 4 components with responsive design

📋 Files Created:
Database (4 files):

- packages/db/src/schemas/reservation/reservation.schema.ts
- packages/db/src/models/reservation.model.ts
- packages/db/migrations/20241028_create_reservation.sql
- packages/db/test/models/reservation.model.test.ts

Service (6 files):

- packages/service-core/src/services/reservation/reservation.service.ts
- packages/schemas/src/reservation/create.schema.ts
- packages/schemas/src/reservation/update.schema.ts
- packages/schemas/src/reservation/search.schema.ts
- packages/service-core/test/services/reservation.service.test.ts
- packages/types/src/reservation/index.ts

API (3 files):

- apps/api/src/routes/reservation/index.ts
- apps/api/test/routes/reservation.test.ts
- Updated apps/api/src/app.ts

Frontend (8 files):

- apps/web/src/components/reservation/ReservationCard.tsx
- apps/web/src/components/reservation/ReservationList.tsx
- apps/web/src/components/reservation/ReservationForm.tsx
- apps/web/src/hooks/useReservation.ts
- apps/web/src/pages/reservation/index.astro
- apps/web/src/pages/reservation/[id].astro
- apps/web/test/components/reservation.test.tsx

📈 Quality Metrics:
✅ Test Coverage: 94% (target: ≥90%)
✅ Type Safety: 100% TypeScript strict mode
✅ Performance: API responses avg 145ms
✅ Security: Authentication and authorization implemented

🚀 Entity ready for production use
```text

---

## Common Entity Types

### Business Entities

**Examples**: Reservation, Review, Payment, Notification

**Characteristics**:

- Complex business logic
- Multiple relationships
- Workflow states
- Audit requirements

### Reference Entities

**Examples**: Location, Amenity, Category, Tag

**Characteristics**:

- Simple structure
- Mostly read operations
- Caching beneficial
- Admin-managed data

### System Entities

**Examples**: AuditLog, Configuration, UserSession

**Characteristics**:

- System-level operations
- Security-sensitive
- Performance-critical
- Limited user access

---

## Integration Considerations

### Existing Entity Relationships

**Common Relationships**:

- User ↔ Entity (ownership)
- Accommodation ↔ Entity (association)
- Booking ↔ Entity (transaction relationship)

**Implementation**:

- Foreign key constraints
- Proper index creation
- Cascade delete policies
- Relationship validation

### API Integration

**Endpoint Patterns**:

- `/api/{entity}s` - Collection operations
- `/api/{entity}s/{id}` - Individual operations
- `/api/users/{userId}/{entity}s` - User-scoped operations
- `/api/accommodations/{accommodationId}/{entity}s` - Accommodation-scoped

### Frontend Integration

**Navigation Integration**:

- Add to main navigation
- Breadcrumb updates
- Search integration
- Filter/sort options

---

## Related Commands

- `/start-feature-plan` - For complex entity planning
- `/quality-check` - Entity validation
- `/review-code` - Code quality verification
- `/update-docs` - Documentation updates

---

## When to Use

- **New Domain Concepts**: Adding new business entities
- **Data Model Extension**: Expanding existing functionality
- **Feature Development**: Entity-centric feature implementation
- **System Enhancement**: Adding new data structures

---

## Prerequisites

- Entity requirements clearly defined
- Relationships with existing entities identified
- Business rules documented
- UI/UX design for entity management

---

## Post-Command Actions

1. **Integration Testing**: Test entity with existing system
2. **Documentation Review**: Ensure all documentation complete
3. **Performance Testing**: Validate entity performance
4. **User Acceptance**: Validate entity meets requirements

---

## Best Practices

### Naming Conventions

- **Entities**: PascalCase (e.g., `UserReservation`)
- **Database Tables**: snake_case (e.g., `user_reservations`)
- **API Endpoints**: kebab-case (e.g., `/user-reservations`)
- **Files**: kebab-case (e.g., `user-reservation.service.ts`)

### Implementation Order

1. **Database Schema**: Foundation for all layers
2. **Model Layer**: Data access patterns
3. **Service Layer**: Business logic implementation
4. **API Layer**: External interface
5. **Frontend Layer**: User interface

### Testing Strategy

- **Unit Tests**: Each layer independently
- **Integration Tests**: Layer interactions
- **API Tests**: Endpoint behavior
- **Component Tests**: UI functionality
- **E2E Tests**: Complete workflows


---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
