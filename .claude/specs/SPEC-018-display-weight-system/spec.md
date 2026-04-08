---
spec-id: SPEC-018
title: Display Weight System for Amenities, Features, and Attractions
type: feature
complexity: medium
status: completed
created: 2026-02-23T12:00:00.000Z
approved: 2026-02-23T12:00:00.000Z
---

## SPEC-018: Display Weight System for Amenities, Features, and Attractions

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Add a `displayWeight` integer field (range 1-100, default 50) to amenities, features, and attractions. Higher values indicate higher importance and are shown first. This allows administrators to control which items appear on accommodation and destination cards when only a subset can be displayed.

#### Motivation

Accommodation cards on the web app currently show 6 amenities and features combined using a naive `.slice(0, 6)` without any ordering. Destination cards show attractions with similar lack of prioritization. There is no way to control which items a visitor sees first. Adding a display weight field gives administrators a simple, intuitive knob to ensure the most relevant or representative items surface at the top when display space is limited.

#### Success Metrics

- `displayWeight` field present and enforced (1-100, NOT NULL, default 50) in the `amenities`, `features`, and `attractions` database tables
- All 90 amenity seed records, 80 feature seed records, and 88 attraction seed records include curated `displayWeight` values
- Accommodation card on the web app shows the top-6 items ordered by `displayWeight` DESC
- Destination card on the web app shows attractions ordered by `displayWeight` DESC
- Admin panel exposes `displayWeight` in list views, create/edit forms, and detail views for all three entity types
- API endpoints accept and return `displayWeight` for amenities, features, and attractions

#### Target Users

- Platform administrators configuring which amenities, features, and attractions stand out on cards
- Visitors who benefit from seeing the most relevant highlights without administrative context

### 2. User Stories & Acceptance Criteria

#### US-01: Admin Configures Display Weight for an Amenity

**As an** administrator,
**I want to** set a display weight on each amenity,
**so that** the most important amenities appear first on accommodation cards when space is limited.

**Acceptance Criteria:**

- **Given** the amenity create form, **When** the admin fills it in, **Then** a numeric `Display Weight` field is present, pre-populated with the value 50, and accepts integers between 1 and 100 inclusive
- **Given** the amenity edit form, **When** the admin opens an existing amenity, **Then** the current `displayWeight` value is shown in the field
- **Given** the admin submits an amenity form with a `displayWeight` outside 1-100, **When** validation runs, **Then** the form shows an inline error message and does not submit
- **Given** the amenity list table in the admin panel, **When** the admin views it, **Then** a `Display Weight` column is present showing the value for each row
- **Given** the amenity detail/view page, **When** the admin opens it, **Then** the `displayWeight` value is displayed

#### US-02: Admin Configures Display Weight for a Feature

**As an** administrator,
**I want to** set a display weight on each feature,
**so that** the most representative features appear first on accommodation cards.

**Acceptance Criteria:**

- **Given** the feature create form, **When** the admin fills it in, **Then** a numeric `Display Weight` field is present, pre-populated with 50, and accepts integers between 1 and 100 inclusive
- **Given** the feature edit form, **When** the admin opens an existing feature, **Then** the current `displayWeight` value is shown in the field
- **Given** the admin submits a feature form with a `displayWeight` outside 1-100, **When** validation runs, **Then** the form shows an inline error and does not submit
- **Given** the feature list table, **When** the admin views it, **Then** a `Display Weight` column is present
- **Given** the feature detail page, **When** the admin opens it, **Then** the `displayWeight` value is displayed

#### US-03: Admin Configures Display Weight for an Attraction

**As an** administrator,
**I want to** set a display weight on each attraction,
**so that** the most notable attractions appear first on destination cards.

**Acceptance Criteria:**

- **Given** the attraction create form, **When** the admin fills it in, **Then** a numeric `Display Weight` field is present, pre-populated with 50, and accepts integers between 1 and 100 inclusive
- **Given** the attraction edit form, **When** the admin opens an existing attraction, **Then** the current `displayWeight` value is shown in the field
- **Given** the admin submits an attraction form with a `displayWeight` outside 1-100, **When** validation runs, **Then** the form shows an inline error and does not submit
- **Given** the attraction list table, **When** the admin views it, **Then** a `Display Weight` column is present
- **Given** the attraction detail page, **When** the admin opens it, **Then** the `displayWeight` value is displayed

#### US-04: Accommodation Card Prioritizes High-Weight Items

**As a** visitor viewing an accommodation card,
**I want to** see the most important amenities and features highlighted,
**so that** the card gives me the most relevant information about the accommodation at a glance.

**Acceptance Criteria:**

- **Given** an accommodation with more than 6 combined amenities and features, **When** the accommodation card renders, **Then** the 6 items shown are those with the highest `displayWeight` values (ties broken by alphabetical name or insertion order)
- **Given** an accommodation with 6 or fewer combined amenities and features, **When** the accommodation card renders, **Then** all items are shown and ordering by `displayWeight` DESC is still applied
- **Given** an accommodation with amenities and features having mixed `displayWeight` values (e.g., 90, 70, 50, 50, 30, 10), **When** the card renders, **Then** items appear ordered highest-to-lowest weight, not in random or insertion order
- **Given** an accommodation with no amenities or features, **When** the card renders, **Then** the amenities/features section is empty or hidden (no change from existing behavior)

#### US-05: Destination Card Prioritizes High-Weight Attractions

**As a** visitor viewing a destination card,
**I want to** see the most notable attractions listed first,
**so that** I get the best overview of what the destination offers.

**Acceptance Criteria:**

- **Given** a destination with multiple attractions, **When** the destination card renders, **Then** attractions are displayed ordered by `displayWeight` DESC
- **Given** a destination with more attractions than the card can display, **When** the card renders, **Then** only the highest-weight attractions fill the available slots
- **Given** a destination with no attractions, **When** the card renders, **Then** no change in behavior from the current empty state

#### US-06: API Exposes Display Weight

**As a** developer consuming the API,
**I want to** receive `displayWeight` in amenity, feature, and attraction responses,
**so that** client applications can use the value for their own sorting or display logic.

**Acceptance Criteria:**

- **Given** a `GET` request to retrieve an amenity by ID, **When** the response is returned, **Then** `displayWeight` is present as an integer in the response body
- **Given** a `GET` request to list amenities, **When** the response is returned, **Then** each item includes `displayWeight`
- **Given** a `POST` or `PUT` request to create or update an amenity with a valid `displayWeight`, **When** the request is accepted, **Then** the value is persisted and returned in the response
- **Given** a `POST` or `PUT` request with `displayWeight` absent, **When** the request is processed, **Then** the field defaults to 50 and the response reflects that default
- **Given** a `POST` or `PUT` request with `displayWeight` set to 0 or 101, **When** the request is validated, **Then** a 400 error is returned with a descriptive message
- **Given** the same behavior above applies symmetrically to features and attractions

#### US-07: Pre-seeded Data Reflects Curated Priorities

**As an** administrator setting up the platform for the first time,
**I want** the seed data to have meaningful `displayWeight` values already configured,
**so that** accommodation and destination cards display sensible highlights out of the box without manual configuration.

**Acceptance Criteria:**

- **Given** the database is seeded, **When** amenities are queried ordered by `displayWeight` DESC, **Then** fundamental amenities (e.g., Wi-Fi, pool, air conditioning) appear before ancillary ones (e.g., electric blankets, soap dispensers)
- **Given** the database is seeded, **When** features are queried ordered by `displayWeight` DESC, **Then** high-impact features (e.g., river front, panoramic view) appear before niche ones (e.g., no TV area)
- **Given** the database is seeded, **When** attractions are queried ordered by `displayWeight` DESC, **Then** landmark attractions appear before minor points of interest
- **Given** any seeded amenity, feature, or attraction, **When** inspected, **Then** its `displayWeight` is an integer between 1 and 100 inclusive

### 3. UX Considerations

#### User Flows

1. **Admin sets display weight for an amenity**: Admin navigates to amenities list.. clicks edit on an amenity.. sees the Display Weight field pre-filled with current value.. adjusts the number.. saves.. the list table reflects the updated value
2. **Visitor views an accommodation card**: Card is rendered server-side.. amenities and features are already sorted by `displayWeight` DESC.. visitor sees the top-6 most important items without any user action required
3. **Visitor views a destination card**: Card is rendered server-side.. attractions are already sorted by `displayWeight` DESC.. most notable attractions shown first

#### Edge Cases

- Accommodation with all amenities/features at the same `displayWeight` (all 50): the existing slicing behavior is preserved since all items are equally weighted. Tie-breaking should be deterministic (e.g., by name alphabetically or by ID)
- Administrator enters a decimal number (e.g., 4.5) in the display weight field: the form should validate the field as integers only and reject non-integer input
- Administrator clears the display weight field entirely: the form should treat an empty value as invalid and require the admin to enter a value (field is required)
- Seed values are 1-100: no seed record should have a `displayWeight` of 0 or above 100

#### Error States

- Admin form with invalid `displayWeight` (out of range or non-integer): inline validation error message displayed beside the field, form submission blocked
- API request with invalid `displayWeight`: 400 response with a message indicating the field must be an integer between 1 and 100

#### Loading States

- No additional loading states are introduced. The `displayWeight` field is part of the same data load as other entity properties in the admin panel forms
- On the web app, ordering is applied server-side before the card component receives data, so no client-side loading change is needed

#### Accessibility

- Admin form field: labeled with `<label>` associated via `for`/`id`, includes `min="1"` and `max="100"` attributes on the `<input type="number">`, and `aria-describedby` pointing to the validation message when an error is present
- Admin list column: standard table column header with visible label "Display Weight"
- Web card: the ordering change is purely presentational and requires no additional ARIA changes

### 4. Out of Scope

- Per-relationship weight override: configuring a different `displayWeight` for a specific amenity-accommodation pair (junction table weight). This is deferred to v2.
- Per-destination or per-accommodation weight override for attractions or features. The weight is global to the entity (amenity, feature, attraction), not contextual.
- Drag-and-drop ordering UI in the admin panel. The weight is set as a numeric field.
- Sorting amenities or features in the admin list by `displayWeight` column (basic column sort may already exist via existing list patterns; no special sorting behavior beyond that is required).
- Changes to the destination detail page or the accommodations listing page sorting beyond the card components specified.
- Automatic weight suggestions or AI-assisted weight assignment.
- Exposing `displayWeight` as a filterable or sortable parameter on public API endpoints (it is returned in responses but the public API does not need to sort by it server-side for listing endpoints beyond the existing accommodation/destination card use cases).

---

## Part 2 - Technical Analysis

### 1. Architecture

#### Pattern

- Database migration adds one column to three tables (no schema redesign)
- Zod schemas extended in the existing per-entity schema files
- Service-core ordering applied at the query level (ORDER BY display_weight DESC) for the methods that return amenities/features for an accommodation and attractions for a destination
- Admin panel uses existing `createEntityHooks` and form field patterns. Only field config and column config need updating
- Web app sorting change is a one-line sort before slice in `AccommodationCard` and the destination card component

#### Packages and Apps Affected

| Layer | Artifact | Change Type |
|-------|----------|-------------|
| `packages/db` | `amenities`, `features`, `attractions` tables | Add `display_weight` column + migration |
| `packages/schemas` | `AmenitySchema`, `FeatureSchema`, `AttractionSchema` | Add `displayWeight` field |
| `packages/schemas` | Create/update input schemas for the three entities | Add optional `displayWeight` with default 50 |
| `packages/schemas` | HTTP response schemas for the three entities | Include `displayWeight` |
| `packages/seed` | 90 amenity files, 80 feature files, 88 attraction files | Add `displayWeight` integer value |
| `packages/service-core` | Destination service (attractions query) | Add ORDER BY display_weight DESC |
| `packages/service-core` | Accommodation service (amenities + features query) | Add ORDER BY display_weight DESC |
| `apps/api` | Amenity, Feature, Attraction create/update/get routes | Pass through `displayWeight` field |
| `apps/admin` | Amenity, Feature, Attraction list configs | Add `displayWeight` column |
| `apps/admin` | Amenity, Feature, Attraction form configs | Add `displayWeight` field (number, 1-100) |
| `apps/web` | `AccommodationCard` component | Sort combined list by `displayWeight` DESC before slice |
| `apps/web` | Destination card component(s) | Sort attractions by `displayWeight` DESC |

#### Data Flow

```
Admin sets displayWeight
  |-- Form submits to API (POST/PUT amenity|feature|attraction)
  |-- API validates with Zod schema (1-100 range)
  |-- Service persists to DB column display_weight
  |-- Response includes displayWeight

Web card renders
  |-- API returns amenities + features (already ordered by display_weight DESC from DB)
  |-- AccommodationCard combines, sorts by displayWeight DESC, slices to 6
  |-- DestinationCard renders attractions pre-sorted by display_weight DESC
```

### 2. Data Model Changes

#### Database Schema Changes

Three tables modified. Same column added to each:

**`amenities` table:**

```sql
ALTER TABLE amenities
  ADD COLUMN display_weight INTEGER NOT NULL DEFAULT 50;
```

**`features` table:**

```sql
ALTER TABLE features
  ADD COLUMN display_weight INTEGER NOT NULL DEFAULT 50;
```

**`attractions` table:**

```sql
ALTER TABLE attractions
  ADD COLUMN display_weight INTEGER NOT NULL DEFAULT 50;
```

One Drizzle migration file generated via `pnpm db:generate`.

#### Drizzle Model Changes

Each model (`amenity.model.ts`, `feature.model.ts`, `attraction.model.ts`) gains:

```typescript
displayWeight: integer('display_weight').notNull().default(50),
```

#### Schema Changes (packages/schemas)

Each entity schema (`AmenitySchema`, `FeatureSchema`, `AttractionSchema`) gains:

```typescript
displayWeight: z.number().int().min(1).max(100).default(50),
```

Create input schemas: `displayWeight` optional, defaults to 50.
Update input schemas: `displayWeight` optional (only updated if provided).
HTTP response schemas: `displayWeight` required integer.

### 3. API Design

No new endpoints. Existing endpoints modified to include `displayWeight`:

**`GET /api/v1/admin/amenities`** - Each item includes `displayWeight`
**`GET /api/v1/admin/amenities/:id`** - Response includes `displayWeight`
**`POST /api/v1/admin/amenities`** - Accepts `displayWeight` (optional, default 50)
**`PUT /api/v1/admin/amenities/:id`** - Accepts `displayWeight` (optional)
**`PATCH /api/v1/admin/amenities/:id`** - Accepts `displayWeight` (optional)

Same pattern for features and attractions under their respective admin routes.

**Public routes** (`/api/v1/public/`) that return amenities, features, or attractions as nested data (e.g., accommodation details, destination details) also include `displayWeight` in responses since it comes from the same schema. No separate change needed for public routes beyond the schema propagation.

**Validation error response (400) example:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "displayWeight must be an integer between 1 and 100"
  }
}
```

### 4. Service-Core Ordering Changes

Two service methods require explicit ORDER BY:

1. **Accommodation amenities + features query**: When the service fetches amenities and features joined through the junction tables for a given accommodation, it must add `ORDER BY display_weight DESC` on the base table join.

2. **Destination attractions query**: When the service fetches attractions joined through the destination-attraction junction table, it must add `ORDER BY display_weight DESC` on the `attractions` table.

No new service methods. No changes to junction tables.

### 5. Admin Panel Changes

#### List Tables

Each of the three entity list tables (`amenities.config.ts`, `features.config.ts`, `attractions.config.ts`) adds one column definition:

```typescript
{
  key: 'displayWeight',
  label: 'Display Weight',
  sortable: true,
}
```

#### Forms

Each entity's create and edit form config adds one field:

```typescript
{
  name: 'displayWeight',
  label: 'Display Weight',
  type: 'number',
  min: 1,
  max: 100,
  defaultValue: 50,
  required: true,
  description: 'Higher values appear first on cards (1-100)',
}
```

#### Detail/View Pages

The `displayWeight` value is rendered as a labeled read-only field alongside other entity properties.

### 6. Web App Changes

#### AccommodationCard

Current code (approximately):

```typescript
const displayItems = [...amenities, ...features].slice(0, 6);
```

New code:

```typescript
const displayItems = [...amenities, ...features]
  .sort((a, b) => b.displayWeight - a.displayWeight)
  .slice(0, 6);
```

#### Destination Card Component(s)

Attractions already arrive from the API in `displayWeight` DESC order (enforced at the service layer). The card component renders them in the order received. If any client-side filtering or re-ordering was previously applied, it is replaced by trusting the API-ordered list.

### 7. Seed Data Strategy

Each of the 258 seed files (90 amenities + 80 features + 88 attractions) gains a `displayWeight` integer field. Values are curated by domain relevance:

- **Amenities**: Core connectivity and comfort (Wi-Fi, pool, A/C, full kitchen) get weights in the 80-100 range. Basic conveniences (towels, linens, coffee maker) get 50-79. Specialized or niche items (baby monitor, organic garden, motorhome parking) get 20-49. Very specific items (soap dispensers, international adapters) get 1-19.
- **Features**: Landmark characteristics (river front, panoramic view, spa front) get 80-100. Guest type compatibility (family, couples, pets) gets 60-79. Style and environment descriptors get 40-59. Operational details (minimum stay, no cell signal) get 1-39.
- **Attractions**: Iconic regional attractions get 80-100. Well-known venues get 60-79. General points of interest get 40-59. Minor or niche attractions get 1-39.

### 8. Dependencies

**External (new):** None.

**Internal changes:**

- `packages/db`: migration + model updates for 3 tables
- `packages/schemas`: schema updates for 3 entities
- `packages/seed`: data updates for 258 files
- `packages/service-core`: ordering logic in accommodation and destination services
- `apps/api`: field passthrough (handled by schema propagation, minimal explicit change)
- `apps/admin`: list + form + detail config updates for 3 entities
- `apps/web`: one-line sort change in 1-2 components

### 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration affects existing data (all rows get default 50) | Certain | Low | Default 50 is correct and intentional. Seed data overrides for fresh installs. Existing production rows need manual weight review post-deploy if accuracy matters immediately |
| Seed file count is large (258 files) | Certain | Medium | Use a scripted approach or batch edit; each file only needs one new integer field added |
| Service-layer ORDER BY changes affect query performance | Low | Low | `display_weight` column has low cardinality but is indexed as part of a base table scan. Add a simple index if profiling shows degradation |
| Web app sort is done client-side (potential inconsistency if API already sorts) | Medium | Low | Clarify ownership: either service always returns sorted data and web trusts it, or web always re-sorts. Document the chosen approach clearly in code comments to avoid double-sort confusion |
| Admin users set all amenities to weight 100 (negating the system) | Low | Low | Out of scope to enforce uniqueness. The system is advisory. Document intended usage |

### 10. Performance Considerations

- ORDER BY on `display_weight` is applied to small sets (accommodation has at most ~90 amenities; destination has a limited number of attractions). No pagination concern.
- Adding an index on `display_weight` to each of the three tables is optional but recommended if list queries in the admin panel use it for server-side sorting.
- The web app client-side sort (`.sort()`) runs on an array of at most 90 items. Negligible cost.
- No new API calls introduced. No new network round trips.

---

## Implementation Approach

### Phase 1: Database and Schema Foundation

1. Add `display_weight` column to `amenities`, `features`, `attractions` Drizzle models
2. Generate and apply migration with `pnpm db:generate && pnpm db:migrate`
3. Add `displayWeight` field to `AmenitySchema`, `FeatureSchema`, `AttractionSchema` in `packages/schemas`
4. Update create/update/patch input schemas with optional `displayWeight` (default 50, range 1-100)
5. Update HTTP response schemas to include `displayWeight`
6. Write schema unit tests (valid range, invalid range, default value behavior)

### Phase 2: Seed Data

7. Add `displayWeight` values to all 90 amenity seed JSON files
8. Add `displayWeight` values to all 80 feature seed JSON files
9. Add `displayWeight` values to all 88 attraction seed JSON files
10. Run `pnpm db:fresh` to verify seed applies without errors

### Phase 3: Service-Core Ordering

11. Update the accommodation service method that returns amenities to ORDER BY `display_weight` DESC
12. Update the accommodation service method that returns features to ORDER BY `display_weight` DESC
13. Update the destination service method that returns attractions to ORDER BY `display_weight` DESC
14. Write service unit tests verifying returned items are in descending weight order

### Phase 4: API Passthrough

15. Verify amenity create/update routes accept and return `displayWeight` (schema propagation should handle this; manual verification + integration test)
16. Verify feature create/update routes accept and return `displayWeight`
17. Verify attraction create/update routes accept and return `displayWeight`
18. Write API integration tests for create/update with `displayWeight` in range, below range, and above range

### Phase 5: Admin Panel

19. Add `displayWeight` column to amenity list table config
20. Add `displayWeight` field to amenity create/edit form config
21. Add `displayWeight` to amenity detail view
22. Repeat steps 19-21 for features
23. Repeat steps 19-21 for attractions
24. Write admin form validation tests (accepts 1, accepts 100, rejects 0, rejects 101, rejects empty)

### Phase 6: Web App

25. Update `AccommodationCard` to sort combined amenities + features by `displayWeight` DESC before `.slice(0, 6)`
26. Update destination card component(s) to rely on API-ordered attractions (remove any existing arbitrary ordering)
27. Write unit tests verifying the top-6 items in `AccommodationCard` are the highest-weight items
28. Write unit test verifying destination card renders attractions in received order (weight ordering validated at service level)

### Phase 7: Polish and Cleanup

29. Run `pnpm typecheck` and resolve any type errors introduced by the new field
30. Run `pnpm lint` and resolve any linting issues
31. Run full test suite (`pnpm test`) and ensure minimum 90% coverage is maintained
32. Manual verification: create an amenity with weight 90 and one with weight 10, assign both to an accommodation, confirm the 90-weight item appears first on the card

### Testing Strategy

**Unit Tests (packages/schemas):**

- `displayWeight` accepts 1 (minimum boundary)
- `displayWeight` accepts 100 (maximum boundary)
- `displayWeight` rejects 0 (below minimum)
- `displayWeight` rejects 101 (above maximum)
- `displayWeight` rejects non-integer (e.g., 4.5)
- `displayWeight` defaults to 50 when absent from create input

**Unit Tests (packages/service-core):**

- Accommodation amenities returned in `displayWeight` DESC order
- Accommodation features returned in `displayWeight` DESC order
- Destination attractions returned in `displayWeight` DESC order
- Items with equal `displayWeight` are returned in a deterministic order

**Integration Tests (apps/api):**

- `POST /admin/amenities` with valid `displayWeight` returns it in response
- `POST /admin/amenities` without `displayWeight` returns default 50
- `POST /admin/amenities` with `displayWeight: 0` returns 400
- `POST /admin/amenities` with `displayWeight: 101` returns 400
- Same three tests for features and attractions

**Unit Tests (apps/web):**

- `AccommodationCard` with 10 items: top 6 by `displayWeight` are rendered, items 7-10 are not
- `AccommodationCard` with 4 items: all 4 rendered in descending weight order
- `AccommodationCard` with 0 items: empty/hidden section rendered correctly

**Manual Testing Checklist:**

- [ ] Run `pnpm db:fresh` and confirm no migration errors
- [ ] Create amenity via admin with weight 95, confirm list shows 95
- [ ] Edit amenity weight to 5, confirm list updates
- [ ] Submit amenity form with weight 0, confirm validation error
- [ ] Submit amenity form with weight 101, confirm validation error
- [ ] Assign a weight-90 amenity and a weight-10 amenity to an accommodation, view card, confirm weight-90 appears first
- [ ] Confirm destination card attractions are ordered highest-weight first
