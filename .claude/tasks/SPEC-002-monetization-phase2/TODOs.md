# TODOs: Monetization System Phase 2 - Post-Launch Enhancements

Spec: SPEC-002 | Status: in-progress | Progress: 50/55

## Setup — 8/8 ✅

- [x] T-001: Create billing_addon_purchases DB schema with Drizzle (complexity: 4) ✅
- [x] T-002: Create billing_notification_log DB schema with Drizzle (complexity: 3) ✅
- [x] T-003: Generate and apply DB migration for new billing tables (complexity: 2) ✅
- [x] T-004: Create data migration script: addon JSON to billing_addon_purchases (complexity: 5) ✅
- [x] T-005: Create @repo/notifications package scaffold (complexity: 5) ✅
- [x] T-006: Implement Resend email transport with EmailTransport interface (complexity: 4) ✅
- [x] T-007: Create cron system scaffold in apps/api (complexity: 6) ✅
- [x] T-008: Add new environment variables to .env.example and config (complexity: 3) ✅

## Core — 12/12 ✅

- [x] T-009: Refactor AddonEntitlementService to use billing_addon_purchases table (complexity: 7) ✅
- [x] T-010: Refactor AddonService to use billing_addon_purchases table (complexity: 6) ✅
- [x] T-011: Create AddonExpirationService (complexity: 6) ✅
- [x] T-012: Create UsageTrackingService (complexity: 5) ✅ (note: getCurrentUsage() has placeholders returning 0)
- [x] T-013: Create NotificationService - main orchestrator (complexity: 7) ✅
- [x] T-014: Create PreferenceService for notification opt-in/opt-out (complexity: 4) ✅
- [x] T-015: Create RetryService with Redis-backed queue (complexity: 6) ✅
- [x] T-016: Create shared email layout component with React Email (complexity: 5) ✅
- [x] T-017: Create billing email templates (complexity: 5) ✅
- [x] T-018: Create addon email templates (complexity: 4) ✅
- [x] T-019: Create trial email templates (complexity: 3) ✅
- [x] T-020: Create admin email templates (complexity: 3) ✅

## Integration — 12/12 ✅

- [x] T-021: Wire webhook handler to persist events to QZPay tables (complexity: 5) ✅
- [x] T-022: Add idempotency check to webhook handler (complexity: 3) ✅
- [x] T-023: Add webhook health monitoring endpoint (complexity: 4) ✅
- [x] T-024: Integrate notifications into webhook handler (complexity: 5) ✅
- [x] T-025: Integrate notifications into trial service (complexity: 4) ✅
- [x] T-026: Create usage tracking API endpoints (complexity: 5) ✅
- [x] T-027: Enhance limit enforcement middleware (complexity: 5) ✅ (partial: favorites real, properties/staff blocked)
- [x] T-028: Create trial-expiry cron job (complexity: 3) ✅
- [x] T-029: Create addon-expiry cron job (complexity: 4) ✅
- [x] T-030: Create notification-schedule cron job (complexity: 5) ✅
- [x] T-031: Create webhook-retry cron job (complexity: 5) ✅
- [x] T-032: Wire cron bootstrap into API server startup (complexity: 3) ✅

## UI — 10/10 ✅

- [x] T-033: Build Active Add-ons widget (web dashboard) (complexity: 5) ✅ ActiveAddons.tsx + AddonManagement.tsx complete
- [x] T-034: Build Usage Meters component with progress bars (complexity: 5) ✅ UsageMeters.tsx with 4-tier color thresholds
- [x] T-035: Build Add-on Management page (complexity: 6) ✅
- [x] T-036: Build Billing History component (complexity: 5) ✅ BillingHistory.tsx with pagination + filtering
- [x] T-037: Enhance /mi-cuenta page integrating dashboard widgets (complexity: 4) ✅ suscripcion.astro integrates all 3 widgets
- [x] T-038: Implement admin Billing Add-ons table with real data (complexity: 6) ✅
- [x] T-039: Implement admin Usage Analytics view (complexity: 6) ✅
- [x] T-040: Implement admin Notification Log viewer (complexity: 5) ✅
- [x] T-041: Implement admin Webhook Event viewer (complexity: 5) ✅
- [x] T-042: Add admin cron job management panel (complexity: 5) ✅ (note: cron.tsx is minimal at 1.3KB)

## Testing — 8/10

- [x] T-043: Unit tests: AddonExpirationService (complexity: 5) ✅
- [ ] T-044: Unit tests: UsageTrackingService (complexity: 4) ⚠️ PARTIAL — covered in integration tests only
- [x] T-045: Unit tests: NotificationService + PreferenceService (complexity: 5) ✅
- [x] T-046: Unit tests: RetryService (complexity: 4) ✅
- [x] T-047: Unit tests: Email template rendering (complexity: 4) ✅
- [x] T-048: Integration tests: Cron routes + auth middleware (complexity: 5) ✅
- [x] T-049: Integration tests: Webhook persistence + idempotency (complexity: 6) ✅
- [x] T-050: Integration tests: Usage tracking API endpoints (complexity: 5) ✅
- [x] T-051: Integration tests: Addon expiration flow e2e (complexity: 7) ✅
- [x] T-052: Integration tests: Notification delivery pipeline (complexity: 6) ✅

## Docs — 0/3

- [ ] T-053: Document cron system setup (Vercel + VPS) (complexity: 3)
- [ ] T-054: Document notification system (complexity: 3)
- [ ] T-055: Update billing API endpoints documentation (complexity: 3)
