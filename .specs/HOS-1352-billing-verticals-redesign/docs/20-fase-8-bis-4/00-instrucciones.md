---
title: "FASE 8-bis-4 · las instrucciones, comunes a los ocho vectores"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 — instrucciones

**Cuarta vuelta del ciclo.** `DEC-METH-006` («el ciclo 8 ↔ 9») manda repetir **hasta que ningún
`CRITICA` quede abierto sin causa declarada**.

**Corre ENTERA, no sólo sobre lo que cambió.** La causa raíz del programa es que las
contradicciones viven **ENTRE capítulos**.

---

## 1. Lo que esta pasada existe para medir, y es una sola cosa

La serie que no baja, y es el número que importa:

| | 8-bis | 8-bis-2 | 8-bis-3 | **8-bis-4** |
|---|---|---|---|---|
| hallazgos | 112 | 120 | 85 | **?** |
| `CRITICA`, por ID | 28 | 27 | 18 | **?** |
| `CRITICA`, **defectos distintos** | no se midió | 17 | 14 | **?** |
| **atribuidos a la tanda de arreglos anterior** | **25 de 25** | **17 de 17** | **13 de 14** | **?** |

**Tres vueltas seguidas, el generador del programa fue EL ACTO DE ARREGLAR.** Dos reglas ya
intentaron cortarlo y ésta es la que mide la segunda.

### `DEC-METH-009` falló en el PASO 3, no en el 2

La regla mandaba (1) nombrar el término que el arreglo redefine, (2) grepearlo sobre los capítulos
que el commit NO toca, (3) resolver cada aparición. **Se aplicó, con cifras, y dos críticos
pasaron igual**: `1ca12d709` declaró haber barrido el `scope` del grant y dejó viva `NUCLEO/01` §5
en un archivo que no tocó; `3692d5deb` declaró *«23 declaradas correctas»* y dejó viva `B/14` §2.2
(*«la sucesora lo hereda»*), que era un `CRITICA`. Medido en
[`../19-fase-8-bis-3/C1-la-costura.md`](../19-fase-8-bis-3/C1-la-costura.md) §4.3.

**El diagnóstico: una resolución en bloque —«101 declaradas correctas»— no es falsable.**

### `DEC-METH-010`, la enmienda que esta pasada mide

Tres obligaciones nuevas más una condicional:

1. **El alcance es TODO EL CORPUS y la unidad es el PÁRRAFO, no el archivo** — incluidos los
   archivos que el commit toca, *«porque un archivo abierto no es un párrafo leído»*.
2. **La obligación 3 se cumple POR APARICIÓN y por escrito**, en su versión acotada: se escribe
   archivo, § y por qué sigue siendo correcta para cada aparición **que no se corrige y está en un
   párrafo que el commit no tocó**.
3. **Se grepea también el término VIEJO**, el que se retira.
4. *(Condicional, sólo con la 2 encima)*: cada término que el núcleo define lleva su lista de
   consumidores, y el arreglo que crea un consumidor nuevo agrega la fila antes de declararse
   aplicado.

**La 9-bis-3 corrió entera bajo esa regla.** Es la primera tanda que lo hizo.

### Lo que cada hallazgo tiene que declarar: TRES líneas, no dos

> 1. **¿Es nuevo, o lo introdujo un arreglo de la 9-bis-3?** OBLIGATORIO siempre.
> 2. **¿Lo habría encontrado el grep?** OBLIGATORIO si la respuesta fue «el arreglo». Nombrá el
>    término —**nuevo o viejo**, que ahora los dos están en el alcance— y decí sí o no.
> 3. **¿La RESOLUCIÓN POR APARICIÓN lo habría atrapado?** **NUEVA Y OBLIGATORIA**, también si la
>    respuesta fue «el arreglo». Es decir: la aparición donde vive el defecto, ¿cae dentro de lo
>    que la obligación 2 manda escribir — no corregida, y en un párrafo que ese commit no tocó? Si
>    **sí**, la enmienda alcanzaba y no se ejecutó. Si **no**, la enmienda no alcanza y hay que
>    saber por qué.

**Sin la tercera línea no se puede distinguir *«la enmienda no sirve»* de *«no se aplicó»*, y son
dos problemas opuestos.** La segunda sola ya no alcanza: es exactamente lo que la vuelta anterior
midió y por eso existe `DEC-METH-010`.

### El dato que necesitás para contestar la 2 y la 3, y que no podés sacar del commit

**El rastro por aparición que la obligación 2 manda escribir NO EXISTE como documento en el
repo.** Lo medí: los once commits de la tanda no agregan ningún archivo, el worklog no lo
contiene, y `rg -i "por aparici|declaradas correctas|apariciones recorridas"` sobre `.specs/`
—excluidos los informes de fases— devuelve **un solo archivo, el decision log**, que es donde
`DEC-METH-010` se enuncia. Las cifras existen sólo como agregados en los mensajes de commit.

Entonces: **la línea 3 se contesta razonando sobre el alcance de la obligación, no consultando un
rastro.** Y **un mensaje de commit no es evidencia de lo que se hizo** — la tabla del §2.3 publica
lo que cada uno declara, para que puedas medir contra ella, no para que la creas.

---

## 2. Qué cambió en la 9-bis-3 — es dónde mirar primero

**Once commits**, `1e3c3fc9e` → `1c17565e1`: cinco de arreglos y seis de decisiones del owner. Los
defectos que los originaron están en
[`../19-fase-8-bis-3/C1-la-costura.md`](../19-fase-8-bis-3/C1-la-costura.md) §2.1 — **los catorce
críticos con su mapa de deduplicación**.

### 2.1 Los trece arreglos, por familia

**Familia del trial y el grant — `1e3c3fc9e`** *(el crítico #1 quedó sin arreglar a propósito: es
`DEC-TRIAL-009`)*

| # | qué cambió | dónde |
|---|---|---|
| 3 | **`S13` gana un SEGUNDO EVENTO**: anclarle una vertical nueva a un grant vivo. Alcance **tabulado por acto**. El acto entra al catálogo de acciones administrativas, que sigue teniendo doce filas | `B/03` §3.2 · `nucleo/08` |
| 2 | **`T7` nueva**: consume el trial de quien **ya ejerció el evento de activación**, el día que una vertical enciende sus días. **SIN agregar un hecho a la frontera** | `V/03` §2 · `V/11` |

**Familia de la sucesión — `f4edbdfdf`** (la más grande: cuatro críticos)

| # | qué cambió | dónde |
|---|---|---|
| 4 | **`S18` gana un CUARTO efecto** —marcar la predecesora que retiene un pago por `S19`— y el cap. 09 pasa de **una salvedad a TRES** | `B/03` §3.2 · `B/09` §3 |
| 5 | **No hay limpiador de `sucede_a`: se acota la LECTURA.** La relación pasa a **CUATRO estados**, **seis predicados exigen la sucesora VIVA**, y `NUCLEO/01` §2.4 pasa de «los cinco predicados» a un **inventario de 16 consumidores en dos grupos**, con `G-R1-E` | `nucleo/01` §2.4 · `B/02` · `B/03` · `B/20` |
| 6 | **`S18` también sale de `PENDING_AUTHORIZATION`**: la sucesora ocupa el candado `A` en el acto. Se **retira** la excepción del cap. 09, que leía el lado equivocado del candado | `B/03` §3.3 · `B/09` §3 |
| 7 | **el tercer efecto de `S18` alcanza TRES entidades**; `B/02` gana el §2.6, el inventario de qué cuelga de una suscripción | `B/02` §2.6 |

**Familia de `S13` y los complementos — `4e383480d`** (cuatro críticos y un `ALTA`)

| # | qué cambió | dónde |
|---|---|---|
| 8 | **el `desde` de `S13` pasa a «toda fila viva PRINCIPAL»**, en la fila y en las DOS entradas de la tabla por acto. La condición de huérfano gana una **tercera mitad** | `B/03` §3.2 · `B/16` |
| 11 | **la exención de terminales deja de ser una lista y pasa a ser CRITERIO** —quien dejó al preapproval sin poder cobrar— con **tabla de SIETE puertas y veredicto por puerta: tres exentas, cuatro no** | `B/09` §3 |
| 12 | **`S13` declara idempotencia**; su detector es la **tercera** comprobación de cero llamadas, escrita para los **dos** disparadores | `B/03` §3.2 · `B/09` |
| 13 | **la re-evaluación del huérfano dice sobre QUÉ filas corre**, e incluye las de la predecesora cuando la fila era una sucesora | `B/16` |
| — | `F-8dB1-004`: la baja que decide el proveedor entra como **rama 5** | `B/12` §5.3 |

**Familia del pago manual y el addon tardío — `a85f5bb7e`**

| # | qué cambió | dónde |
|---|---|---|
| 9 | **el evento de `S19` se enuncia sobre el HECHO** —entra el pago del período impago, por cualquiera de sus dos puertas— **y no sobre el mecanismo**. Con eso `MP1` matchea y `S6` no corre. Residuo cerrado: la devolución de un pago manual se asienta en un `refund` que cuelga de él | `B/03` §3.2 · `B/12` §5.3 |
| 10 | **`A5` sale de toda instancia con autorización que puede cobrar**, no sólo de `ACTIVE`; *«se re-evalúa»* gana sus **tres momentos**. **Cuarta** comprobación de cero llamadas | `B/16` · `B/09` |

**La costura — `c29b318c7`**

| qué cambió | dónde |
|---|---|
| **Las copias de la firma del contrato eran CUATRO, no dos** —los dos `spec.md`, el handoff y la partición, ésta con la firma más vieja—. **Se RETIRAN y se reemplazan por remisión**, más una **regla de vigilancia comprobable con `rg`**: fuera del contrato y los informes, toda aparición de la firma tiene que ser prosa que cite, nunca un bloque que defina | `12-contrato…` · `11-particion…` · `03-handoff` · los dos `spec.md` |
| De paso: el contrato **se contradecía consigo mismo** —§5.1 enumeraba cuatro fuentes y §5.2 decía tres—, y la que faltaba es el **addon**, la única que transporta alcance `LISTING` y `objetivo` | `12-contrato…` §5.1, §5.2 |

### 2.2 Las transiciones e invariantes nuevos, que hay que recorrer

**`T7` · `S18` (cuatro efectos) · `S19` · `S20` · `S21` · `MP4` · `MP5` · `PB7` · `PB8`**, más el
invariante **`D16`** y los guards **`G-R1-E`** y **`G-R5`**.

### 2.3 Qué archivos toca cada commit, y qué declara cada uno

Medido por mí con `git show --name-only`. `DEC-METH-010` cierra diciendo que **el programa no
publica este dato** y que dos de los siete informes de la vuelta anterior contestaron mal
*«¿lo habría encontrado el grep?»* por medir contra el conjunto equivocado. Acá está.

| commit | familia | archivos | qué declara sobre `DEC-METH-010` |
|---|---|---|---|
| `1e3c3fc9e` | trial y grant | 16 — contrato, `nucleo/01`, `/03`, `/04`, `/08`, `V/02`, `V/03`, `V/10`, `V/11`, `V/18`, `V/21`, `B/02`, `B/03`, `B/14`, `B/19`, `B/21` | *«Primera tanda con `DEC-METH-010`: la resolución se escribió por aparición. **72 apariciones no corregidas** quedaron justificadas una por una»* |
| `f4edbdfdf` | la sucesión | 17 — partición, contrato, `nucleo/01`, `/03`, `/04`, `/07`, `/08`, `B/descomposicion`, `B/02`, `B/03`, `B/05`, `B/09`, `B/12`, `B/14`, `B/16`, `B/19`, `B/20` | **ninguna cifra de apariciones.** Declara *«ocho premisas de otros arreglos volvieron falsas»* y que los conteos congelados se recorrieron |
| `4e383480d` | `S13` y complementos | 13 — contrato, `nucleo/01`, `/04`, `B/descomposicion`, `B/02`, `B/03`, `B/05`, `B/09`, `B/12`, `B/14`, `B/16`, `B/20`, `B/21` | **ninguna cifra.** *«Seis premisas volvieron falsas»*; *«la obligación 4 quedó cumplida: el inventario del núcleo ganó su fila 17 en el mismo acto que creó el consumidor»* |
| `a85f5bb7e` | pago manual y addon | 13 — `nucleo/01`, `/03`, `/07`, `/08`, `B/descomposicion`, `B/02`, `B/03`, `B/05`, `B/09`, `B/12`, `B/16`, `B/19`, `B/20` | **ninguna cifra.** *«Ninguna premisa ajena volvió falsa, verificado contra las tres familias anteriores»* |
| `c29b318c7` | la costura | 6 — handoff, partición, contrato, `V/spec.md`, `B/02`, `B/spec.md` | *«**90 apariciones recorridas, 15 corregidas, 75 declaradas correctas** con su rastro por párrafo»* |
| `fe7d14914` | `DEC-TRIAL-009` | 3 — log, `nucleo/08`, `V/11` | — |
| `621332e7c` | `DEC-DATA-002` | 18 — log, contrato, `nucleo/01`, `/03`, `/04`, `/07`, `V/descomposicion`, `V/02`, `V/03`, `V/17`, `V/19`, `V/20`, `V/21`, `V/spec.md`, `B/03`, `B/10`, `B/19`, `B/20` | — |
| `6bac7e63a` | `DEC-ADDON-003` | 12 — log, contrato, `nucleo/01`, `/04`, `/08`, `B/descomposicion`, `B/02`, `B/03`, `B/09`, `B/16`, `B/19`, `B/20` | — |
| `456563988` | `DEC-ADDON-004` | 10 — log, `nucleo/01`, `/03`, `B/descomposicion`, `B/02`, `B/03`, `B/09`, `B/16`, `B/20`, `B/spec.md` | — |
| `71615bb41` | `DEC-SUB-012` | 7 — log, `nucleo/07`, `B/03`, `B/05`, `B/12`, `B/19`, `B/20` | — |
| `1c17565e1` | las tres chicas | 6 — log, `nucleo/03`, `B/02`, `B/03`, `B/09`, `B/16` | — |

**Dos lecturas que esta tabla habilita y conviene hacer:** sólo **dos de los cinco** commits de
arreglo reportan una cifra de apariciones, y **los seis de decisiones no reportan ninguna** —
aunque **los seis editan capítulos y los seis editan el núcleo**.

---

## 3. Las ocho decisiones nuevas, que cambian qué es un hallazgo

| decisión | qué fija |
|---|---|
| **`DEC-TRIAL-009`** *(el trial no vuelve)* | revocar un grant **no devuelve** el trial: se declara en la confirmación y **no se repara** |
| **`DEC-DATA-002`** *(la pausa no borra)* | `ARCHIVED` gana dos salidas `PB7`/`PB8`; el reloj tiene **cuatro hechos de reinicio** con lista cerrada; invariante `D16` = la **relación** entre 120 y 180, no los números, con `G-R5` |
| **`DEC-ADDON-003`** *(addon ya comprado)* | `includesAddons` convierte a **$0** el addon ya comprado, con transición propia **`S20`** y no ampliando `S13` |
| **`DEC-ADDON-004`** *(complemento sin instancia)* | el complemento huérfano va a `CANCELLED` **en el acto**, sin gracia, como fila propia **`S21`** |
| **`DEC-SUB-012`** *(pago manual tardío)* | el pago tardío **reabre** `DECLARED_UNPAID` vía **`MP4`**; el tope no es un plazo sino la condición 1 de `B/05` §3 |
| **`DEC-ADDON-005`** *(fuga USER/GLOBAL)* | la fuga **se DEJA**, decidida con tres razones; se apaga con el grant |
| **`DEC-ADDON-006`** *(la tercera cláusula)* | la 3ª cláusula de `A5` nombra la **REVOCACIÓN** —desanclar no existe— y **no se borra** |
| **`DEC-SUB-013`** *(la cuota del manual)* | la cuota del pagador manual la abre un reloj **`MP5`**, sólo sobre `ACTIVE`, **no durante `SUSPENDED`**, y al reabrir se **re-ancla** |

**El criterio del owner detrás de las cinco de producto**, escrito porque explica por qué tres
resuelven distinto: *si la pérdida la causa un acto deliberado NUESTRO y la persona no puso plata
nueva → se declara y no se repara; si la persona PUSO PLATA → se le da salida.*

---

## 4. Qué NO es un hallazgo de esta pasada

| no reportar | por qué |
|---|---|
| **los cinco críticos que `DEC-MIG-004` retiró** — `PB2` en la mañana del corte, `listing` sin camino, la lápida entre el paso 3 y el 4, el paso 1 y la cohorte que crece, el período ya pagado | están **declarados con causa por el owner**. La población de producción es conocida suya, son pocos y **se los llama por teléfono**. **ES LA CUARTA PASADA QUE LO REDESCUBRE: no lo reabras por ningún ángulo** |
| **las ocho decisiones del §3** | son decisiones **tomadas**, con su razón escrita en el log. Que la decisión esté **mal implementada en los capítulos** SÍ es hallazgo; que no guste, **no** |
| los **85** de la 8-bis-3, los **120** de la 8-bis-2 y los **112** de la 8-bis, salvo que **sigan llegando** sobre el texto nuevo | si uno sigue llegando, **decilo con su ID viejo** y mostrá **en qué paso llega hoy** |
| los **141 de la FASE 8** que nunca estuvieron en un racimo | sólo 34 lo estuvieron; que los demás sigan llegando **es por construcción** |
| el **capítulo 13 (Pagos)**, que no existe | límite declarado. Sí vale: **qué se rompe cuando se escriba**, si depende de algo que esta tanda movió |
| *«esto no está medido»* a secas | la pregunta útil es **«si esa medición vuelve al revés, qué se rompe»** |
| **números que no midió nadie** | si citás un número, **citá dónde se midió** |

---

## 5. Cómo se escribe un hallazgo

```markdown
### F-8eXN-NNN — <título en una línea, que diga qué se rompe>

**Qué se rompe.** El resultado concreto, en el sistema, para una persona.

**El camino.** Los pasos, numerados, cada uno con su cita textual (archivo y §).

**Dónde lo permite el diseño.** Las citas, con archivo y §.

**Severidad.** `CRITICA` | `ALTA` | `MEDIA` | `BAJA`, con su motivo.

**¿Es nuevo, o es el arreglo?** OBLIGATORIO. Si lo introdujo un arreglo de la 9-bis-3, **decí
cuál de los trece** (o cuál de las ocho decisiones).

**¿Lo habría encontrado el grep?** OBLIGATORIO si la respuesta anterior fue «el arreglo».
Nombrá el término —nuevo o viejo— y decí sí o no. Medí contra la tabla del §2.3, no contra el
mensaje del commit.

**¿La resolución POR APARICIÓN lo habría atrapado?** OBLIGATORIO si la respuesta fue «el
arreglo». ¿La aparición cae dentro de lo que la obligación 2 manda escribir —no corregida y en
un párrafo que ese commit no tocó—? Es lo único que separa «la enmienda no sirve» de «no se
aplicó».
```

**IDs**: `F-8e` + tu vector + número. A1 → `F-8eA1-001`.

**`CRITICA`** es: alguien paga de más o de menos, alguien accede a algo que no le corresponde, o un
dato se pierde sin vuelta. **Lo demás no.**

**Sección obligatoria al final**: `## Ataques que intenté y el diseño resistió`.

**Marcá `NUCLEO`** cualquier defecto de `docs/nucleo/`: lo adopta la pasada C.

**Escribís UN SOLO archivo** y **devolvés SÓLO el índice** en tu respuesta: conteo por severidad y
la lista de títulos. Un informe largo en la respuesta tira al agente.

---

## 6. Reglas duras

- **El PDR (`00-PDR.md`) no se edita NUNCA.**
- **No edites ningún capítulo.** Esta fase **encuentra**, no arregla.
- **No toques** el decision log, la matriz, ni los informes de fases anteriores.
- **Los conteos se cuentan**, y **un número que no mediste vos lleva su fuente**. Hoy el log tiene
  **76 decisiones** (77 encabezados `### DEC-` menos la plantilla), 10 de metodología y 66
  funcionales — lo conté con `rg -c "^### DEC-"`. La matriz se cuenta con
  `contar-filas-de-la-matriz.py`.
- **Verificá las citas ajenas contra el TEXTO, no contra el informe que las cita.** Y **un mensaje
  de commit no es evidencia de lo que se hizo.**
- **Grepeá siempre con y sin backticks**: `` `T1` `` no encuentra `T1` pelado.
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

1. **Deduplicar los críticos** — en la 8-bis-3 los 18 IDs eran 14 defectos; en la 8-bis-2, 27 IDs
   eran 17. Declarar el criterio de colapso **antes** de aplicarlo.
2. **Dirimir las contradicciones ENTRE informes**, con veredicto sobre cuál tiene razón,
   **verificado contra el texto del capítulo** y no contra el informe que lo cita.
3. **El veredicto de método**: ¿`DEC-METH-010` cortó el generador? Con la atribución de cada
   crítico, el reparto de los que ninguna búsqueda alcanza, y —lo que esta vuelta agrega— **cuántos
   habría atrapado la resolución por aparición**, separando *«la enmienda no alcanza»* de *«no se
   ejecutó»*.
