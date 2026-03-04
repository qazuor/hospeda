# ADR-005: MercadoPago as Payment Processor

## Status

Accepted

## Context

The Hospeda platform operates in the Argentine tourism market and needs to process payments in Argentine Pesos (ARS). At the time of this decision:

- Few international payment processors supported ARS natively.
- Argentine consumers strongly prefer local payment methods (MercadoPago, bank transfers, cash via Rapipago/PagoFacil).
- The platform's billing model includes subscriptions for accommodation hosts, sponsored listings, and promotional add-ons.
- Payment processing must handle Argentina's complex tax and currency regulations.

## Decision

We chose **MercadoPago** as the primary payment processor, integrated through a QZPay adapter layer in the `@repo/billing` package. All monetary values default to ARS with AR (Argentina) as the country code.

## Consequences

### Positive

- **Native ARS support** .. MercadoPago processes Argentine Pesos natively without currency conversion fees or intermediaries.
- **Market dominance in Argentina** .. MercadoPago (Mercado Libre's payment arm) is the most widely used payment platform in Argentina. Users already have accounts and trust the brand.
- **Familiar checkout experience** .. Argentine consumers recognize and trust MercadoPago's payment flow, reducing checkout friction.
- **Good API** .. MercadoPago provides a comprehensive REST API with webhook support for payment notifications, subscription management, and refunds.
- **Multiple payment methods** .. Supports credit/debit cards, bank transfers, and cash payment vouchers (Rapipago, PagoFacil) through a single integration.

### Negative

- **Argentina-only** .. MercadoPago's best features are Argentina-focused. If the platform expands to other countries, a second payment processor may be needed (though MercadoPago operates across Latin America).
- **Complex webhook system** .. MercadoPago's IPN (Instant Payment Notification) system requires careful handling of retry logic, idempotency, and event ordering.
- **Limited dispute resolution tools** .. Compared to Stripe or PayPal, MercadoPago's chargeback and dispute management tools are less sophisticated.
- **Currency instability** .. ARS inflation and exchange rate volatility require careful handling of pricing, display, and billing cycles.

### Neutral

- The QZPay adapter layer abstracts MercadoPago specifics, making it possible to add additional payment processors in the future without changing business logic.
- MercadoPago's sandbox environment allows full testing without real transactions.

## Alternatives Considered

### Stripe

Stripe is the gold standard for payment processing globally. It was not chosen because:

- At the time of the decision, Stripe did not offer native ARS support for Argentine businesses.
- Argentine consumers would face currency conversion and unfamiliar checkout flows.
- Stripe's strengths (international reach, developer experience) are less relevant for a platform focused exclusively on the Argentine market.

### PayPal

PayPal was rejected due to:

- Poor support for the Argentine market. Limited payment methods and unfavorable exchange rates.
- Argentine users do not commonly use PayPal for domestic transactions.
- Higher fees for ARS transactions compared to MercadoPago.

### Direct Bank Integration

Integrating directly with Argentine banks was considered but rejected because:

- Each bank has its own API (or lacks one entirely), requiring multiple integrations.
- No unified webhook or notification system.
- Significantly more development and maintenance effort for marginal benefits.
