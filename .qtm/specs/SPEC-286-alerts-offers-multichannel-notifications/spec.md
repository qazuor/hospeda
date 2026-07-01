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

- No change to the `VIP_PROMOTIONS_ACCESS` **visibility behavior** — only its key
  is renamed to `VIP_VISIBILITY_ACCESS` (D-5); the 8 checks in
  `accommodation.service.ts` keep the exact same semantics.
- No new payment/checkout for offers — alerts are informational.
- **No WhatsApp or push delivery in v1.** Only email ships here; the other
  channels (and their external infra) are a dedicated follow-up spec. The
  per-plan channel matrix is built to scale to them but only email is wired.

## 5. Resolved decisions (2026-06-30)

All open questions were resolved with the owner before implementation:

- **D-1 (was OQ-2) — Triggers:** two triggers in v1: (a) **price drop** on a
  subscribed accommodation, past a configurable **percentage threshold**; and
  (b) **new owner promotion** on a subscribed accommodation/destination
  (consumes the SPEC-285 promo event). **No availability trigger** — Hospeda has
  no availability/calendar engine today (contact is WhatsApp-only).
- **D-2 (was OQ-3) — Per-plan active-alert limits:** tourist tiers
  **free = 0, plus = 5, vip = 20**. Free has no alerts (paid feature); enforced
  via `MAX_ACTIVE_ALERTS`.
- **D-3 (was OQ-4) — Cadence:** **daily digest**. One cron collects the day's
  matched events and sends a single email per user. No immediate/per-event send
  in v1 (better deliverability, one job, simpler dedupe/rate-limit).
- **D-4 (was OQ-1) — Channel matrix:** **email-only** in v1 across the entitled
  tiers (see Phasing decision). The per-plan channel matrix data model is built
  to scale to WhatsApp/push, but only the email transport is wired.
- **D-5 (was OQ-5) — `VIP_PROMOTIONS_ACCESS`:** **rename** the entitlement key to
  `VIP_VISIBILITY_ACCESS` (behavior unchanged). It is a visibility perk unrelated
  to alerts; the misleading name is corrected. Scope: entitlement key/enum, seed,
  the 8 checks in `accommodation.service.ts`, and any billing plan mapping. No
  change to what it does.
- **D-6 (was OQ-6) — Price-history baseline:** Hospeda has no dedicated
  per-accommodation price-history table, so the alert stores its own baseline:
  `tourist_price_alerts.base_price_snapshot` captures the accommodation's price
  at subscription time. The monitoring cron compares the current price against
  this per-alert snapshot rather than a global history table — no separate
  price-history feature is a prerequisite.

## 6. Dependencies & relationship

- **Depends on SPEC-285** (owner-promotion tourist display) for the promo-offer
  event source.
- **SPEC-282:** the "Alertas y ofertas" row (grouping price alerts + promo offers)
  shows *Próximamente* until this ships (email v1 lifts the badge).
- **Absorbs SPEC-312 (Tourist Price Alerts):** the price-alert core (table, CRUD,
  monitoring cron, web UI, `MAX_ACTIVE_ALERTS` enforcement) is built here as
  T-002..T-007. SPEC-312 is archived (obsolete) — not implemented as a separate
  spec. Limit values follow D-2 (free=0/plus=5/vip=20), reconfirmed by the owner
  on 2026-06-30 over SPEC-310's initial "vip unlimited" (SPEC-310 working-notes
  updated to match). SPEC-312 was a duplicate stub generated independently by
  the SPEC-310 roadmap audit (created 2026-06-30, same `PRICE_ALERTS`/
  `gateAlerts` phantom gate); the price-history baseline question it raised is
  D-6 above.
- **Overlaps SPEC-313 (Tourist Exclusive Deals & VIP Promotions):** owner-promotion
  offers surfaced to tourists are G-2 + T-012 here, but SPEC-313's "curated
  exclusive deals" concept (plus/vip visibility into a deals catalog) may be a
  distinct feature, not fully subsumed by this spec's alert/digest model.
  `staging` independently consolidated SPEC-313 with SPEC-316, explicitly
  blocked on this spec's OQ-5 (now resolved by D-5). Whether SPEC-313 proceeds
  standalone or is archived as absorbed here is a pending owner decision — see
  the conflict note in SPEC-313's own spec.md.
- **Reconciles SPEC-316 (VIP Promotions Access):** D-5 renames the *visibility*
  entitlement `VIP_PROMOTIONS_ACCESS` → `VIP_VISIBILITY_ACCESS` — it is a
  visibility perk today (8 checks in `accommodation.service.ts`), not a promos
  feature. If SPEC-316 later builds real VIP promotions, it MUST define a NEW
  entitlement; it may not reuse the renamed visibility key. SPEC-316 stays
  backlog / discovery-first.
- **Follow-up (future spec):** WhatsApp + push transports on top of the
  channel-agnostic delivery layer built here. Adds external infra + the per-plan
  channel availability decision (deferred from D-4); no change to the core built
  in SPEC-286.
