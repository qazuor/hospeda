# Billing System - End-to-End Manual Testing Checklist

## Document Information

- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Owner**: QA Team
- **Status**: Active
- **Related**: F5-006, SPEC-001-monetization-system

## Table of Contents

- [Overview](#overview)
- [Test Environment Setup](#test-environment-setup)
- [Test Data Requirements](#test-data-requirements)
- [Flow 1: New User Trial → Subscription](#flow-1-new-user-trial--subscription)
- [Flow 2: Plan Upgrade/Downgrade](#flow-2-plan-upgradedowngrade)
- [Flow 3: Promo Code Redemption](#flow-3-promo-code-redemption)
- [Flow 4: Payment Method Management](#flow-4-payment-method-management)
- [Flow 5: Add-on Purchase](#flow-5-add-on-purchase)
- [Bug Report Template](#bug-report-template)
- [Sign-off Section](#sign-off-section)

## Overview

### Purpose

This document provides comprehensive manual testing procedures for all critical billing system flows in Hospeda. Each flow includes detailed steps, expected results, and verification points.

### Testing Objectives

- Verify complete user journeys work as designed
- Validate business logic and entitlement changes
- Ensure proper error handling and edge cases
- Confirm UI/UX meets requirements
- Validate integrations with QZPay and database

### Test Levels

- **P0 - Critical**: Must pass for release
- **P1 - High**: Should pass, blocking if fails
- **P2 - Medium**: Important but not blocking
- **P3 - Low**: Nice to have, cosmetic issues

### Testing Approach

- **Black Box Testing**: Test from user perspective
- **Exploratory Testing**: Look for edge cases
- **Regression Testing**: Verify existing functionality
- **Integration Testing**: Validate external services

## Test Environment Setup

### Prerequisites Checklist

#### 1. Environment Access

- [ ] Access to staging environment: `https://staging.hospeda.com.ar`
- [ ] Access to admin panel: `https://admin.staging.hospeda.com.ar`
- [ ] VPN connected (if required)
- [ ] Test credentials available

#### 2. Browser Setup

- [ ] Chrome (latest version)
- [ ] Firefox (latest version)
- [ ] Safari (latest version) - macOS/iOS only
- [ ] Clear cache and cookies before each test session
- [ ] Browser console open for error monitoring
- [ ] React DevTools installed (optional)

#### 3. Tools Required

- [ ] Screenshot tool (Snagit, Greenshot, etc.)
- [ ] Screen recording software (Loom, OBS, etc.)
- [ ] Browser DevTools familiar
- [ ] Database client (TablePlus, DBeaver) - for verification
- [ ] API client (Postman, Insomnia) - for direct API testing

#### 4. Test Accounts

Create or verify access to:

- [ ] New user account (no activity)
- [ ] Trial user account (active trial)
- [ ] Free plan user account
- [ ] Basic plan subscriber
- [ ] Pro plan subscriber
- [ ] Admin account

#### 5. QZPay Test Environment

- [ ] QZPay sandbox configured
- [ ] Test API keys loaded
- [ ] Test credit card numbers available
- [ ] Webhook endpoints configured
- [ ] Webhook logs accessible

#### 6. Database Access (Read-Only)

- [ ] Connection to staging database
- [ ] Read permissions verified
- [ ] Queries prepared for common checks

### Environment Variables Verification

Verify these are correctly set in staging:

```bash
# API Environment
QZPAY_API_KEY=test_pk_xxxxx
QZPAY_SECRET_KEY=test_sk_xxxxx
QZPAY_WEBHOOK_SECRET=whsec_xxxxx
DATABASE_URL=postgresql://staging...
NODE_ENV=staging

# Admin Environment
VITE_API_URL=https://api.staging.hospeda.com.ar
VITE_QZPAY_PUBLIC_KEY=test_pk_xxxxx

# Web Environment
PUBLIC_API_URL=https://api.staging.hospeda.com.ar
```

### Test Payment Methods

Use these test cards in QZPay sandbox:

```
# Successful Payment
Card: 4111 1111 1111 1111
Expiry: 12/25
CVV: 123
Name: Test User

# Declined Card
Card: 4000 0000 0000 0002
Expiry: 12/25
CVV: 123

# Insufficient Funds
Card: 4000 0000 0000 9995
Expiry: 12/25
CVV: 123

# Expired Card
Card: 4000 0000 0000 0069
Expiry: 01/20
CVV: 123
```

## Test Data Requirements

### User Accounts

Create test users following this naming convention:

```
Email Pattern: qa.billing.{flow}.{scenario}@test.hospeda.com.ar

Examples:
- qa.billing.trial.new@test.hospeda.com.ar
- qa.billing.upgrade.basic@test.hospeda.com.ar
- qa.billing.promo.valid@test.hospeda.com.ar
```

### Promo Codes

Ensure these test promo codes exist:

```sql
-- Valid 20% discount
Code: TEST20
Type: percentage
Value: 20
Valid Until: 2026-12-31
Max Uses: 100
Status: active

-- Expired code
Code: EXPIRED2025
Type: percentage
Value: 50
Valid Until: 2025-01-01
Status: active

-- Depleted code
Code: SOLDOUT
Type: fixed_amount
Value: 1000
Max Uses: 1
Current Uses: 1
Status: active

-- Invalid/Inactive
Code: INACTIVE
Status: inactive
```

### Test Accommodations

Each test user should have:

- **Free Plan Users**: 1 accommodation (at limit)
- **Trial Users**: 2-3 accommodations
- **Basic Plan Users**: 3-5 accommodations
- **Pro Plan Users**: 5+ accommodations

### Database Verification Queries

```sql
-- Check user subscription status
SELECT
  u.email,
  s.plan_slug,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.trial_ends_at,
  s.qzpay_subscription_id
FROM users u
LEFT JOIN billing_subscriptions s ON u.id = s.user_id
WHERE u.email = 'qa.billing.trial.new@test.hospeda.com.ar';

-- Check user entitlements
SELECT
  e.entitlement_slug,
  e.limit_value,
  e.used_value
FROM billing_entitlements e
JOIN users u ON e.user_id = u.id
WHERE u.email = 'qa.billing.trial.new@test.hospeda.com.ar';

-- Check active promo codes
SELECT
  code,
  discount_type,
  discount_value,
  max_uses,
  current_uses,
  valid_until,
  is_active
FROM billing_promo_codes
WHERE is_active = true;

-- Check add-on purchases
SELECT
  a.slug,
  ap.status,
  ap.purchased_at,
  ap.expires_at,
  ap.qzpay_payment_id
FROM billing_addon_purchases ap
JOIN billing_addons a ON ap.addon_id = a.id
JOIN users u ON ap.user_id = u.id
WHERE u.email = 'qa.billing.addon.test@test.hospeda.com.ar';
```

---

## Flow 1: New User Trial → Subscription

**Priority**: P0 - Critical
**Estimated Time**: 15-20 minutes
**User Role**: Owner (Tourist)

### Test Objective

Verify a new user can successfully:

1. Register and start a 14-day trial
2. Access trial features and dashboard
3. Add a payment method during trial
4. Convert trial to paid subscription before expiry
5. Maintain access and entitlements post-conversion

### Preconditions

- [ ] Fresh user account created (never logged in)
- [ ] User email: `qa.billing.trial.new@test.hospeda.com.ar`
- [ ] No existing subscription in database
- [ ] QZPay sandbox is operational
- [ ] Test payment method available

### Test Steps

#### Step 1: User Registration and Trial Start

**Actions:**

1. Navigate to `https://hospeda.com.ar`
2. Click "Registrarse" button
3. Fill registration form:
   - Email: `qa.billing.trial.new@test.hospeda.com.ar`
   - Password: `TestPass123!`
   - Name: `QA Trial User`
   - Role: Select "Owner/Tourist"
4. Click "Crear cuenta"
5. Complete email verification (check inbox)
6. Click verification link
7. Login with credentials

**Expected Results:**

- [ ] Registration form validates inputs correctly
- [ ] Verification email received within 2 minutes
- [ ] Verification link works and redirects to login
- [ ] Login successful
- [ ] **User automatically enrolled in 14-day trial**
- [ ] Redirected to dashboard showing trial status
- [ ] Trial banner visible: "14 días restantes de prueba gratuita"
- [ ] Trial countdown accurate

**Database Verification:**

```sql
SELECT
  status,
  plan_slug,
  trial_ends_at,
  current_period_end,
  qzpay_subscription_id
FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Expected:
-- status: 'trialing'
-- plan_slug: 'basic-tourist' (default trial plan)
-- trial_ends_at: NOW() + 14 days
-- qzpay_subscription_id: NULL (no payment yet)
```

**Screenshot**: `screenshots/flow1/step1-trial-dashboard.png`

**Common Issues to Check:**

- Trial not starting automatically
- Incorrect trial period (should be exactly 14 days)
- Trial banner not visible
- Wrong plan assigned

---

#### Step 2: Trial Dashboard Verification

**Actions:**

1. Navigate through dashboard sections
2. Check "Configuración de Cuenta" → "Suscripción"
3. Verify entitlements display
4. Check accommodation creation limit
5. Create 1-2 test accommodations

**Expected Results:**

**Subscription Section Shows:**

- [ ] Current plan: "Prueba Gratuita - Plan Básico"
- [ ] Trial end date displayed correctly
- [ ] Days remaining count accurate
- [ ] "Agregar método de pago" button visible
- [ ] Feature list matches Basic plan

**Entitlements Visible:**

- [ ] Max Accommodations: 5
- [ ] Max Photos: 10 per accommodation
- [ ] Priority Support: No
- [ ] Analytics: Basic

**Functionality Working:**

- [ ] Can create accommodations (up to 5)
- [ ] Can upload photos (up to 10 per property)
- [ ] Dashboard features accessible
- [ ] No payment required yet

**Database Verification:**

```sql
SELECT
  entitlement_slug,
  limit_value,
  used_value
FROM billing_entitlements
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Expected entitlements:
-- max_accommodations: limit 5, used 0-2
-- max_photos_per_accommodation: limit 10, used varies
-- priority_support: limit 0 (boolean)
-- analytics_access: limit 1 (basic)
```

**Screenshot**: `screenshots/flow1/step2-trial-entitlements.png`

**Common Issues:**

- Entitlements not showing
- Wrong limits displayed
- Features locked that should be accessible
- Trial status not updating

---

#### Step 3: Add Payment Method During Trial

**Actions:**

1. In "Suscripción" section, click "Agregar método de pago"
2. QZPay payment form should load
3. Fill payment details:
   - Card: `4111 1111 1111 1111`
   - Expiry: `12/25`
   - CVV: `123`
   - Name: `QA Trial User`
4. Click "Guardar método de pago"
5. Wait for confirmation

**Expected Results:**

- [ ] QZPay form loads correctly (no 404 errors)
- [ ] Form fields validate input properly
- [ ] Test card accepted
- [ ] Success message: "Método de pago guardado correctamente"
- [ ] Payment method displayed in UI (last 4 digits)
- [ ] Card brand icon visible (Visa)
- [ ] "Set as default" option available
- [ ] **Trial status unchanged** (still trialing)
- [ ] No charges made yet

**Network Verification:**

Check browser DevTools → Network tab:

- [ ] POST to `/api/billing/payment-methods` returns 200
- [ ] Response includes `qzpay_payment_method_id`
- [ ] No error in console

**Database Verification:**

```sql
SELECT
  qzpay_payment_method_id,
  last_four,
  brand,
  is_default,
  created_at
FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Expected:
-- qzpay_payment_method_id: pm_xxxxx
-- last_four: 1111
-- brand: visa
-- is_default: true
```

**Screenshot**: `screenshots/flow1/step3-payment-method-added.png`

**Common Issues:**

- QZPay form not loading
- CORS errors in console
- Payment method saved but not showing in UI
- Trial converted to paid immediately (wrong behavior)

---

#### Step 4: Plan Selection and Checkout

**Actions:**

1. Navigate to "Planes y Precios" or "Elegir Plan" section
2. View available plans (Free, Basic, Pro)
3. Select "Plan Básico - $2,500/mes"
4. Click "Suscribirse"
5. Review checkout summary
6. Verify proration notice (if applicable)
7. Click "Confirmar suscripción"
8. Wait for payment processing

**Expected Results:**

**Plan Selection:**

- [ ] All plans displayed correctly
- [ ] Current plan (Trial) highlighted
- [ ] Features comparison visible
- [ ] Prices in ARS format: "$2,500/mes"
- [ ] "Suscribirse" button enabled

**Checkout Summary:**

- [ ] Plan name: "Plan Básico"
- [ ] Price: $2,500/mes
- [ ] Trial credit applied (if remaining days)
- [ ] **Proration calculation shown**: "Primer pago prorrateado: $X (Y días restantes del período)"
- [ ] Payment method displayed (ending 1111)
- [ ] Terms & conditions checkbox
- [ ] Total amount accurate

**Payment Processing:**

- [ ] Loading indicator shown
- [ ] No duplicate requests (check Network tab)
- [ ] Processes within 5 seconds
- [ ] Success message displayed
- [ ] Redirected to confirmation page

**Post-Payment:**

- [ ] Subscription status: "Activa"
- [ ] Trial banner removed
- [ ] Next billing date shown
- [ ] Receipt/invoice link available
- [ ] Email confirmation sent

**Database Verification:**

```sql
SELECT
  s.status,
  s.plan_slug,
  s.trial_ends_at,
  s.current_period_start,
  s.current_period_end,
  s.qzpay_subscription_id,
  s.qzpay_customer_id
FROM billing_subscriptions s
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Expected:
-- status: 'active'
-- plan_slug: 'basic-tourist'
-- trial_ends_at: NULL (trial ended)
-- qzpay_subscription_id: sub_xxxxx
-- qzpay_customer_id: cus_xxxxx
```

**QZPay Dashboard Verification:**

- [ ] Login to QZPay sandbox dashboard
- [ ] Find customer by email
- [ ] Subscription created and active
- [ ] First payment successful
- [ ] Amount matches proration

**Screenshot**: `screenshots/flow1/step4-subscription-active.png`

**Common Issues:**

- Payment fails silently
- Subscription created but status wrong
- Proration calculation incorrect
- Webhook not received (subscription stays in limbo)
- Email confirmation not sent

---

#### Step 5: Post-Conversion Verification

**Actions:**

1. Refresh dashboard
2. Navigate to all major sections
3. Verify entitlements still accessible
4. Try creating another accommodation
5. Check subscription details
6. Download invoice (if available)

**Expected Results:**

**Dashboard Status:**

- [ ] No trial banner visible
- [ ] Subscription status: "Activa"
- [ ] Plan badge shows "Plan Básico"
- [ ] Next billing date visible and accurate
- [ ] Payment method on file shown

**Entitlements Maintained:**

- [ ] Max Accommodations: Still 5
- [ ] Max Photos: Still 10
- [ ] All previously created content intact
- [ ] No data loss or locked features

**Billing History:**

- [ ] First payment recorded
- [ ] Invoice available for download
- [ ] Invoice shows:
  - Date
  - Amount (prorated)
  - Plan name
  - Payment method (last 4)
  - Status: Paid

**Future Billing:**

- [ ] Next charge date: 30 days from conversion
- [ ] Amount: Full $2,500 (no proration)
- [ ] Auto-renewal indicator visible

**Database Verification:**

```sql
-- Check payment record
SELECT
  amount,
  status,
  description,
  paid_at,
  invoice_url
FROM billing_payments
WHERE subscription_id = (
  SELECT id FROM billing_subscriptions
  WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar')
);

-- Check accommodations still owned
SELECT COUNT(*) as total_accommodations
FROM accommodations
WHERE owner_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');
```

**Screenshot**: `screenshots/flow1/step5-post-conversion-dashboard.png`

**Common Issues:**

- Entitlements reset after conversion
- Accommodations become inaccessible
- Next billing date calculated incorrectly
- Invoice not generated

---

### Edge Cases to Test

#### Edge Case 1: Trial Expiry Without Payment Method

**Setup:**

- New trial user
- Let trial expire (or manually set trial_ends_at to past)
- Do NOT add payment method

**Expected Behavior:**

- [ ] Dashboard shows "Trial expirado" warning
- [ ] User demoted to Free plan automatically
- [ ] Entitlements reduced to Free tier limits
- [ ] Accommodations beyond limit (1) become inactive but not deleted
- [ ] Prompt to upgrade visible

**Actions to Test:**

1. Try creating accommodation (should fail if at limit)
2. Try uploading photo (should fail if at limit)
3. Add payment method and upgrade
4. Verify inactive accommodations restored

---

#### Edge Case 2: Payment Failure During Conversion

**Setup:**

- Trial user with payment method
- Use declined card: `4000 0000 0000 0002`

**Expected Behavior:**

- [ ] Payment declined gracefully
- [ ] Error message: "Pago rechazado. Verifica tu tarjeta."
- [ ] User remains in trial status
- [ ] No subscription created in QZPay
- [ ] Retry option available

**Actions to Test:**

1. Update payment method to valid card
2. Retry subscription
3. Should succeed

---

#### Edge Case 3: Duplicate Subscription Attempt

**Setup:**

- User with active subscription

**Expected Behavior:**

- [ ] "Suscribirse" button disabled/hidden
- [ ] If user tries direct API call, returns error
- [ ] No duplicate subscription created

---

### Rollback/Cleanup Steps

After testing, clean up test data:

```sql
-- Delete subscription
DELETE FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Delete payment methods
DELETE FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Delete entitlements
DELETE FROM billing_entitlements
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Delete accommodations
DELETE FROM accommodations
WHERE owner_id = (SELECT id FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar');

-- Optionally delete user
DELETE FROM users WHERE email = 'qa.billing.trial.new@test.hospeda.com.ar';
```

**QZPay Cleanup:**

- Cancel subscription in QZPay dashboard
- Delete customer record (optional)

---

### Test Results

| Step | Status | Notes | Tester | Date |
|------|--------|-------|--------|------|
| 1. Registration & Trial Start | ⬜ Pass ⬜ Fail | | | |
| 2. Trial Dashboard | ⬜ Pass ⬜ Fail | | | |
| 3. Add Payment Method | ⬜ Pass ⬜ Fail | | | |
| 4. Plan Checkout | ⬜ Pass ⬜ Fail | | | |
| 5. Post-Conversion | ⬜ Pass ⬜ Fail | | | |
| Edge Case 1 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 2 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 3 | ⬜ Pass ⬜ Fail | | | |

**Overall Flow Status:** ⬜ Pass ⬜ Fail ⬜ Blocked

---

## Flow 2: Plan Upgrade/Downgrade

**Priority**: P0 - Critical
**Estimated Time**: 10-15 minutes
**User Role**: Owner (Tourist) with active subscription

### Test Objective

Verify a user with active subscription can:

1. View current plan and available options
2. Upgrade to higher tier with immediate proration
3. Downgrade to lower tier with period-end scheduling
4. See entitlement changes reflected correctly
5. Receive appropriate invoices and confirmations

### Preconditions

- [ ] User with active Basic plan subscription
- [ ] Email: `qa.billing.upgrade.basic@test.hospeda.com.ar`
- [ ] Subscription status: active
- [ ] Valid payment method on file
- [ ] At least 10 days remaining in current period (for proration testing)

### Test Steps

#### Step 1: Current Subscription Verification

**Actions:**

1. Login as `qa.billing.upgrade.basic@test.hospeda.com.ar`
2. Navigate to "Configuración" → "Suscripción"
3. Review current subscription details
4. Note current entitlements
5. Note next billing date

**Expected Results:**

**Current Subscription Display:**

- [ ] Plan name: "Plan Básico"
- [ ] Status badge: "Activa" (green)
- [ ] Price: $2,500/mes
- [ ] Next billing date shown
- [ ] Days until renewal shown
- [ ] Payment method displayed

**Current Entitlements:**

- [ ] Max Accommodations: 5
- [ ] Max Photos: 10 per property
- [ ] Priority Support: No
- [ ] Analytics: Basic
- [ ] Usage statistics shown (e.g., "3/5 alojamientos")

**Available Actions:**

- [ ] "Cambiar Plan" button visible
- [ ] "Cancelar Suscripción" link visible
- [ ] "Administrar Métodos de Pago" link visible

**Database Verification:**

```sql
SELECT
  plan_slug,
  status,
  current_period_start,
  current_period_end,
  (current_period_end - CURRENT_DATE) as days_remaining
FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Verify days_remaining >= 10 for proration test
```

**Screenshot**: `screenshots/flow2/step1-current-subscription.png`

---

#### Step 2: Plan Comparison View

**Actions:**

1. Click "Cambiar Plan" button
2. View plan comparison page
3. Review upgrade options
4. Check feature differences
5. Note pricing for each plan

**Expected Results:**

**Plan Comparison Table:**

- [ ] Current plan (Basic) highlighted
- [ ] Free plan shown (downgrade option)
- [ ] Pro plan shown (upgrade option)
- [ ] All features listed side-by-side
- [ ] Clear visual differentiation

**Plan Details:**

| Feature | Free | Basic (Current) | Pro |
|---------|------|-----------------|-----|
| Price | $0 | $2,500/mes | $5,000/mes |
| Accommodations | 1 | 5 | Unlimited |
| Photos | 5 | 10 | 25 |
| Priority Support | No | No | Yes |
| Analytics | No | Basic | Advanced |

**Action Buttons:**

- [ ] Free plan: "Cambiar a Gratuito" (downgrade)
- [ ] Basic plan: "Plan Actual" (disabled)
- [ ] Pro plan: "Mejorar a Pro" (upgrade)

**Information Notes:**

- [ ] Upgrade notice: "El cambio será inmediato. Se aplicará un cargo prorrateado."
- [ ] Downgrade notice: "El cambio se aplicará al final del período actual."

**Screenshot**: `screenshots/flow2/step2-plan-comparison.png`

---

#### Step 3: Upgrade Flow with Proration

**Actions:**

1. Click "Mejorar a Pro" button
2. Review upgrade confirmation modal/page
3. Verify proration calculation
4. Confirm upgrade
5. Wait for processing
6. Verify immediate effect

**Expected Results:**

**Upgrade Confirmation Screen:**

- [ ] Header: "Mejorar a Plan Pro"
- [ ] Current plan summary shown
- [ ] New plan summary shown
- [ ] **Proration calculation visible**:

  ```
  Plan Pro: $5,000/mes
  Crédito restante Plan Básico: -$1,667 (20 días)
  Cargo prorrateado Plan Pro: +$3,333 (20 días)
  ───────────────────────────────────────
  Total a pagar hoy: $1,666
  ```

- [ ] Next full charge: Shows date + full amount ($5,000)
- [ ] Payment method shown
- [ ] "Confirmar mejora" button enabled

**Processing:**

- [ ] Loading indicator shown
- [ ] Processes within 5 seconds
- [ ] Success message: "¡Mejora exitosa! Ya tienes acceso al Plan Pro."

**Immediate Changes:**

- [ ] Plan badge updated to "Plan Pro"
- [ ] Entitlements updated instantly:
  - Max Accommodations: Unlimited (or high number like 999)
  - Max Photos: 25
  - Priority Support: Yes
  - Analytics: Advanced
- [ ] Subscription page shows new plan
- [ ] Email confirmation sent

**Database Verification:**

```sql
-- Check subscription updated
SELECT
  plan_slug,
  status,
  current_period_end,
  qzpay_subscription_id
FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Expected:
-- plan_slug: 'pro-tourist'
-- status: 'active'
-- current_period_end: UNCHANGED (same billing cycle)

-- Check proration payment created
SELECT
  amount,
  status,
  description,
  paid_at
FROM billing_payments
WHERE subscription_id = (
  SELECT id FROM billing_subscriptions
  WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar')
)
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- amount: ~1666 (prorated difference)
-- status: 'succeeded'
-- description: 'Upgrade proration'

-- Check entitlements updated
SELECT entitlement_slug, limit_value
FROM billing_entitlements
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Expected Pro limits
```

**QZPay Verification:**

- [ ] Subscription updated in QZPay dashboard
- [ ] New plan price: $5,000
- [ ] Proration invoice created
- [ ] Payment successful

**Screenshot**: `screenshots/flow2/step3-upgrade-confirmation.png`

**Common Issues:**

- Proration calculation incorrect
- Entitlements not updated immediately
- Webhook delay causing UI lag
- Double charge
- Subscription in QZPay not updated

---

#### Step 4: Downgrade Flow with Period Handling

**Actions:**

1. From Pro plan, initiate downgrade to Basic
2. Click "Cambiar a Básico" button
3. Review downgrade confirmation
4. Confirm downgrade
5. Verify scheduled change
6. Check current access unchanged

**Expected Results:**

**Downgrade Confirmation Screen:**

- [ ] Header: "Cambiar a Plan Básico"
- [ ] Warning notice: "⚠️ Perderás acceso a algunas funciones al finalizar el período actual"
- [ ] Feature comparison shown:
  - Lost features highlighted in red
  - Retained features in green
- [ ] **Downgrade scheduling notice**:

  ```
  Tu Plan Pro se mantendrá activo hasta: 04/03/2026
  El Plan Básico comenzará el: 05/03/2026
  No se realizará ningún cargo hoy.
  ```

- [ ] Impact warning:
  - "Límite de alojamientos: Ilimitado → 5"
  - "Si tienes más de 5 alojamientos, los excedentes se desactivarán"
- [ ] Confirmation checkbox: "Entiendo que perderé acceso a funciones Pro"
- [ ] "Confirmar cambio" button

**Processing:**

- [ ] Immediate confirmation (no payment processing)
- [ ] Success message: "Cambio programado. Tu Plan Básico comenzará el 05/03/2026."

**Current Status:**

- [ ] Plan still shows "Plan Pro" (current)
- [ ] Pending change notice visible: "Cambio programado a Plan Básico el 05/03/2026"
- [ ] "Cancelar cambio programado" option available
- [ ] All Pro features still accessible
- [ ] No entitlement changes yet

**Database Verification:**

```sql
-- Check subscription has scheduled change
SELECT
  plan_slug,
  status,
  scheduled_plan_change,
  scheduled_change_date
FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Expected:
-- plan_slug: 'pro-tourist' (still current)
-- status: 'active'
-- scheduled_plan_change: 'basic-tourist'
-- scheduled_change_date: current_period_end

-- Entitlements should NOT be changed yet
SELECT entitlement_slug, limit_value
FROM billing_entitlements
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Expected: Still Pro limits
```

**QZPay Verification:**

- [ ] Subscription scheduled to change in QZPay
- [ ] No immediate payment
- [ ] Plan change queued for period end

**Screenshot**: `screenshots/flow2/step4-downgrade-scheduled.png`

**Common Issues:**

- Downgrade applied immediately (wrong)
- Entitlements reduced before period end
- Accommodations exceeding new limit deleted instead of deactivated
- No option to cancel scheduled change

---

#### Step 5: Cancel Scheduled Downgrade (Optional)

**Actions:**

1. Click "Cancelar cambio programado"
2. Confirm cancellation
3. Verify subscription continues as Pro

**Expected Results:**

- [ ] Scheduled change removed
- [ ] Plan remains Pro indefinitely
- [ ] No notices about pending change
- [ ] Next renewal will charge for Pro plan

**Database Verification:**

```sql
SELECT
  plan_slug,
  scheduled_plan_change,
  scheduled_change_date
FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Expected:
-- plan_slug: 'pro-tourist'
-- scheduled_plan_change: NULL
-- scheduled_change_date: NULL
```

---

#### Step 6: Verify Downgrade Execution (Requires Time Manipulation)

**Note:** This requires waiting until period end OR manually updating database to simulate.

**Manual Simulation (for testing):**

```sql
-- Set current_period_end to past
UPDATE billing_subscriptions
SET
  current_period_end = CURRENT_TIMESTAMP - INTERVAL '1 day',
  scheduled_plan_change = 'basic-tourist',
  scheduled_change_date = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Run cron job or webhook handler manually
```

**Expected Automated Process:**

1. Cron job detects expired period with scheduled change
2. Updates subscription plan_slug to 'basic-tourist'
3. Updates entitlements to Basic limits
4. Deactivates excess accommodations (if > 5)
5. Starts new billing period with Basic price
6. Sends confirmation email

**Expected Results:**

- [ ] Plan updated to "Plan Básico"
- [ ] Entitlements reduced:
  - Max Accommodations: 5
  - Max Photos: 10
  - Priority Support: No
  - Analytics: Basic
- [ ] If user had 7 accommodations:
  - 5 most recent remain active
  - 2 oldest marked as inactive (but not deleted)
- [ ] User notified via email
- [ ] Next charge will be $2,500 (Basic price)

**Database Verification:**

```sql
-- Subscription updated
SELECT plan_slug, status, current_period_start
FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Entitlements reduced
SELECT entitlement_slug, limit_value, used_value
FROM billing_entitlements
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar');

-- Accommodations handling
SELECT id, title, status
FROM accommodations
WHERE owner_id = (SELECT id FROM users WHERE email = 'qa.billing.upgrade.basic@test.hospeda.com.ar')
ORDER BY created_at DESC;

-- Expected: 5 active, rest inactive
```

---

### Edge Cases to Test

#### Edge Case 1: Upgrade to Pro, Downgrade to Free (Two-Step Change)

**Actions:**

1. From Basic, upgrade to Pro (immediate)
2. Immediately downgrade to Free (scheduled)
3. Verify Pro access until period end
4. Verify Free plan activates at period end

**Expected:**

- Scheduled change should override previous plan
- Accommodation limit drops from unlimited → 1
- Multiple properties deactivated appropriately

---

#### Edge Case 2: Multiple Rapid Plan Changes

**Actions:**

1. Schedule downgrade to Free
2. Before period end, schedule upgrade to Pro
3. Verify latest scheduled change takes precedence

**Expected:**

- Only last scheduled change executes
- Previous scheduled changes cancelled

---

#### Edge Case 3: Insufficient Funds on Upgrade

**Setup:**

- Use card with insufficient funds: `4000 0000 0000 9995`

**Expected:**

- Payment fails
- Upgrade not applied
- User remains on current plan
- Error message displayed
- Retry option available

---

### Test Results

| Step | Status | Notes | Tester | Date |
|------|--------|-------|--------|------|
| 1. Current Subscription | ⬜ Pass ⬜ Fail | | | |
| 2. Plan Comparison | ⬜ Pass ⬜ Fail | | | |
| 3. Upgrade with Proration | ⬜ Pass ⬜ Fail | | | |
| 4. Downgrade Scheduling | ⬜ Pass ⬜ Fail | | | |
| 5. Cancel Scheduled Change | ⬜ Pass ⬜ Fail | | | |
| 6. Downgrade Execution | ⬜ Pass ⬜ Fail | | | |
| Edge Case 1 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 2 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 3 | ⬜ Pass ⬜ Fail | | | |

**Overall Flow Status:** ⬜ Pass ⬜ Fail ⬜ Blocked

---

## Flow 3: Promo Code Redemption

**Priority**: P1 - High
**Estimated Time**: 10-12 minutes
**User Role**: Owner (Tourist)

### Test Objective

Verify promo code system works correctly:

1. Valid codes apply discounts properly
2. Invalid/expired codes rejected with clear errors
3. Discounts reflected in checkout and invoices
4. Usage limits enforced
5. Code depletion handled correctly

### Preconditions

- [ ] Test promo codes created (see Test Data Requirements)
- [ ] New user or user without active subscription
- [ ] Email: `qa.billing.promo.test@test.hospeda.com.ar`
- [ ] Test payment method available

### Required Test Promo Codes

Ensure these exist in database:

```sql
-- Insert test promo codes
INSERT INTO billing_promo_codes (code, discount_type, discount_value, max_uses, current_uses, valid_until, is_active)
VALUES
  ('TEST20', 'percentage', 20, 100, 0, '2026-12-31', true),
  ('SAVE1000', 'fixed_amount', 1000, 50, 0, '2026-12-31', true),
  ('EXPIRED2025', 'percentage', 50, 100, 0, '2025-01-01', true),
  ('SOLDOUT', 'percentage', 30, 1, 1, '2026-12-31', true),
  ('INACTIVE', 'percentage', 40, 100, 0, '2026-12-31', false);
```

### Test Steps

#### Step 1: Valid Percentage Discount Code

**Actions:**

1. Login as `qa.billing.promo.test@test.hospeda.com.ar`
2. Navigate to plan selection
3. Choose "Plan Básico" ($2,500/mes)
4. On checkout page, locate promo code field
5. Enter code: `TEST20`
6. Click "Aplicar código"
7. Verify discount applied
8. Complete checkout

**Expected Results:**

**Promo Code Field:**

- [ ] Input field visible and enabled
- [ ] Placeholder: "Código promocional"
- [ ] "Aplicar" button next to input

**After Applying Code:**

- [ ] Success message: "✓ Código TEST20 aplicado: 20% de descuento"
- [ ] Code field becomes read-only or changes to "Applied" state
- [ ] "Remover código" option visible
- [ ] Checkout summary updated:

  ```
  Plan Básico: $2,500/mes
  Descuento (TEST20 - 20%): -$500
  ───────────────────────────
  Total: $2,000/mes
  ```

- [ ] Discount applies to first payment only (or specify duration)
- [ ] Notice: "Este descuento se aplica solo al primer mes" (if applicable)

**After Payment:**

- [ ] Payment amount: $2,000 (discounted)
- [ ] Invoice shows:
  - Subtotal: $2,500
  - Discount: -$500 (TEST20)
  - Total: $2,000
- [ ] Subscription created with $2,500 base price
- [ ] Next renewal will be $2,500 (full price)

**Database Verification:**

```sql
-- Check subscription references promo code
SELECT
  s.plan_slug,
  s.qzpay_subscription_id,
  pc.code,
  pc.discount_type,
  pc.discount_value
FROM billing_subscriptions s
LEFT JOIN billing_promo_code_redemptions pcr ON s.id = pcr.subscription_id
LEFT JOIN billing_promo_codes pc ON pcr.promo_code_id = pc.id
WHERE s.user_id = (SELECT id FROM users WHERE email = 'qa.billing.promo.test@test.hospeda.com.ar');

-- Expected:
-- code: 'TEST20'
-- discount_type: 'percentage'
-- discount_value: 20

-- Check promo code usage incremented
SELECT current_uses FROM billing_promo_codes WHERE code = 'TEST20';
-- Expected: previous_uses + 1
```

**QZPay Verification:**

- [ ] Discount/coupon applied in QZPay
- [ ] First invoice shows discount
- [ ] Next scheduled invoice shows full price

**Screenshot**: `screenshots/flow3/step1-valid-percentage-code.png`

**Common Issues:**

- Discount not calculated correctly
- Discount applies to all renewals (should be first only)
- Usage count not incremented
- Code can be applied multiple times by same user

---

#### Step 2: Valid Fixed Amount Discount Code

**Setup:**

- Cancel previous subscription or use different user
- Email: `qa.billing.promo.fixed@test.hospeda.com.ar`

**Actions:**

1. Navigate to checkout for "Plan Básico" ($2,500)
2. Enter promo code: `SAVE1000`
3. Click "Aplicar"
4. Verify discount applied
5. Complete checkout

**Expected Results:**

**Discount Application:**

- [ ] Success message: "✓ Código SAVE1000 aplicado: $1,000 de descuento"
- [ ] Checkout summary:

  ```
  Plan Básico: $2,500/mes
  Descuento (SAVE1000): -$1,000
  ───────────────────────────
  Total: $1,500/mes
  ```

**After Payment:**

- [ ] Payment amount: $1,500
- [ ] Invoice shows fixed amount discount
- [ ] Next renewal: $2,500 (full price)

**Database Verification:**

```sql
SELECT current_uses FROM billing_promo_codes WHERE code = 'SAVE1000';
-- Expected: incremented
```

**Screenshot**: `screenshots/flow3/step2-fixed-amount-code.png`

---

#### Step 3: Invalid Code - Expired

**Actions:**

1. In checkout, enter code: `EXPIRED2025`
2. Click "Aplicar"
3. Verify error handling

**Expected Results:**

- [ ] Error message: "❌ Este código promocional ha expirado"
- [ ] Discount NOT applied
- [ ] Checkout total unchanged
- [ ] Code field cleared or remains editable
- [ ] User can try different code

**Database Verification:**

```sql
-- Usage should NOT increment
SELECT current_uses FROM billing_promo_codes WHERE code = 'EXPIRED2025';
-- Expected: unchanged (0)
```

**Screenshot**: `screenshots/flow3/step3-expired-code.png`

---

#### Step 4: Invalid Code - Depleted (Max Uses Reached)

**Actions:**

1. Enter code: `SOLDOUT`
2. Click "Aplicar"
3. Verify error handling

**Expected Results:**

- [ ] Error message: "❌ Este código promocional ya no está disponible"
- [ ] Discount NOT applied
- [ ] Suggestions for valid codes (optional)

**Database Verification:**

```sql
SELECT current_uses, max_uses FROM billing_promo_codes WHERE code = 'SOLDOUT';
-- Expected: current_uses >= max_uses
```

**Screenshot**: `screenshots/flow3/step4-depleted-code.png`

---

#### Step 5: Invalid Code - Inactive

**Actions:**

1. Enter code: `INACTIVE`
2. Click "Aplicar"
3. Verify error handling

**Expected Results:**

- [ ] Error message: "❌ Código promocional no válido"
- [ ] Discount NOT applied

**Database Verification:**

```sql
SELECT is_active FROM billing_promo_codes WHERE code = 'INACTIVE';
-- Expected: false
```

---

#### Step 6: Invalid Code - Non-Existent

**Actions:**

1. Enter code: `FAKECODE123`
2. Click "Aplicar"
3. Verify error handling

**Expected Results:**

- [ ] Error message: "❌ Código promocional no válido"
- [ ] No database lookup errors in logs
- [ ] Discount NOT applied

**Screenshot**: `screenshots/flow3/step6-nonexistent-code.png`

---

#### Step 7: Remove Applied Code

**Setup:**

- Apply valid code `TEST20` first

**Actions:**

1. After code applied successfully
2. Click "Remover código" or "×" button
3. Verify code removed
4. Re-apply same code

**Expected Results:**

**After Removal:**

- [ ] Code removed from display
- [ ] Discount removed from total
- [ ] Price returns to full amount ($2,500)
- [ ] Code field becomes editable again

**Re-application:**

- [ ] Can apply same code again
- [ ] Discount re-applied correctly
- [ ] Usage count should only increment once (on final checkout)

**Screenshot**: `screenshots/flow3/step7-remove-code.png`

---

#### Step 8: Promo Code with Plan Upgrade

**Setup:**

- User with active Basic subscription
- Email: `qa.billing.promo.upgrade@test.hospeda.com.ar`

**Actions:**

1. Initiate upgrade to Pro plan
2. Apply promo code `TEST20` during upgrade checkout
3. Verify discount applied to prorated amount

**Expected Results:**

**Proration with Discount:**

```
Plan Pro (prorrateado): $3,333
Descuento (TEST20 - 20%): -$667
─────────────────────────────
Total a pagar hoy: $2,666
```

- [ ] Discount applies to prorated upgrade cost
- [ ] Next full renewal at full price ($5,000)

**Database Verification:**

```sql
-- Check promo code linked to subscription
SELECT * FROM billing_promo_code_redemptions
WHERE subscription_id = (
  SELECT id FROM billing_subscriptions
  WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.promo.upgrade@test.hospeda.com.ar')
);
```

**Screenshot**: `screenshots/flow3/step8-promo-upgrade.png`

---

### Edge Cases to Test

#### Edge Case 1: Case Sensitivity

**Actions:**

1. Try code in lowercase: `test20`
2. Try code in uppercase: `TEST20`
3. Try mixed case: `TeSt20`

**Expected:**

- [ ] Codes should be case-insensitive
- [ ] All variations accepted

---

#### Edge Case 2: Whitespace Handling

**Actions:**

1. Enter code with leading/trailing spaces: ` TEST20 `
2. Apply code

**Expected:**

- [ ] Spaces trimmed automatically
- [ ] Code recognized and applied

---

#### Edge Case 3: Multiple Code Attempts

**Actions:**

1. Try applying `EXPIRED2025` (fails)
2. Try applying `SOLDOUT` (fails)
3. Try applying `TEST20` (succeeds)

**Expected:**

- [ ] Each attempt handled independently
- [ ] Previous failures don't block valid code
- [ ] No rate limiting issues

---

#### Edge Case 4: Code Application Before/After Login

**Actions:**

1. As guest, add plan to cart
2. Apply promo code
3. Proceed to login/register
4. Verify code persists after auth

**Expected:**

- [ ] Code remains applied post-login
- [ ] Discount preserved through auth flow

---

### Test Results

| Step | Status | Notes | Tester | Date |
|------|--------|-------|--------|------|
| 1. Valid Percentage Code | ⬜ Pass ⬜ Fail | | | |
| 2. Valid Fixed Amount Code | ⬜ Pass ⬜ Fail | | | |
| 3. Expired Code | ⬜ Pass ⬜ Fail | | | |
| 4. Depleted Code | ⬜ Pass ⬜ Fail | | | |
| 5. Inactive Code | ⬜ Pass ⬜ Fail | | | |
| 6. Non-Existent Code | ⬜ Pass ⬜ Fail | | | |
| 7. Remove Applied Code | ⬜ Pass ⬜ Fail | | | |
| 8. Promo with Upgrade | ⬜ Pass ⬜ Fail | | | |
| Edge Case 1 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 2 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 3 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 4 | ⬜ Pass ⬜ Fail | | | |

**Overall Flow Status:** ⬜ Pass ⬜ Fail ⬜ Blocked

---

## Flow 4: Payment Method Management

**Priority**: P1 - High
**Estimated Time**: 8-10 minutes
**User Role**: Owner (Tourist) with active subscription

### Test Objective

Verify users can manage payment methods:

1. Add new payment methods
2. Set default payment method
3. Remove non-default payment methods
4. Handle default payment method deletion
5. Recover from payment failures

### Preconditions

- [ ] User with active subscription
- [ ] Email: `qa.billing.payment.test@test.hospeda.com.ar`
- [ ] At least one payment method on file
- [ ] QZPay sandbox operational

### Test Steps

#### Step 1: View Current Payment Methods

**Actions:**

1. Login as `qa.billing.payment.test@test.hospeda.com.ar`
2. Navigate to "Configuración" → "Métodos de Pago"
3. Review existing payment methods
4. Note default method

**Expected Results:**

**Payment Methods List:**

- [ ] All payment methods displayed
- [ ] Each card shows:
  - Card brand icon (Visa, Mastercard, etc.)
  - Last 4 digits
  - Expiry date (MM/YY format)
  - Cardholder name (if available)
  - "Default" badge on primary method
- [ ] Actions available:
  - "Establecer como predeterminado" (if not default)
  - "Eliminar" (if not default)
  - "Eliminar" disabled on default (with tooltip)

**Layout Example:**

```
┌─────────────────────────────────────────┐
│ 💳 Visa ****1111                        │
│ Vence: 12/25                            │
│ [PREDETERMINADO]                        │
│ [Eliminar] (disabled)                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 💳 Mastercard ****5555                  │
│ Vence: 06/26                            │
│ [Establecer como predeterminado]        │
│ [Eliminar]                              │
└─────────────────────────────────────────┘
```

**Database Verification:**

```sql
SELECT
  brand,
  last_four,
  expiry_month,
  expiry_year,
  is_default,
  qzpay_payment_method_id
FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar')
ORDER BY is_default DESC, created_at DESC;
```

**Screenshot**: `screenshots/flow4/step1-payment-methods-list.png`

---

#### Step 2: Add New Payment Method

**Actions:**

1. Click "Agregar método de pago" button
2. QZPay form should load
3. Fill payment details:
   - Card: `5555 5555 5555 4444` (Mastercard)
   - Expiry: `06/26`
   - CVV: `456`
   - Name: `QA Test User`
4. Click "Guardar"
5. Wait for confirmation

**Expected Results:**

**Form Loading:**

- [ ] QZPay embedded form loads
- [ ] Form styled according to site theme
- [ ] All fields render correctly
- [ ] No CORS or loading errors

**Form Validation:**

- [ ] Card number validated (Luhn check)
- [ ] Expiry date validated (must be future)
- [ ] CVV length validated (3-4 digits)
- [ ] Name required

**After Submission:**

- [ ] Loading indicator shown
- [ ] Success message: "Método de pago agregado correctamente"
- [ ] New card appears in list
- [ ] Card shows Mastercard icon and ****4444
- [ ] New card NOT set as default automatically
- [ ] Form closes/modal dismissed

**Database Verification:**

```sql
SELECT COUNT(*) FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar');
-- Expected: previous_count + 1

-- Check new card details
SELECT brand, last_four, is_default, qzpay_payment_method_id
FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar')
  AND last_four = '4444';
-- Expected:
-- brand: 'mastercard'
-- is_default: false
```

**QZPay Verification:**

- [ ] Payment method created in QZPay
- [ ] Attached to customer
- [ ] Retrievable via API

**Screenshot**: `screenshots/flow4/step2-add-payment-method.png`

**Common Issues:**

- Form not loading (CORS issues)
- Duplicate payment method created
- Default flag incorrectly set
- QZPay ID not saved

---

#### Step 3: Set Default Payment Method

**Actions:**

1. Locate non-default payment method (****4444)
2. Click "Establecer como predeterminado"
3. Confirm action (if confirmation modal)
4. Verify default changed

**Expected Results:**

**Immediate UI Update:**

- [ ] Loading state shown briefly
- [ ] Success message: "Método de pago predeterminado actualizado"
- [ ] New default card shows "PREDETERMINADO" badge
- [ ] Previous default loses badge
- [ ] "Eliminar" button enabled on previous default
- [ ] "Eliminar" button disabled on new default

**Subscription Update:**

- [ ] Active subscription's default payment method updated in QZPay
- [ ] Next renewal will charge new default card

**Database Verification:**

```sql
SELECT last_four, is_default
FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar')
ORDER BY is_default DESC;

-- Expected:
-- ****4444: is_default = true
-- ****1111: is_default = false
```

**QZPay Verification:**

- [ ] Customer's default payment method updated
- [ ] Subscription's default payment method updated

**Screenshot**: `screenshots/flow4/step3-set-default.png`

**Common Issues:**

- UI updates but database doesn't
- Multiple default methods (data integrity issue)
- QZPay not updated
- Subscription still uses old default

---

#### Step 4: Remove Non-Default Payment Method

**Actions:**

1. Locate non-default payment method (****1111)
2. Click "Eliminar" button
3. Confirm deletion in modal
4. Verify removal

**Expected Results:**

**Confirmation Modal:**

- [ ] Modal appears: "¿Eliminar método de pago?"
- [ ] Shows card details being deleted
- [ ] Warning: "Esta acción no se puede deshacer"
- [ ] "Cancelar" and "Eliminar" buttons

**After Deletion:**

- [ ] Success message: "Método de pago eliminado"
- [ ] Card removed from list
- [ ] Default method unchanged
- [ ] Subscription unaffected

**Database Verification:**

```sql
SELECT COUNT(*) FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar');
-- Expected: previous_count - 1

-- Verify specific card deleted
SELECT * FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar')
  AND last_four = '1111';
-- Expected: 0 rows
```

**QZPay Verification:**

- [ ] Payment method detached/deleted in QZPay
- [ ] Not available for future charges

**Screenshot**: `screenshots/flow4/step4-remove-method.png`

---

#### Step 5: Attempt to Remove Default Payment Method

**Actions:**

1. Try to click "Eliminar" on default payment method (****4444)
2. Verify action blocked

**Expected Results:**

**Prevention:**

- [ ] "Eliminar" button is disabled
- [ ] Tooltip on hover: "No puedes eliminar el método de pago predeterminado. Establece otro primero."
- [ ] OR clicking shows error message
- [ ] Card NOT deleted

**Alternative Flow:**

If deletion is allowed with warning:

- [ ] Warning modal: "Este es tu método predeterminado. ¿Establecer otro primero?"
- [ ] Option to select new default before deletion

**Screenshot**: `screenshots/flow4/step5-prevent-default-deletion.png`

---

#### Step 6: Replace Default Payment Method

**Actions:**

1. Add a new payment method (****6666)
2. Set new card as default
3. Delete old default (****4444)
4. Verify only one default remains

**Expected Results:**

- [ ] New card becomes default
- [ ] Old default deletable
- [ ] After deletion, only ****6666 remains as default
- [ ] Subscription uses ****6666 for renewals

**Database Verification:**

```sql
SELECT last_four, is_default FROM billing_payment_methods
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar');

-- Expected: Only one row
-- ****6666: is_default = true
```

---

#### Step 7: Payment Failure Recovery

**Setup:**

- Use card that will decline: `4000 0000 0000 0002`
- Trigger renewal attempt (manually or wait)

**Actions:**

1. Payment fails on renewal
2. User receives notification
3. User logs in and sees payment failure notice
4. User updates payment method to valid card
5. User retries payment

**Expected Results:**

**Failure Notification:**

- [ ] Email sent: "Payment failed for your subscription"
- [ ] Dashboard shows warning banner: "⚠️ Pago rechazado. Actualiza tu método de pago."
- [ ] Link to payment methods page
- [ ] Subscription status: "past_due" (grace period)

**After Updating Payment Method:**

- [ ] Add valid payment method
- [ ] Set as default
- [ ] "Reintentar pago" button visible
- [ ] Click retry
- [ ] Payment processes successfully
- [ ] Subscription status: "active"
- [ ] Warning banner removed

**Database Verification:**

```sql
-- Check subscription status
SELECT status FROM billing_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar');
-- After fix: 'active'

-- Check payment retry recorded
SELECT status, amount FROM billing_payments
WHERE subscription_id = (
  SELECT id FROM billing_subscriptions
  WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.payment.test@test.hospeda.com.ar')
)
ORDER BY created_at DESC LIMIT 2;
-- Expected: Latest status = 'succeeded', previous = 'failed'
```

**Screenshot**: `screenshots/flow4/step7-payment-recovery.png`

---

### Edge Cases to Test

#### Edge Case 1: Add Duplicate Payment Method

**Actions:**

1. Try adding same card number already on file

**Expected:**

- [ ] QZPay returns error or deduplicates automatically
- [ ] User notified: "This card is already saved"
- [ ] OR card added but shows as duplicate in UI

---

#### Edge Case 2: Expired Card Handling

**Actions:**

1. Add card with expiry in past: `01/20`

**Expected:**

- [ ] Validation error: "Expiry date must be in the future"
- [ ] Card not saved

---

#### Edge Case 3: Delete Last Payment Method with Active Subscription

**Actions:**

1. User has only one payment method
2. User has active subscription
3. Try to delete payment method

**Expected:**

- [ ] Deletion blocked
- [ ] Warning: "Cannot delete last payment method while subscription is active"
- [ ] Suggest canceling subscription first

---

#### Edge Case 4: Rapid Default Switch

**Actions:**

1. Quickly switch default between cards multiple times

**Expected:**

- [ ] Each change processed sequentially
- [ ] No race conditions
- [ ] Final state consistent with last action

---

### Test Results

| Step | Status | Notes | Tester | Date |
|------|--------|-------|--------|------|
| 1. View Payment Methods | ⬜ Pass ⬜ Fail | | | |
| 2. Add Payment Method | ⬜ Pass ⬜ Fail | | | |
| 3. Set Default | ⬜ Pass ⬜ Fail | | | |
| 4. Remove Non-Default | ⬜ Pass ⬜ Fail | | | |
| 5. Prevent Default Deletion | ⬜ Pass ⬜ Fail | | | |
| 6. Replace Default | ⬜ Pass ⬜ Fail | | | |
| 7. Payment Recovery | ⬜ Pass ⬜ Fail | | | |
| Edge Case 1 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 2 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 3 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 4 | ⬜ Pass ⬜ Fail | | | |

**Overall Flow Status:** ⬜ Pass ⬜ Fail ⬜ Blocked

---

## Flow 5: Add-on Purchase

**Priority**: P1 - High
**Estimated Time**: 8-10 minutes
**User Role**: Owner (Tourist) with active subscription

### Test Objective

Verify add-on purchase system:

1. Browse available add-ons
2. Purchase one-time add-on
3. Verify entitlement activation
4. Use add-on features
5. Cancel/expire add-on

### Preconditions

- [ ] User with active Basic subscription
- [ ] Email: `qa.billing.addon.test@test.hospeda.com.ar`
- [ ] Valid payment method on file
- [ ] Test add-ons available

### Required Test Add-ons

Ensure these exist:

```sql
-- Insert test add-ons
INSERT INTO billing_addons (slug, name, description, price_ars, entitlement_slug, entitlement_value, duration_days, is_active)
VALUES
  ('extra-photos-pack', 'Pack de Fotos Extra', 'Agrega 15 fotos adicionales por alojamiento', 500, 'max_photos_per_accommodation', 15, 30, true),
  ('analytics-boost', 'Análisis Avanzado', 'Acceso a análisis avanzado por 30 días', 1000, 'analytics_access', 2, 30, true),
  ('featured-listing', 'Destacar Alojamiento', 'Tu alojamiento aparecerá en la página principal por 7 días', 1500, 'featured_listing', 1, 7, true);
```

### Test Steps

#### Step 1: Browse Available Add-ons

**Actions:**

1. Login as `qa.billing.addon.test@test.hospeda.com.ar`
2. Navigate to "Complementos" or "Add-ons" section
3. View available add-ons
4. Review details of each add-on

**Expected Results:**

**Add-ons Marketplace:**

- [ ] All active add-ons displayed
- [ ] Each add-on shows:
  - Name
  - Description
  - Price in ARS
  - Duration (e.g., "30 días")
  - What entitlement it grants
  - "Comprar" button
- [ ] Add-ons categorized or filterable (optional)
- [ ] Purchased add-ons marked differently

**Add-on Cards Example:**

```
┌──────────────────────────────────────┐
│ 📸 Pack de Fotos Extra               │
│ Agrega 15 fotos adicionales por      │
│ alojamiento durante 30 días          │
│                                      │
│ $500                                 │
│ [Comprar]                            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 📊 Análisis Avanzado                 │
│ Acceso a métricas avanzadas y        │
│ reportes detallados por 30 días      │
│                                      │
│ $1,000                               │
│ [Comprar]                            │
└──────────────────────────────────────┘
```

**Current Entitlements:**

- [ ] User's current limits displayed
- [ ] Example: "Fotos actuales: 10/alojamiento"
- [ ] Add-on impact shown: "Con este pack: 25/alojamiento"

**Database Verification:**

```sql
-- Get all active add-ons
SELECT slug, name, price_ars, duration_days, is_active
FROM billing_addons
WHERE is_active = true;

-- Check user's current purchases
SELECT
  a.slug,
  ap.status,
  ap.purchased_at,
  ap.expires_at
FROM billing_addon_purchases ap
JOIN billing_addons a ON ap.addon_id = a.id
WHERE ap.user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
  AND ap.status = 'active';
```

**Screenshot**: `screenshots/flow5/step1-addons-marketplace.png`

---

#### Step 2: Purchase Add-on

**Actions:**

1. Click "Comprar" on "Pack de Fotos Extra" add-on
2. Review purchase confirmation
3. Verify price and details
4. Confirm purchase
5. Wait for payment processing

**Expected Results:**

**Purchase Confirmation Modal:**

- [ ] Add-on name and description shown
- [ ] Price: $500
- [ ] Duration: 30 días
- [ ] Expiry date calculated and shown
- [ ] Current entitlement: "Fotos: 10/alojamiento"
- [ ] After purchase: "Fotos: 25/alojamiento (10 + 15)"
- [ ] Payment method shown (last 4 digits)
- [ ] "Confirmar compra" button

**Processing:**

- [ ] Loading indicator shown
- [ ] Payment processed within 5 seconds
- [ ] Success message: "¡Complemento activado! Ya puedes usar las fotos adicionales."
- [ ] Redirected to add-ons page or dashboard

**Post-Purchase Display:**

- [ ] Add-on marked as "Activo"
- [ ] Expiry date shown: "Expira: 06/03/2026"
- [ ] "Comprar" button changed to "Activo" or disabled
- [ ] Purchase receipt/invoice link available

**Database Verification:**

```sql
-- Check purchase record
SELECT
  addon_id,
  user_id,
  status,
  purchased_at,
  expires_at,
  qzpay_payment_id
FROM billing_addon_purchases
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
  AND addon_id = (SELECT id FROM billing_addons WHERE slug = 'extra-photos-pack');

-- Expected:
-- status: 'active'
-- expires_at: purchased_at + 30 days
-- qzpay_payment_id: pi_xxxxx

-- Check payment record
SELECT amount, status, description
FROM billing_payments
WHERE qzpay_payment_id = (
  SELECT qzpay_payment_id FROM billing_addon_purchases
  WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
    AND addon_id = (SELECT id FROM billing_addons WHERE slug = 'extra-photos-pack')
);

-- Expected:
-- amount: 500
-- status: 'succeeded'
-- description: 'Add-on: Pack de Fotos Extra'
```

**QZPay Verification:**

- [ ] One-time payment created
- [ ] Amount: $500
- [ ] Status: Succeeded
- [ ] Description includes add-on name

**Email Verification:**

- [ ] Purchase confirmation email sent
- [ ] Email includes:
  - Add-on name
  - Purchase date
  - Expiry date
  - Amount paid
  - Invoice link

**Screenshot**: `screenshots/flow5/step2-addon-purchased.png`

**Common Issues:**

- Payment succeeds but entitlement not granted
- Expiry date calculated incorrectly
- Multiple purchases allowed (should prevent or allow stacking)
- No email confirmation sent

---

#### Step 3: Verify Entitlement Activation

**Actions:**

1. Navigate to accommodation edit page
2. Try uploading photos
3. Verify new limit is enforced
4. Check dashboard entitlements

**Expected Results:**

**Photo Upload:**

- [ ] Can upload up to 25 photos per accommodation (10 base + 15 add-on)
- [ ] Upload counter shows: "15/25 fotos"
- [ ] Limit enforced correctly
- [ ] Attempting 26th photo shows error

**Dashboard Entitlements:**

- [ ] "Max Fotos" shows: 25 per accommodation
- [ ] Add-on listed in "Active Add-ons" section
- [ ] Expiry date visible

**Database Verification:**

```sql
-- Check entitlement value updated
SELECT entitlement_slug, limit_value
FROM billing_entitlements
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
  AND entitlement_slug = 'max_photos_per_accommodation';

-- Expected:
-- limit_value: 25 (10 base + 15 addon)
```

**API Verification:**

```bash
# GET /api/users/me/entitlements
# Should return:
{
  "max_photos_per_accommodation": {
    "limit": 25,
    "used": 15,
    "remaining": 10
  }
}
```

**Screenshot**: `screenshots/flow5/step3-entitlement-active.png`

---

#### Step 4: Use Add-on Features

**Actions:**

1. Create or edit accommodation
2. Upload more than 10 photos (up to 25)
3. Save accommodation
4. Verify photos saved correctly

**Expected Results:**

- [ ] All 25 photos upload successfully
- [ ] No errors when exceeding previous 10-photo limit
- [ ] Photos display in accommodation detail
- [ ] Photo gallery works correctly

**Screenshot**: `screenshots/flow5/step4-using-addon.png`

---

#### Step 5: Add-on Expiry Simulation

**Note:** Requires time manipulation or manual database update

**Manual Simulation:**

```sql
-- Set expiry to past
UPDATE billing_addon_purchases
SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
  AND addon_id = (SELECT id FROM billing_addons WHERE slug = 'extra-photos-pack');

-- Run expiry check job or cron manually
```

**Actions:**

1. After expiry, refresh dashboard
2. Try uploading 11th photo (should fail now)
3. Check entitlements reverted

**Expected Results:**

**After Expiry:**

- [ ] Add-on status changed to "expired"
- [ ] Entitlement reverted to base plan (10 photos)
- [ ] Dashboard shows: "Pack de Fotos Extra expirado"
- [ ] Option to re-purchase add-on
- [ ] Existing photos NOT deleted (only new uploads limited)

**Upload Attempt:**

- [ ] Uploading 11th photo fails
- [ ] Error message: "Has alcanzado el límite de fotos. Compra el Pack de Fotos Extra para agregar más."

**Database Verification:**

```sql
-- Check add-on status
SELECT status, expires_at
FROM billing_addon_purchases
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
  AND addon_id = (SELECT id FROM billing_addons WHERE slug = 'extra-photos-pack');

-- Expected:
-- status: 'expired'

-- Check entitlement reverted
SELECT limit_value FROM billing_entitlements
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
  AND entitlement_slug = 'max_photos_per_accommodation';

-- Expected:
-- limit_value: 10 (back to base)
```

**Screenshot**: `screenshots/flow5/step5-addon-expired.png`

---

#### Step 6: Re-purchase Expired Add-on

**Actions:**

1. Navigate to add-ons marketplace
2. Purchase "Pack de Fotos Extra" again
3. Verify new expiry period starts

**Expected Results:**

- [ ] Can purchase same add-on again
- [ ] New expiry date: Today + 30 days
- [ ] Entitlement re-granted immediately
- [ ] Can upload photos again (up to 25)

**Database Verification:**

```sql
-- Check new purchase created OR old one reactivated
SELECT status, purchased_at, expires_at
FROM billing_addon_purchases
WHERE user_id = (SELECT id FROM users WHERE email = 'qa.billing.addon.test@test.hospeda.com.ar')
  AND addon_id = (SELECT id FROM billing_addons WHERE slug = 'extra-photos-pack')
ORDER BY purchased_at DESC LIMIT 1;

-- Expected:
-- status: 'active'
-- expires_at: NOW() + 30 days
```

---

### Edge Cases to Test

#### Edge Case 1: Purchase Multiple Different Add-ons

**Actions:**

1. Purchase "Pack de Fotos Extra" ($500)
2. Purchase "Análisis Avanzado" ($1,000)
3. Verify both active simultaneously

**Expected:**

- [ ] Both add-ons active
- [ ] Entitlements stacked correctly
- [ ] Photos: 25, Analytics: Advanced
- [ ] Each has independent expiry

---

#### Edge Case 2: Purchase Same Add-on Multiple Times (Stacking)

**Actions:**

1. Purchase "Pack de Fotos Extra"
2. Immediately purchase it again

**Expected Behavior (depends on design):**

**Option A - Prevent Duplicate:**

- [ ] Error: "Ya tienes este complemento activo"
- [ ] Cannot purchase until current expires

**Option B - Allow Stacking:**

- [ ] Second purchase extends expiry
- [ ] Expires_at updated to latest_purchase + 30 days

**Option C - Allow Multiple:**

- [ ] Both purchases active
- [ ] Entitlements stack (40 photos = 10 + 15 + 15)

---

#### Edge Case 3: Payment Failure on Add-on Purchase

**Setup:**

- Use declined card: `4000 0000 0000 0002`

**Expected:**

- [ ] Payment fails
- [ ] Add-on NOT activated
- [ ] Error message shown
- [ ] User can retry with different payment method
- [ ] No database record created

---

#### Edge Case 4: Cancel Subscription with Active Add-ons

**Actions:**

1. User has active add-ons
2. User cancels subscription

**Expected:**

- [ ] Add-ons remain active until expiry
- [ ] OR add-ons canceled immediately (depends on policy)
- [ ] User notified of add-on status

---

### Test Results

| Step | Status | Notes | Tester | Date |
|------|--------|-------|--------|------|
| 1. Browse Add-ons | ⬜ Pass ⬜ Fail | | | |
| 2. Purchase Add-on | ⬜ Pass ⬜ Fail | | | |
| 3. Entitlement Activation | ⬜ Pass ⬜ Fail | | | |
| 4. Use Add-on Features | ⬜ Pass ⬜ Fail | | | |
| 5. Add-on Expiry | ⬜ Pass ⬜ Fail | | | |
| 6. Re-purchase | ⬜ Pass ⬜ Fail | | | |
| Edge Case 1 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 2 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 3 | ⬜ Pass ⬜ Fail | | | |
| Edge Case 4 | ⬜ Pass ⬜ Fail | | | |

**Overall Flow Status:** ⬜ Pass ⬜ Fail ⬜ Blocked

---

## Bug Report Template

Use this template when reporting bugs found during testing.

### Bug Report #[NUMBER]

**Title:** [Short, descriptive title]

**Priority:** ⬜ P0 - Critical ⬜ P1 - High ⬜ P2 - Medium ⬜ P3 - Low

**Flow:** [Which flow: Trial, Upgrade, Promo, Payment, Add-on]

**Reported By:** [Name]
**Date Reported:** [YYYY-MM-DD]
**Environment:** [Staging/Production]
**Browser:** [Chrome 121 / Firefox 122 / Safari 17]

---

### Description

[Clear description of the issue]

---

### Steps to Reproduce

1. [First step]
2. [Second step]
3. [Third step]
4. [Observe issue]

---

### Expected Behavior

[What should happen]

---

### Actual Behavior

[What actually happened]

---

### Screenshots/Videos

- Screenshot 1: [path or link]
- Screenshot 2: [path or link]
- Screen recording: [link]

---

### Technical Details

**URL:** [Full URL where issue occurred]

**User Account:** [Test email used]

**Console Errors:**

```
[Paste any console errors]
```

**Network Requests:**

- Request URL: [URL]
- Status Code: [Code]
- Response: [Error message or response]

**Database State:**

```sql
-- Query showing problematic state
SELECT * FROM ...;
```

---

### Reproduction Rate

⬜ Always (100%)
⬜ Often (>50%)
⬜ Sometimes (25-50%)
⬜ Rarely (<25%)

---

### Impact Assessment

**Users Affected:** [All users / Specific role / Edge case]

**Workaround Available:** ⬜ Yes ⬜ No

**Workaround Details:** [If yes, describe workaround]

**Business Impact:**

- Revenue impact: [High/Medium/Low/None]
- User experience impact: [High/Medium/Low]
- Data integrity risk: [High/Medium/Low/None]

---

### Root Cause Analysis (if known)

[Technical analysis of why this is happening]

---

### Suggested Fix (optional)

[If you have suggestions for how to fix]

---

### Related Issues

- Related to Bug #[NUMBER]
- Duplicate of Bug #[NUMBER]
- Blocks Issue #[NUMBER]

---

### Status Tracking

| Date | Status | Notes | Updated By |
|------|--------|-------|------------|
| 2026-02-04 | Open | Bug reported | QA Team |
| | | | |

**Current Status:** ⬜ Open ⬜ In Progress ⬜ Fixed ⬜ Verified ⬜ Closed ⬜ Won't Fix

---

## Sign-off Section

### Test Execution Summary

**Test Cycle:** [e.g., Sprint 5 QA, Pre-Production]
**Test Period:** [Start Date] to [End Date]
**Tester(s):** [Names]

### Overall Results

| Flow | Total Tests | Passed | Failed | Blocked | Pass Rate |
|------|-------------|--------|--------|---------|-----------|
| Flow 1: Trial → Subscription | 8 | | | | |
| Flow 2: Upgrade/Downgrade | 9 | | | | |
| Flow 3: Promo Codes | 12 | | | | |
| Flow 4: Payment Methods | 11 | | | | |
| Flow 5: Add-ons | 10 | | | | |
| **TOTAL** | **50** | | | | |

### Critical Issues Summary

**P0 - Critical (Blocking Release):**

1. [Issue description] - Status: [Open/Fixed]
2. [Issue description] - Status: [Open/Fixed]

**P1 - High (Should Fix):**

1. [Issue description] - Status: [Open/Fixed]
2. [Issue description] - Status: [Open/Fixed]

**P2 - Medium:**

- [Count] issues logged
- [Count] fixed
- [Count] deferred

**P3 - Low:**

- [Count] issues logged
- [Count] fixed
- [Count] deferred

### Test Coverage

- [ ] All happy paths tested
- [ ] Edge cases covered
- [ ] Error handling validated
- [ ] Database integrity verified
- [ ] QZPay integration confirmed
- [ ] Email notifications checked
- [ ] UI/UX requirements met
- [ ] Performance acceptable
- [ ] Security considerations reviewed

### Risks & Recommendations

**Identified Risks:**

1. [Risk description and mitigation]
2. [Risk description and mitigation]

**Recommendations:**

1. [Recommendation for improvement]
2. [Recommendation for improvement]

**Known Limitations:**

1. [Limitation or technical debt]
2. [Limitation or technical debt]

### QA Sign-off

**QA Lead Approval:**

- Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Decision:**

⬜ **APPROVED FOR RELEASE** - All critical tests passed, no blocking issues

⬜ **CONDITIONAL APPROVAL** - Minor issues present, can release with known limitations

⬜ **REJECTED** - Critical issues must be resolved before release

**Comments:**

[Additional notes or context for the decision]

---

### Stakeholder Sign-off

**Product Manager:**

- Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Tech Lead:**

- Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Business Owner:**

- Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## Appendix

### Common QZPay Test Cards

```
# Successful Payments
Visa: 4111 1111 1111 1111
Mastercard: 5555 5555 5555 4444
Amex: 3782 822463 10005

# Declined Cards
Generic Decline: 4000 0000 0000 0002
Insufficient Funds: 4000 0000 0000 9995
Lost Card: 4000 0000 0000 9987
Stolen Card: 4000 0000 0000 9979

# Special Scenarios
Expired Card: 4000 0000 0000 0069
Processing Error: 4000 0000 0000 0119
Incorrect CVC: 4000 0000 0000 0127
```

### Useful Database Queries

```sql
-- Get full user billing state
SELECT
  u.email,
  s.plan_slug,
  s.status,
  s.current_period_end,
  COUNT(DISTINCT pm.id) as payment_methods,
  COUNT(DISTINCT ap.id) as active_addons
FROM users u
LEFT JOIN billing_subscriptions s ON u.id = s.user_id
LEFT JOIN billing_payment_methods pm ON u.id = pm.user_id
LEFT JOIN billing_addon_purchases ap ON u.id = ap.user_id AND ap.status = 'active'
WHERE u.email = 'qa.billing.test@test.hospeda.com.ar'
GROUP BY u.id, s.id;

-- Check for data integrity issues
SELECT
  user_id,
  COUNT(*) as default_count
FROM billing_payment_methods
WHERE is_default = true
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (each user should have max 1 default)

-- Find users with expiring trials
SELECT
  u.email,
  s.trial_ends_at,
  s.trial_ends_at - CURRENT_DATE as days_remaining
FROM billing_subscriptions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'trialing'
  AND s.trial_ends_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
ORDER BY s.trial_ends_at;
```

### API Testing Snippets

```bash
# Get user entitlements
curl -X GET https://api.staging.hospeda.com.ar/api/billing/entitlements \
  -H "Authorization: Bearer $TOKEN"

# Validate promo code
curl -X POST https://api.staging.hospeda.com.ar/api/billing/promo-codes/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "TEST20"}'

# Get subscription status
curl -X GET https://api.staging.hospeda.com.ar/api/billing/subscription \
  -H "Authorization: Bearer $TOKEN"
```

---

## Document Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-02-04 | Initial creation - all 5 flows documented | QA Team |

---

<!-- END OF DOCUMENT -->
