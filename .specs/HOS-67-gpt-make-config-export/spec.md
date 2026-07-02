---
title: Social Posts — GPT/MAKE Config Export
linear: HOS-67
statusSource: linear
created: 2026-07-02
type: feature
areas:
  - content
  - api
  - web
---

# Social Posts — GPT/MAKE Config Export

> Sub-spec of [HOS-13](https://linear.app/hospeda-beta/issue/HOS-13) (Social Posts
> Module Overhaul), split "297d" per the discovery phase. See
> `.specs/HOS-13-social-posts-module-overhaul/spec.md` OQ-4/R-6/G-6 for the full
> mockup + dead-code investigation that produced this scope.

## 1. Summary

A new admin "Integration Config Export" page that lets the operator copy the GPT
Action config and the Make.com webhook config directly, without hand-editing
either. Also removes confirmed-dead legacy Make.com callback routes as part of
the same cleanup.

## 2. Problem

The operator must manually paste the GPT OpenAPI schema (already exists as a bare
API endpoint with no admin UI) into ChatGPT's Custom GPT Action settings, and there
is no equivalent export for the Make.com side at all — the webhook URL, expected
headers, and payload shape must be manually communicated or reverse-engineered
from code.

Separately, discovery found `apps/api/src/routes/integrations/make/social/jobs/
claim.ts`/`result.ts` (+ their service handlers) are dead-in-practice legacy code
from a pre-synchronous async dispatch design that predates the current
synchronous Make.com "Webhook Response" model — confirmed via git history
(`c73e036ca` added them 2026-06-22; `7b0dba8d8`/`5130b484e` replaced the design
2026-06-24 without deleting them).

## 3. Goals

- G-6: Ship the "Integration Config Export" admin page with two panels:
  - **Panel 1 (GPT Action)**: wraps the existing
    `GET /api/v1/admin/social/gpt-action-schema` endpoint with copy-to-clipboard /
    download affordances (today it's curl-only, no admin UI).
  - **Panel 2 (Make.com webhook, the new piece)**: shows the webhook URL (from
    `social_settings.make_webhook_url`), the outbound headers Hospeda sends
    (`x-make-apikey`, masked with reveal-on-click), and a live JSON Schema of
    `SocialMakePayloadSchema`/`MakeWebhookResponseSchema` — generated
    programmatically from the Zod schema (same pattern as the GPT export, per HOS-13
    Risk R-5), not a hand-written/static doc.
- R-6 cleanup: remove `claim.ts`/`result.ts`, their route mounting, the
  `SocialPublishDispatchService.handleMakeCallbackClaim`/`handleMakeCallbackResult`
  handlers, and the `HOSPEDA_MAKE_INBOUND_KEY` env registry entry. Land this
  before or alongside the export UI so Panel 2 never advertises a dead header.

## 4. Non-goals

- NG-1: Changing the GPT OpenAPI schema generation itself — Panel 1 is a UI wrapper
  around the existing, already-correct endpoint.
- NG-2: Any change to the synchronous Make.com dispatch flow
  (`dispatchTarget`/`social-publish-dispatch.job.ts`) — this spec only adds an
  export/documentation surface and removes genuinely dead code, it does not touch
  the live dispatch path.

## 5. Current baseline

- `apps/api/src/routes/social/admin/gpt-action-schema.ts` — programmatic OpenAPI
  3.1 doc via `@hono/zod-openapi`'s `getOpenAPI31Document()`, generated from
  `CreateSocialDraftBaseSchema`/`SocialCatalogResponseDataSchema`. No admin page
  links to it today.
- `packages/schemas/src/entities/social/social-make-payload.schema.ts` —
  `SocialMakePayloadSchema` (targetId, postId, platform, publishFormat,
  makeChannelKey, captionFinal, hashtagsFinal, footerFinal, mediaUrls,
  scheduledAt, timezone) and `MakeWebhookResponseSchema`
  (`SUCCESS`/`FAILED` discriminated union) — single source of truth for the
  Make.com payload shape. Doc comment confirms callback URLs "have been removed"
  in favor of the synchronous model.
- `social-publish-dispatch.service.ts`'s `dispatchTarget` (~line 878) — POSTs to
  `social_settings.make_webhook_url` with headers `content-type: application/json`
  - `x-make-apikey: <HOSPEDA_MAKE_API_KEY>`, expects `MakeWebhookResponseSchema`
  back in the same HTTP round-trip via Make.com's "Webhook Response" module.
- `apps/api/src/routes/integrations/make/social/jobs/claim.ts`/`result.ts` —
  confirmed dead, mounted at `POST /api/v1/integrations/make/social/jobs/
  {targetId}/{claim,result}` (`apps/api/src/routes/index.ts:589-590`) but nothing
  in the current dispatch path constructs a URL pointing at them.
  `packages/service-core/test/services/social/full-pipeline.integration.test.ts`
  already labels their test coverage "(legacy)".
- `HOSPEDA_MAKE_INBOUND_KEY` — registered in
  `packages/config/src/env-registry.hospeda.ts:1968`, read nowhere outside the two
  dead route files.

## 6. Proposed design

New endpoint `GET /api/v1/admin/social/make-webhook-schema` mirroring
`gpt-action-schema.ts`'s pattern (~150 LOC): builds a JSON Schema from
`SocialMakePayloadSchema`/`MakeWebhookResponseSchema` (e.g. via
`zod-to-json-schema` or equivalent), includes the current `make_webhook_url`
value (via `SocialSettingService`, permission-gated same as the GPT endpoint —
`SOCIAL_SETTINGS_MANAGE`) and a masked/boolean indicator for whether
`HOSPEDA_MAKE_API_KEY` is configured (never return the raw secret).

New admin route `apps/admin/src/routes/_authed/social/integration-config/
index.tsx` (or as a tab on the existing `settings/` page — decide at
implementation time) with two presentational components (`GptActionExportPanel`,
`MakeWebhookExportPanel`), reusing the existing copy-to-clipboard pattern used
elsewhere in `apps/admin`.

R-6 cleanup: delete the two route files, their router mounting in
`apps/api/src/routes/index.ts`, the two service handler methods, and the env
registry entry — a small, independent, low-risk removal PR. **Before merging**,
do a quick sanity check that no live Make.com scenario is hardcoded to call these
URLs outside of the payload-driven config (not verifiable from the repo alone —
check the Make.com dashboard).

## 7. Data model / contracts

- New endpoint `GET /api/v1/admin/social/make-webhook-schema` — response includes
  `{ payloadSchema: JSONSchema, responseSchema: JSONSchema, webhookUrl: string | null, makeApiKeyConfigured: boolean }`.
- No schema/migration changes for G-6.
- R-6 removal: no schema changes, pure code deletion; the
  `HOSPEDA_MAKE_INBOUND_KEY` env var registry entry is removed (coordinate with
  Coolify if the value is actually set there — confirm it's safe to unset).

## 8. UX / UI behavior

Single admin page, two side-by-side (or stacked) panels as mocked during
discovery: each panel has a copy-to-clipboard block for its respective JSON/URL,
with the Make.com panel additionally showing a masked API key with a
reveal-on-click affordance (consistent with how secret settings are masked
elsewhere in the admin, e.g. `SettingsTable`).

## 9. Acceptance criteria

- AC-1: `GET /api/v1/admin/social/make-webhook-schema` returns a valid JSON
  Schema matching the current `SocialMakePayloadSchema` shape — verified by a
  test that changes a field in the Zod schema and confirms the endpoint output
  changes too (proving it's generated, not hand-written).
- AC-2: The admin Integration Config Export page renders both panels, and each
  copy-to-clipboard button copies the expected content.
- AC-3: `claim.ts`/`result.ts` and their route mounting are removed; the existing
  "(legacy)" test coverage in `full-pipeline.integration.test.ts` is updated
  accordingly (either removed or reworked to not depend on the deleted handlers).
- AC-4: `HOSPEDA_MAKE_INBOUND_KEY` is removed from the env registry and
  `.env.example` files; confirmed unset (or explicitly deprecated) in Coolify.

## 10. Risks

- R-1 (from HOS-13 R-6): a live Make.com scenario could theoretically still call
  the dead callback URLs outside of Hospeda's own payload-driven config — verify
  in the Make.com dashboard before removal, not just in this repo.

## 11. Open questions

- None blocking.

## 12. Implementation notes

Land the R-6 removal before or alongside the export UI (not after) — sequencing
it after would mean shipping an export page that still references a header
belonging to dead code, momentarily.

## 13. Linear

Canonical tracking:
HOS-67
