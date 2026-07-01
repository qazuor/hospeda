---
specId: SPEC-321
title: AI Text-Improve in Web Owner Editor
type: feature
complexity: low
status: in-progress
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-321 — AI Text-Improve in Web Owner Editor

Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is PARTIAL: the API route `POST /api/v1/protected/ai/text-improve` exists, works, and enforces quota; the admin app already surfaces it (SPEC-198, not SPEC-223 — see Divergence Report); but the WEB owner accommodation editor has no "improve with AI" button.

Reviewed via `/task-master:spec-review` on 2026-07-01 (see Revision History). Confirmed as a **formal spec** (small scope, but tracked with tasks for traceability with the rest of the SPEC-310 roadmap).

## Overview

Owner-basico and above (`AI_TEXT_IMPROVE` entitlement) can trigger AI-assisted text improvement directly from the web owner accommodation editor, for the `description` and `summary` fields, so hosts can polish their listing copy without leaving the form. The API endpoint and entitlement enforcement already exist and are production-ready — this spec is a frontend wiring task that ports the existing admin (SPEC-198) button+panel pattern to `apps/web`, reusing web's existing entitlement-gating primitives.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `AI_TEXT_IMPROVE` is advertised as an owner feature across multiple tiers, and the backend is complete. The gap is that the web owner editor never received the corresponding UI control, leaving owners unable to access a feature they are paying for.

## Scope

- Add an "Improve with AI" button to the `description` and `summary` fields in `apps/web/src/components/host/editor/BasicInfoSection.client.tsx` (the owner accommodation editor's basic-info section), calling the existing `POST /api/v1/protected/ai/text-improve` endpoint.
- On click: open a panel below the field showing a streaming preview of the improved text (SSE, token-by-token), then **Accept** (replace the field's current value with the suggestion) or **Discard** (close the panel, keep the original value) — no inline diff, matching the admin pattern exactly (see Pattern Reference below).
- Gate the button client-side with the existing `PlanEntitlementGate` component / `useMyEntitlements()` hook (entitlement key `ai_text_improve`), so non-eligible owners don't see it. The API enforces the same gate server-side regardless.
- New web-native hook `apps/web/src/hooks/useAiTextImprove.ts` — a from-scratch port of the SSE-consuming logic in `apps/admin/src/features/accommodations/hooks/useAiTextImprove.ts`, adapted to web conventions (native `fetch`, no TanStack Query, no admin-only UI deps).
- New component `apps/web/src/components/host/editor/AiTextImprovePanel.client.tsx` — web-native port of `apps/admin/.../AiTextImprovePanel.tsx`, styled with a CSS Module per web's styling convention (not Tailwind, not admin's Shadcn `Button`).

## Out of scope (initial)

- `name`/`title` field: **not supported by the backend.** The API's `fieldType` accepts only `description | summary | faq_answer` (`packages/schemas/src/entities/ai/ai-text-improve.schema.ts`). Extending the backend to support title text-improve is a separate, future spec if ever needed — not bundled here.
- Any change to the API route, quota/entitlement middleware, or the `AI_TEXT_IMPROVE` plan grants — all already correct and out of scope.
- Pricing/limit calibration — lives in SPEC-310.
- The RichTextEditor (TipTap) internal formatting/markup is not touched by the improved text — see Edge Cases below for how the suggestion is written back to a TipTap-backed `description`.

## Pattern reference (admin, SPEC-198)

The exact interaction to replicate, from `apps/admin/src/features/accommodations/components/AiTextImprovePanel.tsx` and `useAiTextImprove.ts`:

1. A button (sparkle icon) sits near the field, disabled when the user lacks the entitlement or a request is already in flight.
2. Click → panel opens below the field → loading skeleton while the SSE connection opens.
3. Tokens stream in and are appended live to the panel's preview text as they arrive (`token` SSE event → append `delta`).
4. On the `done` event: panel shows the full suggestion with two actions, **Accept** (writes the suggestion into the field's value, closes panel) and **Discard** (closes panel, original value untouched).
5. On the `error` event or a fetch/network failure: panel shows the error message with a **Dismiss** action.

No diff view, no partial-accept — full plain replace. This spec does not introduce a new interaction model.

## API contract (existing, unchanged)

`POST /api/v1/protected/ai/text-improve`

Request (`AiTextImproveRequestSchema`, strict):

```ts
{
  fieldValue: string;   // 1-5000 chars for description, 1-300 for summary (field-specific caps enforced server-side)
  fieldType: 'description' | 'summary' | 'faq_answer';
  locale?: 'es' | 'en' | 'pt';
}
```

Response: `text/event-stream` (SSE), not a single JSON payload. Events:

- `token`: `{ delta: string }` — append to the running suggestion.
- `done`: stream complete.
- `error`: `{ code: string; message: string }`.

Error status codes (before the stream opens): `403 ENTITLEMENT_REQUIRED` (missing `AI_TEXT_IMPROVE`), `403 LIMIT_REACHED` (monthly quota exhausted — `LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH`, per-plan values: owner-basico 20/mo, owner-pro 100/mo, owner-premium 1000/mo, complex tiers 30/100/2000 respectively).

## Files touched

**New:**

- `apps/web/src/hooks/useAiTextImprove.ts`
- `apps/web/src/components/host/editor/AiTextImprovePanel.client.tsx` (+ colocated `.module.css`)

**Modified:**

- `apps/web/src/components/host/editor/BasicInfoSection.client.tsx` — mount the button + panel for `description` and `summary`, gated via `PlanEntitlementGate` (entitlement key `ai_text_improve`).

**Reference only (not modified):**

- `apps/admin/src/features/accommodations/hooks/useAiTextImprove.ts` (SSE parsing logic to port)
- `apps/admin/src/features/accommodations/components/AiTextImprovePanel.tsx` (interaction pattern to port)
- `apps/web/src/components/host/editor/PlanEntitlementGate.client.tsx` (existing gate, reused as-is)
- `apps/web/src/hooks/useMyEntitlements.ts` (existing hook, reused as-is)

## Edge cases

- **`description` rendered as TipTap (`can_use_rich_description` entitled owners)**: the AI-improved text comes back as plain/markdown text from the API. On Accept, the suggestion must be written into `RichTextEditor.client.tsx`'s TipTap instance via its markdown-set API (it already persists as Markdown — confirm the exact setter during implementation; if TipTap's `setContent`/`insertContent` mishandles raw markdown, parse it through the same markdown pipeline `RichTextEditor` uses on initial load).
- **`description` rendered as plain textarea (non-`can_use_rich_description` owners)**: direct string replace, no special handling.
- **Two independent entitlements interact on the same field**: `can_use_rich_description` (controls textarea vs TipTap) and `ai_text_improve` (controls the improve button) are unrelated — all four combinations (plain+no-AI, plain+AI, rich+no-AI, rich+AI) must render correctly.
- **User navigates away / unmounts while streaming**: abort the in-flight fetch (`AbortController`) to avoid a state update on an unmounted component.
- **Quota exhausted mid-session**: the button stays visible (entitlement check is boolean, not quota-aware client-side); the panel surfaces the `403 LIMIT_REACHED` error via the `error` state, same as admin.
- **Field value empty**: the button is disabled (nothing to improve) — mirrors admin's own guard (min 1 char required by `AiTextImproveRequestSchema`).

## Acceptance criteria

1. An owner-basico+ or complex-basico+ user with `ai_text_improve` entitlement sees an "Improve with AI" button under both the `description` and `summary` fields in the web accommodation editor.
2. A user without the entitlement does not see the button on either field (client-side gate via `PlanEntitlementGate`), even though the API would still enforce it server-side if called directly.
3. Clicking the button streams the improved text token-by-token into a panel below the field, matching the admin visual/interaction pattern (loading → streaming → done with Accept/Discard).
4. Clicking Accept replaces the field's current value with the full suggestion and closes the panel — verified for both the plain-textarea and TipTap-rendered `description` states.
5. Clicking Discard closes the panel and leaves the field's original value untouched.
6. A `403 LIMIT_REACHED` or `403 ENTITLEMENT_REQUIRED` response (or any network error) surfaces a dismissible error state in the panel instead of a silent failure or unhandled exception.
7. Unmounting the component (e.g. navigating away) mid-stream does not throw or update state after unmount.

## Testing strategy

- **Unit — `useAiTextImprove.ts`** (`apps/web/test/hooks/use-ai-text-improve.test.ts`): state machine transitions (`idle→loading→streaming→done`, `→error`), SSE `token` event accumulation, `AbortController` cleanup on unmount, request payload shape per `fieldType`.
- **Component — `AiTextImprovePanel.client.tsx`** (`apps/web/test/components/host/editor/AiTextImprovePanel.rtl.test.tsx`): renders loading/streaming/done/error states correctly; Accept calls the provided `onAccept` callback with the full suggestion text; Discard calls `onDiscard`/closes without mutating anything.
- **Integration — `BasicInfoSection.client.tsx`**: button hidden when `useMyEntitlements().has('ai_text_improve')` is false; button present and wired for both `description` and `summary`; Accept correctly updates the parent form's field value for both the plain-textarea and TipTap-rendered `description` paths (may require mocking `RichTextEditor`'s markdown setter).
- **API**: no new test needed — the endpoint, its entitlement gate, and quota enforcement already have coverage (SPEC-198); this spec only consumes it from a new caller.

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- Existing implementation reference: admin AI text-improve UI (**SPEC-198**, not SPEC-223 as originally stated in the stub — see Divergence Report).
- SPEC-317 (owner review responses) — sibling owner-basico+ feature.

## Divergence Report (Pass 3)

- Stub claimed the admin reference implementation was "SPEC-223, shipped 2026-06-22" → actual code (`apps/admin/src/features/accommodations/hooks/useAiTextImprove.ts` and siblings) is attributed to **SPEC-198** in every file header. Corrected throughout this spec.
- Stub's open question offered `title` as a candidate field → the API's `fieldType` enum (`packages/schemas/src/entities/ai/ai-text-improve.schema.ts`) only accepts `description | summary | faq_answer`; `title`/`seo_title`/`seo_description` are explicitly documented in that schema as future candidates, not implemented. `title` is out of scope by backend constraint, not by preference.
- Stub assumed a `richDescription` field distinct from `description` → there is no separate field; `description` is a single field conditionally rendered as a plain textarea or a TipTap (`RichTextEditor.client.tsx`) editor depending on the unrelated `can_use_rich_description` entitlement.
- Stub implied a simple request/response API → the endpoint is SSE streaming (`text/event-stream`), not a single JSON round-trip; this changes the client implementation shape materially (hence the need for a dedicated hook rather than a simple TanStack Query mutation).
- Frontmatter `complexity: medium` vs `specs/index.json` `complexity: low` → reconciled to `low` (matches the now-confirmed small scope: 2 new files + 1 wire-in, reusing existing gate/hook infra).

## Revision History

### Review Pass 1 — 2026-07-01

**Passes run:** Completeness Audit, No-Ambiguity/Junior-Implementability Gate, Codebase Alignment Audit (delegated to an Explore sub-agent). Pass 4 (external services) skipped — no third-party integration beyond the internal `ai-core` package, already covered by the existing API contract. Pass 5/6 skipped — complexity confirmed low, no new architectural pattern introduced (reuses `PlanEntitlementGate`/`useMyEntitlements`).
**Summary of changes:**

- Added: Pattern reference, API contract, Files touched, Edge cases, Acceptance criteria (7), Testing strategy, Divergence Report sections.
- Modified: Scope narrowed to `description` + `summary` only (backend-enforced); Related section corrected (SPEC-198, not SPEC-223); frontmatter `complexity` reconciled to `low`.
- Flagged: 2 open questions resolved by user — (1) fields = `description`+`summary` (resolved by codebase fact, not a real choice), (2) UX pattern = replicate admin's button/panel/Accept-Discard pattern exactly (user confirmed, recommended option).
- Also resolved: whether to keep this as a formal spec vs NOSPEC — user confirmed formal spec (task-tracked).
- Divergences found: 5 (see Divergence Report above).
- External refs verified: none (no external service/library involved).
**Open questions remaining:** none.
