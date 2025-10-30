# Product Design Requirements (PDR)

## Hospeda Business Model System

**Date**: 2025-10-29
**Status**: Draft
**Priority**: P0 (Critical)
**Owner**: Product Team
**Feature Type**: New Feature

---

## 1. Overview

### 1.1 Problem Statement

Hospeda currently lacks a comprehensive monetization system to generate revenue from the platform. The platform offers valuable services to property owners, tourism businesses, and content creators but has no structured way to:

- Charge for premium listings and enhanced visibility
- Offer professional services (photography, copywriting, SEO)
- Enable advertising campaigns for local businesses
- Manage subscriptions and recurring payments
- Track billing, invoicing, and financial transactions
- Control access rights based on purchased services

**Context:**

- **Business context**: Hospeda needs multiple revenue streams to become financially sustainable and support platform growth. The tourism industry in Concepción del Uruguay and the Litoral region requires professional services and marketing tools that we can monetize.
- **Technical context**: The system must integrate with existing entities (USER, ACCOMMODATION, POST, EVENT) while maintaining flexibility to expand to new revenue models. It requires a polymorphic architecture to handle diverse product types through a unified system.
- **User context**: Three primary user groups need different capabilities:
  - **Property Owners**: Need to list accommodations, purchase visibility boosts, and access professional services
  - **Business Owners**: Need to advertise services/benefits and sponsor content
  - **Administrators**: Need to manage products, pricing, billing, and access rights

### 1.2 Goals & Success Metrics

**Primary Goal:**
Implement a complete, flexible monetization system that enables Hospeda to generate revenue through subscriptions, one-time purchases, advertising, and professional services while providing clear value to clients.

**Success Metrics:**

- **System Completeness**: Implementation of all 35 entities - Target: 100%
  - How measured: All database tables, models, services, and API endpoints operational with 90%+ test coverage
- **Revenue Enablement**: Platform can accept payments and track revenue - Target: Go-live in Q1 2026
  - How measured: First successful subscription payment and invoice generation
- **Architectural Flexibility**: System supports multiple product types - Target: 7 product types
  - How measured: Polymorphic SUBSCRIPTION_ITEM successfully connects to all target entity types
- **Code Quality**: Maintain high quality standards - Target: 90% test coverage, zero lint errors
  - How measured: Automated quality checks pass consistently
- **Developer Efficiency**: Clear patterns accelerate development - Target: 5-6 hours per entity average
  - How measured: Consistent completion time across similar entities

### 1.3 Non-Goals

**Explicitly not included in this phase:**

- Payment gateway integration beyond Mercado Pago (future: Stripe, PayPal)
- Advanced analytics and reporting dashboards (future enhancement)
- Automated subscription renewal reminders (basic notification system only)
- Multi-currency support (ARS only in v1)
- Tax calculation and compliance features (manual for v1)
- Customer portal for self-service management (admin-only in v1)
- Referral and affiliate programs (future revenue stream)
- Dynamic pricing and A/B testing (future optimization)

---

## 2. User Stories

### Functional Group 1: Identity and Clients Management

#### US-001: Register as Billing Client

**As a** property owner or business owner
**I want to** register as a billing client in the system
**So that** I can purchase services, subscriptions, and access premium features

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: User can create a CLIENT entity linked to their USER account
  - Given: Authenticated user without a CLIENT account
  - When: User submits registration with name and billing email
  - Then: CLIENT entity is created with valid audit fields

- [ ] **AC-002**: Organization clients can be created without direct user link
  - Given: Administrator creating organization account
  - When: Admin submits organization details (name, billing email, admin notes)
  - Then: CLIENT entity is created with userId=null and proper organization metadata

- [ ] **AC-003**: Billing email validation prevents duplicates
  - Given: Existing CLIENT with email "example@email.com"
  - When: New registration attempts to use same billing email
  - Then: System rejects registration with clear error message

**Edge Cases:**

- User already has CLIENT account: Show existing account, offer to update details
- Invalid email format: Validate before database insertion
- Network failure during registration: Implement idempotency to prevent duplicates

---

#### US-002: Manage Client Access Rights

**As a** system administrator
**I want to** automatically grant and revoke access rights based on subscriptions
**So that** clients only access features they have paid for

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Access rights are created when subscription item is activated
  - Given: Client purchases accommodation listing subscription
  - When: SUBSCRIPTION_ITEM is created with status ACTIVE
  - Then: CLIENT_ACCESS_RIGHT is automatically generated with proper scope and validity period

- [ ] **AC-002**: Access rights are polymorphic and scope-specific
  - Given: Different types of subscriptions (accommodation, sponsorship, campaign)
  - When: Each subscription item is activated
  - Then: Access right has correct scope (ACCOMMODATION|PLACEMENT|MERCHANT|SERVICE|GLOBAL) and scopeId pointing to specific entity

- [ ] **AC-003**: Access rights expire automatically
  - Given: Access right with validTo date in the past
  - When: System checks access permissions
  - Then: Access is denied and client sees upgrade prompt

**Edge Cases:**

- Subscription cancelled mid-period: Access remains until validTo date
- Multiple access rights to same scope: Most permissive wins
- Orphaned access rights (subscription deleted): Cleanup job removes invalid rights

---

### Functional Group 2: Product Catalog and Pricing

#### US-003: Create Product Catalog

**As a** system administrator
**I want to** define products and services we offer
**So that** clients can purchase standardized offerings

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Products can be created with different types
  - Given: Administrator in product management interface
  - When: Admin creates product with type (SPONSORSHIP|CAMPAIGN|FEATURED|PROF_SERVICE|LISTING_PLAN|PLACEMENT_RATE)
  - Then: Product is saved with proper metadata and type validation

- [ ] **AC-002**: Products support rich metadata
  - Given: Creating product with specific features
  - When: Admin adds metadata (features, limits, descriptions)
  - Then: Metadata is stored as JSONB and retrievable for display

- [ ] **AC-003**: Products can be soft-deleted
  - Given: Product no longer offered
  - When: Admin archives/deletes product
  - Then: Product is soft-deleted (deletedAt set), existing subscriptions unaffected, new purchases prevented

**Edge Cases:**

- Product with active subscriptions: Prevent hard delete, allow soft delete
- Invalid product type: Enum validation catches at schema level
- Duplicate product names: Allow (different pricing plans may exist)

---

#### US-004: Configure Pricing Plans

**As a** system administrator
**I want to** create flexible pricing plans for products
**So that** we can offer different billing options (one-time vs recurring)

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Pricing plans support one-time and recurring billing
  - Given: Product requires pricing
  - When: Admin creates pricing plan with billingScheme (ONE_TIME|RECURRING)
  - Then: Plan is created with appropriate interval (null for one-time, MONTH|YEAR|BIYEAR for recurring)

- [ ] **AC-002**: Pricing stored in minor currency units
  - Given: Price of $1,500 ARS
  - When: Admin enters price
  - Then: System stores 150000 minor units (cents) with currency "ARS"

- [ ] **AC-003**: Multiple pricing plans per product
  - Given: Product with different billing options
  - When: Admin creates monthly and yearly plans
  - Then: Both plans exist and client can choose during purchase

**Edge Cases:**

- Interval set for ONE_TIME billing: Validation error prevents
- Negative or zero prices: Validation requires positive amounts
- Changing price of active plan: Create new plan, deprecate old one

---

#### US-005: Define Tiered Pricing

**As a** system administrator
**I want to** create volume-based pricing tiers
**So that** we can offer discounts for bulk purchases

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Tiers define quantity ranges and unit prices
  - Given: Pricing plan requiring volume discounts
  - When: Admin creates tiers (1-10 units @ $100, 11-50 @ $90, 51+ @ $80)
  - Then: Tiers are stored with minQuantity, maxQuantity (null=unlimited), unitPriceMinor

- [ ] **AC-002**: Tier pricing automatically applied during purchase
  - Given: Client purchasing 25 units of tiered product
  - When: System calculates invoice
  - Then: Correct tier pricing applied (10×$100 + 15×$90 = $2,350)

- [ ] **AC-003**: Tiers cannot overlap or have gaps
  - Given: Existing tier 1-10
  - When: Admin creates tier 15-20
  - Then: Validation error prevents gap (11-14 undefined)

**Edge Cases:**

- Quantity exactly at tier boundary: Use lower tier (10 units uses tier 1-10)
- Unlimited tier (maxQuantity=null): Must be last tier
- Changing tiers on active plans: Version pricing plans instead

---

### Functional Group 3: Subscriptions and Purchases

#### US-006: Create Recurring Subscription

**As a** property owner
**I want to** subscribe to a listing plan with monthly billing
**So that** my accommodation appears on the platform continuously

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Subscription is created with proper lifecycle
  - Given: Client selects recurring pricing plan
  - When: Client completes purchase
  - Then: SUBSCRIPTION created with status ACTIVE, startAt (now), endAt (start + interval), clientId, pricingPlanId

- [ ] **AC-002**: Trial period supported
  - Given: Pricing plan offers 14-day trial
  - When: Client subscribes
  - Then: Subscription created with trialEndsAt = now + 14 days, first invoice generated after trial

- [ ] **AC-003**: Subscription status transitions
  - Given: Active subscription with payment due
  - When: Payment succeeds → status remains ACTIVE
  - When: Payment fails → status changes to PAST_DUE
  - When: Client cancels → status changes to CANCELLED
  - When: Subscription expires → status changes to EXPIRED

**Edge Cases:**

- Trial already used: Check CLIENT history, prevent second trial
- Subscription cancelled during trial: No charge, immediate cancellation
- Past due subscription: Grace period of 7 days before cancellation

---

#### US-007: Make One-Time Purchase

**As a** business owner
**I want to** purchase a one-time professional service
**So that** I get specific deliverables without ongoing commitment

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Purchase creates one-time transaction
  - Given: Client selects ONE_TIME pricing plan
  - When: Client completes purchase
  - Then: PURCHASE entity created with purchasedAt timestamp, clientId, pricingPlanId

- [ ] **AC-002**: Purchase generates immediate invoice
  - Given: Completed purchase
  - When: Purchase is saved
  - Then: INVOICE created with status OPEN, issueDate (now), dueDate (now + payment terms)

- [ ] **AC-003**: Purchase completion grants access
  - Given: Purchase for professional service
  - When: Payment approved
  - Then: SUBSCRIPTION_ITEM and CLIENT_ACCESS_RIGHT created for purchased service

**Edge Cases:**

- Payment fails immediately: PURCHASE exists but no access granted
- Refund requested: Process refund, revoke access if applicable
- Duplicate purchase detection: Prevent within 1-minute window

---

#### US-008: Manage Polymorphic Subscription Items

**As a** system
**I want to** link subscriptions/purchases to diverse entity types
**So that** one unified system handles all product fulfillment

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Subscription items connect sources to targets polymorphically
  - Given: Subscription for accommodation listing
  - When: SUBSCRIPTION_ITEM is created
  - Then: sourceId=subscriptionId, sourceType=SUBSCRIPTION, linkedEntityId=listingId, entityType=ACCOMMODATION_LISTING

- [ ] **AC-002**: System supports all seven target entity types
  - Given: Different product types (sponsorship, campaign, featured, professional service, three listing types)
  - When: Each is purchased
  - Then: SUBSCRIPTION_ITEM correctly links with appropriate entityType (SPONSORSHIP|CAMPAIGN|FEATURED_ACCOMMODATION|PROFESSIONAL_SERVICE_ORDER|ACCOMMODATION_LISTING|BENEFIT_LISTING|SERVICE_LISTING)

- [ ] **AC-003**: Subscription items drive access rights
  - Given: SUBSCRIPTION_ITEM created
  - When: Item is active
  - Then: CLIENT_ACCESS_RIGHT automatically generated referencing subscriptionItemId

**Edge Cases:**

- Invalid entity type: Enum validation prevents
- Orphaned linked entity (target deleted): Handle gracefully, mark item as error
- Multiple items for same target: Allowed (renewal scenario)

---

### Functional Group 4: Billing and Invoicing

#### US-009: Generate Invoices

**As a** system
**I want to** automatically generate invoices for subscriptions and purchases
**So that** clients have clear billing records and payment instructions

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Invoice created for subscription renewals
  - Given: Subscription with renewal date approaching
  - When: Billing cycle triggers (cron job)
  - Then: INVOICE generated with status OPEN, lineItems for all subscription items, totalMinor calculated

- [ ] **AC-002**: Invoice created for one-time purchases
  - Given: Purchase completed
  - When: Purchase is saved
  - Then: INVOICE immediately generated with purchase details

- [ ] **AC-003**: Invoice includes proper line items
  - Given: Subscription with multiple items or tiered pricing
  - When: Invoice is generated
  - Then: INVOICE_LINE records created for each item with quantity, amountMinor, description, linked to subscriptionItemId

**Edge Cases:**

- Prorated charges (mid-cycle changes): Calculate proportional amount
- Discounts applied: Separate line item with negative amount
- Currency conversion (future): Store fxRate and fxSource

---

#### US-010: Process Payments

**As a** client
**I want to** pay invoices through Mercado Pago
**So that** my subscription remains active and services continue

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Payment initiated for open invoice
  - Given: INVOICE with status OPEN
  - When: Client submits payment through Mercado Pago
  - Then: PAYMENT record created with provider=MERCADO_PAGO, status=PENDING, providerPaymentId from MP

- [ ] **AC-002**: Payment webhook updates status
  - Given: Payment with status PENDING
  - When: Mercado Pago webhook arrives with approval
  - Then: PAYMENT status → APPROVED, paidAt set, INVOICE status → PAID

- [ ] **AC-003**: Failed payment handling
  - Given: Payment with status PENDING
  - When: Mercado Pago webhook arrives with rejection
  - Then: PAYMENT status → REJECTED, SUBSCRIPTION status → PAST_DUE, notification sent to client

**Edge Cases:**

- Webhook arrives multiple times: Idempotency check via providerPaymentId
- Partial payments: Not supported in v1 (future enhancement)
- Payment gateway timeout: Retry mechanism with exponential backoff

---

#### US-011: Handle Refunds

**As a** administrator
**I want to** process refunds for payments
**So that** we can resolve customer disputes and cancellations

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Full refund reverts payment
  - Given: PAYMENT with status APPROVED
  - When: Admin initiates full refund
  - Then: REFUND record created with amountMinor = full payment, refundedAt timestamp, INVOICE status → VOID

- [ ] **AC-002**: Partial refund supported
  - Given: PAYMENT with status APPROVED
  - When: Admin initiates partial refund (e.g., 50% of payment)
  - Then: REFUND record created with partial amountMinor, INVOICE remains PAID

- [ ] **AC-003**: Refund triggers access revocation
  - Given: Full refund for subscription
  - When: Refund is processed
  - Then: CLIENT_ACCESS_RIGHT validTo set to now, client loses access immediately

**Edge Cases:**

- Multiple refunds for same payment: Total refunds cannot exceed payment amount
- Refund after service delivered: Require admin override with reason
- Mercado Pago refund failure: Retry + manual reconciliation flag

---

#### US-012: Issue Credit Notes

**As a** administrator
**I want to** issue credit notes for invoice corrections
**So that** clients receive credit without processing refunds

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Credit note created for invoice
  - Given: INVOICE requiring adjustment
  - When: Admin creates credit note with amountMinor and reason
  - Then: CREDIT_NOTE entity created, linked to invoiceId, issuedAt timestamp

- [ ] **AC-002**: Credit note reduces invoice balance
  - Given: Invoice total $1000 with $200 credit note
  - When: System calculates balance due
  - Then: Balance shown as $800

- [ ] **AC-003**: Credit note applies to future invoices
  - Given: Credit note exceeds invoice amount
  - When: Next invoice generated
  - Then: Credit automatically applied to new invoice

**Edge Cases:**

- Credit note exceeds invoice total: Allowed, becomes account credit
- Multiple credit notes: Cumulative credits tracked
- Credit note on already paid invoice: Creates account balance for future use

---

#### US-013: Store Payment Methods

**As a** client
**I want to** save my payment method securely
**So that** future payments are processed automatically

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Payment method tokenized and stored
  - Given: Client completes payment with Mercado Pago
  - When: Client opts to save payment method
  - Then: PAYMENT_METHOD created with provider token, brand (Visa/Master), last4 digits, expiresAt

- [ ] **AC-002**: Default payment method supported
  - Given: Client has multiple payment methods
  - When: Client marks one as default
  - Then: defaultMethod=true for selected, false for others

- [ ] **AC-003**: Expired payment methods detected
  - Given: Payment method with expiresAt in past
  - When: Auto-payment attempted
  - Then: Payment fails gracefully, notification sent requesting update

**Edge Cases:**

- Payment method deleted during active subscription: Subscription → PAST_DUE, client notified
- Multiple default methods (data corruption): Cleanup job ensures single default
- Token revoked by provider: Detect on payment attempt, request re-authorization

---

### Functional Group 5: Promotions and Discounts

#### US-014: Create Promotional Campaigns

**As a** marketing administrator
**I want to** create time-bound promotions
**So that** we can drive sales during specific periods

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Promotion created with time bounds
  - Given: Marketing campaign planned
  - When: Admin creates PROMOTION with name, rules, startsAt, endsAt
  - Then: Promotion is active only within specified period

- [ ] **AC-002**: Promotion rules stored flexibly
  - Given: Complex promotion conditions (e.g., "first 50 customers" or "minimum purchase $500")
  - When: Admin defines rules as JSONB
  - Then: Rules are stored and evaluable during purchase

- [ ] **AC-003**: Promotions link to discount codes
  - Given: Promotion created
  - When: Admin generates discount codes for promotion
  - Then: DISCOUNT_CODE entities reference promotionId

**Edge Cases:**

- Overlapping promotions: Customer gets most favorable discount
- Promotion expired during checkout: Applied discount removed, customer notified
- Promotion rule validation: Admin-side validation + runtime checks

---

#### US-015: Generate and Apply Discount Codes

**As a** client
**I want to** apply discount codes during purchase
**So that** I receive promotional pricing

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Percentage discount codes work
  - Given: DISCOUNT_CODE with discountType=PERCENTAGE, percentOff=20
  - When: Client applies code to $1000 purchase
  - Then: Discount of $200 applied, invoice total $800

- [ ] **AC-002**: Fixed amount discount codes work
  - Given: DISCOUNT_CODE with discountType=FIXED_AMOUNT, amountOffMinor=50000 ($500)
  - When: Client applies code to $1000 purchase
  - Then: Discount of $500 applied, invoice total $500

- [ ] **AC-003**: Discount code validation
  - Given: Discount code with validFrom and validTo dates
  - When: Client attempts to apply outside valid period
  - Then: Error "Discount code expired" or "not yet active"

**Edge Cases:**

- Discount exceeds purchase amount: Discount caps at purchase total (no negative invoice)
- Invalid code: Clear error message "Invalid or expired code"
- Code already used max times: Error "Discount code no longer available"

---

#### US-016: Track Discount Code Usage

**As a** administrator
**I want to** monitor discount code usage
**So that** I can analyze promotion effectiveness and prevent abuse

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Global usage limits enforced
  - Given: DISCOUNT_CODE with maxRedemptionsGlobal=100
  - When: Code used 100 times
  - Then: Further attempts rejected with "Code limit reached"

- [ ] **AC-002**: Per-user usage limits enforced
  - Given: DISCOUNT_CODE with maxRedemptionsPerUser=1
  - When: Same client attempts second use
  - Then: Error "You have already used this code"

- [ ] **AC-003**: Usage tracking for analytics
  - Given: Discount code used by clients
  - When: Admin views discount code report
  - Then: DISCOUNT_CODE_USAGE records show clientId, usageCount, firstUsedAt, lastUsedAt

**Edge Cases:**

- Race condition (simultaneous usage): Atomic counters prevent over-limit
- Usage count mismatch: Reconciliation job fixes discrepancies
- Deleted client usage records: Soft delete maintains usage history

---

### Functional Group 6: Advertising Campaigns

#### US-017: Create Advertising Campaign

**As a** business owner
**I want to** create advertising campaigns
**So that** I can promote my business on Hospeda platform

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Campaign creation with details
  - Given: Client purchases campaign product
  - When: Client creates CAMPAIGN with name, channel (WEB|SOCIAL), fromDate, toDate
  - Then: Campaign saved with status DRAFT

- [ ] **AC-002**: Campaign lifecycle management
  - Given: Campaign in any status
  - When: Status changed (DRAFT → ACTIVE → PAUSED → COMPLETED | CANCELLED)
  - Then: Status transition validated and recorded

- [ ] **AC-003**: Campaign duration enforced
  - Given: CAMPAIGN with fromDate and toDate
  - When: Current date is within campaign period and status ACTIVE
  - Then: Campaign content displayed on platform

**Edge Cases:**

- Campaign dates overlap with existing campaigns: Allowed (ad slots may differ)
- Campaign paused mid-flight: Billing prorated for active days
- Campaign end date reached: Status auto-transitions to COMPLETED

---

#### US-018: Upload Campaign Media Assets

**As a** business owner
**I want to** upload images, videos, and HTML for my campaigns
**So that** I have professional-looking ads

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Media assets uploaded and linked to campaign
  - Given: Campaign in DRAFT status
  - When: Client uploads asset (image/video/HTML)
  - Then: AD_MEDIA_ASSET created with type (IMAGE|HTML|VIDEO), url (storage location), specs (dimensions, format)

- [ ] **AC-002**: Asset specifications validated
  - Given: Ad slot requires 1200x628px image
  - When: Client uploads 800x600px image
  - Then: Validation error with required specifications

- [ ] **AC-003**: Multiple assets per campaign
  - Given: Campaign targeting multiple ad slots
  - When: Client uploads different assets for each slot
  - Then: All assets linked to campaignId, retrievable by type

**Edge Cases:**

- File size limits: Maximum 5MB for images, 50MB for videos
- Unsupported formats: Validation rejects non-image/video files
- Deleted campaign with assets: Cleanup job removes orphaned assets

---

#### US-019: Define Ad Slots

**As a** system administrator
**I want to** define available advertising slots on the platform
**So that** campaigns can reserve specific placements

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Ad slots created with specifications
  - Given: New placement identified on website
  - When: Admin creates AD_SLOT with locationKey (e.g., "homepage_hero"), specs (dimensions, formats), isActive=true
  - Then: Ad slot available for reservations

- [ ] **AC-002**: Ad slot specs guide asset requirements
  - Given: Ad slot with specs {width: 1200, height: 628}
  - When: Client uploads campaign asset
  - Then: Validation ensures asset meets slot specifications

- [ ] **AC-003**: Ad slots can be deactivated
  - Given: Ad slot no longer used
  - When: Admin sets isActive=false
  - Then: No new reservations allowed, existing reservations complete normally

**Edge Cases:**

- Slot with active reservations deactivated: Existing reservations honored
- Slot specifications changed: Only affects new reservations
- Duplicate locationKey: Validation prevents duplicates

---

#### US-020: Reserve Ad Slots

**As a** business owner
**I want to** reserve ad slots for my campaign dates
**So that** my ads appear in specific platform locations

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Slot reservation linked to campaign
  - Given: Active campaign and available ad slot
  - When: Client reserves slot for specific dates
  - Then: AD_SLOT_RESERVATION created with adSlotId, campaignId, fromDate, toDate, status RESERVED

- [ ] **AC-002**: Reservation conflict detection
  - Given: Ad slot already reserved for dates
  - When: Another campaign attempts overlapping reservation
  - Then: Error "Slot unavailable for selected dates" with alternative suggestions

- [ ] **AC-003**: Reservation lifecycle
  - Given: Reservation in RESERVED status
  - When: Campaign goes live → status ACTIVE
  - When: Campaign paused → status PAUSED
  - When: Campaign ends or cancelled → status ENDED or CANCELLED

**Edge Cases:**

- Reservation longer than campaign duration: Not allowed, dates must align
- Campaign deleted with reservations: Reservations automatically cancelled
- Slot deleted with reservations: Existing reservations complete, no new reservations

---

#### US-021: Manage Ad Pricing Catalog

**As a** system administrator
**I want to** define pricing for different ad channels
**So that** ad campaigns are priced consistently

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Ad pricing catalog by channel
  - Given: Different pricing for WEB vs SOCIAL channels
  - When: Admin creates AD_PRICING_CATALOG with channel, validFrom, validTo
  - Then: Pricing catalog active for specified period and channel

- [ ] **AC-002**: Pricing catalog links to pricing plans
  - Given: Ad pricing catalog created
  - When: Admin creates PRICING_PLAN for ad slots
  - Then: Plans reference catalog and inherit channel context

- [ ] **AC-003**: Historical pricing maintained
  - Given: New pricing catalog effective next month
  - When: Current catalog validTo reaches
  - Then: New catalog becomes active, old catalog archived but retained for reporting

**Edge Cases:**

- No active pricing catalog: Default pricing or block ad sales
- Overlapping catalogs: Most recent validFrom wins
- Catalog deleted mid-campaign: Existing campaigns honor original pricing

---

### Functional Group 7: Sponsorships and Featured Content

#### US-022: Sponsor Posts and Events

**As a** business owner
**I want to** sponsor specific posts or events
**So that** my brand appears alongside popular content

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Sponsorship created for post or event
  - Given: Client purchases sponsorship product
  - When: Client selects entityType (POST|EVENT) and entityId
  - Then: SPONSORSHIP created with clientId, entityType, entityId, fromDate, toDate, status ACTIVE

- [ ] **AC-002**: Sponsored content displays branding
  - Given: SPONSORSHIP with status ACTIVE within date range
  - When: User views sponsored post/event
  - Then: Sponsor branding/logo displayed prominently

- [ ] **AC-003**: Sponsorship date enforcement
  - Given: SPONSORSHIP with fromDate and toDate
  - When: Current date outside range
  - Then: Sponsorship not displayed, status auto-updates to EXPIRED

**Edge Cases:**

- Multiple sponsors for same content: Display all sponsors or highest tier
- Sponsored content deleted: Sponsorship marked CANCELLED, prorated refund offered
- Sponsorship paused: Status PAUSED, dates extended by pause duration

---

#### US-023: Feature Accommodations

**As a** property owner
**I want to** feature my accommodation in prominent locations
**So that** I get more visibility and bookings

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Featured accommodation in multiple locations
  - Given: Client purchases featured placement
  - When: Client selects featuredType (HOME|DESTINATION|SEARCH|OTHER)
  - Then: FEATURED_ACCOMMODATION created with accommodationId, featuredType, fromDate, toDate, status ACTIVE

- [ ] **AC-002**: Featured slots are limited
  - Given: Homepage allows 3 featured accommodations
  - When: 3 accommodations already featured for dates
  - Then: New feature request shows "Slots full" with waitlist option

- [ ] **AC-003**: Featured rotation
  - Given: Multiple accommodations featured in same location
  - When: Location is displayed
  - Then: Featured accommodations rotate or display in priority order

**Edge Cases:**

- Featured accommodation unpublished: Feature continues if paid, or refund option
- Feature dates overlap with maintenance: Dates extended automatically
- Featured type changed mid-flight: New type takes effect immediately if slots available

---

### Functional Group 8: Professional Services

#### US-024: Offer Professional Service Types

**As a** system administrator
**I want to** define professional services we offer
**So that** clients can purchase expert services

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Service types created with categories
  - Given: Professional services team identified service offerings
  - When: Admin creates PROFESSIONAL_SERVICE_TYPE with category (PHOTO|COPYWRITING|SEO|DESIGN|MAINTENANCE|TOUR|BIKE_RENTAL|OTHER)
  - Then: Service type saved with name, description, defaultPricing, isActive=true

- [ ] **AC-002**: Service types have default pricing
  - Given: Service type created
  - When: Client views service for purchase
  - Then: Default pricing displayed as JSONB (base price, time estimates, deliverables)

- [ ] **AC-003**: Service types can be activated/deactivated
  - Given: Service type no longer offered
  - When: Admin sets isActive=false
  - Then: Service not shown for new orders, existing orders complete normally

**Edge Cases:**

- Service type with active orders deactivated: Existing orders unaffected
- Custom pricing override: Stored in PROFESSIONAL_SERVICE_ORDER
- Service category OTHER: Requires detailed description

---

#### US-025: Order Professional Services

**As a** property owner
**I want to** order professional services like photography or copywriting
**So that** I improve my listing quality

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Service order creation
  - Given: Client selects professional service type
  - When: Client completes order with requirements and optional notes
  - Then: PROFESSIONAL_SERVICE_ORDER created with status PENDING, orderedAt timestamp, clientRequirements

- [ ] **AC-002**: Service order lifecycle
  - Given: Order in any status
  - When: Status changes (PENDING → IN_PROGRESS → COMPLETED | CANCELLED | REFUNDED)
  - Then: Status transition logged, client notified

- [ ] **AC-003**: Service deliverables attached
  - Given: Order status COMPLETED
  - When: Service provider uploads deliverables
  - Then: Deliverables stored in JSONB field (URLs, files, notes), client notified

**Edge Cases:**

- Service not completed by delivery date: Automatic notification escalation
- Client requests revisions: Revision workflow (future), manual process in v1
- Service order cancelled before work starts: Full refund, after start partial refund negotiated

---

### Functional Group 9: Accommodation Listings

#### US-026: Define Accommodation Listing Plans

**As a** system administrator
**I want to** create listing plans with different feature levels
**So that** property owners can choose appropriate tier

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Listing plans created with limits
  - Given: Tiered listing strategy (Basic, Premium, Enterprise)
  - When: Admin creates ACCOMMODATION_LISTING_PLAN with limits JSONB (photo count, video allowed, priority ranking)
  - Then: Plan saved with name and feature limits

- [ ] **AC-002**: Plans enforce feature limits
  - Given: Listing on Basic plan (limit: 10 photos)
  - When: Owner attempts to upload 11th photo
  - Then: Error "Upgrade to Premium for more photos"

- [ ] **AC-003**: Plans linked to pricing
  - Given: Listing plan created
  - When: Admin creates PRICING_PLAN for listing plan product
  - Then: Pricing reflects plan value (higher tier = higher price)

**Edge Cases:**

- Plan limits changed for existing listings: Existing listings grandfathered or grace period
- Plan deleted with active listings: Existing listings continue on deleted plan
- Custom limits for specific clients: Override limits in JSONB adminInfo

---

#### US-027: Activate Accommodation Listings

**As a** property owner
**I want to** list my accommodation on Hospeda
**So that** guests can find and book my property

**Priority**: P0

**Acceptance Criteria**:

- [ ] **AC-001**: Listing activated with plan selection
  - Given: Property owner with accommodation
  - When: Owner subscribes to listing plan
  - Then: ACCOMMODATION_LISTING created with accommodationId, listingPlanId, status ACTIVE, fromDate (now), toDate (subscription end)

- [ ] **AC-002**: Trial listings supported
  - Given: New property owner
  - When: Owner starts listing with trial
  - Then: Listing created with isTrial=true, trialEndsAt = now + trial period, status TRIAL

- [ ] **AC-003**: Listing visibility controlled by status
  - Given: Listing in different statuses
  - When: Guest searches accommodations
  - Then: Only ACTIVE and TRIAL status listings shown, PAUSED and ARCHIVED hidden

**Edge Cases:**

- Trial expires: Status auto-transitions to PAUSED, owner prompted to subscribe
- Accommodation deleted: Listing status → ARCHIVED, no refund (terms of service)
- Multiple active listings for same accommodation: Not allowed, enforce one active listing

---

### Functional Group 10: Benefit Listings

#### US-028: Register Benefit Partners

**As a** local business owner
**I want to** register as a benefit partner
**So that** I can offer exclusive deals to Hospeda guests

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Benefit partner registration
  - Given: Business owner wants to offer guest benefits
  - When: Owner creates BENEFIT_PARTNER with name, category, clientId
  - Then: Partner entity saved, owner can create benefit listings

- [ ] **AC-002**: Partner categories organized
  - Given: Various business types (restaurants, activities, transportation)
  - When: Partner specifies category
  - Then: Category stored as text, used for filtering and organization

- [ ] **AC-003**: Partner linked to client billing
  - Given: Benefit partner created
  - When: Partner subscribes to listing plan
  - Then: Billing flows to clientId, all standard payment processes apply

**Edge Cases:**

- Client with multiple partners: Allowed, each partner separate entity
- Partner name changes: Update allowed, history preserved in adminInfo
- Partner deactivated: Existing listings continue until expiry, no new listings

---

#### US-029: Create Benefit Listing Plans

**As a** system administrator
**I want to** define benefit listing plans
**So that** partners can choose visibility levels

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Benefit listing plans created
  - Given: Benefit partner program strategy
  - When: Admin creates BENEFIT_LISTING_PLAN with limits (featured placement, highlight, etc.)
  - Then: Plan saved with name and limit specifications

- [ ] **AC-002**: Plans determine benefit visibility
  - Given: Different plan tiers
  - When: Guest views benefits section
  - Then: Higher tier plans have more prominent placement

- [ ] **AC-003**: Plans linked to pricing structure
  - Given: Benefit listing plan
  - When: Admin creates associated PRICING_PLAN
  - Then: Pricing matches plan value and market positioning

**Edge Cases:**

- Unlimited benefits plan: Limits JSONB set to null or very high numbers
- Plan changes mid-subscription: Changes apply at next renewal
- Free community benefit tier: Zero-price plan with basic features

---

#### US-030: Activate Benefit Listings

**As a** benefit partner
**I want to** list my benefits on Hospeda
**So that** guests discover and use my services

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Benefit listing activated
  - Given: Benefit partner with subscription
  - When: Partner creates listing with benefitDetails
  - Then: BENEFIT_LISTING created with benefitPartnerId, listingPlanId, status ACTIVE, benefitDetails (offer description)

- [ ] **AC-002**: Benefit details clearly defined
  - Given: Listing created
  - When: Guest views benefit
  - Then: benefitDetails field shows "20% off dinner for Hospeda guests with booking confirmation"

- [ ] **AC-003**: Benefit listing lifecycle
  - Given: Active benefit listing
  - When: Status changes (ACTIVE → PAUSED → ARCHIVED | TRIAL)
  - Then: Visibility adjusts accordingly, guests see updated availability

**Edge Cases:**

- Benefit expired or invalid: Partner updates or pauses listing
- Benefit abuse by guests: Reporting mechanism for partners
- Seasonal benefits: fromDate/toDate enforced even if subscription active

---

### Functional Group 11: Service Listings

#### US-031: Register Tourist Services

**As a** service provider
**I want to** register my tourist service business
**So that** I can list services for Hospeda guests

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Tourist service registration
  - Given: Service provider (tour operator, bike rental, transport)
  - When: Provider creates TOURIST_SERVICE with name, category, clientId
  - Then: Service entity saved, provider can create service listings

- [ ] **AC-002**: Service categories defined
  - Given: Different service types
  - When: Provider specifies category (tours, rentals, transport, activities)
  - Then: Category stored for filtering and search

- [ ] **AC-003**: Service linked to billing client
  - Given: Tourist service created
  - When: Provider subscribes to listing plan
  - Then: Billing managed through clientId

**Edge Cases:**

- Provider offers multiple service types: Create separate TOURIST_SERVICE entities
- Service name/details change: Update allowed, audit trail in updatedAt
- Service temporarily unavailable: Listing status to PAUSED

---

#### US-032: Create Service Listing Plans

**As a** system administrator
**I want to** define service listing plans
**So that** service providers can choose appropriate visibility

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Service listing plans created
  - Given: Service listing strategy
  - When: Admin creates SERVICE_LISTING_PLAN with limits (featured placement, booking priority)
  - Then: Plan saved with limits JSONB

- [ ] **AC-002**: Plans differentiate visibility
  - Given: Basic vs Premium service listing plans
  - When: Guest searches for services
  - Then: Premium listings appear higher, have enhanced features

- [ ] **AC-003**: Plans linked to pricing
  - Given: Service listing plan
  - When: Admin creates PRICING_PLAN
  - Then: Pricing structure matches plan benefits

**Edge Cases:**

- Unlimited services plan: High or null limits
- Geographic restrictions: Limits can include service area constraints
- Seasonal pricing: Different pricing plans for high/low seasons

---

#### US-033: Activate Service Listings

**As a** service provider
**I want to** list my services on Hospeda
**So that** guests can discover and book my services

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Service listing activated
  - Given: Service provider with subscription
  - When: Provider creates listing
  - Then: SERVICE_LISTING created with touristServiceId, listingPlanId, status ACTIVE, fromDate, toDate

- [ ] **AC-002**: Trial support for service listings
  - Given: New service provider
  - When: Provider starts with trial
  - Then: Listing created with isTrial=true, trialEndsAt, status TRIAL

- [ ] **AC-003**: Listing visibility management
  - Given: Service listing in various statuses
  - When: Status changes or dates pass
  - Then: Visibility on platform adjusts automatically

**Edge Cases:**

- Service temporarily unavailable (weather, maintenance): Status to PAUSED
- Service listing expired: Auto-transition to ARCHIVED, renewal prompt sent
- Multiple listings same service: Allowed for different listing plans or periods

---

### Functional Group 12: Notifications

#### US-034: Send Subscription Lifecycle Notifications

**As a** system
**I want to** notify clients about subscription events
**So that** they stay informed and take timely action

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Trial expiration notifications
  - Given: Subscription with trialEndsAt approaching (3 days, 1 day)
  - When: Notification cron runs
  - Then: NOTIFICATION created with type TRIAL_EXPIRING, recipientId (clientId), channel EMAIL, scheduledFor (now)

- [ ] **AC-002**: Payment notifications
  - Given: Various payment events (due, failed, success)
  - When: Event occurs
  - Then: Appropriate notification sent (PAYMENT_DUE, PAYMENT_FAILED, PAYMENT_SUCCESS)

- [ ] **AC-003**: Subscription renewal notifications
  - Given: Subscription renewed successfully
  - When: New subscription period starts
  - Then: NOTIFICATION type SUBSCRIPTION_RENEWED sent with new period details

**Edge Cases:**

- Notification delivery failure: Retry 3 times with exponential backoff
- Client unsubscribed from emails: Respect preference, use IN_APP only
- Multiple events same time: Batch into single notification

---

#### US-035: Send Service and Campaign Notifications

**As a** system
**I want to** notify clients about service orders and campaign status
**So that** they track progress and respond to issues

**Priority**: P2

**Acceptance Criteria**:

- [ ] **AC-001**: Service order updates
  - Given: Professional service order status changes
  - When: Status → IN_PROGRESS, COMPLETED, or requires input
  - Then: NOTIFICATION type SERVICE_ORDER_UPDATE sent with status and details

- [ ] **AC-002**: Campaign status changes
  - Given: Campaign status transitions
  - When: Status changes (ACTIVE, PAUSED, COMPLETED)
  - Then: NOTIFICATION type CAMPAIGN_STATUS_CHANGE sent

- [ ] **AC-003**: Listing approval/rejection
  - Given: Admin reviews listing
  - When: Listing approved or rejected
  - Then: NOTIFICATION type LISTING_APPROVED or LISTING_REJECTED sent with reason if rejected

**Edge Cases:**

- Notification preferences by type: Allow granular control (future)
- High-priority notifications: SMS for critical issues (payment failures)
- Notification history: Clients can view all notifications in account

---

#### US-036: Manage Notification Delivery

**As a** system
**I want to** reliably deliver notifications across channels
**So that** clients receive timely information

**Priority**: P1

**Acceptance Criteria**:

- [ ] **AC-001**: Multi-channel delivery
  - Given: Notification created with channel specified
  - When: Notification processor runs
  - Then: Notification sent via appropriate channel (EMAIL|SMS|PUSH|IN_APP)

- [ ] **AC-002**: Notification status tracking
  - Given: Notification sent
  - When: Delivery confirmed or fails
  - Then: Status updated (PENDING → SENT → DELIVERED | FAILED), sentAt timestamp

- [ ] **AC-003**: Failed notification retry
  - Given: Notification with status FAILED
  - When: Retry count < 3
  - Then: Notification rescheduled for retry, retryCount incremented, failureReason logged

**Edge Cases:**

- Recipient deleted/invalid: Status → FAILED, no retries
- Scheduled notifications: scheduledFor honors future timestamp
- Notification marked read: readAt timestamp set when client views

---

## 3. Design & Mockups

### 3.1 User Flow Diagram

#### Primary Flow: Property Owner Subscribes to Listing Plan

```mermaid
flowchart TD
    A[Property Owner Logs In] --> B{Has CLIENT account?}
    B -->|No| C[Create CLIENT Profile]
    B -->|Yes| D[Browse Listing Plans]
    C --> D
    D --> E[Select Plan - Basic/Premium/Enterprise]
    E --> F[Configure Listing Details]
    F --> G{Trial Available?}
    G -->|Yes| H[Start 14-day Trial]
    G -->|No| I[Proceed to Payment]
    H --> J[ACCOMMODATION_LISTING Created - Status TRIAL]
    I --> K[Select Payment Method]
    K --> L[Mercado Pago Payment]
    L --> M{Payment Successful?}
    M -->|Yes| N[Create SUBSCRIPTION + SUBSCRIPTION_ITEM]
    M -->|No| O[Show Error - Retry]
    O --> K
    N --> P[Generate INVOICE + PAYMENT]
    P --> Q[Grant CLIENT_ACCESS_RIGHT]
    Q --> R[Listing Goes ACTIVE]
    R --> S[Send Confirmation Email]
    S --> T[Owner Manages Listing]
```text

**Description:**
This flow shows how a property owner subscribes to an accommodation listing plan. Key decision points include CLIENT registration (if new user), trial eligibility, and payment processing. The polymorphic SUBSCRIPTION_ITEM system links the subscription to the actual ACCOMMODATION_LISTING, which then grants access rights.

#### Secondary Flow: Business Owner Creates Ad Campaign

```mermaid
flowchart TD
    A[Business Owner Logs In] --> B[Purchase Campaign Product]
    B --> C[Create CAMPAIGN - Status DRAFT]
    C --> D[Upload Media Assets]
    D --> E[Select Ad Slots]
    E --> F{Slots Available?}
    F -->|Yes| G[Reserve AD_SLOT_RESERVATION]
    F -->|No| H[Show Alternative Slots]
    H --> E
    G --> I[Review Campaign]
    I --> J[Submit for Payment]
    J --> K{Payment Approved?}
    K -->|Yes| L[CAMPAIGN Status → ACTIVE]
    K -->|No| M[Campaign Remains DRAFT]
    L --> N[Create SUBSCRIPTION_ITEM Linking]
    N --> O[Grant Access Rights]
    O --> P[Campaign Displays on Platform]
    P --> Q[Track Campaign Performance]
```text

**Description:**
Business owner creates and activates an advertising campaign. The flow includes media asset upload, ad slot reservation with availability checking, and payment processing. Once paid, the campaign becomes active and displays on the platform.

### 3.2 Wireframes

#### Admin Panel - Product Catalog Management

**Location**: `/admin/products`

**Key Elements:**

- **Product List Table**:
  - Columns: Product Name, Type, Status (Active/Archived), Pricing Plans Count, Actions
  - Filters: Type dropdown, Status toggle, Search bar
  - Actions: Edit, Archive, View Pricing Plans, Create New Product

- **Product Form (Create/Edit)**:
  - Product Name (text input)
  - Product Type (dropdown: SPONSORSHIP, CAMPAIGN, FEATURED, PROF_SERVICE, LISTING_PLAN, PLACEMENT_RATE)
  - Metadata (JSON editor for flexible configuration)
  - Status toggle (Active/Inactive)
  - Associated Pricing Plans (nested list with add/edit/delete)

- **Pricing Plan Editor**:
  - Billing Scheme (radio: One-time | Recurring)
  - Interval (dropdown: Month | Year | BiYear) - conditional on Recurring
  - Amount (currency input with minor units conversion)
  - Pricing Tiers (optional, repeatable section):
    - Min Quantity, Max Quantity (numeric inputs)
    - Unit Price (currency input)

**Responsive Changes (Tablet/Mobile):**

- Table converts to card layout on mobile
- Form sections stack vertically
- JSON editor uses full width with horizontal scroll

---

#### Client Portal - Subscription Management

**Location**: `/account/subscriptions`

**Key Elements:**

- **Active Subscriptions List**:
  - Card per subscription showing:
    - Product name and type
    - Status badge (Active, Past Due, Trial)
    - Current period dates
    - Next billing date and amount
    - Quick actions: Pause, Cancel, Upgrade, View Invoice

- **Subscription Details View**:
  - Full subscription information
  - Linked subscription items (what the subscription provides)
  - Payment history table
  - Invoices list with download links
  - Access rights granted

- **Purchase New Service Button**:
  - Opens product catalog filtered by client type
  - Prominent call-to-action

**Mobile-Specific Features:**

- Swipe actions on subscription cards (Pause, Cancel)
- Collapsible sections for payment history
- Bottom sheet for subscription details

---

#### Client Portal - Professional Service Order

**Location**: `/services/order/:serviceTypeId`

**Key Elements:**

- **Service Details Section**:
  - Service name, category, description
  - Deliverables list
  - Estimated timeline
  - Base pricing (can be customized)

- **Order Form**:
  - Client requirements (textarea)
  - Optional notes (textarea)
  - Delivery date picker (with provider availability)
  - Custom pricing input (if applicable)
  - Payment method selector

- **Order Confirmation**:
  - Summary of service, requirements, pricing
  - Payment breakdown
  - Terms acceptance checkbox
  - Submit button → initiates payment flow

**Mobile View:**

- Sticky header with service name and price
- Form fields stack vertically
- Payment method selector as bottom sheet

---

### 3.3 High-Fidelity Mockups

#### Screen 1: Admin - Campaign Management Dashboard

**Location**: `/admin/campaigns`

**Description**: Dashboard showing all advertising campaigns with filtering and status management capabilities.

**Interactive Elements:**

- **Campaign Status Filter**: Dropdown with multi-select (Draft, Active, Paused, Completed, Cancelled)
  - Behavior: Updates table in real-time, shows count per status
- **Campaign Table Row**: Clickable row expands inline details
  - Behavior: Shows media assets, ad slot reservations, performance metrics
- **Quick Status Toggle**: Dropdown on each row (Active ↔ Paused)
  - Behavior: Confirms action, updates status, shows success toast
- **View Media Assets**: Icon button opens media gallery modal
  - Behavior: Displays all uploaded assets with specs and validation status
- **Ad Slot Calendar**: Button opens reservation timeline view
  - Behavior: Visual calendar showing reserved slots across date range

**States:**

- Default: Table with paginated campaigns
- Loading: Skeleton loader while fetching
- Empty: "No campaigns yet" with create button
- Error: Error banner with retry option

---

#### Screen 2: Client Portal - Billing Dashboard

**Location**: `/account/billing`

**Description**: Client's central billing interface showing payment methods, invoices, and billing history.

**Interactive Elements:**

- **Add Payment Method**: Button opens Mercado Pago tokenization flow
  - Behavior: Secure iframe, stores token on success, updates payment method list
- **Set Default Payment**: Radio button per payment method
  - Behavior: Updates immediately, shows confirmation, one default enforced
- **Invoice Row**: Clickable row shows invoice details
  - Behavior: Expands to show line items, payment status, download PDF button
- **Pay Now Button**: On unpaid invoices
  - Behavior: Opens payment modal with saved methods, processes payment
- **Request Refund**: Link on paid invoices (within X days)
  - Behavior: Opens form with reason, submits refund request to admin

**States:**

- Default: Dashboard with invoices and payment methods
- Payment Processing: Loading spinner, disabled interactions
- Payment Success: Green checkmark animation, updated invoice status
- Payment Failed: Error message with retry and support contact options

---

### 3.4 UI Components

| Component | Description | Behavior | States |
|-----------|-------------|----------|--------|
| SubscriptionCard | Displays subscription summary with key info | Click expands details, hover highlights actions | Default, Active, PastDue, Cancelled, Expired |
| PaymentMethodCard | Shows saved payment method with brand and last4 | Click to set default or delete | Default, Default (highlighted), Expired (warning) |
| InvoiceRow | Table row showing invoice summary | Click to expand line items and details | Open, Paid, Void, Overdue |
| PricingTierForm | Form for creating volume-based pricing tiers | Add/remove tier rows dynamically | Empty, Filled, Validation Error |
| CampaignStatusBadge | Visual indicator of campaign status | Static display with color coding | Draft, Active, Paused, Completed, Cancelled |
| NotificationBell | Icon with unread count badge | Click opens notification dropdown | No Notifications, Has Unread, All Read |
| ProductTypeIcon | Icon representing product type | Static display in product lists | SPONSORSHIP, CAMPAIGN, FEATURED, PROF_SERVICE, LISTING_PLAN, PLACEMENT_RATE |

**Component Details:**

- **SubscriptionCard**:
  - Props: `subscription` (object), `onAction` (callback), `compact` (boolean)
  - Variants: Default (full info), Compact (essential info only), Expandable (with details section)
  - Design: Card with border, status badge top-right, action buttons bottom-right

- **PaymentMethodCard**:
  - Props: `paymentMethod` (object), `isDefault` (boolean), `onSetDefault` (callback), `onDelete` (callback)
  - Variants: Default, Default (highlighted with star), Expired (with warning icon)
  - Design: Card with brand logo, last4 digits, expiry date, radio button for default

- **InvoiceRow**:
  - Props: `invoice` (object), `onExpand` (callback), `expandable` (boolean)
  - Variants: Open (call-to-action), Paid (success), Void (muted), Overdue (warning)
  - Design: Table row with status badge, amount (prominent), dates, action buttons

---

## 4. Technical Constraints

### 4.1 Performance Requirements

**Page Load Time:**

- Desktop: < 2 seconds
- Mobile: < 3 seconds

**API Response Time:**

- Critical endpoints (payment processing, subscription creation): < 500 ms
- Standard endpoints (list queries, single entity fetch): < 200 ms
- Complex queries (reports, analytics): < 1000 ms

**Database Query Time:**

- Simple queries (single entity by ID): < 50 ms
- Complex queries (joins across multiple tables): < 300 ms
- Reporting queries (aggregations): < 800 ms

**Bundle Size:**

- Admin panel JavaScript: < 500 KB (gzipped)
- Client portal JavaScript: < 350 KB (gzipped)
- Shared components: < 100 KB (gzipped)

**Other Performance Metrics:**

- Polymorphic joins (SUBSCRIPTION_ITEM): Indexed and optimized, < 100 ms for typical queries
- Invoice generation: < 1 second for invoices with up to 50 line items
- Notification queue processing: 100+ notifications per second

### 4.2 Security Requirements

**Authentication:**

- Required: Yes
- Level: User (for clients), Admin (for management interfaces)
- Provider: Clerk

**Authorization:**

- Who can access:
  - Clients can view their own subscriptions, invoices, purchases
  - Admins can view all entities
- Who can modify:
  - Clients can create subscriptions/purchases, update payment methods
  - Admins can modify all entities, process refunds, issue credit notes
- Who can delete:
  - Soft delete only
  - Admins can soft delete products, campaigns (with validation)
  - Clients cannot delete (only cancel subscriptions)

**Data Privacy:**

- PII involved: Yes (billing email, payment method tokens)
- Data classification: Confidential (financial data)
- Compliance: GDPR-ready (consent mechanisms, data export, right to deletion)
- Encryption: Payment method tokens encrypted at rest, all traffic over HTTPS

**Input Validation:**

- Client-side: Zod schema validation for all forms (email format, positive amounts, date ranges)
- Server-side: Zod schema validation enforced at API layer, database constraints
- Sanitization: XSS prevention via React escaping, SQL injection prevented by Drizzle ORM parameterized queries

**Rate Limiting:**

- API calls: 100 requests per minute per client for standard endpoints
- Payment processing: 5 requests per minute per client (prevent abuse)
- Admin endpoints: 500 requests per minute per admin user

### 4.3 Accessibility Requirements

**WCAG Level**: AA

**Required Support:**

- [x] Keyboard navigation (Tab, Enter, Esc, Arrow keys for dropdowns and modals)
- [x] Screen reader compatibility (semantic HTML, ARIA labels, live regions for notifications)
- [x] Focus indicators visible (custom styled focus rings on interactive elements)
- [x] Color contrast ratio ≥ 4.5:1 for all text
- [x] Alt text for all product icons and media assets
- [x] ARIA labels for icon-only buttons (payment method actions, status toggles)
- [x] Form labels properly associated via `htmlFor` and `id`
- [x] Error messages accessible and announced to screen readers

**Exceptions:**

- Data visualization charts in admin reports (Phase 2 enhancement, alternative data tables provided)

### 4.4 Browser/Device Support

**Desktop Browsers:**

- Chrome: 90+
- Firefox: 88+
- Safari: 14+
- Edge: 90+

**Mobile Devices:**

- iOS: 14+
- Android: 10+

**Screen Sizes:**

- Mobile: 320px - 767px (stacked layouts, collapsible sections)
- Tablet: 768px - 1023px (hybrid layouts, side panels)
- Desktop: 1024px+ (multi-column layouts, data tables)

---

## 5. Dependencies & Integrations

### 5.1 Internal Dependencies

| Package/Service | Version | Why Needed | Impact if Unavailable |
|----------------|---------|------------|----------------------|
| @repo/db | latest | Database access via Drizzle ORM for all 35 entities | Complete system failure |
| @repo/schemas | latest | Zod validation schemas for all entities (210 schemas) | Cannot validate inputs, data integrity issues |
| @repo/service-core | latest | Business logic services (35 services) | API cannot function |
| @repo/utils | latest | Shared utilities (date handling, currency conversion) | Loss of common functionality |
| @repo/logger | latest | Centralized logging for audit trails | Loss of debugging capability |
| packages/payments | new | Mercado Pago integration wrapper | Cannot process payments |

### 5.2 External Dependencies

| Service/API | Version | Why Needed | Rate Limits | Fallback |
|-------------|---------|------------|-------------|----------|
| Mercado Pago API | v1 | Payment processing | 500 req/min | Queue payments, retry with exponential backoff |
| Clerk | latest | Authentication and user management | Generous (10k MAU free) | Maintain local session cache |
| Neon (PostgreSQL) | 15+ | Production database | Connection pooling (auto-scale) | Switch to local PostgreSQL |
| Vercel | N/A | Hosting and deployment | Standard (auto-scale) | AWS or DigitalOcean fallback |

### 5.3 New Dependencies

**Packages to Add:**

- `mercadopago` SDK: ^1.5.0 - Official Mercado Pago integration - ~50KB
  - **Justification**: Required for payment processing. Official SDK reduces integration complexity and maintenance burden. Alternative of raw API calls would require significant custom code.

- `date-fns`: ^2.30.0 - Date manipulation utilities - ~20KB (tree-shaken)
  - **Justification**: Subscription date calculations (renewals, prorations, trial periods) require robust date handling. Lighter than moment.js, better TypeScript support.

- `ioredis`: ^5.3.0 - Redis client for caching - ~200KB
  - **Justification**: Cache pricing plans, product catalog, active campaigns for performance. Significantly reduces database load for frequently accessed data.

---

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation Strategy | Owner |
|------|--------|-------------|-------------------|-------|
| Payment gateway downtime (Mercado Pago) | High | Low | Implement retry queue, graceful degradation (manual payments), status page for clients | Backend Engineer |
| Database performance degradation (complex polymorphic joins) | High | Medium | Add targeted indexes, implement query result caching, optimize N+1 queries | DB Engineer |
| Scope creep (35 entities is large) | High | High | Strict adherence to PDR, defer non-essential features to future phases, regular scope reviews | Tech Lead |
| Data migration complexity (existing accommodations) | Medium | High | Develop migration scripts early, test on staging data, phased rollout with rollback plan | DB Engineer |
| Mercado Pago API changes/deprecation | Medium | Low | Monitor MP changelog, version lock SDK, implement adapter pattern for easy provider swap | Backend Engineer |
| Incorrect billing calculations | High | Medium | 100% test coverage for billing logic, manual QA of all pricing scenarios, phased rollout | QA Engineer |

**Risk Details:**

### Risk 1: Payment Gateway Downtime

- **Description**: Mercado Pago API becomes unavailable, preventing payment processing and subscription renewals.
- **Impact if occurs**: Clients cannot complete purchases, subscription renewals fail, revenue loss, customer frustration.
- **Mitigation**:
  - Implement payment queue with retry logic (exponential backoff, max 3 retries over 24 hours)
  - Graceful degradation: Allow admins to manually mark payments as pending review
  - Status page: Display service status to clients, offer alternative contact methods
  - Subscription grace period: 7 days past due before cancellation
- **Monitoring**: Mercado Pago status page monitoring, alert on payment failure rate > 5%

### Risk 2: Scope Creep

- **Description**: Feature requests and "while we're at it" additions expand scope beyond 35 entities and defined functionality.
- **Impact if occurs**: Timeline延長, budget overrun, technical debt accumulation, team burnout.
- **Mitigation**:
  - Lock PDR scope after stakeholder approval, all new requests go to Phase 2
  - Regular scope review meetings (bi-weekly)
  - Ruthless prioritization: P0/P1 only for v1, P2/P3 deferred
  - Document all deferred features in "Out of Scope" section
- **Monitoring**: Story point tracking, sprint velocity, change request log

### Risk 3: Data Migration Complexity

- **Description**: Migrating existing accommodation data to new listing structure proves complex, causing data inconsistencies.
- **Impact if occurs**: Listings break, client access issues, revenue loss, customer complaints.
- **Mitigation**:
  - Develop migration scripts in parallel with entity implementation
  - Test migrations on anonymized production data copy
  - Phased rollout: 10% of accommodations → validate → 50% → validate → 100%
  - Rollback plan: Keep old schema tables until migration validated (1 month)
  - Manual verification of high-value clients
- **Monitoring**: Migration success rate tracking, automated data consistency checks

---

## 7. Out of Scope / Future Work

**Explicitly Out of Scope:**

- **Multi-currency support**: ARS only in v1. Reason: Complexity of FX rates, accounting, localization. Future: Q2 2026 with USD support.
- **Tax calculation and compliance**: Manual tax entry by admins in v1. Reason: Argentina tax rules complexity, requires specialized service. Future: Integrate tax service (e.g., Avalara) in Q3 2026.
- **Advanced analytics dashboard**: Basic reports only (revenue by product, subscription counts). Reason: Time constraint, not critical for launch. Future: Full BI dashboard Q2 2026.
- **Customer self-service portal**: Admin manages most actions in v1. Reason: Reduces scope. Future: Q1 2026 with client portal for cancellations, plan changes.
- **Automated email sequences**: Basic transactional emails only (payment confirmation, trial expiry). Reason: Marketing automation separate project. Future: Integrate with email marketing platform Q3 2026.
- **Referral and affiliate programs**: Not implemented in v1. Reason: Requires separate tracking system. Future: Q4 2026 as growth initiative.

**Future Enhancements:**

- **Subscription analytics**: Track MRR, churn rate, LTV, cohort analysis - Q2 2026
- **Dynamic pricing engine**: A/B test pricing, seasonal adjustments, demand-based pricing - Q3 2026
- **Bulk operations**: Bulk invoice generation, bulk client imports - Q1 2026
- **Payment plan installments**: Allow clients to pay large invoices in installments - Q2 2026
- **Dunning management**: Sophisticated retry logic and customer outreach for failed payments - Q1 2026
- **Audit logs**: Comprehensive change tracking for all entities - Q1 2026
- **API webhooks**: Allow third-party integrations to receive events - Q3 2026

**Technical Debt Created:**

- **Manual tax handling**: Admin must calculate and enter tax manually - Plan: Tax service integration Q3 2026
- **Limited reporting**: Basic queries only, no complex analytics - Plan: BI dashboard Q2 2026
- **No invoice PDF generation**: Invoices viewable on screen, manual export - Plan: PDF generation library integration Q1 2026

---

## 8. Testing Strategy

### 8.1 Test Coverage Requirements

- Unit tests: 90%+ coverage for all services, models, schemas
- Integration tests: All API endpoints, critical business flows (subscription creation → invoice → payment)
- E2E tests: Main user flows (property owner subscription, payment, listing activation)

### 8.2 Test Scenarios

**Unit Tests:**

- All 26 enums validate correctly (valid/invalid values)
- All 210 Zod schemas validate correctly (happy path and edge cases)
- All 35 models perform CRUD operations correctly
- All 35 services enforce business rules (e.g., trial only once, subscription status transitions)
- Polymorphic relationships resolve correctly (SUBSCRIPTION_ITEM → target entities)
- Currency calculations (minor units, conversions)
- Date calculations (subscription renewals, trial periods, expirations)

**Integration Tests:**

- Complete subscription flow: Create client → Subscribe to plan → Generate invoice → Process payment → Grant access
- Refund flow: Process refund → Update invoice → Revoke access
- Discount code application: Validate code → Apply discount → Generate correct invoice
- Campaign reservation: Check slot availability → Reserve → Link to campaign
- Professional service order: Create order → Status updates → Deliverables attached

**E2E Tests:**

- **Property Owner Journey**:
  1. Register and create CLIENT
  2. Browse listing plans
  3. Subscribe to Premium plan with trial
  4. Accommodation listing activated
  5. Trial expires, payment processed
  6. Subscription renews successfully
- **Business Owner Journey**:
  1. Purchase campaign product
  2. Create campaign, upload media assets
  3. Reserve ad slots
  4. Pay for campaign
  5. Campaign goes live
  6. View campaign performance (basic)
- **Admin Journey**:
  1. Create new product (Professional Service)
  2. Define pricing plans
  3. Process refund for client
  4. Issue credit note
  5. Review and manage subscriptions

### 8.3 Performance Testing

- Load test: 100 concurrent users purchasing/subscribing
  - Target: < 500ms response time for 95th percentile
- Stress test: 500 concurrent users
  - Target: System remains functional, graceful degradation if necessary
- Endurance test: 24 hours with steady load (50 concurrent users)
  - Target: No memory leaks, consistent performance, database connections stable
- Spike test: Sudden surge to 1000 users for 5 minutes
  - Target: System recovers, queue handles overflow

---

## 9. Documentation Requirements

**Documentation to Create/Update:**

- [x] API documentation (OpenAPI/Swagger for all 35 entity endpoints)
- [x] Database schema documentation (ERD with relationships, constraints, indexes)
- [x] Service layer documentation (JSDoc for all 35 services)
- [x] Admin user guide (product management, billing management, refund processing)
- [x] Client user guide (subscriptions, payments, service orders)
- [x] Deployment guide (environment variables, database migrations, initial seed data)
- [x] Architecture decision record (polymorphic subscription system rationale)

---

## 10. Deployment Plan

**Deployment Type**: Phased Rollout with Feature Flags

**Rollout Plan:**

1. **Phase 0 - Infrastructure** (Week 1):
   - Deploy database migrations (35 tables)
   - Seed initial data (products, pricing plans, service types)
   - Enable feature flag: `business_model_system` = false (hidden)

2. **Phase 1 - Internal Testing** (Week 2):
   - Feature flag: `business_model_system` = true for admins only
   - Admin creates test products and subscriptions
   - QA team validates all flows
   - Fix critical bugs

3. **Phase 2 - Beta Users** (Week 3-4):
   - Feature flag: `business_model_system` = true for 10 selected beta clients
   - Beta clients test real subscriptions (discounted/free)
   - Gather feedback, fix issues
   - Monitor performance metrics

4. **Phase 3 - General Availability** (Week 5):
   - Feature flag: `business_model_system` = true for all users
   - Marketing announcement
   - Monitor closely for 48 hours
   - Support team prepared for questions

**Rollback Plan:**

- **Trigger**: Critical bug (payment processing failure rate > 10%, data corruption, security vulnerability)
- **Steps**:
  1. Set feature flag `business_model_system` = false (immediate)
  2. Stop all background jobs (invoicing, notifications)
  3. Investigate issue, fix in dev environment
  4. Deploy hotfix or prepare for re-rollout
- **Data**: Subscriptions/payments created during deployment remain in database (mark as pending review if needed)

**Feature Flags:**

- `business_model_system`: Master toggle for entire system
- `subscription_trials`: Enable/disable trial functionality
- `mercado_pago_payments`: Toggle payment processing (for testing)
- `notifications_enabled`: Control notification sending

---

## 11. Related Documents

**Planning Documents:**

- [Technical Analysis](./tech-analysis.md) - (To be created by product-technical agent)
- [TODOs & Progress](./TODOs.md) - (To be created after planning approval)

**Design Documents:**

- Mockups: (To be created by ui-ux-designer agent)
- Entity Relationship Diagram: `docs/dev/business_model/diagram.md`

**Technical Documents:**

- Implementation Guide: `docs/dev/business_model/business_model_implementation.md`
- Implementation Phases: `docs/dev/business_model/implementation_phases.md`
- Technical Specifications: `docs/dev/business_model/technical_analysis.md`

**External References:**

- Mercado Pago API Documentation: https://www.mercadopago.com.ar/developers/en/docs
- Drizzle ORM Documentation: https://orm.drizzle.team/
- Zod Validation: https://zod.dev/
- Clerk Authentication: https://clerk.com/docs

---

## 12. Stakeholder Sign-Off

| Role | Name | Status | Date | Comments |
|------|------|--------|------|----------|
| Product Owner | TBD | Pending | - | Awaiting review |
| Tech Lead | TBD | Pending | - | Technical feasibility to be confirmed in tech-analysis.md |
| UX Designer | TBD | Pending | - | Mockups to be created |
| Security Engineer | TBD | Pending | - | Security review needed |

---

## 13. Changelog

| Date | Author | Changes | Version |
|------|--------|---------|---------|
| 2025-10-29 | Product Functional Agent | Initial draft - Complete PDR with 36 user stories covering all 35 entities | 0.1 |

---

## 14. Questions & Answers

**Q1**: Should we support multiple currencies in v1?
**A1**: No. ARS only in v1 to reduce complexity. Multi-currency support deferred to Q2 2026. - 2025-10-29 - Product Team

**Q2**: How do we handle refunds for partially consumed subscriptions?
**A2**: Prorated refunds based on unused days. Calculation: (daysRemaining / totalDays) × subscriptionAmount. Manual admin approval required. - 2025-10-29 - Product Team

**Q3**: Can clients have multiple active subscriptions to the same product?
**A3**: Yes, if the subscriptions are for different target entities (e.g., multiple accommodations). No if same target entity (prevents duplicate listings). - 2025-10-29 - Product Team

**Q4**: What happens to access rights when subscription is cancelled?
**A4**: Access rights remain valid until the end of the current billing period (validTo date). No immediate revocation. - 2025-10-29 - Product Team

**Q5**: How do we handle failed Mercado Pago webhooks?
**A5**: Implement idempotency via providerPaymentId. If webhook arrives multiple times, only process once. If webhook never arrives, poll MP API after 15 minutes to check payment status. - 2025-10-29 - Product Team

---

## Notes

**General Notes:**

This PDR defines a comprehensive monetization system for Hospeda with 35 entities organized into 12 functional groups. The system uses a polymorphic architecture (SUBSCRIPTION_ITEM) to flexibly link subscriptions/purchases to diverse entity types (sponsorships, campaigns, listings, services). This design provides maximum flexibility for future product types while maintaining a unified billing and access control system.

**Key Architectural Decision: Polymorphic Subscription Items**

The SUBSCRIPTION_ITEM entity uses polymorphic associations (sourceType/sourceId for subscription vs purchase, entityType/linkedEntityId for target entity). This allows one system to handle all product types without creating separate subscription systems for each product category. This decision adds complexity to queries but provides unmatched flexibility and consistency.

**Meeting Notes:**

- **2025-10-29**: Initial PDR creation based on existing technical documentation (business_model_implementation.md, diagram.md, technical_analysis.md, implementation_phases.md). Confirmed scope: all 35 entities, 7 polymorphic target types, Mercado Pago integration.

---

**Status**: This PDR is **Draft** and requires stakeholder review.

**Next Actions**:

1. Product Owner reviews and approves business requirements
2. Tech Lead creates `tech-analysis.md` with technical implementation details
3. UX Designer creates high-fidelity mockups for critical screens
4. Security Engineer reviews data privacy and payment security requirements
5. After approvals, create `TODOs.md` with atomized task breakdown

**Owner**: Product Team
