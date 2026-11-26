# MCP Server

The API exposes a Model Context Protocol (MCP) server so a listing owner can manage
their listings and inquiries from an AI assistant (Claude, ChatGPT, Claude Code).
This guide covers phase A (HOS-2184). It is the reference for operators and for
anyone adding a tool.

- Endpoint: `POST|GET|DELETE /mcp` at the API root (Streamable HTTP, stateless).
- Authorization server: Better Auth with the OAuth 2.1 provider, at `/api/auth`.
- Everything is behind one flag: `HOSPEDA_MCP_ENABLED`.

## Contents

- [Configuration](#configuration)
- [OAuth flow](#oauth-flow)
- [Token model and revocation](#token-model-and-revocation)
- [Request checks](#request-checks)
- [Rate limit](#rate-limit)
- [Audit events](#audit-events)
- [Tool catalog](#tool-catalog)
- [create_listing and the Maps link resolver](#create_listing-and-the-maps-link-resolver)
- [reply_inquiry and its security limit](#reply_inquiry-and-its-security-limit)
- [Adding a tool](#adding-a-tool)
- [Known follow-ups](#known-follow-ups)

## Configuration

All variables are registered in `packages/config/src/env-registry.hospeda.ts` and
listed in [environment-variables](../../../docs/guides/environment-variables.md).
They apply to the API only.

| Variable | Type | Default | Notes |
|---|---|---|---|
| `HOSPEDA_MCP_ENABLED` | boolean | `false` | Master switch. Off: `/mcp` and the OAuth discovery routes answer the normal 404, and Better Auth is built without the OAuth plugins. |
| `HOSPEDA_MCP_RESOURCE_URL` | url | none | Canonical public MCP URL, for example `https://api.hospeda.com.ar/mcp`. It is the token audience and the `resource` in the discovery document. **Required** when the flag is on (the env schema refuses the combination otherwise). |
| `HOSPEDA_MCP_RATE_LIMIT_WINDOW_MS` | number | `60000` | Rate-limit window. |
| `HOSPEDA_MCP_RATE_LIMIT_MAX` | number | `60` | Tool calls allowed per window. |
| `HOSPEDA_MCP_IP_RATE_LIMIT_WINDOW_MS` / `_MAX` | number | `900000` / `10000` | Per-IP safety ceiling of `/mcp` and `/.well-known/*` (see [Rate limit](#rate-limit)). |
| `HOSPEDA_MCP_OAUTH_RATE_LIMIT_WINDOW_MS` / `_MAX` | number | `300000` / `1000` | Per-IP tier of the OAuth `token`, `revoke` and `introspect` endpoints. |
| `HOSPEDA_MCP_OAUTH_REGISTER_RATE_LIMIT_WINDOW_MS` / `_MAX` | number | `3600000` / `100` | Per-IP tier of dynamic client registration. |

The flag is read per request by the `/mcp` gate and the discovery routes. The
Better Auth plugin list is built at boot, so turning the flag on or off needs a
redeploy of the API. The web app has no flag of its own (see
[the web panel](../../web/CLAUDE.md#ai-assistants-panel-hos-2184)).

Enabling the flag requires migration `0227_hos2184_oauth_provider_tables`. Without
those tables every auth request fails, because Better Auth validates its schema.

## OAuth flow

Code: `src/lib/auth-mcp-oauth.ts` (plugins and policy), `src/lib/mcp-well-known.ts`
(discovery), `src/middlewares/mcp-auth.ts` (resource server).

### Discovery

All paths are at the API root and exist only when the flag is on.

| Path | Document |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728. `resource` is `HOSPEDA_MCP_RESOURCE_URL` byte for byte. |
| `/.well-known/oauth-protected-resource/mcp` | Path-inserted alias of the same document. This is what the `WWW-Authenticate` challenge points to. |
| `/.well-known/oauth-authorization-server` | RFC 8414 metadata. |
| `/.well-known/oauth-authorization-server/api/auth` | Issuer-path alias (RFC 8414 form for an issuer with a path). |
| `/.well-known/openid-configuration` | OIDC discovery. |
| `/.well-known/openid-configuration/api/auth` | Issuer-path alias. |
| `/api/auth/.well-known/openid-configuration` | OIDC Discovery 1.0 section 4 form (issuer plus the well-known suffix). |

The issuer is the Better Auth base URL (`HOSPEDA_API_URL` plus `/api/auth`).

### Client registration

Two ways in, and no others.

| Path | How | Redirect allowlist |
|---|---|---|
| Dynamic Client Registration, `POST /api/auth/oauth2/register` | Open (no login), PKCE required | Enforced **at registration** by `mcpRegistrationRedirectGuard` (RFC 7591 `invalid_redirect_uri`) **and again at authorize**. |
| CIMD (client id is a metadata-document URL) | Claude and ChatGPT send this | Enforced **only at authorize**. CIMD has no pre-persist hook. |

The allowlist (`isAllowedMcpRedirectUri`) is:

- `https://claude.ai/api/mcp/auth_callback` and `https://claude.com/api/mcp/auth_callback`
- `https://chatgpt.com/connector_platform_oauth_redirect`
- `https://chatgpt.com/connector/oauth/<callback_id>`
- `http://localhost` or `http://127.0.0.1` on any port and path (CLI clients). No
  credentials and no fragment.

### Disabled endpoints

These Better Auth paths are disabled while the flag is on.

| Path | Why |
|---|---|
| `/token` | The `jwt()` plugin's own endpoint. The OAuth token endpoint is `/oauth2/token`. |
| `/oauth2/create-client` | Any signed-in user could mint a confidential client and bypass the registration policy. |
| `/oauth2/update-client`, `/oauth2/delete-client` | Same reason. Clients come only from DCR and CIMD. |
| `/oauth2/client/rotate-secret`, `/oauth2/client/rotate-keys` | Same reason. |

The account panel manages consents, not clients. Read-only client endpoints and the
consent endpoints stay on.

### Sign-in and consent

The provider sends users to the web app: sign-in at `/es/auth/signin/`, consent at
`/es/auth/consent/` (`MCP_OAUTH_CONSENT_PATH`). The consent page shows the account
and the full capabilities the connection grants. Every MCP client goes through it.

The capabilities listed are `read`, `edit`, `pause`, `reply`, `reviews`,
`createListings`, `providers` (search the hosts' provider directory) and
`benefitUsages` (see your benefit usages and confirm or reject them). The same keys
label a connection in the account's AI assistants panel. Their copy lives in
`packages/i18n/src/locales/*/auth.json` and the two lists stay in sync:
`CAPABILITY_KEYS` in `OAuthConsent.client.tsx` and `AI_CAPABILITY_KEYS` in
`apps/web/src/lib/ai-assistants.ts`. A tool that adds a new kind of access adds its
capability in the same PR.

### Only real clients (HOS-2562)

AI assistants are only for a person with at least one business vertical
(accommodation, venue, experience, editorial, partner or provider). The rule is
`isRealClient` in `@repo/schemas`, fed with the actor's effective permissions and the
`probeBusinessOwnership` facts, never the roles. The web reads the same function, so
it cannot disagree. Anybody else is refused with `403` and OAuth's `access_denied` at
three points (`lib/auth-mcp-client-guard.ts`):

1. `/oauth2/authorize` with a session (no session still goes to sign-in).
2. `/oauth2/consent` with `accept: true`. After sign-in the provider resumes the
   authorization internally, so no `/oauth2/authorize` request reaches a hook there;
   this check covers that path. `accept: false` still returns `access_denied`.
3. Token issuance: `customAccessTokenClaims` throws, so neither a code exchange nor a
   refresh yields a token.

`/mcp` checks it again on every request (check 6 below). A tourist's connection made
before the rule is not revoked: it stops working at once and its consent stays until
the user disconnects it.

Scopes are `openid`, `profile`, `email`, `offline_access`. Grants are
`authorization_code` and `refresh_token`. There is no `client_credentials`: every
token acts for a user.

## Token model and revocation

Access tokens are RFC 9068 JWTs signed with the keys served at `/api/auth/jwks`.
They last one hour and carry `aud` = `HOSPEDA_MCP_RESOURCE_URL`.

A JWT access token is **never stored**, and the provider's `/oauth2/revoke` answers
`unsupported_token_type` for it. A signature check alone would keep a revoked
connection alive for up to an hour. So `/mcp` checks a live grant on every request:

1. The `oauth_client` row exists and is not `disabled`.
2. The user's consent row for that client still exists.

Revoking a connection (`DELETE /api/v1/protected/ai-connections?clientId=<encoded>`) deletes,
in one transaction, the user's consent, refresh tokens and any stored access
tokens for that client. The next `/mcp` call answers 401. The shared
`oauth_client` row is **never** deleted: other users may be connected through it.

Refresh tokens rotate and are single use. `refreshTokenReuseInterval` is not set by
Hospeda. It relies on the provider default of `0`.

### After a password reset

Disconnecting is offered, never forced. When a user resets their password through the
forgot-password flow and has at least one connection, the reset time is recorded in
`users.settings.aiConnectionsPasswordResetAt`. A password change while signed in records
nothing. On the next page load the web asks whether to also disconnect the assistants
connected before the reset (`pendingResetReview` on `GET /api/v1/protected/ai-connections`,
answered with `POST .../ai-connections/reset-review`, see
[route architecture](route-architecture.md#ai-connection-routes-hos-2184)). Connections made
after the reset are never part of the question. This works with `HOSPEDA_MCP_ENABLED` off.

## Request checks

`mcp-auth.ts` runs these in order. Any failure of 1 to 4 is a 401 with
`WWW-Authenticate: Bearer resource_metadata="<api>/.well-known/oauth-protected-resource/mcp"`.
The raw token is never logged.

| # | Check | Failure |
|---|---|---|
| 0 | Flag on and resource URL set | 404 |
| 1 | Bearer header present | 401, no `error` code (RFC 6750) |
| 2 | Signature, issuer, audience, `typ` = `at+jwt`, expiry | 401 `invalid_token` |
| 3 | Live grant (see above) | 401 |
| 4 | User exists, not soft-deleted, not banned | 401 |
| 5 | `mustChangePassword` | 403 `PASSWORD_CHANGE_REQUIRED` |
| 6 | Real client (HOS-2562, `isActorRealClient`) | 403 `FORBIDDEN` |

Check 5 is parity with `mustChangePasswordGate`, which a bearer request never
reaches. Email verification is not a request gate. It is a per-tool check (see
`emailUnverifiedOperation` below).

## Rate limit

There are two layers. The per-IP layer is a coarse ceiling, because Claude and
ChatGPT call from a few shared server IPs and every Hospeda user of an assistant
would otherwise share one IP budget.

| Tier (`getEndpointType`) | Paths | Per IP default |
|---|---|---|
| `mcp` | `/mcp`, `/.well-known/*` | 10000 / 15 min. Out of the `general` tier (500 / 15 min). |
| `oauth` | `POST /api/auth/oauth2/{token,revoke,introspect}` | 1000 / 5 min. Out of the login `auth` tier (50 / 5 min), which is unchanged. |
| `oauth-register` | `POST /api/auth/oauth2/register` | 100 / 60 min. Registration is open (no login) and writes a row per call, so it stays strict. |

`/oauth2/authorize`, `/oauth2/consent` and every other method keep the `auth`
tier: they are browser traffic from the user's own IP. The per-(client, user)
limiter below is the real governor of `/mcp`.

- Key: `rl:mcp:<clientId>:<userId>`, a sliding window. One user on two clients has
  two budgets.
- Counts `tools/call` only. `initialize` and `tools/list` are never counted.
- Over the limit: a tool error `RATE_LIMIT_EXCEEDED` (`isError` result with the
  Spanish message), never an HTTP 429. The call is not run and not audited.
- It **fails open**: if the store throws, the call is admitted and a warning is
  logged.

## The assistant plan gate (HOS-2184 phase B)

Every well-formed `tools/call` runs, after input parsing (a malformed call answers
`VALIDATION_ERROR` first, per the order in `error-contract.md`), the
`ai_assistant_access` gate (`lib/mcp/ai-assistant-gate.ts`, decision in
`mcp/access/ai-assistant-access.ts`). The key is `global` but the effective set is
per (user, vertical), so the gate reads accommodation, venue and experience with
`probeEffectiveKeys` (it throws on a failed read; `readEffectiveKeys` would turn
an outage into an upsell).

A vertical only counts where the account holds plan state (billing's coverage
is anything but the implicit PRE_TRIAL + floor pair). PRE_TRIAL grants the key,
so without this rule every floor-only owner would pass through a vertical they
never touched (found in the staging smoke, 2026-11-26).

- A vertical with plan state grants the key: the call runs.
- Nothing counts and a read failed: `SERVICE_UNAVAILABLE`, no link.
- The account holds no plan state in any of the three: not gated. This covers an
  owner who has not started yet, providers, partners, editors and staff; each
  tool still authorizes.
- Otherwise: `ENTITLEMENT_REQUIRED`, reason `AI_ASSISTANT_NOT_IN_PLAN`, a Spanish
  message and a link to the plans page of the first vertical the owner has a plan
  in. There is no add-on. In practice only a floor-only owner (trial over, nothing
  bought) is refused: pre-trial and every sellable plan grant the key.

A refused call never runs the handler and is audited as `denied` with
`errorCode: AI_ASSISTANT_NOT_IN_PLAN`, with its target when the input names one.
`get_help` and `get_my_plan` carry `aiAccessExempt` and skip the gate. The panel
asks the same question with `GET /api/v1/protected/ai-connections/access`
(`{ hasAccess, vertical? }`: `vertical` is set when refused and is the plans page
to link to; 503 when it cannot be decided).

The gate is MCP-channel-specific on purpose. It lives in the MCP binder
(`handleMcpToolCall`), not in `executeTool`, because each assistant channel is
gated by its own entitlement key: the WhatsApp channel (HOS-2185) will check its
own key at its own entry point and must not inherit this one.

## Tool visibility (HOS-2184 T-042)

A tool may declare `requiredPermissions` (any-of; absent or empty means any
authenticated account). `tools/list` publishes only the tools the actor
satisfies, and a `tools/call` to a hidden tool gets the same `-32602` "not found"
as an unknown tool. Decided by `PermissionEnum`, never by role. The handler keeps
its own check. Today: `get_my_plan` (`BILLING_VIEW_OWN`), `list_inquiries` and
`get_inquiry` (`CONVERSATION_VIEW_OWN`), `reply_inquiry`
(`CONVERSATION_REPLY_OWN`), `search_providers` (`HOST_TRADE_VIEW`, enforced inside
`HostTradeService.listForHost`); `test/mcp/tools/required-permissions.registry.test.ts`
pins them and compares them with the handler source. Its pattern sees inline
handler checks only, so a check inside a service is pinned by an explicit table
there, and the test header lists the checks audited and left undeclared because
they are not tool-wide.

## Audit events

Both use the existing `auditLog()` pipeline (`audit_log_entries`). No new table.

| Event | When | Notable fields |
|---|---|---|
| `mcp.tool.call` | Every tool call that reaches input validation, **read or write**, including malformed ones (HOS-2335 D-12) | actor, `clientId`, tool, `isWrite`, target, outcome (`success`, `denied`, `error`), `errorCode`; writes also `contentLength` and `details`. The client-declared name is never recorded (untrusted text) |
| `mcp.connection.revoked` | A user disconnects an assistant | actor, `clientId`, `removed` counts (consents, refresh tokens, access tokens) |

For `reply_inquiry`, `details.step` is `preview` or `send` (the owner history shows
`preview` and `send` as the same step). For `create_listing`,
`confirm_benefit_usage` and `reject_benefit_usage` it is `preview` or `commit`.
Content (a reply text, a rejection note) is never recorded, only its length. Auditing never changes a tool result: a
failure to write the record is logged and swallowed.

**Reads are recorded too (D-12).** A read row carries its `auditTarget` only:
never `details` and never `contentLength`, even when the definition declares
them. `isWrite` tells reads from writes; a row written before this change has no
`isWrite` and counts as a write, because only writes were recorded then. The
insert is fire-and-forget, so a read pays one extra in-memory audit call and an
async insert, never a wait. The volume is bounded by the per-(client, user) rate
limit above.

**Not every use leaves a row (R-16).** A rate-limited call (recording it would
turn the limiter into a write amplifier), a crash inside the binder before the
audit, and an insert the fire-and-forget persister drops leave no row. The log is
best-effort, not a ledger.

Retention, the shared activity reader and the admin log of these rows are in
[Assistant activity](mcp-activity.md).

**Owner history (HOS-2348).** `GET /api/v1/protected/ai-connections/activity`
calls that reader with `scope: { kind: 'own' }` and nothing else can change it:
the query is strict, so `userId`, `actorId` or `scope` answer 400. It lists
writes only by default; `includeReads=true` is the web's "mostrar también lo
que solo miró" toggle (D-12) and maps to no `access` filter. In es "consulta"
is kept for guest inquiries only, so the toggle never uses the word. The route wires the
reader's `buildTargetUrl` port to `mcp/portal/activity-target-url.ts`: a listing
links to its editor and a conversation to its inquiry thread, in the language
the page is rendered in: the web sends it as the optional `locale` query param
(`es|en|pt`, anything else is a 400, absent means `es`). The source is the page
language, not the stored user setting (U-5, owner decision 2026-11-18). The admin
log passes no locale and keeps `es` links. The response does not carry `skipped`. The web page is
`/{lang}/mi-cuenta/asistentes-ia/historial/` (portal destination
`aiAssistantsHistory`). It labels every tool and error code through i18n and
renders a `reply_inquiry` row with `step: 'send'` (written before HOS-2247) the
same as one with `step: 'commit'`. The web parser is tolerant where the API
schema is strict: each item is validated on its own, an invalid one is left
out, an unknown nested key is dropped and an unknown outcome renders as
"Resultado desconocido", so a newer API never blanks the page.

## Portal link locale

Every portal link a tool call emits (refusal links, `get_help` links, the links
of `get_owner_summary`, `get_listing_creation_guide`, `create_listing`,
`search_providers` and `list_benefit_usages`) is prefixed with the user's web
language: `users.settings.languageWeb`, the same source the add-on emails use
(`resolveRecipientLocale`). `handleMcpToolCall` reads it once per call and hands
it to the tool as `context.locale`; the executor passes it to the refusal link
builder too, so a malformed call links in the same language. An unset or
unsupported value, a missing user or a failed read falls back to `es`. Labels and
texts stay Spanish: only the page the link opens changes.

## Tool catalog

Twenty-two tools. `readOnlyHint` is derived from `isWrite`, so the two cannot disagree.

| Tool | Kind | Annotations | Notes |
|---|---|---|---|
| `list_my_listings` | read | read-only | Accommodations, venues and experiences the user owns, in any state. At most 100 per vertical; `total` and `hasMore` say when the list is truncated. With `BILLING_VIEW_OWN`, `plans`: the `get_my_plan` item per listing vertical with a plan, from one plan read per call. |
| `get_owner_summary` | read | read-only | One summary of all the user's listings: counts per vertical and state, plan-gated metrics per vertical, and up to 10 "needs your attention" items with portal links. Period `7d` or `30d`. |
| `get_my_plan` | read | read-only | The user's plan per vertical (live subscription, permanent grant, courtesy or running trial): catalog plan name and version, status with its label, next charge, service end, grace end, trial days left, labelled `includes`, recurring add-ons and the subscription page link. Optional `vertical`. Needs `BILLING_VIEW_OWN`. With no plan: an empty list and the plans pages. |
| `get_listing` | read | read-only | Editable fields, amenities and features as `{ id, slug }`. |
| `list_amenities_and_features` | read | read-only | Ids to use in `update_listing_basic`. Each entry carries its `category`. |
| `get_listing_amenities` | read | read-only | The catalog of one listing grouped by category (amenity `type`, feature `category`) with `selected` marked, scoped to the listing's vertical. Truncates to the response budget and lists `omittedGroups`. |
| `get_listing_stats` | read | read-only | Periods `7d`, `30d`, `90d`. Needs the plan's `view_basic_stats` entitlement. Reviews are untrusted text. With `BILLING_VIEW_OWN`, `plan`: the `get_my_plan` item of the listing's vertical (`null` without one); `omitted: { plan: 'unavailable' }` when it cannot be read. |
| `list_reviews` | read | read-only | Reviews received on the user's listings, newest first, every moderation state with its `moderationState`. Filters: `vertical`, `listingId`, `minRating`, `maxRating`, `since`, `moderationState`, paging. Titles, texts and author names are untrusted text. |
| `get_help` | read | read-only | "How do I do X in Hospeda" for owners and providers, from the curated Spanish help catalog (`@repo/help`). `question` (up to 300 characters) or `topicId`, optional `audience`. At most 3 topics with `steps` and portal `links`; no match returns no topics plus the FAQ and contact links. |
| `get_listing_creation_guide` | read | read-only | Steps, field limits (read from the create schemas), labelled types, city destinations, venue business lines, the user's open drafts and an informational publish quota. |
| `list_inquiries` | read | read-only | Filters: `status`, `listingId`, paging. Accommodations only. |
| `get_inquiry` | read | read-only | Never marks the inquiry read. |
| `update_listing_basic` | write | idempotent, not destructive | Accommodation, venue, experience. |
| `update_listing_amenities` | write | idempotent, not destructive | Adds or removes the items of ONE category; the rest of the set is untouched. No confirmation token. |
| `set_listing_publication` | write | **destructive**, not idempotent | `pause` or `resume`. |
| `create_listing` | write | open-world, not destructive, not idempotent | Creates a DRAFT, two-step, see below. |
| `reply_inquiry` | write | open-world, not destructive, not idempotent | Two-step, see below. |
| `search_providers` | read | read-only | The host's provider directory, the same rows as the portal. Filters: `query`, `category` (catalog slug), `destinationId`, paging. Provider texts are untrusted text. |
| `list_benefit_usages` | read | read-only | The user's benefit usages on both sides (`side`: `host`, `provider`, `both`), with `status`, `pendingMine` and `canAnswer`. Names and notes are untrusted text. |
| `confirm_benefit_usage` | write | open-world, **destructive**, not idempotent | Two-step. The counterpart confirms a PENDING usage; the other party gets the route's email. Irreversible, and it moves the provider's public counters. |
| `reject_benefit_usage` | write | open-world, **destructive**, not idempotent | Two-step, optional `note` bound into the token (blank counts as no note). The other party gets the route's email. |
| `undo_benefit_rejection` | write | not destructive, not idempotent | One step. Puts a REJECTED usage back to PENDING; only whoever rejected it may. Sends nothing. |

Rules that apply to every tool:

- **Owner-only.** A listing or inquiry the user does not own, a staff-only id and a
  non-existent id all answer the same not-found error. There is no 403 and no
  entitlement error that would confirm the id exists. Staff (ADMIN, SUPER_ADMIN)
  get no bypass.
- **Untrusted data.** Text written by guests, reviewers, directory providers or
  hosts is wrapped in
  `<untrusted_data source="...">` and the tool description carries
  `UNTRUSTED_DATA_NOTICE`. A guest message is never an instruction.
- **Spanish errors.** Validation and failure messages are Spanish and never leak
  stacks or internals.
- **Person state.** Read tools that HTTP serves to unverified emails declare
  `emailUnverifiedOperation: 'READ_OWN'`. Tools that declare nothing refuse an
  unverified user.

Tool-specific rules:

- `get_listing_stats`: plan gated. Without the entitlement the call is refused with
  "Tu plan no incluye estadisticas". For `90d` there is no comparison, because
  views are kept 120 days. Accommodations add a block with favorites (advanced stats
  only), inquiries of this listing, and owner-wide inquiry figures. Metrics a
  vertical does not have are omitted, never zero.
- `get_my_plan` (HOS-2328, spec HOS-2335 §6.3). Read only; changing a plan or buying
  an add-on is done on the linked page.
  - Gate: `BILLING_VIEW_OWN`, the permission of `GET /protected/billing-subscription/`.
    Without it the call is refused with the standard denial. `READ_OWN`.
  - One reader, `readMyPlan` (`mcp/tools/plan/my-plan-reader.ts`), shared with the
    `get_owner_summary` `subscription` block and meant for HOS-2184 AC-16. It is a thin
    adapter: subscriptions from `readOwnPlanState` (service-core, the reader of
    Mi suscripción), the trial from `readTrialSummary` and `readOwnTrialPlan`, `includes`
    from the cached effective set (`toEffectiveSetView`), add-ons from
    `readOwnerAddonHoldings` (the read behind `GET /billing-addon/instances`), a
    courtesy or a permanent grant from billing's `coverage` (`COURTESY` and `GRANT`
    sources) with the plan from `readPlanOfVersion`. No raw table is read in the tool,
    and no plan name comes from code (HOS-1967).
  - One item per vertical (AC-C16): a live subscription, unless a courtesy pauses it,
    wins; then a permanent grant (`PERMANENT_GRANT`, «Acceso permanente»,
    `coverageEndsAt: null`), then a courtesy (`COURTESY`, «Cortesía», `coverageEndsAt`
    its end), then a running trial.
  - Labels in `context.locale`: entitlements `billing.entitlement.<key>`, limits
    `billing.comparison.limitLabel.<key>`, plans `billing.plan.<slug>.name` (else the
    catalog name), add-ons `billing.addon.<slug>.name`, statuses
    `account.subscription.mine.status.*` (`account.subscription.statusTrial` for a
    trial), verticals `account.subscription.mine.vertical.*`.
  - A live recurring add-on with no `ends_at` (until HOS-2116 writes it) has
    `endsAt: null` and `renewsWithSubscription: true`; no date is invented. One still in
    `PENDING_AUTHORIZATION` does not renew.
  - A listing add-on whose listing is gone keeps showing, flagged `listingGone: true`,
    because billing may still charge it until the asynchronous cancel lands (the same
    instance `/billing-addon/instances` lists with `targetName: null`). It goes to its
    product's only compatible vertical, or to the top-level `unattributedAddons` (with
    `addonsUrl`) when the product fits several. Any held add-on whose verticals have no
    item (the title lapsed) goes there too, once, so no charged add-on is hidden. The owner summary carries
    `unattributedAddons` too.
  - `includes` is `null` when the effective set cannot be read; it is never guessed.
- `get_owner_summary` (HOS-2331, spec HOS-2335 §6.6). It is one call instead of one
  `get_listing_stats` per listing.
  - `subscription` (HOS-2328, AC-C33): per vertical, the same item `get_my_plan`
    returns, built by the same `readMyPlan`. Present only with `BILLING_VIEW_OWN`. If
    the plan read fails, the block is left out and `omitted: { subscription:
    'unavailable' }` says so; the rest of the summary still answers. Over the response
    budget, each plan's `includes` gives way first (an `over_budget` marker pointing to
    `get_my_plan`), before any attention item.
  - `listings`: counts per vertical and publication state. They are computed over the
    rows `list_my_listings` reads (`readMyListingRows`), so the two always agree.
    `PURGED` is not counted. `partial: true` means a vertical has more than 100
    listings.
  - `metrics`: one entry per vertical the user has listings in. It is gated exactly
    like `get_listing_stats` (`mcp/tools/listing/stats-entitlement.ts`, shared by
    both tools). Without `view_basic_stats`, only that vertical's entry is replaced
    by `{ omitted: 'NO_STATS_ENTITLEMENT', note, action }`, with a link to the
    vertical's plans (owner decision D-9). The note names no plan until HOS-2066
    exposes which plan versions carry the entitlement (HOS-1967 forbids
    hardcoding names). Listings and attention are never gated.
  - Metric sources:
    - views: `getStatsForHostAccommodations` / `getStatsForOwnListings`, summed;
    - new reviews in the period, every moderation state: `readOwnerListingReviews`
      with `since`;
    - accommodation inquiries and reply speed: `getHostMonthlyInquiries` /
      `getHostResponseRate`;
    - unanswered inquiries: conversations in `PENDING_OWNER`, the `total` of the
      `listForOwner` read `list_inquiries` makes, over the same scope
      (`readOwnerAccommodationIds`) and behind the same `CONVERSATION_VIEW_OWN`
      permission. It is the number `list_inquiries` returns for that status;
    - favorites, advanced stats only: one batched count with the where of
      `countBookmarksForEntity`. It sums live bookmarks over the accommodations,
      so a user who saved two counts twice.
    A metric that cannot be read for a permission reason is left out and listed in
    `omitted`, never zero.
  - Counts and metrics skip `PURGED` listings: a vertical whose only listings are
    purged gets no metrics entry.
  - A vertical with more than 100 listings marks its metrics entry `partial: true`
    too. `newReviews` and `favorites` then cover only the listings read, while
    views and inquiries are owner-wide.
  - The period is `7d` or `30d`, because those are the windows the owner-wide view
    reads offer. For 90 days, use `get_listing_stats` per listing.
  - `attention`: most urgent first, capped at 10, with `more` counting the
    rest. The kinds:
    - `unanswered_inquiries`, linked to the inbox;
    - `pending_benefit_usages` (owner decision D-11). Side `host` comes from
      `countPendingForHost` and links to `usos-de-beneficio`. Side `provider` is the
      provider inbox (`listForProvider`, `PENDING` declared by a host, only when
      `getOwn` finds the user's directory listing) and links to `proveedor`, where
      that inbox lives. Each side is omitted when zero.
    - `open_fix_request`, from `listingNoticesModel.readOwnerListingNotices` (the
      portal notices reader, purged excluded), linked to the editor hub;
    - `incomplete` and `missing_photos`: drafts only, evaluated in batch by
      `evaluateListingsPublishCompleteness` (the publish rules, one media query per
      vertical), linked to the first missing editor section or to `fotos`.
  - Cost: the reads are per vertical or owner-wide, so their number does not depend
    on how many listings the user has (a test asserts it). The serialized result is
    fitted to `MCP_RESULT_MAX_CHARS`. Attention items give way first. A result that
    cannot fit is refused, never returned over budget.
  - No new consent capability. Listings, stats, inquiries and reviews are covered.
    The pending-usage counts are covered by the `benefitUsages` capability
    (HOS-2332).
- `list_reviews`: the OWNER view of the reviews (HOS-2330, owner decisions D-7 and
  D-8). It returns every review of the user's own listings in every moderation
  state, `PENDING` and `REJECTED` text included, each labelled with its state.
  Soft-deleted and non-`ACTIVE` reviews never appear, in the items or in
  `countsByState`. `moderationReason` is not returned. The author is a display
  name only (the public rule of `resolveReviewerDisplayName`): no email, no user id,
  no image. It reads through `readOwnerListingReviews`, a function apart from the
  public reader (`readLatestListingReviews`) that `get_listing_stats`, the public
  lists and `reviewsCount` keep using with `ACTIVE` + `APPROVED`. Text is excerpted
  to the response budget and `textTruncated` says so; when a page of long reviews
  would overflow the budget the excerpt steps down (600, 300, 150, 60 characters).
  Paging reaches the newest 200 reviews of a search (the models cap one read at
  200 and the verticals merge by date); beyond that, narrow with `since`,
  `vertical` or `listingId`. A foreign or missing `listingId` is the uniform
  not-found, with a link to the owner's listings. There is no reply field, because
  the feature does not exist.
- `get_help`: answers from the help catalog in `@repo/help` (HOS-2410, which replaced the
  typed catalog of HOS-2333): Markdown articles under `packages/help/content/es/<audience>/`,
  compiled by `pnpm help:build` into a committed `help-index.json` that the API imports and
  validates at boot. Each article has its steps («Cómo se hace»), its portal destinations,
  its audiences and a `reviewedAt`. The search, shared with the web help center, is a
  normalized keyword match (case and accents ignored, keyword hits plus title words, best
  three), with no embeddings. A caller with an `audience` only gets the articles that list
  it. The `question` is untrusted: it is only compared against the catalog and is never
  echoed in the result, in a link or in a log. Links name a destination and are built
  through the portal route map and `HOSPEDA_SITE_URL`; an editor-section link is filled in
  from the caller's own listings (at most three per vertical) and falls back to the list
  pages when they cannot be read. It needs no new consent capability: static help plus the
  caller's own listing ids, which the `read` capability already covers. An unmatched
  question or an unknown `topicId` returns `topics: []`, `fallbackLinks` and a `note` that
  forbids inventing steps. Whoever changes a portal flow updates its article and the index
  in the same PR; `pnpm check:help-catalog` (CI `Guards` job) fails on a link to a page
  that is gone, a FAQ item or anchor that does not exist, a broken interlink or a stale
  index, and lists articles not re-checked in 180 days without failing.
- `update_listing_basic`: `amenityIds` and `featureIds` **replace** the whole set
  (`[]` clears it). To add or remove items of one category, use
  `update_listing_amenities`.
- `update_listing_amenities`: sends `(current minus remove) plus add` for the one kind
  named, so other categories and the other kind are carried over untouched. Every id
  must be a catalog row of that kind and category that applies to the listing's
  vertical (`applicable_verticals`), otherwise a validation error names the id and
  nothing is written. It runs the owner PATCH route's listing access and service
  call, and evicts the public accommodation cache after a write (HOS-2323).
- `set_listing_publication`: resuming an **archived** listing is two steps. The
  first `resume` returns it to draft, the second puts it online. Going online needs
  an active plan or the free trial and a free slot. Refusals map to Spanish reasons
  (`NO_COVERAGE`, `SUBSCRIPTION_REQUIRED`, `LISTING_LIMIT_REACHED`, and others).
- Benefit usages (`search_providers`, `list_benefit_usages`, `confirm_benefit_usage`,
  `reject_benefit_usage`, `undo_benefit_rejection`, HOS-2332). They mirror the
  HOS-376 routes and call the same `HostTradeUsageService` methods; see
  [route-architecture.md](route-architecture.md) for the flow itself.
  - **Role-blind.** Who may answer is decided by the row's `declaredBy` alone
    (`isUsageCounterpart`, shared with the service), never by the actor's role, and
    the tools declare no permission. One account can be host and provider at once
    (`host-provider@local.test`). A static test fails if a usage tool or
    `lib/host-trade-usage-transitions.ts` references a role or a permission.
  - **404, never 403.** A foreign usage, a missing id and the declarant answering
    their own declaration all give the same not-found, in preview and in commit.
    A FORBIDDEN from the service collapses to that not-found too.
  - **Same emails as the route.** The route and the tools both call
    `lib/host-trade-usage-transitions.ts`, which sends `notifyUsageConfirmed` and
    `notifyUsageRejected` (with the note). Undo sends nothing, as in the portal.
  - **Two steps.** The token binds user, client, tool, usage id and the note, so a
    reject commit whose note changed is refused. A usage that is no longer PENDING
    is refused before any token is issued.
  - **One writer.** The service's UPDATE is keyed on the state the transition
    leaves (`status = 'PENDING'` for confirm and reject, `REJECTED` plus the
    rejecter for undo). Two live tokens committed in parallel, a confirm and a
    reject, write once: the other matches zero rows, gets the not-pending refusal
    and sends no email.
  - **Ordered lists.** `listForHost` and `listForProvider` read newest first with
    an `id` tie-break (`BaseModel.findAll` does not order otherwise), which also
    fixes the portal's `/usages` and `/mine/usages` pages.
  - **No declaring from chat** (owner decision). `search_providers` returns each
    provider's `declareUsageUrl`, the portal page where a host declares a usage.
  - `search_providers` reads `listForHost`, so a provider outside the host's
    destinations never appears; a non-host gets FORBIDDEN with a link to the
    directory. Hidden columns (pending benefit, suspension, owner) are never
    returned. On the provider side of `list_benefit_usages`, a host-declared row
    names its host in `counterpartName` (display name only, never an e-mail), so
    the provider knows which host to confirm or reject (HOS-2376). A
    provider-declared row names the host only when the pair is already linked;
    otherwise it is `null`. Long
    texts step down to the response budget and `textTruncated` says so. The floor
    is measured too (`fitPageToBudget`): if it still overflows, trailing items are
    dropped, `hasMore` is `true` and `omittedItems` says how many, to be re-read
    with a smaller `pageSize`. A `search_providers` query of filler words only
    ("de la") is a validation error, not the whole directory.
- `get_inquiry` reads without a read receipt. A reply that was sent marks the inquiry
  read (best effort, failures are logged and swallowed).

## create_listing and the Maps link resolver

`create_listing` (HOS-2329) creates a DRAFT accommodation, venue or experience. It is
two steps, with the same token store as `reply_inquiry`.

1. **Preview.** No `confirmationToken`. It validates the input with that vertical's
   portal schema, checks the destination, runs the create route's listing access as a
   dry run, resolves `mapsUrl`, reads the publish quota and the duplicate-address rule,
   and answers what will be created plus a token. Nothing is written.
2. **Commit.** The same input plus the token. The token is bound to
   `user + client + 'create_listing' + vertical + the payload`, and to the point the
   preview resolved (kept with the token as its stash). Any change burns it. The link
   is not resolved again. Then the access step runs for real and the listing is
   created once, through the function the portal route itself calls.

What each vertical runs, and why:

| Vertical | Same as | Access step | Side effects |
|---|---|---|---|
| accommodation | `POST /protected/host-onboarding/start` (owner decision D-6) | none, as the route declares none | `createForOnboarding` (insert and HOST promotion in one transaction), the `AnalyticsEvents.onboardingStarted` and `accommodationDraftSaved` events, then the public cache eviction |
| venue | `POST /protected/venues/` | `CREATE`, business lines and sections from the body | `createForOwner` (role grant in the same transaction) |
| experience | `POST /protected/experiences/` | `CREATE` | `createForOwner` (role grant in the same transaction) |

- **No publish, no trial.** The row is born `DRAFT`. The trial starts on the first
  publish, never here.
- **Drafts are unlimited.** `CREATE` has no limit step; the cap is enforced at publish
  (`LISTING_LIMIT_REACHED`). The preview only notes it when the user is at the cap.
- **Location.** Coordinates come only from the user's Google Maps link. The street and
  number the user confirms feed the `location_key` through the services' create hooks;
  coordinates alone leave it null. When the address equals another published listing of
  the same owner, the preview warns and a later publish answers `DUPLICATE_LOCATION`.
  When there is no location, `nextSteps` links the editor's location section.

The resolver (`src/mcp/tools/listing/google-maps-link*.ts`, spec §5.5, owner decision D-4):

- Exact host allowlist on the parsed hostname (`maps.app.goo.gl`, `goo.gl` with a
  `/maps/` path, `google.com`, `www.google.com`, `maps.google.com`, `google.com.ar`,
  `www.google.com.ar`). `https:` only, no userinfo, no port (not even `:443`), no IP
  literal.
- A full URL is parsed with no network call. A short link is followed by hand: `HEAD`
  (then `GET` on 405), headers only, at most 5 redirects, every hop re-checked, 3 s per
  hop and 5 s in total.
- The socket resolves through a guarded `lookup` that refuses the hop if any address is
  private, loopback, link-local, metadata or reserved. The checked address is the one
  connected to, so DNS rebinding has no second lookup to use.
- An unreadable link, a point outside Argentina or a timeout is a `mapsUrl` validation
  error with a Spanish reason. The link and the place text are never logged; the place
  text is shown wrapped as untrusted data.

## reply_inquiry and its security limit

`reply_inquiry` sends a message to a guest, so it is two steps.

1. **Preview.** Call with `inquiryId` and `text`. Nothing is sent. The answer holds
   the exact text and a `confirmationToken`.
2. **Send.** Call again with the same `inquiryId`, the **same** `text` and the token.

The token (`confirmation-token-store.ts`):

- Is bound to `user + client + inquiry + sha256(text)`. Changing any of them
  invalidates it.
- Lives in Redis for 600 seconds. Redis holds only a digest of the token.
- Is consumed by one atomic `GETDEL`, so it is single use. A failed attempt on an
  existing token still burns it. Unknown, expired, reused and mismatched tokens are
  indistinguishable.
- **Fails closed.** If Redis is unavailable, no preview is issued and no send runs
  (`SERVICE_UNAVAILABLE`). Requires Redis 6.2 or later.

### Security limit

The confirmation token is returned **to the same model** that calls the tool. It
guards only against accidental, altered or replayed sends. It does **not** stop a
manipulated model (for example one steered by a guest message) from calling step 2
itself. The real human approval is the MCP client's per-tool approval prompt for a
write tool. Follow-up HOS-2247 (MCP elicitation) would move the confirmation to the
user's side.

## Adding a tool

Code lives in `src/mcp/tools/`. A tool is transport-agnostic. The MCP binding is in
`src/lib/mcp/`.

1. **Define it** in `src/mcp/tools/<area>/<name>.ts` with `defineTool({...})`:
   `name` (snake_case), `title`, `description` (English, model-facing), `inputSchema`
   (a strict Zod object, reuse `@repo/schemas` with `.pick()`), `isWrite`, optional
   `hints`, `emailUnverifiedOperation`, `reasonMessages`, and the `handler`. The
   handler is a thin adapter over service-core and returns `{ data }` or `{ error }`.
2. **Register it** by appending to `MCP_TOOL_DEFINITIONS` in
   `src/mcp/tools/registry.ts`.
3. **Validation.** `parseToolInput` in `run-tool.ts` validates raw arguments and
   answers a Spanish `VALIDATION_ERROR` naming the fields. Keep field descriptions
   short and Spanish messages in the schema.
4. **Audit hooks** (every call is audited automatically; a read records `auditTarget` only):
   - `auditTarget` returns `{ type, id }` of the entity.
   - `auditContentLength` returns the length of user content, never the content.
   - `auditDetails` returns scalar facts, for example `{ step }`. Never user content.
     A string value longer than 40 characters fails
     `test/mcp/tools/audit-details.registry.test.ts` (AC-C50).
   - The owner's history shows the tool by name, so add a label under
     `account.aiAssistants.activity.tools.<name>` in es, en and pt.
     `test/mcp/tools/activity-labels.registry.test.ts` fails until you do (AC-C49).
5. **Wrap untrusted text** with `wrapUntrustedText` and append `UNTRUSTED_DATA_NOTICE`
   to the description when the tool returns third-party text.
6. **Owner-only.** Resolve the resource through the owner-scoped readers and answer
   the same not-found for missing and foreign ids.
7. **Sweep test.** `test/mcp/tools/cross-user-not-found.sweep.test.ts` iterates the
   registry. A tool that takes a listing or inquiry id **must** be added to
   `ID_TOOL_CASES`. A tool with no resource id goes in `NO_RESOURCE_INPUT_TOOLS`.
   The coverage test **fails** if a registered tool is in neither.
8. **Do not read `@repo/db` tables at module level** in any module that
   `src/lib/auth` imports. The Better Auth adapter is built at boot and the tables
   must be read lazily (see the fix in `88131ac590`). A module-level read breaks
   boot with the flag off.

## Known follow-ups

| Item | State |
|---|---|
| HOS-2244 | Pausing a listing without a plan. |
| HOS-2247 | MCP elicitation, to move reply confirmation to the user's side. |
| Phase B | The entitlement gate, tool visibility and plan status shipped (see above); the panel's use of the access endpoint and the ChatGPT directory remain. |
| SDK `Server` | `createHospedaMcpServer` uses the low-level `Server`, which the SDK marks `@deprecated` ("advanced use"). It is deliberate: `McpServer` validates input in English and bypasses the Spanish message and the audit. Revisit on SDK upgrades. |
| `NO_STATS_ENTITLEMENT` plan names | The note still names no plan; reading which plan versions carry `view_basic_stats` from the catalog is pending (the `subscription` block itself shipped with HOS-2328). |
| Billing refusal mapping | `set_listing_publication` maps billing refusals to reasons by matching service message text. There is no guard that fails if the text changes. |

## Related

- [Assistant activity](mcp-activity.md) (retention, reader, admin log)
- [Route architecture](route-architecture.md#ai-connection-routes-hos-2184) (protected `ai-connections`)
- [Error contract](error-contract.md)
- [Environment variables](../../../docs/guides/environment-variables.md)
- Spec: `.specs/HOS-2184-mcp-server/spec.md`
