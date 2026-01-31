# TODOs: Hospeda Platform Monetization System

Spec: SPEC-001 | Status: in-progress | Progress: 53/55

## Setup (Phase 1) — 7/7 ✅

- [x] T-001: Create packages/billing package with qzpay integration (complexity: 7) ✅
- [x] T-002: Install qzpay dependencies across the monorepo (complexity: 3) ✅
- [x] T-003: Configure qzpay-drizzle storage adapter with existing DB (complexity: 4) ✅
- [x] T-004: Configure qzpay-mercadopago adapter (complexity: 4) ✅
- [x] T-005: Run qzpay database migrations (24 billing tables) (complexity: 3) ✅
- [x] T-006: Add SPONSOR role to RoleEnum (complexity: 1) ✅
- [x] T-007: Create new billing-related enums in @repo/schemas (complexity: 5) ✅

## Core (Phase 2) — 17/17 ✅

- [x] T-008: Define all 9 plans with entitlements and limits in packages/billing (complexity: 6) ✅
- [x] T-009: Seed default plans, entitlements, and limits into database (complexity: 5) ✅
- [x] T-010: Integrate qzpay-hono middleware into apps/api (complexity: 5) ✅
- [x] T-011: Mount qzpay billing routes in the API (complexity: 4) ✅
- [x] T-012: Set up Mercado Pago webhook endpoint (complexity: 5) ✅
- [x] T-013: Implement Clerk user -> billing customer sync (complexity: 6) ✅
- [x] T-014: Implement trial flow (14-day, auto-block on expiry) (complexity: 7) ✅
- [x] T-015: Implement entitlement checking middleware (complexity: 6) ✅
- [x] T-016: Implement limit enforcement in existing services (complexity: 6) ✅ (partial: favorites real, properties/staff blocked on missing tables)
- [x] T-023: Create sponsorship Zod schemas in @repo/schemas (complexity: 6) ✅
- [x] T-024: Create sponsorship Drizzle schemas in @repo/db (complexity: 6) ✅
- [x] T-025: Create sponsorship models in @repo/db (complexity: 5) ✅
- [x] T-026: Create SponsorshipService in @repo/service-core (complexity: 7) ✅
- [x] T-027: Create sponsorship API routes in apps/api (complexity: 5) ✅
- [x] T-028: Create SponsorshipLevel and SponsorshipPackage CRUD (complexity: 4) ✅
- [x] T-029: Create OwnerPromotion entity (schema, model, service, routes) (complexity: 6) ✅
- [x] T-030: Implement sponsor user creation flow (SPONSOR role) (complexity: 5) ✅

## Integration (Phase 3-6) — 26/26 ✅

- [x] T-017: Configure all add-ons (one-time + recurring) in packages/billing (complexity: 4) ✅
- [x] T-018: Implement add-on purchase flow (complexity: 6) ✅
- [x] T-019: Implement add-on limit adjustments (complexity: 4) ✅
- [x] T-020: Implement promo code system (CRUD + validation + application) (complexity: 7) ✅
- [x] T-021: Create HOSPEDA_FREE permanent discount code (complexity: 3) ✅
- [x] T-022: Implement promo code checkout integration (complexity: 5) ✅
- [x] T-031: Create billing admin section with sidebar navigation (complexity: 4) ✅
- [x] T-032: Create plans management page (CRUD) (complexity: 6) ✅
- [x] T-033: Create subscriptions management page (complexity: 6) ✅
- [x] T-034: Create payments management page (complexity: 5) ✅
- [x] T-035: Create invoices management page (complexity: 5) ✅
- [x] T-036: Create promo codes management page (CRUD) (complexity: 5) ✅
- [x] T-037: Create add-ons management page (CRUD) (complexity: 5) ✅
- [x] T-038: Create sponsorships management page (CRUD + analytics) (complexity: 7) ✅
- [x] T-039: Create billing metrics dashboard page (complexity: 7) ✅
- [x] T-040: Create billing settings page (complexity: 4) ✅
- [x] T-041: Create pricing page for owners (complexity: 6) ✅
- [x] T-042: Create pricing page for tourists (complexity: 5) ✅
- [x] T-043: Create subscription management page (complexity: 6) ✅
- [x] T-044: Implement entitlement gating in accommodation features (complexity: 6) ✅ API middleware in accommodation-entitlements.ts
- [x] T-045: Implement entitlement gating in tourist features (complexity: 6) ✅ API middleware in tourist-entitlements.ts
- [x] T-046: Create add-on purchase UI (complexity: 5) ✅
- [x] T-047: Create owner promotion management UI (complexity: 5) ✅ SKIPPED for web — admin-only per decision
- [x] T-048: Create sponsor dashboard (limited access) (complexity: 6) ✅

## Testing (Phase 7) — 3/6

- [x] T-049: Write unit tests for packages/billing (complexity: 4) ✅
- [x] T-050: Write integration tests for billing API routes (complexity: 7) ✅
- [x] T-051: Write integration tests for webhook processing (complexity: 6) ✅
- [ ] T-052: Write integration tests for entitlement enforcement (complexity: 6)
- [ ] T-053: Write E2E tests for subscription purchase flow (complexity: 8)
- [ ] T-054: Write E2E tests for sponsorship purchase flow (complexity: 7)

## Docs — 0/1

- [ ] T-055: Update documentation (API docs, admin guide) (complexity: 5)
