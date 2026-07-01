---
title: Direct Booking Model for Hospeda
linear: HOS-36
statusSource: linear
created: 2026-07-01
type: feature
areas:
  - billing
  - api
  - web
---

# Direct Booking Model for Hospeda

> Migrated from `.qtm/specs/SPEC-298-direct-booking-model/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-36.
>
> Owner's question, verbatim: "Pensar un sistema de reserva directa dentro de Hospeda.
> ¿Mantenemos ambas formas? Suscripción pero contacto directo, y/o sin suscripción
> pero pago por reserva hecha desde Hospeda. ¿Qué hace el mercado?"
>
> This is a **pre-engineering discovery spec**. No architecture is decided.
> The first deliverable is a market-research report and a business-model decision
> with the owner — NOT code.

## 1. Summary

Today Hospeda operates a **pure subscription model**: hosts pay a monthly or annual
plan, upload their listing, and guests contact them directly via WhatsApp. Hospeda
is a discovery platform, not a transaction platform — money between guest and host
never touches Hospeda infrastructure.

The owner is exploring whether to add — or replace the subscription model with — an
**in-platform direct booking** flow where guests pay through Hospeda and Hospeda
retains a per-booking commission. This is a fundamental product-strategy question
that changes monetization, legal obligations, trust requirements, and the entire
technical surface. It must be answered with market research and a business decision
BEFORE any engineering begins.

## 2. Current state — what the codebase has today

### 2.1 Subscription-only billing

The full billing surface lives in:

- `packages/billing/src/config/plans.config.ts` — plan definitions (Básico, Esencial,
  Profesional, Elite, complex tiers). Every plan is time-based (monthly / annual).
- `packages/billing/src/config/entitlements.config.ts` — feature gates per plan.
  Notably contains `CAN_SHOW_WHATSAPP_NUMBER` and `CAN_CONTACT_WHATSAPP_DIRECT`:
  WhatsApp contact is the **only** guest-to-host communication channel available.
- `apps/api/src/routes/billing/` — checkout (`start-paid.ts`), plan change, cancel,
  addons, promo codes, trial, webhooks. All flows are subscription lifecycle flows.
- `packages/service-core/src/services/billing/` — subscription, addon, promo-code,
  settings services.

### 2.2 Contact flow today (no in-platform booking)

Guest-to-host contact is entirely **off-platform**:

- `apps/web/src/lib/api/transforms.ts:1999` — "Only `whatsapp` is surfaced publicly
  (for the CTA deep link)." The public contact shape is `{ whatsapp?: string | null }`.
- `apps/web/src/data/types.ts:992-996` — `AccommodationPublicContactInfo` exposes only
  the WhatsApp number. No booking form, no date picker, no payment.
- Beta docs (`apps/web/src/content/beta/host/mensajes.md`) mention an in-platform
  **contact form** (message inbox) as an MVP feature, but this is a messaging tool,
  not a booking or payment system.

### 2.3 "Booking" in the codebase today — GREENFIELD

A search across `apps/` and `packages/` for `booking`, `reserva`, `reservation`,
`availability`, `calendar`, `BOOKING_ACTOR` yields:

- `apps/api/src/routes/accommodation/protected/import-from-url.ts:321` —
  `apifyBookingActor` is an Apify web-scraping actor used to **import** listings
  FROM Booking.com. This is data-ingestion tooling, not an in-platform booking system.
- Every other `calendar` hit refers to "calendar month" in analytics/usage routes.
- Every other `availability` hit refers to provider (media/storage) availability checks.

**Conclusion: there is zero booking infrastructure in the codebase today. This is a
100% greenfield feature if pursued.**

## 3. The decision space (provisional — owner must decide)

Three mutually non-exclusive models exist. All are TBD pending the research phase.

### Model A — Subscription + direct WhatsApp (status quo)

Host pays a monthly/annual plan. Guest contacts host via WhatsApp, negotiates price
and dates off-platform, pays the host directly (cash, transfer, MP link). Hospeda
never touches the transaction.

### Model B — Commission-only (no subscription)

Host lists for free. Hospeda charges a % commission on every booking completed
through the platform. Guest pays through Hospeda, Hospeda splits to host. Host
has no recurring subscription cost but pays per transaction.

### Model C — Hybrid (subscription + optional in-platform booking)

Hosts on higher-tier plans (or all hosts) can opt into Hospeda-mediated booking.
A per-booking commission applies on top of (or reduced relative to) the subscription
fee. Lower-tier or opted-out hosts retain the WhatsApp-only model.

**No model is chosen yet.** The research phase (Section 7) surfaces the tradeoffs
the owner needs to make this call.

## 4. Goals (PROVISIONAL — all subject to revision after research)

- **G-1** [TBD] Decide on Model A / B / C (or a variant) via market research +
  owner alignment.
- **G-2** [TBD] If in-platform booking is chosen: define the reservation data model
  (availability, dates, pricing, guest identity, booking state machine).
- **G-3** [TBD] If commission applies: wire into QZPay + MercadoPago Marketplace
  (split payments) or MercadoPago Connect (money-in → split → money-out).
- **G-4** [TBD] If hybrid: decide how subscription tier gates access to in-platform
  booking vs WhatsApp-only, and update `entitlements.config.ts` + plan definitions.
- **G-5** [TBD] Define cancellation, refund, and dispute policies before any payment
  flow is built.

## 5. Non-Goals (stable regardless of model choice)

- Commerce listings (`product_domain = 'commerce'`) are out of scope — this spec
  covers accommodation bookings only.
- Migrating existing hosts to a new billing model without explicit opt-in.
- Building a full channel-manager / OTA sync (Booking.com, Airbnb, etc.) — Hospeda
  is not trying to become a PMS.
- Replacing MercadoPago with another payment processor.

## 6. Open Questions

These are the questions that drive the research phase. None are answered yet.

### Business model

- **OQ-1** — Which model (A / B / C) fits the Concepción del Uruguay / Litoral market
  best? Are hosts willing to pay a commission? Are guests willing to pay on-platform?
  What is the tolerance for friction vs trust?
- **OQ-2** — What commission % is market-competitive AND sustainable for Hospeda's
  unit economics? (Reference: Airbnb ~14-16% total split; Booking.com ~15-17% from
  host; local AR players vary widely.) At what booking volume does commission
  outperform subscription revenue?
- **OQ-3** — Do we keep subscription as the base + commission as an upsell (Model C),
  or does in-platform booking make subscription redundant (Model B)? Is there a free
  tier that only converts when a booking happens?
- **OQ-4** — Who absorbs MercadoPago's processing fee (~2-5% MP Marketplace)?
  Does it come out of the commission, or is it passed to the guest as a service fee?

### Payments and custody

- **OQ-5** — Does money flow through Hospeda (Hospeda holds funds → pays host after
  stay)? Or does MercadoPago Marketplace route funds directly from guest to host with
  Hospeda taking a marketplace fee? These have very different legal and operational
  implications in Argentina.
- **OQ-6** — What is the refund and cancellation policy engine? Who decides per-listing
  policy (host-defined vs platform-defined)? How does this interact with MercadoPago
  dispute resolution (chargeback)?
- **OQ-7** — Does QZPay (the current billing abstraction, `@qazuor/qzpay-core`) have
  a marketplace/split-payment adapter, or does this require a direct MercadoPago
  Marketplace integration outside QZPay?

### Legal and compliance

- **OQ-8** — Does holding or routing guest payments in Argentina require Hospeda to
  register as a payment processor or intermediary (BCRA, AFIP)? Does a marketplace
  exemption apply?
- **OQ-9** — Are collected commissions subject to IVA (21%)? Does Hospeda issue
  facturas to hosts for the commission deduction? (See SPEC-028 IVA spec for
  prior art on tax handling.)
- **OQ-10** — What privacy and data-retention obligations arise from storing guest
  payment data (PII, card tokens) if Hospeda mediates the transaction?

### Product and UX

- **OQ-11** — What is the availability source of truth? Does Hospeda manage a
  calendar (host sets available dates) or does it rely on host-external systems
  (Google Calendar sync, iCal export)? How do we prevent double-booking if a host
  also takes WhatsApp or walk-in reservations?
- **OQ-12** — What is the booking state machine?
  `requested → confirmed → checked_in → completed | cancelled | no_show`?
  Who can transition each state, and what notifications fire at each transition?
- **OQ-13** — Do we surface reviews/ratings (guest rates host + accommodation,
  host rates guest) as part of the trust layer for direct booking? This is a major
  scope addition.
- **OQ-14** — In a hybrid model, how does the UI distinguish "book now on Hospeda"
  vs "contact via WhatsApp"? Does the booking CTA replace or augment the current
  WhatsApp deep-link CTA?

### Integration with existing systems

- **OQ-15** — How does in-platform booking interact with the existing subscription
  entitlement engine (`loadEntitlements`, `billing_subscriptions`,
  `product_domain = 'accommodation'`)? Does a commission-based host still need a
  subscription at all, or is the subscription model retired for them?
- **OQ-16** — The existing `import-from-url` Apify scraper pulls listing data FROM
  Booking.com. If we build our own booking, does this importer create a conflict
  (hosts dual-listed, availability diverges)? What is the migration path for hosts
  who currently use it?

## 7. Market Research Checklist (Phase 0 deliverable)

Before any product decision, the owner (or a delegated researcher) must answer the
following dimensions for each competitor:

**Competitors to cover:**

1. Airbnb (global benchmark)
2. Booking.com (dominant in AR, `apifyBookingActor` already imports from here)
3. Expedia / Hotels.com
4. MercadoViajes / Despegar (AR-native OTA)
5. Hostelworld (hostel segment)
6. Local / regional AR alternatives (AlquilerArgentina, alquilando.com, etc.)
7. Direct-booking platforms with subscription models (Lodgify, Hostaway, Lodgix)

**Dimensions to capture per competitor:**

| Dimension | Question |
|-----------|----------|
| Fee model | Subscription + commission? Commission-only? Free listing? |
| Commission % | Guest-side fee? Host-side fee? Split? |
| Payment custody | Platform holds funds? Direct to host? Marketplace split? |
| Cancellation policy | Platform-defined tiers or host-defined? |
| Refund timeline | When does guest money reach host? |
| Availability calendar | Platform-managed or external sync (iCal/GCal)? |
| Double-booking prevention | Hard lock or soft warning? |
| Trust layer | Reviews after booking? ID verification? |
| Host onboarding | KYC requirements for receiving payouts? |
| AR-specific | MercadoPago? Local bank transfer? AFIP compliance? |

## 8. Risks

- **R-1 — Scope explosion.** A full booking system (calendar, payments, state machine,
  cancellation, reviews, legal compliance) is 6-12 months of engineering. Market
  research must establish whether the product ROI justifies this before a single line
  of code is written.
- **R-2 — MercadoPago Marketplace complexity.** MP Marketplace requires sellers
  (hosts) to complete KYC, accept MP's terms, and link their CBU. This is a host-
  onboarding UX problem that may have higher drop-off than expected in the Litoral
  market (many small hosts, informal accommodations).
- **R-3 — Churn from monetization model change.** Existing subscribed hosts who
  paid for a plan may react negatively to a new commission layer on top. Any hybrid
  model must grandfather or clearly communicate the change.
- **R-4 — Regulatory risk (BCRA/AFIP).** Collecting and disbursing money in Argentina
  without the correct registry or intermediary status could expose Hospeda to
  regulatory penalties. This requires legal review BEFORE shipping.
- **R-5 — Double-booking and calendar synchronization.** Without a reliable
  availability source of truth, direct booking creates the risk of confirmed
  reservations that the host cannot honor — a trust-destroying failure mode at
  small scale.
- **R-6 — QZPay adapter gap.** If QZPay does not support MP Marketplace split
  payments natively, the entire billing abstraction may need to be bypassed or
  extended for the booking payment flow — a significant architectural cost.

## 9. Relationship to existing systems

- **`packages/billing/`** — current subscription billing. A commission model runs
  parallel to or replacing this. Entitlements may need a new gate
  (`CAN_RECEIVE_DIRECT_BOOKINGS`) if the hybrid model is chosen.
- **`packages/service-core/src/services/billing/`** — subscription lifecycle
  services. A booking payment is a different financial event (not a subscription
  renewal) and would likely require a new service, not an extension of these.
- **SPEC-028 (IVA tax handling)** — prior art on Argentine tax obligations within
  Hospeda billing. Any commission revenue will intersect with IVA.
- **`apps/api/src/routes/accommodation/protected/import-from-url.ts`** — the Apify
  Booking.com importer. If hosts can be listed simultaneously on Booking.com and
  Hospeda, availability sync becomes a hard dependency (OQ-11, OQ-16).
- **SPEC-239 (commerce subscription isolation)** — sets the precedent that different
  product domains (`accommodation` vs `commerce`) use separate billing subscriptions.
  A direct booking model could live in a third domain or as a separate financial
  event type.

## 10. First Steps — Discovery Plan (NOT implementation)

**Phase 0 (research, no engineering):**

1. Owner or delegated researcher completes the market research checklist (Section 7)
   across all 7 competitors on all 10 dimensions.
2. Legal consultation (AR-based accountant / attorney) on OQ-8, OQ-9, OQ-10 (BCRA
   registration, IVA on commissions, PII retention).
3. Owner interviews 5-10 active hosts on willingness to adopt a commission model vs
   subscription preference.
4. Owner decides on Model A / B / C (or hybrid variant) — this is the **gate** before
   Phase 1 begins.

**Phase 1 (only after Phase 0 decision):**

5. Tech-analysis spec covering: booking data model, availability calendar design,
   MercadoPago Marketplace integration surface, QZPay adapter assessment (OQ-7),
   state machine, notification hooks, entitlement changes.
6. Engineering estimate and scope segmentation (MVP booking vs full-featured).

No code should be written before Step 4 is complete. Doing so risks building the
wrong model.

## 11. Revision History

- 2026-06-27 — Initial discovery draft (allocated SPEC-298). Status: draft.
  Owner question captured verbatim. Repo surveyed: booking infrastructure is 100%
  greenfield; today's contact model is WhatsApp-only (`CAN_CONTACT_WHATSAPP_DIRECT`
  entitlement + `AccommodationPublicContactInfo.whatsapp`). Sixteen open questions
  documented across business model, payments, legal, product UX, and integration
  dimensions. Market research checklist defined. First step is Phase 0 research +
  owner business-model decision — no engineering until that gate clears.
