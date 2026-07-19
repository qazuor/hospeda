# Investigación: Flujo de Suscripciones MercadoPago — Billing Hospeda

**Fecha:** 2026-07-18
**Ambiente de pruebas:** PRODUCCIÓN, MercadoPago real (cuenta `HOSPEDA_COM_AR`, id `3497516165`, `mp@hospeda.com.ar`, site MLA). Pagos con `qazuor@gmail.com` (payer real `5860436`).
**Estado:** núcleo del camino elegido (C) validado en prod. Falta: cobro día-N (canario, mañana), multi-user, addons a fondo.

---

## 0. TL;DR / Resumen ejecutivo

- **Decisión: se va por el CAMINO C** = `preapproval_plan` + redirección al **share link hosted del plan** + linking vía **`PUT external_reference` en el back_url return**.
- **Por qué:** es el único que **autoriza la tarjeta con trial**. Los caminos inline (A/B) fallan la autorización de tarjeta cuando llevan `free_trial`. Además C deja el trial en manos de MP (menos lógica en Hospeda, preferencia del owner).
- **El bug actual en prod** (`card_token_id is required`) es porque el código shippeado (HOS-191) hace un `POST /preapproval` **server-side** atado al `preapproval_plan_id`, que MP rechaza. El flujo correcto es **redirigir al share link del plan**, no crear el preapproval server-side.
- **Refund:** el único cobro real de las pruebas ($5.000) fue **reembolsado** (payment `169465668718` → refunded).

---

## 1. Contexto y problema original

Durante el smoke de lanzamiento, TODO checkout pago fallaba en prod. El error evolucionó:

1. **Primero** (resuelto por HOS-200 / PR #2360): `POST /preapproval_plan` fallaba con `"Back url is required"` porque no se mandaba `back_url` al provisionar el plan. **Arreglado y vivo en prod.**
2. **Ahora** (este es el problema real): `POST /preapproval` (crear la suscripción atada al plan) falla con `"card_token_id is required"`.

**Causa raíz:** la migración HOS-191 (de `preapproval` inline a `preapproval_plan`) shippeó un flujo donde Hospeda hace `POST /preapproval` **server-side** pasando `preapproval_plan_id`. MP exige `card_token_id` en ese request (que Hospeda no tokeniza, por diseño/PCI). El flujo que **realmente se validó** en el spike de HOS-191 era distinto: redirigir el browser al **share link del plan**, no el POST server-side. El código no implementó lo validado.

---

## 2. Los tres caminos evaluados

| Dimensión | **A** · inline + `free_trial` | **B** · inline + `start_date` | **C** · plan + share link |
|---|---|---|---|
| Creación (init_point sin token) | ✅ 201 | ✅ 201 | ✅ (plan + share link) |
| **Autorización de tarjeta** | ❌ **falla** ("No pudimos procesar tu pago") | ❌ prob. = A (MP mete free_trial) | ✅ **autoriza** |
| Linking | ✅ limpio (extref + id sincrónico) — pero MOOT | ✅ limpio — MOOT | ⚠️→✅ vía `PUT external_reference` |
| Trial | ✅ | ✅ | ✅ |
| Trial-extension | ❌ trial no mutable per-sub | ❓ | ✅ (un plan por duración) |
| Descuento | ✅ | ❓ | ✅ |

**Conclusión:** A y B quedan descartados porque **el `free_trial` inline rompe la autorización de la tarjeta** — reproducido en prod HOY con control (la MISMA tarjeta autorizó en C minutos antes y falló en A). No es la tarjeta ni rate-block: es el flujo inline con trial. El preapproval inline queda `cancelled` con `payment_method_id: null`, sin generar payment.

**C es el camino.**

---

## 3. Comportamiento de MercadoPago — hallazgos confirmados (empíricos)

### 3.1 Creación de suscripción / trial

- **`POST /preapproval` con `preapproval_plan_id` SIEMPRE exige `card_token_id`** (3 variantes probadas: con `status:pending`, sin status, mínima → todas 400). No hay forma server-side sin token. (Confirma doc MP: "una suscripción con plan asociado siempre debe crearse con `card_token_id` y `status: authorized`".)
- **La única vía sin token es el share link hosted del plan**: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=<id>`.
- **`POST /preapproval` INLINE (sin plan) con `free_trial` devuelve `init_point` sin token** (201, status pending) — PERO la aprobación de la tarjeta falla (ver §2). Sirve la creación, no la autorización.
- **MP acepta cadencia diaria** (`frequency:1, frequency_type:"days"`) y anual (`frequency:12, months`; rechaza `years`). Anual + `free_trial` juntos: OK.

### 3.2 Regla de TRIAL (crítica)

- **MP otorga 1 trial por `(payer + plan)`**, nativo y server-side.
  - Plan nuevo/distinto + mismo payer → **trial** ✅.
  - Mismo plan + mismo payer, 2da vez → **sin trial, cobra de una** ❌ (verificado: `de0f7502` cobró $5000; re-suscripción al plan fresco `b7439f78` mostró "sin trial" en el checkout).
- **Implicancia:** MP NO alcanza para "1 trial por customer de por vida" (un user podría hacer trial-hopping entre planes distintos). **Hospeda DEBE mantener su propia capa global** "un trial por customer" (ya en código, HOS-110/171). → **Dos capas**: MP por-plan (backstop) + Hospeda por-customer-global.

### 3.3 Linking MP ↔ Hospeda

- **El share link IGNORA `external_reference` como query param** — el preapproval creado queda con `external_reference: null`.
- **`payer_id` es INESTABLE**: el mismo email resuelve a distinto `payer_id` según contexto (API-created placeholder `1505978827` vs cuenta real `5860436`). No sirve para linkear.
- **`payer_email` es estable** pero frágil (BETA-183: puede diferir del email de registro).
- **`PUT /preapproval/{id}` con `external_reference` FUNCIONA post-creación y persiste** — confirmado empírico + doc oficial. **Es el mecanismo de linking.**
- **`external_reference` es libremente SOBRESCRIBIBLE** (MP no protege exclusividad) → el guard anti-hijack es 100% de Hospeda.
- **El back_url devuelve `?preapproval_id=<id>`** cuando el user vuelve al sitio.
- **`/preapproval/search?external_reference=X` NO filtra** (devuelve todo, ignora el filtro) → la reconciliación por search no sirve.

### 3.4 Webhooks

- Son **sobres finos**: solo `{type, data:{id}, action, ...}`. Sin `external_reference` ni payer inline → hay que hacer `GET` del recurso.
- **Server-to-server**: llegan **independiente de si el user vuelve** al sitio (confirmado: cerrar el tab NO impide el webhook).
- **El webhook de cancelación es el MISMO tipo que el de creación** (`subscription_preapproval`) → el handler debe ramificar por el `status` que ve en el GET (authorized/trialing/cancelled), no por el tipo de evento.
- **`subscription_authorized_payment`** = el signal del cobro (día N o inmediato). Confirmado en un cobro real.
- Llegan a la webhook URL real de Hospeda (`/api/v1/webhooks/mercadopago`) y responden 200. Nota: llegaron **sin** el marker `?source_news=webhooks` y funcionaron — revisar la asunción de HOS-159.
- Firma `x-signature` disponible para anti-spoofing (a validar en implementación).

### 3.5 Ciclo de vida

- **Cancelación bidireccional funciona**: Hospeda→MP (`PUT status:cancelled`) y MP→Hospeda (user cancela en MP → webhook `subscription_preapproval` → GET muestra `cancelled`).
- **Descuento**: mutar `auto_recurring.transaction_amount` de la sub por `PUT` funciona (5000→4000→5000), preserva el `free_trial`.
- **Cambio de precio del PLAN NO retro-propaga a subs existentes** (cambié el plan 5000→6000, la sub siguió en 5000). → un aumento de precio a suscriptores actuales = mutar CADA sub, no solo el plan.
- **`address_pending` en la cuenta MP NO bloquea cobros reales** (un cobro de $5000 se acreditó sin problema).
- **Refund** por `POST /v1/payments/{id}/refunds` funciona (total, con `X-Idempotency-Key`).

### 3.6 Gestión de planes

- **MP NO deduplica planes** (2 POST idénticos → 2 ids distintos) → idempotencia = responsabilidad de Hospeda (registro `billing_mp_plans` por `(plan, intervalo, trial_days)`).
- **Plan archivable** por `PUT status:cancelled`.
- **Precio del plan editable** por `PUT` (afecta solo a nuevas subs, ver 3.5).

### 3.7 Gotchas

- La pantalla de **congrats de MP** pone el `preapproval_id` en un query param llamado literalmente `external_reference` — **NO es un external_reference, es el preapproval_id** (confirmado contra el `data.id` del webhook).
- **`/preapproval/search` list-view devuelve `free_trial:null` y `next_payment_date:null`** aunque la sub SÍ los tenga → **usar siempre el GET individual** `/preapproval/{id}` para el estado real de trial.

### 3.8 Dunning nativo, rate limits, status lifecycle (investigación doc oficial)

- **Dunning nativo de MP ("recycling")**: hasta **4 reintentos por cuota fallida** en una ventana de **~10 días**. Tras **3 cuotas fallidas**, MP **auto-cancela** la sub (nunca la pausa) + notifica al seller por email. → **Hospeda NO debe duplicar** la lógica de reintentos; hay que **reconciliar** el grace de 7d (`past_due`) de Hospeda con la ventana nativa de ~10d de MP para no producir estados contradictorios.
- **Retry de webhooks** (mecanismo SEPARADO del dunning de pagos): 0/15m/30m/6h/48h/96h/96h/96h (8 intentos) si el endpoint no devuelve 200 en ~22s.
- **Rate limits**: MP **NO publica límite numérico**. Solo `429 usage_quota_exceeded` + header `Retry-After` + backoff exponencial con jitter. También `423 resource_locked` (contención de idempotency key). → honrar `Retry-After`, no budget fijo.
- **Status lifecycle**: 4 estados — `pending`, `authorized`, `paused`, `cancelled`. `paused` SOLO por acción manual (`PUT status:paused`), nunca automático. Fallo de pago → nunca `paused`, va a `cancelled` tras 3 cuotas.
- **Códigos de rechazo** (`status_detail`): fraude/riesgo (`cc_rejected_high_risk`, `_blacklist`, `_other_reason`) → NO reintentar con la misma tarjeta (MP lo advierte); declines normales (`_insufficient_amount`, `_card_disabled`, `_call_for_authorize`...) → OK reintentar / otra tarjeta.
- **2 gaps a verificar EMPÍRICAMENTE** (no bloqueantes): (a) ¿el recycling (4 retries / 3 strikes → cancel) aplica igual a `preapproval_plan`? (la doc es del flujo "sin plan asociado"); (b) ¿qué `status` queda el preapproval cuando la tarjeta se rechaza en la 1ra autorización? (best guess: `pending`, no documentado).

---

## 4. Diseño de linking del camino C (recomendado)

1. Antes de redirigir, Hospeda guarda un **pending-checkout local**: `{ localUserId, planId, timestamp, nonce }` (no se expone a MP).
2. Redirige al share link del plan (sin pasar nada extra — MP lo ignora).
3. `back_url` → ruta propia de Hospeda. Cuando el user vuelve con `?preapproval_id=X` (**logueado**):
   - `GET /preapproval/X` server-side (nunca confiar en la URL a ciegas).
   - Si `external_reference` vacío y sesión válida → `PUT external_reference = localUserId`.
   - Si ya tiene OTRO user → rechazar + alertar (**guard anti-IDOR**).
4. El webhook (`subscription_preapproval`, `x-signature` validado) → `GET` → ramificar por `status`.
5. **Caso "no vuelve"** (cerró el tab): el webhook llega igual → reconciliar por pending-row (plan + timing) + `payer_email`. Residuo (no-vuelve + email distinto, BETA-183) → **reconciliación asistida** (el user confirma al volver a la app). Sin pérdida de plata.

**Seguridad IDOR:** riesgo BAJO — el `preapproval_id` es un secreto de 128 bits (32 hex) no enumerable ni expuesto. Los guards de Hospeda (no sobrescribir si ya está seteado, verificar payer, `x-signature`) son defensa en profundidad.

---

## 5. Checklist de pruebas — estado

Leyenda: ✅ hecho · 🕐 pendiente-tiempo · ⏳ pendiente-otra-tanda

### Comportamiento MP (Fase A, $0)

- ✅ Provisión de planes (mensual/anual/notrial/trial30/diario). MP acepta cadencia diaria.
- ✅ `POST /preapproval` + plan_id → siempre pide card_token (3 variantes).
- ✅ Inline + free_trial → crea con init_point sin token (pero no autoriza).
- ✅ Idempotencia planes (no dedupe), archivar plan, editar precio.
- ✅ `PUT external_reference` post-creación (funciona + persiste + sobrescribible).
- ✅ Search no filtra por external_reference.
- ✅ Descuento (mutar amount), preserva trial.
- ✅ Cambio precio plan NO retro-propaga.

### Aprobaciones (Fase B, con owner)

- ✅ Path feliz C: aprueba → authorized → trial difiere cobro → back_url → PUT extref → linkeado.
- ✅ Inline + free_trial: la tarjeta NO autoriza (A descartado).
- ✅ No-vuelve (T3.2): webhook llega igual (server-to-server).
- ✅ Cancelación MP→Hospeda (T7.2) + Hospeda→MP (T7.1).
- ✅ Regla de trial (payer+plan) sellada.
- ✅ address_pending no bloquea cobro; webhook de cobro visto; refund hecho.
- ⏳ T3.5 email-distinto (lo cubre agente BETA-183).
- ⏳ T3.6 multi-user (ambigüedad de reconciliación).
- ⏳ T8 detalle cambio de plan_id (parcial: mutar amount ya cubierto).
- ⏳ T10 addons a fondo (único vs recurrente sin trial).

### Tiempo real (Fase C)

- 🕐 T5.x cobro día N: canario `7a9e6a99` cobra **2026-07-19 ~16:13** → verificar débito + webhook `subscription_authorized_payment` + `billing_payments` + `mp_customer_id`.
- 🕐 Renovación / dunning nativo de MP (reintentos, pausa/cancel automático).

---

## 6. Decisiones tomadas

1. **Camino C** (plan + share link + PUT external_reference). A/B descartados (no autorizan con trial).
2. **Trial innegociable**: todo user self-service (turista Y owner) sale con trial; solo admin-sells sin trial. Producto nuevo en mercado local → sin trial no se lanza.
3. **Dos capas de trial guard**: MP por-plan (nativo) + Hospeda por-customer-global (obligatoria).
4. **Linking robusto** vía PUT external_reference en el back_url; fallback asistido para no-vuelve+email-distinto.
5. **Aumento de precio** a suscriptores = mutación por-sub (el PUT al plan no propaga).
6. **Refund entre pruebas** = parte del protocolo; ejecutado por API con OK del owner.

---

## 7. Implicancias para la implementación en Hospeda

Lo que hay que cambiar respecto del código shippeado (HOS-191):

1. **Dejar de hacer `POST /preapproval` server-side** para el flujo pago (es lo que tira `card_token_id`). En su lugar, **redirigir al share link del plan** (`.../subscriptions/checkout?preapproval_plan_id=<id>`, construible desde `billing_mp_plans.mpPreapprovalPlanId`).
2. **Crear un pending-checkout local** antes de redirigir; **handler del back_url** que hace `GET` + `PUT external_reference` con guard anti-IDOR.
3. **Handler de webhook** `subscription_preapproval`: `GET` + ramificar por `status` (crear/trialing/cancelar). Validar `x-signature`. Reconciliar el caso no-vuelve por pending-row + payer_email; los ambiguos → asistida.
4. **Provisioning idempotente** de planes por `(plan, intervalo, trial_days)` (MP no dedupe).
5. **Guard de trial global por customer** en Hospeda (MP solo cubre por-plan).
6. **Aumento de precio** = job que muta cada sub, no solo el plan.
7. Revisar la asunción de **HOS-159** (los webhooks llegan sin `source_news` y responden 200).

---

## 8. Pendientes

- 🕐 Cobro día-N del canario (mañana ~16:13).
- ⏳ Multi-user (T3.6), addons (T10), cambio de plan_id (T8), email-distinto (T3.5 → BETA-183).
- Edge case: botón **"volver a suscribirme"** en la UI de cancelación de MP (reactivación desde MP-side) → Hospeda debería captarlo por webhook. Baja prioridad, anotado para el futuro.
- Entender el **dunning nativo de MP** (reintentos, pausa/cancel automático) para no duplicar con el dunning de Hospeda.

---

## 9. Referencia — objetos de prueba en la cuenta MP (limpiar)

- **Canario vivo (NO borrar hasta ver el cobro):** preapproval `7a9e6a9979be4153b164854345c45a69` (plan `e3b2a6bd`, trial 1 día, cobra 2026-07-19).
- Planes de prueba `HOSPEDA-MPTEST-PLAN-*`: `069085b7` (monthly-t14), `263413ec` (annual-t14), `0a20cec4` (monthly-notrial), `9c8e00c0` (monthly-t30), `e3b2a6bd` (daily-t1 = canario), `b7439f78` (fresh-t14), + temporales de idempotencia/precio.
- Todos los preapprovals de prueba (marca `HOSPEDA-MPTEST/LOCALUSER/ATTACKER`) ya cancelados salvo el canario.
- Token de prueba en el VPS: `~/mp-test/token` (chmod 600). Scripts y respuestas en `~/mp-test/`.
