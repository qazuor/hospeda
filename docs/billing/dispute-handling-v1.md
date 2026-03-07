# Dispute Handling (v1)

## Overview

In v1, dispute and chargeback handling is a semi-automated process. The API webhook handler logs dispute events, sends email notifications to admins, and records the event for audit. However, actual dispute resolution must still be performed manually through the MercadoPago Dashboard.

## Webhook Events

The API processes `chargebacks` and `payment.dispute` IPN events from MercadoPago:

- Events are logged at `warn` level with metadata: disputeId, paymentId, status, amount, reason
- Events are marked as `processed` in the `billing_webhook_events` table for audit trail
- Admin email notifications are sent to addresses in `ADMIN_NOTIFICATION_EMAILS` env var (severity: critical, with idempotency)
- Logic is extracted to `dispute-logic.ts` for reuse by both webhook handlers and cron retry jobs
- Handler: `apps/api/src/routes/webhooks/mercadopago/dispute-handler.ts`
- Logic: `apps/api/src/routes/webhooks/mercadopago/dispute-logic.ts`

## Manual Resolution Process

1. **Monitor**: Check API logs for `Dispute opened` warnings or admin dashboard alerts
2. **Navigate**: Go to MercadoPago Dashboard > Actividad > Disputas (Activity > Disputes)
3. **Review**: Check dispute details.. reason, amount, payment reference
4. **Gather evidence**: Booking confirmation, guest communication, service proof
5. **Submit**: Provide evidence within MercadoPago's response deadline
6. **Track**: Follow resolution status in the dashboard

## Response Deadlines

- **Chargebacks**: Respond within 10 business days
- **Pre-chargebacks (mediations)**: Respond within 5 business days
- Evidence must be submitted via the MercadoPago panel

## Current Automation (v1)

- Email notifications to admins on dispute events (via `@repo/notifications`, `NotificationType.ADMIN_SYSTEM_EVENT`)
- Notifications include: event type, dispute ID, payment ID, status, amount, reason
- Configured via `ADMIN_NOTIFICATION_EMAILS` environment variable (comma-separated)
- Idempotent notifications (one per dispute per day)

## Future Improvements (v2)

- Automated dispute tracking in admin dashboard
- Evidence template generation
- Resolution status sync from MercadoPago API
- Customer communication workflow
- Automatic evidence submission via MercadoPago API
- See SPEC-027 for webhook subscription sync improvements

## References

- MercadoPago Dispute Documentation: <https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/disputes>
- Webhook handler: `apps/api/src/routes/webhooks/mercadopago/dispute-handler.ts`
- SPEC-021: Billing Production Fixes (this document's origin)
