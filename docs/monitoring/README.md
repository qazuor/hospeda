# Monitoring & Error Tracking

Documentación del sistema de monitoreo y tracking de errores para Hospeda.

## Contenido

| Documento | Descripción |
|-----------|-------------|
| [sentry-setup-guide.md](./sentry-setup-guide.md) | **Guía principal** - Configuración completa de Sentry para producción (DSNs, estructura, alertas) |
| [sentry-alerts.md](./sentry-alerts.md) | Runbooks operacionales, testing de alertas, y ajuste de thresholds |

## Herramientas de Monitoreo

### Sentry

**Propósito:** Error tracking y performance monitoring

- **API App:** Configurado con `@sentry/node`
- **Web App:** Configurado con `@sentry/astro`
- **Admin App:** Configurado con `VITE_SENTRY_DSN`

**Características:**

- Captura automática de errores no manejados
- Performance monitoring con transacciones
- Profiling de CPU y memoria
- Context enrichment (billing, user, request)
- Filtrado automático de datos sensibles

**Documentación:**

- [Guía de Setup para Producción](./sentry-setup-guide.md) - DSNs, alertas, verificación
- [Runbooks y Testing de Alertas](./sentry-alerts.md)
- [Sentry Docs](https://docs.sentry.io/)

### Configuración

> **Ver [sentry-setup-guide.md](./sentry-setup-guide.md) para la guía completa de configuración con DSNs de producción.**

Todas las herramientas de monitoreo se configuran via variables de entorno en `.env`:

```bash
# Sentry (API) - hospeda-api project
SENTRY_DSN=https://...@sentry.io/project-id
SENTRY_PROJECT=hospeda
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Sentry (Web) - hospeda-web project
PUBLIC_SENTRY_DSN=https://...@sentry.io/project-id
PUBLIC_SENTRY_PROJECT=hospeda

# Sentry (Admin) - hospeda-admin project
VITE_SENTRY_DSN=https://...@sentry.io/project-id
VITE_SENTRY_PROJECT=hospeda
```

## Uso en el Código

### API - Capturar Errores de Billing

```typescript
import { captureBillingError, capturePaymentFailure } from '@/lib/sentry';

// Capturar error de subscription
try {
  await subscriptionService.create(data);
} catch (error) {
  captureBillingError(error, {
    subscriptionId: data.subscriptionId,
    planId: data.planId,
    customerEmail: data.email,
  });
  throw error;
}

// Capturar fallo de pago
try {
  await processPayment(data);
} catch (error) {
  capturePaymentFailure(error, {
    subscriptionId: data.subscriptionId,
    amount: data.amount,
    currency: 'ARS',
    failureReason: 'card_declined',
  });
  throw error;
}
```

### API - Capturar Errores de Webhook

```typescript
import { captureWebhookError } from '@/lib/sentry';

try {
  await processWebhook(event);
} catch (error) {
  captureWebhookError(error, {
    provider: 'mercadopago',
    eventType: event.type,
    eventId: event.id,
    retryCount: 2,
  });
  throw error;
}
```

### API - Tracking de Performance

```typescript
import { startTransaction } from '@/lib/sentry';

const transaction = startTransaction('billing.checkout', 'billing.operation');

try {
  // Tu código aquí
  await processCheckout(data);
} finally {
  transaction?.finish();
}
```

## Contexto Automático

El middleware de Sentry agrega automáticamente:

- **Request Context:** Method, URL, headers (sanitized)
- **User Context:** User ID, email (anonymized), role
- **Billing Context:** Subscription, plan, payment info
- **Tags:** module, operation type, plan ID

## Filtrado de Datos Sensibles

Sentry está configurado para filtrar automáticamente:

- Tokens de autenticación
- Contraseñas
- Claves de API
- Información de tarjetas de crédito
- Emails (se anonymizan: `***@domain.com`)

## Alertas Recomendadas

> **Ver [sentry-setup-guide.md](./sentry-setup-guide.md) para instrucciones paso a paso para crear cada alerta.**

### Alertas Críticas (10)

| # | Nombre | Proyecto | Prioridad |
|---|--------|----------|-----------|
| 1 | High Payment Failure Rate | hospeda-api | 🔴 Critical |
| 2 | Webhook Processing Failures | hospeda-api | 🔴 Critical |
| 3 | High Error Rate - API | hospeda-api | 🟠 High |
| 4 | High Error Rate - Web | hospeda-web | 🟠 High |
| 5 | High Error Rate - Admin | hospeda-admin | 🟠 High |
| 6 | Low Trial Conversion | hospeda-api | 🟡 Medium |
| 7 | New Error - API | hospeda-api | 🟡 Medium |
| 8 | New Error - Web | hospeda-web | 🟡 Medium |
| 9 | New Error - Admin | hospeda-admin | 🟡 Medium |
| 10 | Subscription State Errors | hospeda-api | 🟠 High |

## Dashboard de Monitoreo

### Sentry Dashboard: "Billing System Health"

Widgets recomendados:

1. **Payment Failures (24h)** - Count by failure reason
2. **Webhook Success Rate** - Percentage of successful webhooks
3. **Avg Response Time (P95)** - Latency for billing endpoints
4. **Trial Conversions** - Trial → Active conversion rate
5. **Active Subscriptions** - Current count and trend

## Runbooks

> **Ver [sentry-alerts.md](./sentry-alerts.md) para runbooks detallados, testing de alertas, y ajuste de thresholds.**

### Resumen de Acciones

**Payment Failure Alert:**

1. Check Sentry issue → 2. Verify MercadoPago status → 3. Check API credentials → 4. Contact affected customers

**Webhook Failure Alert:**

1. Review webhook logs → 2. Check endpoint accessibility → 3. Verify signature → 4. Re-process manually

## Recursos

- [Sentry Documentation](https://docs.sentry.io/)
- [MercadoPago Webhook Guide](https://www.mercadopago.com.ar/developers/es/docs/webhooks)
- [Hospeda Billing Architecture](../architecture/billing-system.md)

## Mantenimiento

- **Revisión mensual** de alertas y thresholds
- **Limpieza trimestral** de eventos antiguos
- **Actualización semestral** de SDK versions

---

**Última Actualización:** 2026-02-04
