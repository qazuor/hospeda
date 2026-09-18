---
title: Núcleo — mapa del programa y reglas de escritura
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
status: CURRENT
fase: 2
---

# Núcleo — mapa del programa y reglas de escritura

El diseño de FASE 2: **cómo se construye hoy Verticales + Billing de Hospeda partiendo de cero**
(`00-PDR.md` §1).

> **Este documento cambió de forma el 2026-09-18.** Era el índice de una Master Spec de 22
> capítulos en un solo lugar. `DEC-ARCH-005` partió el programa en dos épicas autónomas y el
> desarme se ejecutó el mismo día, así que ahora es **el mapa de las tres partes** más las reglas
> de escritura, que no cambiaron.

## Qué es y qué no es

**Es** el diseño completo del sistema nuevo: dominio, datos, estados, invariantes, servicios,
API, jobs, proveedor, superficies, testing y migración.

**No es** un plan de implementación (eso es FASE 7), ni una comparación contra lo que existe
(eso es FASE 5), ni una clasificación de código en `KEEP`/`ADAPT`/`REWRITE` — que tiene su
propio gate (`DEC-METH-003`) y **no se anticipa acá ni siquiera de forma implícita**.

## De dónde sale cada afirmación

La regla de fuentes de esta fase es **distinta de la de FASE 1B**, y conviene decirlo porque
las dos conviven en el mismo programa.

FASE 1B se escribió **sólo contra el código**. FASE 2 se escribe **sin el código**: el §0 del
PDR es explícito —*«NO quiero que la implementación existente condicione el diseño del sistema
nuevo»*— y el §65 lo repite al abrir la fase. Las tres fuentes admitidas son las del programa
(`01-decision-log.md`, regla 4):

1. **el PDR** — y si un capítulo cita un `§`, el texto se verifica contra el PDR antes de
   escribirlo (regla 5);
2. **una decisión registrada** en `01-decision-log.md` — son **48** al 2026-09-18, recontadas con
   `rg -c "^### DEC-"` menos la plantilla del formato, y las `SUPERSEDED` no cuentan;
3. **una medición fechada** de `06-mp-validation-matrix.md` o `07-facts-inventory.md`.

**El registro de FASE 1B (`08`) no es fuente de diseño.** Un hallazgo de 1B puede aparecer en
un capítulo **sólo** como advertencia sobre un modo de falla ya observado —nunca como razón
para que el diseño sea de una forma u otra—, y va marcado como tal. Es la línea que el §0
traza: la arquitectura actual no es la fuente de verdad.

## Cómo se relacionan las tres partes

**El núcleo es el único lugar donde algo se define.** Los capítulos de las dos épicas describen
comportamiento y **referencian** el núcleo; no redefinen una entidad, un estado ni un invariante.
Si una épica necesita algo que el núcleo no tiene, se agrega al núcleo — no se declara localmente.

Es el §7 aplicado al documento: *«Debe existir un único motor genérico de billing»*. Una spec
organizada por subdominio reproduce en el papel la duplicación que el §1 nombra como causa de
este programa.

**Y las dos épicas no se referencian entre sí.** Lo único que cruza es el contrato de cobertura
([`12-contrato-de-cobertura.md`](../12-contrato-de-cobertura.md)), que vive afuera de las dos
justamente para que ninguna lo pueda mutar sola.

## Cuándo un hueco se considera cerrado

Los 72 huecos técnicos de `04-open-decisions.md` los resuelve el diseño **sin el owner**. Un
hueco se cierra cuando un capítulo dice qué pasa en todos sus casos, y en el **mismo commit**
se marca cerrado en `04-open-decisions.md` con el capítulo que lo cerró. La fila no se borra.

Dos reglas de método que salen de los propios huecos y rigen este documento:

- **`O-METH-01`** — *«cerrar todas las decisiones funcionales» no cierra en 1A*. Se registra
  acá: el cierre de una decisión funcional es este diseño, y lo que quede abierto al terminarlo
  se declara abierto, no se completa en silencio (§67).
- **`S-METH-01`** — **cuándo caduca una decisión**. Toda afirmación que se apoye en una medición
  lleva su fecha; una medición de `06` o de `07` caduca si el hecho que mide puede haber cambiado,
  y en ese caso se re-mide antes de implementar, no antes de escribir.

---

## Las tres partes

### El núcleo — acá · `docs/nucleo/`

Lo que las dos épicas comparten. **No se parte**: un glosario en dos mitades deja de ser un
glosario, y 51 invariantes numerados de corrido pierden lo único que los hace útiles, que es poder
preguntar **una vez** si están todos.

| # | capítulo | qué define |
|---|---|---|
| `00` | este documento | el mapa y las reglas de escritura |
| `01` | [glosario](./01-glosario.md) | los nombres, el glosario de estados, el criterio Eje 1 / Eje 2 |
| `02` | [modelo de datos](./02-modelo-de-datos.md) | qué sale de la base y qué del código, y el registro de eventos |
| `03` | [máquinas de estado](./03-maquinas-de-estado.md) | las seis reglas de lectura que valen para las nueve máquinas |
| `04` | [invariantes](./04-invariantes.md) | los 51, con quién sostiene cada uno |
| `07` | [outbox y notificaciones](./07-outbox-y-notificaciones.md) | el mecanismo de entrega, el dedup y el huso horario |
| `08` | [auditoría y observabilidad](./08-auditoria-y-observabilidad.md) | qué es auditable y los identificadores de correlación |

### Épica de verticales · `HOS-1353-…/docs/` — **arranca ya**

Once capítulos: `02` modelo de datos sin el precio · `03` Trial, Publicación y Postulación de
Partner · `10` el Eje 2 · `11` trial · `15` entitlements y limits · `17` autorización ·
`18` Partner · `19` superficies · `20` testing · `21` migración · `22` lo legal.

### Épica de billing · `HOS-1354-…/docs/` — **espera la pasarela**

Trece capítulos: `02` las entidades de dinero · `03` Suscripción, Grace, Pausa, Pago, Pago manual,
Addon y el no-retroceso · `05` idempotencia · `06` proveedor · `09` conciliación · `10` retiro de
plan y vertical discontinuada · `12` suscripción · `14` promos, cortesías y grants · `16` addons ·
`19` · `20` · `21` · `22`.

**Falta el `13` (Pagos)**, el único capítulo sin escribir de los 22. Se difirió a propósito: es el
que más depende de con qué pasarela vamos a cobrar.

---

## Las áreas que el §65 exige, y dónde quedaron

| área del §65 | dónde |
|---|---|
| domain · entities · relations · constraints | `01` y `02` del núcleo, más el `02` de cada épica |
| DB | el `02` de cada épica |
| states · transitions | `03` del núcleo, más el `03` de cada épica |
| invariants | `04` del núcleo |
| services · API | cada subdominio, más el `19` de cada épica |
| jobs | cada subdominio |
| provider · MP | `06` — billing |
| manual payments | `13` — billing, **sin escribir** |
| outbox | `07` del núcleo |
| trial | `11` — verticales |
| subscription · billing · pause · grace · cancellation | `12` — billing |
| plans · billing options | `10`, partido entre las dos |
| promo · courtesy · grants | `14` — billing |
| addons | `16` — billing |
| entitlements · limits | `15` — verticales |
| auth | `17` — verticales |
| UI · Admin | `19`, partido entre las dos |
| audit · observability | `08` del núcleo |
| reconciliation | `09` — billing |
| testing | `20`, partido entre las dos |
| migration | `21`, partido entre las dos |

---

## Estado

**21 de 22 capítulos escritos.** El único que falta es el `13`.

El desarme se verificó antes de retirar los originales: **105 de 105 encabezados** presentes en
alguna mitad, y el volumen de texto entre **1,06x y 1,29x** del de partida — el excedente es
frontmatter, la frase de encabezado de cada mitad, y las secciones que van a las dos.
