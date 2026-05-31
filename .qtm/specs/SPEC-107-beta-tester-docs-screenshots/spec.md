---
spec-id: SPEC-107
title: Beta Tester Docs Screenshots Rollout
type: docs
complexity: medium
status: draft
created: 2026-05-13T00:00:00Z
effort_estimate_hours: 8-14
tags: [beta-docs, screenshots, content, ux, non-tech-audience]
---

# SPEC-107: Beta Tester Docs Screenshots Rollout

## Part 1 — Functional Specification

---

### 1. Overview & Goals

**Goal:** Add screenshots to the private beta tester documentation site (`/beta/*`, sourced from `apps/web/src/content/beta/`) so that the 40 non-technical testers can **visually identify** every UI element, flow step and result state referenced in the docs.

**Why:** The audience is non-technical Argentine testers. Many of them will use the platform mostly from mobile devices and some do not even have a computer. Pure text instructions like "tocá el FAB azul abajo a la derecha" leave too much room for confusion — what is a "FAB"? Where exactly? Screenshots collapse that ambiguity and unblock testers without requiring chat support.

**Audience for the work:** Solo developer (qazuor) takes the captures by hand, with manual annotations (red arrow / circle, ~3px). Claude orchestrates the batches and applies the `<figure>` blocks in the markdown.

**Success metric:** Every page in `apps/web/src/content/beta/` that references a concrete UI element, flow step or panel section embeds at least one screenshot, with caption, that a tester can recognize at a glance. The set of "ALTA priority" captures (42 entries) covers the highest-friction moments. MEDIA and BAJA tiers are evaluated after ALTA is shipped.

---

### 2. Out of Scope

- **Automatic capture generation (Playwright).** Considered for the long term but not in v1 — the UI changes too fast during beta to justify the scaffolding. Re-evaluate post-beta if the docs site outlives the program.
- **Video tutorials / screencasts.** Separate effort. The `[VIDEO_LINK]` placeholder was removed from `index.md` earlier; videos are not part of this spec.
- **MEDIA + BAJA tiers (20 captures).** Defer to a follow-up after the 42 ALTA are in. Reassess priority once we see how testers actually use the docs.
- **English and Portuguese variants.** The beta docs are Spanish-only by product decision (`BetaDocLayout.astro` is hardcoded to `lang="es"`, middleware skips locale enforcement for `/beta/*`).
- **Dark-theme variants.** Single dark capture is needed for the theme-toggle anchor; the rest stay in light theme to keep the matrix manageable.
- **Animated GIFs / videos for flows that benefit from motion** (drag-and-drop, wizard transitions, lightbox open). Listed in section 9 as future enhancement, not part of v1.

---

### 3. Implementation Status

#### 3.1 — DONE: Phase 0 — Foundation (commit `cd6a9eeee` on `feat/beta-docs`)

- **Folder structure** under `apps/web/public/beta-docs/screenshots/` mirroring the content tree. Subfolders for `_shared/`, `empezar/`, `turista/{crear-cuenta,buscar-alojamiento,detalle-alojamiento,contactar-host,favoritos-colecciones,preferencias-cuenta,paginas-estaticas}/`, `host/{onboarding,crear-alojamiento,dashboard,suscripcion-y-pagos,mensajes}/`, `admin-editor/{acceso,editor,alojamientos,billing,usuarios,otros}/`, `pago-real/pasos/`, `reportar-bugs/{como-reportar,ejemplos}/`, `faq/`. No `.gitkeep` files — folders materialize naturally as captures land.
- **`.beta-figure` block** in `BetaDocLayout.astro`: rounded corners, subtle border, soft shadow, italic centered caption, `zoom-in` cursor and a slight hover lift to hint at the lightbox interaction.
- **`.beta-figure-group` grid** for side-by-side desktop + mobile pairs (2:1 ratio on wide screens, stacked on narrow).
- **Native `<dialog>` lightbox** at the layout root: click any `.beta-figure img` opens the image enlarged with caption. Closes with Escape / X / backdrop / click-on-image. ~40 lines of vanilla JS, no dependencies, re-binds on `astro:page-load` for view transitions.

#### 3.2 — PENDING: Phase 1 — Capture and embed the 42 ALTA screenshots

Organized into 7 batches by descending value (see section 7).

---

### 4. Conventions & Standards

Every capture in this spec follows these rules. Any deviation must be justified in the batch row.

| Dimension | Standard | Notes |
|---|---|---|
| **Viewport (desktop)** | 1440 × 900 | Most common laptop. Do not use 4K — layouts change. |
| **Viewport (mobile)** | ~400 × 800 (iPhone-ish) | Only when the UI changes significantly vs. desktop. |
| **Browser** | Chrome or Firefox, zoom 100% | Default install, no extensions |
| **Theme** | Light | Single dark capture is needed for the theme-toggle anchor; rest stay light. |
| **Language** | Spanish (`es`) | The only multi-language capture is the language-selector dropdown showing ES / EN / PT. |
| **Frame** | Page content only — no browser chrome (tabs, URL bar) | Exception: capture URL bar when the domain matters (e.g. `staging-admin.hospeda.com.ar`). |
| **Annotations** | Red arrow or circle, ~3 px stroke, consistent across the set | Hand-annotated by qazuor. Keep an unannotated original + an `-anotada.png` variant when applicable. |
| **Format** | PNG | Max 1600 px wide. Compress with ImageOptim/Squoosh before commit. |
| **PII (mandatory blur)** | Real emails, full names, tarjeta numbers, DNI, teléfono, URLs with tokens | Even our own test data — never get used to publishing it. |
| **Mobile policy** | Capture **both** desktop and mobile only when the layout changes significantly (catálogo, mapa, detalle, dashboard, wizard, filtros). For the rest, desktop only. | Testers using mobile can map from a responsive desktop capture in most cases. |
| **Filename** | kebab-case, no diacritics. Suffixes: `-mobile`, `-dark`, `-en`, `-pt`, `-vacio`, `-lleno`, `-error`, `-exito`, `-anotada` | Path under `public/beta-docs/screenshots/<track>/<slug>.png` |

---

### 5. Markdown Patterns

The figure is plain markdown HTML — no custom Astro component. Drop it directly into any `.md` file in the content collection.

**Single figure:**

```markdown
<figure class="beta-figure">
  <img src="/beta-docs/screenshots/<track>/<name>.png" alt="descripción accesible de la captura">
  <figcaption>Texto explicativo abajo de la imagen.</figcaption>
</figure>
```

**Desktop + mobile pair** (for the cases where mobile is captured separately):

```markdown
<div class="beta-figure-group">
  <figure class="beta-figure">
    <img src="/beta-docs/screenshots/<track>/<name>.png" alt="...">
    <figcaption><strong>Desktop:</strong> ...</figcaption>
  </figure>
  <figure class="beta-figure">
    <img src="/beta-docs/screenshots/<track>/<name>-mobile.png" alt="...">
    <figcaption><strong>Mobile:</strong> ...</figcaption>
  </figure>
</div>
```

Lightbox behavior is automatic — every `.beta-figure img` in the page becomes clickable; the layout-level `<dialog>` handles the rest.

---

### 6. Workflow

1. **Claude** opens a batch by sending a table with: URL to visit, state to put the UI in, what to capture, what to annotate, the absolute filename.
2. **qazuor** takes the captures, annotates manually, optimizes the PNG, drops it into `apps/web/public/beta-docs/screenshots/<track>/<filename>.png`.
3. **qazuor** notifies "están" / "listas".
4. **Claude** applies the `<figure>` blocks in **every** consuming `.md` file at the appropriate anchor, in a **single commit per batch** (`docs(beta): add screenshots for <batch-name>`).
5. **qazuor** sanity-checks the rendering in `pnpm dev` once or twice per batch — full pass only at the end.
6. After Phase 1 is complete, evaluate whether MEDIA + BAJA (20 more) are worth the time.

**Rules of thumb:**
- Reusable captures in `_shared/` come first — they unblock multiple files at once.
- Within a track, capture screens in reading order so the user only navigates once.
- If a UI element is not present yet (mid-development), park that capture in a "blocked" sub-list and continue.

---

### 7. Batches & Capture Inventory

The full 62-capture report (with URL, state, annotation hint and filename per entry) lives in **engram** under topic key `beta-docs/screenshots/state`. The summary below is the durable, version-controlled index. Treat engram as the working document for execution; treat this section as the table of contents.

#### 7.1 — Batch 1 (NEXT UP): `_shared/` reusables — 4 captures

| File | Captura | Consumed by |
|---|---|---|
| `_shared/fab-cerrado.png` | FAB azul "Reportar problema" en home, círculo rojo | `index.md`, `reportar-bugs/como-reportar.md`, `faq.md` |
| `_shared/fab-modal-abierto.png` | Modal "Reportar un problema" abierto con "Detalles técnicos" expandido | `reportar-bugs/como-reportar.md` |
| `_shared/theme-toggle.png` | Control Sol/Engranaje/Luna en header, flecha roja | `empezar/como-entrar.md`, `faq.md` |
| `_shared/language-selector.png` | Dropdown ES/EN/PT abierto | `turista/preferencias-cuenta.md` |

#### 7.2 — Batch 2: `reportar-bugs/` — 5 captures (ALTA)

Targets `como-reportar.md` (FAB mobile + desktop + ejemplos) and `ejemplos.md` (detalles técnicos auto-recolectados + ejemplo de reporte bueno).

#### 7.3 — Batch 3: `empezar/` + `index.md` — 2 captures (ALTA)

Home of `staging.hospeda.com.ar` (first impression) and the docs site role selector.

#### 7.4 — Batch 4: `turista/` — 11 captures (ALTA)

Header login button, signup form, search bar in hero, catálogo, filtros (desktop), vista mapa, detalle galería, favorito states, contact form, bandeja mensajes, modal mover colección, banner cookies.

#### 7.5 — Batch 5: `host/` — 10 captures (ALTA)

Onboarding (publicar button + landing), wizard de 8 secciones (overview + ubicación con mapa + fotos drag-and-drop), dashboard (mis propiedades), página planes, checkout MP, mi suscripción, bandeja host mensajes.

#### 7.6 — Batch 6: `admin-editor/` — 8 captures (ALTA)

Login admin, dashboard admin con KPIs, lista publicaciones, editor de post, lista alojamientos, billing planes, billing suscripciones, sidebar de billing.

#### 7.7 — Batch 7: `pago-real/` — 4 captures (ALTA)

Pago aprobado, pago pendiente, pago rechazado, mi suscripción (reuso de batch 5).

#### 7.8 — Out of scope for v1: MEDIA + BAJA — 20 captures

Filtros mobile, FAB mobile, formularios menores, listados secundarios, estado vacío de dashboard, etc. Decide after Phase 1 is shipped.

---

### 8. Acceptance Criteria

This spec is **complete** when:

1. **All 42 ALTA captures are committed** under `apps/web/public/beta-docs/screenshots/` following the convention in section 4.
2. **Every consuming `.md` file** embeds the corresponding `<figure>` block at the anchor defined in the engram batch tables.
3. **No PII is visible** in any committed capture — manual review of every PNG before commit.
4. **The site renders correctly** in the dev server (`pnpm dev` from `apps/web/`) on at least one full pass through every track.
5. **The lightbox works** for every figure (click → enlarge → close).
6. **The figures look acceptable** in both light and dark theme (sombra y borde no se "funden").
7. **The site builds without warnings** related to images (`pnpm build` from `apps/web/`).
8. **A short manual smoke test** on a real mobile viewport (375 × 812 ≈ iPhone 12) confirms the figures, captions, and lightbox behave on a phone.

Decision on MEDIA + BAJA: deferred until after acceptance 1-8 are met. Re-evaluate based on tester feedback in the first week of the beta.

---

### 9. Future Enhancements (post-v1, not in this spec)

- **GIF / video clips** for motion-dependent flows: FAB modal opening with the "Detalles técnicos" expansion, wizard section transitions, drag-and-drop fotos upload, pin arrastrable en el mapa, favorite toggle animation, cookie banner customize flow, theme toggle live transition.
- **Mobile-variant captures for MEDIA tier** (filtros, FAB mobile, etc.).
- **Auto-regeneration via Playwright** when the docs site outlives the beta program.
- **Per-locale captures** if EN/PT versions of the beta docs are added.

---

### 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| The UI changes between when a capture is taken and when it ships | Take captures only after the user signals the UI is stable for that flow (this spec was paused for that exact reason — see `cd6a9eeee` for the pause point) |
| Inconsistent annotations across the set | Section 4 defines color, stroke and tool conventions. Single operator (qazuor) keeps continuity. |
| PII leaks (emails, names, card numbers) | Mandatory pre-commit visual review per capture; blur as part of the annotation step |
| Bundle size grows from many PNGs | Compress every PNG before commit (target < 200 KB per capture for desktop, < 100 KB for mobile). `pnpm build` runs on every PR; if size jumps, address it then. |
| Lightbox accessibility regression | Native `<dialog>` is accessible by default (focus trap, ARIA, ESC). Don't replace with a custom component. |
| Folder structure drift between content tree and screenshot tree | Keep the mirror. When adding a new `.md` file under `content/beta/`, the matching screenshot subfolder is added if and when a capture is needed. |

---

### 11. References

- **Engram topic** `beta-docs/screenshots/state` — execution state, full per-capture instructions, full 62-row capture inventory, gotchas learned during Phase 0.
- **Memory pointer** `~/.claude/projects/-home-qazuor-projects-WEBS-hospeda/memory/MEMORY.md` — single-line index entry.
- **Code** `apps/web/src/layouts/BetaDocLayout.astro` — `.beta-figure`, `.beta-figure-group`, `<dialog>` lightbox.
- **Content collection** `apps/web/src/content/beta/` — where every `<figure>` block lands.
- **Related specs**: SPEC-103 (post-merge cleanup — green-build gate must pass before this spec ships).
