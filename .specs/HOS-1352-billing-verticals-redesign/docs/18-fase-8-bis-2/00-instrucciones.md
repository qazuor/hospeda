---
title: "FASE 8-bis-2 · las instrucciones, comunes a los ocho vectores"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 — instrucciones

**Segunda vuelta del ciclo.** `DEC-METH-006` («el ciclo 8 ↔ 9») manda volver a correr la FASE 8
sobre el diseño que la 9 produjo, y repetir **hasta que ningún `CRITICA` quede abierto sin causa
declarada**.

**Corre ENTERA, no sólo sobre lo que cambió.** La causa raíz del programa es que las
contradicciones viven **ENTRE capítulos**.

---

## 1. Lo que la vuelta anterior midió, y por qué esta pasada es distinta

La **8-bis** dio **112 hallazgos y 28 críticos**. El dato que importa no es ése:

> **De los 25 críticos de sus pasadas A y B, 25 los había producido la tanda de arreglos anterior.
> NINGUNO era un defecto preexistente.**

O sea: la condición de corte medía un **stock** cuando el generador es **el acto de arreglar**. La
causa, con caso testigo: la definición de «resuelto» exigía recorrer *«todo su dominio»*, y ése es
**el dominio del PROBLEMA, nunca el del ARREGLO**. Al partir el `UNIQUE` del §11 por `sucede_a`, el
dominio pasó de **90 a 180 pares** y se verificaron los 90 viejos; **la mitad nueva contenía el
doble cobro que el arreglo venía a cerrar**.

`DEC-METH-008` («el dominio del arreglo») lo corrigió, y **esta pasada es la que mide si funcionó**.

### Lo que esta pasada tiene que producir, además de hallazgos

**Cada hallazgo declara si lo introdujo un arreglo de la 9-bis**, igual que la vez pasada. Con eso
se calcula la misma proporción:

| | 8-bis | 8-bis-2 |
|---|---|---|
| críticos | 28 | ? |
| **atribuidos a la tanda de arreglos anterior** | **25 de 25** en A y B | **?** |

**Si la proporción se repite, la regla nueva no funcionó.** Es el único modo de saberlo, así que la
línea de atribución **no es opcional en ningún hallazgo**.

---

## 2. Los 23 arreglos de la 9-bis — es dónde mirar primero

Seis commits, `a720519e1` → `e6f4ff3a7`. El detalle de cada defecto está en
[`../17-fase-8-bis/00-hallazgos.md`](../17-fase-8-bis/00-hallazgos.md) §3.

### El contrato (`12-contrato-de-cobertura.md`) — la frontera

| # | qué cambió | dónde |
|---|---|---|
| 1 | **la clase se deriva del `tipo` Y del `hasta`**: una fuente con `SIN_EMPEZAR` **no cuenta para `cubierto`**. Trae la tabla de 6 tipos × 4 `hasta` con tres combinaciones declaradas imposibles | §2.4 |
| 2 | **el pliegue DESCARTA las fuentes de clase `COMPLEMENTO`** cuando no hay ninguna de clase `TÍTULO` viva | §2.4 |
| 5 | las tres defensas del §6 recuperan su sujeto, con el caso concreto que distingue una implementación correcta de una constante | §5.1 |
| 6 | **el grant ancla un plan POR CADA VERTICAL** de su scope | §2.8 |
| 7 | la dirección inversa gana **`direcciónDeCambio(origen, destino) → SUBE \| BAJA`** (`DEC-ARCH-008`) | §4.1 |
| 16 | **el mapa completo de los nueve estados**: cuál emite fuente y con qué `hasta`. **Esperar autorización NO emite** | §2.6 |

### Verticales (`HOS-1353`)

| # | qué cambió | dónde |
|---|---|---|
| 3 | el criterio eran **dos preguntas**: todas las operaciones corren la resolución; **sólo las que escriben pasan por el paso 5** | `V/17` §3.5 |
| 4 | **cuatro entradas nuevas** en la invalidación del caché, más la regla que las generaliza | `V/02` §3.2 |
| 8 | **`T6`**: quien publica teniendo ya una suscripción viva nace con el trial **consumido** | `V/03` §2 |
| 9 | **`PB2` y `PB3` se disparan por el CAMBIO de `cubierto`**, no por listas de transiciones | `V/03` §9 |
| 10 | **`addon_instance` ancla su `addon_version`** | `V/02` §2.1 · `B/02` §2.4 |

### Billing (`HOS-1354`)

| # | qué cambió | dónde |
|---|---|---|
| 11 · 12 | **`S17`**: cancela la predecesora cuando la sucesora queda autorizada **y limpia `sucede_a`**. La sucesión por fin **termina** | `B/03` §3.2 |
| 13 | la fecha de primer cobro guardada es **la que el proveedor confirmó** | `B/02` §2.2 |
| 14 | la sucesora nace con fecha **posterior al vencimiento de su ventana de autorización** | `B/12` §5.2 |
| 15 | **`S5` no aplica** sobre una fila que ya declaró sucesión: el cobro entra, se registra y **se reembolsa** | `B/12` §5.3 |
| 17 | la excepción de `CANCEL_SCHEDULED` **exige releer el preapproval por id** | `B/02` §2.2 |
| 18 | **los ocho pares** (leído en el proveedor × lo nuestro), enumerados con su veredicto | `B/03` §10.1 |
| 19 | la fila marcada **SÍ se barre** —lo que se agrega es el aviso— y **la marca lleva reloj** | `B/09` §3 |
| 20 | **`S16` lee por AUTORIZACIÓN**, no por la historia de la persona | `B/03` §3.1 |

### El corte

| # | qué cambió | dónde |
|---|---|---|
| 21 | **la lápida**: el compromiso cancelado se conserva en `CANCELLED` con su `provider_link`, escrito **después** de cancelarlo | `B/21` §2.5 |
| 22 | la población existente **se despublica y se la llama**; **no se siembra nada** | `V/21` §2.4 |
| 23 | **el orden del corte**: cancelar → **verificar releyendo** → desplegar → escribir. El paso 2 es el gate | `16-fase-7-del-paraguas.md` §4 |

### Y tres correcciones de registro

`DEC-MIG-003` precisada (*«ninguna fila VIVA»*), el resumen de invariantes recontado entero
(**52, 10 de base, 18 apoyos sobre 15**), y *«las doce fichas del catálogo»* **retirado por no ser
una medición** — lo medido son 12 filas de alojamiento y 22 usuarios.

---

## 3. La regla nueva, que la pasada anterior no tenía

`DEC-METH-008` agrega dos obligaciones, y **son el corazón de esta pasada**:

1. **El dominio que el ARREGLO crea.** Si un arreglo agrega un eje a una clave, a un estado o a una
   clasificación, **el dominio se multiplica**. Los ejes nuevos de esta tanda, para recorrer:
   - `hasta` × `tipo` (la clase ahora sale de los dos) — **el contrato ya trae esa tabla: verificala,
     no le creas**;
   - `sucede_a` **nulo / no nulo** cruzado con los nueve estados y con las operaciones;
   - **`T6`** y **`S17`**, que son transiciones nuevas: qué pares habilitan y cuáles cierran;
   - los **ocho pares** del espejo del `B/03` §10.1 — ¿son ocho de verdad, o el proveedor devuelve
     más estados?
2. **La pregunta explícita**: **«¿qué premisa de OTRO arreglo estoy volviendo falsa?»** La vuelta
   anterior la produjo sin hacerla: `R2` construyó el título `BASE` sobre una premisa que `R3`
   volvió falsa. **Ahora hay 23 arreglos que se escribieron en cuatro tandas distintas.**

---

## 4. Qué NO es un hallazgo de esta pasada

| no reportar | por qué |
|---|---|
| los **112 de la 8-bis**, salvo que **sigan llegando** sobre el texto nuevo | están en `17-fase-8-bis/`. Si uno sigue llegando, **decilo con su ID viejo** y mostrá en qué paso llega ahora |
| los **141 de la FASE 8** que nunca estuvieron en un racimo | **sólo 34 de los 141 lo estuvieron**; los demás nunca se fueron a arreglar y que sigan llegando **es por construcción** |
| **`RES-01`** — la mitad `Guest` de `F-8A1-005` | nombrada en [`../15-fase-9/08-residuos-del-paso-1.md`](../15-fase-9/08-residuos-del-paso-1.md), con decisión del owner |
| el **capítulo 13 (Pagos)**, que no existe | límite declarado. Sí vale: **qué se rompe cuando se escriba**, si depende de algo que esta tanda movió |
| *«esto no está medido»* a secas | la pregunta útil es **«si esa medición vuelve al revés, qué se rompe»** |
| **números que no midió nadie** | la vuelta pasada un informe convirtió *«12 filas»* en *«12 publicadas»* y el dato circuló como medición. **Si citás un número, citá dónde se midió** |

---

## 5. Cómo se escribe un hallazgo

```markdown
### F-8cXN-NNN — <título en una línea, que diga qué se rompe>

**Qué se rompe.** El resultado concreto, en el sistema, para una persona.

**El camino.** Los pasos, numerados, cada uno con su cita textual (archivo y §).

**Dónde lo permite el diseño.** Las citas, con archivo y §.

**Severidad.** `CRITICA` | `ALTA` | `MEDIA` | `BAJA`, con su motivo.

**¿Es nuevo, o es el arreglo?** OBLIGATORIO. Si lo introdujo un arreglo de la 9-bis, **decí cuál
de los 23**. Es el dato con el que se mide si el ciclo converge.
```

**IDs**: `F-8c` + tu vector + número. A1 → `F-8cA1-001`.

**`CRITICA`** es: alguien paga de más o de menos, alguien accede a algo que no le corresponde, o un
dato se pierde sin vuelta. **Lo demás no.** El conteo de críticos decide si el ciclo sigue.

**Sección obligatoria al final**: `## Ataques que intenté y el diseño resistió`.

**Marcá `NUCLEO`** cualquier defecto de `docs/nucleo/`: lo adopta la pasada C.

---

## 6. Reglas duras

- **El PDR (`00-PDR.md`) no se edita NUNCA.**
- **No edites ningún capítulo.** Esta fase **encuentra**, no arregla. Escribís **un solo archivo**.
- **No toques** el decision log, la matriz, ni los informes de fases anteriores.
- **Los conteos se cuentan**, y **un número que no mediste vos lleva su fuente**.
- **Verificá las citas ajenas contra el TEXTO, no contra el informe que las cita.** La vuelta
  pasada un agente construyó un `CRITICA` citando un informe de la FASE 9 como si fuera el
  capítulo, y otro midió que eso nunca había llegado a ningún capítulo.
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
| **C** | `C1` | la costura: capítulos partidos, el contrato, los invariantes | todo |
| **C** | `C2` | liberación, coexistencia y migración del conjunto | todo |

**El núcleo es de la pasada C.** **C corre después de A y B**, y lee sus informes.

**Y C1 tiene un encargo propio**, que la vuelta pasada demostró que rinde: **deduplicar los
críticos** —cinco pares eran el mismo defecto visto por dos agentes ciegos— y **nombrar las
contradicciones ENTRE informes**, con veredicto sobre cuál tiene razón.
