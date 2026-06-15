---
specId: SPEC-187
title: Rich Text Entity Descriptions — per-entity toolbars, plain-text accommodation.description, full richDescription backing, ratify canonical format & harden rendering
slug: rich-text-entity-descriptions
type: feature
status: completed
complexity: high
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-187-rich-text-entity-descriptions
worktree: /home/qazuor/projects/WEBS/hospeda-spec-187-rich-text-entity-descriptions
linearIssues:
  - BETA-60
tags:
  - admin
  - web
  - rich-text
  - markdown
  - tiptap
  - sanitization
  - xss
  - documentation
  - adr
---

# SPEC-187 — Rich Text Entity Descriptions

> Skeleton note: this is the formalized functional spec. Tasks and `index.json`
> updates are produced by the caller after this file lands — do not generate them here.

## 1. Origin & problem statement

The **base markdown pipeline already exists and works end-to-end** (admin TipTap+markdown
authoring ↔ web `marked`+`sanitize-html` rendering — verified below). But this spec is **no
longer just "finishing" that rollout**. After owner review the surface grew significantly and
the complexity is now **high**. On top of the base pipeline, this spec now also:

- **(a) Adds a per-entity configurable toolbar** so each rich field exposes only the formatting
  features appropriate to its content (e.g. host-editable accommodation content gets no outbound
  links; editorial destination/event/post content gets the full set including links). The
  `RichTextField` already supports `typeConfig.allowedFeatures` + `isFeatureAllowed`; this spec
  POPULATES that per entity against a LOCKED feature matrix (§4 FR-5).
- **(b) Reverts `accommodation.description` to PLAIN TEXT.** It is `RICH_TEXT` today; the owner
  wants it to have **no formatting at all** — plain text in the admin editor and plain (non-markdown)
  rendering on the web. This is a behavior change plus a **required data migration** (existing seed
  rows may contain markdown that must be stripped so users never see raw `**`/`##`).
- **(c) Gives `accommodation.richDescription` FULL backing.** Today it is an admin-form-only field
  with NO schema, NO DB column and NO web rendering. The owner chose to make it a real, persisted,
  premium-gated rich field in THIS spec (not cosmetic, not a spin-off): `@repo/schemas` field, a
  **versioned DB migration** (SPEC-178 carril), service-core persistence, admin `RICH_TEXT` editor
  behind the premium entitlement gate, and web rendering through `renderContent`. `richDescription`
  becomes the ONLY rich field on accommodation. **The premium gate on the PUBLIC web surface is
  enforced server-side by ENTITLEMENT-BY-OMISSION** (owner-approved Option 1, §10 D-13): the public
  accommodation endpoint/transform includes `richDescription` only when the owning host is entitled
  (`CAN_USE_RICH_DESCRIPTION`); otherwise the field is omitted/null in the public payload. The web
  NEVER evaluates entitlements — it renders rich if `richDescription` is present, otherwise it
  renders the plain `description`.

So the entity rich-text picture after this spec is: **accommodation.description = plain text**,
**accommodation.richDescription = premium rich (linkless)**, **destination.description / event.description
/ post.content = full rich**. The base markdown infrastructure is reused; the new surface is the
toolbar matrix, the plain-text revert + migration, and the full richDescription vertical slice.

This feature began as **~80% implemented** for the base pipeline. The rich-text infrastructure for
entity description fields exists and works **end-to-end as Markdown** today:

- **Admin authoring** uses a real TipTap WYSIWYG editor
  (`apps/admin/src/components/entity-form/fields/RichTextField.tsx`) that **stores
  Markdown** via the `tiptap-markdown` extension, configured `html: false` for a strict
  markdown round-trip. Its toolbar covers bold, italic, underline, H2/H3, bullet list,
  ordered list, blockquote, and link. The field type is `FieldTypeEnum.RICH_TEXT`, with a
  `RichTextFeatureEnum` set and a view renderer (`RichTextViewField.tsx`).
- **Web rendering** uses a single canonical pipeline
  (`apps/web/src/lib/render-content.ts` → `renderContent({ raw, siteOrigin })`) that runs
  `marked.parse` (GFM markdown → HTML) → `sanitizeHtml` (`apps/web/src/lib/sanitize-html.ts`,
  the battle-tested `sanitize-html` library) → output fed to `set:html`. **All four** detail
  pages already import and call it for their body field (verified — see §2).

So BETA-60 is **NOT** "build a rich-text editor". The editor, the storage format, and the web
pipeline already exist and are correct, and are reused. But the surface this spec owns is larger
than the original "two field flips". The work breaks down as:

1. **Per-entity configurable toolbar (NEW, FR-5).** The `RichTextField` already supports
   `typeConfig.allowedFeatures`, but no entity declares one — every rich field gets the full
   toolbar. This spec POPULATES `allowedFeatures` per entity against a LOCKED matrix so each rich
   field exposes only the formatting it should (notably: accommodation content gets **no link**;
   editorial destination/event/post get the **full set incl. link**).
2. **`event.description` migrates `TEXTAREA → RICH_TEXT` (FR-1).** Event authors currently type
   raw markdown into a plain textarea with no toolbar/preview. After migration it is the WYSIWYG
   editor with the event toolbar (full set incl. link).
3. **`accommodation.description` reverts `RICH_TEXT → PLAIN TEXT` (NEW, FR-2).** Owner wants no
   formatting on this field. Admin field becomes `TEXTAREA`; web renders it as plain text (NOT
   markdown); existing rows with seed markdown must be audited and stripped (required data
   migration, FR-9).
4. **`accommodation.richDescription` gets FULL backing (NEW scope, FR-3).** Today it is admin-only
   with no schema/DB/web. This spec makes it a real premium rich field: `@repo/schemas` field +
   versioned DB migration + service-core persistence + admin `RICH_TEXT` (gated) + web rendering
   through `renderContent`. `maxLength` is **5000**. It becomes the only rich field on accommodation.
   The PUBLIC web premium gate is enforced **server-side by omission** (Option 1, FR-3b/FR-4): the
   public transform includes `richDescription` only for entitled hosts; the web does not query
   entitlements.
5. **Canonical-format ADR (FR-6).** Markdown is the de-facto storage format but nothing states it.
   The ADR ratifies Markdown, documents the three markdown touchpoints, draws the newsletter
   Tiptap-JSON boundary, and gives a "wire a new rich field" recipe.
6. **Sanitization hardening + XSS tests (FR-8)** including the new `richDescription` rich content.
7. **Per-entity configurable toolbar (FR-5)** and **data audit + the accommodation.description
   strip migration (FR-9).**

> Reuse the base pipeline (editor, markdown round-trip, web `renderContent`/`sanitizeHtml`) — do
> not rebuild it. The NEW work is the toolbar matrix, the plain-text revert + migration, and the
> full richDescription vertical slice (schema → DB → service → admin → web).

### Current-state matrix (verified this session)

| Entity | Field id | Current admin type | Target admin type | Schema backing | Web renders rich? |
|--------|----------|--------------------|-------------------|----------------|-------------------|
| accommodation | `description` | `RICH_TEXT` (maxLength 2000) | **`TEXTAREA` / PLAIN TEXT** (FR-2, revert) | yes (`accommodation.schema.ts` `z.string().min(30).max(2000)`, plain string — unchanged) | **NO** — must render PLAIN (not markdown). Currently `[slug].astro` ~L333 passes it through `renderContent`; that MUST change (FR-2) |
| accommodation | `summary` | `TEXTAREA` | `TEXTAREA` (no change — non-goal) | yes (10–300 chars) | n/a (card/SEO summary) |
| accommodation | `richDescription` | `TEXTAREA` ❌ (TODO; maxLength 5000) | **`RICH_TEXT`** (FR-3, full backing + premium gate) | **ADDED THIS SPEC** — new `z.string().max(5000).optional()` in `@repo/schemas` + new `rich_description` DB column (versioned migration) | **YES (NEW)** — rendered on accommodation detail via `renderContent`. The PUBLIC premium gate is **server-side by omission** (FR-3b): the public transform includes `richDescription` only for entitled hosts; the web renders rich if present else plain `description` and never evaluates `CAN_USE_RICH_DESCRIPTION` (FR-4) |
| destination | `description` | `RICH_TEXT` ✅ | `RICH_TEXT` (no change; declare `allowedFeatures` full incl. link) | yes | **yes** — via `renderContent` (`set:html`) |
| destination | `summary` | `TEXTAREA` | `TEXTAREA` (no change — non-goal) | yes | n/a |
| event | `description` | `TEXTAREA` ❌ (maxLength 5000) | **`RICH_TEXT`** (FR-1; `allowedFeatures` full incl. link) | yes (`event.schema.ts` `z.string().min(50).max(5000)`) | **yes** — via `renderContent` (already calls it on `contentHtml` / `description` / `summary`) |
| event | `summary` | `TEXTAREA` | `TEXTAREA` (no change — non-goal) | yes (10–300 chars) | n/a |
| post | `content` | `RICH_TEXT` ✅ (maxLength 50000) | `RICH_TEXT` (no change; declare `allowedFeatures` full incl. link) | yes | **yes** — via `renderContent` (`set:html`) |

> Net target: (1) `event.description` `TEXTAREA → RICH_TEXT`; (2) `accommodation.description`
> `RICH_TEXT → PLAIN TEXT` + strip-markdown data migration; (3) `accommodation.richDescription`
> `TEXTAREA → RICH_TEXT` **with full schema/DB/service/web backing**; (4) every rich field declares
> a per-entity `allowedFeatures` toolbar per the LOCKED matrix in FR-5. `destination.description`,
> `post.content`, and all `summary` fields keep their current type (destination/post only gain an
> explicit `allowedFeatures` declaration).

## 2. Current architecture (verified facts)

| Concern | Location | State today |
|---------|----------|-------------|
| Admin rich editor | `apps/admin/src/components/entity-form/fields/RichTextField.tsx` | TipTap + `tiptap-markdown` (`html: false`), stores **Markdown**; toolbar = bold/italic/underline/H2/H3/bulletList/orderedList/blockquote/link. **Already supports `typeConfig.allowedFeatures` + `isFeatureAllowed`** to restrict the toolbar per field (FR-5 populates this) |
| Field type enum | `apps/admin/src/components/entity-form/enums/form-config.enums.ts` | `FieldTypeEnum.RICH_TEXT = 'RICH_TEXT'`, `FieldTypeEnum.TEXTAREA` (plain); `RichTextFeatureEnum` (BOLD … LINK) — the values used in `allowedFeatures` |
| Admin view renderer | `apps/admin/src/components/entity-form/views/RichTextViewField.tsx` | Renders the stored markdown via a hand-rolled `parseMarkdown` regex → `DOMPurify.sanitize` → `dangerouslySetInnerHTML` (a third markdown path — see finding D-4) |
| Web render pipeline | `apps/web/src/lib/render-content.ts` | `renderContent({ raw, siteOrigin })` → `marked.parse` (gfm) → `sanitizeHtml` → `set:html` |
| Web sanitizer | `apps/web/src/lib/sanitize-html.ts` | `sanitize-html` lib; allowlist of tags/attrs; YouTube-iframe allowlist; `id`/`data-*` scrub; external-link `target`/`rel` policy |
| Web accommodation render | `apps/web/src/pages/[lang]/alojamientos/[slug].astro` (~L333) | TODAY: `renderContent({ raw: accommodation.description })` → `<Description descriptionHtml>` (`set:html`). **FR-2 changes this**: `description` must render PLAIN TEXT (no markdown), and the new `richDescription` (FR-4) renders rich via `renderContent`, gated by `CAN_USE_RICH_DESCRIPTION` |
| Web destination render | `apps/web/src/pages/[lang]/destinos/[...path].astro` (~L337,416) | `renderContent({ raw: dest.contentHtml \|\| description \|\| summary })` → `set:html` |
| Web event render | `apps/web/src/pages/[lang]/eventos/[slug].astro` (~L104,238) | `renderContent({ raw: contentHtml \|\| description \|\| summary })` → `set:html` |
| Web post render | `apps/web/src/pages/[lang]/publicaciones/[slug].astro` (~L177) | `renderContent({ raw: post.contentHtml \|\| post.content \|\| summary })` → `set:html` |
| Tiptap-JSON renderer | `packages/utils/src/tiptap-renderer.ts` (+ test) | Tiptap/ProseMirror **JSON → HTML** (HTML-escaped). **Used by the newsletter/email subsystem, NOT entity descriptions** (finding below) |

### FINDING A — all four web detail pages today render via `renderContent` (one MUST change)

Verified by reading each page: accommodation, destination, event, and post **all** currently
import `renderContent` and feed its output to `set:html` (the accommodation case routes through
the `<Description>` component, which is documented as requiring sanitized HTML). **There is no
detail page that renders its body field as raw plain text today.**

Two consequences for this spec:

- For destination, event, post and the new `richDescription` — this is the desired behavior. FR-4
  keeps every RICH field flowing through `renderContent` and pins it with regression tests
  (pin-and-protect).
- For `accommodation.description` — this is now the WRONG behavior. FR-2 reverts the field to plain
  text, so `[slug].astro` ~L333 must STOP routing `description` through `renderContent` (which
  parses markdown) and instead render it as plain text (e.g. text node / escaped output), so `**`
  and `##` are shown literally only if the data still contains them — and FR-9 strips those from
  the data. This is the one detail-page change required by the audit.

### FINDING B — `accommodation.richDescription` has NO schema/DB/web backing TODAY; this spec ADDS it

`richDescription` does **not** exist anywhere in `packages/schemas/src` today. It appears only as:
an admin form-config field (`basic-info.consolidated.ts`), an i18n type string, an admin test,
and the `PlanEntitlementGate`. It is **not** in the accommodation Zod schema, **not** in the
DB model, and **not** consumed by `apps/web`. So the field is admin-form-only today and its
value has no persisted home or web surface.

**This is no longer an open decision — the owner chose FULL backing in THIS spec** (it is no
longer "cosmetic vs spin-off"). FR-3 builds the full vertical slice: a `z.string().max(5000).optional()`
field in `@repo/schemas`, a new `rich_description` DB column via the SPEC-178 **versioned migration
carril** (`pnpm db:generate` → `pnpm db:migrate`, NEVER `db:push`), service-core persistence/read,
the admin `RICH_TEXT` editor behind the premium gate, and web rendering through `renderContent`.
The PUBLIC premium gate is enforced server-side by omission (Option 1, FR-3b): the public transform
includes `richDescription` only for entitled hosts, and the web renders it if present else falls
back to the plain `description` — the web never evaluates the entitlement (FR-4). `richDescription`
becomes the **only** rich field on accommodation (because `description` reverts to plain text per
FR-2).

### ARCHITECTURAL DECISION — how `description` / `richDescription` reach the web and who decides the premium gate (Option 1, owner-approved)

Accommodation has TWO description fields: `description` (plain text, always present) and
`richDescription` (premium rich markdown). The open question was how both reach the web and **who
evaluates the `CAN_USE_RICH_DESCRIPTION` premium gate** for the PUBLIC surface. Three models were
considered; the owner approved **Option 1**.

**Chosen — Option 1: entitlement-by-omission in the backend; the web renders two fields without
evaluating entitlements.**

1. **The web NEVER evaluates entitlements.** It does NOT check `CAN_USE_RICH_DESCRIPTION`. The
   backend decides.
2. **Entitlement-by-omission in the backend:** the PUBLIC accommodation endpoint/transform includes
   `richDescription` in the response **only if the owning host is premium** (gated server-side by
   `CAN_USE_RICH_DESCRIPTION`). If the host is not premium, `richDescription` is **omitted / null**
   in the public payload. Admin endpoints still return `richDescription` raw for editing, regardless
   of entitlement.
3. **Web render rule** on the accommodation detail page:
   `richDescription ? renderRich(richDescription) : renderPlain(description)`.
   - `renderRich` = the existing `renderContent` pipeline (markdown → `marked` → `sanitize-html` →
     `set:html`).
   - `renderPlain` = plain-text rendering of `description`: HTML-escape + emit as a text node / wrap
     in `<p>`. It **MUST NOT** run through `marked` / markdown parsing (no `**`, `##`, `-`, `1.`,
     `[]()` interpretation). Plain text is rendered as plain text — that is the whole point.
4. The web's only "decision" is **presence-of-field**: `if (richDescription) use it, else show
   description`. No business logic, no entitlement query.
5. **API contract (explicit):** `richDescription` present/non-null in the PUBLIC payload **signals
   the host is entitled**; absent/null means show the plain `description`. The field's nullability
   is documented in the schema/transform contract (`z.string().max(5000).optional()` → may be
   `undefined`/`null` in the public shape).

**Why Option 1.** It keeps entitlement evaluation **server-side** (correct — the client must not be
trusted with the premium decision) while keeping the markdown + sanitize pipeline in **ONE place**
(the web). It avoids: porting the pipeline to the backend, serving a double HTML/raw shape per
consumer, and coupling presentation to the API. The cost is a single presence-check branch in the
web, which is cheap and correct.

**Rejected alternatives** (recorded in §10 D-14 / D-15):

- **Option 2 — backend sends pre-rendered sanitized HTML and the web is 100% dumb.** Rejected as
  over-engineering unless more clients appear: it moves the markdown + sanitize pipeline to the
  backend, forces a double-shape (raw for admin, HTML for public), and couples cache-invalidation to
  presentation.
- **Option 3 — backend sends a single markdown-normalized field, escaping plain → markdown-safe.**
  Rejected because the plain → markdown escape is fragile and reintroduces the spurious-formatting
  bug (the plain `description` could acquire accidental markdown semantics).

This decision REFINES FR-3 and FR-4: the admin EDIT-surface gate (PlanEntitlementGate /
`CAN_USE_RICH_DESCRIPTION`) is unchanged; the NEW thing is the PUBLIC-payload gate-by-omission for
the web (FR-3b), with the web doing only a presence check (FR-4).

### FINDING C — `tiptap-renderer.ts` is NOT dead, NOT a web duplicate, and lives in `packages/utils`

The original framing assumed a "dual renderer smell" in `apps/web` (`tiptap-renderer.ts`
parallel to `render-content.ts`). **That file does not exist in `apps/web`.** The Tiptap-JSON
renderer is `packages/utils/src/tiptap-renderer.ts` and its consumers are the **newsletter /
email** subsystem:

- `packages/notifications/src/templates/newsletter/newsletter-campaign.tsx` +
  `packages/notifications/src/utils/` (email body rendering),
- `apps/admin/src/components/newsletter/RichTextEditor.tsx` — a **separate** newsletter
  editor that stores **Tiptap-JSON** (`editor.getJSON()`), distinct from the entity
  `RichTextField` which stores Markdown.

So the platform has **two intentionally different rich-text domains**: (1) **entity
descriptions** = Markdown (TipTap-markdown ↔ marked + sanitize-html), and (2) **newsletter
emails** = Tiptap-JSON (because email HTML must be produced server-side from a structured doc
with escaping, and email clients cannot run the web `marked` pipeline). They are not
duplicates of the same path. This spec's FR-5 therefore RATIFIES the boundary in the ADR
instead of deleting anything: `tiptap-renderer` stays for newsletters; the ADR states it is
out of scope for entity descriptions.

### FINDING D — a third markdown→HTML path exists in the admin view renderer

`RichTextViewField.tsx` renders the stored markdown via a hand-rolled regex `parseMarkdown` +
`DOMPurify.sanitize`, NOT via `marked`. This means the admin VIEW mode and the web render
can diverge for the same markdown. This is noted for the ADR (document the three touchpoints:
admin-edit `tiptap-markdown`, admin-view regex+DOMPurify, web `marked`+sanitize-html). Aligning
the admin view renderer onto `marked` is a candidate hardening item but is treated as
**optional / verify-then-decide**, not a mandated build, to keep blast radius small.

### Project rules that constrain this work

- Descriptions are stored as a **plain string** (not an i18n/localized object) — confirmed by
  the `z.string()` schemas and the `maxLength` form configs. No i18n-object handling needed.
- Zod schemas in `@repo/schemas` are the single source of truth for types.
- Admin styling is Tailwind v4; web styling is vanilla CSS / CSS Modules (no Tailwind in web).
- All web body HTML MUST go through `renderContent`/`sanitizeHtml` before `set:html` — never
  pipe a raw API field into `set:html` (the JSDoc of `render-content.ts` and `Description.astro`
  enforce this).
- i18n for all user-facing strings via `@repo/i18n` (es default; en, pt). No new end-user
  strings are expected here (the toolbar labels are already shipped).
- Test-Informed Development: Vitest, AAA, ≥90% coverage; no committed PNGs (assert over DOM /
  computed style, not screenshots).

## 3. Goals & non-goals

### Goals

1. Migrate `event.description` admin field from `TEXTAREA` to `RICH_TEXT` so event authors get
   the WYSIWYG markdown editor, with the full toolbar (incl. link) per the FR-5 matrix.
2. Revert `accommodation.description` from `RICH_TEXT` to **plain text** (`TEXTAREA`): admin editor
   is a plain textarea, web renders it as PLAIN TEXT (NOT markdown), and existing rows are
   audited/stripped of seed markdown so no raw `**`/`##` reaches users.
3. Give `accommodation.richDescription` FULL backing: a `@repo/schemas` field
   (`z.string().max(5000).optional()`), a `rich_description` DB column via the versioned migration
   carril, service-core persistence/read, admin `RICH_TEXT` (premium-gated, full toolbar **minus
   link**), and web rendering through `renderContent`. The PUBLIC premium gate is enforced
   **server-side by omission** (Option 1): the public accommodation transform/endpoint includes
   `richDescription` only when the owning host has `CAN_USE_RICH_DESCRIPTION`; otherwise it is
   omitted/null. The web does NOT evaluate entitlements. `richDescription` becomes the only rich
   field on accommodation.
4. Add a **per-entity configurable toolbar**: every rich field declares `typeConfig.allowedFeatures`
   per the LOCKED matrix in FR-5 (accommodation content linkless; destination/event/post full incl.
   link).
5. Guarantee web rendering: every RICH field renders through canonical `renderContent` (markdown →
   sanitized HTML → `set:html`) and is pinned by regression tests; the now-plain
   `accommodation.description` renders as plain text (`renderPlain` — HTML-escaped, NOT markdown-parsed)
   and is pinned to NOT be markdown-parsed. The accommodation detail page applies the single rule
   `richDescription ? renderRich(richDescription) : renderPlain(description)` with no entitlement
   query on the web (Option 1).
6. Ratify Markdown as the **canonical storage format** for entity rich-text fields in an ADR, with
   rationale, the three markdown-touchpoint map, the newsletter Tiptap-JSON boundary, and a "how to
   wire a new rich field" recipe.
7. Document the `tiptap-renderer` boundary (newsletter/email Tiptap-JSON domain, NOT entity
   descriptions; finding C says it is NOT dead → document, do not delete).
8. Harden sanitization with explicit description-scoped XSS unit tests (script tags, `javascript:`
   URLs, `onerror=`/`onclick=` handlers, non-YouTube iframes), covering the new `richDescription`
   rich content, proving they are stripped while the allowed markdown subset survives.
9. Perform the data audit and run the `accommodation.description` strip-markdown migration; confirm
   `event.description` / `richDescription` rows need no migration (or define handling).

### Non-goals (explicitly out of scope)

1. **D-1 — Tiptap-JSON as the canonical format for entity descriptions is REJECTED.** Markdown
   is canonical (locked, owner-approved). No migration of entity descriptions to Tiptap-JSON.
2. **D-2 — `summary` / `excerpt` / short fields do NOT become rich text.** They are 300-char
   card/SEO summaries; rich markup would have to be stripped for cards and meta tags. They stay
   plain `TEXTAREA`. (accommodation `summary`, event `summary`, destination `summary`,
   post `summary`.)
3. **D-3 — No new toolbar FEATURES** (images, tables, code blocks, etc.) beyond the existing set
   (bold/italic/underline/H2-H3/lists/blockquote/link). FR-5 only RESTRICTS the existing set
   per entity via `allowedFeatures`; it does not add new editor capabilities. Adding features is a
   future spec.
4. **D-4 — No deletion of `packages/utils/src/tiptap-renderer.ts`.** It powers the newsletter/
   email subsystem (finding C) and is not part of the entity-description path. The ADR
   documents the boundary; the file is untouched.
5. **D-5 — No changes to OTHER accommodation rich plumbing.** `richDescription` is the ONLY rich
   field added/backed on accommodation; `description` becomes plain and `summary` stays plain. No
   additional accommodation rich fields are introduced.
6. **D-6 — No speculative migration on `event.description` / `richDescription`** if the FR-9 audit
   confirms existing values are plain text (valid markdown as-is). The ONLY required data migration
   is the `accommodation.description` markdown-strip (because that field becomes plain text and seed
   rows may contain markdown).
7. **D-7 — No changes to the newsletter editor** (`apps/admin/.../newsletter/RichTextEditor.tsx`)
   or the email rendering path.

## 4. Functional requirements & acceptance criteria

### FR-1 — Migrate `event.description` admin field to `RICH_TEXT` (BETA-60)

In `apps/admin/src/features/events/config/sections/basic-info.consolidated.ts`, change the
`description` field's `type` from `FieldTypeEnum.TEXTAREA` to `FieldTypeEnum.RICH_TEXT`,
preserving its `required`, `modes`, `permissions`, `minLength: 50`, and `maxLength: 5000`
(the rich field's `typeConfig` carries `maxLength`; the `minRows` textarea-only key is dropped).
Declare the **full** `allowedFeatures` set **including link** per the FR-5 matrix (editorial
content). Verify `event.schema.ts` `description` is a plain `z.string().min(50).max(5000)` with
**no format constraint** that would reject markdown (verified: it is plain string — OK). Ensure the
admin VIEW mode renders the field via `RichTextViewField`.

```
Given an editor opens an event in edit mode
  When the description field renders
  Then it is a TipTap WYSIWYG editor with the full toolbar including the link button (not a plain textarea)
  And typing bold/heading/list/link produces markdown stored in the field value

Given an event with markdown in its description
  When the event is viewed in the admin (view mode)
  Then the description renders as formatted rich text via RichTextViewField (not raw ** / ## markers)

Given the event schema validates a description containing markdown (e.g. "## Title\n\n**bold**")
  When the event is saved
  Then validation passes (the z.string() min/max constraints accept markdown; no format rule rejects it)

Given the migrated event description config
  When the admin config test suite runs
  Then a test asserts the description field type is RICH_TEXT with maxLength 5000, required true, and allowedFeatures includes LINK
```

### FR-2 — Revert `accommodation.description` to PLAIN TEXT (NEW) (BETA-60)

The owner wants `accommodation.description` to carry **no formatting at all**. Today it is
`RICH_TEXT`. Revert it across admin, web, and data:

- **Admin:** in `apps/admin/src/features/accommodations/config/sections/basic-info.consolidated.ts`,
  change the `description` field `type` from `FieldTypeEnum.RICH_TEXT` back to
  `FieldTypeEnum.TEXTAREA` (plain). Drop any `allowedFeatures`/rich `typeConfig`; keep `required`,
  `permissions`, `minLength: 30`, `maxLength: 2000`.
- **Web:** `accommodation.description` must render as PLAIN TEXT via `renderPlain` (the plain branch
  of the FR-4 render rule), NOT markdown. It must NOT be interpreted as markdown (no `**`/`##`
  parsing). In `apps/web/src/pages/[lang]/alojamientos/[slug].astro` (~L333) STOP routing
  `description` through `renderContent` (which runs `marked`). `renderPlain` = HTML-escape + emit as
  a text node / wrap in `<p>` (the chosen mechanism — stop-routing vs escape — is a design choice
  recorded in §10; default: emit as an HTML-escaped text node so no markdown is parsed and no HTML
  is injected). Note: when the owner IS entitled, the accommodation detail page shows
  `richDescription` (rich) instead of `description` per the FR-4 rule
  `richDescription ? renderRich : renderPlain(description)`; `description` is the plain fallback.
- **Schema:** confirm the accommodation `description` Zod type stays a plain string
  (`z.string().min(30).max(2000)`) — it already does; no schema change.
- **Data migration (REQUIRED — see FR-9):** existing rows may contain seed markdown (`**bold**`,
  `## heading`, links). They must be audited and stripped/converted to plain text so users never
  see raw markdown markers once the field renders plain.

```
Given an editor opens an accommodation in edit mode
  When the description field renders
  Then it is a plain TEXTAREA (no toolbar, no WYSIWYG)

Given an accommodation whose description contains "## Title\n\n**bold**"
  When the accommodation detail page renders (after FR-9 migration)
  Then the description text contains neither an <h2>/<strong> element NOR literal "##"/"**" markers
  And the description is emitted as plain text, never piped into set:html as markdown-parsed HTML

Given the reverted accommodation description config
  When the admin config test suite runs
  Then a test asserts the description field type is TEXTAREA (not RICH_TEXT), maxLength 2000, required true

Given a web render test for the accommodation detail page
  When description plain text is rendered
  Then a regression test asserts description does NOT go through renderContent (markdown is not interpreted)
```

### FR-3 — Give `accommodation.richDescription` FULL backing (NEW scope) (BETA-60)

`richDescription` becomes a real, persisted, premium-gated rich field — the ONLY rich field on
accommodation. Build the full vertical slice (each layer independently testable):

- **`@repo/schemas`** — add `richDescription` to the accommodation schema
  (`packages/schemas/src/entities/accommodation/...`, verify exact file/shape) as
  `z.string().max(5000).optional()`. It currently does NOT exist; this is a new field.
- **DB** — add a `rich_description` column on the accommodation table via the project's
  **VERSIONED migration carril** (SPEC-178): run `pnpm db:generate` to produce the migration file
  under `packages/db/src/migrations/`, then `pnpm db:migrate`. **NEVER `db:push`.** Update the
  Drizzle model under `packages/db` accordingly. Respect the drift guard (commit the generated
  migration file in the same change as the schema change).
- **service-core** — persist on create/update and read on get/list through the accommodation
  service so the value round-trips DB ↔ API. The PUBLIC read path applies the gate-by-omission
  (FR-3b): include `richDescription` only when the owning host has `CAN_USE_RICH_DESCRIPTION`.
- **Admin** — in `basic-info.consolidated.ts`, set `richDescription` `type: FieldTypeEnum.RICH_TEXT`,
  **remove** the `// Should be RICH_TEXT when available` / `// TODO` comment, keep
  `entitlementKey: EntitlementKey.CAN_USE_RICH_DESCRIPTION` (premium gate) and `maxLength: 5000`,
  and declare `allowedFeatures` = full set **MINUS link** per the FR-5 matrix (host content,
  linkless).
- **Web** — see FR-4: render `richDescription` on the accommodation detail page through
  `renderContent` when it is present in the payload; the web does NOT evaluate entitlements (the
  presence of the field already encodes the gate, per FR-3b / Option 1).

```
Given the accommodation Zod schema after this change
  When richDescription is validated
  Then z.string().max(5000).optional() accepts a 5000-char markdown string, rejects a 5001-char string, and allows undefined

Given the new rich_description DB column and the accommodation service
  When an accommodation is created/updated with a richDescription value and re-fetched
  Then the value round-trips intact (DB write → API read) — a service-core round-trip test asserts this

Given the DB migration
  When generated via pnpm db:generate
  Then a migration file is committed under packages/db/src/migrations and the drift guard passes (no uncommitted schema drift)

Given a HOST with CAN_USE_RICH_DESCRIPTION opens an accommodation in edit mode
  When the richDescription field renders
  Then it is the TipTap WYSIWYG editor with the full toolbar EXCEPT the link button (linkless), and the TODO comment is gone

Given a HOST WITHOUT CAN_USE_RICH_DESCRIPTION
  When they open the accommodation edit form
  Then the richDescription rich editor is gated (premium-gate state shown, editor not editable) — no gate regression

Given the migrated richDescription admin config
  When the admin config test suite runs
  Then a test asserts richDescription is RICH_TEXT, retains entitlementKey CAN_USE_RICH_DESCRIPTION, maxLength 5000, required false, and allowedFeatures EXCLUDES LINK
```

### FR-3b — PUBLIC premium gate by omission in the backend (NEW, Option 1) (BETA-60)

The premium gate for the PUBLIC web surface is enforced **server-side, by omitting the field** —
NOT on the web. The PUBLIC accommodation endpoint/transform includes `richDescription` in the
response **only if the owning host is entitled** (`CAN_USE_RICH_DESCRIPTION`); for a non-entitled
host it is **omitted / null**. This is the single place the entitlement is enforced for the public
surface.

- **Where:** the PUBLIC accommodation read path in `apps/api` / `@repo/service-core` (the public
  detail/list resolver + transform). The web consumes the result via
  `apps/web/src/lib/api/transforms.ts` and the public API endpoint — it receives `richDescription`
  already gated and never re-evaluates the entitlement.
- **Admin is unaffected:** admin endpoints continue to return `richDescription` raw for editing,
  regardless of entitlement (the admin EDIT gate is the PlanEntitlementGate per FR-3, a different
  surface).
- **API contract (explicit):** `richDescription` present/non-null in the PUBLIC payload **signals
  the host is entitled**; absent/null means the web shows the plain `description` (FR-4). Document
  the field's nullability in the schema/transform contract.
- **Correctness is security-relevant:** a bug here either leaks premium rich content on a
  non-premium host's public page, or hides it for a premium host. FR-3b is pinned by acceptance
  tests for BOTH the premium-host (present) and non-premium-host (absent) cases.

```
Given an accommodation whose owning host HAS CAN_USE_RICH_DESCRIPTION and a stored richDescription
  When the PUBLIC accommodation transform/endpoint builds the payload
  Then richDescription is present (non-null) in the public response

Given an accommodation whose owning host LACKS CAN_USE_RICH_DESCRIPTION (even if a richDescription is stored)
  When the PUBLIC accommodation transform/endpoint builds the payload
  Then richDescription is omitted / null in the public response (gate-by-omission)

Given the ADMIN accommodation endpoint for the same non-entitled host
  When the payload is built
  Then richDescription is returned raw (admin EDIT surface is not gated by omission)

Given the public payload contract
  When richDescription is non-null
  Then it is the documented signal that the owning host is entitled (the web does not re-check)
```

### FR-4 — Web rendering: rich fields via `renderContent`; richDescription-present-else-plain-description; web does NOT evaluate entitlements (BETA-60)

Every RICH field renders through canonical `renderContent` (markdown → sanitized HTML →
`set:html`); the now-plain `accommodation.description` renders plain (FR-2). **The web does NOT
evaluate entitlements** (Option 1 — the gate is enforced in the backend by omission, FR-3b).
Specifically:

- destination, event, post body fields keep rendering via `renderContent` (already do — finding A);
  pinned with regression tests.
- **Accommodation detail page render rule:** `richDescription ? renderRich(richDescription) :
  renderPlain(description)`.
  - `renderRich` = the existing `renderContent` pipeline (markdown → `marked` → `sanitize-html` →
    `set:html`).
  - `renderPlain` = plain-text rendering of `description`: HTML-escape + emit as a text node / wrap
    in `<p>`. It **MUST NOT** run through `marked` / markdown parsing — no `**`, `##`, `-`, `1.`,
    `[]()` interpretation. Plain text is rendered as plain text (this is the whole point).
  - The web's only decision is **presence-of-field**: if `richDescription` is present (non-null) use
    `renderRich`, else show `description` via `renderPlain`. No business logic, no
    `CAN_USE_RICH_DESCRIPTION` query. Because the backend already gated by omission (FR-3b),
    a present `richDescription` is, by contract, an entitled host's content.
- `accommodation.description` (FR-2) does NOT go through `renderContent` / `renderRich` — it is
  always `renderPlain` (plain text only).

```
Given destination/event/post detail pages
  When the page module is inspected / tested
  Then their body field reaches set:html only via renderContent (no raw API field piped into set:html)

Given the event description is now rich markdown
  When the event detail page renders an event whose description contains "## Heading\n\n**bold**"
  Then the output shows an <h2> and <strong> (formatted), not literal "## " / "**" characters

Given an accommodation whose PUBLIC payload INCLUDES richDescription (owner is entitled, gated by FR-3b)
  When the accommodation detail page renders
  Then richDescription is rendered as sanitized HTML via renderRich (renderContent) — formatted
  And the web did NOT query CAN_USE_RICH_DESCRIPTION (it only checked field presence)

Given an accommodation whose PUBLIC payload OMITS richDescription (owner not entitled, or no value)
  When the accommodation detail page renders
  Then the page falls back to renderPlain(description) — plain text, no markdown interpretation
  And no rich content is shown

Given accommodation.description rendered via renderPlain with content "## Title\n\n**bold**"
  When the page renders
  Then the output contains NO <h2>/<strong> element AND NO markdown is interpreted (the literal markers, if present in data, are shown as escaped text — and FR-9 strips them from the data)
  And description is never piped through renderContent / marked

Given a regression test guarding the pipeline
  When a contributor changes a detail page to feed a raw field to set:html, OR routes accommodation.description through renderContent/renderRich, OR adds a CAN_USE_RICH_DESCRIPTION entitlement query on the web
  Then a test fails (the pipeline, the plain-description rule, and the "web does not evaluate entitlements" rule are pinned, not one-time)
```

### FR-5 — Per-entity configurable toolbar (`allowedFeatures`) (NEW) (BETA-60)

The `RichTextField` already supports `typeConfig.allowedFeatures` + `isFeatureAllowed`
(`apps/admin/src/components/entity-form/fields/RichTextField.tsx`). The infra exists; this FR
POPULATES it per entity so each rich field exposes only the formatting features appropriate to its
content. Each rich field declares its `allowedFeatures` (values from `RichTextFeatureEnum`) in its
admin config `typeConfig`. The matrix below is **LOCKED**.

Available features: **bold, italic, underline, H2/H3 heading, bullet list, ordered list,
blockquote/quote, link**.

| Feature | accommodation.description | accommodation.richDescription (premium) | destination.description | event.description | post.content |
|---|:--:|:--:|:--:|:--:|:--:|
| (field is) | PLAIN TEXT (not rich) | rich | rich | rich | rich |
| bold | — | ✅ | ✅ | ✅ | ✅ |
| italic | — | ✅ | ✅ | ✅ | ✅ |
| underline | — | ✅ | ✅ | ✅ | ✅ |
| bullet list | — | ✅ | ✅ | ✅ | ✅ |
| ordered list | — | ✅ | ✅ | ✅ | ✅ |
| H2/H3 | — | ✅ | ✅ | ✅ | ✅ |
| quote | — | ✅ | ✅ | ✅ | ✅ |
| link | — | ❌ | ✅ | ✅ | ✅ |

**Rationale (locked):** accommodation content is host-editable, so it gets **no outbound links**
(anti-spam / SEO protection) — `accommodation.description` is plain text entirely, and
`accommodation.richDescription` is premium rich but still **linkless**. `destination.description`,
`event.description`, and `post.content` are editorial/staff-authored content, so they get the
**full set including link**.

```
Given the destination/event/post rich field configs
  When the admin config test suite runs
  Then each declares allowedFeatures = full set INCLUDING LINK

Given the accommodation.richDescription rich field config
  When the admin config test suite runs
  Then it declares allowedFeatures = full set EXCLUDING LINK

Given a rich field whose allowedFeatures omits LINK
  When the editor toolbar renders
  Then the link button is absent (isFeatureAllowed('LINK') is false) and the author cannot insert a link

Given a rich field whose allowedFeatures includes LINK (event/destination/post)
  When the editor toolbar renders
  Then the link button is present and a link can be inserted

Given accommodation.description (plain text, FR-2)
  When its admin field renders
  Then it is a plain TEXTAREA with no toolbar at all (allowedFeatures is not applicable)
```

### FR-6 — Canonical-format ADR (BETA-60)

Add an ADR under `docs/decisions/` (e.g. `docs/decisions/NNN-markdown-canonical-rich-text.md`,
numbered per the existing ADR sequence) stating: **Markdown is the canonical storage format for
entity rich-text fields** (`accommodation.richDescription`, `destination.description`,
`event.description`, `post.content` — note `accommodation.description` is now PLAIN TEXT and
deliberately NOT rich, per FR-2). The ADR must document:

- The format decision and rationale (admin `tiptap-markdown` `html:false` round-trip ↔ web
  `marked` + `sanitize-html`; markdown is human-diffable, storage-portable, and renders
  identically across surfaces).
- The **per-entity toolbar policy** (FR-5 matrix): host content (accommodation) is linkless;
  editorial content (destination/event/post) gets the full set incl. link. Note that
  `accommodation.description` is plain text (no rich features at all).
- The three markdown touchpoints (admin-edit `tiptap-markdown`, admin-view regex+DOMPurify,
  web-render `marked`+sanitize-html) and the note that the admin-view renderer uses a different
  parser (finding D) — flagged as a known divergence.
- The explicit boundary with the **newsletter** Tiptap-JSON path (`packages/utils/tiptap-renderer.ts`)
  — different domain, NOT the entity format (finding C); the file is NOT deleted.
- A "how to wire a NEW rich entity field" recipe: set `type: FieldTypeEnum.RICH_TEXT` + declare
  `typeConfig.allowedFeatures` in the feature config; back it with a plain `z.string().min/max`
  schema field + (if persisted) a versioned DB column via the SPEC-178 carril; render on the web via
  `renderContent`; never `set:html` a raw field.

```
Given the ADR is added
  When a reviewer reads it
  Then it states Markdown is canonical, lists the affected fields, gives the rationale, and includes the new-field wiring recipe

Given the ADR
  When it discusses Tiptap-JSON
  Then it explicitly scopes Tiptap-JSON to the newsletter/email subsystem and rejects it for entity descriptions (per §10 D-1)

Given the ADR is referenced from docs/decisions/README.md (the ADR index)
  When the docs build/lint runs
  Then there is no broken link and the ADR appears in the index
```

### FR-7 — Resolve the `tiptap-renderer` duality (verify-then-document) (BETA-60)

Verify the consumers of `packages/utils/src/tiptap-renderer.ts` (done — finding C: newsletter
emails + admin newsletter editor). Because it is **used** and serves a **different domain**, the
resolution is to **document** the boundary (in the FR-6 ADR) and ensure it does not get
mistaken for the entity-description path — NOT to delete it.

```
Given the verification of tiptap-renderer consumers
  When the spec records the finding
  Then it confirms tiptap-renderer is consumed by packages/notifications (newsletter) and apps/admin newsletter editor, not by entity descriptions

Given tiptap-renderer is in use
  When the resolution is applied
  Then the file is NOT deleted, and the FR-6 ADR documents the entity-markdown vs newsletter-JSON boundary so the duality is explained rather than accidental

Given a contributor later searches for "the rich text renderer"
  When they read the ADR
  Then they can tell which path (markdown render-content vs tiptap-renderer) applies to their case
```

### FR-8 — Sanitization hardening + explicit XSS tests (BETA-60)

Add description-scoped XSS unit tests through `renderContent` / `sanitizeHtml` proving the
dangerous payloads are stripped and the allowed markdown subset survives. The sanitizer
(`apps/web/src/lib/sanitize-html.ts`) is already robust; this FR PINS its behavior with tests so
a future allowlist change cannot silently open a hole. The new `accommodation.richDescription`
rich content (FR-3/FR-4) flows through the same `renderContent` → `sanitizeHtml` path, so these
tests cover it too (a host-authored richDescription with a malicious payload must be sanitized on
web render).

Required malicious cases (each asserted stripped/neutralized):

- `<script>alert(1)</script>` → no `<script>` in output.
- A link with `href="javascript:alert(1)"` → `href` dropped or link removed (scheme not in
  `ALLOWED_SCHEMES`).
- `<img src=x onerror="alert(1)">` → `onerror` attribute removed.
- An `<iframe>` to a non-YouTube host → element discarded (per `YOUTUBE_EMBED_REGEX`).
- An `onclick=`/`onmouseover=` attribute on any allowed tag → removed.
- A `data:text/html` or otherwise disallowed-scheme URL → removed.

Required allowed cases (each asserted survives): `<strong>`, `<em>`, `<u>`, `<h2>`/`<h3>`,
`<ul>/<ol>/<li>`, `<blockquote>`, and an `<a href="https://...">` (external link gains
`target="_blank"` + `rel="noopener noreferrer"`; internal link does not).

```
Given a description containing "<script>alert(1)</script>"
  When renderContent processes it
  Then the output contains no <script> tag and no executable payload

Given a markdown/HTML link with href "javascript:alert(1)"
  When sanitizeHtml processes it
  Then the javascript: href is removed (the scheme is not in the allowlist)

Given an "<img src=x onerror=alert(1)>"
  When sanitizeHtml processes it
  Then the onerror handler is stripped (event-handler attrs are never allowlisted)

Given an <iframe> whose src is not a whitelisted YouTube embed
  When sanitizeHtml processes it
  Then the iframe element is discarded entirely (no stub left)

Given the allowed markdown subset (bold, italic, underline, h2/h3, lists, blockquote, links)
  When renderContent processes the markdown
  Then each maps to its allowed tag and survives sanitization, and external links get target=_blank + rel=noopener noreferrer
```

### FR-9 — Data audit + `accommodation.description` strip-markdown migration (BETA-60)

Two parts: a REQUIRED data migration for `accommodation.description` (it becomes plain text, FR-2),
and a verify-then-decide audit for `event.description` / `richDescription`.

**REQUIRED — `accommodation.description` markdown strip:**

- `accommodation.description` is reverting `RICH_TEXT → PLAIN TEXT` (FR-2). Existing seed/prod rows
  may contain markdown (`**bold**`, `## heading`, `[text](url)`, lists). Because the web render
  stops interpreting it as markdown, those markers would otherwise become visible raw text.
- Audit the column: count rows containing markdown markers; inspect a representative sample.
- Strip/convert markdown to plain text (e.g. unwrap emphasis markers, drop heading `#`, flatten
  list bullets, reduce links to their text) so users see clean plain text. The chosen mechanism
  (one-off normalization script vs render-time strip) and its exact rules are recorded in §10;
  default is a one-off normalization of the stored data (so the DB carries clean plain text), since
  render-time stripping every request is wasteful and the field is now plain by contract.
- This is a real, required data task — NOT optional.

**Verify-then-decide — `event.description` / `accommodation.richDescription`:**

- These stay/become markdown (rich). Verify existing rows are plain text (valid markdown as-is)
  rather than raw HTML.
- Query the column(s); inspect a sample + count rows with raw HTML markers (`<p>`, `<div>`,
  `<script>`, `&lt;`). `richDescription` is a brand-new column (FR-3), so it starts empty — only
  `event.description` has pre-existing data to audit.
- If all rows are plain text / markdown → record "no row migration needed" with row-count evidence.
- If any row contains raw HTML → define handling (render-time sanitize-through vs one-off
  normalization) with rationale — never left unaddressed.

```
Given accommodation.description is reverting to plain text (FR-2)
  When the column is audited and the strip migration is run
  Then no accommodation.description row contains markdown markers (** , ## , [..](..) , list bullets) afterward
  And a sample of migrated rows is verified to read as clean plain text

Given the accommodation.description strip migration
  When it completes
  Then the spec records the exact strip rules applied and the count of rows changed (evidence, not a handwave)

Given the data audit query is run against event.description
  When the sample + raw-HTML-marker count is reviewed
  Then the spec records whether any row contains raw HTML/unexpected markup

Given event.description rows are all plain text or already markdown
  When the decision is recorded
  Then it states "no row migration needed" with the row-count evidence

Given any audited event.description row contains raw HTML
  When the decision is recorded
  Then it states the chosen handling (render-time sanitize-through vs one-off normalization) with rationale
```

## 5. Phased implementation plan

Ordered low-risk → high-risk and to keep the highest-risk item (the DB migration for
`richDescription`) well-isolated in its own phase. Toolbar config and the event flip land first
(config-only, independently testable); then the accommodation.description plain revert + data
migration; then the full richDescription vertical slice (schema → DB → service → admin → web) as
one isolated phase; then documentation + sanitization; then closeout. Each phase is a natural
pause point.

### Phase 1 — Per-entity toolbar matrix + `event.description` → RICH_TEXT (FR-5 + FR-1)

1. Populate `typeConfig.allowedFeatures` per the LOCKED FR-5 matrix on every rich field config:
   `destination.description`, `event.description`, `post.content` → full set incl. link;
   `accommodation.richDescription` → full set minus link (the field still flips type in Phase 3).
2. Flip `event.description` `TEXTAREA → RICH_TEXT` in events `basic-info.consolidated.ts`,
   preserving `required`, `permissions`, `minLength 50`, `maxLength 5000`; verify `event.schema.ts`
   accepts markdown; ensure event view-mode uses `RichTextViewField`.
3. Admin config tests: per-entity `allowedFeatures` (link present for event/destination/post),
   `event.description` is RICH_TEXT with the right `typeConfig`.

**Pause point:** every rich field has a correct toolbar; event description is WYSIWYG; no web/DB
change yet.

### Phase 2 — `accommodation.description` → plain text + data strip (FR-2 + FR-9 part 1)

4. Admin: flip `accommodation.description` `RICH_TEXT → TEXTAREA`, drop rich `typeConfig`, keep
   `minLength 30`/`maxLength 2000`.
5. Web: stop routing `accommodation.description` through `renderContent` in `[slug].astro`; render
   as plain text. Add a regression test asserting it is NOT markdown-parsed.
6. Data migration: audit + strip markdown from existing `accommodation.description` rows; record
   the strip rules + changed-row count.
7. Admin config test: `accommodation.description` is TEXTAREA (not RICH_TEXT).

**Pause point:** accommodation description is plain everywhere (admin, web, data); no raw markdown
visible to users.

### Phase 3 — `accommodation.richDescription` full backing (FR-3 + FR-3b + FR-4) — HIGHEST RISK, isolated

8. `@repo/schemas`: add `richDescription` `z.string().max(5000).optional()` to the accommodation
   schema (+ schema test).
9. DB: `pnpm db:generate` to create the `rich_description` migration under
   `packages/db/src/migrations/`, update the Drizzle model, `pnpm db:migrate`; commit the migration
   file (drift guard). NEVER `db:push`. Round-trip test.
10. service-core: persist on create/update, read on get/list; round-trip test. Implement the
    **PUBLIC gate-by-omission (FR-3b)** in the public read path/transform: include `richDescription`
    only when the owning host has `CAN_USE_RICH_DESCRIPTION`, else omit/null; admin path returns it
    raw. Tests for BOTH cases (premium-host present, non-premium-host absent) + admin-raw.
11. Admin: flip `richDescription` `TEXTAREA → RICH_TEXT`, remove the TODO, keep
    `CAN_USE_RICH_DESCRIPTION` gate + `maxLength 5000` + `allowedFeatures` (no link); config test
    (entitled vs non-entitled EDIT gate).
12. Web: render `richDescription` on the accommodation detail page via `renderContent` (`renderRich`)
    using the presence rule `richDescription ? renderRich : renderPlain(description)`; the web does
    NOT evaluate `CAN_USE_RICH_DESCRIPTION` (Option 1). Render tests: payload-with-richDescription →
    formatted; payload-without → `renderPlain(description)`; pin "web does not query entitlements".

**Pause point:** richDescription is a real persisted premium rich field end-to-end; the PUBLIC gate
is enforced server-side by omission; the web only does a presence check; the DB migration is
committed and isolated.

### Phase 4 — ADR + tiptap boundary + sanitization XSS tests (FR-6 + FR-7 + FR-8)

13. Write the canonical-format ADR under `docs/decisions/` (Markdown canonical; per-entity toolbar
    policy; three markdown touchpoints; newsletter-JSON boundary; new-field recipe); link it from
    the ADR index; record the `tiptap-renderer` finding inside it.
14. Add the description-scoped XSS test suite (malicious stripped + allowed-subset survives) against
    `renderContent` / `sanitizeHtml`, covering richDescription rich content.
15. Finish the `event.description` audit (FR-9 part 2); record the decision (expected: none needed).

**Pause point:** format ratified, duality explained, sanitization pinned, audit recorded.

### Phase 5 — Closeout

16. Flip spec + task index to completed; manual admin smoke of `event.description` (full toolbar
    incl. link) and `accommodation.richDescription` editors (entitled + non-entitled HOST, linkless
    toolbar); web smoke of an event with markdown, an accommodation with plain description, a
    premium-host accommodation whose public payload INCLUDES `richDescription` (rich rendered), and a
    non-premium-host accommodation whose public payload OMITS `richDescription` (plain `description`
    fallback) — confirming the FR-3b gate-by-omission on both owning-host tiers.

## 6. Risk and rollback

| Risk | Mitigation |
|------|------------|
| **XSS via rich content (incl. host-authored `richDescription`)** — a markdown/HTML payload reaching `set:html` unsanitized | All rich body fields go through `renderContent` → `sanitizeHtml`; FR-8 pins the sanitizer with explicit malicious-payload tests covering richDescription; FR-4 pins the "no raw `set:html`" rule with a guarding test |
| **`accommodation.description` data migration leaves raw markdown visible** — if seed rows are not stripped, users see literal `**`/`##` once the field renders plain | FR-9 makes the strip migration REQUIRED with a post-condition test (no markdown markers remain) and records the strip rules + changed-row count; FR-2 web test asserts plain rendering |
| **New `rich_description` DB migration** — wrong carril / uncommitted drift / `db:push` against a remote | FR-3 / Phase 3 mandate the SPEC-178 versioned carril (`pnpm db:generate` → `pnpm db:migrate`, commit the migration file); drift guard blocks CI on uncommitted schema drift; NEVER `db:push`; migration isolated in its own phase |
| **Premium entitlement-gate regression on `richDescription` (admin EDIT surface)** — the rich editor shows/hides for the wrong actor | Keep the `entitlementKey` on the admin field config; FR-3 tests assert the EDIT gate for entitled vs non-entitled actors (admin); manual smoke with both |
| **Backend gate-by-omission is incorrect (FR-3b, security-relevant)** — a bug either LEAKS premium rich content on a non-premium host's public page, or HIDES it for a premium host | FR-3b enforces the gate in ONE server-side place (public transform/read path) and is pinned by acceptance tests for BOTH cases: premium owning-host → `richDescription` present in the public payload; non-premium owning-host → omitted/null; plus an admin-raw test. FR-4 keeps the web dumb (presence check only) so the gate cannot be bypassed client-side. Manual smoke covers both owning-host tiers |
| **Markdown shown as raw text** — `##` / `**` leaking to users if a rich field skips `renderContent` | FR-4 pins all rich pages render via `renderContent`; event-detail markdown render test asserts `<h2>`/`<strong>` not literal markers |
| **Deleting `tiptap-renderer` (mistaken as dead)** | Finding C proves it powers newsletters; §10 D-4 forbids deletion; ADR documents the boundary |
| **Admin-view vs web-render divergence** (finding D — different markdown parsers) | Documented in the ADR as a known divergence; aligning the admin view renderer is optional/verify-then-decide, not mandated, to keep blast radius small |

## 7. Testing strategy

Per the project's Test-Informed Development rules (Vitest, AAA, ≥90% coverage):

- **Pure logic — tests first:** `renderContent` / `sanitizeHtml` behavior — the FR-8 malicious
  cases (script, `javascript:` href, `onerror`/`onclick`, non-YouTube iframe, disallowed scheme)
  and the allowed-subset survival cases (bold/italic/underline/h2-h3/lists/blockquote/external+
  internal links), covering richDescription rich content. These extend the existing
  `apps/web/test/pages/detail-pages-html-sanitization.test.ts` and
  `publicaciones-content-markdown.test.ts`.
- **Schema — tests first:** `richDescription` `z.string().max(5000).optional()` accepts a 5000-char
  string, rejects 5001 chars, allows undefined (FR-3).
- **service-core round-trip — tests alongside:** create/update an accommodation with `richDescription`
  and re-read it; the value round-trips DB ↔ API (FR-3).
- **PUBLIC gate-by-omission — tests alongside (FR-3b, security-relevant):** the public accommodation
  transform/endpoint includes `richDescription` when the owning host is entitled
  (`CAN_USE_RICH_DESCRIPTION`) and OMITS/nulls it when not — assert BOTH cases. Plus a test that the
  ADMIN endpoint returns `richDescription` raw for a non-entitled host (admin EDIT surface is not
  gated by omission).
- **DB migration round-trip — per SPEC-178 patterns:** the generated `rich_description` migration
  applies cleanly and the column round-trips a value; drift guard passes (no uncommitted drift).
- **Config — tests alongside:** admin config assertions for `event.description` (RICH_TEXT,
  maxLength 5000, required, `allowedFeatures` incl. LINK); `accommodation.description` (TEXTAREA,
  not RICH_TEXT); `accommodation.richDescription` (RICH_TEXT, entitlementKey
  CAN_USE_RICH_DESCRIPTION, maxLength 5000, `allowedFeatures` EXCLUDES LINK, TODO removed); and
  the per-entity `allowedFeatures` matrix (link present for event/destination/post, absent for
  richDescription) in the existing admin feature config test suites (e.g.
  `apps/admin/test/accommodation-consolidated.test.ts`).
- **Web render integration:** event-detail markdown renders formatted; `accommodation.description`
  plain-render test via `renderPlain` (no markdown interpretation — `**`/`##`/`-`/`1.`/`[]()` not
  parsed, not piped through `renderContent`; markdown metacharacters in the data are escaped, NOT
  formatted); the accommodation presence-rule tests (payload WITH `richDescription` →
  `renderRich`/`renderContent` formatted; payload WITHOUT → `renderPlain(description)`); a test
  pinning that the web does NOT query `CAN_USE_RICH_DESCRIPTION` (Option 1 — presence check only);
  the rich-page `renderContent`-only guard. Note the split: `renderRich` formats markdown,
  `renderPlain` escapes markdown metacharacters and does NOT format them — both directions asserted.
- **Data audit + migration:** the `accommodation.description` strip migration has a post-condition
  assertion (no markdown markers remain) + recorded changed-row count; the `event.description` audit
  is a one-off query whose result + decision is recorded (FR-9).
- **Regression:** any bug found during the work gets a reproducing test before the fix.
- **No committed PNGs** (project policy): visual confirmation in the Phase 5 manual smoke; all
  automated assertions are over DOM / parsed HTML / computed values, never screenshots.
- **Manual smoke (Phase 5):** event description editor (full toolbar incl. link) + accommodation
  richDescription editor (entitled and non-entitled HOST, linkless toolbar) in the admin; on the web
  (es locale): an event with markdown in its description, an accommodation with a plain description
  (no raw markdown), a premium-host accommodation whose public payload includes `richDescription`
  (rich rendered), and a non-premium-host accommodation whose public payload omits it (plain
  `description` fallback) — confirming the FR-3b gate-by-omission end-to-end.

## 8. Out-of-scope / future work

- **Expanding the toolbar with NEW features** (images, tables, code blocks beyond the current set) —
  future spec. FR-5 only RESTRICTS the existing feature set per entity; it adds no new capability.
- **Aligning the admin-view markdown renderer** (`RichTextViewField` regex+DOMPurify) onto the
  same `marked` pipeline as the web — optional hardening, deferred unless the data audit surfaces
  a divergence that matters.
- **Migrating `summary`/`excerpt` fields to rich text** — rejected (D-2); they are plain-text
  card/SEO summaries.
- **Tiptap-JSON for entity descriptions** — rejected (D-1).
- **Backend pre-rendered sanitized HTML for the public payload (Option 2)** — rejected (D-14) as
  over-engineering; revisit only if a non-web client needs the rendered body.
- **Backend single markdown-normalized field escaping plain → markdown (Option 3)** — rejected
  (D-15) as fragile.
- **Any newsletter/email rich-text changes** — out of scope (D-7).
- **Adding links to accommodation rich content** — deliberately excluded by the FR-5 matrix
  (anti-spam/SEO); not a future enhancement unless the policy changes.

## 9. Key file pointers

| File | Relevance |
|------|-----------|
| `apps/admin/src/features/events/config/sections/basic-info.consolidated.ts` | FR-1 — flip `event.description` `TEXTAREA → RICH_TEXT`; FR-5 — `allowedFeatures` full incl. link |
| `apps/admin/src/features/accommodations/config/sections/basic-info.consolidated.ts` | FR-2 — flip `description` `RICH_TEXT → TEXTAREA` (plain); FR-3 — flip `richDescription` `TEXTAREA → RICH_TEXT`, remove TODO, keep `CAN_USE_RICH_DESCRIPTION` gate; FR-5 — richDescription `allowedFeatures` minus link |
| `apps/admin/src/features/destinations/config/sections/...consolidated.ts` | FR-5 — declare `destination.description` `allowedFeatures` full incl. link |
| `apps/admin/src/features/posts/config/sections/...consolidated.ts` | FR-5 — declare `post.content` `allowedFeatures` full incl. link |
| `apps/admin/src/components/entity-form/fields/RichTextField.tsx` | Shared TipTap editor — supports `typeConfig.allowedFeatures` + `isFeatureAllowed` (FR-5 reference) |
| `apps/admin/src/components/entity-form/views/RichTextViewField.tsx` | Admin view renderer (finding D — different markdown parser; document in ADR) |
| `apps/admin/src/components/entity-form/enums/form-config.enums.ts` | `FieldTypeEnum.RICH_TEXT`/`TEXTAREA`, `RichTextFeatureEnum` (FR-5 feature values) |
| `packages/schemas/src/entities/event/event.schema.ts` | Verify `description` `z.string().min(50).max(5000)` accepts markdown (FR-1) |
| `packages/schemas/src/entities/accommodation/accommodation.schema.ts` | FR-3 — ADD `richDescription` `z.string().max(5000).optional()`; confirm `description` stays plain `z.string().min(30).max(2000)` (FR-2) |
| `packages/db/src/...` (accommodation Drizzle model) | FR-3 — add `rich_description` column to the model |
| `packages/db/src/migrations/` | FR-3 — generated `rich_description` migration via `pnpm db:generate` (SPEC-178 versioned carril); commit it |
| `packages/service-core/...` (accommodation service) | FR-3 — persist/read `richDescription` on create/update/get/list; FR-3b — PUBLIC read path applies the gate-by-omission (include `richDescription` only when the owning host has `CAN_USE_RICH_DESCRIPTION`; admin returns raw) |
| `apps/api/...` (public accommodation endpoint/transform) | FR-3b — the PUBLIC payload omits/nulls `richDescription` for non-entitled hosts; the contract: present/non-null signals entitled |
| `apps/web/src/lib/api/transforms.ts` | FR-4 — web consumes the already-gated public payload; renders `richDescription` if present (`renderRich`) else `renderPlain(description)`; NEVER evaluates `CAN_USE_RICH_DESCRIPTION` |
| `apps/web/src/lib/render-content.ts` | Canonical web pipeline `marked → sanitizeHtml` (FR-4, FR-8) |
| `apps/web/src/lib/sanitize-html.ts` | The sanitizer to pin with XSS tests (FR-8) |
| `apps/web/src/pages/[lang]/alojamientos/[slug].astro` | FR-2 — STOP routing `description` through `renderContent` (render plain via `renderPlain`); FR-4 — apply the presence rule `richDescription ? renderRich(richDescription) : renderPlain(description)`; do NOT evaluate `CAN_USE_RICH_DESCRIPTION` (the backend gated by omission, FR-3b) |
| `apps/web/src/pages/[lang]/destinos/[...path].astro` | destination render via `renderContent` (FR-4) |
| `apps/web/src/pages/[lang]/eventos/[slug].astro` | event render via `renderContent` (FR-4; now rich) |
| `apps/web/src/pages/[lang]/publicaciones/[slug].astro` | post render via `renderContent` (FR-4) |
| `apps/web/src/components/accommodation/Description.astro` | `set:html` sink for accommodation rich content (requires sanitized HTML); FR-2 affects whether `description` feeds it |
| `packages/utils/src/tiptap-renderer.ts` | Tiptap-JSON → HTML for NEWSLETTERS — keep, document boundary (FR-7, D-4) |
| `packages/notifications/src/templates/newsletter/newsletter-campaign.tsx` | Consumer of tiptap-renderer (finding C) |
| `apps/admin/src/components/newsletter/RichTextEditor.tsx` | Newsletter Tiptap-JSON editor (separate domain — D-7) |
| `apps/web/test/pages/detail-pages-html-sanitization.test.ts` | Extend with FR-8 XSS cases |
| `apps/web/test/pages/publicaciones-content-markdown.test.ts` | Existing markdown render test (reference/extend) |
| `docs/decisions/` (+ `docs/decisions/README.md`) | FR-6 — new canonical-format ADR + index link |

## 10. Design decisions (locked)

1. **D-1 — Markdown is the canonical format** for entity rich-text fields
   (admin `tiptap-markdown` `html:false` ↔ web `marked` + `sanitize-html`). Tiptap-JSON is
   rejected for entity descriptions (ratified in the FR-6 ADR).
2. **D-2 — `event.description` migrates `TEXTAREA → RICH_TEXT`** (full toolbar incl. link, FR-1/FR-5).
3. **D-3 — `accommodation.description` reverts `RICH_TEXT → PLAIN TEXT`** (owner decision). Admin =
   `TEXTAREA`; web renders plain (NOT through `renderContent`); existing rows are stripped of seed
   markdown via the REQUIRED FR-9 migration. Default web mechanism: stop routing through
   `renderContent` and emit `description` as a plain text node (alt considered: HTML-escape it —
   rejected as redundant since it is no longer HTML).
4. **D-4 — `accommodation.richDescription` gets FULL backing in THIS spec** (owner decision — NOT
   cosmetic, NOT a spin-off). New `@repo/schemas` field `z.string().max(5000).optional()` + new
   `rich_description` DB column via the SPEC-178 versioned carril + service-core persistence + admin
   `RICH_TEXT` premium-gated (`CAN_USE_RICH_DESCRIPTION`, `allowedFeatures` minus link) + web render
   via `renderContent`. The PUBLIC premium gate is enforced server-side by omission (D-13). It is the
   ONLY rich field on accommodation. `maxLength` = **5000**.
5. **D-5 — Per-entity configurable toolbar (`allowedFeatures`), LOCKED matrix** (FR-5):
   accommodation content is LINKLESS (host-editable → anti-spam/SEO); `accommodation.description`
   is plain text (no features); `accommodation.richDescription` is rich but linkless;
   `destination.description` / `event.description` / `post.content` get the FULL set incl. link
   (editorial/staff content). No new toolbar features are added — only restriction of the existing
   set (D-6).
6. **D-6 — No NEW toolbar features** (images, tables, code blocks) beyond the shipped set. FR-5
   only restricts the existing features per entity.
7. **D-7 — `packages/utils/src/tiptap-renderer.ts` is NOT deleted** — it powers the newsletter/
   email subsystem (a different domain); the ADR documents the boundary.
8. **D-8 — DB migration uses the SPEC-178 versioned carril** (`pnpm db:generate` → `pnpm db:migrate`,
   commit the migration file; drift guard enforced). NEVER `db:push`. Isolated in its own phase.
9. **D-9 — Required data migration: `accommodation.description` markdown strip** (because it becomes
   plain text). Default: one-off normalization of stored data (not render-time stripping). For
   `event.description` / `richDescription` (rich): verify-then-decide, no speculative migration if
   rows are already plain text / markdown.
10. **D-10 — Sanitization is mandatory and pinned by tests.** Every RICH web body field reaches
    `set:html` only via `renderContent` → `sanitizeHtml` (incl. host-authored `richDescription`);
    FR-8 pins the sanitizer with explicit XSS assertions; FR-4 pins the "no raw `set:html`" rule and
    the "accommodation.description is NOT markdown-parsed" rule.
11. **D-11 — Premium entitlement gate enforced on BOTH surfaces, but in DIFFERENT places.** The admin
    EDIT surface respects `CAN_USE_RICH_DESCRIPTION` via the PlanEntitlementGate (FR-3). The PUBLIC
    web surface is gated SERVER-SIDE by omission (D-13 / FR-3b) — the web itself does NOT evaluate the
    entitlement. Non-entitled owners get neither the editor (admin) nor the web-rendered rich content
    (because the public payload omits the field).
12. **D-12 — Rich web detail pages already render via `renderContent`** (finding A). FR-4 is
    pin-and-protect for destination/event/post; new for `richDescription`; and a deliberate REMOVAL
    for `accommodation.description` (now plain via `renderPlain`).
13. **D-13 — PUBLIC premium gate = entitlement-by-omission in the backend; the web renders two fields
    without evaluating entitlements (owner-approved Option 1).** The web NEVER checks
    `CAN_USE_RICH_DESCRIPTION`. The PUBLIC accommodation endpoint/transform includes `richDescription`
    only if the owning host is entitled; otherwise it is omitted/null (FR-3b). Admin endpoints return
    it raw for editing regardless. Web render rule (FR-4):
    `richDescription ? renderRich(richDescription) : renderPlain(description)`, where `renderRich` =
    the existing `renderContent` pipeline and `renderPlain` = HTML-escaped plain text that MUST NOT be
    markdown-parsed (no `**`/`##`/`-`/`1.`/`[]()` interpretation). The web's only decision is
    presence-of-field. API contract: `richDescription` present/non-null in the public payload SIGNALS
    the host is entitled; absent/null means show the plain `description`; the field's nullability is
    documented in the schema/transform contract. **Why:** keeps entitlement evaluation server-side
    (correct) AND the markdown+sanitize pipeline in ONE place (web), avoiding a backend pipeline port,
    a double payload shape, and presentation/cache coupling — at the cost of one cheap presence-check
    branch on the web.
14. **D-14 — REJECTED Option 2: backend sends pre-rendered sanitized HTML and the web is 100% dumb.**
    Over-engineering unless more clients appear — it moves the markdown+sanitize pipeline to the
    backend, forces a double payload shape (raw for admin, HTML for public), and couples
    cache-invalidation to presentation.
15. **D-15 — REJECTED Option 3: backend sends a single markdown-normalized field, escaping plain →
    markdown-safe.** The plain → markdown escape is fragile and reintroduces the spurious-formatting
    bug (the plain `description` could gain accidental markdown semantics).
