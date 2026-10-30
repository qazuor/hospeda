---
title: "FASE 9 vuelta 2 · aplicación — grupo G"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo G, las últimas dos decisiones

Las dos filas finales de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md): `R18-b` y
`Q-ALTAS-b`, que cierran las preguntas 1 y 2 del §4 de
[`16-aplicacion-decisiones-tardias.md`](./16-aplicacion-decisiones-tardias.md). Medido y editado
en el worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits, sobre `5991bae575` (el
grupo F commiteado). `B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`.

## 1. Qué se aplicó

### `R18-b` — el espejo de `R18` y `S7` cancelan los complementos como `S11`

**Por remisión, sin copiar la regla.** La regla de complementos de `S11` (`R1-a`) ya trae su
selección (la de `S32`, sólo filas en `ACTIVE`), su fin de servicio (el de la principal) y su
cierre (`S21` antes que su `S12`, `R1-c`). El espejo y `S7` la invocan y declaran que esas filas
cuentan como una `CANCEL_SCHEDULED` de `S11`. Así las alcanzan el reintento de la cancelación
sin confirmar y el orden de `S12`, que hasta acá hablaban sólo de `S11` y `S26`.

- La salvedad de `R18` en `B/03` §10.1:
  `B/03:2776` — «Y sus complementos los cancela como `S11`»
- `B/03:2776` — «esas filas de complemento son una `CANCEL_SCHEDULED` de `S11` en todo lo que el diseño dice de ella»
- La fila de `S7`, con lo que la remisión deja afuera:
  `B/03:155` — «Esa regla toma sólo las que siguen en `ACTIVE`, y aquí son las que `S32` no alcanzó a pausar al suspender»
- El par de la cancelación sin confirmar, que decía que no alcanza a la `CANCEL_SCHEDULED` de `S7`:
  `B/03:2778` — «sí a las filas de complemento que `S7` o el espejo de `R18` llevan a `CANCEL_SCHEDULED` por la regla de `S11`»
- El orden de `S12`: `B/03:160` — «y para la que puso la regla de `S11` desde el espejo de `R18` o desde `S7`»
- El reintento del barrido, punto 3:
  `B/09:271` — «Cuenta como de `S11` la fila de complemento que el espejo de `R18`»
- **Espejo en `B/16` §4.3**, junto a *“en la baja desde `ACTIVE` ese alguien es `S11`”*:
  `B/16:706` — «Y el mismo alguien es la regla de `S11` cuando la principal llega a `CANCEL_SCHEDULED` sin pedir la baja»
- Y por qué ninguna de las dos entra en la lista de catorce:
  `B/16:709` — «Ninguna de las dos saca a la principal de las filas vivas»
- **El ítem de `S7` del “NO cierra” de `B/16`** hablaba de los complementos de `S7`, así que lo
  ajusté: el pausado por `S32` sigue siendo residuo.
  `B/16:1044` — «así que el pausado por `S32` sigue siendo este residuo»
- **Espejo en `B/19` §4, fila 22**: el aviso de quien pagó mientras mandábamos cancelar ahora dice
  qué pasa con sus addons, como la fila 3-bis.
  `B/19:140` — «que su cobro también se cortó y se siguen viendo hasta la misma fecha»
- Unidad **B7** (la mora, dueña del espejo y de `S7`), fila y criterio; el modelo del complemento
  sigue en B10: `$B/descomposicion.md:133` — «y sus complementos recurrentes los cancela, como `S7`, la regla de `S11`»
- `$B/descomposicion.md:740` — «si sigue `ACTIVE` cobrando, el espejo no aplicó la regla de `S11`»

**El ítem declarado de `S7` que cerró F** (`B/19` «NO cierra», *«qué se le dice a quien entra por
`S7` a `CANCEL_SCHEDULED`»*) trata del aviso a la persona y no de sus complementos, así que no lo
toqué. Lo que dice sigue siendo cierto: la fila 22 cubre los dos caminos, y ahora también nombra
los addons.

### `Q-ALTAS-b` — si falla la mitad de billing, se reintenta y nunca se deshace la de verticales

- `B/10` §4.3, después del orden de las dos mitades:
  `B/10:169` — «Si la mitad de billing falla, la acción la reintenta hasta que entra»
- `B/10:170` — «Nunca deshace la mitad de verticales»
- `B/10` §4.6: la fila *“cerrada a altas”* decía que el estado ya no existe, y existe mientras
  la mitad de billing no entró: `B/10:420` — «Salvo mientras la mitad de billing del acto no entró»
- El capítulo de verticales, `V/02` §2.1, donde F escribió quién escribe `admite_altas`:
  `V/02:123` — «y esta escritura no se deshace nunca»
- Unidades: la mitad de billing y su reintento, **B12**, fila y criterio:
  `$B/descomposicion.md:138` — «sin deshacer nunca la de verticales»
- `$B/descomposicion.md:745` — «si vuelve a `sí`, la acción deshizo la mitad de verticales»
- La mitad de verticales, **V2**, criterio y fila ✚ del §2.10:
  `$V/descomposicion.md:522` — «esa escritura no se deshace cuando la mitad de billing falla»
- `$V/descomposicion.md:408` — «y no se deshace si la de billing falla»

**El catálogo de `NUCLEO/08` §3 no tiene la fila.** Sus quince filas son: la cortesía temporal,
el grant permanente, el pago manual, confirmar que no se pagó, la postulación de Partner, el plan
de Partner, levantar la marca, cancelar, pausar o reanudar, cambiar de plan, extender un trial,
moderar, reembolsar, asentar un cobro o una devolución, y editar una ficha ajena. **Ninguna es
discontinuar una vertical**, ni la nombra como una de sus escrituras. No la agregué: va como
pregunta 1 (§4).

## 2. Conteos recontados

Ninguna lista con conteo congelado cambió. Recontado con `python3` sobre la fuente:

| lista | antes → ahora | por qué no cambia |
|---|---|---|
| filas del §10.1 de `B/03` | 14 → **14** | `R18-b` es una oración dentro de la salvedad de `R18` |
| disparadores de la orfandad, `B/16` §4.3 | catorce → **catorce** | ni la salvedad de `R18` ni `S7` sacan a la principal de las filas vivas (`B/16:709`) |
| filas de `B/19` §4 | 33 → **33** | la fila 22 ganó una oración |
| acciones de `NUCLEO/08` §3 | 15 → **15** | no agregué la fila de discontinuar (pregunta 1) |
| situaciones de `B/10` §4.6 | sin cifra | la fila *«cerrada a altas»* sigue tachada, con una salvedad transitoria |
| filas de la matriz | 99 → **99** (5 `UNKNOWN`) | `python3 contar-filas-de-la-matriz.py` en `$D/` |

## 3. Propuestas para el log y la matriz (lista consolidada final)

Es la lista del §3 de `16-`, con lo que agregan `R18-b` y `Q-ALTAS-b` (entradas 1, 6 y 12), y
con el cambio que `R1-c` le hacía a la entrada 1 ya escrito en su texto. Cada ID se verificó con
`rg -n "^### DEC-XXX-NNN" $D/01-decision-log.md`, y los dieciséis existen en la línea que se
cita. La matriz se contó con `$D/contar-filas-de-la-matriz.py`: **99 filas**, **5 `UNKNOWN`**
(`PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`), la última es `EX-42`. `R18-b` y `Q-ALTAS-b` no agregan
filas de matriz: cancelar un preapproval ya está medido (`PA-5`), y el reintento de la mitad de
billing no llama al proveedor más que `S26`–`S28`.

**Sin propuesta**: `R11-3b` (`G1-3` no está en el log), `R7`/`R7-b` (el log no tiene decisión de
identidad de Partner), y `R24`, `Q-FECHA` y `Q-ALTAS-b` por separado (van dentro de la entrada 12).

### Log

1. **`DEC-ADDON-002`**, implicación 6 (`:1909`). **Qué cambia**: *“cancelar el plan no cancela
   los addons”* deja de valer para la baja desde `ACTIVE` y para la principal que llega a
   `CANCEL_SCHEDULED` por el espejo de `R18` o por `S7`. **Origen**: grupo A (`R1-a`), grupo F
   (`R1-c`) y grupo G (`R18-b`). **Razón**: es la frase que las tres precisan, y el log no lo dice.
   **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R1-a`, `R1-c` y `R18-b`)**:
   > la baja desde `ACTIVE` (`S11`) cancela en el proveedor, en el mismo acto y con la misma regla
   > que la principal, los complementos recurrentes que dependen de ella —la selección de `S32`—;
   > siguen dando servicio hasta el fin de servicio y en esa fecha los cierra `S21`, antes que su
   > propio `S12`. La misma regla corre cuando la principal llega a `CANCEL_SCHEDULED` sin pedir la
   > baja: por el espejo que lee nuestra cancelación después de que el pago le ganó la escritura a
   > `S6` o `S3`, y por `S7`. Lo que sigue valiendo es que la instancia no se apaga con el plan: la
   > apaga la orfandad.
2. **`DEC-ADDON-004`** (`:3423`). **Qué cambia**: el complemento en `CANCEL_SCHEDULED` muere por
   `S21` en la fecha de fin, antes que su `S12`. **Origen**: grupo F, `R1-c`. **Razón**: es la
   decisión que dice que el complemento sin instancia muere en el acto, y `R1-c` fija el orden de
   ese acto contra el `S12` del propio complemento. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R1-c`, opción 2)**: cuando
   > la principal y su complemento están en `CANCEL_SCHEDULED` con la misma fecha de fin —por
   > `S11` o por `S26`—, en esa fecha corre primero el `S12` de la principal, la orfandad corre
   > `A5` y `S21` toma el complemento antes que su propio `S12`. Si su último cobro pagó días
   > posteriores, abre el motivo 14, que propone no devolver, y una persona ve el caso y puede
   > apartarse. Se eligió contra la recomendación, que era proponer devolver la parte proporcional.
3. **`DEC-GRANT-007`** (`:3787`). **Qué cambia**: la cortesía re-emitida arranca al agotarse el
   crédito. **Origen**: grupo A, `R17`. **Razón**: su título dice *«se re-emite sobre la sucesora
   cuando autoriza»*. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: sobre una sucesora
   > que vive del crédito de `DEC-SUB-006`, la cortesía re-emitida arranca al agotarse el crédito;
   > `S9` sigue corriendo al autorizar y la pausa cruza los N cobros que caen desde ese día.
4. **`DEC-RF-001`** (`:1613`). **Qué cambia**: la revocación alcanza al pago de la predecesora y a
   los complementos. **Origen**: grupo A, `R17` y `R1-b`. **Razón**: la revocación devolvía sólo el
   último pago de la fila. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17` y `R1-b`)**: sobre una
   > sucesora sin pagos, el pago que se devuelve es el de su predecesora, que se encuentra por
   > `sucedida_por`; y la orfandad que causa la revocación devuelve por `RF1` el último cobro de
   > cada complemento recurrente sólo si cae dentro de sus propios 10 días corridos; si no, va al
   > motivo 14.
5. **`DEC-SUB-009`** (`:1236`). **Qué cambia**: el crédito cuenta como período pagado.
   **Origen**: grupo A, `R17`. **Razón**: la cláusula del 2026-09-25 fijaba el fin en el acto para
   toda fila sin `covered_period`. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: el crédito de
   > `DEC-SUB-006` cuenta como período pagado: `fin_de_servicio = max(fórmula, fin del crédito)`.
   > El fin en el acto queda sólo para la fila sin `covered_period` y sin crédito.
6. **`DEC-SUB-019`** (`:5279`). **Qué cambia**: la cancelación de `S6` que pierde la carrera contra
   el pago no se espeja como baja, y los complementos de esa principal se cancelan como en `S11`.
   **Origen**: grupo F (`R18`) y grupo G (`R18-b`). **Razón**: `R18` es una consecuencia de la
   cancelación que esta decisión le pone a `S6` al vencer el grace; `DEC-SUB-021` sólo aporta el
   camino y `DEC-SUB-009` la forma del destino. `R18-b` completa el mismo caso. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R18` y `R18-b`)**: si `S6`
   > —o `S3` sobre una alta— manda la cancelación y el pago (`S5`) o la autorización (`S2`) le
   > ganan la escritura, la fila queda `ACTIVE` con el preapproval `cancelled`, y el espejo no la
   > corta: la lleva a `CANCEL_SCHEDULED`, con el fin de servicio de `S11`, y `S12` la termina.
   > Recibe el período que pagó, y la pantalla le dice que para seguir se vuelve a suscribir. Es la
   > respuesta que el owner dio a `S7` en el orden inverso. Y en los dos casos, el espejo y `S7`,
   > los complementos recurrentes de esa principal se cancelan por la regla de `S11`: su cobro se
   > corta en el acto y se siguen viendo hasta la misma fecha.
7. **`DEC-RF-006`** (`:4920`). **Qué cambia**: la lista de motivos que esa decisión volvió a leer
   por motivo pasa a 24, con 9 `SÍ`. **Origen**: grupo A (`R4`, el 23) y grupo F (`R20`, el 24).
   **Razón**: son los dos motivos nuevos de la vuelta y los dos llevan `SÍ`. **Texto**:
   > 📌 **2026-09-27 (FASE 9 vuelta 2, `R4` y `R20`, con OK del owner)**: se agregan dos motivos
   > con `SÍ` y default devolver. El 23, `ORDEN_PAGADA_SIN_INSTANCIA`, cuelga de la instancia del
   > addon de única vez y es el único que no cuelga de una suscripción. El 24,
   > `IMPORTE_COBRADO_DE_MÁS`, lo abre la comparación de cobros del barrido cuando un cobro
   > aprobado supera el monto esperado de su período, y propone devolver la diferencia; y el
   > contador de una promo baja sólo con un cobro que salió con el descuento. Son veinticuatro
   > motivos y nueve devuelven plata.
8. **`DEC-MIG-004`**, punto 2 de su 📌 del 2026-09-25 (`:2994`). **Qué cambia**: entre el paso 3 y
   el 4 no llega nada al handler nuevo. **Origen**: grupo B, `F-8V2B3-003`, `F-8V2C2-002`.
   **Razón**: su conclusión sobre el #15 deja de ser cierta. **Texto**:
   > 📌 **Precisado el 2026-09-27 (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`)**: entre el
   > paso 3 y el 4 no llega nada al handler nuevo. Las lápidas se siembran antes de apuntar la URL
   > (el nuevo paso 4b de `16-fase-7…` §4.2), así que el cobro en vuelo de un id que la base no
   > conoce encuentra su lápida del corte y se asienta por la regla de `G3-1`, sin marca si es del
   > día del corte.
9. **`DEC-MIG-005`** (`:5738`). **Qué cambia**: la población y el aviso del cobro sobre la lápida
   del corte. **Origen**: grupo B (`R2`, `R21`) y grupo F (`R21-b`, que reemplaza la última
   oración del grupo B). **Razón**: es donde vive *«no se devuelve la diferencia»*. **Texto**:
   > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R2`, `R21` y `R21-b`)**: el
   > cobro sobre una lápida del corte no se devuelve sólo si es del día del corte (`date_created`
   > del registro). Uno posterior abre `PAGO_TARDÍO_RECHAZADO` con la propuesta de devolverlo. La
   > población se lee de la re-verificación del día del corte, y un detector corre después del
   > corte, con dueño y fecha (`B/21` «NO cierra»). El titular de una autorización que sólo
   > conoce el proveedor entra a la población a avisar: antes del aviso previo, una pasada de sólo
   > lectura sobre el proveedor lista las autorizaciones vivas con su `payer_email`, y el 1b
   > cancela después. Quien aparezca recién en el manifiesto del 1b recibe el aviso después de la
   > cancelación, y lo que pierde se declara como en `G1-4`.
10. **`DEC-MIG-003`**, 📌 del 2026-09-25, puntos 2 y 3 (`:2674`). **Qué cambia**: la rama de
    aborto, su frontera, su inventario externo y los dos recuentos que detienen el corte.
    **Origen**: grupo B (inventario, 4b, frontera), grupo E (gate del paso 2 y 4c) y grupo F
    (`R9-b`; y `R3-G4-1`, que el owner confirmó *«con el 📌 de `DEC-MIG-003`»*). **Razón**: la
    rama de aborto ahora tiene inventario externo, su frontera incluye las lápidas, y el corte
    gana dos controles y un paso fuera de la rama. **Texto**:
    > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R3-G4-1` y `R9-b`;
    > `F-8V2A3-002`, `F-8V2C1-001`, `F-8V2B3-003`, `F-8V2A3-003`, `F-8V2C2-006`)**:
    >
    > - La rama de aborto devuelve la URL de notificación a la ruta del viejo y la verifica con
    >   una entrega real.
    > - El borrado del contenido de las `L1` pasa al paso 5b, después de abrir altas, porque el
    >   backup no restaura fotos ni tokens.
    > - El apuntado de la URL es el paso 4b, después de las lápidas. El paso 3, que es hasta donde
    >   cubre la rama de aborto, termina con el paso 4 y el 4b verificados y su sonda cancelada
    >   (el owner confirmó que la frontera de `G4-1` los incluye). El punto de no retorno no se
    >   mueve.
    > - El recuento de fichas de Gastronomía y de Experiencia se hace antes del 1a, y el corte no
    >   arranca si da una fila; el gate del paso 2 lo repite como segundo control, y si ahí da una
    >   fila el corte entra en la rama de aborto (`V/21` §2.4).
    > - El paso 4c, después del 4b y fuera de la rama, revalida las páginas públicas de las fichas
    >   que nacieron despublicadas.
11. **`DEC-ARCH-006`** (`:2241`). **Qué cambia**: la frontera gana una entrada en la dirección de
    ida, con su almacenamiento. **Origen**: grupo C (`R5`) y grupo F (`Q-FECHA`). **Razón**: el
    contrato ya no tiene sólo a billing contestando `cobertura()`. **Texto**:
    > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R5` y `Q-FECHA`)**: la
    > fecha de fin de servicio de una vertical la calcula billing y verticales la pregunta por
    > `finDeServicio` (`12-contrato…` §4.1), que en la implementación de arranque contesta
    > `NINGUNA`; la real contesta de `vertical_discontinuation`, una fila de billing por vertical
    > discontinuada, y verticales no guarda copia. El día del fin de servicio billing sólo avisa.
    > `PB2`, el hecho 4 y la invalidación de la vertical los ejecuta el reconciliador diario de
    > cobertura (`V/03` §9). `extenderTrial` sigue siendo la única escritura de billing en
    > verticales.
12. **`DEC-ARCH-011`** (`:5962`). **Qué cambia**: quién invalida el caché el día del fin de
    servicio, quién escribe `admite_altas`, qué pasa si falla la mitad de billing, dónde vive la
    fecha y qué pasa sin planes vendibles. **Origen**: grupo C (`R5`), grupo F (`Q-ALTAS`, `R24`,
    `Q-FECHA`) y grupo G (`Q-ALTAS-b`). **Razón**: es la decisión que ata *«deja de admitir
    altas»* a *«deja de admitir suscripciones»*, y las cinco filas la tocan. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `R5`, `Q-ALTAS`, `Q-ALTAS-b`, `R24` y `Q-FECHA`, con OK
    > del owner)**:
    >
    > - La invalidación de la vertical entera el día del fin de servicio la invoca el
    >   reconciliador diario de cobertura de verticales, no el barrido de billing.
    > - El acto de `SUPER_ADMIN` que discontinúa tiene dos mitades: verticales escribe
    >   `admite_altas = no` y billing escribe la fecha y los avisos. La acción administrativa las
    >   orquesta en ese orden. Billing no escribe `admite_altas`.
    > - Si la mitad de billing falla, la acción la reintenta hasta que entra y le muestra al admin
    >   que el acto quedó a medias; nunca deshace la mitad de verticales. Mientras tanto la
    >   vertical no admite altas y no tiene fecha, y nadie paga de más.
    > - La fecha la guarda `vertical_discontinuation` (`B/02` §2.1): la escribe el acto del día 0
    >   y la reescribe sólo el acortamiento de `B/10` §4.4.
    > - Retirar todos los planes vendibles no cierra la vertical: `T1` y `S1` exigen una versión
    >   vigente y vendible, y la pantalla dice que la vertical no tiene planes disponibles.
    >   Cerrarla a altas es discontinuarla.
13. **`DEC-TRIAL-004`** (`:429`). **Qué cambia**: la normalización deja de valer en todos los
    dominios. **Origen**: grupo D (condicionada a la pregunta 2 de `14-`), definitiva con `R23`.
    **Razón**: `R23` precisa la decisión, como dice su fila. **Texto**:
    > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R23`, `F-8V2A3-004`)**: el
    > seudónimo del correo es SHA-256 sin clave sobre el correo normalizado, y la función no cambia
    > nunca. Los puntos de la parte local y el `+alias` se sacan sólo en una lista cerrada de
    > proveedores que los ignoran —Gmail, Outlook y los que se midan—; en los demás dominios el
    > correo se compara tal cual, en minúsculas. Cambiar la lista no recalcula las filas viejas, y
    > se declara.
14. **`DEC-DATA-005`** (`:5507`). **Qué cambia**: `PURGED` trata lo que cuelga de la ficha por
    dueño del dato. **Origen**: grupo D, `R9`. **Razón**: el log sólo protege a las personas y a
    su contenido. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `R9`, con OK del owner)**: en `PURGED`, lo que cuelga de la
    > ficha se trata por dueño del dato, con una lista cerrada (`V/02` §4.1). Lo de un tercero se
    > conserva: la conversación queda en sólo lectura y su referencia admite una ficha ausente. La
    > alerta de precio se cierra con un aviso al turista. Lo del dueño que sólo sirve a la ficha se
    > borra con el contenido.
15. **`DEC-AUTH-003`** (`:6012`). **Qué cambia**: la clase de la acción 15. **Origen**: grupo D,
    `F-8V2A1-004`. **Razón**: deja de ser capacidad del actor. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `F-8V2A1-004`)**: la acción 15 no es capacidad del actor:
    > sus pasos 5 a 7 se evalúan sobre el dueño de la ficha. Su aviso es la fila 26 de `V/19` §4.
16. **`DEC-LEGAL-001`** (`:911`). **Qué cambia**: el asiento de un cobro sobre una lápida emite
    comprobante. **Origen**: grupo E (`F-8V2B3-005`) y grupo F (`R25`, que lo confirmó). **Razón**:
    la decisión dice *«por cada cobro»*, y un comprobante que no se envía a nadie necesita quedar
    dicho. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `R25`, con OK del owner)**: el cobro que se asienta sobre
    > una lápida —la del corte o la de recepción— también emite su comprobante, que queda en su
    > fila sin enviarse, porque la lápida no tiene destinatario.

### Matriz (`$D/06-mp-validation-matrix.md`, después de `EX-42`)

Sin cambios respecto de `16-` §3: `EX-43` a `EX-47`, sin huecos ni duplicados. Los espejos del
recuento están en `B/spec` §5.2, `$B/descomposicion.md` §2.7 y `B/06`.

1. **`EX-43`** (grupo A, `R4`). **Qué agrega**: el reenvío de una orden horas después.
   **Razón**: `A3` reenvía hasta 72 h o 7 días después, y `EX-41` midió el reenvío inmediato.
   > | **EX-43** ✚ | ¿Reenviar una orden con la misma clave y el mismo cuerpo horas después —con el token de la tarjeta ya vencido— devuelve la misma orden si existía, y qué devuelve si nunca se creó? | `A3` sobre el addon de única vez (`B/03` §8; FASE 9 vuelta 2, `R4`) | `UNKNOWN` | — | — | — | Pendiente de sonda. Si devuelve error cuando la orden existía, `A3` no la ve pagada y el caso cae en la comprobación de órdenes pagadas del barrido. |
2. **`EX-44`** (grupo B, `R2`). **Qué agrega**: si cancelar corta el reciclado. **Razón**: da el
   tamaño de la población del cobro sobre la lápida del corte.
   > | **EX-44** ✚ | ¿Cancelar un preapproval **corta el reciclado** de un registro de cobro abierto (`scheduled`/`recycling`), o un cambio de medio posterior todavía lo cobra? | el cobro sobre la lápida del corte y la exención de las terminales (`B/21` §2.5, `B/09` §3; FASE 9 vuelta 2, `R2`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte (`16-fase-7…` §4.2) sobre una sonda propia con un registro abierto. No es condición del corte: da el tamaño de la población |
3. **`EX-45`** (grupo B, `F-8V2C2-004`). **Qué agrega**: si una cancelación sigue `cancelled`
   horas después. **Razón**: el código actual registra seis que no.
   > | **EX-45** ✚ | Una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato, ¿sigue `cancelled` releída **horas después**? | el gate del paso 2 y el cobro sobre la lápida del corte (FASE 9 vuelta 2, `F-8V2C2-004`) | `UNKNOWN` | — | — | — | El código actual registra seis que no (`preapproval-recovery.service.ts:22`, HOS-937); se mide en el paso 0. `PA-5` midió la irreversibilidad en sandbox |
4. **`EX-46`** (grupo B, `F-8V2C2-002`). **Qué agrega**: a qué URL va un reintento. **Razón**: es
   el ⚠️ del paso 4b.
   > | **EX-46** ✚ | ¿A qué URL va el **reintento** de una notificación emitida antes de cambiar la URL de notificación de la aplicación: a la de entonces o a la vigente? | el paso 4b del corte (FASE 9 vuelta 2, `F-8V2C2-002`) | `UNKNOWN` | — | — | — | `WH-4` midió los reintentos, no su destino. Si va a la vieja, el evento se pierde y su cobro cae en el punto (3) del «NO cierra» de `B/21` sobre `G3-1` |
5. **`EX-47`** (grupo E, y `R20` la vuelve condición de alcance del motivo 24). **Qué agrega**: qué
   monto cobra un registro ya creado cuando la mutación cae en medio. **Razón**: sin medirlo no se
   sabe cuántos cobros va a ver el motivo 24; con él aplicado, el caso ya tiene detector aunque
   cobre el viejo. **Texto**:
   > | **EX-47** ✚ | Si el monto de un preapproval se muta **después** de creado el registro de cobro del ciclo (antes del lote, o durante sus reintentos), ¿el registro cobra el monto viejo o el nuevo? | el importe cobrado contra el esperado (`B/09` §3, `B/14` §2.4; FASE 9 vuelta 2, `F-8V2B3-001`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte sobre una sonda propia. `PC-1` midió el monto vigente con la mutación mucho antes del cobro. Si cobra el viejo, el motivo 24 (`B/02` §2.5, `R20`) es el que lo ve |

**Recuento, si el owner acepta las cinco**: la matriz pasa de **99 a 104 filas**, y los `UNKNOWN`
de **5 a 10** (`PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`, más `EX-43` a `EX-47`).

## 4. Preguntas abiertas

1. **El catálogo de `NUCLEO/08` §3 no tiene la fila de discontinuar una vertical.** `Q-ALTAS`
   dice *«la acción administrativa existente»* y `Q-ALTAS-b` le pone a esa acción un reintento y
   una pantalla, pero ninguna de las quince filas es ese acto. La regla del § dice que no se puede
   ejecutar una escritura que no esté nombrada en ninguna fila. Hay dos lecturas:
   - **A: se agrega la fila 16**, discontinuar una vertical, destructiva y con confirmación.
     **Daño**: ninguno de plata. Mueve el conteo de quince y sus espejos (`NUCLEO/08` §3, las
     líneas de `V/17` §3.2 reglas 1 y 3, §3.3, §3.4 y su ⚠️, §3.5, y `B/19` §6), y la pantalla
     del acto a medias se escribe como parte de esa fila.
   - **B: no se agrega**, porque el acto ya está escrito en `B/10` §4.3 con su registro.
     **Daño**: por la regla del §, el acto no tiene permiso que pedir y no es capacidad de nadie.
     Tampoco tiene dónde vivir la pantalla que `Q-ALTAS-b` pide para el admin.
   - Recomiendo **A**. `Q-ALTAS` habla de una acción *«existente»* que no existe.
2. **Cuál es el instante del anuncio si la mitad de billing entra tarde.** La fórmula de `B/10`
   §4.3 y el piso de §4.4 se cuentan desde el anuncio, que es un campo de
   `vertical_discontinuation`. Con el reintento, verticales cerró las altas en un instante y
   billing escribe la fila y avisa en otro. Hay dos lecturas:
   - **A: el anuncio es el instante en que entra la mitad de billing**, que es cuando sale el
     aviso. **Daño**: las altas quedan cerradas un rato más largo del que dice el anuncio. Nadie
     paga de más.
   - **B: el anuncio es el instante de la mitad de verticales.** **Daño**: el piso de servicio
     se cuenta desde antes del aviso, así que quien paga recibe menos aviso que el que el §4.4
     le promete.
   - No lo escribí porque la decisión no lo dice. Recomiendo **A**.

## 5. Casos vecinos

- **`B/09` todavía nombra sólo a `S11` y `S26` en cuatro lugares** (`:132`, `:160`, `:929` y
  `:1019`), y también la fila `pending` del §10.1 de `B/03` (`:2766`). No los toqué: la
  oración de `B/03` §10.1 y el punto 3 de `B/09` §3 dicen que las filas de complemento de
  `R18-b` cuentan como de `S11`, y con eso los seis siguen siendo exactos.
- **El complemento de `S7` que `S32` no pudo pausar ya tiene una marca abierta.** Si la relectura
  de `S32` vio `authorized`, `S14` abrió `PAUSA_NO_APLICADA` (motivo 22). Ahora `S7` cancela esa
  fila por la regla de `S11`, así que la marca queda abierta sobre un complemento que ya no cobra.
  Nadie dice si la cancelación la resuelve o si la tiene que levantar una persona.
- **Los avisos de la mitad de billing al reintentar.** `vertical_discontinuation` es una fila
  por vertical (`UNIQUE(vertical)`) y `S26`–`S28` son idempotentes, pero no encontré escrito que
  el aviso del anuncio de `B/19` §4 fila 14 salga una sola vez si la mitad de billing se corta
  después de avisar a una parte de las personas y se reintenta.
- **El residuo de `S7` con el complemento pausado sigue declarado** (`B/16`, NO cierra). La
  remisión a `S11` no lo alcanza, porque la regla de `S11` toma sólo filas en `ACTIVE`. No cobra
  ni da servicio hasta que la orfandad lo apaga.

## Key Learnings

1. Aplicar una regla *«por remisión»* obliga a decidir a qué cosas nombradas por la regla original
   pertenecen las filas nuevas. Acá hizo falta una oración que dijera que las filas de complemento
   del espejo y de `S7` cuentan como de `S11`. Sin ella, el par de la cancelación sin confirmar
   las marcaba como divergencia real.
2. La remisión trae también las exclusiones de la regla original. `S11` sólo toma complementos en
   `ACTIVE`, así que en `S7` quedan afuera los que `S32` ya pausó, y el residuo declarado en `B/16`
   sigue vigente.
3. Una frase como *«ya no existe»* en una tabla de situaciones deja de ser cierta con cualquier
   rama de fallo que se agregue después. `Q-ALTAS-b` volvió a crear el estado *«sin altas y sin
   fecha»*, aunque transitorio, y hubo que salvarlo en `B/10` §4.6.
4. *«La acción existente»* en una decisión se tiene que verificar contra el catálogo. `NUCLEO/08`
   §3 no la tiene, y agregarla mueve un conteo con seis espejos. Por eso va como pregunta.
