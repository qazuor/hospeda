---
specId: SPEC-286
title: Alerts & Offers — Multichannel Notifications
type: feat
complexity: high
status: draft
created: 2026-06-26
parentSpec: SPEC-285
tags: [tourist, alerts, notifications, promotions, entitlements, multichannel]
---

# SPEC-286 — Alerts & Offers — Multichannel Notifications

> Unifies two phantom/empty concepts into one real feature. Surfaced during the
> SPEC-282 review (replaces the mislabeled "Promo VIP" row).

## 1. Summary

Two things the comparison table previously listed separately are merged here into a
single **alerts & offers** feature:

- **Price alerts** — entitlement `PRICE_ALERTS` + limit `MAX_ACTIVE_ALERTS` exist,
  but the feature is a **phantom gate** (`gateAlerts()` → `route not built yet`).
  No model, no route, no UI.
- **"Promo VIP"** — the `VIP_PROMOTIONS_ACCESS` entitlement does NOT do what the
  name suggests. It is currently a **visibility modifier** (VIP tourists see
  RESTRICTED / plan-restricted / suspended accommodations). It is NOT a deals or
  alerts feature and has no UI of its own.

The owner decided to repurpose this into a real feature: a tourist receives
**alerts and offers** — price drops **and** owner promotions (SPEC-285), which may
not be price-based — delivered over **multiple channels** (email, WhatsApp, push
notifications), with **per-plan limits**.

## 2. Context

- **Verified 2026-06-26:** price alerts = phantom; `VIP_PROMOTIONS_ACCESS` = a
  working accommodation-visibility perk (8 checks in `accommodation.service.ts`),
  unrelated to the owner-promotions model.
- The existing visibility behavior of `VIP_PROMOTIONS_ACCESS` is a separate concern
  and stays as-is unless OQ-5 decides to refactor it.

## 3. Goals

- **G-1** Build a price-alert subscription model (per accommodation / search) +
  evaluation (cron or event) + delivery.
- **G-2** Subscribe tourists to **owner-promotion offers** (consumes the SPEC-285
  promo-created event).
- **G-3** Multichannel delivery: email, WhatsApp, push — reusing
  `@repo/notifications` where possible.
- **G-4** Per-plan limits (how many active alerts, which channels) graduated by
  plan; mount the `PRICE_ALERTS` / `MAX_ACTIVE_ALERTS` gates.

## 4. Non-Goals

- No change to the `VIP_PROMOTIONS_ACCESS` visibility behavior in v1 (OQ-5).
- No new payment/checkout for offers — alerts are informational.

## 5. Open Questions

- **OQ-1** Channel availability by plan (e.g. email all paid tiers, WhatsApp/push
  higher tiers only?).
- **OQ-2** Alert triggers: price drop threshold, availability, new promo on a saved
  listing/destination.
- **OQ-3** Per-plan limit values (active alerts, channels) — confirm at
  implementation.
- **OQ-4** Delivery cadence + digest vs immediate.
- **OQ-5** Do we keep `VIP_PROMOTIONS_ACCESS` as a visibility perk, fold it in, or
  rename it?

## 6. Dependencies & relationship

- **Depends on SPEC-285** (owner-promotion tourist display) for the promo-offer
  event source.
- **SPEC-282:** the "Alertas y ofertas" row (grouping price alerts + promo offers)
  shows *Próximamente* until this ships.
