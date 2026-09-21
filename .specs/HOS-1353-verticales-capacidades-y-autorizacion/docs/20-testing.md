---
title: Master Spec 20 — Estrategia de testing
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
status: CURRENT
fase: 2
capitulo: 20
---

# 20 · Estrategia de testing

Mitad **VERTICALES** del capítulo 20 del programa. La otra mitad vive en la otra épica.

El §62 abre diciendo que *«testing forma parte del diseño desde el comienzo»* y reparte el trabajo
en cuatro capas. Este capítulo dice **qué va en cada una** y, sobre todo, resuelve las dos cosas
que el §62 deja sin decir y que deciden si la suite sirve:

- **qué tiene que mentir el proveedor falso** (§3), porque uno que se porte bien no prueba nada
  sobre el código que tiene que sobrevivir al real;
- **qué son exactamente los guards** que los capítulos anteriores fueron dejando (§2), que hoy
  están repartidos en siete lugares.

---

## 1. Las cuatro capas

| capa | qué cubre | contra qué corre |
|---|---|---|
| **dominio e integración** (§62.1) | los escenarios funcionales: estados, transiciones, trial, billing, grace, pausa, cancelación, upgrade, downgrade, promo, cortesía, grant, addons, entitlements, limits, autorización, conciliación, **carreras** e **idempotencia** | base real, proveedor falso |
| **guards** | propiedades del **código**, no de una ejecución | el árbol de fuentes, en CI |
| **sandbox del proveedor** (§62.3) | *«suite real más pequeña pero obligatoria»* | Mercado Pago sandbox |
| **E2E** (§62.4) | *«los flujos críticos que hoy requieren smoke manual»* | el sistema entero |

**El §62.1 dice algo que conviene no suavizar: *«cubrir 100 % de escenarios funcionales
relevantes. No obsesionarse con 100 % lines»*.** Un porcentaje de líneas se sube ejecutando
código sin afirmar nada sobre él; un escenario faltante es un caso que nadie pensó. Las dos
métricas no miden lo mismo y sólo una importa.

---

## 2. Los guards, en un solo lugar

Los capítulos anteriores fueron dejando guards y cada uno explicó el suyo. Acá está la lista, que
es lo que permite preguntar *«¿están todos?»* una vez en vez de siete.

| # | qué falla si se rompe | de dónde sale |
|---|---|---|
| G1 | una pieza **nombra una vertical** sin implementar uno de los ocho ítems del Eje 2 | cap. 01 §4.4 (núcleo) |
| G2 | una operación de dominio **no declara** su contexto de vertical | cap. 17 §2.3 (épica de verticales) |
| G3 | una clave usada en código **no existe en la base**, o una de la base **no existe en el catálogo** — las dos direcciones | cap. 02 §1.2 |
| G4 | una transición de suscripción o de trial **escribe roles** | cap. 17 §4.4 (épica de verticales) |
| G5 | una fuente de entitlements **se apaga sin pasar** por el reconciliador de excedentes | cap. 15 §4.2 (épica de verticales) |
| G6 | una autorización **decide sólo por rol** | invariantes §64.12 y §64.13 |
| G8 | aparece `commerce` en fuentes activas | invariante §64.32, §55 |
| G-R2 | el pliegue del conjunto efectivo **recibe una fuente de clase `COMPLEMENTO`** cuando el conjunto no tiene ninguna de clase `TÍTULO` viva — en cualquiera de sus dos tramos | cap. 15 §2.6 |
| G-R2-B | una fuente `GRANT` transporta **un plan de otra vertical** que la de la fuente | cap. 15 §2.5, `12-contrato…` §2.8 |
| G-R3 | una de las **dos versiones no vendibles** de una vertical —la de pre-trial o la de piso— otorga una clave de la clase comercial o un entitlement medido; o la capacidad de activación no cumple el «si y sólo si» | cap. 02 §2.1 |
| G-R3-B | una transición **disparada por el reloj** otorga algo, en vez de quitar | cap. 17 §3.4 |
| G-R3-C | una **operación de dominio no declara** si pasa por el paso 5 | cap. 17 §3.5 |
| G-R4 | una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas** — sobre las nueve máquinas, en las dos épicas | cap. 03 §1 regla 7 (núcleo) |
| G-R4-B | una condición o un evento de una máquina de **la épica de verticales** nombra un **estado de la suscripción** o de la instancia de addon | `12-contrato…` §4 |
| G-R5 | el **tope de una pausa** que declara el catálogo, pasado a días, **alcanza el día del hard delete** de la retención | `D16` (cap. 04 §3, núcleo), cap. 03 §5 (épica de billing), cap. 02 §4.1 |

**`G-R5` vigila una desigualdad entre dos números de configuración, y por eso existe.** El
arreglo de `F-8cC1-001` deja al cliente que pausa a salvo del borrado **porque 120 es menor que
180**, no porque el reloj se detenga: no se detiene, se reinicia al reanudar (cap. 01 §1.2,
núcleo). Es una premisa verdadera el día que se escribe y que **nadie vuelve a mirar** el día que
alguien suba el tope de pausa —el quinto modo que `DEC-METH-010` declara no cubierto por ninguna
búsqueda de texto—. Un guard es lo único que la vuelve a mirar sola. **Es cruzado**: el tope vive
en el catálogo de billing y el día 180 en el capítulo 02 de esta épica, así que `B/20` §2 lo
repite como referencia cruzada, igual que `G-R4`.

**Y vigila esa mitad y no la otra, que hay que decirlo para que nadie lea de más.** *«Se reinicia
al reanudar»* presupone que **la reanudación ocurre**, y eso no es una cifra del catálogo: es una
llamada al proveedor que puede no aplicarse. `G-R5` sigue en verde sobre una pausa que venció hace
veinte días y no reanudó —las dos cifras que compara no cambiaron—, así que **esa mitad la cubren
otras dos piezas y ninguna es un guard**: la rama de fallo de `S10` (`B/03` §3.2) y la **quinta**
comprobación de cero llamadas del barrido (`B/09` §3).

**`G-R4` y `G-R4-B` son el mismo defecto visto en dos planos, y hacen falta los dos.** El primero
mira **la forma** de una tabla: dos guardas que se pueden satisfacer a la vez dejan el desenlace
en el orden de recorrido, y los pares con dos destinos que el diseño declara hoy son **cuatro**:
`T1`/`T6` acá, y `S5`/`S19`, `S7`/`S19` y `S10`/`S25` en la tabla de suscripción (`B/03` §3.2).
**Cuántos son es lo que este guard cuenta**, no una lectura a mano — y el cuarto entró en la FASE
9-bis-4 por una decisión sobre planes retirados (`DEC-SUB-015`), no porque nadie estuviera
mirando esta lista. *(Este párrafo decía que `T1`/`T6` era el único; ya no lo era desde que `S19`
compartió par con `S5` y con `S7`.)* El segundo
mira **de qué habla** una guarda: `T6` estaba escrita sobre *«una suscripción viva»*, un predicado
que el §4 del contrato **le prohíbe evaluar** al lado que tiene que evaluarlo, así que su
implementación iba a leer otra cosa sin decirlo. Disjuntas y **evaluables** son dos propiedades
distintas; `T6` fallaba las dos, y cada guard atrapa una.

**`G-R4` es del núcleo y el catálogo de guards está partido en dos épicas** —la numeración es una
sola—. Esta fila es la definición; `B/20` §2 la repite como referencia cruzada, para que las seis
tablas de billing no queden vigiladas por un guard que su propio catálogo no nombra. **Es un
guard, no dos.**

**`G-R3` es el que más carga lleva, y conviene decir por qué.** El arreglo del trial concentra todo
en un solo dato: **si alguien siembra una de esas dos versiones con una clave comercial, toda la
plataforma la recibe gratis, para siempre, sin consumir ningún trial**. Es un punto único de falla
que antes no existía, y la comparación honesta no es *«¿esto abre algo?»* sino *«¿abre más o menos
que la alternativa?»*: la exención por ruta abre un agujero **por cada ruta que alguien marque**, y
ninguna herramienta lo cuenta; ésta abre uno solo, en una tabla, que un guard puede contar en cada
PR.

**G1 y G2 son la pinza** y ya se explicó en el capítulo 17 §2.3 (épica de verticales): uno acota
**quién puede** nombrar una vertical, el otro obliga a que las operaciones **lo hagan**. Por
separado cada uno deja pasar lo que el otro atrapa.

### 2.1 Un guard se prueba rompiéndolo

**Todo guard de esta lista lleva un caso que lo hace fallar a propósito.** No es rigor de más: un
guard que no puede fallar es un comentario con exit code 0, y no hay forma de distinguirlo de uno
que funciona salvo rompiéndolo.

Vale igual para el mensaje: **el texto con que falla no puede afirmar más de lo que el predicado
verifica.** Un guard que dice *«ninguna operación cruza verticales»* y sólo mira una forma
sintáctica está mintiendo con precisión, que es peor que no estar.

---

## 5. E2E: lo que hoy se hace a mano

7. **trial** completo: activación, campaña previa, vencimiento, campaña de recuperación y
   conversión tardía;
