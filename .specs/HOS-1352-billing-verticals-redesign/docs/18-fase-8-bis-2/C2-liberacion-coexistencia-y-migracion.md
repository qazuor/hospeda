---
title: "FASE 8-bis-2 · C2 — liberación, coexistencia y migración del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 · C2 — liberación, coexistencia y migración del conjunto

Tercera pasada sobre el **conjunto**. No ataco ninguna de las dos mitades: ataco si este programa,
**como programa**, se puede empezar, se puede liberar, puede convivir con el sistema que reemplaza
y tiene vuelta atrás. La vuelta anterior el corte era un hueco declarado; esta vuelta **el corte
existe, tiene cuatro pasos y un gate**, y eso es material nuevo que se puede atacar.

**Doce hallazgos: 2 `CRITICA`, 7 `ALTA`, 3 `MEDIA`.** Los doce declaran su atribución.

La reejecución de mis 16 hallazgos de la 8-bis está en la **§4** y **no cuenta como hallazgos
nuevos**: **2 cortan, 3 cortan a medias, 11 siguen llegando**.

**Límites declarados.**

1. **Mediciones del repo: 2026-09-20**, sobre el worktree
   `hospeda-spec-hos-1352-billing-redesign`, rama `spec/HOS-1352-billing-verticals-redesign`,
   `HEAD = 7281fbe6e`, y sobre `origin/staging` recién buscado. **Nunca sobre
   `/home/qazuor/projects/WEBS/hospeda2/`.**
2. **Esta vez sí leí código del sistema actual**, y sólo donde hacía falta para contestar una
   pregunta de coexistencia: qué hace el sistema vivo cuando se cancela un preapproval
   (`F-8cC2-006`). Está acotado a dos archivos y citado por línea. Los demás hallazgos no dependen
   de cómo está escrito el código; dependen de **cuánto hay** o de **qué declara un documento del
   repo**.
3. **No relitigo** `DEC-ARCH-004/005/006/007`, `DEC-MIG-002`, `DEC-MIG-003`, `D-26` ni `D-28`. Que
   se libere junto, que no se migre y que se arranque en días **no se discuten**. Ataco si el
   **mecanismo** elegido para cada una cumple.
4. **El núcleo es de `C1`.** Lo que encontré ahí va en la §6.
5. **Los números que cito y no medí llevan su fuente.** El número retirado —*«las doce fichas del
   catálogo»*— no lo uso en ningún camino: lo medido es **12 filas de alojamiento y 22 usuarios**
   (`07-facts-inventory.md`, «Contenido y usuarios», 2026-09-15), y **cuántas están publicadas no
   lo contó nadie** (`03-handoff.md`, «Tres correcciones de registro», punto 2).

---

## 1. La pregunta que esta pasada existe para contestar, medida

`DEC-METH-008` («el dominio del arreglo») se escribió porque la 8-bis dio **25 de 25** críticos
atribuidos a la tanda de arreglos anterior. **Esta pasada es la que mide si funcionó.**

### 1.1 Los dos conteos, recontados con script sobre los seis informes de A y B

| | 8-bis (A+B) | 8-bis-2 (A+B) | variación |
|---|---|---|---|
| hallazgos | **85** | **92** | **+8 %** |
| `CRITICA` | **25** | **24** | −4 % |
| `ALTA` | 41 | 36 | −12 % |
| `MEDIA` | 16 | 29 | +81 % |
| `BAJA` | 3 | 3 | — |
| `CRITICA` por vector | 4,17 | **4,00** | −4 % |

Medido con `rg -c '^### F-8c'` por archivo (A1 15 · A2 15 · A3 17 · B1 10 · B2 14 · B3 21 = 92) y
con la severidad extraída del encabezado de cada bloque. **Cuidado con dos trampas de conteo que
verifiqué**: los seis informes tienen **94** líneas `**Severidad.**` y sólo 92 hallazgos nuevos —
las dos de más son `F-8bB1-009` y `F-8bB1-012`, reejecuciones de la 8-bis que `B1` anota con su ID
viejo, como pide el §4 de las instrucciones. Y `B1` numera 001–011 **salteando el 009**, así que su
ID más alto no es su cantidad.

### 1.2 El dato que decide la pregunta: 24 de 24

Leí las 24 líneas *«¿Es nuevo, o es el arreglo?»* de los 24 `CRITICA`, una por una. **Las 24 nombran
un arreglo concreto de la 9-bis**, con su número: el 2, el 6, el 8, el 9, el 10, el 11·12, el 15, el
18, el 21, el 22, el 23, y la precisión de registro. **Ninguna dice *«esto ya estaba y nadie lo
vio»*.**

| | 8-bis | 8-bis-2 |
|---|---|---|
| críticos | 28 (8 vectores) · **25** (A+B) | **24** (A+B) |
| **atribuidos a la tanda de arreglos anterior** | **25 de 25** | **24 de 24** |

Sobre los 92 completos la proporción se sostiene: **85 atribuyen a un arreglo**, 4 se declaran
*«sigue llegando»* o *«el conteo es viejo»*, y 3 quedan sin clasificar por redacción mixta. **Cero
son defectos preexistentes.**

> **Respuesta: `DEC-METH-008` no cambió la proporción.** Bajó un crítico sobre veinticinco y subió
> el total de hallazgos un 8 %. La regla nueva **sí** produjo algo distinto —`B3` §2 recorre la
> pregunta obligatoria arreglo por arreglo y saca cinco pares de ella, y `A2`/`A3` la citan por
> nombre en sus atribuciones—, pero lo que produjo son **hallazgos de la FASE 8, no cierres de la
> FASE 9**: la regla se está aplicando en la pasada que busca, no en la que arregla. Es la
> diferencia entre una regla escrita y una regla ejecutada, y esta pasada mide que todavía es lo
> primero. **Eso es `F-8bC2-003` sin corregir**, y por eso no lo repito como hallazgo nuevo (§4).

### 1.3 Y una cosa que sí cortó, y conviene decirlo

`F-8bC2-004` reportaba que el predicado de corte no se podía evaluar con una consulta: los informes
escribían la severidad de dos formas y una expresión razonable devolvía **14 de 85**. **Hoy los seis
informes usan la misma forma**: `rg -c '^\*\*Severidad\.\*\*'` matchea **94 de 94**. La plantilla
del §5 se siguió. **El hallazgo corta**, con la salvedad de la §1.1: la consulta ahora cuenta de
más, no de menos, que es la dirección barata.

---

## 2. `DEC-METH-008`, aplicada a mis tres arreglos

La regla pide dos cosas. Las contesto por escrito antes de los hallazgos, porque las dos produjeron
hallazgos que sin ellas no habría buscado.

### 2.1 El dominio que cada arreglo CREA

| arreglo | el dominio que crea | recorrido |
|---|---|---|
| **21** · la lápida | *«el compromiso cancelado se conserva»* crea **el conjunto de compromisos cancelables**, y ese conjunto **no es el mismo el día que se midió que el día del corte**: `DEC-MIG-002` le agrega una fila por alta | **la mitad nueva contiene `F-8cC2-001`** |
| **22** · se despublica y se la llama | *«se la llama»* crea **el conjunto de personas a llamar**, que es el de **dueños de ficha publicada**, no el de **filas de billing** sobre el que se midió el costo | `F-8cC2-010` |
| **23** · el orden | cuatro pasos crean **cuatro pasos × dos desenlaces = ocho estados del corte**. El documento escribe el desenlace bueno de los cuatro y el malo de **uno** (el paso 2, y sin salida — `F-8cB3-010`) | `F-8cC2-003`, `F-8cC2-004`, `F-8cC2-007` |

**El paso que más dominio crea es el 3**, y es el que menos texto tiene: una palabra. Desplegar no
es un acto (`F-8cC2-004`).

### 2.2 «¿Qué premisa de OTRO arreglo estoy volviendo falsa?»

`B3` §2 ya nombra cinco pares y los verifiqué contra el texto: los cinco se sostienen. **Agrego tres
que ninguno de los seis informes tiene**, y los tres cruzan la frontera entre el diseño y el repo,
que es donde vive mi vector:

| el arreglo | vuelve falsa la premisa de | cómo | hallazgo |
|---|---|---|---|
| **23** (el orden) | **`DEC-MIG-002`** (las altas se transcriben) | el paso 1 fija el sujeto en *«los tres»* medidos el 2026-09-15; `DEC-MIG-002` garantiza que ese conjunto crece y `DEC-MIG-003` borró el procedimiento que lo absorbía | `F-8cC2-001` |
| **23** (el orden) | **`DEC-MIG-003`** (*«nada de plata»*) | el corte es incondicional y la premisa *«no hay un solo pago histórico»* **caduca sola el 2026-09-26** | `F-8cC2-002` |
| **21 + 23** (la lápida y su paso 4) | **`DEC-ARCH-007`** (*«despliega una sola vez»*) | el paso 3 son tres despliegues manuales por app más tres carriles de migración; *«una sola vez»* describe la política de merge, no el acto | `F-8cC2-004` |

**Y una que va en la dirección inversa y es la más incómoda**: el arreglo 23 supone que el sistema
viejo es **una herramienta que todavía corre**. No lo es: es **un actor que reacciona**. El paso 1
le dispara al sistema vivo el correo de cancelación al cliente y la alerta al admin
(`F-8cC2-006`). Ningún arreglo de la 9-bis volvió falsa esa premisa porque **nadie la escribió**:
es una premisa sobre el repo, y el programa no tiene ningún documento que las declare.

---

## 3. Hallazgos

## CRITICA

### F-8cC2-001 — Cuatro documentos mandan transcribir la cohorte de altas nuevas, `DEC-MIG-003` borró el procedimiento que las transcribiría, y el paso 1 del corte cancela «los tres»: cada alta del rediseño cruza el despliegue con su preapproval vivo

**Qué se rompe.** Quien se suscriba entre hoy y el corte —que el programa decidió permitir, con
motivo escrito— llega a la noche del corte con una autorización de cobro viva **que no está en la
lista del paso 1, que nadie va a cancelar y para la que nadie va a escribir lápida**. Después del
despliegue esa autorización cobra contra un sistema que no la conoce: **la plata entra y no queda ni
servicio ni asiento**. Es, palabra por palabra, el modo de falla que el §4.1 del documento del corte
existe para evitar, sobre la única población que el programa **sabe** que va a crecer.

**El camino.**

1. **El corte fija su sujeto en tres, y los nombra como el conjunto completo.**
   `16-fase-7-del-paraguas.md` §4.2, paso 1: *«| 1 | **cancelar los tres preapprovals en el
   proveedor** | el sistema **viejo**, que todavía corre | es el único que sabe hacerlo; después del
   despliegue ese código no existe |»*. Y §4.1: *«Son **tres** las que pueden hacerlo —**las únicas
   con preapproval vivo**—»*.
2. **Ese «tres» es una medición del 2026-09-15**, no una propiedad del sistema. `V/21` §2.2: *«Las
   tres `trialing` son las **únicas** con preapproval vivo (medido: 3 de 3, y ninguna de las otras
   cinco)»*, sobre la medición de `07-facts-inventory.md`.
3. **`DEC-MIG-002` decide, el 2026-09-19, que el conjunto crece**: *«**Decisión**: **(1)**. Se
   siguen tomando altas en el sistema actual, y **se transcriben a mano cuando el rediseño esté
   listo**, con el mismo procedimiento del §2.3 que `DEC-MIG-001` fijó para las cinco relaciones
   vivas.»* Y su riesgo declarado: *«**la cohorte a transcribir crece mientras dure el rediseño.**
   Hoy son 5; cada alta nueva suma una.»*
4. **Cada alta nueva es un preapproval vivo**, no una fila inerte: es el mismo instrumento que las
   tres `trialing`, tomado por el mismo checkout del mismo sistema.
5. **`DEC-MIG-003`, el mismo día y 277 líneas más abajo en el mismo log, elimina el procedimiento
   que `DEC-MIG-002` acababa de invocar**: *«**se arranca de cero. El sistema nuevo no hereda una
   sola fila**»*, y *«La unidad de trabajo que iba a escribirla **no se crea**.»* El *«mismo
   procedimiento del §2.3»* al que `DEC-MIG-002` remite **deja de existir en ese párrafo**.
6. **`DEC-MIG-003` nombra a `DEC-MIG-002` una sola vez, y sólo para decir que la cartera crece**:
   *«⚠️ **Condición de caducidad**: `DEC-MIG-002` decidió **seguir tomando altas durante el
   rediseño**, así que la cartera crece. Con ocho filas *«no migrar»* son tres llamadas; **el umbral
   medido está en unas veinte**»*. Habla del **volumen** de la cohorte y **nunca de su destino**.
7. **Y los otros dos documentos que contestan la pregunta siguen dando la respuesta vieja.**
   `04-open-decisions.md`, `OD-MIG-01`: *«✅ **CERRADA por `DEC-MIG-002`** (2026-09-19): se siguen
   tomando altas en el sistema actual y **se transcriben a mano al terminar**, como las cinco de
   `DEC-MIG-001`»*. Y `B/21` §3.3 sigue declarando la pregunta **abierta**: *«**No se completa en
   silencio** (§67). Queda declarada como decisión del owner en `04-open-decisions.md` — la única
   que este capítulo abre en vez de cerrar.»*
8. **Resultado: la misma pregunta tiene cuatro respuestas.** *«Se transcriben»* (`DEC-MIG-002`,
   `OD-MIG-01`), *«está abierta»* (`B/21` §3.3), *«no se hereda ninguna fila y la unidad no se
   crea»* (`DEC-MIG-003`), y *«se cancelan los tres»* (el corte). **Ninguna de las cuatro dice quién
   cancela el preapproval de la alta número nueve.**
9. **El desenlace lo escribe el propio documento del corte**, §4.1: *«**Una autorización viva cobra
   DESPUÉS del despliegue que borró el código capaz de reconocerla.** La persona paga, el dinero
   entra, y del lado de Hospeda **no queda ni servicio ni asiento contable**»*. Y §4.2 cierra la
   puerta de atrás: *«el código que sabe cancelar esos preapprovals **se va con el despliegue**.
   Cancelarlos después exige hacerlo a mano contra la API del proveedor, sin idempotencia, sin
   registro y sin nadie que verifique»*.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §4.1 y §4.2, tabla de cuatro pasos.
- `HOS-1352/docs/01-decision-log.md`, `DEC-MIG-002` («Decisión», «El riesgo, declarado»,
  implicación 2) y `DEC-MIG-003` («Decisión», «Qué deja sin objeto», «Condición de caducidad»).
- `HOS-1352/docs/04-open-decisions.md`, fila `OD-MIG-01`.
- `HOS-1354/docs/21-migracion.md` §3.3.

**Severidad.** `CRITICA` — un cobro real que entra sin asiento contable, sobre una población que el
programa decidió hacer crecer a propósito y que ningún documento cuenta antes del corte. Es el
criterio *«alguien paga de más»* en su forma más limpia: paga y no recibe, y no hay dónde anotarlo.
**No duplica a `F-8cB3-016`**, que es sobre las **tres `abandoned` existentes** con `EX-1` en
`UNKNOWN`; éste es sobre filas que **todavía no existen** y que una decisión del owner garantiza que
van a existir.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23**, cruzado con `DEC-MIG-002`. El arreglo 23
recorrió el dominio del **problema** —*«un cobro cae en el vacío»*— y para fijar su sujeto copió el
conteo de la medición que tenía a mano. El dominio que el arreglo **crea** es *«los preapprovals
vivos la noche del corte»*, y ése lo define `DEC-MIG-002`, no `07-facts-inventory.md`. Es la
obligación 1 de `DEC-METH-008` sin hacer, sobre el arreglo que el propio `DEC-METH-008` señala como
el más caro de equivocar.

---

### F-8cC2-002 — El corte no tiene ningún paso para un período ya pagado, y el primer cobro de la historia del sistema es dentro de seis días

**Qué se rompe.** El corte cancela una suscripción **a mitad de su período pagado**. La persona pagó
el mes, el corte le apaga el servicio, el sistema nuevo no hereda nada y lo único que se escribe es
una lápida en `CANCELLED`: **no hay `payment`, no hay `receipt`, no hay crédito y no hay camino de
reembolso declarado.** Pagó un mes y recibió los días que van hasta el corte, y el sistema nuevo no
tiene ninguna fila que diga que eso pasó.

**El camino.**

1. **El corte es incondicional y no menciona pagos.** `16-fase-7-del-paraguas.md` §4.2 tiene cuatro
   pasos —*«cancelar los tres preapprovals»*, *«verificar releyendo»*, *«desplegar»*, *«sembrar las
   lápidas»*— y **ninguno pregunta si alguno ya cobró**. Su §4.1 declara el sujeto sin condición:
   *«Son tres las que pueden hacerlo —las únicas con preapproval vivo—, y el hecho de que sean pocas
   no cambia nada»*.
2. **El corte se ejecuta al final de la FASE 10**, que es lo que el paso 3 despliega
   (`DEC-ARCH-007` implicación 3 y `11-particion-del-programa.md` §6: lo que llega a `staging` es el
   paraguas). O sea: **meses después de hoy**.
3. **El primer cobro de la historia del sistema es el 2026-09-26** — hoy es el 2026-09-20. `B/21`
   §3.1 tiene las tres fechas: *«| 1 | **2026-09-26** | 2 | 2026-11-25 | 3 | 2026-11-30 |»*. Las
   tres son **anteriores** a cualquier fecha plausible del corte, y las tres son **mensuales**
   (`DEC-MIG-002`: *«suscripciones vivas | **8**, todas mensuales»*), así que para el corte la
   primera habrá cobrado varias veces.
4. **Todo el argumento de `DEC-MIG-003` descansa en que eso todavía no pasó**: *«**Qué se pierde,
   medido**: **nada de plata** —no hay **un solo pago histórico**, ningún comprobante, ninguna serie
   que reconstruir—»*.
5. **Y el programa tiene escrito, con nombre, que ése es el umbral que manda** — no el de las veinte
   filas. `15-fase-9/06-R5-resuelto.md` §7.1: *«**El umbral real no es cuántas filas hay: es si
   alguna ya cobró.** Con cero pagos, migrar es escribir títulos y volver a pedir un consentimiento.
   Con un pago, migrar pasa a incluir **una serie de comprobantes sin huecos**, que es lo único de
   todo el modelo que **no se puede reconstruir después ni escribir a mano sin romper su propia
   restricción**.»* Y precisa qué aparece: *«el dominio pasa a **ocho**: aparece `payment` … y
   aparece `receipt`, con **`UNIQUE(numero)`, sin huecos** (`B/02` §2.3). Y **ninguna de las ocho
   reglas de este documento describe qué se hace con ellos.**»*
6. **La única re-verificación agendada está del lado equivocado del acto que protege.** `B/21` §1.3:
   *«Se re-verifica **antes de implementar nada de FASE 10**, con la consulta que el inventario deja
   escrita.»* El corte es **el final** de la FASE 10. La medición que decidiría si el corte es
   seguro se agenda para meses antes de que el corte ocurra, y el checklist del corte no tiene un
   paso 0 que la repita.
7. **Y la lápida no cubre esto.** Su razón declarada es otra: *«hace **reconocible** un cobro viejo
   que llegue tarde»* (`16-fase-7…` §4.2) — reconocible, no asentado. Una `subscription` en
   `CANCELLED` con su `provider_link` no es un comprobante ni un crédito, y `B/21` §2.5 no le asigna
   ninguno.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §4.1 y §4.2.
- `HOS-1354/docs/21-migracion.md` §1.3 y §3.1.
- `HOS-1352/docs/01-decision-log.md`, `DEC-MIG-003`, *«Qué se pierde, medido»*.
- `HOS-1352/docs/15-fase-9/06-R5-resuelto.md` §7.1, *«Umbral 2 — el primer cobro, y es el que
  manda»*.

**Severidad.** `CRITICA` — alguien paga un período y recibe una fracción, sin crédito, sin
comprobante y sin fila que lo registre; y el documento que define lo que se pierde dice
explícitamente que la serie de comprobantes **no se puede reconstruir después**. Ese es el criterio
*«un dato se pierde sin vuelta»* además del de plata.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23**, apoyado en una premisa de `DEC-MIG-003`
que caduca sola. La FASE 8-bis no podía encontrarlo: **el corte no existía como procedimiento**, y
un argumento de decisión que envejece no es lo mismo que un checklist que se va a ejecutar. El
arreglo 23 convirtió *«no se migra porque no hay plata»* en **una secuencia de actos irreversibles
que se ejecuta cuando ya la hay**, y no le puso la condición de re-medición que la propia decisión
que lo autoriza declara obligatoria.

---

## ALTA

### F-8cC2-003 — El corte no es idempotente: `PA-5` mide `400` al reintentar, así que la única salida del gate del paso 2 —volver a correr el paso 1— no se puede ejecutar

**Qué se rompe.** El gate se cierra con *«el corte no avanza»*. Lo que nadie escribió es que **el
corte tampoco se puede volver a intentar**: reintentar el paso 1 falla con `400` sobre los sujetos
que sí se cancelaron, así que la segunda corrida del checklist **no distingue «ya estaba cancelado»
de «falló»** y su propio paso 2 no la puede dar por buena. El programa queda en un estado del que no
sale ni hacia adelante ni hacia atrás **ni repitiendo**.

**El camino.**

1. *«**El paso 2 es el gate**, y es lo único que vuelve segura la secuencia: si alguno de los tres
   **no se pudo cancelar**, el corte **no avanza**.»* (`16-fase-7-del-paraguas.md` §4.2).
2. El paso 1 es secuencial sobre tres sujetos, así que *«dos cancelados, uno no»* es alcanzable en
   cuanto uno falle. Eso es `F-8cB3-010`, y lo doy por dicho.
3. **Lo que sigue, y `F-8cB3-010` no cubre**: la salida obvia de un gate que cierra es **corregir la
   causa y volver a correr el paso 1**. Medido: `PA-5`, `VERIFIED`, 2026-09-15, sandbox —
   *«`PUT {status:"cancelled"}`. **Irreversible: reintentar da `400`**; sobre una autorizada,
   `400 "Invalid transition from cancelled to authorized"»*
   ([`06-mp-validation-matrix.md`](../06-mp-validation-matrix.md), fila`PA-5`).
4. Entonces la segunda corrida del paso 1 **devuelve `400` en dos de los tres sujetos por haber
   funcionado**, y `400` en el tercero si sigue fallando por la misma causa. **Los dos desenlaces
   tienen la misma firma.**
5. **Y el paso 2 no la desambigua por sí solo, tal como está escrito**: dice *«verificar releyendo
   cada uno por su id y confirmar que quedó `cancelled`»*. Releer **sí** distingue —ése es
   exactamente el principio del programa, *«verificar releyendo en vez de creerle al código de
   estado»*—, pero el checklist **no declara que el paso 1 sea saltéable para un id ya
   `cancelled`**, y su columna *«por qué en ese lugar»* razona sobre una única ejecución. Un
   operador que siga el texto vuelve a llamar los tres.
6. **La ventana en la que ese reintento ocurre no es inocua**: entre el paso 1 fallido y el reintento
   el sistema viejo sigue corriendo y los dos clientes cancelados ya están sin servicio
   (`F-8cC2-007`).

**Dónde lo permite el diseño.** `16-fase-7-del-paraguas.md` §4.2 (pasos 1 y 2, y el párrafo del
gate) contra `06-mp-validation-matrix.md`, `PA-5` `VERIFIED`.

**Severidad.** `ALTA`. No cobra de más por sí solo. **No lo marco `CRITICA` a propósito**: el daño
en plata de ese estado es el de `F-8cC2-001`/`F-8cB3-010` y ya está contado, y las tres personas son
conocidas. Lo que agrego es que **la recuperación declarada del gate no existe**, que es la
diferencia entre un procedimiento que falla y uno que se traba.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23.** El gate lo escribió él, y escribió **una**
de sus dos salidas. `F-8cB3-010` mide que la salida hacia atrás no existe; esto mide que **la salida
hacia el costado —reintentar— tampoco**, y ésa era la que parecía obvia. Es el mismo defecto de
dominio: el arreglo recorrió la corrida buena y ninguna de las otras.

---

### F-8cC2-004 — El paso 3 no es un acto: son tres despliegues manuales por app, tres carriles de migración y una siembra de catálogo que el contrato exige y el checklist no nombra

**Qué se rompe.** El único procedimiento paso a paso de la noche irreversible del programa trata
*«desplegar»* como un instante entre el gate y la escritura. En este repo **no lo es**: son tres
aplicaciones que se despliegan **a mano y por separado**, tres carriles de migración con orden
propio, y una siembra de catálogo **sin la cual el contrato de cobertura declara que una fuente no
se puede expresar**. Cada una de esas piezas es un lugar donde el corte puede quedar a mitad de
camino, y ninguna tiene paso, orden ni verificación.

**El camino.**

1. El checklist: *«| 3 | **desplegar** | — | recién acá, y sólo si el paso 2 cerró |»*
   (`16-fase-7-del-paraguas.md` §4.2). Una palabra, sin sujeto y sin verificación — en un documento
   cuyo único principio de seguridad declarado es *«verificar releyendo»*.
2. **Desplegar son tres actos manuales.** `CLAUDE.md` del repo, línea 105: *«Production deploys are
   triggered manually from the Coolify dashboard … per app — auto-deploy on push is disabled by
   policy»*, y línea 880 nombra las tres: `hospeda-api-prod`, `hospeda-web-prod`,
   `hospeda-admin-prod`. Entre el primero y el tercero **conviven un front viejo y una API nueva**,
   o al revés, según el orden que nadie declaró.
3. **Y hay migraciones, con orden propio.** `CLAUDE.md` línea 944: *«Run order on a live env:
   `db:migrate` → `db:apply-extras` → `db:seed:migrate`»*, con la advertencia de que **ese orden
   satisface una sola dirección**. El corte despliega un esquema nuevo entero; el checklist no
   nombra ninguno de los tres comandos.
4. **La siembra del catálogo no es opcional y no está en el checklist.** El contrato la declara
   obligatoria: *«**Lo único que se siembra son las versiones de plan del catálogo**: una vendible
   para que el trial tenga de dónde derivar …, y las dos no vendibles que sí guardan lo suyo — **la
   de pre-trial y la de piso**»* (`12-contrato-de-cobertura.md` §5.1). Y sin la de piso, la fuente
   `BASE` **no se puede escribir**: *«Transporta la referencia a la **versión de piso** de esa
   vertical»* (§2.5) y *«**Una fuente sin referencia resoluble no se puede expresar**»* (§2.3). Una
   plataforma desplegada sin esa siembra deja a **todo usuario autenticado** sin la única fuente que
   el §2.5 existe para darle.
5. **Y por eso la frase del checklist es falsa**: *«**El paso 4 es la única escritura del corte, y es
   a mano.**»* (`16-fase-7-del-paraguas.md` §4.2). Las escrituras del corte son, como mínimo: el
   catálogo de planes con sus tres versiones por vertical (§5.1 del contrato), los dos
   `permanent_grant` de las cortesías —una fila **por vertical de su scope**, `B/21` §2.4— y las
   lápidas. `F-8cA3-013` cuenta las dos primeras clases y `F-8cA3-017` mide que el párrafo tiene un
   *«las dos»* sin antecedente; **lo que agrego es la tercera, que es la que el contrato declara
   condición de que el modelo se pueda expresar.**
6. **Ninguna de esas escrituras tiene carril declarado**, y el repo tiene tres con reglas distintas
   y un guard fail-closed que las vigila (`scripts/check-seed-dual-write.sh`, `CLAUDE.md` §«Seed
   dual-write rule»). El catálogo de planes es exactamente su sujeto: *«a billing
   plan/limit/entitlement»*.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §4.2, paso 3 y el párrafo *«El paso 4 es la única
  escritura del corte»*.
- `HOS-1352/docs/12-contrato-de-cobertura.md` §5.1, §2.5 y §2.3.
- `HOS-1354/docs/21-migracion.md` §2.4 (los dos `permanent_grant`, una fila por vertical).
- Medición propia sobre `CLAUDE.md` de la rama, líneas 105, 880 y 944; `ls apps` → 5 directorios, 3
  de ellos desplegados en producción según la línea 880.

**Severidad.** `ALTA` — no mueve plata por sí solo, pero es el paso que separa los dos actos
irreversibles del programa y está escrito con una palabra. La dirección del error es la peor: el
checklist **afirma** ser exhaustivo (*«la única escritura»*) sobre un paso que oculta tres clases de
escritura y seis actos manuales.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23.** Antes de la 9-bis no había checklist, así
que *«desplegar»* no era una afirmación sobre nada. El arreglo lo convirtió en un paso con una
posición declarada y una garantía declarada (*«la única escritura»*), y **las dos son verificables y
las dos fallan**. Es la obligación 1 de `DEC-METH-008`: el dominio que el arreglo crea son los
estados intermedios del paso 3, y no se recorrió ninguno.

---

### F-8cC2-005 — La rama del paraguas borra los tres documentos del único gate manual obligatorio que el repo le impone al billing, y el `CLAUDE.md` de la misma rama sigue apuntándolos

**Qué se rompe.** El repo tiene una regla que declara **no negociable**: ningún PR que toque billing
se mergea sin ejecutar un smoke manual contra una checklist concreta, y ningún cambio del **billing
CORE** llega a producción sin la checklist de prod. **La rama de este programa ya borró las tres
checklists**, en un commit que está en su historia desde antes de esta pasada, y **el archivo que
impone la regla —en la misma rama— sigue apuntando a los tres archivos borrados**. El día que el
paraguas mergee, el gate de liberación del billing queda enunciado y sin instrumento.

**El camino, todo medido el 2026-09-20 sobre el worktree.**

1. **La regla, en la rama.** `CLAUDE.md` §«Billing testing — manual smoke checklist required»:
   *«Any PR that touches the billing surface (checkout, webhooks, cron, refund, admin billing ops,
   entitlements) MUST have the relevant manual staging smoke executed before merging to `staging`»*,
   y su paso 5: *«For PRs that change the **billing CORE** …, the prod smoke … MUST be executed too
   — **that's the production go-live gate**»* (línea 562). El programa reemplaza el billing CORE
   entero.
2. **Los tres documentos que la regla nombra existen en `origin/staging`**:
   `git ls-tree -r --name-only origin/staging | rg SPEC-143-billing-testing-coverage` → **14
   archivos**, entre ellos `staging-smoke-checklist.md`, `prod-smoke-checklist.md` y
   `mp-test-cards-reference.md`.
3. **Y no existen en esta rama.** `ls .qtm/specs/` lista once entradas y
   `SPEC-143-billing-testing-coverage` **no está entre ellas**. El commit que los borró es
   **`471a54b7a` — *«docs(spec): borrar todo el material de billing previo al PDR»***, que elimina
   **95 archivos**, 13 de ellos bajo `.qtm/specs/SPEC-143-billing-testing-coverage`, incluidos
   `staging-smoke-checklist.md`, `prod-smoke-checklist.md` y `mp-test-cards-reference.md`
   (verificado con `git show --name-status 471a54b7a | rg '^D'`).
4. **El `CLAUDE.md` de esta misma rama sigue apuntando ahí**: `rg -c "SPEC-143-billing-testing-coverage" CLAUDE.md` → **3**, en las líneas 558, 559 y 562 — los tres pasos operativos de la regla.
5. **El nivel de prod, además, es insatisfacible por construcción para este programa.** La regla lo
   ubica *«after merge to staging, **before promoting to `main`**»* (línea 580). El smoke de prod se
   corre **contra producción**, y hasta la promoción producción corre el sistema **viejo**: no hay
   forma de smokear el checkout nuevo antes de desplegarlo. Para un cambio incremental el gate tiene
   sentido; para un reemplazo del motor **pide observar en producción algo que sólo existe después
   de la promoción**.
6. **Y el programa no lo nombra en ninguna parte.** Medido: *«smoke»* aparece **0 veces** en
   `16-fase-7-del-paraguas.md`, **0** en los dos `spec.md` y los dos `descomposicion.md`, **1** en
   `V/20` y **2** en `B/20` (y las tres son sobre E2E y el smoke contra el proveedor, no sobre el
   gate del repo). En el decision log aparece **2 veces**, las dos dentro de `DEC-CI-001` y sólo
   para excluir `smoke-gate-sync.yml` de `epic/**`.

**Dónde lo permite el diseño.**

- `CLAUDE.md` de la rama, §«Billing testing — manual smoke checklist required» (pasos 1, 2 y 5) y
  §«Smoke-gate labels for any spec» (el tier de prod).
- `HOS-1352/docs/16-fase-7-del-paraguas.md` — el §1 declara los diez ítems del §65 y el reparto; el
  gate de aceptación no aparece.
- Medición propia: `git show --name-status 471a54b7a`, `git ls-tree -r origin/staging`,
  `rg -c "SPEC-143-billing-testing-coverage" CLAUDE.md`, `rg -cin smoke` sobre los tres cuerpos de
  diseño.

**Severidad.** `ALTA` — no mueve plata por sí solo; **desarma la última defensa manual antes de
producción del subsistema que mueve toda la plata**, y lo hace por un borrado ya commiteado que
nadie va a notar hasta el PR final, que es justamente el que *«nadie puede revisar de verdad»*
(`DEC-ARCH-007`).

**¿Es nuevo, o es el arreglo?** **Nuevo, y no es un arreglo de la 9-bis: es el programa.** El commit
`471a54b7a` es trabajo de limpieza del propio programa —el §55 mandando eliminar el material
previo—, y es correcto en su intención. Lo que no se hizo es la otra mitad del §55: *«Eliminar de
fuentes activas: … **docs; specs**»* incluye las checklists **y el archivo que las cita**, y el
archivo que las cita es el que le impone la regla al repo entero. Lo anoto acá porque es el único
ítem de la lista de la FASE 7 —`acceptance gates`— que tiene un sujeto real, medible y ya roto.

---

### F-8cC2-006 — El paso 1 trata al sistema viejo como una herramienta y es un actor: cancelar dispara el correo de cancelación al cliente, la alerta al admin y dos reconciliadores que escriben visibilidad de fichas

**Qué se rompe.** El aviso a las tres personas se planificó como una conversación humana que va
**antes** del paso 1. Medido en el código que va a estar corriendo ese día: en el instante en que el
operador cancela el preapproval, **el sistema vivo le manda al cliente su propio correo de
«suscripción cancelada»** —con la copia del sistema que estamos reemplazando—, **le dispara una
alerta de cancelación involuntaria al admin**, y corre **dos reconciliadores** que reescriben el
estado de visibilidad de las fichas de esa persona. El checklist no nombra ninguno de los cuatro
efectos, y su columna *«quién lo hace»* dice *«el sistema **viejo**, que todavía corre»* — como si
correr fuera una propiedad pasiva.

**El camino.**

1. El checklist: *«| 1 | **cancelar los tres preapprovals en el proveedor** | el sistema **viejo**,
   que todavía corre | **es el único que sabe hacerlo** …»*, y el quinto acto: *«**El aviso va ANTES
   del paso 1**, no después»* (`16-fase-7-del-paraguas.md` §4.2).
2. Cancelar en el proveedor produce un `preapproval.updated` que el sistema vivo procesa. Medido en
   `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`:
   - **correo al cliente** — `shouldSendCancelledEmail(previousStatus, newStatus)` (línea 228)
     devuelve `true` para todo `previousStatus` que no sea `CANCELLED`, `EXPIRED` ni
     `PENDING_PROVIDER`. Los tres sujetos del corte están en `trialing` (`V/21` §2.2), así que **los
     tres disparan**;
   - **alerta al admin** — `shouldSendAdminAlert` (línea 258), predicado idéntico, y su docblock la
     describe como *«an admin alert … for **involuntary** cancellation»*;
   - **dos reconciliadores** — línea 1426, `reconcileSubscriptionLinkedEntities({…, source:
     'mp-webhook'})`, y línea 1432, `reconcilePartnerForSubscription`.
3. El primero de esos dos reconciliadores no es un lector: **escribe**. Su docblock
   (`apps/api/src/services/subscription-linked-entities.service.ts`, líneas 70–101) enumera tres
   efectos, y los tres tocan publicación: *«update the listing link rows and **flip each linked
   listing's visibility**»*, *«**refresh** the `entity_subscriptions` cache rows of the
   subscription's owner»* y *«**bring back** the listings billing took down»*.
4. **Y el corte razona sobre esa ventana con una sola clase de tráfico**: *«**La ventana entre el
   paso 1 y el paso 3** es la parte incómoda, y se declara: durante ese rato el sistema viejo sigue
   corriendo con tres suscripciones canceladas. **Si entra un cobro en vuelo, lo registra el
   viejo**»* (§4.2). Lo que entra se declaró; **lo que sale, no**.
5. La consecuencia concreta sobre el quinto acto: el aviso humano va antes, y **el correo automático
   del sistema viejo llega después, contradiciéndolo o duplicándolo**, con el texto de un producto
   que ese mismo día deja de existir. Y `V/21` §2.4 apoya todo el arreglo 22 en que la conversación
   acote el daño: *«Lo que lo acota es que el aviso va **antes** del corte, no después.»*

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §4.2, paso 1, el párrafo de la ventana y el quinto acto.
- `HOS-1353/docs/21-migracion.md` §2.4, el párrafo del aviso.
- Medición propia sobre el worktree, `HEAD = 7281fbe6e`:
  `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` líneas 228, 258, 1426 y 1432;
  `apps/api/src/services/subscription-linked-entities.service.ts` líneas 70–101 y 104.

**Severidad.** `ALTA` — no mueve plata y no pierde datos. Lo que rompe es **la única parte del corte
que el diseño declara que sale bien**: la conversación con tres personas conocidas, que es la
premisa sobre la que `DEC-MIG-003` eligió no migrar. **No resuelvo si la ficha de cada uno además se
cae en ese momento**: eso depende de cómo el sistema actual gatea la visibilidad de un alojamiento
contra el caché de entitlements, y no lo medí. Lo que sí está medido es que **hay escrituras de
visibilidad en ese camino** y que el corte no las nombra.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23**, y es el caso más puro de premisa no
escrita. Ningún arreglo de la 9-bis la volvió falsa, porque **nadie la escribió**: el programa no
tiene un solo documento que declare qué hace el sistema actual cuando se lo toca. El arreglo 23 es
el primero que da una instrucción operativa **sobre el sistema vivo**, y la dio razonando sobre el
proveedor y no sobre Hospeda.

---

### F-8cC2-007 — Entre el paso 1 y el paso 3 los tres clientes quedan sin servicio y sin dónde contratar, y nada acota la duración de esa ventana

**Qué se rompe.** El corte le cancela la suscripción a tres clientes reales **antes** de desplegar el
sistema en el que van a re-contratar. Durante toda esa ventana no tienen ni lo viejo ni lo nuevo: el
compromiso está cancelado e **irreversiblemente** (`PA-5`), y el lugar donde volver a suscribirse
todavía no existe. El documento declara esa ventana *«la parte incómoda»* y razona sólo sobre lo que
**entra** en ella; no dice cuánto dura, quién decide que terminó, ni qué se le ofrece a alguien
mientras.

**El camino.**

1. El orden: *«| 1 | cancelar … | 3 | **desplegar** | — | recién acá, y sólo si el paso 2 cerró |»*
   (`16-fase-7-del-paraguas.md` §4.2).
2. Cancelar es irreversible: `PA-5` `VERIFIED` (`06-mp-validation-matrix.md`).
3. Los tres sujetos son *«clientes reales, **y contactables**»* (`V/21` §2.2), y el plan para ellos
   es *«se los llama, contratan, y la ficha vuelve sola por `PB3` cuando la cobertura vuelve»*
   (`V/21` §2.4). **Contratar exige que el sistema nuevo esté desplegado**, o sea el paso 3.
4. **La duración de la ventana no está acotada por nada.** El paso 2 puede tardar (`F-8cB3-010`), el
   paso 3 son seis actos manuales (`F-8cC2-004`), y el documento no le pone ni un techo ni una
   ventana horaria. Su única marca temporal es *«**la mañana del corte**»*, que describe el efecto
   sobre las fichas, no la duración del procedimiento.
5. **Y el argumento que acota el daño está escrito sobre la otra ventana.** `V/21` §2.4: *«la ficha
   de cada uno está abajo **desde el corte hasta que esa persona contrata**. Si alguno tarda una
   semana, estuvo una semana afuera. **Lo que lo acota es que el aviso va antes del corte**»*. El
   aviso acota **la ventana del cliente** —cuánto tarda en decidirse—; **no acota la ventana del
   operador**, que es la del paso 1 al paso 3 y en la que decidirse no sirve de nada.
6. **Y si el gate cierra, la ventana no termina nunca**: el corte *«no avanza»*, no se puede
   reintentar (`F-8cC2-003`) y no se puede volver (`PA-5`). Los dos clientes ya cancelados quedan en
   esa ventana **sin fecha de salida declarada**.

**Dónde lo permite el diseño.** `16-fase-7-del-paraguas.md` §4.2 (la tabla, el párrafo de la ventana
y el quinto acto) contra `V/21` §2.4 y `06-mp-validation-matrix.md` `PA-5`.

**Severidad.** `ALTA` — tres clientes reales sin servicio por un tiempo que nadie declaró, con su
autorización destruida sin vuelta y sin producto que comprar. No lo marco `CRITICA` porque **no
pagaron nunca** (`DEC-MIG-003`: cero pagos históricos, medido tres veces) — y esa atenuación
**caduca el 2026-09-26**, que es `F-8cC2-002`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23.** El orden *«cancelar antes de desplegar»* es
correcto y su argumento es bueno —el cobro en vuelo necesita un lugar donde anotarse—; lo que el
arreglo no recorrió es que ese mismo orden **crea una ventana de desabastecimiento** y que la
declaró *«incómoda»* midiéndola sólo por lo que puede entrar. El costo del orden elegido se enunció
por un lado y no por el otro.

---

### F-8cC2-008 — Ni el corte ni la lápida son ítem de trabajo de ninguna de las 22 unidades, y ninguno de los cuatro documentos que un implementador abre nombra el documento del corte

**Qué se rompe.** El procedimiento de la única noche irreversible del programa vive en un documento
que **nadie que vaya a construir el programa tiene motivo de abrir**. Las 22 unidades de trabajo no
contienen el corte, ni la lápida, ni la despublicación, ni la llamada; y las dos épicas que le
delegan trabajo a la FASE 7 lo hacen sin enlazarla.

**El camino, medido el 2026-09-20.**

1. **Cero referencias al documento del corte desde la implementación.** `rg -l "16-fase-7"` sobre
   `.specs/HOS-135*` devuelve **12 archivos**, y **ninguno** es `HOS-1353/spec.md`,
   `HOS-1354/spec.md`, `HOS-1353/descomposicion.md` ni `HOS-1354/descomposicion.md`. Los doce son el
   worklog, el handoff, el decision log, las instrucciones de las dos pasadas adversariales y seis
   informes de agentes.
2. **Los dos capítulos que le delegan trabajo tampoco lo enlazan.** `V/21`, «Lo que este capítulo NO
   cierra»: *«**Cómo se le avisa a las tres personas y cuándo se cancelan sus suscripciones es FASE
   7**»* — sin ruta. `B/21` §2.5: *«el **rollback del PROGRAMA** … no se escribe acá»* — sin ruta.
   Medido: *«FASE 7»* tiene **0 apariciones** en los cuatro documentos de implementación.
3. **«Lápida» tiene 0 apariciones** en los cuatro documentos de implementación
   (`rg -cin "lápida|lapida"` → sin resultados). La única fila que el sistema nuevo escribe el día
   del corte no es criterio de terminación de ninguna unidad.
4. **Y no hay superficie que la escriba** — eso es `F-8cB3-013`, y compone: el paso 4 es *«a mano»*
   y no hay unidad que construya la mano.
5. **El propio documento se declara sin dueño.** `16-fase-7-del-paraguas.md` §1 promete tres cosas:
   *«Lo que está escrito acá es **qué tiene que contestar, quién lo escribe y para cuándo**»*.
   **Ningún párrafo del archivo nombra a una persona, a un rol ni a una unidad de trabajo.** La
   columna *«quién lo hace»* de su §4.2 contesta *«el sistema viejo»* / *«el sistema nuevo»*, que es
   **qué**, no **quién**. Es `F-8bC2-006` intacto en esa mitad, y lo agrego acá porque ahora hay un
   procedimiento concreto de cuatro pasos que la necesita.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §1 y §4.2.
- `HOS-1353/docs/21-migracion.md`, «Lo que este capítulo NO cierra»; `HOS-1354/docs/21-migracion.md`
  §2.5.
- Medición propia: `rg -l "16-fase-7" .specs/HOS-135*`, `rg -cin "FASE 7|lápida|lapida"` sobre los
  dos `spec.md` y las dos `descomposicion.md`.

**Severidad.** `ALTA` — el corte es la operación de mayor riesgo del programa y **no está en el
inventario de trabajo**, así que el tablero que *«calcula solo cuáles están listas»*
(`descomposicion.md` §5) puede dar todas las unidades hechas con el corte sin construir ni ensayar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo a medias: el 21 y el 23.** `F-8bC2-006` reportaba que
el documento no tenía contenido; el arreglo 23 le puso contenido y **no lo propagó a ninguna unidad**
—que es exactamente el modo de falla que `F-8bC2-008` midió para `DEC-METH-007` (2 archivos de 8) y
que `D-30` §3 decidió aceptar difiriendo la propagación al final del ciclo (`F-8bC2-014`). La mitad
*«sin dueño»* es anterior y sigue entera.

---

### F-8cC2-009 — El único ítem huérfano que la FASE 7 declara resuelto es `staging`, y su §4 no menciona staging: el procedimiento irreversible no tiene dónde ensayarse

**Qué se rompe.** De los seis ítems que la FASE 7 del paraguas declara huérfanos, el documento marca
**uno como cubierto** y es `staging`. La sección que lo cubriría no nombra `staging` ni una sola
vez, ni ninguna forma de ensayo. El resultado es que el procedimiento de cuatro pasos irreversibles
**se ejecuta por primera vez en producción**, en un repo que tiene un entorno de staging cuyo uso es
obligatorio por convención para cambios mucho menores.

**El camino, medido el 2026-09-20.**

1. La tabla de huérfanos: *«| **staging** | **el §4**, en lo que hace al orden del corte |»*
   (`16-fase-7-del-paraguas.md` §1), y el cierre: *«**Cinco de los seis ítems huérfanos**, uno por
   uno — el sexto, `staging`, quedó escrito en el §4 en lo que hace al orden del corte»* (§5).
2. **La palabra `staging` aparece 3 veces en el archivo** —líneas 26, 39 y 150— y **ninguna de las
   tres está dentro del §4** (líneas 86 a 144): la 26 explica que la unidad que llega a `staging` es
   el paraguas, la 39 es la fila de la tabla y la 150 es la frase de cierre. **El §4 nunca la
   nombra.** El ítem se declara cubierto por una sección que no lo trata.
3. **Y no hay ensayo**: `rg -in "ensay|simulacro"` sobre el archivo → **cero**. El §4 describe una
   única ejecución, en producción, sobre tres clientes reales.
4. **Los otros cuatro siguen en cero, recontado hoy** sobre `docs/nucleo/`, `HOS-1353/docs/` y
   `HOS-1354/docs/`: `rollout` **0**, `coexistence` **0**, `feature flag` **0**, `acceptance gate`
   **0**, `rollback` **5** —las cinco en los dos capítulos 21, tres sobre la migración que `D-26`
   dejó sin sujeto y dos diciendo que el del programa vive en otra parte—. **Idéntico a la medición
   de la 8-bis**: la 9-bis no movió un solo conteo.
5. **Y la fecha límite que el propio documento se pone vence en tres días**: *«Se escribe ANTES de
   que nazca la rama»* (§2), y `D-28` pone el nacimiento el **2026-09-23**. Hoy es el **2026-09-20**.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §1 (tabla), §2, §4 y §5.
- `HOS-1352/docs/00-PDR.md` §65, FASE 7 — los diez ítems.
- Medición propia: `rg -n staging 16-fase-7-del-paraguas.md`, `rg -in "ensay|simulacro"` sobre el
  mismo archivo, y `rg -ci` de las cinco palabras sobre los tres cuerpos de diseño.

**Severidad.** `ALTA` — es el único ítem que el documento se acredita, y no lo cumple; y su
consecuencia concreta es que **el procedimiento irreversible no tiene ensayo declarado** en un
programa cuyo método entero se apoya en verificar antes de actuar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23.** El documento existía vacío (`F-8bC2-006`);
el arreglo 23 escribió el §4 y **con él la afirmación de que `staging` quedaba cubierto**. Escribir
el orden del corte de producción y acreditarlo como la estrategia de staging es un cruce de dos
cosas distintas que sólo se pudo hacer en el mismo acto de escribirlo.

---

## MEDIA

### F-8cC2-010 — El arreglo 22 cambió el conjunto de personas a llamar y reusa el argumento de costo de `DEC-MIG-003`, que se midió sobre otro conjunto

**Qué se rompe.** *«No migrar»* es barato porque son **tres llamadas y dos cuentas propias**. El
arreglo 22 agrega un segundo motivo para llamar —*«se despublica y se la llama»*— cuyo sujeto es
**el dueño de cada ficha publicada de Alojamiento**, que no es el mismo conjunto que las ocho filas
de billing, y lo apoya en el mismo argumento de costo sin volver a medirlo.

**El camino.**

1. El costo medido de `DEC-MIG-003`: *«| **no migrar** | **tres llamadas** y dos cuentas propias |»*
   (`V/21` §2.3). El sujeto son **las ocho filas de billing**: 2 `comp` del owner, 3 `abandoned`, 3
   `trialing`.
2. El arreglo 22 introduce el otro sujeto: *«**las fichas publicadas de Alojamiento se despublican
   la mañana del corte**»* y *«Se les avisa **antes** del corte, **se los llama**, contratan, y la
   ficha vuelve sola»* (`V/21` §2.4). Quien queda afuera es **el dueño de una ficha publicada**.
3. **Y reusa el argumento anterior como si el conjunto fuera el mismo**: *«A esta gente **hay que
   llamarla igual** —es lo que decide todo este capítulo: son pocos, la mayoría **no pagó nunca**, y
   el owner **los conoce a todos**—»* (`V/21` §2.4). *«Lo que decide todo este capítulo»* se decidió
   sobre las ocho filas de billing; *«esta gente»* son los dueños de fichas.
4. **Los dos conjuntos no coinciden y su intersección no está medida.** Lo medido es **22 usuarios y
   12 alojamientos** (`07-facts-inventory.md`, «Contenido y usuarios», 2026-09-15). De las ocho
   filas de billing, **tres** son `trialing` de alojamiento (`V/21` §2.2); de los otros cinco
   sujetos, dos son cuentas del owner y tres abandonaron el checkout. **Nada mide cuántos dueños de
   ficha publicada no están entre los ocho**, y un alojamiento publicado no exige una fila de
   billing viva para estarlo — la despublicación del arreglo 22 se dispara por ausencia de
   cobertura, o sea sobre **todos**, no sobre los ocho.
5. La consecuencia es sobre la **elección**, no sobre la ejecución: si la lista de llamadas es
   mayor que tres, el término que hacía desproporcionada la alternativa —*«desproporcionado frente a
   **un mensaje**»*, `DEC-MIG-003`— se calculó con el número chico.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/21-migracion.md` §2.2, §2.3 y §2.4.
- `HOS-1352/docs/01-decision-log.md`, `DEC-MIG-003`, *«El argumento, y no es de pereza»*.
- `HOS-1352/docs/07-facts-inventory.md`, «Contenido y usuarios».

**Severidad.** `MEDIA`. No rompe nada ejecutando, y la atenuación es real y está escrita: *«el owner
los conoce a todos»*. Lo que queda mal es que **la decisión más cara del capítulo se apoya en un
conteo de un conjunto y se aplica a otro**. **No duplica a `F-8cA3-015`** —que ataca el **tamaño**
del efecto (*«si son cero, el arreglo 22 se queda sin sus dos razones»*)— ni a `F-8cB3-021` —que
ataca **cuándo** se cuenta—: acá el defecto es **cuál es el conjunto**, y se sostiene aunque el
número resulte grande.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 22.** Es el primero que razona sobre fichas
publicadas, y al hacerlo heredó el argumento de costo de una decisión cuyo sujeto eran suscripciones.
Es la obligación 1 de `DEC-METH-008`: el arreglo cambió el dominio del predicado *«hay que llamarlos
igual»* y verificó el dominio viejo.

---

### F-8cC2-011 — El umbral que decide si «no migrar» sigue siendo viable se compara contra un conteo que cuatro documentos dan como 5 y como 8, el mismo día

**Qué se rompe.** La condición de caducidad de la decisión más grande de la migración es un umbral
numérico —*«unas veinte»*— y el número contra el que se compara **no es uno**. Quien vaya a evaluar
si la decisión caducó lee 5 en dos documentos y 8 en otros dos, todos del 2026-09-19, y la distancia
al umbral cambia según cuál abra.

**El camino, medido el 2026-09-20.**

1. El umbral: *«Con **ocho** filas *«no migrar»* son tres llamadas; **el umbral medido está en unas
   veinte**, y arriba de eso deja de ser viable»* — `DEC-MIG-003`, «Condición de caducidad», y
   `V/21` §2.5 con las mismas palabras.
2. **`DEC-MIG-002`, mismo día, mismo log**: *«la cohorte a transcribir crece mientras dure el
   rediseño. **Hoy son 5**; cada alta nueva suma una.»*
3. **`04-open-decisions.md`, «Para revisar más adelante»**: *«Es barata porque son pocas —**hoy la
   cohorte a transcribir son 5**— y cada alta nueva suma una.»*
4. Los dos números son correctos y miden cosas distintas —8 son las filas vivas, 5 las que
   `DEC-MIG-001` consideraba «a transcribir»—, y **ninguno de los cuatro documentos dice cuál de los
   dos se compara contra el veinte.** Con `DEC-MIG-003` la distinción además perdió sentido: no se
   transcribe ninguna, así que *«la cohorte a transcribir»* es hoy un conjunto vacío por definición
   y el número 5 describe algo que ya no existe.
5. Y el umbral que de verdad manda no es ninguno de los dos: es *«**si alguna ya cobró**»*
   (`15-fase-9/06-R5-resuelto.md` §7.1), que es `F-8cC2-002`.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/01-decision-log.md`, `DEC-MIG-002` («El riesgo, declarado») y `DEC-MIG-003`
  («Condición de caducidad»).
- `HOS-1352/docs/04-open-decisions.md`, § «Para revisar más adelante», fila `DEC-MIG-002`.
- `HOS-1353/docs/21-migracion.md` §2.5.

**Severidad.** `MEDIA`. No falla ejecutando; deja sin sujeto contable a la única condición de
caducidad que el programa le puso a la decisión de no migrar, que es la misma clase de defecto que
`F-8cA3-014` mide para el conteo de la dirección inversa.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-MIG-003`.** Los dos conteos convivían sin
problema mientras describían dos cosas distintas; `DEC-MIG-003` vació el conjunto que el 5 medía y
puso el umbral en el mismo párrafo donde cita a `DEC-MIG-002`, sin reconciliarlos.

---

### F-8cC2-012 — El rollback del programa tiene una respuesta parcial ya escrita en el repo, y ubica el punto de no retorno adentro del paso 3 y no entre el 2 y el 3

**Qué se rompe.** El §3 de la FASE 7 acepta de antemano que *«la conclusión honesta»* puede ser que
no hay vuelta atrás, y el §4.3 declara **dónde** está el punto de no retorno: *«entre el paso 2 y el
paso 3»*. El repo ya contesta una parte de esa pregunta, con una frase que ningún documento del
programa cita, y su respuesta mueve la frontera: **el paso 3 la cruza por dentro**, antes de que las
aplicaciones cambien.

**El camino, medido el 2026-09-20.**

1. `16-fase-7-del-paraguas.md` §4.3: *«Lo que este § agrega es que **el punto de no retorno ahora
   tiene una ubicación declarada: está entre el paso 2 y el paso 3.**»*
2. **El repo declara que la mitad de base del paso 3 es irreversible por construcción**:
   `packages/db/CLAUDE.md`, línea 726 — *«**Migrations are forward-only - no rollback support**»*. Y
   el orden en un entorno vivo es `db:migrate` → `db:apply-extras` → `db:seed:migrate`
   (`CLAUDE.md` línea 944), o sea que la migración corre **antes** de que las aplicaciones sirvan
   código nuevo.
3. Entonces el paso 3 tiene un interior con dos mitades de reversibilidad opuesta: **los tres
   despliegues de Coolify se pueden revertir** —el mecanismo es el mismo botón, y el propio repo
   documenta que durante un rollout conviven dos versiones—, y **el esquema no**. Decir que el punto
   de no retorno está *«entre el paso 2 y el paso 3»* es correcto sólo si el paso 3 es atómico, y no
   lo es (`F-8cC2-004`).
4. **Y el programa nunca cita esa frase.** `rollback` tiene **5 apariciones** en los tres cuerpos de
   diseño, las cinco en los dos capítulos 21 y ninguna sobre el mecanismo del repo. El §3, que es el
   lugar donde esa respuesta iría, dice: *«**la palabra «rollback» sin aparecer en un solo documento
   de diseño del programa**»* — una frase que ya era falsa cuando se escribió (son 5) y que sigue
   siendo cierta en lo que importa: **ninguna de las cinco habla del rollback del programa**.
5. Lo que esto **no** dice es que el rollback sea imposible: dice que **una parte de la respuesta ya
   está medida y escrita en el repo**, y que el documento que tiene que producirla la ignora. La
   salvedad del §3 —*«saber dónde está el punto de no retorno y decidir con eso a la vista es mucho
   mejor que descubrirlo cruzándolo»*— se cumple peor de lo que el propio documento cree.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/16-fase-7-del-paraguas.md` §3 y §4.3.
- Medición propia: `packages/db/CLAUDE.md` línea 726; `CLAUDE.md` línea 944; `rg -ci rollback` sobre
  `docs/nucleo/`, `HOS-1353/docs/` y `HOS-1354/docs/` → 5, todas en los dos capítulos 21.

**Severidad.** `MEDIA` — no rompe nada ejecutando, y se cierra con un párrafo en el documento que ya
existe. Lo anoto porque es el único de los seis ítems huérfanos que tiene **material medido
disponible y sin usar**, y porque la ubicación declarada del punto de no retorno es el entregable
que el §4.3 se acredita.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 23.** El §4.3 es suyo, y la ubicación declarada
es su aporte. Antes de la 9-bis no había ninguna ubicación que pudiera estar mal.

---

## 4. Los 16 hallazgos de la 8-bis, reejecutados sobre el texto y el repo de hoy

**No son hallazgos de esta pasada.** Cada camino se volvió a correr paso por paso.

| id | veredicto | dónde corta, o por qué sigue llegando |
|---|---|---|
| `F-8bC2-001` · toda la cartera amanece en `PRE_TRIAL` y cubierta | **CORTA a medias** | **el paso 3 corta**: el arreglo 1 saca del `TÍTULO` a toda fuente con `hasta = SIN_EMPEZAR`, así que `PRE_TRIAL` **no cubre** (`12-contrato…` §2.4). El desenlace *«todos gratis para siempre»* se cerró. **La rama B empeoró y es de A/B**: `PB2` se dispara por el **cambio** de `cubierto` y no hay cambio, así que ahora **no se despublica nada** — `F-8cA1-003`, `F-8cA2-001`, `F-8cA3-003`, `F-8cB3-009` |
| `F-8bC2-002` · nadie declara el orden entre cancelar y desplegar | **CORTA** | el arreglo 23 lo declaró, con verificación y gate. Lo que sigue son **defectos del orden nuevo**, no del hueco: `F-8cC2-001` a `F-8cC2-004`, `F-8cC2-007`, `F-8cB3-003`, `F-8cB3-010` |
| `F-8bC2-003` · el ciclo mide un stock y su generador es arreglar | **SIGUE, y ahora está medido dos veces** | §1.2: **24 de 24**. `DEC-METH-008` se escribió para esto y produjo hallazgos de FASE 8, no cierres de FASE 9 |
| `F-8bC2-004` · los informes no se cuentan con una consulta | **CORTA** | medido: `**Severidad.**` matchea **94 de 94**. Queda la salvedad de que cuenta 94 sobre 92 (las dos reejecuciones de `B1`) |
| `F-8bC2-005` · tres fechas del programa no pueden ser las tres ciertas | **SIGUE, agravado** | el 2026-09-23 está a **3 días**; la FASE 7 tiene 1 de 6 ítems; el ciclo abrió **24 críticos**. Ninguna de las tres decisiones nombra a las otras dos |
| `F-8bC2-006` · la FASE 7 no nombra a nadie y sus ítems siguen en cero | **SIGUE** | recontado hoy: `rollout` 0 · `coexistence` 0 · `feature flag` 0 · `acceptance gate` 0 · `rollback` 5 — **idéntico a la 8-bis**. El §4 agregó contenido a un ítem y **ningún párrafo del archivo nombra a una persona, un rol ni una unidad**. `F-8cC2-008`, `F-8cC2-009` |
| `F-8bC2-007` · `DEC-CI-001` sin aplicar y contradictoria | **SIGUE entero** | medido hoy: `rg -c epic .github/workflows/*.yml` → **0 archivos** de **15**; `git show origin/staging:CLAUDE.md \| rg -c epic` → **0**; `git ls-remote --heads origin 'epic/*'` → **0**. La contradicción sobre `e2e-pr.yml` sigue |
| `F-8bC2-008` · el gate de FASE 5 se abrió y no se propagó; `V1` sin dueño | **SIGUE entero** | `DEC-METH-007` sigue en **2 archivos** fuera de los informes (decision log y handoff). `commerce`: **1.390 archivos / 16.721 ocurrencias** en `apps packages scripts`, **el mismo número que en la 8-bis** |
| `F-8bC2-009` · el filtro 1 no es decidible del lado billing | **SIGUE** | ningún cambio de la 9-bis toca `DEC-METH-007` ni el inventario de guards |
| `F-8bC2-010` · si la pasarela cambia se rehacen 9 de 13 criterios | **SIGUE** | `DEC-ARCH-004` y `B/descomposicion` §2.3/§4 sin tocar |
| `F-8bC2-011` · `D-28` alarga el paraguas y `DEC-MIG-003` se apoya en que sea corto | **SIGUE, y ahora con un mecanismo** | la 8-bis lo reportaba como multiplicador; esta pasada lo instancia: el destino de la cohorte nueva **no existe** (`F-8cC2-001`) y el umbral que manda vence en 6 días (`F-8cC2-002`) |
| `F-8bC2-012` · la rama del paraguas no tiene punto de corte declarado | **SIGUE, ensanchado** | medido hoy: `git rev-list --left-right --count origin/staging...HEAD` → **`0  348`** (eran 330), y `git ls-tree -r origin/staging .specs/ \| rg HOS-135[234]` → **0**. Sigue sin decir de dónde se corta |
| `F-8bC2-013` · el guard de seed no da veredicto sobre el paraguas | **SIGUE** | `scripts/resolve-ci-baseline.sh` y `ci.yml` sin cambios; y el catálogo de planes del paso 3 es exactamente su sujeto (`F-8cC2-004`) |
| `F-8bC2-014` · la propagación se difirió al final del ciclo | **SIGUE, agravado** | con 24 críticos hay al menos una vuelta más. `F-8cC2-008` mide una instancia concreta: el corte no llegó a ninguna de las 22 unidades |
| `F-8bC2-015` · el handoff dice «3 a 10 sin empezar» | **SIGUE** | medido hoy: *«\| 3 a 10 \| épicas → implementación \| ⬜ sin empezar \|»* (línea 597) y *«\| FASE 3 a 10 \| ⬜ no empezadas \|»* (línea 1099), con cuatro fases ejecutadas |
| `F-8bC2-016` · tres conteos del decision log | **SIGUE, ensanchado** | medido hoy: log **62** (su propio «Resumen», y `grep -c '^### DEC-'` da 63 encabezados con la plantilla adentro) · `spec.md` **48**, en dos lugares · `03-handoff.md` **46**. La brecha pasó de 12 a **16** |

**Conteo: 2 cortan · 3 cortan a medias · 11 siguen llegando.**

---

## 5. Ataques que intenté y el diseño resistió

Siete, y valen tanto como los hallazgos.

**1. «El orden del corte está al revés: había que desplegar primero.»** No, y el argumento del §4.2
es de los mejores del programa. *«Si entra un cobro en vuelo, **lo registra el viejo**, que es
exactamente lo que queremos — sigue existiendo el lugar donde anotarlo. Al revés, con el despliegue
primero, ese mismo cobro cae en el vacío»*, más *«el código que sabe cancelar esos preapprovals **se
va con el despliegue**»*. Lo verifiqué contra `PA-5` y contra `B/09` §2.1, y el orden elegido es el
correcto. Lo que le falta no es el orden: es todo lo demás (`F-8cC2-003` a `F-8cC2-007`).

**2. «El arreglo 22 es una decisión de producto disfrazada de consecuencia técnica.»** No, y el
capítulo lo dice con más honestidad de la que esperaba: *«**Qué se pierde, dicho sin adornos**: la
ficha de cada uno está abajo desde el corte hasta que esa persona contrata. Si alguno tarda una
semana, estuvo una semana afuera.»* Y la razón para no sembrar es correcta y no es de pereza —*«no
cuesta menos: cuesta lo mismo **más una siembra**»*, sobre gente a la que hay que llamar igual—. El
defecto no está en la elección: está en el conjunto sobre el que se calculó (`F-8cC2-010`), y en que
`PB2` no dispara, que es de A/B.

**3. «La lápida contradice *no se hereda una sola fila* y hay que elegir una de las dos.»** No.
`DEC-MIG-003` se precisó el 2026-09-20 con exactamente la distinción que hace falta —*«**Ninguna
fila VIVA** del sistema viejo pasa al nuevo»*— y `B/21` §2.5 la repite. La regla es coherente. Lo
que falla son sus alrededores: dónde se escribe (`F-8cB3-003`), con qué se escribe (`F-8cB1-007`,
`F-8cB3-013`) y quién la lee (`F-8cA2-014` y cuatro más). **La excepción está bien construida.**

**4. «`DEC-MIG-003` se puede revertir: todavía estamos a tiempo de migrar.»** Intenté armar el
argumento y **no se sostiene hoy**: la premisa está medida cuatro veces —2026-09-15, re-verificada
el 09-17 *«sin un solo cambio»*, consultada el 09-19 y citada el 09-20— y con cero pagos el
razonamiento es correcto. La decisión no está mal tomada. Lo que está mal es que **caduca sola el
2026-09-26** y el procedimiento que la ejecuta no tiene dónde enterarse (`F-8cC2-002`).

**5. «El paraguas se puede partir para que verticales salga sola y el corte se achique.»** No, y lo
verifiqué otra vez en los dos sentidos. `DEC-ARCH-007` es explícito, el contrato §5.3 descarta la
tercera implementación por la misma razón, y las dependencias cruzadas siguen siendo **dos** —`B2 →
V2` y `B4 → V4`—. Además el mecanismo del repo lo impide por accidente y a favor: cada PR de
sub-épica a `staging` cerraría su issue en Linear sin nada desplegado. **La partición aguanta.**

**6. «El gate del paso 2 es teatro: nadie va a releer tres preapprovals.»** No, y es la parte mejor
fundada del §4. El programa tiene medido que **leer por id es confiable y buscar no** (`RC-2` contra
`RC-1`), `D5` ya exige la relectura para toda mutación, y son tres llamadas. El gate está bien
elegido. Lo que no tiene es qué hacer cuando cierra (`F-8cB3-010`) ni cómo reintentar
(`F-8cC2-003`).

**7. «El `CLAUDE.md` del repo ya resuelve la liberación y el programa no necesita escribirla.»**
Lo intenté porque sería la salida barata, y **falla por los dos lados**: el gate manual del billing
apunta a archivos que esta misma rama borró (`F-8cC2-005`), y el flujo de ramas del repo —`epic/**`
sin un solo workflow que lo nombre— es `DEC-CI-001` sin aplicar (`F-8bC2-007`). El repo no cubre al
programa; **el programa rompe partes del repo** y todavía no las anotó.

---

## 6. Fuera de mi vector

- **`NUCLEO` → `C1`** — `nucleo/` sigue con **0 apariciones** de `rollout`, `coexistence`,
  `feature flag`, `acceptance gate` y `rollback`, medido hoy. No es un defecto del núcleo: es que la
  FASE 7 del paraguas no tiene dónde aterrizar dentro de él, y `nucleo/00-indice.md` es el documento
  que declara qué vive ahí. Lo dejo a `C1` porque toca el índice del núcleo, que no es mío.

- **[`C1` — la costura]** `HOS-1354/docs/21-migracion.md` **sigue con sus secciones fuera de
  orden**: el archivo va §1 → §1.3 → §3 → §3.3 → **§2.4** → §2.5 → §4. La sección que contiene la
  decisión central (*«No se migra»*) está **después** de las que la citan, y el §3.3 —que declara
  abierta una decisión que `DEC-MIG-002` cerró (`F-8cC2-001`, paso 7)— está antes del §2.4 que la
  contradice. Es el mismo desarme que reporté en la 8-bis, intacto.

- **[`A2` / `A3` — máquinas y datos]** El camino de `F-8cC2-007` supone que las tres personas
  **pueden** volver a contratar después del paso 3. Si `F-8cA3-006` tiene razón y las 12 fichas no
  tienen camino declarado al modelo nuevo, el paso 3 no les devuelve nada que republicar. La mitad
  *«de dónde salen las filas»* es de ellos; la mitad *«cuánto tiempo están sin nada»* es mía.

- **[`B3` — conciliación y datos]** `F-8cC2-001` produce exactamente el mismo webhook huérfano que
  `F-8cB3-003` y `F-8cB3-016` describen, por una tercera puerta. Si se resuelve el orden y se
  escriben las lápidas antes del despliegue, **los tres siguen en pie**: el mío porque la lista de
  ids no incluye a las altas nuevas, y los suyos por sus propias razones.
