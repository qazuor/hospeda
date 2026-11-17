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

## Audit events

Both use the existing `auditLog()` pipeline (`audit_log_entries`). No new table.

| Event | When | Notable fields |
|---|---|---|
| `mcp.tool.call` | Every **write** tool call, including malformed ones | actor, `clientId`, tool, target, outcome (`success`, `denied`, `error`), `errorCode`, `contentLength`, `details`. The client-declared name is never recorded (untrusted text) |
| `mcp.connection.revoked` | A user disconnects an assistant | actor, `clientId`, `removed` counts (consents, refresh tokens, access tokens) |

For `reply_inquiry`, `details.step` is `preview` or `send`. Content (a reply text)
is never recorded, only its length. Auditing never changes a tool result: a
failure to write the record is logged and swallowed.

## Tool catalog

Eleven tools. `readOnlyHint` is derived from `isWrite`, so the two cannot disagree.

| Tool | Kind | Annotations | Notes |
|---|---|---|---|
| `list_my_listings` | read | read-only | Accommodations, venues and experiences the user owns, in any state. At most 100 per vertical; `total` and `hasMore` say when the list is truncated. |
| `get_listing` | read | read-only | Editable fields, amenities and features as `{ id, slug }`. |
| `list_amenities_and_features` | read | read-only | Ids to use in `update_listing_basic`. Each entry carries its `category`. |
| `get_listing_amenities` | read | read-only | The catalog of one listing grouped by category (amenity `type`, feature `category`) with `selected` marked, scoped to the listing's vertical. Truncates to the response budget and lists `omittedGroups`. |
| `get_listing_stats` | read | read-only | Periods `7d`, `30d`, `90d`. Needs the plan's `view_basic_stats` entitlement. Reviews are untrusted text. |
| `list_inquiries` | read | read-only | Filters: `status`, `listingId`, paging. Accommodations only. |
| `get_inquiry` | read | read-only | Never marks the inquiry read. |
| `update_listing_basic` | write | idempotent, not destructive | Accommodation, venue, experience. |
| `update_listing_amenities` | write | idempotent, not destructive | Adds or removes the items of ONE category; the rest of the set is untouched. No confirmation token. |
| `set_listing_publication` | write | **destructive**, not idempotent | `pause` or `resume`. |
| `reply_inquiry` | write | open-world, not destructive, not idempotent | Two-step, see below. |

Rules that apply to every tool:

- **Owner-only.** A listing or inquiry the user does not own, a staff-only id and a
  non-existent id all answer the same not-found error. There is no 403 and no
  entitlement error that would confirm the id exists. Staff (ADMIN, SUPER_ADMIN)
  get no bypass.
- **Untrusted data.** Text written by guests or reviewers is wrapped in
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
  views are kept 95 days. Accommodations add a block with favorites (advanced stats
  only), inquiries of this listing, and owner-wide inquiry figures. Metrics a
  vertical does not have are omitted, never zero.
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
- `get_inquiry` reads without a read receipt. A reply that was sent marks the inquiry
  read (best effort, failures are logged and swallowed).

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
4. **Audit hooks** (write tools are audited automatically):
   - `auditTarget` returns `{ type, id }` of the entity.
   - `auditContentLength` returns the length of user content, never the content.
   - `auditDetails` returns scalar facts, for example `{ step }`. Never user content.
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
| Phase B | Entitlement gate on `/mcp`, plan status, ChatGPT directory. Blocked on HOS-1352 and HOS-2066. |
| SDK `Server` | `createHospedaMcpServer` uses the low-level `Server`, which the SDK marks `@deprecated` ("advanced use"). It is deliberate: `McpServer` validates input in English and bypasses the Spanish message and the audit. Revisit on SDK upgrades. |
| Billing refusal mapping | `set_listing_publication` maps billing refusals to reasons by matching service message text. There is no guard that fails if the text changes. |

## Related

- [Route architecture](route-architecture.md#ai-connection-routes-hos-2184) (protected `ai-connections`)
- [Error contract](error-contract.md)
- [Environment variables](../../../docs/guides/environment-variables.md)
- Spec: `.specs/HOS-2184-mcp-server/spec.md`
