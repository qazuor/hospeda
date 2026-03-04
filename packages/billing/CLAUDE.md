# CLAUDE.md - Billing Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Billing and monetization logic for the Hospeda platform. Integrates with MercadoPago via the QZPay adapter for ARS payments. Handles plans, subscriptions, add-ons, promo codes, sponsorships, and customer management.

## Key Files

```
src/
├── adapters/         # Payment processor adapters (MercadoPago)
├── config/           # Plan configs, add-on configs, pricing
├── services/         # Billing business logic services
├── types/            # TypeScript types and interfaces
└── webhooks/         # Webhook handlers for payment events
```

## Patterns

- All monetary values stored as integers (centavos), never float or numeric
- Default currency: ARS (Argentine Peso)
- Config names and descriptions always in English (UI localization handled by i18n)
- Plans use UUID for `id`
- Trial: 14 days, HOST role only
- AFIP invoicing deferred to v2 (manual via accountant)
- Dispute handling: manual in v1 (webhooks logged, resolved via dashboard)

## Common Gotchas

- `billing_subscription_addons` has no `livemode` or `deleted_at` columns
- `billing_plans.id` is UUID but `billing_subscriptions.plan_id` is varchar
- `billing_customers` uses `segment` column, not `category`
- `PaginationQuerySchema` uses `page`+`pageSize` (NOT `limit`) for admin routes
- Billing endpoints from qzpay-hono (`/api/v1/billing/plans`, `/addons`) DO accept `limit` natively

## Related Documentation

- [Billing Documentation](../../docs/billing/README.md)
- [ADR-005: MercadoPago Payments](../../docs/decisions/ADR-005-mercadopago-payments.md)
- [ADR-006: Integer Monetary Values](../../docs/decisions/ADR-006-integer-monetary-values.md)
- [ADR-008: AFIP Deferred to v2](../../docs/decisions/ADR-008-afip-deferred-v2.md)
- [ADR-009: Trial Host-Only](../../docs/decisions/ADR-009-trial-host-only.md)
