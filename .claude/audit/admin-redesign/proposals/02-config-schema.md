---
proposal: config-schema
status: DRAFT (in active discussion)
version: 0.1
date-started: 2026-05-22
last-updated: 2026-05-22
depends-on: 01-information-architecture.md (v0.6+)
---

# Admin IA Config Schema (Zod)

> **Living document.** The Zod schema that validates the admin Information Architecture config at boot. The IA proposal (01) defines WHAT we configure; this doc defines the TYPES that enforce HOW. Lockable decisions live in [Decisions log](#decisions-log) at the bottom.

## How to read this doc

- All code blocks are TypeScript with `zod` imports — they represent the **actual schema** that will live in `apps/admin/src/config/ia/schema.ts` once we move to implementation.
- Each schema element is presented with its Zod definition + rationale + a sample valid value.
- Cross-reference validations (e.g., "every role.mainMenu entry must be a known section") are in §10 [Cross-reference validations](#10-cross-reference-validations).

---

## 1. Goals & non-goals

### Goals

- **Type safety in the IDE**: autocomplete + refactor for the config, errors caught at compile time.
- **Boot-time validation**: invalid configs crash the app with a precise error path, never with a silent fallback.
- **Cross-reference integrity**: every `sidebar` ref, `dashboard` ref, `mainMenu` entry resolves to a real definition.
- **Permission validation**: every permission string is a real `PermissionEnum` member (with wildcard support).
- **Forward-compatible**: deferred roles (`enabled: false`) can have partial configs.

### Non-goals

- No runtime mutability in V1. The config is loaded once at boot.
- Not a DB-backed UI editor — Phase 2 may add that, but the schema stays the same.
- Not validating route strings against TanStack file-based routes (too brittle; the renderer handles missing routes with 404).

---

## 2. File structure [PROPOSED — resolves Open Q-A from doc 01]

Split-file approach (lower merge-conflict risk than a single megafile):

```
apps/admin/src/config/ia/
├── schema.ts                 # Zod schemas + inferred TS types (this doc's content)
├── sections.ts               # Section definitions (the 7 main sections)
├── sidebars.ts               # Sidebar definitions (one per section that has one)
├── dashboards.ts             # Dashboard widget configurations
├── tabs.ts                   # Tab configs per entity (accommodation, post, etc.)
├── roles/                    # One file per role
│   ├── host.ts
│   ├── editor.ts
│   ├── admin.ts
│   ├── super-admin.ts
│   ├── sponsor.ts            # enabled: false (deferred)
│   └── client-manager.ts     # enabled: false (deferred)
├── permission-bundles.ts     # Helper expanding wildcards to PermissionEnum arrays
├── index.ts                  # Composes everything into AdminIAConfig + runs Zod parse
└── validate.ts               # Boot-time validation entry point + error formatting
```

`index.ts` re-exports the final `AdminIAConfig` object after Zod parsing. Importing `index.ts` is what triggers boot-time validation; failed validation throws and the app does not start.

---

## 3. Core primitives

### 3.1 i18n label

Every user-facing string must be tri-locale (es/en/pt). No exceptions.

```ts
import { z } from 'zod';

export const I18nLabelSchema = z.object({
  es: z.string().min(1),
  en: z.string().min(1),
  pt: z.string().min(1),
});

export type I18nLabel = z.infer<typeof I18nLabelSchema>;
```

**Sample valid**: `{ es: 'Inicio', en: 'Home', pt: 'Início' }`

**Rationale**: forcing all three at compile time prevents the "we forgot to translate to pt" bug that the i18n audit caught.

### 3.2 Permission expression

Permission strings can be:
- An exact `PermissionEnum` value: `'ACCOMMODATION_VIEW_OWN'`
- A wildcard suffix: `'ACCOMMODATION_*'` (matches all permissions starting with the prefix)
- A universal wildcard: `'*'` (only valid for SUPER_ADMIN `defaultPermissions`)

```ts
import { PermissionEnum } from '@repo/schemas';

export const PermissionExpressionSchema = z.string().regex(
  /^(\*|[A-Z][A-Z0-9_]+(_\*)?|[A-Z][A-Z0-9_]+)$/,
  'Permission must be an exact PermissionEnum value, a prefix wildcard (FOO_*), or "*"',
);

export type PermissionExpression = z.infer<typeof PermissionExpressionSchema>;
```

A separate **runtime expansion** function (in `permission-bundles.ts`) resolves wildcards to concrete `PermissionEnum[]`:

```ts
export const expandPermissions = (expressions: PermissionExpression[]): PermissionEnum[] => {
  const all = Object.values(PermissionEnum) as PermissionEnum[];
  const result = new Set<PermissionEnum>();
  for (const expr of expressions) {
    if (expr === '*') {
      all.forEach((p) => result.add(p));
    } else if (expr.endsWith('_*')) {
      const prefix = expr.slice(0, -2);
      all.filter((p) => p.startsWith(prefix + '_')).forEach((p) => result.add(p));
    } else {
      if (!all.includes(expr as PermissionEnum)) {
        throw new Error(`Unknown permission: ${expr}`);
      }
      result.add(expr as PermissionEnum);
    }
  }
  return [...result];
};
```

**Boot-time guarantee**: if a wildcard expands to zero permissions, that's a configuration error (likely a typo).

### 3.3 Permission gate

The "guard" attached to navigation items. OR-logic — user passes if they have ≥1 of the listed permissions.

```ts
export const PermissionGateSchema = z.array(PermissionExpressionSchema).min(1);

export type PermissionGate = z.infer<typeof PermissionGateSchema>;
```

**Sample**: `['CONVERSATION_VIEW_OWN', 'CONVERSATION_VIEW_ALL']` — user with either permission sees the item.

### 3.4 `onMissing` behavior

Per §8 of doc 01. Default is `'disable'`; opt-in to `'hide'` for structurally inaccessible items.

```ts
export const OnMissingSchema = z.enum(['disable', 'hide']);

export type OnMissing = z.infer<typeof OnMissingSchema>;
```

---

## 4. Sections (Level 1 — main menu)

```ts
export const SectionSchema = z.object({
  id: z.string().min(1),
  label: I18nLabelSchema,
  icon: z.string().min(1),                    // icon ID from @repo/icons (validated at runtime)
  route: z.string().startsWith('/'),
  defaultRoute: z.string().startsWith('/').optional(),
                                              // where the section opens by default (e.g., '/catalogo/dashboard')
                                              // falls back to `route` if omitted
  sidebar: z.string().nullable(),             // ref to sidebar ID; null = no sidebar (e.g., for V0 Inicio before v0.6)
});

export type Section = z.infer<typeof SectionSchema>;
```

**Sample**:

```ts
{
  id: 'catalogo',
  label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
  icon: 'package',
  route: '/catalogo',
  defaultRoute: '/catalogo/dashboard',
  sidebar: 'catalogoSidebar',
}
```

---

## 5. Sidebar items (Level 2 — discriminated union)

Three item types: `link`, `group` (recursive), `separator`.

```ts
// Common base
const ItemBaseFields = {
  id: z.string().min(1),                      // unique within its sidebar
  label: I18nLabelSchema,
  icon: z.string().optional(),
  permissions: PermissionGateSchema.optional(),
                                              // omitted = visible to anyone with ACCESS_PANEL_ADMIN
  onMissing: OnMissingSchema.default('disable'),
  badge: z.string().optional(),               // ID of a badge source (e.g., 'unread-conversations')
} as const;

// Link
export const LinkItemSchema = z.object({
  type: z.literal('link'),
  ...ItemBaseFields,
  route: z.string().startsWith('/'),
  exact: z.boolean().default(false),          // whether route match is exact or prefix
});

// Group (recursive)
export type GroupItem = z.infer<typeof LinkItemSchema> & {  // forward declaration
  type: 'group';
  defaultOpen: boolean;
  items: SidebarItem[];
};

export const GroupItemSchema: z.ZodType<GroupItem> = z.object({
  type: z.literal('group'),
  ...ItemBaseFields,
  defaultOpen: z.boolean().default(false),
  items: z.lazy(() => z.array(SidebarItemSchema).min(1)),
});

// Separator (no permissions — always shown if any sibling is visible)
export const SeparatorItemSchema = z.object({
  type: z.literal('separator'),
  id: z.string().min(1),
});

// Discriminated union
export const SidebarItemSchema = z.discriminatedUnion('type', [
  LinkItemSchema,
  GroupItemSchema,
  SeparatorItemSchema,
]);

export type SidebarItem = z.infer<typeof SidebarItemSchema>;
```

### 5.1 Sidebar (collection of items)

```ts
export const SidebarSchema = z.object({
  items: z.array(SidebarItemSchema).min(1),
});

export type Sidebar = z.infer<typeof SidebarSchema>;
```

**Sample** (truncated):

```ts
{
  items: [
    { type: 'link', id: 'cat-dashboard', label: { es: 'Dashboard de Catálogo', ... },
      route: '/catalogo/dashboard', permissions: ['ACCESS_PANEL_ADMIN'] },
    { type: 'group', id: 'alojamientos', label: { es: 'Alojamientos', ... }, defaultOpen: true,
      items: [
        { type: 'link', id: 'aloj-list', label: { es: 'Listado', ... },
          route: '/catalogo/alojamientos',
          permissions: ['ACCOMMODATION_VIEW_ALL', 'ACCOMMODATION_VIEW_OWN'] },
        { type: 'link', id: 'aloj-create', label: { es: 'Crear alojamiento', ... },
          route: '/catalogo/alojamientos/new',
          permissions: ['ACCOMMODATION_CREATE'] },
      ],
    },
    { type: 'separator', id: 'sep-1' },
    // ...
  ],
}
```

---

## 6. Detail page tabs (Level 3)

```ts
export const TabSchema = z.object({
  id: z.string().min(1),
  label: I18nLabelSchema,
  permissions: PermissionGateSchema.optional(),
  onMissing: OnMissingSchema.default('disable'),
});

export type Tab = z.infer<typeof TabSchema>;

export const TabsConfigSchema = z.object({
  entity: z.string().min(1),                  // 'accommodation' | 'post' | 'event' | 'user' | 'subscription' | etc.
  tabs: z.array(TabSchema).min(1).max(9),     // max 9 per design rule (§5 of doc 01)
});

export type TabsConfig = z.infer<typeof TabsConfigSchema>;
```

**Sample** (accommodation):

```ts
{
  entity: 'accommodation',
  tabs: [
    { id: 'overview',    label: { es: 'Información general', ... } },
    { id: 'gallery',     label: { es: 'Fotos', ... }, permissions: ['ACCOMMODATION_MEDIA_VIEW'] },
    { id: 'amenities',   label: { es: 'Amenidades', ... } },
    { id: 'pricing',     label: { es: 'Precios', ... }, permissions: ['ACCOMMODATION_PRICING_VIEW'] },
    { id: 'reviews',     label: { es: 'Reseñas', ... } },
    { id: 'sponsorship', label: { es: 'Sponsorship', ... }, permissions: ['SPONSORSHIP_VIEW_ALL'], onMissing: 'hide' },
    { id: 'stats',       label: { es: 'Estadísticas', ... } },
    { id: 'config',      label: { es: 'Estado y visibilidad', ... } },
  ],
}
```

---

## 7. Dashboard widgets

```ts
export const WidgetScopeSchema = z.enum(['own', 'all', 'toggle']);
                                             // own = scoped to user's data; all = global; toggle = user can switch

export const WidgetTypeSchema = z.enum([
  'kpi',                                     // single big number, optional delta
  'list',                                    // top-N list (recent items, top performers, etc.)
  'chart',                                   // line/bar/area chart
  'feed',                                    // chronological feed (activity, audit log preview)
  'callout',                                 // notice/banner with CTA (e.g., "Tu plan vence en 5 días")
  'shortcut',                                // group of quick-action buttons
]);

export const WidgetSchema = z.object({
  id: z.string().min(1),                     // unique within dashboard
  type: WidgetTypeSchema,
  label: I18nLabelSchema,
  permissions: PermissionGateSchema.optional(),
  scope: WidgetScopeSchema.default('all'),
  // Type-specific config kept loose in V1 — each widget renderer validates its own shape
  config: z.record(z.unknown()).optional(),
});

export type Widget = z.infer<typeof WidgetSchema>;

export const DashboardSchema = z.object({
  widgets: z.array(WidgetSchema).min(1),
});

export type Dashboard = z.infer<typeof DashboardSchema>;
```

**Sample** (`hostDashboard` partial):

```ts
{
  widgets: [
    { id: 'my-accommodations-count', type: 'kpi',
      label: { es: 'Mis alojamientos', ... },
      scope: 'own',
      permissions: ['ACCOMMODATION_VIEW_OWN'],
      config: { source: 'accommodation.list.count.own' } },
    { id: 'upcoming-checkins', type: 'list',
      label: { es: 'Próximos check-ins', ... },
      scope: 'own',
      permissions: ['ACCOMMODATION_BOOKING_VIEW_OWN'],
      config: { source: 'booking.list.upcoming', limit: 5 } },
    { id: 'subscription-status', type: 'callout',
      label: { es: 'Estado de mi suscripción', ... },
      scope: 'own',
      permissions: ['BILLING_VIEW_OWN'],
      config: { source: 'subscription.status.own', variantWhen: 'expiring' } },
  ],
}
```

**Future hardening (post-V1)**: replace `config: z.record(z.unknown())` with a discriminated union by widget type. For V1 each renderer parses its own `config` with a local Zod schema.

---

## 8. Topbar config (per role)

```ts
export const QuickCreateSchema = z.union([
  z.literal('all'),                           // shorthand: show ALL create actions available to this role
  z.array(z.string().min(1)).min(1),          // explicit list of create-action IDs
]);

export const TopbarConfigSchema = z.object({
  showSearch: z.boolean(),                    // Cmd+K command palette
  showQuickCreate: QuickCreateSchema.nullable(),
                                              // null = no + button shown
  accountInMenu: z.boolean(),                 // true = Mi cuenta in main nav; false = in avatar dropdown
});

export type TopbarConfig = z.infer<typeof TopbarConfigSchema>;
```

**Create actions** are defined separately (see §11 below).

---

## 9. Mobile config (per role)

```ts
export const MobileConfigSchema = z.object({
  bottomNav: z.array(z.string()).min(2).max(5).nullable(),
                                              // section IDs to surface in bottom nav; null = hamburger only
  fab: z.string().nullable(),                 // ID of a single create-action for FAB; null = no FAB
});

export type MobileConfig = z.infer<typeof MobileConfigSchema>;
```

Min 2 bottomNav items (less than 2 doesn't justify a bottom nav); max 5 (more is unusable on small screens).

---

## 10. Roles

```ts
import { RoleEnum } from '@repo/schemas';

export const RoleConfigSchema = z.object({
  enabled: z.boolean(),

  label: I18nLabelSchema,

  defaultPermissions: z.array(PermissionExpressionSchema).default([]),
                                              // expanded at boot via expandPermissions()

  // The following are required when enabled=true; optional when enabled=false
  mainMenu: z.array(z.string()).optional(),   // ordered list of section IDs
  dashboard: z.string().optional(),           // dashboard ID
  topbar: TopbarConfigSchema.optional(),
  mobile: MobileConfigSchema.optional(),

  labelOverrides: z.record(z.string(), I18nLabelSchema).default({}),
                                              // key format: 'sidebarId.itemId' or 'sectionId'
                                              // overrides the default label for THIS role only
}).superRefine((role, ctx) => {
  if (role.enabled) {
    if (!role.mainMenu || role.mainMenu.length < 1) {
      ctx.addIssue({ code: 'custom', path: ['mainMenu'],
        message: 'mainMenu must have ≥1 section when role is enabled' });
    }
    if (!role.dashboard) {
      ctx.addIssue({ code: 'custom', path: ['dashboard'],
        message: 'dashboard ref required when role is enabled' });
    }
    if (!role.topbar) {
      ctx.addIssue({ code: 'custom', path: ['topbar'],
        message: 'topbar config required when role is enabled' });
    }
    if (!role.mobile) {
      ctx.addIssue({ code: 'custom', path: ['mobile'],
        message: 'mobile config required when role is enabled' });
    }
  }
});

export type RoleConfig = z.infer<typeof RoleConfigSchema>;
```

**Sample** (HOST role config):

```ts
{
  enabled: true,
  label: { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' },
  defaultPermissions: [
    'ACCESS_PANEL_ADMIN',
    'ACCOMMODATION_VIEW_OWN', 'ACCOMMODATION_EDIT_OWN', 'ACCOMMODATION_CREATE',
    // ... (see doc 01 §12)
  ],
  mainMenu: ['inicio', 'misAlojamientos', 'consultas', 'miFacturacion', 'miCuenta'],
  dashboard: 'hostDashboard',
  topbar: { showSearch: false, showQuickCreate: ['newAccommodation'], accountInMenu: true },
  mobile: { bottomNav: ['inicio', 'misAlojamientos', 'consultas', 'miCuenta'], fab: 'newAccommodation' },
  labelOverrides: {
    'inicioSidebar.dashboard': { es: 'Mi negocio', en: 'My business', pt: 'Meu negócio' },
  },
}
```

**Sample** (deferred SPONSOR):

```ts
{
  enabled: false,
  label: { es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' },
  // mainMenu, dashboard, topbar, mobile can be omitted when enabled=false
}
```

---

## 11. Create actions (referenced by topbar + mobile FAB)

To keep `showQuickCreate` and `mobile.fab` declarative, define create actions explicitly:

```ts
export const CreateActionSchema = z.object({
  id: z.string().min(1),                      // referenced by topbar/mobile configs
  label: I18nLabelSchema,
  route: z.string().startsWith('/'),
  icon: z.string().optional(),
  permissions: PermissionGateSchema.optional(),
});

export type CreateAction = z.infer<typeof CreateActionSchema>;
```

**Sample registry**:

```ts
{
  newAccommodation: { id: 'newAccommodation', label: { es: 'Nuevo alojamiento', ... },
                     route: '/catalogo/alojamientos/new',
                     permissions: ['ACCOMMODATION_CREATE'] },
  newPost: { id: 'newPost', label: { es: 'Nuevo post', ... },
            route: '/editorial/blog/new', permissions: ['POST_CREATE'] },
  newEvent: { id: 'newEvent', label: { es: 'Nuevo evento', ... },
             route: '/editorial/eventos/new', permissions: ['EVENT_CREATE'] },
  newCampaign: { id: 'newCampaign', label: { es: 'Nueva campaña', ... },
                route: '/editorial/newsletter/new', permissions: ['NEWSLETTER_CAMPAIGN_WRITE'] },
  // ...
}
```

---

## 12. Top-level config

```ts
export const AdminIAConfigSchema = z.object({
  sections: z.record(z.string(), SectionSchema),
  sidebars: z.record(z.string(), SidebarSchema),
  dashboards: z.record(z.string(), DashboardSchema),
  tabs: z.record(z.string(), TabsConfigSchema),       // keyed by entity name
  createActions: z.record(z.string(), CreateActionSchema),
  roles: z.record(z.nativeEnum(RoleEnum), RoleConfigSchema),
}).superRefine((config, ctx) => {
  // (cross-reference validations — see §13)
});

export type AdminIAConfig = z.infer<typeof AdminIAConfigSchema>;
```

---

## 13. Cross-reference validations

These run in `.superRefine()` on the top-level schema. Any failure makes the app refuse to start.

### 13.1 Sidebar refs

Every `section.sidebar` (when not null) must exist in `sidebars`.

```ts
for (const [sectionId, section] of Object.entries(config.sections)) {
  if (section.sidebar !== null && !config.sidebars[section.sidebar]) {
    ctx.addIssue({ code: 'custom',
      path: ['sections', sectionId, 'sidebar'],
      message: `Sidebar '${section.sidebar}' not found in sidebars` });
  }
}
```

### 13.2 Role mainMenu

Every entry in an enabled role's `mainMenu` must be a known section ID.

```ts
for (const [roleId, role] of Object.entries(config.roles)) {
  if (!role.enabled || !role.mainMenu) continue;
  role.mainMenu.forEach((sectionId, idx) => {
    if (!config.sections[sectionId]) {
      ctx.addIssue({ code: 'custom',
        path: ['roles', roleId, 'mainMenu', idx],
        message: `Section '${sectionId}' not found` });
    }
  });
}
```

### 13.3 Role dashboard refs

Every enabled role's `dashboard` must reference a known dashboard.

```ts
for (const [roleId, role] of Object.entries(config.roles)) {
  if (!role.enabled || !role.dashboard) continue;
  if (!config.dashboards[role.dashboard]) {
    ctx.addIssue({ code: 'custom',
      path: ['roles', roleId, 'dashboard'],
      message: `Dashboard '${role.dashboard}' not found` });
  }
}
```

### 13.4 Create action refs

Every entry in `topbar.showQuickCreate` (when an array) and `mobile.fab` must reference a known create action.

```ts
for (const [roleId, role] of Object.entries(config.roles)) {
  if (!role.enabled) continue;
  const qc = role.topbar?.showQuickCreate;
  if (Array.isArray(qc)) {
    qc.forEach((actionId, idx) => {
      if (!config.createActions[actionId]) {
        ctx.addIssue({ code: 'custom',
          path: ['roles', roleId, 'topbar', 'showQuickCreate', idx],
          message: `Create action '${actionId}' not found` });
      }
    });
  }
  const fab = role.mobile?.fab;
  if (fab && !config.createActions[fab]) {
    ctx.addIssue({ code: 'custom',
      path: ['roles', roleId, 'mobile', 'fab'],
      message: `Create action '${fab}' not found` });
  }
}
```

### 13.5 mobile.bottomNav refs

Every entry in `mobile.bottomNav` must be a section ID present in the role's `mainMenu`.

```ts
for (const [roleId, role] of Object.entries(config.roles)) {
  if (!role.enabled || !role.mobile?.bottomNav) continue;
  role.mobile.bottomNav.forEach((sectionId, idx) => {
    if (!role.mainMenu?.includes(sectionId)) {
      ctx.addIssue({ code: 'custom',
        path: ['roles', roleId, 'mobile', 'bottomNav', idx],
        message: `bottomNav section '${sectionId}' must be in role's mainMenu` });
    }
  });
}
```

### 13.6 labelOverrides paths

Every `labelOverrides` key must resolve to a known item path. The path format is documented as `'sidebarId.itemId'` (item label override) or `'sectionId'` (section label override).

```ts
// Pseudocode — full implementation walks sidebar trees recursively
for (const [roleId, role] of Object.entries(config.roles)) {
  if (!role.enabled) continue;
  for (const path of Object.keys(role.labelOverrides)) {
    if (!resolveLabelPath(config, path)) {
      ctx.addIssue({ code: 'custom',
        path: ['roles', roleId, 'labelOverrides', path],
        message: `Label override path '${path}' does not resolve to any item` });
    }
  }
}
```

### 13.7 Permission expansion sanity

After `expandPermissions()` is applied to every role's `defaultPermissions`, the result must be non-empty for enabled roles. (A role with 0 permissions cannot enter the admin.)

```ts
for (const [roleId, role] of Object.entries(config.roles)) {
  if (!role.enabled) continue;
  try {
    const expanded = expandPermissions(role.defaultPermissions);
    if (expanded.length === 0) {
      ctx.addIssue({ code: 'custom',
        path: ['roles', roleId, 'defaultPermissions'],
        message: 'expanded permissions is empty — role cannot access admin' });
    }
  } catch (err) {
    ctx.addIssue({ code: 'custom',
      path: ['roles', roleId, 'defaultPermissions'],
      message: (err as Error).message });
  }
}
```

### 13.8 Unique IDs within sidebars

Within a single sidebar (recursively flattened), all `id` fields must be unique.

```ts
for (const [sidebarId, sidebar] of Object.entries(config.sidebars)) {
  const ids = new Set<string>();
  const dup: string[] = [];
  const visit = (items: SidebarItem[]) => {
    for (const item of items) {
      if (ids.has(item.id)) dup.push(item.id);
      ids.add(item.id);
      if (item.type === 'group') visit(item.items);
    }
  };
  visit(sidebar.items);
  if (dup.length) {
    ctx.addIssue({ code: 'custom',
      path: ['sidebars', sidebarId],
      message: `Duplicate item IDs in sidebar: ${dup.join(', ')}` });
  }
}
```

---

## 14. Validation entry point

```ts
// apps/admin/src/config/ia/validate.ts
import { AdminIAConfigSchema } from './schema';
import { rawConfig } from './index';

export const validatedConfig = (() => {
  const result = AdminIAConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[admin-ia.config] Validation failed:\n${formatted}\n` +
      `\nFix the config in apps/admin/src/config/ia/ and restart.`,
    );
  }
  return result.data;
})();
```

Validation runs **at module load** — importing the IA config anywhere in the admin triggers validation. If it fails, the app does not start. The error message points to the exact path of every problem.

---

## 15. Sample invalid configs (crash examples)

### Example 1 — Bad sidebar ref

```ts
sections: {
  catalogo: { ..., sidebar: 'catalogoSdiebar' /* typo */ }
}
```

Crash:
```
[admin-ia.config] Validation failed:
  sections.catalogo.sidebar: Sidebar 'catalogoSdiebar' not found in sidebars

Fix the config in apps/admin/src/config/ia/ and restart.
```

### Example 2 — Role mainMenu references non-existent section

```ts
roles: {
  EDITOR: { ..., mainMenu: ['inicio', 'editorial', 'analyiss' /* typo */, 'miCuenta'] }
}
```

Crash:
```
[admin-ia.config] Validation failed:
  roles.EDITOR.mainMenu.2: Section 'analyiss' not found
```

### Example 3 — Empty expanded permissions

```ts
roles: {
  HOST: { enabled: true, defaultPermissions: ['ACCOMODDATION_*' /* typo */] }
}
```

Crash:
```
[admin-ia.config] Validation failed:
  roles.HOST.defaultPermissions: Unknown permission: ACCOMODDATION_*
```

### Example 4 — bottomNav references non-mainMenu section

```ts
roles: {
  HOST: { ..., mainMenu: ['inicio', 'misAlojamientos', 'consultas', 'miFacturacion', 'miCuenta'],
          mobile: { bottomNav: ['inicio', 'misAlojamientos', 'comercial' /* not in mainMenu */, 'miCuenta'], fab: 'newAccommodation' } }
}
```

Crash:
```
[admin-ia.config] Validation failed:
  roles.HOST.mobile.bottomNav.2: bottomNav section 'comercial' must be in role's mainMenu
```

---

## 16. Inferred TS types (export for consumers)

```ts
export type AdminIAConfig    = z.infer<typeof AdminIAConfigSchema>;
export type Section          = z.infer<typeof SectionSchema>;
export type Sidebar          = z.infer<typeof SidebarSchema>;
export type SidebarItem      = z.infer<typeof SidebarItemSchema>;
export type LinkItem         = z.infer<typeof LinkItemSchema>;
export type GroupItem        = z.infer<typeof GroupItemSchema>;
export type SeparatorItem    = z.infer<typeof SeparatorItemSchema>;
export type Tab              = z.infer<typeof TabSchema>;
export type TabsConfig       = z.infer<typeof TabsConfigSchema>;
export type Widget           = z.infer<typeof WidgetSchema>;
export type Dashboard        = z.infer<typeof DashboardSchema>;
export type TopbarConfig     = z.infer<typeof TopbarConfigSchema>;
export type MobileConfig     = z.infer<typeof MobileConfigSchema>;
export type RoleConfig       = z.infer<typeof RoleConfigSchema>;
export type CreateAction     = z.infer<typeof CreateActionSchema>;
export type I18nLabel        = z.infer<typeof I18nLabelSchema>;
export type PermissionGate   = z.infer<typeof PermissionGateSchema>;
export type OnMissing        = z.infer<typeof OnMissingSchema>;
```

Components import these and never duplicate shapes.

---

## Open questions

### A. Schema location: `apps/admin` vs `@repo/schemas` [OPEN]

Currently proposed at `apps/admin/src/config/ia/schema.ts`. Alternative: move to `@repo/schemas` so other apps could read role/permission bundles (e.g., the API for permission-bundle previews in an admin UI).

Recommend keeping in `apps/admin` for V1 — it's admin-specific config. Move later if a cross-package need emerges.

### B. Widget `config` typing [OPEN — V1 acceptable]

For V1, `WidgetSchema.config: z.record(z.unknown())` is loose. Each widget renderer validates its own `config` shape with a local schema. Post-V1 hardening: replace with a discriminated union by widget `type`.

### C. Permission expansion timing [DECIDED — boot time]

Expansion happens once at boot via `expandPermissions()`. The expanded array is what the runtime uses for permission checks. Wildcards never reach the runtime.

### D. Hot-reload behavior in dev [OPEN]

Vite HMR on a TS config change → does the app re-validate and rebuild? Likely yes (TanStack Start dev server triggers a full reload on config changes). To be confirmed in implementation.

---

## Decisions log

| Date | Decision | Section |
|------|----------|---------|
| 2026-05-22 | Schema lives in `apps/admin/src/config/ia/` (split-file approach), not in a single megafile | §2 |
| 2026-05-22 | All user-facing labels are tri-locale `{ es, en, pt }`, all required at compile time | §3.1 |
| 2026-05-22 | Permission expressions support: exact `PermissionEnum`, suffix wildcard `FOO_*`, universal `*`. Boot-time expansion via `expandPermissions()` | §3.2 |
| 2026-05-22 | `onMissing` field on items (default `'disable'`, opt-in `'hide'`) per IA doc §8 | §3.4 |
| 2026-05-22 | Sidebar items as discriminated union by `type`: `link`, `group` (recursive), `separator` | §5 |
| 2026-05-22 | Detail page tabs capped at max 9 (per IA doc §5 design rule) | §6 |
| 2026-05-22 | Widget types in V1: `kpi`, `list`, `chart`, `feed`, `callout`, `shortcut`. Widget `config` field loose for V1, tightened post-V1 | §7 |
| 2026-05-22 | `mobile.bottomNav` cap: min 2, max 5 sections | §9 |
| 2026-05-22 | Roles with `enabled: false` can have partial config (mainMenu/dashboard/topbar/mobile optional) | §10 |
| 2026-05-22 | Create actions defined separately and referenced by ID from topbar.showQuickCreate + mobile.fab | §11 |
| 2026-05-22 | Cross-reference validations run in top-level `superRefine`: sidebars, mainMenu, dashboards, create actions, bottomNav, label override paths, permission expansion, unique IDs | §13 |
| 2026-05-22 | Validation entry point throws at module load with a formatted multi-line error pointing to every problem | §14 |

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial full draft. 16 sections covering primitives, sections, sidebar items, tabs, widgets, topbar, mobile, roles, create actions, top-level config, cross-reference validations, error examples, and inferred TS types. 4 open questions (A: schema location, B: widget config typing, C: permission expansion, D: HMR behavior). |
