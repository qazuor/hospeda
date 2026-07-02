---
title: WhatsApp Contact (Display + Direct)
linear: HOS-19
statusSource: linear
created: 2026-07-01
type: feature
areas:
  - web
  - admin
---

# WhatsApp Contact (Display + Direct)

> Migrated from `.qtm/specs/SPEC-311-whatsapp-contact/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-19.

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is a two-layer phantom gate (the accommodation data model has NO whatsappNumber/whatsappDirectLink fields, the gates are PHANTOM-GATE, and the public comparison table already advertises them as "available"). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Accommodations should be able to carry a WhatsApp contact number and/or a click-to-chat direct link. Tourist-plus and owner-basico+ tiers (and above) see the WhatsApp number displayed on the accommodation detail page (`CAN_CONTACT_WHATSAPP_DISPLAY`). Tourist-vip and owner-pro+ tiers (and above) get a one-click `wa.me` deep link for direct WhatsApp chat (`CAN_CONTACT_WHATSAPP_DIRECT`). This is a two-tier contactability feature that currently has zero data model support.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. The public plan comparison table already lists WhatsApp contact as "available" for paying tiers, but neither the DB schema nor any frontend surface has the fields or rendering needed to back that claim.

## Scope (to refine in discovery)

- Add `whatsapp_number` (E.164 or local AR format) and optionally `whatsapp_direct_link` fields to the accommodation DB table and Zod schema.
- Wire the existing `CAN_CONTACT_WHATSAPP_DISPLAY` (plus/owner-basico+) and `CAN_CONTACT_WHATSAPP_DIRECT` (vip/owner-pro+) entitlement keys through the gate functions in the public API response.
- Render the gated WhatsApp contact block on the web accommodation detail UI; owner editor needs input fields to set the number.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Is the WhatsApp number per-accommodation or per-owner-profile (one number reused across all listings)?
- What is the accepted format for Argentine numbers — local (`011 XXXX-XXXX`) normalized to E.164 (`+54 9 11 XXXX XXXX`), and does the app validate/normalize on save?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-317 (owner-review-responses) — same tier group (owner basico+).

## 13. Linear

Canonical tracking:
HOS-19
