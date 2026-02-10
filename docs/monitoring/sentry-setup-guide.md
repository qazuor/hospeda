# Sentry Setup Guide - Hospeda

> Guía completa para configurar Sentry en producción para el proyecto Hospeda.

**Última actualización**: 2026-02-04
**Estado**: ✅ Configuración base completa, alertas pendientes

---

## Tabla de Contenidos

1. [Resumen de Configuración](#resumen-de-configuración)
2. [Estructura en Sentry](#estructura-en-sentry)
3. [DSNs y Variables de Entorno](#dsns-y-variables-de-entorno)
4. [Configuración de Alertas](#configuración-de-alertas)
5. [Verificación Post-Deploy](#verificación-post-deploy)
6. [Dashboards Recomendados](#dashboards-recomendados)
7. [Troubleshooting](#troubleshooting)

---

## Resumen de Configuración

| Componente | Valor | Estado |
|------------|-------|--------|
| **Organización** | `qazuor` | ✅ |
| **Team** | `hospeda` | ✅ |
| **Proyecto API** | `hospeda-api` (Node.js) | ✅ |
| **Proyecto Web** | `hospeda-web` (Astro) | ✅ |
| **Proyecto Admin** | `hospeda-admin` (React) | ✅ |
| **Region** | US (`us.sentry.io`) | ✅ |

### URLs de Acceso

- **Dashboard**: <https://qazuor.sentry.io>
- **Issues**: <https://qazuor.sentry.io/issues/>
- **Proyectos**: <https://qazuor.sentry.io/projects/>
- **Alertas**: <https://qazuor.sentry.io/alerts/rules/>
- **Team Hospeda**: <https://qazuor.sentry.io/settings/teams/hospeda/>

---

## Estructura en Sentry

```
Organización: qazuor
└── Team: hospeda
    ├── hospeda-api      (Node.js backend)
    ├── hospeda-web      (Astro frontend)
    └── hospeda-admin    (React admin dashboard)
```

### Tags Configurados

Todos los errores incluyen automáticamente:

| Tag | Descripción | Valores |
|-----|-------------|---------|
| `project` | Nombre del proyecto | `hospeda` |
| `app_type` | Tipo de aplicación | `api`, `web`, `admin` |
| `module` | Módulo de origen (billing) | `billing` |
| `event_type` | Tipo de evento billing | `payment_failure`, `webhook_failure`, `trial_expiration` |

### Filtros Útiles en Sentry

```
# Ver todos los errores de Hospeda
project:hospeda

# Ver solo errores del API
project:hospeda app_type:api

# Ver errores de billing
module:billing

# Ver fallos de pago
event_type:payment_failure

# Combinar filtros
project:hospeda app_type:api event_type:webhook_failure
```

---

## DSNs y Variables de Entorno

### Producción (`.env`)

```bash
# =============================================================================
# SENTRY CONFIGURATION - PRODUCTION
# =============================================================================

# API - hospeda-api project
SENTRY_DSN=https://31c6b2d7db0789020567a65cb20bf796@o4508855548313600.ingest.us.sentry.io/4510829690028032
SENTRY_PROJECT=hospeda
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_DEBUG=false

# Web App - hospeda-web project
PUBLIC_SENTRY_DSN=https://f2e64d188706860ecff62b23ff2fb8d6@o4508855548313600.ingest.us.sentry.io/4510829690486784
PUBLIC_SENTRY_PROJECT=hospeda

# Admin App - hospeda-admin project
VITE_SENTRY_DSN=https://1bd1f0f8e4bfc2aa0bd2b64fcd13db97@o4508855548313600.ingest.us.sentry.io/4510829690814464
VITE_SENTRY_PROJECT=hospeda
```

### Staging (usar DSNs diferentes si querés separar ambientes)

```bash
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=1.0    # 100% en staging para debugging
SENTRY_DEBUG=true
```

### Valores por Ambiente

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `SENTRY_ENVIRONMENT` | `development` | `staging` | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | `1.0` | `1.0` | `0.1` |
| `SENTRY_PROFILES_SAMPLE_RATE` | `1.0` | `1.0` | `0.1` |
| `SENTRY_DEBUG` | `true` | `true` | `false` |

---

## Configuración de Alertas

### Acceso Rápido

**URL para crear alertas**: <https://qazuor.sentry.io/alerts/rules/>

### Alerta 1: High Payment Failure Rate

> Detecta picos de fallos en pagos

**Proyecto**: `hospeda-api`

| Campo | Valor |
|-------|-------|
| Alert Name | `[Billing] High Payment Failure Rate` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Condiciones (When)**:

```
An event's tags match: event_type equals payment_failure
```

**Trigger (If)**:

```
The issue is seen more than 5 times in 5 minutes
```

**Action (Then)**:

```
Send a notification to: [tu email]
```

**Pasos**:

1. Ir a <https://qazuor.sentry.io/alerts/rules/>
2. Click "Create Alert" → "Issue Alert"
3. Seleccionar proyecto: `hospeda-api`
4. En "Set conditions":
   - Add condition → "The event's tags match"
   - Key: `event_type`, Value: `payment_failure`
5. En "Set action interval":
   - "More than 5 times in 5 minutes"
6. En "Perform actions":
   - Add action → "Send a notification"
   - Seleccionar email
7. Nombrar: `[Billing] High Payment Failure Rate`
8. Save Rule

---

### Alerta 2: Webhook Processing Failures

> Detecta problemas con webhooks de MercadoPago

**Proyecto**: `hospeda-api`

| Campo | Valor |
|-------|-------|
| Alert Name | `[Billing] Webhook Processing Failures` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Condiciones**:

```
An event's tags match: event_type equals webhook_failure
```

**Trigger**:

```
The issue is seen more than 3 times in 10 minutes
```

**Action**:

```
Send a notification to: [tu email]
```

---

### Alerta 3: Critical Error Spike

> Detecta picos generales de errores en cualquier app

**Proyecto**: Crear en CADA proyecto (`hospeda-api`, `hospeda-web`, `hospeda-admin`)

| Campo | Valor |
|-------|-------|
| Alert Name | `[Critical] High Error Rate - {app}` |
| Alert Type | Metric Alert |
| Environment | `production` |

**Métrica**:

```
count() > 50 in the last 5 minutes
```

**Action**:

```
Send a notification to: [tu email]
```

**Pasos**:

1. Ir a <https://qazuor.sentry.io/alerts/rules/>
2. Click "Create Alert" → "Metric Alert"
3. Seleccionar proyecto
4. Metric: `Number of Errors`
5. Threshold: `Above 50`
6. Time window: `5 minutes`
7. Save

---

### Alerta 4: Trial Conversion Issues

> Detecta usuarios que no convierten después del trial

**Proyecto**: `hospeda-api`

| Campo | Valor |
|-------|-------|
| Alert Name | `[Billing] Low Trial Conversion` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Condiciones**:

```
An event's tags match: event_type equals trial_expiration
AND
An event's tags match: converted equals no
```

**Trigger**:

```
The issue is seen more than 10 times in 1 hour
```

---

### Alerta 5: New Issue Detection

> Notifica cuando aparece un error nuevo (first seen)

**Proyecto**: Crear en CADA proyecto

| Campo | Valor |
|-------|-------|
| Alert Name | `[New] First Seen Error - {app}` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Condiciones**:

```
A new issue is created
```

**Action**:

```
Send a notification to: [tu email]
```

---

### Alerta 6: Subscription State Errors

> Detecta errores en cambios de estado de suscripciones

**Proyecto**: `hospeda-api`

| Campo | Valor |
|-------|-------|
| Alert Name | `[Billing] Subscription State Errors` |
| Alert Type | Issue Alert |

**Condiciones**:

```
The event's message contains: subscription
AND
The event's level equals: error
```

**Trigger**:

```
The issue is seen more than 5 times in 15 minutes
```

---

### Resumen de Alertas a Crear

| # | Nombre | Proyecto | Tipo | Prioridad |
|---|--------|----------|------|-----------|
| 1 | High Payment Failure Rate | hospeda-api | Issue | 🔴 Critical |
| 2 | Webhook Processing Failures | hospeda-api | Issue | 🔴 Critical |
| 3 | High Error Rate - API | hospeda-api | Metric | 🟠 High |
| 4 | High Error Rate - Web | hospeda-web | Metric | 🟠 High |
| 5 | High Error Rate - Admin | hospeda-admin | Metric | 🟠 High |
| 6 | Low Trial Conversion | hospeda-api | Issue | 🟡 Medium |
| 7 | New Error - API | hospeda-api | Issue | 🟡 Medium |
| 8 | New Error - Web | hospeda-web | Issue | 🟡 Medium |
| 9 | New Error - Admin | hospeda-admin | Issue | 🟡 Medium |
| 10 | Subscription State Errors | hospeda-api | Issue | 🟠 High |

---

## Verificación Post-Deploy

### Checklist de Verificación

```bash
# 1. Verificar que Sentry inicializa (buscar en logs)
grep -i "sentry" /var/log/hospeda-api.log

# Deberías ver:
# "Sentry Logger [log]: Initializing Sentry..."
# "Sentry initialized successfully"
```

### Test de Error Manual

Para verificar que los errores llegan a Sentry:

```typescript
// En cualquier endpoint de prueba (NO en producción real)
import { Sentry } from '../lib/sentry';

// Capturar error de prueba
Sentry.captureMessage('Test error from Hospeda API', 'error');

// O lanzar una excepción
throw new Error('Test exception for Sentry verification');
```

### Verificar en Dashboard

1. Ir a <https://qazuor.sentry.io/issues/>
2. Filtrar por proyecto: `hospeda-api`
3. Debería aparecer el error de prueba

### Health Check de Sentry

```bash
# Verificar conexión desde el servidor
curl -I https://o4508855548313600.ingest.us.sentry.io/
# Debería retornar 200 OK
```

---

## Dashboards Recomendados

### Dashboard: Billing System Health

Crear en: <https://qazuor.sentry.io/dashboards/>

**Widgets recomendados**:

1. **Error Count by App Type** (Bar Chart)

   ```
   count() by app_type
   ```

2. **Payment Failures (24h)** (Big Number)

   ```
   count() where event_type:payment_failure
   ```

3. **Webhook Errors (24h)** (Big Number)

   ```
   count() where event_type:webhook_failure
   ```

4. **Error Trend (7 days)** (Line Chart)

   ```
   count() by day
   ```

5. **Top 5 Errors** (Table)

   ```
   count() by issue order by count desc limit 5
   ```

6. **P99 Response Time** (Line Chart)

   ```
   p99(transaction.duration) where transaction:"/api/v1/billing/*"
   ```

---

## Troubleshooting

### Sentry no inicializa

**Síntoma**: No aparecen logs de Sentry al iniciar

**Solución**:

```bash
# Verificar DSN configurado
echo $SENTRY_DSN

# Verificar que no esté vacío
# Si está vacío, Sentry se desactiva silenciosamente
```

### Errores no aparecen en dashboard

**Síntoma**: La app funciona pero no se ven errores

**Posibles causas**:

1. DSN incorrecto
2. Environment filtrado (verificar filtro en Issues)
3. Sample rate en 0

**Solución**:

```bash
# Temporalmente aumentar sample rate
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_DEBUG=true

# Reiniciar app y verificar logs
```

### Demasiados errores (ruido)

**Síntoma**: Muchos errores irrelevantes

**Solución**:

1. Configurar `beforeSend` para filtrar errores conocidos
2. Usar `ignoreErrors` en la config de Sentry
3. Marcar issues como "Ignored" en el dashboard

### Rate limiting de Sentry

**Síntoma**: Errores de "rate limited" en logs

**Solución**:

1. Reducir `tracesSampleRate`
2. Implementar client-side filtering
3. Upgrade de plan si es necesario

---

## Release Tracking (Opcional)

Para trackear errores por release/versión:

### 1. Agregar variable de versión

```bash
# En .env o CI/CD
SENTRY_RELEASE=hospeda-api@1.2.3
```

### 2. Configurar en código

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.SENTRY_RELEASE || `hospeda-api@${process.env.npm_package_version}`,
});
```

### 3. Crear release en deploy

```bash
# En CI/CD pipeline
sentry-cli releases new hospeda-api@1.2.3
sentry-cli releases set-commits hospeda-api@1.2.3 --auto
sentry-cli releases finalize hospeda-api@1.2.3
```

---

## Source Maps (Para Web y Admin)

Para mejor stack traces en frontend:

### 1. Build con source maps

```bash
# astro.config.mjs
export default defineConfig({
  vite: {
    build: {
      sourcemap: true,
    },
  },
});
```

### 2. Upload source maps

```bash
# En CI/CD después del build
sentry-cli sourcemaps upload \
  --org qazuor \
  --project hospeda-web \
  ./dist
```

---

## Contacto y Soporte

- **Sentry Status**: <https://status.sentry.io/>
- **Documentación**: <https://docs.sentry.io/>
- **Soporte**: <https://sentry.io/support/>

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-02-04 | Configuración inicial: org, team, 3 proyectos, DSNs |
| 2026-02-04 | Documentación de alertas recomendadas |
