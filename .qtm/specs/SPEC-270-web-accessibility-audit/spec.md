---
spec-id: SPEC-270
title: Web accessibility audit & improvements — WCAG 2.1 AA, concrete findings + fix catalog
type: improvement
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
audited: 2026-06-23
model_fit: basic
effort_estimate_hours: 16-24
tags: [accessibility, web, audit, wcag, a11y, aria, keyboard, contrast]
---

# SPEC-270: Web accessibility audit & improvements (WCAG 2.1 AA)

> ## ✅ AUDIT DONE + DECISION RESOLVED (2026-06-23)
>
> Auditoría estática ejecutada sobre el código real + cálculo PRECISO de contraste
> (OKLCH→sRGB→WCAG, no aproximación). Hallazgos concretos en `## 3`.
>
> **Corrección importante:** la primera pasada (aproximada) reportó 4 fallos de
> contraste. El cálculo exacto **descartó 2 como falsos positivos**:
> `--core-muted-foreground` da **7.13:1** sobre fondo y **6.45:1** sobre muted (PASS).
> El fallo real es solo el **azul de marca como texto** (3.42:1) y el **texto de
> botón primario** (3.47:1) — ambos FAIL para texto normal, PASS para texto grande.
>
> **Decisión del owner:** crear un token de texto dedicado.
> - `--brand-primary` = river500 (sin cambios) → fondos, acentos, botones.
> - `--brand-primary-text` = **river700** (L≈0.48) → links/texto de marca sobre fondo
>   claro. Verificado: **~6.5:1** (PASS holgado). Target objetivo: cualquier shade river
>   con **L ≤ 0.55** pasa 4.5:1; river700 da margen.
> - Botones primarios: el texto debe ser **bold** (cuenta como large text, umbral 3.0 →
>   3.47:1 PASS) o usar fondo river600+. Se opta por mantener texto bold en botones.

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Llevar la web pública a WCAG 2.1 AA: corregir los findings detectados, agregar
un CI guard de axe-core (replicando el patrón del admin), y dejar el procedimiento de
auditoría runtime (keyboard/screen-reader) documentado.

**Why now:** Requisito legal (Argentina Ley 26.653, EU EAA 2025). Pre-launch es el momento.

### 2. Out of Scope

- SEO → SPEC-268 · Performance → SPEC-269 · Admin a11y → SPEC-134/136 (hecho) · Mobile app → SPEC-245

### 3. Audit Findings (concretos, por categoría)

#### A. Contraste (decisión tomada — ver banner)

| # | Finding | Real | Fix |
|---|---------|------|-----|
| A1 | `--brand-primary` como texto/link sobre fondo claro | 3.42:1 FAIL | Usar `--brand-primary-text` (river700) en links/texto de marca |
| A2 | Texto en botón primario (`--primary-foreground` sobre river500) | 3.47:1 FAIL-normal / PASS-large | Garantizar texto bold en botones primarios |

Usos a migrar a `--brand-primary-text`: nav links activos (`Header.astro:329-330`), active
underline, links inline de marca. **NO** descartado: el texto muted (era falso positivo, pasa).

#### B. Alt text (WCAG 1.1.1)

| # | Finding | Archivo | Fix |
|---|---------|---------|-----|
| B1 | `alt={title}`/`alt={name}` genérico (repite el heading) | `publicaciones/[slug].astro:397`, `RelatedPostCard.astro:45`, `eventos/[slug].astro:244`, `destinos/atraccion/[slug]/index.astro:54`, `PostAuthorCard.astro:52` | alt descriptivo (ej. `Foto de {name}` para autor; para hero, describir la imagen o `alt=""` si es decorativa junto al h1) |
| B2 | Avatar con `alt=""` donde comunica identidad | `mi-cuenta/index.astro:145`, `UserMenu.client.tsx:541`, `MobileMenu.client.tsx:367` | `alt={user.name}` |
| B3 | Logo footer `alt=""` | `Footer.astro:173` | `alt="Hospeda"` o `aria-hidden="true"` si redundante |

#### C. Focus visible (WCAG 2.4.7)

| # | Finding | Archivo | Fix |
|---|---------|---------|-----|
| C1 | `:focus-visible` solo cambia color, sin indicador de forma | `MobileMenu.module.css:96` | Agregar outline/box-shadow visible (≥3:1 contra fondo) |
| C2 | `:focus` (no `:focus-visible`) quita outline para mouse users | `components.css:834-840` | Cambiar a `:focus-visible`; el box-shadow sustituto debe tener ≥3:1 |
| C3 | 53 instancias de `outline: none` — varias sin sustituto | ver lista del audit (Dialog, IconChipsFilter, FilterGroupContent, ContactHost, CommerceLead module.css) | Revisar case-by-case: cada una necesita indicador visible en `:focus-visible` |

#### D. Tap targets <44px (WCAG 2.5.5)

| # | Finding | Archivo | Fix |
|---|---------|---------|-----|
| D1 | ScrollToTop 40×40px en mobile | `ScrollToTop.astro:142-146` | min 44×44px |
| D2 | MobileMenu auth button `min-height: 40px` | `MobileMenu.module.css:148` | min 44px |

(Precedente: `PasswordField.module.css:77-78` ya hace 44×44 correcto — seguir ese patrón.)

#### E. Landmarks & ARIA

| # | Finding | Archivo | Fix |
|---|---------|---------|-----|
| E1 | `<footer>` sin `role="contentinfo"` explícito | `Footer.astro:150` | Agregar `role="contentinfo"` |
| E2 | `aria-modal="true"` sin `role="dialog"` | `BetaSearch.client.tsx:171` | Agregar `role="dialog"` |
| E3 | Banners `danger` usan `role="status"` (polite) | `GlobalAnnouncements.astro:65` | `role="alert"` (assertive) para variante danger |
| E4 | dismiss aria-label hardcodea 3 locales | `GlobalAnnouncements.astro:74` | Usar i18n dinámico |

#### F. Heading hierarchy (WCAG 1.3.1)

| # | Finding | Fix |
|---|---------|-----|
| F1 | ~20 páginas sin `<h1>` directo (delegado a islands/componentes); riesgo de `page-has-heading-one: false` si el h1 no está en el SSR inicial | Verificar que cada página renderice un único h1 en SSR. Foco: `alojamientos/mapa.astro`, `destinos/mapa.astro`, `host-dashboard.astro`, `mi-cuenta/newsletter.astro`, checkout success/failure/pending |

#### G. CI guard (no existe para web)

| # | Finding | Fix |
|---|---------|-----|
| G1 | El admin tiene un sweep axe manual (SPEC-134) pero web NO tiene ningún check a11y; `ci.yml` no corre axe | Crear sweep axe para web (ver §5) e integrarlo en CI |

**Bien (NO tocar):** skip-to-content (`SkipToContent.astro`), `lang` en `<html>`
(`BaseLayout.astro:86`), `prefers-reduced-motion` (multicapa, bien), IconButton con
`ariaLabel` requerido, varios modals con `<dialog>` nativo + focus trap.

### 4. CI Guard — replicar patrón del admin

El admin usa **`@axe-core/playwright` v4.10.2** con un script `sweep.ts`
(`.qtm/specs/SPEC-134-admin-audit-remediation/audit-baseline/_scripts/sweep.ts`):
navega cada ruta de un inventory, espera networkidle + h1, corre
`AxeBuilder().withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze()`,
guarda JSON, agrega.

**Adaptación para web (más simple — sin auth en páginas públicas):**

1. Crear `apps/web/scripts/a11y-sweep/` con `sweep.ts` análogo.
2. Inventory: las rutas públicas indexables (reusar la lista de SPEC-268 Part 2).
3. Sin login step (páginas públicas). Correr en es (y un sample en en/pt).
4. Misma config de tags axe. Threshold: **0 violations critical/serious**.
5. Integrar en `.github/workflows/`: job `a11y` que corre el sweep. Empezar como
   non-blocking (nightly o post-merge); promover a PR-gate cuando esté en verde.

### 5. User Stories con Acceptance Checks

#### US-1 — Contraste de marca AA

```
GIVEN un link/texto que usa el azul de marca sobre fondo claro
WHEN se mide su contraste
THEN usa --brand-primary-text (river700) y da ≥4.5:1
 AND los botones primarios tienen texto bold y dan ≥3:1
```
Checks:
- [ ] `--brand-primary-text` definido (river700, L≈0.48) y verificado ≥4.5:1 con el script de contraste
- [ ] nav links activos y links inline de marca migrados al nuevo token
- [ ] botones primarios con `font-weight: 700`

#### US-2 — axe-core limpio en páginas clave

```
GIVEN cualquier página pública clave
WHEN corre el sweep axe-core (wcag2a/2aa/21a/21aa)
THEN 0 violations critical/serious
```
Checks:
- [ ] sweep axe creado y corriendo en CI
- [ ] 0 critical/serious en home, los 6 listados, un detail por entidad
- [ ] el guard falla el build si aparece una violation critical/serious

#### US-3 — Imágenes con alt correcto y targets táctiles

```
GIVEN imágenes de contenido y controles táctiles
THEN las de contenido tienen alt descriptivo (no el título repetido)
 AND avatares usan el nombre del usuario
 AND todos los tap targets son ≥44×44px
```
Checks:
- [ ] B1/B2/B3 corregidos
- [ ] ScrollToTop y MobileMenu auth button ≥44×44 en mobile

#### US-4 — Foco visible y ARIA correcto

```
GIVEN navego por teclado
THEN cada elemento enfocable tiene indicador visible (≥3:1)
 AND landmarks y roles ARIA son correctos
```
Checks:
- [ ] C1/C2/C3 resueltos (todo `:focus-visible` con indicador visible)
- [ ] footer `role=contentinfo`, BetaSearch `role=dialog`, danger banners `role=alert`

### 6. Remaining Runtime Audit (procedimiento, no estático)

- **Keyboard/focus de islands:** recorrer con teclado los componentes interactivos
  (inventario en Part 2): UserMenu, MobileMenu, SearchBar, FilterSidebar, ImageGallery
  (GLightbox — tercero, a11y no auditado), modals. Verificar: focus trap, ESC cierra,
  retorno de foco al disparador, no keyboard traps.
- **Screen reader:** NVDA (Windows, gratis) + VoiceOver (macOS) en home + 1 detail + 1 form.

### 7. Acceptance Criteria (global)

- [ ] Todos los findings A–G resueltos o diferidos con razón
- [ ] axe-core 0 critical/serious en páginas clave, en ambos themes (light/dark)
- [ ] Contraste de marca AA verificado con el script
- [ ] Keyboard nav + screen reader pasan en páginas clave
- [ ] CI guard axe activo

### 8. Risks

| Risk | Mitigation |
|------|-----------|
| Islands con a11y issues no visibles en SSR | Sweep con JS habilitado (Playwright real browser) |
| Dark mode rompe algún contraste | Sweep + cálculo en ambos themes (dark ya pasa los pares medidos) |
| GLightbox (tercero) inaccesible | Evaluar reemplazo o wrapper accesible; registrar como follow-up si es grande |
| Cambiar focus/outline rompe estética | Usar box-shadow tokenizado consistente, no outline default feo |

---

## Part 2 — Implementation Notes

### Inventario de React islands a auditar (keyboard/focus)

UserMenu, MobileMenu (focus trap ✓), SettingsDropdown, LanguageSwitcher, ThemeControl,
FilterSidebar (drawer focus trap ✓), SearchBar (role=dialog), SearchResultsLive,
ImageGallery (GLightbox — NO auditado), ReviewsModal (`<dialog>` ✓), ContactHost
(outline:none), AiChatWidget (✓), CookieConsentBanner (✓), ShareButtons, Testimonials
Carousel (tablist ✓), CollectionPickerPopover, DateRangeFilter, SearchableSelect
(combobox ✓), GastronomyReviewForm (`<dialog>` ✓), CommerceLead (outline:none), maps.

### Reference

- Tokens: `packages/design-tokens/src/themes/web-light.ts` / `web-dark.ts`,
  `packages/design-tokens/src/tokens/colors.ts:134` (`river = deriveShades({l:0.63,c:0.19,h:259})`)
- Contrast script: usar conversión OKLCH→sRGB→WCAG (ver historial de esta spec); target L≤0.55 para river-as-text
- Admin a11y sweep (patrón): `.qtm/specs/SPEC-134-admin-audit-remediation/audit-baseline/_scripts/sweep.ts`
- Global CSS: `apps/web/src/styles/global.css` (`:focus-visible` :44-48, reduced-motion :137-145)
- Layouts: `BaseLayout.astro`, `Footer.astro`, `Header.astro`

### Cross-spec dependencies

- SPEC-268 (SEO): alt text + semantic HTML se solapan; coordinar para no duplicar.
- SPEC-269 (perf): reduced-motion/lazy se solapan.
- SPEC-134/136 (admin a11y): patrón de sweep y de remediación a reutilizar.

---

## Model Fit Verdict

**BÁSICO.** La decisión de diseño (contraste de marca) ya está tomada y el shade
verificado numéricamente. Todo lo demás es mecánico con patrón existente: alt text,
aria-labels/roles, tap targets (patrón PasswordField), focus-visible, h1, y un CI guard
que clona el sweep del admin. La verificación es objetiva (axe-core 0 critical/serious +
script de contraste). La auditoría runtime de keyboard/screen-reader es un procedimiento
guiado, no una decisión.
