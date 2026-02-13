---
spec-id: SPEC-007
title: Exchange Rate Integration
type: feature
complexity: medium
status: draft
created: 2026-02-13T12:00:00.000Z
updated: 2026-02-13T12:00:00.000Z
depends-on: SPEC-005
---

## SPEC-007: Exchange Rate Integration

## 1. Overview

Automated exchange rate fetching and management system for converting platform prices between ARS (Argentine Pesos), BRL (Brazilian Reais), and USD (US Dollars).

SPEC-005 defines the DB schema and UI display logic for currency conversion. This spec covers the **backend integration**: API fetching, caching, auto-update, admin management, and fallback strategies.

## 2. Goals

- Automatically fetch and update exchange rates from external APIs
- Provide admin UI for manual rate overrides
- Support multiple exchange rate sources with fallback chain
- Cache rates with configurable TTL
- Handle the Argentine market specificity (multiple rate types: oficial, blue, MEP, CCL)

## 3. Exchange Rate Sources

### 3.1 Primary: DolarAPI.com (ARS-specific)

- Free, open source, no authentication required
- Provides all Argentine rate types: oficial, blue, MEP, CCL, tarjeta, cripto
- Includes BRL/ARS direct rate
- Real-time updates
- Endpoint: `https://dolarapi.com/v1/dolares/` (USD rates)
- Endpoint: `https://dolarapi.com/v1/cotizaciones/` (all currencies)

### 3.2 Secondary: ExchangeRate-API (international)

- 1,500 free requests/month
- 161 currencies, updated every 24h (free tier)
- Used for USD/BRL and other non-ARS conversions
- Endpoint: `https://v6.exchangerate-api.com/v6/{API_KEY}/latest/USD`

### 3.3 Tertiary: Manual Admin Override

- Admin can set rates manually for any currency pair
- Manual rates take priority over API rates when set
- Useful for corrections, outages, or custom business rates

## 4. Architecture

### 4.1 Fetch Strategy

```
Priority Chain:
1. Manual admin override (if set and not expired)
2. DolarAPI (for ARS-related pairs)
3. ExchangeRate-API (for international pairs)
4. Last known rate from DB (stale fallback)
```

### 4.2 Update Schedule

- **DolarAPI**: Fetch every 15 minutes (ARS rates change frequently)
- **ExchangeRate-API**: Fetch every 6 hours (conserve free tier quota)
- **Manual overrides**: No expiry unless admin sets one
- **Cron job**: Runs on API server, stores results in DB

### 4.3 DB Schema

```typescript
// exchangeRates table
{
  id: uuid,
  fromCurrency: string,     // e.g. "ARS"
  toCurrency: string,       // e.g. "USD"
  rate: decimal(20, 10),    // e.g. 0.0008900000
  inverseRate: decimal(20, 10), // e.g. 1123.5955056
  rateType: "oficial" | "blue" | "mep" | "ccl" | "tarjeta" | "standard",
  source: "dolarapi" | "exchangerate-api" | "manual",
  isManualOverride: boolean,
  expiresAt: DateTime | null, // null = no expiry (for manual)
  fetchedAt: DateTime,
  createdAt: DateTime,
  updatedAt: DateTime
}

// exchangeRateConfig table (admin settings)
{
  id: uuid,
  defaultRateType: string,           // Which ARS rate to use by default (e.g. "blue")
  dolarApiFetchIntervalMinutes: number,  // default: 15
  exchangeRateApiFetchIntervalHours: number, // default: 6
  showConversionDisclaimer: boolean,  // default: true
  disclaimerText: string,            // Customizable disclaimer
  enableAutoFetch: boolean,          // default: true
  updatedAt: DateTime
}
```

### 4.4 API Endpoints

```
GET  /api/v1/exchange-rates                    → List current rates
GET  /api/v1/exchange-rates/convert            → Convert amount (?from=ARS&to=USD&amount=5000)
POST /api/v1/admin/exchange-rates              → Set manual rate override
DELETE /api/v1/admin/exchange-rates/:id         → Remove manual override
PUT  /api/v1/admin/exchange-rates/config       → Update fetch config
POST /api/v1/admin/exchange-rates/fetch-now    → Trigger immediate fetch
GET  /api/v1/admin/exchange-rates/history      → Rate history/audit log
```

## 5. Admin UI

### 5.1 Exchange Rate Dashboard (admin panel)

- Current rates table (all pairs, source, last updated)
- Manual override form (currency pair, rate, optional expiry)
- Fetch configuration (intervals, enable/disable auto-fetch, default rate type)
- "Fetch Now" button to trigger immediate update
- Rate history chart (last 30 days)
- Alert/notification when rates haven't been updated in > configured threshold

### 5.2 Rate Type Selection (ARS-specific)

Admin can choose which ARS rate type to use for public display:

- Oficial (government rate)
- Blue (parallel market rate)
- MEP (stock market dollar)
- CCL (contado con liquidacion)
- Tarjeta (credit card rate, includes taxes)

Default: depends on current Argentine economic policy (currently oficial and blue are nearly equal post-cepo).

## 6. Error Handling

- If DolarAPI is unavailable: fall back to ExchangeRate-API
- If all APIs fail: use last known rate from DB with warning badge
- If no rates exist at all: display prices only in ARS, hide conversion
- Log all fetch failures for monitoring
- Admin notification on 3+ consecutive fetch failures

## 7. Security

- ExchangeRate-API key stored as environment variable
- Admin endpoints require SUPER_ADMIN role
- Rate limits on public conversion endpoint
- Input validation on manual rate overrides (reasonable range checks)

## 8. Out of Scope

- Cryptocurrency rates
- Historical rate graphs on public web (admin only)
- Rate alerts/notifications for users
- Multi-tenancy (multiple rate configurations)

## 9. Dependencies

- SPEC-005: Defines the UI display and user preference logic
- Database: Exchange rate tables
- Cron infrastructure: For scheduled fetching
- Admin panel: For management UI

## 10. Handoff from SPEC-005

SPEC-005 implements the public web application with currency display but intentionally leaves the following areas incomplete. SPEC-007 is responsible for completing them:

| Item | What SPEC-005 leaves | What SPEC-007 must do |
|---|---|---|
| `PriceDisplay` component | Uses hardcoded fallback rates (`{ ARS_USD: 0.00089, ARS_BRL: 0.0049 }`) | Provide a real `getExchangeRate()` service/API that `PriceDisplay` calls to get live rates |
| `preferredCurrency` user field | Added to user model (`"ARS" \| "BRL" \| "USD" \| null`) | Consume this field when converting prices; no changes needed to the field itself |
| `exchangeRates` DB table | NOT created. SPEC-005 does not touch this table | Create the full table with complete schema (rateType, inverseRate, isManualOverride, source, expiresAt, etc.) |
| Conversion disclaimer | `PriceDisplay` shows static disclaimer text | SPEC-007 may enhance with dynamic info (rate source, last updated time) |
| Price format | Prices displayed primarily in ARS with approximate conversion | SPEC-007 enables accurate real-time conversion with proper rate source attribution |
| Admin rate management | No admin UI for rates | SPEC-007 builds the full admin dashboard for rate management |

**Important:** The `PriceDisplay` component in `apps/web2/` is designed to accept exchange rates as props or from a context/service. SPEC-007 should provide a service layer that `PriceDisplay` can consume without major refactoring.

---

**Status**: Draft - awaiting review
