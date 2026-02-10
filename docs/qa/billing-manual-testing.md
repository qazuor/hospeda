# Billing System - Manual UI Testing Guide

## Document Information

- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Owner**: QA Team
- **Status**: Active
- **Related**: SPEC-001-monetization-system

## Table of Contents

- [Pre-requisites](#pre-requisites)
- [Pre-requisites](#pre-requisites)
- [Phase 1: Public Pricing Pages](#phase-1-public-pricing-pages)
- [Phase 2: Registration and Trial](#phase-2-registration-and-trial)
- [Phase 3: Subscription Dashboard](#phase-3-subscription-dashboard)
- [Phase 4: Plan Change Flow](#phase-4-plan-change-flow)
- [Phase 5: Cancellation and Reactivation](#phase-5-cancellation-and-reactivation)
- [Phase 6: Add-ons](#phase-6-add-ons)
- [Phase 7: Payment Methods](#phase-7-payment-methods)
- [Phase 8: Promo Codes](#phase-8-promo-codes)
- [Phase 9: Admin - Core Management](#phase-9-admin---core-management)
- [Phase 10: Admin - Promotions](#phase-10-admin---promotions)
- [Phase 11: Admin - Monitoring](#phase-11-admin---monitoring)
- [Phase 12: Edge Cases and Error Handling](#phase-12-edge-cases-and-error-handling)
- [Bug Report Template](#bug-report-template)

---

## Pre-requisites

### Services Required

| Service | URL | Description |
|---------|-----|-------------|
| API | `http://localhost:3001` | Hono backend |
| Web | `http://localhost:4321` | Astro + React public frontend |
| Admin | `http://localhost:3000` | TanStack Start admin dashboard |
| PostgreSQL | `localhost:5436` | Database (via Docker) |
| Redis | `localhost:6381` | Cache (via Docker) |

### Start All Services

```bash
pnpm dev:all
```

### Required Environment Variables

Verify these are set in `.env` before starting:

```bash
# Database (REQUIRED)
HOSPEDA_DATABASE_URL=postgresql://user:password@localhost:5436/hospeda

# MercadoPago Sandbox (REQUIRED for billing)
MERCADO_PAGO_ACCESS_TOKEN=TEST-your_access_token_here
MERCADO_PAGO_SANDBOX=true

# Clerk Auth (REQUIRED)
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE
HOSPEDA_CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE

# Optional but recommended
SENTRY_DSN=                  # Leave empty to disable
CRON_SECRET=test-secret      # For cron endpoint testing
```

### Database Setup

Ensure billing tables exist:

```bash
pnpm db:migrate    # Apply pending migrations
pnpm db:studio     # Visual verification (optional)
```

### Test Accounts

| Role | Email | Purpose |
|------|-------|---------|
| New user | Create fresh in Clerk | Test trial flow |
| Owner with subscription | Existing user with active plan | Test management |
| Admin | User with admin role in Clerk | Test admin pages |
| Tourist | User with tourist plan | Test tourist features |

---

## Phase 1: Public Pricing Pages

**Goal**: Verify pricing pages render correctly without authentication.

### T1.1 - Owner Pricing Page

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `http://localhost:4321/precios/propietarios` | Page loads without errors |
| 2 | Verify plan cards | 3 plans visible: Basico, Pro, Premium |
| 3 | Check prices | Prices shown in ARS with proper formatting (e.g., "$2.900/mes") |
| 4 | Check highlighted plan | "Pro" plan has visual highlight and "Mas Popular" badge |
| 5 | Check trial text | All plans show "14 dias de prueba gratis" |
| 6 | Check features list | Each plan shows features with checkmarks |
| 7 | Scroll to FAQ | FAQ accordion is visible and expandable |

### T1.2 - Tourist Pricing Page

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `http://localhost:4321/precios/turistas` | Page loads without errors |
| 2 | Verify plan cards | 3 plans: Free, Plus, VIP |
| 3 | Check free plan | Free plan shows "$0" or "Gratis", no trial text |
| 4 | Check VIP banner | VIP Promotions banner visible |
| 5 | Check recommended | "Plus" plan is highlighted as recommended |

### T1.3 - Billing Interval Toggle

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On either pricing page, find toggle | Toggle shows "Mensual" / "Anual" |
| 2 | Click "Anual" | Prices update to annual amounts |
| 3 | Check savings badge | Savings percentage badge appears (e.g., "Ahorra 20%") |
| 4 | Click "Mensual" | Prices revert to monthly amounts |
| 5 | Toggle back and forth | No visual glitches, smooth transition |

### T1.4 - CTA Without Authentication

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure you are NOT logged in | No user avatar in header |
| 2 | Click "Comenzar" on any plan | Redirects to signup page |
| 3 | Check URL | URL should include plan identifier as parameter |

---

## Phase 2: Registration and Trial

**Goal**: Verify new user registration triggers trial period.

### T2.1 - New Owner Registration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `/precios/propietarios` | Pricing page loads |
| 2 | Click CTA on "Pro" plan | Redirects to Clerk signup |
| 3 | Complete registration | Account created successfully |
| 4 | After signup, navigate to `/mi-cuenta/suscripcion` | Subscription page loads |
| 5 | Check SubscriptionStatusCard | Shows "En prueba" status |
| 6 | Check trial countdown | Shows "X dias restantes" (should be 14 or close) |
| 7 | Check plan name | Shows the plan selected during signup |

### T2.2 - Post-Checkout Banner

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/mi-cuenta/suscripcion?checkout=success` | Page loads |
| 2 | Check banner | Green success banner appears at top |
| 3 | Wait 10 seconds | Banner auto-dismisses |
| 4 | Check URL | `?checkout=success` param removed from URL |
| 5 | Navigate to `/mi-cuenta/suscripcion?checkout=cancelled` | Page loads |
| 6 | Check banner | Yellow/orange cancellation banner appears |

---

## Phase 3: Subscription Dashboard

**Goal**: Verify subscription management UI for authenticated users.

### T3.1 - Subscription Status Card

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as user with active subscription | Login successful |
| 2 | Go to `/mi-cuenta/suscripcion` | Page loads, skeleton shows briefly |
| 3 | Check status card | Shows plan name, status badge, renewal date |
| 4 | Check status badge color | Active = green, Trial = blue, Cancelled = red |
| 5 | Check action buttons | "Cambiar plan" and "Cancelar" buttons visible |
| 6 | Check date formatting | Dates in Spanish format (e.g., "5 de febrero de 2026") |
| 7 | Check currency | Amounts in ARS format (e.g., "$2.900") |

### T3.2 - Usage Meters

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On subscription page, find UsageMeters | Usage section visible |
| 2 | Check meter bars | Progress bars showing current usage vs limits |
| 3 | Check labels | Each meter labeled with resource name |
| 4 | Check percentages | Usage percentage displayed (e.g., "3/10 alojamientos") |
| 5 | If near limit | Warning color change (yellow at 80%, red at 90%+) |

### T3.3 - Active Addons Section

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find ActiveAddons on subscription page | Section visible |
| 2 | If user has addons | List of active addons with names and expiry dates |
| 3 | If user has no addons | Empty state with "Explorar complementos" CTA |
| 4 | Check status badges | Active = green, Expiring soon = yellow, Expired = red |
| 5 | Click CTA | Navigates to `/mi-cuenta/addons` |

### T3.4 - Billing History Page

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `/mi-cuenta/billing` | Page loads |
| 2 | Check breadcrumb | "Mi cuenta > Facturacion" visible |
| 3 | Check sections | ActiveAddons, UsageMeters, BillingHistory sections present |
| 4 | Check billing history | List of past transactions/invoices |
| 5 | If no history | Empty state message |

### T3.5 - Loading and Error States

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Reload `/mi-cuenta/suscripcion` | Skeleton loaders appear briefly |
| 2 | Stop API server, reload page | Error state with retry button |
| 3 | Click "Reintentar" | Attempts to reload data |
| 4 | Start API again, click retry | Data loads successfully |

---

## Phase 4: Plan Change Flow

**Goal**: Verify upgrade and downgrade between plans.

### T4.1 - Open Plan Change Dialog

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On `/mi-cuenta/suscripcion` as user with active plan | Status card visible |
| 2 | Click "Cambiar plan" | Modal dialog opens |
| 3 | Check plan list | Available plans listed with prices |
| 4 | Check current plan | Current plan marked as "Plan actual" (grayed out) |
| 5 | Check category filter | Only plans from same category shown |

### T4.2 - Upgrade Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | In plan change dialog, select a higher plan | Plan gets selected |
| 2 | Check price difference | Shows positive price difference (e.g., "+$1.000/mes") |
| 3 | Check label | Shows "Upgrade" indicator |
| 4 | Click "Confirmar cambio" | Loading state appears |
| 5 | Wait for completion | Success message appears for 2 seconds |
| 6 | Dialog closes | SubscriptionStatusCard refreshes with new plan |

### T4.3 - Downgrade Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | In plan change dialog, select a lower plan | Plan gets selected |
| 2 | Check price difference | Shows negative price difference |
| 3 | Check warning | Downgrade warning message visible |
| 4 | Confirm downgrade | Loading, then success |
| 5 | Verify status card | Updated to new plan |

### T4.4 - Dialog Keyboard Navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open plan change dialog | Dialog visible |
| 2 | Press Escape | Dialog closes |
| 3 | Open again, press Tab | Focus moves through plan options |

---

## Phase 5: Cancellation and Reactivation

**Goal**: Verify subscription cancellation and reactivation flows.

### T5.1 - Cancel Subscription

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On `/mi-cuenta/suscripcion` with active plan | Cancel button visible |
| 2 | Click "Cancelar suscripcion" | Confirmation dialog opens |
| 3 | Check dialog content | Warning message, option for "al final del periodo" |
| 4 | Check cancel options | Immediate vs end-of-period options |
| 5 | Select "Al final del periodo" | Option selected |
| 6 | Click "Confirmar cancelacion" | Loading, then success |
| 7 | Check status card | Shows "Cancelada" with end date |

### T5.2 - Reactivate Subscription

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With cancelled subscription | Status shows "Cancelada" |
| 2 | Find "Reactivar" button | Button visible |
| 3 | Click "Reactivar" | Loading state |
| 4 | Wait for completion | Subscription back to "Activa" |
| 5 | Check renewal date | Renewal date updated |

---

## Phase 6: Add-ons

**Goal**: Verify add-on browsing and purchase flows.

### T6.1 - Add-on Catalog

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `/mi-cuenta/addons` | Catalog page loads |
| 2 | Check addon list | Add-ons listed with names and descriptions |
| 3 | Check price format | Prices in ARS (e.g., "$500") |
| 4 | Check type badges | "Pago unico" or "Mensual" badges visible |
| 5 | Check categories | Addons grouped by category (propietarios/complejos) |
| 6 | Check benefits | Each addon shows what it includes |
| 7 | For one-time addons | Duration shown (e.g., "30 dias") |

### T6.2 - Purchase Add-on

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click purchase button on an addon | Checkout flow initiates |
| 2 | Complete payment (sandbox) | Redirect back to app |
| 3 | Navigate to `/mi-cuenta/mis-addons` | Purchased addon visible |
| 4 | Check addon status | Shows "Activo" with expiry date |

### T6.3 - My Add-ons

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `/mi-cuenta/mis-addons` | Page loads |
| 2 | Check addon sections | Grouped by status: Active, Expired, Cancelled |
| 3 | If no addons | Empty state with CTA to catalog |
| 4 | Check promotional banner | "Comprar mas complementos" banner visible |

---

## Phase 7: Payment Methods

**Goal**: Verify payment method management.

### T7.1 - View Payment Methods

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find PaymentMethodSection in billing page | Section visible |
| 2 | Check payment method list | Cards listed with brand icon and last 4 digits |
| 3 | Check default badge | Default method has "Predeterminado" badge |
| 4 | If no methods | Empty state with "Agregar metodo de pago" CTA |

### T7.2 - Change Default Method

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a non-default payment method | "Establecer como predeterminado" button visible |
| 2 | Click the button | Loading spinner appears |
| 3 | Wait for completion | Badge moves to the newly selected method |
| 4 | Verify persistence | Refresh page, default is preserved |

### T7.3 - Add Payment Method

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Agregar metodo de pago" | Redirect or modal opens |
| 2 | Complete payment method form | Method added |
| 3 | Return to billing page | New method appears in list |

---

## Phase 8: Promo Codes

**Goal**: Verify promotional code application flow.

### T8.1 - Valid Promo Code

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to pricing page (`/precios/propietarios`) | Page loads |
| 2 | Find promo code input | Input field visible with "Codigo promocional" label |
| 3 | Enter valid code (e.g., "HOSPEDA_FREE") | Type the code |
| 4 | Click "Aplicar" | Loading state briefly |
| 5 | Check result | Success: discount shown, prices updated on cards |
| 6 | Check plan cards | Prices show original crossed out + new discounted price |

### T8.2 - Invalid Promo Code

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter "INVALID_CODE_12345" in promo input | Type the code |
| 2 | Click "Aplicar" | Loading state briefly |
| 3 | Check result | Error message: "Codigo invalido" or similar |
| 4 | Check prices | Prices remain unchanged |

### T8.3 - Expired Promo Code

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter an expired code | Type the code |
| 2 | Click "Aplicar" | Loading state briefly |
| 3 | Check result | Error message about expired code |

### T8.4 - Checkout with Promo

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Apply valid promo code | Discount applied |
| 2 | Click CTA on a plan (logged in) | Checkout initiates |
| 3 | Verify checkout amount | Discounted amount in MercadoPago checkout |

---

## Phase 9: Admin - Core Management

**Goal**: Verify admin billing management pages.

**Login**: Access admin at `http://localhost:3000` with admin account.

### T9.1 - Plans Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/plans` | Plans list loads |
| 2 | Check filter | Category filter (Owner, Complex, Tourist) works |
| 3 | Check plan details | Name, price, interval, status visible |
| 4 | Toggle plan active/inactive | Status updates, confirmation shown |
| 5 | Click on a plan | Detail view with entitlements and limits |

### T9.2 - Subscriptions Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/subscriptions` | Subscription list loads |
| 2 | Check filters | Status filter (Active, Trialing, Cancelled, etc.) |
| 3 | Check search | Search by user name or email works |
| 4 | Click on subscription | Detail view expands |
| 5 | Check detail content | Plan, status, dates, payment history, entitlements |
| 6 | Try "Extend trial" action | Trial extension dialog, extend, verify |
| 7 | Try "Cancel" action | Cancel confirmation, verify status change |

### T9.3 - Payments

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/payments` | Payment list loads |
| 2 | Check filters | Status, method, date range, amount filters work |
| 3 | Search by ID or email | Results update |
| 4 | Click on payment | Detail: user, plan, transaction ID, amount |
| 5 | Check refund option | "Procesar reembolso" button available for completed payments |

### T9.4 - Invoices

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/invoices` | Invoice list loads |
| 2 | Check filters | Status (draft, open, paid, void), date, user filters |
| 3 | Click on invoice | Detail with line items, subtotal, IVA (21%), total |
| 4 | Try "Marcar como pagada" | Status updates to paid |
| 5 | Try "Enviar recordatorio" | Confirmation, notification sent |
| 6 | Try "Anular" on draft | Invoice marked as void |

### T9.5 - Add-ons Purchased

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/addons` | Addon purchases list loads |
| 2 | Check filters | Status (active, expired, cancelled), type, search |
| 3 | Click on addon | Detail: customer, type, purchase date, expiry |
| 4 | Try "Force activate" | Addon status changes to active |
| 5 | Try "Force expire" | Addon status changes to expired |

---

## Phase 10: Admin - Promotions

**Goal**: Verify promotional management features.

### T10.1 - Promo Code Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/promo-codes` | Promo code list loads |
| 2 | Click "Crear codigo" | Creation form/dialog opens |
| 3 | Fill: code "TEST20", type "percentage", value 20 | Form accepts values |
| 4 | Set max uses: 100, per user: 1 | Limits configured |
| 5 | Set valid dates | From/to date pickers work |
| 6 | Select applicable plans | Plan checkboxes work |
| 7 | Save | Code created, appears in list |
| 8 | Toggle active/inactive | Status updates |
| 9 | Delete a code | Confirmation dialog, code removed |

### T10.2 - Sponsorships

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/sponsorships` | Page with 3 tabs loads |
| 2 | Check "Patrocinios" tab | List of sponsorships with approve/cancel actions |
| 3 | Check "Niveles" tab | Bronze, Silver, Gold, Standard, Premium levels |
| 4 | Check "Paquetes" tab | Monthly packages with included posts/events |
| 5 | Try creating a new level | Form works, level created |

### T10.3 - Owner Promotions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/owner-promotions` | Promotions list loads |
| 2 | Click "Crear promocion" | Form opens |
| 3 | Select type (%, fixed, free night, special price) | Type options available |
| 4 | Fill details and save | Promotion created |
| 5 | Check entitlement gates | Some features gated by plan (requires subscription) |
| 6 | Check usage stats | Redemption count visible |

---

## Phase 11: Admin - Monitoring

**Goal**: Verify monitoring and configuration pages.

### T11.1 - Metrics Dashboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/metrics` | Dashboard loads |
| 2 | Check system stats cards | Global billing statistics visible |
| 3 | Check approaching limits table | Customers at 90%+ usage listed |
| 4 | Search customer by email | Customer usage details appear |
| 5 | Check usage display | Resource usage vs limits per customer |

### T11.2 - Billing Settings

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/settings` | Settings page loads |
| 2 | Check Trial section | Owner trial days (14), complex trial days (28), auto-block toggle |
| 3 | Check Payment section | Grace period (3 days), retry count (3), interval, currency (ARS) |
| 4 | Check Webhook section | URL, secret (read-only), last received timestamp |
| 5 | Check Notifications section | Payment reminders, days in advance, receipts toggle |
| 6 | Modify a value | Field editable |
| 7 | Click "Guardar" | Success toast, changes persisted |
| 8 | Refresh page | Modified values still present |

### T11.3 - Cron Jobs

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/cron` | Cron panel loads |
| 2 | Check job list | Scheduled tasks listed with status |
| 3 | Check execution log | Recent executions visible |

### T11.4 - Notification Logs

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/notification-logs` | Log list loads |
| 2 | Check filters | Type (payment_success, trial_ending, etc.) filter |
| 3 | Check channel filter | Email, SMS, push options |
| 4 | Check status filter | Sent, pending, failed options |
| 5 | Click on notification | Detail with payload, metadata, error (if failed) |

### T11.5 - Webhook Events

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/billing/webhook-events` | Page loads with 2 tabs |
| 2 | Check "Eventos" tab | Webhook event history |
| 3 | Check filters | Type, status, provider, date filters |
| 4 | Click on event | JSON payload viewer |
| 5 | Check "Cola de Reintentos" tab | Dead Letter Queue with failed events |
| 6 | Try "Reintentar" on failed event | Event retried, status updates |

---

## Phase 12: Edge Cases and Error Handling

**Goal**: Verify system behavior in edge cases.

### T12.1 - No Subscription

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as user without any subscription | Login OK |
| 2 | Go to `/mi-cuenta/suscripcion` | Page loads |
| 3 | Check status card | Empty state: "No tienes suscripcion" with CTA to pricing |
| 4 | Check action buttons | Only "Ver planes" visible, no cancel/change buttons |

### T12.2 - Trial Expired

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As admin, force-expire a trial (or use expired account) | Trial ends |
| 2 | Log in as that user | Login OK |
| 3 | Try to access a protected feature | 402 response from API |
| 4 | Check UI | UpgradeFallback shown with CTA to subscribe |
| 5 | Billing/docs/export routes | Still accessible (not blocked) |

### T12.3 - Resource Limit Reached

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Use account at max usage for a resource | Setup: create items up to limit |
| 2 | Try to create one more item | Action blocked |
| 3 | Check UI | LimitFallback component shown |
| 4 | Check message | Shows current usage vs limit, CTA to upgrade |

### T12.4 - Feature Not Included in Plan

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Use account on basic plan | Login OK |
| 2 | Try to access premium-only feature | Action blocked |
| 3 | Check UI | UpgradeFallback with plan comparison |

### T12.5 - API Down

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Stop API server | Server stopped |
| 2 | Load `/mi-cuenta/suscripcion` | Page loads (SSR shell) |
| 3 | Check billing components | BillingErrorState shown in each island |
| 4 | Check retry button | "Reintentar" button visible |
| 5 | Start API, click retry | Components recover and show data |

### T12.6 - Concurrent Operations

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open subscription page in 2 browser tabs | Both load |
| 2 | Cancel subscription in tab 1 | Cancellation succeeds |
| 3 | Try to change plan in tab 2 | Appropriate error or stale data warning |

---

## Bug Report Template

When finding issues, use this template:

```markdown
### Bug Title

**Phase/Test**: T[X].[Y] - [Test Name]
**Severity**: Critical / High / Medium / Low
**Environment**: Dev (localhost)

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**: [What should happen]
**Actual Result**: [What actually happened]

**Screenshots**: [Attach if applicable]

**Browser**: [Chrome/Firefox/Safari + version]
**Console Errors**: [If any]
**Network Errors**: [If any API failures]
```

---

## Testing Progress Tracker

| Phase | Tests | Passed | Failed | Blocked | Notes |
|-------|-------|--------|--------|---------|-------|
| Phase 1: Pricing Pages | 4 groups | | | | |
| Phase 2: Registration | 2 groups | | | | |
| Phase 3: Dashboard | 5 groups | | | | |
| Phase 4: Plan Change | 4 groups | | | | |
| Phase 5: Cancel/Reactivate | 2 groups | | | | |
| Phase 6: Add-ons | 3 groups | | | | |
| Phase 7: Payment Methods | 3 groups | | | | |
| Phase 8: Promo Codes | 4 groups | | | | |
| Phase 9: Admin Core | 5 groups | | | | |
| Phase 10: Admin Promos | 3 groups | | | | |
| Phase 11: Admin Monitoring | 5 groups | | | | |
| Phase 12: Edge Cases | 6 groups | | | | |
| **TOTAL** | **46 groups** | | | | |
