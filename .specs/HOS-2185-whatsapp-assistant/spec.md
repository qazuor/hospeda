---
title: Hospeda WhatsApp assistant — customers manage listings, inquiries and stats by messaging an official number
linear: HOS-2185
statusSource: linear
created: 2026-11-14
type: feature
areas:
  - api
  - auth
  - db
  - billing
  - web
---

# Hospeda WhatsApp assistant

## 1. Summary

A customer (owner of an accommodation, venue or experience) links their mobile
number in the panel and then messages Hospeda's official WhatsApp number to do
what the MCP server (HOS-2184) offers: read and do basic edits on listings,
read and reply to guest inquiries, read stats. Unlike HOS-2184, Hospeda runs
the agent and pays the LLM and Meta: the agent is built on `@repo/ai-core` and
calls the **same tool layer** HOS-2184 defines.

Official Meta WhatsApp Cloud API only, customer-initiated conversations only,
access gated by its own entitlement with monthly interaction limits from the
catalog.

## 2. Problem

Many owners live in WhatsApp and do not use ChatGPT/Claude/Gemini. HOS-2184
does not reach them. A Hospeda-run assistant on WhatsApp does, at a cost per
interaction that the entitlement, limits and add-on price must cover.

## 3. Goals

- G-1: A linked customer can, by WhatsApp, run every HOS-2184 v1 tool.
- G-2: Writes are confirmed with WhatsApp reply buttons (**Enviar** /
  **Cancelar**) showing the exact text; replies to guests are the customer's
  literal text (HOS-2184 decision 7).
- G-3: Phone linking proven by the customer sending a panel-issued code from
  their phone to the Hospeda number.
- G-4: Webhook is signed, idempotent and acks fast; processing is durable.
- G-5: Monthly interaction limits (and a trial limit) from
  `plan_version_limit`, with an 80% warning and a single cut-off message.
- G-6: Cost per interaction (LLM + Meta) is measured, to price the add-ons
  after a pilot with Premium customers.
- G-7: The bot is scoped to Hospeda and refuses anything else (Meta's
  general-purpose assistant ban).

## 4. Non-goals

- NG-1: Outbound / proactive messages and templates (e.g. "tenés una consulta
  nueva"). The bot only replies inside the 24 h customer service window.
- NG-2: More than one phone per account, or per-phone permissions (needs an
  account-member model that does not exist).
- NG-3: Extra interaction packs beyond the monthly limit.
- NG-4: Media (photos, audio, documents). Non-text inbound messages get a short
  "solo puedo leer texto por ahora" reply.
- NG-5: Anything HOS-2184 excludes (photos, prices, address; inquiries for
  venues/experiences until HOS-2186; contact-click stats until HOS-2187).
- NG-6: Unofficial libraries (whatsapp-web.js, Baileys) and BSP intermediaries.

## 5. Current baseline

Facts from the 2026-11-14 survey (checkout ≈ `origin/staging`, catalog also on
`origin/epic/HOS-1352-post-mvp`).

### WhatsApp in the code
- No Cloud API integration exists. Only `wa.me` links:
  `apps/api/src/routes/accommodation/protected/getWhatsApp.ts`, the brand phone
  (`packages/config/src/env-registry.hospeda.ts:73`, `apps/web/src/lib/brand-phone.ts`)
  and the channel invite URL. No `WHATSAPP_*`/`META_*` secrets, no
  `X-Hub-Signature-256` code.

### Webhook precedent
- MercadoPago: `apps/api/src/routes/webhooks/mercadopago.ts` — secret required
  (500 if unset), signature check with `timingSafeEqual` (manifest HMAC, not raw
  body), then `receiveProviderDelivery` stores the delivery **before**
  processing and maps a processing error to 500 so the provider retries.
- Processing is synchronous; there is no generic queue. The only outbox is
  `email_outbox`, drained by `email-outbox-sender.job.ts` every minute with
  leases and batches.

### Phone and verification
- Phone lives in `users.contact_info` JSONB (`contactInfo.mobilePhone`,
  E.164-compatible regex). No phone-verified flag, no OTP plugin, no SMS
  provider. Better Auth's `verification` table exists (identifier, value,
  expiresAt).

### `@repo/ai-core`
- Capabilities: generate-text, generate-object, stream-text, extract-intent,
  embed, moderate. **No tool calling or agent loop**: `AiProvider` exposes no
  `tools` parameter; Vercel adapters import only `generateText`,
  `generateObject`, `streamText`, `zodSchema` (`vercel-openai.adapter.ts:43`).
- Safety: injection guard, PII scrubber, moderation. Usage: `recordAiUsage` →
  `ai_usage` (`userId`, `feature`), monthly cost ceilings per feature
  (`usage/ceiling.ts`, 50/80/100% alerts).
- Monthly quota: `apps/api/src/utils/listing-access/ai-quota-gate.ts`
  `enforceAiQuota` → optional entitlement check → `getMonthlyCallCount` (counts
  `ai_usage` rows `success|fallback` in the UTC month) → `resolveLimitStep`
  against `plan_version_limit` → `LIMIT_REACHED` with
  `{ limitKey, currentCount, maxAllowed }`.
- Chat history: `ai_conversations` (`userId`, `feature`) + `ai_messages`
  (`role`, `content`). No tool-call, channel, `wamid` or pending-confirmation
  storage.

### Accounts
- Listings are single-owner (`ownerId`). No account-member model;
  `CLIENT_MANAGER` is a platform role, not membership.

### Meta (official docs, 2026-11-14)
- Per-delivered-message pricing since 2025-07-01. Inbound messages are free.
  1,000 free **service** messages per number per month; from 2026-10-01 service
  messages beyond that are charged. Without a payment method on file, service
  replies may stop once the free tier is used. (The es-LA marketing page still
  says service is free — the developer docs are authoritative.) Argentina ARS
  rate cards exist since 2026-04-01; values to be read manually.
- 24 h customer service window opens/resets with each customer message; inside
  it, free-form messages, **reply buttons (max 3)** and list messages are
  allowed without templates.
- Webhooks: GET handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`);
  POST signed with `X-Hub-Signature-256` = HMAC-SHA256(app secret, raw body);
  reply 200 fast; retries up to 36 h–7 days (docs disagree) → dedupe by message
  id; batches up to 1,000 entries; payload up to 3 MB.
- Throughput 80 msg/s per number; pair limit ~1 msg / 6 s to the same user
  (bursts up to 45). Graph API v26.0 (2026-07-29) is current.
- Messaging limit tiers (250 → 2,000 → …) count only messages **outside** the
  service window — a reply-only bot is largely unaffected.
- A production number cannot already be registered on the WhatsApp app (must be
  deleted there first). Business verification improves limits and enables
  Official Business Account; not confirmed as mandatory.
- Business Solution Terms bar general-purpose AI assistants (new users from
  2025-10-15, existing from 2026-01-15, per secondary reporting); customer
  support bots scoped to the business are the allowed case.

## 6. Proposed design

### 6.1 Dependencies and phasing

- Depends on HOS-2184 phase A (the tool layer as plain functions
  `(actor, input) → result`, HOS-2184 §12). No business logic is duplicated.
- **Phase A** — cut from `staging` after HOS-2184 phase A merges. Everything
  below except the entitlement gate, behind `HOSPEDA_WHATSAPP_ASSISTANT_ENABLED`
  (default `false`).
- **Phase B** — after the HOS-1352 umbrella lands on `staging` (and HOS-2066),
  alongside HOS-2184 phase B: entitlement, limits, add-ons, gate.
- **Pilot** — before public launch, enabled for a handful of Premium customers
  to measure real cost per interaction; add-on prices are set from that data
  (owner decision 8).

### 6.2 `@repo/ai-core` tool calling (owner decision, 2026-11-14)

Extend ai-core instead of calling the `ai` SDK directly, so provider
abstraction, metering, cost ceilings and safety stay in one place.

- `AiProvider` gains an SDK-free tool contract: tool name, description, Zod
  input schema, and an `execute` callback supplied by the caller; plus a
  `maxSteps` cap. Adapters map it to the Vercel AI SDK tool API.
- New capability `run-agent` (name tentative): system prompt + history + tools
  → final text + the list of tool calls made + per-step usage.
- Every model step records usage (`recordAiUsage`, feature
  `whatsapp_assistant_step`); cost ceilings apply per step. The **interaction**
  (one inbound message) is counted separately — see §6.7.
- The stub provider supports scripted tool calls so the agent is testable
  without a real model.
- Injection guard runs on inbound customer text; tool results that carry
  third-party text (guest messages, reviews) are passed as delimited data
  (HOS-2184 §6.6).

### 6.3 Webhook and processing (owner decision, 2026-11-14)

- `GET /api/v1/webhooks/whatsapp`: verify-token handshake, echo `hub.challenge`.
- `POST /api/v1/webhooks/whatsapp`:
  1. Read the **raw body**; verify `X-Hub-Signature-256` with the app secret and
     `timingSafeEqual` before parsing. Secret unset → 500; bad signature → 401.
  2. Parse; for each inbound message insert a row in a new table
     `whatsapp_inbound_message` with a **unique `wamid`**. A duplicate insert is
     a no-op (Meta retries).
  3. Respond 200.
  4. Immediately after responding, process newly inserted rows in-process
     (fire-and-forget, errors logged, never thrown into the response).
- Recovery cron (`whatsapp-inbound-recovery`, every minute, in
  `schedules.manifest.ts`): picks rows still `pending` or stuck in `processing`
  past a lease (e.g. 2 min), with an attempt cap; after the cap the row is
  `failed` and the customer gets one apology message if the window is open.
- Status callbacks (`sent`, `delivered`, `read`, `failed`) update the outbound
  record; they are not processed by the agent.
- Rows retained for 30 days (cost audit, dedupe); a retention job prunes older
  rows.

### 6.4 Phone linking (owner decision, 2026-11-14)

1. Panel → "Asistente por WhatsApp" (client island): the customer clicks
   "Vincular"; the API issues a short single-use code (e.g. `HOS-482913`),
   valid 15 minutes, stored hashed and bound to the user.
2. The panel shows the code and a `wa.me/<hospeda-number>?text=<code>` link.
3. The customer sends the code from their phone. The webhook sees a message
   whose text matches a pending code: it binds the sender's number (`from`, as
   given by Meta) to that user, marks the code used, and replies with a
   confirmation.
4. Table `whatsapp_link` (singular): `user_id` (unique in v1), `phone_e164`
   (unique), `linked_at`, `revoked_at`. One active link per user and per phone.
5. Unlinking from the panel sets `revoked_at`; a message from an unlinked or
   revoked number gets one explanatory reply with the panel URL (rate-limited
   per number so it cannot be used to spam replies).
6. Linking does not overwrite `contactInfo.mobilePhone`.

### 6.5 Conversation flow

For each inbound text from a linked number:

1. Feature flag off → ignore (no reply).
2. Build the actor for the linked user (same actor builder HOS-2184 extracts).
3. Phase B: check `whatsapp_assistant_access`; missing → one reply explaining
   it is not in the plan, with the plans page link (rate-limited).
4. Interaction limit check (§6.7).
5. If the message is a button reply for a pending confirmation → resolve it
   (§6.6) without calling the model.
6. Otherwise run the agent with the conversation history and the HOS-2184 tool
   set; send the final text (split if over WhatsApp's text length limit).

History: reuse `ai_conversations` / `ai_messages` with `feature =
'whatsapp_assistant'`, one rolling conversation per linked user; the agent sees
the last N messages (config) so "respondele a esa" resolves. Tool calls are
stored alongside (new columns or a side table — implementer's choice, OQ-1).

System prompt: Hospeda-only scope, Rioplatense Spanish (voseo), refuse
off-topic requests (Meta policy), never invent data, use tools for every fact.
Prompt text lives where other AI prompts live (`ai_prompt` rows / prompt
resolver), not hard-coded.

### 6.6 Write confirmations

- Write tools are never executed directly from a model step. The agent's write
  tool call produces a **pending action** (tool, validated input, preview text)
  stored with a 10-minute TTL, bound to the user.
- The bot sends an interactive message with the exact preview ("Se va a
  enviar: '…'") and two reply buttons, **Enviar** and **Cancelar**, whose ids
  reference the pending action.
- **Enviar** executes the stored input exactly as previewed (no model call);
  **Cancelar** discards it. Expired or already-resolved actions reply
  "esa acción venció, pedímela de nuevo".
- `reply_inquiry`: the `text` must be the customer's literal words (same
  parameter contract as HOS-2184 §6.7); moderation runs at preview and again on
  send.

### 6.7 Limits and metering

- An **interaction** = one inbound customer text message answered by the bot.
  Button replies and the cut-off/explanatory messages do not count.
- Counting: on completing an interaction, record one `ai_usage` row with
  feature `whatsapp_assistant` (status `success`), so `enforceAiQuota` /
  `getMonthlyCallCount` count interactions, not model steps (steps use
  `whatsapp_assistant_step`, §6.2).
- Limit keys (phase B, catalog): `max_whatsapp_interactions_per_month`
  (Premium + add-on values) and the trial value via `trialQuota` /
  trial limit (tentative 50 for the whole trial — the trial limit semantics
  must be checked against the catalog, OQ-2).
- At 80% of the monthly limit: one warning message per month. Over the limit:
  one cut-off message per month suggesting the panel or the MCP (HOS-2184);
  later messages that month get no reply.
- Meta cost: record each outbound message (category service, `wamid`, status)
  so cost per interaction = LLM (from `ai_usage`) + delivered service messages
  beyond the free tier. Report available to staff for the pilot.

### 6.8 Outbound sending

- Thin Cloud API client in `apps/api` (native `fetch`, Graph API version
  pinned in config): send text, send interactive reply buttons, mark as read.
- Respect the pair limit (≥ 6 s spacing to the same user when splitting long
  replies) and back off on 429 / rate-limit errors (`4^n` s).
- Only send while the 24 h window is open (always true when replying to an
  inbound message processed in time; the recovery path checks it).

## 7. Data model / contracts

- New tables (singular): `whatsapp_inbound_message` (`wamid` unique, `from`,
  `user_id` nullable, `type`, `body`, `status`, `attempts`, `lease_until`,
  timestamps), `whatsapp_outbound_message` (`wamid`, `user_id`, `kind`,
  `status`, `inbound_id`), `whatsapp_link`, `whatsapp_link_code`,
  `whatsapp_pending_action` (or Redis with TTL — OQ-3).
- Phase B catalog (umbrella): key `whatsapp_assistant_access` (`global`,
  boolean) on Premium of the three verticals; limit
  `max_whatsapp_interactions_per_month`; one add-on (scope `USER`, compatible
  with the three verticals) granting the key and the limit for Básico and Pro;
  price as a catalog value (G7), set after the pilot. Generated SQL (G18).
- Env vars (registry flow, `@repo/config` + `apps/api` env schema +
  `.env.example` + Coolify): `HOSPEDA_WHATSAPP_ASSISTANT_ENABLED`,
  `HOSPEDA_WHATSAPP_ACCESS_TOKEN` (secret), `HOSPEDA_WHATSAPP_PHONE_NUMBER_ID`,
  `HOSPEDA_WHATSAPP_APP_SECRET` (secret), `HOSPEDA_WHATSAPP_VERIFY_TOKEN`
  (secret), `HOSPEDA_WHATSAPP_GRAPH_API_VERSION`.
- Protected endpoints: create link code, get link status, unlink.

## 8. UX / UI behavior

- Panel → "Asistente por WhatsApp" (client island, pages stay session-blind):
  status (vinculado / no vinculado), "Vincular" with code + `wa.me` link and a
  countdown, "Desvincular", usage this month (n / limit) in phase B, add-on link
  for Básico/Pro.
- Bot copy in Spanish (voseo), short, with the listing name in every write
  preview so the customer knows which listing is affected.
- Messages for: unlinked number, not in plan, 80% warning, limit reached,
  expired action, non-text message, internal failure.

## 9. Acceptance criteria

Phase A
- AC-1: Flag off → webhook still answers the GET handshake and 200 to POSTs but
  sends nothing.
- AC-2: A POST with a missing or wrong `X-Hub-Signature-256` is rejected (401)
  and stores nothing.
- AC-3: The same `wamid` delivered twice produces one row and one reply.
- AC-4: The webhook responds 200 before the model is called; a row left
  `pending` (simulated crash) is processed by the recovery cron.
- AC-5: Linking: a code sent from the phone binds that number; an expired,
  reused or unknown code does not; one active link per user and per phone.
- AC-6: An unlinked number gets exactly one explanatory reply per rate-limit
  window.
- AC-7: "¿Cuántas vistas tuvo mi cabaña este mes?" → the agent calls
  `get_listing_stats` and answers with real numbers (stub provider test +
  staging smoke).
- AC-8: A write request sends a button message with the exact preview;
  **Enviar** executes exactly that input; **Cancelar** and expiry execute
  nothing.
- AC-9: `reply_inquiry` sends the customer's literal text; a moderation
  rejection is reported and nothing is sent.
- AC-10: Any tool on another user's listing or inquiry returns "not found".
- AC-11: Off-topic requests ("escribime un poema") are declined.
- AC-12: Each model step and each interaction are recorded with the right
  feature; outbound messages are recorded with status.
- AC-13: ai-core `run-agent` is covered by unit tests with the stub provider
  (tool selection, `maxSteps` cap, usage per step).

Phase B
- AC-14: Premium (and add-on holders) can use it; Básico/Pro without the add-on
  get the not-in-plan message; trial users get the trial limit.
- AC-15: At 80% one warning; over the limit one cut-off message and silence for
  the rest of the month; the counter resets on the new month.
- AC-16: Catalog guards G3, G18 and `check-addon-compatible-verticals` pass.

## 10. Risks

- R-1: ai-core tool calling is new and touches the shared provider interface.
  Mitigation: additive contract, stub-provider tests, no change to existing
  capabilities.
- R-2: Meta billing — without a payment method, service replies may stop after
  1,000/month. Owner prerequisite (§12).
- R-3: Meta policy — general-purpose ban is based on secondary sources; read the
  "AI Providers" section of the Business Solution Terms before launch.
- R-4: Cost per interaction unknown until the pilot; cost ceilings in ai-core
  cap the worst case.
- R-5: Prompt injection from guest text (inquiries, reviews) reaching the agent;
  delimited data + no write without button confirmation limits the blast radius.
- R-6: Fire-and-forget processing can be lost on a deploy/restart; the recovery
  cron is the backstop (Coolify rollouts run two containers briefly — dedupe by
  `wamid` and leases prevent double processing).
- R-7: Phone number change by the customer → they must re-link; documented in
  the panel.
- R-8: Webhook retry window disagreement (36 h vs 7 days): keep inbound rows ≥ 7
  days (30 planned).

## 11. Open questions (implementer, from code)

- OQ-1: Where to store tool calls of the agent (columns on `ai_messages` vs
  side table).
- OQ-2: How a trial-wide limit (50 for the whole trial, not per month) is
  expressed in the catalog (`trialQuota` semantics on the umbrella).
- OQ-3: Pending actions and link codes in Postgres vs Redis with TTL.
- OQ-4: Read Argentina ARS service-message rates from Meta's rate card for the
  pilot report.

## 12. Implementation notes

- **Owner prerequisites (outside the code), before staging smoke:**
  1. Meta Business account (verification recommended).
  2. Dedicated number (SIM or virtual) not registered on the WhatsApp app;
     display name approved.
  3. Payment method on the WhatsApp Business account.
  4. Read the "AI Providers" section of the Business Solution Terms.
  5. App secret, permanent access token, phone number id and verify token set
     in Coolify (staging first) via `hops env-set`.
- Smoke: `status-needs-smoke-staging` with Meta's test number, then the real
  number; phase B touches billing → `docs/billing/smoke-checklist.md`.
- Release: migrations in phase A (`release-migration`).
- Graph API: pin v26.0 (current as of 2026-07-29) in config.

## 13. Linear

Canonical tracking: HOS-2185. Blocked by: HOS-2184. Related: HOS-1352,
HOS-2186, HOS-2187.
