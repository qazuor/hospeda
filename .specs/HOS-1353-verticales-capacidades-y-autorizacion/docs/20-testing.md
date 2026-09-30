---
title: Master Spec 20 — Estrategia de testing
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
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
| G2 | ~~**dos mitades, con dos mensajes**~~ **tres mitades, con tres mensajes**. **(a)** una operación de dominio **no declara** su contexto de vertical; **(b)** una operación **sobre ~~una ficha~~ un recurso que guarda su vertical** —la ficha y su contenido, la presencia de Partner, la instancia de addon— toma su contexto de vertical **del pedido y no ~~de la ficha~~ del recurso** (FASE 8 completa, `F-8CA1-001`, owner 2026-09-25; generalizada por la FASE 9 completa, decisión 7a); **(c)** una operación **escribe la vertical de un recurso que ya existe** —la vertical de una ficha es inmutable desde el alta, `V/02` §2.5— (owner 2026-09-25; FASE 9 completa, decisión 7a) | cap. 17 §2.3 y §1.2 precisión 6 (épica de verticales); cap. 02 §2.5 |
| G3 | una clave usada en código **no existe ~~en la base~~ en el catálogo**~~, o una de la base **no existe en el catálogo** — las dos direcciones~~. **La otra dirección, una clave de la base que no está en el catálogo, deja de ser del guard y pasa a ser una restricción de la base** (revisión del owner, 2026-09-28, N1): la tabla de claves la escribe la migración desde el catálogo, y toda asignación de un plan apunta a ella por FK, así que el panel no puede cargar una clave que el código no conoce. CI no ve la base de producción, que desde N1 se edita desde el panel | cap. 02 §1.2; `NUCLEO/02` §1.2 y §1.4 |
| G4 | una transición de suscripción o de trial **escribe roles** | cap. 17 §4.4 (épica de verticales) |
| G5 | una fuente de entitlements **se apaga sin pasar** por el reconciliador de excedentes | cap. 15 §4.2 (épica de verticales) |
| G6 | **dos mitades, con dos mensajes**. **(a)** una autorización **decide sólo por rol**; **(b)** *«un rol entró al conjunto efectivo»*: una construcción del conjunto efectivo lee un rol —el cargador que le da el conjunto entero a `SUPER_ADMIN`, `ADMIN`, `EDITOR` o `CLIENT_MANAGER`— (FASE 9 vuelta 1, `F-8V1A1-002`) | invariantes §64.12 y §64.13; cap. 17 §4.3 |
| G8 | ~~aparece `commerce` en fuentes activas~~ **aparece, sin distinguir mayúsculas, el nombre del agrupamiento viejo de Gastronomía y Experiencia en cualquier archivo versionado del repositorio**: código, esquema, tipos, tests, docs, specs, comentarios, nombres de archivo, la historia de migraciones y el ledger del seed. **Una sola exención, por nombre: el PDR de HOS-1352 (`00-PDR.md`)**, que no se edita y lo nombra en su §55.1; la causa va escrita en el guard (revisión del owner, 2026-09-28, C3, `L2-a` y `L2-b`). **Ya no hay excepción histórica**: lo que la nombre se reescribe o se borra. El guard arma el patrón sin escribir la palabra, para no fallar sobre su propio texto, **y el script del corte arma igual el valor viejo que tenga que nombrar al leer la base vieja: sin escribir la palabra de corrido, así que pasa `G8` sin entrar a la lista de pendientes** (`16-fase-7…` §4.2; revisión del owner, casos vecinos, 2026-09-29, caso F-D). **Hasta el corte la historia de migraciones y el ledger del seed la nombran y sólo el paso 6 del corte los reemplaza** (`16-fase-7…` §4.2): ~~cómo corre el guard mientras tanto no está decidido (`30-revision-del-owner/14-` §5)~~ **mientras tanto el guard lleva una lista de pendientes cerrada, con ~~dos entradas~~ ~~tres entradas y ninguna más~~ ~~**tres entradas por carpeta y un trinquete de archivos, y nada más** (verificación corta, 2026-09-29, lote M-E)~~ **tres entradas por carpeta, y ninguna más** (verificación corta, 2026-09-29, lote N-A: el trinquete salió): la historia de migraciones (`packages/db/src/migrations/**`) **sin el carril de extras (`packages/db/src/migrations/extras/**`), que no entra a la lista: los extras no tienen registro y se reaplican, así que un extra nuevo con la palabra falla desde el primer día y no el del corte, y `U1` reescribe los dos que la nombran hoy, `032` (nombre y comentarios) y `033` (comentario)** (FASE 5, owner 2026-09-30, lote 1 H, `F5-BD-019`, `F5-U1-055`)~~ y~~, las migraciones de datos del seed que el ledger anota (`packages/seed/src/data-migrations/**`)** **y las carpetas del programa en `.specs/` (`HOS-1352-…`, `HOS-1353-…` y `HOS-1354-…`), que por el caso 41 se quedan en el repositorio hasta el cierre de HOS-1352** (revisión del owner, casos vecinos, 2026-09-29, caso H-A). **La tercera entrada son sólo esas tres carpetas: las specs de otros issues y `.qtm/` que la nombran no entran a la lista, y las limpia ~~`V1`~~ la limpieza del principio en el mismo cambio que construye el guard** (verificación corta, 2026-09-29, lote N-A; `16-fase-7…` §4.6) (`21` §4; revisión del owner, casos vecinos, 2026-09-29, caso I-D). **Lo que está en la lista no falla, y la lista no admite ~~una tercera~~ ~~una cuarta entrada~~ **una cuarta carpeta**~~, y el trinquete no admite un archivo nuevo~~ (lote N-A). ~~El paso 6 del corte la vacía~~ El paso 6 del corte le saca las dos historias, en el mismo commit que ~~reemplaza las dos historias~~ las reemplaza, y un build destinado a producción después del corte falla si ~~no está vacía~~ le queda una de las dos** (revisión del owner, casos vecinos, 2026-09-29, caso 8). **Esa regla la enciende el mismo commit del paso 6**: desde ahí, que la lista vuelva a tener ~~algo~~ una de las dos historias falla; antes, el despliegue del paso 3, que es un build destinado a producción con la lista llena, no falla por ella (revisión del owner, casos vecinos, 2026-09-29, caso F-B). **La tercera entrada la saca el commit del cierre de HOS-1352**, que reescribe el diseño vigente sin la palabra y saca los informes históricos (`HOS-1352/spec.md`, *«Al cerrar HOS-1352»*), **y ese mismo commit extiende la regla: desde ahí, la lista no vacía falla** (revisión del owner, casos vecinos, 2026-09-29, caso H-A). ~~**El trinquete** (verificación corta, 2026-09-29, lote M-E): **`G8` nace con la lista medida de los archivos que ese día nombran la palabra fuera de las tres carpetas y del PDR**, que es el código del sistema viejo que corre hasta el corte (medido en `30-revision-del-owner/31-` §2, `VC-VT-01`, sobre `origin/staging` `35e2d63e81`: unos 1229 archivos versionados, 326 con la palabra en el nombre; la lista real es la que genere `V1`). **La lista sólo se achica**: falla un archivo que la nombra y no está en la lista (una aparición nueva, también en el nombre de un archivo); falla un archivo de la lista que ya no la nombra o que ya no existe, así que la unidad que lo reescribe o lo borra **lo saca de la lista en el mismo cambio**; y falla una lista que crece. **La genera un script** que construye `V1` con el guard: es el propio `G8` en modo de generación, con el mismo patrón armado en partes y el mismo conjunto de archivos (los versionados del árbol del commit de `V1`, después de la limpieza que ese commit hace), así que el guard y la lista no pueden discrepar. Excluye el PDR y las tres carpetas, y no recoge lo que `V1` limpia en ese commit (el `CLAUDE.md` raíz, el i18n, las specs de fuera del programa y `.qtm/`, el rol, los permisos, la tabla de contactos y el tipo de partner), que ya no la nombra. **La lista no escribe la palabra**: guarda cada ruta con la palabra enmascarada, que el guard reconstruye como su patrón, así que no falla sobre sí misma. **Lo vacían** las unidades que reescriben o borran esos archivos y, lo que quede, el retiro del sistema viejo después del corte (`16-fase-7…` §4.5, punto 3). **La regla que enciende el paso 6 no lo alcanza**: un build de producción después del corte falla si le queda una de las dos historias, no por el trinquete, porque el código viejo se borra después; **la que extiende el commit del cierre de HOS-1352 sí**: desde ahí la lista entera no vacía falla, así que la épica no cierra con el trinquete sin vaciar.~~ **Sin trinquete y sin lista de pendientes de código** (verificación corta, 2026-09-29, lote N-A): el trinquete que el lote M-E le sumaba el mismo día sale antes de llegar al código, porque **el código del sistema viejo sale entero de la rama al principio de la épica**, en la limpieza del principio (`16-fase-7…` §4.6), que borra el cobro viejo y renombra o borra todo lo que nombra la palabra. **`G8` corre sobre todo el repositorio desde que nace**, con el PDR como única exención y las tres carpetas como única lista, y nace verde porque la limpieza va antes que él o con él. **Las tres carpetas siguen haciendo falta**, revisadas una por una: la historia de migraciones, porque una migración aplicada no se reescribe y la que la rama genera para borrar lo viejo lo nombra (hasta el paso 6); las migraciones de datos del seed, que el ledger anota como aplicadas, ~~entre ellas las 11 congeladas del caso 9~~ **menos las que usan el cobro viejo, que `U1` saca de la rama** (FASE 5, owner 2026-09-30, lote 1 C, `F5-U1-048`: ya no se congelan) (hasta el paso 6); y las carpetas del programa, cuyos informes históricos la citan (hasta el cierre de HOS-1352). Lo construye ~~`V1` con el guard~~ la unidad que hace la limpieza del principio, en el mismo cambio ~~(⚠️ si es `V1` o una unidad propia anterior pide decisión del owner: `30-revision-del-owner/34-` §3, N-A-1)~~: **`U1`, la unidad del paraguas que va antes de `V1` y de `B1`** (verificación corta, 2026-09-29, lote O-A; `16-fase-7…` §4.6) | invariante §64.32, §55; revisión del owner, 2026-09-28, C3 |
| **G13** ✚ | ~~la implementación **de arranque** de `cobertura()` llega a producción~~ **un build destinado a producción importa el módulo de la implementación de arranque que contesta por billing** (~~el `no` a las cuatro fuentes de billing~~ ~~y el `NINGUNA` de `finDeServicio`~~; la pregunta salió con la revisión del owner, 2026-09-28, C8). **Son las seis respuestas de arranque que contestan por billing: el `no` a las cuatro fuentes de billing, el `detenida: no` de `retenciónDetenida` y el `no` de `puedeCobrarle` (contrato §5.1 y §6.3), las seis en el módulo vigilado, y un caso de `G13` por cada una que lo pone en rojo si el build de producción la enlaza** (FASE 9 vuelta 3, `F-8V3C1-002`, `F-8V3D1-001`), **no** la resolución del trial ni la del título `BASE`, que son de verticales en las dos implementaciones (contrato §6.3; FASE 9 vuelta 2, `F-8V2C1-005`; la fila, corregida en la verificación, `22-` §5) | [contrato](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §6.3. **Lo construye `V4`**, con la implementación de arranque: falla sobre un build destinado a producción, no sobre la rama, así que calla hasta que un build apunte a producción y la defensa existe desde el primer día. **Vino de `B/20` §2** (owner 2026-09-26, `G5-5`): allá lo construía `B4` con la razón *«el consumidor del contrato es billing»*, que era falsa —el consumidor de `cobertura()` es verticales— |
| **G14** ✚ | **una mitad importa a la otra**: el código de la épica de verticales importa algo de la de billing, o al revés, fuera del package del contrato (`12-contrato…` §7.1). Las dos importan sólo ese package, y el único lugar que junta las dos es la raíz de composición de `apps/api`, que el guard nombra como única excepción. **Importar el package de pruebas compartido del reloj adelantable no es cruzar**: no es de ninguna de las dos mitades (`B/20` §5.1; revisión del owner, casos vecinos, 2026-09-29, caso 31). **La app del panel no junta las dos**: la pantalla única de plazos las lee por la API, sin importar ninguna (revisión del owner, casos vecinos, 2026-09-29, caso H-F). **Se rompe a propósito** agregando en verticales un import de billing, y el rojo tiene que nombrar el archivo y la mitad importada | revisión del owner, 2026-09-28, N6, `L1-d`; `12-contrato…` §4.2 y §7.1. **Lo construye `V1`**, que crea el package. **No ve** una lectura de tablas de la otra mitad por `@repo/db` (`12-contrato…` §4.2) |
| G-R2 | el pliegue del conjunto efectivo **recibe una fuente de clase `COMPLEMENTO`** cuando el conjunto no tiene ninguna de clase `TÍTULO` viva **que no sea de `tipo: TRIAL`** — en cualquiera de sus dos tramos. **El caso que lo distingue de la versión anterior**: un addon `USER` o `GLOBAL` comprado con la suscripción de otra vertical, contra una vertical cuyo único título es un trial, **no entra** (`V/11` §5.3; FASE 8 completa, `F-8CA1-004`, `F-8CA2-011`, `F-8CC1-006`) | cap. 15 §2.6, `V/11` §5.2–§5.3 |
| G-R2-B | una fuente `GRANT` transporta **un plan de otra vertical** que la de la fuente | cap. 15 §2.5, `12-contrato…` §2.8 |
| **G-R2-C** | una fuente `ADDON` de alcance `USER` o `GLOBAL` **se emite en una vertical que no está entre las compatibles de su producto** (`addon_product`, `B/02` §2.4). **Gemelo de `G-R2-B`**: aquél vigila que un grant no transporte el ancla de otra vertical, éste que un addon global no aparezca donde su producto no llega | `12-contrato…` §2.7; owner 2026-09-25, FASE 9 completa, decisión 4e, `F-8CA1-008`. **Lo construye `B10`** de la otra épica (owner 2026-09-25, FASE 9 completa, decisión 10c; `B/descomposicion.md` §2, fila `B10`) |
| `G-R3` (validación del panel) | **Deja de ser un guard de CI y pasa a ser una validación del panel, con el mismo nombre** (revisión del owner, 2026-09-28, N1, `L1-f`): el catálogo vive 100 % en la base y se edita desde el panel, así que CI no ve el de producción. **Lo que sigue es lo que la acción administrativa *«publicar una versión de plan»* rechaza** (`NUCLEO/02` §1.4, `NUCLEO/08` §3) y lo que el paso 3a del corte corre sobre la base de producción después de la migración única del catálogo. **Conserva su nombre para que las citas sigan apuntando a lo mismo, y no se cuenta entre los guards.** ~~**tres mitades, con tres mensajes**~~ **cuatro mitades, con cuatro mensajes** (la cuarta, FASE 9 vuelta 1, `F-8V1A1-005`). **(a)** una de las **dos versiones no vendibles** de una vertical —la de pre-trial o la de piso— otorga una clave de la clase comercial o un entitlement medido; **(b)** la versión de piso de una vertical **no otorga** alguna de las **dos claves** que las filas 2 y 3 de su lista cerrada declaran —*«contratar una suscripción»* y *«recuperar lo suyo»*—; **(c)** la capacidad de activación no cumple el «si y sólo si»; **(d)** ~~ni la versión de trial ni las dos no vendibles declaran `hereda Turista VIP`~~ **la versión de trial o una de las dos no vendibles declara `hereda Turista VIP`** (escrita como la falla, igual que las otras tres; decía el invariante y, leída a la letra en la columna *«qué falla si se rompe»*, fallaba cuando ninguna la declaraba; FASE 9 vuelta 1, §4 punto 7 de `25-verificado-G5-y-registro`): es una columna y no una clave, así que (a) no la ve. Mensaje propio: *«herencia de VIP fuera de una versión vendible»* | cap. 02 §2.1 |
| G-R3-B | una transición **disparada por el reloj** otorga algo, en vez de quitar | cap. 17 §3.4 |
| G-R3-C | una **operación de dominio no declara** si pasa por el paso 5 | cap. 17 §3.5 |
| G-R4 | una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas** — sobre las ~~nueve~~ **diez** máquinas (la décima, el reembolso: owner 2026-09-25, FASE 9 completa, decisión 5a), en las dos épicas | cap. 03 §1 regla 7 (núcleo) |
| G-R4-B | una condición o un evento de una máquina de **la épica de verticales** nombra un **estado de la suscripción** o de la instancia de addon | `12-contrato…` §4 |
| ~~G-R5~~ | ~~el **tope de una pausa** que declara el catálogo, pasado a días, **alcanza el día del hard delete** de la retención~~ | **retirado** (revisión del owner, 2026-09-28, C14, `L1-c`): la pausa pedida por el dueño detiene el reloj de retención (`12-contrato…` §4.1, `retenciónDetenida`), así que el tope de pausa ya no tiene que quedar por debajo del día del borrado y el guard se queda sin sujeto; sale con `D16`. El número no se reusa |
| **`G-R5-B`** (validación del panel) | **Deja de ser un guard de CI y pasa a ser una validación de la acción *«cambiar un plazo»*, con el mismo nombre, y no se cuenta entre los guards** (revisión del owner, 2026-09-28, C9, C11): el plazo vive en la base y lo cambia el súper admin (`NUCLEO/02` §1.5). ~~el **`N` de `PB5`** que declara la configuración, pasado a días, **no es menor que 6 meses**~~ **Rechaza un `N` de `PB5` que, en su peor caso en días (meses de 31), no quede por debajo del plazo de borrado de la misma versión de plazos**: la cota deja de ser 6 meses literal, porque el 180 dejó de ser fijo | cap. 03 §9 (`PB5`), cap. 02 §4.1; FASE 8 completa, `F-8CA2-014`, owner 2026-09-25. **Misma forma que `G-R5`**: compara una cifra de configuración contra una cota, y ninguna búsqueda de texto lo vería cambiar. **Lo construye `V6`**, la unidad que construye `PB5` y su `N` (`descomposicion.md` §2) |
| G-R6 | una **condición de transición lee una columna que NINGUNA transición escribe** — sobre las ~~**nueve**~~ **diez** máquinas (la décima, el reembolso, FASE 9 completa, 5a), en las dos épicas, y contra **las tablas que los capítulos declaran** y no contra el subconjunto ya construido (`B/20` §2) | `DEC-TEST-001` y su ampliación del mismo día, `B/03` §7.2 (`MP5`), `F-8eB1-002`. **Referencia cruzada**: lo define `B/20` §2, donde nació. Figura acá porque **la columna que más caro sale muerta es de esta épica**: `listing.inactiva_desde` (cap. 02 §2.5) |
| **G-R6-B** | **las ~~DOS~~ TRES mitades de la lista cerrada de `listing.inactiva_desde`** (cap. 02 §2.5; la tercera, la *(d)*, revisión del owner, casos vecinos, 2026-09-29, caso 16). **(a) Escritores**: una escritura de la columna —el efecto de una transición, un camino de servicio o un barrido— **o de `listing.plazos_version`** (que se escribe sólo junto con `inactiva_desde`; revisión del owner, casos vecinos, 2026-09-29, caso 48) que **no sea uno de los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco hechos** del cap. 01 §1.2 (núcleo; el 4 salió con la revisión del owner, 2026-09-28, C8) **ni la escritura `C` del corte en la migración estructural del corte** —**el sexto, *«se levanta la moderación»*, entra con un solo ejecutor, `PB11`** (owner 2026-09-25; FASE 9 completa, decisión 5b)—; el quinto, ~~**la primera rama de `PB2`**~~ **la pérdida de cobertura del dueño en la vertical**, entra a la lista **con sus ~~dos~~ tres ejecutores** —la primera rama de `PB2` sobre la ficha publicada y el recálculo que el aviso despierta sobre las demás del dueño, **y el reconciliador diario de cobertura sobre las demás cuando el aviso se perdió** (cap. 03 §9, `DEC-ARCH-009`)— y la segunda rama de `PB2` sigue afuera (FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, owner 2026-09-25)—. **El reconciliador no agrega ningún hecho**: escribe el 2 y el 5, y la mitad *(a)* lo admite por la lista. **(b) Consumidores**: una lectura de la columna que **no figure entre los ~~cinco~~ seis consumidores** que el cap. 02 §2.5 enumera y cierra (recontados, `F-8CD1-009`). **(c) Consumidores que dejaron de serlo**: uno de esos **~~cinco~~ seis** que **ya no lee** la columna. **(d) Lectores de retención sin la pausa** ✚ (revisión del owner, casos vecinos, 2026-09-29, caso 16): un consumidor de la columna que decide archivar, borrar o avisar (`PB4`, `PB5`, `PB9` y los avisos de retención) y **no consulta `retenciónDetenida`** (`12-contrato…` §4.1) al ejecutar **o no cuenta desde el más tardío de los dos instantes, `listing.inactiva_desde` y el `pausaTerminadaEn` que devuelve** (verificación corta, 2026-09-29, VC-VT-05: la regla de F-A tiene dos mitades, y la *(d)* vigilaba sólo la primera); es la misma lista de lectores que la mitad *(b)* y el mismo recorrido. **El mensaje nombra la mitad que falló** — *«escritor fuera de la lista»*, *«lector fuera del inventario»*, ~~o~~ *«lector declarado que ya no lee»* **o *«lector de retención que no pregunta por la pausa»***, nunca uno solo para ~~las tres~~ las cuatro | `DEC-TEST-001`, **tercera y cuarta enmiendas** del mismo día; cap. 02 §2.5 —*«se escribe en los ~~cuatro~~ ~~cinco~~ seis hechos —y en la escritura única del corte— y en ninguna otra parte»*, *«y la leen ~~cinco~~ seis consumidores»*—; `DEC-DATA-002`. Lo construye **V6** (`descomposicion.md` §2). `B/20` §2 lo repite como referencia cruzada |
| **G-R9** ✚ | **una tabla del esquema cuelga de `listing` y no tiene fila en la lista cerrada de `PURGED`** (cap. 02 §4.1). Recorre `packages/db/src/schemas/` y toma **toda tabla con FK a `accommodations`, `gastronomies` o `experiences`** (leyendo el `references(` aunque el formateador lo parta en varias líneas, que es como la primera medición perdió `posts`) **y toda tabla con una columna `entity_type`**, y falla si una no aparece en la columna de tablas de la lista. ~~Hoy da 29 con FK y 11 con `entity_type`, y la lista nombra las 40~~ **Sobre la rama después de la limpieza del principio da ~~28 con FK y 10 con `entity_type`~~ 29 con FK y 9 con `entity_type` (FASE 5, owner 2026-09-30, lote 6 G, `F5-BD-011`: las dos del cobro viejo estaban entre las de `entity_type`), y la lista nombra 40: esas 38 y las dos del modelo nuevo, `pedido_de_arreglo` y `addon_instance`, que el recorrido encuentra si cuelgan de la ficha por FK o por `entity_type`** (FASE 9 vuelta 3, `F-8V3A3-007`: salen las dos del cobro viejo) | cap. 02 §4.1; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`, `N-B-02`. **Misma forma que `G-R6-B`**: una lista cerrada sin guard ya perdió un miembro, `posts`, y lo que la lista sostiene es qué le pasa a lo que cuelga de una ficha cuyo contenido se borró. **Lo construye `V6`**, con `PB12`, que es la primera de las dos transiciones hacia `PURGED` en el orden de la épica (`PB9` es de `V9`, que llega después): es el argumento de `G-R6-B` (`descomposicion.md` §2.5 y §2.10), y la lista sigue siendo del cap. 02. **No afirma que el tratamiento de cada fila sea el correcto**: afirma que ninguna tabla que cuelga de `listing` quedó sin fila (§2.1) |

**`G-R6` llega a este catálogo por una columna concreta y no por simetría, y conviene decir cuál.**
Nació en `B/20` §2 acotado a las seis tablas de billing, porque el crítico que lo motivó era de
billing: `MP5` disparaba sobre *«el período actual arrancó»* y **ninguna escritura del corpus
avanzaba esa columna**, así que el pagador manual pagaba una vez en la vida y seguía cubierto para
siempre (`F-8eB1-002`). La ampliación no se pide porque *«también podría pasar acá»* —eso vale para
cualquier guard— sino porque **acá vive el candidato más fresco del corpus**: `listing.inactiva_desde`,
la columna que `DEC-DATA-002` creó **el mismo día** que esta decisión, con **cuatro escritores** y
**cinco consumidores** —hoy ~~**cinco hechos más la escritura del corte**~~ ~~**seis hechos más la
escritura del corte**~~ **cinco hechos más la escritura del corte** (revisión del owner, 2026-09-28, C8: sale el 4) y **seis consumidores**
(FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, `F-8CD1-009`, owner 2026-09-25; el sexto hecho, FASE
9 completa, 5b)— (cap. 02 §2.5, que
enumera las dos listas y las cierra). Y sobre todo: **lo
que esa columna decide es el borrado irreversible del contenido de una ficha** — `PB4` archiva en
`inactiva_desde + 90` y el hard delete borra en `inactiva_desde + 180` (cap. 02 §4.1). En billing la
clase costó dinero; **acá cuesta datos sin vuelta**, y ésa es la diferencia que justifica la fila.

**Y hay que decir qué NO afirma el guard sobre esta columna, porque los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco escritores
no son ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco transiciones.** El predicado es *«al menos una transición la escribe»*, y
de los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco hechos de reinicio del cap. 01 §1.2 (núcleo) **sólo el tercero** —la ficha
vuelve a `PUBLISHED` por `PB1`, `PB3` o `PB7`— ~~**y el quinto** —la primera rama de `PB2`, FASE 8
completa, `F-8CA2-001`, owner 2026-09-25— son transiciones~~ es una transición entera, **y el
quinto lo es a medias**: sobre la ficha publicada lo ejecuta la primera rama de `PB2`
(`F-8CA2-001`), y sobre las demás fichas del dueño en la vertical el recálculo que el aviso
despierta **o el reconciliador diario de cobertura** (`DEC-ARCH-009`), que no son transiciones (FASE 8 completa, owner 2026-09-25); **y el sexto** —se levanta la moderación— **es una transición entera, `PB11`** (FASE 9 completa, 5b). El primero se lee del registro de
eventos de dominio y el segundo de la respuesta del contrato ~~, y el cuarto de
la pregunta `finDeServicio` del contrato §4.1 (FASE 9 vuelta 2, `R5`)~~ (el cuarto salió con la revisión del owner, 2026-09-28, C8); la escritura del corte es de la migración. Así que sobre
`inactiva_desde` el guard queda **verde por ~~el tercero solo~~ ~~cualquiera de los dos~~ cualquiera de los tres** —`PB1`/`PB3`/`PB7`,
`PB2` **o `PB11`**—, sin mirar ~~al recálculo que ejecuta~~ **a los dos ejecutores —el recálculo y el reconciliador diario— de** la otra mitad del quinto, y lo que
certifica es *«alguien la mueve»*, nunca *«los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco hechos la escriben»*. Es el §2.1
aplicado a su propio mensaje: el texto con que falla no puede afirmar más de lo que el predicado
verifica. **Que los otros ~~tres~~ dos escritores estén es lo que vigila el cap. 02 §2.5**, que los enumera
y declara la lista cerrada, y no este guard.

**Y esa lista cerrada dejó de ser la única vigilancia: desde la tercera enmienda de `DEC-TEST-001`
lleva guard propio, `G-R6-B`.** El párrafo de arriba es su motivo entero — si `G-R6` queda verde
por un escritor de ~~cuatro~~ ~~cinco~~ seis, **a los otros ~~tres~~ ~~cuatro~~ cinco no los mira nadie** y lo único que los sostiene es la
enumeración del cap. 02 §2.5. **Una lista cerrada sin guard es una promesa que en este programa ya
se rompió una vez**: `DEC-TEST-001` lo dice con el caso —*«la única lista que existía quedó corta
en el mismo commit que creó su sexto miembro»*— y acá lo que la lista sostiene no es un conteo,
es **el borrado irreversible del contenido de una ficha**.

**Su papel es el de `G-R1-E` y su forma también, que es por qué es una letra de `R6` y no un
racimo nuevo.** `G-R1-E` ancla su segunda mitad en un inventario —*«un consumidor nuevo no figura
en la lista»*— porque ahí **ningún grep sustituye la cuenta**: una pieza nueva **no aparece
buscando el término viejo**, así que lo único que lo detecta es que la lista tenga una fila menos
que las piezas. Desde la cuarta enmienda la coincidencia es literal: **la mitad (b) de este guard
es la mitad de `G-R1-E`**, sobre otro inventario. El precedente de la letra es `G-R1-F`, que entró
como sexto de `R1` **con un sujeto distinto del racimo** —la marca y no `sucede_a`— porque el daño
estaba pegado al de sus hermanos. Acá es lo mismo: el sujeto de `R6` son *«las columnas que una
condición lee»* y el de éste es **quién toca una columna, escribiéndola o leyéndola**, pero la
columna es la misma, el día es el mismo, y `G-R6` **ya declaró por escrito que no lo cubre**.

**Vigila las DOS mitades de esa lista y, sobre la de lectores, las DOS DIRECCIONES: son tres
predicados.** La cuarta enmienda de `DEC-TEST-001` le sumó los **consumidores** al mismo guard, y el
argumento no es la simetría: **las dos mitades fallan distinto y la segunda falla peor**. Un
escritor fuera de la lista **mueve el reloj** cuando no corresponde — grave, y todavía reparable
mientras la ficha exista. Un consumidor que nadie registró **lee el reloj y decide con él**, y el
consumidor más caro de esta columna **es el hard delete del día 180** (cap. 02 §4.1): un lector no
inventariado es **un lugar que borra contenido sin que la lista sepa que existe**. Es además la
mitad que el precedente ya cubre — `G-R1-E` vigila exactamente eso para los inventarios del núcleo.
La tercera, *(c)*, es esa misma mitad leída al revés y entró en esta pasada; su razón está cuatro
párrafos más abajo.

**El mensaje dice QUÉ MITAD falló, y la condición no es cosmética: es el §2.1 sobre este mismo
guard.** Un guard que vigila varias cosas y falla con un solo texto **afirma más de lo que su
predicado verificó en esa corrida** —el que lo lee no sabe si le sobra un escritor, si le falta una
fila de lectores o si se le fue un lector declarado, que son tres arreglos distintos en dos
capítulos distintos—, y es **la misma regla con la que `DEC-TEST-001` rechazó el segundo guard** que
evaluó. Sin mensaje diferenciado, la enmienda que agrega la mitad se contradice con la entrada que
la contiene. Así que son **tres predicados con tres textos**, en un guard con un id.

**Se rompe a propósito tres veces, una por predicado, y cada una tiene que dar SU mensaje.** *(a)*
~~Se le agrega la escritura a **`PB2`** —la ficha que cae al perder cobertura (cap. 03 §9)—, que es
el escritor de más creíble de todos: *«la ficha acaba de quedar inactiva, sellemos el instante»* se
lee bien y **corre el día 90 y el día 180 hacia adelante en cada caída**, con lo cual una ficha que
va y viene no llega nunca al borrado.~~ **Ese caso dejó de ser un rojo**: desde la FASE 8 completa
la escritura de `PB2` en su primera rama **es** el hecho 5 del cap. 01 §1.2 (núcleo) (`F-8CA2-001`,
`F-8CA3-001`, owner 2026-09-25), y la razón que la prohibía —*«corre el día 90 y el día 180 hacia
adelante en cada caída»*— era la dirección correcta: sin ella el borrado caía hasta 90 días antes.
**El rojo de *(a)* se prueba ahora con la otra rama de la misma transición**: se le agrega la
escritura a **la rama del excedente de `PB2`**, que baja la ficha **con la cobertura verdadera**
y por eso no es ningún hecho — y el rojo tiene que decir *«escritor fuera de la lista»* aunque la
misma transición escriba legítimamente en su otra rama, que es lo que prueba que el guard cuenta
hechos y no ejecutores. **Y la prueba sigue valiendo después de que el hecho 5 pasara a alcanzar
todas las fichas del dueño** (FASE 8 completa, owner 2026-09-25), revisada y no supuesta: la
ficha excedente **sí** recibe ahora el hecho 5, pero **cuando el dueño pierde la cobertura**, y se
lo escribe el recálculo que el aviso despierta; la rama del excedente de `PB2` corre con `cubierto`
verdadero, así que en **su** instante no ocurrió ningún hecho y su escritura sigue fuera de la
lista. Queda, además, más filosa: la misma ficha puede recibir una escritura legítima de un
ejecutor y una ilegítima de otro, y el guard tiene que distinguirlas **por el hecho**, no por la
ficha ni por la columna. *(b)* Se le agrega un **lector** que la lista no nombra —el
caso barato es una superficie que quiera mostrar *«hace cuánto está inactiva»*— **sin** su fila en
el cap. 02 §2.5. *(c)* Se le **saca la lectura al día 180** dejando su fila intacta en el cap. 02
§2.5. Las tres tienen que poner el guard en rojo, y **un rojo de una con el texto de otra es el
guard fallando su propia condición**: se prueba mirando el texto, no el exit code.

**Y hay que decir lo que sigue SIN verificar, porque se lee de más.** **No verifica que los
~~cuatro~~ ~~cinco~~ ~~seis~~ cinco hechos tengan quien los ejecute**, que es justo la mitad que `G-R6` deja abierta.
Comprobarlo pide que cada escritura **declare cuál de los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco ejecuta**, y un guard estático sólo puede comprobar
que la declaración **esté**, nunca que sea cierta — que es **exactamente la forma que
`DEC-TEST-001` rechazó** para el segundo guard de esa decisión. Así que `G-R6` y `G-R6-B` juntos
certifican *«alguien la mueve»*, *«nadie de más la mueve»* y *«nadie de más la lee»*, **nunca *«los
~~cuatro~~ ~~cinco~~ ~~seis~~ cinco la mueven»***: quitarle la escritura a uno de los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco —al recálculo del hecho 2, por
ejemplo, que el cap. 02 §4.2 regla 4 declara **en ~~tres~~ cuatro momentos y no en uno**— deja a los dos en
verde.

**Y la mitad que falta NO es la misma en las dos listas, que es lo que esta pasada separa.** El
renglón de acá decía que ninguna de las dos comprueba que sus miembros declarados **existan**, y la
simetría no se sostiene:

- **Para escritores es la forma rechazada y sigue rechazada.** Comprobar que un hecho tenga quien lo
  ejecute pide que cada escritura **declare cuál de los ~~cuatro~~ ~~cinco~~ seis ejecuta**, y un guard estático sólo
  puede comprobar que la declaración **esté** — exactamente el segundo guard que `DEC-TEST-001`
  rechazó. Queda afuera **del catálogo de guards**, con su razón — **y desde `DEC-TEST-002` la
  cubre un criterio de terminación**, que no es un guard y por eso la objeción no lo alcanza: lo
  contesta una persona al declarar lista la unidad (`descomposicion.md` §4, con el desarrollo en
  `B/descomposicion` §4).
- **Para lectores es un HECHO comprobable y entra: es la mitad *(c)*.** *«El día 180 no lee
  `listing.inactiva_desde`»* es un rojo verificable **sin pedirle a nadie que declare nada** —se
  mira si la lectura está, igual que la mitad *(b)* mira si sobra una—, que es el mismo criterio con
  el que esa decisión aceptó este guard y rechazó el otro. La mitad quedó afuera por analogía con un
  caso que no es el mismo.

**Y la dirección importa, porque es la que se paga con contenido.** La *(b)* atrapa a un lector que
nadie inventarió; la *(c)* atrapa a un lector inventariado que **desapareció** — y el día que el hard
delete del día 180 deje de leer la columna, por un refactor, un rename o una reescritura del
cálculo, **el guard seguía verde y la lista seguía diciendo que ese lector está ahí**. Es el patrón
*«un inventario que afirma completitud sin tenerla»* aplicado a la defensa del único acto
irreversible del programa. **Se rompe a propósito sacándole al día 180 su lectura de la columna sin
tocar el cap. 02 §2.5**, y el rojo tiene que decir *«lector declarado que ya no lee»* y nombrarlo.

**Y `G-R6-B` sigue sin afirmar nada sobre ejecutores, con tres mitades igual que con dos.** La
*(c)* cuenta **lecturas**, no actos: que el hecho 2 tenga sus ~~tres~~ cuatro ejecutores (`V/02` §4.2, regla 4)
no lo verifica este guard ni ningún otro, y decirlo acá es lo que impide que las tres mitades se
lean como *«la lista entera está vigilada»*.

**Y `B/20` §2 lo repite como referencia cruzada por la razón de `G-R5` y no por simetría**: lo que
puede romperlo se escribe **en la otra épica**. ~~Dos lugares medidos. `B/10` §4.3 es donde está
escrito que el reloj *«arranca acá, no antes»*, que **es** el cuarto hecho; y~~ Un lugar medido (el otro, `B/10` §4.3 con el cuarto hecho, salió con la revisión del owner, 2026-09-28, C8): `B/03` §7.1 apoya el
tope de la reapertura en que la lista **sea** cerrada —*«`DEC-DATA-002` le puso a la inactividad
cuatro hechos de reinicio con lista cerrada»* —hoy ~~cinco, `B/03` §7.1 ya lo dice así~~ ~~**seis**~~ **cinco** (el sexto, FASE 9 completa, 5b; el 4 salió con la revisión del owner, 2026-09-28, C8)—, y de ahí sale que el tope *«ya no es monótono»*—.
Un ~~quinto~~ escritor **nuevo** agregado desde billing rompe ~~las dos cosas~~ esa cosa **sin que nadie abra
este capítulo**. *(El quinto hecho, el de la FASE 8 completa, no salió de billing: ~~es `PB2`, de
esta épica~~ sus ~~dos~~ tres ejecutores —`PB2`, el recálculo que el aviso despierta y el reconciliador diario de cobertura (`DEC-ARCH-009`)— son de esta épica —
`F-8CA2-001`, owner 2026-09-25. **Y el sexto tampoco**: lo ejecuta `PB11`, de esta épica — FASE 9
completa, decisión 5b.)*

~~Tres párrafos explicaban `G-R5`: por qué vigilaba la desigualdad entre el tope de pausa y el día
del borrado, por qué hasta la FASE 8 completa comparaba una cuenta falsa y qué mitad no vigilaba
(la reanudación que no ocurre).~~ **Salen con `G-R5`** (revisión del owner, 2026-09-28, C14): la
pausa pedida por el dueño detiene el reloj y no hay desigualdad que vigilar. **La mitad que `G-R5`
no vigilaba sigue igual y sigue sin guard**: una pausa que vence y no reanuda deja ahora el reloj
detenido, y la cubren la rama de fallo de `S10` (`B/03` §3.2) y la quinta comprobación de cero
llamadas del barrido (`B/09` §3).

*(Desde la revisión del owner, 2026-09-28, C9, `G-R5-B` es una validación del panel y no un guard:
el párrafo que sigue queda como la historia de su cota. **La cota es hoy el plazo de borrado de la
misma versión de plazos, en el peor caso de `N` en días**, así que el ⚠️ de *«6 meses no son 180
días»* no tiene sujeto, y el espacio entre archivado y borrado lo da la fecha que anuncia el
archivado: `V/03` §9, ⚠️ punto 7, cerrado.)*
**`G-R5-B` es la misma clase sobre el otro reloj de la ficha** (FASE 8 completa, `F-8CA2-014`,
owner 2026-09-25). `PB5` archiva un borrador a los `N` meses y el hard delete borra a los 180
días, **sobre la misma columna**; con `N ≥ 6` meses el borrado alcanzaba a un borrador sin que
hubiera pasado por el archivado ni por su aviso. Lo cierran dos reglas juntas: **`PB9` exige
`ARCHIVED`** —eso lo dice la tabla del cap. 03 §9 y no necesita guard: es su `desde`— y **`N` se
valida menor que 6 meses**, que es configuración y por eso lleva guard, igual que `D16`. **Se rompe
a propósito** poniendo `N` en 6 meses, y el rojo tiene que nombrar a `PB5` y la cifra.
~~⚠️ **Lo que no está decidido**: si la cota es **6 meses literal** o **el día del hard delete**
—como `D16`, que compara contra el 180 y no contra un número fijo—. Hoy son lo mismo; el día que
alguien mueva el 180, dejan de serlo. El predicado de arriba toma la letra del owner.~~ **Cerrado
el 2026-09-25 (owner, FASE 8 completa)**: **la cota es 6 meses literal**, como dice el predicado de
arriba; **la unidad que lo construye sigue siendo `V6`**, y **no se agrega un invariante `D18`**.
⚠️ **6 meses no son 180 días**: son 181 a 184 (FASE 9 completa, `B-2`; declarado por
`DEC-METH-015`, FASE 9 completa). Un `N` entre 180 días y 6 meses pasa el guard, y `PB5` archiva
el día 180 o después; `PB9` borra en la corrida siguiente, con el aviso del archivado sin espacio
para exportar. **Causa**: la cota se eligió literal y el borrado cuenta días. Con `N` en meses
enteros el hueco no existe. *(El texto tachado de arriba decía «Hoy son lo mismo», y no lo son.)*

**`PB9` no mueve ni a `G-R6` ni a `G-R6-B`, revisado y no supuesto.** El hard delete pasó a ser
una transición (`PB9`, cap. 03 §9; `F-8CA2-008`), pero **lee la columna igual que antes** —es el
lector *(3)* del cap. 02 §2.5, con otro nombre— y **no la escribe** salvo por la relectura que trae
la cobertura verdadera, que es el hecho 2 y ya estaba en la lista. Así que los seis lectores y los
~~cinco~~ hechos quedan como estaban (**seis** desde la FASE 9 completa, por `PB11` y no por `PB9`: 5b), y la mitad *(c)* se sigue rompiendo igual: sacándole a `PB9` su
lectura de la columna. `G-R6` gana una condición más que lee `inactiva_desde`, escrita por las
mismas transiciones que ya la escribían.

**`G-R4` y `G-R4-B` son el mismo defecto visto en dos planos, y hacen falta los dos.** El primero
mira **la forma** de una tabla: dos guardas que se pueden satisfacer a la vez dejan el desenlace
en el orden de recorrido, y los pares con dos destinos que el diseño declara hoy son ~~**cuatro**~~ ~~**tres**~~ **cuatro**:
`T1`/`T6` y **`PB11`/`PB13`** (revisión del owner, 2026-09-28, C10) acá, y `S5`/`S19` y `S7`/`S19` ~~y `S10`/`S25`~~ en la tabla de suscripción (`B/03` §3.2).
**Cuántos son es lo que este guard cuenta**, no una lectura a mano — ~~y el cuarto entró en la FASE
9-bis-4 por una decisión sobre planes retirados (`DEC-SUB-015`), no porque nadie estuviera
mirando esta lista~~ y el cuarto, `S10`/`S25`, que había entrado en la FASE 9-bis-4 por
`DEC-SUB-015`, salió con la revisión del owner, 2026-09-28, C8. *(Este párrafo decía que `T1`/`T6` era el único; ya no lo era desde que `S19`
compartió par con `S5` y con `S7`.)* El segundo
mira **de qué habla** una guarda: `T6` estaba escrita sobre *«una suscripción viva»*, un predicado
que el §4 del contrato **le prohíbe evaluar** al lado que tiene que evaluarlo, así que su
implementación iba a leer otra cosa sin decirlo. Disjuntas y **evaluables** son dos propiedades
distintas; `T6` fallaba las dos, y cada guard atrapa una.

**`G-R4` es del núcleo y el catálogo de guards está partido en dos épicas** —la numeración es una
sola—. Esta fila es la definición; `B/20` §2 la repite como referencia cruzada, para que las seis
tablas de billing no queden vigiladas por un guard que su propio catálogo no nombra. **Es un
guard, no dos.**

*(Desde la revisión del owner, 2026-09-28, N1, `G-R3` es una validación del panel y no un guard:
lo que sigue vale para ella. **El punto único de falla sigue siendo uno, y ahora lo cuida el panel
al publicar una versión de plan**, y el paso 3a del corte sobre la base de producción. «Se rompe a
propósito» se lee como la prueba de la validación: publicar la versión que la rompe y ver el
rechazo con su mensaje.)*
**`G-R3` es el que más carga lleva, y conviene decir por qué.** El arreglo del trial concentra todo
en un solo dato: **si alguien siembra una de esas dos versiones con una clave comercial, toda la
plataforma la recibe gratis, para siempre, sin consumir ningún trial**. Es un punto único de falla
que antes no existía, y la comparación honesta no es *«¿esto abre algo?»* sino *«¿abre más o menos
que la alternativa?»*: la exención por ruta abre un agujero **por cada ruta que alguien marque**, y
ninguna herramienta lo cuenta; ésta abre uno solo, en una tabla, que un guard puede contar en cada
PR.

**Y hasta esta pasada sólo sabía prohibir, que es la mitad barata del punto único de falla.** Su
enunciado era **negativo entero** —*«ninguna … otorga»*— más un bicondicional cuyo dominio es **una
sola** clave, la de activación. La lista de lo que el piso otorga es de **tres** filas y es cerrada
(cap. 02 §2.1), y **sólo la primera nombraba un guard**: la 1 *es* la mitad en negativo. Así que un
catálogo al que le faltara la fila 2 o la 3 **pasaba en verde**, y el desenlace de cada ausencia lo
escribe el propio capítulo: sin la 3, *«esa persona no puede ejecutar ninguno de los ~~cuatro~~ cinco
reinicios y el día 180 le borra el contenido»* (cap. 02 §2.1); sin la 2, un `TRIAL_EXPIRED`, un
`Turista Free` ~~y un `Guest`~~ **no pueden suscribirse** (el guest se registra antes de suscribirse, y entonces es `Turista Free`: FASE 9 vuelta 1, `F-8V1A1-006`) —*«queda afuera para siempre»*
(`12-contrato…` §2.5)—. **La mitad `(b)` es esa dirección.** Es la misma corrección que la cuarta
enmienda de `DEC-TEST-001` le hizo a `G-R6-B` sobre otra lista cerrada, y por la misma razón: **una
lista cerrada vigilada en una sola dirección declara una cobertura que no tiene.**

**La `(b)` se puede formar sin juicio, y ésa es la condición con que entra.** Pregunta si **dos
claves nombradas** están entre las que la versión de piso de cada vertical otorga en el catálogo:
no hay que entender qué significan, igual que `G-R6` no necesita entender qué significa una columna
(`B/20` §2). Y **no** verifica que otorgar esas dos claves alcance para ejecutar `PB8` ni el alta —
eso son los ~~nueve~~ siete pasos del cap. 17 §3.5 y este guard no los recorre—; verifica que **estén**.

**Y la `(a)` recién ahora se puede formar, que es la otra mitad del arreglo.** *«Clave de la clase
comercial»* era un término **sin definición en ningún capítulo y sin atributo en el catálogo**:
quien construyera el guard tenía que inventar la clasificación clave por clave, y la primera que le
tocaba era la que la lista del piso acababa de agregar. Si la clasificaba comercial, el guard se
ponía en rojo sobre el catálogo **correcto** y la salida obvia era sacar la clave — que es el
crítico que el cap. 02 §2.1 cerró. **La clase es hoy el cuarto atributo declarado de una clave**
(cap. 15 §3.4), con dos valores y lista cerrada, y su definición está en el glosario al lado de la
de *«entitlement medido»*, que es la otra mitad del mismo predicado (`NUCLEO/01` §1.6). El guard lee
un atributo; no juzga.

**Se rompe a propósito tres veces, una por mitad, y cada una tiene que dar SU mensaje.** *(a)* se le
siembra a la versión de piso de una vertical una clave comercial cualquiera. *(b)* se le **saca** a
esa misma versión la clave *«recuperar lo suyo»*, que es exactamente el catálogo con el que el hard
delete del día 180 se vuelve indefendible. *(c)* se le pone la capacidad de activación a la versión
de pre-trial de una vertical que no declara evento. **Un rojo de una mitad con el texto de otra es
el guard fallando su propia condición** (§2.1): son tres arreglos distintos, en dos tablas
distintas, y el que lo lea tiene que saber cuál le tocó.

**G1 y G2 son la pinza** y ya se explicó en el capítulo 17 §2.3 (épica de verticales): uno acota
**quién puede** nombrar una vertical, el otro obliga a que las operaciones **lo hagan**. Por
separado cada uno deja pasar lo que el otro atrapa.

**La tercera mitad de `G2` cierra la puerta que la segunda dejaba** (owner 2026-09-25; FASE 9
completa, decisión 7a). Leer la vertical del recurso no alcanza si el recurso la puede cambiar: una
ficha creada y publicada en Alojamiento, editada después a Gastronomía, pasaba la edición contra
la vertical **anterior** y quedaba publicada sin cobertura en la nueva hasta que el reconciliador la
bajaba. **Se rompe a propósito** con una operación que actualice `listing.vertical` de una ficha
existente, y el rojo tiene que decir *«escribe la vertical de un recurso que ya existe»*, no el
texto de la *(b)*.

**`G-R2-C` es el gemelo de `G-R2-B` del lado de los addons** (owner 2026-09-25; FASE 9 completa,
decisión 4e). `G-R2-B` impide que una fuente `GRANT` transporte el plan de otra vertical; `G-R2-C`
impide que una fuente `ADDON` de alcance `USER` o `GLOBAL` aparezca en `cobertura(user, vertical)`
de una vertical que su producto no declara compatible (`12-contrato…` §2.7). **Se rompe a
propósito** emitiendo un addon `USER` compatible sólo con Alojamiento en la respuesta de
Gastronomía. ~~**Qué unidad lo construye no está asignado todavía**: es de la descomposición
(`descomposicion.md` §2), que esta pasada no toca, y queda anotado para ella.~~ **La descomposición
lo propone para `B10` (`descomposicion.md` §2.10): su dato, las verticales compatibles, es de
`addon_product` y ninguna fuente lo transporta; `V/20` conserva la fila, como la de `G-R5`** (owner
2026-09-25; FASE 9 completa, decisión 10c).

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
