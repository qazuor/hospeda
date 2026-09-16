# Relevamiento carril WEB — paridad billing verticales (HOS-1257)

Worktree: /home/qazuor/projects/WEBS/hospeda-hos-1257-paridad-billing-verticales
Herramientas: Read/Grep/Glob/Bash (rg/fd) únicamente. Sin codegraph, sin edits.

## 1. Inventario de páginas billing-relevantes

- /planes/anfitriones, /planes/gastronomia, /planes/experiencias, /planes/turistas, /planes/aliados (+ /precios/ hijas) — landing+pricing por vertical.
- /suscriptores/planes/*, /suscriptores/turistas/*, /suscriptores/checkout/* — legacy tourist/accommodation checkout surface (aún vivo, separado de /planes/).
- /publicar/index.astro (accommodation), /publicar/gastronomia, /publicar/experiencias — landing+form unificado (HOS-1156).
- /publicar-experiencia, /publicar-restaurante — shims que 301/redirect a PUBLISH_PAGE_PATH_BY_VERTICAL.
- /mi-cuenta/suscripcion — dashboard único para las 3 verticales vía ?domain=.
- /mi-cuenta/comercio (index + nuevo/[vertical] + [vertical]/[id]/editar/*) — gestión comercio.
- /mi-cuenta/propiedades — gestión accommodation (asimétrico: comercio vive bajo /comercio, accommodation bajo /propiedades, no unificado).
- /mi-cuenta/canjear, /canjear/[code] — redeem promo, genérico (sin vertical propio visible).
- /mi-cuenta/addons — addons (accommodation-flavored, no revisado a fondo, fuera de foco por tiempo).
- /mi-cuenta/partner, /mi-cuenta/proveedor, /mi-cuenta/aliados — partner-specific.

## 2. Llamadas API con/sin `?domain=` (o `productDomain`)

| archivo:línea | endpoint | domain/productDomain pasado | vertical del caller |
|---|---|---|---|
| lib/billing/fetch-plans.ts:83-89 | GET /public/plans | opcional, param del caller | genérico (correcto) |
| pages/planes/gastronomia/index.astro:77 | fetchPublicPlans | `{domain:'gastronomy'}` | OK |
| pages/planes/experiencias/index.astro:69 | fetchPublicPlans | `{domain:'experience'}` | OK |
| pages/planes/turistas/index.astro:69 | fetchPublicPlans | SIN domain (default accommodation) | OK — tourist plans viven bajo domain accommodation |
| lib/billing/audience-plans.ts:190 | fetchPublicPlans | domain por audiencia (host=undef→accommodation, gastronomy, experience, partner) | OK |
| lib/billing/audience-plans.ts:452-456 | fetchPublicPlans x4 | accommodation(default)+gastronomy+experience+partner en paralelo | OK |
| pages/mi-cuenta/suscripcion/index.astro:142 | fetchPublicPlans | `isCommerceDomain ? {domain:productDomain} : {}` | OK |
| pages/mi-cuenta/comercio/index.astro:109 | fetchPublicPlans | `{domain: vertical}` por cada vertical con listings | OK |
| pages/publicar/index.astro:113 | fetch directo `/protected/billing/trial/status` | SIN domain param (endpoint no lo acepta) | accommodation-only page, consistente |
| lib/api/endpoints-protected.ts:1400 (getTrialStatus) | GET /protected/billing/trial/status | sin domain — endpoint es user-scoped, no vertical-scoped | usado solo por accommodation |
| lib/api/endpoints-protected.ts:1494 (getTrialEligibility) | GET /protected/billing/trial-eligibility | sin domain | usado por PlanPurchaseButton (accommodation/tourist) |
| lib/api/endpoints-protected.ts:4071 (accommodationEligibility) | GET /protected/accommodations/publish-eligibility | N/A — literalmente accommodation-only en el path | sin equivalente comercio (ver hallazgo H-05) |
| components/account/SubscriptionDashboard.client.tsx:685,712 | userApi.getSubscription | `{productDomain}` | OK, prop pasada desde la page |
| lib/commerce/usage-badge.ts:64 | GET /protected/billing/usage/:limitKey | `params:{productDomain: vertical}` explícito | OK |
| lib/host/usage-badge.ts:96,204 | GET /protected/billing/usage/:limitKey | SIN productDomain (default accommodation) | OK, consistente con default backend |
| lib/api/endpoints-protected.ts:838 (pauseSubscription) | POST /protected/billing/subscriptions/pause (sin id) | SIN domain, sin subscriptionId — "targets the caller's own active subscription" | invocado desde SubscriptionDashboard sin distinguir vertical (ver H-01) |
| lib/api/endpoints-protected.ts:759 (cancelSubscription) | POST /protected/billing/subscriptions/:id/cancel | usa subscriptionId explícito (no domain, pero unívoco por id) | OK |
| lib/publish/publish-page-slot.ts:126-137 (buildSubscriptionUrl) | link a /mi-cuenta/suscripcion | agrega `?domain=vertical` para gastronomy/experience, nada para accommodation (default) | OK |

## 3-4. UX trial: alta + promesa de precios

- **Accommodation** (`publicar/index.astro`): 52 menciones de "trial" en el archivo. Trae `resolveGenericOwnerTrialDays()`, muestra banner de trial expirado, callout "✨ N días gratis" en el hero, y pasa `trialDays` al `CreatePropertyMiniForm` que renderiza su propio `form-trial-callout` (líneas 1772-1795 del form).
- **Gastronomy/Experience** (`publicar/gastronomia/index.astro`, `publicar/experiencias/index.astro`): **0 menciones de "trial"**. Ni hero callout, ni trial expirado, ni el `CommerceCreateForm.client.tsx` (grep de "trial" = 0 resultados) menciona días gratis en ningún lado del formulario de alta.
- Las páginas de precios **sí** prometen trial para comercio: `planes/gastronomia/index.astro:77-83` y `planes/experiencias/index.astro:69-75` resuelven `trialDays` vía `resolveCommerceLandingOffer` y renderizan FAQ `"N días de prueba gratis"` (claves `commerce.landing.gastronomy.faq.a1` / `.experience.faq.a1`, i18n `commerce.json:590-591,651-652`).
- La promesa de trial para comercio SÍ existe en la superficie web, pero recién en `CommerceListingActions.client.tsx` (el checklist de una ficha YA CREADA en `mi-cuenta/comercio`), usando `commerce.owner.checklist.n`/`nNoCount` — un paso completo después de donde accommodation la muestra (en el propio formulario de alta, antes de crear nada).
- Conclusión: la página de precios de gastronomía/experiencias promete "N días gratis" en el momento de decidir publicar, pero el flujo de alta al que esa misma página linkea (mismo dominio, mismo botón "Publicar") no repite ni confirma la promesa hasta un paso posterior. Accommodation sí la repite inmediatamente.

## 5. Elegibilidad "puede publicar"

- `precheck` (cap de creación, vía `publishApi.precheck({vertical, cookieHeader})`, resuelto en `lib/publish/publish-page-slot.ts`) es UNA sola función server-driven, reutilizada literalmente para las 3 verticales (mismo `resolvePublishPageSlot` llamado desde `publicar/index.astro`, `publicar/gastronomia/index.astro`, `publicar/experiencias/index.astro`, con `vertical` como parámetro). Fail-open documentado (D-5) si el precheck falla. **Simétrico.**
- `accommodationEligibility` ("puede poner en vivo una ficha ya creada" / trial-vs-pago) es una función DISTINTA, y su propio docblock (endpoints-protected.ts:4034-4058) dice explícitamente: *"Accommodation-only for now: commerce listings go live through a checkout and resolve their own verdict (HOS-1184)"*. No existe un endpoint equivalente para gastronomy/experience en el cliente — el comercio resuelve elegibilidad implícitamente vía el checkout de `CommerceCreateForm`/`CommerceListingActions`, no vía un veredicto explícito `canPublish`.

## 6. Mi cuenta / suscripción — cobertura por acción

`mi-cuenta/suscripcion/index.astro` + `SubscriptionDashboard.client.tsx` sirven las 3 verticales vía `?domain=` (default resuelto server-side por `resolveActiveSubscriptionDomain`, `lib/billing/subscription-domain.ts`).

| Acción | Accommodation | Gastronomy/Experience | Evidencia |
|---|---|---|---|
| Cancelar | Sí | Sí | `canCancel` sin gate de vertical, `cancelSubscription({subscriptionId})` genérico |
| **Pausar** | Sí | Sí (botón se renderiza igual) — **pero el endpoint es accommodation-only en su contrato documentado** | `canPause` (línea ~1029) NO chequea `commerceVertical`, a diferencia de `showPlanChangeFlow` que sí lo hace explícitamente (línea ~1482, comentario HOS-1213 "defence in depth"). `pauseSubscription()` (endpoints-protected.ts:830-834): *"stops billing AND hides/edit-locks the owner's **accommodations**"*, retorna `accommodationsUpdated: number`. |
| Cambiar plan | `PlanChangeFlow` | `CommercePlanChange` (componente separado) | gate explícito `commerceVertical === null` / `!== null`, HOS-1213, intencional |
| Canjear promo (trial extension) | Sí | Sí (mismo gate `status==='trial' && !isComplimentary`) | línea ~1247, sin gate de vertical — simétrico |
| Reemplazar medio de pago | Sí (`canReplacePaymentMethod`) | Mismo gate, sin excluir comercio | línea ~1038 |
| Descargar factura | Sí | Sí | sin gate de vertical |

## 7. i18n — claves de trial por vertical (packages/i18n/src/locales/es)

- `host.json`: 11 ocurrencias de "trial" (incluye `trialCallout`, `trialCalloutTitle`, `trialNote`, etc. — usadas por `CreatePropertyMiniForm`).
- `publish.json`: 0 ocurrencias de "trial" (el namespace `publish.*` que usan las 3 páginas /publicar/* no tiene ninguna clave de trial — coherente con que ninguna de las 3 la lee de ahí; accommodation la saca de `host.json` y `billing.json` en cambio).
- `commerce.json`: SÍ tiene trial — pero en dos lugares distintos del namespace: `commerce.owner.checklist.publishCtaTrial_one/other/NoCount` (CTA de pago con trial, usada por `CommerceListingActions`) y `commerce.landing.gastronomy/experience.faq.trial_one/other` (FAQ de la landing de precios). Ninguna clave de trial vive bajo el form de alta en sí.
- `billing.json`: 7 ocurrencias, genéricas (banner de trial expirado, usado solo por accommodation vía `publicar/index.astro`).

## 8. Componentes duplicados (dos caminos por vertical)

| Par | Líneas | Relación |
|---|---|---|
| `PlanPicker.client.tsx` vs `CommercePlanPicker.client.tsx` | — | selector de plan, dos implementaciones separadas |
| `PlanChangeFlow.client.tsx` (448) vs `CommercePlanChange.client.tsx` (394) | 842 total | flujo de cambio de plan, intencionalmente separado (HOS-1213) |
| `CreatePropertyMiniForm.client.tsx` (1801) vs `CommerceCreateForm.client.tsx` (518, compartido gastronomy+experience vía prop `vertical`) | 2319 total | formulario de alta — comercio YA unificó sus 2 verticales en 1 componente; accommodation nunca comparte con comercio |

## Notas de método
- No se ejecutó nada (build/test/browser) — solo lectura estática.
- Zonas no cubiertas a fondo por tiempo: `/mi-cuenta/addons`, `/mi-cuenta/promociones`, `/suscriptores/*` legacy checkout completo, `/planes/aliados` (partner) en detalle.
