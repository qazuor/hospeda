---
proposal: mi-facturacion-host-verification
status: complete
version: 0.1
date: 2026-05-22
agent: Explore
related: 04-settings.md, 03b-endpoint-verification.md
---

# HOST Self-Service Billing Verification

## Goal

Audit what HOST self-service billing functionality exists in the codebase to determine whether the admin panel's "Mi facturación" section should (A) link to existing web app pages, (B) build new admin-only pages, or (C) use a hybrid approach.

## Summary Table

### Backend Endpoints Status

| Endpoint | Path | Status | Notes |
|----------|------|--------|-------|
| List subscriptions | GET /api/v1/protected/billing/subscriptions | ✅ QZPay | Via createBillingRoutes() |
| Get subscription | GET /api/v1/protected/billing/subscriptions/:id | ✅ QZPay | Via createBillingRoutes() |
| Cancel subscription | DELETE /api/v1/protected/billing/subscriptions/:id | ✅ QZPay | Via createBillingRoutes() |
| Change plan | POST /api/v1/protected/billing/subscriptions/change-plan | ✅ Custom | Upgrades/downgrades with proration |
| Subscription status (polling) | GET /api/v1/protected/billing/subscriptions/:localId/status | ✅ Custom | Post-checkout polling |
| List invoices | GET /api/v1/protected/billing/invoices | ✅ QZPay | Via createBillingRoutes() |
| Get invoice | GET /api/v1/protected/billing/invoices/:id | ✅ QZPay | Via createBillingRoutes() |
| Download invoice | GET /api/v1/protected/billing/invoices/:id (PDF) | ✅ QZPay | Via pdfUrl field |
| List payments | GET /api/v1/protected/billing/payments | ✅ QZPay | Via createBillingRoutes() |
| Get payment | GET /api/v1/protected/billing/payments/:id | ✅ QZPay | Via createBillingRoutes() |
| Usage summary | GET /api/v1/protected/billing/usage | ✅ Custom | Plan limits tracking |
| Usage for limit | GET /api/v1/protected/billing/usage/:limitKey | ✅ Custom | Specific resource tracking |
| List plans (public) | GET /api/v1/public/plans | ✅ Custom | Available plans catalog |
| List addons | GET /api/v1/protected/billing/addons | ✅ Custom | Available add-ons |
| Get addon | GET /api/v1/protected/billing/addons/:slug | ✅ Custom | Addon details |
| Purchase addon | POST /api/v1/protected/billing/addons/:slug/purchase | ✅ Custom | Create addon purchase |
| My addons | GET /api/v1/protected/billing/addons/my | ✅ Custom | User's active add-ons |
| Cancel addon | POST /api/v1/protected/billing/addons/:id/cancel | ✅ Custom | Cancel active addon |
| Promo codes (validate) | GET/POST /api/v1/protected/billing/promo-codes | ✅ Custom | Validate & apply codes |
| Start paid subscription | POST /api/v1/protected/billing/subscriptions/start-paid | ✅ Custom | Initial paid plan bootstrap |
| Trial management | POST /api/v1/protected/billing/trial/* | ✅ Custom | Trial reactivation, extensions |

### Payment Methods Status

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Add payment method | ❌ Missing | - | Not in protected/billing routes |
| Edit payment method | ❌ Missing | - | Not in protected/billing routes |
| List payment methods | ❌ Missing | - | Not in protected/billing routes |
| Delete payment method | ❌ Missing | - | Not in protected/billing routes |
| Change payment method | 🟡 Partial | MP preapproval | Via plan change checkout |

### Web App Pages (HOST Self-Service)

| Page | Route | Component | Status | What it does |
|------|-------|-----------|--------|--------------|
| Subscription Dashboard | /{lang}/mi-cuenta/suscripcion | SubscriptionDashboard.client.tsx | ✅ Full | Shows current plan, status, next billing date, payment method (read-only), cancel button |
| Plan features | /{lang}/suscriptores/planes | (External link) | ✅ Full | View available plans (planning ahead) |

### Endpoints Consumed by Web Pages

**SubscriptionDashboard.client.tsx:**
- `userApi.getSubscription()` → GET /api/v1/protected/users/me/subscription
- `billingApi.listInvoices({ page: 1, pageSize: 1 })` → GET /api/v1/protected/billing/invoices (last invoice only)
- Opens pdfUrl directly in new window

**Cancel flow:**
- Modal displays support email (info@hospeda.com) — self-cancel endpoint not yet implemented (SPEC-147)

---

## Backend Endpoint Details

### QZPay Pre-Built Routes (createBillingRoutes)
**File:** `/home/qazuor/projects/WEBS/hospeda-admin-redesign-audit/apps/api/src/routes/billing/index.ts` (lines 72-110)

All routes decorated with:
- `billingAuthMiddleware` — requires user.id OR actor.id
- `billingOwnershipMiddleware` — customers/subscriptions/invoices/payments limited to owner
- `pastDueGraceMiddleware` — blocks past_due users with expired grace

**Routes include:**
- Customers: GET/POST/PUT/DELETE
- Subscriptions: GET/POST/PUT/DELETE (cancel)
- Plans: GET/POST/PUT/DELETE
- Invoices: GET/POST/PUT + /pay + /void
- Payments: GET/POST + /refund
- Entitlements: GET/POST/DELETE
- Checkout: POST (create session), GET (retrieve)
- Webhooks: POST (MercadoPago)

### Custom Routes

**Usage (Plan Limits)**
- **File:** `apps/api/src/routes/billing/usage.ts` (lines 52-209)
- **Routes:**
  - GET /api/v1/protected/billing/usage (line 55)
  - GET /api/v1/protected/billing/usage/:limitKey (line 127)

**Plan Change (Upgrade/Downgrade)**
- **File:** `apps/api/src/routes/billing/plan-change.ts` (lines 426-435)
- **Route:** POST /api/v1/protected/billing/subscriptions/change-plan
- **Logic:** Upgrades immediate with proration checkout; downgrades scheduled for period end

**Subscription Status (Polling)**
- **File:** `apps/api/src/routes/billing/subscription-status.ts` (lines 244-255)
- **Route:** GET /api/v1/protected/billing/subscriptions/:localId/status
- **Purpose:** Front-end polls this after MercadoPago checkout redirect

**Other Custom Routes**
- `addons.ts` — GET /addons, GET /addons/:slug, POST :slug/purchase, GET /my, POST :id/cancel
- `promo-codes.ts` — User validate & apply (admin CRUD on separate admin/promo-codes)
- `start-paid.ts` — POST /subscriptions/start-paid (create new paid subscription)
- `trial.ts` — Trial extensions, reactivation flows
- `public/listPlans.ts` — GET /api/v1/public/plans (public, cacheable)

### Admin Routes
**File:** `apps/api/src/routes/billing/admin/index.ts`

**Custom Hospeda routes (mounted FIRST):**
- GET /api/v1/admin/billing/usage/:customerId — Customer usage summary
- GET/PATCH /api/v1/admin/billing/settings — Billing config
- GET /api/v1/admin/billing/notifications — Notification logs
- POST /api/v1/admin/billing/notifications/cleanup — Retention cleanup
- GET /api/v1/admin/billing/customer-addons, POST :id/expire, POST :id/activate
- GET /api/v1/admin/billing/metrics (+ /activity, /system-usage, /approaching-limits)
- GET /api/v1/admin/billing/subscriptions/:id/events — Lifecycle events
- GET /api/v1/admin/billing/addons, GET :slug — Addon catalog
- GET /api/v1/admin/billing/plans, GET :id — Plan details
- GET/POST/PUT/DELETE /api/v1/admin/billing/promo-codes — Code management

**QZPay Admin tier (mounted LAST):**
- Subscriptions (list, get, cancel, force-cancel, change-plan, extend-trial)
- Payments (list, get, refund, force-refund)
- Invoices (list, get, pay, void, mark-paid)
- Entitlements & Limits management

---

## Web App HOST Self-Service Pages Inventory

### 1. Subscription Dashboard Page
- **Route:** `/{lang}/mi-cuenta/suscripcion/`
- **File:** `apps/web/src/pages/[lang]/mi-cuenta/suscripcion/index.astro`
- **Island Component:** `SubscriptionDashboard.client.tsx`
- **What it displays:**
  - Current plan name + status badge (active/trial/cancelled/expired/past_due/pending)
  - Next billing date (formatted)
  - Payment method (card brand + last4 OR "MercadoPago" fallback)
  - Plan features list (TODO: not yet fetched from /api/v1/public/plans)
  - Actions: Download latest invoice, Cancel subscription (modal → email support), Escalate to admin panel
- **API endpoints consumed:**
  - `userApi.getSubscription()` → GET /api/v1/protected/users/me/subscription
  - `billingApi.listInvoices({ page: 1, pageSize: 1 })` → GET /api/v1/protected/billing/invoices
- **Access:** Authenticated users only (redirects to auth/signin if not logged in)
- **Notes:**
  - Cancel is non-functional (directs to email support) — pending SPEC-147
  - Admin escalation link points to `${ADMIN_URL}/billing/settings` (hardcoded)
  - Payment method is read-only (no edit/change UI)

### 2. Plans Listing / Upgrade Page
- **Route:** `/{lang}/suscriptores/planes`
- **Purpose:** View available plans, upgrade path
- **Status:** Exists but not fully audited (external to mi-facturacion scope)

---

## Web App Endpoint Consumption Summary

**File:** `apps/web/src/lib/api/endpoints-protected.ts`

**Billing API wrapper exports:**

```typescript
export const billingApi = {
  changePlan({ newPlanId, billingInterval }),
  cancelSubscription({ subscriptionId }),
  reactivateSubscription({ planId }),
  createCheckout({ planSlug, billingInterval }),
  listInvoices(params),
  listPayments(params),
  getAddons(),
};
```

All methods use `apiClient.getProtected()` / `apiClient.postProtected()` which handle credentials: 'include' automatically.

---

## Key Findings

### What EXISTS in HOST Self-Service (Web App)
1. ✅ View current subscription (plan name, status, billing date, payment method)
2. ✅ Download last invoice (PDF)
3. ✅ View available plans
4. ✅ Change plan (link to checkout)
5. ✅ View usage/limits (endpoint exists but not integrated into UI)
6. ✅ Manage add-ons (endpoints exist but no UI)
7. ✅ Promo codes (endpoints exist but no dedicated UI)

### What's MISSING or INCOMPLETE
1. ❌ Self-cancel subscription (endpoint exists, no UI — directs to email)
2. ❌ Add/edit/remove payment methods (no endpoints)
3. ❌ View payment history (endpoint exists, no UI)
4. ❌ View invoice history beyond latest (endpoint exists, UI fetches only 1)
5. ❌ Promo code validation UI (endpoint exists)
6. ❌ Add-on management UI (endpoints exist, no UI)
7. ❌ Usage/limits dashboard (endpoint exists, no UI)

---

## Recommendation: **HYBRID (A + B)**

### Rationale

**Option A alone (link to web pages) is INSUFFICIENT because:**
- Web app currently provides minimal functionality (subscription read-only view + download 1 invoice)
- Most endpoints exist but have no UI (usage, addons, invoices list, payments, promo codes)
- Self-cancel is non-functional (directs to email)
- Payment method management completely absent

**Option B alone (new admin pages) is WASTEFUL because:**
- Some clean HOST self-service pages already exist (subscription dashboard is well-designed)
- Duplicating the subscription view in admin panel adds maintenance burden
- Linking to a polished web page is better UX than Admin-only pages for read-only views

**Hybrid: Link + Build**
- **LINK to web app for:**
  - Subscription status view (SubscriptionDashboard is mature)
  - Plan upgrade flow (already optimized for HOST user)
  
- **BUILD new admin pages for:**
  - Invoice history with pagination (web only fetches latest)
  - Payment history view
  - Add-on management (purchase, cancel, view active)
  - Usage/limits dashboard (endpoint exists, no UI anywhere)
  - Promo code entry (validate + apply)
  - Payment method management (requires new backend endpoints)

---

## Admin Pages V1 Should Include

### 1. Invoices Page
- List all invoices with status, date, amount
- Download PDF
- Filter by status/date range
- Consume: GET /api/v1/protected/billing/invoices (paginated)

### 2. Payment History Page
- List all payments with method, date, amount, status
- Consume: GET /api/v1/protected/billing/payments (paginated)

### 3. Add-ons Page
- View available add-ons (catalog)
- View active add-ons with expiry
- Purchase new add-ons
- Cancel active add-ons
- Consume: GET /api/v1/protected/billing/addons (list), GET :slug, POST :slug/purchase, POST :id/cancel, GET /my

### 4. Usage & Limits Dashboard
- Display plan limits + current usage per resource
- Show threshold status (ok/warning/critical/exceeded)
- Upgrade CTA when critical
- Consume: GET /api/v1/protected/billing/usage

### 5. Promo Codes Entry
- Input field to validate + apply promo code
- Show discount preview
- Apply to current subscription (if upgrading)
- Consume: GET/POST /api/v1/protected/billing/promo-codes

### 6. Subscription Actions (link to web or embed)
- View current plan details
- Change plan (link to web checkout or embedded flow)
- View next charge estimate
- Consume: Existing plan-change endpoint (web handles checkout)

## Missing Backend Endpoints (Required for V1)

**Payment Methods Management** — Currently zero endpoints exist:
- POST /api/v1/protected/billing/payment-methods (add)
- PUT /api/v1/protected/billing/payment-methods/:id (edit)
- GET /api/v1/protected/billing/payment-methods (list)
- DELETE /api/v1/protected/billing/payment-methods/:id (remove)

**Next Charge Preview** — Currently missing:
- GET /api/v1/protected/billing/invoices/next-preview (estimated next charge)

These two endpoint families must be implemented before admin "Mi facturación" can be feature-complete.

---

## References

- Backend billing router: `/home/qazuor/projects/WEBS/hospeda-admin-redesign-audit/apps/api/src/routes/billing/index.ts`
- Web SubscriptionDashboard: `/home/qazuor/projects/WEBS/hospeda-admin-redesign-audit/apps/web/src/components/account/SubscriptionDashboard.client.tsx`
- Web endpoints: `/home/qazuor/projects/WEBS/hospeda-admin-redesign-audit/apps/web/src/lib/api/endpoints-protected.ts`
- Admin routes: `/home/qazuor/projects/WEBS/hospeda-admin-redesign-audit/apps/api/src/routes/billing/admin/index.ts`
