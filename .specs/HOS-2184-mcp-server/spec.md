---
title: Hospeda MCP server — customers manage listings, inquiries and stats from ChatGPT, Claude or Gemini
linear: HOS-2184
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

# Hospeda MCP server

## 1. Summary

A remote MCP server (Streamable HTTP) that lets a Hospeda customer — owner of an
accommodation, a "Comer y salir" venue or an experience — connect their Hospeda
account to their own AI chat (Claude custom connector, ChatGPT app, Gemini) and,
from there, read and do basic edits on their listings, read and reply to guest
inquiries, and read their listing stats.

The customer pastes one URL and logs in with their Hospeda account (OAuth 2.1).
Better Auth is the authorization server; `apps/api` is the resource server.

Access is gated by a plan entitlement (`ai_assistant_access`), delivered in a
second phase because the entitlement catalog lives on the HOS-1352 umbrella.

## 2. Problem

Customers increasingly run their day from ChatGPT/Claude/Gemini. Today the only
way to manage a listing or answer a guest is the Hospeda panel. An MCP server
puts Hospeda inside the tool they already use, at no LLM cost to Hospeda (the
customer's subscription pays for the model), and is the foundation HOS-2185
(WhatsApp assistant) reuses.

## 3. Goals

- G-1: One remote MCP endpoint usable from Claude and ChatGPT, with OAuth 2.1
  login against the customer's Hospeda account.
- G-2: Read tools: list own listings (all three verticals), get one listing,
  list/get inquiries, get listing stats.
- G-3: Write tools (v1 scope, owner decision 6): description, opening hours,
  contact data, amenities/features; pause and reactivate a listing.
- G-4: Reply to a guest inquiry with the user's **literal** text, never AI
  wording (owner decision 7), with a two-step server-side confirmation.
- G-5: Every tool inherits existing authorization (PermissionEnum, ownership,
  `resolveListingAccess`), the error contract (foreign resource → not found)
  and content moderation.
- G-6 (phase B): access gated by the `ai_assistant_access` entitlement —
  included in Pro and Premium and during the trial, purchasable as an add-on on
  Básico, same key for all three verticals.
- G-7 (phase B): ChatGPT app directory submission prepared and sent.
- G-8: The customer can see and revoke connected AI clients from their panel.

## 4. Non-goals

- NG-1: Inquiries for venues and experiences. They do not exist in the product
  yet (`conversations` only has `accommodation_id`). Tracked in **HOS-2186**;
  the inquiry tools extend to them once it ships.
- NG-2: Contact-click stats (WhatsApp/phone/web) and favorites for venues and
  experiences. Not measured today. Tracked in **HOS-2187**.
- NG-3: Editing photos, prices/rates, address or map location (owner decision 6).
- NG-4: Hospeda-side LLM. The model is the customer's. (HOS-2185 is the
  Hospeda-hosted agent.)
- NG-5: MCP elicitation for confirmations — future improvement once all three
  clients support it.
- NG-6: Staff/admin use. HOS-40 (staff Custom GPT for social content) is a
  separate, related issue.
- NG-7: Gemini as a launch blocker (owner decision, 2026-11-14 — see §10 R-5).

## 5. Current baseline

Facts from the 2026-11-14 survey (checkout ≈ `origin/staging`; catalog facts
also from `origin/epic/HOS-1352-post-mvp`).

### Auth
- `apps/api/src/lib/auth.ts`, `better-auth ^1.7.14`. Plugins: `admin()`,
  `expo()` only. No `jwt`, `bearer`, `oauthProvider`, `mcp` or API-key plugin.
- Actor: `apps/api/src/middlewares/actor.ts` builds it from the session user +
  DB roles/permissions; otherwise a guest (`utils/actor.ts:13`, `isGuestActor`
  at `:28`).
- Rate limiting: `middlewares/rate-limit.ts` (Redis, prefix `rl:`, in-memory
  fallback); `createSlidingWindowPerUserRateLimit` keys on `actor.id`. No
  per-token limiter.

### Inquiries (accommodation only)
- Tables in `packages/db/src/schemas/conversation/`: `conversations`
  (`accommodation_id` only, `:40`), `messages`, …
- `ConversationService`: `listForOwner` (`:914`), `getThread` (`:755`),
  `getHostResponseRate` (`:1704`), `getHostMonthlyInquiries` (`:1744`).
- Reply: `POST /api/v1/protected/conversations/owner/:id/messages`
  (`routes/conversations/protected/owner/reply.ts`), gated by
  `CONVERSATION_REPLY_OWN`; ownership is a hand-written query over the actor's
  accommodations (foreign → 404); calls
  `MessageService.createMessage(SYSTEM_ACTOR, { senderType: OWNER, userId })`.
- Moderation is synchronous in `message.service.ts` (`moderateText` from
  `@repo/content-moderation`); a rejection is `VALIDATION_ERROR` → 422.

### Listing edits
- Accommodation: `PATCH /{id}` → `AccommodationService.update`,
  `AccommodationUpdateHttpSchema`
  (`packages/schemas/src/entities/accommodation/accommodation.http.schema.ts:499`).
  Where accommodation amenities/features are edited was **not located** (see OQ-1).
- Venue / experience: `PATCH /{id}` → `VenueService.updateOwn` /
  `ExperienceService.updateOwn`, schemas `VenueOwnerUpdateInputSchema`,
  `ExperienceOwnerUpdateInputSchema` (include `description`, `openingHours`,
  `contactInfo`, `amenityIds`, `featureIds`, …).
- Pause/reactivate: `POST /{id}/unpublish|publish|reactivate` via
  `ListingPublicationService` (`apps/api/src/services/listing-publication/`),
  uniform across verticals.
- `resolveListingAccess` (`packages/verticals/src/authorization/`) wired via
  `apps/api/src/middlewares/listing-access.ts`; step 6 maps `EDIT` →
  `edit_<vertical>_info`, `PUBLISH` → `publish_*`.

### Stats available today
| Metric | Availability |
|---|---|
| Views (7d/30d, daily series) | All 3 verticals — `EntityViewService` (`getStatsForOwnListings :1058`, `getDailySeriesForOwnListings :1098`) |
| Reviews count / average | All 3 verticals — `reviewsCount`, `averageRating` columns |
| Favorites count | Accommodation only — `UserBookmarkService.countBookmarksForEntity` |
| Inquiries / avg response time | Accommodation only — `getHostMonthlyInquiries`, `getHostResponseRate` |
| Plan status | Not available on staging (dashboard `plan` is always null since HOS-1416) |
| Contact clicks | Not measured (HOS-2187) |

### Entitlement catalog (umbrella only)
- Keys: `packages/schemas/src/catalog/entitlement-keys.ts` rows
  `[key, scope, aggregation, enforcement, class]`; scope `vertical | global`.
  Global precedents: `priority_support`, `has_verification_badge`, `vip_support`.
- Values: `plan_version_entitlement` (`planQuota`, `trialQuota`),
  `plan_version_limit`; add-ons in `addon-catalog.dbschema.ts`
  (`addon_version_entitlement`, scope `LISTING | VERTICAL_SUBSCRIPTION | USER | GLOBAL`).
- Guards: G3 (`check-catalog-key-usage`), G18 (`check-catalog-sql`),
  `check-addon-compatible-verticals`.
- The staging checkout has 10 catalog files; the umbrella has the full catalog.

### Better Auth capability (docs, 2026-11-14)
- `@better-auth/oauth-provider` is the current OAuth 2.1/OIDC provider; `mcp()`
  wraps it (never register both). The legacy `oidcProvider`/old `mcp` plugin
  omit RFC 9207 `iss`, which ChatGPT requires.
- Covers: auth code + PKCE S256, CIMD (`@better-auth/cimd`), DCR (opt-in),
  RFC 9728 protected-resource metadata, RFC 8414 / OIDC discovery, RFC 8707
  `resource` → RFC 9068 JWT access tokens (with `jwt()`), refresh rotation
  (`offline_access`), revocation, introspection, custom login/consent pages,
  resource-server helpers (`verifyAccessTokenRequest`,
  `createMcpProtectedRequestHandler`).
- Adds tables `oauthClient`, `oauthAccessToken`, `oauthRefreshToken`,
  `oauthConsent`, `oauthClientAssertion` (+ `jwks` from `jwt()`).
- No Hono example in the docs; `/.well-known/*` must be mounted at the API root.
- Latest 1.7.x is 1.7.25 and fixes several Claude-blocking DCR/CIMD bugs
  (#11081, #10900, #10553, #11461). Open: #12087 (concurrent refresh).
- MCP spec revision 2026-07-28: CIMD SHOULD, DCR MAY (deprecated), `resource`
  required on both requests. SDK v2: `@modelcontextprotocol/server`,
  `@modelcontextprotocol/hono`.

## 6. Proposed design

### 6.1 Placement — inside `apps/api` (owner decision, 2026-11-14)

The MCP endpoint lives at `POST/GET /mcp` in `apps/api`, not a separate app.
Better Auth, services, actor building and the Redis limiter are already there;
one less Coolify deploy. Isolation comes from a dedicated per-token rate limit
and a feature flag.

### 6.2 Phasing (owner decision, 2026-11-14)

- **Phase A — cut from `staging`.** OAuth provider, MCP endpoint, all v1 tools,
  connections panel, audit, rate limit. Behind `HOSPEDA_MCP_ENABLED` (default
  `false`), so nobody uses it without the entitlement gate.
- **Phase B — after the HOS-1352 umbrella lands on `staging` and HOS-2066 is
  done.** `ai_assistant_access` key + plan/add-on rows + gate + plan status in
  stats + ChatGPT directory submission. Only then is the flag turned on in prod.

### 6.3 Authorization server (Better Auth)

- Upgrade `better-auth` (and `@better-auth/expo`) to 1.7.25; regression-test
  existing session flows (web, admin, mobile expo).
- Register `jwt({ disableSettingJwtHeader: true })` and `oauthProvider(...)`
  directly (not `mcp()`), plus `@better-auth/cimd`. Rationale: the Hono API is
  the resource server; `oauthProvider` + resource-server helpers is the
  documented split, and avoids `mcp()`'s Next.js-oriented helpers. Revisit if
  `@modelcontextprotocol/hono` integrates `mcp()` cleanly (OQ-3).
- Config: PKCE S256 required; CIMD on and advertised
  (`client_id_metadata_document_supported: true`, `"none"` in
  `token_endpoint_auth_methods_supported`); DCR enabled as fallback; refresh
  tokens with rotation via `offline_access`; `iss` in authorization responses;
  token audience bound to the MCP resource URL.
- Allowed redirect URIs: `https://claude.ai/api/mcp/auth_callback`,
  `https://claude.com/api/mcp/auth_callback`, ChatGPT's documented callback(s),
  and loopback (`localhost`/`127.0.0.1`, any port) for Claude Code / CLIs.
- Workarounds documented by a third-party Better Auth + Claude integration, to
  verify in staging and apply only if reproduced: accept `client_secret_post`
  without a secret as `none`; tolerate `prompt=consent`.
- `/.well-known/oauth-protected-resource` (+ path-inserted alias),
  `/.well-known/oauth-authorization-server` and
  `/.well-known/openid-configuration` mounted at the API root in Hono.
- `resource` in protected-resource metadata MUST equal the exact URL the user
  pastes (Claude requirement) — one canonical public URL per environment.
- Unauthenticated MCP request → `401` with
  `WWW-Authenticate: Bearer resource_metadata="…"` (Claude ignores the header on
  a 200). Tool errors on an expired token also return
  `_meta["mcp/www_authenticate"]` (ChatGPT linking UI).
- Login page: the existing web login, with a return URL. Consent page: new
  route in `apps/web`, rendered as a client island (pages stay session-blind),
  calling `authClient.oauth2.consent`. Spanish copy via `@repo/i18n`.

### 6.4 Resource server — the `/mcp` endpoint

- Transport: Streamable HTTP via `@modelcontextprotocol/server` +
  `@modelcontextprotocol/hono` (v2 SDK; pin exact versions).
- Every request: verify the bearer token (`verifyAccessTokenRequest`, local JWKS),
  check audience = MCP resource, then build the **same actor** the session
  middleware builds (user + DB roles + permissions) from the token's subject.
  Extract the actor building in `middlewares/actor.ts` into a reusable function
  instead of duplicating it.
- Feature flag off → `404` on `/mcp` and on the OAuth metadata endpoints.
- Phase B: after the actor is built, check `ai_assistant_access` in the
  effective set; missing → MCP error with a clear Spanish message pointing to
  the plans page (not a 500, not a silent empty result).
- Rate limit: new Redis sliding window keyed on the **access token's client +
  user** (`rl:mcp:<clientId>:<userId>`), stacked with the existing per-user
  limiter. Limits come from config, not code literals.
- Audit: every write tool call records actor, OAuth client id/name, tool name,
  target id, outcome. Reuse an existing audit mechanism if one fits (OQ-4);
  otherwise a new singular table `mcp_audit_event`.

### 6.5 Tools (v1)

Each tool is a thin adapter over the existing service/route logic — never a
re-implementation — and validates input with Zod from `@repo/schemas`.
Read tools carry `readOnlyHint: true`; write tools carry `readOnlyHint: false`
and `destructiveHint` where applicable, so clients ask for confirmation.

| Tool | Kind | Backed by | Notes |
|---|---|---|---|
| `list_my_listings` | read | services of the 3 verticals | id, vertical, name, publication status, plan coverage (phase B) |
| `get_listing` | read | per-vertical get-own | only fields relevant to the editable set + public URL |
| `update_listing_basic` | write | `AccommodationService.update` / `VenueService.updateOwn` / `ExperienceService.updateOwn` | allowlist: description, opening hours, contact data, amenities/features. Schema is a `.pick()` of the existing owner update schemas, never a new shape |
| `set_listing_publication` | write | `ListingPublicationService` | `pause` → unpublish, `resume` → publish/reactivate; `destructiveHint: true` on pause |
| `list_inquiries` | read | `ConversationService.listForOwner` | accommodation only (NG-1); `status`, `page`, `pageSize` |
| `get_inquiry` | read | `ConversationService.getThread` | guest text returned as delimited data (§6.6) |
| `reply_inquiry` | write | `MessageService.createMessage` | two-step, see §6.7 |
| `get_listing_stats` | read | `EntityViewService`, review aggregates, `UserBookmarkService`, conversation stats | date range; previous-period comparison computed from the same series; per-vertical availability per §5 table; phase B adds plan status |

Authorization per tool goes through the same path the HTTP route uses
(PermissionEnum + ownership + `resolveListingAccess` where the route applies
it). A foreign or missing resource returns the same "not found" result — never
"forbidden" (error contract). Accommodation ownership for inquiries must reuse
the logic in `reply.ts`, extracted into a service-level helper, not copied.

### 6.6 Prompt-injection posture

Guest-written text (inquiry messages, reviews) is third-party content. Tools
return it inside a clearly delimited field (e.g. `guestMessage`) and tool
descriptions state that those fields are untrusted data, never instructions.
No tool takes an action based on content it returned.

### 6.7 `reply_inquiry` — literal text, two steps

1. Parameter `text` is described as "the user's exact words, verbatim; do not
   rewrite, summarise, translate or add anything".
2. First call (no `confirmationToken`): server runs `moderateText` dry, and
   returns either a moderation rejection (shown to the user, nothing stored) or
   a preview — "Se va a enviar: '…' ¿Confirmás?" — plus a `confirmationToken`.
3. The token is single-use, stored in Redis for 10 minutes, bound to
   `(userId, conversationId, sha256(text))`.
4. Second call with the same `text` and the token: the server verifies the
   binding and only then calls `MessageService.createMessage`. Any change in the
   text invalidates the token. Moderation runs again inside `createMessage`
   (authoritative); a 422 there is returned as a tool error.

## 7. Data model / contracts

- Better Auth OAuth tables (`oauthClient`, `oauthAccessToken`,
  `oauthRefreshToken`, `oauthConsent`, `oauthClientAssertion`, `jwks`) as a
  Drizzle migration via `pnpm db:generate` — follow however existing Better Auth
  tables are named/mapped in `packages/db` (OQ-2).
- Optional `mcp_audit_event` (OQ-4).
- Phase B, catalog (on top of the umbrella catalog): key `ai_assistant_access`,
  `scope: global`, boolean (no quota); `plan_version_entitlement` rows on Pro and
  Premium of accommodation, venue and experience with `trialQuota` granting it;
  one add-on (scope `USER`) granting it, compatible with the three verticals,
  price as a catalog value (G7; price TBD per HOS-2185 decision 8). Generated
  SQL migration (G18).
- Env vars (registry flow in `@repo/config` + app `env.ts` + `.env.example` +
  Coolify): `HOSPEDA_MCP_ENABLED`, `HOSPEDA_MCP_RESOURCE_URL` (canonical public
  URL), `HOSPEDA_MCP_RATE_LIMIT_*`. OAuth issuer derives from
  `HOSPEDA_BETTER_AUTH_URL` unless a separate var proves necessary.
- New protected endpoints for the connections panel: list connected OAuth
  clients for the actor, revoke one (revokes its refresh + access tokens and
  consent).

## 8. UX / UI behavior

- **Consent screen** (`apps/web`, client island): Hospeda branding, the client
  name, what it will be able to do (read listings/stats, edit basic data, reply
  inquiries), Permitir / Cancelar. es/en/pt.
- **Panel → "Asistentes de IA"** (`apps/web`, client island): the MCP URL to
  copy, short per-client instructions (Claude, ChatGPT, Gemini), the list of
  connected clients with last use, and Desconectar. Phase B: shows whether the
  plan includes it and links to the add-on for Básico.
- Tool responses and errors are in Spanish (the customer's locale when known).

## 9. Acceptance criteria

Phase A
- AC-1: With the flag off, `/mcp` and the OAuth metadata endpoints answer 404.
- AC-2: From Claude (custom connector) a user pastes the staging URL, logs in,
  consents, and `list_my_listings` returns exactly their listings across all
  three verticals.
- AC-3: Same from ChatGPT (developer mode app).
- AC-4: An unauthenticated MCP request gets 401 with `resource_metadata`; the
  metadata `resource` equals the pasted URL byte for byte.
- AC-5: `update_listing_basic` changes description/hours/contact/amenities on
  each vertical, and rejects any field outside the allowlist with a validation
  error.
- AC-6: Any tool on a listing or inquiry of another user returns "not found";
  covered by tests per tool.
- AC-7: `set_listing_publication` pauses and resumes a listing; the public page
  reflects it (cache revalidation as today).
- AC-8: `reply_inquiry` without a token never sends; with a valid token sends
  exactly the previewed text; with altered text or a reused/expired token is
  rejected; a moderation rejection is surfaced and nothing is stored.
- AC-9: `get_listing_stats` returns views (all verticals), reviews (all
  verticals), favorites and inquiries/response time (accommodation), with
  previous-period comparison; unavailable metrics are omitted, not zero.
- AC-10: Per-token rate limit returns a tool error when exceeded and does not
  affect the same user's web session.
- AC-11: Revoking a client from the panel makes its next MCP call return 401.
- AC-12: Every write tool call leaves an audit record with actor, client and
  tool.
- AC-13: Existing login/session flows (web, admin, mobile) pass their suites
  after the Better Auth upgrade and plugin additions.

Phase B
- AC-14: A Pro/Premium or trial user can use the tools; a Básico user without
  the add-on gets the "not included in your plan" message on every tool; buying
  the add-on unlocks it.
- AC-15: Catalog guards G3, G18 and `check-addon-compatible-verticals` pass.
- AC-16: Stats include plan status (expiry and what it includes).
- AC-17: ChatGPT directory submission sent (privacy policy, tool descriptions,
  test account) — public listing depends on OpenAI's approval and does not
  block Claude, Gemini or ChatGPT Business.

## 10. Risks

- R-1: Better Auth upgrade + `jwt()`/`oauthProvider()` change session/token
  behaviour for every app. Mitigation: AC-13, separate commit, staging smoke of
  all login paths. Check whether `auth.ts` uses secondary storage
  (`session.storeSessionInDatabase: true` is then required).
- R-2: Client-specific OAuth quirks (Claude: 10 s endpoint budget, form-encoded
  `/token`, `invalid_grant`, inbound from `160.79.104.0/21`; ChatGPT: `iss` on
  every response, `aud` = `resource`). Mitigation: staging smoke with real
  clients before phase B; Cloudflare rules must not block those ranges.
- R-3: Better Auth #12087 — concurrent refresh can return `invalid_grant`,
  forcing a re-link. Monitor; document workaround.
- R-4: Prompt injection via guest text (§6.6).
- R-5: Gemini consumer app OAuth-backed remote MCP is not officially
  documented; a forum report says the flow stops after the callback. Gemini is
  "tested if it works" in the smoke, not a blocker.
- R-6: Global entitlement granted by a (vertical-scoped) trial: the effective
  set must resolve a `global` key from a trial source. Verify on the umbrella
  before writing phase B; adjust key scope if needed.
- R-7: Pages in `src/pages` must stay session-blind (consent + panel as islands).

## 11. Open questions (for the implementer to resolve from code)

- OQ-1: Where accommodation amenities/features are edited by an owner (not in
  `AccommodationUpdateHttpSchema` as surveyed). Determines `update_listing_basic`
  for accommodations.
- OQ-2: How existing Better Auth tables are named/mapped in `packages/db`, and
  whether the plugin's tables can follow the singular convention.
- OQ-3: Whether `@modelcontextprotocol/hono` composes cleanly with Better Auth's
  resource-server helpers, or `mcp()` is simpler after all.
- OQ-4: Whether an existing audit table/service fits write-tool auditing.

None of these needs an owner decision unless the answer changes scope.

## 12. Implementation notes

- Smoke label: `status-needs-smoke-staging` (real Claude + ChatGPT connection,
  Gemini best-effort). Phase B touches billing → follow
  `docs/billing/smoke-checklist.md`.
- Release: phase A adds migrations (`release-migration`).
- Branching: phase A from `staging`; phase B from `staging` after the umbrella
  merge and HOS-2066.
- HOS-2185 (WhatsApp) reuses the tool layer: keep tools as plain functions
  `(actor, input) → result` with the MCP binding as a thin wrapper, so a
  Hospeda-hosted agent can call them without MCP.

## 13. Linear

Canonical tracking: HOS-2184.
Follow-ups: HOS-2186 (inquiries for venue/experience), HOS-2187 (contact clicks
and favorites stats). Blocks: HOS-2185. Related: HOS-40, HOS-1352.
