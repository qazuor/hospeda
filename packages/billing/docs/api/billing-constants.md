# Billing Constants Reference

## Timing Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `OWNER_TRIAL_DAYS` | `14` | Trial period in days for owner plans |
| `COMPLEX_TRIAL_DAYS` | `14` | Trial period in days for complex plans |
| `PAYMENT_GRACE_PERIOD_DAYS` | `3` | Days after payment failure before dunning starts |
| `DUNNING_GRACE_PERIOD_DAYS` | `7` | Days of dunning process before subscription cancellation |
| `DUNNING_RETRY_INTERVALS` | `[1, 3, 5, 7]` | Days after failure when retry attempts occur |
| `MAX_PAYMENT_RETRY_ATTEMPTS` | `3` | Max retry attempts for initial payment flow |

## Cache Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `ENTITLEMENT_CACHE_TTL_MS` | `300000` (5 min) | TTL for entitlement cache |
| `PLAN_CACHE_TTL_MS` | `1800000` (30 min) | TTL for plan data cache |

## Currency Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_CURRENCY` | `'ARS'` | Default currency for billing operations |
| `REFERENCE_CURRENCY` | `'USD'` | Reference currency for display |
| `MERCADO_PAGO_DEFAULT_TIMEOUT_MS` | `5000` | Default timeout for MercadoPago API |

## Plan Slugs

### Owner Plans

| Slug | Export Name | Default |
|------|-----------|---------|
| `owner-basico` | `OWNER_BASICO_PLAN` | Yes |
| `owner-pro` | `OWNER_PRO_PLAN` | No |
| `owner-premium` | `OWNER_PREMIUM_PLAN` | No |

### Complex Plans

| Slug | Export Name | Default |
|------|-----------|---------|
| `complex-basico` | `COMPLEX_BASICO_PLAN` | Yes |
| `complex-pro` | `COMPLEX_PRO_PLAN` | No |
| `complex-premium` | `COMPLEX_PREMIUM_PLAN` | No |

### Tourist Plans

| Slug | Export Name | Default |
|------|-----------|---------|
| `tourist-free` | `TOURIST_FREE_PLAN` | Yes |
| `tourist-plus` | `TOURIST_PLUS_PLAN` | No |
| `tourist-vip` | `TOURIST_VIP_PLAN` | No |

## EntitlementKey Enum

All 40 entitlement keys organized by category.

### Owner Entitlements

| Key | Value |
|-----|-------|
| `PUBLISH_ACCOMMODATIONS` | `'publish_accommodations'` |
| `EDIT_ACCOMMODATION_INFO` | `'edit_accommodation_info'` |
| `VIEW_BASIC_STATS` | `'view_basic_stats'` |
| `VIEW_ADVANCED_STATS` | `'view_advanced_stats'` |
| `RESPOND_REVIEWS` | `'respond_reviews'` |
| `PRIORITY_SUPPORT` | `'priority_support'` |
| `FEATURED_LISTING` | `'featured_listing'` |
| `CUSTOM_BRANDING` | `'custom_branding'` |
| `API_ACCESS` | `'api_access'` |
| `DEDICATED_MANAGER` | `'dedicated_manager'` |
| `CREATE_PROMOTIONS` | `'create_promotions'` |
| `SOCIAL_MEDIA_INTEGRATION` | `'social_media_integration'` |

### Accommodation Feature Entitlements

| Key | Value |
|-----|-------|
| `CAN_USE_RICH_DESCRIPTION` | `'can_use_rich_description'` |
| `CAN_EMBED_VIDEO` | `'can_embed_video'` |
| `CAN_USE_CALENDAR` | `'can_use_calendar'` |
| `CAN_SYNC_EXTERNAL_CALENDAR` | `'can_sync_external_calendar'` |
| `CAN_CONTACT_WHATSAPP_DISPLAY` | `'can_contact_whatsapp_display'` |
| `CAN_CONTACT_WHATSAPP_DIRECT` | `'can_contact_whatsapp_direct'` |
| `HAS_VERIFICATION_BADGE` | `'has_verification_badge'` |

### Complex Entitlements

| Key | Value |
|-----|-------|
| `MULTI_PROPERTY_MANAGEMENT` | `'multi_property_management'` |
| `CONSOLIDATED_ANALYTICS` | `'consolidated_analytics'` |
| `CENTRALIZED_BOOKING` | `'centralized_booking'` |
| `STAFF_MANAGEMENT` | `'staff_management'` |
| `WHITE_LABEL` | `'white_label'` |
| `MULTI_CHANNEL_INTEGRATION` | `'multi_channel_integration'` |

### Tourist Entitlements

| Key | Value |
|-----|-------|
| `SAVE_FAVORITES` | `'save_favorites'` |
| `WRITE_REVIEWS` | `'write_reviews'` |
| `READ_REVIEWS` | `'read_reviews'` |
| `AD_FREE` | `'ad_free'` |
| `PRICE_ALERTS` | `'price_alerts'` |
| `EARLY_ACCESS_EVENTS` | `'early_access_events'` |
| `EXCLUSIVE_DEALS` | `'exclusive_deals'` |
| `VIP_SUPPORT` | `'vip_support'` |
| `CONCIERGE_SERVICE` | `'concierge_service'` |
| `AIRPORT_TRANSFERS` | `'airport_transfers'` |
| `VIP_PROMOTIONS_ACCESS` | `'vip_promotions_access'` |
| `CAN_COMPARE_ACCOMMODATIONS` | `'can_compare_accommodations'` |
| `CAN_ATTACH_REVIEW_PHOTOS` | `'can_attach_review_photos'` |
| `CAN_VIEW_SEARCH_HISTORY` | `'can_view_search_history'` |
| `CAN_VIEW_RECOMMENDATIONS` | `'can_view_recommendations'` |

## LimitKey Enum

| Key | Value | Used By |
|-----|-------|---------|
| `MAX_ACCOMMODATIONS` | `'max_accommodations'` | Owner |
| `MAX_PHOTOS_PER_ACCOMMODATION` | `'max_photos_per_accommodation'` | Owner, Complex |
| `MAX_ACTIVE_PROMOTIONS` | `'max_active_promotions'` | Owner, Complex |
| `MAX_FAVORITES` | `'max_favorites'` | Tourist |
| `MAX_PROPERTIES` | `'max_properties'` | Complex |
| `MAX_STAFF_ACCOUNTS` | `'max_staff_accounts'` | Complex |

A limit value of `-1` means unlimited.

## Add-on Slugs

| Slug | Export Name | Type |
|------|-----------|------|
| `visibility-boost-7d` | `VISIBILITY_BOOST_ADDON` | One-time |
| `visibility-boost-30d` | `VISIBILITY_BOOST_30D_ADDON` | One-time |
| `extra-photos-20` | `EXTRA_PHOTOS_ADDON` | Recurring |
| `extra-accommodations-5` | `EXTRA_ACCOMMODATIONS_ADDON` | Recurring |
| `extra-properties-5` | `EXTRA_PROPERTIES_ADDON` | Recurring |

## Collection Exports

| Export | Type | Description |
|--------|------|-------------|
| `ALL_PLANS` | `PlanDefinition[]` | All 9 plans |
| `PLANS_BY_CATEGORY` | `Record<PlanCategory, PlanDefinition[]>` | Plans grouped by category |
| `ALL_ADDONS` | `AddonDefinition[]` | All 5 add-ons |
| `ENTITLEMENT_DEFINITIONS` | `EntitlementDefinition[]` | All entitlement metadata |
| `LIMIT_METADATA` | `Record<LimitKey, {...}>` | Limit names and descriptions |
| `DEFAULT_PROMO_CODES` | `PromoCodeDefinition[]` | All 3 default promo codes |

## Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `getPlanBySlug` | `(slug: string) => PlanDefinition \| undefined` | Find plan by slug |
| `getDefaultPlan` | `(category: PlanCategory) => PlanDefinition` | Get default plan (throws if none) |
| `getAddonBySlug` | `(slug: string) => AddonDefinition \| undefined` | Find add-on by slug |
| `createMercadoPagoAdapter` | `(config?: MercadoPagoAdapterConfig) => QZPayMercadoPagoAdapter` | Create payment adapter |
| `getDefaultCurrency` | `() => string` | Returns `'ARS'` |
| `getDefaultCountry` | `() => string` | Returns `'AR'` |
| `validateBillingConfig` | `() => BillingConfigValidationResult` | Validate all config |
| `validateBillingConfigOrThrow` | `() => void` | Validate or throw |
| `checkConfigDrift` | `(params) => DriftCheckResult` | Check config vs DB drift |
| `formatDriftReport` | `(params) => string` | Format drift result as text |
