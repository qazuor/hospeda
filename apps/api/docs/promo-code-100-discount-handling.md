# Handling 100% Discount Promo Codes

## Overview

This document explains how to handle promo codes with 100% discount (like `HOSPEDA_FREE`) in the checkout and subscription creation flow.

## Current Implementation

### Promo Code Creation

The `HOSPEDA_FREE` promo code is automatically created during API startup via:

- **Module**: `apps/api/src/services/promo-code-defaults.ts`
- **Initialization**: Called in `apps/api/src/index.ts` during `startServer()`
- **Behavior**: Idempotent - won't recreate if code already exists

### Configuration

```typescript
{
  code: 'HOSPEDA_FREE',
  discountType: 'percentage',
  discountValue: 100,
  isActive: true,
  expiryDate: undefined,        // No expiration
  maxUses: undefined,            // Unlimited uses
  planRestrictions: undefined,   // All plans
  firstPurchaseOnly: false,      // Can be used multiple times per user
  minAmount: undefined           // No minimum amount
}
```

## Future Implementation Requirements

### 1. Checkout Flow Modification

When implementing the checkout flow with QZPay, you need to handle 100% discount specially:

**Location**: `apps/api/src/services/promo-code.service.ts` - `apply()` method

```typescript
async apply(code: string, checkoutId: string) {
  // 1. Validate the promo code
  const promoCode = await this.getByCode(code);

  if (!promoCode.success || !promoCode.data) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Promo code not found' } };
  }

  // 2. Check if discount is 100%
  if (promoCode.data.type === 'percentage' && promoCode.data.value === 100) {
    // Skip payment provider checkout
    // Create subscription directly with $0 amount
    return this.createFreeSubscription(checkoutId, promoCode.data);
  }

  // 3. Normal flow - apply to checkout and proceed to payment
  const billing = this.ensureBilling();
  const checkout = await billing.checkout.applyPromoCode(checkoutId, code);

  return { success: true, data: checkout };
}
```

### 2. Create Free Subscription Method

Add a new method to handle 100% discount subscriptions:

**Location**: `apps/api/src/services/promo-code.service.ts`

```typescript
/**
 * Creates a free subscription (100% discount)
 *
 * When a promo code provides 100% discount, we skip the payment provider
 * and create the subscription directly with $0 amount.
 *
 * @param checkoutId - The checkout session ID
 * @param promoCode - The promo code providing 100% discount
 * @returns Created subscription
 */
private async createFreeSubscription(checkoutId: string, promoCode: PromoCode) {
  const billing = this.ensureBilling();

  // Get checkout details to extract plan, customer, etc.
  const checkout = await billing.checkout.retrieve(checkoutId);

  if (!checkout) {
    throw new Error('Checkout not found');
  }

  // Create subscription with $0 amount
  const subscription = await billing.subscriptions.create({
    customerId: checkout.customerId,
    planId: checkout.planId,
    status: 'active',          // Immediately active
    amount: 0,                 // $0 billing
    currency: 'ARS',
    promoCodeId: promoCode.id,
    paymentMethodRequired: false, // No payment method needed
    metadata: {
      checkoutId,
      promoCode: promoCode.code,
      freeSubscription: true
    }
  });

  // Increment promo code usage
  await this.incrementUsage(promoCode.id);

  return {
    success: true,
    data: {
      subscription,
      skipPayment: true,
      message: 'Subscription activated with 100% discount - no payment required'
    }
  };
}
```

### 3. Frontend Integration

The frontend checkout flow should handle the `skipPayment` response:

```typescript
// apps/web/src/components/checkout/CheckoutFlow.tsx
const applyPromoCode = async (code: string) => {
  const response = await api.billing.promoCodes.apply(code, checkoutId);

  if (response.skipPayment) {
    // Subscription is already active - skip payment step
    router.push('/dashboard?subscription=activated');
    return;
  }

  // Normal flow - redirect to payment provider
  window.location.href = response.data.checkoutUrl;
};
```

### 4. Subscription Display

Subscriptions with 100% discount should be displayed differently:

**Location**: `apps/admin/src/routes/_authed/billing/subscriptions.tsx`

```typescript
// In subscription list/detail view
{subscription.amount === 0 && subscription.promoCode && (
  <Badge variant="success">
    Free Plan (100% Discount)
  </Badge>
)}
```

### 5. Renewal Handling

Subscriptions created with `HOSPEDA_FREE` should renew automatically at $0:

**Location**: QZPay subscription renewal logic

```typescript
// During renewal check
if (subscription.promoCode === 'HOSPEDA_FREE') {
  // Skip payment collection
  // Auto-renew with $0 amount
  subscription.status = 'active';
  subscription.currentPeriodEnd = calculateNextPeriodEnd();
  await subscription.save();
}
```

## Testing Checklist

When implementing the 100% discount flow, test:

- [ ] Promo code is created on API startup
- [ ] Code can be applied to checkout
- [ ] Subscription is created without payment
- [ ] Subscription shows as active immediately
- [ ] No payment method is required
- [ ] Subscription displays correctly in admin
- [ ] Subscription auto-renews at $0
- [ ] Promo code usage count increments
- [ ] User can't be charged accidentally
- [ ] Downgrade/upgrade flows work correctly

## Security Considerations

### 1. Prevent Unauthorized Code Creation

Only system initialization should create 100% discount codes:

```typescript
// In PromoCodeService.create()
if (input.discountValue === 100 && input.discountType === 'percentage') {
  // Require special permission
  if (!actor.permissions.includes('promo_code:create_100_discount')) {
    throw new Error('Insufficient permissions to create 100% discount code');
  }
}
```

### 2. Audit 100% Discount Usage

Log all uses of 100% discount codes:

```typescript
if (promoCode.value === 100) {
  apiLogger.info({
    event: 'FREE_SUBSCRIPTION_CREATED',
    userId: checkout.customerId,
    promoCode: promoCode.code,
    planId: checkout.planId,
    timestamp: new Date().toISOString()
  });
}
```

### 3. Rate Limiting

Consider rate limiting 100% discount code applications to prevent abuse:

```typescript
// Allow max 1 free subscription per user per hour
const recentFreeSubscriptions = await db.subscriptions.count({
  where: {
    customerId: checkout.customerId,
    amount: 0,
    createdAt: { gte: oneHourAgo }
  }
});

if (recentFreeSubscriptions >= 1) {
  throw new Error('Too many free subscription requests. Please try again later.');
}
```

## Related Files

- `apps/api/src/services/promo-code-defaults.ts` - Default code creation
- `apps/api/src/services/promo-code.service.ts` - Promo code business logic
- `apps/api/src/routes/billing/promo-codes.ts` - API routes
- `apps/api/src/schemas/promo-code.schema.ts` - Validation schemas
- `apps/api/src/index.ts` - Startup initialization

## Questions & Answers

**Q: Can HOSPEDA_FREE be deleted?**
A: Yes, but it will be recreated on next API startup. To permanently disable it, set `isActive: false` in the configuration.

**Q: Can users downgrade from paid to HOSPEDA_FREE?**
A: Yes, this is allowed. Apply the code during subscription modification.

**Q: What happens if QZPay is not configured?**
A: The placeholder implementation will create the code locally, but checkout will fail. Ensure QZPay is configured before allowing checkout.

**Q: Can I create more 100% discount codes?**
A: Yes, but only via admin API with special permissions. Add them to `DEFAULT_PROMO_CODES` array for automatic creation.
