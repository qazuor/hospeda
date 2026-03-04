# @repo/billing Documentation

## Overview

The `@repo/billing` package is the central billing configuration and types library for the Hospeda platform. It defines all plan tiers, entitlements, limits, add-ons, promo codes, and payment adapter integration with MercadoPago via the QZPay abstraction layer.

This package is **configuration-only**.. it does not contain runtime services, webhook handlers, or database access. Those responsibilities live in `apps/api` and `packages/service-core`. The billing package provides the static definitions that those layers consume.

## Architecture

```
@repo/billing
├── config/        # Plan, addon, entitlement, limit, and promo code definitions
├── types/         # TypeScript interfaces and enums (PlanDefinition, EntitlementKey, etc.)
├── constants/     # Billing constants (trial days, grace periods, timeouts, currencies)
├── adapters/      # MercadoPago adapter factory (createMercadoPagoAdapter)
├── validation/    # Config validator (validateBillingConfig, validateBillingConfigOrThrow)
└── utils/         # Config drift detection (checkConfigDrift)
```

### Relationship to QZPay

Hospeda's billing stack is built on top of **QZPay**, a payment abstraction library:

- `@qazuor/qzpay-core` .. Core billing engine (QZPayBilling class)
- `@qazuor/qzpay-mercadopago` .. MercadoPago payment adapter
- `@qazuor/qzpay-drizzle` .. Drizzle ORM storage adapter
- `@repo/billing` .. Hospeda-specific configuration layer on top of QZPay

The `@repo/billing` package provides Hospeda-specific plan definitions, entitlements, and a pre-configured MercadoPago adapter factory that connects to the QZPay engine.

### How it fits in the monorepo

| Consumer | What it uses |
|----------|-------------|
| `apps/api` | Plan definitions, entitlement checks, adapter factory, config validation |
| `apps/admin` | Plan metadata for display, entitlement keys for UI |
| `packages/service-core` | Entitlement keys for permission checks, limit enforcement |
| `packages/seed` | Plan/addon/promo definitions for database seeding |

## Guides

- [Quick Start](./quick-start.md) .. Setup, configuration, and initialization
- [Plans and Entitlements](./guides/plans-and-entitlements.md) .. Plan tiers, entitlement system, limits
- [Trial System](./guides/trial-system.md) .. Trial period behavior and lifecycle
- [Add-on Management](./guides/addon-management.md) .. One-time and recurring add-ons
- [Promo Codes](./guides/promo-codes.md) .. Discount codes and redemption rules
- [MercadoPago Integration](./guides/mercadopago-integration.md) .. Payment adapter setup and configuration

## API Reference

- [Billing Constants](./api/billing-constants.md) .. All constants, plan IDs, limit keys, entitlement keys

## Key Design Decisions

- All prices are stored in **ARS centavos** (integer). Divide by 100 for display.
- USD prices are **reference only** for informational display.
- A limit value of `-1` means **unlimited**.
- Entitlement keys are the **single source of truth** for feature access. Never check roles directly.
- Config names and descriptions are in **English**. UI localization is handled by `@repo/i18n`.

## Related Documentation

- [Billing API Endpoints](../../apps/api/docs/billing-api-endpoints.md)
- [Trial System (API)](../../apps/api/docs/trial-system.md)
- [ADR-005: MercadoPago Payments](../../docs/decisions/ADR-005-mercadopago-payments.md)
- [ADR-006: Integer Monetary Values](../../docs/decisions/ADR-006-integer-monetary-values.md)
- [ADR-009: Trial Host-Only](../../docs/decisions/ADR-009-trial-host-only.md)
