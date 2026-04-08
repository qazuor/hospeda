# SPEC-041: Admin Integration Tests

## Metadata

- **ID**: SPEC-041
- **Status**: draft
- **Created**: 2026-03-16
- **Updated**: 2026-03-17
- **Priority**: high
- **Effort**: very large (10-14 días)
- **Owner**: Engineering
- **Relacionado con**: SPEC-022 (Frontend Quality)

---

## Overview

El panel de administración (`apps/admin`) tiene **~112 archivos .tsx** bajo `_authed/` (~96 archivos de ruta + ~16 componentes colocados) y 0 tests de integración que validen los flujos CRUD, las interacciones con la API `/api/v1/admin/*`, el comportamiento de las tablas TanStack Table o los diálogos críticos. Esta especificación define la estrategia, infraestructura y fases de implementación para cubrir ese gap de forma incremental y sostenible.

La infraestructura de testing ya existe y es sólida: MSW está configurado en `test/mocks/`, el setup corre en jsdom, y ya hay mocks de TanStack Router y Better Auth en el setup global. El mock de `@repo/icons` existe pero está duplicado en 3 archivos de test individuales — no está en el setup global. Lo que falta son los tests de las páginas de negocio.

---

## Problem Statement

El admin gestiona datos críticos del negocio (alojamientos, destinos, eventos, planes de billing, usuarios, sponsors). Un bug en un flujo CRUD — por ejemplo, un campo que no se envía en el create, o un diálogo que crashea al editar — solo se detecta manualmente. Esto genera:

1. **Riesgo de regresiones silenciosas**: cualquier cambio en `EntityCreateContent`, `EntityPageBase` o `createEntityHooks` puede romper múltiples páginas sin que los tests lo detecten.
2. **Sin validación de integración API**: los handlers MSW existentes usan `/api/v1/public/*` — los endpoints `/api/v1/admin/*` no tienen cobertura.
3. **Cero tests de comportamiento de tablas**: sort, filtrado, paginación y acciones de fila son flujos sin validar.
4. **Diálogos críticos sin tests**: `PlanDialog`, diálogos de promo-codes, sponsorships, invoices — todos con lógica de formulario compleja y sin un solo test.

---

## Current State

### Páginas existentes sin tests de integración (conteo real: ~112 archivos .tsx — ~96 rutas + ~16 componentes colocados)

**Módulo: Accommodations** (8 rutas + 1 componente)
- `accommodations/index.tsx` — lista con tabla, filtros
- `accommodations/new.tsx` — create con EntityCreateContent
- `accommodations/$id.tsx` — view con tabs
- `accommodations/$id_.edit.tsx` — edit con EntityFormSection
- `accommodations/$id_.amenities.tsx` — gestión de amenities
- `accommodations/$id_.gallery.tsx` — gestión de galería
- `accommodations/$id_.pricing.tsx` — pricing
- `accommodations/$id_.reviews.tsx` — reviews
- `accommodations/pricing-components.tsx` — componente auxiliar (no es ruta)

**Módulo: Destinations** (7 rutas)
- `destinations/index.tsx`
- `destinations/new.tsx`
- `destinations/$id.tsx`
- `destinations/$id_.edit.tsx`
- `destinations/$id_.accommodations.tsx`
- `destinations/$id_.attractions.tsx`
- `destinations/$id_.events.tsx`

**Módulo: Events** (17 rutas: 6 principales + 5 locations + 6 organizers)
- `events/index.tsx`
- `events/new.tsx`
- `events/$id.tsx`
- `events/$id_.edit.tsx`
- `events/$id_.attendees.tsx`
- `events/$id_.tickets.tsx`
- `events/locations/index.tsx`, `new.tsx`, `$id.tsx`, `$id_.edit.tsx`, `$id_.events.tsx` (5 rutas)
- `events/organizers/index.tsx`, `new.tsx`, `$id.tsx`, `$id_.edit.tsx`, `$id_.events.tsx`, `$id_.contact.tsx` (6 rutas)

**Módulo: Content** (12 rutas)
- `content/accommodation-amenities/index.tsx`, `new.tsx`, `$id.tsx`, `$id_.edit.tsx`
- `content/accommodation-features/index.tsx`, `new.tsx`, `$id.tsx`, `$id_.edit.tsx`
- `content/destination-attractions/index.tsx`, `new.tsx`, `$id.tsx`, `$id_.edit.tsx`

**Módulo: Billing** (14 rutas + 10 componentes en `billing/components/`)
- `billing/plans.tsx` — tabla de planes + `PlanDialog` (create/edit)
- `billing/addons.tsx` — tabla de addons + diálogos
- `billing/subscriptions.tsx`
- `billing/invoices.tsx`
- `billing/payments.tsx`
- `billing/promo-codes.tsx`
- `billing/owner-promotions.tsx`
- `billing/sponsorships.tsx` — con tabs (Levels, Packages, Sponsorships)
- `billing/webhook-events.tsx`
- `billing/notification-logs.tsx`
- `billing/exchange-rates.tsx`
- `billing/metrics.tsx`
- `billing/cron.tsx`
- `billing/settings.tsx`
- Componentes (NO son rutas): `billing/components/InvoiceDetailDialog.tsx`, `PromoCodeFormDialog.tsx`, `PromoCodeDeleteDialog.tsx`, `PromotionFormDialog.tsx`, `PromotionDetailDialog.tsx`, `WebhookEventDetailDialog.tsx`, `NotificationDetailDialog.tsx`, y otros auxiliares

**Módulo: Access** (8 rutas)
- `access/users/index.tsx`
- `access/users/new.tsx`
- `access/users/$id.tsx`
- `access/users/$id_.edit.tsx`
- `access/users/$id_.activity.tsx`
- `access/users/$id_.permissions.tsx`
- `access/roles.tsx`
- `access/permissions.tsx`

**Módulo: Sponsors** (4 rutas admin + 4 rutas sponsor dashboard)
- `sponsors/index.tsx`, `sponsors/new.tsx`, `sponsors/$id.tsx`, `sponsors/$id_.edit.tsx`
- `sponsor/index.tsx` (dashboard de sponsor), `sponsor/invoices.tsx`, `sponsor/analytics.tsx`, `sponsor/sponsorships.tsx`

**Módulo: Posts** (6 rutas)
- `posts/index.tsx`, `posts/new.tsx`, `posts/$id.tsx`, `posts/$id_.edit.tsx`, `posts/$id_.seo.tsx`, `posts/$id_.sponsorship.tsx`

**Módulo: Settings** (6 rutas)
- `settings/tags/index.tsx`, `settings/tags/new.tsx`, `settings/tags/$id.tsx`, `settings/tags/$id_.edit.tsx`
- `settings/critical.tsx`
- `settings/seo.tsx`

**Módulo: Dashboard / Analytics** (4+ rutas)
- `dashboard.tsx` — estructura de ruta (delega a `dashboard.lazy.tsx`)
- `dashboard.lazy.tsx` — componente real con métricas (IMPORTANTE: el componente vive aquí, no en `dashboard.tsx`)
- `analytics/business.tsx`, `analytics/usage.tsx`, `analytics/debug.tsx`

**Módulo: Me** (4 rutas + 2 archivos de componentes)
- `me/profile.tsx`
- `me/settings.tsx`
- `me/change-password.tsx`
- `me/accommodations/index.tsx`
- Componentes auxiliares: `me/password-strength-components.tsx`, `me/profile-components.tsx` (no son rutas)

**Módulo: Revalidation** (1 ruta + 2 componentes)
- `revalidation/index.tsx`
- `revalidation/components/LogsTab.tsx` (componente, no ruta)
- `revalidation/components/revalidation-shared.tsx` (componente, no ruta)

**Módulo: Notifications** (1 ruta)
- `notifications.tsx`

**Total: ~112 archivos .tsx bajo `_authed/` (~96 rutas + ~16 componentes colocados), 0 tests de integración de páginas.**

---

### Tests existentes (qué SÍ se testea)

La infraestructura de testing es buena. Lo que existe:

| Área | Tests existentes | Estado |
|------|-----------------|--------|
| Infraestructura MSW | `test/mocks/handlers.ts`, `test/mocks/server.ts` | ✅ Funcional |
| Navegación | `test/integration/navigation.test.tsx` | ✅ Header + Sidebar |
| Rutas anidadas | `test/routes/nested-routes.test.tsx` | ✅ Layout persistence |
| Layout components | `test/components/layout/Header.test.tsx`, `Sidebar.test.tsx`, `PageTabs.test.tsx` | ✅ |
| Auth components | `test/components/auth/PermissionGate.test.tsx`, `RoutePermissionGuard.test.tsx` | ✅ |
| Entity hooks | `test/components/entity-list/useEntityQuery.test.tsx` | ✅ |
| Entity API factory | `test/components/entity-list/createEntityApi.test.ts` | ✅ |
| Lib: sections | `test/lib/sections/` (use-section, registry, helpers, permissions) | ✅ |
| Lib: errors | `test/lib/errors/` (api-error, error-reporter, toast-error, parse-api-validation-errors) | ✅ |
| Lib: table-persistence | `test/lib/table-persistence.test.ts` | ✅ |
| Lib: billing adapter | `test/lib/billing-http-adapter.test.ts` | ✅ |
| Hooks | `test/hooks/use-user-permissions.test.tsx`, `use-translations.test.tsx` | ✅ |
| Contexts | `test/contexts/sidebar-context.test.tsx` | ✅ |
| Examples | `test/examples/api-mocking.test.ts`, `component-testing.test.tsx`, `hooks-testing.test.tsx` | ✅ Referencia |
| Integration: QZPay | `test/integration/qzpay-provider.test.tsx` | ✅ |
| Forms: Zod validation | `test/components/entity-form/zod-validation.test.ts`, `field-validation.test.ts` | ✅ |
| Auth: Impersonation | `test/components/auth/impersonation-banner.test.tsx` | ✅ |
| Feedback components | `test/components/feedback/ComingSoon.test.tsx`, `EmptyState.test.tsx` | ✅ |
| Error boundaries | `test/lib/error-boundaries/GlobalErrorBoundary.test.tsx` | ✅ |
| CSP helpers | `test/lib/csp-helpers.test.ts` | ✅ |
| QZPay theme | `test/lib/qzpay-theme.test.ts` | ✅ |
| i18n static | `test/lib/i18n/static-translations.test.ts` | ✅ |
| Form validation | `test/lib/validation/validate-form.test.ts` | ✅ |
| Root route | `test/routes/__root.test.tsx` | ✅ |
| Header user | `test/integrations/header-user.test.tsx` | ✅ |
| Basic + env | `test/basic.test.tsx`, `test/env.test.ts`, `test/accommodation-consolidated.test.ts` | ✅ |

**Lo que NO existe**: tests de ninguna página concreta en `_authed/`, tests de diálogos de negocio, tests de flujos CRUD end-to-end contra `/api/v1/admin/*`.

---

## Existing Test Infrastructure

Esta sección documenta EXACTAMENTE lo que ya está configurado en `test/setup.tsx` para que los tests nuevos no lo recreen ni lo rompan.

### Better Auth Mock (configurado globalmente)

```typescript
// En test/setup.tsx — ya activo en TODOS los tests
// Mock de sesión con usuario autenticado.
// Shape completo de mockSession.user:
// {
//   id: 'test_user_id',
//   name: 'Test User',
//   email: 'test@example.com',
//   role: 'USER',
//   emailVerified: true,
//   image: null,
//   createdAt: new Date(),
//   updatedAt: new Date(),
// }

// Provee estos hooks/métodos:
// - useSession() → { data: mockSession, isPending: false, error: null }
// - signIn.email(credentials) → mock function
// - signUp.email(data) → mock function
// - signOut() → mock function
// - getSession() → mock function

// Shape completo de mockSession:
// {
//   user: { id, name, email, role, emailVerified, image, createdAt, updatedAt },
//   session: { id: 'session_id', userId: 'test_user_id', ... }
// }
```

Los tests de páginas admin NO necesitan mockear auth — ya viene configurado. Si un test necesita un rol diferente (por ejemplo, para probar `PermissionGate`), debe sobrescribir localmente con `vi.mocked(useSession).mockReturnValue(...)`.

### TanStack Router Mock (configurado globalmente)

```typescript
// En test/setup.tsx — ya activo en TODOS los tests
// Provee:
// - Link: renderiza como <a href={to}>{children}</a>
// - useRouter() → { navigate: vi.fn() }
// - useNavigate() → vi.fn()
// - createRouter, createRoute, createRootRoute → mocks básicos
// - Outlet → () => null
```

Los tests que necesiten params específicos (ej: `useParams` retornando `{ id: 'test-id-123' }`) deben sobreescribir localmente con `vi.mock('@tanstack/react-router', ...)` dentro del test file o `beforeEach`.

### MSW Server (configurado globalmente)

```typescript
// En test/setup.tsx y test/mocks/server.ts:
// - server.listen({ onUnhandledRequest: 'warn' })  → en beforeAll
// - server.resetHandlers()  → en afterEach  (limpia overrides por test)
// - server.close()  → en afterAll
// - cleanup()  → en afterEach  (limpia DOM de React Testing Library)
// - vi.clearAllMocks()  → en afterEach
```

Cuando un test usa `server.use(...)` para agregar handlers temporales, estos se limpian automáticamente en el `afterEach` global. No hace falta llamar `server.resetHandlers()` dentro de cada test.

### API_BASE Constant

```typescript
// Definida en test/mocks/handlers.ts (actualmente NO exportada — debe exportarse en Phase 1):
const API_BASE = '/api/v1';

// Todos los handlers usan esta constante. Ejemplo:
// http.get(`${API_BASE}/admin/accommodations`, handler)
// Después de exportarla (Phase 1, tarea 6), importar en nuevos archivos:
// import { API_BASE } from './handlers';
```

### Response Factory Functions (en `test/mocks/handlers.ts`)

```typescript
/**
 * Genera una respuesta paginada estándar para endpoints de lista.
 * Usar para: GET /api/v1/admin/{entity} (la mayoría de los endpoints de lista)
 */
function mockPaginatedResponse<T>(items: T[], page = 1, pageSize = 20) {
    return {
        success: true,
        data: {
            items,
            pagination: {
                page,
                pageSize,
                total: items.length,
                totalPages: Math.ceil(items.length / pageSize),
                hasNextPage: page * pageSize < items.length,
                hasPreviousPage: page > 1,
            },
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: 'test-request-id',
        },
    };
}

/**
 * Genera una respuesta de éxito simple (no paginada).
 * Usar para: GET /api/v1/admin/{entity}/:id, POST, PATCH, DELETE
 */
function mockSuccessResponse<T>(data: T) {
    return {
        success: true,
        data,
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: 'test-request-id',
        },
    };
}

/**
 * Genera una respuesta de error estándar.
 * Usar para: cualquier endpoint que devuelva error.
 */
function mockErrorResponse(code: string, message: string) {
    return {
        success: false,
        error: {
            code,
            message,
            details: null,
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: 'test-request-id',
        },
    };
}
```

**IMPORTANTE**: Estas funciones deben exportarse desde `test/mocks/handlers.ts` para que los nuevos archivos `admin-handlers.ts` y los tests las puedan importar.

### Response Format: Endpoints NO paginados

No todos los endpoints admin retornan respuestas paginadas. Los handlers MSW deben respetar los formatos reales:

| Endpoint | Formato de respuesta |
|----------|---------------------|
| `GET /api/v1/admin/billing/plans` | `{ success: true, data: BillingPlan[] }` — array directo, **sin** objeto `pagination` |
| `GET /api/v1/admin/cron` | `{ success: true, data: { jobs: CronJob[], totalJobs: number, enabledJobs: number } }` |
| `GET /api/v1/admin/billing/metrics` | Formato custom con métricas de negocio (ver fixtures) |
| `GET /api/v1/admin/billing/exchange-rates/*` | Formato custom con tasas de cambio |
| `GET /api/v1/admin/{entity}` (mayoría) | `mockPaginatedResponse(items)` — paginado estándar |

Usar `mockSuccessResponse(arrayDirecto)` para los endpoints no paginados, **no** `mockPaginatedResponse`.

---

## Scope

### In Scope (Phase 1 — infraestructura)

Ampliar la infraestructura existente para soportar tests de páginas admin:
- Fixtures por entidad en `test/fixtures/`
- Handlers MSW para todos los endpoints `/api/v1/admin/*`
- Helpers de render y query client
- Mocks adicionales requeridos (icons, i18n, guards)

### In Scope (Phase 2 — smoke-first)

Tests que verifican que cada página carga sin crashear. No validan comportamiento complejo, solo que el render no lanza excepciones con datos mockeados correctos.

- Todas las páginas (`index.tsx`, `$id.tsx`, `new.tsx`, `$id_.edit.tsx`) de los 8 módulos principales (~96 rutas + ~16 colocated components = ~112 archivos)
- Dashboard + Analytics
- Me, Notifications, Revalidation

### In Scope (Phase 3 — functional CRUD)

Tests de comportamiento real en entidades de alto riesgo:
- Flujos CRUD completos: create → validación → submit → éxito/error
- Estados de error: 404, 500, red caída (MSW error responses)
- Estados de loading: spinners, botones disabled durante submit

### In Scope (Phase 4 — table interactions)

- Interacciones de tabla: sort de columna, filtro por texto, cambio de página, tamaño de página
- Acciones de fila: edit, delete, restore

### In Scope (Phase 5 — dialogs)

- Apertura, llenado de campos, submit, cancelación de diálogos críticos
- `PlanDialog`, `PromoCodeFormDialog`, `PromotionFormDialog`, `InvoiceDetailDialog`, `WebhookEventDetailDialog`, `NotificationDetailDialog`

### Out of Scope

- Tests E2E con browser real (responsabilidad de Playwright, fuera de este spec)
- Tests de la API (`apps/api/`) — tiene su propio suite
- Tests de lógica de negocio ya cubierta en service-core
- Screenshots o visual regression testing
- Tests de performance

---

## Mocks Required for Page Tests

Además de los mocks globales en `test/setup.tsx`, los tests de páginas necesitan estos mocks adicionales. Algunos pueden agregarse al setup global; otros se aplican por test file.

### 1. `@repo/icons` Mock (agregar al setup global)

Las páginas admin usan decenas de iconos distintos de `@repo/icons`. Mockearlos individualmente es inviable. La estrategia es un Proxy que retorna un stub para cualquier nombre de componente:

```typescript
// En test/setup.tsx — agregar al bloque de vi.mock existente:
vi.mock('@repo/icons', () => new Proxy({}, {
    get: (_target, prop) => {
        if (typeof prop === 'string' && prop !== '__esModule') {
            // Retorna un functional component stub para cualquier icono
            return (props: Record<string, unknown>) => (
                <span data-testid={`icon-${prop}`} aria-hidden="true" {...props} />
            );
        }
        return undefined;
    }
}));
```

### 2. `@/hooks/use-translations` Mock (agregar al setup global)

Las páginas usan el hook de traducciones para todos los textos. En tests, retornar la key tal cual permite usar `getByText('billing.plans.title')` o similar:

```typescript
// En test/setup.tsx:
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string, _count: number) => key,
        locale: 'es',
    }),
}));
```

**Nota**: Ya existe `test/hooks/use-translations.test.tsx` que testea el hook real. Este mock es para los tests de páginas que usan el hook como dependencia. The real hook returns `{ t, tPlural, locale }` — not `{ t, i18n }`.

**IMPORTANTE — Translation Key Matching**: Since the `useTranslations` mock returns the key itself (not translated text), ALL test assertions must match against translation keys, not user-visible text. For example:
- Instead of: `screen.getByRole('button', { name: /Create/i })`
- Use: `screen.getByRole('button', { name: /createButton/i })` or match the full key like `admin-billing.plans.dialog.createButton`
- `getByText('billing.plans.title')` will match the key string directly
- For buttons and labels, use partial key matches like `/createButton/i` or `/cancelButton/i`
- This applies to ALL test examples in this spec

### 3. `@qazuor/qzpay-react` Mock (LimitGate, EntitlementGate) (por test file o setup global)

Algunas páginas de create envuelven el formulario en `LimitGate` que verifica si el usuario alcanzó el límite del plan. `LimitGate` viene de `@qazuor/qzpay-react`, no es un componente local. En tests siempre debe renderizar el contenido:

```typescript
// Agregar a test/setup.tsx o localmente por test:
vi.mock('@qazuor/qzpay-react', () => ({
    LimitGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    LimitReachedUI: () => <div data-testid="limit-reached" />,
    EntitlementGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useEntitlements: () => ({ check: () => true, isLoading: false }),
    QZPayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

### 4. `RoutePermissionGuard` Mock (por test file o setup global)

Las páginas de create y edit envuelven su contenido en `RoutePermissionGuard`. En tests siempre renderizar children:

```typescript
// Agregar a test/setup.tsx o localmente por test:
vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

**Razonamiento**: `RoutePermissionGuard` ya tiene sus propios tests en `test/components/auth/RoutePermissionGuard.test.tsx`. En tests de páginas no interesa testear el guard — interesa testear el contenido de la página.

### 5. `useAuthContext` Mock (agregar al setup global o por test file)

11 files use `useAuthContext` (profile, settings, accommodations, etc.). It must be mocked for page tests:

```typescript
// Add to test/setup.tsx or per-test:
vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({
        user: {
            id: 'test_user_id',
            name: 'Test User',
            email: 'test@example.com',
            role: 'ADMIN',
        },
        isAuthenticated: true,
        isLoading: false,
    }),
}));
```

For tests that need a different user role (e.g., OWNER, USER), override locally with `vi.mocked(useAuthContext).mockReturnValue(...)`.

### 6. Radix UI PointerEvent Polyfill (REQUERIDO — agregar al setup global)

JSDOM no implementa `PointerEvent`, y Radix UI Select/Popover/Dialog usan internamente `pointerdown`/`pointerup` events. Sin este polyfill, los Selects no se abren y los tests que interactúan con Radix Select fallan silenciosamente.

Referencia: [Radix UI issue #1822](https://github.com/radix-ui/primitives/issues/1822)

```typescript
// En test/setup.tsx — agregar ANTES de los vi.mock():
class MockPointerEvent extends Event {
    readonly button: number;
    readonly ctrlKey: boolean;
    readonly pointerType: string;

    constructor(type: string, props: PointerEventInit = {}) {
        super(type, props);
        this.button = props.button ?? 0;
        this.ctrlKey = props.ctrlKey ?? false;
        this.pointerType = props.pointerType ?? 'mouse';
    }
}

// biome-ignore lint/suspicious/noExplicitAny: necesario para polyfill en JSDOM
window.PointerEvent = MockPointerEvent as any;

// También necesario para que Radix detecte pointer support:
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
```

---

## Component Import Strategy

Las páginas admin son archivos de ruta de TanStack Start. El componente de la página está declarado dentro de `createFileRoute(path)(options)` como `options.component`. No es un named export directo en la mayoría de los casos.

### Approach A — Mock `createFileRoute` (RECOMENDADO para smoke tests y unit tests)

Este approach intercepta la llamada a `createFileRoute` para exponer el componente y los hooks de la ruta de forma testeable:

```typescript
// En el test file (ANTES del import del módulo de ruta):
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to}>{children}</a>
    ),
    useRouter: () => ({ navigate: vi.fn() }),
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    createFileRoute: (_path: string) => (routeOptions: {
        component: React.ComponentType;
        [key: string]: unknown;
    }) => ({
        options: routeOptions,
        useLoaderData: vi.fn(),
        useSearch: vi.fn(() => ({ page: 1, pageSize: 20 })),
        useParams: vi.fn(() => ({})),
    }),
    Outlet: () => null,
}));

// Luego importar el módulo de la ruta:
import { Route } from '@/routes/_authed/billing/plans';

// Acceder al componente:
const BillingPlansPage = Route.options.component;

// Para rutas con params, configurar el mock de useParams:
import { useParams } from '@tanstack/react-router';
vi.mocked(useParams).mockReturnValue({ id: 'test-accommodation-id-123' });
```

### Approach B — Named Export (PREFERIDO a largo plazo)

Si el archivo de ruta exporta el componente como named export:

```typescript
// Si el route file tiene:
export function AccommodationsPage() { ... }
// Entonces en el test:
import { AccommodationsPage } from '@/routes/_authed/accommodations/index';
```

Actualmente no todos los route files siguen este patrón. Para los que no lo tienen, usar Approach A.

### Caso especial: `dashboard.lazy.tsx`

La ruta `dashboard.tsx` usa lazy loading via `createLazyFileRoute` and the real component lives in `dashboard.lazy.tsx`. Para tests, importar directamente desde el archivo lazy:

```typescript
import { Route as DashboardRoute } from '@/routes/_authed/dashboard.lazy';
const DashboardPage = DashboardRoute.options.component;
```

The `createFileRoute` mock must also include `createLazyFileRoute` for the dashboard to import correctly:

```typescript
// Add to the createFileRoute mock block:
createLazyFileRoute: (_path: string) => (routeOptions: {
    component: React.ComponentType;
    pendingComponent?: React.ComponentType;
    [key: string]: unknown;
}) => ({
    options: routeOptions,
}),
```

### Feature Config Delegation Pattern

Many LIST routes are thin 11-line wrappers that delegate to feature configs:

```typescript
// accommodations/index.tsx — only 11 lines
import { AccommodationsRoute } from '@/features/accommodations/config/accommodations.config';
export const Route = AccommodationsRoute;
```

For these delegated routes:
- The component is NOT inline in the route file — it comes from the feature config in `features/<entity>/config/`
- Import the `Route` from the feature config, not the route file, when testing the component directly
- The route file itself only re-exports, so smoke-testing via the route file import is fine (it uses the same `Route` object)

Example test for a delegated route:

```typescript
// The route file just re-exports, so either import works:
import { Route } from '@/routes/_authed/accommodations/index';
// OR import directly from the feature config:
import { AccommodationsRoute } from '@/features/accommodations/config/accommodations.config';

const AccommodationsPage = Route.options.component;
// Both give the same component
```

---

## fetchApi Behavior

Documentación de cómo funciona `fetchApi` para que los handlers MSW sean correctos.

```typescript
// Ubicación: apps/admin/src/lib/api/client.ts

// Signatura conceptual:
fetchApi<T>({
    path: string;        // Ej: '/api/v1/admin/accommodations'
    method?: string;     // Default: 'GET'
    headers?: Record<string, string>;
    body?: unknown;      // Se serializa a JSON automáticamente
    signal?: AbortSignal;
}): Promise<{ data: T; status: number }>

// Comportamiento:
// - Autenticación: credentials: 'include' (usa cookies de sesión). NO envía header Authorization.
// - Base URL: Lee VITE_API_URL del env. En tests, si no está definido, hace request al path relativo.
// - Content-Type: Setea 'application/json' automáticamente cuando hay body.
// - Errores: Lanza ApiError para respuestas non-2xx. ApiError tiene { code, message, status, details }.

// Para MSW: Los handlers interceptan por path relativo (ej: '/api/v1/admin/accommodations').
// MSW en modo node intercepta fetch calls incluyendo las relativas.
// IMPORTANTE: No incluir el origen (http://localhost:3001) en los handlers — usar paths relativos.
```

---

## Test Infrastructure Setup

### Decisión: MSW vs vitest mocks para API mocking

**Veredicto: MSW (ya instalado y configurado). NO usar `vi.mock` para API calls.**

**Justificación:**

Los handlers MSW ya existen en `test/mocks/handlers.ts` con `setupServer` de `msw/node`. El archivo `test/setup.tsx` ya arranca el servidor en `beforeAll`. La infraestructura está lista.

`vi.mock('fetchApi')` o `vi.mock('@/lib/api/fetch-api')` es una alternativa válida pero inferior en este caso porque:

1. **MSW intercepta a nivel de red** — los componentes usan `fetchApi` que llama a `fetch` nativo. MSW intercepta ese `fetch` sin necesidad de saber qué módulo lo llama. Con `vi.mock` hay que mockear el módulo correcto en cada test.
2. **Los handlers son reutilizables** — se definen una vez en `handlers.ts` y cualquier test puede usar `server.use(...)` para sobrescribir en casos específicos. Con `vi.mock` cada test recrea los mocks.
3. **Los ejemplos existentes** (`test/examples/api-mocking.test.ts`) ya demuestran el patrón MSW con override por test — consistencia con la codebase.
4. **Mejor cobertura de errores de red** — MSW puede simular `HttpResponse.error()` para network failure, que es difícil con `vi.mock`.

El único caso donde se usará `vi.mock` es para módulos que no son HTTP: `@tanstack/react-router`, `better-auth/react`, `@repo/icons`, `@repo/i18n` — que ya están mockeados en `test/setup.tsx`.

### Handlers MSW faltantes para `/api/v1/admin/*`

Los handlers actuales en `test/mocks/handlers.ts` solo cubren `/api/v1/public/*`. Hay que agregar handlers para los endpoints admin. Se creará `test/mocks/admin-handlers.ts`.

#### HTTP Verbs por entidad

Cada entidad admin expone este conjunto estándar de endpoints:

```
GET    /api/v1/admin/{entity}              → lista paginada (mockPaginatedResponse)
GET    /api/v1/admin/{entity}/:id          → item individual (mockSuccessResponse)
POST   /api/v1/admin/{entity}              → create → 201
PUT    /api/v1/admin/{entity}/:id          → update completo → 200
PATCH  /api/v1/admin/{entity}/:id          → update parcial → 200
DELETE /api/v1/admin/{entity}/:id          → soft delete → 200 o 204
POST   /api/v1/admin/{entity}/:id/restore  → restaurar soft-deleted → 200
POST   /api/v1/admin/{entity}/:id/hard-delete → borrado permanente → 204
```

No todas las entidades implementan todos los verbs. Los handlers default deben cubrir los más comunes (GET list, GET by id, POST, PATCH, DELETE).

#### Entidades a cubrir en `admin-handlers.ts`

```typescript
// Entidades con paginación estándar:
// accommodations, destinations, events, event-locations, event-organizers
// accommodation-amenities, accommodation-features, destination-attractions
// sponsors, posts, tags, users
// billing/subscriptions, billing/invoices, billing/payments
// billing/promo-codes, billing/owner-promotions, billing/sponsorships
// billing/webhook-events, billing/notification-logs

// Entidades con formato NO paginado (requieren handlers custom):
// billing/plans          → { success: true, data: BillingPlan[] }
// billing/addons         → { success: true, data: BillingAddon[] }
// billing/cron           → { success: true, data: { jobs, totalJobs, enabledJobs } }
// billing/metrics        → { success: true, data: MetricsData }
// billing/exchange-rates → { success: true, data: ExchangeRatesData }
// roles, permissions     → { success: true, data: Role[] / Permission[] }
```

### TanStack Router mock strategy

El mock de `@tanstack/react-router` en `test/setup.tsx` es global y básico. Para tests de páginas específicas que usen `useParams`, `useSearch`, `useNavigate` o `Link`, se sobrescribirá localmente con `vi.mock` dentro del test:

```typescript
vi.mock('@tanstack/react-router', () => ({
    ...baseRouterMock,
    useParams: () => ({ id: 'test-id-123' }),
    useSearch: () => ({ page: 1, pageSize: 20 }),
}));
```

Para tests que validen navegación post-submit, se capturará la función `navigate`:

```typescript
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
    // ...
}));
// Luego: expect(mockNavigate).toHaveBeenCalledWith({ to: '/accommodations' });
```

### TanStack Query mock strategy

Se usará `QueryClientProvider` real con un `QueryClient` de test (sin retry, sin staleTime). NO se mockea `@tanstack/react-query` globalmente — los hooks usan MSW para las llamadas HTTP y el QueryClient real para el cache.

```typescript
// test/helpers/create-test-query-client.ts
export function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                // gcTime: Infinity prevents "Jest/Vitest did not exit one second after the test run completed"
                // errors caused by pending garbage collection timers. Documented in the TanStack Query v5
                // testing guide as the recommended configuration for test QueryClient instances.
                gcTime: Infinity,
            },
            mutations: { retry: false },
        },
    });
}
```

### `render-with-providers` Helper

```typescript
// test/helpers/render-with-providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import type { ReactNode } from 'react';

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                // gcTime: Infinity prevents "Jest/Vitest did not exit one second after the test run completed"
                // errors caused by pending garbage collection timers. Documented in the TanStack Query v5
                // testing guide as the recommended configuration for test QueryClient instances.
                gcTime: Infinity,
            },
            mutations: { retry: false },
        },
    });
}

interface WrapperProps {
    readonly children: ReactNode;
}

export function renderWithProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) {
    const queryClient = createTestQueryClient();

    function Wrapper({ children }: WrapperProps) {
        return (
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </QueryClientProvider>
        );
    }

    return {
        ...render(ui, { wrapper: Wrapper, ...options }),
        queryClient,
    };
}
```

**IMPORTANTE**: `ToastProvider` is REQUIRED in the test wrapper. The `__root.tsx` wraps everything in `<ToastProvider>` and many pages call `addToast()` for success/error feedback. Without it, CRUD tests will fail with missing context errors.

### Test fixtures strategy

Se centralizarán los fixtures en `test/fixtures/` por entidad:

```
test/fixtures/
├── accommodation.fixture.ts
├── destination.fixture.ts
├── event.fixture.ts
├── billing-plan.fixture.ts
├── billing-addon.fixture.ts
├── billing-subscription.fixture.ts
├── billing-invoice.fixture.ts
├── promo-code.fixture.ts
├── owner-promotion.fixture.ts
├── sponsorship.fixture.ts
├── webhook-event.fixture.ts
├── notification-log.fixture.ts
├── user.fixture.ts
├── role.fixture.ts
├── tag.fixture.ts
├── post.fixture.ts
├── sponsor.fixture.ts
└── index.ts       ← re-exporta todo
```

Cada fixture exporta:
- `mock{Entity}` — objeto individual mínimo válido
- `mock{Entity}List` — array de 3 items para listas
- `mock{Entity}Page` — respuesta paginada completa (para handlers MSW)

Los fixtures deben derivarse de los Zod schemas en `@repo/schemas` para garantizar compatibilidad con los tipos reales.

### `waitForLoadingToFinish` Helper

```typescript
// test/helpers/wait-for-loading.ts
import { waitFor } from '@testing-library/react';

/**
 * Espera a que los indicadores de carga desaparezcan.
 * El admin usa Skeleton components y loading states de TanStack Query.
 * Usar en smoke tests y tests de integración después de render().
 */
export async function waitForLoadingToFinish() {
    await waitFor(
        () => {
            const skeletons = document.querySelectorAll(
                '[data-loading="true"], .animate-pulse, [role="status"][aria-label*="loading"]'
            );
            expect(skeletons.length).toBe(0);
        },
        { timeout: 5000 }
    );
}
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup (3-4 días)

**Objetivo**: Ampliar la infraestructura existente para soportar tests de páginas admin.

**Tareas detalladas:**

1. **Agregar mocks faltantes a `test/setup.tsx`**:
   - Proxy mock de `@repo/icons`
   - Mock de `@/hooks/use-translations` (returns `{ t, tPlural, locale }`)
   - Mock de `@qazuor/qzpay-react` (LimitGate, EntitlementGate)
   - Mock de `@/components/auth/RoutePermissionGuard`
   - Mock de `@/hooks/use-auth-context` (useAuthContext)
   - `createLazyFileRoute` mock for dashboard lazy route

2. **Crear `test/fixtures/` con fixtures por entidad**:
   - 17 archivos de fixture (ver lista arriba)
   - Migrar fixtures existentes desde `handlers.ts` al nuevo formato
   - Derivar shapes de los schemas Zod en `@repo/schemas`

3. **Crear `test/mocks/admin-handlers.ts`**:
   - Handlers para ~20 entidades admin
   - Respetar formatos paginados vs no paginados
   - Usar fixtures centralizados
   - Exportar función `getAdminHandlers()` que retorna el array de handlers

4. **Actualizar `test/mocks/server.ts`**:
   - Importar `getAdminHandlers()` desde `admin-handlers.ts`
   - Incluirlos en el `setupServer()`

5. **Crear helpers de testing**:
   - `test/helpers/render-with-providers.tsx`
   - `test/helpers/create-test-query-client.ts`
   - `test/helpers/wait-for-loading.ts`

6. **Exportar factories de respuesta desde `handlers.ts`**:
   - `mockPaginatedResponse`, `mockSuccessResponse`, `mockErrorResponse` deben ser exports nombrados para que `admin-handlers.ts` los pueda importar.

**Archivos a crear:**

```
test/fixtures/accommodation.fixture.ts
test/fixtures/destination.fixture.ts
test/fixtures/event.fixture.ts
test/fixtures/billing-plan.fixture.ts
test/fixtures/billing-addon.fixture.ts
test/fixtures/billing-subscription.fixture.ts
test/fixtures/billing-invoice.fixture.ts
test/fixtures/promo-code.fixture.ts
test/fixtures/owner-promotion.fixture.ts
test/fixtures/sponsorship.fixture.ts
test/fixtures/webhook-event.fixture.ts
test/fixtures/notification-log.fixture.ts
test/fixtures/user.fixture.ts
test/fixtures/role.fixture.ts
test/fixtures/tag.fixture.ts
test/fixtures/post.fixture.ts
test/fixtures/sponsor.fixture.ts
test/fixtures/index.ts
test/mocks/admin-handlers.ts
test/helpers/render-with-providers.tsx
test/helpers/create-test-query-client.ts
test/helpers/wait-for-loading.ts
```

**Archivos a modificar:**

```
test/setup.tsx   ← agregar 6 mocks nuevos (icons, translations, qzpay, guard, auth-context, lazy-route)
test/mocks/handlers.ts  ← exportar mockPaginatedResponse, mockSuccessResponse, mockErrorResponse
test/mocks/server.ts    ← importar admin-handlers
```

### Phase 2: Smoke Tests — pages load without crashes (2 días)

**Objetivo**: Verificar que cada una de las ~96 rutas (de ~112 archivos .tsx totales) renderiza sin lanzar excepciones cuando recibe datos válidos de MSW.

**Estrategia**: Un test por página, con assertion significativa (no `expect(document.body).toBeTruthy()`):

```typescript
// test/smoke/accommodations.smoke.test.tsx

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// Mock de rutas ANTES de importar el módulo de ruta
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to}>{children}</a>
    ),
    useRouter: () => ({ navigate: vi.fn() }),
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    createFileRoute: (_path: string) => (options: { component: React.ComponentType }) => ({
        options,
        useSearch: vi.fn(() => ({ page: 1, pageSize: 20 })),
        useParams: vi.fn(() => ({})),
    }),
    Outlet: () => null,
}));

import { Route as AccommodationsRoute } from '@/routes/_authed/accommodations/index';

describe('Accommodations smoke tests', () => {
    it('renders accommodations list page without crashing', async () => {
        const user = userEvent.setup();
        const AccommodationsPage = AccommodationsRoute.options.component;

        renderWithProviders(<AccommodationsPage />);

        // Esperar a que cargue la data (MSW responde con mock data)
        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        }, { timeout: 5000 });

        // Verificar que la página renderizó contenido significativo
        // (tabla, heading, o cualquier elemento que indique render exitoso)
        expect(screen.getByRole('table')).toBeInTheDocument();
    });
});
```

**Archivos a crear (uno por módulo, con todos los smoke tests del módulo dentro):**

```
test/smoke/accommodations.smoke.test.tsx   ← 8 rutas del módulo
test/smoke/destinations.smoke.test.tsx     ← 7 rutas
test/smoke/events.smoke.test.tsx           ← 17 rutas (events + locations + organizers)
test/smoke/content.smoke.test.tsx          ← 12 rutas (amenities, features, attractions)
test/smoke/billing.smoke.test.tsx          ← 14 rutas
test/smoke/access.smoke.test.tsx           ← 8 rutas (users + roles + permissions)
test/smoke/sponsors.smoke.test.tsx         ← 8 rutas (sponsors + sponsor dashboard)
test/smoke/posts.smoke.test.tsx            ← 6 rutas
test/smoke/settings.smoke.test.tsx         ← 6 rutas
test/smoke/dashboard.smoke.test.tsx        ← dashboard.lazy, analytics/* (4 rutas)
test/smoke/me.smoke.test.tsx               ← 5 rutas
test/smoke/system.smoke.test.tsx           ← notifications, revalidation (2 rutas)
```

**Assertion pattern recomendada por tipo de página:**

| Tipo de página | Assertion primaria |
|---------------|-------------------|
| Lista (`index.tsx`) | `screen.getByRole('table')` o `screen.getByRole('grid')` |
| Detail (`$id.tsx`) | `screen.getByRole('heading')` o elemento de datos |
| Create (`new.tsx`) | `screen.getByRole('form')` o un campo del formulario |
| Edit (`$id_.edit.tsx`) | `screen.getByRole('form')` con campos pre-llenados |
| Dashboard | `screen.getByRole('main')` o métricas |

Para páginas donde no se sabe exactamente qué elemento buscar, usar:
```typescript
// Mínimo aceptable: no hay errores en la consola y el body tiene contenido
expect(document.body.children.length).toBeGreaterThan(0);
```

### Phase 3: CRUD Flow Tests (2-3 días)

**Objetivo**: Validar los flujos create, edit y delete de las entidades de alto riesgo.

**Entidades priorizadas** (ver Priority Matrix):
1. Billing plans (`PlanDialog`)
2. Promo codes (`PromoCodeFormDialog`)
3. Accommodations (create + edit)
4. Users (create)

#### Estructura de un test de flujo CRUD

```typescript
// test/integration/accommodations.crud.test.tsx

import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../mocks/server';
import { mockAccommodation, mockAccommodationList } from '../fixtures';
import { mockSuccessResponse, mockErrorResponse } from '../mocks/handlers';
import { renderWithProviders } from '../helpers/render-with-providers';

describe('Accommodation CRUD flows', () => {
    describe('Create flow', () => {
        it('submits form with valid data and navigates to list', async () => {
            // Arrange
            const user = userEvent.setup();
            server.use(
                http.post('/api/v1/admin/accommodations', () =>
                    HttpResponse.json(mockSuccessResponse(mockAccommodation), { status: 201 })
                )
            );
            const mockNavigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(mockNavigate);

            // Act
            render(<NewAccommodationPage />, { wrapper: createWrapper() });
            await user.type(screen.getByLabelText(/name/i), 'Hotel Test');
            await user.type(screen.getByLabelText(/slug/i), 'hotel-test');
            await user.click(screen.getByRole('button', { name: /createButton/i }));

            // Assert
            await waitFor(() =>
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.objectContaining({ to: expect.stringContaining('/accommodations') })
                )
            );
        });

        it('shows validation errors when form is submitted empty', async () => {
            const user = userEvent.setup();
            render(<NewAccommodationPage />, { wrapper: createWrapper() });

            await user.click(screen.getByRole('button', { name: /createButton/i }));

            await waitFor(() =>
                expect(screen.getByText(/required/i)).toBeInTheDocument()
            );
        });

        it('shows error toast when API returns 400 VALIDATION_ERROR', async () => {
            // IMPORTANTE: El API mapea VALIDATION_ERROR a status 400, NO 422
            const user = userEvent.setup();
            server.use(
                http.post('/api/v1/admin/accommodations', () =>
                    HttpResponse.json(
                        mockErrorResponse('VALIDATION_ERROR', 'Slug already taken'),
                        { status: 400 }
                    )
                )
            );

            render(<NewAccommodationPage />, { wrapper: createWrapper() });
            // ... fill form ...
            await user.click(screen.getByRole('button', { name: /createButton/i }));

            await waitFor(() =>
                expect(screen.getByText(/slug already taken/i)).toBeInTheDocument()
            );
        });

        it('disables submit button while pending', async () => {
            // Arrange: handler que no resuelve inmediatamente
            server.use(
                http.post('/api/v1/admin/accommodations', async () => {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    return HttpResponse.json(mockSuccessResponse(mockAccommodation), { status: 201 });
                })
            );
            const user = userEvent.setup();
            render(<NewAccommodationPage />, { wrapper: createWrapper() });
            // ... fill form ...
            await user.click(screen.getByRole('button', { name: /createButton/i }));

            // Mientras está pending, el botón debe estar disabled
            // Button text during submit depends on the component's loading state implementation.
            // It may show a spinner or disabled state with the same key.
            const submitButton = screen.getByRole('button', { name: /createButton/i });
            expect(submitButton).toBeDisabled();
        });
    });

    describe('Edit flow', () => {
        it('pre-fills form with existing data', async () => {
            server.use(
                http.get('/api/v1/admin/accommodations/:id', () =>
                    HttpResponse.json(mockSuccessResponse(mockAccommodation))
                )
            );

            render(<EditAccommodationPage />, { wrapper: createWrapper() });

            await waitFor(() =>
                expect(screen.getByDisplayValue(mockAccommodation.name)).toBeInTheDocument()
            );
        });
    });
});
```

**IMPORTANTE sobre status codes de error:**

| Error del API | HTTP Status | Código |
|---------------|-------------|--------|
| Validation errors | **400** | `VALIDATION_ERROR` |
| Not found | 404 | `NOT_FOUND` |
| Conflict/duplicate | 409 | `CONFLICT` |
| Unauthorized | 401 | `UNAUTHORIZED` |
| Forbidden | 403 | `FORBIDDEN` |
| Internal error | 500 | `INTERNAL_ERROR` |

Siempre usar `status: 400` para `VALIDATION_ERROR` — el API nunca devuelve 422.

**Archivos a crear:**

```
test/integration/accommodations.crud.test.tsx
test/integration/billing-plans.crud.test.tsx
test/integration/promo-codes.crud.test.tsx
test/integration/users.crud.test.tsx
```

### Phase 4: Table Interaction Tests (1 día)

**Objetivo**: Validar las interacciones de TanStack Table en las páginas LIST.

**Cómo funciona la paginación en las páginas admin:**

```typescript
// Las tablas usan manualPagination: true — la paginación y el sort son SERVER-SIDE.
// Esto significa:
// - Cambiar de página → nueva llamada a la API con ?page=2
// - Cambiar sort → nueva llamada con ?sort=[{"id":"name","desc":false}] (JSON serialized DataTableSort)
// - Cambiar pageSize → nueva llamada con ?pageSize=50
// - Filtrar → nueva llamada con ?q=texto
// NO hay ordenamiento o filtrado client-side.

// La paginación y el sort son completamente EXTERNOS al table instance.
// DataTable recibe props de paginación y sort como callbacks:
//
// <DataTable
//     data={data?.items || []}
//     columns={columns}
//     page={page}
//     pageSize={pageSize}
//     total={data?.pagination?.total || 0}
//     onPageChange={(newPage) => setSearch({ page: newPage })}
//     onPageSizeChange={(newSize) => setSearch({ pageSize: newSize })}
//     sort={sort}
//     onSortChange={(newSort) => setSearch({ sort: newSort })}
// />
//
// Internamente, DataTable usa useReactTable con getCoreRowModel() y getSortedRowModel(),
// pero NO usa getPaginationRowModel(). La paginación UI es manual (botones propios).
// El sort propaga cambios hacia arriba via callback.
// Esto significa que los tests deben verificar que los CALLBACKS se llaman con los
// parámetros correctos, o que se hacen nuevas llamadas al API con los query params esperados.
```

**Tests a implementar:**

```typescript
describe('Accommodations table interactions', () => {
    it('sends sort params when column header is clicked', async () => {
        const user = userEvent.setup();
        let lastRequest: Request | undefined;

        server.use(
            http.get('/api/v1/admin/accommodations', ({ request }) => {
                lastRequest = request;
                return HttpResponse.json(mockPaginatedResponse(mockAccommodationList));
            })
        );

        renderWithProviders(<AccommodationsPage />);
        await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

        // Click en header de columna sortable
        await user.click(screen.getByRole('columnheader', { name: /name/i }));

        await waitFor(() => {
            const url = new URL(lastRequest!.url);
            // createEntityHooks serializes sort as DataTableSort: ReadonlyArray<{ id: string; desc: boolean }>
            const sort = JSON.parse(url.searchParams.get('sort') || '[]');
            expect(sort).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'name', desc: false })
                ])
            );
        });
    });

    it('sends page=2 when next page button is clicked', async () => {
        const user = userEvent.setup();
        let lastRequest: Request | undefined;

        // Configurar handler con datos suficientes para que haya página 2
        server.use(
            http.get('/api/v1/admin/accommodations', ({ request }) => {
                lastRequest = request;
                return HttpResponse.json(
                    mockPaginatedResponse(mockAccommodationList, 1, 2) // total > pageSize
                );
            })
        );

        renderWithProviders(<AccommodationsPage />);
        await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: /next/i }));

        await waitFor(() => {
            const url = new URL(lastRequest!.url);
            expect(url.searchParams.get('page')).toBe('2');
        });
    });

    it('navigates to edit page when edit action is clicked', async () => {
        const user = userEvent.setup();
        const mockNavigate = vi.fn();
        vi.mocked(useNavigate).mockReturnValue(mockNavigate);

        renderWithProviders(<AccommodationsPage />);
        await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

        // Click en acción de fila (Edit button / dropdown)
        const editButtons = screen.getAllByRole('button', { name: /edit/i });
        await user.click(editButtons[0]);

        expect(mockNavigate).toHaveBeenCalledWith(
            expect.objectContaining({
                to: expect.stringContaining(mockAccommodation.id),
            })
        );
    });
});
```

**Archivos a crear:**

```
test/integration/accommodations.table.test.tsx
test/integration/billing-plans.table.test.tsx
```

### Phase 5: Dialog Tests (2-3 días)

**Objetivo**: Validar los diálogos críticos de billing y otras entidades.

#### `PlanDialog` — Especificación completa

`PlanDialog` es el componente más complejo de testear (622 líneas de código). Es CRÍTICO para el negocio porque controla la creación y edición de planes de subscripción.

**Props reales:**

```typescript
interface PlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan?: PlanDefinition | null;  // null/undefined = create mode, objeto = edit mode
    onSubmit: (payload: CreatePlanPayload) => Promise<void>;
    isSubmitting?: boolean;
}
```

**Implementación interna:**
- Usa `@tanstack/react-form` con el hook `useForm`
- Tiene **6 secciones** del formulario:
  1. **Basic Info**: `slug`, `name`, `description`, `category` (select — valores: owner, complex, tourist, etc.)
  2. **Pricing**: `monthlyPriceArs` (número), `annualPriceArs` (número), `monthlyPriceUsdRef` (número, referencia USD)
  3. **Trial**: `hasTrial` (switch), `trialDays` (número, condicional — solo visible si `hasTrial` es true)
  4. **Entitlements**: checkboxes agrupados por categoría (ej: Accommodation, Gallery, Content, Billing) con entitlements específicos como `canListAccommodations`, `canManageGallery`, etc. — los grupos se definen en `plan-entitlement-groups.ts`
  5. **Limits**: array dinámico de limits — cada limit tiene `key` (string), `value` (número). NO son campos individuales fijos
  6. **Configuration**: `sortOrder` (número), `isDefault` (switch), `isActive` (switch)
- Total de inputs: **10+ campos fijos** + entitlements dinámicos + limits dinámicos

**Tests:**

```typescript
// test/integration/plan-dialog.test.tsx

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanDialog } from '@/features/billing-plans/components/PlanDialog';
import { mockBillingPlan } from '../fixtures/billing-plan.fixture';
import { renderWithProviders } from '../helpers/render-with-providers';

describe('PlanDialog', () => {
    describe('Create mode (plan = null)', () => {
        it('renders dialog with empty fields', () => {
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByLabelText(/slug/i)).toHaveValue('');
            expect(screen.getByLabelText(/name/i)).toHaveValue('');
        });

        it('calls onSubmit with correct payload on valid submit', async () => {
            const user = userEvent.setup();
            const onSubmit = vi.fn().mockResolvedValue(undefined);

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={onSubmit}
                />
            );

            // Basic Info
            await user.type(screen.getByLabelText(/slug/i), 'basic-plan');
            await user.type(screen.getByLabelText(/name/i), 'Basic Plan');

            // Pricing (3 campos de precio separados)
            await user.clear(screen.getByLabelText(/monthly.*ars/i));
            await user.type(screen.getByLabelText(/monthly.*ars/i), '99900');
            await user.clear(screen.getByLabelText(/annual.*ars/i));
            await user.type(screen.getByLabelText(/annual.*ars/i), '999000');

            // Submit
            await user.click(screen.getByRole('button', { name: /createButton/i }));

            await waitFor(() =>
                expect(onSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        slug: 'basic-plan',
                        name: 'Basic Plan',
                    })
                )
            );
        });

        it('shows validation error when required fields are empty', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /createButton/i }));

            await waitFor(() => {
                expect(screen.getByText(/required/i)).toBeInTheDocument();
            });
        });
    });

    describe('Edit mode (plan = existing)', () => {
        it('pre-fills all fields with existing plan data', () => {
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={mockBillingPlan}
                    onSubmit={vi.fn()}
                />
            );

            expect(screen.getByLabelText(/slug/i)).toHaveValue(mockBillingPlan.slug);
            expect(screen.getByLabelText(/name/i)).toHaveValue(mockBillingPlan.name);
        });

        it('renders "Save" button (not "Create") in edit mode', () => {
            // NOTE: The real code uses translation keys for button text:
            //   plan ? t('admin-billing.plans.dialog.saveButton') : t('admin-billing.plans.dialog.createButton')
            // Since useTranslations mock returns the key itself, match against the key.
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={mockBillingPlan}
                    onSubmit={vi.fn()}
                />
            );

            expect(screen.getByRole('button', { name: /saveButton/i })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /createButton/i })).not.toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('disables submit button while isSubmitting is true', () => {
            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={vi.fn()}
                    isSubmitting={true}
                />
            );

            // When isSubmitting=true, the button shows a loading/disabled state.
            // Match against translation key pattern:
            const submitButton = screen.getByRole('button', { name: /createButton|saveButton/i });
            expect(submitButton).toBeDisabled();
        });
    });

    describe('Cancel behavior', () => {
        it('calls onOpenChange(false) when cancel button is clicked', async () => {
            const user = userEvent.setup();
            const onOpenChange = vi.fn();

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={onOpenChange}
                    plan={null}
                    onSubmit={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: /cancelButton/i }));

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('Radix Select interaction', () => {
        it('handles Radix Select for category field', async () => {
            const user = userEvent.setup();
            const onSubmit = vi.fn().mockResolvedValue(undefined);

            renderWithProviders(
                <PlanDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    plan={null}
                    onSubmit={onSubmit}
                />
            );

            // Para Radix Select en JSDOM, se requiere el PointerEvent polyfill
            // (configurado en test/setup.tsx — ver sección "Radix UI PointerEvent Polyfill")
            const categorySelect = screen.getByRole('combobox', { name: /category/i });
            await user.click(categorySelect);
            await user.click(screen.getByRole('option', { name: /owner/i }));

            // Verificar que el valor se seleccionó
            expect(categorySelect).toHaveTextContent(/owner/i);
        });
    });
});
```

#### `PromoCodeFormDialog` — Especificación completa

```typescript
// Props reales:
interface PromoCodeFormDialogProps {
    readonly promoCode: PromoCode | null; // null = create mode, objeto = edit mode
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (data: CreatePromoCodePayload) => void;
}

// Estado interno: useState (NO @tanstack/react-form)
// Campos del formulario:
// - code: string — auto-uppercased on every keystroke (onChange handler calls .toUpperCase())
// - description: string
// - type: 'percentage' | 'fixed'
// - discountValue: number
// - maxUses: number | null
// - maxUsesPerUser: number | null
// - minimumAmount: number | null
// - validFrom: string (fecha ISO)
// - validUntil: string (fecha ISO)
// - applicablePlans: string[] (array de plan IDs)
// - isStackable: boolean
// - isActive: boolean
// - requiresFirstPurchase: boolean
```

**Tests:**

```typescript
// test/integration/promo-code-dialog.test.tsx

describe('PromoCodeFormDialog', () => {
    it('auto-uppercases the code field on every keystroke', async () => {
        // The real code uppercases on onChange, not at submit:
        // onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
        const user = userEvent.setup();

        renderWithProviders(
            <PromoCodeFormDialog
                promoCode={null}
                isOpen={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        );

        const codeInput = screen.getByLabelText(/code/i);
        await user.type(codeInput, 'summer2026');

        // The input should show the uppercased value immediately while typing
        expect(codeInput).toHaveValue('SUMMER2026');
    });

    it('shows discount value field for both percentage and fixed types', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <PromoCodeFormDialog
                promoCode={null}
                isOpen={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        );

        // Seleccionar 'percentage' via Radix Select
        const typeSelect = screen.getByRole('combobox', { name: /type/i });
        await user.click(typeSelect);
        await user.click(screen.getByRole('option', { name: /percentage/i }));
        expect(screen.getByLabelText(/discount value/i)).toBeInTheDocument();

        // Cambiar a 'fixed'
        await user.click(typeSelect);
        await user.click(screen.getByRole('option', { name: /fixed/i }));
        expect(screen.getByLabelText(/discount value/i)).toBeInTheDocument();
    });
});
```

#### `PromotionFormDialog` — Especificación completa

```typescript
// Props reales:
interface PromotionFormDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly promotion: OwnerPromotion | null; // null = create mode
    readonly mode: 'create' | 'edit';
}

// Estado interno: useState (NO @tanstack/react-form)
// Mutations internas (NO onSubmit prop):
//   - useCreateOwnerPromotionMutation() para mode='create'
//   - useUpdateOwnerPromotionMutation() para mode='edit'
// IMPORTANTE: Este dialog no recibe onSubmit como prop — llama la mutation internamente.
// Para testear el submit, hay que mockear las mutations o usar MSW.

// Campos:
// - ownerId: string (select de usuarios con rol OWNER)
// - accommodationId: string | null (select opcional)
// - title: string
// - description: string
// - discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_NIGHT' | 'SPECIAL_PRICE' (uppercase enums, usa <select> HTML nativo)
// - discountValue: number
// - minNights: number | null
// - maxRedemptions: number | null
// - validFrom: string (fecha)
// - validUntil: string (fecha)
// - isActive: boolean
//
// NOTA: Los campos ownerId, accommodationId, minNights, maxRedemptions e isActive
// existen en el state interno pero NO todos tienen inputs visibles en el JSX.
// Los tests deben verificar solo los campos que tienen elementos de formulario renderizados:
// title, description, discountType, discountValue, validFrom, validUntil.
```

**Nota importante**: A diferencia de `PlanDialog` y `PromoCodeFormDialog`, `PromotionFormDialog` maneja sus propias mutations internamente. Los tests deben agregar un handler MSW para `POST /api/v1/admin/billing/owner-promotions` y verificar que el dialog se cierra y el estado se actualiza correctamente.

#### `InvoiceDetailDialog` — Solo lectura

```typescript
// Props reales:
interface InvoiceDetailDialogProps {
    readonly invoice: Invoice | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly onMarkAsPaid: (invoice: Invoice) => void;
    readonly onMarkAsVoid: (invoice: Invoice) => void;
    readonly onSendReminder: (invoice: Invoice) => void;
}

// NO es un formulario — muestra datos de la factura con botones de acción.
// Muestra: invoice number, user info, line items table, totals, payment info.
// Acciones: Mark as Paid, Mark as Void, Send Reminder, Print.
```

**Tests:**

```typescript
describe('InvoiceDetailDialog', () => {
    it('renders invoice data correctly', () => {
        renderWithProviders(
            <InvoiceDetailDialog
                invoice={mockInvoice}
                open={true}
                onOpenChange={vi.fn()}
                onMarkAsPaid={vi.fn()}
                onMarkAsVoid={vi.fn()}
                onSendReminder={vi.fn()}
            />
        );

        expect(screen.getByText(mockInvoice.invoiceNumber)).toBeInTheDocument();
        expect(screen.getByText(mockInvoice.userEmail)).toBeInTheDocument();
    });

    it('calls onMarkAsPaid with the invoice when button is clicked', async () => {
        const user = userEvent.setup();
        const onMarkAsPaid = vi.fn();

        renderWithProviders(
            <InvoiceDetailDialog
                invoice={mockInvoice}
                open={true}
                onOpenChange={vi.fn()}
                onMarkAsPaid={onMarkAsPaid}
                onMarkAsVoid={vi.fn()}
                onSendReminder={vi.fn()}
            />
        );

        await user.click(screen.getByRole('button', { name: /mark as paid/i }));
        expect(onMarkAsPaid).toHaveBeenCalledWith(mockInvoice);
    });

    it('renders null gracefully when invoice is null', () => {
        renderWithProviders(
            <InvoiceDetailDialog
                invoice={null}
                open={false}
                onOpenChange={vi.fn()}
                onMarkAsPaid={vi.fn()}
                onMarkAsVoid={vi.fn()}
                onSendReminder={vi.fn()}
            />
        );
        // No debe crashear
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
```

#### `WebhookEventDetailDialog` — Solo lectura

```typescript
// Props reales:
interface WebhookEventDetailDialogProps {
    readonly event: WebhookEvent | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

// Muestra: provider, type, status, payload (como JSON formateado),
// timestamps, retry count, error message (si falla).
```

#### `NotificationDetailDialog` — Solo lectura

```typescript
// Props reales:
interface NotificationDetailDialogProps {
    readonly notification: NotificationLog | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

// Muestra: recipient, type, status, channel, sentAt, errorMessage, metadata (como JSON).
```

**Archivos a crear:**

```
test/integration/plan-dialog.test.tsx
test/integration/promo-code-dialog.test.tsx
test/integration/promotion-dialog.test.tsx
test/integration/invoice-detail-dialog.test.tsx
test/integration/webhook-event-dialog.test.tsx
```

---

## EntityCreateContent Pattern

Documentación del componente `EntityCreateContent` para entender qué mockear y qué testear en las páginas de create.

```typescript
// Props reales:
interface EntityCreateContentProps {
    readonly config: EntityCreateConfig;  // Contiene: titles, labels, toast messages, basePath
    readonly createConsolidatedConfig: () => {
        sections: ConsolidatedSectionConfig[] | SectionConfig[];
        metadata?: Record<string, unknown>;
    };
    readonly createMutation: {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };
    readonly onNavigate: (path: string) => void;
    readonly configDeps?: readonly unknown[];
    readonly formWrapper?: (children: React.ReactNode) => React.ReactNode;
    readonly zodSchema?: ZodSchema;
}

// Submit flow interno de EntityCreateContent:
// 1. Recolecta valores del formulario
// 2. Llama unflattenValues(values) — convierte dot-notation "address.city" → { address: { city } }
// 3. Llama createMutation.mutateAsync(payload)
// 4. Si éxito: muestra toast de éxito + llama onNavigate(`${config.basePath}/${result.id}`)
// 5. Si error 400 VALIDATION_ERROR: parsea errores del API, setea field errors en el form, muestra toast
// 6. Si error 500: muestra toast de error genérico
```

**Para tests de páginas que usan `EntityCreateContent`:**

```typescript
// Las páginas de create pasan createMutation como una TanStack Query mutation.
// La mutation llama a fetchApi → interceptado por MSW.
// Por lo tanto: agregar handler MSW para POST, render la página, fill form, submit.
// NO mockear createMutation directamente — dejar que MSW maneje la red.
```

**IMPORTANTE**: `EntityCreateContent` usa `useState` puro para el manejo de estado del formulario (`values`, `errors`, `isSaving`). NO usa `@tanstack/react-form`. La renderización de campos la delega a `EntityFormSection` dentro de un `EntityFormProvider`. Los tests interactúan con los inputs HTML nativos renderizados por las secciones — no hay APIs específicas de TanStack Form involucradas aquí.

Esto es diferente de `PlanDialog`, que SÍ usa `@tanstack/react-form` con `useForm`. Ver la sección "TanStack Form Testing" para patrones específicos de ese caso.

---

## TanStack Form Testing

Documentación para interactuar con formularios que usan `@tanstack/react-form`.

`@tanstack/react-form` renderiza inputs nativos vía render props. `@testing-library/react` los encuentra normalmente con los selectores estándar.

### Patrón de interacción

```typescript
// SIEMPRE usar userEvent.setup() (v14 API):
const user = userEvent.setup();

// Inputs de texto:
await user.type(screen.getByLabelText(/name/i), 'Test Plan');

// Inputs numéricos:
await user.clear(screen.getByLabelText(/price/i));
await user.type(screen.getByLabelText(/price/i), '999');

// Radix Select (NO es un <select> nativo — es un combobox de Radix UI):
await user.click(screen.getByRole('combobox', { name: /category/i }));
await user.click(screen.getByRole('option', { name: /owner/i }));

// Checkbox / Switch:
await user.click(screen.getByRole('checkbox', { name: /active/i }));
// O para switches de Radix:
await user.click(screen.getByRole('switch', { name: /active/i }));

// Submit y assert:
await user.click(screen.getByRole('button', { name: /createButton/i }));
await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Test Plan' })
));

// Validación (formulario vacío):
await user.click(submitButton);
await waitFor(() => expect(screen.getByText(/required/i)).toBeInTheDocument());
```

### Diferencias clave vs formularios con useState

| Aspecto | `useState` forms | `@tanstack/react-form` |
|---------|-----------------|----------------------|
| Trigger de submit | `onSubmit` prop directa | Interna al form; exponer via prop |
| Valor inicial | `useState` init | `defaultValues` en `useForm` |
| Errores | State local | Internos al form, renderizados vía `field.state.meta.errors` |
| Testing API | Igual (`getByLabelText`, etc.) | Igual |

---

## Table Testing Strategy

Las tablas admin usan TanStack Table con `manualPagination: true`. Esto significa que TODA la lógica de paginación, sort y filtrado es server-side.

**Qué verificar en tests de tabla:**

1. **Sort**: click en header sortable → el API recibe `?sort=[{"id":"name","desc":false}]` (JSON serialized `DataTableSort` from `createEntityHooks`; format is `ReadonlyArray<{ id: string; desc: boolean }>`)
2. **Paginación**: click en "next" → el API recibe `?page=2`
3. **Page size**: cambio de selector de tamaño → el API recibe `?pageSize=50`
4. **Filtro**: input de búsqueda → el API recibe `?q=texto` (con debounce, usar `waitFor`)
5. **Row actions**: click en "Edit" en una fila → navigate a ruta de edit con el id correcto

**Lo que NO verificar** (porque no existe):
- Sorting client-side de columnas
- Filtering client-side de filas
- Paginación sin llamada al API

**Patrón para capturar requests al API:**

```typescript
let capturedRequest: Request | undefined;

server.use(
    http.get('/api/v1/admin/accommodations', ({ request }) => {
        capturedRequest = request;
        return HttpResponse.json(mockPaginatedResponse(mockAccommodationList));
    })
);

// Después de la acción del usuario:
await waitFor(() => {
    expect(capturedRequest).toBeDefined();
    const url = new URL(capturedRequest!.url);
    expect(url.searchParams.get('page')).toBe('2');
});
```

**Nota sobre DataTable**: Las páginas usan un componente `<DataTable>` que wrappea el table instance de TanStack Table. Los tests interactúan con el DOM renderizado (roles ARIA de tabla), no con la instancia del table directamente.

---

## Priority Matrix

Priorización basada en riesgo de negocio (impacto si rompe) × frecuencia de uso:

| Entidad / Página | Riesgo negocio | Frecuencia uso | Prioridad | Fase |
|-----------------|---------------|---------------|-----------|------|
| Billing Plans + PlanDialog (622 líneas) | Crítico | Alto | P0 | 3+5 |
| Promo Codes + dialog | Crítico | Alto | P0 | 3+5 |
| Accommodations CRUD | Alto | Muy alto | P1 | 3 |
| Users CRUD | Alto | Alto | P1 | 3 |
| Billing Subscriptions | Alto | Medio | P1 | 2 |
| Billing Invoices + InvoiceDetailDialog | Alto | Medio | P1 | 2+5 |
| Sponsors CRUD | Medio | Medio | P2 | 3 |
| Events CRUD | Medio | Alto | P2 | 3 |
| Destinations CRUD | Medio | Medio | P2 | 3 |
| Owner Promotions + PromotionFormDialog | Medio | Bajo | P2 | 3+5 |
| Webhook Events + dialog | Bajo | Bajo | P3 | 5 |
| Notification Logs + dialog | Bajo | Bajo | P3 | 5 |
| Exchange Rates | Bajo | Bajo | P3 | 2 |
| Analytics pages | Bajo | Bajo | P3 | 2 |
| Cron page | Bajo | Muy bajo | P3 | 2 |
| Content (amenities, features, attractions) | Bajo | Bajo | P3 | 2 |
| Me / Profile / Settings | Bajo | Bajo | P3 | 2 |
| Revalidation | Bajo | Muy bajo | P3 | 2 |

---

## Acceptance Criteria

### User Story 1: Test Infrastructure Ready

**Como** desarrollador, **quiero** que la infraestructura de testing de páginas admin esté completa, **para** poder escribir tests de integración sin fricción.

**Given** que las herramientas de testing están instaladas (Vitest, Testing Library, MSW, userEvent),
**When** creo un nuevo test file para una página admin,
**Then** puedo importar `renderWithProviders`, `createTestQueryClient`, y los fixtures de la entidad correspondiente sin setup adicional.

**Given** que una página admin usa iconos de `@repo/icons`,
**When** el test renderiza esa página,
**Then** no se producen errores de "component is undefined" ni warnings de módulos faltantes.

**Given** que una página admin usa el hook `useTranslations`,
**When** el test renderiza esa página,
**Then** los textos se renderizan como translation keys (ej: `"billing.plans.title"`) sin crashear.

### User Story 2: Smoke Test Coverage

**Como** desarrollador, **quiero** tener un smoke test para cada página admin, **para** detectar regressions de render antes de que lleguen a producción.

**Given** que existe un handler MSW para el endpoint principal de una página,
**When** el smoke test renderiza esa página,
**Then** el test pasa sin arrojar excepciones y el DOM tiene contenido significativo (table, heading, o form).

**Given** que hay ~112 archivos .tsx en `_authed/` (~96 rutas + ~16 componentes colocados),
**When** ejecuto `pnpm test` en `apps/admin`,
**Then** todos los smoke tests pasan (~96 rutas cubiertas; colocated components tested via their parent routes).

### User Story 3: CRUD Flow Validation

**Como** desarrollador, **quiero** tests que validen los flujos CRUD de las 4 entidades de alto riesgo, **para** detectar bugs en el submit de formularios.

**Given** que el formulario de create de una accommodation está completo con datos válidos,
**When** el usuario hace click en "Create",
**Then** se hace un `POST /api/v1/admin/accommodations`, se muestra un toast de éxito, y se navega al detalle.

**Given** que el formulario de create tiene campos vacíos obligatorios,
**When** el usuario hace click en "Create",
**Then** se muestran mensajes de validación en los campos correspondientes y NO se hace ningún request al API.

**Given** que el API devuelve `status: 400` con `VALIDATION_ERROR`,
**When** el usuario submite el formulario,
**Then** se muestra el mensaje de error del API en el toast y/o en el campo correspondiente.

**Given** que el formulario está siendo procesado (mutation pending),
**When** el submit está en progreso,
**Then** el botón de submit está deshabilitado.

### User Story 4: Table Interaction Validation

**Como** desarrollador, **quiero** tests que verifiquen que las interacciones de tabla generan los query params correctos, **para** asegurar que el sort y la paginación funcionan server-side.

**Given** que la tabla de accommodations está cargada con datos,
**When** el usuario hace click en el header de la columna "Name",
**Then** se hace un nuevo request al API con `?sort=[{"id":"name","desc":false}]` en los query params (format: `DataTableSort = ReadonlyArray<{ id: string; desc: boolean }>`).

**Given** que hay más de una página de resultados,
**When** el usuario hace click en "Next Page",
**Then** se hace un nuevo request al API con `?page=2`.

### User Story 5: Dialog Validation

**Como** desarrollador, **quiero** tests para `PlanDialog` y `PromoCodeFormDialog`, **para** asegurar que los formularios más críticos de billing funcionan correctamente.

**Given** que `PlanDialog` se abre con `plan={null}` (create mode),
**When** se renderiza el dialog,
**Then** todos los campos están vacíos y el botón muestra la key `admin-billing.plans.dialog.createButton`.

**Given** que `PlanDialog` se abre con un plan existente (edit mode),
**When** se renderiza el dialog,
**Then** los campos están pre-llenados con los datos del plan y el botón muestra la key `admin-billing.plans.dialog.saveButton` (NOT "Update" — the real code uses "Save" for edit mode).

**Given** que `PlanDialog` recibe `isSubmitting={true}`,
**When** se renderiza el dialog,
**Then** el botón de submit está deshabilitado.

**Given** que `PlanDialog` está abierto,
**When** el usuario hace click en "Cancel",
**Then** se llama `onOpenChange(false)`.

---

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| TanStack Router difícil de mockear para páginas con params complejos | Alta | Medio | Approach A con `createFileRoute` mock; `useParams` configurable por test |
| `PlanDialog` (622 líneas, 6 secciones, 14+ campos) — test muy lento | Alta | Medio | Testear secciones individualmente; no testear todos los campos en un solo test |
| `PromotionFormDialog` usa mutations internas — difícil de aislar | Media | Alto | Usar MSW para el endpoint, no mockear la mutation directamente |
| MSW handlers desincronizados con la API real | Media | Alto | Derivar fixtures de schemas Zod de `@repo/schemas`; review en PR |
| Tests lentos por demasiados renders complejos | Media | Bajo | Pool de Vitest ya está en `forks` con `maxForks: 3`; smoke tests son livianos |
| `EntityCreateContent` tiene demasiadas dependencias internas | Alta | Medio | Comenzar testeando dialogs antes de páginas completas |
| Fixtures desactualizados que generan falsos positivos | Baja | Medio | Derivar fixtures de los schemas Zod de `@repo/schemas` |
| Icons Proxy mock puede romper algunos tests que buscan por texto de icono | Baja | Bajo | Los iconos renderizan `<span data-testid="icon-NombreIcono">` — testable si necesario |
| Endpoints no paginados reciben `mockPaginatedResponse` → runtime error | Alta | Alto | Documentar y separar explícitamente en `admin-handlers.ts` los formatos custom |

---

## Definition of Done

Una tarea de este spec se considera **done** cuando:

- [ ] Tests escritos y pasando (`pnpm test` verde en `apps/admin`)
- [ ] Coverage no decreció respecto al baseline pre-PR
- [ ] MSW handlers usados (no `vi.mock` para HTTP calls)
- [ ] Fixtures centralizados en `test/fixtures/` (no inline en el test)
- [ ] `userEvent.setup()` usado (patrón v14 — NO `userEvent.type()` directo)
- [ ] Error de validación del API simulado con `status: 400` (NO 422)
- [ ] Descripción de tests en inglés, comentarios en inglés
- [ ] Sin `any` types en los tests
- [ ] `gcTime: Infinity` en el `QueryClient` de test
- [ ] PR revisado y mergeado

El spec completo se considera **done** cuando:
1. Los 5 grupos de Acceptance Criteria están cumplidos
2. Los ~96 route smoke tests pasan
3. Los 4 flujos CRUD están cubiertos (billing plans, promo codes, accommodations, users)
4. `PlanDialog` y `PromoCodeFormDialog` tienen tests de create, edit, submit, cancel y loading state
5. La coverage de `apps/admin` supera el 70% en todos los umbrales (configurados en `vitest.config.ts`)
