---
title: "FASE 9 vuelta 3 · aplicación — verificación corta"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación: la verificación corta

Aplica al diseño los 21 hallazgos de la verificación corta,
[`20-verificacion-cobro.md`](./20-verificacion-cobro.md) (nueve) y
[`21-verificacion-verticales-y-transversal.md`](./21-verificacion-verticales-y-transversal.md)
(doce), con las filas AE a AJ de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) para
los que tenían elección. Un solo agente, con permiso sobre `$V/*`, `$B/*`, `$D/nucleo/*`, el
contrato y `16-`. Medido en el worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits. El
origen de cada enmienda es `(FASE 9 vuelta 3, owner 2026-09-30, lote XX)` si viene de una decisión
y `(FASE 9 vuelta 3, verificación, VC3-…)` si es escritura.

## 1. Qué se aplicó

### VC3-cobro-01 (bloquea): el lote U en la tabla que se ejecuta

- Un par nuevo en `B/03` §10.1, después del de la salvedad 4, con el veredicto del lote U.
  `B/03:2773` «mandar la cancelación que `S16` habría mandado, sobre las dos»
- Los 3 días desde la relectura que la vio viva, no desde la transición.
  `B/03:2773` «Los 3 días se cuentan desde la relectura que la vio viva»
- `paused` entra con la misma forma.
  `B/03:2773` «`paused` entra igual que `authorized` y `pending`»
- La clave del correo previo: su ocurrencia es esa relectura.
  `B/03:2773` «El correo de antes tiene por ocurrencia la relectura que la vio viva»
- El par de la salvedad 4 deja de excluir al espejo tras un rechazo y a la `S16` sin llamada.
  `B/03:2772` «Salvo el espejo que siguió a un cobro rechazado, y la de `S16` que llegó sin mandar ninguna llamada»
- La precisión 3 del §3.2, con la ocurrencia de esta cancelación.
  `B/03:373` «salvedad 4) no hay transición ni antes ni después»
- `B/09` §3: `paused` y la remisión a la tabla.
  `B/09:239` «`authorized`, `pending` o `paused`»
- `B/09` §3, el punto 1 del reintento.
  `B/09:336` «reloj de los 3 días son la relectura que la vio viva»
- El criterio de `B11` en `$B/descomposicion.md` §2.11.
  `$B/descomposicion.md:688` «los 3 días cuentan desde la relectura que la vio viva y no desde `S16`»

### VC3-cobro-02 con AE: `puedeCobrarle` no suelta lo que el barrido relee

- Contrato §4.1, la población nueva.
  `D/12:1121` «o una fila terminal cuyo preapproval canceló el proveedor tras un cobro rechazado»
- Contrato §4.1, cuándo deja de contar.
  `D/12:1121` «Salvo la que canceló el proveedor tras un cobro rechazado, que deja de contar cuando pasa el plazo 16»
- Contrato §4.1, la espera de la acción 24.
  `D/12:1121` «Y sobre la que canceló el proveedor tras un rechazo, la acción 24 espera hasta 7 días»
- La fila 27 del glosario.
  `nucleo/01:569` «o una terminal cuyo preapproval canceló el proveedor tras un cobro rechazado, mientras no pase el plazo 16»
- `NUCLEO/08` §1.3, paso 1.
  `nucleo/08:102` «el paso 3 espera hasta que pase el plazo 16, 7 días desde la primera relectura»
- La acción 24 de `NUCLEO/08` §3.
  `nucleo/08:203` «y una terminal cuyo preapproval canceló el proveedor tras un cobro rechazado, hasta que pase el plazo 16»
- `B/09` §3, el tercer lector de `cancelado_visto_en`.
  `B/09:275` «salvo la que canceló el proveedor tras un cobro rechazado, que deja de contar recién»
- El criterio de `B4`.
  `$B/descomposicion.md:686` «Una `CHARGE_DECLINED` de `S16` sin llamada»

### VC3-cobro-03 con AF: `MP6` sobre una `CANCELLED` con la última cuota impaga

- La fila de `MP6` en `B/03` §7.
  `B/03:1876` «Sobre una `CANCELLED` cuya última cuota quedó `DECLARED_UNPAID`»
- El motivo 2 lo abre también `MP6`.
  `B/02:1018` «y desde `MP6`, cuando la transferencia llega sobre una `CANCELLED`»
- El NO cierra de `B/03`.
  `B/03:3052` «`COBRO_POSTERIOR_A_LA_BAJA`, también con propuesta de devolver»
- El criterio de `B5`.
  `$B/descomposicion.md:690` «sobre una `CANCELLED` con la última cuota `DECLARED_UNPAID`, la cobertura tampoco se escribe»

### VC3-cobro-04 a -09 (menores)

- 04, `B/06` con 117 filas y 101 medidas.
  `B/06:27` «~~112~~ 117 filas»
- 04, las dieciséis `UNKNOWN`, quince de billing.
  `B/06:28` «quedan dieciséis `UNKNOWN` y quince son de este capítulo»
- 04, la tabla del §11.
  `B/06:433` «Catorce de las dieciséis filas de 117»
- 04, la fila de `EX-57`.
  `B/06:457` «si una orden de `/v1/orders` se encuentra por su `external_reference` sin conocer su id»
- 04, la fila de `EX-59`.
  `B/06:458` «si, con el `GET` del preapproval trayendo `payer_email` vacío, otra lectura trae el correo del pagador»
- 04, el recuento de qué son.
  `B/06:467` «~~doce~~ catorce siguen siendo el mismo hecho»
- 04, el título de `$B/spec.md` §5.2.
  `$B/spec.md:249` «~~doce~~ quince filas que siguen `UNKNOWN`»
- 04, su texto.
  `$B/spec.md:257` «de las quince de billing se listan catorce»
- 05, `EX-45` en `B/06` §11.
  `B/06:452` «y la medición dice si los 7 días alcanzan»
- 05, el mismo espejo en la descomposición.
  `$B/descomposicion.md:439` «la medición dice si los 7 días alcanzan»
- 05, `B/22`.
  `B/22:134` «no están medidos (`EX-58`»
- 06, la plantilla de `MP6`.
  `B/03:1876` «~~{W}~~ FASE 9 vuelta 3, owner 2026-09-30, lote W»
- 07, la rama de `EX-58` si la relectura de la orden no nombra el id: pregunta abierta (§6).
  `B/03:1852` «Si esa relectura no nombra el id de la devolución»
- 07, su unidad.
  `$B/descomposicion.md:685` «`EX-58`, la devolución de una orden»
- 08, el plazo 17 es uno solo.
  `B/09:923` «permite medir el plazo por marca. El plazo es uno solo, el 17 de la lista cerrada»
- 09, la fila `EX-45` de la matriz: propuesta (§5).

### VC3-VT-01 con AG: el link de reclamo ya usado

- La pantalla, en `V/18` §2.4 regla 4.
  `V/18:295` «*«este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte»*»
- El hash se conserva.
  `V/18:304` «El reclamo que escribe el vínculo conserva el hash, y el secreto sólo reclama con»
- `V/02` §2.7.
  `V/02:593` «conservado tras el reclamo, porque sólo reclama con `owner_user_id` nulo»
- La fila 32 de `V/19`.
  `V/19:79` «Sólo con el secreto correcto del link»
- El criterio de `V8`.
  `$V/descomposicion.md:500` «el mismo link con otro secreto contesta como un Partner que no existe»
- El de `V7`.
  `$V/descomposicion.md:499` «y el hash queda en la columna (lote AG)»
- `DEC-AUTH-004` no dice que el reclamo borre el secreto: no hace falta 📌 (§5).

### VC3-VT-02 con AH: la cuarta situación del corte

- El encabezado del §4.3 de `16-`.
  `D/16:488` «~~tres~~ cuatro situaciones, declaradas por decisión del owner»
- La cuarta, con su causa y su daño.
  `D/16:519` «4. Un aborto borra lo que el sistema viejo asentó después del backup del 2b»

### VC3-VT-08 con AI: el correo de una postulación sin cuenta

- La acción 24 de `NUCLEO/08` §3.
  `nucleo/08:203` «Y alcanza también a una postulación hecha sin cuenta»
- Su confirmación.
  `nucleo/08:203` «Sobre una postulación sin cuenta, dice de qué postulación es el correo que reemplaza»
- `V/02` §2.7.
  `V/02:592` «Y la de una postulación hecha sin cuenta también la reemplaza la acción 24»
- `V/22` §3.1.
  `V/22:78` «Y el pedido de supresión de quien postuló un Partner sin cuenta»
- El sujeto, en `V/17` §3.2 regla 5.
  `V/17:484` «o, en la vigesimocuarta, quien postuló un Partner sin cuenta»
- El criterio de `V8`.
  `$V/descomposicion.md:483` «y sobre una postulación hecha sin cuenta, la 24 reemplaza su correo»

### VC3-VT-10 con AJ: la cuenta sin verificar no postula como guest

- `V/17` precisión 9.
  `V/17:247` «Una cuenta con sesión y el correo sin verificar no postula como guest»
- `V/18` §2.4.
  `V/18:259` «Una cuenta con sesión y el correo sin verificar, en cambio, no»
- La fila 34 de `V/19`.
  `V/19:81` «al postular un Partner con sesión y el correo de la cuenta sin verificar»
- El criterio, en `V5` y `V8`.
  `$V/descomposicion.md:501` «postular con sesión y el correo sin verificar»

### VC3-VT-03 a -07, -09, -11 (menores, escritura)

- 03, la confirmación de la acción 26.
  `nucleo/08:205` «o, al quitarlo, a qué cuenta se le quita y qué filas deja de poder ejecutar»
- 03, la enumeración de filas con más de un verbo.
  `nucleo/08:217` «y *«asignar o quitar»* el rol `SUPER_ADMIN`»
- 03, el sujeto en `V/17` §3.2 regla 5.
  `V/17:487` «o pierde el rol, así que nadie se da el rol»
- 03, `V/17` §3.3.
  `V/17:528` «no toca plata, pero da o saca el permiso»
- 03, el criterio de `V5`.
  `$V/descomposicion.md:505` «quitárselo a otra cuenta deja el mismo registro»
- 03, los espejos con el nombre nuevo (`V/17` §3.2 reglas 1 y 3, §3.5, `$V/spec.md`, `B/19` §6 y
  los cinco de `B/03`); uno de ellos:
  `$V/spec.md:216` «~~asignar~~ asignar o quitar el rol `SUPER_ADMIN` a una cuenta (el nombre, lote AC)»
- 04, la remisión de los recuentos del paso 3.
  `D/16:137` «los dos recuentos del paso 2 y el de dueños con más de una `L8` del paso 0»
- 05, el cuerpo del punto 1 del ⚠️ del reconciliador.
  `V/03:1247` «y eso puede adelantar el archivado (`PB4` y `PB5`), que no es irreversible»
- 06, los campos del contrato, recontados con script.
  `D/12:1236` «~~trece~~ catorce campos en»
- 07, la carga del catálogo con una sola unidad dueña.
  `$V/descomposicion.md:487` «la pieza que carga el catálogo, que la migración estructural llama»
- 07, qué pasa en `staging`, desarrollo y CI hasta el paso 6: lo que es hecho, escrito; lo que es
  elección, pregunta abierta (§6).
  `D/16:145` «qué hace en desarrollo y en CI, donde el seed carga además los datos de demostración, es pregunta abierta»
- 09, `V/02` §2.1.
  `V/02:231` «o la postulación de un Partner (`PP1`)»
- 09, el resumen de `V5`.
  `$V/descomposicion.md:58` «salvo en la lectura pública y en `PP1`»
- 11, qué puede hacer el turista.
  `V/17:224` «Sobre una ficha que dejó de publicarse sin llegar a `PURGED`, el turista ve la conversación»
- 11, su fila en `V/19`.
  `V/19:82` «sobre una ficha que dejó de publicarse sin llegar a `PURGED`»
- 11, su criterio en `V8`.
  `$V/descomposicion.md:502` «la conversación del turista sobre una ficha que dejó de publicarse»

### VC3-VT-12

El resumen del log no es de mis archivos: va como propuesta (§5).

## 2. Lo que no se aplicó y por qué

- **`VC3-cobro-09`** y **`VC3-VT-12`**: son del log y de la matriz, que no se editan. Van al §5.
- **`VC3-cobro-02`, «contrato §5.1»**: la implementación de arranque ya contesta `no` a
  `puedeCobrarle` porque sin billing no hay suscripción; el lote AE no la toca. Cambió sólo §4.1.
- **`VC3-cobro-07`**: la rama «no» de `EX-58` tiene dos lecturas con daño distinto. Se escribió que
  es pregunta abierta, con las dos, y la unidad (`B6`); no se eligió (§6).
- **`VC3-VT-07`**: qué hace la carga del catálogo en desarrollo y en CI es una elección. Se escribió
  el hecho (la corre toda base que aplique las migraciones) y la pregunta (§6).
- **`VC3-cobro-03`**: AF nombra la `CANCELLED`. La `ABANDONED` de un pagador manual con la primera
  cuota `DECLARED_UNPAID` tiene el mismo hueco; no la alcancé sin decisión (§6).

## 3. Conteos recontados

| lista | viejo → nuevo | comando | espejos actualizados |
|---|---|---|---|
| pares de `B/03` §10.1 | 14 → 15 | `python3`: filas de la tabla desde el encabezado de la columna del proveedor | el recuento del mismo § (`B/03:2791`); no hay otro espejo (`rg` por la cifra y por la palabra) |
| filas de la matriz en `B/06` | 112 → 117 filas, 95 → 101 medidas | `contar-filas-de-la-matriz.py` (117 = 61 · 16 · 24 · 16) | `B/06:27` |
| `UNKNOWN` en `B/06` | 14 y 13 de billing → 16 y 15 | ídem | `B/06:28` |
| filas `UNKNOWN` de la tabla de `B/06` §11 | 12 de 14 (de 114) → 14 de 16 (de 117) | `python3` sobre la tabla: 16 filas, dos no `UNKNOWN` (`RN-3`, `GR-1`) | `B/06:433`, `B/06:467` |
| filas de `$B/spec.md` §5.2 | título doce → quince; se listan catorce en vez de doce | ídem, con `EX-49` de verticales y `EX-54` sin fila | `$B/spec.md:249`, `:257` |
| campos de las consultas del contrato | 13 → 14 | `python3` sobre el bloque de firmas: 4 + 3 + 4 + 3 | `D/12:1236`; el 📌 del 2026-09-29 de `DEC-ARCH-006` dice trece y es histórico |
| situaciones que no deshace una restauración | 3 → 4 | `python3`: ítems numerados del § de `16-` | encabezado y la frase de la falla previa en `D/16:488` |
| filas de `V/19` §4 | hasta la 33 → hasta la 35 | `python3`: ids de la tabla | sin cifra congelada |
| acciones de `NUCLEO/08` §3 | 25, sin cambio (la 24 y la 26 crecen por dentro) | `rg` | ninguno |
| motivos de `B/02` §2.5 | 24, sin cambio (el 2 suma a `MP6` como fuente) | `rg` | ninguno |
| decisiones del log de metodología | 15 → 16 | `rg -c "^### DEC-METH-"` (16; 140 encabezados menos la plantilla = 139 = 123 + 16) | propuesta (§5) |

## 4. Para otro grupo

Ninguno: trabajé solo sobre los tres árboles. Lo del log y la matriz va al §5.

## 5. Propuestas para el log y la matriz

1. **`DEC-ARCH-006`, un 📌 nuevo (lote AE)**. Razón: el 📌 del lote D dice que `puedeCobrarle`
   deja de contar cuando una relectura ve `cancelled`, y AE lo precisa para la cancelación del
   proveedor tras un rechazo. Texto:
   *«📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote AE)**: sobre una
   suscripción cuyo preapproval canceló el proveedor tras un cobro rechazado, `puedeCobrarle`
   contesta `sí` mientras no pase el plazo 16 de `NUCLEO/02` §1.5, la ventana de relectura de la
   cancelación por rechazo (7 días), desde la primera relectura que lo vio `cancelled`: es la
   misma ventana con que el barrido la sigue releyendo, porque el proveedor puede deshacer esa
   cancelación (`EX-45`). La baja de cuenta espera hasta entonces.»* Y en su Estado, al final:
   *«**y precisada otra vez el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lote AE: la
   cancelación del proveedor tras un rechazo cuenta hasta que pasa el plazo 16; ver su último 📌)»*.
2. **`DEC-AUTH-005`, un 📌 nuevo (lotes AI y AJ)**. Razón: AJ fue contra la recomendación y precisa
   quién postula; AI da un escritor al correo que esa decisión dejó en claro. Texto:
   *«📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lotes AI y AJ)**: una cuenta
   con sesión y el correo sin verificar no postula como un visitante sin cuenta: se le pide
   verificar el correo antes (contra la recomendación, que era dejarla postular como guest). Y el
   correo de una postulación hecha sin cuenta lo reemplaza la acción 24 de `NUCLEO/08` §3 a pedido
   de quien la escribió, con motivo y registro, sin cuenta que dar de baja.»* Estado: *«**precisada
   el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lotes AI y AJ; ver su 📌)»*.
3. **El resumen del log, fila «De metodología» (`VC3-VT-12`)**. Razón: los prefijos `DEC-METH-`
   son 16 desde `DEC-METH-016`, que está bajo el encabezado funcional; 123 + 16 = 139. Texto:
   *«~~15~~ **16** *(por prefijo; ~~once —`DEC-METH-005` a `-015`—~~ doce, de `DEC-METH-005` a
   `-016`, están bajo el encabezado funcional porque se escribieron en orden cronológico;
   `26-fase-9-completa/09` `C-15`; recontado el 2026-09-30, verificación, VC3-VT-12)*»*.
4. **La matriz, fila `EX-45`, columna «para qué» (`VC3-cobro-09`)**. Razón: desde el lote K
   condiciona también la exención del barrido y `S16`. Texto a sumar al final de la celda:
   *«y el criterio de exención del barrido y `S16`, con la ventana del plazo 16 (`B/09` §3; FASE
   9 vuelta 3, lote K)»*.
5. **La matriz, fila `EX-58`, columna «para qué»**. Razón: de su medición depende una rama que
   quedó como pregunta abierta. Texto a sumar: *«y la rama de `RF3` sobre una orden cuya relectura
   no nombra el id de la devolución (`B/03` §6.1; FASE 9 vuelta 3, verificación, VC3-cobro-07)»*.
6. `DEC-AUTH-004` no dice que el reclamo borre el secreto: dice *«un secreto de un solo uso»*, que
   sigue siendo cierto con el hash conservado. No propongo 📌.

## 6. Preguntas abiertas

1. **Qué hace `RF3` sobre una orden cuya relectura no nombra el id de la devolución** (`EX-58`,
   `VC3-cobro-07`).
   - Lectura A: la fila toma la devolución de la orden cuyo monto es el suyo, como `RF2` con el
     pago cuando la respuesta se perdió. Daño: con dos devoluciones del mismo monto sobre la misma
     orden, una fila puede tomar la de otra; sobre un `UNA_VEZ` la orden tiene una sola devolución,
     el total de `S36`, así que no pasa en el camino principal. Y si la relectura tampoco trae el
     monto por devolución, no alcanza.
   - Lectura B: la fila queda en `CONFIRMED` y la mira una persona, como `RF2` cuando ningún
     reintento entra. Daño: cada revocación de un `UNA_VEZ` necesita a una persona, y el barrido la
     relee hasta que alguien la asiente.
   - Recomendación: A, y medir en `EX-58` también si la relectura trae el monto por devolución.
2. **Qué hace la carga del catálogo en desarrollo y en CI hasta el paso 6** (`VC3-VT-07`).
   - Lectura A: corre en toda base, como el resto de la migración estructural. Daño: las bases de
     desarrollo y la de CI tienen el catálogo de producción además de los datos de demostración del
     seed, y un choque de claves entre los dos rompe el `db:fresh`.
   - Lectura B: corre sólo con una marca del corte. Daño: una marca que falta en el paso 3 deja la
     prueba sin plan; la migración falla y entra el aborto, que es el camino ya declarado, pero en
     el día del corte.
   - Recomendación: A (el ensayo en `staging` ya necesita que corra), y que el seed de demostración
     no cargue catálogo donde la migración ya lo cargó; si el owner no lo quiere escrito, es de
     implementación.
3. **`MP6` sobre una `ABANDONED` de pagador manual con la primera cuota `DECLARED_UNPAID`**
   (vecino de `VC3-cobro-03`). AF nombra la `CANCELLED`.
   - Lectura A: la misma regla de AF: sin cobertura con qué chocar, motivo 2 con propuesta de
     devolver. Daño: ninguno nuevo, usa la misma marca.
   - Lectura B: sólo la `CANCELLED`. Daño: la transferencia sobre esa `ABANDONED` escribe
     cobertura sobre una fila terminal y no abre marca: la persona pagó y nada propone devolverle.
   - Recomendación: A, que es la recomendación 1 de `VC3-cobro-03` leída sobre toda terminal.

## 7. Casos vecinos

1. **El reloj de los 3 días del par del lote U sale del instante del correo que esa relectura
   encola.** Lo derivé y lo marqué en `B/03` §10.1: sin eso la cuenta no tenía de dónde salir. Si
   el correo no se pudiera encolar (no pasa: sin destinatario se cancela igual), el reloj no
   tendría ancla.
2. **El contrato §6.2 no tiene un caso del juego común para la cancelación del proveedor tras un
   rechazo.** El criterio de `B4` lo cubre, pero el juego que corre contra las dos
   implementaciones no lo nombra.
3. **El 📌 del 2026-09-29 de `DEC-ARCH-006`** dice *«sin `CANCEL_SCHEDULED`»* y *«trece campos»*:
   es histórico y lo corrigen los 📌 posteriores, pero quien lo lea suelto lee dos cifras viejas.
4. **La fila 28 de `V/19` le dice al dueño *«esta ficha ya no existe»*** también desde su bandeja;
   sobre una ficha `PURGED` es cierto, y la fila 35 nueva es sólo del turista. El dueño de una
   ficha no publicada sigue escribiendo, y ninguna fila le dice que el turista no puede contestar.

## Key Learnings

1. Una tabla de pares que se ejecuta se identifica por el correo o la columna que la reconoce: el
   par nuevo del lote U tuvo que decir cómo se reconoce la fila en la segunda corrida, porque la
   relectura que la vio viva vacía justo la columna que la reconoció en la primera.
2. Cuando una decisión redefine «confirmado» para una población, el lector que contesta sobre esa
   palabra tiene que citar la misma condición que el barrido y no reescribirla: así
   `puedeCobrarle` y la exención no pueden volver a separarse.
3. Un espejo de conteo de la matriz se recuenta con el script y con la tabla: `B/06` tenía dos
   filas `UNKNOWN` sin fila en su propia tabla, además de la cifra vieja.
4. Un campo de estado que se vacía para cerrar un uso (el hash del reclamo) puede borrar la única
   prueba que distingue a quien tiene derecho a una respuesta de quien no.
