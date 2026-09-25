---
title: "FASE 8-bis-3 · A1 — acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 · A1 — acceso cruzado y autorización

Cuarta pasada adversarial sobre `HOS-1353`, con el vector de siempre —**que una cuenta llegue a
algo que no le corresponde, o pierda algo que sí**: otra vertical, otro plan, otra ficha, otro
sujeto— sobre el texto que la 9-bis-2 produjo.

**Diez hallazgos. Uno `CRITICA`, cuatro `ALTA`, cuatro `MEDIA`, uno `BAJA`.**

Los paths se abrevian como siempre: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y cómo.** Todo conteo de este informe sale de recorrer el artefacto citado
sobre el worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign` el
2026-09-21, con `rg` o a mano sobre la tabla: 6 filas en la tabla de transiciones de `V/03` §2 y
sus valores de `desde`; 24 celdas en la tabla de clases del `12-contrato…` §2.4; 6 filas en la
tabla de lectura de catálogo de `V/10` §2; 12 filas en `NUCLEO/08` §3; 14 guards en `V/20` §2 y
11 en `B/20` §2; 3 planes no vendibles por vertical en `V/02` §2.1; 5 campos en la fuente del
`12-contrato…` §2; 8 commits de la tanda y cuáles declaran `DEC-METH-009`. **Ningún número de
este informe viene de otro informe.**

---

## La tesis: la regla sirve, y la mitad de la tanda no la corrió

`DEC-METH-009` es lo que esta pasada existe para medir, y el dato más duro no es sobre los
hallazgos sino sobre los commits. Conté los ocho commits de la tanda
(`1ca12d709` → `50c3e2196`) y **cuatro declaran haber ejecutado la regla y cuatro no**:

| commit | ¿declara `DEC-METH-009`? |
|---|---|
| `1ca12d709` familia del contrato | **sí** — *«los términos redefinidos se grepearon sobre los capítulos que la edición no toca»* |
| `49eb99f34` familia del trial | **sí** — *«110 apariciones de «vivo/viva» inspeccionadas, 9 corregidas … 101 declaradas correctas»* |
| `3692d5deb` familia de la sucesión | **sí** |
| `99e9d4e24` familia del pago tardío | **no** |
| `f5731fd65` familia de `CHARGE_DECLINED` | **sí** |
| `94e4baf5b` reembolso lo confirma una persona | **no** |
| `1c972a07b` el cierre | **no** |
| **`50c3e2196` las dos decisiones de producto** | **no** |

**Y el `CRITICA` y dos de las cuatro `ALTA` de esta pasada viven en los dos últimos renglones**,
que son los que cargaron `DEC-GRANT-006` y `DEC-TRIAL-008` y no greparon nada. `F-8dA1-002` se
encuentra literalmente con `rg -n "cortesía"` sobre los capítulos que `50c3e2196` no toca —
`V/11`, `B/14`, `B/03` y `NUCLEO/08` — y las cuatro apariciones que devuelve son las cuatro que
quedaron falsas.

**La regla sirve donde se aplicó**: de mis quince hallazgos de la 8-bis-2, **cuatro cortan**
(`001`, `002`, `007`, `013`) y los cuatro los cerró un commit que declara `DEC-METH-009`.
Ninguno de los que siguen llegando cae en un commit que la haya declarado.

**Y la regla tiene un punto ciego que hay que nombrar, porque es donde cae mi `CRITICA`.** La
obligación 2 dice *«buscarlo … sobre los capítulos que el commit NO toca»*. Tres de mis diez
hallazgos son colisiones **adentro del archivo que el commit edita** —`T2` contra `T4`, dos filas
de la misma tabla— o entre **dos secciones que el mismo commit reescribe** —`V/15` §2.5 contra
`V/20` §2—. El alcance de la regla **excluye por construcción** el lugar donde están. Y el
`CRITICA` tiene un modo peor: **no lo encuentra ningún grep del término redefinido, porque el
consumidor que se rompe no nombra ese término** — lo encontraría grepear el término que el
arreglo **trae al alcance por primera vez** (`grant`, `revocar`), que la regla no pide.

| modo | cuántos de los 10 | ¿lo habría dado el grep? |
|---|---|---|
| aparición del término redefinido en un capítulo que el commit no toca | **4** | **sí** — la regla existía y no se corrió |
| colisión adentro del archivo que el commit edita, o entre dos § del mismo commit | **3** | **no** — fuera del alcance declarado |
| el consumidor roto **no nombra** el término redefinido | **2** | **no** — haría falta grepear el término que el arreglo trae al alcance |
| preexistente, ningún arreglo de la tanda lo tocó | **1** | no aplica |

---

## CRITICA

### F-8dA1-001 — `T2` y `T6` convierten el trial ante una fuente `GRANT`, y un grant se revoca: el trial único de por vida se destruye con un acto administrativo reversible, sin vuelta y sin reparación declarada

**Qué se rompe.** `SUPER_ADMIN` le firma un *Free Forever* a alguien que está probando
Gastronomía. El acto —que nadie vive como un costo, porque el grant es *«estrictamente mejor y
para siempre»*— **consume su trial único de por vida en el acto**. Meses después el grant se
revoca, que es una acción declarada del catálogo administrativo. La persona queda sin grant, sin
suscripción, con su ficha abajo por `PB2`, y **sin el trial que nunca usó**. No hay transición de
vuelta y no hay instrumento de reparación: `V/11` §2 sólo repara *«lo que rompimos nosotros»* en
el sentido de una moderación equivocada, y esto no lo es — es una decisión de negocio que se
revirtió.

**El camino.**

1. La persona entra a Gastronomía, publica su ficha, y `T1` le arranca el trial: *«| T1 |
   `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | … **y**
   `cubierto` es **falso** |»* (`V/03` §2). No tiene suscripción, así que `cubierto` es falso y
   `T1` es la única de las dos que dispara. Día 2 de 30.
2. `SUPER_ADMIN` firma un grant permanente con un ancla en Gastronomía. El grant **no necesita
   que exista nada previo** —es la diferencia que `DEC-GRANT-006` usa para justificar su propia
   asimetría— y `S13` cancela *«toda fila viva del beneficiario en cada vertical que el grant
   ancla»* (`B/03` §3.2): acá no hay ninguna.
3. El contrato emite la fuente: *«grant … una fuente `VERTICAL` **por cada vertical de su
   scope**»* (`12-contrato…` §2.7), con `tipo: GRANT` y `hasta: NO_VENCE`. La tabla de clases la
   clasifica **`TÍTULO`**: *«| `GRANT` | — | `TÍTULO` | — | — |»* (§2.4).
4. **`T2` dispara.** Su evento, después del arreglo: *«| T2 | `TRIAL_ACTIVE` | **aparece una
   fuente viva de clase `TÍTULO` que no es la del trial** | `TRIAL_CONVERTED` | — |»* (`V/03`
   §2). Y el propio § lo dice sin ambigüedad en su tabla de *«qué gana cada fila»*: *«ahora
   alcanza también a quien **recupera** (`S7`), **reanuda** (`S10`) o **recibe una cortesía o un
   grant durante el trial**»*.
5. **`TRIAL_CONVERTED` es terminal.** Conté los valores de la columna `desde` de las seis filas
   de `V/03` §2: `PRE_TRIAL` (×2), `TRIAL_ACTIVE` (×3), `TRIAL_EXPIRED` (×1). **`TRIAL_CONVERTED`
   no aparece en ninguna.** Y la fila no se borra: *«`UNIQUE(user_id, vertical)` — **sin
   condición de estado** … el trial es único **de por vida**, así que la fila sobrevive a todo y
   su sola existencia niega un trial nuevo»* (`V/02` §2.2), reforzado por
   `UNIQUE(hash_del_correo_normalizado, vertical)`, que cierra hasta el re-registro.
6. **La revocación existe, es un acto declarado y es el más grave del catálogo**: *«| otorgar o
   revocar un **grant permanente** | §35, §35.4 | **sí**, y la más grave: revocar deja al cliente
   **sin grant y sin suscripción**, o sea sin servicio |»* (`NUCLEO/08` §3).
7. Revocado el grant, `cubierto` pasa a falso, `PB2` despublica (`V/03` §9) y el conjunto
   efectivo cae al piso, que otorga *«**ninguna capacidad comercial**, y la de contratar una
   suscripción»* (`V/02` §2.1). El trial no vuelve: `T5` sale de `TRIAL_EXPIRED`, no de
   `TRIAL_CONVERTED`.
8. **La segunda puerta es `T6`, y es la más frecuente.** Quien ya tiene el grant y **después**
   publica cae en *«| T6 | `PRE_TRIAL` | … **y** `cubierto` es **verdadero** | `TRIAL_CONVERTED` |
   … **crea la fila de `trial`, consumida** |»*. El mismo desenlace, sin pasar por
   `TRIAL_ACTIVE`.

**Dónde lo permite el diseño.** Las siete citas de arriba. La justificación de consumir, tal como
está escrita, **sólo cubre la suscripción**: *«la condición garantiza que hay un título vivo, así
que no necesita probar lo que ya tiene»* y *«sin escribirla esa persona **se guardaría un trial
para el día que cancele** — un trial gratis para quien ya fue cliente»* (`V/03` §2). El sujeto de
esa frase es alguien que **contrató**; el beneficiario de un grant no contrató nada y no eligió
nada. `B/14` §4.3 usa el mismo argumento para la cortesía y lo acota explícitamente a lo que el
grant sí es: *«no es una pérdida — el grant es estrictamente mejor **y para siempre**»*. El
diseño, en el renglón de al lado, declara que ese «para siempre» se puede revocar.

Y la confirmación que debería avisarlo no puede: `NUCLEO/08` §3.1 regla 1 exige que *«la
confirmación dice qué va a pasar»*, y el texto que `DEC-GRANT-001` pide para la revocación
—*«estás cortando el servicio de alguien»*— se escribió antes de que revocar también quemara un
trial.

**Severidad.** `CRITICA` — *«un dato se pierde sin vuelta»*, sobre el activo que la spec entera
declara único de por vida, protegido por dos `UNIQUE` sin condición de estado y por la ausencia
deliberada de toda transición de retorno. La pérdida la causa un acto nuestro, sobre una persona
que no pidió nada, y no tiene reparación declarada: los dos instrumentos de `V/11` §2.3 son una
extensión sobre un `TRIAL_ACTIVE` que ya no existe, y una cortesía sobre *«la suscripción que
tome después»* — o sea, sobre algo que la persona todavía tiene que pagar.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2** (la familia del trial: *«`T2`/`T5`
se disparan por «aparece una fuente viva de clase `TÍTULO`»»*, y `T6` reescrita sobre `cubierto`).
Antes de la tanda, `T2` decía *«se autoriza una suscripción»* y `T6` *«ya hay una suscripción
viva»*: **un grant no disparaba ninguna de las dos**. El defecto que el arreglo cerraba era el
contrario —el trial colgado conviviendo con un título— y la corrección amplió el disparador a las
cuatro fuentes de clase `TÍTULO` **sin separar las que son del cliente de las que le imponemos**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es el evento de
`T2`/`T6` —*«se autoriza una suscripción»* / *«una suscripción viva»* → *«fuente viva de clase
`TÍTULO`»* / `cubierto`— y el commit lo grepeó: su mensaje declara 110 apariciones de «vivo/viva»
inspeccionadas, y verifiqué que `V/11` §6.3, `V/11` §5.1 y `V/10` §2 quedaron corregidas por esa
pasada. **El consumidor que se rompe no contiene ninguno de los dos términos**: es
`NUCLEO/08` §3, fila *«otorgar o **revocar** un grant permanente»*, que no dice «vivo», no dice
«cubierto» y no dice «trial». Lo habría dado grepear **el término que el arreglo trae al alcance
por primera vez** —`grant`, `cortesía`, `revocar`—, que es la pregunta inversa a la que la regla
hace. Es el modo que `DEC-METH-009` declara no cubrir pero por otra razón que la que declara: no
es una premisa que envejece, es un consumidor nuevo que el arreglo **adquiere** y que no comparte
vocabulario con lo que cambió.

---

## ALTAS

### F-8dA1-002 — `DEC-GRANT-006` dejó el §34.1 sin ningún instrumento que lo ejecute, y cuatro lugares lo siguen nombrando: `T4` tiene un evento sin productor y la reparación de `V/11` §2.3 no se puede hacer

**Qué se rompe.** La cortesía durante un trial —§34.1 del PDR, *«extiende el trial»*— **ya no se
puede expresar en ningún lado**: la fila necesita una suscripción que no existe y la transición
que la produce exige un estado que es incompatible con tener un trial corriendo. Con eso caen
tres cosas que dependen de ella: `T4` queda con la mitad de su evento sin productor, el techo de
días de trial de `V/11` §3 pierde uno de los dos instrumentos sobre los que se justifica, y **la
reparación que `V/11` §2.3 le promete a quien le bajamos la ficha por error queda sin mecanismo**.

**El camino.**

1. La fila no se puede escribir: *«| **`courtesy_grant`** | beneficiario, días o meses, inicio,
   fin, quién lo firmó, motivo, **la suscripción que pausa** | … la suscripción **no es
   anulable**; **sin `scope`** — la cortesía es por suscripción (`DEC-GRANT-006`) |*» (`B/02`
   §2.4). Sin suscripción en esa vertical, no hay fila.
2. Y la transición que la produce exige `ACTIVE`: *«| S9 | **`ACTIVE`** | `SUPER_ADMIN` otorga
   cortesía | `PAUSED` *(motivo `COURTESY`)* | no hay pausa vigente |»* (`B/03` §3.2). Es la
   única fila de las nueve máquinas cuyo evento es *«otorga cortesía»* — lo conté con `rg` sobre
   `B/03`.
3. **Y un `ACTIVE` es incompatible con un trial corriendo**, así que el caso no se alcanza por
   ningún lado: una suscripción `ACTIVE` emite fuente con `hasta: SIN_FECHA_CONOCIDA`
   (`12-contrato…` §2.6), o sea `cubierto` verdadero, y con `cubierto` verdadero `T1` **no
   dispara** y `T6` escribe la fila ya consumida. Quien tiene una `ACTIVE` no tiene un trial
   corriendo al que extenderle nada.
4. `T4` sigue nombrándolo igual: *«| T4 | `TRIAL_ACTIVE` | **promo de extensión o cortesía** |
   `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) | corre la fecha de fin |»* (`V/03` §2).
   La mitad «o cortesía» **no tiene productor en ninguna tabla del programa**.
5. `V/11` §3.2 apoya el techo en que son dos: *«Toda extensión cuenta contra ese mismo techo,
   venga de un promo del §32 o de **una cortesía del §34.1**: se acumulan»*, y su párrafo de
   justificación —*«Sin un techo único, dos instrumentos distintos con tope propio se suman»*—
   queda sin su segundo instrumento.
6. `V/11` §3.4 reparte el techo por quién firma: *«Un canje de promo es self-service y el techo lo
   frena en seco. **Una extensión firmada por `SUPER_ADMIN` puede pasarlo**»*. La vía de
   `SUPER_ADMIN` era la cortesía. `NUCLEO/08` §3 lista *«**extender un trial**»* como acción
   administrativa, y **esa acción no figura como evento de ninguna transición**: `T4` enumera dos
   eventos y ninguno es ella. Por `NUCLEO/03` §1 regla 1, *«lo que no está, no pasa … se registra
   como evento de dominio y, si tocaba plata o estado, **pone la marca**»*.
7. Resultado sobre `V/11` §2.3, que es donde duele: *«| el trial está en **`TRIAL_ACTIVE`** | una
   extensión por los días perdidos: **es T4**, la transición que ya existe | … |»*, y *«**Las dos
   las firma `SUPER_ADMIN`** con motivo escrito»*. La primera fila de esa tabla —la reparación de
   **nuestro** error mientras el trial corre— no tiene camino.
8. `B/14` §4.4 lo da por resuelto en otro capítulo: *«Ya está resuelto en el capítulo 11 §3: las
   **dos** extienden, acumulan contra un único techo»*.

**Dónde lo permite el diseño.** Las ocho citas. Y `DEC-GRANT-006` **nombra el hueco y lo usa como
argumento en vez de resolverlo**: *«qué hace la cortesía en una vertical donde el beneficiario NO
tiene suscripción. El PDR trae media respuesta y en dos mecanismos distintos —**§34.1** «durante
trial: extiende el trial», **§34.2** … Un instrumento con tres comportamientos según lo que
encuentre no es un scope: son tres instrumentos con un nombre»*. El razonamiento es correcto
**contra el scope plural**, que es lo que estaba decidiendo; el §34.1 no es un caso de scope
—ocurre en **una** vertical— y se fue con el scope sin que nadie lo decidiera.

**Severidad.** `ALTA` — deja sin ejecutor a la única reparación declarada de un daño que nosotros
causamos, sobre un recurso irreversible, y vacía la justificación del techo de días de trial. No
es `CRITICA` porque no abre acceso indebido y porque para el trial **ya vencido** el instrumento
alternativo existe y está escrito (`V/11` §2.3, segunda fila).

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-GRANT-006`** (`50c3e2196`), sobre una columna
que la 9-bis ya había vuelto no anulable. Antes de la decisión quedaba viva una lectura —el
`scope` plural, declarado abierto en `B/02` §2.4— bajo la cual una cortesía podía alcanzar una
vertical sin suscripción; la decisión la cerró y **no le dio domicilio al §34.1**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y con el término más obvio de los
dos.** El término redefinido es `courtesy_grant.scope` / *«la cortesía es por suscripción»*.
`rg -n "cortesía"` sobre los capítulos que `50c3e2196` **no toca** —el commit tocó sólo el
decision log, `12-contrato…`, `V/03` y `B/02`— devuelve exactamente las apariciones que quedaron
falsas: `V/11` líneas 110, 119 y 96, `B/14` línea 25 y §4.4, `B/03` línea 98 (`S9`) y
`NUCLEO/08` línea 136. **El commit no declara `DEC-METH-009` en su mensaje**, y es uno de los
cuatro de la tanda que no lo hacen. La regla no falló: no se corrió.

---

### F-8dA1-003 — El conjunto plegable de `V/15` §2.6 no lleva el recorte de `V/11` §5.3, así que un addon `USER`/`GLOBAL` vuelve a aportar en la vertical donde el único título es un trial — y `G-R2` lo certifica correcto

**Qué se rompe.** El arreglo 5 escribió por fin el gate del pliegue **donde se ejecuta**, y al
escribirlo lo definió en positivo: el conjunto plegable **son** los `TÍTULO` y `BASE` más los
`COMPLEMENTO` si hay título. Un trial en `TRIAL_ACTIVE` **es** un `TÍTULO`, así que por esa
definición un addon de scope `USER` o `GLOBAL` entra en el pliegue de la vertical que la persona
está **probando** — exactamente lo que `V/11` §5.3 prohíbe con una regla propia y lo que `V/17`
§2.4 cita como el caso resuelto. La regla vieja sobrevive escrita en dos capítulos y **no está en
el único § que define lo que se pliega**, ni en el guard que lo vigila.

**El camino.**

1. La persona tiene una suscripción real en Alojamiento y compra un addon de scope `GLOBAL`. Es
   legítimo: *«**¿Puede comprarlo?** **Sí.** El §38 pide «una subscription válida compatible» y la
   tiene»* (`V/11` §5.2).
2. Entra a Gastronomía y publica. `cubierto` en Gastronomía es falso, así que `T1` dispara y queda
   en `TRIAL_ACTIVE` (`V/03` §2).
3. `cobertura(user, GASTRONOMÍA)` devuelve la fuente del trial —`tipo: TRIAL`, `hasta: la fecha de
   fin`, clase **`TÍTULO`** por la tabla del `12-contrato…` §2.4— y la fuente `ADDON` de alcance
   `GLOBAL`, clase `COMPLEMENTO`.
4. El paso 6 abre `V/15` §2.6, que es el § que el arreglo declara canónico y al que `§2.2` manda a
   todas las estrategias: *«Las cuatro estrategias pliegan el MISMO conjunto de fuentes … Es el
   que queda **después** del descarte del §2.6»*. Y el §2.6 dice:

   > **El conjunto plegable de un `user + vertical` son sus fuentes de clase `TÍTULO` y `BASE`,
   > más las de clase `COMPLEMENTO` SÓLO SI hay al menos una de clase `TÍTULO` viva.**

   Hay una de clase `TÍTULO` viva: el trial. **El addon entra.**
5. `V/11` §5.3 dice lo contrario, y con su razón: *«**Un addon de scope `USER` o `GLOBAL` no
   aporta nada a una vertical cuyo único título es un trial.** Sin ella, la resolución de
   entitlements … sumaría el addon en **todas** las verticales, trial incluido, y **rompería el
   invariante §64.7** sin que ninguna línea de código diga «trial»»*.
6. Ningún guard dirime. `G-R2` está escrito sobre el caso complementario: *«el pliegue del
   conjunto efectivo **recibe una fuente de clase `COMPLEMENTO`** cuando el conjunto **no tiene
   ninguna** de clase `TÍTULO` viva»* (`V/20` §2). Acá sí la tiene, así que el guard **pasa**, y
   pasando certifica como correcto el desenlace que `V/11` §5.3 prohíbe. Recorrí los 14 guards de
   `V/20` §2: ninguno mira el caso del trial.

**Dónde lo permite el diseño.** `V/15` §2.2 y §2.6, `V/20` §2 (`G-R2`), contra `V/11` §5.3 y
contra `V/17` §2.4, que lo da por hecho: *«El capítulo 11 §5.3 ya usó exactamente esto para
decidir que un addon global **no** aporta a una vertical cuyo único título es un trial»*. Y el
§2.6 enumera *«tres casos que NO cambian»* —el grant, el piso, el descarte— y **el trial no está
entre ellos**, ni como excepción ni como caso que sí cambia.

**Severidad.** `ALTA` — es el invariante §64.7 incumplido por el § que el arreglo acaba de
declarar canónico, y el guard nuevo lo firma. No es `CRITICA` porque la capacidad que se filtra
está pagada por esa persona y su scope es global por declaración: nadie paga de más ni de menos y
nada se pierde. Lo que se rompe es el corte que el §10.5 pide y la regla que `V/11` §5.3 escribió
para sostenerlo.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 5** (`V/15` §2.6, el conjunto
plegable). Antes, `V/15` §2.2 decía *«suma todas las fuentes vivas»* —incorrecto, y es
`F-8cA1-007`— y `V/11` §5.3 era una excepción **encima** de esa frase. El arreglo reemplazó la
frase por una **definición cerrada** y no reabsorbió la excepción: pasó de una regla ancha con un
recorte declarado en otro capítulo a una regla precisa que el recorte contradice, que es peor,
porque ahora hay dos enunciados normativos y el que tiene guard es el que se equivoca.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término que el arreglo introduce
es *«conjunto plegable»*, que es **nuevo** y por lo tanto no aparece en ningún capítulo previo
—lo verifiqué: `rg -n "conjunto plegable"` devuelve sólo `V/15` y `V/20`, los dos del commit—. Y
el término que reemplaza, *«todas las fuentes vivas»*, tampoco aparece en `V/11` §5.3: esa sección
dice *«sumaría el addon en todas las verticales»*, sin ninguno de los dos términos. `rg -n
"pliegue"` sobre lo no tocado sí devuelve `V/03` §2, pero no `V/11`. **Un grep por el término
redefinido no encuentra un consumidor que expresa la misma regla con otras palabras**, y es el
segundo caso del mismo modo que el `CRITICA`.

---

### F-8dA1-004 — El trinquete por vertical del grant lo resuelve verticales sobre un piso que la fuente no transporta, y `G-R2-B` declara vigilarlo mirando sólo el plan

**Qué se rompe.** El arreglo 4 puso el piso del trinquete **por vertical**, dentro de
`permanent_grant_vertical`, que es una tabla de **billing**, y escribió en `V/15` §2.5 que la
resolución *«toma la fuente `GRANT` de esa vertical —con el plan de esa vertical **y el piso de
esa vertical**—»*. La fuente del contrato tiene **cinco campos** y ninguno es el piso. Así que el
trinquete —la promesa *«un grant nunca otorga menos de lo que otorgaba el día que se concedió»*—
**no se puede evaluar del lado que tiene que evaluarlo**, y la única salida obvia es meterle a la
frontera un campo que el §4 no tiene.

**El camino.**

1. El piso vive en billing: *«| **`permanent_grant_vertical`** | el ancla … el `plan` que otorga
   en esa vertical y **el piso del trinquete de esa vertical** | … el piso tampoco es anulable |»*
   (`B/02` §2.4).
2. El trinquete lo calcula verticales: *«El trinquete tiene un segundo sujeto … **Y se compara POR
   VERTICAL, que es la parte que la resolución no puede deducir sola.** La resolución de un `user
   + vertical` toma **la fuente `GRANT`de esa vertical** —con el plan de esa vertical y el piso
   de esa vertical— y **ninguna otra**»* (`V/15` §2.5).
3. La fuente no lo lleva. Conté los campos del `12-contrato…` §2: `tipo`, `referencia`, `alcance`,
   `objetivo`, `hasta`. **Cinco.** Y `referencia` es *«una versión de plan o una versión de
   addon»*, singular, definida en §2.3 como *«la referencia, no los valores»*.
4. Y el §4 cierra la otra puerta: *«**No cruzan los valores de lo que otorga una fuente** — ni los
   del plan, ni los del addon, ni los de un grant. Sólo la referencia»*.
5. Las dos ramas. **Rama A**: el trinquete no se evalúa. Se publica una versión nueva del plan
   anclado que reparte distinto, el grant sigue la vigente (`V/10` §2, fila 5) y el beneficiario
   **pierde en silencio** lo que su «para siempre» le daba — exactamente el daño que el trinquete
   se escribió para impedir, con la razón textual *«le sacaría algo a quien tiene un «para
   siempre», sin que nadie lo haya decidido para esa persona»*. **Rama B**: billing agrega un
   sexto campo a la fuente, que es la regla de vigilancia del §4.2 disparándose —*«si billing
   necesita … algo que no está en los seis campos del §4.1»*— sin que nadie la corra.
6. El guard no cubre ninguna de las dos. `V/15` §2.5 cierra con *«Lo vigila `G-R2-B`»*, y el
   predicado de `G-R2-B` es otro: *«una fuente `GRANT` transporta **un plan de otra vertical** que
   la de la fuente»* (`V/20` §2). **El plan, no el piso.** Es la regla del capítulo 20 §2.1 al
   revés: *«el texto con que falla no puede afirmar más de lo que el predicado verifica»*, acá
   sobre el § que lo invoca en vez de sobre el mensaje.

**Dónde lo permite el diseño.** Las seis citas. Y `12-contrato…` §2.8, que enuncia el trinquete
como propiedad del grant —*«Cada ancla guarda **su** piso, y se compara contra el plan **de esa
misma vertical**»*— sin agregarle nada a la firma de la fuente que el mismo documento define
veinte párrafos más arriba.

**Severidad.** `ALTA` — la rama que el diseño produce hoy es que un instrumento firmado por
`SUPER_ADMIN` con la promesa explícita de no empeorar nunca **empeore sin que nadie lo decida**, y
la rama alternativa abre la frontera. No es `CRITICA` porque falla hacia dar de menos y porque el
dato no se pierde: el piso está guardado, lo que falta es el transporte.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 4, y agrava `F-8bA1-005`**, que sigue llegando
desde la 8-bis. Lo nuevo no es que el piso esté del lado de billing —eso ya estaba— sino que el
arreglo **escribió en `V/15` §2.5 una afirmación sobre el contenido de la fuente que es falsa**
(*«la fuente `GRANT` … con el plan de esa vertical y el piso de esa vertical»*) y le colgó un
guard que no la verifica. Antes, `V/15` §2.5 decía *«guardado en la fila»*, que era vago; ahora es
preciso y falso.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, por el alcance de la regla.** El
término redefinido es `piso_del_trinquete` / *«el piso del trinquete de esa vertical»*, y los tres
lugares donde vive —`V/15` §2.5, `V/20` §2 y `B/02` §2.4— **los toca el mismo commit**
`1ca12d709`. La búsqueda que la regla manda es *«sobre los capítulos que el commit NO toca»*, y el
desajuste está entre dos secciones que el commit **sí** toca, más una —los cinco campos de la
fuente en `12-contrato…` §2— que el commit también edita en otro §. La regla no puede ver esto
por construcción.

---

### F-8dA1-005 — Anclar un plan a un grant en una vertical es un acto administrativo nuevo que no está entre las doce de `NUCLEO/08` §3: sin permiso propio, sin confirmación, y con los pasos 5-7 sobre el sujeto

**Qué se rompe.** Desde el arreglo 4, el scope de un grant **no es una columna: es el conjunto de
anclas**, así que extender un *Free Forever* a una vertical es **escribir una fila en
`permanent_grant_vertical`**. Ese acto concede servicio gratuito permanente en una vertical
nueva, y **no existe en el catálogo de acciones administrativas**. La regla que da permisos
cuantifica sobre ese catálogo, así que el acto no tiene permiso declarado; la regla que decide
sobre quién se evalúan los pasos 5-7 también, así que por defecto se evalúan **sobre el sujeto**,
que por definición no tiene la capacidad que se le está por conceder. Las dos ramas rompen algo, y
la practicable es la que el propio hueco `M-AUTH-02` nombra como el vector de abuso.

**El camino.**

1. El acto existe y está declarado, dos veces: *«extenderlo a una vertical nueva es **anclarle un
   plan**, que es un acto de `SUPER_ADMIN` y **queda auditado como cualquier otro**»*
   (`12-contrato…` §2.8), y *«extenderlo a una vertical nueva es anclarle un plan, un acto de
   `SUPER_ADMIN` que queda auditado»* (`B/02` §2.4).
2. *«Como cualquier otro»* apunta a `NUCLEO/08` §3, y **no está ahí**. Conté las filas de esa
   tabla: **doce**, y son otorgar/revocar cortesía, otorgar/revocar grant, registrar pago manual,
   confirmar que no se pagó, aprobar/rechazar postulación, configurar plan y método de un Partner,
   levantar la marca, cancelar, pausar/reanudar, cambiar de plan, extender un trial, reembolsar.
   **Anclar no está**, y *«otorgar un grant»* no lo contiene: el grant ya está otorgado, y `S13`
   —*«`SUPER_ADMIN` otorga *Free Forever*»*— es el evento de la concesión, no el de una extensión
   posterior.
3. Sin entrada, no hay permiso: *«**`actor ≠ sujeto` exige un permiso de esa acción concreta**, no
   una condición general de «es administrador». **Las doce acciones del capítulo 08 §3 llevan
   permiso propio, una por una**»* (`V/17` §3.2, regla 1).
4. Sin entrada, los pasos 5-7 caen sobre el sujeto: *«**El admin no hereda los entitlements del
   sujeto.** Los pasos 5, 6 y 7 se evalúan **sobre el sujeto** … La excepción está declarada y es
   acotada: **las doce acciones del capítulo 08 §3 son capacidades del actor**… **A qué clase
   pertenece una operación se declara, nunca se infiere**»* (`V/17` §3.2, regla 3). El paso 6
   sobre el beneficiario en la vertical nueva resuelve contra el piso, que no otorga ninguna
   capacidad comercial: **la operación se rechaza**.
5. Y sin entrada tampoco hay confirmación, que es la tercera cosa que el catálogo da: *«Cada
   acción lleva tres cosas: permiso propio, registro de auditoría, y **confirmación explícita si
   es destructiva o mueve dinero**»* (`NUCLEO/08` §3). Anclar concede servicio gratuito
   permanente; **desanclar** —que el diseño no declara pero que es la única forma de reducir un
   scope sin revocar el grant entero— corta el servicio en una vertical, y sería la mitad de *«la
   acción administrativa más grave»* sin ninguna de sus tres protecciones.
6. La rama practicable es declarar *«el admin puede anclar»*, que es la condición general que la
   regla 1 prohíbe con esas palabras, sobre el instrumento que el invariante §64.30 reserva a
   `SUPER_ADMIN` —*«| 30 | sólo `SUPER_ADMIN` otorga *Free Forever* | **la autorización de esa
   operación** |»* (`NUCLEO/04` §2)—: una autorización que apunta a una operación que no está en
   ningún catálogo.

**Dónde lo permite el diseño.** Las seis citas. Y `NUCLEO/08` §1.1 confirma que el acto **es**
auditable por criterio —*«cambia el acceso de alguien … un grant»*—, lo que hace más visible que
lo que falta no es la auditoría sino **el permiso y la clase**, que es lo que sólo el catálogo da.

**Severidad.** `ALTA` — deja sin control declarado el acto que amplía el instrumento más caro del
sistema, en las dos direcciones: la rama honesta lo vuelve inejecutable y la rama practicable es
el *«es administrador»* general con el que `M-AUTH-02` justificó su propia existencia. No es
`CRITICA` porque el acceso indebido depende de que se tome la segunda rama y porque el contrato sí
dice, en prosa, que es de `SUPER_ADMIN`.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 4.** Antes, el scope era una columna de
`permanent_grant` y cambiarlo era editar el grant, o sea parte de *«otorgar … un grant
permanente»*. Al convertir el scope en **un conjunto de filas de otra tabla**, el arreglo creó una
operación de escritura que antes no existía como tal, y la declaró *«un acto de `SUPER_ADMIN`»* en
el contrato en vez de en el catálogo que reparte permisos. Es el mismo defecto de domicilio que
`F-8cA1-005` tenía para las lecturas del admin, sobre una escritura.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y es la cuarta aparición del mismo
término.** El término redefinido es *«el scope de verticales»* del grant —que pasa de columna a
conjunto de anclas—, y el commit `1ca12d709` **no toca `NUCLEO/08`**. `rg -n "grant"` sobre
`NUCLEO/08` devuelve la fila *«otorgar o revocar un grant permanente»* y `§1.1`; resolverlas contra
el significado nuevo obligaba a preguntarse si *«otorgar»* cubre *«anclar»*. La misma búsqueda, en
el mismo archivo no tocado, es la que habría dado también el `CRITICA`.

---

## MEDIAS

### F-8dA1-006 — `T2` y `T4` salen del mismo estado y dan veredictos opuestos para el mismo acto, y `G-R4` no los ve porque las dos filas escriben el evento con otras palabras

**Qué se rompe.** En la tabla de `V/03` §2 conviven, desde el arreglo, dos filas con origen
`TRIAL_ACTIVE` que se disparan con el mismo hecho del mundo —*«a esta persona le dieron una
cortesía»*— y llevan a destinos opuestos: `T4` extiende el trial y `T2` lo declara convertido.
`G-R4`, el guard que existe para esto, no las cuenta como un par porque su predicado es
sintáctico: compara `(desde, evento)` y los dos eventos están escritos distinto.

**El camino.**

1. Las dos filas, textuales (`V/03` §2):

   | # | desde | evento | hacia |
   |---|---|---|---|
   | T2 | `TRIAL_ACTIVE` | **aparece una fuente viva de clase `TÍTULO` que no es la del trial** | `TRIAL_CONVERTED` |
   | T4 | `TRIAL_ACTIVE` | **promo de extensión o cortesía** | `TRIAL_ACTIVE` |

2. Una cortesía es una fuente de clase `TÍTULO`: *«| `PAUSED` por `COURTESY` | **sí**, como `tipo:
   CORTESÍA` | la fecha de fin de la cortesía |»* (`12-contrato…` §2.6) y *«| `CORTESÍA` |
   `TÍTULO` | — | — | — |»* (§2.4). Satisface el evento de `T2` palabra por palabra.
3. El propio § elige la rama de `T2` en su prosa: *«ahora alcanza también a quien … **recibe una
   cortesía o un grant durante el trial**»*. Eso contradice al §34.1 del PDR —*«Durante trial:
   extiende el trial»*—, a `V/11` §3.2 y a `B/14` §4.4.
4. `G-R4` no dirime: *«una tabla de transiciones tiene **dos filas con el mismo `(desde,
   evento)`** cuyas guardas **no son disjuntas**»* (`V/20` §2). Los dos eventos son cadenas
   distintas, así que no hay par que contar. Y `NUCLEO/03` §1 regla 7 enumera **tres** pares
   declarados —`T1`/`T6`, `S5`/`S19`, `S7`/`S19`— y afirma que *«que sean tres y no cuatro no es
   una afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR»*: el conteo es correcto
   bajo su propio predicado y no dice nada de esta colisión.
5. Si `F-8dA1-002` se corrige dándole domicilio al §34.1, el par se vuelve alcanzable y la tabla
   queda con dos desenlaces para el mismo acto, sin precedencia — que es lo que `NUCLEO/03` §1
   regla 7 declara *«un defecto de la tabla»*.

**Dónde lo permite el diseño.** Las cuatro citas, más `V/20` §2, que explica por qué `G-R4` y
`G-R4-B` hacen falta los dos —*«El primero mira **la forma** de una tabla»*— y con eso nombra su
propio límite: mirar la forma no alcanza cuando dos filas describen el mismo hecho con vocabulario
distinto.

**Severidad.** `MEDIA` — hoy no es alcanzable, porque `F-8dA1-002` deja al §34.1 sin instrumento;
lo que está roto es la propiedad que vuelve determinista a la máquina, y el guard que debería
sostenerla mira una forma que la colisión no tiene. Sube de `BAJA` porque el arreglo del `002` la
vuelve alcanzable sin que nada avise.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2.** `T4` no se tocó —lo verifiqué en el
diff de `49eb99f34`: la línea de `T4` está intacta— y `T2` pasó de *«se autoriza una suscripción»*,
que una cortesía **no** satisface, a *«aparece una fuente viva de clase `TÍTULO`»*, que sí.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y es el caso más limpio del punto ciego
de la regla.** El término redefinido es el evento de `T2`, y la fila con la que colisiona está
**dos renglones más arriba en la misma tabla del mismo archivo que el commit edita**. La
obligación 2 manda buscar *«sobre los capítulos que el commit NO toca»*, así que el alcance de la
regla **excluye explícitamente** el lugar donde está el defecto. Y el término viejo tampoco
ayudaba: `T4` no dice «suscripción», dice «cortesía».

---

### F-8dA1-007 — Hay TRES versiones no vendibles por vertical y cinco documentos dicen «las dos»; la fuente de trial en `TRIAL_ACTIVE` es el séptimo lector de un catálogo que `V/10` §2 declara cerrado en seis

**Qué se rompe.** El arreglo del `V/10` §2 enumeró los lectores del catálogo y cerró con *«las
**seis** filas quedan del lado correcto **sin excepción**»*. Falta uno, y es el más poblado: la
fuente de trial en `TRIAL_ACTIVE`, que lee **la versión del plan de trial**. Y el conteo vecino
—*«las dos versiones no vendibles de una vertical»*— es falso sobre el modelo: `V/02` §2.1 declara
**tres** planes no vendibles por vertical, y **nada en el modelo dice cuál es cuál**, así que
`G-R3` no tiene sujeto sobre el que cuantificar.

**El camino.**

1. Los tres, contados sobre `V/02` §2.1: *«El plan de trial … Es un `plan` con su versión, marcado
   **no vendible**, uno por vertical»*; *«**El plan de pre-trial tampoco.** Es un `plan` con su
   versión, marcado **no vendible**, uno por vertical»*; *«**El plan de piso tampoco** … marcado
   **no vendible**, **uno por vertical**»*.
2. El mismo capítulo usa *«los dos no vendibles»* para **dos pares distintos**, a 26 líneas de
   distancia: *«La asimetría entre **los dos planes no vendibles** es deliberada»* (línea 154), con
   la tabla de abajo comparando **trial contra pre-trial**; y *«**Las dos versiones no vendibles**
   son un punto único de falla»* (línea 180), que a renglón seguido dice *«a la de piso o a la de
   pre-trial»*. Dos pares, tres planes, una frase.
3. El resto del corpus repite la frase y hereda el par de la segunda: `G-R3` (`V/20` §2), `V/17`
   §1.3, `V/10` §2.1 y `12-contrato…` §2.5 y §5.1. Conté las apariciones con
   `rg -n "dos versiones no vendibles"`: **cinco documentos**.
4. **Nada distingue cuál plan es cuál.** `V/02` §2.1 los declara como tres `plan` con
   `vendible = false` y `UNIQUE(vertical, slug)`; el capítulo le dio a `vertical` una columna
   `evento_de_activacion` **porque sin ella el guard no verificaba nada**, y no le dio ninguna que
   diga cuál plan es el piso, cuál el pre-trial y cuál el de trial. `G-R3` implementado sobre
   *«toda versión no vendible»* falla sobre el plan de trial, que **tiene que** otorgar claves
   comerciales porque *«sus limits y entitlements no se guardan: se derivan … del plan vendible de
   `rank` más alto»*. Implementado sobre *«las dos»*, no hay forma de identificarlas.
5. El séptimo lector: `V/03` §2 declara que en `TRIAL_ACTIVE` la `referencia` de la fuente es *«la
   versión del **plan de trial**»*. Recorrí las seis filas de `V/10` §2 y ninguna la cubre: la
   fila 3 es *«la derivación del plan de trial»*, que lee **el premium y el más bajo**, no la
   versión del plan de trial; la fila 6 dice *«una fuente `BASE`, y una fuente de trial en
   **`PRE_TRIAL`**»*, explícitamente el otro estado.
6. El riesgo tiene dirección y el propio § lo nombra para los otros dos: *«si la resolución les
   exigiera `vendible`, **nadie tendría nada**, nunca»*. Quien implemente contra la tabla y no
   contra el enunciado le aplica al plan de trial la regla de la fila 1 —vigente **y** vendible— y
   **toda la población en `TRIAL_ACTIVE` se queda sin capacidades**.

**Dónde lo permite el diseño.** Las seis citas. Lo que salva el caso 6 es el enunciado que el
mismo § escribió —*«Una lectura que resuelve lo que ALGUIEN TIENE nunca exige `vendible`»*—, y por
eso esto no sube: la regla cubre al lector que la enumeración olvidó.

**Severidad.** `MEDIA` — no abre acceso por sí solo y el enunciado nuevo hace caer al lector
faltante del lado correcto. Lo que queda roto es una afirmación de completitud (*«las seis … sin
excepción»*) y un cuantificador que un guard necesita y no tiene: `G-R3` es, por declaración del
propio `V/20` §2, *«el que más carga lleva»*.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** *«Las dos versiones no vendibles»* es
preexistente —viene del arreglo que creó el piso, en la 9-bis—. Lo nuevo es la **enumeración
cerrada de seis lectores y su «sin excepción»**, que es del arreglo del `V/10` §2 de esta tanda
(`1ca12d709`, refinado por `49eb99f34`): antes eran cuatro filas y no pretendían ser el catálogo
completo de lecturas.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, para la mitad nueva.** El término
redefinido es la regla de lectura de catálogo —*«vigente»* / *«vendible»* y el enunciado que la
reemplaza—. `rg -n "no vendible"` sobre los capítulos que `1ca12d709` **no toca** devuelve
`V/17` §1.3 y `12-contrato…` §5.1 con el conteo viejo, y `rg` dentro del propio `V/02` —que el
commit **sí** toca— habría destapado los dos usos incompatibles de la misma frase. Es el tercer
caso en que la mitad del defecto está adentro del commit.

---

### F-8dA1-008 — La razón que sostiene la asimetría de `DEC-GRANT-006` —«una cortesía se vence sola, no hay revocación que se escape»— la desmiente el catálogo del núcleo, que declara la revocación de una cortesía como acción administrativa

**Qué se rompe.** `DEC-GRANT-006` decide lo contrario que el arreglo del grant —N cortesías
separadas contra un grant con N anclas— y **apoya esa asimetría en una sola razón**: que una
cortesía no se revoca. `NUCLEO/08` §3 dice que sí se revoca, y además que revocarla es
destructivo. Con la premisa falsa, el argumento que separa los dos instrumentos deja de separarlos:
N cortesías son N revocaciones de las que se puede olvidar una, que es literalmente el motivo por
el que «N grants» se rechazó el mismo día.

**El camino.**

1. La razón, textual (`01-decision-log.md`, `DEC-GRANT-006`): *«La razón de aquello fue que
   **revocar es la acción administrativa más grave del sistema** (`NUCLEO/08` §3) y con N
   instrumentos pasa a ser N actos, de los que se puede olvidar uno … **Ese argumento no existe en
   la cortesía: una cortesía se vence sola a los N días. No hay revocación que se pueda
   escapar.**»* La misma frase está en `B/02` §2.4.
2. El catálogo dice otra cosa, y es el mismo documento que la decisión cita: *«| **otorgar o
   revocar** una **cortesía temporal** | §34, `DEC-GRANT-002` | **sí**: revocar deja al cliente
   sin la cortesía que le quedaba |»* (`NUCLEO/08` §3, fila 1 de doce). Está clasificada como
   destructiva.
3. `V/15` §4.4 la trata como un disparador real del reconciliador de excedentes, junto a las otras
   pérdidas: *«| revocación de un grant · suspensión · fin del trial | **no** |»* para la ventana,
   y el §4.1 enumera *«termina una cortesía (§34)»* entre los seis casos.
4. Con la premisa corregida, la consecuencia operativa que la decisión descarta vuelve: dos
   cortesías sobre el mismo beneficiario en dos verticales son **dos revocaciones**, y olvidar una
   deja servicio regalado hasta su vencimiento — acotado en el tiempo, a diferencia del grant, pero
   no inexistente.

**Dónde lo permite el diseño.** Las tres citas. No discuto la decisión, que es del owner y está
tomada: lo que reporto es que **su única razón declarada contradice el capítulo que la decisión
cita como fuente**, y que `NUCLEO/00` fija al núcleo como *«el único lugar donde algo se define»*.

**Severidad.** `MEDIA` — no cambia el desenlace hoy (la capacidad no se pierde y el gesto único se
puede hacer de superficie), y el daño de una revocación olvidada está acotado por el vencimiento.
Lo reporto porque una razón caduca debajo de una conclusión defendible es lo que nadie vuelve a
mirar el día que alguien pregunte por qué los dos instrumentos se modelaron distinto.

**¿Es nuevo, o es el arreglo?** **Lo introdujo `DEC-GRANT-006`** (`50c3e2196`). La razón es nueva:
se escribió ese día para justificar la asimetría con el arreglo 4, que se había decidido horas
antes.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** `NUCLEO/08` está entre los capítulos
que `50c3e2196` **no toca** —el commit tocó cuatro archivos, ninguno del núcleo— y
`rg -n "cortesía"` sobre él devuelve exactamente la fila que desmiente la premisa, en la primera
línea de resultados. Es la misma búsqueda que habría dado `F-8dA1-002`, sobre el mismo commit que
no la declaró.

---

### F-8dA1-009 — `NUCLEO/01` no recibió ninguna de las dos redefiniciones de la tanda: la cortesía sigue sin domicilio de suscripción y el grant sigue «con su scope de verticales» — `NUCLEO`

**Qué se rompe.** El capítulo que *«fija los nombres»* y declara que *«nada de lo que esté acá se
redefine en otro capítulo»* quedó fuera de los dos cambios de modelo de la tanda. Su glosario y su
mapa conceptual describen dos instrumentos que ya no son los del modelo, y son el texto que la
regla del índice manda leer primero.

**El camino.**

1. La regla: *«Este capítulo fija **los nombres**. Todo lo que el resto de la spec use tiene que
   estar acá, y **nada de lo que esté acá se redefine en otro capítulo**»* (`NUCLEO/01`, apertura),
   reforzada por `NUCLEO/00`: *«**El núcleo es el único lugar donde algo se define.**»*
2. La cortesía, en el glosario: *«| **Cortesía temporal** | N días o meses de servicio sin cobrar,
   otorgados por `SUPER_ADMIN` (§34, `DEC-GRANT-002`). Se implementa **pausando** en el proveedor y
   sosteniendo el servicio de nuestro lado |»* (§1.5). **No dice que sea por suscripción**, que es
   lo que `DEC-GRANT-006` decidió y lo único que impide la lectura que la decisión prohíbe
   expresamente.
3. El mapa conceptual la cuelga del `User`, como hermana del grant y **fuera** del bloque *«por
   cada Vertical»* (§5):

   ```text
   ├── Suscripciones de complemento (una por addon recurrente, DEC-ADDON-002)
   ├── Cortesías temporales         (§34)
   └── Grant permanente             (§35, con su scope de verticales)
   ```

   Las dos líneas quedaron falsas el mismo día: la cortesía cuelga hoy de **una suscripción**, y el
   scope del grant **dejó de ser una propiedad suya** — *«El scope de verticales NO es una columna:
   son sus anclas»* (`B/02` §2.4).
4. `NUCLEO/01` §2.4 —la sección que la tanda **sí** escribió— enumera *«los cinco predicados de
   billing»* que usan «fila viva» y declara que los dos conjuntos difieren; el glosario de arriba,
   en el mismo archivo, no recibió nada.

**Dónde lo permite el diseño.** Las cuatro citas. Y el precedente está en el propio archivo:
`F-8cC1-002` se reportó porque *«vivo» decidía tres cosas caras y el glosario no lo definía*; la
tanda arregló esa palabra y dejó las dos entidades que cambiaron de forma.

**Severidad.** `MEDIA` — no decide nada por sí sola, pero es el documento que un implementador
abre primero y el único que el programa declara autoritativo para los nombres. `NUCLEO`.

**¿Es nuevo, o es el arreglo?** **Lo introdujeron los arreglos 4 y `DEC-GRANT-006`**, cada uno con
su mitad. Ninguno de los dos commits toca `NUCLEO/01` §1.5 ni §5 — lo verifiqué en los dos diffs:
`1ca12d709` no toca `NUCLEO/01` en absoluto y `49eb99f34` sólo le agrega el §2.4.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, las dos mitades.** `rg -n "scope de
verticales"` sobre lo que `1ca12d709` no toca devuelve `NUCLEO/01` §5; `rg -n "[Cc]ortesía"` sobre
lo que `50c3e2196` no toca devuelve `NUCLEO/01` §1.5 y §5. `1ca12d709` **declara** haber corrido
la regla y esta aparición no quedó ni corregida ni declarada correcta, así que es el único caso de
esta pasada en que la regla se declaró corrida y se le escapó una aparición literal del término.

---

## BAJA

### F-8dA1-010 — El `alcance` del contrato renombra `VERTICAL_SUBSCRIPTION` a `VERTICAL` diciendo que no renombra nada, y quedan tres vocabularios vivos para los cuatro scopes del §40

**Qué se rompe.** El contrato declara que su vocabulario de `alcance` **mapea** y no renombra
—*«no se renombra ninguno de los dos que ya conviven»*— y en la misma tabla colapsa
`VERTICAL_SUBSCRIPTION` en `VERTICAL`, que es además el valor que usa para la suscripción, la
cortesía, el trial y el piso. Quedan tres grafías vivas para el mismo scope y una colisión de
nombre entre *«el addon que cuelga de la suscripción de una vertical»* y *«la fuente que cubre una
vertical»*.

**El camino.**

1. El §40 del PDR: *«`LISTING`; **`VERTICAL_SUBSCRIPTION`**; `USER`; `GLOBAL`»*.
2. El contrato: *«| addon | los cuatro del §40 | `LISTING` · **`VERTICAL`** · `USER` · `GLOBAL` |»*
   y, en la fila de arriba, *«| suscripción, cortesía, trial, `BASE` | — (cubren su vertical) |
   **`VERTICAL`** |»* (`12-contrato…` §2.7), precedido de *«se declara su mapeo — **no se renombra
   ninguno de los dos que ya conviven**»*.
3. `V/11` §5.2 sigue con la grafía del PDR: *«| `VERTICAL_SUBSCRIPTION` | la suscripción de una
   vertical | el trial **no es una suscripción**: no hay a qué apuntar |»*.
4. `B/02` §2.4 usa una tercera: *«**objetivo** (ficha, **suscripción de vertical**, usuario o
   global)»*.
5. Y el `objetivo` se pierde en el camino: *«`objetivo` | la ficha, si `alcance = LISTING`; **nada
   en los otros tres**»* (§2.1), así que del lado de verticales un addon `VERTICAL_SUBSCRIPTION`
   llega indistinguible de una fuente que cubre la vertical entera. Hoy no cambia el resultado
   —los dos se pliegan en el tramo cacheado por `user + vertical`—, pero el argumento de `V/11`
   §5.2 *«no hay a qué apuntar»* deja de ser evaluable: no hay a qué apuntar porque el contrato
   quitó el campo, no porque el trial no sea una suscripción.

**Dónde lo permite el diseño.** Las cinco citas.

**Severidad.** `BAJA` — no cambia ninguna resolución hoy. Es vocabulario, y el programa ya tiene
escrito en `NUCLEO/01` §2.3 por qué eso importa: *«Un estado se llama igual en toda la spec, en la
base y en la API. No hay mapa de traducción entre capas. Si hiciera falta uno, es señal de que hay
dos vocabularios»*.

**¿Es nuevo, o es el arreglo?** **Es preexistente.** La tabla de mapeo del §2.7 es de la 9-bis y
ningún arreglo de esta tanda la tocó. No estuvo entre los 120 de la 8-bis-2 ni entre los 112 de la
8-bis; lo reporto porque `F-8dA1-003` me obligó a recorrer el alcance de las fuentes `COMPLEMENTO`
y aparece en el mismo renglón.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** No aplica: no lo introdujo ningún arreglo.

---

## Mis quince hallazgos de la 8-bis-2, reejecutados sobre el texto de hoy

No cuentan como hallazgos nuevos. Cada camino se volvió a correr paso por paso sobre el texto
vigente.

| ID | título, en corto | ¿corta? | dónde |
|---|---|---|---|
| `F-8cA1-001` | `T1`/`T6` comparten par y `T1` deja una fuente `TÍTULO` perpetua | **SÍ** | corta en el paso 3: `T1` gana *«y `cubierto` es **falso**»*, `T6` *«verdadero»*, y `NUCLEO/03` §1 regla 7 lo cuenta con `G-R4`. Disjuntas por construcción |
| `F-8cA1-002` | el grant ancla N planes en el contrato y uno en la tabla | **SÍ** | corta en el paso 2: `B/02` §2.4 trae `permanent_grant_vertical` con `UNIQUE(permanent_grant_id, vertical)` y *«el plan … pertenece a esa vertical»*, y `permanent_grant` perdió `plan_id`, `piso` y `scope` |
| `F-8cA1-003` | la mañana del corte no se despublica nada | — | **no se reporta**: `DEC-MIG-004` lo retiró con causa del owner |
| `F-8cA1-004` | la exención de las lecturas se dio en el paso que ya no rechaza | **NO** | llega entero: `V/17` §3.5 punto 1 sin tocar —*«no pasa por el 5 — y **sí por los otros ocho**»*— y el paso 6 sigue siendo el que rechaza al que sólo tiene el piso |
| `F-8cA1-005` | el admin del §48 lee ajeno y sus pasos 6-7 caen sobre el sujeto | **NO** | llega entero: `NUCLEO/08` §3 sigue con doce filas y ninguna es inspeccionar; `V/17` §3.2 reglas 1 y 3 intactas. Es la misma forma que `F-8dA1-005`, sobre una escritura |
| `F-8cA1-006` | «operación de dominio» perdió su definición | **NO** | llega entero: el término sigue sin definirse en `V/17` §3.5 y sigue siendo el cuantificador de §2.2, `G2` y `G-R3-C` |
| `F-8cA1-007` | el gate de los complementos vive en el contrato y no en `V/15` | **SÍ** | corta en el paso 3: `V/15` §2.6 existe, `§2.2` manda a él y `G-R2` lo vigila. Abrió `F-8dA1-003` |
| `F-8cA1-008` | la lista pasó a diez entradas y `V/15` §4.2 dice «sus siete» | **NO** | llega entero. Lo verifiqué con `rg -n "siete entradas"`: `V/15` línea 236, sin tocar, contra las diez filas de `V/02` §3.2 |
| `F-8cA1-009` | al espejo del §10.1 le falta `authorized × ACTIVE` | **NO** | llega entero: recorrí `B/03` §10.1 y `authorized` aparece con `PENDING_AUTHORIZATION`, con `PAUSED` y con `GRACE_PERIOD · SUSPENDED`; **con `ACTIVE` no**. Reclasificado `ALTA` por `C1` §3.3, y es vector de `B` |
| `F-8cA1-010` | la tabla 6 × 4 dice «tres imposibles» y trae dos | **NO** | llega entero: recontadas por mí las 24 celdas del `12-contrato…` §2.4 — 9 con clase, 2 «imposible» con razón, **13 mudas**. Sin cambios |
| `F-8cA1-011` | la derivación de la clase no es excluyente | **NO** | llega entero: `BASE` sigue siendo *«`tipo = BASE`, **o cualquier fuente con `hasta = SIN_EMPEZAR`**»* y `COMPLEMENTO` *«`tipo = ADDON`»*, sin precedencia |
| `F-8cA1-012` | `T6` quema el trial sobre «una suscripción viva» | **SÍ, en su forma** | corta: la condición es `cubierto`, y el residuo —quien está `SUSPENDED`, `PAUSED` o `PENDING_AUTHORIZATION`— lo decidió `DEC-TRIAL-008`. **La puerta que queda abierta es otra fuente**, y es `F-8dA1-001` |
| `F-8cA1-013` | el arreglo del grant citó a la cortesía como precedente | **SÍ** | corta: `rg -n "R5-D"` sobre el contrato y sobre `B/` no devuelve nada, y `courtesy_grant` perdió el `scope` (`DEC-GRANT-006`) |
| `F-8cA1-014` | «los otros ocho» sobre una tabla de siete pasos | **NO** | llega entero: `V/17` §1.1 sigue diciendo *«nueve pasos y una precondición»*, la tabla del §1.2 sigue numerada 1 a 7, y §3.5 sigue restando sobre nueve |
| `F-8cA1-015` | si `S17` falla quedan dos fuentes `SUSCRIPCIÓN` emitiendo | **SÍ, como hallazgo** | el desenlace no cambió, pero dejó de ser un hueco: `12-contrato…` §2.6 lo **declara** —*«Dos fuentes `SUSCRIPCIÓN` de clase `TÍTULO` … son posibles, y sólo en ese caso»*— con su razón (*«en esa rama el cliente está pagando las dos»*) y con las seis transiciones contadas |

**Cinco cortan** (`001`, `002`, `007`, `013`, `015`), **uno se retira por decisión** (`003`), **uno
corta en su forma y se decide** (`012`), y **ocho siguen llegando**. Los cinco que cortan los cerró
un commit que declara `DEC-METH-009`; de los ocho que siguen, **ninguno** cae en el alcance de un
commit de esta tanda.

---

## Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé sobre el texto nuevo y que cierran.

+ **Hacer que un grant de scope plural alimente una vertical con el plan de otra.** Cerrado en la
  base, que es donde había que cerrarlo: `UNIQUE(permanent_grant_id, vertical)` más *«el plan **no
  es anulable** y **pertenece a esa vertical**»* (`B/02` §2.4), y `NUCLEO/04` §2 lo asienta como la
  mitad del §64.10 que el scope estructural del capítulo 17 no alcanzaba. Probé escribir la fila
  mala y no se puede escribir.
+ **Emitir una cortesía en una segunda vertical transportando la versión anclada de la
  suscripción de la primera** — el defecto del grant con otro `tipo`. Cerrado en seco por
  `DEC-GRANT-006`, que retiró la columna en vez de dejarla muerta, y lo deja fijado por escrito
  como *«lo que queda fijado y no se revisa»*.
+ **Mover todas las instancias vivas de un addon publicando una versión nueva del producto.**
  Cerrado y ahora en los dos lados: `addon_product.version_id` está declarado *«la versión que se
  vende hoy»* y *«**NO** es la referencia que transporta una fuente `ADDON`»*, con la tabla de dos
  columnas que las separa (`B/02` §2.4) y el eco en `V/02` §2.1.
+ **Conservar las capacidades de un addon después de dejar de pagar.** Cerrado donde se ejecuta:
  `V/15` §2.6 descarta los `COMPLEMENTO` sin título **en los dos tramos del pliegue**, con guard
  `G-R2`. Probé entrar por el delta de ficha —el tramo que el caché no cachea— y el § lo anticipa:
  *«si el descarte sólo rigiera en el primero, el suspendido conservaría sus addons de ficha»*.
+ **Dejar sin nada al beneficiario de un *Free Forever* retirando su plan del catálogo.** Cerrado
  por el enunciado nuevo de `V/10` §2 —*«una lectura que resuelve lo que ALGUIEN TIENE nunca exige
  `vendible`»*— y por la fila 5 de su tabla, que lo dice para el grant con esas palabras.
+ **Quedarse con una cobertura perpetua confundiendo `SIN_EMPEZAR` con `NO_VENCE`.** Sigue
  cerrado por la clase derivada del `hasta`, y ahora también por `T1`, que exige `cubierto` falso y
  por lo tanto no puede autoalimentarse con la fuente de `PRE_TRIAL`, que es de clase `BASE`.
+ **Disparar `T1` y `T6` a la vez sobre el mismo evento para quedarse con el plan de trial encima
  del plan contratado.** Cerrado por construcción: las dos comparten la mitad de catálogo y
  difieren en un booleano, `NUCLEO/03` §1 regla 7 lo exige, y `G-R4` lo cuenta en cada PR en vez de
  fiarse de una lectura a mano.
+ **Quemarle el trial a un Partner antes de que la vertical lo ofrezca.** Cerrado por dato y con
  la tercera fila del recorrido escrita: sin evento declarado y con días en cero, *«**ninguna de las
  dos transiciones dispara ahí**»* (`V/02` §2.1), y `T6` ahora repite la mitad de catálogo que le
  faltaba.
+ **Conseguir un segundo trial re-registrándome con el mismo correo.** Cerrado por
  `UNIQUE(hash_del_correo_normalizado, vertical)`, sin condición de estado, y con la nota de que es
  *«una condición de aplicación, no una tarea suelta»* — el orden entre el arreglo del trial y la
  restricción está declarado.
+ **Comprar un addon apoyándome en una suscripción que todavía no autorizó nadie.** Cerrado por
  `B/16` §2.2, que enumera los siete estados y deja sólo `ACTIVE`, y la única excepción —el grant—
  quedó acotada a *«la vertical donde el grant **ANCLÓ**, no en todas»* (§2.4), que es el arreglo 4
  llegando hasta acá.
+ **Usar un addon de scope `LISTING` en otra ficha del mismo dueño.** Cerrado por el pliegue en dos
  tramos del `12-contrato…` §2.7, y sin meter la ficha en la clave del caché.
+ **Que un job otorgue una cortesía o un grant.** `V/17` §3.3 intacto —*«Un actor de sistema no
  puede ejecutar ninguna de las doce acciones»*— y ahora reforzado por el cierre de la tanda:
  `NUCLEO/08` §3 declara que *«no hay ninguna operación automática sobre dinero»*.
+ **Impersonar al cliente para lavar el rastro.** `V/17` §3.2 regla 4, intacta.
+ **Acumular roles hasta que el paso 3 deje de filtrar.** Sigue cerrado: §64.12, §64.13, `G6`, y
  `G4` impidiendo que una transición escriba roles.
+ **Que el `BASE` de una vertical le dé algo comercial a alguien en otra.** Cierra en el paso 6, con
  `V/17` §2.2 diciéndolo donde corresponde y `G-R3` verificando el catálogo en las dos direcciones.

---

## Fuera de mi vector

Lo que vi y le toca a otro. No lo perseguí.

+ **Costura (`C1`).** El catálogo de `V/20` §2 tiene **14** guards contados por mí
  (`G1`-`G6`, `G8`, `G-R2`, `G-R2-B`, `G-R3`, `G-R3-B`, `G-R3-C`, `G-R4`, `G-R4-B`), **`G7` no
  existe ahí** —vive en `B/20` §2, con `G9`, `G10`, `G11` y los cuatro `G-R1-*`, once en total— y
  `HOS-1353/spec.md` sigue diciendo *«siete guards»* en dos lugares (líneas 61 y 275). Tercera
  cardinalidad viva, y la brecha creció de 10 a 14 en esta tanda.
+ **Costura (`C1`).** `V/19` sigue partido: el §2 tiene **una** fila, el §4 está numerado
  `1, 2, 4, 8, 9` y no hay §3 ni §5. El capítulo se presenta como *«la lista de lo que hay que
  decirle a la gente»* y la lista tiene huecos numerados.
+ **Costura (`C1`) / `NUCLEO`.** `NUCLEO/08` §3 sigue diciendo *«las doce acciones»* sobre una
  tabla cuyas cuatro primeras filas nombran **dos actos cada una**; `V/17` §3.2 regla 1 cuantifica
  sobre **actos**. Es `F-8cC1-010`, sigue igual, y `F-8dA1-005` se apoya en la tabla y no en el
  conteo.
+ **Máquinas (`A2`).** Quién guarda el valor anterior de `cubierto` para poder detectar *«el
  cambio»* que disparan `PB2` y `PB3` sigue sin estar escrito en ningún lado, y ahora hay un
  consumidor más: `T2` y `T5` se disparan por la **aparición** de una fuente, que es el mismo hecho
  diferencial con otro nombre.
+ **Máquinas (`A2`).** `PB3` **otorga** —restituye una publicación— y su actor es el sistema, así
  que `V/17` §3.4 (*«una transición de esta clase nunca otorga»*) y `G-R3-B` siguen sin sujeto que
  los cubra. Es `F-8bA1-008`, que sigue llegando entero.
+ **Datos (`A3`).** Nada en el modelo distingue cuál de los tres planes no vendibles de una
  vertical es el piso, cuál el de pre-trial y cuál el de trial (`F-8dA1-007`, punto 4). La mitad de
  modelo es de `A3`; yo lo reporto por el guard.
