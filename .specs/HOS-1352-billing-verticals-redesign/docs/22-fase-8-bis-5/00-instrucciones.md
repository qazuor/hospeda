---
title: "FASE 8-bis-5 · las instrucciones, comunes a los ocho vectores"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 — instrucciones

**Quinta vuelta del ciclo.** `DEC-METH-006` («el ciclo 8 ↔ 9») manda repetir **hasta que ningún
`CRITICA` quede abierto sin causa declarada**.

**Corre ENTERA, no sólo sobre lo que cambió.** La causa raíz del programa es que las
contradicciones viven **ENTRE capítulos**.

**Y esta vuelta tiene algo que ninguna anterior tuvo: un rastro escrito de 1.030 afirmaciones
falsables.** Leé el §1.3 antes que nada: cambia dónde conviene atacar.

---

## 1. Lo que esta pasada existe para medir

La serie que no baja, y es el número que importa:

| | 8-bis | 8-bis-2 | 8-bis-3 | 8-bis-4 | **8-bis-5** |
|---|---|---|---|---|---|
| hallazgos | 112 | 120 | 85 | 83 | **?** |
| `CRITICA`, por ID | 28 | 27 | 18 | 13 | **?** |
| `CRITICA`, **defectos distintos** | no se midió | 17 | 14 | 12 | **?** |
| **atribuidos a la tanda de arreglos anterior** | **25 de 25** | **17 de 17** | **13 de 14** | **12 de 12** | **?** |

**Cuatro vueltas seguidas, el generador del programa fue EL ACTO DE ARREGLAR.** Tres reglas
intentaron cortarlo —`DEC-METH-009`, `DEC-METH-010`, `DEC-METH-011`— y ésta mide la tercera.

### 1.1 `DEC-METH-010` falló por dos puertas, y las dos están medidas

La 8-bis-4 fue la primera vuelta que trajo **evidencia positiva** en vez de sólo el fracaso:

1. **Los dos únicos commits que ejecutaron la obligación 2 con cifras produjeron CERO de los doce
   críticos.** `1e3c3fc9e` tocó **16** archivos y produjo **0**; `621332e7c` tocó **18** y produjo
   **5**. Exposición comparable, resultado opuesto. **No era que la enmienda no sirviera: no se
   ejecutó en 9 de los 11 commits.**
2. **Nueve de los doce críticos salieron de los seis commits de DECISIONES**, que no reportaban
   ninguna cifra aunque los seis editaban capítulos y los seis editaban el núcleo.
3. **El rastro por aparición no existía como artefacto.** *«72 apariciones justificadas una por
   una»* era tan falsable como el *«101 declaradas correctas»* que motivó `DEC-METH-010`: en los dos
   casos el único lector posible era el que las escribió.

Medido en [`../20-fase-8-bis-4/C1-la-costura.md`](../20-fase-8-bis-4/C1-la-costura.md) §4.

### 1.2 `DEC-METH-011`, la enmienda que esta pasada mide

Dos partes que van juntas:

1. **La obligación alcanza a TODO commit que edite el corpus, no sólo a los de arreglo.** Una
   decisión del owner que toca capítulos es un arreglo a los efectos de `DEC-METH-010`.
2. **El rastro por aparición se escribe como ARCHIVO**, en `<carpeta-de-la-fase>/rastro-<sha>.md`,
   con archivo, §, la cita y **por qué sigue siendo correcta** por cada aparición no corregida. Un
   agregado en el mensaje del commit **ya no cumple** la obligación 2.

**Lo que `DEC-METH-011` explícitamente NO levantó**, y va dicho porque decide la línea 3 de cada
hallazgo: la exclusión de *«los párrafos que el commit escribió o editó»*. Ahí nacían **5 de los 9**
críticos que la resolución por aparición no atrapaba (`C1` §4.4, modos 1 y 2). La decisión lo deja
*«medido para la vuelta que viene»*. **Esta es la vuelta que viene.**

### 1.3 La 9-bis-4 ejecutó la regla entera, y lo medí yo

No lo tomes de ningún informe ni de ningún mensaje de commit. Estos cuatro números los conté sobre
el worktree el 2026-09-22:

| medición | cómo se contó | resultado |
|---|---|---|
| commits de la tanda | `git log --format=%h 5ac5e92c9~1..HEAD` | **76** |
| de ésos, que editan el **corpus** (excluidos log, matriz, sondas y los propios rastros) | script sobre `git show --name-only` | **47** |
| de esos 47, **nombrados en algún rastro** | cruce contra `^\| \`<sha>\`` en los diez rastros | **47 de 47** |
| apariciones no corregidas declaradas una por una | suma de los encabezados `## Las N apariciones…` | **1.030** |

**Cobertura sin agujeros.** Los 29 commits restantes tocan sólo el log, la matriz o una sonda — no
el corpus—, así que la obligación no los alcanza.

> **Y acá está el material de esta pasada.** Las 1.030 líneas son afirmaciones **falsables una por
> una**: cada una dice *«esta aparición sigue siendo correcta PORQUE X»*. **Tomá una línea de un
> rastro y mostrá que es falsa hoy.** Eso es un hallazgo de primera clase y ninguna vuelta anterior
> lo pudo producir, porque el rastro no existía.

Que funciona hay prueba: la propia 9-bis-4 se auto-detectó **cinco** defectos de una familia sobre
la anterior leyendo sus propios rastros, todos con archivo y línea —una justificación falsa, dos
correcciones incompletas, una con argumento auto-contradictorio— y están escritos en
`rastro-12cc0879f.md` §5, `rastro-ce52dce5f.md` §6 y `rastro-8d6b27a12.md` §5. Con *«187 declaradas
correctas»* ninguna era señalable.

### 1.4 Lo que cada hallazgo tiene que declarar: las TRES líneas

> 1. **¿Es nuevo, o lo introdujo un arreglo de la 9-bis-4?** OBLIGATORIO siempre.
> 2. **¿Lo habría encontrado el grep?** OBLIGATORIO si la respuesta fue «el arreglo». Nombrá el
>    término —**nuevo o viejo**— y decí sí o no. Medí contra la tabla del §2.3, no contra el mensaje
>    del commit.
> 3. **¿La RESOLUCIÓN POR APARICIÓN lo habría atrapado?** OBLIGATORIO si la respuesta fue «el
>    arreglo». **Y ahora se contesta con evidencia, no razonando**: el rastro existe. Buscá la
>    aparición en el rastro de su familia y **citá la línea**. Tres desenlaces, y los tres son
>    resultados distintos:
>    - **está en el rastro y su justificación es falsa** → la regla se ejecutó y la resolución
>      estuvo mal. Es el hallazgo más fuerte que esta pasada puede producir.
>    - **NO está en el rastro y debería estar** (no corregida, en un párrafo que ese commit no tocó)
>      → la regla no se ejecutó sobre esa aparición.
>    - **NO está y no debía estar** (nace en prosa que el commit escribió o editó, o es una
>      ausencia) → cae en la exclusión que `DEC-METH-011` dejó viva a propósito. Decí en cuál de los
>      cinco modos de `C1` §4.4 cae.

**Sin la tercera línea no se puede distinguir *«la enmienda no sirve»* de *«no se aplicó»* de *«se
aplicó mal»*, y son tres problemas distintos.**

---

## 2. Qué cambió en la 9-bis-4 — es dónde mirar primero

**76 commits**, `5ac5e92c9` → `90e4b326f`. **Los doce críticos de la 8-bis-4 se cerraron los doce**,
en cinco familias de arreglo, más una tanda corta de ocho decisiones, más cuatro tandas de guards.

### 2.1 Lo estructural, por familia

#### La retención — cierra los cinco de `DEC-DATA-002` (#1, #2, #4, #5, #6)

| qué cambió | dónde |
|---|---|
| **el reloj de inactividad gana columna**: `listing.inactiva_desde`, y deja de leerse del aviso que el contrato prohíbe usar para decidir | `V/02` · `V/03` |
| **la ocurrencia de todo schedule lleva la fecha objetivo** en su clave de deduplicación | `nucleo/07` |
| **`S10` gana rama de fallo**, y el barrido su **quinta** comprobación de cero llamadas | `B/03` · `B/09` |
| **el piso otorga TRES capacidades** —la tercera es *«recuperar lo suyo»*— y con eso `PB8` se vuelve ejecutable | `V/17` · `V/15` |
| **`PB3` y `PB7` ganan la rama del cupo** que vuelve a alcanzar, con criterio de orden: **«vuelve primero lo que cayó al final»** (`DEC-DATA-003`) | `V/03` |

#### El pagador manual — cierra #7 y #8

| qué cambió | dónde |
|---|---|
| **la columna que `MP5` lee pasa a ser «fecha del próximo cobro»**, con **tres escrituras** que la mueven, y el re-anclaje incondicional de `MP4` se reemplaza por un **TOPE** | `B/02` · `B/03` |
| la vuelta de una pausa **espeja `PS-6`**, no el tope; la pantalla y el correo dicen cuándo vence la próxima cuota | `B/03` · `B/19` |
| la mitad de la pausa **cuelga de una medición abierta** de `DEC-SUB-010`, y queda escrito en el § | `B/03` |

#### La baja — cierra #10

| qué cambió | dónde |
|---|---|
| **la baja pasa de una fila a tres**: `S22` desde `PAUSED` y `S23` desde `SUSPENDED`, **las dos a `CANCELLED` directo** | `B/03` · `nucleo/03` |

#### El grant y el addon — cierra #9 y #11

| qué cambió | dónde |
|---|---|
| **`permanent_grant` gana `revocado_en`**; *«grant vivo»* y *«ancla viva»* pasan a ser términos **con columna e inventario** | `B/02` · `nucleo/01` |
| **el orden de las dos escrituras de `S20` es NORMATIVO**: primero el ancla-título, después el cobro | `B/03` · `B/16` |

#### La sucesión — cierra #3 y #12

| qué cambió | dónde |
|---|---|
| **`requiere_conciliación` deja de ser columna y pasa a ser FILA** (`reconciliation_mark`), con **motivo**, **reloj** y **referencia al pago** | `B/02` · `B/09` |
| **la cortesía NO se re-apunta**: `S18` la **difiere** en `courtesy_grant.saldo_días` y **`S9` la re-emite** cuando la sucesora autoriza (`DEC-GRANT-007`) | `B/03` · `B/14` |
| la prosa de `B/03` §3.2 enumeraba **tres** caminos por los que la predecesora se muere sola y `B/14` ya decía **cinco** | `B/03` |

#### Después: la tanda corta de las ocho decisiones y las cuatro tandas de guards

| qué cambió | dónde |
|---|---|
| **`S24`** (la baja desde `GRACE_PERIOD`, corta en el acto) y **`S25`** (final de pausa sobre vertical discontinuada) | `B/03` · `V/03` |
| **`G-R6`** (la columna que nadie escribe) y **`G-R6-B`** (las **dos mitades** de la lista de `inactiva_desde`: escritores y consumidores), con **mensaje por mitad** | `V/20` · `B/20` |
| **`UNIQUE` parcial**: a lo sumo **un grant vivo por beneficiario**, garantizado por la base | `B/02` |
| **los catorce guards sin unidad se repartieron**: el conteo de `B/20` §2 pasa de **14 de 29 → 0 de 29** | `B/20` · `V/20` · las dos `descomposicion.md` |

### 2.2 Las transiciones, guards y columnas nuevos, que hay que recorrer

**`S22` · `S23` · `S24` · `S25` · `G-R6` · `G-R6-B`**, más las columnas **`reconciliation_mark`**,
**`revocado_en`**, **`listing.inactiva_desde`**, **`courtesy_grant.saldo_días`** y el **`UNIQUE`
parcial de grants vivos**.

### 2.3 Los diez rastros: qué cubre cada uno, medido por mí

Esto reemplaza la tabla de commits de las vueltas anteriores, porque **la unidad de la obligación
ahora es la familia y su rastro**. Los archivos salen de `git show --name-only` sobre los commits de
cada familia; las apariciones, del encabezado del propio rastro.

| rastro | commits | apariciones | capítulos que la familia tocó |
|---|---|---|---|
| [`rastro-5836ec219.md`](../21-fase-9-bis-4/rastro-5836ec219.md) · la retención | 6 | **187** | `B/03` `B/09` `B/16` `B/19` `B/22` · `V/02` `V/03` `V/11` `V/15` `V/17` `V/19` `V/20` · núcleo `01` `03` `04` `07` · contrato · `V/spec` `V/descomposicion` |
| [`rastro-8f9f31ac0.md`](../21-fase-9-bis-4/rastro-8f9f31ac0.md) · el pagador manual | 4 | **65** | `B/02` `B/03` `B/19` · núcleo `07` |
| [`rastro-032f761e0.md`](../21-fase-9-bis-4/rastro-032f761e0.md) · la baja | 1 | **69** | `B/03` `B/05` `B/09` `B/12` `B/16` `B/19` · núcleo `03` `04` |
| [`rastro-ce52dce5f.md`](../21-fase-9-bis-4/rastro-ce52dce5f.md) · el grant y el addon | 1 | **108** | `B/02` `B/03` `B/09` `B/14` `B/16` `B/20` · núcleo `01` `08` · contrato |
| [`rastro-f21d5d828.md`](../21-fase-9-bis-4/rastro-f21d5d828.md) · la sucesión | 3 | **268** | `B/02` `B/03` `B/05` `B/09` `B/12` `B/14` `B/16` `B/19` `B/20` · núcleo `01` `03` `04` `07` `08` · `B/descomposicion` |
| [`rastro-8d6b27a12.md`](../21-fase-9-bis-4/rastro-8d6b27a12.md) · las ocho decisiones | 9 | **91** | `B/02` `B/03` `B/05` `B/09` `B/10` `B/12` `B/14` `B/16` `B/19` `B/20` · `V/03` `V/20` · núcleo `01` `03` `04` `07` `08` · contrato |
| [`rastro-12cc0879f.md`](../21-fase-9-bis-4/rastro-12cc0879f.md) · el cierre de guards | 6 | **21** | `B/20` `V/20` · `B/spec` `V/spec` `B/descomposicion` |
| [`rastro-7676082e6.md`](../21-fase-9-bis-4/rastro-7676082e6.md) · el guard de la lista de escritores | 7 | **58** | `B/20` `V/02` `V/20` · núcleo `01` · `B/spec` `V/spec` `V/descomposicion` |
| [`rastro-31ce26bb2.md`](../21-fase-9-bis-4/rastro-31ce26bb2.md) · la ampliación de `G-R6-B` | 5 | **118** | `B/20` `V/02` `V/20` · núcleo `01` · `V/descomposicion` |
| [`rastro-40b922120.md`](../21-fase-9-bis-4/rastro-40b922120.md) · el reparto de los catorce guards | 5 | **45** | `B/20` `V/20` · las dos `descomposicion` |

**Tres lecturas que esta tabla habilita y conviene hacer:**

- **`f21d5d828` recorrió 268 apariciones sobre 15 archivos**; `12cc0879f`, **21 sobre 5**. La
  densidad por archivo varía casi diez veces entre familias. **Donde el rastro es fino, la
  probabilidad de una justificación floja es más alta** — pero donde es grueso, el volumen mismo es
  un riesgo. Las dos puntas valen.
- **Tres rastros declaran haber invalidado líneas de rastros anteriores** (`12cc0879f` §5,
  `ce52dce5f` §6, `8d6b27a12` §5). Esas secciones son **la única auto-corrección documentada del
  programa**: verificá que lo que declaran corregido esté efectivamente corregido hoy.
- **Cuatro rastros tienen un § de «preguntas para el owner»** que nadie contestó todavía. Si una de
  esas preguntas es en realidad un defecto, decilo — una pregunta abierta no es una causa declarada.

---

## 3. Las doce decisiones nuevas, que cambian qué es un hallazgo

El log pasó de **79 a 88** decisiones (11 de metodología, 77 funcionales).

| decisión | qué fija |
|---|---|
| **`DEC-METH-011`** *(el rastro es un archivo)* | la obligación alcanza a **las decisiones**, no sólo a los arreglos; el rastro por aparición es un **ARCHIVO**. **NO levanta** la exclusión de la prosa que el commit escribe o edita |
| **`DEC-DATA-003`** *(el cupo que vuelve a alcanzar)* | `PB3` gana la rama simétrica a la del excedente; el orden es **«vuelve primero lo que cayó al final»** |
| **`DEC-GRANT-007`** *(la cortesía no se re-apunta)* | se **difiere** con su saldo de días y **`S9` la re-emite** cuando la sucesora autoriza |
| **`DEC-SUB-014`** *(la baja desde el grace)* | corta el servicio **en el acto** |
| **`DEC-SUB-015`** *(la pausada y la vertical discontinuada)* | **NO entra al piso**: se le avisa, y al volver elige plan nuevo |
| **`DEC-RF-003`** *(la rama 6)* | entra al listado con el **default en DEVOLVER** |
| **`DEC-GRANT-008`** *(motivo de la revocación)* | la revocación guarda **motivo** (texto libre), además de fecha y firmante |
| **`DEC-GRANT-009`** *(un grant vivo)* | **`UNIQUE` parcial**: lo garantiza la base, no los nueve consumidores |
| **`DEC-TEST-001`** *(qué guard va)* | va **`G-R6`**; el guard del **orden de escrituras NO** — más cinco enmiendas |
| **`DEC-GRANT-010`** *(la cortesía sin destino)* | sobre una vertical discontinuada se **difiere**, y su re-emisión **puede no llegar**: queda declarado con causa |
| **`DEC-MP-003`** *(la pausa del proveedor)* | lleva motivo propio **`PROVIDER_DUNNING`** y no entra como pausa del cliente. **Qué hace el dunning con esa fila espera la sonda 49 del 24/09** |
| **`DEC-MP-004`** *(el alta rechazada)* | el mensaje sale del **`status_detail`**, con mapa explícito y genérico obligatorio |

---

## 4. Qué NO es un hallazgo de esta pasada

| no reportar | por qué |
|---|---|
| **los cinco críticos que `DEC-MIG-004` retiró** — `PB2` en la mañana del corte, `listing` sin camino, la lápida entre el paso 3 y el 4, el paso 1 y la cohorte que crece, el período ya pagado | están **declarados con causa por el owner**: la población de producción es conocida suya, son pocos y **se los llama por teléfono**. **ES LA QUINTA PASADA QUE LO PUEDE REDESCUBRIR: no lo reabras por ningún ángulo** |
| **`DEC-MP-003` y `DEC-MP-004` no están implementadas en los capítulos** | **medido el 2026-09-22**: `rg -l "PROVIDER_DUNNING"` fuera de los informes devuelve **sólo el decision log**, y `status_detail` fuera de sondas e informes, **sólo la matriz y el log**. Los dos commits tocan **un archivo cada uno: el log**. Es trabajo **pendiente y conocido**, y la mitad de `DEC-MP-003` no se puede escribir hasta leer la sonda 49 el **24/09**. **Decisión del owner del 2026-09-22: no es hallazgo.** Lo que **SÍ** es hallazgo: que `B/03` §10.1 hoy espeje esa pausa con `S8`/`CUSTOMER_REQUEST` **rompa algo más** que lo que la propia decisión ya enumera |
| **las doce decisiones del §3** | son decisiones **tomadas**, con su razón escrita. Que estén **mal implementadas en los capítulos** SÍ es hallazgo; que no gusten, **no** |
| **la discontinuación de una vertical** | el owner declaró que **no va a pasar**, y el saldo de cortesía sin destino quedó declarado con causa en `DEC-GRANT-010` |
| los **83** de la 8-bis-4, los **85** de la 8-bis-3, los **120** de la 8-bis-2 y los **112** de la 8-bis, salvo que **sigan llegando** sobre el texto nuevo | si uno sigue llegando, **decilo con su ID viejo** y mostrá **en qué paso llega hoy** |
| los **141 de la FASE 8** que nunca estuvieron en un racimo | sólo 34 lo estuvieron; que los demás sigan llegando **es por construcción** |
| el **capítulo 13 (Pagos)**, que no existe | límite declarado. Sí vale: **qué se rompe cuando se escriba**, si depende de algo que esta tanda movió |
| *«esto no está medido»* a secas | la pregunta útil es **«si esa medición vuelve al revés, qué se rompe»** |
| **números que no midió nadie** | si citás un número, **citá dónde se midió** |

### 4.1 El hallazgo ya anclado que esta pasada DEBE tomar

**`RC-5` de [`../06-mp-validation-matrix.md`](../06-mp-validation-matrix.md)**, medido en producción
el 2026-09-22: **`summarized.charged_quantity` cuenta INTENTOS, no cobros.** Un alta rechazada quedó
con `charged_quantity: 1`, `charged_amount: 0` y `last_charged_amount: 15` — tres campos del mismo
objeto contándose distinto.

**Y `B/09` §4 decide *«no cobró nunca»* con ese campo**, así que esa regla concluye **«sí cobró»**
sobre una suscripción que no cobró un peso. El § se titula *«Los tres modos de cero cobros»* y **hay
un cuarto**: cobró cero porque el cobro se rechazó, con el contador en uno.

Está escrito dentro de la fila de la matriz como *«se deja como hallazgo para la FASE 8-bis-5»*.
**Quien lo tome (vector `B1` o `B3`) lo escribe como hallazgo propio con su ID.** **No se arregla a
mano y no se toca la matriz.**

---

## 5. Cómo se escribe un hallazgo

```markdown
### F-8fXN-NNN — <título en una línea, que diga qué se rompe>

**Qué se rompe.** El resultado concreto, en el sistema, para una persona.

**El camino.** Los pasos, numerados, cada uno con su cita textual (archivo y §).

**Dónde lo permite el diseño.** Las citas, con archivo y §.

**Severidad.** `CRITICA` | `ALTA` | `MEDIA` | `BAJA`, con su motivo.

**¿Es nuevo, o es el arreglo?** OBLIGATORIO. Si lo introdujo la 9-bis-4, **decí cuál de las cinco
familias, de las cuatro tandas de guards, o cuál de las doce decisiones**.

**¿Lo habría encontrado el grep?** OBLIGATORIO si la respuesta anterior fue «el arreglo». Nombrá
el término —nuevo o viejo— y decí sí o no. Medí contra la tabla del §2.3.

**¿La resolución POR APARICIÓN lo habría atrapado?** OBLIGATORIO si la respuesta fue «el arreglo».
**Contestá con el rastro en la mano**: citá la línea del rastro de esa familia, o mostrá que la
aparición no está y decí en cuál de los tres desenlaces del §1.4 cae.
```

**IDs**: `F-8f` + tu vector + número. A1 → `F-8fA1-001`.

**`CRITICA`** es: alguien paga de más o de menos, alguien accede a algo que no le corresponde, o un
dato se pierde sin vuelta. **Lo demás no.**

**Sección obligatoria al final**: `## Ataques que intenté y el diseño resistió`.

**Sección obligatoria, NUEVA**: `## Líneas de rastro que ataqué`. Va aunque no encuentres ninguna
falsa — decí cuántas revisaste, de qué rastros, y por qué esas. **Un cero medido es un resultado; un
cero por no haber mirado, no.**

**Marcá `NUCLEO`** cualquier defecto de `docs/nucleo/`: lo adopta la pasada C.

**Escribís UN SOLO archivo** y **devolvés SÓLO el índice** en tu respuesta: conteo por severidad y
la lista de títulos. Un informe largo en la respuesta tira al agente.

---

## 6. Reglas duras

- **El PDR (`00-PDR.md`) no se edita NUNCA.**
- **No edites ningún capítulo.** Esta fase **encuentra**, no arregla.
- **No toques** el decision log, la matriz, los rastros de la 9-bis-4, ni los informes de fases
  anteriores.
- **Los conteos se cuentan**, y **un número que no mediste vos lleva su fuente**. Hoy el log tiene
  **88 decisiones** (89 encabezados `### DEC-` menos la plantilla), **11 de metodología y 77
  funcionales** — contado con `rg -c "^### DEC-"` el 2026-09-22. La matriz tiene **89 filas** — 50
  `VERIFIED`, 13 `PARTIALLY_SUPPORTED`, 20 `NOT_SUPPORTED`, 6 `UNKNOWN` —, contadas con
  `contar-filas-de-la-matriz.py` el mismo día.
- **Verificá las citas ajenas contra el TEXTO, no contra el informe que las cita.** Y **un mensaje
  de commit no es evidencia de lo que se hizo.** **Una línea de rastro tampoco**: es la afirmación a
  verificar, no la prueba.
- **Grepeá siempre con y sin backticks**: `` `T1` `` no encuentra `T1` pelado.
- **Medí siempre sobre este worktree**, nunca sobre el clone principal.
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

**Los tres encargos propios de `C1`**, que rinden:

1. **Deduplicar los críticos** — en la 8-bis-4 los 13 IDs eran 12 defectos; en la 8-bis-3, 18 eran
   14; en la 8-bis-2, 27 eran 17. Declarar el criterio de colapso **antes** de aplicarlo.
2. **Dirimir las contradicciones ENTRE informes**, con veredicto sobre cuál tiene razón,
   **verificado contra el texto del capítulo** y no contra el informe que lo cita.
3. **El veredicto de método sobre `DEC-METH-011`**, y esta vez con una pregunta que se puede
   contestar con evidencia y no razonando:
   - ¿cuántos críticos habría atrapado el rastro, ahora que el rastro **existe**?
   - de los que se escapan, **¿cuántos caen en la exclusión que `DEC-METH-011` dejó viva a
     propósito** —la prosa que el commit escribe o edita, modos 1 y 2 de `C1` §4.4—? Ése es el
     número que decide si la corrección B de la 8-bis-4 hay que aplicarla o no.
   - **¿cuántas líneas de rastro resultaron falsas**, sobre cuántas revisadas, sumando las de los
     ocho informes? Es la primera vez que el programa puede medir **la calidad** de una resolución y
     no sólo su existencia.
