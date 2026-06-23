---
spec-id: SPEC-270
title: Web accessibility audit & improvements — WCAG 2.1 AA compliance
type: improvement
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 16-24
tags: [accessibility, web, audit, wcag, a11y, aria, keyboard, screen-reader]
---

# SPEC-270: Web accessibility audit & improvements

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Auditar y mejorar la accesibilidad de toda la app web para cumplir WCAG 2.1 AA: ARIA, keyboard navigation, screen reader, color contrast, focus management, reduced motion. Asegurar que el sitio sea usable por personas con discapacidades.

**Why now:** Accesibilidad es requerimiento legal en varios mercados (Argentina Ley 26.653, UE European Accessibility Act 2025). Pre-launch es el momento de asegurar compliance. El admin ya tuvo audits (SPEC-134, SPEC-136) pero la web no.

**Related:** SPEC-268 (SEO) — algunos a11y fixes mejoran SEO (alt text, semantic HTML). SPEC-269 (performance) — reduced motion, lazy load mejoran ambos.

### 2. Out of Scope

- SEO on-page → SPEC-268
- Performance → SPEC-269
- Admin panel accessibility — ya cubierto por SPEC-134/136
- Mobile app accessibility — SPEC-245

### 3. Current State

| Área | Estado | Notas |
|------|--------|-------|
| Semantic HTML | Astro components usan `<article>`, `<section>`, `<nav>` | Generalmente bueno |
| ARIA | `aria-hidden` en decorativos, `aria-label` en algunos | Audit incompleto |
| Keyboard | No auditado | Potencial issues en islands |
| Color contrast | Tokens CSS con dark mode | No auditado contra WCAG AA |
| Focus management | No auditado | Potencial issues en modals, route changes |
| Alt text | `alt={title}` en muchas images | No siempre descriptivo |
| Reduced motion | `prefers-reduced-motion` en scroll reveal | No comprehensivo |
| Skip links | No auditado | Potencial missing |
| Forms | Auth forms via @repo/auth-ui | No auditado |
| Error states | 404/500 pages | No auditado para a11y |

### 4. Audit Areas (WCAG 2.1 AA)

#### 4.1 Perceivable

- [ ] **1.1 Text Alternatives**: alt text descriptivo en todas las images (no `alt="image"`)
- [ ] **1.2 Time-based Media**: transcripts/captions si hay video (futuro)
- [ ] **1.3 Adaptable**: semantic HTML, correcto heading hierarchy (h1→h2→h3)
- [ ] **1.4 Distinguishable**:
  - Color contrast ratio ≥4.5:1 (normal text), ≥3:1 (large text)
  - No info por color solo
  - Resize text 200% sin pérdida
  - Images of text avoided

#### 4.2 Operable

- [ ] **2.1 Keyboard Accessible**: todas las funciones operables por keyboard
  - Tab order lógico
  - No keyboard traps
  - Skip to content link
  - Focus visible
- [ ] **2.2 Enough Time**: sin time limits (o extendible)
- [ ] **2.3 Seizures**: no content que flashee >3 veces/segundo
- [ ] **2.4 Navigable**:
  - Skip blocks (bypass blocks)
  - Page titled
  - Focus order
  - Link purpose clear (no "click here")
  - Multiple ways to find pages
- [ ] **2.5 Input Modalities**: tap/click targets ≥44x44 CSS px

#### 4.3 Understandable

- [ ] **3.1 Readable**: lang attribute en `<html>`, lang changes marcados
- [ ] **3.2 Predictable**: consistent navigation, consistent identification
- [ ] **3.3 Input Assistance**: error identification, labels, instructions

#### 4.4 Robust

- [ ] **4.1 Compatible**: valid HTML, ARIA correcto, status messages via role/aria-live

### 5. Deliverables

| Deliverable | Descripción |
|-------------|-------------|
| Audit report | axe-core + manual review, findings por página, severity |
| Fix plan | Priorizado por impacto (critical > serious > moderate) |
| Implementation | Fixes aplicados |
| Validation | axe-core 0 violations + manual screen reader test |
| Monitoring | CI axe-core guard para prevenir regresiones |

### 6. Tasks

| Task | Title | Status |
|---|---|---|
| T-270-01 | axe-core scan en todas las páginas clave | pending |
| T-270-02 | Keyboard navigation audit — tab order, traps, focus | pending |
| T-270-03 | Color contrast audit — todas las combinaciones de tokens | pending |
| T-270-04 | Alt text audit — descriptivo, no decorativo | pending |
| T-270-05 | Heading hierarchy audit — h1 único, jerarquía correcta | pending |
| T-270-06 | Form accessibility audit — labels, error messages, instructions | pending |
| T-270-07 | ARIA audit — roles, labels, states correctos | pending |
| T-270-08 | Focus management audit — modals, route changes, dynamic content | pending |
| T-270-09 | Screen reader test (NVDA + VoiceOver) en páginas clave | pending |
| T-270-10 | Implementar fixes priorizados | pending |
| T-270-11 | CI axe-core guard | pending |
| T-270-12 | Re-run axe-core post-fix — 0 violations | pending |

### 7. Acceptance Criteria

- [ ] axe-core 0 violations en todas las páginas clave
- [ ] Color contrast ≥4.5:1 en todos los text/background combinations
- [ ] Keyboard navigation completa en todas las páginas
- [ ] Screen reader test pasa en NVDA + VoiceOver
- [ ] Lang attribute correcto en `<html>` y cambios de idioma
- [ ] CI axe-core guard bloquea regresiones

### 8. Risks

| Risk | Mitigation |
|---|---|
| React islands pueden tener a11y issues no visibles en SSR | Audit con JS habilitado, no solo SSR |
| Dark mode puede romper contrast | Audit en ambos themes |
| Fixes pueden requerir cambios en shared packages | Coordinar con @repo/auth-ui si forms tienen issues |
| Screen reader testing requiere expertise | Usar NVDA (gratis) + docs de patrones |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "analisis y mejora de seo, performance y accesibilidad de la app web completa"

### Reference

- Web CLAUDE.md: `apps/web/CLAUDE.md` — Component Conventions (aria-hidden, loading="lazy")
- Scroll reveal: `prefers-reduced-motion` en `apps/web/src/lib/scroll-reveal.ts`
- Auth UI: `@repo/auth-ui` — forms accesibles
- Admin a11y precedent: SPEC-134 (admin audit remediation), SPEC-136 (admin a11y compliance)
- Tokens: `apps/web/src/styles/global.css` — CSS custom properties con dark mode

### Cross-spec dependencies

- SPEC-268 (SEO) — alt text, semantic HTML mejoran ambos
- SPEC-269 (performance) — reduced motion, lazy load
- SPEC-134/136 (admin a11y) — precedent para metodología
