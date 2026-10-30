---
title: "FASE 8-bis-3 · las instrucciones, comunes a los ocho vectores"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 — instrucciones

**Tercera vuelta del ciclo.** `DEC-METH-006` («el ciclo 8 ↔ 9») manda repetir **hasta que ningún
`CRITICA` quede abierto sin causa declarada**.

**Corre ENTERA, no sólo sobre lo que cambió.** La causa raíz del programa es que las
contradicciones viven **ENTRE capítulos**.

---

## 1. Lo que esta pasada existe para medir, y es una sola cosa

Las dos vueltas anteriores dieron el mismo número, y es el que no baja:

| | 8-bis | 8-bis-2 | **8-bis-3** |
|---|---|---|---|
| hallazgos | 112 | 120 | **?** |
| `CRITICA`, defectos distintos | no se midió | **17** | **?** |
| **atribuidos a la tanda de arreglos anterior** | **25 de 25** en A y B | **17 de 17** | **?** |

Dos veces seguidas, **todos** los críticos los produjo el acto de arreglar. `DEC-METH-009` es la
regla que se agregó para cortar eso, y **esta pasada es la que mide si funcionó**.

### `DEC-METH-009`, que la vuelta anterior no tenía

Un arreglo no está aplicado hasta que: (1) se **nombra por escrito el término que redefine**,
(2) se lo **busca con `rg` sobre los capítulos que el commit NO toca**, y (3) **cada aparición se
resuelve** — se corrige, o se declara por escrito por qué sigue siendo correcta.

Se eligió esa y no «más recorrido» porque está contado: de los 17 críticos anteriores, **doce se
detectaban con esa búsqueda**, y **ninguno** se habría evitado recorriendo mejor el dominio propio.

### Lo que cada hallazgo tiene que declarar

**La línea «¿es nuevo, o es el arreglo?» es OBLIGATORIA**, igual que las dos vueltas anteriores.
Y esta vez lleva **una segunda parte**, porque es lo que mide la regla:

> Si lo introdujo un arreglo de la 9-bis-2: **¿lo habría encontrado el grep de `DEC-METH-009`?**
> Es decir: ¿hay un término redefinido que, buscado en el capítulo donde encontraste el defecto,
> lo habría mostrado? Si **sí**, la regla existía y no se ejecutó bien. Si **no**, la regla no
> alcanza y hay que saber por qué.

Sin esa segunda parte no se puede distinguir *«la regla no sirve»* de *«la regla no se aplicó»*, y
son dos problemas opuestos.

---

## 2. Los doce arreglos de la 9-bis-2 — es dónde mirar primero

Siete commits, `1ca12d709` → `1c972a07b`. Los defectos que los originaron están en
[`../18-fase-8-bis-2/C1-la-costura.md`](../18-fase-8-bis-2/C1-la-costura.md) §2.1.

### Familia del contrato — `1ca12d709`

| # | qué cambió | dónde |
|---|---|---|
| 4 | **el grant es UN instrumento con UN ANCLA POR VERTICAL**: entidad nueva `permanent_grant_vertical` con `UNIQUE(permanent_grant_id, vertical)`. `permanent_grant` **pierde** `plan_id`, `piso_del_trinquete` y `scope`. El trinquete pasa a ser **por vertical** | `12-contrato…` §2.7 y §2.8 · `B/02` §2.4 · `V/15` §2.5 |
| 5 | **`V/15` §2.6 nuevo: el conjunto plegable** — `TÍTULO` + `BASE`, más `COMPLEMENTO` sólo si hay un `TÍTULO` vivo. La celda de `SUMA` ya no dice «todas las fuentes vivas». Guard `G-R2` | `V/15` §2.6 · `V/20` §2 |
| 6 | **`addon_product.version_id` NO es la referencia que transporta la fuente `ADDON`**: es «la versión que se vende hoy», y por eso `addon_product` no necesita ser inmutable | `B/02` §2.4 · `12-contrato…` §2.3 |
| — | `V/10` §2 gana dos lectores (seis) y su invariante se reemplaza por **«una lectura que resuelve lo que alguien TIENE nunca exige `vendible`; una que resuelve lo que SE PUEDE COMPRAR siempre lo exige»** | `V/10` §2 |

### Familia del trial — `49eb99f34`

| # | qué cambió | dónde |
|---|---|---|
| — | **«Vivo» se define y son dos conjuntos**: **fila viva** (las seis de `B/02` §2.2, **de billing, NO cruza la frontera**) y **fuente viva** (la que el contrato devuelve). Dos reglas de uso: ninguna regla de verticales se condiciona sobre una fila viva, y «vivo» pelado no va en un predicado | `nucleo/01` §2.4 |
| 2 | **`T1` gana `cubierto` falso y `T6` `cubierto` verdadero**: disjuntas por construcción, sin regla de precedencia. `T3` pierde su condición vieja. `T2`/`T5` se disparan por **«aparece una fuente viva de clase `TÍTULO`»** | `V/03` §2 |
| 3 | **`T6` suma su mitad de catálogo** (días de trial > 0). Guard `G-R4-B` | `V/03` §2 · `V/20` §2 |
| — | **`NUCLEO/03` regla 7**: dos filas con el mismo `(desde, evento)` tienen guardas disjuntas. Guard `G-R4` | `nucleo/03` §1 |

### Familia de la sucesión — `3692d5deb`

| # | qué cambió | dónde |
|---|---|---|
| 8 | **`S17` se parte en dos**: `S17` mata a la predecesora (desde las **cinco** filas vivas alcanzables; cancela en el proveedor **sólo si la relectura dice que el preapproval sigue vivo**) y **`S18` cierra la sucesión**, con condición *«la predecesora ya no es fila viva»*. `G-R1-A` **re-anclado al ACTO de declarar**; guard nuevo `G-R1-C` | `B/03` §3.2 y §3.3 · `B/20` §2 |
| 9 | **`S13` alcanza TODA fila viva** del beneficiario **en cada vertical que el grant ancla**, y cancela el preapproval esté autorizado o esperando | `B/03` §3.2 |
| 10 | **columna nueva `sucedida_por`** en la predecesora, escrita por `S18`, **que no se borra nunca**. `B/16` §4.2 lee **las dos mitades** | `B/02` §2.2 · `B/16` §4.2 |
| — | La rama de cancelación fallida deja **dos fuentes `SUSCRIPCIÓN` de clase `TÍTULO`**, declarada y sin desempate | `12-contrato…` §2.6 |

### Familia del pago tardío — `99e9d4e24`

| # | qué cambió | dónde |
|---|---|---|
| 11 | **la condición 3 de `B/05` §3 pasa de «un estado que dé título» a «otra fila viva», las SEIS**, `PENDING_AUTHORIZATION` incluido; el desenlace nombra `S5` **y** `S7` | `B/05` §3 |
| 12 | el sujeto es **la predecesora de una sucesión en curso**, enunciado sobre la columna. Condición en `S5`, `S6` y `S7`, y fila nueva **`S19`** (el pago se registra y queda pendiente). Guard `G-R1-D` | `B/12` §5.3 · `B/03` §3.2 · `B/20` §2 |
| 13 | **el disparador del reembolso es el CIERRE de la sucesión, no la llegada del pago**, con **cuatro ramas** enumeradas. `S6` no corre sobre un pago pendiente. Backstop en `B/09` §3 | `B/12` §5.3 · `B/09` §3 |

### Familia de `CHARGE_DECLINED` — `f5731fd65`

| # | qué cambió | dónde |
|---|---|---|
| 14 | **el disparador de `B/16` §4.3 es «deja de ser fila viva»**, con las **cinco** transiciones que sacan una fila principal de las filas vivas (`S3`, `S12`, `S13`, `S16`, `S17`) | `B/16` §4.3 · `B/03` §8 |
| — | **la exención de terminales del cap. 09 se acota**: el preapproval de un complemento **lo cancelamos nosotros**, así que su fila terminal **sí se barre** hasta que la relectura la vea `cancelled` | `B/09` §3 |
| — | `B/12` §4.3 y §4.5.1 tenían la condición **histórica** de `S16` que `B/03` §3.1 ya había reemplazado | `B/12` §4.3, §4.5.1 |

### El cierre — `1c972a07b`

| qué cambió | dónde |
|---|---|
| **el actor del reembolso**: se confirma, no se dispara solo; el aviso al cliente tiene que decir que **la devolución no es instantánea**; el catálogo del núcleo declara que **no queda ninguna operación automática sobre dinero** | `B/12` §5.3 · `nucleo/08` §3 |
| **la comprobación de cero llamadas del cap. 09 se acota**: no alcanza a la sucesora que sigue siendo fila viva en `PENDING_AUTHORIZATION` con su ventana abierta, porque `S18` **todavía no puede** correr | `B/09` §3 |

---

## 3. Las cinco decisiones nuevas, que cambian qué es un hallazgo

| decisión | qué fija |
|---|---|
| **`DEC-METH-009`** | la tercera obligación del protocolo de arreglo (§1) |
| **`DEC-MIG-004`** | **la población de producción se resuelve por teléfono, no por diseño.** Retira **cinco** críticos de la 8-bis-2, declarados con causa |
| **`DEC-RF-002`** | el reembolso del pago pendiente **lo confirma una persona** |
| **`DEC-GRANT-006`** | **la cortesía es por suscripción y se le retiró el `scope`.** Desviación declarada del PDR §34 |
| **`DEC-TRIAL-008`** | quien tiene una suscripción que **no cubre** recibe su trial; **la frontera NO gana un segundo hecho** |

---

## 4. Qué NO es un hallazgo de esta pasada

| no reportar | por qué |
|---|---|
| **los cinco críticos que `DEC-MIG-004` retiró** — `PB2` en la mañana del corte, `listing` sin camino, la lápida entre el paso 3 y el 4, el paso 1 y la cohorte que crece, el período ya pagado | están **declarados con causa por el owner**, que es lo que `DEC-METH-006` permite. La población es conocida suya y se la llama. **No vuelvas sobre esto**: es la tercera pasada que lo redescubre |
| **lo que `DEC-GRANT-006` y `DEC-TRIAL-008` decidieron** | son decisiones de producto **tomadas**, con su razón escrita en el log. Si encontrás que la decisión **no está bien implementada en los capítulos**, eso sí es un hallazgo; que no te guste la decisión, no |
| los **120 de la 8-bis-2** y los **112 de la 8-bis**, salvo que **sigan llegando** sobre el texto nuevo | están en `18-fase-8-bis-2/` y `17-fase-8-bis/`. Si uno sigue llegando, **decilo con su ID viejo** y mostrá en qué paso llega ahora |
| los **141 de la FASE 8** que nunca estuvieron en un racimo | sólo 34 lo estuvieron; que los demás sigan llegando **es por construcción** |
| el **capítulo 13 (Pagos)**, que no existe | límite declarado. Sí vale: **qué se rompe cuando se escriba**, si depende de algo que esta tanda movió |
| *«esto no está medido»* a secas | la pregunta útil es **«si esa medición vuelve al revés, qué se rompe»** |
| **números que no midió nadie** | si citás un número, **citá dónde se midió** |

---

## 5. Cómo se escribe un hallazgo

```markdown
### F-8dXN-NNN — <título en una línea, que diga qué se rompe>

**Qué se rompe.** El resultado concreto, en el sistema, para una persona.

**El camino.** Los pasos, numerados, cada uno con su cita textual (archivo y §).

**Dónde lo permite el diseño.** Las citas, con archivo y §.

**Severidad.** `CRITICA` | `ALTA` | `MEDIA` | `BAJA`, con su motivo.

**¿Es nuevo, o es el arreglo?** OBLIGATORIO. Si lo introdujo un arreglo de la 9-bis-2, **decí
cuál de los doce**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** OBLIGATORIO si la respuesta anterior fue
«el arreglo». Nombrá el término y decí sí o no. Es lo que mide si la regla sirve o si no se
aplicó.
```

**IDs**: `F-8d` + tu vector + número. A1 → `F-8dA1-001`.

**`CRITICA`** es: alguien paga de más o de menos, alguien accede a algo que no le corresponde, o un
dato se pierde sin vuelta. **Lo demás no.**

**Sección obligatoria al final**: `## Ataques que intenté y el diseño resistió`.

**Marcá `NUCLEO`** cualquier defecto de `docs/nucleo/`: lo adopta la pasada C.

---

## 6. Reglas duras

- **El PDR (`00-PDR.md`) no se edita NUNCA.**
- **No edites ningún capítulo.** Esta fase **encuentra**, no arregla. Escribís **un solo archivo**.
- **No toques** el decision log, la matriz, ni los informes de fases anteriores.
- **Los conteos se cuentan**, y **un número que no mediste vos lleva su fuente**.
- **Verificá las citas ajenas contra el TEXTO, no contra el informe que las cita.**
- Todo en **español**, con acentos.

---

## 7. Los ocho vectores

| pasada | agente | vector | material principal |
|---|---|---|---|
| **A** | `A1` | acceso cruzado y autorización | `HOS-1353` |
| **A** | `A2` | máquinas, carreras y huérfanos | `HOS-1353` |
| **A** | `A3` | datos, migración y acoplamiento | `HOS-1353` |
| **B** | `B1` | doble cobro y pérdida de pago | `HOS-1354` |
| **B** | `B2` | máquinas, idempotencia y carreras | `HOS-1354` |
| **B** | `B3` | conciliación, datos y migración | `HOS-1354` |
| **C** | `C2` | liberación, coexistencia y migración del conjunto | todo |
| **C** | `C1` | la costura: capítulos partidos, el contrato, los invariantes | todo |

**El núcleo es de la pasada C.** **C corre después de A y B.**

**Y `C1` corre DESPUÉS de `C2`, no al lado.** En la 8-bis-2 los dos se lanzaron juntos y `C1`
—que tiene el encargo de deduplicar— no tenía el informe de `C2` cuando dedupicó: el conteo salió
15 y el real era 17. **El que consolida no va en paralelo con los que consolida.**

**El encargo propio de `C1`**, que rinde: **deduplicar los críticos** —en la 8-bis-2 los 27 IDs
eran 17 defectos— y **nombrar las contradicciones ENTRE informes**, con veredicto sobre cuál tiene
razón, verificado contra el texto del capítulo y no contra el informe que lo cita.
