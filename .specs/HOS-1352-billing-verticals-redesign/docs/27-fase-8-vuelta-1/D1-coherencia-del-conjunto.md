---
title: "FASE 8 vuelta 1 · D1 — coherencia del conjunto"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · D1 — coherencia del conjunto

Ataqué el alcance entero leído como un solo cuerpo: el núcleo, las dos épicas con sus
descomposiciones, el contrato de cobertura y el corte. Reconté con script los conteos congelados
contra sus tablas (S1–S35, T1–T8, PB1–PB12, los 22 motivos de marca, las 14 acciones
administrativas, los 31 guards, los 54 invariantes, las 13 + 9 unidades), recorrí las referencias
`X/NN §N` contra los encabezados reales, reconté la matriz con `contar-filas-de-la-matriz.py`
(98 filas: 56 `VERIFIED`, 15 `PARTIALLY_SUPPORTED`, 23 `NOT_SUPPORTED`, 4 `UNKNOWN`) y crucé las
decisiones más recientes del log contra los capítulos que las aplican.

Son **10 hallazgos**: **0 CRITICA, 2 ALTA, 2 MEDIA y 6 BAJA**. Lo más grave: el trial que el owner
le regaló a la cartera vieja no tiene ninguna transición que lo arranque, porque el corte deja sus
fichas en `UNPUBLISHED_BY_BILLING` y desde ahí el dueño no puede publicar.

Regla de lectura: cada hallazgo se apoya en una cita textual, copiada literal de una sola línea del
archivo con su `archivo:línea` (rutas relativas a `.specs/` del worktree). Las citas van entre «».

## ALTA

### F-8V1D1-001 — El trial regalado a la cartera vieja no tiene ninguna transición que lo arranque

**Qué se rompe.** `DEC-MIG-005` decide que los clientes del sistema viejo arrancan como nuevos y
tienen su trial. `V/21` y `V/03` §2 lo traducen a *«su próxima publicación arranca un trial por
`T1`»*. Pero el corte (paso de las llamadas del `16` §4.2 y `V/21` §2.4) deja cada ficha publicada
en `UNPUBLISHED_BY_BILLING` por `PB2`, y la tabla de Publicación no le da al dueño ninguna salida de
ese estado: `PB1` sale sólo de `DRAFT`, `PB6` sólo de `PUBLISHED`, y `PB3` es automática y exige
cobertura. Sin publicar no hay evento de activación, y sin evento `T1` no dispara. Y el botón
inteligente tampoco lo salva: `B/19` fila 21 manda al checkout a quien *«ya publicó»*, y el dueño
viejo publicó. Dos implementadores construyen cosas distintas: uno sigue la tabla y el trial
prometido no existe; otro «arregla» agregando un camino que ninguna fila declara.

**El camino.**

1. Juan tiene una ficha publicada en Alojamiento en el sistema viejo; el owner le avisa que va a
   tener su trial de regalo.
2. Corte: la primera corrida del reconciliador lleva la ficha a `UNPUBLISHED_BY_BILLING` (`PB2`).
   Juan está en `PRE_TRIAL`, sin fila de `trial`.
3. Juan entra a Mi Cuenta para «volver a publicar»: no hay acción de publicar sobre esa ficha
   (ninguna fila del dueño sale de `UNPUBLISHED_BY_BILLING` salvo borrarla, `PB12`).
4. Toca «suscribirme»: según `B/19` fila 21 ya publicó, así que va al checkout, paga en el acto y
   `PB3` le devuelve la ficha. El trial que el owner le regaló no ocurrió, y cobramos desde el
   día 1.
5. Si en cambio el implementador lee «publicó» como «en el sistema nuevo» (`V/03` §2, `T7`), el
   botón lo manda a publicar, y publicar no tiene qué ejecutar: queda en un lazo entre el botón y
   una pantalla sin acción.

**La evidencia.**

- `HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5686`:
  «nuevos que recién arrancan: tendrán su trial y luego se suscribirán»
- `HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:155`:
  «publicar —o el botón de suscribirse, que manda a publicar a quien todavía no publicó en esa»
- `HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:168`:
  «las despublica la primera corrida del reconciliador»
- `HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:506`:
  «`DRAFT` | el dueño publica | `PUBLISHED` | **sólo si el dueño está cubierto**»
- `HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:511`:
  «| PB6 | `PUBLISHED` | el dueño despublica | `DRAFT` |»
- `HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:364`:
  «encendido sigue resolviendo a quien ejerció el evento **en el sistema nuevo**.»
- `HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:137`:
  «El checkout de billing queda para quien ya publicó o ya consumió su trial»

**Qué haría falta decidir o escribir.** Qué transición le permite al dueño viejo ejercer el evento
de activación sobre una ficha `UNPUBLISHED_BY_BILLING` (o si el corte las deja en otro estado), y
qué significa *«ya publicó»* para el botón en la cartera del corte. Toca una decisión del owner
(`DEC-MIG-005`) que hoy no tiene camino ejecutable.

### F-8V1D1-002 — «Cobrada» significa dos cosas, y la única definición del paraguas es la estrecha

**Qué se rompe.** El contrato define el campo `cobrada` como *«esa fila tiene al menos un pago
acreditado»*, y dice explícitamente que la sucesora cuyo primer cobro difiere `D8` viene en `no`.
`B/16` y `B/03` `A1`, en cambio, usan la misma palabra para la validez y la orfandad de un addon
con otra definición: pago acreditado **o** sucesora de una predecesora que venía pagando
(`DEC-ADDON-007`, 📌 9e). El glosario del núcleo no define el término y hasta lo usa (inventario de
«fila viva», fila 5) sin decir cuál de las dos lecturas vale. Un implementador de B4 y uno de B10
que centralicen el predicado —que es lo que el §7 pide— eligen uno solo, y el que se equivoque de
lado rompe lo que la otra definición protegía. El propio log mide el daño del lado estrecho.

**El camino.**

1. Juan paga su plan de Alojamiento y tiene un addon `USER` comprado y cobrando.
2. Hace upgrade: nace la sucesora, con el primer cobro diferido (`D8`); todavía no tiene pago
   propio.
3. El implementador de B10 reusa el predicado `cobrada` que B4 ya expone para el contrato (el
   único definido en el paraguas): la sucesora da `no`.
4. La orfandad de `USER`/`GLOBAL` no encuentra ninguna principal «viva y cobrada»: `A5` cancela el
   preapproval del addon, irreversible (`PA-5`), sin reembolso del período (motivo 14).
5. Al revés, si B4 reusa el predicado de B10, la sucesora sale `cobrada: sí` y el contrato le dice
   a la máquina de trial que hay un título que convierte antes de cualquier cobro, que es lo que
   `DEC-TRIAL-010` cerró.

**La evidencia.**

- `HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:126`:
  «en una fuente `SUSCRIPCIÓN`, si **esa fila** tiene **al menos un pago acreditado**»
- `HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:154`:
  «que se dio de baja antes del primer cobro y sobre una sucesora cuyo primer cobro»
- `HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:114`:
  «tiene al menos un pago acreditado, o es la sucesora de una predecesora que venía pagando»
- `HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5797`:
  «de `DEC-SUB-022`, 9d). Sin la segunda mitad, todo upgrade dejaba huérfanos en el acto los»
- `HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:568`:
  «hay una principal fila viva **y cobrada** ni un ancla viva»

`rg -n "cobrada" nucleo/01-glosario.md` devuelve sólo esa línea: el término no tiene entrada.

**Qué haría falta decidir o escribir.** Un nombre distinto para cada predicado (o una entrada de
glosario que diga que son dos y cuál usa cada consumidor), y que el contrato deje de afirmar que su
bit es el único uso de la palabra. Sin decisión nueva del owner: las dos lecturas ya están
decididas, falta separarlas.

## MEDIA

### F-8V1D1-003 — La regla 5 del núcleo cierra la lista de lecturas del proveedor en `S3` y `S6`, y `S1` lee otra

**Qué se rompe.** El núcleo es *«el único lugar donde algo se define»*, y su regla 5 dice que
ninguna máquina consulta al proveedor para decidir, salvo el job por nuestro reloj de `S3` y `S6`.
`D17` repite la misma enumeración. Pero la condición de `S1` —un acto del cliente, no un job—
relee el preapproval de la predecesora y exige `authorized`. Quien implemente el motor de máquinas
desde el núcleo (o un chequeo que haga cumplir la regla 5) deja a `S1` sin esa relectura.

**El camino.**

1. Juan, pagador con tarjeta, en `ACTIVE`. Su renovación se rechaza y el aviso se pierde (`WH-5`).
2. Pide upgrade. El motor, fiel a la regla 5, no relee al proveedor en `S1`: la sucesión se
   declara sobre un preapproval que en realidad está en mora.
3. La guarda de sucesión de `S6` frena la suspensión mientras la sucesión esté en curso; Juan sigue
   con servicio y el ciclo impago no se cobra nunca si la sucesora se consuma.

**La evidencia.**

- `HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:63`:
  «Ninguna máquina consulta el estado del proveedor para decidir.**»
- `HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:66`:
  «actuar**, releyendo por id, y esa relectura es parte de la condición de `S3` y `S6`»
- `HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:143`:
  «el preapproval de la predecesora se relee por id antes de aceptar el cambio y tiene que estar»

**Qué haría falta escribir.** Agregar `S1` (y todo acto del cliente que relea al proveedor en su
condición) a la excepción de la regla 5 y de `D17`, o reformular la regla para que no sea una lista
cerrada de dos.

### F-8V1D1-004 — Los dos espejos del botón de suscribirse no dicen lo mismo, y en una vertical sin trial el lazo es cerrado

**Qué se rompe.** `V/19` fila 23 manda al checkout a quien ya publicó, ya consumió su trial **o no
puede arrancar uno**. `B/19` fila 21 —su espejo, el que construye B13— sólo nombra a los dos
primeros. En una vertical con días de trial en cero no se puede publicar sin título (`V/03` §2),
así que quien nunca publicó ahí va, por `B/19`, a publicar; `PB1` lo rechaza con «suscribite para
publicar» (`V/19` fila 21, que tampoco lista los días en cero entre sus causas), y el botón lo
vuelve a mandar a publicar.

**El camino.**

1. Una vertical nueva sale con días de trial en cero.
2. Juan, que nunca publicó ahí, toca «suscribirme»: B13 lo manda a publicar.
3. Publicar no dispara `T1` (días = 0) y no está cubierto: «suscribite para publicar».
4. Vuelve al botón y lo manda de nuevo a publicar. No puede comprar.

**La evidencia.**

- `HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:137`:
  «El checkout de billing queda para quien ya publicó o ya consumió su trial»
- `HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:69`:
  «El checkout queda para quien ya publicó o ya consumió su trial —el que no puede arrancar uno»
- `HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:67`:
  «ya consumió su trial, la vertical no admite altas, o el hash de su correo ya tiene fila»
- `HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:371`:
  «con los días en cero sólo se puede publicar teniendo un título»

**Qué haría falta escribir.** Una sola regla de a quién manda el botón, escrita en un lugar y
citada por el otro, con los días en cero (y la vertical sin evento declarado) entre los casos que
van al checkout.

## BAJA

### F-8V1D1-005 — Varios textos siguen diciendo `UNKNOWN` o contando mediciones que la matriz ya cerró

**Qué se rompe.** La matriz da `RN-3` en `PARTIALLY_SUPPORTED`, `EX-1` en `PARTIALLY_SUPPORTED` y
cuatro `UNKNOWN` (94 filas medidas). Cuatro textos lo dicen distinto: el título del §2.7 de la
descomposición de billing sigue en «seis filas `UNKNOWN`» (su cuerpo dice cuatro); `B/06` dice
«92 medidas»; la tabla de filas abiertas de `B/06` dice que `RN-3` «sigue `UNKNOWN`»; y
`B/09` §3 cita a `EX-1` «todavía
`UNKNOWN`». Ninguno mueve plata, pero `B/06` es donde un implementador lee qué está medido.

**El camino.** Juan (implementador de B7) busca en `B/06` si `RN-3` está abierta para decidir si el
§61 le bloquea la unidad, y lee `UNKNOWN`.

**La evidencia.**

- `HOS-1354-billing-cobro-y-proveedor/descomposicion.md:354`:
  «Dónde caen las ~~ocho~~ seis filas `UNKNOWN`»
- `HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:27`:
  «las reglas de trato que salen de haberlo medido** — 98 filas, 92 medidas (recontadas»
- `HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:412`:
  «reactivar no reintenta lo adeudado; sigue `UNKNOWN` si vuelve a pausar»
- `HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:194`:
  «Recuperación tras el fallo | ~~`UNKNOWN`~~ `PARTIALLY_SUPPORTED`»
- `HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:159`:
  «y `B/06` §6 lo subraya con `EX-1` todavía `UNKNOWN`»

**Qué haría falta escribir.** Actualizar las cuatro frases contra el recuento del script.

### F-8V1D1-006 — Las invariantes cuentan 117 decisiones y el índice 124

**Qué se rompe.** `NUCLEO/04` §3 dice que el §64 se escribió antes de «las 117 decisiones»; el
índice del núcleo, recontado, dice 124 (y `rg -c "^### DEC-"` da 125 con la plantilla). Texto
vencido sin consecuencia.

**El camino.** Juan cruza el número de decisiones entre dos capítulos del núcleo y encuentra dos.

**La evidencia.**

- `HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:123`:
  «El §64 se escribió antes de las 117 decisiones»
- `HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:43`:
  «2026-09-25~~ **124** al 2026-09-25, con las siete nuevas de la FASE 9 completa»

**Qué haría falta escribir.** Llevar el número de `NUCLEO/04` a la cifra del índice, o quitarlo.

### F-8V1D1-007 — Tres referencias apuntan a secciones de `B/09` que no existen

**Qué se rompe.** `B/09` tiene §1–§7 y §7.1; su §6 no tiene subsecciones. `B/02` §2.5 cita dos veces
«`B/09` §6.2» (es el punto 2 del §6) y `B/06` cita «`B/09` §8». El lector va a un encabezado que no
está.

**El camino.** Juan busca el umbral de 3 días del motivo 21 en `B/09` §6.2 y no lo encuentra.

**La evidencia.**

- `HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:939`:
  «el **barrido** (`B/09` §6.2, punto 2), **cuando pasaron 3 días**»
- `HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:412`:
  «(FASE 9 completa, C11: `B/09` §8 ya dice que ninguna bloquea)»
- `HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:760`:
  «## 6. Dos límites que no se pueden correr»

**Qué haría falta escribir.** Corregir las tres a «§6, punto 2» y al § que corresponda.

### F-8V1D1-008 — El spec de verticales sigue diciendo que no necesita leer billing

**Qué se rompe.** El índice del núcleo tachó *«las dos épicas no se referencian entre sí»* y mide
decenas de líneas de `HOS-1353/docs` que citan billing (`B/NN`); el `spec.md` de verticales sigue
afirmando la autonomía vieja. Texto vencido.

**El camino.** Juan, implementador de V4, confía en que no tiene que abrir `B/12` §4.3 (que
`V/03` §2 cita para `cobrada`) y no lo abre.

**La evidencia.**

- `HOS-1353-verticales-capacidades-y-autorizacion/spec.md:49`:
  «y ninguno de ellos necesita leer uno de la épica de billing para estar completo.»
- `HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md:70`:
  «se citan entre sí**: recontado el 2026-09-25»

**Qué haría falta escribir.** Alinear la frase del `spec.md` con el índice.

### F-8V1D1-009 — El inventario de «fila viva» dice que `A5` es el único consumidor de la instancia, y `A6` también lo es

**Qué se rompe.** Desde `K-9` (`DEC-ADDON-007`, 📌 9f) el `desde` de `A6` enumera los dos estados
vivos de la instancia (`ACTIVE` o `PENDING_AUTHORIZATION`). El inventario del glosario —que
`G-R1-E` usa como control— sigue diciendo que `A5` es el único consumidor cuyo sujeto es sólo una
instancia, y `A6` no figura. Si el conjunto vivo de la instancia cambia, el censo no lleva a `A6`.

**El camino.** Juan agrega un estado vivo a la instancia de addon, recorre el inventario para
actualizar consumidores y deja a `A6` con la enumeración vieja: una instancia en el estado nuevo
no se cancela al purgarse su ficha.

**La evidencia.**

- `HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:571`:
  «es el **único consumidor cuyo sujeto es SÓLO una instancia de addon**»
- `HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2484`:
  «| A6 | `ACTIVE` —**o `PENDING_AUTHORIZATION`**: la ficha de un `LISTING` que»

**Qué haría falta escribir.** Agregar `A6` al inventario y retirar el «único».

### F-8V1D1-010 — El paso 4 del corte dice en su tabla que lo hace el sistema nuevo, y en la prosa que es a mano

**Qué se rompe.** La tabla del `16` §4.2 asigna las lápidas a «el sistema nuevo», igual que los
grants del paso 3b, que sí son automáticos; la prosa del mismo § y `B/21` §2.5 dicen que es la
única escritura a mano, hecha por una persona. Quien arme el procedimiento puede escribir una
migración automática sin la verificación manual que `B/21` supone.

**El camino.** Juan arma el runbook del corte desde la columna «quién lo hace» y automatiza el
paso 4 dentro del despliegue.

**La evidencia.**

- `HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:126`:
  «| 4 | **sembrar las lápidas** (`B/21` §2.5) con los ids cancelados | el sistema **nuevo** |»
- `HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:160`:
  «a mano del corte. Las otras dos»
- `HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:172`:
  «la escribe una persona, sin idempotencia ni registro de nuestro lado,»

**Qué haría falta escribir.** Una sola respuesta a quién siembra las lápidas, en la tabla y en la
prosa.

## Ataques que intenté y el diseño resistió

- **S1–S35**: 35 filas en `B/03` §3.2, sin huecos ni duplicados; el reparto por unidad de la
  descomposición suma 35 y no deja ninguna sin unidad.
- **T1–T8, PB1–PB12, PP1–PP3, P1–P7, RF1–RF5, MP1–MP5, A1–A6**: coinciden con los conteos
  declarados (seis estados y doce transiciones de Publicación, cuatro estados y cinco filas del
  reembolso, diez máquinas).
- **22 motivos de marca**: la tabla tiene 22; `S14` abre 12 y otros actos 10; los `SÍ` son 7 y son
  los mismos siete que proponen «devolver» en `B/19` §6.
- **14 acciones administrativas**: la tabla de `NUCLEO/08` §3 tiene 14 y todas las menciones
  vivas (`V/17`, `B/03`, `B/19`) dicen catorce.
- **31 guards**: 16 + 19 − 4 referencias cruzadas; 14 en las columnas de billing y 17 en las de
  verticales; «sin unidad» en cero. `V/spec` (19) y `B/spec` (16) cierran.
- **54 invariantes**: 37 + 17, con 21 apoyos en la columna derecha; todo cierra.
- **La matriz en los cuerpos**: `B/spec` §5.2 y el cuerpo de `B/descomposicion` §2.7 dicen
  98/56/15/23/4, igual que el script.
- **Las 13 transiciones que sacan a una principal de las filas vivas**: la misma lista en `B/16`
  §4.3, `B/03` §3.2 (R6) y `B/09` §3 (con `S21` como decimocuarta por la salvedad 1).
- **`SUPERSEDED`**: la lista del índice coincide con los seis estados no `ACCEPTED` del log, y
  ningún capítulo cita `DEC-SUB-003` como vigente.
- **`GR-1` `VERIFIED`**: todas las superficies y correos del grace ya dicen que cambiar la tarjeta
  reintenta el cobro; lo viejo quedó tachado.
- **`D8` y su excepción**: la misma en `NUCLEO/04`, `B/12` §5.2 y `G-R1-B`.
- **La firma de siete campos y las ocho dependencias con verticales**: coinciden entre contrato,
  `V/descomposicion` y `B/descomposicion`.

## Fuera de mi vector

- Un contracargo sobre una `PAUSED` por `CUSTOMER_REQUEST` sólo abre la marca (`P6`); al reanudar,
  `S10` devuelve el servicio completo sin mirar esa marca. Es de máquinas/cobro.
- La rama de aborto del corte le cobra al cliente que se re-suscribe por el link reactivado y
  después le promete un trial «en el sistema nuevo»; cómo se concilian los dos es de migración.
- La lápida de un preapproval que sólo estaba en el proveedor (sin fila vieja) necesita `user`,
  vertical y versión de plan que nadie dice de dónde salen. Es de migración.

## Key Learnings

1. Los conteos congelados de este corpus cierran: ya se recuentan con script. Lo que se rompe es
   el significado. La misma palabra («cobrada», «publicó») definida distinto en dos lugares no la
   detecta ningún recuento.
2. Una decisión del owner sobre el corte (`DEC-MIG-005`) puede quedar sin camino ejecutable cuando
   el estado en que el corte deja las filas no tiene la transición que la decisión supone.
   Conviene recorrer la tabla de transiciones desde el estado real del día del corte.
3. Una regla del núcleo escrita como lista cerrada («salvo `S3` y `S6`») envejece cada vez que una
   épica agrega otro caso. Hay que cruzar las excepciones del núcleo contra las condiciones de las
   tablas de las épicas.
4. Los espejos entre épicas (`V/19` y `B/19`) divergen en las cláusulas finas aunque el titular
   coincida; hay que compararlos cláusula por cláusula.
5. Las referencias «§6.2» que en realidad son «§6, punto 2» pasan cualquier lectura rápida y no
   pasan un script contra los encabezados.
