---
specId: SPEC-160
title: Newsletter Engagement Tracking (Open / Click)
status: draft
complexity: high
owner: qazuor
created: 2026-05-26
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — consumer of the open rate)
  - SPEC-101 (newsletter MVP — campaign + subscriber model)
tags:
  - newsletter
  - analytics
  - open-rate
  - ctr
  - tracking
  - backend
  - phase-2
---

# SPEC-160 — Newsletter Engagement Tracking (Open / Click)

> **Status**: DRAFT — extracted from the 2026-05-26 dashboard redefinition session as "heavy backend". See `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` (EDITOR card C).

## 1. Origin

The EDITOR dashboard wants an "open rate último envío" widget, but the `newsletter_campaigns` schema stores only `totalRecipients`, `totalSoftcapped`, `sentAt` — **no engagement metrics** (no opens, clicks, bounces beyond status). The open-rate widget was deferred to phase 2 pending this tracking layer.

## 2. Goal

Track per-campaign **opens** (pixel) and **clicks**, and expose **open rate / CTR** for campaigns. This is email-engagement tracking — technically distinct from web page-view tracking (SPEC-159).

## 3. Scope

### IN
- Open tracking (tracking pixel on sent emails).
- Click tracking (link wrapping / redirect) — optional V1, can phase CTR.
- Per-campaign aggregate: opens, unique opens, open rate, clicks, CTR.
- Read endpoint for "last sent campaign" metrics (the widget) + per-campaign detail.

### OUT
- Per-recipient engagement timeline.
- A/B testing metrics.

## 4. Notes / decisions to resolve in tech-analysis

- Email provider is Brevo (per SPEC-101 webhooks: bounce/complaint already arrive). Check whether Brevo webhooks can deliver open/click events directly (preferred — no pixel/redirect infra needed) vs. building our own pixel + redirect endpoints.
- Storage: extend `newsletter_campaigns` (additive, per schema-compat policy) or a new `newsletter_campaign_metrics` table.

## 5. Enables (SPEC-155 widgets, phase 2)

- EDITOR · Card C · "Open rate último envío" (and future CTR).

## 6. Dependencies

- SPEC-101 (newsletter model + Brevo webhooks).
- SPEC-155 is the CONSUMER (open-rate widget).

## 7. Next steps

Needs tech-analysis (Brevo-webhook vs own-pixel decision) + task atomization.
