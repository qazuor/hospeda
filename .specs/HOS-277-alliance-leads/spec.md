---
title: Alliance leads (partner / sponsor / editor / service_provider)
linear: HOS-277
statusSource: linear
created: 2026-07-23
type: feature
areas:
  - web
  - api
  - db
  - admin
  - content
---

# Alliance leads (partner / sponsor / editor / service_provider)

## 1. Summary

Reemplazar los botones "Próximamente" del door `partner` en `/mi-cuenta/aliados`
por **leads calificados tipados**. Cada uno de los 4 kinds
(`partner`, `sponsor`, `editor`, `service_provider`) obtiene una página/landing
propia con copy explicativo (qué es, beneficios) y un formulario específico que
**persiste** en una tabla nueva y llega a una **bandeja de admin**. El admin
evalúa el lead y da de alta a mano — NO es un alta self-service.

## 2. Problem

Hoy las tres tarjetas "Próximamente" del door aliados (`sponsor`, `partner`,
`service_provider`) y la cuarta activa (`editor`) resuelven mal el flujo de
captación:

- `sponsor` / `partner` / `service_provider` están hardcodeadas como
  `comingSoon: true` en `apps/web/src/config/discovery-doors.ts` y su botón
  apunta al form genérico `/contacto`. No hay copy que explique qué es cada
  programa ni qué se gana sumándose, y el lead cae en el buzón de soporte
  genérico sin tipar ni persistir.
- `editor` sí tiene página propia (`/colaborar/editores`) pero usa
  `ContributionForm` → `POST /api/v1/public/contact` con `skipDb: true`: **no
  persiste nada**, solo dispara un email. No hay bandeja de admin ni registro
  trazable del estado del lead.

Resultado: no hay forma de captar de manera estructurada a aliados, sponsors,
proveedores o editores, ni de que un admin gestione esos leads con un ciclo de
estados.

## 3. Goals

- G-1: Una página/landing propia por kind con copy (qué es + beneficios).
- G-2: Un formulario específico por kind que capture info relevante del caso.
- G-3: El lead **persiste** en una tabla nueva (`alliance_leads`) con un ciclo
  de estados `pending → reviewing → approved/rejected`.
- G-4: Una **bandeja de admin** para listar/filtrar por `kind` y `status`, y
  aprobar/rechazar con nota (`mark-handled`), clonada del patrón existente
  `CommerceLeadInbox`.
- G-5: Migrar `editor` del molde `ContributionForm` (que no persiste) a este
  nuevo flujo, unificando los 4 kinds.
- G-6: Cablear el door aliados: quitar `comingSoon` y apuntar cada tarjeta a su
  landing nueva.

## 4. Non-goals

- NG-1: **Alta self-service**. El admin siempre da de alta a mano; NO se crea
  automáticamente ningún rol/entidad al aprobar un lead (eso es follow-up).
- NG-2: **Lógica de billing / descuentos**. El copy de editor menciona
  beneficios en la suscripción, pero es SOLO copy — no hay cálculo, ni vínculo
  editor↔billing, ni sistema de descuentos. El admin aplica descuentos a mano.
- NG-3: **Columnas custom por kind**. Para V1 los campos específicos se
  serializan en `message`; no hay columnas tipadas por tipo (follow-up).
- NG-4: **Desbloquear el rol `sponsor`**. El bug F-1 (HOS-107) que impide
  activar el rol sponsor es independiente; captar el lead no lo toca.
- NG-5: **Reusar `commerce_leads`**. Se descartó a favor de una tabla paralela
  (ver Open questions resueltas).

## 5. Current baseline

- **Door aliados**: `apps/web/src/pages/[lang]/mi-cuenta/aliados/index.astro`
  renderiza `DiscoveryDoorHub.astro` con las opciones del door `partner` de
  `apps/web/src/config/discovery-doors.ts` (opciones: `sponsor`, `partner`,
  `serviceProvider`, `editor`). El estado `comingSoon` lo resuelve
  `resolveDoorOptionState()` en `apps/web/src/lib/nav-gating.ts`.
- **Molde de referencia (a clonar)** — `CommerceLead`:
  - Landing repetible: `apps/web/src/pages/[lang]/publicar-restaurante/` y
    `.../publicar-experiencia/` (esta última clonada de la primera).
  - Form: `apps/web/src/components/gastronomy/CommerceLead.client.tsx` (campos
    de negocio, no genéricos; prop `domain`).
  - Schema: `packages/schemas/src/entities/commerce-lead/commerce-lead.schema.ts`
    (ciclo `CommerceLeadStatusEnum`: pending/reviewing/approved/rejected).
  - Endpoint público: `POST /api/v1/public/commerce/leads`
    (`apps/api/src/routes/commerce/public/create-lead.ts` — honeypot `_hp`,
    rate-limit 5/min), persiste en tabla `commerce_leads`.
  - Bandeja admin: `GET /api/v1/admin/commerce/leads`
    (`apps/api/src/routes/commerce/admin/list-leads.ts`, gate
    `COMMERCE_VIEW_ALL`) + `apps/admin/src/features/commerce-leads/components/CommerceLeadInbox.tsx`
    (tabla paginada, filtro por status, acción "Handle" = approve/reject + nota).
- **Molde débil (a reemplazar para editor)** — `ContributionForm`:
  - `apps/web/src/pages/[lang]/colaborar/editores/index.astro` +
    `apps/web/src/components/contributions/ContributionForm.client.tsx`.
  - `POST /api/v1/public/contact` (`apps/api/src/routes/contact/submit.ts`) llama
    `sendNotification(payload, { skipDb: true, skipLogging: true })` — **no
    persiste**. Campos genéricos (firstName/lastName/email/message). Sin bandeja
    de admin.
- **service_provider = HostTrade**: el directorio que el usuario ve en
  `/mi-cuenta/directorio-proveedores` es `HostTrade`
  (`packages/schemas/src/enums/permission.enum.ts` — "Admin-curated host
  trades/services directory (SPEC-241). Host-only read perk; admin-only CRUD").
  El lead de `service_provider` es una solicitud para que el admin cargue ese
  proveedor en HostTrade.

## 6. Proposed design

### 6.1 Tabla / dominio nuevo `alliance_leads`

Tabla paralela, discriminada por `kind`, con el mismo ciclo de estados que
`commerce_leads`. No se reusa `commerce_leads` para no arrastrar el permiso
`COMMERCE_VIEW_ALL` ni el botón "Approve & provision" (que crea
`COMMERCE_OWNER`, sin sentido para estos kinds).

### 6.2 Frontend: 4 landings + form por kind

- Una página `.astro` por kind bajo una ruta a definir (p. ej.
  `/sumate/partner`, `/sumate/sponsor`, `/sumate/proveedor`, `/colaborar/editores`
  — este último se reescribe sobre el nuevo molde). Estructura clonada del
  molde `publicar-*`: hero + copy (i18n) + componente de form `client:load`.
- Un componente de form reutilizable que recibe `kind` como prop y renderiza:
  - Campos **genéricos** (todos los kinds): `contactName`, `email`, `phone`
    (opt), `message`.
  - Campos **específicos** por kind (solo UI + validación en front). Al enviar,
    los específicos se **serializan dentro de `message` con labels** (ver §7.3),
    de modo que el payload al backend solo lleve genéricos + `message` + `kind`.
- Honeypot + rate-limit equivalentes al molde commerce.

### 6.3 Backend: rutas mínimas

- `POST /api/v1/public/alliance/leads` — crea el lead (público, honeypot,
  rate-limit). Persiste genéricos + `kind` + `message`, status inicial `pending`.
- `GET /api/v1/admin/alliance/leads?kind=&status=` — bandeja de admin, gate por
  un permiso nuevo `ALLIANCE_LEAD_VIEW_ALL` (o el que se defina en §7.4).
- `POST|PATCH /api/v1/admin/alliance/leads/:id/mark-handled` — approve/reject +
  `adminNote`.

### 6.4 Admin: bandeja

Clonar `CommerceLeadInbox.tsx` ~1:1 en una feature `alliance-leads`, con columna
`kind`, filtro por `status` y `kind`, y acción "Handle" (approve/reject + nota).
**Sin** botón "Approve & provision" (el provisioning es manual en V1).

### 6.5 Door aliados

En `discovery-doors.ts`, para `sponsor`/`partner`/`serviceProvider`: quitar
`comingSoon: true` y cambiar `href` de `'contacto'` a la landing respectiva. La
máquina de estados de `nav-gating.ts` ya soporta esto sin cambios.

### 6.6 Copy de editor (cross-incentivo)

La landing de editor incluye copy que invita a dueños de alojamiento / partners a
colaborar como editores para acceder a beneficios/descuentos en su suscripción
("consultanos"). Es SOLO copy — sin ninguna lógica de billing (ver NG-2).

## 7. Data model / contracts

### 7.1 Enum de kinds

`AllianceLeadKindEnum`: `partner | sponsor | editor | service_provider`
(en `@repo/schemas`). El `kind` es cerrado (a diferencia del `domain` abierto de
commerce) porque acá los 4 valores son conocidos y acotados.

### 7.2 Tabla `alliance_leads` (columnas V1)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `kind` | varchar/enum | discriminador |
| `contactName` | text | requerido |
| `email` | text | requerido |
| `phone` | text | opcional |
| `message` | text | genérico + custom serializado (§7.3) |
| `status` | varchar/enum | `pending/reviewing/approved/rejected` |
| `adminNote` | text | opcional, seteado en mark-handled |
| timestamps | | createdAt/updatedAt + soft-delete por convención BaseModel |

Migración estructural vía `pnpm db:generate` + `pnpm db:migrate` (carril 1).
Sin seed data live → no aplica la regla de dual-write.

### 7.3 Serialización de campos custom en `message`

El form front arma un `message` con labels legibles, p. ej. para `partner`:

```
Nombre del negocio: Acme SA
Sitio web: https://acme.com
Tipo de alianza: Agencia de turismo

Mensaje:
<texto libre del usuario>
```

Campos específicos por kind (solo front, van al `message`):

- `partner`: businessName, website, partnershipType
- `sponsor`: businessName, website, sponsorshipInterest
- `service_provider`: businessName, serviceType, coverageArea, website
- `editor`: portfolioLinks, topics, experience (sin businessName — es B2C)

### 7.4 Schemas Zod

- `AllianceLeadCreateSchema` (payload público): `kind`, `contactName`, `email`,
  `phone?`, `message`, `_hp?` (honeypot).
- `AllianceLeadSchema` (entidad completa) + `AllianceLeadStatusEnum`.
- `AllianceLeadAdminListQuerySchema`: `kind?`, `status?`, paginación.
- `AllianceLeadMarkHandledSchema`: `status` (approved/rejected), `adminNote?`.

### 7.5 Permisos

Definir el/los permiso(s) de la bandeja admin (p. ej. `ALLIANCE_LEAD_VIEW_ALL`,
`ALLIANCE_LEAD_MANAGE`) en `PermissionEnum` y asignarlos al rol admin en el seed
de rolePermissions (carril seed si aplica a env vivo).

## 8. UX / UI behavior

- Cada landing: hero con título + subtítulo + bloque de beneficios (3-4 bullets)
  - el form. Todo el texto vía i18n (`es`/`en`/`pt`).
- El form valida en front (campos requeridos, email, url de website) antes de
  enviar. Éxito → mensaje de confirmación ("recibimos tu solicitud, te
  contactamos"). Error → mensaje genérico.
- Door aliados: las tarjetas dejan de mostrar el badge "Próximamente" y pasan a
  ser CTA que llevan a la landing.

## 9. Acceptance criteria

- AC-1: Existen 4 landings (una por kind) con copy propio en `es`/`en`/`pt`.
- AC-2: Cada form envía un lead que **persiste** en `alliance_leads` con el
  `kind` correcto y status `pending`.
- AC-3: Los campos específicos por kind aparecen serializados con labels dentro
  de `message`.
- AC-4: La bandeja de admin lista los leads, filtra por `kind` y `status`, y
  permite approve/reject con nota (que persiste en `adminNote` + cambia status).
- AC-5: El door aliados ya no muestra "Próximamente" para
  sponsor/partner/service_provider; cada tarjeta lleva a su landing.
- AC-6: `editor` usa el nuevo flujo (persiste); el viejo `ContributionForm` para
  editor queda retirado o redirigido.
- AC-7: NO se crea ningún rol/entidad automáticamente al aprobar (alta manual).
- AC-8: El copy de editor menciona el cross-incentivo sin ninguna lógica de
  billing asociada.
- AC-9: Endpoint público con honeypot + rate-limit (paridad con commerce leads).

## 10. Risks

- R-1: Spam en el endpoint público. Mitigación: honeypot + rate-limit como en
  commerce.
- R-2: Confusión conceptual `service_provider` vs HostTrade vs commerce leads.
  Mitigación: documentar claramente que el lead alimenta HostTrade y que el
  admin lo carga a mano.
- R-3: Migrar `editor` puede dejar el enum `ContactTypeEnum` con
  `editor_application` huérfano. Mitigación: decidir si se deja por compat o se
  deprecia limpiamente.
- R-4: Footgun Linear/GitHub: el PR de docs lleva `HOS-277` en el título; ver
  §12 (la automation de auto-close ya fue resuelta el 2026-07-02, pero
  spot-check post-merge).

## 11. Open questions

Resueltas en la sesión de definición con el owner (2026-07-23):

- OQ-1 (resuelta): ¿Reusar `commerce_leads` o tabla paralela? → **Tabla
  paralela** `alliance_leads`.
- OQ-2 (resuelta): ¿Approve auto-provisiona o alta manual? → **Alta manual en
  V1** + follow-up para automatizar.
- OQ-3 (resuelta): ¿Campos custom estructurados o serializados? → **Serializados
  en `message`** en V1 + follow-up para estructurarlos.

Pendientes para la fase de implementación:

- OQ-4: Ruta exacta de las landings (`/sumate/*` vs otra convención).
- OQ-5: Nombre exacto del/los permiso(s) de la bandeja admin.
- OQ-6: ¿`editor_application` en `ContactTypeEnum` se deprecia o se deja por
  compat? (ver R-3).

## 12. Implementation notes

- Fase 1 (esta spec) NO crea worktree — branch de docs liviana + PR a `staging`.
- Fase 2 (implementación) creará worktree `spec-hos-277-alliance-leads`.
- **Follow-up issues a crear** (no en esta spec):
  1. Automatizar el provisioning en el approve (HostTrade / rol sponsor /
     partner).
  2. Migrar los campos custom serializados en `message` a columnas
     estructuradas/filtrables.
- Molde a clonar en cada capa: `CommerceLead` (front, schema, rutas, bandeja).
- Footgun Linear conocido (RESUELTO 2026-07-02): no poner magic words
  (`Closes/Fixes/Resolves`) en el PR de docs; spot-check el estado de HOS-277
  tras el merge.

## 13. Linear

Canonical tracking:
HOS-277
