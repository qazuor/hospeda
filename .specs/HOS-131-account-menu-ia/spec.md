---
title: "Reorganización de la navegación de /mi-cuenta — IA por roles, puertas de descubrimiento, fuente única de menú"
linear: HOS-131
statusSource: linear
type: feature
areas: [web]
created: 2026-07-11
---

# Reorganización de la navegación de `/mi-cuenta` (web)

## 1. Summary

El área de cuenta (`/mi-cuenta/*`) de `apps/web` creció a ~19 ítems en un único
sidebar sobrecargado. Esta spec rediseña su **arquitectura de información** con un
modelo **híbrido por roles** (sin mode-switcher), agrega dos **puertas de
descubrimiento** para sumar verticales nuevos, cura el dropdown del avatar
(`UserMenu`), define la estructura del menú mobile (hamburguesa), y — lo más
importante estructuralmente — **colapsa las tres definiciones de menú divergentes**
que hoy conviven en una única config tipada con i18n y un solo modelo de gating.

Fase 1 (esta spec) es **solo documentación**, sin worktree. La implementación es
Fase 2.

## 2. Problem

Hoy existen **tres** definiciones de menú de cuenta, separadas y desincronizadas:

1. `apps/web/src/layouts/AccountLayout.astro` — el sidebar real de `/mi-cuenta/*`.
   Ya está agrupado (`profile` / `activity` / `host` / `config`), usa i18n
   (`account.nav.*`), y gatea por **rol** (`isHostRole`, `isCommerceOwnerRole` en
   `apps/web/src/lib/account-roles.ts`). Su grupo `activity` es el sobrecargado
   (~10 ítems que mezclan features de turista con verticales de negocio).
2. `apps/web/src/components/shared/navigation/UserMenu.client.tsx` — el dropdown del
   avatar. Lista plana, labels **hardcodeados** por locale (NO i18n), gatea por
   strings de **permiso**.
3. `apps/web/src/components/shared/navigation/MobileMenu.client.tsx` — la sección de
   cuenta del hamburguesa. Lista plana, hardcodeada, sin gating.

Mismos links, tres fuentes de verdad, dos modelos de gating distintos. Cualquier
reorganización que toque una sola deja a las otras dos mintiendo. Ese es el problema
de fondo: **no hay una fuente única de navegación de cuenta.**

## 3. Goals

- **G-1** — Reemplazar el sidebar sobrecargado por una IA **híbrida por roles**:
  grupos densos con sección propia (según el rol activo) + un grupo "cajón" para los
  verticales livianos.
- **G-2** — Introducir dos **puertas de descubrimiento** ("Publicá en Hospeda" y
  "Sumate como aliado") que llevan a páginas-hub internas, separadas del bloque de
  gestión.
- **G-3** — Unificar las **tres definiciones de menú** en una única config tipada +
  i18n; cada superficie (sidebar desktop, avatar, hamburguesa mobile) renderiza un
  subconjunto de esa fuente.
- **G-4** — Unificar la **declaración** de gating: cada ítem declara su
  `PermissionEnum` como fuente única de verdad. La **evaluación** es exacta en el
  cliente (permisos reales) y aproximada por rol en el server SSR (ver D-4 —
  exponer permisos efectivos server-side cuesta un round-trip `/auth/me` sin
  cachear por render, descartado por performance).
- **G-5** — Curar el `UserMenu` del avatar como accesos rápidos (identidad + atajos +
  sesión), NO como espejo del sidebar.
- **G-6** — Definir la estructura del hamburguesa mobile como **única superficie de
  navegación**, jerarquizada por acordeón.

## 4. Non-goals

- **NG-1** — No se rediseñan las sub-páginas individuales de cuenta, solo sus
  entradas de menú.
- **NG-2** — No se implementan los paneles de verticales que aún no existen
  (sponsor, proveedor de servicios). El menú se diseña para acomodarlos, pero su
  implementación es trabajo separado (ej. sponsors: HOS-107).
- **NG-3** — No se construye un **mode-switcher** (patrón Airbnb "modo anfitrión").
  Descartado por YAGNI: ver decisión D-1.

## 5. Current baseline

Inventario real del sidebar (`AccountLayout.astro`, `navGroups`), 4 grupos:

- **profile**: Mi cuenta (`mi-cuenta`), Editar perfil (`mi-cuenta/editar`).
- **activity** (sobrecargado): Novedades, Mis propiedades (host), Mi comercio
  (commerce owner), Favoritos, Historial de búsquedas, Alertas de precio, Ofertas
  exclusivas, Recomendaciones, Mis reseñas, Mis consultas.
- **host** (todo el grupo si `showPropertiesNav`): Panel del anfitrión, Mensajes de
  huéspedes, Mis promociones, Directorio de proveedores.
- **config**: Suscripción, Preferencias, Boletín de novedades.

Gating actual: `showPropertiesNav = isHostRole(userRole)` (HOST, ADMIN, SUPER_ADMIN,
CLIENT_MANAGER, EDITOR); `showCommerceNav = isCommerceOwnerRole(userRole)`
(COMMERCE_OWNER, ADMIN, SUPER_ADMIN). i18n namespace `account.nav.*` (+ algunos cross:
`commerce.*`, `conversations.inbox.*`).

`UserMenu.client.tsx`: dropdown plano, `TEXTS` hardcodeado (es/en/pt), gating por
permiso (`accommodation.create`, `access.panelAdmin`). `MobileMenu.client.tsx`:
sub-lista de 4 links hardcodeada, sin gating.

Inconsistencia concreta a corregir: "Mis propiedades" vive en `activity`, separada del
resto del tooling de anfitrión (grupo `host`).

## 6. Proposed design

### 6.1 Estructura — híbrida por roles, sin switcher

Fundamento (D-1): solo **Alojamiento** es un vertical denso; Gastronomía/Experiencias
son medianos; el resto (sponsor, proveedor) son livianos (1-2 ítems). Un usuario
realista tiene **1, a lo sumo 2** verticales densos a la vez → un mode-switcher sería
sobre-ingeniería.

Grupos (cada uno visible SOLO si el usuario tiene el rol activo — **cero grupos
fantasma**):

- **Mi cuenta** — siempre. Perfil, preferencias, suscripción, boletín, contraseña,
  novedades.
- **Turista** — siempre. Favoritos, historial de búsquedas, alertas de precio, ofertas
  exclusivas, recomendaciones, reseñas, consultas (guest inbox).
- **Anfitrión** — solo si rol host. Denso: panel del anfitrión, mensajes de huéspedes,
  promociones, directorio de proveedores, y **Mis alojamientos** (movido acá desde
  `activity` — corrige la inconsistencia del baseline). El grupo se nombra por **rol**
  ("Anfitrión"); los listings son un ítem adentro ("Mis alojamientos").
- **Aliados** (`es`) / **Partners** (`en`) / **Parceiros** (`pt`) — cajón para los
  verticales B2B livianos (sponsor, proveedor de servicios…). **Sin header cuando hay
  uno solo** (el ítem va suelto).
- Verticales densos futuros (Gastronomía, Experiencias) obtienen su propio grupo cuando
  el rol aplica, con el mismo patrón.

### 6.2 Descubrimiento — dos puertas a páginas-hub internas

Principio rector (D-2): **navegación = gestión (limpia); descubrimiento = conversión,
en su propia superficie, nunca mezclado dentro de un grupo de gestión.** Un submenú
anidado no puede explicar; una página sí. Por eso cada puerta linkea a una página-hub
interna de `/mi-cuenta` con una mini-explicación + un botón por opción.

- **"Publicá en Hospeda"** (`es`) / "List on Hospeda" / "Publique no Hospeda" —
  verticales de listing (alojamiento, gastronomía, experiencia). Framing de **acción**
  → texto **fijo**.
- **"Sumate como aliado"** (`es`) / "Become a partner" / "Seja parceiro" — roles B2B.
  Framing de **identidad** → el texto DEBE cambiar a **"Sumá otra alianza"** una vez
  que el usuario ya tiene al menos un rol de aliado (si no, "Sumate como aliado" parece
  un bug).

### 6.3 Ciclo de vida de las puertas (D-3)

Regla en una línea: **grupos = solo lo que TENÉS; puertas = solo lo que te FALTA;
nunca uno invadiendo al otro.**

- Una puerta vive mientras quede ≥1 opción sin adquirir en su categoría. Cuando ya las
  tenés todas, la puerta desaparece.
- Dentro del hub, las opciones ya adquiridas se muestran con un check y un botón
  "Gestionar" (que linkea al grupo correspondiente) en vez del CTA de adquisición.

### 6.4 UserMenu (dropdown del avatar) — accesos rápidos curados

No es espejo del sidebar. Criterio: frecuencia de uso + salto de contexto, NO
cobertura. Tres zonas:

1. **Identidad** — avatar + nombre + "Mi cuenta" (entrada al panel completo).
2. **Atajos** (2-4) — Favoritos (turista) + **atajo al panel del rol de negocio activo**
   ("Panel de anfitrión" / "Mi comercio", patrón "Switch to hosting" de Airbnb) +
   Suscripción.
3. **Sesión** — idioma, tema, cerrar sesión, y el link externo al **panel de admin**.

Lo que NO va (vive solo en el sidebar): historial, alertas, ofertas, recomendaciones,
reseñas, consultas, promociones, boletín, directorio.

### 6.5 Mobile hamburguesa — única superficie, acordeón

En mobile no hay separación avatar-vs-sidebar; todo colapsa en el hamburguesa,
jerarquizado por **acordeón** (secciones colapsadas por default). Orden:

1. **Navegación del sitio** (arriba) — Destinos, Alojamientos, Gastronomía,
   Experiencias, etc.
2. **Bloque de cuenta** (acordeones colapsados) — Cuenta / Turista / Anfitrión /
   Aliados + las dos puertas.
3. **Sesión** (abajo) — idioma, tema, cerrar sesión, panel admin (solo staff).

Sin sesión: navegación del sitio + Iniciá sesión / Registrate + idioma/tema.

### 6.6 Fuente única + gating (G-3, G-4)

Las tres definiciones colapsan en **una** config tipada e i18n'd. Cada superficie
renderiza un subconjunto: el avatar cura, el hamburguesa muestra completo con acordeón,
el sidebar desktop muestra completo plano. **Una fuente, tres vistas.**

**Decisión D-4 (gating — modelo de declaración única, evaluación asimétrica).**
Cada ítem/grupo de la config declara su `requiredPermission` (`PermissionEnum`) —
fuente única de la semántica de gating. La evaluación difiere por superficie por una
restricción real de arquitectura:

- **Cliente** (UserMenu, islands): evalúa con los permisos efectivos reales
  `(rol ∪ grants) \ denies` que ya trae `GET /api/v1/public/auth/me` (cacheado
  client-side 60s). **Exacto**, respeta overrides por-usuario (SPEC-170).
- **Server SSR** (sidebar `AccountLayout.astro`): NO tiene los permisos efectivos.
  `Astro.locals.user` sólo trae `role` (de la sesión Better Auth); resolverlos
  server-side exige un round-trip nuevo a `/auth/me` sin cache por cada render de
  `/mi-cuenta` (web no tiene cache server-side de auth, y agravaría el
  SSR-over-fetching de HOS-103). **Descartado por costo.** El server aproxima vía un
  único mapa `permiso → roles` (centralizado, reemplaza los `isHostRole`/
  `isCommerceOwnerRole` dispersos), derivando del `role` que sí tiene.
- **Trade-off**: el sidebar es impreciso sólo para el caso marginal de un usuario con
  override manual de permisos (grant/deny) que contradice su rol — comportamiento
  idéntico al actual (hoy ya gatea por rol). El UserMenu, la superficie más mirada, es
  exacto. Si en el futuro web gana un cache server-side de auth (candidato SPEC-111
  §4.3), el sidebar puede pasar a evaluación exacta sin cambiar la config.

El link al panel de admin se gatea por `access.panelAdmin` (cubre admin/super_admin/
editor), nunca por una lista hardcodeada de roles.

## 7. Data model / contracts

- **Sin cambios de DB.** Es una spec de frontend/IA.
- Nueva config tipada de navegación (ubicación tentativa: `apps/web/src/config/` o
  `apps/web/src/lib/navigation/`) que modele: grupo, ítem, icono, permiso requerido,
  clave i18n, superficie(s) donde aparece, y para las puertas su estado (opciones
  adquiridas vs disponibles).
- Nuevas claves i18n en el namespace `account.*` (grupos: Turista, Anfitrión, Aliados;
  puertas: publicá/sumate/sumá-otra). Migrar los labels hoy hardcodeados de `UserMenu`
  y `MobileMenu` a `t()`.
- Nuevas páginas-hub internas bajo `/mi-cuenta` (ruta a definir en Fase 2): una para
  "Publicá en Hospeda", otra para "Sumate como aliado".

## 8. UX / UI behavior

- Grupos aparecen/desaparecen según el rol activo (permiso). Cero grupos fantasma.
- Grupo "Aliados" sin header cuando hay un solo ítem.
- Puerta "Sumate como aliado" cambia a "Sumá otra alianza" cuando ya hay ≥1 rol de
  aliado; desaparece cuando están todos.
- Puerta "Publicá en Hospeda": texto fijo; desaparece cuando se publicó en los tres
  verticales de listing.
- Hub interno: opciones adquiridas con check + "Gestionar"; disponibles con
  mini-explicación + botón de adquisición.
- Mobile: acordeones colapsados por default, orden sitio → cuenta → sesión.

## 9. Acceptance criteria

- **AC-1** — El sidebar de `/mi-cuenta` muestra los grupos Cuenta y Turista siempre;
  Anfitrión y Aliados solo si el permiso correspondiente está presente; ningún grupo de
  rol no-poseído aparece.
- **AC-2** — "Mis alojamientos" aparece dentro del grupo Anfitrión (no en un grupo de
  actividad suelto).
- **AC-3** — Existen dos puertas de descubrimiento que llevan a páginas-hub internas
  con explicación + botón por opción; ninguna despliega submenú anidado.
- **AC-4** — La puerta de aliados muestra "Sumate como aliado" sin roles de aliado, y
  "Sumá otra alianza" con ≥1; desaparece con todos adquiridos.
- **AC-5** — El `UserMenu` del avatar muestra solo identidad + atajos curados + sesión;
  no replica el sidebar completo.
- **AC-6** — El menú mobile es una única superficie con acordeón en el orden definido;
  logged-out muestra sitio + auth + idioma/tema.
- **AC-7** — Existe una única config de navegación tipada; sidebar, avatar y hamburguesa
  la consumen (no hay tres listas divergentes).
- **AC-8** — Todo label pasa por `t()` (i18n); cero labels hardcodeados en las tres
  superficies. `pnpm check-locales` sin faltantes.
- **AC-9** — La config declara `requiredPermission` (`PermissionEnum`) por ítem (fuente
  única). El cliente evalúa con permisos reales; el server SSR aproxima vía un único
  mapa `permiso → roles` (per D-4). El panel admin se gatea por `access.panelAdmin`. No
  hay `isHostRole`/`isCommerceOwnerRole` dispersos: el único mapeo rol↔permiso vive
  centralizado.
- **AC-10** — `pnpm typecheck`, `pnpm lint`, `pnpm test` verdes.

## 10. Risks

- **R-1** — Colapsar tres definiciones en una toca superficies muy visibles (header,
  sidebar, mobile). Regresiones de navegación son de alto impacto → cobertura de tests
  por superficie y verificación visual.
- **R-2** — El modelo de "puertas con estado" (adquirido vs disponible) necesita saber,
  por usuario, qué verticales/roles ya tiene. Definir la fuente de esa señal
  (permisos/entitlements) sin N llamadas extra.
- **R-3** — Migrar labels hardcodeados a i18n puede exponer faltantes de traducción en
  en/pt.

## 11. Open questions

- **OQ-1** — Ruta y layout exactos de las páginas-hub internas ("Publicá en Hospeda" /
  "Sumate como aliado"): ¿`/mi-cuenta/publica`, `/mi-cuenta/aliados/sumate`? ¿Reusan un
  layout de hub genérico?
- **OQ-2** — Ubicación canónica de la config de navegación tipada
  (`apps/web/src/config/` vs `src/lib/navigation/`) y su forma exacta.
- **OQ-3** — Señal por-usuario para el estado de las puertas: ¿de permisos, de
  entitlements de billing, o de una consulta de "verticales activos"? Definir sin
  penalizar el render.
- **OQ-4** — ¿El atajo del avatar al "panel del rol activo" maneja el caso multi-rol
  (host + comercio) mostrando ambos, o prioriza uno?
- **OQ-5** — ¿Se conserva el toggle contextual del sidebar dentro de `/mi-cuenta` en
  mobile, o el hamburguesa es la única puerta? Si se conserva, debe leer la misma
  config (no una cuarta lista).

## 12. Implementation notes

- Fase 2 crea worktree + branch de implementación (`spec-hos-131-account-menu-ia`).
- El trabajo real se reparte en, tentativamente: (a) la config única + tipos + i18n;
  (b) refactor del sidebar a la nueva IA; (c) refactor del `UserMenu` curado; (d)
  refactor del hamburguesa mobile; (e) las dos páginas-hub con estado de puertas.
- Consultar el patrón existente de `navGroups` en `AccountLayout.astro` y los helpers de
  `account-roles.ts` antes de reescribir el gating.
- La spec de sponsors (HOS-107) y los futuros verticales de gastronomía/experiencias son
  consumidores naturales de la puerta "Aliados"/"Publicá" — coordinar naming.

## 13. Linear

Canonical tracking:
HOS-131 — <https://linear.app/hospeda-beta/issue/HOS-131>
