# SPEC-001: Hospeda Platform Monetization System

## Spec Metadata

- **Spec ID**: SPEC-001
- **Title**: Hospeda Platform Monetization System
- **Type**: feature
- **Complexity**: high
- **Status**: approved

---

## Part 1: Functional Specification

### 1. Overview and Goals

**Goal**: Implement a complete monetization system for the Hospeda tourism platform using the qzpay billing library, enabling subscription plans for property owners, complexes, and tourists, plus add-ons, sponsorships, promo codes, and admin management.

**Motivation**: Hospeda needs revenue streams to sustain the platform. Property owners pay for listing visibility and features, tourists optionally upgrade for premium experiences, and external sponsors pay for event/post visibility.

**Success Metrics**:

- All 9 subscription plans configurable and purchasable via Mercado Pago
- Trial flow working (14 days, no credit card, auto-block on expiry)
- Entitlement-gated features enforced across web and admin apps
- Add-ons purchasable (one-time and recurring)
- Sponsorship system operational (events + posts)
- Admin panel fully manages all billing entities
- Promo codes functional with all condition types

**Target Users**:

- Property Owners (individual) - 3 paid plans
- Complex Operators (hotels/multi-property) - 3 paid plans
- Tourists - Free + 2 premium plans
- Sponsors (internal users + external businesses) - Sponsorship purchases
- Admins - Full billing management

### 2. User Stories and Acceptance Criteria

#### US-001: Owner Registration and Trial

```
GIVEN a new property owner registers on Hospeda
WHEN their account is created
THEN a 14-day trial of the Owner Basico plan starts automatically
AND no credit card is required
AND they can publish 1 accommodation with 5 photos
AND they see a trial countdown in their dashboard
```

#### US-002: Owner Subscription Purchase

```
GIVEN an owner's trial has expired (or they want to upgrade)
WHEN they select a plan (Basico/Pro/Premium)
THEN they are redirected to Mercado Pago Checkout Pro
AND upon successful payment their subscription activates immediately
AND their entitlements and limits update to match the new plan
```

#### US-003: Owner Trial Expiry Block

```
GIVEN an owner's 14-day trial has expired
AND they have not subscribed to any plan
WHEN they try to access their dashboard
THEN they see a full-screen "Subscribe to continue" page
AND their accommodations are hidden from search results
AND their data is preserved (not deleted)
AND they can subscribe at any time to restore access
```

#### US-004: Owner Plan Upgrade/Downgrade

```
GIVEN an owner has an active subscription
WHEN they change to a different plan
THEN proration is calculated (upgrade: immediate, downgrade: at period end)
AND their entitlements update accordingly
AND they receive a confirmation email
```

#### US-005: Tourist Free Account

```
GIVEN a new tourist registers on Hospeda
WHEN their account is created
THEN they have the free plan by default (no trial, permanent free)
AND they can save up to 3 favorites
AND they can read and write reviews
AND they see advertisements
```

#### US-006: Tourist Premium Upgrade

```
GIVEN a tourist with a free account
WHEN they upgrade to Plus or VIP
THEN they are redirected to Mercado Pago Checkout Pro
AND upon payment their plan activates immediately
AND features unlock (favorites, alerts, no ads, etc.)
```

#### US-007: Entitlement Enforcement

```
GIVEN any user with a specific plan
WHEN they attempt to use a gated feature
THEN the system checks their entitlements via qzpay
AND allows or blocks the action accordingly
AND blocked actions show a clear upgrade prompt
```

#### US-008: Limit Enforcement

```
GIVEN an owner trying to publish a new accommodation
WHEN they have reached their plan's max_accommodations limit
THEN the system blocks the creation
AND shows a message indicating the limit and upgrade options
```

#### US-009: Add-on Purchase (One-time)

```
GIVEN an owner wants to boost their listing visibility
WHEN they purchase a "Boost de visibilidad (7 dias)"
THEN they pay ARS $5,000 via Mercado Pago
AND their listing receives boosted visibility for 7 days
AND the boost expires automatically after the period
```

#### US-010: Add-on Purchase (Recurring)

```
GIVEN an owner wants extra photos monthly
WHEN they subscribe to "Pack fotos extra (+20 fotos)"
THEN they pay ARS $5,000/month via Mercado Pago
AND their max_photos_per_accommodation limit increases by 20
AND the add-on renews automatically each month
AND they can cancel at any time
```

#### US-011: Promo Code Application

```
GIVEN a user is checking out for a subscription
WHEN they enter a valid promo code (e.g., LANZAMIENTO50)
THEN the discount is applied and shown in the checkout
AND the code's usage count increments
AND conditions are validated (expiry, max uses, plan restrictions)
```

#### US-012: HOSPEDA_FREE Code

```
GIVEN an admin creates a user with the HOSPEDA_FREE promo code
WHEN applied to any subscription
THEN the user gets 100% permanent discount
AND the subscription shows as active with $0 billing
AND no payment method is required
```

#### US-013: Event Sponsorship Purchase

```
GIVEN a sponsor (user or external business)
WHEN they purchase a Gold event sponsorship for ARS $20,000
THEN their logo/banner appears on the event page
AND their link is displayed
AND a discount coupon is generated for event attendees
AND they are mentioned in event newsletters
AND they can view analytics (impressions, clicks, coupons used)
```

#### US-014: Blog Post Sponsorship Purchase

```
GIVEN a sponsor
WHEN they purchase a Premium post sponsorship for ARS $6,000
THEN a "Sponsored by [Sponsor]" banner appears on the article
AND their link is displayed
AND they are mentioned in the newsletter
AND they can view analytics
```

#### US-015: Sponsorship Package (Monthly)

```
GIVEN a sponsor wants ongoing visibility
WHEN they subscribe to "Paquete Profesional" (5 posts + 2 Gold events)
THEN they pay ARS $35,000/month
AND they can assign sponsorships to specific posts/events each month
AND unused sponsorships do not roll over
```

#### US-016: External Sponsor Registration

```
GIVEN an external business wants to sponsor events/posts
WHEN the admin creates a SPONSOR user account for them
THEN they receive login credentials
AND they can only see their sponsorships, analytics, and invoices
AND the admin can create sponsorships on their behalf
```

#### US-017: Owner Promotions for VIP Tourists

```
GIVEN an owner with Pro or Premium plan
WHEN they create a promotion (e.g., "20% off weekdays")
THEN the promotion is visible only to tourists with VIP plan
AND the owner's active promotions count against their plan limit
```

#### US-018: Admin Plan Management

```
GIVEN an admin in the admin panel
WHEN they navigate to /admin/billing/plans
THEN they can CRUD all plans (texts, prices, limits, entitlements)
AND changes take effect for new subscriptions
AND existing subscriptions maintain their current terms until renewal
```

#### US-019: Admin Billing Metrics

```
GIVEN an admin in the admin panel
WHEN they navigate to /admin/billing/metrics
THEN they see MRR, churn rate, active subscriptions, revenue breakdown
AND data is provided by qzpay's MetricsService
```

#### US-020: Webhook Processing

```
GIVEN Mercado Pago sends an IPN webhook
WHEN the webhook is received at the API endpoint
THEN the signature is verified via qzpay-mercadopago
AND the event is processed (payment confirmed, subscription updated, etc.)
AND the event is logged in billing_webhook_events table
AND failed events are stored in billing_webhook_dead_letter
```

### 3. UX Considerations

**User Flows**:

- Owner: Register -> Trial (14d) -> Subscribe -> Use features -> Upgrade/Cancel
- Tourist: Register -> Free plan -> Optional upgrade -> Use features
- Sponsor: Admin creates account -> Login -> View/manage sponsorships
- Admin: Billing section -> Manage plans, subs, payments, promos, sponsorships

**Edge Cases**:

- Payment failure during checkout -> Show error, allow retry
- Webhook delivery failure -> Dead letter queue, admin notification
- Downgrade with over-limit content -> Content preserved but hidden until within limits
- Concurrent promo code use -> Atomic redemption count increment
- Trial extension via promo code -> HOSPEDA_FREE applies 100% discount

**Error States**:

- Payment declined -> Clear error message with retry option
- Invalid promo code -> Specific error (expired, max uses, wrong plan)
- Feature blocked by plan -> Upgrade prompt with plan comparison

**Loading States**:

- Checkout redirect -> Loading spinner with "Redirecting to Mercado Pago..."
- Plan change -> Processing indicator
- Webhook processing -> Background, no user-facing loading

### 4. Out of Scope

- Stripe integration (future, adapter exists but not wired)
- Multi-currency payment (USD as reference only, not payment)
- Reservation/booking system
- Multi-user management for complexes (single user manages all)
- Room/unit type management
- API availability endpoint
- Automated social media posting
- Email marketing automation (beyond basic transactional)
- Mobile app

---

## Part 2: Technical Analysis

### 1. Architecture

**Pattern**: Layered architecture with qzpay as billing engine

```
Frontend Layer (Astro Web + TanStack Admin)
    |-- @qazuor/qzpay-react (hooks, components)
    |
API Layer (Hono)
    |-- @qazuor/qzpay-hono (middleware, routes, webhooks)
    |
Service Layer (packages/service-core + packages/billing)
    |-- @qazuor/qzpay-core (billing engine)
    |-- Custom services (Sponsorship, OwnerPromotion)
    |
Data Layer (packages/db)
    |-- @qazuor/qzpay-drizzle (24 billing tables)
    |-- Custom tables (sponsorship, owner_promotion)
    |
Payment Provider
    |-- @qazuor/qzpay-mercadopago (Mercado Pago adapter)
```

**Integration Points**:

- Clerk auth -> Billing customer mapping (user.id -> billing_customers.metadata.userId)
- Existing permission system -> Billing permissions already defined
- Existing admin patterns -> New billing section follows same factory patterns
- Existing schema patterns -> New billing enums/schemas follow same structure

**Data Flow**:

1. User selects plan on web/admin
2. API creates checkout session via qzpay-hono routes
3. qzpay-mercadopago creates Mercado Pago Checkout Pro preference
4. User redirected to Mercado Pago for payment
5. Mercado Pago sends IPN webhook
6. qzpay-hono webhook router processes event
7. qzpay-core updates subscription status in billing_* tables
8. Entitlements/limits updated automatically
9. Frontend reads entitlements via qzpay-react hooks

### 2. Data Model Changes

**qzpay-drizzle provides 24 tables** (all prefixed `billing_`):

- billing_customers, billing_subscriptions, billing_payments
- billing_payment_methods, billing_invoices, billing_invoice_lines
- billing_invoice_payments, billing_plans, billing_prices
- billing_promo_codes, billing_promo_code_usage, billing_addons
- billing_subscription_addons, billing_entitlements
- billing_customer_entitlements, billing_limits, billing_customer_limits
- billing_usage_records, billing_vendors, billing_vendor_payouts
- billing_audit_logs, billing_webhook_events
- billing_webhook_dead_letter, billing_idempotency_keys

**Custom tables to create** (following Hospeda patterns):

```sql
-- sponsorships: Individual event/post sponsorships
CREATE TABLE sponsorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    sponsor_user_id UUID NOT NULL REFERENCES users(id),
    target_type TEXT NOT NULL, -- 'event' | 'post'
    target_id UUID NOT NULL,
    level_id UUID NOT NULL REFERENCES sponsorship_levels(id),
    package_id UUID REFERENCES sponsorship_packages(id),
    status TEXT NOT NULL DEFAULT 'pending',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    payment_id TEXT,
    logo_url TEXT,
    link_url TEXT,
    coupon_code TEXT,
    coupon_discount_percent INTEGER,
    analytics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users(id),
    updated_by_id UUID REFERENCES users(id),
    deleted_by_id UUID REFERENCES users(id)
);

-- sponsorship_levels: Bronze, Silver, Gold, Standard, Premium
CREATE TABLE sponsorship_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    target_type TEXT NOT NULL,
    tier TEXT NOT NULL,
    price_amount INTEGER NOT NULL,
    price_currency TEXT NOT NULL DEFAULT 'ARS',
    benefits JSONB NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users(id),
    updated_by_id UUID REFERENCES users(id),
    deleted_by_id UUID REFERENCES users(id)
);

-- sponsorship_packages: Monthly sponsorship bundles
CREATE TABLE sponsorship_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price_amount INTEGER NOT NULL,
    price_currency TEXT NOT NULL DEFAULT 'ARS',
    included_posts INTEGER NOT NULL,
    included_events INTEGER NOT NULL,
    event_level_id UUID REFERENCES sponsorship_levels(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users(id),
    updated_by_id UUID REFERENCES users(id),
    deleted_by_id UUID REFERENCES users(id)
);

-- owner_promotions: Discounts from owners for VIP tourists
CREATE TABLE owner_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES users(id),
    accommodation_id UUID REFERENCES accommodations(id),
    title TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_value NUMERIC NOT NULL,
    min_nights INTEGER,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ,
    max_redemptions INTEGER,
    current_redemptions INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users(id),
    updated_by_id UUID REFERENCES users(id),
    deleted_by_id UUID REFERENCES users(id)
);
```

**New enums needed in @repo/schemas**:

- SponsorshipStatusEnum (pending, active, expired, cancelled)
- SponsorshipTargetTypeEnum (event, post)
- SponsorshipTierEnum (bronze, silver, gold, standard, premium)
- OwnerPromotionDiscountTypeEnum (percentage, fixed, free_night)
- UserTypeEnum or extend RoleEnum with SPONSOR

### 3. API Design

**qzpay-hono provides pre-built routes** (mounted under /api/billing/):

- POST /api/billing/customers - Create billing customer
- GET /api/billing/customers/:id - Get customer
- POST /api/billing/subscriptions - Create subscription
- POST /api/billing/subscriptions/:id/cancel - Cancel subscription
- POST /api/billing/subscriptions/:id/change-plan - Change plan
- POST /api/billing/checkout - Create checkout session
- POST /api/billing/payments - Process payment
- POST /api/billing/payments/:id/refund - Refund payment
- GET /api/billing/plans - List plans
- GET /api/billing/entitlements/:customerId - Check entitlements
- GET /api/billing/limits/:customerId/:limitKey - Check limit
- POST /api/billing/webhooks/mercadopago - Webhook endpoint

**Custom API routes to create**:

```
POST   /api/sponsorships              - Create sponsorship
GET    /api/sponsorships              - List sponsorships (admin/sponsor)
GET    /api/sponsorships/:id          - Get sponsorship
PUT    /api/sponsorships/:id          - Update sponsorship
DELETE /api/sponsorships/:id          - Delete sponsorship
GET    /api/sponsorships/:id/analytics - Get sponsorship analytics

POST   /api/sponsorship-levels        - Create level (admin)
GET    /api/sponsorship-levels        - List levels
PUT    /api/sponsorship-levels/:id    - Update level (admin)
DELETE /api/sponsorship-levels/:id    - Delete level (admin)

POST   /api/sponsorship-packages      - Create package (admin)
GET    /api/sponsorship-packages      - List packages
PUT    /api/sponsorship-packages/:id  - Update package (admin)
DELETE /api/sponsorship-packages/:id  - Delete package (admin)

POST   /api/owner-promotions          - Create promotion (owner)
GET    /api/owner-promotions          - List promotions
GET    /api/owner-promotions/:id      - Get promotion
PUT    /api/owner-promotions/:id      - Update promotion
DELETE /api/owner-promotions/:id      - Delete promotion
```

**Auth**: All routes require Clerk authentication. Admin routes require ADMIN role permissions. Owner routes check ownership. Sponsor routes check SPONSOR role.

### 4. Dependencies

**External packages to add**:

- @qazuor/qzpay-core
- @qazuor/qzpay-mercadopago
- @qazuor/qzpay-drizzle
- @qazuor/qzpay-hono (apps/api)
- @qazuor/qzpay-react (apps/admin, apps/web)

**Internal packages affected**:

- packages/billing (NEW) - Plan configs, entitlements, business logic wrapper
- packages/schemas - New enums, Zod schemas for sponsorship/promotion entities
- packages/db - New Drizzle schemas, models for custom entities
- packages/service-core - New services (Sponsorship, OwnerPromotion, BillingIntegration)
- apps/api - New routes, qzpay-hono middleware, webhook endpoint
- apps/admin - New billing section (plans, subs, payments, promos, sponsorships, metrics)
- apps/web - Pricing page, checkout flow, entitlement gating, subscription management

### 5. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Mercado Pago webhook reliability | Medium | High | Dead letter queue, retry logic, admin alerts |
| qzpay library bugs | Low | High | Thorough testing, direct access to source code for fixes |
| Payment data security | Low | Critical | qzpay handles PCI compliance, HTTPS enforced, no card data stored |
| Trial abuse (multiple accounts) | Medium | Medium | Clerk device fingerprinting, email verification required |
| Promo code abuse | Medium | Low | Max redemptions, conditions validation, audit logging |
| Entitlement enforcement gaps | Medium | High | Centralized middleware check, integration tests for all gated features |
| Schema migration complexity | Low | Medium | qzpay-drizzle handles its own migrations, custom tables follow existing patterns |

### 6. Performance Considerations

**Load expectations**:

- ~1000 owners, ~5000 tourists initially
- ~100 concurrent users typical
- Webhook processing: batch-capable, async

**Bottlenecks**:

- Entitlement checks on every request -> Cache with TTL (qzpay supports this)
- Metrics calculations -> Background job or cache with periodic refresh
- Webhook processing -> Queue-based processing to avoid blocking

**Optimization**:

- Entitlement results cached per session (5 min TTL)
- Plan data cached (changes infrequent, invalidate on admin update)
- Database indexes on billing_subscriptions(customer_id, status)
- Webhook idempotency via billing_idempotency_keys table

---

## Implementation Phases

### Phase 1: Setup (Foundation)

1. Create packages/billing package with qzpay integration
2. Install qzpay dependencies across the monorepo
3. Configure qzpay-drizzle storage adapter with existing DB
4. Configure qzpay-mercadopago adapter
5. Run qzpay database migrations (24 billing tables)
6. Add SPONSOR role to RoleEnum
7. Create new billing-related enums in @repo/schemas

### Phase 2: Core Billing (Plans + Subscriptions)

8. Define all 9 plans with entitlements and limits in packages/billing
9. Seed default plans, entitlements, and limits into database
10. Integrate qzpay-hono middleware into apps/api
11. Mount qzpay billing routes in the API
12. Set up Mercado Pago webhook endpoint
13. Implement Clerk user -> billing customer sync
14. Implement trial flow (14-day, auto-block on expiry)
15. Implement entitlement checking middleware
16. Implement limit enforcement in existing services

### Phase 3: Add-ons and Promo Codes

17. Configure all add-ons (one-time + recurring) in packages/billing
18. Implement add-on purchase flow
19. Implement add-on limit adjustments (e.g., extra photos)
20. Implement promo code system (CRUD + validation + application)
21. Create HOSPEDA_FREE permanent discount code
22. Implement promo code checkout integration

### Phase 4: Sponsorship System (Custom)

23. Create sponsorship Zod schemas in @repo/schemas
24. Create sponsorship Drizzle schemas in @repo/db
25. Create sponsorship models in @repo/db
26. Create SponsorshipService in @repo/service-core
27. Create sponsorship API routes in apps/api
28. Create SponsorshipLevel and SponsorshipPackage CRUD
29. Create OwnerPromotion entity (schema, model, service, routes)
30. Implement sponsor user creation flow (SPONSOR role)

### Phase 5: Admin Panel

31. Create billing admin section with sidebar navigation
32. Create plans management page (CRUD)
33. Create subscriptions management page (list, view, cancel, change)
34. Create payments management page (list, refunds)
35. Create invoices management page
36. Create promo codes management page (CRUD)
37. Create add-ons management page (CRUD)
38. Create sponsorships management page (CRUD + analytics)
39. Create billing metrics dashboard page (MRR, churn, revenue)
40. Create billing settings page (grace period, retry, trial days)

### Phase 6: Web Frontend

41. Create pricing page for owners (plan comparison + checkout)
42. Create pricing page for tourists (plan comparison + checkout)
43. Create subscription management page (current plan, upgrade, cancel)
44. Implement entitlement gating in accommodation features
45. Implement entitlement gating in tourist features
46. Create add-on purchase UI
47. Create owner promotion management UI
48. Create sponsor dashboard (limited access)

### Phase 7: Testing and Documentation

49. Write unit tests for packages/billing (plan configs, entitlements)
50. Write integration tests for billing API routes
51. Write integration tests for webhook processing
52. Write integration tests for entitlement enforcement
53. Write E2E tests for subscription purchase flow
54. Write E2E tests for sponsorship purchase flow
55. Update documentation (API docs, admin guide)
