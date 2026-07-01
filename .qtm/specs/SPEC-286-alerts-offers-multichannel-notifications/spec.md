---
specId: SPEC-286
title: Alerts & Offers — Multichannel Notifications
type: feat
complexity: high
status: in-progress
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
not be price-based — with **per-plan limits**.

### Phasing decision (2026-06-30)

This spec builds the **complete codebase foundation** for multichannel delivery
(channel-agnostic delivery abstraction, subscription model, evaluation engine,
per-plan limits, gates, UI), but in **v1 only the email channel is shipped**.
WhatsApp and push are deliberately deferred to a **separate follow-up spec**
because they require external infrastructure (WhatsApp Business API provider,
verified number, template approval, per-message cost; web-push/FCM token
management and service worker) out of scope here.

The delivery layer is designed channel-agnostic from day one, so the follow-up
spec only adds new transports with no rework of the subscription/evaluation core.

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
- **G-3** Channel-agnostic delivery abstraction reusing `@repo/notifications`,
  with the **email transport shipped in v1**. The abstraction must accept new
  transports (WhatsApp, push) without touching the subscription/evaluation core
  — those transports are a follow-up spec, not this one.
- **G-4** Per-plan limits (how many active alerts, which channels) graduated by
  plan; mount the `PRICE_ALERTS` / `MAX_ACTIVE_ALERTS` gates.

## 4. Non-Goals

- No change to the `VIP_PROMOTIONS_ACCESS` visibility behavior in v1 (OQ-5).
- No new payment/checkout for offers — alerts are informational.
- **No WhatsApp or push delivery in v1.** Only email ships here; the other
  channels (and their external infra) are a dedicated follow-up spec. The
  per-plan channel matrix is built to scale to them but only email is wired.

## 5. Open Questions

- **OQ-1** Per-plan channel matrix shape. v1 is email-only across the entitled
  tiers; the question of WhatsApp/push availability by tier moves to the
  follow-up channels spec, but the data model for the matrix is defined here.
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
  shows *Próximamente* until this ships (email v1 lifts the badge).
- **Follow-up (future spec):** WhatsApp + push transports on top of the
  channel-agnostic delivery layer built here. Adds external infra + the per-plan
  channel availability decision (OQ-1); no change to the core built in SPEC-286.
