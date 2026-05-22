---
audit: i18n-coverage
status: complete
date: 2026-05-21
agent: Explore
---

# Hospeda Admin i18n Coverage Audit

## Executive Summary

The Hospeda admin panel demonstrates **excellent i18n architecture** with properly wired providers, hooks, and locale files across es/en/pt. However, a critical gap exists: **~96+ hardcoded user-facing strings** have escaped translation, predominantly in the **Tags management feature** (user-moderation, system, post-tags, internal tabs). The majority are Spanish strings (placeholder text, aria-labels, page titles, search inputs) that should be moved to translation keys.

**Locale resource completeness**: All three languages (en, es, pt) maintain structural parity with consistent key counts per file. The admin-specific JSON files (admin-*.json) are complete and synchronized.

---

## 1. i18n Architecture & Wiring

### Provider Setup

**Location**: `@repo/i18n` (shared package)

The admin app correctly leverages a centralized i18n package:
- **useTranslations hook**: Re-exported from `@repo/i18n` via `/apps/admin/src/hooks/use-translations.ts` for React components
- **Static fallback**: `getTranslation(key, params?)` in `/apps/admin/src/lib/i18n/static-translations.ts` for class components and error boundaries
- **Translation function alias**: `t = getTranslation` for convenience

### Standard Translation Pattern

All properly implemented strings follow:
```typescript
const { t } = useTranslations();
t('admin-dashboard.kpis.accommodations')  // Dot-notation keys
t('admin-billing.plans.dialog.successUpdate')
```

### Interpolation Support

Both hook and static utility support parameter replacement:
- Double braces: `{{key}}` 
- Single braces: `{key}`
- Fallback: Returns `[MISSING: key]` if translation not found (logged as error)

---

## 2. Locale Resource Files

### Location
`/home/qazuor/projects/WEBS/hospeda-admin-redesign-audit/packages/i18n/src/locales/{en,es,pt}/`

### Admin-Specific Files (All Present & Synchronized)
- `admin-common.json` (266 lines, 3 languages): UI chrome, errors, common actions
- `admin-auth.json`: Login/signup flows
- `admin-dashboard.json`: Dashboard KPIs & charts
- `admin-billing.json`: Billing, plans, addons, payments
- `admin-entities.json`: CRUD labels & dialogs
- `admin-filters.json`: Filter UI
- `admin-menu.json`: Sidebar navigation
- `admin-nav.json`: Breadcrumbs & routing
- `admin-newsletter.json`: Campaign management
- `admin-pages.json`: Page titles (45+ entries)
- `admin-tables.json`: Table headers & pagination
- `admin-tabs.json`: Tab labels
- `tags.json`: Comprehensive tag management strings (admin, user, system, post-tags)

### Completeness Check
✅ **All three locales (en, es, pt) are structurally identical**
- Line counts match perfectly (e.g., admin-common.json: 266 lines across all 3)
- Key-value structure synchronized
- No orphaned keys in one language

**No missing pt translations**, unlike typical monorepos. This is excellent.

---

## 3. Hardcoded Strings Found

### Count Summary
**Total hardcoded user-facing strings: ~96+**

Breakdown by type:
- **Placeholder attributes**: 39 instances (search boxes, form inputs)
- **Aria-labels**: 28+ instances (accessibility attributes)
- **Page titles & headings**: 8+ instances (h1/h2 tags)
- **Status/error messages**: 20+ instances
- **Navigation labels**: 5+ instances

### Most Affected Areas

#### 1. **Tags Management** (WORST OFFENDER: ~45 instances)
**Files**: 
- `/apps/admin/src/routes/_authed/tags/user-moderation/index.tsx`
- `/apps/admin/src/routes/_authed/tags/system/index.tsx`
- `/apps/admin/src/routes/_authed/tags/post-tags/index.tsx`
- `/apps/admin/src/routes/_authed/tags/internal/index.tsx`

**Hardcoded Spanish strings**:
```jsx
// Page titles (hardcoded)
<h1>Moderación de etiquetas de usuario</h1>
<p>Etiquetas privadas creadas por usuarios. Solo visible para admins.</p>

// Placeholders (hardcoded)
placeholder="Buscar por nombre de etiqueta..."
placeholder="Buscar por nombre..."

// Aria-labels (hardcoded)
aria-label="Buscar etiquetas de usuario"
aria-label="Filtrar por nombre"
aria-label="Filtrar por estado"
aria-label="Paginación"
aria-label="Página anterior"
aria-label="Página siguiente"
aria-label="Miga de pan"

// Status messages (hardcoded)
"Cargando etiquetas..."
"Error al cargar las etiquetas. Intentá de nuevo."
```

**Should be**: `t('admin-tags.moderation.title')`, `t('admin-tags.moderation.description')`, etc.

#### 2. **Sponsorships** (~12 instances)
`/apps/admin/src/features/sponsorships/components/`
- `title="Próximamente"` (Coming Soon feature)
- `placeholder="Ej: Plan Oro"` (form field examples)
- `placeholder="Beneficios e inclusiones del paquete"`

#### 3. **Form Placeholders** (~20 instances across billing, newsletters, accommodations)
- `/features/billing-plans/components/PlanDialog.tsx`
- `/features/billing-addons/components/AddonDialog.tsx`
- `/features/billing-payments/PaymentFilters.tsx`
- `/features/promo-codes/components/PromoCodeFormDialog.tsx`
- `/features/accommodations/components/edit/fields/LocationPickerField.tsx`
- `/features/newsletter/campaigns/-components/CampaignEditor.tsx`

**Examples**:
```jsx
placeholder="Ej: Plan Oro"
placeholder="Auto si vacío"
placeholder="Nombre interno de la campaña"
placeholder="Asunto que verá el destinatario en su bandeja"
placeholder="Av. Belgrano 123, Concepción del Uruguay"
```

#### 4. **Shared Tag Components** (~15 instances)
`/apps/admin/src/components/tags/`
- `OwnTagForm.tsx`: `placeholder="Ej: Revisar después, VIP, Urgente"`
- `PostTagForm.tsx`: Multiple placeholders
- `AdminTagForm.tsx`: Multiple placeholders
- `TagPicker.tsx`: `placeholder="Buscar tags..."`

#### 5. **Newsletter Campaigns** (~8 instances)
`/routes/_authed/newsletter/campaigns/`
- Pagination strings: `"Página {pagination.page} de {pagination.totalPages} · {pagination.total}"`
- This should use a translated template with interpolation

#### 6. **Other Areas** (~10 instances)
- Billing settings: `placeholder="ARS"`
- Icon comparison (dev route): `placeholder="Filter icons..."` (English, acceptable for dev)
- Examples & documentation components (lower priority)

---

## 4. Anti-Patterns & Issues Detected

### Issue #1: Spanish-Only in International App
**Severity**: 🔴 **HIGH**

Multiple features have Spanish text hardcoded where English versions should also be hardcoded or both should be translated:
- Tags moderation page title: "Moderación de etiquetas de usuario" (Spanish only)
- Error messages: "Error al cargar las etiquetas. Intentá de nuevo." (Spanish colloquial)
- Pagination labels: Uses Spanish template logic

**Impact**: English and Portuguese users see Spanish text in these pages.

### Issue #2: Placeholder Pattern Inconsistency
**Severity**: 🟡 **MEDIUM**

Placeholders use both:
1. **Translated**: `placeholder={t('admin-filters.searchPlaceholder')}` ✅ (correct)
2. **Hardcoded examples**: `placeholder="Ej: Plan Oro"` ❌ (needs translation)

The "Ej:" prefix (Spanish for "e.g.") makes these context-specific; they should be keys like:
```
admin-billing.plans.examples.namePrefix
admin-billing.plans.examples.benefitsPrefix
```

### Issue #3: Missing Pluralization Handling
**Severity**: 🟡 **MEDIUM**

String concatenation observed in pagination:
```jsx
`Página ${pagination.page} de ${pagination.totalPages} · ${pagination.total}`
```

Should use i18n pluralization utility with:
```
admin-tables.pagination.info: "Page {{page}} of {{totalPages}} · {{total}} items"
```

### Issue #4: No Translations for User-Moderation Meta-Text
**Severity**: 🟡 **MEDIUM**

Status/loading messages lack translation keys:
```jsx
"Cargando etiquetas..."  // Should be admin-tags.loading
"Error al cargar..."     // Should be admin-tags.error.loading
```

---

## 5. Locale Key Coverage Gap Analysis

### What's Missing in Locale Files

**No entry for**: Tags moderation admin pages
- Should add `admin-tags.moderation` section to all three locale files:
```json
{
  "admin-tags": {
    "moderation": {
      "title": "User Tag Moderation",
      "description": "Private tags created by users. Admin-only view.",
      "search": {
        "placeholder": "Search by tag name...",
        "aria": "Search user tags"
      },
      "pagination": {
        "aria": "Pagination"
      },
      "loading": "Loading tags...",
      "error": "Failed to load tags. Please try again."
    },
    "system": {
      "title": "System Tags",
      "search": { ... }
    },
    "postTags": {
      "title": "Post Tags",
      "search": { ... }
    },
    "internal": {
      "title": "Internal Tags",
      "search": { ... }
    }
  }
}
```

**Current** `admin-tags` structure is incomplete; only covers user/system/post-tags types, not admin CRUD page labels.

### What Exists & Is Complete

✅ `admin-common.json`: All error boundaries, loading states, form validation  
✅ `admin-entities.json`: CRUD action labels (create, edit, delete)  
✅ `admin-tables.json`: Table header, sort, filter  
✅ `tags.json`: Tag type enums, delete dialog, picker  

---

## 6. Recommendations (Priority Order)

### P0 (Block release)
1. **Extract Tags moderation page strings** to `/admin-tags.moderation.*` keys
   - Page title, subtitle, search label, aria-labels, status messages
   - ~20 strings, affects 4 file variants (user/system/post/internal)
   - Add to all 3 locale files

2. **Translate placeholder examples** as separate keys
   - Create `admin-billing.placeholders.plan*`, `admin-sponsorships.examples.*`
   - ~15 strings in billing, sponsorships, accommodations
   - Use interpolation: `t('admin-billing.examples.plan', { default: 'e.g. Gold Plan' })`

### P1 (Before next release)
3. **Extract pagination & loading messages** to i18n
   - Newsletter campaigns pagination template
   - All "Cargando..." and error messages
   - ~10 strings

4. **Audit form placeholders** in all feature dialogs
   - `PlanDialog.tsx`, `AddonDialog.tsx`, etc.
   - Use pattern: `placeholder={t('admin-{feature}.form.{field}.placeholder')}`
   - ~20 strings

### P2 (Nice to have)
5. **Set up i18n pluralization utility** for count-based strings
   - Already exists in `@repo/i18n` but not used in admin yet
   - Affects pagination, item counts, etc.

6. **Add admin-specific locale file** `/en/admin-tags.json`
   - Move all hardcoded tag-related strings here
   - Better organization than cramming into `tags.json`

---

## 7. Testing Checklist for Completeness

Once keys are added to locale files, verify:

- [ ] **Spanish (es)**: No hardcoded non-colloquial text (no "Intentá", use formal "Intenta")
- [ ] **Portuguese (pt)**: All plurals & formatting correct (date formats, etc.)
- [ ] **English (en)**: Clear, professional tone (not "Ej:" for examples; use "e.g.")
- [ ] **Pagination**: Works with count-based pluralization (1 item / 2+ items)
- [ ] **Aria-labels**: Distinct from visible text, convey purpose (not just repeat button label)
- [ ] **Locale parity**: All 3 files have identical structure + keys

---

## Conclusion

**i18n wiring is solid**, but **string escape rate is ~7–8% of JSX files** (96 hardcoded of ~384 .tsx files). **Tags management is the critical pain point** with ~45 instances, mostly Spanish placeholders and pagination labels. The issue stems from developer convenience (hardcoding Spanish examples) rather than missing i18n infrastructure.

**Immediate action**: Extract Tags moderation page and form placeholders to translation keys. The groundwork (locale files, hooks, patterns) is already in place; only data entry & refactoring needed.

**Locale completeness**: Excellent. No missing pt translations; en/es/pt perfectly synchronized. Adding ~50–70 new keys to each locale file will achieve 99%+ coverage.

**Estimated effort**: 2–3 hours to extract hardcoded strings and add keys to 3 locale files.
