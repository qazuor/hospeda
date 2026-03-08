# Billing Admin Guide

Complete guide for managing billing, subscriptions, payments, and sponsorships in the Hospeda admin panel.

## Overview

The billing admin panel provides comprehensive tools for managing the monetization system, including:

- Plan and add-on catalog management
- Subscription and payment tracking
- Promo code creation and management
- Owner promotion moderation
- Sponsorship deal management
- Revenue metrics and analytics
- Billing system configuration

## Access Control

**Roles with Access:**

- `SUPER_ADMIN` - Full access to all billing features
- `CLIENT_MANAGER` - Read-only access to subscriptions, payments, and invoices

**Sponsor Portal:**

- `SPONSOR` - Limited access to own sponsorships, analytics, and invoices

## Billing Section

Access the billing section at `/billing/*` in the admin dashboard.

### Plans Management (`/billing/plans`)

Manage the 9 subscription plans (3 owner tiers, 3 complex tiers, 3 tourist tiers).

**Features:**

- View all plans with pricing and features
- Edit plan details (name, description, display order)
- Configure pricing (monthly/annual rates)
- Set trial periods per plan
- Toggle plan visibility
- Plans are seeded from `@repo/billing` configuration

**Plan Structure:**

- **Owner Plans**: `owner-basic`, `owner-professional`, `owner-business`
- **Complex Plans**: `complex-starter`, `complex-growth`, `complex-enterprise`
- **Tourist Plans**: `tourist-free`, `tourist-explorer`, `tourist-pro`

**Actions:**

- Edit plan metadata
- Override prices (preserves seed defaults)
- Configure trial days
- Toggle active status

### Subscriptions (`/billing/subscriptions`)

Monitor and manage all active subscriptions across the platform.

**Features:**

- DataTable with filtering and sorting
- Filter by status (`active`, `canceled`, `past_due`, `trialing`)
- Filter by plan type
- Search by user/customer
- View subscription details
- Change plans
- Cancel subscriptions

**Columns:**

- Customer name/email
- Plan name
- Status
- Current period (start/end dates)
- Next billing date
- Amount
- Actions

**Actions:**

- View full subscription details
- Change subscription plan
- Cancel subscription (with reason)
- View associated payments

### Payments (`/billing/payments`)

Complete payment history with filtering and refund management.

**Features:**

- DataTable with advanced filtering
- Filter by status (`succeeded`, `pending`, `failed`, `refunded`)
- Date range filtering
- Search by customer or transaction ID
- View payment details
- Process refunds

**Columns:**

- Transaction ID
- Customer
- Amount
- Status
- Payment method
- Created date
- Actions

**Actions:**

- View payment details
- Process full/partial refund
- View related invoice
- Download receipt

### Invoices (`/billing/invoices`)

Invoice management and generation.

**Features:**

- DataTable with invoice list
- Filter by status (`draft`, `open`, `paid`, `void`, `uncollectible`)
- Date range filtering
- Search by customer or invoice number
- View/download invoices
- Void invoices

**Columns:**

- Invoice number
- Customer
- Amount
- Status
- Due date
- Paid date
- Actions

**Actions:**

- View invoice details
- Download PDF
- Void invoice
- Send invoice email
- Mark as paid (manual)

### Promo Codes (`/billing/promo-codes`)

Full CRUD interface for promotional codes and discounts.

**Features:**

- Create custom promo codes
- Edit existing codes
- Toggle active/inactive status
- Delete unused codes
- Track usage statistics

**Code Configuration:**

- Code (unique identifier, e.g., `LANZAMIENTO50`)
- Discount type (`percentage` or `fixed_amount`)
- Discount value
- Valid from/to dates
- Max redemptions (total and per customer)
- Plan restrictions (which plans can use this code)
- Description (internal notes)

**Default Codes:**

- `HOSPEDA_FREE` - 100% discount (special events)
- `LANZAMIENTO50` - 50% off for 3 months (launch promotion)
- `BIENVENIDO30` - 30% off first month (welcome offer)

**Actions:**

- Create new promo code
- Edit code details
- Toggle active status
- Delete (if unused)
- View redemption history

### Add-ons (`/billing/addons`)

Manage one-time purchase add-ons (e.g., featured listings, extra photos).

**Features:**

- View all add-ons
- Filter by active/inactive status
- Edit add-on details
- Update pricing
- Configure entitlements

**Add-on Types:**

- Featured listing boosts
- Additional photo uploads
- Priority support
- Analytics packages
- Custom features

**Actions:**

- Edit add-on details
- Update pricing
- Toggle availability
- View purchase history

### Owner Promotions (`/billing/owner-promotions`)

Moderate owner-created promotions for their accommodations.

**Features:**

- View all owner promotions
- Filter by status (`active`, `scheduled`, `expired`)
- Filter by discount type
- Search by owner or accommodation
- Toggle activation
- Delete promotions

**Columns:**

- Owner name
- Accommodation
- Discount type/amount
- Valid dates
- Status
- Created date
- Actions

**Actions:**

- View promotion details
- Toggle active status
- Delete promotion
- View promotion performance

### Sponsorships (`/billing/sponsorships`)

Manage sponsorship deals for events and posts.

**Features:**

- View all sponsorship deals
- Filter by target type (`event`, `post`)
- Filter by level (Bronze, Silver, Gold, Platinum)
- Filter by status (`active`, `pending`, `completed`)
- Search by sponsor or target

**Columns:**

- Sponsor name
- Target (event/post title)
- Level
- Amount
- Status
- Start/end dates
- Actions

**Actions:**

- View sponsorship details
- Approve pending deals
- Edit terms
- View analytics
- Generate invoice

### Metrics (`/billing/metrics`)

Revenue analytics and business intelligence dashboard.

**Key Metrics:**

- **MRR (Monthly Recurring Revenue)** - Total recurring revenue
- **Active Subscriptions** - Count by plan type
- **Churn Rate** - Monthly subscription cancellations
- **Revenue by Plan** - Breakdown per plan tier
- **Conversion Rate** - Trial to paid conversion
- **ARPU (Average Revenue Per User)** - Revenue per active user

**Charts:**

- Revenue trends (line chart)
- Plan distribution (pie chart)
- Monthly growth (bar chart)
- Cohort analysis
- Churn analysis

**Date Filters:**

- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

### Settings (`/billing/settings`)

Configure billing system behavior and defaults.

**Configuration Options:**

- **Trial Period** - Default trial days for new subscriptions (default: 14)
- **Grace Period** - Days before suspending after failed payment (default: 3)
- **Retry Policy** - Payment retry schedule (e.g., 1, 3, 7 days)
- **Default Currency** - ARS (Argentine Peso)
- **Tax Settings** - Tax rates and regions
- **Invoice Settings** - Company details, invoice prefix, numbering
- **Email Notifications** - Enable/disable email triggers
- **Webhook URLs** - Configure external webhook endpoints

**Actions:**

- Update trial period
- Configure retry policy
- Edit invoice template
- Toggle email notifications
- Test webhook endpoints

## Sponsor Section

Limited portal for sponsors to manage their own deals. Access at `/sponsor/*`.

### Dashboard (`/sponsor/`)

Overview of sponsorship activity and performance.

**Summary Cards:**

- Active sponsorships count
- Total spent this month
- Total impressions
- Average CTR

**Recent Activity:**

- Latest sponsorships
- Recent invoices
- Performance highlights

### Sponsorships (`/sponsor/sponsorships`)

Manage own sponsorship deals.

**Features:**

- View active and past sponsorships
- Filter by target type
- View performance metrics
- Download reports

**Actions:**

- View details
- Request renewal
- Download invoice

### Analytics (`/sponsor/analytics`)

Detailed performance metrics for sponsorships.

**Metrics:**

- Impressions (total views)
- Clicks (click-through count)
- CTR (click-through rate)
- Conversions (coupon usage)
- ROI calculation

**Charts:**

- Impressions over time
- CTR trends
- Conversion funnel
- Geographic distribution

### Invoices (`/sponsor/invoices`)

Access to sponsorship invoices.

**Features:**

- List of all invoices
- Filter by status and date
- Download PDF invoices
- Payment status tracking

## Webhook Setup

Configure MercadoPago webhooks to receive real-time payment notifications.

### Endpoint

```text
POST /api/v1/webhooks/mercadopago
```

**Public endpoint** - No authentication required (signature verification used instead)

### MercadoPago Configuration

1. Log in to [MercadoPago Developers](https://www.mercadopago.com.ar/developers)
2. Navigate to **Your Applications** → **Your App** → **Webhooks**
3. Add webhook URL: `https://your-domain.com/api/v1/webhooks/mercadopago`
4. Select events to receive:
   - `payment.created`
   - `payment.updated`
   - `subscription_preapproval.updated`
5. Copy webhook secret from MercadoPago dashboard
6. Add to environment variables (see below)

### Events Handled

#### payment.created

- New payment initiated
- Logged for monitoring
- Processed by QZPay billing system

#### payment.updated

- Payment status changed (succeeded, failed, refunded)
- Automatic subscription activation on success
- Add-on purchase confirmation (if metadata contains `addonSlug`)
- Updates customer entitlements

#### subscription_preapproval.updated

- Subscription status changed (activated, paused, canceled)
- Automatic entitlement updates
- Grace period handling for failed payments

### Signature Verification

All webhooks are verified using the `x-signature` header:

```text
x-signature: ts=1234567890,v1=abc123def456...
```

- Timestamp validation (prevents replay attacks)
- HMAC SHA-256 signature verification
- Rejects invalid or expired signatures

### Add-on Purchase Flow

When a payment is for an add-on purchase:

1. Payment created with metadata:

   ```json
   {
     "addonSlug": "featured-listing",
     "customerId": "cus_abc123"
   }
   ```

2. Webhook receives `payment.updated` event
3. System confirms purchase: `AddonService.confirmPurchase()`
4. Entitlements applied to customer immediately
5. Customer notified via email

### Idempotency

- All webhook events are processed idempotently
- Duplicate events are ignored automatically
- Safe to retry failed webhooks

## Environment Variables

Configure the following environment variables for billing functionality.

### Required

```env
# MercadoPago Access Token (TEST- prefix for sandbox, APP_USR- for production)
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-your_access_token_here

# Database connection (shared)
HOSPEDA_DATABASE_URL=postgresql://user:password@localhost:5432/hospeda

# API URL (shared)
HOSPEDA_API_URL=http://localhost:3001
```

### Optional

```env
# Webhook secret for signature verification
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=your_webhook_secret_here

# MercadoPago configuration
HOSPEDA_MERCADO_PAGO_SANDBOX=true                    # Enable sandbox mode (default: true)
HOSPEDA_MERCADO_PAGO_TIMEOUT=5000                    # Request timeout in ms (default: 5000)
HOSPEDA_MERCADO_PAGO_PLATFORM_ID=                    # Platform ID for marketplace tracking
HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID=                  # Integrator ID for tracking

# Redis (optional, for caching)
HOSPEDA_REDIS_URL=redis://localhost:6379
```

### Production Checklist

Before going live:

- [ ] Replace `TEST-` token with production `APP_USR-` token
- [ ] Set `HOSPEDA_MERCADO_PAGO_SANDBOX=false`
- [ ] Configure webhook secret from production app
- [ ] Update webhook URL in MercadoPago dashboard
- [ ] Test all webhook events with production credentials
- [ ] Enable SSL/TLS for webhook endpoint
- [ ] Configure monitoring for webhook failures
- [ ] Set up error alerting (Sentry/email)

## Security Best Practices

- **Never expose** access tokens or webhook secrets in client code
- **Always verify** webhook signatures before processing
- **Use HTTPS** for webhook endpoints in production
- **Implement** rate limiting on webhook endpoint (handled automatically)
- **Monitor** for suspicious activity (multiple failed signatures)
- **Rotate** webhook secrets periodically
- **Restrict** admin access to billing section by role

## Troubleshooting

**Webhook not receiving events:**

- Verify webhook URL is publicly accessible
- Check MercadoPago dashboard for delivery attempts
- Verify webhook secret matches environment variable
- Check API logs for signature verification errors

**Subscription not activating:**

- Check payment status in MercadoPago dashboard
- Verify webhook received `payment.updated` event
- Check customer entitlements in database
- Review API logs for processing errors

**Add-on purchase not confirmed:**

- Verify payment metadata contains `addonSlug` and `customerId`
- Check webhook processing logs
- Verify add-on exists and is active
- Check customer entitlements table

**Metrics not updating:**

- Verify cron jobs are running for metric calculation
- Check database connections
- Review calculation logs for errors
- Manually trigger metric recalculation if needed
