# Abiertos de la pasada 4 · grupo billing-corte

Dos entradas. Las dos son de **orden de merge**: lo que la fuente manda construir en una pieza depende
de algo que otra pieza, que se mergea después, crea. Las fuentes congeladas en `b949031c70` y las
letras no dicen en qué PR entra.

## 1. El predicado de CC en `B2` lee una tabla que nace en `B3`

- **Qué falta**: en qué PR entran el predicado de CC (la acción 19 cuenta como cliente de una versión
  la fila con un `S38` encolado hacia ella) y su test (`AC:B2:12`, `TEST:B2:12`).
- **Ítems**: `DEC-MP-002#📌4` (pieza dueña del AC: `B2`), `ESQ:3`, `PIEZA:B2`, `PIEZA:B3`.
- **Por qué las fuentes no lo deciden**: el 📌4 dice *«`B2` suma ese predicado al rechazo de la acción
  19, con su test»* (`D/01-decision-log.md:1486`). Pero la cola de cambios programados es `ESQ:3`, que
  *«de `B8b`, la crea `B3` (AP)»* (`D/16-fase-7-del-paraguas.md:986`), y en el grafo `B2` va antes que
  `B3` (`B/descomposicion.md:888-889`, `B1 ─┐ B2 ─┘ ──► B3`). Al merge de `B2` la tabla no existe:
  ni el predicado ni su test de integración pueden correr. Ninguna letra (BM, BZ, CC, AP) dice cuál
  de las dos cosas cede.
- **Pregunta al owner**: ¿cómo entra el predicado de CC?
  1. **El predicado y su test van en el PR de `B3`, como una línea más sobre el rechazo de la acción 19
     que ya existe**; `B2` queda como dueña del AC en la spec y `B3` lo implementa. Costo: bajo, un
     cambio chico en el PR de `B3`. Riesgo: bajo; se corre la regla «cada pieza toca su código», pero
     el código de la acción 19 no cambia de dueño.
  2. **`B2` crea ella la cola de cambios (`ESQ:3`)** y `B3` la da por hecha. Costo: medio, mueve un
     esquema que AP asignó a `B3`. Riesgo: medio; reabre AP.
  3. **El predicado entra en `B2` contra una interfaz interna, como hacen `B5` y `B7` con `B8b` (BL), y
     el test corre en `B3` sobre filas sembradas**. Costo: bajo. Riesgo: bajo-medio; es el patrón de
     BL, pero BL habla de piezas posteriores que implementan una interfaz, no de una tabla.
- **Recomendada: la 1.** Es la que menos letras toca: CC sigue diciendo «`B2` suma el predicado», que
  en la spec sigue siendo el AC de `B2`, y la tabla nace donde AP la puso.
- **Ejemplo con Juan**: Juan se suscribe al Básico la semana siguiente al corte. Meses después pide
  bajar a un plan más barato; su `S38` queda encolado hacia la versión del plan destino, que no tiene
  otro cliente. Si alguien quiere fijarle el precio a esa versión, la acción 19 tiene que rechazarlo.
  Al corte la cola está vacía, así que el predicado no muerde; lo que se decide es sólo en qué PR
  queda escrito y probado.

## 2. La prueba de punta a punta de la baja (`B8a`) necesita las pantallas de `B13a`, que va después

- **Qué falta**: contra qué superficie corre `AC:B8a:15` / `TEST:B8a:15` (la cancelación, de punta a
  punta, con el falso como servidor, el reloj adelantable y el correo capturado) al merge de `B8a`.
- **Ítems**: `DEC-TEST-003` (pieza dueña: `B1`), `LISTA:B8a`, `PIEZA:B8a`, `PIEZA:B13a`.
- **Por qué las fuentes no lo deciden**: `B/20` §5.1 punto 3 manda que *«cada unidad escribe la de su
  flujo: […] la pausa y la cancelación `B8`»* (`B/docs/20-testing.md:762`), y la corrección
  `H-VA-A7b-1` la pone en `B8a`. Pero la pantalla de la baja es de `B13a` (*«la baja self-service es
  criterio de `B13`»*, `FILA:B8a`) y `B13a` espera a `B8a` (`B8a → B13a`, BH). La fuente escribió el
  punto 3 antes de partir `B8` y `B13` (Z), y ninguna letra lo reparte.
- **Pregunta al owner**: ¿dónde vive la prueba de punta a punta de la baja?
  1. **En `B13a`**, que es la primera pieza del corte con la API, la web y la pantalla de la baja
     juntas; `B8a` se queda con sus pruebas de integración. Costo: bajo. Riesgo: bajo; el flujo se prueba
     igual antes del corte, sólo que una pieza más tarde.
  2. **En `B8a`, contra la API construida, sin pantalla** (el e2e dispara la baja por la ruta y asierta
     correo y orden de llamadas). Costo: bajo. Riesgo: medio; no ejercita la pantalla, que es lo que
     `B/20` §5.1 quiere que el e2e reemplace del smoke manual.
  3. **Las dos**: `B8a` escribe la versión sin pantalla y `B13a` la completa con la pantalla. Costo:
     medio, dos pruebas del mismo flujo. Riesgo: bajo.
- **Recomendada: la 1.** Respeta el orden del grafo, no inventa una segunda prueba y deja el e2e donde
  existe la superficie que tiene que ejercer.
- **Ejemplo con Juan**: Juan, con el Básico mensual, se da de baja desde Mi Suscripción. La prueba
  tiene que ver que su correo sale antes que la cancelación en el falso y que, al adelantar el reloj
  hasta su fin de servicio, la fila llega a `CANCELLED`. La pantalla donde Juan aprieta «darme de
  baja» la construye `B13a`; antes de ella, la prueba sólo puede apretar la API.
