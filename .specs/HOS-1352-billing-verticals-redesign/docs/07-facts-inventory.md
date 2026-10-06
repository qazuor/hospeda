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

### La cuarta consulta — 2026-09-19, producción, sólo lectura

Autorizada por el owner para cerrar los tres datos que `06-R5-resuelto.md` §1.6 declaró faltantes.
**No cambió ningún conteo**: 8 filas, 3 `trialing`, 3 `abandoned`, 2 `comp`.

| dato que faltaba | qué dio |
|---|---|
| `trial_end` de las tres `abandoned` | **las tres lo tienen**: `2026-09-26`, `2026-09-27` y `2026-09-27` |
| el plan de las ocho | `owner-premium` ×3 (las 2 `comp` + 1 `trialing`) · `owner-pro` ×2 · `owner-basico` ×2 · `tourist-vip` ×1 |
| el id de preapproval de las tres vivas | **las tres lo tienen**, y son las únicas de las ocho |

Observaciones **fácticas**, sin interpretar:

- **El vínculo con el proveedor se corresponde exactamente con `trialing`**: 3 de 3 lo tienen, y
  ninguna de las otras cinco. Confirma medido lo que la tabla de arriba ya decía.
- **Las tres `abandoned` tienen trial con fecha**, así que el dato para escribir su fila de `trial`
  existía desde siempre: lo que faltaba era leerlo. La consulta 2 filtraba
  `status IN ('trialing','comp')`, que es por qué nunca apareció.
- **Los cuatro planes vivos en la cartera son `owner-basico`, `owner-pro`, `owner-premium` y
  `tourist-vip`.** Ninguna fila apunta a un plan de gastronomía, experiencia ni partner.
- **La fila de `tourist` no es una anomalía**: el glosario §2 declara Turista como una de las cinco
  verticales comerciales, y `tourist` es miembro de `ProductDomainEnum` en el código
  (`packages/schemas/src/enums/product-domain.enum.ts`). Se registra porque a primera vista parece
  un valor fuera del enum, y no lo es.

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

**La consulta 3 no cuenta la población del aviso del corte** (FASE 9 vuelta 1, R7; 2026-09-26).
Para eso va **una consulta por tabla de ficha de cada vertical, agrupada por dueño y por clase
`L1`–`L8`** (`V/21` §2.4), **en lugar del único `count(*)` de alojamientos** de la última línea,
que cuenta fichas vivas de una sola vertical y sin dueño. Es la consulta que describe `B/21` §1.3:
la población a avisar es toda persona con una ficha que no sea `L1` o con una suscripción viva en
el sistema viejo, medida el día del corte. Van separadas por vertical por la misma razón de arriba:
un `UNION` se anula entero si una tabla o una columna no existe.

**Y escrita, no sólo descrita** (FASE 9 vuelta 1, §4 punto 3 de `21-verificado-G1`: `B/21` §1.3 y
`V/21` §4 citaban como reproducible un párrafo sin texto ejecutable). Columnas verificadas contra
`origin/staging` el 2026-09-26. Turista es una de las cinco verticales y no tiene tabla de fichas;
las otras cuatro, sí. La clase `L1`–`L8` completa sólo se escribe para `accommodations`, que es la
única tabla sobre la que `V/21` §2.4 define la traducción; en las otras tres basta separar `L1` del
resto, y **si alguna da filas fuera de `L1`, la tabla de `V/21` §2.4 hay que extenderla antes del
corte** (hoy son cero).

```sql
-- 4a. alojamientos por dueño y clase (V/21 §2.4, en el orden de la tabla)
SELECT owner_id,
       CASE
         WHEN deleted_at IS NOT NULL THEN 'L1'
         WHEN lifecycle_state = 'DRAFT' THEN 'L2'
         WHEN lifecycle_state = 'ARCHIVED' THEN 'L3'
         WHEN lifecycle_state = 'INACTIVE' AND billing_unpublished_at IS NULL THEN 'L4'
         WHEN lifecycle_state = 'INACTIVE' THEN 'L5'
         WHEN lifecycle_state = 'ACTIVE' AND visibility <> 'PUBLIC' THEN 'L6'
         WHEN owner_suspended OR plan_restricted THEN 'L7'
         ELSE 'L8'
       END AS clase,
       count(*) AS n,
       count(*) FILTER (WHERE moderation_state = 'REJECTED') AS rejected
FROM accommodations GROUP BY 1,2 ORDER BY 1,2;

-- 4b. gastronomía por dueño: L1 o no
SELECT owner_id, (deleted_at IS NOT NULL) AS es_l1, count(*) AS n
FROM gastronomies GROUP BY 1,2 ORDER BY 1,2;

-- 4c. experiencia por dueño: L1 o no
SELECT owner_id, (deleted_at IS NOT NULL) AS es_l1, count(*) AS n
FROM experiences GROUP BY 1,2 ORDER BY 1,2;

-- 4d. partner por dueño (owner_user_id es nulo mientras nadie lo reclamó): L1 o no
SELECT owner_user_id, (deleted_at IS NOT NULL) AS es_l1, count(*) AS n
FROM partners GROUP BY 1,2 ORDER BY 1,2;

-- 4e. personas con una suscripción viva en el sistema viejo: toda la que no es terminal. El enum
--     de Hospeda escribe 'cancelled' y el de qzpay 'canceled', así que van los dos, más
--     'incomplete_expired'. Una baja programada sigue 'active' y entra. Antes, la consulta 1 dice
--     qué valores hay de verdad en la columna: uno que no esté en ninguna lista se mira a mano.
SELECT c.external_id AS user_id, s.status, coalesce(s.product_domain,'(null)') AS vertical
FROM billing_subscriptions s JOIN billing_customers c ON c.id = s.customer_id
WHERE s.deleted_at IS NULL
  AND s.status NOT IN ('cancelled','canceled','expired','abandoned','incomplete_expired')
ORDER BY 1;
```

**La población es la unión de los dueños de 4a–4d con alguna fila fuera de `L1` y los
`user_id` de 4e**, contados como personas y no como filas —`V/21` §2.5 mide el umbral en personas
a llamar—. Se une a mano o con una sexta consulta, **sólo después de que las cinco devolvieron
algo o se verificó que están vacías de verdad**: la unión es el `UNION` que la regla de arriba
prohíbe correr a ciegas. Un `partner` con `owner_user_id` nulo no tiene persona a quien llamar y se
lista aparte.
