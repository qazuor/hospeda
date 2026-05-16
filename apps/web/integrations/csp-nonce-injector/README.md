# csp-nonce-injector

Local Astro integration that stamps the per-request CSP nonce onto inline `<style>` and `<script>` tags Astro emits without one. The middleware (`apps/web/src/middleware.ts`) generates a per-request nonce and stores it in `context.locals.cspNonce`; this integration is the post-render step that copies that nonce onto unguarded inline tags so they match the policy advertised in the `Content-Security-Policy-Report-Only` header.

Architecture: **Path A2** from [`research/astro-csp-options.md`](../../../../.claude/specs/SPEC-046-csp-post-deploy-verification/research/astro-csp-options.md). We keep middleware as the single source of CSP truth (compatible with `<ClientRouter />`, per-request nonce rotation, `report-uri` retained) and reject Astro 6's hash-only `security.csp` mode because it requires dropping `<ClientRouter />`. The HTML walker logic lands in **T-002**, hook wiring in **T-003**. This scaffold (T-001) is the integration shell only.
