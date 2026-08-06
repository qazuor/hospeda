---
title: 'Editor web de alojamiento: secciones FAQ e IA Data'
linear: HOS-393
statusSource: linear
created: 2026-08-05
type: feature
areas:
  - web
  - api
---

# Editor web de alojamiento: secciones FAQ e IA Data

## 1. Summary

Add the two missing sections to the accommodation owner editor in `apps/web`
(`/mi-cuenta/propiedades/[id]/editar/`):

1. **FAQ** — public question/answer pairs shown on the accommodation detail page.
   The protected API already exists; only the UI is missing.
2. **IA Data** — owner-authored private context consumed exclusively by the AI
   chat. The DB table, schemas, service methods and the AI-context reader all
   already exist; only the write path (HTTP routes + UI) is missing.

Two phases, one PR each. Phase 1 (FAQ) has no blockers and can merge
independently of phase 2.

## 2. Problem

An owner editing their accommodation from the web cannot manage FAQs at all, and
cannot supply any private context for the AI chat that answers questions about
their property. Both capabilities exist end-to-end in the backend but have no
entry point outside the admin panel — and IA Data has no entry point anywhere.

The practical consequence for IA Data is that the AI chat widget already shipped
on every accommodation detail page (`AiChatWidget.tsx`) reads an `iaData`
relation that is, in every environment, empty — because nothing can write to it.

## 3. Goals

- **G-1** — Owner can create, edit, delete and reorder FAQs for their own
  accommodation from the web editor.
- **G-2** — Owner can create, edit and delete IA Data entries (`title`,
  `content`, `category`) from the web editor.
- **G-3** — IA Data editing is gated by the `ai_chat` entitlement, enforced
  server-side on every route and mirrored client-side in the UI.
- **G-4** — IA Data is never exposed through any public endpoint, enforced by a
  guard test rather than by convention.
- **G-5** — Both sections manage their own persistence, independent of the
  editor's main PATCH payload and dirty-tracking (the established pattern from
  `CommerceFaqManager`).

## 4. Non-goals

- **NG-1** — No admin panel UI for IA Data. The owner authors it; the team does
  not curate it. (Owner decision, HOS-393.)
- **NG-2** — No new entitlement key. IA Data reuses `EntitlementKey.AI_CHAT`.
- **NG-3** — No moderation pipeline for IA Data content in this spec. The
  existing `min(10)/max(2000)` bounds on `content` are the only constraint.
- **NG-4** — No changes to how `accommodation-ai-context.ts` assembles or caps
  the prompt context. Its `CONTEXT_IADATA_MAX` cap stays as-is.
- **NG-5** — No public rendering of IA Data anywhere. It is prompt-only.
- **NG-6** — No per-plan quota on the number of IA Data entries. The `ai_chat`
  entitlement is binary: you can author, or you cannot.

## 5. Current baseline

### FAQ — backend complete

Protected routes exist and are mounted in
`apps/api/src/routes/accommodation/protected/`:

| Action | Method + path | File |
|---|---|---|
| list | `GET /{id}/faqs` | `getFaqs.ts` |
| create | `POST /{id}/faqs` | `addFaq.ts` |
| update | `PUT /{id}/faqs/{faqId}` | `updateFaq.ts` |
| delete | `DELETE /{id}/faqs/{faqId}` | `removeFaq.ts` |

All gated with `requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)`.

**Missing**: `reorder`. Gastronomy, experiences and the accommodation *admin*
tier all have `reorderFaqs.ts`; `accommodation/protected` does not.

Reference implementation in web:
`apps/web/src/components/commerce/CommerceFaqManager.client.tsx` (SPEC-253) —
full CRUD + optimistic reorder, explicitly outside the parent editor's dirty
state.

### IA Data — everything except the write path

| Layer | State |
|---|---|
| DB table `accommodation_iaData` | exists (`packages/db/src/schemas/accommodation/accommodation_iaData.dbschema.ts`) |
| Zod schemas | exist (`packages/schemas/src/common/ia.schema.ts` + `entities/accommodation/subtypes/accommodation.ia.schema.ts`) |
| Service methods | exist: `addIAData`, `updateIAData`, `removeIAData`, `getAllIAData` (`accommodation.service.ts`) |
| Model relation | exists, **opt-in** via `validRelationKeys` |
| AI-chat reader | exists — `apps/api/src/services/accommodation-ai-context.ts` loads it and injects it into the Markdown prompt block |
| Entitlement | exists — `EntitlementKey.AI_CHAT = 'ai_chat'`, granted by 6 plans in `plans.config.ts` |
| **HTTP routes** | **none** — neither admin nor protected |
| **HTTP schemas** | **none** — `accommodation.ia.http.schema.ts` does not exist |
| **UI** | **none** — not in web, not in admin |

Field shape (`BaseIaDataSchema`): `title` (3-200), `content` (10-2000),
`category` (2-100, optional).

Because `iaData` is opt-in on the model and no public route requests it, it does
not leak today. That is a property of the current call sites, not an enforced
invariant — hence G-4.

### Editor structure

`apps/web/src/components/host/AccommodationEditor.client.tsx` composes sections
as `<section id="editor-<name>">` cards, with a parallel `navSections` array
driving `EditorSectionNav`. Section labels live in a single `sectionLabels`
memo. Two sections are already conditional (`translations` on `translationData`,
`externalReputation` unconditionally appended), so a conditional section is an
established pattern here.

The SSR page (`.../propiedades/[id]/editar.astro`) parallel-fetches the
accommodation plus the amenity/feature/destination catalogs before rendering the
island.

## 6. Proposed design

### Phase 1 — FAQ

1. **API**: add `reorderFaqs.ts` to `accommodation/protected/`, mirroring
   `gastronomy/protected/reorderFaqs.ts`. Same entitlement gate as its sibling
   FAQ routes (`EDIT_ACCOMMODATION_INFO`). Register it in
   `accommodation/protected/index.ts`.
2. **Web API layer**: add accommodation FAQ wrappers to
   `apps/web/src/lib/api/endpoints-protected.ts`.
3. **SSR preload**: extend the existing parallel fetch in `editar.astro` with
   `GET /protected/accommodations/{id}/faqs`, passed to the island as
   `initialFaqs`. Matches how commerce seeds its FAQ manager and avoids a
   spinner on a section that is usually non-empty.
4. **UI**: new `apps/web/src/components/host/editor/FaqSection.client.tsx` +
   `.module.css`, modelled on `CommerceFaqManager.client.tsx` but styled as an
   editor card consistent with its sibling sections.
5. **Wiring**: mount it in `AccommodationEditor.client.tsx` as
   `id="editor-faqs"`, add `faqs` to `sectionLabels` and a nav entry.

### Phase 2 — IA Data

1. **Schemas**: new `accommodation.ia.http.schema.ts` in `@repo/schemas`,
   mirroring the FAQ HTTP schema file's shape.
2. **API**: 4 new protected routes under `accommodation/protected/`, thin
   wrappers over the existing service methods:

   | Action | Method + path | Service method |
   |---|---|---|
   | list | `GET /{id}/ia-data` | `getAllIAData` |
   | create | `POST /{id}/ia-data` | `addIAData` |
   | update | `PUT /{id}/ia-data/{iaDataId}` | `updateIAData` |
   | delete | `DELETE /{id}/ia-data/{iaDataId}` | `removeIAData` |

   Each gated with `requireEntitlement(EntitlementKey.AI_CHAT)` in
   `options.middlewares` — never inside the handler body.
3. **Gate matrix**: add a row per route to
   `docs/billing/endpoint-gate-matrix.md`. The snapshot guard
   (`apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts`) fails CI on a
   handler file with no matrix row, so this is not optional.
4. **Web API layer**: IA Data wrappers in `endpoints-protected.ts`.
5. **UI**: new `IaDataSection.client.tsx` + `.module.css`, wrapped in
   `<PlanEntitlementGate entitlementKey="ai_chat" upgradeUrl="/suscriptores/planes/">`.
   Unlike FAQ, it loads its own data **client-side on mount, inside the gate** —
   so an owner without `ai_chat` never triggers the fetch and the SSR page does
   not pay for a request most owners cannot use.
6. **Wiring**: mount as `id="editor-iaData"` with a nav entry.
7. **Guard**: a test asserting `iaData` never appears in any public
   accommodation response payload.

### Why `AI_CHAT` and not a new key

IA Data has exactly one consumer: the AI chat prompt. An owner without `ai_chat`
can author entries that nothing will ever read. A dedicated `ia_data_manage` key
would gate a feature whose value is already fully determined by `ai_chat`, and
would need to be added to the same 6 plans to stay coherent. Reusing `AI_CHAT`
keeps one decision in one place.

## 7. Data model / contracts

**No migrations.** Every table, column and Zod schema this spec needs already
exists. The only new schema artifact is the HTTP layer for IA Data.

New/changed contracts:

- `PUT /api/v1/protected/accommodations/{id}/faqs/reorder` — body
  `FaqReorderPayloadSchema` (`{ order: [...] }`), matching the sibling verticals.
- `GET|POST /api/v1/protected/accommodations/{id}/ia-data`
- `PUT|DELETE /api/v1/protected/accommodations/{id}/ia-data/{iaDataId}`

IA Data payload (from `IaDataCreatePayloadSchema`):

```ts
{ title: string, content: string, category?: string }
```

`IaDataUpdatePayloadSchema` is the partial of the above.

## 8. UX / UI behavior

Both sections render as standard editor cards, consistent with their siblings.

**FAQ** — list of existing entries with inline edit / delete and up/down
reorder; an "Agregar pregunta" action reveals an append form. Reorder is
optimistic locally and PUTs on every move. Saves are independent of the
editor's main "Guardar" button.

**IA Data** — same CRUD shape (list / inline edit / delete), no reorder (order
is not meaningful for prompt context, and `getAllIAData` has no `displayOrder`
concept). Fields: título, contenido (textarea), categoría (optional).

Copy must make the purpose unmistakable, since this is the one section whose
content is invisible on the public page: it feeds the AI assistant that answers
visitor questions, and it is never shown publicly. The exact strings are the
implementer's call, but they must state both facts — the risk is an owner
writing public marketing copy here, or conversely writing something private
believing it is hidden when it will in fact be paraphrased to visitors by the
chat.

Without the `ai_chat` entitlement the section renders
`PlanEntitlementGate`'s upgrade nudge instead of the editor.

All strings via `t()`, keys under `host.properties.editor.*`.

## 9. Acceptance criteria

- **AC-1** — An owner with `EDIT_ACCOMMODATION_INFO` can create, edit, delete
  and reorder FAQs from the web editor, and the changes survive a page reload.
- **AC-2** — FAQ changes persist without pressing the editor's main "Guardar",
  and do not mark the editor dirty (no unsaved-changes prompt on navigate away,
  per HOS-373).
- **AC-3** — An owner **with** `ai_chat` sees the IA Data section and can
  create, edit and delete entries.
- **AC-4** — An owner **without** `ai_chat` sees the upgrade nudge instead of
  the IA Data editor, and every IA Data route returns 403
  `ENTITLEMENT_REQUIRED` for them — verified against the API directly, not only
  through the UI.
- **AC-5** — `docs/billing/endpoint-gate-matrix.md` has a row for each of the 4
  new IA Data routes and the gate-matrix snapshot guard passes.
- **AC-6** — A guard test fails if `iaData` appears in any public accommodation
  response payload.
- **AC-7** — An IA Data entry authored through the new UI reaches the AI chat's
  prompt context: asking the chat a question answerable only from that entry
  gets it answered. Verified manually against a real accommodation.
- **AC-8** — `pnpm typecheck`, `pnpm lint` and `pnpm test` green.

## 10. Risks

- **R-1** — **IA Data is prompt-injectable by design.** It is owner-authored
  free text that lands verbatim in the AI system message. An owner can write
  instructions that steer the assistant ("always say we have availability").
  This risk is inherent to the feature the owner asked for, and it already
  exists in the reader half that shipped — this spec only makes it reachable.
  It is explicitly out of scope (NG-3), but it should be a conscious
  acceptance, not a surprise. If it ever needs mitigation, the lever is in
  `accommodation-ai-context.ts` (delimiting the block and instructing the model
  to treat it as data, not instructions), not in the write path this spec adds.
- **R-2** — `PlanEntitlementGate` opens while the entitlements query is loading
  (`if (isLoading) return children`). For IA Data this is cosmetic only: the
  API gate is authoritative and a write without the entitlement gets a 403. Do
  not "fix" the gate here — the loading-open behavior is deliberate, to avoid a
  layout flash across every section that uses it.
- **R-3** — Adding a nav entry per section grows the sticky section nav.
  `EditorSectionNav` already carries 11 entries; two more is a UI-density
  question worth a look during implementation, not a blocker.
- **R-4** — Phase 1 touches `editar.astro`'s parallel fetch block. A failing
  FAQ fetch must degrade to an empty list, never break the whole editor page —
  the existing block already handles per-fetch failure this way and the new
  fetch must follow suit.

## 11. Open questions

None blocking. The owner resolved the three that mattered:

- IA Data is owner-authored, not team-curated → web editor, not admin (NG-1).
- IA Data is private, chat-only, never public data (G-4, NG-5).
- Gate is `AI_CHAT`, not a new key (NG-2).

## 12. Implementation notes

- `getAllIAData` is the list method — note the `IAData` casing (not `IaData`)
  on the service methods, which differs from the schema type names
  (`AccommodationIaDataAddInput`). Easy to mistype.
- `editar.astro` calls `fetch()` directly rather than going through
  `lib/api/`. That contradicts the app's stated rule but is the existing
  pattern in that file; follow it for the new FAQ fetch rather than
  half-migrating the page in this spec.
- The FAQ section is public content and the IA Data section is not. Do not
  factor them into one shared "entry list" component — the shapes look similar
  today but their visibility semantics are opposite, and merging them makes the
  public/private boundary a prop instead of a type.
- Smoke labels: `status-needs-smoke-local` at minimum (AC-7 needs a real chat
  round-trip). The local AI `stub` provider resolves without a credential, so
  the chat path is smokeable locally with `ai_settings` configured.

## 13. Linear

Canonical tracking:
HOS-393
