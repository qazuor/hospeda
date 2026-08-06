---
title: 'Editor web de alojamiento: sección FAQ con visibilidad por canal'
linear: HOS-393
statusSource: linear
created: 2026-08-05
type: feature
areas:
  - web
  - api
  - db
---

# Editor web de alojamiento: sección FAQ con visibilidad por canal

> **Cambio de alcance (2026-08-06).** Esta spec se llamaba "secciones FAQ e IA
> Data" y su fase 2 construía IA Data como sección del editor. Al revisar si esa
> feature tenía sentido funcional, la conclusión fue que no: se solapaba casi
> por completo con FAQ, y su uso más intuitivo (instrucciones de comportamiento
> al asistente) era precisamente lo que la defensa anti-prompt-injection tenía
> que neutralizar. IA Data se elimina (**HOS-398**) y la configuración de
> comportamiento del bot pasa a ser configuración estructurada (**HOS-399**).
> La fase 2 de esta spec es ahora la visibilidad por canal en FAQ. El registro
> completo de la discusión está en §11.

## 1. Summary

Two phases, one PR each.

**Fase 1 (mergeada, PR #2689)** — sección FAQ en el editor de alojamiento de
`apps/web` (`/mi-cuenta/propiedades/[id]/editar/`): listar, crear, editar,
borrar y reordenar, con persistencia propia.

**Fase 2** — cada FAQ gana **dos checkboxes independientes**, ambos marcados por
defecto:

| Checkbox | Efecto |
|---|---|
| **Visible en la ficha pública** | la FAQ se muestra en la página del alojamiento y entra en el JSON-LD |
| **Usable por la IA** | la FAQ entra en el contexto del chat de IA |

Más un texto explicativo en la sección que enseñe el concepto — sobre todo el
caso menos obvio: por qué alguien querría una FAQ que no se publica.

## 2. Problem

**Fase 1**: un dueño no podía gestionar FAQs desde la web.

**Fase 2**: hoy una FAQ es todo-o-nada. Se publica en la ficha *y* alimenta al
chat, sin control separado. Eso deja dos necesidades sin cubrir:

- **Información que el chat debería saber pero que no va en la vidriera.** "La
  pileta está en refacción hasta noviembre" (temporal, ensucia la ficha), "hay
  flexibilidad de late check-out si no hay reserva siguiente" (margen comercial
  que no se quiere publicar como promesa), "de noche conviene pedir remis"
  (honesto en una conversación 1-a-1, feo en el escaparate). El chat es privado
  y contextual; la ficha es escaparate. Hoy no se puede distinguir.
- **Información pública que el bot no debería parafrasear.** Texto legal,
  condiciones exactas de cancelación, o cualquier contenido donde una
  reformulación del modelo sea peor que el texto original.

La distinción real no es "datos para la IA" vs "datos para humanos" — es
**canal**. El mismo contenido, distinto destino.

## 3. Goals

- **G-1** — Owner can create, edit, delete and reorder FAQs from the web editor. ✅ fase 1
- **G-2** — FAQ persistence is independent of the editor's main PATCH payload
  and dirty-tracking. ✅ fase 1
- **G-3** — Each FAQ carries two independent booleans: visible on the public
  listing, and usable by the AI chat. Both default to `true`, so existing FAQs
  and newly created ones behave exactly as today.
- **G-4** — The public-visibility flag is enforced **server-side**: a
  non-public FAQ never leaves the API in a public payload. Not a client-side
  filter.
- **G-5** — The AI flag is enforced where the prompt is assembled: a FAQ with
  the flag off never reaches the model's context.
- **G-6** — The section carries explanatory copy that teaches the concept,
  giving the owner a concrete reason to use each combination — especially the
  non-obvious "not public but AI-usable" case.
- **G-7** — The FAQ block in the AI prompt is delimited and labelled as
  owner-supplied data, with an explicit instruction that its contents are
  information to report, never instructions to follow.

## 4. Non-goals

- **NG-1** — **IA Data is not built.** It is removed entirely — see HOS-398 and
  §11.
- **NG-2** — **No free-text field for AI behaviour.** Tone of voice and
  behaviour are structured configuration, in HOS-399. If a case does not fit a
  structured field, the answer is a new structured field, never a textarea.
- **NG-3** — No write-time screening of FAQ content for instruction-shaped text.
  That defence existed because IA Data invited instructions; a FAQ does not. G-7
  (the read-side framing) is kept and is the one that carries the weight.
- **NG-4** — No per-flag entitlement gating. Both checkboxes are available to
  any owner who can edit FAQs. The AI flag is inert for owners without
  `ai_chat` (there is no chat to feed), which is acceptable — gating it would
  add a plan check to a checkbox whose effect is already conditional.
- **NG-5** — No change to the prompt's caps (`CONTEXT_FAQ_MAX = 10`).

## 5. Current baseline

### Fase 1 — shipped

- Protected routes: `GET|POST /{id}/faqs`, `PUT|DELETE /{id}/faqs/{faqId}`, and
  `PUT /{id}/faqs/reorder` (added by this spec; registered **before**
  `updateFaqRoute` so `/reorder` is not captured as a `{faqId}`).
- UI: `apps/web/src/components/host/editor/FaqSection.client.tsx`, mounted
  between Amenities and Photos, SSR-preloaded from `editar.astro`.

### Where accommodation FAQs flow today

This is the map fase 2 has to touch. Both consumers currently receive **every**
FAQ:

| Consumer | Path |
|---|---|
| **Public listing** | `apps/api/src/routes/accommodation/public/getBySlug.ts:205-223` loads `faqsData` and returns it in the payload. `apps/web/src/pages/[lang]/alojamientos/[slug].astro` uses it in **three** places: `faqSections` (:451), `FAQPageJsonLd` (:488) and `FaqAccordion` (:555). |
| **AI chat** | `apps/api/src/services/accommodation-ai-context.ts` — `safeLoadFaqs` → `buildMarkdownContext` renders a `### FAQs` block, capped at `CONTEXT_FAQ_MAX = 10`. |

**The public filter must be server-side (G-4).** Filtering only in the Astro
component would still ship the private FAQ inside the page payload — visible in
view-source. The FAQ must not leave `getBySlug`.

### The AI prompt has no provenance marking today

`buildMarkdownContext` renders owner-authored content (`### FAQs`, `###
Description`) structurally identical to the sections the system itself
generates. The model cannot tell them apart. This already applies to FAQs — it
is not a new exposure introduced by fase 2, but fase 2 is when it gets fixed
(G-7).

## 6. Proposed design

### 6.1 Data

Two boolean columns on `accommodation_faqs`, both `NOT NULL DEFAULT true`, so
the backfill of existing rows is automatic and behaviour is unchanged for
everything that exists today:

- `is_visible_on_listing`
- `is_usable_by_ai`

Naming follows the repo's `is*` convention (`is_featured`, `is_builtin`,
`is_verified`). `is_public` was rejected: too easy to confuse with the
`visibility` enum that already exists on other entities.

### 6.2 Enforcement, one place each

| Flag | Enforced in |
|---|---|
| `is_visible_on_listing` | `accommodation/public/getBySlug.ts` — filter `faqsData` before it enters the payload |
| `is_usable_by_ai` | `accommodation-ai-context.ts` — filter in `safeLoadFaqs` (before the `CONTEXT_FAQ_MAX` slice, so a hidden FAQ does not consume a slot) |

Order matters on the AI side: filter first, cap second. Otherwise ten
AI-disabled FAQs would starve the context of the ones that should be there.

The owner-facing editor always shows **all** FAQs regardless of flags — it is
the management surface, not a consumer.

### 6.3 Prompt provenance (G-7)

In `buildMarkdownContext`: wrap the owner-authored FAQ block in a delimiter the
content cannot forge, introduce it as content supplied by the property owner,
and state adjacent to it that its contents are information to relay to the
guest and must never be interpreted as instructions to the assistant.

Whatever delimiter is chosen must be stripped or escaped from the FAQ text
before interpolation — a delimiter the payload can reproduce is not a
delimiter.

This is deliberately kept from the original IA Data design. It is cheap,
deterministic, and it protects content that **already** reaches the prompt
today.

### 6.4 UI

Two checkboxes per FAQ row, in both the add form and the edit form. Both
checked by default.

**Explanatory copy (G-6).** A short block at the top of the section, above the
list. It has to answer the question the owner will actually have — *"¿por qué
querría una pregunta que no se ve?"* — with concrete examples, not an abstract
description of the flags. Suggested substance (exact wording is the
implementer's, and goes through i18n):

- what each checkbox does, in one line each;
- **why** you would uncheck "visible en la ficha": information useful to
  someone who asks but that does not belong on the public page — something
  temporary, a commercial margin you would rather not publish as a promise,
  or an honest caveat better delivered in conversation;
- **why** you would uncheck "usable por la IA": content you want shown
  verbatim and would rather the assistant not rephrase.

Copy must describe only what the code does. No promising behaviour that is not
built.

## 7. Data model / contracts

**One migration** (`db:generate`) adding the two columns. No data migration:
`DEFAULT true` backfills existing rows to current behaviour.

Schema changes are additive and therefore compatible with the package's
additive-only policy:

- `FaqCreatePayloadSchema` / `FaqUpdatePayloadSchema` gain both booleans as
  `.optional()` with default `true`.
- The FAQ read schema gains both as required-with-default.

**They must NOT go on `BaseFaqSchema`.** All four FAQ tables
(`accommodation_faqs`, `destination_faqs`, `gastronomy_faqs`,
`experience_faqs`) extend it, and only accommodation is in scope. Introduce a
small shared fragment — e.g. `FaqChannelVisibilityFields` — and extend only the
accommodation FAQ schema with it. HOS-400 reuses that same fragment when it
brings gastronomy and experiences in; keeping it shared from day one is what
makes that a two-line change instead of a copy-paste.

## 8. UX / UI behavior

Both checkboxes are visible in the add and edit forms and reflected in the list
row, so an owner can see at a glance which FAQs are not public — otherwise a
hidden FAQ is invisible in the very screen meant to manage it. A compact marker
per row (icon or label) is enough; it must be readable by screen reader, not
colour-only.

Unchecking both is allowed: it is effectively a draft. Do not block it, but the
row marker should make the state obvious.

All strings via `t()`, keys under `host.properties.editor.faq.*`, in es/en/pt.

## 9. Acceptance criteria

- **AC-1..AC-7** — fase 1, met and verified in browser (see §12).
- **AC-8** — A FAQ with `is_visible_on_listing = false` does **not** appear in
  the `getBySlug` payload. Asserted against the **API response**, not the
  rendered page — the point is that it never leaves the server.
- **AC-9** — That same FAQ does not appear in the accordion, in `faqSections`,
  or in the `FAQPage` JSON-LD. Three consumers, three assertions.
- **AC-10** — A FAQ with `is_usable_by_ai = false` does not appear in the string
  produced by `buildMarkdownContext`.
- **AC-11** — Filtering happens **before** the `CONTEXT_FAQ_MAX` cap: with 12
  FAQs where the first 10 are AI-disabled, the remaining 2 still reach the
  prompt.
- **AC-12** — Existing FAQs (created before the migration) behave exactly as
  before: visible and AI-usable.
- **AC-13** — `buildMarkdownContext` renders the FAQ block delimited and
  labelled with the "data, not instructions" directive; a FAQ whose text
  contains the delimiter cannot break out of the block.
- **AC-14** — The editor shows all FAQs regardless of flags, and each row makes
  a non-default state visible.
- **AC-15** — `pnpm typecheck`, `pnpm lint`, `pnpm test` green; `db:generate`
  committed.

## 10. Risks

- **R-1** — **A hidden FAQ is content nobody sees, and unseen content rots.**
  The owner updates what they look at. This is the same failure mode that
  helped sink IA Data, and the flags do not fully escape it — they only reduce
  it, because the entry still lives in the same list the owner manages. Keeping
  hidden FAQs visible **in the editor** (AC-14) is the mitigation; do not
  "clean up" the editor by hiding them.
- **R-2** — **The AI still reaches the guest.** A FAQ marked non-public but
  AI-usable is not secret: the assistant will say it out loud to whoever asks.
  The copy must not imply confidentiality. It is "not on the page", not
  "private".
- **R-3** — Prompt framing (G-7) is not a hard security boundary. It makes
  instruction-shaped text structurally inert, which is the right posture for
  content that only influences what the assistant *says*. If the chat is ever
  given tools with side effects (booking, pricing, messaging), revisit this
  first.
- **R-4** — Three public consumers read `accommodation.faqs` (accordion,
  `faqSections`, JSON-LD). Filtering server-side covers all three at once —
  that is the reason for G-4. A client-side filter would have to be repeated
  three times and would leak in the payload anyway.

## 11. Open questions

None open.

Resolved during this spec (see §12 for the reasoning):

- **OQ-1 — scope: accommodation only.** The flags do **not** go on
  `BaseFaqSchema`. All four FAQ tables extend it, and only accommodation is in
  scope, so they go in a **shared schema fragment** that just the participating
  entity schemas extend. Rationale: the AI flag is inert where there is no chat,
  and today the chat exists only on accommodations. Gastronomy and experiences
  get both flags **together with their chat**, in HOS-400 — bundling them is
  what keeps the pair coherent instead of shipping a checkbox that does
  nothing. Destinations are deliberately out: no chat and no stated need.
  Deferring costs nothing; the columns are additive.

- IA Data is not built — it is removed (NG-1, HOS-398).
- Bot behaviour is structured config, not free text (NG-2, HOS-399).
- Both checkboxes default to `true` (G-3).

## 12. Implementation notes

### Why IA Data was dropped (2026-08-06)

Recorded here because the decision reverses this spec's own original fase 2, and
the reasoning is worth keeping:

- **Near-total overlap with FAQ.** Both were owner-authored free text landing in
  the same prompt with the same cap (`CONTEXT_FAQ_MAX = 10`,
  `CONTEXT_IADATA_MAX = 10`). The only real difference was public visibility —
  which is now a checkbox.
- **Two places for one thing.** "¿Dónde lo pongo?" with no clear criterion, and
  the right answer nearly always being "in the FAQ", where it also earns public
  visibility and SEO.
- **The design contradicted itself.** The most intuitive use of a field called
  "datos para la IA" is behaviour instructions — exactly what the anti-injection
  defence had to neutralise. A field whose natural use you must block is a
  mis-framed field.
- **It never had a write path.** The reader shipped; no UI or HTTP endpoint ever
  existed, in admin or web. The only rows anywhere came from the seed.
- **The seeded content revealed the confusion**: 64 rows in `hospeda_dev` with
  titles like "Historia de los cítricos en Chajarí" and "Termas de Chajarí" —
  destination tourist context, not accommodation data, and already modelled by
  destinations, attractions and POIs.

### Fase 1 notes worth keeping

- `apiClient.post` is the only verb that does **not** send `withCredentials`
  (`apps/web/src/lib/api/client.ts:272`); `patch`/`put`/`delete` do. Use
  `postProtected` for any authenticated POST. Verified live in the browser
  smoke: the FAQ create landed as `201` with the session attached. The commerce
  FAQ manager still has this bug — HOS-394.
- The reorder route must stay registered before `updateFaqRoute`; both are
  `PUT` under `/{id}/faqs/...`.
- `editar.astro` calls `fetch()` directly instead of going through `lib/api/`.
  That contradicts the app's rule but is the existing pattern in that file;
  follow it rather than half-migrating the page.
- Smoke label: `status-needs-smoke-local`.

## 13. Linear

Canonical tracking:
HOS-393

Related: HOS-394 (`apiClient.post` credentials), HOS-398 (remove IA Data),
HOS-399 (bot configuration), HOS-400 (AI chat + these same flags for gastronomy
and experiences).
