# Sentry Alert Rules

> Tracking de alertas configuradas y pendientes en Sentry para Hospeda.
> Cada alerta tiene owner, fecha de creación y drill de verificación.

## Tracking

| # | Alerta | Estado | Owner | Fecha creación | Drill verificado | Proyecto Sentry |
|---|--------|--------|-------|----------------|------------------|-----------------|
| 1 | Moderation Degraded — staging | **Pendiente** | — | — | No | `hospeda-api-staging` |
| 2 | Moderation Degraded — prod | **Pendiente** | — | — | No | `hospeda-api-prod` |
| 3 | API Error Rate Spike | **Pendiente** | — | — | No | `hospeda-api-prod` |
| 4 | Billing Webhook Failure | **Pendiente** | — | — | No | `hospeda-api-staging` / `hospeda-api-prod` |
| 5 | Cron Job Failure | **Pendiente** | — | — | No | `hospeda-api-staging` / `hospeda-api-prod` |
| 6 | Auth Failure Spike | **Pendiente** | — | — | No | `hospeda-api-prod` |
| 7 | DB Connection Pool Exhaustion | **Pendiente** | — | — | No | `hospeda-api-staging` / `hospeda-api-prod` |

**Leyenda**:

- **Pendiente**: no creada aún
- **Activa**: creada, drill verificado, monitoreando
- **Archivada**: deshabilitada (reason en notes)

---

## 1. Moderation Degraded — staging

> **SPEC-195** — Muestra cuándo el engine de moderación cae en fallback degradado.

### Cuándo dispara

El engine de moderación entra en `score: 0.5` (forzando PENDING) porque:

- OpenAI API timeout / 5xx / 429
- DB word-list query falló
- Todos los providers fallaron

### Configuración

| Campo | Valor |
|---|---|
| **Project** | `hospeda-api-staging` |
| **Alert type** | Issue alert |
| **Trigger** | `A new issue is created` |
| **Search query** | `message:"moderation.degraded"` |
| **Level** | `warning` |
| **Environment** | `staging` |
| **Action** | Email → equipo / Slack canal `#alertas-staging` |
| **Auto-resolve** | Sí — `When resolved` → notificar |

### Código fuente

```typescript
// packages/content-moderation/src/engine/orchestrator.ts
Sentry.captureMessage('moderation.degraded', 'warning');
```

### Drill de verificación (5 min)

1. Coolify → `hospeda-api-staging` → env vars → set `HOSPEDA_MODERATION_PROVIDER=stub` → Redeploy
2. Esperar ~30s a que el engine cargue con `provider=stub`
3. Hacer un POST que triggeree moderación (ej: crear un review)
4. Verificar en Sentry → Issues → debería aparecer `moderation.degraded`
5. Verificar que la notificación llega (email / Slack)
6. Volver a setear `HOSPEDA_MODERATION_PROVIDER=openai` → Redeploy
7. Verificar que Sentry marca el issue como **Resolved**

---

## 2. Moderation Degraded — prod

> Igual que #1 pero para producción. Se activa DESPUÉS del soak de staging.

### Configuración

| Campo | Valor |
|---|---|
| **Project** | `hospeda-api-prod` |
| **Alert type** | Issue alert |
| **Trigger** | `A new issue is created` |
| **Search query** | `message:"moderation.degraded"` |
| **Level** | `warning` |
| **Environment** | `production` |
| **Action** | Email → equipo / Slack canal `#alertas-prod` / PagerDuty |
| **Auto-resolve** | Sí |

### Activación

1. Crear la regla **sin activar** (toggle OFF)
2. Después de 7 días de soak en staging con `provider=openai` → activar
3. Flip `HOSPEDA_MODERATION_PROVIDER=openai` en prod
4. Verificar drill

---

## 3. API Error Rate Spike

> Detecta cuando la tasa de errores 5xx en la API supera un umbral.

### Configuración

| Campo | Valor |
|---|---|
| **Project** | `hospeda-api-prod` |
| **Alert type** | Metric alert |
| **Metric** | `count()` where `level:error` |
| **Time window** | 5 minutes |
| **Threshold** | `>50` events in 5 min |
| **Action** | Email + Slack `#alertas-prod` |

### Notas

- Útil para detectar deploys rotos, errores de DB, o provider outages
- El threshold de 50 es conservador — ajustar según volumen normal de la API
- Para staging: threshold más bajo (ej: `>10`)

---

## 4. Billing Webhook Failure

> Detecta cuando un webhook de MercadoPago/QZPay falla al procesarse.

### Configuración

| Campo | Valor |
|---|---|
| **Project** | `hospeda-api-staging` / `hospeda-api-prod` |
| **Alert type** | Issue alert |
| **Trigger** | `A new issue is created` |
| **Search query** | `message:"webhook" level:error` |
| **Action** | Email + Slack `#alertas-billing` |

### Notas

- Los webhooks de MP son críticos: si fallan, el estado de suscripciones se desincroniza
- Crear en staging primero, probar con sandbox de MP, luego activar en prod
- El endpoint `/api/v1/protected/billing/webhooks` ya loguea errores a Sentry

---

## 5. Cron Job Failure

> Detecta cuando un cron job programado falla.

### Configuración

| Campo | Valor |
|---|---|
| **Project** | `hospeda-api-staging` / `hospeda-api-prod` |
| **Alert type** | Issue alert |
| **Trigger** | `A new issue is created` |
| **Search query** | `message:"cron" level:error` |
| **Action** | Email + Slack `#alertas-ops` |

### Cron jobs monitoreados

| Cron | Descripción | Frecuencia |
|------|-------------|------------|
| `apply-scheduled-plan-changes` | Aplica cambios de plan programados | Diario |
| `trial-pre-end-notif` | Notifica usuarios antes de que termine el trial | Diario |
| `conversation-notification` | Procesa notificaciones de mensajes | Cada 5 min |
| `trial-reactivate` | Reactiva trials expirados | Diario |

---

## 6. Auth Failure Spike

> Detecta intentos de login fallidos en masa (posible brute force).

### Configuración

| Campo | Valor |
|---|---|
| **Project** | `hospeda-api-prod` |
| **Alert type** | Metric alert |
| **Metric** | `count()` where `message:"auth" level:warning` |
| **Time window** | 5 minutes |
| **Threshold** | `>20` events in 5 min |
| **Action** | Email + Slack `#alertas-security` |

### Notas

- Better Auth ya loguea intentos fallidos
- Si el threshold se dispara frecuentemente, considerar rate-limiting en el endpoint de login
- Para staging: no aplica (solo test users)

---

## 7. DB Connection Pool Exhaustion

> Detecta cuando el pool de conexiones PostgreSQL se agota.

### Configuración

| Campo | Valor |
|---|---|
| **Project** | `hospeda-api-staging` / `hospeda-api-prod` |
| **Alert type** | Issue alert |
| **Trigger** | `A new issue is created` |
| **Search query** | `message:"connection" message:"pool" level:error` |
| **Action** | Email + Slack `#alertas-ops` |

### Notas

- Drizzle/pg pool tiene un límite configurable (default 10)
- Si se dispara, puede indicar: queries lentas, conexiones no liberadas, o pico de tráfico
- Revisar `packages/db/src/client.ts` para la config del pool

---

## Setup inicial de Sentry (si no está hecho)

### 1. Crear proyectos en Sentry

1. Andá a <https://sentry.io> → **Create Project**
2. **Framework**: Node.js
3. Nombre: `hospeda-api-staging` (environment: `staging`)
4. Nombre: `hospeda-api-prod` (environment: `production`)
5. Nombre: `hospeda-web-staging` / `hospeda-web-prod` (Astro, optional)

### 2. Configurar DSN en Coolify

```bash
# En la VPS
hops env-set staging HOSPEDA_SENTRY_DSN "https://xxx@sentry.io/yyy"
hops env-set prod HOSPEDA_SENTRY_DSN "https://xxx@sentry.io/yyy"
hops redeploy staging
hops redeploy prod
```

### 3. Verificar que los eventos llegan

1. Deploy a staging con `HOSPEDA_SENTRY_DSN` seteado
2. Trigger un error manual (ej: GET a un endpoint que no existe)
3. Verificar en Sentry → Issues → debería aparecer el error

---

## Reglas de mantenimiento

1. **Revisar alertas quarterly**: ¿siguen siendo relevantes? ¿el threshold es correcto?
2. **Documentar cambios**: si se actualiza un threshold o se agrega una nueva alerta, actualizar esta tabla
3. **Archivar alertas obsoletas**: si una feature se depreca, archivar la alerta y documentar por qué
4. **Drill anual**: una vez al año, hacer el drill completo de cada alerta para confirmar que funciona

---

## References

- [Sentry Alert Docs](https://docs.sentry.io/product/alerts/)
- [Sentry Search Syntax](https://docs.sentry.io/concepts/search/)
- [SPEC-195](../../.qtm/specs/SPEC-195-content-auto-moderation/spec.md) — moderation degraded alert
- [SPEC-143](../../.qtm/specs/SPEC-143-billing-testing-coverage/spec.md) — billing testing coverage (webhook monitoring)
