---
title: "Email follow-ups: cancellation and plan retirement mails, access-ending notice, staff mail details"
linear: HOS-2580
statusSource: linear
created: 2026-11-24
type: feature
areas:
  - api
  - content
---

# Email follow-ups after HOS-2565

## 1. Summary

Follow-ups to HOS-2565. Rework two live user mails with the presentation of two
never-sent templates and delete those templates. Wire the "access ending" notice.
Give two staff mails the detail they lack. Remove leftover tuteo from the templates.

## 2. Verified facts (step A)

Only wording these facts confirm goes into the mails.

### A1. What happens when a scheduled cancellation reaches its end

There is **no "go back to a free plan"**.

- A cancellation the person asks for (S11) moves the row to `CANCEL_SCHEDULED`
  with `service_ends_at` set
  (`packages/service-core/src/services/billing/subscription/cancel-active-subscription.service.ts:158-159`).
- When `service_ends_at` arrives, S12 (cron `subscription-service-end`) moves it to
  `CANCELLED` and records the coverage loss (`service-end-s12.ts:1-17`,
  `coverage/coverage-loss.ts`).
- The account keeps only the `BASE` source, which points to the vertical's
  non-sellable `floor` plan (`packages/verticals/src/coverage/trial-and-base-sources.ts:98-107`,
  `packages/schemas/src/catalog/plan-role.ts:12-14`). `BASE` is not a title, so the
  account is **not covered** (`trial-and-base-sources.ts:108-110`).
- Without coverage, every `PUBLISHED` listing becomes `UNPUBLISHED_BY_BILLING` and the
  inactivity clock starts (`packages/verticals/src/publication/coverage-recalculation.ts:81-104`).
  The retention clock can later archive the listing (`retention-clock.ts`).
- New coverage restores them (PB3, same file, `restored`), within the plan's limit.

Wording used: "your listings stop being published" for listing verticals
(accommodation, venue, experience); "you stop having what your plan includes" for
the other verticals. "Free plan" is never used.

### A2. Can a scheduled cancellation be undone?

**No.**

- `PROH:B:1` forbids `CANCEL_SCHEDULED → ACTIVE`
  (`subscription/subscription-prohibited-transitions.ts:23-27`).
- No route or service reactivates it. `reactivate-suspended.service.ts` acts on
  `SUSPENDED` only.
- S11 cancels the preapproval at Mercado Pago, so there is no authorization left to resume.
- The real path is a **new subscription**: S1 admits a `CANCEL_SCHEDULED` row as a
  succession predecessor (`subscription/admit-succession-predecessor.ts:14`,
  `:148-149`).

Wording used: "if you want to keep going, you can sign up for a plan again from Mi
Suscripción". "Reactivate" is never used.

## 3. Scope and acceptance criteria

- **B. Scheduled cancellation**
  - `billing.scheduled-cancellation` gets a heading, the plan name, an info Callout
    (Plan, Servicio hasta, Estado), what happens after (A1), a Button to Mi Suscripción
    and the Mercado Pago notice. It falls back when `serviceEndsAt` is null.
  - The producer adds `planName` and `vertical`, both optional so queued rows still render.
  - `SUBSCRIPTION_CANCEL_CONFIRMED` is deleted everywhere.
- **C. Access ending**
  - `billing.access-ending` is enqueued once per `CANCEL_SCHEDULED` principal, at the
    largest PLAZO:13 offset (5 days by default) before `service_ends_at`. It is skipped
    for active renewing rows, rows already notified and rows already ended.
  - It runs inside the existing `subscription-renewal-notice` cron. No new job.
  - `SUBSCRIPTION_ACCESS_ENDING_SOON` is deleted, since the outbox mail replaces it.
- **D. Plan migration announced**
  - It gets a warmer intro, an info Callout (Plan actual, Plan nuevo, Precio actual,
    Precio nuevo, Fecha del cambio, each only when present) and "Si tenés dudas,
    escribinos" linked to the contact page.
  - The facts are unchanged for RETIREMENT and PRICE_INCREASE in all variants.
  - `PLAN_BEING_RETIRED` is deleted everywhere.
- **E.** `billing.manual-installment-unpaid` names the partner and links it in admin. The
  "Id de la cuota" row stays.
- **F.** The provider-watch staff mail shows its `details` lines in Spanish through a
  keyed map. Unknown lines fall back to the raw text.
- **G.** `purchase-confirmation` and any other template with tuteo use voseo.
- **H. Previewer search by subject** (added by the owner, 2026-11-24). The admin email
  previewer search also matches the subject of every scenario, case- and
  accent-insensitively like the name. The list endpoint returns
  `scenarios[].subject` (`@repo/schemas`, nullable when a sample fails), computed once
  per API process through the production subject code without rendering any HTML body.
  The client renders nothing.
- **I. Accountless footer link label** (added by the owner, 2026-11-24). When
  `showAccountLinks` is false, the first help link of the user footer points at
  `EMAIL_PUBLIC_FAQ_URL` and now reads "Preguntas frecuentes". Account holders keep
  "Centro de ayuda". This amends HOS-2565 §8.3, whose text says "Centro de ayuda" for both.
