---
title: "Revisión del owner · aplicación, tanda 3: el cobro"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# Revisión del owner · aplicación, tanda 3: el cobro

C13 con `L3-c` y `L3-d` (el Mercado Pago falso con sus dos listas y la batería que vigila al
real), C15 con `L1-g` y `L1-h` (migrar a los clientes de un plan retirado), N2 (se saca `qzpay`),
N4 con `L3-f` (el control automático de la relectura), N3 con `L3-e` (E2E para reducir el smoke
manual) y N8, N9 con `L3-g` (pendientes de medición), de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `91416e9a9a`, sin commits, con el mapa de
[`02-impacto-cobro-y-proceso.md`](./02-impacto-cobro-y-proceso.md) § C13, C15, N2, N3, N4, N8 y N9.
Leídos antes los registros de las tandas 1 y 2
([`11-aplicacion-simplificacion.md`](./11-aplicacion-simplificacion.md),
[`12-aplicacion-verticales-y-contrato.md`](./12-aplicacion-verticales-y-contrato.md)): la acción 16
y `S25`–`S28` quedaron retiradas sin reusar el número, el catálogo de guards estaba en 32 y `G14`
es de `V1`. Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato,
`D/16` la FASE 7 del paraguas, `nucleo/` el núcleo, `$V/` y `$B/` la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, 2026-09-28, <punto>)`. La tabla vieja de quince
filas del falso quedó tachada fila por fila, con una columna que dice dónde fue a parar cada una.
**Los números nuevos no reusan ninguno retirado**: la transición nueva es `S37`, la acción nueva es
**la decimoséptima** (la 16 era discontinuar una vertical) y los guards nuevos son `G15`–`G17`.
**No toqué** los plazos configurables (C9, tanda 4) más allá de decir que el plazo del aviso de una
migración es configurable, ni las cinco acciones de `L1-f`, ni `EX-42`, ni la FAQ.

## 1. Qué se aplicó

### C13, `L3-c` · las dos listas del Mercado Pago falso

- La forma: `B/20:468` «son dos listas cerradas»
- Las tres reglas de la primera lista: `B/20:475` «Una mentira que no está en la lista no puede estar en el falso.»
- `B/20:478` «Por defecto el falso miente siempre»
- `B/20:479` «Una prueba puede apagar una mentira puntual»
- La lista de mentiras, reconciliada con las trece de la presentación, cada una con su fila de la
  matriz, fecha, cuenta y la defensa que obliga a probar: `B/20:500` «Son trece, recontadas sobre la tabla.»
- Las reglas propias, en otra lista: `B/20:504` «Las reglas propias de Mercado Pago: otra lista»
- `B/20:519` «Son seis, recontadas sobre la tabla»
- Lo simulado sin medir, aparte (la respuesta perdida, la red cortada, y los avisos fuera de orden,
  que `WH-3` no observó): `B/20:522` «Lo que el falso simula sin haberlo medido, aparte»
- Los correos del proveedor al cliente no se simulan: `B/20:532` «Lo que no se simula»
- La tabla vieja, tachada con el destino de cada fila: `B/20:538` «Dónde quedó cada fila de la tabla vieja»
- El ⚠️ viejo de la conciliación, cerrado en su mayor parte, con lo que queda afuera declarado:
  `B/20:570` «Lo que queda afuera de las dos listas»
- El control automático: `B/20:63` «las dos listas del proveedor falso, con dos predicados»
- `$B/spec.md:158` «Y miente sólo donde dice una lista cerrada de trece mentiras medidas»
- `$B/descomposicion.md:216` «las trece mentiras de la lista cerrada del»

### C13, `L3-d` · la batería que vigila a Mercado Pago

- El § nuevo: `B/20:615` «La batería que vigila a Mercado Pago»
- `B/20:626` «sola, una vez por semana»
- `B/20:627` «sola, una vez por mes»
- `B/20:631` «Y a mano cuando se quiera»
- `B/20:633` «Qué hace si algo cambió: avisa y no toca nada.»
- `B/20:637` «Si no corre, avisa el vigía externo»
- El canal de cada aviso se registra, sin decidir nada (N9): `B/20:639` «Qué avisos registra»
- `B/20:643` «Ninguna credencial de producción la tiene un agente»
- El vigía, con la batería: `B/09:990` «también la batería que vigila a Mercado Pago»
- El cap. 06, donde la regla de caducidad no tenía quien la disparara:
  `B/06:348` «la regla 2 tiene quien la dispare»
- `B/06:370` «sí es código»
- La unidad: `$B/descomposicion.md:124` «la batería que vigila a Mercado Pago, semanal en la cuenta de pruebas»

### C15, `L1-g`, `L1-h` · migrar a los clientes de un plan retirado

- La frase que se contradecía, corregida: `B/10:75` «Nada migra por plazo ni por retirar»
- Los caminos que ya existían, del §3.2, tachados: `B/10:46` «con su propio mecanismo, el»
- El § nuevo: `B/10:143` «Migrar a los clientes de un plan retirado»
- `B/10:154` «Siempre con aviso previo, suba o baje»
- El anual espera su renovación (`L1-g`): `B/10:162` «También en el anual»
- `B/10:164` «Si el destino ofrece su ciclo, se cambia el monto sobre la misma autorización»
- `B/10:169` «Si el destino no ofrece su ciclo, no se lo mueve solo»
- `B/10:172` «es un excedente con fecha conocida»
- `B/10:174` «Pausados y en gracia esperan»
- `B/10:177` «sale de la»
- La cancelación (`L1-h`): `B/10:180` «puede cancelar una migración anunciada»
- Su NO cierra: `B/10:217` «La migración de un plan retirado»
- La transición nueva: `B/03:184` «llega el día de la migración de esa fila»
- `B/03:184` «Con la mutación confirmada, la fila de alcance pasa a»
- La cola que aplica el cambio de versión: `B/12:189` «encola también el cambio de versión de una»
- Las dos tablas: `B/02:58` «una migración de los clientes de un plan retirado»
- `B/02:59` «una fila por suscripción alcanzada»
- El contador de la promo: `B/02:652` «también lo pone en 0»
- El reintento de la mutación: `B/09:163` «la de una migración (revisión del owner, 2026-09-28, C15)»
- `B/14:294` «la de una migración (revisión del owner, 2026-09-28, C15)»
- La acción administrativa, la decimoséptima: `nucleo/08:170` «migrar a los clientes de un plan retirado»
- `nucleo/08:174` «La tabla tiene DIECISÉIS filas vivas»
- `nucleo/08:182` «migrar o cancelar una migración»
- `nucleo/08:184` «dicen dieciséis desde la misma revisión»
- Sus espejos en la autorización: `V/17:344` «la decimoséptima, migrar a los clientes de un plan retirado o cancelar una migración»
- `V/17:363` «las catorce primeras y la decimoséptima»
- Es plata, y lo que aplica después es una transición: `V/17:438` «La decimoséptima, migrar a los»
- `V/17:441` «una transición y no una ejecución de sistema»
- `V/17:513` «la 17, migrar a los clientes de un plan retirado»
- `$V/spec.md:210` «y la decimoséptima, migrar a los clientes de un plan retirado»
- `B/03:2067` «dicen dieciséis, y por»
- Los correos: `nucleo/07:232` «migración de un plan retirado»
- `nucleo/07:233` «la migración se canceló»
- `nucleo/07:137` «y los tres de una migración de un plan retirado»
- `B/19:120` «los tres correos de una migración»
- El panel, previsualización y lo que queda para resolver a mano: `B/19:214` «las migraciones de planes retirados»
- `B/19:206` «C15: entra la migración»
- El censo de emisores: `D/12:867` «el cambio de versión de una migración de un plan retirado»
- La transición en el índice de la épica: `$B/spec.md:58` «`S37`, la aplicación de una migración»
- La unidad `B12`: `$B/descomposicion.md:135` «y la migración mueve a los que quedaron, con aviso, en su renovación»
- `$B/descomposicion.md:142` «treinta y tres transiciones vivas de la Suscripción»
- `$B/descomposicion.md:767` «y cancelar la migración no toca a los ya aplicados»
- La dependencia con `V2`, en la fila que ya existía: `$B/descomposicion.md:345` «Es la misma fila y no una nueva»
- El flujo E2E: `B/20:677` «la migración de un plan retirado»

### N2 · `qzpay` se saca

- El package del cobro, publicable solo: `$B/spec.md:96` «se saca, y el cobro nuevo se escribe en un package compartido del monorepo que se puede»
- `$B/spec.md:99` «no depende de ninguna app ni de la mitad de verticales, salvo del package»
- `$B/spec.md:102` «queda sólo como referencia de lectura»
- `$B/spec.md:105` «se congela y se archiva después del corte»
- La absorción, tachada: `$B/spec.md:330` «se saca, y queda sólo como referencia de lectura»
- `$B/descomposicion.md:819` «se saca y queda sólo como referencia de lectura»
- El guard: `B/20:64` «el cobro vuelve a depender de lo que dejó»
- Congelar y archivar, en el paraguas: `D/16:440` «congelado hasta el corte, archivado después»
- `D/16:449` «Después del corte, se archiva.»

### N4, `L3-f` · el control automático de la relectura

- La quinta entrada de `D17`: `nucleo/04:141` «y una acción administrativa cuya condición depende de ese estado»
- `nucleo/04:141` «la regla tiene un control automático»
- El recuento de apoyos: `nucleo/04:303` «Recorrido otra vez el 2026-09-28, al darle a»
- `nucleo/04:229` «20 apoyos sobre 15 invariantes»
- El guard: `B/20:65` «una decisión sale de lo que dice un aviso del proveedor sin releerlo por id»
- En la regla del webhook: `B/03:2701` «esta regla tiene control automático»
- Lo que los tres guards no verifican: `B/20:67` «llegaron con la revisión del owner (2026-09-28), y los tres son de»

### N3, `L3-e` · E2E para reducir el smoke manual

- `B/20:685` «Lo que hace falta para que el E2E reemplace el smoke manual»
- `B/20:689` «El Mercado Pago falso corre también como servidor HTTP»
- `B/20:693` «Un reloj que se puede adelantar en las pruebas»
- `B/20:696` «no puede vivir en ninguna de las dos»
- Cada unidad escribe la prueba de su flujo: `B/20:701` «Cada unidad escribe la de su flujo»
- `B/20:703` «El recorte del checklist de smoke manual, sección por sección»
- `B/20:708` «Lo que queda manual, porque no se puede simular»

### N8, N9, `L3-g` · pendientes de medición

- Los dos huecos de N8, sin decidir: `B/12:1130` «pendiente de medición»
- `B/12:1138` «una pausa del pagador se leería como mora»
- Los dos canales de avisos, con su causa y el requisito de `L3-g`:
  `B/06:476` «Los dos canales de avisos del proveedor: pendiente de medición»
- `B/06:490` «no puede producir efecto doble»

### Los guards y sus recuentos

- `B/20:369` «la numeración llega a»
- `B/20:380` «entraron con la revisión del owner, 2026-09-28 (C13 y»
- `B/20:382` «así que queda en 35»
- `B/20:383` «que nacen con unidad (revisión del owner, 2026-09-28), más los»
- `$B/spec.md:67` «diecisiete guards»
- `$B/descomposicion.md:707` «y entran `G15`, `G16` y `G17`, los tres de `B1`»
- `$B/descomposicion.md:756` «pone `G15` en rojo»
- `$V/descomposicion.md:514` «y entran `G15`, `G16` y `G17` en la otra, los tres de `B1`»

## 2. Conteos que cambiaron

Recontados sobre la tabla o la lista, no restados.

| qué | antes | ahora | espejos corregidos |
|---|---|---|---|
| filas de `B/20` §2 | 14 | 17 (`G15`, `G16`, `G17`) | `B/20` (tabla de recuento), `$B/spec.md` §2 |
| guards distintos del programa | 32 | 35 | `B/20`, `$B/descomposicion.md` §4, `$V/descomposicion.md` §4 |
| guards con unidad | 32 | 35 (los tres, de `B1`) | `B/20` |
| guards por épica | 20 verticales · 12 billing | 20 · 15 | `$B/descomposicion.md` §4, `$V/descomposicion.md` §4 |
| numeración de guards con id | `G1`–`G14` | `G1`–`G17` | `B/20` |
| lo que miente el falso | 15 filas mezcladas | 13 mentiras + 6 reglas propias + 3 simulaciones | `B/20` §3.2, `$B/descomposicion.md` §2.3, `$B/spec.md` §3.7 |
| transiciones vivas de la Suscripción | 32 | 33 (`S37`) | `$B/descomposicion.md` §2, `$B/spec.md` §2 (`S1`–`S37`) |
| acciones administrativas vivas | 15 | 16 (entra la decimoséptima; la 16 sigue retirada) | `nucleo/08` (tres), `V/17` (nueve), `B/03` (siete), `B/19` §6, `$V/spec.md` |
| acciones que son capacidad del actor | 14 | 15 (las catorce primeras y la decimoséptima) | `V/17` (tres), `$V/spec.md` |
| entradas de `D17` | 4 | 5 (la acción administrativa) | `nucleo/04` |
| apoyos del §3 de `nucleo/04` | 19, guard 5, doble apoyo 4 | 20, guard 6, doble apoyo 5 (`D17`) | `nucleo/04` (tabla del §5, nota y recorrido) |
| flujos E2E de `B/20` §5 | 7 | 8 (la migración) | sin espejo con cifra |
| filas del panel en `B/19` §6 | 2 | 3 | `B/19` |

**Lo que no se movió**: las once dependencias entre épicas (la migración se sumó a la fila 6, que
ya era `B12` contra `V2`); los 24 motivos (la migración usa `DIVERGENCIA_DE_MONTO`); los cinco
hechos del reloj; los 52 invariantes; las filas de la matriz (todo lo de la matriz va propuesto
abajo).

## 3. Para el log y la matriz (pide OK del owner)

Todos los IDs grepeados en `01-decision-log.md` y en la matriz: los últimos de cada prefijo son
`DEC-SUB-022`, `DEC-TEST-002` y `EX-50`; `WH-6` no existe (sólo lo nombra el informe `02`).

1. **📌 en `DEC-ARCH-004`**, sobre la definición 2 y la implicación 5. Texto: *«`qzpay` no se
   absorbe: se saca. Todo el cobro nuevo se escribe bien encapsulado en un package compartido del
   monorepo, de modo que se pueda publicar como package npm propio sin reescribirlo: no depende de
   ninguna app ni de la mitad de verticales, salvo del package del contrato. `qzpay` queda sólo
   como referencia de lectura: su adaptador de Mercado Pago sirve para ver cómo se arma un pedido
   o se verifica una firma, y su motor y su esquema no. La implicación 5 (se absorben el 2 % del
   motor y los modelos de las 27 tablas) queda superada: con `DEC-MIG-003` y el modelo nuevo no se
   absorbe ninguna tabla. `qzpay` se congela hasta el corte y se archiva después (`D/16` §4.5), y
   `G16` falla si vuelve `@qazuor/qzpay` (revisión del owner, 2026-09-28, N2).»* **Razón**: la
   implicación 5 se lee como permiso para portar el esquema de `qzpay`.
2. **`DEC-SUB-023` nueva (C15, `L1-g`, `L1-h`)**. Texto: *«Migrar a los clientes de un plan
   retirado a una versión vigente y vendible de la misma vertical es un acto aparte del
   `SUPER_ADMIN` (la acción administrativa 17), con aviso previo de 60 días por defecto,
   configurable y nunca menor que el mínimo de `DEC-MP-002`, y tres correos (al anunciar, a 30 y a 7
   días de la fecha de cada cliente). Se aplica a cada cliente en su renovación, la primera
   posterior a cumplirse el aviso, también en el anual. Si el destino ofrece su ciclo, `S37` muta el
   monto sobre la misma autorización siete días antes, sin re-autorizar, y el cambio de versión
   entra en la renovación por la cola de `B/12` §2; si no lo ofrece, queda para resolver a mano. El
   excedente tiene la fecha de aplicación; pausados y en grace esperan a volver; quien cambia de
   plan o se da de baja durante el aviso sale; el `SUPER_ADMIN` puede cancelar la migración para
   los que no se aplicaron, con el correo "ya no cambia nada". No es el upgrade de `DEC-SUB-007` ni
   el downgrade de `DEC-SUB-008`: es un tercer camino.»* **Razón**: agrega mecanismo, tabla,
   transición y acción, y `B/10` §3.4 decía lo contrario.
3. **📌 en `DEC-SUB-007` y `DEC-SUB-008`**: *«La migración de un plan retirado (`DEC-SUB-023`) es un
   tercer camino: muta el monto como un aumento y baja o sube capacidades en la renovación.»*
4. **📌 en `DEC-MP-002`**: *«La migración de un plan retirado usa la regla de esta decisión para su
   fecha (primer cobro estrictamente posterior, empate a favor del cliente) y su mínimo como piso
   del plazo (`DEC-SUB-023`).»*
5. **`DEC-TEST-003` nueva (C13, `L3-c`, `L3-d`, N3, `L3-e`, N4, `L3-f`)**. Texto: *«El proveedor
   falso tiene dos listas cerradas: trece mentiras medidas, cada una con su fila de la matriz, su
   fecha, su cuenta y la prueba que demuestra que el código la resiste; y seis reglas propias del
   proveedor, que el falso cumple igual. Lo simulado sin medir va aparte. Por defecto el falso miente
   siempre y una prueba puede apagar una mentira nombrándola. Una batería repite cada medición
   semanal en la cuenta de pruebas, mensual en producción y a mano cuando se quiera, compara también
   la forma de las respuestas, avisa por correo y no ajusta nada; si no corre, avisa el vigía
   externo. El falso corre también como servidor HTTP, hay un reloj adelantable, y cada sección del
   checklist de smoke manual que tenga su prueba de punta a punta sale del manual; queda manual el
   checkout real, los correos del proveedor al cliente, Cloudflare y los horarios reales. Tres
   guards nuevos, de `B1`: `G15` (las dos listas), `G16` (vuelve `qzpay`) y `G17` (una decisión sin
   releer por id, también en las acciones administrativas).»*
6. **📌 en `DEC-MP-008` y en `DEC-SUB-009`**: *«Pendiente de medición (revisión del owner, N8): una
   pausa o una cancelación hecha por el pagador desde su cuenta de Mercado Pago no se distingue hoy
   de una del proveedor; hasta medir, esta decisión la trata como mora o como baja del proveedor.
   `B/12`, lo que no cierra.»*
7. **Matriz, fila nueva `EX-51`** (`VERIFIED`, 2026-09-24, producción): *«¿A qué hora cobra el
   proveedor un registro de cobro con fecha dada?»* Evidencia ya medida: trece renovaciones con fecha
   13:13-13:28 `-04` entraron a las 14:01-14:02, y una con fecha 17:43 a las 18:02 (`B/09` §6 punto 2,
   `03-handoff.md`). **Razón**: la M8 de la lista del falso no tiene fila, y `G15` la pide.
8. **Matriz, fila nueva `EX-52`** (`UNKNOWN`): *«Si el pagador cancela desde su cuenta de Mercado
   Pago, ¿qué aviso llega, por qué canal, y qué campo del preapproval la distingue de una
   cancelación nuestra o de una por antifraude?»* Con un comprador de prueba en sandbox, los dos
   canales apuntados al receptor. **Razón**: N8, primer hueco.
9. **Matriz, fila nueva `EX-53`** (`UNKNOWN`): *«¿Puede el pagador pausar desde su cuenta de Mercado
   Pago? Si puede, ¿cómo se ve en el preapproval y en `/authorized_payments/search`, y qué aviso
   llega por cada canal?»* **Razón**: N8, segundo hueco; en la mora hay intentos rechazados en el
   ciclo (`GR-3`) y en una pausa voluntaria no.
10. **Matriz, fila nueva `WH-6`** (`UNKNOWN`): *«¿Qué entrega el proveedor por el canal IPN y qué por
    Webhooks, con las dos URL de la aplicación apuntadas al receptor, y cuántas entregas duplicadas
    produce un mismo hecho entre los dos?»* Secuencia de la sonda 09 (crear, mutar monto, pausar,
    reanudar, cancelar) con 90 s entre acciones, más la cancelación del comprador de `EX-52` y un
    pago por `/v1/orders`. **Razón**: N9 y `L3-g`.
11. **Matriz, reabrir la mitad de producción de `WH-5`** (antifraude): *«2 de 2 cancelaciones por
    antifraude no produjeron `subscription.updated`»* se leyó en `billing_webhook_events`, que está
    **después** del descarte del receptor de hospeda2: el filtro `source_news=webhooks` (HOS-159)
    contesta `200` y descarta en silencio toda entrega IPN, con log `debug`. Hay una tercera
    explicación, además de pérdida o no notificación: llegó por IPN y se descartó. Se repite a
    propósito con los dos canales escuchando. Propuesta: la fila pasa a `PARTIALLY_SUPPORTED`
    (mecanismo `VERIFIED` en sandbox; alcance de producción por remedir).
12. **Matriz, reabrir `EX-15`** con la misma causa: *«mutar el monto NO emite ninguna entrega»* se
    midió con el receptor escuchando sólo el canal Webhooks. Propuesta: `PARTIALLY_SUPPORTED`
    (Webhooks medido, IPN sin medir) hasta `WH-6`. **Con las propuestas 7 a 12, la matriz pasaría de
    107 a 111 filas: `VERIFIED` 56 → 55, `PARTIALLY_SUPPORTED` 15 → 17, `UNKNOWN` 13 → 16**
    (contado sobre las propuestas, no con el script: se recuenta al escribirlas).

## 4. Casos vecinos (piden decisión, no los decidí)

1. **Los siete días de `S37`.** La decisión dice *«se aplica en la renovación»* y no dice cuándo se
   muta el monto, que tiene que ser antes del cobro. Escribí siete días antes de la fecha de
   aplicación: coincide con el tercer correo, deja entrar los 3 días del reintento de la mutación
   antes del cobro y evita que Mercado Pago le escriba *«cambió el monto»* a un anual diez meses
   antes. Es un plazo técnico (no configurable, por `L2-g`). La alternativa es mutar al cumplirse el
   aviso, como el aumento de `DEC-MP-002`.
2. **«A 30 días y a 7 días»**: lo leí como antes de la fecha de cada cliente, que es lo único que
   tiene sentido en un anual que renueva en diez meses. La lectura de `DEC-MP-002` en mensual
   coincide.
3. **Una fila nueva y no la extensión de «cambiar de plan».** La presentación dice *«quince
   acciones»* y pone la migración dentro de «cambiar de plan», pero la tabla de `nucleo/08` §3 da
   un permiso por fila y la migración es sólo de `SUPER_ADMIN`. La sumé como la decimoséptima (el
   16 no se reusa). Si la tanda 4 agrega «publicar versión de plan» (`L1-f`), la migración podría
   vivir ahí; hoy esa fila no existe. La presentación queda desalineada en la cifra.
4. **`S37` la corre el sistema.** `V/17` §3.3 dice que ningún actor de sistema ejecuta una fila de la
   tabla. Escribí que `S37` es una transición que aplica lo que la persona firmó al anunciar, como
   `S9` re-emite con la firma original y como el aumento de `DEC-MP-002` se aplica solo en su fecha.
   Pide confirmación del owner.
5. **Una cohorte que incluye la cuenta del propio `SUPER_ADMIN`** (`V/17` §3.2 regla 5, `actor ≠
   sujeto`). La discontinuación lo resolvía con *«el sujeto es la vertical»* (`V2-s`); para la
   migración no está escrito si esa fila se excluye o si el acto entero se rechaza.
6. **Cancelar durante los siete días.** Una fila con `S37` ya corrido está `APLICADA` y la
   cancelación no la alcanza, aunque la versión todavía no cambió: recibió el tercer correo y no
   recibe el de *«ya no cambia nada»*. Deshacerlo sería otra mutación.
7. **`PARA_RESOLVER` sin plazo.** Los que no tienen su ciclo en el destino quedan en el plan
   retirado hasta que una persona los resuelva, sin fecha. ¿Hay un plazo o un recordatorio?
8. **Una cortesía temporal el día de la migración** (`PAUSED · COURTESY`): espera a volver, lo que
   puede correr la fecha varios meses. Lo dejé en el NO cierra de `B/10`.
9. **Lo que queda afuera de las dos listas del falso**: `RC-7`, `GR-3`, `PS-2`, `PS-6` y
   `last_charged`. Son comportamiento medido que no es mentira ni regla exigida, y el barrido y `S6`
   necesitan que el falso lo reproduzca. ¿Van a la segunda lista, o hace falta una tercera?
10. **Tres cifras de la presentación que el repo no sostiene**: el *«5 de 8»* (la matriz cita cinco
    filas, `EX-4`, `EX-21`, `EX-34`, `EX-35` y `CN-1`; el *«de ocho»* sale de `$B/spec.md` §3.3 y no
    de una fila, y el *«5 de 8»* de `DEC-ARCH-004` habla de capacidades, no de cambios); el
    *«hasta 14 días de demora»* (lo medido es de 0,6 a 32 s en `WH-2` y una escalera de reintentos
    de unas 7 h en `WH-4`/`WH-5`); y *«fuera de orden»* entre las mentiras (`WH-3` no lo observó:
    pasó a simulación). Además `EX-5` (el campo `items`) entró en M1 y la presentación no lo nombra.
11. **`G16` no mira las dependencias del package del cobro hacia otros packages compartidos**
    (`@repo/db`, `@repo/logger`, `@repo/schemas`). La decisión dice *«sin dependencias hacia apps ni
    hacia verticales»*; cualquiera de esos también impediría publicarlo en npm sin reescribir.
12. **Dónde vive el reloj adelantable**: lo usan las dos mitades y `G14` prohíbe que una importe a la
    otra. Lo dejé para la FASE 5.
13. **La regla de smoke de `CLAUDE.md`** (todo PR de billing exige smoke manual de staging) no la
    puedo editar: el recorte sección por sección de `B/20` §5.1 la contradice cuando se aplique. El
    checklist es el de SPEC-143.
14. **La batería en producción necesita una autorización del owner guardada para cada mes**: quién
    la custodia y cómo se renueva no está escrito. Y el margen del vigía (un día sobre la cadencia)
    no está medido, igual que las 26 h del barrido.
15. **Qué correo manda Mercado Pago cuando la migración sube el monto**: `EX-3` lo midió al bajar
    (*«El vendedor Hospeda cambió el monto»*). Conviene una fila si se quiere que el tercer correo lo
    anticipe con el texto exacto.
16. **`G17` no verifica que la lectura sea del mismo acto**: una lectura por id vieja pasa en verde.
    `D17` sigue diciendo *«relee antes de actuar»*; si se quiere que el tipo lleve su instante y la
    decisión rechace una lectura anterior al acto, es un agregado.
17. **La fila 6 de dependencias** creció en vez de sumar una nueva. Las filas 4 y 5 (`B8` contra
    `V2`, dos campos) son el precedente contrario; la 6 ya juntaba dos campos. Si se prefiere una
    fila por campo, las dependencias pasan de 11 a 12.
18. **La cola de `B/12` §2 no tiene transición** para el descenso de un downgrade, y el cambio de
    versión de la migración viaja por ella: es un hueco anterior que la migración hereda.
19. **En `$B/descomposicion.md` §2.3 queda una fila de `B12`** (*«se deja de cobrar antes de dejar
    de prestar»*) que es de la discontinuación y la tanda 1 no tachó. Es historia de un § marcado
    como rastro; no la toqué.
20. **El receptor nuevo y el descarte de IPN**: escribí que no lo hereda *«por inercia»* y que si lo
    tiene se decide después de medir. Si el owner prefiere que hasta la medición el receptor nuevo
    registre los IPN sin actuar (la opción 3 del informe `02`), es una línea.

## Key Learnings

1. Una acción nueva en un catálogo con números retirados toma el número siguiente al retirado, no el
   hueco: la decimoséptima deja *«las catorce primeras»* partido en dos, como estaba en la FASE 9
   vuelta 2.
2. Un guard sobre la lectura del aviso tiene que dejar pasar la `version`, que el receptor lee del
   cuerpo para descartar lo viejo; si no, nace en rojo sobre el camino correcto.
3. Las cifras de la presentación se reconcilian contra la matriz fila por fila: tres de las trece
   mentiras traían una cifra o una clase que ninguna fila sostiene.
4. Un mecanismo que muta el monto y otro que cambia la versión no tienen que ser la misma
   transición: el monto tiene que llegar antes del cobro y las capacidades en la renovación.
