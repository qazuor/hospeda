---
spec-id: SPEC-265
title: AI accommodation search — UI/UX improvements (transparency, onboarding, chat control, layout)
type: improvement
complexity: medium
status: draft
created: 2026-06-22T21:55:01Z
---

# SPEC-265 — AI accommodation search: UI/UX improvements

> Follow-up of **SPEC-199** (single-shot NL search intent) and **SPEC-212**
> (conversational multi-turn search). The AI search pipeline works and is
> architecturally solid; this spec raises the **UI/UX** so the feature feels
> trustworthy, guided and polished — surfacing signal the backend already
> computes but throws away, helping the user know what to ask, and tightening
> the chat interaction. **Not yet implemented** — written so it can be planned
> and atomized later. Tasks are intentionally NOT atomized yet.

## 1. Overview

### Goal

Improve the user-facing experience of the natural-language (AI) accommodation
search along four axes:

1. **Transparency of interpretation** — show the user *how* the AI understood
   their query, using signal the backend already produces but currently discards.
2. **Onboarding / guidance** — help the user discover what they can ask (example
   queries), so the empty chat isn't a blank wall.
3. **Chat control + error clarity** — stop streaming, character counter, collapse
   the panel, and differentiated (friendly) error messages.
4. **Layout / placement (decision)** — evaluate improving the layout of the
   containing page (`/alojamientos`) vs. moving the AI search to its own dedicated
   surface. This is an open architecture-of-information decision to resolve during
   planning, not pre-decided here.

### Motivation

The exploration of the current implementation surfaced a recurring theme: the
backend is richer than the UI exposes. Concretely:

- The API **computes a `confidence` score (0–1) per turn and then strips it** from
  the SSE `filters` event — the UI can never tell a confident extraction from a
  vague one, and the `aiSearch.lowConfidenceMessage` i18n key is dead code.
- The create/search chat **only hints via a static placeholder** — no example
  queries, so a first-time user doesn't know the feature understands "cabaña para
  4 con pileta cerca del río".
- Several **i18n keys already exist but are never rendered** (`charCount`,
  `rateLimitError`, `lowConfidenceMessage`, `triggerLabel`, `panelTitle`) — the
  UI was scaffolded for these affordances but they were never wired.
- A 429 rate-limit surfaces to the user as the raw string **"HTTP 429"** instead
  of the friendly copy that's already translated in three locales.
- The panel is **always open, in normal document flow above the results grid**,
  with no collapse and no clear relationship to the regular faceted search — which
  raises the layout/placement question.

## 2. Current state

### What exists today

| Concern | Location |
|---|---|
| AI search UI (React island) | `apps/web/src/components/ai-search/SearchChatPanel.client.tsx` |
| Mounted (always visible) in | `apps/web/src/pages/[lang]/alojamientos/index.astro` (`client:load`, above the grid) |
| Filter chips | `apps/web/src/components/ai-search/ActiveFilterChips.tsx` |
| State hook | `apps/web/src/components/ai-search/useSearchChat.ts` |
| SSE client | `apps/web/src/lib/api/search-chat-stream.ts` |
| API endpoint | `POST /api/v1/protected/ai/search-chat` (`apps/api/src/routes/ai/protected/search-chat.ts`) |
| Intent → params mapper | `apps/api/src/routes/ai/protected/search-intent.mapper.ts` |
| AI layer | `@repo/ai-core` (`generateObject` slot extraction + `streamText` reply) |
| i18n namespace | `aiSearch` (`packages/i18n/src/locales/{es,en,pt}/aiSearch.json`) |

### How it works (per turn)

1. User types NL text → `POST .../ai/search-chat` (SSE).
2. API extracts structured slots via `generateObject` (`SearchIntentOutputSchema`,
   which includes `confidence`), then streams a short conversational reply.
3. SSE frames: `filters` (once: `{ params, intent }`) → `token` × N → `done`.
4. Browser renders `intent` as removable chips, then independently fires
   `GET /api/v1/public/accommodations` with the derived params and shows a compact
   3-card result grid.

### Governance note

`ai_search` is a **platform feature, not a billing entitlement** (per
SPEC-211 §7.7) — no per-plan quota gate; cost is capped inside the AI engine,
plus per-user/per-IP rate limiting. Auth IS required: anonymous visitors see a
login CTA instead of the composer. Any UX change must keep this model.

## 3. Scope — four workstreams

### A. Transparency of interpretation

The backend already knows more than it shows. Surface it.

| # | Change | Notes |
|---|---|---|
| A1 | **Forward `confidence`** from the route's `filters` SSE event to the client (it is parsed at `search-chat.ts` and dropped). | Touches API (SSE payload) + the SSE client type + hook. Small but cross-layer. |
| A2 | **Low-confidence / "didn't understand" UI** — when confidence is low or entities come back empty, render `aiSearch.lowConfidenceMessage` (already translated) with a suggestion to rephrase, instead of silently showing zero results. | UI; depends on A1. |
| A3 | **Resolve the opaque destination chip** — `ActiveFilterChips` shows a `destinationId` UUID as a generic "Destino filtrado" because the panel has no destinations catalog. Pass the catalog (already fetched by the Astro host page) so the chip shows the real name. | UI + prop wiring. |
| A4 | (consider) A lightweight "Entendí: …" interpretation summary distinct from the free-form reply, if A1+chips aren't enough. | Decide during planning. |

### B. Onboarding / guidance

| # | Change | Notes |
|---|---|---|
| B1 | **Example query chips** — clickable starter queries in the empty state (e.g. "Cabaña para 4 con pileta", "Departamento cerca del río", "Algo pet-friendly con cochera") that populate + send. i18n in all three locales. | UI-only. |
| B2 | (consider) Contextual hints / refinement suggestions after a result set (e.g. "¿querés filtrar por precio?"). | Decide during planning; keep cheap. |

### C. Chat control + error clarity

| # | Change | Notes |
|---|---|---|
| C1 | **Stop/cancel streaming** — a real abort button during streaming (the `AbortController` exists but only fires on a new send). | UI + hook. |
| C2 | **Character counter** — render `aiSearch.charCount` (key exists, unused) + a `maxLength` aligned with the API's 500-char limit. | UI-only. |
| C3 | **Differentiated error copy** — map 429 → `aiSearch.rateLimitError`, service errors → `aiSearch.serviceError`, etc., instead of surfacing raw "HTTP 429". | UI + SSE client (classify status). |
| C4 | **Collapse / minimize the panel** — let the user fold the always-on panel. Interacts with workstream D. | UI; may be subsumed by D. |

### D. Layout / placement — DECISION (open)

The AI panel is currently always-open above the results grid with no clear
relationship to the regular faceted `FilterSidebar`. Evaluate, during planning:

1. **Improve in-place** — better layout/affordances within `/alojamientos`
   (collapse, clearer "AI vs filters" framing, responsive behavior).
2. **Dedicated surface** — move AI search to its own page/route (e.g.
   `/alojamientos/buscar-ia` or a modal/drawer) with more room for transparency
   + onboarding affordances.
3. **Hybrid** — entry point on the listing page that expands into a focused
   experience.

This decision shapes C4 and the home for A/B affordances. **Do not pre-decide;
resolve it as the first planning step (likely needs owner input + a quick
design pass).**

## 4. Out of scope

- **"Bridge to the full listing"** (applying AI-derived filters to the listing URL
  for pagination/sorting/full browsing) — explicitly NOT in this spec (owner
  deselected it). Can be a separate follow-up.
- Billing / entitlement changes — `ai_search` stays a platform feature.
- Changing the AI extraction pipeline, prompts, or model behavior (this is a UI/UX
  spec; the only backend touch is forwarding already-computed signal like
  `confidence` and classifying error codes).
- New search capabilities / new slots — not adding what the AI can understand,
  only how the UI presents it.

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A1 forwards `confidence` but the UI over-interprets a noisy score | Medium | Treat it as a coarse band (low/ok), not a precise %; validate thresholds with real queries |
| Layout decision (D) balloons into a redesign | Medium | Time-box the decision; keep an "improve in-place" minimal option viable |
| Example queries (B1) drift from what the model actually handles well | Low | Source them from the prompt's documented capabilities; test each before shipping |
| i18n drift — new keys in only one locale | Low | Key-coverage test across es/en/pt (existing discipline) |
| Cross-layer change (A1/C3 touch API+web) inflates a "UI" PR | Low/Med | Split: API-signal PR (confidence/error codes) separate from pure-UI PRs |

## 6. Tasks (suggested, by workstream — NOT atomized yet)

- **Decision first (D):** resolve layout/placement (in-place vs dedicated vs hybrid)
  — likely a short design pass + owner sign-off before atomizing the rest.
- **A (transparency):** forward `confidence` (API+SSE+hook), low-confidence UI,
  destination-chip resolution, optional interpretation summary.
- **B (onboarding):** example query chips + i18n (es/en/pt); optional refinement hints.
- **C (control/errors):** stop-streaming, char counter, differentiated error copy,
  collapse (pending D).
- **Integration/testing:** component tests for new states (low-confidence, abort,
  example-click); SSE-client tests for confidence forwarding + error classification;
  i18n key-coverage.
- **Testing (smoke):** Chrome smoke — verify confidence band, example queries,
  abort, friendly rate-limit message, and the chosen layout.
- **Docs/cleanup:** update AI-search docs + cross-reference SPEC-199/212.

## 7. Open questions for planning

- **Q1 (Layout/D):** improve in-place vs dedicated page vs hybrid? (Needs owner +
  design input — this is the spec's pivot decision.)
- **Q2 (Confidence/A1):** expose confidence as a visible band/badge, or only use it
  internally to trigger the low-confidence message? How are the thresholds set?
- **Q3 (Onboarding/B1):** how many example queries, and are they static or
  context-aware? Localized copy per market (es/en/pt)?
- **Q4 (Scope split):** ship as chained PRs — (i) API signal (confidence + error
  codes), (ii) transparency UI, (iii) onboarding, (iv) control/errors — to keep
  each reviewable? (Recommended.)
- **Q5 (Collapse vs layout):** is C4 (collapse) independent, or fully absorbed by
  the D decision?

## Internal Review Notes

- Built directly from a thorough exploration of the current AI-search implementation
  (web island + API route + `@repo/ai-core` + i18n) as of 2026-06-22. File paths in
  §2 are the authoritative current-state pointers.
- The strongest, cheapest win is **transparency (A)**: the `confidence` signal and
  several affordances are *already there* in the backend / i18n and just aren't
  wired — high trust impact, low cost.
- The pivot is **the layout decision (D)** — it gates where A/B/C affordances live,
  so it must be resolved first when this spec is attacked.
- Owner scoping (this session): selected transparency + onboarding + chat-control/
  errors + layout-rethink; explicitly DEselected the "bridge to full listing" eje.
