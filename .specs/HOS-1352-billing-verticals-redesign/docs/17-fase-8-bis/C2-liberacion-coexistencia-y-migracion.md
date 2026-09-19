---
title: "FASE 8-bis · C2 — liberación, coexistencia y migración del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · C2 — liberación, coexistencia y migración del conjunto

Segunda pasada sobre el **conjunto**. No ataco ninguna de las dos mitades: ataco si este programa,
**como programa**, se puede empezar, se puede liberar y tiene vuelta atrás. Existe porque
`DEC-ARCH-007` implicación 2 pide *«una revisión final sobre el conjunto antes del despliegue»*, y
corre después de A y B porque su material es parte del mío.

**Dieciséis hallazgos: 2 `CRITICA`, 9 `ALTA`, 4 `MEDIA`, 1 `BAJA`.** Nueve de los dieciséis los
introdujo —o los volvió alcanzables— un cambio de la FASE 9.

La reejecución de mis 17 hallazgos de la FASE 8 está en la §3 y **no cuenta como hallazgos
nuevos**: **1 no llega, 5 cortan a medias, 11 siguen llegando**.

**Límites declarados.**

1. **No leí el código de billing actual.** Lo que sí medí del repo son archivos de configuración
   (`.github/workflows/*.yml`, `scripts/resolve-ci-baseline.sh`, `CLAUDE.md`) y **conteos de
   ocurrencias** sobre `apps/`, `packages/` y `scripts/`. Ningún hallazgo depende de cómo está
   escrito el código; dependen de **cuánto hay**.
2. **Todas las mediciones del repo son del 2026-09-19**, sobre el worktree
   `hospeda-spec-hos-1352-billing-redesign` (rama `spec/HOS-1352-billing-verticals-redesign`) y
   sobre `origin/staging` (`60a39dae2`), recién buscado.
3. **No relitigo** `DEC-ARCH-004`, `005`, `006` ni `007`, ni `DEC-MIG-003`, ni `D-28`. Que se
   libere junto, que no se migre y que se arranque en días no se discuten. Ataco si el
   **mecanismo** elegido para cada una cumple.
4. **El núcleo es de `C1`.** Lo que encontré en `docs/nucleo/` va en la §5.

---

## 1. La pregunta del ciclo, contestada con números antes que con opinión

`DEC-METH-006` corta el ciclo 8 ↔ 9 *«hasta que una pasada de FASE 8 no produzca ningún `CRITICA`
nuevo»*. Esta pasada **ya no cumple esa condición** —25 críticos con dos vectores todavía sin
informar—, así que la 9-bis es un hecho, no un pronóstico. Lo que sigue es si el ciclo **termina
alguna vez**.

### 1.1 Los dos conteos, recontados con script

| | FASE 8 (A+B, 6 vectores) | FASE 8-bis (A+B, 6 vectores) | variación |
|---|---|---|---|
| hallazgos | **110** | **85** | −23 % |
| `CRITICA` | **38** | **25** | −34 % |
| `ALTA` | 38 | 41 | +8 % |
| `MEDIA` | 22 | 16 | −27 % |
| `BAJA` | 5 | 3 | — |
| `CRITICA` por vector | **6,33** | **4,17** | −34 % |

Los de la FASE 8 salen de la tabla de
[`14-fase-8-adversarial/00-hallazgos.md`](../14-fase-8-adversarial/00-hallazgos.md) §1; los de
esta pasada, de contar los encabezados `### F-8b…` y su línea de severidad en los seis informes de
esta carpeta.

### 1.2 El dato que decide la pregunta: 25 de 25

De los **25 `CRITICA` de esta pasada, los 25** atribuyen su existencia —entera o a medias— a un
cambio de la FASE 9. **Ninguno** es un defecto preexistente que la primera pasada hubiera dejado
pasar.

| cómo lo dice el informe | cuántos de los 25 |
|---|---|
| *«lo introdujo el arreglo»* / *«es el arreglo»* | **20** |
| *«el arreglo lo volvió alcanzable»* · *«lo destapó»* · *«la omisión es anterior; el arreglo le agregó caminos»* · *«mitad y mitad»* · *«las dos cosas»* | **5** |
| preexistente, no visto en la pasada 1 | **0** |

Sobre los 85 hallazgos completos la proporción se sostiene: **70 dicen *«lo introdujo el
arreglo»*, 6 *«mitad y mitad»* y 9 *«nuevo sobre el arreglo»* o *«el arreglo lo agrandó»*. Cero
dicen *«esto ya estaba y nadie lo vio»*.**

### 1.3 Qué significa eso, y no es lo que el descenso del 34 % sugiere

El conteo baja, pero **lo que baja no es el stock de defectos: es el tamaño de la tanda de
arreglos anterior.** La condición de corte de `DEC-METH-006` mide un stock —*«¿quedan críticos?»*—
y el generador de críticos de esta pasada **no es el stock: es el acto de arreglar**.

La causa está en el procedimiento, y es citable. `DEC-METH-004` define *«resuelto»* como
**verificar la regla contra todo su dominio**, y los dominios están enumerados —327 casos— en
[`15-fase-9/00-dominios-de-los-racimos.md`](../15-fase-9/00-dominios-de-los-racimos.md). **Ese
dominio es el del PROBLEMA, nunca el del ARREGLO.** Un arreglo crea pares que no existían cuando
el dominio se enumeró, y por construcción quedan fuera del recorrido que certifica el arreglo.

Está medido dos veces en esta misma pasada, con las palabras de los informes:

- `F-8bB3-005`: *«La tabla de cierre de `15-fase-9/02-R2-resuelto.md` §4 da por cerrado el par
  (`GRANT`, `versiónDePlan`) **sin haber recorrido el par (`GRANT`, el piso)**, que la misma
  decisión acababa de crear.»*
- `F-8bB3-003`: *«El dominio de 90 pares (`15-fase-9/05-R1-resuelto.md` §4) recorre «la fila
  existente está en X» **por estado**, y `sucede_a` no es un estado: por eso el par (sucesora
  `ACTIVE`, `C2`/`C3`) no aparece en ninguna de las diez tablas.»*

Y el caso más caro es `F-8bB3-002`: la FASE 9 **escribió** la regla que evitaba el defecto
(`R5-G`) y la aplicación de `D-26` la tiró junto con la migración que sí había dejado de hacer
falta. No es que no se haya pensado: se pensó, se escribió y se perdió al aplicar.

### 1.4 La aritmética, con la salvedad de que son dos puntos

Con la tasa medida —25 críticos y un decaimiento de 0,66 por pasada— llegar a **cero** pide
`log(1/25)/log(0,66) ≈ 7,7`, o sea **unas ocho pasadas más**, cada una con ocho agentes
adversariales, una FASE 9 completa y su aplicación. Y ese número **supone** que el decaimiento se
sostiene, que es una extrapolación sobre **dos** puntos. El dato de la §1.2 dice lo contrario: si
cada tanda de arreglos produce críticos en proporción a su propio tamaño, y cada tanda de arreglos
es proporcional al número de críticos que vino a cerrar, el proceso es un punto fijo sólo si la
tasa de *defectos por arreglo* cae — y nadie la está midiendo.

> **Respuesta:** con la condición escrita hoy, el ciclo **no tiene convergencia demostrada**. No es
> que vaya a durar para siempre; es que **nada de lo que el programa mide dice cuándo para**, y lo
> único medido apunta en la dirección mala.

### 1.5 Lo que sí lo haría terminar, y no cambia la decisión del owner

Tres cambios, ninguno relitiga `DEC-METH-006`:

1. **Extender `DEC-METH-004`**: *«resuelto»* exige recorrer el dominio del problema **y el dominio
   que el arreglo crea** — los pares nuevos que la decisión introduce. Es lo que habría cazado
   `F-8bB3-005`, `F-8bB3-003`, `F-8bB1-001` y `F-8bB2-002` **dentro de la FASE 9**, sin gastar una
   pasada de FASE 8 entera en encontrarlos.
2. **Medir la tasa, no sólo el conteo**: *«críticos nuevos por decisión aplicada»*. Hoy son
   25 sobre 33 decisiones ≈ 0,76. Si la próxima pasada da una tasa parecida, el corte por conteo
   absoluto no va a llegar y conviene saberlo antes de la tercera vuelta, no después.
3. **Una salida por costo**, que la decisión ya admite en su forma: `DEC-METH-006` permite cerrar
   con críticos abiertos *«con causa declarada»*. Nada impide aplicar el mismo criterio al ciclo —
   *«se corta cuando una pasada produce menos de N críticos, y los que queden van declarados»*—, que
   es la forma que `D-30` ya eligió para la salida de la FASE 9 y descartó explícitamente para el
   ciclo.

Esto es un hallazgo con ID —`F-8bC2-003`— y lo marco `ALTA`, no `CRITICA`, porque por el criterio
declarado nadie paga de más por un método que no converge. Es, aun así, lo más importante de este
informe.

---

## 2. Hallazgos

## CRITICA

### F-8bC2-001 — El día del corte toda la cartera existente queda en `PRE_TRIAL`, y el evento que la sacaría de ahí ya ocurrió

**Qué se rompe.** El 100 % de los usuarios de producción amanece, en el sistema nuevo, en el único
estado del trial que **cubre sin otorgar nada y sin cobrar nada**, y no existe ningún camino por el
que salgan: el evento que dispara `T1` para Alojamiento es *«la ficha queda publicada»* y sus fichas
**ya están publicadas**. Según cuál de las dos ramas se implemente, o esas personas usan la
plataforma gratis para siempre sin que nada falle, o las doce fichas del catálogo se despublican la
mañana del corte. **Ninguna de las dos está escrita.**

**El camino.**

1. `DEC-MIG-003` decide que **no se hereda una sola fila**: *«**El sistema nuevo no hereda una sola
   fila.**»* (`B/21` §2.4; `V/21` §2.1 con las mismas palabras). Así que el día del corte las tablas
   `trial` y `subscription` están **vacías**.
2. **Sin fila de `trial`, el estado es `PRE_TRIAL`**, por construcción: *«**`T1` crea la fila, y por
   eso `PRE_TRIAL` no la tiene.**»* (`V/03` §2). No es un default: es la definición.
3. **`PRE_TRIAL` es fuente viva de clase `TÍTULO`.** `V/03` §2: *«El trial es **fuente viva en
   `PRE_TRIAL` y en `TRIAL_ACTIVE`**»*, con `tipo: TRIAL` y `hasta: SIN_EMPEZAR`; y el contrato pone
   `TRIAL` en la clase que sí cuenta: *«| **`TÍTULO`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` ·
   `GRANT` | **sí** |»* y *«**`cubierto` se calcula sólo sobre las fuentes de clase `TÍTULO`**»*
   (`12-contrato-de-cobertura.md` §2.4). Entonces **`cubierto: sí` para todos**.
4. **Y `PRE_TRIAL` no otorga nada comercial**: *«es donde vive quien entró a la vertical y todavía
   no publicó, **con borradores ilimitados, sin capacidades comerciales y sin consumir trial**»*
   (`V/03` §2, `DEC-TRIAL-007`).
5. **El evento que los sacaría de ahí ya pasó.** `DEC-TRIAL-006` fija la tabla: *«| alojamiento ·
   gastronomía · experiencia | **la ficha queda publicada** (`DEC-TRIAL-005`) |»*, y `T1` dispara
   con *«el evento de activación declarado por la vertical»* (`V/03` §2). *«La ficha queda
   publicada»* es la **transición** `PB1` (`DRAFT → PUBLISHED`), no un estado: una ficha que **ya
   está** `PUBLISHED` no vuelve a quedar publicada. Los doce alojamientos medidos en producción
   están del otro lado de ese evento.
6. **Rama A — `PB2` no dispara.** Su condición es *«se pierde la cobertura»* con cuatro causas
   enumeradas —*«trial vencido (T3), suspensión (S6), cancelación consumada (S12), o excedente tras
   un downgrade»*— (`V/03` §9) y **ninguna ocurre**: no hay `T3` porque no hay trial, no hay `S6`
   ni `S12` porque no hay suscripción. Las fichas siguen publicadas, el dueño tiene `cubierto: sí`,
   cero capacidades comerciales y **ninguna razón para volver a contratar**. El ingreso de la única
   vertical con fichas reales se va a cero y **nada falla**.
7. **Rama B — el reconciliador de excedentes sí corre.** `V/15` §4.2: *«**se dispara cuando el
   conjunto efectivo de un `user + vertical` se recalcula, y actúa sólo si algo bajó**»*. Si el
   primer cálculo del conjunto efectivo cuenta como un recálculo y las fichas publicadas se comparan
   contra el limit de la **versión de pre-trial** —que por diseño *«no otorga ninguna clave
   comercial»* (`12-contrato-de-cobertura.md` §2.5, punto 2, sobre la de piso y la de pre-trial)—,
   entonces *«cae lo más reciente primero, hasta entrar en el límite»* (`V/15` §4.3) **despublica
   las doce**.
8. **Cuál de las dos ocurre no está escrito**, porque *«algo bajó»* no tiene referente en el primer
   cálculo de la historia del sistema nuevo. El programa nunca preguntó **cómo amanece la población
   existente**: `V/21` §4 declara *«Gastronomía, experiencia y partner: cero filas. El rediseño de
   esas tres verticales **no toca un solo dato existente**»* y **no dice una palabra sobre
   Alojamiento**, que es la única vertical con fichas.

**Dónde lo permite el diseño.**

- `HOS-1354/docs/21-migracion.md` §2.4 y `HOS-1353/docs/21-migracion.md` §2.1 — *«El sistema nuevo
  no hereda una sola fila.»*
- `HOS-1353/docs/03-maquinas-de-estado.md` §2 — *«**`T1` crea la fila, y por eso `PRE_TRIAL` no la
  tiene.**»*, la tabla *«¿fuente viva? | `PRE_TRIAL` | **sí** | la versión de pre-trial | `SIN_EMPEZAR`»*,
  y §9, fila `PB2` con sus cuatro causas.
- `HOS-1352/docs/12-contrato-de-cobertura.md` §2.4 — *«`cubierto` se calcula sólo sobre las fuentes
  de clase `TÍTULO`»*, con `TRIAL` adentro.
- `HOS-1352/docs/01-decision-log.md`, `DEC-TRIAL-006` — la tabla de eventos de activación.
- `HOS-1352/docs/07-facts-inventory.md`, «Contenido y usuarios» — *«Usuarios 22 · **Alojamientos
  12** · Gastronomías 0 · Experiencias 0 · Partners 0»*. **Las ocho filas de billing se contaron
  tres veces; las doce fichas que dependen de ellas, ninguna.**
- `HOS-1353/docs/21-migracion.md` §4 — la frase que cubre a las tres verticales vacías y deja
  afuera a la única llena.

**Severidad.** `CRITICA` — en la rama A, todo el mundo accede indefinidamente a un servicio que no
paga, y el defecto es silencioso por construcción; en la rama B, el catálogo público desaparece el
día del corte. Las dos cumplen el criterio, por extremos opuestos.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo, y lo introdujeron dos decisiones que
nadie compuso.** `D-26` (no se migra) vació las tablas; `R3` —el cambio 13, *«`T1` crea la fila;
`PRE_TRIAL` no tiene fila»*— convirtió *«no tener fila»* en *«estar cubierto»*. Antes de la FASE 9,
una población sin filas era una población **sin cobertura**, que es un desenlace distinto y visible.
`F-8bA3-001` y `F-8bA2-001` reportan la mitad de dominio de este mecanismo (Partner, `PB2`); lo que
agrego es su instanciación **el día del corte sobre la cartera real**, que ninguno de los seis
informes compone y que es exactamente lo que `DEC-MIG-003` dejó sin mirar.

---

### F-8bC2-002 — `D-26` no eliminó el punto de no retorno: lo subió de escala, y nadie declara el orden entre cancelar y desplegar

**Qué se rompe.** Un preapproval vivo cobra **después** del despliegue que borró el código capaz de
cancelarlo, de reconocerlo y de registrar su cobro. La persona paga, el dinero entra, y del lado de
Hospeda no queda ni servicio ni asiento: el sistema que sabía qué era ese id ya no existe y el
nuevo nunca lo conoció.

**El camino.**

1. El plan es cancelar en el proveedor: *«**se cancelan las ocho** y quien tenga algo vivo se
   suscribe de nuevo»* (`B/21` §2.4). Tres de las ocho tienen preapproval vivo, medido: *«**El
   vínculo con el proveedor se corresponde exactamente con `trialing`**: 3 de 3 lo tienen, y ninguna
   de las otras cinco»* (`07-facts-inventory.md`, cuarta consulta).
2. **El despliegue es uno solo y es del paraguas**: *«La FASE 10 se desarrolla en paralelo y
   **despliega una sola vez**»* (`DEC-ARCH-007` implicación 3), y lo que llega a `staging` *«es el
   paraguas»* (`11-particion-del-programa.md` §6).
3. **Ese despliegue borra el ejecutor de la cancelación.** El §55 ordena eliminar `commerce` de
   *«code, schema, types, tests…»* y `DEC-ARCH-004` absorbe qzpay entero
   (`HOS-1354/spec.md`, *«salvo `qzpay`, que `DEC-ARCH-004` ya resolvió: **se absorbe**»*). El
   código que hoy sabe cancelar esos tres preapprovals es exactamente el que el despliegue retira.
4. **`D-26` declaró muerto el punto de no retorno, y lo que mató fue el de FILA.** Su sección *«Qué
   queda sin objeto»* enumera *«tenía un punto de no retorno **sin lado elegido**»* entre los cuatro
   críticos que se eliminan. Es cierto **por fila**: ya no hay que elegir entre cancelar primero o
   autorizar primero para cada persona. **No es cierto por programa**: sigue habiendo dos actos
   irreversibles —la cancelación masiva y el despliegue único— y **sigue sin declararse cuál va
   primero**.
5. **Y esta vez el orden no es indiferente, es asimétrico.** Si se cancela primero, hay una ventana
   sin servicio para tres clientes y el riesgo es de conversación. Si se despliega primero, las
   autorizaciones siguen vivas contra un sistema que ya no las conoce: *«guardar ese id deja de ser
   una comodidad y pasa a ser **la condición de que la conciliación exista**. Una suscripción cuyo
   id se pierde **es invisible para el barrido**»* (`B/09` §2.1). Y como `DEC-MIG-003` no escribe
   ninguna fila, ese id **no está en el inventario nuevo** — que es el mecanismo de `F-8bB3-002`.
6. **Quién decide el orden no existe.** `V/21`, «Lo que este capítulo NO cierra»: *«**Cómo se le
   avisa a las tres personas y cuándo se cancelan sus suscripciones es FASE 7**: acá está que no se
   migra, no el procedimiento de la conversación.»* La FASE 7 que despliega es la del paraguas, y
   `16-fase-7-del-paraguas.md` declara en su §1 que *«**Su contenido todavía no está escrito**»*.
   El *cuándo* se difirió a un documento vacío.
7. **Y la frase que cierra el hueco lo niega**: *«No hay nada que parar ni que coexistir, y **tampoco
   nada que transcribir**»* (`B/21` §3.2 (a)) — sobre un plan cuyo primer acto es cancelar tres
   autorizaciones vivas en un proveedor externo.

**Dónde lo permite el diseño.**

- `HOS-1354/docs/21-migracion.md` §2.4 y §3.2 (a), citados.
- `HOS-1352/docs/01-decision-log.md`, `DEC-ARCH-007` implicación 3; `DEC-MIG-003`, *«Qué deja sin
  objeto»*.
- `HOS-1353/docs/21-migracion.md`, «Lo que este capítulo NO cierra».
- `HOS-1352/docs/16-fase-7-del-paraguas.md` §1 — *«Su contenido todavía no está escrito.»*
- `HOS-1354/docs/09-conciliacion.md` §2.1.

**Severidad.** `CRITICA` — un cobro real contra una relación que el sistema desplegado no puede
reconocer ni revertir. **No duplica a `F-8bB3-002`**: aquél describe qué hace el sistema nuevo con
el webhook huérfano una vez que llega; éste describe por qué llega, y es el único de los dos que se
arregla con una línea de orden en la FASE 7 en lugar de con una fila de base.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** `F-8C2-001` reportaba el punto de no
retorno **por fila** y `D-26` lo cerró correctamente. Lo que `D-26` no miró es que la operación que
lo reemplaza —cancelar ocho y desplegar una vez— tiene el mismo problema **una escala más arriba**,
y que su cierre declarado (*«sin lado elegido»* deja de existir) se escribió sobre el sujeto viejo.
Es el patrón exacto de `F-8bB3-002`: `D-26` eliminó la migración y se llevó puesto algo que no
migraba.

---

## ALTA

### F-8bC2-003 — El ciclo 8 ↔ 9 mide el stock de defectos y su generador es el acto de arreglar

**Qué se rompe.** La condición que decide si el programa entra a FASE 10 no puede cumplirse por el
mecanismo que la evalúa: cuenta críticos residuales y los críticos que aparecen los **fabrica la
tanda de arreglos anterior**. El programa puede quedar iterando un número indefinido de pasadas,
cada una con ocho agentes y una FASE 9 completa, sin ninguna señal de que se está acercando.

**El camino.** Está desarrollado con sus números en la §1 de este informe, y se resume así:

1. `DEC-METH-006` corta *«hasta que una pasada de FASE 8 no produzca ningún `CRITICA` nuevo»*.
2. Esta pasada produjo **25 `CRITICA`** (6 de 8 vectores), contados con script sobre los seis
   informes de esta carpeta.
3. De los 25, **25 atribuyen su existencia a un cambio de la FASE 9** — 20 enteros y 5 a medias.
   **Cero** son defectos preexistentes que la primera pasada hubiera dejado pasar.
4. La causa es procedimental y está citada: `DEC-METH-004` exige recorrer *«todo su dominio»*, y los
   dominios enumerados son los del **problema**. `F-8bB3-005` lo dice textual sobre la tanda que
   acaba de correr: *«da por cerrado el par (`GRANT`, `versiónDePlan`) **sin haber recorrido el par
   (`GRANT`, el piso)**, que la misma decisión acababa de crear»*.
5. Con el decaimiento medido (0,66 por pasada) el corte por cero pide **unas ocho pasadas más**, y
   ese decaimiento se extrapola de **dos** puntos.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-METH-006` — *«Se repite hasta que una pasada de FASE 8 no
  produzca ningún `CRITICA` nuevo»*, y su propio argumento: *«**No** *«ningún hallazgo»*: siempre va
  a aparecer algo menor, y atarlo a cero es la misma trampa»*. El razonamiento que descarta el cero
  para los hallazgos es exactamente el que hace falta para los críticos, y no se aplicó.
- `HOS-1352/docs/01-decision-log.md`, `DEC-METH-004` — la definición de *«resuelto»*.
- `HOS-1352/docs/15-fase-9/00-dominios-de-los-racimos.md` — los 327 casos, todos del problema.
- Medición propia sobre `docs/17-fase-8-bis/*.md` y `docs/14-fase-8-adversarial/00-hallazgos.md` §1.

**Severidad.** `ALTA`. **No la marco `CRITICA` a propósito**: por el criterio declarado —alguien
paga de más, alguien accede a lo que no le corresponde, o un dato se pierde sin vuelta— un método
que no converge no califica, e inflarlo sería exactamente lo que la instrucción advierte. Es, aun
así, lo que decide si esta fase corta.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**, en el sentido más literal posible: el
ciclo lo creó `D-30` en la misma tanda, y esta pasada es su primera ejecución.

---

### F-8bC2-004 — La condición de corte es un conteo y los informes que cuenta no se pueden contar con una sola consulta

**Qué se rompe.** El único predicado que decide si el programa sigue iterando —*«¿hubo un `CRITICA`
nuevo?»*— se evalúa leyendo ocho archivos que escriben esa línea de **dos formas incompatibles**. La
consulta natural devuelve **14 de 85** y no falla: devuelve un subconjunto plausible, que es la
forma más creíble de un «cero críticos».

**El camino.**

1. `DEC-METH-006` ata el corte a un conteo, y la regla dura de esta fase es *«**Los conteos se
   cuentan**, no se estiman»* ([`00-instrucciones.md`](./00-instrucciones.md) §6).
2. Medido sobre los seis informes de esta carpeta: la línea de severidad aparece como
   **`**Severidad.**`X``en 71 hallazgos** y como **`**Severidad**: `X`` en 14**. Una expresión
   anclada en `\*\*Severidad\*\*` —la forma que usa `B1`— matchea **14 de 85** y reporta
   `7 CRITICA`, no 25.
3. La línea que esta pasada existe para producir —*«¿Es nuevo, o es el arreglo?»*— está peor:
   **cinco redacciones distintas** (*«Lo introdujo el arreglo»*, *«Es el arreglo»*, *«El arreglo lo
   volvió alcanzable»*, *«Lo destapó el arreglo»*, *«Nuevo sobre el arreglo»*), así que el dato que
   `D-30` nombró como el motivo del ciclo **no se puede agregar con un script**.
4. Es `F-8C2-016` punto 3 **una pasada después**, sobre informes escritos con la instrucción
   delante: *«Un programa que se verifica contando no puede contar sus propios hallazgos con una
   sola consulta.»* La plantilla de [`00-instrucciones.md`](./00-instrucciones.md) §5 escribe
   `**Severidad.**` con el punto adentro de las negritas, y cuatro de los seis informes la
   siguieron y dos no.

**Dónde lo permite el diseño.**

- [`00-instrucciones.md`](./00-instrucciones.md) §5 (la plantilla) y §6 (*«Los conteos se cuentan»*).
- `HOS-1352/docs/01-decision-log.md`, `DEC-METH-006`, condición de corte.
- Medición propia sobre los seis informes de `docs/17-fase-8-bis/`.

**Severidad.** `ALTA` — no rompe el sistema, rompe **la única medición que decide si el programa
avanza**, y falla hacia el lado que da vía libre.

**¿Es nuevo, o es el arreglo?** **Nuevo sobre el arreglo**: el conteo no era un predicado de
decisión hasta que `D-30` lo convirtió en uno.

---

### F-8bC2-005 — Tres fechas del programa no pueden ser las tres ciertas, y la más cercana es dentro de cuatro días

**Qué se rompe.** El 2026-09-23 el programa tiene que estar a la vez en FASE 10 (empezar a
desarrollar), con la FASE 7 del paraguas escrita (que no existe) y con el ciclo 8 ↔ 9 cerrado (que
acaba de abrir 25 críticos). Las tres condiciones están decididas, las tres son del mismo día, y
**ninguna de las tres decisiones nombra a las otras dos**.

**El camino.**

1. **`D-28`**: *«ni en pedo vamos a esperar 3 meses. Si en 3 o 4 días no tenemos respuesta,
   empezaremos a desarrollar con lo que tenemos conocido hoy en día»*. **Plazo: hasta el
   2026-09-23.**
2. **`D-32`**: la FASE 7 del paraguas *«se escribe como documento propio, con dueño, **ANTES de que
   nazca la rama**»*, y la rama nace *«cuando exista el primer código»* (`DEC-ARCH-007` punto 1).
   Con `D-28`, *antes de que nazca la rama* **es antes del 2026-09-23**. Contenido hoy:
   *«**Su contenido todavía no está escrito.**»* (`16-fase-7-del-paraguas.md` §1).
3. **`DEC-METH-006`** §3 fija el orden: *«| 3 | **8-bis, entera** | 4 | **¿críticos nuevos?** → 9-bis
   → **volver al paso 1** | 5 | **¿sin críticos?** → recién ahí **salidas 3 y 4** | 6 | **FASE 10**
   |»*. Con 25 críticos, el paso 4 se dispara y **FASE 10 queda detrás de al menos una 9-bis y una
   8-ter completas**.
4. **Y el PDR no deja margen**: *«NO saltar fases»* (§65) y *«FASE 10 — **Solo ahora código
   productivo**»*.
5. Las tres se decidieron **el mismo día**, en el mismo documento
   ([`15-fase-9/07-decisiones-del-owner.md`](../15-fase-9/07-decisiones-del-owner.md), `D-28`,
   `D-30`, `D-32`), y el documento las cierra con una tabla *«Lo que sigue abierto, con su causa»*
   que **no registra la colisión**.
6. El desenlace por omisión es el peor de los tres: se empieza a escribir código el 2026-09-23
   contra un diseño que el propio método declara no final y **garantiza** que va a moverse. Es
   `F-8C2-013` —*«la FASE 9 corrige capítulos sobre los que ya se escribió código»*— que hasta hoy
   no tenía disparador y ahora tiene fecha.

**Dónde lo permite el diseño.**

- `15-fase-9/07-decisiones-del-owner.md`, `D-28` (*«Plazo: hasta el 2026-09-23»*), `D-30` §3 (la
  tabla de seis pasos) y `D-32` (*«ANTES de que nazca la rama»*).
- `HOS-1352/docs/16-fase-7-del-paraguas.md` §1 y §2.
- `HOS-1352/docs/00-PDR.md` §65, *«NO saltar fases»* y FASE 10.

**Severidad.** `ALTA` — no produce un cobro por sí sola; produce **código productivo escrito contra
un diseño con 25 críticos abiertos**, que es el modo de falla que todo el método existe para
impedir.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Las tres fechas son de la FASE 9 y
ninguna existía antes.

---

### F-8bC2-006 — La FASE 7 del paraguas declara que contesta «quién lo escribe» y no nombra a nadie; y de sus seis ítems huérfanos, cuatro siguen en cero

**Qué se rompe.** El hueco que `F-8C2-005` y `F-8C2-010` reportaban —la estrategia de despliegue del
programa no es de nadie— **cambió de nombre y no de estado**. Hoy tiene archivo, y el archivo dice
que su contenido no está escrito. El rollback del reemplazo entero del sistema de cobro sigue sin
existir, cuatro días antes de que se empiece a escribir el código que lo va a necesitar.

**El camino.**

1. `D-32` decide *«con dueño»*, y el documento lo promete en su primera línea: *«Lo que está escrito
   acá es **qué tiene que contestar, quién lo escribe y para cuándo**»* (`16-fase-7-del-paraguas.md`
   §1). **Ningún párrafo del archivo nombra a una persona, un rol ni una unidad de trabajo.** Contesta
   dos de las tres preguntas que dice contestar.
2. Contenido: *«**Su contenido todavía no está escrito.**»* (§1) y *«Los seis ítems huérfanos, uno
   por uno. Ésa es la FASE 7 del paraguas y **es trabajo pendiente**»* (§4).
3. **Medido hoy sobre los tres cuerpos de diseño** —`docs/nucleo/`, `HOS-1353/docs/`,
   `HOS-1354/docs/`—, después de aplicada la FASE 9:

   | palabra | FASE 8 | hoy |
   |---|---|---|
   | `rollout` | 0 | **0** |
   | `feature flag` | 0 | **0** |
   | `coexistence` | 0 | **0** |
   | `rollback` | 0 | **5** |

   Las cinco apariciones de `rollback` están en los dos capítulos 21: **tres** hablan del rollback de
   la migración que `D-26` dejó sin sujeto y **dos** dicen que el del programa vive en otra parte
   (*«el **rollback del PROGRAMA** … no se escribe acá»*, `B/21` §2.4).
4. **Y en los cuatro documentos que un implementador abre para saber qué construir** —los dos
   `spec.md` de épica y las dos `descomposicion.md`— las tres palabras tienen **cero apariciones**,
   medido. Ninguna de las 22 unidades tiene un ítem de rollout, coexistencia, flags ni rollback.
5. `16-fase-7…` §2 fija el momento con un argumento correcto —*«Después de que nazca, la estrategia
   de despliegue se escribe con código adentro, que es exactamente la posición desde la cual una
   decisión de rollback deja de ser una decisión y pasa a ser una descripción de lo que ya se
   hizo»*— y `D-28` pone el nacimiento a cuatro días.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §1, §2, §3 y §4, citados.
- `HOS-1352/docs/00-PDR.md` §65, FASE 7 — los diez ítems.
- Medición propia con `rg -ci` sobre `docs/nucleo/*.md`,
  `HOS-1353-…/docs/*.md`, `HOS-1354-…/docs/*.md`, los dos `spec.md` y las dos `descomposicion.md`.

**Severidad.** `ALTA` — un despliegue único e irreversible del sistema de cobro sigue siendo una
elección de riesgo tomada por omisión, y ahora con fecha.

**¿Es nuevo, o es el arreglo?** **Es el arreglo a medias.** `D-32` cerró la mitad *«dónde vive»* de
`F-8C2-005` y `F-8C2-010` y dejó abiertas las mitades *«quién»* y *«qué dice»*. Nombrar el hueco no
lo cierra — y la salvedad que el propio documento acepta (*«puede que la conclusión honesta sea que
no hay vuelta atrás»*) sólo tiene valor si alguien la escribe antes del corte, no después.

---

### F-8bC2-007 — `DEC-CI-001` sigue sin aplicar, se contradice consigo misma sobre `e2e-pr.yml`, y su única copia escrita no está en `staging`

**Qué se rompe.** La decisión que convierte *«no lo hagas»* en *«no se puede»* sigue sin existir en
la herramienta, y ahora además **dice dos cosas distintas** sobre uno de los diez workflows que hay
que tocar. Quien la aplique —en días— tiene que elegir entre dos fuentes del programa que se
contradicen, y ninguna de las dos está donde el CI la lee.

**El camino, todo medido el 2026-09-19.**

1. **En el repo, cero.** `rg "epic" .github/` devuelve **0 aciertos** sobre los **15** workflows. Los
   filtros siguen exactamente como los describía `F-8C2-003`: `ci.yml` en `pull_request` a
   `[main, staging]`, `e2e-pr.yml` y `lighthouse.yml` a `[staging, main]`, `a11y-sweep.yml` sólo a
   `staging`, `codeql.yml` sólo a `main`.
2. **En `origin/staging`, cero por partida doble.** `git show origin/staging:.github/workflows/<w>`
   da **0** aciertos de `epic` en los siete workflows del reparto, y
   `git show origin/staging:CLAUDE.md` da **0** aciertos de `epic` en todo el archivo. La regla que
   `DEC-CI-001` implicación 4 declara viva —*«La regla vive en el `CLAUDE.md` del repo, junto a las
   de `main` y `staging`»*— **existe sólo en la rama de spec**, en tres commits (`560055ac4`,
   `066c2fbd0`, `36e17982c`) que no llegaron a `staging`.
3. **La rama no existe**: `git ls-remote --heads origin 'epic/*'` → **cero**, con 502 heads remotos.
4. **Y las dos copias se contradicen.** El decision log pone `e2e-pr.yml` del lado que **no** corre:
   *«**No corren**: `e2e-pr.yml` (caro por PR — va por `workflow_dispatch` y **obligatorio antes del
   PR final a `staging`**)»*. El `CLAUDE.md` de la rama lo pone del lado que **sí**: *«| runs on
   `epic/**` | … | `e2e-pr.yml` — only the **P0** suite, mocked externals, 25 min cap |»*. El commit
   `066c2fbd0` —*«docs: e2e P0 vuelve a correr en la rama paraguas»*— tocó **sólo `CLAUDE.md`**; el
   decision log no se actualizó.
5. **La decisión difiere su propia aplicación a la fase que viene a proteger**: *«**No está
   aplicado.** Son archivos del repo y el §65 reserva el código productivo para la FASE 10; la
   aplicación la decide el owner»* (implicación 1). Pero los workflows tienen que estar **antes del
   primer PR de sub-épica**, que por `D-28` es dentro de días y por `DEC-METH-006` es antes de la
   FASE 10. La condición de aplicación y el momento en que hace falta están del lado equivocado uno
   del otro.
6. Y hay un detalle de mecánica que la decisión no dice y cambia quién tiene que aplicarla: para
   `pull_request`, GitHub ejecuta el workflow **de la rama base**. Los filtros `epic/**` tienen que
   existir **en la rama del paraguas**, no en `staging`, para que los PRs de sub-épica corran. O sea
   que la aplicación puede hacerse en el paraguas — pero entonces el diff de los diez workflows viaja
   dentro del PR final a `staging`, que es el que *«nadie puede revisar de verdad»*.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-CI-001`, *«El reparto, workflow por workflow»* e
  implicaciones 1, 2 y 4.
- `CLAUDE.md` de la rama, §«`epic/**` — umbrella integration branches», tabla de reparto.
- Medición propia: `.github/workflows/*.yml` (15 archivos), `git ls-remote --heads origin 'epic/*'`,
  `git show origin/staging:…`.

**Severidad.** `ALTA` — es `F-8C2-003` sin corregir más una contradicción nueva. No es `CRITICA`
porque no mueve plata; y porque la línea más peligrosa del reparto está a salvo por accidente
(ver §4, ataque 4).

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** El hueco es `F-8C2-003`, que sigue entero. La
contradicción sobre `e2e-pr.yml` y la asimetría entre las dos copias **las introdujo el arreglo**,
al escribir la regla en dos lugares y actualizar uno.

---

### F-8bC2-008 — El gate de FASE 5 se abrió en el log y sigue cerrado en los ocho documentos que un implementador lee; `V1` sigue sin dueño para un trabajo de 16.721 apariciones

**Qué se rompe.** `DEC-METH-007` existe para destrabar `V1`, que es lo primero que se construye en
todo el programa. Cuatro días antes de empezar, **ningún documento que describa `V1` dice que el
gate se abrió**, ninguna de las 22 unidades es dueña del trabajo que `G8` exige, y el tamaño de ese
trabajo no está medido en ninguna parte del programa. Abrir el gate era necesario y no alcanza.

**El camino.**

1. `DEC-METH-007` abre el gate y dice para qué: *«**Qué destraba**: `V1`, la única unidad sin
   dependencias, que lleva `G8` —falla si queda `commerce` en fuentes activas— y hacerlo pasar **es
   ejecutar el §55 sobre el código real**. Sin esto, **la primera unidad del programa no puede
   terminar** y las otras 21 esperan.»*
2. **Medido**, excluyendo los informes adversariales y los de la FASE 9 —que son registro histórico
   y no se tocan—: **`DEC-METH-007` aparece en 2 archivos** (el decision log y el handoff);
   **`DEC-METH-003` aparece 25 veces en 16 archivos**, y **ocho de ellos describen el trabajo que el
   gate destraba y siguen diciendo lo mismo que antes**:

   | archivo | qué sigue diciendo |
   |---|---|
   | **`04-open-decisions.md`**, §«Gate de FASE 5 — decidido» | *«El criterio … **se define al empezar FASE 5**»* y *«**No se clasifica ninguna pieza antes de haberlo definido.**»* — en el documento cuyo trabajo es decir qué sigue abierto |
   | `HOS-1353/descomposicion.md` §6 | *«Qué se reescribe y qué se reutiliza. Es FASE 5 y **tiene su gate propio** (`DEC-METH-003`).»* |
   | `HOS-1354/descomposicion.md` §6 | ídem |
   | `HOS-1353/docs/21-migracion.md`, cierre | *«tiene su propio gate (`DEC-METH-003`) y es FASE 5. **No se anticipa acá ni implícitamente.**»* |
   | `HOS-1354/docs/21-migracion.md`, cierre | ídem |
   | `HOS-1353/spec.md` · `HOS-1354/spec.md` | ídem |
   | `nucleo/00-indice.md` | *«no se anticipa acá **ni siquiera de forma implícita**»* |

3. **Y `V1` sigue sin declarar `G8` en su criterio de terminación.** `HOS-1353/descomposicion.md` §2
   le asigna `G1 G3 G8`; su §4 —*«lo que la unidad tiene que dejar demostrado»*— dice *«agregar una
   clave al código sin agregarla a la base **falla**, y al revés también; y nombrar una vertical sin
   implementar su ítem del Eje 2 **falla**»*. **`G8` no aparece.** Es la misma omisión que
   `F-8C2-006` reportó, intacta.
4. **El tamaño del trabajo, medido hoy** sobre `apps/`, `packages/` y `scripts/` del worktree:

   | qué | archivos | ocurrencias |
   |---|---|---|
   | `commerce` (sin distinguir mayúsculas) | **1.390** | **16.721** |
   | `product_domain` · `productDomain` · `ProductDomainEnum` | **595** | — |
   | importadores de `@qazuor/qzpay` | **264** | — |

   Ninguno de esos tres números aparece en ningún documento del programa.
5. **Y el §55 incluye a los propios documentos de este programa**: *«Eliminar de fuentes activas:
   code; schema; types; tests; docs; **specs**; artifacts; comments; prompts; memory; Engram; TODO;
   naming.»* Medido: `commerce` aparece **110 veces en 17 archivos** de
   `.specs/HOS-1352*`, `HOS-1353*` y `HOS-1354*` — incluidos los dos capítulos 21, que son
   justamente los que mandan eliminarlo.
6. Nada de esto contradice `DEC-METH-005`, que ya decidió qué hacer con los guards viejos. Lo que
   falta es lo que `F-8C2-006` ya nombraba y `DEC-METH-007` no toca: **ninguna de las 22 unidades es
   «sacar `commerce`»**.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-METH-007`, *«Qué destraba»*.
- `HOS-1353/descomposicion.md` §2 (fila `V1`), §2.1 y §4.
- `HOS-1352/docs/04-open-decisions.md`, §«Gate de FASE 5 — decidido (`DEC-METH-003`)».
- `HOS-1352/docs/00-PDR.md` §55 y §55.1.
- Medición propia: `rg -l`/`rg -o` sobre `apps packages scripts` y sobre `.specs/HOS-135*`.

**Severidad.** `ALTA` — la primera unidad del programa sigue sin poder terminar, ahora por falta de
dueño y no de permiso.

**¿Es nuevo, o es el arreglo?** **Es el arreglo a medias.** `DEC-METH-007` cerró la mitad *«el gate
está cerrado»* de `F-8C2-006`. Lo que agrego es que la apertura **no se propagó** —está en 2 de 8
documentos— y que el trabajo que destraba **ahora está medido y sigue sin dueño**.

---

### F-8bC2-009 — El filtro 1 de `DEC-METH-007` no es decidible para la mitad billing, y el programa ya lo midió sin darse cuenta

**Qué se rompe.** El criterio que abre FASE 5 pregunta *«¿el sujeto de este código existe en el
modelo nuevo?»*. Para la mitad billing, **el modelo nuevo todavía no tiene forma**: `DEC-ARCH-004`
declara que *«cuál pasarela sea decide la forma de casi todo el sistema de billing»*. Aplicar el
filtro 1 hoy sobre el código de billing produce veredictos que hay que volver a correr cuando la
pasarela se decida — y `D-28` manda construir sobre ellos igual.

**El camino.**

1. `DEC-METH-007`, filtro 1: *«**Sobrevive el código cuyo sujeto sobrevive.** No se juzga la
   calidad: se pregunta si **la cosa que ese código maneja existe en el modelo nuevo**.»*
2. **El modelo nuevo de billing no está fijado.** `HOS-1354/descomposicion.md` §2.3: *«**Cuál sea
   decide la forma de casi todo el sistema**»*, con siete filas de cosas que la pasarela decide —el
   reloj del cobro, si la pausa es nativa, si un addon es una autorización aparte, si se puede mutar
   el ciclo, si el inventario se puede listar, qué miente el falso, el piso y la moneda.
3. **Y el programa ya corrió el filtro 1 sobre una muestra y midió la tasa de indecidibles.**
   [`15-fase-9/04-inventario-de-guards.md`](../15-fase-9/04-inventario-de-guards.md) aplicó
   exactamente esa forma —*«¿el diseño nuevo le borra el sujeto que este guard vigila?»*— a 45
   scripts y dio **7 `MUERE` / 6 `REVISAR` / 32 `SOBREVIVE`**. Los seis `REVISAR` son, textual,
   *«decidirlos hoy significaría **adivinar una pregunta —qué proveedor de cobro se usa—** que la
   propia spec de `HOS-1354` declara todavía sin resolver»* (§5). **13 % de indecidibles sobre la
   única muestra que existe**, y los seis son todos del lado billing.
4. `DEC-METH-007` es el precedente que cita ese mismo inventario —*«Precedente en la misma sesión: el
   inventario de guards aplicó exactamente esta forma»*— y **cita los tres números sin citar la
   razón del `REVISAR`**. El criterio se adoptó tomando como prueba de viabilidad una corrida cuyo
   13 % quedó abierto por la razón que hace al criterio no aplicable.
5. Y el filtro 2 hereda el problema por otro lado: exige *«ver que el test **detecta el fallo** —
   romper la cosa y verlo ponerse rojo»*. Eso es mutación pieza por pieza, y **no es unidad de
   trabajo de ninguna de las 22** ni tiene presupuesto declarado en ninguna descomposición.
6. El inventario de guards lo dice de sí mismo, y sigue siendo cierto: *«esa clasificación es FASE 5
   (`DEC-METH-003`), **que el owner todavía no abrió**»* (§5) — una frase que el 2026-09-19 pasó a
   ser falsa y que nadie corrigió (ver `F-8bC2-008`).

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-METH-007`, filtros 1 y 2 y la precisión sobre *«bien
  testeado»*.
- `HOS-1352/docs/15-fase-9/04-inventario-de-guards.md` §1, §2 (tabla `REVISAR`) y §5.
- `HOS-1354/descomposicion.md` §2.3 y `DEC-ARCH-004`.

**Severidad.** `ALTA` — el gate que destraba el programa produce, del lado billing, una clasificación
provisoria que `D-28` convierte en base de construcción.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**: el filtro 1 nació con `D-31` el
2026-09-19 y esta es su primera confrontación con el material.

---

### F-8bC2-010 — Si la pasarela es Mobbex no se rehace el adaptador: se rehacen 9 de los 13 criterios de aceptación de billing

**Qué se rompe.** `D-28` manda construir contra el proveedor falso y afirma que *«lo que el adaptador
compra es que esa re-medición **no invalide lo construido**, sólo el adaptador»*. Medido contra la
propia descomposición de billing, esa afirmación es falsa para **nueve de sus trece unidades**: lo
que se invalida no es el adaptador, es **qué tiene que demostrar cada unidad para declararse
terminada**.

**El camino.**

1. `D-28`: *«**Qué significa «con lo conocido»**: construir contra la interfaz de las ocho
   capacidades y el **proveedor falso**, con las **90 filas medidas** de la matriz como referencia de
   comportamiento.»*
2. **El proveedor falso es, por construcción, un simulador de Mercado Pago.**
   `HOS-1354/descomposicion.md` §2.3: *«| **qué miente el falso** | las **quince** filas del `20`
   §3.2, **todas suyas** |»*, y el criterio de `B1` en su §4: *«el falso **miente** — hay un caso
   donde acepta una mutación, devuelve `2xx`, **no la aplica**, y el código de arriba lo detecta
   releyendo»* — que es `EX-20`, una medición de Mercado Pago.
3. **Y el §4 de esa descomposición —*«lo que cada unidad tiene que dejar demostrado»*— enuncia nueve
   de sus trece criterios sobre comportamiento medido de Mercado Pago**:

   | unidad | la frase del §4 que lo ata | qué la sostiene |
   |---|---|---|
   | `B1` | *«acepta una mutación, devuelve `2xx`, no la aplica»* | `EX-20` |
   | `B3` | *«una ventana que vence **cancela en el proveedor**»* · *«diez altas simultáneas … un id en el proveedor»* | `PA-5`, `EX-6`, y las 72 h existen porque `EX-1` está `UNKNOWN` |
   | `B5` | *«un reembolso que emite **tres notificaciones en dos formatos** produce una fila»* | la forma de los webhooks de MP |
   | `B7` | *«un **primer** cobro rechazado **no da grace**»* · *«un cobro que el proveedor está reintentando deja el pago `PENDING`»* | `B/12` §4.4 y los reintentos de MP |
   | `B8` | *«un aumento … se aplica en el **primer cobro posterior a la reanudación**»* | `PS-6`: la pausa de MP no auto-reanuda |
   | `B9` | *«un descuento que deja el monto bajo **ARS 15** pausa en vez de mutar»* | el piso de MP |
   | `B10` | *«cancelar el plan **deja vivo** el preapproval de cada addon recurrente»* · *«`PERIÓDICO + DÍAS_FIJOS` no se puede configurar»* | el array de ítems que da `400` |
   | `B11` | *«un barrido que liste desde el buscador del proveedor **no existe**»* | `RC-1`: 15 de 69 |
   | `B13` | *«**nuestro** correo sale antes que el del proveedor»* | `DEC-MAIL-001`, sobre el correo de MP |

   Las cuatro que no dependen —`B2`, `B4`, `B6` (bloqueada) y `B12`— son exactamente las que la
   descomposición ya marca sin atadura o sin diseño.
4. O sea que la re-medición de `F-8C2-007` —*«las 49 filas `VERIFIED` vuelven a `UNKNOWN`»*— **no se
   detiene en el adaptador**: llega a los tests de nueve unidades, que son lo que `DEC-ARCH-007`
   implicación 1 exige para declarar una épica *«lista y **verificada** contra el contrato»*.
5. `D-28` lo reconoce a medias —*«`F-8C2-007` sigue en pie»*— y saca la conclusión equivocada:
   *«lo que el adaptador compra es que esa re-medición no invalide lo construido, **sólo el
   adaptador**»*. Lo construido incluye sus criterios de aceptación, y nueve de trece están
   escritos sobre el proveedor que puede no ser.

**Dónde lo permite el diseño.**

- `15-fase-9/07-decisiones-del-owner.md`, `D-28`, *«Qué significa «con lo conocido»»* y *«Lo que esta
  decisión NO cambia»*.
- `HOS-1354/descomposicion.md` §2.3 (la tabla *«lo que la pasarela decide»*) y §4 (las trece filas).
- `HOS-1352/docs/10-evaluacion-de-proveedor.md`, *«Lo que NO cambia si cambiamos de proveedor»*.

**Severidad.** `ALTA` — no produce un cobro; produce que *«terminada»*, que es el hito que dispara la
liberación conjunta, no tenga criterio estable para nueve unidades.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** `F-8C2-007` reportaba la re-apertura de
la FASE 1C; `D-28` la aceptó y **declaró acotado su alcance al adaptador**. Esa acotación es nueva,
es del 2026-09-19, y es lo que mido acá.

---

### F-8bC2-011 — `D-28` alarga el paraguas y `DEC-MIG-003` se apoya en que sea corto; las dos son del mismo día y nadie las compuso

**Qué se rompe.** *«No se migra»* es barato **porque son ocho y porque la espera es corta**. El mismo
día, tres decisiones movieron las dos variables en la dirección que lo encarece —se siguen tomando
altas, el programa se alarga y el umbral que lo acota se cruza solo— y **ninguna de las tres nombra
a las otras**. Cada fila que se suma a la cohorte es, por `F-8bB3-002`, un candidato de cobro
huérfano imputado a la suscripción nueva de la misma persona.

**El camino.**

1. `DEC-MIG-003` se apoya en el tamaño: *«se estaba construyendo una migración para **ocho filas sin
   un solo pago, todas de gente a la que se puede llamar**»*, y declara su caducidad: *«Con ocho
   filas *«no migrar»* son tres llamadas; **el umbral medido está en unas veinte**, y arriba de eso
   deja de ser viable.»*
2. `DEC-MIG-002` mantiene la fuente que hace crecer la cohorte: *«las altas nuevas siguen tomándose
   en el sistema actual durante el rediseño»*.
3. **`D-29` declara por escrito que el programa se alarga, y lo deduce de `D-28`**: *«Con `D-28`
   —arrancar a desarrollar en días sin esperar la pasarela— **el paraguas va a vivir más, no
   menos**: verticales avanza ya y billing construye contra el proveedor falso.»* Ese razonamiento
   está en el documento de decisiones, a 130 líneas de `D-26`, y **no vuelve sobre `DEC-MIG-003`**.
4. **La vigilancia es una promesa verbal.** `V/21` §2.4: *«El aviso que el owner ya se comprometió a
   dar —*«si veo que empiezan a entrar registros nuevos, te aviso»*— ahora tiene una consecuencia
   concreta»*. No hay consulta agendada, ni conteo, ni alarma, ni dueño.
5. **Y la re-verificación está del lado equivocado del momento en que sirve**: `B/21` §1.3 la fija
   *«antes de implementar nada de FASE 10»*, o sea **después** de todos los meses durante los cuales
   la cohorte crece. Es `F-8C2-012` con un número puesto y sin instrumento.
6. **El umbral que de verdad manda ni siquiera es el de veinte**, y está escrito fuera de los
   capítulos: *«**El umbral real no es cuántas filas hay: es si alguna ya cobró.** Con cero pagos,
   migrar es escribir títulos y volver a pedir un consentimiento. Con un pago, migrar pasa a incluir
   **una serie de comprobantes sin huecos**»*
   ([`15-fase-9/06-R5-resuelto.md`](../15-fase-9/06-R5-resuelto.md) §7.1). **Ese umbral se cruza solo
   el 2026-09-26**, siete días después de esta pasada: `B/21` §3.2 (b) tiene la fecha del primer
   cobro de la historia del sistema y le asigna *«alguien mirándola el día que pase»*, sin nombre.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-MIG-003` (*«Condición de caducidad»*) y `DEC-MIG-002`.
- `15-fase-9/07-decisiones-del-owner.md`, `D-28` y `D-29` (*«el paraguas va a vivir más, no menos»*).
- `HOS-1353/docs/21-migracion.md` §2.4 · `HOS-1354/docs/21-migracion.md` §1.3 y §3.2 (b).
- `15-fase-9/06-R5-resuelto.md` §7.1.

**Severidad.** `ALTA`. **No la marco `CRITICA` porque el mecanismo que cuesta plata es de
`F-8bB3-002`**, ya reportado; lo que agrego es el multiplicador y las tres decisiones que lo
producen sin verse entre sí. `F-8bB3-011` cubre la mitad *«la cita del umbral está rota»*; ésta es la
mitad *«las decisiones del mismo día empujan en direcciones opuestas»*.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** `DEC-MIG-003`, `D-28` y `D-29` son las
tres del 2026-09-19.

---

## MEDIA

### F-8bC2-012 — La rama del paraguas no tiene punto de corte declarado, y la línea de documentos que `DEC-ARCH-007` da por resuelta lleva 330 commits sin llegar a `staging`

**Qué se rompe.** En días hay que crear `epic/HOS-1352-verticales-billing` y **ningún documento dice
de dónde se corta**. Las dos opciones dan resultados distintos y las dos rompen algo: de `staging`,
el paraguas nace sin el diseño ni la regla de CI; de la rama de spec, nace cargando 330 commits de
documentación que después viajan dentro del PR final.

**El camino.**

1. La regla, en cuatro documentos, sólo dice **cuándo**: *«nace cuando exista el primer código, no
   antes»* (`DEC-ARCH-007` punto 1; `11-particion` §6.1; las dos specs). **Nunca dice desde dónde.**
2. `DEC-ARCH-007` punto 1 declara resuelta la línea de documentos: *«Los documentos siguen yendo por
   su rama de spec, **que sí va a `staging` normalmente**: son documentación y no despliegan nada.»*
3. **Medido el 2026-09-19**: `git rev-list --left-right --count origin/staging...HEAD` da
   **`0  330`**, y `git ls-tree -r origin/staging .specs/` devuelve **cero** archivos de
   `HOS-1352`, `HOS-1353` y `HOS-1354`. Los 330 commits van del 2026-09-15 al 2026-09-19 y **ninguno
   llegó a `staging`**. *«Normalmente»* describe algo que no ocurrió una sola vez.
4. Consecuencia práctica: hoy `staging` no contiene el PDR, ni el decision log, ni el contrato de
   cobertura, ni la regla `epic/**` del `CLAUDE.md` (`F-8bC2-007`). Un paraguas cortado de `staging`
   arranca sin nada de eso.
5. Y la mitad *«cota»* de `F-8C2-014` sí quedó cerrada por `D-28` —la espera se corta en días—, que
   es lo que vuelve urgente la mitad que falta.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-ARCH-007` punto 1; `11-particion-del-programa.md` §6.1.
- Medición propia: `git rev-list --left-right --count`, `git ls-tree -r origin/staging .specs/`.

**Severidad.** `MEDIA` — se arregla con una línea en la FASE 7 del paraguas, que es el documento que
falta.

**¿Es nuevo, o es el arreglo?** **Nuevo sobre el arreglo**: la pregunta no era urgente hasta que
`D-28` puso fecha al nacimiento.

---

### F-8bC2-013 — El guard que protege los datos de seed vivos no puede dar un veredicto con sentido sobre el paraguas, en ninguno de sus dos modos — y `V1` y `V2` son catálogos de seed

**Qué se rompe.** El guard que impide que un cambio de datos de seed llegue a producción sin su
data-migration numerada **no funciona sobre una rama de integración larga**: en un modo grita sobre
cambios ajenos ya resueltos, en el otro no mira nada. Y las dos primeras unidades del programa —el
catálogo de verticales y claves, y el catálogo de planes— son exactamente la clase de dato que ese
guard existe para vigilar.

**El camino.**

1. `V1` deja *«el enum de verticales, **su espejo en base**, y el catálogo de claves de entitlement y
   limit»*; `V2` deja *«`plan`, `plan_version` y sus entitlements y limits»*
   (`HOS-1353/descomposicion.md` §2). El `CLAUDE.md` del repo define el sujeto del guard con esas
   mismas palabras: *«add/rename/remove a `required` catalog row … a billing plan/limit/entitlement»*.
2. El guard se ancla en un baseline que resuelve `scripts/resolve-ci-baseline.sh`, y en `push` usa
   `github.event.before`: *«`PUSH_BEFORE` `github.event.before` (push runs)»*.
3. **Modo A — el merge periódico `staging` → paraguas.** El baseline es el HEAD anterior del
   paraguas, así que el diff incluye **todos los cambios de seed que `staging` hizo desde el merge
   anterior** — que ya traen su data-migration, porque se mergearon bien. El guard se pone rojo por
   una regla satisfecha. `DEC-CI-001` lo anticipa: *«esa merge será **ruidosa** en los dos jobs
   basados en diff … re-dispatch `ci.yml` with `baseline_ref: staging` to fix the base»*.
4. **Modo B — el workaround prescrito.** Con `baseline_ref: staging`, el script resuelve
   *«`git merge-base HEAD origin/staging`»*, que **inmediatamente después del merge es el merge
   mismo**: el diff queda vacío y el guard pasa sin haber comparado nada.
5. Los dos modos son veredictos sin información, y el remedio declarado es que una persona se
   acuerde de re-disparar el workflow con el input correcto. Durante meses, en la rama que lleva todo
   el programa.
6. Y el guard no es opcional: es el que existe porque *«fresh DBs are correct but live DBs never
   receive the change»*. Un catálogo de planes que llega a `main` sin su data-migration es un sistema
   nuevo desplegado **sin planes en producción**.

**Dónde lo permite el diseño.**

- `scripts/resolve-ci-baseline.sh` (medido) y `.github/workflows/ci.yml`, pasos *«Resolve diff
  baseline»* y *«Check seed dual-write rule (HOS-25 T-024)»*.
- `CLAUDE.md` de la rama, §«`epic/**`», párrafo *«`ci.yml` needs both halves»*.
- `HOS-1353/descomposicion.md` §2, filas `V1` y `V2`.

**Severidad.** `MEDIA` — no hay vuelta atrás rota ni plata, pero es el guard que más hace falta
durante este programa y queda inoperante justo en la rama del programa. **`NUCLEO` no aplica**: es
del repo, no del diseño.

**¿Es nuevo, o es el arreglo?** **Nuevo sobre el arreglo.** `DEC-CI-001` es lo que trae el modo A al
tablero; el modo B es su propio remedio, que nadie evaluó.

---

### F-8bC2-014 — La propagación se difirió al final del ciclo, así que las 22 fichas, las 12 etiquetas y el tablero quedan mintiendo tantas pasadas como tenga el ciclo

**Qué se rompe.** `D-30` §3 movió la propagación —52 objetos entre issues, fichas y
descomposiciones— **después** del ciclo, por una razón correcta: no propagar dos veces. La
consecuencia que no evaluó es que, mientras el ciclo corra, **todo lo publicado dice cosas falsas**,
y es lo único que un implementador mira para saber qué construir.

**El camino.**

1. `D-30` §3: *«| 5 | **¿sin críticos?** → recién ahí **salidas 3 y 4**, una sola vez |»*, y la
   razón: *«Si la 8-bis corriera después … la 9-bis los resolvería **y habría que propagar todo de
   nuevo**»*.
2. Con 25 críticos, hay al menos una vuelta más, y por `F-8bC2-003` puede haber varias.
3. Lo que queda mintiendo, enumerado: las **22 fichas** publicadas
   (`HOS-1353/descomposicion.md` §5 y `HOS-1354/descomposicion.md` §5), el **tablero** que *«calcula
   solo cuáles están listas: una unidad lo está **cuando todas sus dependencias están hechas**»* —un
   predicado que no tiene lugar para el gate de FASE 5, la FASE 7 que falta, ni los críticos
   abiertos—, y las **12 etiquetas `status-blocked` de Linear** que `D-28` declara pendientes de
   revisar: *«con esta decisión *«bloqueada»* pasa a significar otra cosa … **Esas etiquetas hay que
   revisarlas una por una**, y es parte de la salida 4»*.
4. Y `D-28` pone a gente a desarrollar el 2026-09-23, o sea **dentro de la ventana en la que todo eso
   está desactualizado a propósito**.
5. Es `F-8C2-011` una pasada después, con la diferencia de que ahora el desfasaje está **decidido**
   en vez de ser un accidente de fechas.

**Dónde lo permite el diseño.**

- `15-fase-9/07-decisiones-del-owner.md`, `D-30` §3 y `D-28`, *«Consecuencia operativa que hay que
  ejecutar»*.
- `HOS-1353/descomposicion.md` §5 · `HOS-1354/descomposicion.md` §5.

**Severidad.** `MEDIA`.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**: el diferimiento es `D-30` §3, del
2026-09-19.

---

### F-8bC2-015 — El handoff, que el §66 designa para reconstruir el estado, dice «3 a 10 ⬜ sin empezar» con la 8 y la 9 corridas, y no tiene forma de expresar un ciclo

**Qué se rompe.** El documento que el PDR manda mantener para que *«cada handoff pueda reconstruir
exactamente lo realizado»* (§37) declara sin empezar dos fases que produjeron 141 + 85 hallazgos y
33 decisiones. Y su tabla es lineal, así que **no puede representar el ciclo 8 ↔ 9 aunque se la
actualice**.

**El camino.**

1. `03-handoff.md`, «Estado por fase, medido»: *«| 3 a 10 | épicas → implementación | ⬜ **sin
   empezar** |»*. Medido hoy, con las fases 3, 4, 8 y 9 ejecutadas y documentadas en cuatro carpetas
   de `docs/`.
2. El mismo bloque da la regla que lo contradice: *«**Conteos que se recuentan con script, nunca a
   mano** … las decisiones con `rg -c "^### DEC-"` (**47 encabezados = 46 decisiones**)»*. Medido
   hoy: **61 encabezados = 60 decisiones**.
3. La tabla tiene una fila por fase y un estado por fila. `DEC-METH-006` introdujo un bucle entre dos
   de ellas: *«¿críticos nuevos? → 9-bis → **volver al paso 1**»*. Una fila con ✅/🟡/⬜ no puede
   decir *«segunda vuelta de tres»*.
4. `HOS-1352/spec.md` es el documento que el §66 manda leer primero, y su fila 2 dice **48
   decisiones**; el handfoff dice **54**; el log dice **60**. Es la `BAJA` de abajo.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/03-handoff.md`, «Estado por fase, medido» y su nota de conteos.
- `HOS-1352/docs/00-PDR.md` §37 y §66.
- Medición propia: `grep -c "^### DEC-" 01-decision-log.md` → 61.

**Severidad.** `MEDIA` — el §66 apoya toda la continuidad del programa en este documento, y el
programa atraviesa varias ventanas de contexto por diseño.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** El desfasaje de la tabla es anterior; la
imposibilidad de representar un ciclo la introdujo `D-30`.

---

## BAJA

### F-8bC2-016 — Siguen conviviendo tres conteos del decision log, y el que quedó más atrás es el que el §66 manda leer primero

**Qué se rompe.** Nada en ejecución. Pero `F-8C2-017` reportaba una diferencia de dos y hoy es de
**doce**, en el documento que abre el orden de lectura obligatorio.

**El camino.** Medido el 2026-09-19: `grep -c "^### DEC-"` sobre
`01-decision-log.md` da **61 encabezados = 60 decisiones**, que es lo que dice su propio «Resumen».
`HOS-1352/spec.md` dice **48 decisiones** en dos lugares —la tabla de orden de lectura, fila 2, y su
resumen—. `03-handoff.md` dice **54**. Los tres se escribieron con la regla del programa y los tres
son correctos **en su fecha**; el worklog incluso documenta el patrón (*«este mismo worklog dice «45
decisiones» y es correcto **en su fecha**»*). Lo que falta sigue siendo que el de arriba se actualice
cuando el de abajo cambia.

**Dónde lo permite el diseño.**

- `HOS-1352/spec.md`, tabla de orden de lectura, fila 2, y §«48 decisiones».
- `HOS-1352/docs/03-handoff.md`; `HOS-1352/docs/01-decision-log.md`, «Resumen».

**Severidad.** `BAJA`.

**¿Es nuevo, o es el arreglo?** **Sigue llegando**: `F-8C2-017`, ensanchado por las doce decisiones
que la FASE 9 agregó.

---

## 3. Los 17 hallazgos de la FASE 8, reejecutados sobre el texto nuevo

**No son hallazgos de esta pasada.** Cada camino se volvió a correr paso por paso contra el texto y
el repo de hoy.

| id | veredicto | dónde corta, o por qué sigue llegando |
|---|---|---|
| `F-8C2-001` · el punto de no retorno de la migración | **CORTA a medias** | **paso 4 corta**: `D-26` eliminó la migración por fila, así que ya no hay que elegir orden *por persona*. **El paso 3 sigue, una escala arriba**: `F-8bC2-002` |
| `F-8C2-002` · `DEC-MIG-001` y el §2.3 describen dos operaciones | **NO LLEGA** | **paso 2**: no hay transcripción. Coincide con el veredicto de `B3` sobre `F-8B3-006` |
| `F-8C2-003` · los PRs de revisión no disparan workflows | **SIGUE** entero | medido hoy: `rg "epic" .github/` → **0** sobre 15 workflows, y **0** en `origin/staging`. `DEC-CI-001` decidió y no aplicó: `F-8bC2-007` |
| `F-8C2-004` · el merge periódico resuelve texto, no semántica | **SIGUE** | `DEC-CI-001` atiende la mitad correcta en el papel (`push` a `ci.yml`) y no está aplicada. **Agravado**: `F-8bC2-013`, el guard de seed queda inoperante en los dos modos |
| `F-8C2-005` · no hay rollback | **SIGUE** | `rollout`, `coexistence` y `feature flag` siguen en **cero**; `rollback` pasó de 0 a **5**, y las cinco están en los capítulos 21 diciendo que vive en otro lado. `F-8bC2-006` |
| `F-8C2-006` · `V1` exige FASE 5 con el gate cerrado | **CORTA a medias** | **el gate se abrió** (`DEC-METH-007`). **Sigue**: nadie es dueño del §55, `V1` §4 no nombra `G8`, y el trabajo son 16.721 apariciones. `F-8bC2-008` |
| `F-8C2-007` · decidir la pasarela reabre la FASE 1C | **SIGUE** | `D-28` lo declara en pie textualmente. **Ampliado**: además reabre 9 de los 13 criterios de aceptación (`F-8bC2-010`) |
| `F-8C2-008` · guards de CI que vigilan el modelo que se borra | **SIGUE, mejor medido** | recontado hoy: **13 de los 53 pasos** del job `guards` nombran el modelo condenado, no 11 — la FASE 8 no contaba `qzpay` ni el filtro de planes no listados. La FASE 9 lo midió por el otro lado (7 `MUERE` / 6 `REVISAR` / 32 `SOBREVIVE`) y `DEC-METH-005` decidió qué hacer; **lo que sigue es cuándo se enfrentan al árbol nuevo**: el PR final |
| `F-8C2-009` · verticales no se certifica sin billing | **SIGUE, agravado** | dos de sus cuatro capas siguen atadas a MP, y `D-28` manda construir contra el falso que miente **como MP** (`F-8bC2-010`) |
| `F-8C2-010` · la FASE 7 se partió y el que despliega es el paraguas | **CORTA a medias** | `D-32` le dio documento y momento. **Sigue**: sin dueño y sin contenido (`F-8bC2-006`) |
| `F-8C2-011` · el desarme se publicó antes de la FASE 8 | **SIGUE, agravado** | 25 críticos más, y `D-30` §3 **difiere la propagación al final del ciclo** a propósito (`F-8bC2-014`) |
| `F-8C2-012` · la premisa que abarata la migración no la mide nadie | **SIGUE** | `DEC-MIG-003` puso el número (≈20) y no puso instrumento; `B/21` §1.3 agenda la re-verificación después del momento útil. `F-8bC2-011` y `F-8bB3-011` |
| `F-8C2-013` · la FASE 9 corrige capítulos con código ya escrito | **SIGUE, y ahora tiene fecha** | `D-28`: 2026-09-23. `F-8bC2-005` |
| `F-8C2-014` · la rama no tiene nacimiento verificable ni cota | **CORTA a medias** | `D-28` cierra la **cota** —y lo dice: *«cierra la mitad «cota» de `F-8C2-014`»*—. **Sigue el nacimiento**: de dónde se corta (`F-8bC2-012`) |
| `F-8C2-015` · la capacidad con riesgo de plataforma vence sin fecha | **SIGUE** entero | `R-MP-01` sigue sin respuesta y el canal técnico sigue cerrado. Ningún cambio de la FASE 9 lo toca |
| `F-8C2-016` · qué significa «resuelto» | **CORTA a medias** | `D-30` §1 define la salida de la FASE 9, y lo declara: *«Cierra el paso 4 de `F-8C2-016`»*. **Sigue el paso 3**: los informes no se pueden contar con una consulta (`F-8bC2-004`) |
| `F-8C2-017` · tres conteos del decision log | **SIGUE, ensanchado** | 48 / 54 / 60 (`F-8bC2-016`) |

**Conteo: 1 no llega · 5 cortan a medias · 11 siguen llegando.** Ninguno corta del todo salvo el que
perdió su sujeto.

---

## 4. Ataques que intenté y el diseño resistió

Nueve, y valen tanto como los hallazgos: son los lugares donde el mecanismo aguanta.

**1. «`D-28` abre la puerta a liberar una épica sola.»** No. Lo que abre es **construir** sin la
pasarela, y lo dice con precisión: *«Lo que esperaba era el adaptador real, no el contrato»*. El
candado de liberación sigue intacto en cuatro documentos, y ahora tiene un guard con dueño y unidad:
`G13` nace en `B4` —*«la de arranque **no puede llegar a producción**»*—, que es la unidad donde
aparece la segunda implementación. La razón por la que no nace en `V4` está escrita y es correcta:
un guard que falla desde el primer día nace con lista de excepciones.

**2. «`D-28` viola la condición A de `DEC-ARCH-004`.»** No, y es lo mejor argumentado de esa
decisión. La condición A —el SDK detrás del adaptador, con `G12`— y la definición de la API *«por lo
que Hospeda necesita, no por lo que una pasarela ofrece»* son **exactamente** lo que vuelve legítimo
construir sin saber la pasarela. Lo que `D-28` no compra son los criterios de aceptación
(`F-8bC2-010`); la arquitectura la respeta.

**3. «El paraguas se puede evitar: que cada sub-épica vaya a `staging`.»** No, y la razón está medida
y es grave: `smoke-gate-sync.yml` corre en `pull_request: closed` a `[staging, main]` y mueve issues
de Linear al mergear; los PRs de sub-épica llevan `[HOS-NNNN]` porque `validate-pr-title` lo exige.
**Cada PR de sub-épica a `staging` cerraría su unidad como hecha sin nada desplegado**, que es el
footgun con dos incidentes reales. El paraguas no es una preferencia de flujo: es lo que impide eso.

**4. «El `DEC-CI-001` sin aplicar deja abierta su línea más peligrosa.»** No, y es el mejor accidente
del programa: `smoke-gate-sync.yml` **no lista `epic/**` hoy** porque no lista nada que no sea
`staging` y `main`. La única línea del reparto que tenía que ser falsa por defecto **es falsa por
defecto**. Aplicar la decisión no puede romperla; no aplicarla tampoco. Todo lo que falta es lo que
falla hacia el lado ruidoso.

**5. «El umbral de las veinte filas se puede cruzar sin que nada lo note.»** A medias, y el diseño
resiste mejor de lo que parece: el umbral que manda **está escrito y tiene fecha** —*«si alguna ya
cobró»*, y el primer cobro es el 2026-09-26—. El diseño contiene su propio disparador. Lo que no
tiene es quién lo mira (`F-8bC2-011`).

**6. «El filtro 1 de `DEC-METH-007` es una trampa para el Eje 2.»** No, y `DEC-METH-003` había
anticipado exactamente esa trampa. El filtro pregunta *«¿esa capacidad de esa vertical existe en el
modelo nuevo?»* y no *«¿nombra una vertical?»*, que es la formulación que habría mandado el Eje 2
entero a `REWRITE` por definición. Hay precedente medido con evidencia por fila. El criterio es
correcto; lo que le falta es ser decidible del lado billing.

**7. «`DEC-MIG-003` pierde plata.»** No. Cero pagos en la historia del sistema, medido el 2026-09-15,
re-verificado el 2026-09-17 *«sin un solo cambio»* y consultado por cuarta vez el 2026-09-19 sin
mover un conteo. La decisión se apoya en una premisa medida tres veces. Lo que caduca es la premisa,
no el razonamiento — y eso el propio `DEC-MIG-003` lo declara.

**8. «El corte de las dos épicas se filtró con `D-28`.»** No. Verifiqué el grafo en los dos sentidos:
las dependencias cruzadas siguen siendo **dos y sólo dos** —`B2 → V2` por
`UNIQUE(plan_version_id, ciclo)` y `B4 → V4` por el contrato—, que es lo que
`HOS-1354/descomposicion.md` §2.6 declara, y las dos son tempranas. Las filtraciones que esta pasada
encontró (`F-8bB3-008`, `F-8bA3-005`) van en la dirección inversa —billing leyendo de verticales— y
son de `B3` y de `C1`. La partición aguanta.

**9. «`DEC-METH-006` se puede cumplir bajando la vara de `CRITICA`.»** Lo intenté: revisé los 25 de
esta pasada buscando severidad inflada, porque inflarla cuesta una vuelta entera. Los siete de `B1`
nombran un cobro concreto, los de `A3` y `A1` nombran un acceso concreto, los de `B2` nombran una
transición que deja plata sin cobrar. **No encontré uno solo inflado.** El problema del ciclo no es
la vara: es el generador (`F-8bC2-003`).

---

## 5. Fuera de mi vector

- **`NUCLEO` → `C1`** — `nucleo/04-invariantes.md` §3, fila 34, declara *«el código legacy dudoso se
  reescribe | **regla de FASE 5** (`DEC-METH-003`)»*, y `nucleo/00-indice.md` dice que la
  clasificación *«no se anticipa acá **ni siquiera de forma implícita**»*. Las dos quedaron del lado
  cerrado del gate que `DEC-METH-007` abrió (`F-8bC2-008`). Es propagación, no defecto de núcleo,
  pero toca dos archivos que no son míos.

- **`NUCLEO` → `C1`** — `nucleo/04-invariantes.md` §3 clasifica `D8` como sostenido por la **base**.
  `B3` ya lo reportó en su §5 y coincido: un guard estático sobre un valor que escribe el mismo
  camino que audita no es una restricción de base.

- **[`C1` — la costura]** `HOS-1354/docs/21-migracion.md` tiene sus secciones **fuera de orden**: el
  archivo va §1 → §1.3 → §3 → §3.3 → **§2.4** → §4. La sección que contiene la decisión central del
  capítulo (*«No se migra»*) está después de la que la cita. Es el mismo desarme que dejó a
  `HOS-1353/docs/20-testing.md` sin su §3.

- **[`A2` / `A3` — máquinas y datos]** El camino de `F-8bC2-001` pasa por `PRE_TRIAL` como fuente de
  clase `TÍTULO` y por `T1` disparado por un evento que ya ocurrió. La mitad *«el mecanismo está
  mal»* es de ellos (`F-8bA3-001`, `F-8bA2-001`); la mitad *«el día del corte lo instancia sobre
  toda la cartera»* es la que reporto.

- **[`B3` — conciliación y datos]** `F-8bC2-002` produce el webhook huérfano que `F-8bB3-002`
  describe. Si se resuelve el orden en la FASE 7 del paraguas, `F-8bB3-002` sigue en pie igual: la
  regla `R5-G` hace falta aunque la cancelación se haga en el orden correcto.
