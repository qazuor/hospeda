# @repo/payments

Payment processing package for Hospeda using Mercado Pago integration.

## Features

- **One-time Payments**: Process single payments for premium features
- **Subscriptions**: Handle monthly and yearly recurring payments with discounts
- **Webhook Processing**: Secure handling of Mercado Pago notifications
- **Type Safety**: Full TypeScript support with Zod validation
- **Configurable**: Flexible configuration for different environments

## Installation

```bash
pnpm add @repo/payments
```

## Usage

### Basic Setup

```typescript
import { 
  MercadoPagoClient, 
  PaymentService, 
  SubscriptionService,
  WebhookHandler,
  createMercadoPagoConfig 
} from '@repo/payments';
import { logger } from '@repo/logger';

// Configure Mercado Pago
const config = createMercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  publicKey: process.env.MERCADOPAGO_PUBLIC_KEY!,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  defaultCurrency: 'ARS',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL
});

// Initialize client
const mercadoPagoClient = new MercadoPagoClient(config, logger);

// Initialize services
const paymentService = new PaymentService(
  mercadoPagoClient,
  paymentRepository, // Your implementation
  paymentPlanRepository, // Your implementation
  logger
);

const subscriptionService = new SubscriptionService(
  mercadoPagoClient,
  subscriptionRepository, // Your implementation
  paymentPlanRepository, // Your implementation
  logger
);

const webhookHandler = new WebhookHandler(
  mercadoPagoClient,
  paymentService,
  subscriptionService,
  logger
);
```

### Creating One-time Payments

```typescript
const preference = await paymentService.createOneTimePayment({
  userId: 'user-123',
  paymentPlanId: 'premium-plan',
  type: 'one_time',
  metadata: {
    feature: 'advanced_analytics'
  }
});

// Redirect user to preference.initPoint for payment
```

### Creating Subscriptions

```typescript
const subscription = await subscriptionService.createSubscription({
  userId: 'user-123',
  paymentPlanId: 'monthly-pro',
  type: 'subscription',
  metadata: {
    plan: 'pro_monthly'
  }
});
```

### Processing Webhooks

```typescript
app.post('/webhooks/mercadopago', async (req, res) => {
  const signature = req.headers['x-signature'] as string;
  
  if (!webhookHandler.validatePayload(req.body)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  
  const result = await webhookHandler.processWebhook(req.body, signature);
  
  if (result.success) {
    res.status(200).json({ message: 'Webhook processed successfully' });
  } else {
    res.status(500).json({ error: result.errorMessage });
  }
});
```

## Environment Variables

```env
# Mercado Pago Configuration
MERCADOPAGO_ACCESS_TOKEN=your_access_token
MERCADOPAGO_PUBLIC_KEY=your_public_key
MERCADOPAGO_WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_BASE_URL=https://your-domain.com/webhooks
```

## Repository Interfaces

You need to implement the following repository interfaces:

### PaymentRepository

```typescript
interface PaymentRepository {
  create(payment: NewPaymentInputType): Promise<PaymentType>;
  update(id: PaymentId, updates: UpdatePaymentInputType): Promise<PaymentType>;
  findById(id: PaymentId): Promise<PaymentType | null>;
  findByExternalReference(reference: string): Promise<PaymentType | null>;
  findByMercadoPagoId(mercadoPagoId: string): Promise<PaymentType | null>;
}
```

### SubscriptionRepository

```typescript
interface SubscriptionRepository {
  create(subscription: NewSubscriptionInputType): Promise<SubscriptionType>;
  update(id: SubscriptionId, updates: UpdateSubscriptionInputType): Promise<SubscriptionType>;
  findById(id: SubscriptionId): Promise<SubscriptionType | null>;
  findByUserId(userId: UserId): Promise<SubscriptionType[]>;
  findActiveByUserId(userId: UserId): Promise<SubscriptionType[]>;
  findExpiring(days: number): Promise<SubscriptionType[]>;
}
```

### PaymentPlanRepository

```typescript
interface PaymentPlanRepository {
  findById(id: PaymentPlanId): Promise<PaymentPlanType | null>;
  findBySlug(slug: string): Promise<PaymentPlanType | null>;
  findActive(): Promise<PaymentPlanType[]>;
  findActiveSubscriptionPlans(): Promise<PaymentPlanType[]>;
}
```

## Security

- All webhook signatures are validated
- Sensitive configuration is excluded from logs
- External references are generated securely
- Input validation using Zod schemas

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## License

Private - Hospeda Project

