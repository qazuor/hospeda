---
specId: SPEC-321
title: AI Text-Improve in Web Owner Editor
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-321 — AI Text-Improve in Web Owner Editor

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is PARTIAL (the API route `POST /ai/text-improve` exists, works, and enforces quota; the admin app already surfaces it; but the WEB owner accommodation editor has no "improve with AI" button — only admin-side surfaces expose this capability). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Owner-basico and above (`AI_TEXT_IMPROVE` entitlement) should be able to trigger AI-assisted text improvement directly from the web owner accommodation editor (RichTextEditor component or plain text fields), so hosts can polish their descriptions without leaving the form. The API endpoint and entitlement enforcement already exist and are production-ready — this spec is almost entirely a frontend wiring task. NOTE: given the small scope (mostly a UI addition calling an existing API), this could be handled as a `[NOSPEC:<slug>]` change rather than a full spec — confirm during discovery.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `AI_TEXT_IMPROVE` is advertised as an owner feature across multiple tiers, and the backend is complete. The gap is that the web owner editor never received the corresponding UI control, leaving owners unable to access a feature they are paying for.

## Scope (to refine in discovery)

- Add an "Improve with AI" button or affordance to the relevant text fields in the web owner accommodation editor (`apps/web`), wired to the existing `POST /api/v1/protected/ai/text-improve` endpoint.
- Show the AI-improved text for the owner to accept or reject (inline diff or replace-with-preview pattern).
- Enforce the entitlement gate client-side (hide/disable the button for non-eligible owners) while the API already enforces it server-side.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Which specific fields in the owner editor should get the AI-improve button: `description`, `richDescription`, `title`, or all of the above? Limiting to one or two rich-text fields keeps the scope minimal.
- Should the web editor follow the same UX pattern already used in the admin app, or is a different interaction model (inline suggestion, side panel, etc.) more appropriate for the web owner context?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- Existing implementation reference: admin AI text-improve UI (SPEC-223, shipped 2026-06-22) — the pattern to replicate on the web side.
- SPEC-317 (owner review responses) — sibling owner-basico+ feature.
