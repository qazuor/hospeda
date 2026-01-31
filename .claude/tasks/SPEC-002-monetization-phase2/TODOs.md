# TODOs: Monetization System Phase 2 - Post-Launch Enhancements

Spec: SPEC-002 | Status: in-progress | Progress: 0/55

## Setup

- [ ] T-001: Create billing_addon_purchases DB schema with Drizzle (complexity: 4)
- [ ] T-002: Create billing_notification_log DB schema with Drizzle (complexity: 3)
- [ ] T-003: Generate and apply DB migration for new billing tables (complexity: 2) [blocked by T-001, T-002]
- [ ] T-004: Create data migration script: addon JSON to billing_addon_purchases (complexity: 5) [blocked by T-001, T-003]
- [ ] T-005: Create @repo/notifications package scaffold (complexity: 5)
- [ ] T-006: Implement Resend email transport with EmailTransport interface (complexity: 4) [blocked by T-005]
- [ ] T-007: Create cron system scaffold in apps/api (complexity: 6)
- [ ] T-008: Add new environment variables to .env.example and config (complexity: 3)

## Core

- [ ] T-009: Refactor AddonEntitlementService to use billing_addon_purchases table (complexity: 7) [blocked by T-001, T-004]
- [ ] T-010: Refactor AddonService to use billing_addon_purchases table (complexity: 6) [blocked by T-001, T-004]
- [ ] T-011: Create AddonExpirationService (complexity: 6) [blocked by T-009, T-010]
- [ ] T-012: Create UsageTrackingService (complexity: 5)
- [ ] T-013: Create NotificationService - main orchestrator (complexity: 7) [blocked by T-002, T-005, T-006]
- [ ] T-014: Create PreferenceService for notification opt-in/opt-out (complexity: 4) [blocked by T-005]
- [ ] T-015: Create RetryService with Redis-backed queue (complexity: 6) [blocked by T-005]
- [ ] T-016: Create shared email layout component with React Email (complexity: 5) [blocked by T-005]
- [ ] T-017: Create billing email templates (complexity: 5) [blocked by T-016]
- [ ] T-018: Create addon email templates (complexity: 4) [blocked by T-016]
- [ ] T-019: Create trial email templates (complexity: 3) [blocked by T-016]
- [ ] T-020: Create admin email templates (complexity: 3) [blocked by T-016]

## Integration

- [ ] T-021: Wire webhook handler to persist events to QZPay tables (complexity: 5)
- [ ] T-022: Add idempotency check to webhook handler (complexity: 3) [blocked by T-021]
- [ ] T-023: Add webhook health monitoring endpoint (complexity: 4) [blocked by T-021]
- [ ] T-024: Integrate notifications into webhook handler (complexity: 5) [blocked by T-013, T-017, T-020]
- [ ] T-025: Integrate notifications into trial service (complexity: 4) [blocked by T-013, T-019]
- [ ] T-026: Create usage tracking API endpoints (complexity: 5) [blocked by T-012]
- [ ] T-027: Enhance limit enforcement middleware (complexity: 5) [blocked by T-012]
- [ ] T-028: Create trial-expiry cron job (complexity: 3) [blocked by T-007]
- [ ] T-029: Create addon-expiry cron job (complexity: 4) [blocked by T-007, T-011]
- [ ] T-030: Create notification-schedule cron job (complexity: 5) [blocked by T-007, T-013, T-018, T-025]
- [ ] T-031: Create webhook-retry cron job (complexity: 5) [blocked by T-007, T-021]
- [ ] T-032: Wire cron bootstrap into API server startup (complexity: 3) [blocked by T-028, T-029, T-030, T-031]

## UI

- [ ] T-033: Build Active Add-ons widget (web dashboard) (complexity: 5) [blocked by T-010]
- [ ] T-034: Build Usage Meters component with progress bars (complexity: 5) [blocked by T-026]
- [ ] T-035: Build Add-on Management page (complexity: 6) [blocked by T-010, T-033]
- [ ] T-036: Build Billing History component (complexity: 5)
- [ ] T-037: Enhance /mi-cuenta page integrating dashboard widgets (complexity: 4) [blocked by T-033, T-034, T-036]
- [ ] T-038: Implement admin Billing Add-ons table with real data (complexity: 6) [blocked by T-010]
- [ ] T-039: Implement admin Usage Analytics view (complexity: 6) [blocked by T-026]
- [ ] T-040: Implement admin Notification Log viewer (complexity: 5) [blocked by T-002, T-013]
- [ ] T-041: Implement admin Webhook Event viewer (complexity: 5) [blocked by T-021, T-023]
- [ ] T-042: Add admin cron job management panel (complexity: 5) [blocked by T-007, T-032]

## Testing

- [ ] T-043: Unit tests: AddonExpirationService (complexity: 5) [blocked by T-009, T-011]
- [ ] T-044: Unit tests: UsageTrackingService (complexity: 4) [blocked by T-012]
- [ ] T-045: Unit tests: NotificationService + PreferenceService (complexity: 5) [blocked by T-013, T-014]
- [ ] T-046: Unit tests: RetryService (complexity: 4) [blocked by T-015]
- [ ] T-047: Unit tests: Email template rendering (complexity: 4) [blocked by T-017, T-018, T-019, T-020]
- [ ] T-048: Integration tests: Cron routes + auth middleware (complexity: 5) [blocked by T-028, T-029, T-030, T-031, T-032]
- [ ] T-049: Integration tests: Webhook persistence + idempotency (complexity: 6) [blocked by T-021, T-022]
- [ ] T-050: Integration tests: Usage tracking API endpoints (complexity: 5) [blocked by T-026, T-027]
- [ ] T-051: Integration tests: Addon expiration flow e2e (complexity: 7) [blocked by T-024, T-029]
- [ ] T-052: Integration tests: Notification delivery pipeline (complexity: 6) [blocked by T-013, T-015]

## Docs

- [ ] T-053: Document cron system setup (Vercel + VPS) (complexity: 3) [blocked by T-032]
- [ ] T-054: Document notification system (complexity: 3) [blocked by T-013, T-017]
- [ ] T-055: Update billing API endpoints documentation (complexity: 3) [blocked by T-026, T-023]
