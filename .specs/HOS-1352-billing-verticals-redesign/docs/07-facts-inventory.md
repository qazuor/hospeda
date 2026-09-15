---
title: Inventario de hechos medidos — producción
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
measuredAt: 2026-09-15
environment: production
---

# Inventario de hechos medidos — producción

**Medido**: 2026-09-15, contra la base de **producción**, sólo lectura, cero escrituras.

## Por qué existe este documento

Varias decisiones de FASE 1A dependen de cuántos clientes reales hay y en qué estado. El §56
razona explícitamente sobre ese número — *"Como hay pocos customers actuales: si migrar
automáticamente agrega mucha complejidad/riesgo: preferir coordinación manual y nueva
subscription"* — **y el PDR no lo da**. `O-MIG-01` marcó esa premisa como no verificada.

El owner autorizó conteos read-only durante 1A (pregunta 24). El alcance autorizado es
estricto: **contar filas**. No se leyó código, ni esquema, ni migraciones, ni tests, ni jobs,
ni comportamiento — eso sigue siendo FASE 1B y sigue prohibido.

> **Estos números caducan.** Cualquier decisión que los cite debe re-verificarlos si pasó
> tiempo. La fecha de medición está arriba.

---

## El titular

**Producción nunca cobró nada.** Cero pagos registrados.

Hay **tres** relaciones con un compromiso de cobro vivo, y **dos** cortesías sin ningún
vínculo con el proveedor de pagos. Eso es todo lo que hay que cuidar en una migración.

---

## Suscripciones vivas

Ocho filas en total, todas de ciclo **mensual**.

| status | vertical | ciclo | filas | con compromiso de cobro vivo | con trial |
|---|---|---|---|---|---|
| `trialing` | alojamiento | mensual | 3 | **3** | 3 |
| `comp` | alojamiento | mensual | 2 | 0 | 0 |
| `abandoned` | alojamiento | mensual | 2 | 0 | 2 |
| `abandoned` | turista | mensual | 1 | 0 | 1 |

Detalle de las cinco que importan:

| status | inicio trial | fin trial | fin período | compromiso de cobro | creada |
|---|---|---|---|---|---|
| `trialing` | 2026-08-27 | **2026-09-26** | 2026-09-27 | **sí** | 2026-08-27 |
| `trialing` | 2026-08-27 | 2026-11-25 | 2026-09-27 | **sí** | 2026-08-27 |
| `trialing` | 2026-09-01 | 2026-11-30 | 2026-10-01 | **sí** | 2026-09-01 |
| `comp` | — | — | 2126-06-30 | no | 2026-07-24 |
| `comp` | — | — | 2126-07-21 | no | 2026-08-14 |

Observaciones **fácticas**, sin interpretar:

- Las tres `trialing` son las **únicas** con vínculo vivo al proveedor de pagos en toda la
  base.
- Las duraciones de trial no son homogéneas: una de 30 días y dos de 90.
- En dos de las tres, el fin de período cae **antes** que el fin del trial. Se registra el
  hecho; explicarlo requeriría leer comportamiento, o sea FASE 1B.
- Las dos `comp` tienen fin de período en el **año 2126** y ningún vínculo con el proveedor.
- **El primer trial vence el 2026-09-26**, once días después de esta medición.

## Movimiento

| | Filas |
|---|---|
| Pagos registrados | **0** |

## Contenido y usuarios

| | Filas |
|---|---|
| Usuarios | 22 |
| Alojamientos | 12 |
| Gastronomías | **0** |
| Experiencias | **0** |
| Partners | **0** |

---

## Qué habilita esto

Tres cosas, y ninguna es una decisión — son insumos:

1. **La premisa del §56 queda verificada, y por mucho.** "Pocos customers" son **tres
   compromisos de cobro vivos y cero pagos cobrados en la historia del sistema**. No hay
   historial de pagos que preservar.
2. **Gastronomía, experiencia y partner no tienen un solo dato.** Todo el rediseño de esas
   verticales se puede hacer sin migración alguna: la deuda que arrastran no es de datos.
3. **La ventana es corta.** El primer trial vence el 2026-09-26. Si el rediseño va a cambiar
   qué pasa al vencer un trial, esa fecha llega mucho antes que FASE 2.

## Cómo reproducir

Tres consultas cortas, no una larga: una salida **vacía** significa que la consulta falló y el
error se tragó, no que haya cero filas. Un `UNION` largo se anula entero si una sola columna
no existe.

```sql
-- 1. suscripciones vivas por estado, vertical y ciclo
SELECT status, coalesce(product_domain,'(null)') AS vertical, billing_interval,
       count(*) AS n,
       count(*) FILTER (WHERE mp_subscription_id IS NOT NULL) AS con_compromiso,
       count(*) FILTER (WHERE trial_end IS NOT NULL) AS con_trial
FROM billing_subscriptions WHERE deleted_at IS NULL GROUP BY 1,2,3 ORDER BY 1,2,3;

-- 2. fechas de las que importan
SELECT status, trial_start::date, trial_end::date, current_period_end::date,
       (mp_subscription_id IS NOT NULL) AS tiene_mp, created_at::date
FROM billing_subscriptions
WHERE deleted_at IS NULL AND status IN ('trialing','comp') ORDER BY trial_end NULLS LAST;

-- 3. movimiento y contenido
SELECT 'pagos', count(*)::text FROM billing_payments
UNION ALL SELECT 'usuarios', count(*)::text FROM users WHERE deleted_at IS NULL
UNION ALL SELECT 'alojamientos', count(*)::text FROM accommodations WHERE deleted_at IS NULL;
```
