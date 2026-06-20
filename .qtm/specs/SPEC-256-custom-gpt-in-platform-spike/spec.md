---
spec-id: "SPEC-256"
type: improvement
complexity: medium
status: draft
created: "2026-06-20T00:00:00Z"
research-spike: true
---

# Custom GPT From Our Platform — Research Spike

## Overview

- **Goal**: Determine whether the Custom GPT experience that operators currently use on ChatGPT.com can be replicated or embedded inside the Hospeda admin panel, eliminating the context-switch between two products.
- **Motivation**: Today an operator generating social content (SPEC-254 flow) must leave the admin, open ChatGPT.com, chat with the Custom GPT to produce copy + images + hashtags, and then return. This is friction. If an equivalent assistant can live inside the admin, the entire content-creation workflow becomes a single surface with direct API integration to our backend.
- **Success criteria**: At the end of this spike the team has a written feasibility report covering all six investigation areas below, a clear recommendation (build in-platform / keep external GPT / hybrid), and — if the recommendation is "build" — a rough effort range that can anchor a follow-up implementation spec.

**This spike produces NO production code.** Deliverables are a report, a recommendation, and an effort estimate.

---

## Background and Current State

SPEC-254 defines the social automation backend. The current operator workflow is:

1. Operator opens ChatGPT.com and starts a session with a Custom GPT configured for Hospeda.
2. The Custom GPT has system instructions that encode platform knowledge (accommodation types, tone, locale) and a set of GPT Actions (HTTP calls to our backend) for saving drafts, retrieving catalog hashtags, and triggering image upload to Cloudinary.
3. The operator chats, the GPT generates marketing copy and images, selects hashtags, then calls the backend via Actions to persist the draft.
4. The operator returns to the admin to review and schedule.

The research question: **can step 1-3 happen entirely inside the Hospeda admin?**

> Note: Custom GPTs as a product live exclusively inside the ChatGPT.com UI. They are NOT directly accessible via the OpenAI REST API. Any in-platform solution must therefore use a different OpenAI surface (Assistants API, Responses API, or the Chat Completions API with function calling). All API shapes and capabilities listed in this spec should be verified against current OpenAI documentation during the spike — these APIs evolve rapidly.

---

## Investigation Areas

The spike is organized as six investigation questions. Each question must produce a concrete finding (yes / no / conditional) plus supporting evidence.

---

### INV-1: Can a Custom GPT be invoked or embedded programmatically?

**Research question**: Is there any official or supported path to call a Custom GPT from outside ChatGPT.com — via API, iframe, or any embedding mechanism?

**What to verify:**

- Whether the OpenAI API exposes a `gpt_id` or similar parameter that routes a Chat Completions / Assistants call to a specific Custom GPT's configuration.
- Whether OpenAI has published or plans to publish a "GPT deployment" or "GPT API access" feature distinct from the ChatGPT UI.
- Whether the ChatGPT Embed (if it exists) supports authenticated, white-labeled use inside a third-party admin.
- Any terms-of-service restrictions on automated or programmatic use of Custom GPTs.

**Known starting point**: As of the spec creation date, Custom GPTs are a ChatGPT-product feature, not an API feature. The spike must confirm whether this is still true and whether any partial workaround is viable or officially planned.

**Acceptance criteria for this investigation:**

- Finding states explicitly: (a) officially supported, (b) officially unsupported with no near-term roadmap signal, or (c) partially supported via a workaround with documented limitations.
- If unsupported, the finding explains WHY (architecture gap, policy, etc.) with a source reference (OpenAI docs, changelog, or official statement).

---

### INV-2: Rebuilding the assistant via OpenAI Assistants API or Responses API

**Research question**: Can the Custom GPT's behavior be reproduced using the OpenAI Assistants API (persistent threads, tool/function calling, file retrieval) or the Responses API, and what would parity with the current GPT require?

**What to verify:**

- Assistants API capabilities: thread management, function calling (mapping to the existing GPT Actions), streaming, file/image handling, and knowledge retrieval (for platform-specific context we currently embed in GPT system instructions).
- Responses API capabilities: whether it supersedes or complements the Assistants API for stateful conversation use cases, and its current stability/GA status.
- Mapping exercise: list each GPT Action (e.g., save-draft, fetch-hashtags, upload-image-to-Cloudinary) and confirm the equivalent function/tool definition is possible in the target API.
- System prompt parity: the Custom GPT has a configured system prompt. Can the same instructions be replicated verbatim as an Assistant's system message without behavioral differences?
- Effort to migrate: rough LOE to port the GPT configuration (system prompt + tool definitions) to an Assistant definition.

**Acceptance criteria for this investigation:**

- A feature parity table is produced: GPT capability vs. Assistants/Responses API equivalent, with status (full parity / partial parity / gap).
- Each gap is categorized: blocker, workaround available, or acceptable tradeoff.
- A rough effort range (in days of engineering) is stated for the port, conditional on the gaps.

---

### INV-3: Image generation parity and Cloudinary integration

**Research question**: The Custom GPT generates images inline (via DALL-E through the ChatGPT UI). Can an in-platform assistant produce equivalent image output, and how do generated images reach Cloudinary?

**What to verify:**

- Whether the Assistants API or Responses API supports calling the DALL-E image generation endpoint as a tool call within a conversation turn, or whether image generation must be a separate explicit API call outside the conversation thread.
- Image output format: URL (temporary, expiring) vs. base64 vs. binary blob — and which of these is returnable to the admin frontend in a way that allows upload to Cloudinary.
- Cloudinary upload path: can the admin backend call Cloudinary directly after receiving the generated image, or does the flow require a server-side intermediary step? (The spike does not design this — it confirms the path exists and has no blocking API restrictions.)
- Image quality / model equivalence: does DALL-E accessed via API produce results equivalent to what the Custom GPT produces via the ChatGPT UI, or are there model version or parameter differences?

**Acceptance criteria for this investigation:**

- The image generation + Cloudinary upload path is mapped end-to-end (even if only as a diagram or prose description), with each step confirmed as technically feasible.
- Any expiry / TTL constraints on OpenAI-generated image URLs are documented, since they affect the upload timing.
- If there is a capability gap relative to the current Custom GPT image output, it is explicitly noted with severity.

---

### INV-4: Auth, cost model, rate limits, and thread persistence

**Research question**: What are the operational constraints (authentication, per-token cost, rate limits, conversation state) of running the assistant via the OpenAI API compared to the current ChatGPT subscription model?

**What to verify:**

**Authentication:**

- The OpenAI API uses secret API keys scoped to an organization. Confirm how keys would be stored and rotated in the Hospeda API (env var management, secret manager, etc.) — this is a feasibility check, not a design decision.
- Confirm whether any per-user OAuth to OpenAI is required or whether a single platform key is sufficient.

**Cost model:**

- Current cost: the Custom GPT is consumed under the operator's ChatGPT subscription (paid by the operator or the platform, depending on how accounts are shared). Confirm the pricing model for the Assistants/Responses API and image generation API (input tokens, output tokens, image generation units).
- Rough cost estimate per typical content-creation session (e.g., 10 conversation turns + 1 image generation) to assess whether in-platform use changes the cost structure significantly.

**Rate limits:**

- Confirm current tier rate limits for Assistants API and image generation that would apply to a typical operator-per-hour usage pattern.

- Identify whether a single platform API key could become a bottleneck if multiple operators use the assistant concurrently.

**Thread persistence:**

- Assistants API maintains Threads (persistent conversation history). Confirm: do Threads persist indefinitely, or do they expire? What is the cost of storing long threads?
- Confirm whether we need to associate an Assistant Thread ID with an operator session in our DB, and whether this data is PII-sensitive.

**Acceptance criteria for this investigation:**

- A cost comparison table is produced: current model (ChatGPT subscription) vs. API model (per-token), with a "breakeven" usage point identified.
- Rate limit risks (if any) for realistic concurrent operator usage are documented.
- Thread lifecycle behavior is clearly described with expiry / retention data from current OpenAI docs.

---

### INV-5: Hosting a chat UI inside the admin (TanStack Start)

**Research question**: What would the in-admin assistant surface look like, and what level of effort would a chat UI require inside TanStack Start?

**What to verify — UX surface (no code, surface description only):**

- Where the chat UI would live in the admin nav: a dedicated route (e.g., `/admin/content/assistant`), a slide-over panel accessible from within the social content list, or a modal triggered from a "Create with AI" action.
- Minimum viable chat UI components needed: message history display, text input with submit, streaming response rendering, image display inline in the conversation, and a "save draft" action button.
- Whether an existing open-source React chat component could be dropped in or whether a custom component is required given admin styling constraints (Tailwind v4 + Shadcn UI, as per the admin's dependency policy).
- Accessibility requirements for a chat interface (keyboard navigation, screen reader announcements for streaming text, focus management on new messages).

**What to verify — technical feasibility:**

- Streaming support: the Assistants/Responses API supports streaming via SSE. Confirm whether TanStack Query's query-streaming patterns (or a simpler `ReadableStream` fetch approach) are compatible with how we would proxy API calls through our Hono backend.
- The chat UI MUST route all OpenAI calls through the Hospeda API backend — the OpenAI API key must never be exposed to the browser. Confirm this architecture is feasible (admin → Hono endpoint → OpenAI → stream back to admin).

**Acceptance criteria for this investigation:**

- A prose description (not wireframes, not code) of the proposed UI surface is written, sufficient for a designer or developer to understand the layout and interaction model.
- The streaming proxy pattern is confirmed as technically feasible with a note on which Hono/browser API primitives would handle it.
- At least one open-source chat component library (if evaluated) is named with a compatibility note (compatible / incompatible with Tailwind v4 + Shadcn constraint).

---

### INV-6: Decision criteria and recommendation framework

**Research question**: Given the findings from INV-1 through INV-5, what is the structured framework for deciding whether to build in-platform, keep the external Custom GPT, or pursue a hybrid?

**What to define (during the spike):**

- The criteria that would tip the decision toward building in-platform: cost below a threshold, parity above a threshold, UI effort below a threshold, no blocking API gaps.
- The criteria that would tip the decision toward keeping the external Custom GPT: API gaps that cannot be resolved, cost significantly higher than ChatGPT subscription, effort exceeds benefit within 12-month planning horizon.
- A hybrid option: the admin links out to ChatGPT.com for draft creation but automatically imports the draft once saved (requires SPEC-254 webhook or polling). Describe this path briefly as a fallback.
- A recommendation: after the spike, the researcher must state a clear recommendation (one of: build, keep, hybrid) with the top three supporting findings from INV-1–5 as justification.

**Acceptance criteria for this investigation:**

- The decision framework is a table or decision tree with explicit thresholds, not vague qualitative statements.
- The recommendation is stated unambiguously (not "it depends" without a resolution path).
- The recommendation includes a confidence level (high / medium / low) with an explanation of what would change it.

---

## User Stories for the Spike Workflow

These stories describe how the spike itself is executed and reviewed — not the end-user experience of the eventual feature.

### US-1: Spike Researcher Executes Investigation

**As a** platform engineer conducting this spike, **I want** a clear checklist of questions to answer and sources to consult (current OpenAI docs via context7, OpenAI changelog, pricing page), **so that** the investigation is reproducible and covers all identified risk areas without scope creep.

**Acceptance Criteria:**

- **Given** the six investigation areas defined above, **When** the researcher begins the spike, **Then** they have a documented starting point for each area (confirmed API surface names, doc URLs, and the specific claim to verify).
- **Given** an investigation area is complete, **When** the finding conflicts with the expected outcome, **Then** the finding is recorded as-is (not adjusted to match expectations) and its impact on the recommendation is noted.
- **Given** the researcher cannot verify a claim (API docs are ambiguous or behind a paywall/login), **Then** the uncertainty is explicitly flagged in the report with a note on how to resolve it (e.g., "contact OpenAI support", "check enterprise tier docs").

### US-2: Stakeholder Reviews Feasibility Report

**As a** product owner reviewing this spike, **I want** a feasibility report that presents findings in plain language with a clear recommendation and an effort estimate, **so that** I can decide whether to green-light an implementation spec or keep the current Custom GPT workflow.

**Acceptance Criteria:**

- **Given** the spike is complete, **When** I read the feasibility report, **Then** each of the six investigation areas has a finding summary of no more than one paragraph, followed by a binary verdict (feasible / not feasible / feasible with caveats).
- **Given** the recommendation is "build in-platform", **When** I read the effort estimate, **Then** it states a range in engineering days (e.g., "6-10 days") with the key assumptions that bound the range, sufficient to plan a follow-up implementation spec.
- **Given** the recommendation is "keep external Custom GPT" or "hybrid", **When** I read the report, **Then** the top three blockers that prevented an in-platform build are listed explicitly so they can be revisited if OpenAI's API capabilities change.

### US-3: Follow-on Spec Readiness

**As a** platform engineer who will implement the in-platform assistant (if green-lit), **I want** the spike report to include a mapping of GPT Actions to OpenAI API function/tool definitions and a sketch of the backend API surface needed, **so that** the implementation spec can be written from concrete findings rather than re-investigating the same ground.

**Acceptance Criteria:**

- **Given** the recommendation is "build", **When** I read the spike output, **Then** there is a table mapping each existing GPT Action (name, HTTP method, backend endpoint) to its proposed OpenAI API equivalent (function name, parameters, response shape — using current API schema from docs).
- **Given** the recommendation is "build", **Then** the report states which new Hono routes would be needed (at minimum: a proxy route for chat completions/assistant messages, a route for image generation, and any thread-management endpoints), without prescribing implementation details.
- **Given** the recommendation is "do not build", **Then** the follow-on spec readiness section is omitted and the report ends at the recommendation.

---

## Out of Scope

The following are explicitly excluded from this spike:

- Writing any production code, database migrations, or API route implementations.
- Designing the full UI/UX of the in-admin chat interface beyond what is needed to assess feasibility (INV-5).
- Integrating with SPEC-254's backend while this spike runs — this spike is independent and can run concurrently.
- Evaluating non-OpenAI alternatives (Anthropic Claude API, Google Gemini, etc.) — this spike is scoped to reproducing the existing Custom GPT experience, which is OpenAI-native.
- Setting up a staging environment for OpenAI API calls.
- Cost negotiation with OpenAI or evaluation of enterprise pricing tiers (unless enterprise tier is the only path to feasibility).
- Any change to the existing Custom GPT configuration on ChatGPT.com — the spike is read-only relative to the current setup.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI API shapes change between spec creation and spike execution | High | Verify all API surfaces against current docs (context7 / OpenAI changelog) at the moment of investigation, not from training data. |
| Custom GPT remains permanently inaccessible via API (INV-1 finding is "no") | High | Spike is designed around this being the expected finding. INV-2 through INV-5 are the real investigation and proceed regardless. |
| Assistants API is deprecated in favor of Responses API before spike completes | Medium | Investigate both surfaces in parallel. The spike report should cover whichever is the current recommended path at investigation time. |
| Image generation API returns expiring URLs that make Cloudinary upload timing fragile | Medium | Document the TTL constraints in INV-3 finding. If TTL < 60s, flag as a design risk for the follow-on spec. |
| In-platform cost per session is significantly higher than ChatGPT subscription | Medium | The cost comparison in INV-4 surfaces this. If breakeven is above realistic usage, recommendation shifts to "keep external". |
| Operator adoption risk: operators prefer the ChatGPT.com UX they already know | Low | Out of scope for this spike. Noted here for product context — UX research would be a separate concern. |

---

## Deliverables

At spike completion, the researcher produces:

1. **Feasibility report** — a document (can be a new `.md` in this spec's directory or an engram observation) covering each of the six investigation areas with findings and a verdict.
2. **Feature parity table** — mapping current GPT capabilities to Assistants/Responses API equivalents (from INV-2).
3. **Cost comparison table** — ChatGPT subscription model vs. API model with breakeven analysis (from INV-4).
4. **Recommendation** — a single clearly-stated recommendation (build / keep / hybrid) with confidence level and top supporting findings.
5. **Follow-on effort estimate** — only if recommendation is "build": a rough engineering day range with key assumptions.

The feasibility report should be written to be readable by a product owner who is not an OpenAI expert.

---

## Suggested Spike Tasks

These are investigation tasks, not implementation tasks.

1. [ ] Read current OpenAI docs on Custom GPT API access (context7 query: "custom GPT API embed programmatic access") — record INV-1 finding.
2. [ ] Read current OpenAI Assistants API docs and Responses API docs (context7) — confirm GA status, thread behavior, tool/function calling schema.
3. [ ] Map existing GPT Actions to OpenAI API function definitions — produce parity table for INV-2.
4. [ ] Read current OpenAI image generation API docs (DALL-E / gpt-image-1) — confirm response format, TTL, model availability via Assistants/Responses — record INV-3 finding.
5. [ ] Read current OpenAI pricing page for Assistants API and image generation — produce cost comparison table for INV-4.
6. [ ] Read current OpenAI rate limits doc for the applicable tier — record concurrency risk for INV-4.
7. [ ] Describe proposed chat UI surface in prose and identify candidate open-source components — record INV-5 finding.
8. [ ] Confirm streaming proxy feasibility (SSE through Hono to TanStack Start) — record INV-5 technical finding.
9. [ ] Write decision framework and apply findings to produce recommendation — produce INV-6 output.
10. [ ] Compile feasibility report, parity table, cost table, and recommendation into deliverable document.
