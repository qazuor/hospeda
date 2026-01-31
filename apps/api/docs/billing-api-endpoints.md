# Billing API Endpoints

Comprehensive documentation for all billing-related endpoints in the Hospeda API.

## Overview

The billing system provides subscription management, payment processing, add-on purchases, promo codes, and trial management for Hospeda's three user categories: **Owners**, **Complexes**, and **Tourists**.

**Key Features:**

- Subscription lifecycle management (create, update, cancel)
- Plan selection and upgrades/downgrades
- Payment processing via MercadoPago
- Add-on purchases (one-time and recurring)
- Promo code validation and application
- 14-day trial period for new users
- Entitlement and limit enforcement
- Invoice and payment history
- Webhook integration for payment events

**Technologies:**

- **Billing Engine**: QZPay (via `@qazuor/qzpay-hono`)
- **Payment Gateway**: MercadoPago (Argentina)
- **Currency**: ARS (Argentine Peso)
- **Database**: PostgreSQL via Drizzle ORM

## Authentication

All billing endpoints require **Clerk authentication** unless explicitly noted as public.

**Authentication header:**

```http
Authorization: Bearer <clerk-jwt-token>
```

**Exceptions:**

- `POST /api/v1/webhooks/mercadopago` - Public (signature verification)
- `POST /api/v1/billing/trial/start` - Internal use (no auth)

**Admin-only endpoints** require the user to have `admin` or `super_admin` role.

## Base URL

All billing endpoints are mounted under:

```text
/api/v1/billing
```

Webhook endpoints are under:

```text
/api/v1/webhooks
```

## Response Format

All endpoints follow the standard Hospeda API response format:

**Success:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

## Endpoints

### Plans

#### List All Plans

Get a list of all available subscription plans.

**Endpoint:** `GET /api/v1/billing/plans`

**Auth:** Required

**Query Parameters:**

| Parameter | Type   | Description                           |
|-----------|--------|---------------------------------------|
| category  | string | Filter by category: owner/complex/tourist |
| active    | boolean | Filter by active status (default: true) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "plan-uuid",
      "slug": "owner-basico",
      "name": "Propietario Básico",
      "description": "Plan básico para propietarios individuales",
      "category": "owner",
      "monthlyPriceArs": 1500000,
      "annualPriceArs": 15000000,
      "usdReferencePrice": 1500,
      "trialDays": 14,
      "entitlements": ["PUBLISH_ACCOMMODATIONS", "VIEW_BOOKING_STATS"],
      "limits": {
        "MAX_ACCOMMODATIONS": 1,
        "MAX_PHOTOS_PER_ACCOMMODATION": 5
      },
      "isActive": true,
      "isDefault": true
    }
  ]
}
```

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Get Plan by ID

Get details of a specific plan.

**Endpoint:** `GET /api/v1/billing/plans/:id`

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id        | uuid | Plan ID     |

**Response:** Single plan object (same structure as list)

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Customers

#### Create Billing Customer

Create a billing customer record for a user.

**Endpoint:** `POST /api/v1/billing/customers`

**Auth:** Required

**Request Body:**

```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "category": "owner"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "customer-uuid",
    "userId": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "category": "owner",
    "createdAt": "2024-01-30T12:00:00Z"
  }
}
```

**Notes:**

- Usually called automatically during user registration (auth sync)
- One customer per user
- Category cannot be changed after creation

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Get Customer

Get billing customer details.

**Endpoint:** `GET /api/v1/billing/customers/:id`

**Auth:** Required (user can only access their own customer record unless admin)

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "customer-uuid",
    "userId": "user-uuid",
    "email": "user@example.com",
    "category": "owner",
    "activeSubscription": {
      "id": "sub-uuid",
      "planSlug": "owner-basico",
      "status": "active"
    }
  }
}
```

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Subscriptions

#### Create Subscription

Create a new subscription for a customer.

**Endpoint:** `POST /api/v1/billing/subscriptions`

**Auth:** Required

**Request Body:**

```json
{
  "customerId": "customer-uuid",
  "planId": "plan-uuid",
  "billingCycle": "monthly",
  "promoCode": "LANZAMIENTO50"
}
```

**Fields:**

| Field        | Type   | Required | Description                     |
|-------------|--------|----------|---------------------------------|
| customerId  | uuid   | Yes      | Billing customer ID             |
| planId      | uuid   | Yes      | Plan ID to subscribe to         |
| billingCycle | enum  | Yes      | "monthly" or "annual"           |
| promoCode   | string | No       | Optional promo code to apply    |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "sub-uuid",
    "customerId": "customer-uuid",
    "planId": "plan-uuid",
    "status": "active",
    "billingCycle": "monthly",
    "currentPeriodStart": "2024-01-30T12:00:00Z",
    "currentPeriodEnd": "2024-02-30T12:00:00Z",
    "nextBillingDate": "2024-02-30T12:00:00Z",
    "appliedPromoCode": "LANZAMIENTO50",
    "discountAmount": 750000
  }
}
```

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Get Subscription

Get subscription details.

**Endpoint:** `GET /api/v1/billing/subscriptions/:id`

**Auth:** Required (user can only access their own subscription unless admin)

**Response:** Single subscription object (same structure as create)

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Update Subscription

Change subscription plan (upgrade/downgrade).

**Endpoint:** `PATCH /api/v1/billing/subscriptions/:id`

**Auth:** Required

**Request Body:**

```json
{
  "planId": "new-plan-uuid",
  "billingCycle": "annual",
  "applyImmediately": true
}
```

**Notes:**

- `applyImmediately: true` - Change takes effect immediately (prorated)
- `applyImmediately: false` - Change takes effect at next billing cycle
- Upgrades are usually immediate, downgrades scheduled for next cycle

**Response:** Updated subscription object

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Cancel Subscription

Cancel an active subscription.

**Endpoint:** `DELETE /api/v1/billing/subscriptions/:id`

**Auth:** Required

**Request Body:**

```json
{
  "reason": "User requested cancellation",
  "cancelImmediately": false
}
```

**Notes:**

- `cancelImmediately: false` (default) - Subscription remains active until end of billing period
- `cancelImmediately: true` - Subscription canceled immediately (no refund)

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "sub-uuid",
    "status": "canceled",
    "canceledAt": "2024-01-30T12:00:00Z",
    "endsAt": "2024-02-30T12:00:00Z"
  }
}
```

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Checkout

#### Create Checkout Session

Create a checkout session for subscription or add-on purchase.

**Endpoint:** `POST /api/v1/billing/checkout`

**Auth:** Required

**Request Body:**

```json
{
  "customerId": "customer-uuid",
  "planId": "plan-uuid",
  "billingCycle": "monthly",
  "promoCode": "BIENVENIDO30",
  "successUrl": "https://hospeda.com/checkout/success",
  "cancelUrl": "https://hospeda.com/checkout/cancel"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "checkout-uuid",
    "checkoutUrl": "https://mercadopago.com.ar/checkout/v1/...",
    "expiresAt": "2024-01-30T13:00:00Z",
    "amount": 1500000,
    "currency": "ARS"
  }
}
```

**Notes:**

- Checkout session expires after 1 hour
- Redirect user to `checkoutUrl` to complete payment
- MercadoPago will redirect to `successUrl` or `cancelUrl` after payment

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Get Checkout Session Status

Get the status of a checkout session.

**Endpoint:** `GET /api/v1/billing/checkout/:id`

**Auth:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "checkout-uuid",
    "status": "completed",
    "paymentId": "payment-uuid",
    "subscriptionId": "sub-uuid",
    "completedAt": "2024-01-30T12:30:00Z"
  }
}
```

**Status values:**

- `pending` - Waiting for payment
- `completed` - Payment successful
- `failed` - Payment failed
- `expired` - Session expired (1 hour)
- `canceled` - User canceled

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Payments

#### List Payments

Get a paginated list of payments for the authenticated user.

**Endpoint:** `GET /api/v1/billing/payments`

**Auth:** Required

**Query Parameters:**

| Parameter | Type   | Description                    |
|-----------|--------|--------------------------------|
| page      | number | Page number (default: 1)       |
| pageSize  | number | Items per page (default: 20)   |
| status    | string | Filter by status (paid/pending/failed) |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "payment-uuid",
        "customerId": "customer-uuid",
        "amount": 1500000,
        "currency": "ARS",
        "status": "paid",
        "method": "credit_card",
        "description": "Subscription - Propietario Básico",
        "createdAt": "2024-01-30T12:00:00Z",
        "paidAt": "2024-01-30T12:05:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Get Payment Details

Get details of a specific payment.

**Endpoint:** `GET /api/v1/billing/payments/:id`

**Auth:** Required

**Response:** Single payment object (same structure as list)

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Invoices

#### List Invoices

Get a paginated list of invoices for the authenticated user.

**Endpoint:** `GET /api/v1/billing/invoices`

**Auth:** Required

**Query Parameters:**

| Parameter | Type   | Description                    |
|-----------|--------|--------------------------------|
| page      | number | Page number (default: 1)       |
| pageSize  | number | Items per page (default: 20)   |
| status    | string | Filter by status (paid/pending/void) |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "invoice-uuid",
        "invoiceNumber": "INV-2024-001",
        "customerId": "customer-uuid",
        "amount": 1500000,
        "currency": "ARS",
        "status": "paid",
        "lineItems": [
          {
            "description": "Propietario Básico - Monthly",
            "quantity": 1,
            "unitPrice": 1500000,
            "total": 1500000
          }
        ],
        "issuedAt": "2024-01-30T12:00:00Z",
        "dueAt": "2024-02-15T12:00:00Z",
        "paidAt": "2024-01-30T12:05:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

**Status:** ✅ Fully implemented (QZPay pre-built)

---

#### Get Invoice Details

Get details of a specific invoice.

**Endpoint:** `GET /api/v1/billing/invoices/:id`

**Auth:** Required

**Response:** Single invoice object (same structure as list)

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Promo Codes

#### Validate Promo Code

Validate a promo code without applying it.

**Endpoint:** `POST /api/v1/billing/promo-codes/validate`

**Auth:** Required

**Request Body:**

```json
{
  "code": "LANZAMIENTO50",
  "userId": "user-uuid",
  "planId": "plan-uuid",
  "amount": 1500000
}
```

**Fields:**

| Field  | Type   | Required | Description                      |
|--------|--------|----------|----------------------------------|
| code   | string | Yes      | Promo code to validate           |
| userId | uuid   | Yes      | User ID (must match authenticated user unless admin) |
| planId | uuid   | No       | Plan ID to validate against      |
| amount | number | No       | Amount to calculate discount for |

**Response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "discountAmount": 750000,
    "errorCode": null,
    "errorMessage": null
  }
}
```

**Error Response (Invalid Code):**

```json
{
  "success": true,
  "data": {
    "valid": false,
    "errorCode": "PROMO_CODE_EXPIRED",
    "errorMessage": "This promo code has expired"
  }
}
```

**Validation Rules:**

- Code must be active
- Code must not be expired
- User must meet plan restrictions (if any)
- User must meet first purchase requirement (if applicable)
- Amount must meet minimum amount (if applicable)
- Code must not exceed max uses

**Status:** ✅ Fully implemented (Custom)

---

#### Apply Promo Code

Apply a promo code to a checkout session.

**Endpoint:** `POST /api/v1/billing/promo-codes/apply`

**Auth:** Required

**Request Body:**

```json
{
  "code": "LANZAMIENTO50",
  "checkoutId": "checkout-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "checkout-uuid",
    "promoCode": "LANZAMIENTO50",
    "amount": 1500000,
    "discountAmount": 750000
  }
}
```

**Notes:**

- Validates promo code first
- Updates checkout session with discount
- Increments redemption count

**Status:** ⚠️ Partially implemented (returns placeholder data)

---

#### List All Promo Codes (Admin)

Get a list of all promo codes (admin only).

**Endpoint:** `GET /api/v1/billing/promo-codes`

**Auth:** Admin only

**Query Parameters:**

| Parameter   | Type    | Description                    |
|-------------|---------|--------------------------------|
| page        | number  | Page number (default: 1)       |
| pageSize    | number  | Items per page (default: 20)   |
| active      | boolean | Filter by active status        |
| expired     | boolean | Filter by expiration status    |
| codeSearch  | string  | Search by code (partial match) |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "promo-uuid",
        "code": "LANZAMIENTO50",
        "discountType": "percentage",
        "discountValue": 50,
        "description": "50% off for first 100 users",
        "expiresAt": "2024-06-30T23:59:59Z",
        "maxRedemptions": 100,
        "redemptionCount": 45,
        "restrictions": {
          "plans": ["owner-basico", "owner-pro"],
          "firstPurchaseOnly": true,
          "minimumAmount": null
        },
        "active": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-30T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 8,
      "totalPages": 1
    }
  }
}
```

**Status:** ✅ Fully implemented (Custom)

---

#### Create Promo Code (Admin)

Create a new promo code (admin only).

**Endpoint:** `POST /api/v1/billing/promo-codes`

**Auth:** Admin only

**Request Body:**

```json
{
  "code": "NEWYEAR2024",
  "discountType": "percentage",
  "discountValue": 30,
  "description": "New Year 2024 promotion",
  "expiryDate": "2024-12-31T23:59:59Z",
  "maxUses": 500,
  "planRestrictions": ["owner-basico", "owner-pro"],
  "firstPurchaseOnly": true,
  "minAmount": 1000000,
  "isActive": true
}
```

**Fields:**

| Field            | Type     | Required | Description                      |
|------------------|----------|----------|----------------------------------|
| code             | string   | Yes      | Unique code (3-50 chars, A-Z0-9_-) |
| discountType     | enum     | Yes      | "percentage" or "fixed"          |
| discountValue    | number   | Yes      | Percentage (1-100) or ARS cents  |
| description      | string   | No       | Internal description             |
| expiryDate       | datetime | No       | Expiry date (null = no expiry)   |
| maxUses          | number   | No       | Max redemptions (null = unlimited) |
| planRestrictions | array    | No       | Array of plan UUIDs              |
| firstPurchaseOnly | boolean | No      | Only for first purchase (default: false) |
| minAmount        | number   | No       | Minimum amount in ARS cents      |
| isActive         | boolean  | No       | Active status (default: true)    |

**Validation:**

- Code must be unique
- Percentage discount must be 1-100
- Fixed discount must be positive

**Response:** Single promo code object (same structure as list)

**Status:** ✅ Fully implemented (Custom)

---

#### Update Promo Code (Admin)

Update an existing promo code (admin only).

**Endpoint:** `PUT /api/v1/billing/promo-codes/:id`

**Auth:** Admin only

**Request Body:**

```json
{
  "description": "Updated description",
  "expiryDate": "2024-12-31T23:59:59Z",
  "maxUses": 1000,
  "isActive": false
}
```

**Notes:**

- Cannot update `code`, `discountType`, or `discountValue`
- All fields are optional

**Response:** Updated promo code object

**Status:** ✅ Fully implemented (Custom)

---

#### Delete Promo Code (Admin)

Soft delete a promo code (admin only).

**Endpoint:** `DELETE /api/v1/billing/promo-codes/:id`

**Auth:** Admin only

**Response:**

```json
{
  "success": true,
  "data": null
}
```

**Notes:**

- Soft delete (sets `deletedAt` timestamp)
- Cannot be reactivated (create a new code instead)

**Status:** ✅ Fully implemented (Custom)

---

### Add-ons

#### List Available Add-ons

Get a list of available add-ons for purchase.

**Endpoint:** `GET /api/v1/billing/addons`

**Auth:** Required

**Query Parameters:**

| Parameter      | Type   | Description                           |
|---------------|--------|---------------------------------------|
| billingType   | enum   | Filter by type: one_time/recurring    |
| targetCategory | enum  | Filter by category: owner/complex     |
| active        | boolean | Filter by active status (default: true) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "slug": "visibility-boost-7d",
      "name": "Impulso de Visibilidad - 7 días",
      "description": "Destaca tu alojamiento en búsquedas por 7 días",
      "billingType": "one_time",
      "priceArs": 500000,
      "durationDays": 7,
      "affectsLimitKey": null,
      "limitIncrease": null,
      "grantsEntitlement": "FEATURED_LISTING",
      "targetCategories": ["owner", "complex"],
      "isActive": true,
      "sortOrder": 1
    },
    {
      "slug": "extra-photos-20",
      "name": "20 Fotos Adicionales",
      "description": "Añade 20 fotos más por alojamiento",
      "billingType": "recurring",
      "priceArs": 500000,
      "durationDays": null,
      "affectsLimitKey": "MAX_PHOTOS_PER_ACCOMMODATION",
      "limitIncrease": 20,
      "grantsEntitlement": null,
      "targetCategories": ["owner", "complex"],
      "isActive": true,
      "sortOrder": 2
    }
  ]
}
```

**Status:** ✅ Fully implemented (Custom)

---

#### Get Add-on by Slug

Get details of a specific add-on.

**Endpoint:** `GET /api/v1/billing/addons/:slug`

**Auth:** Required

**Response:** Single add-on object (same structure as list)

**Status:** ✅ Fully implemented (Custom)

---

#### Purchase Add-on

Initiate add-on purchase and get checkout URL.

**Endpoint:** `POST /api/v1/billing/addons/:slug/purchase`

**Auth:** Required

**Request Body:**

```json
{
  "addonId": "addon-slug",
  "promoCode": "ADDON20"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://mercadopago.com.ar/checkout/v1/...",
    "orderId": "order-uuid",
    "addonId": "visibility-boost-7d",
    "amount": 500000,
    "currency": "ARS",
    "expiresAt": "2024-01-30T13:00:00Z"
  }
}
```

**Notes:**

- Requires active subscription
- One-time add-ons are single purchases
- Recurring add-ons create a secondary subscription
- Redirect user to `checkoutUrl` to complete payment

**Status:** ✅ Fully implemented (Custom)

---

#### Get User's Active Add-ons

Get a list of the authenticated user's active add-ons.

**Endpoint:** `GET /api/v1/billing/addons/my`

**Auth:** Required

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "user-addon-uuid",
      "addonSlug": "visibility-boost-7d",
      "addonName": "Impulso de Visibilidad - 7 días",
      "billingType": "one_time",
      "status": "active",
      "purchasedAt": "2024-01-30T12:00:00Z",
      "expiresAt": "2024-02-06T12:00:00Z",
      "canceledAt": null,
      "priceArs": 500000,
      "affectsLimitKey": null,
      "limitIncrease": null,
      "grantsEntitlement": "FEATURED_LISTING"
    }
  ]
}
```

**Status:** ✅ Fully implemented (Custom)

---

#### Cancel Recurring Add-on

Cancel a recurring add-on subscription.

**Endpoint:** `POST /api/v1/billing/addons/:id/cancel`

**Auth:** Required

**Request Body:**

```json
{
  "reason": "No longer needed"
}
```

**Response:**

```json
{
  "success": true,
  "data": null
}
```

**Notes:**

- Only works for recurring add-ons
- Add-on remains active until end of billing period
- One-time add-ons cannot be canceled (they expire automatically)

**Status:** ✅ Fully implemented (Custom)

---

### Trial

#### Get Trial Status

Get the trial status for the authenticated user.

**Endpoint:** `GET /api/v1/billing/trial/status`

**Auth:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "isOnTrial": true,
    "isExpired": false,
    "startedAt": "2024-01-16T12:00:00Z",
    "expiresAt": "2024-01-30T12:00:00Z",
    "daysRemaining": 7,
    "planSlug": "owner-basico"
  }
}
```

**Fields:**

- `isOnTrial` - Currently on trial (even if expired)
- `isExpired` - Trial has expired
- `startedAt` - Trial start date
- `expiresAt` - Trial end date
- `daysRemaining` - Days remaining (0 if expired)
- `planSlug` - Trial plan slug

**Status:** ✅ Fully implemented (Custom)

---

#### Start Trial (Internal)

Start a 14-day trial for a new user. Typically called by auth sync service.

**Endpoint:** `POST /api/v1/billing/trial/start`

**Auth:** Public (internal use)

**Request Body:**

```json
{
  "customerId": "customer-uuid",
  "userType": "owner"
}
```

**Response:**

```json
{
  "success": true,
  "subscriptionId": "sub-uuid",
  "message": "Trial started successfully"
}
```

**Notes:**

- Called automatically when a new user registers
- Creates a trial subscription with 14-day duration
- User type determines trial plan (owner/complex)
- Tourist users don't get trials (free plan available)

**Status:** ✅ Fully implemented (Custom)

---

#### Check Expired Trials (Admin/Cron)

Batch job to find and block all expired trials.

**Endpoint:** `POST /api/v1/billing/trial/check-expiry`

**Auth:** Required (TODO: admin-only)

**Response:**

```json
{
  "success": true,
  "blockedCount": 12,
  "message": "Successfully blocked 12 expired trial(s)"
}
```

**Notes:**

- Intended to be called by a cron job daily
- Blocks access for expired trials
- Users must upgrade to paid plan to continue

**Status:** ✅ Fully implemented (Custom, admin check pending)

---

### Entitlements

#### Get User Entitlements

Get the authenticated user's current entitlements (feature flags).

**Endpoint:** `GET /api/v1/billing/entitlements`

**Auth:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "entitlements": [
      "PUBLISH_ACCOMMODATIONS",
      "VIEW_BOOKING_STATS",
      "RESPOND_TO_REVIEWS",
      "CUSTOM_AVAILABILITY_CALENDAR"
    ]
  }
}
```

**Notes:**

- Entitlements are determined by active subscription + add-ons
- Used for feature gating in frontend and API

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Limits

#### Get User Limits

Get the authenticated user's current numeric limits.

**Endpoint:** `GET /api/v1/billing/limits`

**Auth:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "limits": {
      "MAX_ACCOMMODATIONS": 1,
      "MAX_PHOTOS_PER_ACCOMMODATION": 5,
      "MAX_ACTIVE_PROMOTIONS": 1,
      "MAX_FAVORITES": -1,
      "MAX_PROPERTIES": -1,
      "MAX_STAFF_ACCOUNTS": -1
    }
  }
}
```

**Notes:**

- `-1` means unlimited
- Limits are determined by active subscription + add-ons
- Used for enforcement in API and frontend

**Status:** ✅ Fully implemented (QZPay pre-built)

---

### Webhooks

#### MercadoPago IPN Webhook

Handle incoming payment notifications from MercadoPago.

**Endpoint:** `POST /api/v1/webhooks/mercadopago`

**Auth:** Public (signature verification)

**Security:**

- Webhook signature verification via `x-signature` header
- Idempotent event processing (duplicate events ignored)
- MercadoPago adapter validates signature automatically

**Events Handled:**

- `payment.created` - New payment initiated
- `payment.updated` - Payment status changed (approved, rejected, etc.)
- `subscription_preapproval.updated` - Subscription status changed

**Request (from MercadoPago):**

```json
{
  "id": 12345,
  "type": "payment",
  "action": "payment.updated",
  "data": {
    "id": "payment-id"
  }
}
```

**Headers:**

```http
x-signature: ts=1234567890,v1=abc123...
x-request-id: unique-request-id
```

**Response:**

```json
{
  "success": true
}
```

**Notes:**

- Returns 200 OK immediately to acknowledge receipt
- Processing happens asynchronously
- Signature verification prevents unauthorized requests
- Webhook URL must be configured in MercadoPago dashboard

**Special Handling:**

- **Add-on purchases**: If payment metadata contains `addonSlug` and `customerId`, the webhook confirms the purchase and applies entitlements
- **Subscription payments**: Standard QZPay processing
- **Failed payments**: Updates subscription status

**Status:** ✅ Fully implemented (QZPay + Custom add-on handling)

---

## Error Codes

Common error responses across all billing endpoints:

### 400 Bad Request

Invalid request parameters or body.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "planId",
      "message": "Invalid plan ID"
    }
  }
}
```

### 401 Unauthorized

Missing or invalid authentication token.

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden

Insufficient permissions (e.g., admin-only endpoint).

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

### 404 Not Found

Resource not found.

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Plan not found"
  }
}
```

### 409 Conflict

Business rule violation.

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "User already has an active subscription"
  }
}
```

**Common conflict scenarios:**

- User already has active subscription
- Promo code already redeemed
- Maximum redemptions reached

### 503 Service Unavailable

Billing service not configured or temporarily unavailable.

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Billing service is not configured"
  }
}
```

---

### Usage Tracking

#### Get User Usage Summary

Get the authenticated user's current resource usage across all plan limits.

**Endpoint:** `GET /api/v1/billing/usage`

**Auth:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "customerId": "customer-uuid",
    "limits": [
      {
        "limitKey": "MAX_ACCOMMODATIONS",
        "displayName": "Maximum Accommodations",
        "currentUsage": 1,
        "maxAllowed": 5,
        "usagePercentage": 20,
        "threshold": "ok",
        "planBaseLimit": 5,
        "addonBonusLimit": 0
      },
      {
        "limitKey": "MAX_PHOTOS_PER_ACCOMMODATION",
        "displayName": "Photos per Accommodation",
        "currentUsage": 8,
        "maxAllowed": 10,
        "usagePercentage": 80,
        "threshold": "warning",
        "planBaseLimit": 5,
        "addonBonusLimit": 5
      },
      {
        "limitKey": "MAX_ACTIVE_PROMOTIONS",
        "displayName": "Active Promotions",
        "currentUsage": 3,
        "maxAllowed": 3,
        "usagePercentage": 100,
        "threshold": "critical",
        "planBaseLimit": 1,
        "addonBonusLimit": 2
      }
    ],
    "overallThreshold": "warning",
    "upgradeUrl": "https://hospeda.com.ar/upgrade"
  }
}
```

**Threshold Levels:**

- `ok` - Usage below 70%
- `warning` - Usage 70-90%
- `critical` - Usage 90-100%
- `exceeded` - Usage above 100% (limit enforcement may be in effect)

**Notes:**

- `planBaseLimit` - Base limit from subscription plan
- `addonBonusLimit` - Additional limit from purchased add-ons
- `maxAllowed` = `planBaseLimit` + `addonBonusLimit`
- `overallThreshold` - Highest threshold across all limits

**Status:** ✅ Fully implemented (Custom)

---

#### Get Usage for Specific Limit

Get detailed usage information for a specific resource limit.

**Endpoint:** `GET /api/v1/billing/usage/:limitKey`

**Auth:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| limitKey  | enum | Limit key (e.g., MAX_ACCOMMODATIONS) |

**Valid Limit Keys:**

- `MAX_ACCOMMODATIONS`
- `MAX_PHOTOS_PER_ACCOMMODATION`
- `MAX_ACTIVE_PROMOTIONS`
- `MAX_FAVORITES`
- `MAX_PROPERTIES`
- `MAX_STAFF_ACCOUNTS`

**Response:**

```json
{
  "success": true,
  "data": {
    "limitKey": "MAX_ACCOMMODATIONS",
    "displayName": "Maximum Accommodations",
    "currentUsage": 3,
    "maxAllowed": 5,
    "usagePercentage": 60,
    "threshold": "ok",
    "planBaseLimit": 5,
    "addonBonusLimit": 0
  }
}
```

**Status:** ✅ Fully implemented (Custom)

---

#### Get Customer Usage Summary (Admin)

Get any customer's resource usage (admin only).

**Endpoint:** `GET /api/v1/admin/billing/usage/:customerId`

**Auth:** Admin only (requires `BILLING_READ_ALL` permission)

**Path Parameters:**

| Parameter  | Type | Description |
|-----------|------|-------------|
| customerId | uuid | Billing customer ID |

**Response:** Same structure as user usage summary

**Status:** ✅ Fully implemented (Custom)

---

### Webhooks

#### Webhook Health Check

Get webhook system health metrics and statistics.

**Endpoint:** `GET /api/v1/webhooks/health`

**Auth:** CRON_SECRET or Admin

**Authentication:**

```http
Authorization: Bearer <CRON_SECRET>
```

Or authenticated admin user.

**Response:**

```json
{
  "success": true,
  "data": {
    "last24h": {
      "total": 142,
      "processed": 138,
      "failed": 3,
      "pending": 1
    },
    "lastEventAt": "2024-01-30T14:23:45Z",
    "deadLetterCount": 2,
    "avgProcessingTimeMs": 234
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| last24h.total | number | Total events in last 24 hours |
| last24h.processed | number | Successfully processed events |
| last24h.failed | number | Failed events |
| last24h.pending | number | Pending events |
| lastEventAt | string | ISO timestamp of most recent event |
| deadLetterCount | number | Events requiring manual intervention |
| avgProcessingTimeMs | number | Average processing time in milliseconds |

**Use Cases:**

- Monitor webhook health in production
- Alert on high failure rates
- Track processing performance
- Identify dead letter queue buildup

**Status:** ✅ Fully implemented (Custom)

---

## Implementation Status

### QZPay Pre-built Routes

These endpoints are fully implemented via `@qazuor/qzpay-hono`:

- ✅ Plans (list, get)
- ✅ Customers (create, get, update, delete)
- ✅ Subscriptions (create, get, update, cancel)
- ✅ Checkout (create, get status)
- ✅ Payments (list, get, refund)
- ✅ Invoices (list, get, pay, void)
- ✅ Entitlements (list, grant, revoke, get)
- ✅ Webhook handling (signature verification, idempotency)

### Custom Routes

These endpoints are custom implementations:

- ✅ Promo Codes (CRUD, validate, apply)
- ✅ Add-ons (list, get, purchase, user list, cancel)
- ✅ Trial (status, start, check expiry)
- ✅ Usage Tracking (user summary, specific limit, admin summary)
- ✅ Webhook Health (monitoring and statistics)
- ⚠️ Promo code apply - Returns placeholder data (QZPay integration pending)

### Pending Features

- [ ] Admin check for trial expiry endpoint
- [ ] Promo code apply integration with QZPay checkout
- [ ] Refund endpoint (QZPay pre-built, not yet exposed)
- [ ] Invoice pay endpoint (QZPay pre-built, not yet exposed)

---

## Testing

**Test users and plans:**

- Owner trial: 14 days on `owner-basico` plan
- Complex trial: 14 days on `complex-basico` plan
- Tourist: No trial, free `tourist-free` plan available

**Test promo codes:**

- `HOSPEDA_FREE` - 100% discount (internal use)
- `LANZAMIENTO50` - 50% discount for 3 months
- `BIENVENIDO30` - 30% discount for 1 month

**Sandbox environment:**

- MercadoPago sandbox mode enabled by default
- Use test cards from MercadoPago docs
- All prices in ARS cents (e.g., 1500000 = ARS $15,000)

---

## Additional Resources

- [MercadoPago API Docs](https://www.mercadopago.com.ar/developers/es/docs)
- [QZPay Documentation](https://github.com/qazuor/qzpay)
- [Billing Package README](../../../packages/billing/README.md)
- [Trial System Documentation](./trial-system.md)
- [Promo Code 100% Discount Handling](./promo-code-100-discount-handling.md)
