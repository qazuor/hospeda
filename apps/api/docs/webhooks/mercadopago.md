# MercadoPago Webhook Integration

This document describes the MercadoPago webhook endpoint implementation for processing IPN (Instant Payment Notification) events.

## Overview

The webhook endpoint receives and processes payment and subscription events from MercadoPago. It provides secure, idempotent handling of payment lifecycle events with automatic signature verification.

## Endpoint

```
POST /api/v1/webhooks/mercadopago
```

## Security

- Public endpoint (no authentication required)
- Signature verification via `x-signature` header
- Uses MercadoPago webhook secret from environment variables
- Implemented by QZPay payment adapter

## Event Types

The webhook processes the following MercadoPago event types:

### Payment Events

#### payment.created

Triggered when a new payment is initiated.

**Example payload:**

```json
{
  "id": 12345,
  "type": "payment",
  "action": "payment.created",
  "data": {
    "id": "payment-123"
  }
}
```

#### payment.updated

Triggered when a payment status changes.

**Example payload:**

```json
{
  "id": 12346,
  "type": "payment",
  "action": "payment.updated",
  "data": {
    "id": "payment-123"
  }
}
```

**Common payment statuses:**

- `approved` - Payment was approved
- `rejected` - Payment was rejected
- `pending` - Payment is pending
- `cancelled` - Payment was cancelled
- `refunded` - Payment was refunded
- `charged_back` - Payment was charged back

### Subscription Events

#### subscription_preapproval.updated

Triggered when a subscription status changes.

**Example payload:**

```json
{
  "id": 12347,
  "type": "subscription_preapproval",
  "action": "subscription_preapproval.updated",
  "data": {
    "id": "subscription-123"
  }
}
```

**Common subscription statuses:**

- `authorized` - Subscription is active
- `paused` - Subscription is paused
- `cancelled` - Subscription was cancelled
- `pending` - Subscription is pending activation

## Request Format

### Headers

```http
POST /api/v1/webhooks/mercadopago HTTP/1.1
Content-Type: application/json
User-Agent: MercadoPago/1.0
x-signature: ts=1234567890,v1=abc123...
x-request-id: unique-request-id
```

Required headers:

- `Content-Type: application/json`
- `User-Agent: MercadoPago/*`
- `x-signature` - Webhook signature for verification

### Body

Standard MercadoPago IPN notification format:

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

## Response Format

### Success (200 OK)

```json
{
  "received": true
}
```

The webhook always returns `200 OK` quickly to acknowledge receipt, even if processing fails. This prevents MercadoPago from retrying non-recoverable errors.

### Error Responses

#### 400 Bad Request

Invalid request format or missing required headers.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request format"
  }
}
```

#### 401 Unauthorized

Invalid or missing webhook signature.

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid webhook signature"
  }
}
```

## Event Processing

### Processing Flow

1. **Signature Verification**
   - QZPay webhook middleware verifies the `x-signature` header
   - Uses `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` from environment
   - Rejects requests with invalid signatures

2. **Idempotency Check**
   - QZPay checks if the event has been processed before
   - Uses event ID for deduplication
   - Prevents duplicate processing

3. **Event Routing**
   - Specific handlers for known event types
   - Generic handler for unknown event types
   - Logs all events for monitoring

4. **Billing System Update**
   - QZPay billing instance processes the event
   - Updates subscriptions, payments, invoices
   - Triggers business logic (activation, notifications, etc.)

5. **Response**
   - Returns `200 OK` to acknowledge receipt
   - Actual processing may continue asynchronously

### Error Handling

- **Recoverable Errors**: QZPay retries internally with exponential backoff
- **Non-Recoverable Errors**: Logged but returns `200 OK` to prevent MercadoPago retries
- **Critical Errors**: Logged with full context for investigation

## Configuration

### Environment Variables

Required environment variables (set in `.env`):

```bash
# MercadoPago Access Token (required)
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-1234567890-abcdef

# Webhook Secret for signature verification (recommended)
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret-here

# Database connection (required)
HOSPEDA_DATABASE_URL=postgresql://...
```

### MercadoPago Dashboard Configuration

1. Go to MercadoPago Developer Dashboard
2. Navigate to Your App > Webhooks
3. Add webhook URL: `https://yourdomain.com/api/v1/webhooks/mercadopago`
4. Select event types:
   - `payment.created`
   - `payment.updated`
   - `subscription_preapproval.updated`
5. Copy the webhook secret to `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`

## Monitoring

### Logging

All webhook events are logged with:

- Event ID and type
- Request ID for tracing
- Processing status
- Error details (if any)

Example log entry:

```
[INFO] MercadoPago webhook: Payment updated
  eventId: 12345
  eventType: payment.updated
  requestId: abc-123-def
```

### Metrics

Monitor these metrics for webhook health:

- Request rate
- Success rate
- Error rate
- Processing time
- Signature verification failures

## Testing

### Development Testing

Use MercadoPago's webhook simulator in the developer dashboard to send test events.

### Manual Testing

```bash
curl -X POST https://localhost:3001/api/v1/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "User-Agent: MercadoPago/1.0" \
  -H "x-signature: ts=$(date +%s),v1=test-signature" \
  -d '{
    "id": 12345,
    "type": "payment",
    "action": "payment.updated",
    "data": {
      "id": "test-payment-123"
    }
  }'
```

Note: Manual tests will fail signature verification unless you generate a valid signature using the webhook secret.

### Integration Tests

Integration tests are located at:

```
apps/api/test/integration/webhooks/mercadopago.test.ts
```

Run tests:

```bash
pnpm test apps/api/test/integration/webhooks/mercadopago.test.ts
```

## Troubleshooting

### Webhook Not Receiving Events

1. Verify webhook URL is publicly accessible
2. Check MercadoPago dashboard webhook configuration
3. Ensure SSL certificate is valid (required for production)
4. Check firewall/security groups allow MercadoPago IPs

### Signature Verification Failures

1. Verify `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` matches dashboard
2. Check for whitespace or encoding issues in secret
3. Ensure webhook secret hasn't been rotated
4. Check system clock is synchronized (signature includes timestamp)

### Events Not Processing

1. Check billing service is configured (`getQZPayBilling()` returns instance)
2. Verify database connectivity
3. Check logs for error details
4. Ensure payment adapter is initialized correctly

### Duplicate Event Processing

QZPay handles idempotency automatically. If seeing duplicate processing:

1. Check QZPay version supports idempotency
2. Verify database stores event IDs correctly
3. Check for event ID collisions

## Related Documentation

- [QZPay Documentation](https://github.com/qazuor/qzpay)
- [MercadoPago IPN Documentation](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/ipn)
- [Billing Service Documentation](../../../packages/billing/README.md)

## Code References

- Webhook implementation: `apps/api/src/routes/webhooks/mercadopago.ts`
- Integration tests: `apps/api/test/integration/webhooks/mercadopago.test.ts`
- Billing middleware: `apps/api/src/middlewares/billing.ts`
- Payment adapter: `packages/billing/src/adapters/mercadopago.ts`
