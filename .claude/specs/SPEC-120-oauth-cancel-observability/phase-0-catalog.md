# SPEC-120 — Phase 0 Catalog: Better Auth OAuth Error Redirect Contract

> **Deliverable for**: T-120-01
> **Captured on**: 2026-05-15
> **Environment**: staging (`staging.hospeda.com.ar` + `staging-api.hospeda.com.ar`)
> **Better Auth version**: `^1.4.18` (from `apps/api/package.json`)
> **Method**: live reproduction by qazuor against staging — Google + Facebook user-cancel flows.

## Summary

When OAuth fails (user cancel, provider rejection, or other RFC 6749 §4.1.2.1 errors), Better Auth `^1.4.18` redirects the browser to the `errorCallbackURL` (already set client-side in `apps/web/src/components/auth/SignIn.client.tsx:123`) with a filtered subset of the provider's query string.

**Preserved by Better Auth in the final redirect**: `error`, `error_description`.
**Discarded by Better Auth**: `state`, `error_code` (FB), `error_reason` (FB), and any provider-specific params.

The wrapping infrastructure already exists end-to-end:

- Client sets `errorCallbackURL = ${origin}${pathname}` when calling `signIn.social()`.
- API `/api/auth/callback/<provider>` route is owned by Better Auth via the catch-all in `apps/api/src/routes/auth/handler.ts:476-479`.
- API returns a `302` redirect to the `errorCallbackURL` carrying `?error=...`.
- Web `signin.astro` page receives the redirect — but currently **does not read the `error` query param**, so the failure is invisible to the user.
- API does **not** emit a Sentry event for the cancel — the OAuth callback is a successful redirect from the API's perspective (no exception thrown by Better Auth).

## Reproduced flows

### Test 1 — Google user cancel

Steps: revoke Google OAuth grant for Hospeda, navigate to `/es/auth/signin/`, click "Continuar con Google", click "Cancelar" on consent screen.

**Provider → API (the URL Google calls back on)**:

```
GET https://staging-api.hospeda.com.ar/api/auth/callback/google?error=access_denied&state=AIM8S7JOQECbn4E92RRg4TQvejNbKx0b
```

**API response (the 302 the API emits)**:

```
HTTP/3 302
location: https://staging.hospeda.com.ar/es/auth/signin/?error=access_denied
content-type: application/json
content-length: 0
set-cookie: __Secure-better-auth.state=; Max-Age=0; Domain=hospeda.com.ar; Path=/; HttpOnly; Secure; SameSite=Lax
```

**Final URL the browser lands on**:

```
https://staging.hospeda.com.ar/es/auth/signin/?error=access_denied
```

**Observations**:

- Google sends only `error` (no `error_description`).
- Better Auth correctly clears the state cookie (`__Secure-better-auth.state`) on the failure path — no state leak.
- The OAuth callback counts against the `ratelimit-type: auth` bucket (50 req/window). Not a problem for normal usage; relevant if a future runaway script triggers thousands of cancels.

### Test 2 — Facebook user cancel

Steps: revoke Facebook OAuth grant for Hospeda, navigate to `/es/auth/signin/`, click "Continuar con Facebook", click "Cancel" on the consent dialog.

**Provider → API**:

```
GET https://staging-api.hospeda.com.ar/api/auth/callback/facebook?error=access_denied&error_code=200&error_description=Permissions error&error_reason=user_denied&state=rvw81pJ6ia8lYbvzXUOE8-eCsCUu4Rdp
```

**API response (302)**:

```
HTTP/3 302
location: https://staging.hospeda.com.ar/es/auth/signin/?error=access_denied&error_description=Permissions+error
content-type: application/json
content-length: 0
set-cookie: __Secure-better-auth.state=; Max-Age=0; Domain=hospeda.com.ar; Path=/; HttpOnly; Secure; SameSite=Lax
```

**Final URL the browser lands on**:

```
https://staging.hospeda.com.ar/es/auth/signin/?error=access_denied&error_description=Permissions+error#_=_
```

**Observations**:

- Facebook sends `error`, `error_code`, `error_description`, `error_reason` — Better Auth strips everything except `error` + `error_description`.
- Facebook adds `#_=_` to the redirect — this is the legacy "Facebook trailing hash bug" present since 2011. It's harmless, but our `history.replaceState` cleanup in Phase 2 must remove the hash too, not just the query, otherwise the banner-cleared URL will still be `https://.../signin/#_=_`.
- `error_description` is provider-supplied and free-form (`"Permissions error"`). It is **not** locale-aware and varies between providers — we use it as Sentry context only, never as user-facing UI text.

### Test 3 — Provider error (`redirect_uri_mismatch`)

**Not reproduced** in this session — would require temporarily breaking the Google Cloud Console redirect URI. Catalogued from RFC 6749 §4.1.2.1 and Better Auth source for completeness.

Expected behavior: Google likely shows its own error page and never redirects back to Hospeda (the redirect URI on its side does not match anything it trusts). If by some path it does redirect back, the code would be `redirect_uri_mismatch`.

### Sentry verification

Filtered Sentry by `environment:staging`, time window ±10min around tests. **Zero events** for either cancellation. Confirmed without the filter too — nothing related appears anywhere. This validates the central premise of SPEC-120: OAuth failures are completely invisible to operators today.

## Canonical error code catalog

Codes Better Auth `^1.4.18` is observed (or specified) to propagate as `?error=<code>` to `errorCallbackURL`:

| Code | Source | Trigger | Sentry level | Provider-confirmed |
|---|---|---|---|---|
| `access_denied` | RFC 6749 §4.1.2.1 | User cancelled consent / denied scope | `warning` | Google ✓, Facebook ✓ |
| `redirect_uri_mismatch` | RFC 6749 §4.1.2.1 | Configured redirect URI doesn't match provider whitelist | `error` | catalogued, not reproduced |
| `invalid_request` | RFC 6749 §4.1.2.1 | Malformed authorization request | `error` | catalogued |
| `unauthorized_client` | RFC 6749 §4.1.2.1 | Client not authorized for this grant type | `error` | catalogued |
| `unsupported_response_type` | RFC 6749 §4.1.2.1 | Wrong `response_type` param | `error` | catalogued |
| `invalid_scope` | RFC 6749 §4.1.2.1 | Requested scope is invalid or revoked | `error` | catalogued |
| `server_error` | RFC 6749 §4.1.2.1 | Provider-side internal error | `error` | catalogued |
| `temporarily_unavailable` | RFC 6749 §4.1.2.1 | Provider currently down / throttled | `error` | catalogued |
| `oauth_state_mismatch` | Better Auth internal | CSRF state cookie missing or mismatched (e.g. cookie expired between authz and callback) | `error` | catalogued from BA source |
| `account_not_linked` | Better Auth internal | Email belongs to existing account on a different provider, AND `accountLinking.trustedProviders` does not include the current provider | `error` | **N/A in Hospeda** — both Google + Facebook are in `trustedProviders` (`apps/api/src/lib/auth.ts:386`), so auto-linking handles this case before it surfaces as an error |
| _(anything else)_ | unknown | Future provider-specific or Better Auth-specific code | `error` | use `unknown` fallback i18n key |

## Implications for Phase 1 (contract decisions)

Based on the observed behavior, the contract should be:

**UI side (web)**:

1. `signin.astro` reads `Astro.url.searchParams.get('error')` server-side and passes it as a prop to `SignIn.client.tsx`.
2. The island maps the code via `t('auth-ui.signIn.errors.oauth.<code>', { provider })` with `oauth.unknown` as the fallback.
3. The banner reuses the existing `<div role="alert" className={styles.error}>` in `SignIn.client.tsx:158-165` — no new component.
4. On mount, the island calls `history.replaceState({}, '', window.location.pathname)` to strip BOTH query and hash. This is critical because Facebook adds `#_=_` and a naive `?` strip leaves the hash dangling.
5. `error_description` is **not** rendered. It's free-form, provider-specific, untranslated — useless for the user.

**API side**:

1. The catch-all in `apps/api/src/routes/auth/handler.ts:476-479` is wrapped: after `await auth.handler(c.req.raw)`, inspect the response. If `status === 302` AND the request path matches `/callback/<provider>` AND the `Location` header contains `?error=`, capture a Sentry event.
2. Sentry capture uses `Sentry.captureMessage` (not `captureException` — Better Auth didn't throw) with:
   - `level`: `'warning'` if code is `access_denied`, `'error'` otherwise.
   - `tags`: `{ provider, error_code, environment }` (environment is auto-tagged by SPEC-103 T-076).
   - `extra`: `{ error_description, request_id, user_agent }`.
3. The provider is extracted from the request URL path — `provider = url.pathname.split('/').pop()`.
4. Optional but recommended: rewrite the `Location` header to append `&provider=<name>` so the web side can render a provider-specific banner ("Cancelaste con Google" vs "Cancelaste con Facebook") instead of generic text. This is the cleanest way to surface provider identity without touching Better Auth config or cookies.

## Edge cases noted

- **Rate-limit hits**: OAuth callbacks count against the `auth` rate-limit bucket. If a 429 is returned, that's a separate failure mode and should be Sentry-captured at a different level (`info` or `warning`). Out of scope for this spec; flag if discovered.
- **HTTP/3 transport**: staging serves over h3 via Cloudflare. The 302 chain works correctly over h3; no protocol-level concerns.
- **`Domain=hospeda.com.ar` cookie scoping**: state cookie is cleared on the apex domain so it works across `staging.*` subdomains. Already handled by Better Auth's `crossSubDomainCookies` config.

## Files / lines referenced

- `apps/api/src/lib/auth.ts:342-371` — socialProviders config (Google + Facebook conditional).
- `apps/api/src/lib/auth.ts:383-388` — `accountLinking.trustedProviders` (rules out `account_not_linked` for our providers).
- `apps/api/src/routes/auth/handler.ts:476-479` — catch-all that delegates to Better Auth (Sentry capture lands here).
- `apps/api/src/lib/sentry.ts` — `captureMessage`/`captureException` API, env tagging via `HOSPEDA_SENTRY_ENVIRONMENT`.
- `apps/web/src/pages/[lang]/auth/signin.astro` — currently does not read `?error=`.
- `apps/web/src/components/auth/SignIn.client.tsx:123-124` — already sets `errorCallbackURL`. Already has an `<div role="alert">` for errors at line 158-165.
- `packages/i18n/src/locales/es/auth-ui.json:17-26` — existing `signIn.errors.*` namespace; OAuth keys to be added under a new `oauth` sub-key.

## Status

**T-120-01 — DONE.** Ready to proceed to T-120-02 (Phase 1 contract finalization based on this catalog).
