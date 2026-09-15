---
title: Inventario de hechos duros — producción
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
measuredAt: 2026-09-15
environment: production
---

# Inventario de hechos duros — producción

**Medido**: 2026-09-15, contra la DB de **producción**, vía
`hops --target=prod psql --stdin` (lectura solamente, cero escrituras).

## Por qué existe este documento

Varias decisiones de [FASE 1A](./05-phase-1a-domain-analysis.md) — migración, alcance del
trial, identidad del usuario — dependen de cuántos clientes reales hay y en qué estado.
El owner autorizó estos conteos antes de empezar 1A, como excepción explícita a la regla
"no mirar el sistema actual": **son restricciones de realidad, no arquitectura**.

Acá no se interpreta diseño. Se cuentan filas. Toda lectura de código, esquema o
comportamiento es FASE 1B.

> Estos números **caducan**. Cualquier decisión que los cite debe re-verificarlos si pasó
> tiempo. La fecha de medición está arriba.

---

## El titular

**Producción no tiene un solo pago registrado.** `billing_payments` = **0 filas**.
Tampoco tiene una sola ficha de gastronomía, experiencia ni partner.

Lo que hay es: 22 usuarios, 12 alojamientos (5 publicados), 3 trials vivos con preapproval
de MP, y 2 suscripciones de cortesía.

Esto reduce drásticamente el riesgo que `R-MIG-01` y `BD-MIG-01` suponían.

---

## Suscripciones vivas (`deleted_at IS NULL`)

Ocho filas en total.

| status | dominio | inicio trial | fin trial | fin período | tiene MP | creada |
|---|---|---|---|---|---|---|
| `comp` | accommodation | — | — | 2126-06-30 | no | 2026-07-24 |
| `comp` | accommodation | — | — | 2126-07-21 | no | 2026-08-14 |
| `trialing` | accommodation | 2026-08-27 | 2026-09-26 | 2026-09-27 | **sí** | 2026-08-27 |
| `abandoned` | accommodation | 2026-08-27 | 2026-09-26 | 2026-08-27 | no | 2026-08-27 |
| `trialing` | accommodation | 2026-08-27 | 2026-11-25 | 2026-09-27 | **sí** | 2026-08-27 |
| `abandoned` | tourist | 2026-08-28 | 2026-09-27 | 2026-08-28 | no | 2026-08-28 |
| `abandoned` | accommodation | 2026-08-28 | 2026-09-27 | 2026-08-28 | no | 2026-08-28 |
| `trialing` | accommodation | 2026-09-01 | 2026-11-30 | 2026-10-01 | **sí** | 2026-09-01 |

Observaciones **fácticas** (no interpretadas):

- Los tres `trialing` tienen preapproval de MercadoPago. Son los únicos con vínculo vivo
  al provider en toda la base.
- Las duraciones de trial no son homogéneas: una de 30 días y dos de 90.
- En dos de los tres `trialing`, `current_period_end` cae **antes** que `trial_end`.
  Se registra el hecho; explicarlo es FASE 1B.
- Las dos `comp` tienen `current_period_end` en el **año 2126** y ningún vínculo con MP.
- El trial que vence primero lo hace el **2026-09-26** — once días después de esta medición.
  Cualquier decisión sobre migración o sobre el fin del trial afecta a esa fecha.

## Catálogo y configuración

| Tabla | Filas |
|---|---|
| `billing_plans` (vivos) | 18 |
| `billing_prices` | 30 |
| `billing_entitlements` | 53 |
| `billing_limits` | 20 |
| `billing_addons` (catálogo) | 15 |
| `billing_promo_codes` | 5 |
| `billing_customers` | 19 |
| `entity_subscriptions` | 12 |

### Planes por dominio

| `product_domain` | planes |
|---|---|
| accommodation | 4 |
| gastronomy | 4 |
| experience | 4 |
| partner | 3 |
| tourist | 2 |
| **`commerce`** | **1** |

El valor `commerce` — retirado según la documentación del repo — **sigue vivo en una fila de
`billing_plans` en producción**. Es un hecho a tener en cuenta para §55 del PDR ("Commerce
debe desaparecer"): no alcanza con limpiar código.

## Movimiento

| Tabla | Filas |
|---|---|
| `billing_payments` | **0** |
| `billing_addon_purchases` | **0** |
| `billing_promo_code_usage` | 4 |

## Contenido y usuarios

| | Total | Publicados | Owners distintos |
|---|---|---|---|
| `users` | 22 | — | — |
| `accommodations` | 12 | 5 | 12 |
| `gastronomies` | **0** | 0 | 0 |
| `experiences` | **0** | 0 | 0 |
| `partners` | **0** | — | — |

Cada alojamiento tiene un owner distinto: no hay ningún caso real de multi-ficha en
producción. Tampoco hay ningún usuario con más de una vertical con contenido, porque sólo
existe una vertical con contenido.

## Infraestructura de billing existente

42 tablas cuyo nombre empieza con `billing`, o relacionadas: incluye auditoría, dunning,
webhooks (con dead-letter), idempotencia, invoices, refunds, orphan payments, polling jobs,
price changes con notices y targets, vendors y payouts.

Se registra el conteo como contexto de magnitud. **Qué hace cada una, si se usa y si sirve
es FASE 1B/5**, no esta fase.

---

## Qué cambia esto en 1A

Tres cosas, y ninguna es una decisión — son insumos para las preguntas del owner:

1. **`BD-MIG-01` y `R-MIG-01` se abaratan mucho.** No hay historial de pagos que preservar
   ni cobros en curso que no se puedan interrumpir. Lo que hay que cuidar son **tres trials
   con preapproval vivo** y **dos cortesías**. Migrar cinco relaciones a mano es
   perfectamente viable; el PDR ya lo anticipaba en §56 y los números lo confirman.

2. **Gastronomía, experiencias y partner no tienen un solo dato en producción.** Todo el
   rediseño de esas verticales se puede hacer sin migración alguna. La deuda que arrastran
   es de código, no de datos.

3. **La ventana es corta.** El primer trial vence el 2026-09-26. Si el rediseño va a cambiar
   qué pasa al vencer un trial, esa fecha llega antes que la FASE 2.

## Cómo reproducir

```bash
ssh -o BatchMode=yes -p 2222 qazuor@216.238.103.219 \
  '~/.local/bin/hops --target=prod psql --stdin' <<'SQL'
SELECT coalesce(product_domain,'(null)') AS domain, status, billing_interval, livemode,
       count(*) AS n,
       count(*) FILTER (WHERE mp_subscription_id IS NOT NULL) AS with_mp,
       count(*) FILTER (WHERE trial_end IS NOT NULL) AS with_trial
FROM billing_subscriptions
WHERE deleted_at IS NULL
GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;
SQL
```

Dos trampas que costaron una ronda cada una y conviene no repetir:

- `hops psql` con una salida **vacía** no significa "cero filas": significa que la query
  falló y el error se tragó. Un `UNION` de diez tramos se anula entero si una sola columna
  no existe. Conviene ir de a poco.
- `--target=` va **antes** del subcomando, y es obligatorio.
