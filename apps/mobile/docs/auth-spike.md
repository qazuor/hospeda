# SPEC-243 T-003 — Better Auth / Expo Authentication Spike

## Status

**Static spike COMPLETE** — typecheck, lint, test, and `expo export --platform ios` all
pass. The live device flow (sign-in → cookie persist → session refresh → sign-out) is
**UNVERIFIED** here. It MUST be run on a real device or simulator by the owner before
T-004 (auth screens) is considered validated.

---

## What Was Wired

### 1. Server plugin — `apps/api/src/lib/auth.ts`

- Added `@better-auth/expo@1.4.18` to `apps/api/package.json` dependencies.
- Imported `expo` from `@better-auth/expo` (the `.` export, server-only).
- Added `expo()` to the `plugins: [admin(...), expo()]` array.
- Appended `'hospeda://'` to `trustedOrigins` so OAuth and magic-link callbacks can
  deep-link back into the native app.

**The `expo()` server plugin does NOT import any Expo or React Native packages.**
It is pure Node.js and safe inside the Hono API build. The only side effects are:

| Effect | Details |
|--------|---------|
| New endpoint | `GET /api/auth/expo-authorization-proxy` — OAuth deep-link proxy for native |
| `onRequest` hook | Synthesises a missing `origin` header from the `expo-origin` header that `expoClient` sends on every native request. Without this, Better Auth's origin-validation would reject all native requests. |
| `trustedOrigins` in dev | Automatically adds `"exp://"` (Expo Go scheme) in `NODE_ENV === "development"`. |
| Web / admin behaviour | **Unchanged.** No cookie or session logic is modified for web or admin clients. |

### 2. Mobile client — `apps/mobile/src/lib/auth-client.ts`

- Added `@better-auth/expo@1.4.18`, `better-auth@1.4.18`, `expo-secure-store@~56.0.4`,
  `expo-web-browser@~56.0.5`, and `expo-network@~56.0.5` to `apps/mobile/package.json`.
- Created `apps/mobile/src/lib/auth-client.ts`.

**Import paths:**

- Server plugin: `import { expo } from '@better-auth/expo'`
- Client plugin: `import { expoClient } from '@better-auth/expo/client'`

**`expoClient` options used:**

| Option | Value | Purpose |
|--------|-------|---------|
| `scheme` | `'hospeda'` | Matches `expo.scheme` in `app.json`; used to build `hospeda://` deep-link URLs |
| `storagePrefix` | `'hospeda'` | SecureStore key prefix (`hospeda_cookie`, `hospeda_session_data`) |
| `storage` | `SecureStore` (from `expo-secure-store`) | Sync `getItem`/`setItem` interface; SDK 56 ships compatible sync methods |

**Exports from `auth-client.ts`:**

```ts
export { authClient, signIn, signUp, signOut, useSession, getCookie }
```

---

## Transport Decision (RESOLVED)

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Fetch transport | `@better-fetch/fetch` (bundled inside `@better-auth/expo/client`) | Ships with the package, no extra dep; handles cookie injection via `init()` hook |
| Cookie persistence | `expo-secure-store` sync API (`getItem`/`setItem`) | Secure enclave storage on iOS; Android Keystore on Android; works on SDK 56 |
| Session cookie key | `hospeda_cookie` (JSON blob) | Colon-stripped by `normalizeCookieName` (SecureStore rejects colons) |
| Online manager | `expo-network` (dynamic import, graceful fallback) | `import("expo-network").catch(() => setOnline(true))` — SDK 56 delivers `expo-network@56.0.5` which does NOT satisfy the peerDep `^8.0.7`, but the fallback means the app stays functional (online is assumed). See **Known Mismatch** below. |

---

## `hospeda://` scheme and trustedOrigins

```
app.json:   "scheme": "hospeda"
auth.ts:    trustedOrigins: [...parseTrustedOrigins(), 'hospeda://']
```

The `expo()` plugin auto-adds `"exp://"` in development (Expo Go). In production only
`hospeda://` is in scope. OAuth callback redirects (Google, Facebook) will use
`hospeda://` as the return URL; this must also be registered in the OAuth provider's
allowed redirect URIs (Google Cloud Console / Facebook Dev Console) before OAuth social
sign-in can work on native.

For Expo Go testing in development, the `exp://` trust is automatic. For standalone/EAS
builds the scheme is `hospeda://`.

---

## Known Mismatch: expo-network semver

`@better-auth/expo@1.4.18` declares `peerDependencies: { "expo-network": "^8.0.7" }`.

Expo SDK 56 ships `expo-network@56.0.5`. The package version 56.0.5 does **not**
satisfy `^8.0.7` (which requires major = 8). However, the plugin uses `expo-network`
only via a **dynamic import with a catch block**:

```js
import("expo-network").then(({ addNetworkStateListener }) => { ... })
  .catch(() => { this.setOnline(true); });
```

This means:

- At runtime, if `expo-network` is present and its `addNetworkStateListener` API is
  compatible (SDK 56 still exports it), the online manager works normally.
- If the dynamic import fails for any reason, the online manager falls back to
  `isOnline = true` — the app keeps working, just without network-state-driven
  session refresh pausing.
- The peerDep warning from pnpm is expected and non-blocking. **Do not attempt to
  install `expo-network@8.x` — that would downgrade from SDK 56 to SDK 51/52 era.**

**Recommendation:** When `@better-auth/expo` publishes a 1.5.x or later release that
targets SDK 56 peerDeps, upgrade at that time. Until then, the fallback is safe.

---

## What Is VERIFIED (this spike)

| Check | Result |
|-------|--------|
| `pnpm --filter mobile typecheck` | exit 0 |
| `pnpm --filter mobile lint` | exit 0 (11 files, 0 issues) |
| `pnpm --filter mobile test` | exit 0 (no test files yet — T-004 adds them) |
| `expo export --platform ios --output-dir /tmp/t003-export` | exit 0, 1316 modules bundled, 4.9 MB .hbc |
| `pnpm --filter hospeda-api typecheck` | exit 0 |
| `pnpm --filter admin typecheck` | exit 0 |
| `pnpm --filter hospeda-web typecheck` | exit 0 |
| API auth unit tests (21 tests: trusted-origins + cookie-domain) | 21/21 pass |

## What Is UNVERIFIED (requires device/simulator)

- **Sign-in flow**: `signIn.email({ email, password })` → `expo-secure-store` persists
  the session cookie → `useSession()` returns the authenticated session.
- **Session persistence**: app restart → SecureStore key `hospeda_cookie` is read on
  startup → session is restored without a new sign-in.
- **Session refresh**: Better Auth refreshes the session token → new cookie value is
  written to SecureStore via the `onSuccess` hook.
- **Sign-out**: `signOut()` → `hospeda_cookie` and `hospeda_session_data` are cleared
  from SecureStore → `useSession()` returns `null`.
- **OAuth social sign-in**: `signIn.social({ provider: 'google' })` → `expo-web-browser`
  opens the authorization URL → OAuth callback deep-links to `hospeda://...cookie=...` →
  cookie is extracted and persisted.
- **Network state manager**: `expo-network@56.0.5` `addNetworkStateListener` is
  compatible at runtime (peerDep version mismatch is semver-only; actual API is stable).

**Test users (after `pnpm db:fresh-dev`):**

- Tourist: `tourist-free@local.test` / `Password123!`
- Host: `host-basico@local.test` / `Password123!`

---

## Server-Side Follow-ups (tracked in SPEC-243)

1. **OAuth redirect URIs for native**: When enabling Google / Facebook social sign-in on
   native, add `hospeda://` to the allowed redirect URIs in Google Cloud Console and
   Facebook Developer Console. The callback URL for native OAuth is the `expo-authorization-proxy`
   endpoint, which redirects back to `hospeda://?cookie=...`.
2. **CORS for native**: Native fetch calls do NOT send `origin`, so the current CORS
   middleware (which requires `origin` to match trusted origins) is bypassed by the
   `expo()` plugin's `expo-origin` → `origin` header substitution. Verify CORS
   middleware order in `apps/api/src/app.ts` to ensure the substitution fires before
   CORS validation.
3. **Production `trustedOrigins` audit**: After EAS build with the `hospeda://` scheme,
   run a quick smoke to confirm the native app's requests pass Better Auth's origin
   check in production (where `HOSPEDA_EXTRA_TRUSTED_ORIGINS` does not include the
   scheme and the `expo()` plugin does not add `exp://`).
