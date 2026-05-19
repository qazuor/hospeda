# csp-nonce-injector

Logical module that stamps the per-request CSP nonce onto inline `<style>` and `<script>` tags emitted by Astro without one. The middleware (`apps/web/src/middleware.ts`) generates a per-request nonce, stores it in `context.locals.cspNonce`, sets the `Content-Security-Policy-Report-Only` header citing that nonce, and then calls `injectNonce({ html, nonce })` against the rendered response body so every unguarded inline tag matches the policy.

## Why this is NOT an Astro integration

Originally scoped as **Path A2** in [`research/astro-csp-options.md`](../../../../.claude/specs/SPEC-046-csp-post-deploy-verification/research/astro-csp-options.md) — a small Astro integration registering an HTML transformation hook. After confirming via Astro 6 docs (context7), there is no per-request response hook in Astro 6:

- `astro:server:setup` runs once at dev-server startup; receives the Vite server, not per-request responses.
- `astro:build:*` hooks run at build time only.
- `astro:config:*` and `astro:route:setup` are config-time only.

So the wiring lives in **middleware** (Path A1 from the same research), using this module's `injectNonce()` helper. The middleware was already touching HTML responses to set the CSP header — extending it to also rewrite the body is the natural fit. The parse5-based walker keeps Path A1's correctness on par with Path A2 without the regex fragility the research warned about.

## Public API

- `injectNonce({ html, nonce }) -> { html }` — pure function. Stamps `nonce="${nonce}"` on every `<script>` and `<style>` that does not already carry a `nonce` attribute. Skips descendants of `<noscript>`. External `<script src="...">` tags DO receive the nonce (CSP3 `strict-dynamic` requires it for trust propagation). No-op on empty `html` or empty `nonce`.

## Tests

See [`test/inject-nonce.test.ts`](./test/inject-nonce.test.ts) (12 cases covering the 10 enumerated in the spec plus 2 defensive ones, run via `pnpm test`).
