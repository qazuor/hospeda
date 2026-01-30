# Changelog

All notable changes to the @repo/billing package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.0] - 2026-01-29

### Added

- Initial package creation
- Complete plan configuration system with 9 plans:
  - 3 Owner plans (Basico, Pro, Premium)
  - 3 Complex plans (Basico, Pro, Premium)
  - 3 Tourist plans (Free, Plus, VIP)
- 31 entitlement keys for feature flags
- 6 limit keys for numeric constraints
- 5 add-on definitions (2 one-time, 3 recurring)
- 3 default promo codes
- Billing constants (trial days, grace periods, currencies)
- Type-safe TypeScript interfaces for all entities
- Helper functions: `getPlanBySlug`, `getDefaultPlan`, `getAddonBySlug`
- Comprehensive test suite with 42 tests
- Usage examples demonstrating all major patterns
- Complete README with usage documentation

### Package Structure

- `src/config/` - All configuration files
  - `plans.config.ts` - 9 plan definitions with pricing, entitlements, and limits
  - `addons.config.ts` - 5 add-on definitions
  - `entitlements.config.ts` - 31 entitlement definitions
  - `limits.config.ts` - Limit metadata
  - `promo-codes.config.ts` - Default promo codes
- `src/types/` - TypeScript type definitions
  - `plan.types.ts` - Plan, limit, and category types
  - `entitlement.types.ts` - Entitlement types
  - `addon.types.ts` - Add-on types
- `src/constants/` - Billing constants
- `test/` - Test suite with 42 passing tests
- `examples/` - Usage examples for common patterns

### Pricing Structure (ARS)

**Owner Plans:**

- Basico: $15,000/month - 1 accommodation, 5 photos
- Pro: $35,000/month - 3 accommodations, 15 photos, featured listing
- Premium: $75,000/month - 10 accommodations, 30 photos, API access

**Complex Plans:**

- Basico: $50,000/month - 3 properties, 10 photos per property
- Pro: $100,000/month - 10 properties, 20 photos, consolidated analytics
- Premium: $200,000/month - Unlimited properties, 50 photos, white label

**Tourist Plans:**

- Free: $0 - 3 favorites, basic features
- Plus: $5,000/month - 20 favorites, no ads, price alerts
- VIP: $15,000/month - Unlimited favorites, concierge service

### Technical Details

- All prices stored in cents (ARS cents)
- All exports use named exports (no defaults)
- 100% type-safe (no `any` types)
- Built with tsup for ESM output
- Tested with Vitest (100% passing rate)
- Follows Hospeda coding standards

### Dependencies

- `@repo/schemas` - For future Zod schema integration
- `@repo/config` - For environment configuration
- `@repo/logger` - For logging capabilities

### Future Enhancements

- Integration with @qazuor/qzpay-* packages (when published)
- Subscription management functions
- Real-time entitlement checking
- Usage tracking helpers
- Billing event handlers
- Webhook processors
