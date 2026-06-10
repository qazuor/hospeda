# CLAUDE.md - Admin Application

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Hospeda Admin application (`apps/admin`).

## Overview

TanStack Start-based admin dashboard for managing the Hospeda platform. Features file-based routing, React 19, Better Auth authentication, Radix UI components, TanStack Table for data grids, and TanStack Query for server state.

## Key Commands

```bash
# Development
pnpm dev               # Start dev server (port 3000)
pnpm dev:clean         # Clear Vite cache and start dev
pnpm dev:watch         # Watch packages for changes and restart

# Build & Deploy
pnpm build             # Production build
pnpm serve             # Preview production build
pnpm start             # Start production server

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:ui           # Interactive UI

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
pnpm check             # Run all checks

# Utilities
pnpm clean             # Remove node_modules and dist
pnpm clean:cache       # Remove Vite cache only
```

## Project Structure

```
src/
├── routes/                # File-based routing (TanStack Router)
│   ├── __root.tsx             # Root layout
│   ├── _authed/               # Authenticated routes wrapper
│   │   ├── accommodations/    # Accommodation CRUD pages
│   │   ├── destinations/      # Destination CRUD pages
│   │   ├── events/            # Events + locations + organizers
│   │   ├── content/           # Amenities, features, attractions
│   │   ├── sponsors/          # Sponsor pages (nested folder)
│   │   ├── settings/          # Tags, critical settings
│   │   ├── access/            # User management
│   │   ├── billing/           # Billing pages
│   │   └── posts/             # Blog post pages
├── features/              # Feature-specific modules
│   ├── accommodations/        # config/, hooks/, utils/
│   ├── destinations/
│   ├── amenities/
│   ├── attractions/
│   ├── features/
│   ├── events/
│   ├── event-locations/
│   ├── event-organizers/
│   ├── sponsors/
│   ├── tags/
│   ├── posts/
│   └── dashboard/
├── components/            # Reusable components
│   ├── entity-form/           # EntityFormSection, fields, navigation
│   ├── entity-pages/          # EntityPageBase, EntityViewContent, EntityCreateContent
│   ├── entity-list/           # DataTable, createEntityApi
│   ├── selects/               # DestinationSelect, OwnerSelect
│   ├── error-boundaries/      # EntityErrorBoundary
│   ├── auth/                  # RoutePermissionGuard
│   ├── table/                 # DataTable wrapper
│   ├── ui/                    # Shadcn UI components
│   └── ui-wrapped/            # Wrapped UI components (Button, Card, etc.)
├── lib/                   # Utility libraries
│   ├── api/                   # fetchApi client
│   ├── factories/             # createEntityHooks factory
│   └── utils/                 # async-validation, entity-search
├── hooks/                 # Custom React hooks
├── config/                # App configuration (sections, navigation)
└── utils/                 # General utilities (logger)
```

## File-Based Routing

TanStack Router uses file-based routing in `src/routes/_authed/`:

```
routes/_authed/
├── accommodations/
│   ├── index.tsx              → LIST page
│   ├── $id.tsx                → VIEW page
│   ├── $id_.edit.tsx          → EDIT page ($id_ = sibling, not child)
│   └── new.tsx                → CREATE page
├── events/
│   ├── locations/             → Nested folder (NOT flat locations.tsx)
│   │   ├── index.tsx          → LIST
│   │   ├── $id.tsx            → VIEW
│   │   ├── $id_.edit.tsx      → EDIT
│   │   └── new.tsx            → CREATE
│   └── organizers/            → Same pattern
├── sponsors/                  → Nested folder (NOT flat sponsors.tsx)
│   ├── index.tsx
│   ├── $id.tsx
│   ├── $id_.edit.tsx
│   └── new.tsx
└── settings/
    └── tags/                  → Nested folder
        ├── index.tsx
        ├── $id.tsx
        ├── $id_.edit.tsx
        └── new.tsx
```

**Route naming rules:**

- Use **nested folders** (NOT flat files like `tags.tsx`, `tags.$id.tsx`)
- `$id.tsx` = view page (child of folder)
- `$id_.edit.tsx` = edit page (underscore suffix makes it a sibling route, not nested under `$id`)
- `new.tsx` = create page
- `index.tsx` = list page

### Protected Routes

All routes under `_authed/` require authentication via `beforeLoad` guard in `_authed.tsx`.

## Entity Page Architecture

Every entity in the admin panel follows a consistent 4-page pattern:

### LIST Page (`index.tsx`)

Uses `DataTable` with entity-specific columns and config:

```tsx
// Features entity-specific config in features/<entity>/config/<entity>.columns.ts
// and features/<entity>/config/<entity>.config.ts
```

### VIEW Page (`$id.tsx`)

Uses `EntityPageBase` with tabs (General, Events, Contact, etc.):

```tsx
import { EntityPageBase } from '@/components/entity-pages';
// EntityPageBase renders tabs, breadcrumbs, and EntityViewContent per section
```

### EDIT Page (`$id_.edit.tsx`)

Uses `EntityPageBase` in edit mode with `EntityFormSection` for each section.

### CREATE Page (`new.tsx`)

Uses **`EntityCreateContent`** shared component (in `components/entity-pages/EntityCreateContent.tsx`). This is the standard pattern for ALL create pages:

```tsx
import { EntityCreateContent } from '@/components/entity-pages';
import { createConsolidatedConfig } from '../config/sections/basic-info.consolidated';

function NewEntityPage() {
    const createMutation = useCreateEntity();
    const navigate = useNavigate();

    return (
        <EntityCreateContent
            config={{
                entityType: 'entity-name',
                title: 'Create Entity',
                description: 'Create a new entity',
                entityName: 'Entity',
                entityNamePlural: 'Entities',
                basePath: '/entities',
                submitLabel: 'Create',
                savingLabel: 'Creating...',
                successToastTitle: 'Created',
                successToastMessage: 'Entity created successfully',
                errorToastTitle: 'Error',
                errorMessage: 'Failed to create entity',
            }}
            createConsolidatedConfig={createConsolidatedConfig}
            createMutation={createMutation}
            onNavigate={(path) => navigate({ to: path })}
        />
    );
}
```

**Never duplicate form/navigation/error-handling logic in individual create pages.** Always use EntityCreateContent.

### Consolidated Config Pattern

Each entity defines its sections in `features/<entity>/config/sections/basic-info.consolidated.ts`:

```ts
export function createConsolidatedConfig() {
    return {
        sections: [
            {
                id: 'basic-info',
                title: 'Basic Information',
                mode: ['create', 'edit', 'view'],
                fields: [/* field definitions */],
            },
            // More sections...
        ],
        metadata: {
            entityName: 'Entity',
            entityNamePlural: 'Entities',
        },
    };
}
```

### Entity Hooks Factory

Use `createEntityHooks` from `lib/factories/createEntityHooks.ts` to generate standardized CRUD hooks:

```ts
const { useList, useGetById, useCreate, useUpdate, useDelete } = createEntityHooks({
    entityName: 'accommodations',
    apiEndpoint: '/api/v1/admin/accommodations',
});
```

## Tables (TanStack Table)

```tsx
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { Accommodation } from '@repo/types';

const columns: ColumnDef<Accommodation>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'city',
    header: 'City',
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <button onClick={() => editAccommodation(row.original.id)}>
        Edit
      </button>
    ),
  },
];

export function AccommodationsTable({ data }: { data: Accommodation[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div>
        <button onClick={() => table.previousPage()}>Previous</button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>
        <button onClick={() => table.nextPage()}>Next</button>
      </div>
    </div>
  );
}
```

## UI Components (Shadcn)

Add components with:

```bash
pnpx shadcn@latest add button
pnpx shadcn@latest add dialog
pnpx shadcn@latest add form
```

Use components:

```tsx
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

export function MyComponent() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <h2>Dialog Content</h2>
      </DialogContent>
    </Dialog>
  );
}
```

## Authentication (Better Auth)

### Setup in Root

```tsx
// routes/__root.tsx
import { AuthProvider } from 'better-auth/react';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthProvider baseURL={import.meta.env.VITE_BETTER_AUTH_URL}>
      <Outlet />
    </AuthProvider>
  );
}
```

### Using Auth Hooks

```tsx
import { useSession } from 'better-auth/react';

export function UserProfile() {
  const { data: session, isPending } = useSession();
  

  if (!session) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <p>User ID: {session.user.id}</p>
      <p>Name: {session.user.name}</p>
      <p>Email: {session.user.email}</p>
    </div>
  );
}
```

## API Endpoint Convention

**All admin panel API calls use `/api/v1/admin/*` endpoints.** This ensures admin users get full access to all resources (including drafts, deleted items, and audit fields).

| Pattern | Usage |
|---------|-------|
| `/api/v1/admin/<entity>` | ALL entity CRUD operations |
| `/api/v1/public/auth/me` | Auth status check (exception) |
| `/api/v1/protected/billing/*` | Billing operations (protected tier) |

**Never use `/api/v1/public/*` or `/api/v1/protected/*` in admin panel code** (except auth).

### Entity Config Pattern

Each entity config defines the `apiEndpoint`:

```ts
// features/accommodations/config/accommodations.config.ts
export const accommodationsConfig = {
    apiEndpoint: '/api/v1/admin/accommodations',
    // ...
};
```

### Entity Hook Pattern

Hooks use the admin endpoint for all operations:

```ts
const fetchAccommodations = async () => {
    const response = await fetchApi('/api/v1/admin/accommodations');
    return response;
};
```

## API Client

Uses `fetchApi` from `@/lib/api/fetch-api` with automatic auth token injection.

```ts
import { fetchApi } from '@/lib/api/fetch-api';

// All CRUD operations go through /admin/ endpoints
const list = () => fetchApi('/api/v1/admin/accommodations');
const getById = (id: string) => fetchApi(`/api/v1/admin/accommodations/${id}`);
const create = (data: unknown) => fetchApi('/api/v1/admin/accommodations', { method: 'POST', body: JSON.stringify(data) });
const update = (id: string, data: unknown) => fetchApi(`/api/v1/admin/accommodations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
const remove = (id: string) => fetchApi(`/api/v1/admin/accommodations/${id}`, { method: 'DELETE' });
```

## State Management

Use TanStack Query for server state and React Context/useState for UI state:

```tsx
// contexts/ThemeContext.tsx
import { createContext, useContext, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

## Deployment (Coolify)

This app runs as two Coolify resources on the self-hosted VPS:

- `hospeda-admin-prod` — production, served at `https://admin.hospeda.com.ar`
- `hospeda-admin-staging` — staging, served at `https://staging-admin.hospeda.com.ar`

Each resource has its own database, env vars, and OAuth client. The operational toolkit (`scripts/server-tools/`, command `hops`) is target-aware via `--target=prod|staging` (defaults to prod). See [docs/migration/staging-prod-db-separation.md](../../docs/migration/staging-prod-db-separation.md) for the full split rationale.

### Healthcheck — probe `/healthz`, never `GET /` (SPEC-209)

The container healthcheck MUST hit `/healthz`, not `GET /`. Probing `/` server-renders
the entire React root on every probe (every 30 s), and each SSR render of the root used to
construct a fresh `QZPayBilling` instance — the production admin grew to ~986 MB in 48 h
with no real users, fed almost entirely by the healthcheck. See engram
`deploy/vps-memory-pressure` and `spec/SPEC-209/progress`.

- **Endpoint**: `/healthz` returns `200 {"status":"ok"}` (`application/json`) without
  invoking React SSR, the `cspMiddleware`, the `_authed` auth guard, or any billing
  construction. It is implemented as a path intercept in `src/server.ts`
  (`healthcheckResponse(request)`), returned BEFORE `createStartHandler` runs — NOT as a
  TanStack Start `server.handlers` route. Server routes (`createFileRoute(...).server.handlers`)
  are a **no-op** in TanStack Start / router-generator `1.131.26`: the generator never emits
  `serverRouteTree`, so the SSR dispatch short-circuits and the handler never fires. Re-evaluate
  if the framework is upgraded.
- **Dockerfile**: the `HEALTHCHECK` instruction in `apps/admin/Dockerfile` targets `/healthz`.
- **Coolify caveat**: a healthcheck configured in the Coolify resource UI (Health Checks tab)
  OVERRIDES the Dockerfile instruction. When deploying, confirm the UI healthcheck (if any)
  also points at `/healthz`, or the container silently keeps probing `GET /`.

### SSR safety in the root — never build per-request singletons client-side-only (SPEC-209)

`src/routes/__root.tsx` `RootDocument` mounts **once per request** on the server (TanStack
Start SSR). A `useState(() => createX())` lazy initializer is the correct *browser* pattern
(one instance per mounted tree) but on the server it runs on EVERY request, leaking a fresh
instance per render.

- **QZPayBilling** is therefore built CLIENT-ONLY: `const [billing, setBilling] = useState(null)`
  - `useEffect(() => setBilling(createQZPayBilling(...)), [])`. `useEffect` never runs on the
  server, so SSR builds zero billing instances; the client builds exactly one on mount.
  `QZPayProvider` does not tolerate `null` billing (it calls `billing.isLivemode()` during
  render), so it is mounted conditionally (`{billing !== null ? <QZPayProvider…> : children}`)
  with the theme/query/toast providers kept stable outside the conditional.
- **QueryClient** is intentionally LEFT as a per-request `useState` lazy initializer — a
  per-request QueryClient is the recommended TanStack Query SSR pattern (cache isolation
  between requests) and is NOT a leak. Do not collapse it into a module-level singleton.
- **Guard**: `test/routes/__root.ssr-guard.test.ts` (and the web twin
  `apps/web/test/layouts/BaseLayout.ssr-guard.test.ts`) statically fail CI if
  `createQZPayBilling(` / `new QueryClient(` reappears in a root/layout outside a client-only
  guard. The memory-validation procedure for staging lives in
  [`.qtm/specs/SPEC-209-admin-ssr-memory-leak-healthcheck/docs/memory-validation-procedure.md`](../../.qtm/specs/SPEC-209-admin-ssr-memory-leak-healthcheck/docs/memory-validation-procedure.md).

## Environment Variables

See `apps/admin/.env.example` for a full list. Client-side variables use the `VITE_` prefix (required by Vite to expose them to the browser). Server-side secrets that the admin build process needs use the `HOSPEDA_` prefix.

```env
# Client-side (VITE_ prefix - exposed to browser by Vite)
VITE_BETTER_AUTH_URL=http://localhost:3001/api/auth
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=Hospeda Admin
```

Access client-side variables via `import.meta.env`:

```ts
const apiUrl = import.meta.env.VITE_API_URL;
```

Never put `HOSPEDA_*` secrets in `VITE_` variables. Secrets must stay server-side only.

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  it('should render accommodation name', () => {
    const accommodation = {
      id: '1',
      name: 'Hotel Test',
      city: 'Buenos Aires',
    };

    render(<AccommodationCard accommodation={accommodation} />);

    expect(screen.getByText('Hotel Test')).toBeInTheDocument();
  });
});
```

## Styling

This app uses **Tailwind CSS v4** utility classes (with `class-variance-authority` for component variants). Do NOT use CSS Modules or vanilla CSS files here — that pattern belongs to `apps/web` only.

Use Tailwind CSS with class variance authority:

```tsx
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        outline: 'border border-input hover:bg-accent',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export function Button({ variant, size, className, ...props }) {
  return (
    <button className={buttonVariants({ variant, size, className })} {...props} />
  );
}
```

## Key Dependencies

- `@tanstack/react-start` - Full-stack React framework
- `@tanstack/react-router` - File-based routing
- `@tanstack/react-query` - Server state management
- `@tanstack/react-table` - Data tables
- `@tanstack/react-form` - Form handling
- `better-auth` - Authentication
- `@radix-ui/*` - Unstyled UI primitives
- `tailwindcss` - Utility-first CSS

## FAQ Management (SPEC-177, Phase 2 of SPEC-158)

Destinations and accommodations expose an admin **"FAQs" sub-tab** to create, edit, delete and
**reorder** their structured FAQs. The UI is a single generic, reusable component:

- `components/faqs/FaqManager.tsx` + `SortableFaqRow.tsx` + `FaqCategoryCombobox.tsx`. Props:
  `{ entityType: 'destinations' | 'accommodations', parentId }`.
- Data via the generic `features/faqs/hooks/useFaqs(entityType, parentId)` (TanStack Query):
  list + create/update/delete/reorder mutations hitting
  `/api/v1/admin/{entityType}/:id/faqs[/:faqId | /reorder]`.
- **Granular per-item CRUD**: each row saves on its own (PUT), deletes on its own (DELETE), and
  "Add FAQ" POSTs — there is no bulk form-array save.
- **Reorder** is drag-and-drop (dnd-kit, copied from `GalleryField` + `SortableGalleryItem`) and
  persists via `PATCH .../faqs/reorder`. Order is stored in the nullable `display_order` column;
  reads return FAQs ordered by `display_order ASC NULLS LAST, created_at ASC` (so the public
  destination/accommodation pages reflect the admin order).
- **Category** is a free string with `FAQ_BASELINE_CATEGORIES` (from `@repo/schemas`) offered as
  `<datalist>` suggestions. **Answer** is plain text (no markdown).
- **Permissions** are enforced server-side by the service `_canUpdate` gate (destinations need
  `DESTINATION_UPDATE`; accommodations allow `UPDATE_ANY` or `UPDATE_OWN` + ownership, so owning
  hosts can manage their own accommodation FAQs). The routes themselves only require admin-panel access.

## Common Gotchas

### Fresh `pnpm install` requires a workspace build before `pnpm dev`

`apps/admin/vite.config.ts` aliases 8 of the ~12 `@repo/*` workspace packages to their `src/` directories. The four packages NOT aliased — `@repo/feedback`, `@repo/auth-ui`, `@repo/billing`, `@repo/notifications` — resolve to their `dist/` outputs per their `exports` field. A fresh checkout has empty `dist/` directories, so SSR fails on the first request with `ERR_MODULE_NOT_FOUND: @repo/feedback/schemas` (or one of the other three) until the packages are built (SPEC-117 A2).

If you see that error after a fresh `pnpm install`, run from the repo root:

```bash
pnpm turbo run build --filter='@repo/feedback' --filter='@repo/auth-ui' --filter='@repo/billing' --filter='@repo/notifications'
```

Workspace packages whose source can be consumed directly via the existing aliases (everything under `resolve.alias` in `vite.config.ts`) do NOT need to be pre-built — Vite picks them up from `src/` and hot-reloads on edit.

### Accepted dev-only console noise

The following warnings appear on every `pnpm dev` startup or page load and are **not defects** — they are upstream third-party recommendations / dev tooling artifacts that do not affect functionality. Do NOT spend time fixing them under this app (SPEC-117 CE-6, CE-8).

- `vite-tsconfig-paths` plugin recommends removal in favor of Vite native support. Out of scope.
- `optimizeDeps.rollupOptions` deprecation hint suggesting `optimizeDeps.rolldownOptions`. Out of scope.
- `@vitejs/plugin-react` recommends switching to `@vitejs/plugin-react-oxc`. Out of scope.
- `Open TanStack Devtools` floating button visible at the bottom-left of every page in dev. Cosmetic only — the button is gated by `env.NODE_ENV === 'development'` and never reaches production builds. Document, do not fix.

### Accepted production-build warnings (`pnpm build`)

`pnpm build` (Vite + Nitro) completes successfully (exit 0). It emits the dev-only
recommendations above (plugin-react / `optimizeDeps.rollupOptions`) once per build
environment, plus the following build-specific warnings. All were reviewed under
BETA-81 and accepted — they are **not defects**. Do NOT "fix" them by swapping to
`@vitejs/plugin-react-oxc` or removing `vite-tsconfig-paths`: those are explicitly
out of scope (SPEC-117 CE-6, CE-8).

- **`Module "crypto" has been externalized for browser compatibility`** (imported by
  `@qazuor/qzpay-mercadopago/dist/index.js`). The MercadoPago SDK is pulled in
  transitively via `@repo/billing` / `@repo/service-core` (aliased to `src/`); no
  admin client code imports it directly. Its `crypto` usage is server-side (MP
  webhook signing) and is never invoked from the browser — Vite stubs it to empty
  in the client bundle. Benign; accepted.
- **`"import.meta" is not available in the configured target environment ("es2019") and will be empty`**
  (Nitro server build, e.g. `components-entity-*.js`). These are all
  `import.meta.env.DEV` debug gates (EntityCreateContent, VirtualizedEntityList,
  FilterSelect, …). In production `import.meta.env.DEV` resolves to falsy, so the
  debug blocks correctly do NOT render. The empty value under Nitro's es2019
  esbuild target is the desired behavior. Cosmetic; accepted.
- **`(!) Some chunks are larger than 500 kB`** — worst case `components-entity`
  (~4 MB), also `lib-utils` (~566 kB). Caused by the `manualChunks` rule
  `id.includes('/components/entity-')` collapsing ~158 entity components + TipTap +
  Leaflet + dnd-kit into one chunk. This is a **runtime load-performance** concern
  only (it does NOT affect test time — Vitest never bundles — and only marginally
  affects build time). Tracked separately for optimization in **BETA-86**; not a
  blocker for BETA-81.

### Vite + `@repo/i18n` SSR cache (hard reload required after JSON edits)

When you edit any `packages/i18n/src/locales/<locale>/<namespace>.json`, the running TanStack Start SSR Node process keeps the **old** flattened `trans` map in memory — HMR only refreshes CSS / TS modules, not JSON imports baked into pre-bundled deps. Symptom: pages render `[MISSING: <key>]` even though the JSON on disk has the new key.

Reliable recovery:

```bash
# In the terminal running `pnpm dev`:
# Ctrl+C — NOT Ctrl+R / HMR
lsof -i :3000   # must be empty before continuing
rm -rf apps/admin/node_modules/.vite
pnpm dev
```

A simple page reload in the browser is not enough; the process itself must restart so the i18n imports re-execute against the new JSON content.

### Feedback FAB position is overridden in `styles.css`

The `@repo/feedback` package raises the FAB to `bottom: 5.5rem` on mobile so it clears `apps/web`'s sticky controls + cookie banner. Admin has neither, so the default left the FAB floating mid-screen on mobile and overlapping textareas on desktop. The admin `apps/admin/src/styles.css` re-anchors the FAB (and its collapsed `minimizedDot` state) to a plain `bottom-right` offset on both viewports (SPEC-117 V-2 / V-4). If you change FAB positioning, do it there — do not edit the package CSS.

## Best Practices

1. **Use nested folder routing** - `entity/index.tsx`, `entity/$id.tsx`, NOT flat `entity.tsx`, `entity.$id.tsx`
2. **Use EntityCreateContent** for ALL create pages - never duplicate form/navigation/error logic
3. **Use EntityPageBase** for view/edit pages with tabs
4. **Use createEntityHooks factory** for standardized CRUD hooks
5. **Use consolidated configs** for section definitions shared across create/edit/view
6. **All API calls go through `/api/v1/admin/*`** - use fetchApi from `@/lib/api/fetch-api`
7. **Use Shadcn components** via `@/components/ui-wrapped/` wrappers
8. **Keep route files thin** - extract logic to features/ and use shared components
9. **Use TypeScript strict mode** - no `any` types (biome enforces this)
10. **Use `useMemo` with whole objects as deps** - not individual properties (biome `useExhaustiveDependencies`)

## Related Documentation

- [Adding Admin Pages](docs/development/creating-pages.md)
- [Dependency Policy](../../docs/guides/dependency-policy.md)
- [Authentication Guide](../../docs/security/authentication.md)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
