---
title: F4. Baja por plantilla
linear: HOS-2639
parent: HOS-2635
statusSource: linear
created: 2026-11-25
blockedBy: [HOS-2637]
coordinateWith: [HOS-2567]
smokeLabels: [status-needs-smoke-staging]
---

# F4. Baja por plantilla (HOS-2639)

Paraguas: [spec.md](./spec.md). Decisión aplicable: D-10. Este PR es el que lleva
`Closes HOS-2635` además de `Closes HOS-2639`.

## 1. Objetivo

Que cada email generado por una plantilla tenga, además de la baja global, un link
"no recibir más este resumen" que da de baja **sólo esa plantilla**, y que el suscriptor
vea y revierta esas bajas desde su perfil.

## 2. Alcance

**Incluye**
- Tabla `newsletter_schedule_optouts` (spec §9).
- Token HMAC con scope `schedule_optout` sobre `newsletter-token.helpers.ts`, con separación estricta del token de baja global (H-13).
- Link en el footer de los emails con `schedule_id`, con el `public_name` del idioma.
- Página web `/{lang}/newsletter/baja-resumen/` (session-blind) con confirmación por `POST`.
- Exclusión en `getEligibleForCampaign` y re-chequeo en `processBatch`.
- Sección de perfil "Resúmenes que no recibís" con revertir, coordinada con HOS-2567.
- Conteo de bajas por plantilla en el detalle del admin.

**No incluye**
- `contentType` `digest` (diferido, D-10).
- Cambiar la baja global. Desde HOS-2617 funciona: página `/{lang}/newsletter/unsubscribe/`
  con POST y header RFC 8058 (H-12).
- Cambiar el header `List-Unsubscribe`: en los mails de plantilla sigue apuntando a la baja
  **global** (`newsletter-delivery.service.ts:690-700`). Se mantiene global (OQ-7, decidida 2026-11-25).

## 3. Dependencias

- HOS-2637 (F2): `schedule_id` en campañas y `public_name` en cuerpos.
- HOS-2567: no tiene código ni carpeta de spec en staging. Pista: el footer de usuario de
  HOS-2565 ya enlaza `EMAIL_PREFERENCES_URL = .../es/mi-cuenta/preferencias/`
  (`packages/email/src/email-assets.ts:22`, texto "Elegí qué correos recibís"), y esa página
  no existe en `apps/web/src/pages/[lang]/mi-cuenta/`. Lo más probable es que sea la de
  HOS-2567. Hasta que exista, la sección va en `mi-cuenta/newsletter.astro`, como isla
  aislada para poder moverla sin tocar su lógica. Acordar ubicación antes de T-F4-09.

## 4. Diseño

### 4.1 Token

```ts
/** Input for {@link generateScheduleOptOutToken}. */
export interface GenerateScheduleOptOutTokenInput {
    readonly subscriberId: string;
    readonly scheduleId: string;
    readonly channel: NewsletterTokenChannel;
    readonly secret: string;
}
export function generateScheduleOptOutToken(input: GenerateScheduleOptOutTokenInput): string;
export function verifyScheduleOptOutToken(input: VerifyUnsubscribeTokenInput)
    : { readonly subscriberId: string; readonly scheduleId: string; readonly channel: NewsletterTokenChannel };
```

- Payload `{ sid, ch, scp: 'schedule_optout', sch }`, estable (sin `iat`), mismo HMAC y
  rotación con `secretPrev`.
- `verifyScheduleOptOutToken` exige `scp === 'schedule_optout'` y `sch` UUID.
- `verifyUnsubscribeToken` (`newsletter-token.helpers.ts:295-323`) hoy sólo exige que
  `sid` y `ch` sean strings (`:309-310`): un token con scope verificaría como baja global
  (H-13). Pasa a **rechazar** cualquier payload con `scp`. Los tokens globales existentes
  no tienen `scp`, así que siguen funcionando (compatibilidad). El único consumidor es
  `unsubscribeByToken` (`newsletter-subscriber.service.ts:926-943`), que atiende tanto la
  página como el one-click RFC 8058.

### 4.2 Link y página

- El link se arma en `packages/utils/src/newsletter-links.ts`, la fuente única de URLs de
  baja desde HOS-2617: `NEWSLETTER_SCHEDULE_OPTOUT_PAGE_PATH = 'newsletter/baja-resumen'`
  y `buildNewsletterScheduleOptOutPageUrl({ siteUrl, locale, token })`, con la misma forma
  que `buildNewsletterUnsubscribePageUrl` (`:46-53`, barra final y `encodeURIComponent`).
  El guard `apps/web/test/pages/newsletter-unsubscribe-link-target.guard.test.ts` se
  extiende para que la constante nueva también tenga que corresponder a un archivo de
  `apps/web/src/pages/[lang]/`. El slug va en español como 4 de las 5 páginas hermanas
  (`confirmado`, `desuscripto`, `error`, `confirma-tu-email`); la excepción es `unsubscribe`.
- `processBatch` (y `sendTestEmailFromContent`) reciben `schedule_id` de la campaña; si no
  es null, generan el token con scope junto al global (`newsletter-delivery.service.ts:677-689`)
  y el componente `NewsletterCampaign` muestra "No recibir más «{public_name}»" junto a
  "Darme de baja" (`newsletter-campaign.tsx:84-94`).
- La página copia el patrón de `apps/web/src/pages/[lang]/newsletter/unsubscribe.astro`:
  `DefaultLayout` con `noindex`, `StatusPage`, lee sólo `token` del query y monta una isla
  `ScheduleOptOutConfirm.client.tsx` hermana de `NewsletterUnsubscribeConfirm.client.tsx`,
  que hace `POST` al click. El `GET` no cambia nada: los escáneres de links no pueden dar
  de baja a nadie (R-8). Guard `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts`.
- Tras confirmar, muestra el nombre del resumen y un link al perfil para revertir.

### 4.3 API

| Ruta | Respuesta |
|---|---|
| `POST /api/v1/public/newsletter/schedule-optout` `{ token }` | 200 `{ status: 'opted_out' \| 'already_opted_out', publicName }`. Mismo mapeo que `unsubscribe-post.ts:57-94`: token ausente o de más de 1024 caracteres → 400 `VALIDATION_ERROR` (`NEWSLETTER_TOKEN_INVALID`); firma inválida o scope incorrecto → 401 `UNAUTHORIZED` (`NEWSLETTER_TOKEN_INVALID`); suscriptor o plantilla inexistente → 404 `NOT_FOUND`. Se registra en `createRouter()` de `public/index.ts:136-141` con el `unsubscribeRateLimiter` (20/min, `:109-112`). |
| `GET /api/v1/protected/newsletter/schedule-optouts` | 200 lista `{ scheduleId, publicName, optedOutAt }` del suscriptor de la sesión; `publicName` en el idioma del suscriptor con fallback `es`, desde la versión vigente. Sin suscripción → lista vacía. |
| `DELETE /api/v1/protected/newsletter/schedule-optouts/{scheduleId}` | 200 `{ status: 'reverted' }`; ajeno o inexistente → 404. Idempotencia: una baja ya revertida → 404 (no existe la fila). |

Una plantilla `ended` acepta igual la baja (idempotente) y sigue en el perfil.

### 4.4 Elegibilidad

`getEligibleForCampaign` gana `excludeOptedOutOfScheduleId?: string`:

```sql
AND NOT EXISTS (
  SELECT 1 FROM newsletter_schedule_optouts o
  WHERE o.subscriber_id = ns.id AND o.schedule_id = :excludeOptedOutOfScheduleId
)
```

Lo pasan siempre las campañas con `schedule_id`. `processBatch` vuelve a mirar las bajas
de los suscriptores del lote y marca `skipped` las entregas de quien se dio de baja entre
el despacho y el lote (mismo trato que un suscriptor inactivo).

## 5. Archivos a tocar

| Archivo | Cambio |
|---|---|
| `packages/db/src/schemas/newsletter/newsletter_schedule_optouts.dbschema.ts` | nuevo + `index.ts` + `db:generate` |
| `packages/service-core/src/services/newsletter/newsletter-token.helpers.ts` | generar/verificar con scope; el global rechaza `scp` |
| `packages/service-core/src/services/newsletter/schedule/newsletter-schedule-optout.service.ts` | nuevo: optOutByToken, listOwn, revertOwn, countBySchedule |
| `packages/service-core/src/services/newsletter/newsletter-subscriber.service.ts` | `excludeOptedOutOfScheduleId` |
| `packages/utils/src/newsletter-links.ts` | constante y builder de la página de baja por plantilla |
| `apps/web/test/pages/newsletter-unsubscribe-link-target.guard.test.ts` | cubre la constante nueva |
| `packages/service-core/src/services/newsletter/newsletter-delivery.service.ts` | link por destinatario (`:670-717`) y re-chequeo en el lote |
| `packages/notifications/src/templates/newsletter/newsletter-campaign.tsx` | prop `scheduleOptOut?: { url, label }` |
| `packages/schemas/src/entities/newsletter/newsletter-schedule-optout.schema.ts` | nuevo: body, respuestas |
| `apps/api/src/routes/newsletter/public/schedule-optout-post.ts` | nuevo, handler como `unsubscribe-post.ts` |
| `apps/api/src/routes/newsletter/public/index.ts` | registrar con `.post('/schedule-optout', unsubscribeRateLimiter, ...)` |
| `apps/api/src/routes/newsletter/protected/schedule-optouts.ts` | nuevo, `createProtectedRoute` |
| `apps/api/src/routes/newsletter/protected/index.ts` | registrar |
| `apps/api/src/routes/newsletter/admin/schedules.ts` | `optOutCount` en el detalle |
| `apps/web/src/pages/[lang]/newsletter/baja-resumen.astro` | nuevo |
| `apps/web/src/components/newsletter/ScheduleOptOutConfirm.client.tsx` + `.module.css` | nuevo |
| `apps/web/src/components/newsletter/NewsletterScheduleOptOuts.client.tsx` + `.module.css` | nuevo, sección de perfil |
| `apps/web/src/pages/[lang]/mi-cuenta/newsletter.astro` | montar la sección (coordinar HOS-2567) |
| `packages/i18n/src/locales/{es,en,pt}/` | textos de footer, página y perfil |

## 6. Criterios de aceptación

- **AC-F4-1 Link en el footer.** Dada una campaña con `schedule_id` y `public_name: 'Lo más visto de la semana'`, cuando se renderiza para un suscriptor `es`, entonces el HTML contiene la baja global y "No recibir más «Lo más visto de la semana»" apuntando a `/es/newsletter/baja-resumen/?token=`.
- **AC-F4-2 Campañas manuales sin link.** Dada una campaña sin `schedule_id`, entonces el HTML no contiene el link de baja por plantilla.
- **AC-F4-3 GET no da de baja.** Dado un `GET` a `/es/newsletter/baja-resumen/?token=<válido>`, cuando responde, entonces no existe fila en `newsletter_schedule_optouts`.
- **AC-F4-4 POST da de baja.** Dado un token válido, cuando se hace `POST /schedule-optout`, entonces existe la fila `(subscriber, schedule)`, responde `opted_out`, y un segundo `POST` responde `already_opted_out` sin duplicar.
- **AC-F4-5 Scope estricto, sentido 1.** Dado un token de baja por plantilla, cuando se usa en `POST /api/v1/public/newsletter/unsubscribe` (como body JSON y como query del one-click RFC 8058), entonces responde 401 `NEWSLETTER_TOKEN_INVALID` y el suscriptor sigue `active`.
- **AC-F4-6 Scope estricto, sentido 2.** Dado un token de baja global, cuando se usa en `POST /schedule-optout`, entonces 401 y no hay fila.
- **AC-F4-7 Tokens globales viejos.** Dado un token de baja global emitido antes de F4, cuando se usa en la baja global, entonces sigue funcionando.
- **AC-F4-8 Rotación.** Dado un token firmado con el secreto anterior y `HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV` seteado, cuando se usa, entonces la baja funciona.
- **AC-F4-9 Exclusión en la próxima edición.** Dado un suscriptor con baja de la plantilla P, cuando corre la siguiente edición de P, entonces no recibe entrega, y sí recibe una campaña manual y una edición de otra plantilla Q.
- **AC-F4-10 Baja entre despacho y lote.** Dada una baja registrada después del `send()` y antes del lote, cuando se procesa el lote, entonces su entrega queda `skipped` y no se llama al transporte para esa dirección.
- **AC-F4-11 Perfil lista.** Dado un usuario logueado con dos bajas, cuando pide `GET /schedule-optouts`, entonces recibe dos ítems con `publicName` en su idioma (fallback `es` si la versión vigente no tiene cuerpo en ese idioma).
- **AC-F4-12 Revertir.** Dado ese usuario, cuando hace `DELETE /schedule-optouts/{P}`, entonces la fila desaparece y la próxima edición de P le llega.
- **AC-F4-13 Ajeno da 404.** Dado otro usuario que hace `DELETE /schedule-optouts/{P}` sobre una baja que no es suya, entonces 404 y la fila sigue; sin sesión, 401.
- **AC-F4-14 Session-blind.** Dada la página nueva, cuando corre el guard de páginas, entonces pasa.
- **AC-F4-15 Conteo en admin.** Dada una plantilla con 3 bajas, cuando un admin con `newsletter.schedule.view` abre el detalle, entonces ve `optOutCount: 3`.
- **AC-F4-16 Plantilla terminada.** Dada una plantilla `ended`, cuando se usa su link de baja, entonces responde `opted_out` igual.
- **AC-F4-17 One-click sigue global.** Dada una edición de plantilla, cuando se inspeccionan los headers del mensaje, entonces `List-Unsubscribe` apunta a `/api/v1/public/newsletter/unsubscribe` con el token global (OQ-7, decidida).
- **AC-F4-18 Link sin página.** Dada la constante `NEWSLETTER_SCHEDULE_OPTOUT_PAGE_PATH` cambiada a una ruta inexistente, cuando corre `newsletter-unsubscribe-link-target.guard.test.ts`, entonces falla.

## 7. Plan de tests

| Nivel | Suite | Qué |
|---|---|---|
| Unit | `packages/service-core/test/services/newsletter/newsletter-token.helpers.test.ts` | AC-F4-5..8 a nivel helper, incluidos payloads con `scp` alterado |
| Unit | `packages/service-core/test/services/newsletter/schedule/newsletter-schedule-optout.service.test.ts` (nuevo) | AC-F4-4, 11..13, 16 |
| Unit | `packages/service-core/test/services/newsletter/newsletter-delivery.service.test.ts` | AC-F4-1, 2, 10 |
| Unit | `packages/notifications/test/templates/newsletter.templates.test.tsx` | footer con y sin link |
| Integración | `packages/service-core/test/integration/services/newsletter-schedule-optout.integration.test.ts` (nuevo) | AC-F4-9 con Postgres real |
| API | `apps/api/test/routes/newsletter/public-schedule-optout.test.ts`, `protected-schedule-optouts.test.ts` (nuevos), `public.test.ts` | AC-F4-4..6, 13; asertar `mock.calls` |
| Web | `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts`, tests de las islas | AC-F4-3, 14 |
| E2E | `apps/e2e/tests/newsletter/schedule-optout-flow.spec.ts` (nuevo) | link → página → confirmar → perfil → revertir |

Mutación mínima: quitar el rechazo de `scp` en `verifyUnsubscribeToken` debe romper AC-F4-5.

## 8. Guards

- Guard de páginas session-blind de `apps/web`.
- `apps/web/test/pages/newsletter-unsubscribe-link-target.guard.test.ts` (extendido, AC-F4-18).
- Guards de i18n (estructura de claves en es/en/pt).
- Contrato de errores: ajeno = 404, 401 antes que nada, el tier público no exige permisos de escritura.
- `scripts/check-schema-drift.sh`.

## 9. Smoke (staging)

Label `status-needs-smoke-staging`. Se necesita staging porque lo que se prueba es un
email real con su footer, el link en un cliente de correo real (con su prefetch) y la
siguiente edición del cron:

1. Recibir una edición en una casilla real, abrir el link de baja por plantilla desde Gmail y desde Outlook: sin confirmar, no hay baja (prefetch inofensivo).
2. Confirmar: la siguiente edición no llega; una campaña manual sí.
3. Revertir desde el perfil: la siguiente edición llega.
4. La baja global sigue funcionando con un token viejo.

## 10. Tareas (orden de implementación)

1. **T-F4-01** Tabla `newsletter_schedule_optouts` + `db:generate`. (1h)
2. **T-F4-02** Token con scope y rechazo de `scp` en el global + tests AC-F4-5..8. (1.5h)
3. **T-F4-03** Servicio de bajas (optOutByToken, listOwn, revertOwn, countBySchedule) + tests. (2h)
4. **T-F4-04** `excludeOptedOutOfScheduleId` en elegibilidad + test de integración AC-F4-9. (1.5h)
5. **T-F4-05** Builder en `newsletter-links.ts` + guard extendido, link en footer y re-chequeo en el lote + tests AC-F4-1, 2, 10, 17, 18. (2h)
6. **T-F4-06** Ruta pública `POST /schedule-optout` + tests. (1.5h)
7. **T-F4-07** Rutas protegidas list/delete + tests AC-F4-13. (1.5h)
8. **T-F4-08** Página `baja-resumen.astro` + isla de confirmación + guard session-blind. (2h)
9. **T-F4-09** Sección de perfil (coordinada con HOS-2567) + tests de la isla. (2h)
10. **T-F4-10** `optOutCount` en admin + i18n + e2e `schedule-optout-flow.spec.ts`. (1.5h)
