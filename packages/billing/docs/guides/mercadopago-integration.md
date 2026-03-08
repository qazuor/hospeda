# MercadoPago Integration

## Overview

Hospeda uses **MercadoPago** as its payment processor, integrated through the **QZPay** abstraction layer. The `@repo/billing` package provides a factory function that creates a pre-configured MercadoPago adapter with Hospeda-specific defaults.

### Stack

```
Hospeda API
  └── @qazuor/qzpay-core (QZPayBilling engine)
        ├── @qazuor/qzpay-mercadopago (payment adapter) <-- configured by @repo/billing
        └── @qazuor/qzpay-drizzle (storage adapter)
```

## Environment Variables

```env
# Required
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-1234567890abcdef

# Required in production (optional in sandbox)
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret

# Optional
HOSPEDA_MERCADO_PAGO_SANDBOX=true          # default: true
HOSPEDA_MERCADO_PAGO_TIMEOUT=5000          # default: 5000ms
HOSPEDA_MERCADO_PAGO_PLATFORM_ID=          # marketplace tracking
HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID=        # integrator tracking
```

### Token format

| Environment | Token Prefix | `HOSPEDA_MERCADO_PAGO_SANDBOX` |
|-------------|-------------|----------------------|
| Sandbox/test | `TEST-` | `true` (default) |
| Production | `APP_USR-` | `false` |

Note: Some test credentials from MercadoPago use the `APP_USR-` prefix even in sandbox mode. The adapter accepts both prefixes.

### Webhook secret

- **Required in production**.. without it, attackers could forge payment webhooks and manipulate subscription states
- **Optional in sandbox**.. a warning is logged if not configured, and signature verification is skipped

## Creating the Adapter

### Using environment variables (recommended)

```typescript
import { createMercadoPagoAdapter } from '@repo/billing';

// Reads all config from environment variables
const adapter = createMercadoPagoAdapter();
```

### With explicit configuration

```typescript
import { createMercadoPagoAdapter } from '@repo/billing';

const adapter = createMercadoPagoAdapter({
    accessToken: 'TEST-1234567890abcdef',
    webhookSecret: 'my-secret',
    sandbox: true,
    timeout: 10000,
    retry: {
        enabled: true,
        maxAttempts: 5,
        initialDelayMs: 2000
    }
});
```

### Connecting to QZPayBilling

```typescript
import { createMercadoPagoAdapter } from '@repo/billing';
import { QZPayBilling } from '@qazuor/qzpay-core';
import { createDrizzleAdapter } from '@qazuor/qzpay-drizzle';

const billing = new QZPayBilling({
    storage: createDrizzleAdapter({ db }),
    paymentAdapter: createMercadoPagoAdapter()
});
```

## Default Configuration

The adapter factory applies these Hospeda-specific defaults:

| Setting | Default | Source |
|---------|---------|--------|
| Currency | `ARS` | Argentina market |
| Country | `AR` | Argentina |
| Timeout | 5000ms | `MERCADO_PAGO_DEFAULT_TIMEOUT_MS` constant |
| Retry enabled | `true` | - |
| Retry max attempts | 3 | - |
| Retry initial delay | 1000ms | Exponential backoff |
| Sandbox | `true` | Safe default for development |

## Helper Functions

```typescript
import { getDefaultCurrency, getDefaultCountry } from '@repo/billing';

getDefaultCurrency(); // 'ARS'
getDefaultCountry();  // 'AR'
```

## Validation Rules

The `createMercadoPagoAdapter` function validates configuration at creation time:

1. **Access token required** .. Throws if `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` is not set
2. **Token format** .. Must start with `APP_USR-` or `TEST-`
3. **Production webhook secret** .. Throws if `sandbox=false` and no webhook secret is configured
4. **Sandbox webhook warning** .. Logs a warning if webhook secret is missing in sandbox mode

## Error Handling

```typescript
import { createMercadoPagoAdapter } from '@repo/billing';

try {
    const adapter = createMercadoPagoAdapter();
} catch (error) {
    // Possible errors:
    // - "MercadoPago access token is required..."
    // - "Invalid MercadoPago access token format..."
    // - "Webhook secret is required in production mode..."
}
```

## Related

- [ADR-005: MercadoPago Payments](../../../../docs/decisions/ADR-005-mercadopago-payments.md)
- [Billing API Endpoints](../../../../apps/api/docs/billing-api-endpoints.md)
