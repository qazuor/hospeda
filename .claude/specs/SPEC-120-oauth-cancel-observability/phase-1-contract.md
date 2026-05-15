# SPEC-120 — Phase 1 Contract

> **Deliverable for**: T-120-02
> **Decided on**: 2026-05-15 by qazuor based on Phase 0 catalog
> **Status**: confirmed, implementation may proceed

## Contract summary

End-to-end behavior when a user cancels (or any RFC 6749 error occurs) during OAuth signin:

```
1. User clicks "Continuar con <provider>" on signin page.
2. Better Auth redirects to provider's OAuth consent.
3. User cancels (or provider rejects).
4. Provider GETs /api/auth/callback/<provider>?error=<code>&...
5. Better Auth processes, builds 302 to errorCallbackURL?error=<code>&error_description=...
6. API catch-all wrapper intercepts the 302:
     a. Parses Location query for `error`.
     b. Captures Sentry event with provider tag + RAW callback query as extra.
     c. Rewrites Location header to inject `&provider=<name>`.
7. Browser navigates to /es/auth/signin/?error=<code>[&error_description=...]&provider=<name>
8. signin.astro reads the query, passes structured props to SignIn island.
9. Island maps code → i18n key → banner; calls history.replaceState to strip query AND hash.
10. User sees: "Cancelaste el inicio de sesión con Google. Intentá de nuevo o usá otro método."
```

## Decisions (with rationale)

### Decision 1 — Provider visibility

**Adopted: (A) Provider-aware banner.**

The API wrapper in `apps/api/src/routes/auth/handler.ts` rewrites the `Location` header of the 302 returned by Better Auth to append `&provider=<name>`. The provider is extracted from the request URL path (`/api/auth/callback/<provider>`).

- This is the only state we add to the redirect — clean, stateless, no cookie or storage side-channel.
- If `provider` is already in the location for some reason (future Better Auth versions, custom callbacks), the wrapper skips the rewrite (idempotent).
- The web side falls back to a generic message if `provider` is missing or unknown.

### Decision 2 — `error_description` handling

**Adopted: (A) Sentry + console only; never UI.**

- `error_description` is provider-supplied free-form text (e.g. Facebook's `"Permissions error"`). It's not i18n-translated and would break visual consistency with the i18n-controlled banner.
- It IS valuable for debugging and post-mortem, so:
  - `Sentry.captureMessage` includes it in `extra.error_description`.
  - The web island calls `console.warn('[OAuth] <code>:', error_description)` so a local browser dev session sees the raw description without UI noise.
- Banner content is 100% controlled by i18n keys.

### Decision 3 — Sentry payload

**Adopted: (A) Capture RAW callback query.**

The provider sends a richer query than Better Auth re-emits (Facebook in particular: `error_code`, `error_reason`). These are valuable for distinguishing user-cancel from other denials post-mortem at no extra cost.

The wrapper captures the **incoming** request query (what the provider sent) as `extra.provider_raw_query` — a flat object of all params except `state` (filtered for noise). The filtered `error` + `error_description` from the final redirect go into `extra.redirect_query` for completeness.

## Per-component contracts

### `apps/api/src/routes/auth/handler.ts` — catch-all wrapper

Replace the bare catch-all with a version that:

1. Captures the original request URL + path BEFORE delegating.
2. Awaits `auth.handler(c.req.raw)`.
3. If `response.status === 302` AND the request path matches `/callback/<provider>` (any provider name):
   a. Parses `Location` header.
   b. If Location has `?error=`, calls `Sentry.captureMessage(...)`:
      - **level**: `'warning'` if code is `access_denied`, `'error'` otherwise.
      - **tags**: `{ module: 'auth.oauth', provider: <name>, error_code: <code> }`.
      - **extra**: `{ error_description, redirect_location, provider_raw_query, request_id, user_agent }`.
   c. If Location does not already contain `&provider=`, appends it.
   d. Returns a new `Response` with the modified `Location` header (Response headers are immutable; we must construct a new Response).
4. If `response.status !== 302` or no `?error=`, returns the response unchanged (zero overhead for the happy path).

### `apps/web/src/pages/[lang]/auth/signin.astro` — SSR query reading

Reads `Astro.url.searchParams`:

- `error` → only if it matches `/^[a-z_]{1,64}$/` (allowlist regex). Reject anything else as `'unknown'` to prevent XSS via injected codes.
- `error_description` → only if present, truncated to 200 chars. Passed to client for console.warn only.
- `provider` → only if matches `/^[a-z]{1,32}$/`. Reject anything else as `undefined`.

These are passed as a single optional prop `initialOAuthError?: { code: string; description?: string; provider?: string }` to the `<SignIn>` island.

### `apps/web/src/components/auth/SignIn.client.tsx` — banner rendering

- New prop `initialOAuthError?: { code: string; description?: string; provider?: string }`.
- On mount (`useEffect`):
  1. If `initialOAuthError` present:
     - Compute banner text: `t('auth-ui.signIn.errors.oauth.' + code, { provider: providerLabel(provider) })`. If the i18n lookup falls back (key missing), use `auth-ui.signIn.errors.oauth.unknown` with provider interpolation.
     - `setError(bannerText)`.
     - `console.warn('[OAuth] ' + code + ':', description ?? '(no description)')`.
  2. Always: call `history.replaceState({}, '', window.location.pathname)`. Strips BOTH query AND hash (handles Facebook's `#_=_`).
- `providerLabel(provider)`: returns `"Google"`, `"Facebook"`, or capitalized `provider` string. Stays in the island, not i18n (provider names are brand names — same in all locales).

### `packages/i18n/src/locales/{es,en,pt}/auth-ui.json` — new keys

New sub-namespace under existing `signIn.errors.oauth.*`:

```json
"oauth": {
    "access_denied": "Cancelaste el inicio de sesión con {provider}. Intentá de nuevo o usá otro método.",
    "redirect_uri_mismatch": "Hay un problema de configuración con {provider}. Por favor, contactanos.",
    "invalid_request": "La solicitud a {provider} es inválida. Intentá de nuevo en unos minutos.",
    "unauthorized_client": "Nuestra aplicación no está autorizada en {provider}. Por favor, contactanos.",
    "unsupported_response_type": "Hay un problema técnico con {provider}. Por favor, contactanos.",
    "invalid_scope": "Los permisos solicitados a {provider} no son válidos. Por favor, contactanos.",
    "server_error": "{provider} está teniendo problemas. Intentá de nuevo en unos minutos.",
    "temporarily_unavailable": "{provider} no está disponible en este momento. Intentá de nuevo en unos minutos.",
    "oauth_state_mismatch": "Tu sesión expiró durante el inicio de sesión. Intentá de nuevo.",
    "unknown": "No pudimos completar el inicio de sesión con {provider}. Intentá de nuevo más tarde."
}
```

Default locale is Spanish (project convention — en/pt fall back to es until translated, but we still seed the same structure in all three to keep keys in sync).

## Non-goals (re-confirmed from spec)

- No new auth/error page route — recoverable error reuses `/auth/signin/`.
- No cookie / localStorage flash channel — query string is sufficient.
- No retry of the cancelled provider on error — user re-initiates manually.
- No metrics emission to non-Sentry destinations (logger handles audit if needed, but not in this spec).

## Status

**T-120-02 — DONE.** Implementation of T-120-03 / 04 / 05 may proceed.
