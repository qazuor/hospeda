---
title: Descomposición de la épica de verticales
linear: HOS-1353
statusSource: linear
created: 2026-09-18
updated: 2026-09-18
status: CURRENT
---

# Descomposición de HOS-1353

> **Esto no es un plan de fechas ni el atomizado en tareas.** Es el corte en unidades de trabajo y
> el orden que sale de las dependencias del propio diseño. El atomizado de cada unidad se hace
> cuando esa unidad arranca, no ahora.

## 1. El criterio de corte

**Se corta siguiendo la cadena de preguntas del diseño**, no por capa técnica ni por capítulo.

Cortar **por capa** —toda la base, después todos los servicios, después la API— tiene el problema
conocido: nada funciona hasta el final, y el primer error de modelado se descubre cuando ya hay
tres capas encima. Cortar **por capítulo** es peor: los capítulos son ejes de diseño y se cruzan —
el `02` toca todo, el `15` y el `17` se necesitan mutuamente.

La cadena que sí ordena es la del propio sistema, y cada eslabón deja **una pregunta contestada**:

```text
¿qué verticales y qué claves existen?      → V1
¿qué otorga un plan?                        → V2
¿qué puede hacer esta cuenta?               → V3
¿tiene título vivo?                         → V4
¿puede hacer ESTO, acá y ahora?             → V5
¿qué pasa cuando algo baja?                 → V6
```

Las tres últimas —Partner, superficies, retención— no están en la cadena porque **no la
condicionan**: se apoyan en ella.

### 1.1 Dos reglas que valen para las nueve

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después es un
   guard que se escribe contra código ya escrito, y para entonces ya hay call sites que lo
   violan. Y cada uno **lleva su caso que lo hace fallar a propósito** — un guard que no puede
   fallar es un comentario con exit code 0.
2. **Ninguna unidad pregunta por dinero.** Si una lo necesita, es señal de que el corte de
   `DEC-ARCH-005` se está filtrando: se mira, no se resuelve en el lugar.

---

## 2. Las nueve unidades

| # | unidad | qué deja funcionando | capítulos | guards |
|---|---|---|---|---|
| **V1** | **El catálogo y su doble guard** | el enum de verticales, su espejo en base, y el catálogo de claves de entitlement y limit en código | `02` §1 (núcleo) · `10` §1 | `G1` `G3` `G8` |
| **V2** | **El catálogo de planes** | `plan`, `plan_version` y sus entitlements y limits, con `rank`, vigente y vendible | `02` §2.1 · `10` §2 | — |
| **V3** | **La resolución de capacidades** | *«¿qué puede hacer esta cuenta en esta vertical?»* tiene respuesta: agregación, scopes, caché e invalidación | `15` §1–3 · `02` §3 | — |
| **V4** | **El contrato de cobertura y el trial** | hay títulos vivos de verdad, y `cobertura()` responde | `11` entero · `03` §2 · `02` §2.2 · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) | — |
| **V5** | **La autorización** | ninguna operación se ejecuta sin pasar por los nueve pasos | `17` entero | `G2` `G4` `G6` |
| **V6** | **Publicación y excedente** | una ficha se publica, cae al perder cobertura, vuelve al recuperarla **—también desde `ARCHIVED`: sola por `PB7`, o a pedido del dueño por `PB8`, que la versión de piso le autoriza—**, y el excedente se resuelve solo **en las dos direcciones**: cae lo más reciente primero y **vuelve primero lo que cayó al final**, con el criterio escrito en los dos avisos | `03` §9 · `02` §2.5 · `15` §4 | `G5` **`G-R6-B`** |
| **V7** | **Partner** | la postulación con su máquina, la presencia como entitlement booleano, y el reclamo por correo | `18` entero · `03` §11 | — |
| **V8** | **Superficies** | Mi Cuenta, los mensajes que hay que decir, el panel de postulaciones | `19` | — |
| **V9** | **Retención** | el reloj de 90 y 180 días **con sus cuatro hechos de reinicio**, la anonimización, el hash del correo y los **tres** avisos | `02` §4 · `22` §3 · `01` §1.2 (núcleo) | el de `D16` |

### 2.1 Por qué V1 va primero aunque parezca infraestructura

Porque sus dos guards son **los únicos que no se pueden agregar después sin reescribir lo
anterior**. `G1` prohíbe nombrar una vertical fuera de los ocho ítems del Eje 2 y `G3` verifica el
catálogo de claves **en las dos direcciones**. Si llegan en V5, para entonces hay cinco unidades
de código que los violan y el guard nace con una lista de excepciones — que es exactamente cómo
un guard deja de servir.

### 2.2 Por qué el trial y el contrato son la misma unidad

Porque **el trial es la implementación de arranque del contrato** (`DEC-ARCH-006`). Separarlos
dejaría el puerto sin ninguna fuente que lo responda de verdad, y ahí la única opción sería un
simulacro que contesta siempre lo mismo — que es justo lo que la decisión descartó, porque **deja
sin ejercer la mitad interesante: perder la cobertura**.

### 2.3 V4 sí tiene un guard, y nace del otro lado

Esta tabla dejó a **V4 sin guards**, y la descomposición de billing encontró el que le
correspondía: **`G13`**, la tercera defensa del
[contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §6.3 — *«un
guard impide que la implementación de arranque llegue a producción»*.

**No puede nacer acá.** Mientras la de arranque es la única implementación que existe, un guard que
prohíba su llegada a producción **falla desde el primer día**, y un guard que falla desde el primer
día nace con una lista de excepciones — que es exactamente el argumento del §2.1, leído al revés.

Nace en **B4** de la otra épica, que es donde aparece la segunda implementación. Queda anotado acá
para que nadie lo lea como un olvido.

### 2.4 Por qué el excedente va con publicación y no con entitlements

El reconciliador se define en el `15` §4, pero **lo que hace es despublicar**, y su criterio —cae
lo más reciente primero— sólo se puede verificar con fichas de verdad. Construirlo en V3 sería
escribirlo sin poder probarlo.

### 2.5 `G-R6-B` va con V6 y no con V9, y las dos candidatas eran razonables

`G-R6-B` (`20` §2) falla si **algo escribe `listing.inactiva_desde` desde un lugar que la lista
cerrada del `01` §1.2 (núcleo) no nombra**. Las dos unidades que lo podían reclamar son **V6**, que
crea la columna (`02` §2.5) y **escribe** en ella —`PB1`, `PB3` y `PB7` son el tercer hecho, y la
relectura de `PB4`/`PB5` es el segundo momento del segundo (`02` §4.2 regla 4)—, y **V9**, que es
la dueña del `01` §1.2 y del reloj que la **lee**.

**Va con V6 por la regla 1 leída entera**: el guard protege **las escrituras**, no la lista como
texto, y V6 es la unidad donde nacen. Y por el argumento del §2.1 leído sobre el orden real: **V9
depende de V4 y V6** (§3), así que un guard que llegue con V9 llega **después de todos los
escritores que existen**, que es la definición de *«un guard que se escribe contra código ya
escrito»*. Puesto en V6, el único escritor que puede aparecer después es uno nuevo — que es
exactamente lo que viene a rechazar.

**Lo que V9 conserva es su parte**: la lista del `01` §1.2 es su capítulo y el guard la cita; si
alguien agrega un quinto hecho, **el cambio es de V9 y el rojo lo da el guard de V6**. Es la misma
forma de `G13`, que vigila el contrato de V4 y nace en `B4` (§2.3): **dónde se construye un guard y
qué documento define su lista son dos preguntas distintas.**

---

## 3. El orden, y qué se puede hacer en paralelo

```text
V1 ──► V2 ──► V3 ──► V4 ──► V5 ──► V6 ──► V8
                                └──► V7 ──┘
                      └──────────────► V9
```

| | |
|---|---|
| **camino crítico** | `V1 → V2 → V3 → V4 → V5 → V6 → V8` |
| **en paralelo** | **V7** una vez que esté V5 · **V9** una vez que estén V4 y V6 |
| **nada arranca antes que V1** | y V1 no depende de nada |

**V5 es la bisagra**: hasta ahí se construyen capacidades, y de ahí en adelante se consumen. Es
también el punto donde el contrato deja de ser una definición y pasa a tener un consumidor real —
el paso 5.

---

## 4. Lo que cada unidad tiene que dejar demostrado

No es una lista de tests: es **qué pregunta tiene que poder contestar alguien de afuera** cuando
la unidad se declara terminada.

| # | la unidad está lista cuando… |
|---|---|
| **V1** | agregar una clave al código sin agregarla a la base **falla**, y al revés también; y nombrar una vertical sin implementar su ítem del Eje 2 **falla** |
| **V2** | dos versiones vendibles y vigentes con el mismo `rank` en la misma vertical **son imposibles**, no un empate a desempatar |
| **V3** | una clave que suma y una que no acumulan **distinto**, y la que no acumula **favorece al cliente**; y revocar una fuente invalida el caché de ese `user + vertical` |
| **V4** | un trial vence de verdad, `cobertura()` pasa de sí a no por sí sola, y un segundo trial para el mismo `user + vertical` **es imposible** |
| **V5** | un recurso ajeno, uno archivado y uno inexistente **contestan lo mismo al que no es su dueño** —y una ficha `ARCHIVED` le acepta a **su** dueño verla, exportarla y reactivarla **aunque no tenga ninguna fuente de clase `TÍTULO`**, porque la versión de piso lo otorga (`02` §2.1)—; y una cuenta inhabilitada no puede averiguar qué permisos tiene probando operaciones |
| **V6** | un trial que vence baja la ficha a `UNPUBLISHED_BY_BILLING` y no a `DRAFT`, y al recuperar cobertura vuelve **sólo** la que bajó el sistema |
| **V7** | aprobar una postulación con el correo de un tercero **no vincula nada** hasta que alguien con acceso a esa casilla lo reclame |
| **V8** | ninguna superficie decide por sí misma: lo que se oculta ya está rechazado por V5 |
| **V9** | la fila de `trial` sobrevive al borrado de la cuenta, y su hash **no** se anonimiza |

---

## 5. Dónde vive cada unidad

Las nueve están en Linear como sub-issues de `HOS-1353`, y cada una tiene su ficha publicada.
El estado en vivo —qué está bloqueado, qué se puede empezar, qué está en curso— se lleva en el
**[tablero](https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB)**, que calcula solo cuáles están listas: una unidad lo está
cuando todas sus dependencias están hechas.

| unidad | issue | ficha |
|---|---|---|
| **V1** | [HOS-1355](https://linear.app/hospeda-beta/issue/HOS-1355) | [ficha](https://claude.ai/artifact/Xy46L4orTxa3MwSaNGgK6o) |
| **V2** | [HOS-1356](https://linear.app/hospeda-beta/issue/HOS-1356) | [ficha](https://claude.ai/artifact/DhWZPJ72BxssRMYp2WTQ6R) |
| **V3** | [HOS-1357](https://linear.app/hospeda-beta/issue/HOS-1357) | [ficha](https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6) |
| **V4** | [HOS-1358](https://linear.app/hospeda-beta/issue/HOS-1358) | [ficha](https://claude.ai/artifact/AfAufifn4m4qurfC4fKgYa) |
| **V5** | [HOS-1359](https://linear.app/hospeda-beta/issue/HOS-1359) | [ficha](https://claude.ai/artifact/KsjdENgkcaJaz49Qk9h1dX) |
| **V6** | [HOS-1360](https://linear.app/hospeda-beta/issue/HOS-1360) | [ficha](https://claude.ai/artifact/Lqmv2r3Vt53ugG2iBKnJEY) |
| **V7** | [HOS-1361](https://linear.app/hospeda-beta/issue/HOS-1361) | [ficha](https://claude.ai/artifact/G9qtHb2DN8upN9QzaE7ueb) |
| **V8** | [HOS-1362](https://linear.app/hospeda-beta/issue/HOS-1362) | [ficha](https://claude.ai/artifact/SqXumRq9YrBQpqiyoNTYGq) |
| **V9** | [HOS-1363](https://linear.app/hospeda-beta/issue/HOS-1363) | [ficha](https://claude.ai/artifact/5Nc7PT6fyh67GoL7Lfmwcd) |

**Las otras cuatro fichas del programa**: [el paraguas](https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA) ·
[la épica de verticales](https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP) ·
[el contrato de cobertura](https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ) ·
[la épica de billing](https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ).

---

## 6. Lo que esta descomposición NO decide

- **Las tareas atómicas de cada unidad.** Se atomiza cuando la unidad arranca, con el estado del
  código de ese momento a la vista.
- **Qué se reescribe y qué se reutiliza.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`).
  Esta descomposición dice **qué hay que tener funcionando**, no de dónde sale.
- **Fechas y esfuerzo.** No hay estimaciones acá a propósito: salen del atomizado.
- **Si cada unidad es un issue de Linear.** Depende de si conviene verlas en el roadmap o
  alcanza con el tracking interno de la épica.
