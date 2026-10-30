# Payment Notifications and the MercadoPago Receiver

## Overview

The MercadoPago webhook route no longer sends payment emails itself. The
HOS-1352 rebuild (see [root CLAUDE.md → Billing and verticals](../../../../CLAUDE.md#billing-and-verticals-hos-1352))
replaced the old handler, which fired `PAYMENT_SUCCESS` / `PAYMENT_FAILURE` /
`ADMIN_PAYMENT_FAILURE` notifications inline, with a receiver that stores every
delivery and then processes it through the billing services.

## Receiver flow

`POST /api/v1/webhooks/mercadopago` (`apps/api/src/routes/webhooks/mercadopago.ts`):

1. Webhooks-channel deliveries require a valid `x-signature`
   (`mercadopago-signature.ts`): 401 when invalid, 500 when
   `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is not configured. IPN-channel
   deliveries are stored without processing.
2. `receiveProviderDelivery` (`packages/service-core/src/services/billing/notice/receive-provider-delivery.service.ts`)
   inserts the raw delivery (`providerNotificationModel.insertDelivery`) before
   anything else.
3. `processProviderNotice` handles it with the ports built in
   `apps/api/src/routes/webhooks/mercadopago-ports.ts`.
4. The route answers 200 `{ received: true }` when `ack` is `OK` and 500 when
   the delivery could not be saved or re-read, so MercadoPago retries.

There is no application-level retry loop and no dunning: MercadoPago owns the
retry schedule of a failed charge, and reconciliation is done by the
`billing-reconciliation-sweep` cron (see [cron-system.md](../cron-system.md)).

## Notification types

The notification types still exist in `packages/notifications/src/types/notification.types.ts`
(`PAYMENT_SUCCESS`, `PAYMENT_FAILURE`, `ADMIN_PAYMENT_FAILURE`), with categories in
`packages/notifications/src/config/notification-categories.ts`. Nothing under
`apps/api/src` sends them today (checked by search).

Admin recipients for admin-category mail come from `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`
(comma-separated); when unset, admin notifications are skipped.

## Related files

- `apps/api/src/routes/webhooks/mercadopago.ts` - the route
- `apps/api/src/routes/webhooks/mercadopago-ports.ts` - receiver ports
- `apps/api/src/routes/webhooks/mercadopago-signature.ts` - signature check
- `apps/api/src/utils/notification-helper.ts` - fire-and-forget notification utility
