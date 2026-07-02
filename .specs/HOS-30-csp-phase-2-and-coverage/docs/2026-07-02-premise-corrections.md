# HOS-30 — 2026-07-02 session: three premise corrections before continuing 2.A/2.B/2.C

Picked up from T-006 (in_progress). Before continuing the authenticated crawl
(2.A) or implementing the MercadoPago allowlist (2.B), this session verified
the state of the two "already done" prerequisites (2.C home header fix, T-023
Sentry cleanup) and the technical premise of 2.B. All three turned out to need
correction. Documented here instead of pushed through unilaterally, per the
architectural-decision consultation rule — each item below ends with options
and a recommendation, not a decision already made.

## 1 — 2.C (home CSP header) is NOT actually fixed in production

**Claim in tracking**: T-004/T-005 "completed" — `/es/` emits the CSP header
after the `context.isPrerendered` fallback fix (PR #1857).

**Reality, verified two independent ways**:

1. **Live staging curl** (2026-07-02):

   ```
   curl -sI https://staging.hospeda.com.ar/es/          -> NO content-security-policy* header
   curl -sI https://staging.hospeda.com.ar/es/alojamientos/ -> content-security-policy-report-only: ... (present)
   ```

   The `/es/` response carries `Last-Modified`/`ETag`/`Accept-Ranges: bytes` —
   static-file-server fingerprints, not present on the SSR `/alojamientos/`
   response.

2. **Local reproduction, independent of any staging deploy/CDN staleness**:
   Built `apps/web` in production mode (`astro build`) and ran the standalone
   Node server directly, bypassing Cloudflare/Coolify entirely. Same result:
   `/es/` -> no CSP header, `/es/alojamientos/` -> header present. This rules
   out "stale staging deploy" as the explanation — the bug is in the current
   `staging`-branch code itself.

**Root cause** (confirmed via Astro's own docs, `mcp__context7__query-docs`
on `/withastro/docs`): `@astrojs/node`'s `staticHeaders: true` (set in
`apps/web/astro.config.mjs:73`) only forwards headers that Astro's **native**
`security: { csp: true }` build feature registers into the `routeToHeaders`
map via the `astro:build:generated` hook. It does **not** generically capture
arbitrary headers a middleware sets on the `Response` object for prerendered
routes. This app builds CSP by hand in `buildCspHeader()` / middleware
`response.headers.set()` — a mechanism `staticHeaders` was never wired to.

For a prerendered route (`export const prerender = true` on
`apps/web/src/pages/[lang]/index.astro`), the middleware's `next()` ->
`response.headers.set(...)` path only executes **once, at build time**, to
produce the static HTML file. At runtime, `@astrojs/node` serves that file
through its own static-file code path (hence the `Last-Modified`/`ETag`
headers), which never re-invokes middleware and has no access to whatever
that one build-time `Response` object had on it. T-004's `context.isPrerendered`
fallback fixed the `isHtmlPage` detection (so the header-setting branch is
entered instead of skipped) but that branch's effect is discarded before it
ever reaches a real request.

The existing regression test (`apps/web/src/lib/__tests__/csp-middleware.test.ts`,
"middleware.ts — prerendered CSP emission guard") only asserts that specific
strings (`context.isPrerendered`, etc.) appear in the middleware source file.
It cannot and does not prove the header reaches an actual HTTP response —
which is exactly the gap that let this ship as "completed". Added a
clarifying comment to that file this session (no assertions changed) so
future readers don't take it as proof of runtime behavior.

**Why this blocks 2.D**: the spec's own prerequisite list for the enforce
flip requires "2.C home page emits the CSP header consistently". That is
false today. Flipping to enforce with `/es/` (the highest-traffic route)
carrying zero CSP protection is a real regression in security posture, not
just an inconsistency.

**Options** (none applied — architectural call):

| # | Approach | Pros | Cons |
|---|---|---|---|
| A | Migrate to Astro's native `security: { csp: true }` and let Astro generate directives (nonce nuances need re-checking — Astro's native CSP is newer and its `strict-dynamic`/hash support may not cover every pattern this app relies on, e.g. the `style-src-attr 'unsafe-inline'` carve-out). `staticHeaders: true` then does what its comment always assumed it would. | Fixes the gap for ALL prerendered routes at once (not just home), and is the "intended" path per the astro.config.mjs comment. | Biggest lift — touches the whole CSP-generation mechanism, needs re-validating every directive Astro's native builder supports. |
| B | Remove `export const prerender = true` from `[lang]/index.astro` — force home to go through SSR like every other CSP-covered route. | One-line change, immediately consistent with how `/alojamientos/` etc. already work correctly. | Home is the highest-traffic route; losing prerendering has a real perf cost (SSR renders it per-request instead of serving a pre-built static file). Needs a perf sign-off. |
| C | Fix at the reverse-proxy layer (Cloudflare/Traefik rule injecting the header for `/es/` specifically). | No app-code change. | Duplicates the CSP value in two places (app + infra config) — a drift risk every time a directive changes; infra-only fix owned outside this repo/PR. |

**Recommendation**: B for a fast, low-risk close of 2.C (accept the perf
trade-off on one route, revisit A later as the general fix once the app has
more prerendered routes needing it). Flagging for the user's call rather than
applying it, since it's a product/perf trade-off on the top route.

## 2 — 2.B's premise (embedded MercadoPago Brick) does not match the current integration

**Claim in spec**: "MercadoPago's Brick widget loads JS bundles, calls
back-end APIs, and embeds an iframe for sensitive card-data entry" on
`/es/suscriptores/checkout/`, requiring `frame-src`/`connect-src`/`img-src`/
`font-src` allowlist entries (T-011 through T-015).

**Reality**: the current checkout integration is MercadoPago's **redirect
flow (Checkout Pro / preapproval `init_point`)**, not an embedded Brick:

- `apps/web/src/pages/[lang]/suscriptores/checkout/index.astro` — the
  checkout root itself is just a 302 redirect to `/planes/`; it explicitly
  says "checkout is a MercadoPago return target with sub-routes
  (success/failure/pending), never a destination on its own."
- `apps/web/src/components/billing/PlanPurchaseButton.client.tsx:693` —
  `window.location.href = result.data.checkoutUrl` — a full top-level
  navigation away from the site, not an iframe mount.
- `apps/api/src/services/subscription-checkout.service.ts` —
  `checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint`,
  i.e. MercadoPago's own hosted checkout page URL, generated server-side.
- No occurrence anywhere in `apps/web/src` of `sdk.mercadopago.com`,
  `Wallet`/`CardPayment` Brick components, or an iframe pointed at
  `mercadopago.com`/`mlstatic.com`.

Because the browser does a plain top-level navigation (`location.href`) to
pay, **`connect-src`/`frame-src` do not apply at all** — those directives
govern `fetch`/`XHR`/`WebSocket` calls and iframe embeds respectively, not
top-level navigation (only the rarely-implemented `navigate-to` directive
would, and this policy doesn't set one). The card entry UI, MP's fonts/icons,
and MP's own API calls all happen on `mercadopago.com`'s own origin, under
MercadoPago's own CSP — none of it is subject to *our* policy.

**Conclusion**: T-011 through T-015 as scoped (add MP domains to frame-src/
connect-src/img-src/font-src) are very likely unnecessary. Did not implement
them — adding unused allowlist entries for a widget that isn't embedded would
be dead config with a false-confidence unit test attached (the same failure
mode as item 1's test).

**What 2.B should probably become instead** (needs a decision, not applied):

1. **Descope T-011-T-014** (no allowlist changes needed) and narrow 2.B to a
   single verification task: crawl `/es/suscriptores/checkout/` through the
   real redirect (still needs the T-006 authenticated staging session +
   sandbox credentials) and confirm zero CSP console errors during the
   pre-redirect page render — mainly to rule out anything unexpected (an
   analytics beacon, a prefetch, an error-page render) firing before
   `location.href` takes over. Low effort, still requires live staging.
2. **Keep T-011-T-014 as a defensive pre-emptive allowlist anyway** on the
   theory that a future PM/eng decision might switch to an embedded Brick
   (Checkout Bricks is MercadoPago's currently-promoted integration path;
   Checkout Pro is the older redirect pattern). Cheap to add now while the
   research is fresh, at the cost of allowlisting domains with no current
   consumer (a minor attack-surface increase with no test that can prove it's
   needed).

**Recommendation**: option 1 (descope). Option 2 optimizes for a hypothetical
future migration this session found no evidence is planned.

## 3 — T-023 (Sentry `beforeSend` CSP filter) is not implementable as scoped

**Claim in tracking**: "Add a `beforeSend` filter in `apps/web/src/lib/sentry.ts`
... that drops CSP reports where `violatedDirective = 'script-src'` AND
`blockedUri` contains `'eval'`."

**Reality**: CSP `report-uri` violation reports are raw browser-generated
HTTP POSTs sent directly to the URL in the `report-uri` directive (Sentry's
"Security Header Endpoint" — see `buildSentryReportUri()` in
`apps/web/src/lib/middleware-helpers.ts` / `@repo/utils`). They never pass
through `Sentry.init()`'s JS pipeline, so `beforeSend`/`beforeBreadcrumb` in
`apps/web/sentry.client.config.ts` (or `sentry.server.config.ts`) structurally
cannot see or filter them — those hooks only intercept events the SDK itself
captures (exceptions, breadcrumbs, manual `captureException`/`captureMessage`
calls). Confirmed against Sentry's own docs (Security Policy Reporting) via
web search this session, not just inference.

**Correct mechanism** (Sentry-side, not app code): Sentry project settings ->
**Security Headers -> CSP -> "Additional ignored sources"**, which filters by
matching `blocked_uri`/`source_file`/`document_uri` — a dashboard
configuration, not a code change. Out of scope for a PR to this repo (no file
in-tree controls it); flagging so whoever owns the Sentry project can apply it
directly, or explicitly decide the eval-probe noise is acceptable and skip it.

**Action taken**: did not implement a no-op `beforeSend` branch that would
never actually trigger — same "test masks that it doesn't work" trap as
item 1. Left T-023 `pending` with this note; it's optional (2.E) either way.

## Task-tracking changes this session

- `T-005` (verify `/es/` header on staging) -> `blocked`, reason = item 1.
- `T-004` -> left `completed` (the diagnosed-and-attempted fix genuinely
  shipped and IS necessary, just not sufficient) with a `note` pointing here.
- `T-006` -> left `in_progress`, unchanged — still blocked on no agent-level
  access to create/seed a staging test account (needs a human with `hops`
  VPS access or Coolify-side DB access to run the staging equivalent of
  `pnpm db:seed:ready-user`, since this agent's DB access is local-worktree
  only).
- `T-011`-`T-015` -> left `pending`, `note` added pointing here (item 2 —
  needs a scope decision before implementing).
- `T-023` -> left `pending`, `note` added pointing here (item 3 — needs a
  Sentry-dashboard fix instead of code, not a PR item).

## What actually unblocks HOS-30 from here

1. **Human decision on item 1** (un-prerender home vs. migrate to native
   `security.csp` vs. proxy-layer fix) — this blocks 2.C, which blocks 2.D.
2. **Human decision on item 2** (descope 2.B's allowlist tasks vs. keep
   them as pre-emptive) — either way, needs the live crawl once T-006 is
   unblocked.
3. **A human with staging DB/VPS access to finish T-006** (seed or identify a
   HOST-role staging test account with an accommodation + active
   subscription, capture a session cookie) — this unblocks the entire 2.A
   crawl (T-007-T-010) and, transitively, T-016/T-017/T-020/T-021.
4. **The 48h enforce soak (T-021)** — real-traffic monitoring only a human
   (or a scheduled job with staging Sentry dashboard access) can execute.

None of T-019-T-022 (the Phase 2 flip itself) should proceed before 1-3 above
are resolved, per the spec's own pre-flip gate and this session's explicit
instructions.
