# Review Code Command

## Purpose

Comprehensive code quality review analyzing architecture, patterns, maintainability, and best practices. REPORTS all findings without stopping execution to provide complete feedback.

## Usage

```bash
/review-code
```text

## Description

Performs thorough code quality analysis using specialized review agents. Uses **REPORT all findings** strategy to provide comprehensive feedback on code quality, architecture consistency, and adherence to project standards.

---

## Execution Flow

### Step 1: Backend Code Review

**Agent**: `backend-reviewer`

**Scope**:

- `apps/api/` - Hono API implementation
- `packages/service-core/` - Business logic services
- `packages/db/` - Database models and schemas

**Review Areas**:

- API route implementation and patterns
- Service layer architecture and business logic
- Database model design and queries
- Type safety and error handling
- Authentication and authorization
- Testing coverage and quality

**Analysis Focus**:

- Route factory pattern compliance
- Service extension of `BaseCrudService`
- Model extension of `BaseModel`
- RO-RO pattern implementation
- Zod schema usage and validation

### Step 2: Frontend Code Review

**Agent**: `frontend-reviewer`

**Scope**:

- `apps/web/` - Astro + React frontend
- `apps/admin/` - TanStack Start admin dashboard
- `packages/auth-ui/` - Authentication components

**Review Areas**:

- Component architecture and design
- State management patterns
- Type safety with TypeScript
- Accessibility compliance
- Performance optimization
- User experience patterns

**Analysis Focus**:

- React 19 best practices
- Astro integration patterns
- TanStack query usage
- Component reusability
- Responsive design implementation

### Step 3: Architecture Validation

**Agent**: `architecture-validator`

**Scope**: Entire codebase

**Review Areas**:

- Layer separation and boundaries
- Dependency management
- Package organization
- Interface design
- Pattern consistency

**Analysis Focus**:

- Monorepo structure compliance
- Package interdependencies
- Architectural pattern adherence
- SOLID principles implementation
- Design pattern consistency

---

## Quality Assessment Criteria

### Code Quality Standards

#### TypeScript Implementation

- ✅ **Strict Mode**: TypeScript strict mode enabled
- ✅ **Type Safety**: No `any` types, proper type definitions
- ✅ **Import Organization**: Clean, organized imports
- ✅ **Named Exports**: Consistent use of named exports only

#### Architecture Patterns

- ✅ **Layer Separation**: Clear Model → Service → API boundaries
- ✅ **Base Classes**: Proper extension of base classes
- ✅ **Factory Patterns**: Route factories used consistently
- ✅ **RO-RO Pattern**: Functions receive/return objects

#### Error Handling

- ✅ **Consistent Errors**: `ServiceError` with `ServiceErrorCode`
- ✅ **Proper Validation**: Zod schemas for all inputs
- ✅ **Error Propagation**: Proper error handling through layers
- ✅ **User-Friendly Messages**: Clear error messages for users

### Backend Quality Standards

#### API Implementation

- ✅ **Route Structure**: Proper factory pattern usage
- ✅ **Middleware**: Authentication, validation, rate limiting
- ✅ **Response Format**: Consistent API response structure
- ✅ **Documentation**: OpenAPI/Swagger documentation

#### Service Layer

- ✅ **Business Logic**: Proper service layer implementation
- ✅ **Transaction Handling**: Database transactions where needed
- ✅ **Dependency Injection**: Clean dependency management
- ✅ **Test Coverage**: ≥ 90% coverage for business logic

#### Database Layer

- ✅ **Schema Design**: Proper relationships and constraints
- ✅ **Query Optimization**: Efficient database queries
- ✅ **Migration Strategy**: Clean, rollback-able migrations
- ✅ **Indexing**: Proper database indexing

### Frontend Quality Standards

#### Component Design

- ✅ **Reusability**: Components designed for reuse
- ✅ **Props Interface**: Clear, typed component interfaces
- ✅ **State Management**: Appropriate state management patterns
- ✅ **Performance**: Optimized rendering and re-renders

#### User Experience

- ✅ **Accessibility**: WCAG AA compliance
- ✅ **Responsive Design**: Mobile-first responsive design
- ✅ **Loading States**: Proper loading and error states
- ✅ **User Feedback**: Clear user feedback and interactions

---

## Output Format

### Success Case

```text
✅ CODE REVIEW COMPLETE - HIGH QUALITY

Backend Review (backend-reviewer):
✅ API Routes: Excellent pattern compliance
✅ Service Layer: Clean business logic separation
✅ Database Layer: Well-designed schemas and queries
✅ Type Safety: Strict TypeScript implementation
✅ Error Handling: Consistent error patterns

Frontend Review (frontend-reviewer):
✅ Component Architecture: Well-structured, reusable components
✅ State Management: Proper TanStack query usage
✅ Accessibility: WCAG AA compliant
✅ Performance: Optimized bundle size and rendering
✅ User Experience: Intuitive and responsive design

Architecture Review (architecture-validator):
✅ Layer Separation: Clean boundaries maintained
✅ Package Organization: Logical monorepo structure
✅ Pattern Consistency: SOLID principles followed
✅ Dependency Management: Clean package interdependencies

🚀 Code quality meets highest standards
```text

### Issues Found Case

```text
⚠️ CODE REVIEW - ISSUES IDENTIFIED

Backend Review (backend-reviewer):
❌ CRITICAL: Type safety violation in AccommodationService
   File: packages/service-core/src/services/accommodation/accommodation.service.ts:45
   Issue: Using 'any' type for database result
   Fix: Add proper type definition for query result

⚠️ MEDIUM: Missing error handling in BookingController
   File: apps/api/src/routes/bookings/index.ts:78
   Issue: No try-catch around service call
   Fix: Add proper error handling with ServiceError

ℹ️ LOW: Inconsistent import organization
   File: apps/api/src/routes/payments/webhook.ts
   Issue: Mixed import statement ordering
   Fix: Run lint --fix to organize imports

Frontend Review (frontend-reviewer):
❌ CRITICAL: Accessibility violation in BookingForm
   File: apps/web/src/components/booking/BookingForm.tsx:23
   Issue: Missing aria-label on submit button
   Fix: Add descriptive aria-label

⚠️ MEDIUM: Performance issue in AccommodationList
   File: apps/web/src/components/accommodation/AccommodationList.tsx:67
   Issue: Unnecessary re-renders on filter change
   Fix: Memoize filter function with useCallback

Architecture Review (architecture-validator):
⚠️ MEDIUM: Layer boundary violation
   File: apps/api/src/routes/accommodations/create.ts:34
   Issue: Direct database call bypassing service layer
   Fix: Use AccommodationService.create() instead

Summary:

- Critical Issues: 2 (fix before merge)
- Medium Issues: 3 (address soon)
- Low Issues: 1 (nice to have)

🔧 Address critical issues before proceeding
```text

---

## Issue Categories

### Critical Issues (Must Fix)

- Type safety violations (`any` usage)
- Security vulnerabilities
- Accessibility violations
- Layer boundary violations
- Missing error handling for critical paths

### Medium Issues (Should Fix)

- Performance optimization opportunities
- Inconsistent pattern usage
- Missing test coverage
- Documentation gaps
- Code smell patterns

### Low Issues (Nice to Fix)

- Code style inconsistencies
- Import organization
- Minor refactoring opportunities
- Optimization suggestions

---

## Review Depth by Package

### API Package (`apps/api/`)

**Review Focus**:

- Route implementation patterns
- Middleware configuration
- Authentication/authorization
- Request/response handling
- Error propagation

**Key Patterns**:

- `createSimpleRoute()`, `createCRUDRoute()`, `createListRoute()`
- Zod validation with `zValidator()`
- Actor context handling
- Service layer integration

### Service Core Package (`packages/service-core/`)

**Review Focus**:

- Business logic implementation
- Service layer patterns
- Data validation
- Transaction handling
- Error management

**Key Patterns**:

- `BaseCrudService` extension
- RO-RO pattern implementation
- `ServiceError` usage
- Dependency injection

### Database Package (`packages/db/`)

**Review Focus**:

- Schema design
- Model implementation
- Query optimization
- Migration quality
- Relationship management

**Key Patterns**:

- `BaseModel` extension
- Drizzle ORM usage
- Proper indexing
- Transaction handling

### Frontend Packages (`apps/web/`, `apps/admin/`)

**Review Focus**:

- Component architecture
- State management
- Type safety
- User experience
- Accessibility

**Key Patterns**:

- React 19 features usage
- TanStack query integration
- Responsive design
- Error boundary implementation

---

## Related Commands

- `/quality-check` - Includes code review + other validations
- `/review-security` - Security-focused analysis
- `/review-performance` - Performance-focused analysis
- `/code-check` - Lint and typecheck validation

---

## When to Use

- **Part of**: `/quality-check` comprehensive validation
- **Before Merge**: Final code quality assessment
- **During Development**: Periodic quality feedback
- **Code Review Process**: Before team code review

---

## Prerequisites

- All code changes committed
- Code compiles without errors
- Basic lint and typecheck passes

---

## Post-Command Actions

**If No Issues**: Proceed with confidence

**If Issues Found**:

1. **Critical Issues**: Fix immediately before proceeding
2. **Medium Issues**: Plan fixes in near term
3. **Low Issues**: Consider addressing during refactoring

**Documentation**: Update code quality learnings in CLAUDE.md

---

## Review Consistency

### Pattern Validation

- Factory pattern usage in routes
- Base class extension patterns
- Error handling consistency
- Import organization standards

### Architecture Validation

- Layer separation maintenance
- Package dependency respect
- Interface design quality
- SOLID principle adherence

### Quality Metrics

- Type safety compliance
- Test coverage adequacy
- Documentation completeness
- Performance consideration

