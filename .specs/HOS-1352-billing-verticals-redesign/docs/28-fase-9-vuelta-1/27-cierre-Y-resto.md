---
title: "FASE 9 vuelta 1 · cierre Y — el empuje, el corte, el núcleo y lo que quedaba de G1, G2, G4 y G5"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — cierre Y

Agente de cierre Y. Archivos propios: `$V/**`, `$D/nucleo/*.md`, `$D/12-contrato-de-cobertura.md`,
`$D/16-fase-7-del-paraguas.md`, `$D/07-facts-inventory.md` y `$D/11-particion-del-programa.md`
(este último no hizo falta tocarlo). Todo `$B/**` es de X: lo que necesita va en §3. Entrada: los
informes `21-`, `22-`, `24-` y `25-` y las decisiones de `10-`. Rutas: `D/` =
`.specs/HOS-1352-billing-verticals-redesign/docs/`, `V/` = `.specs/HOS-1353-…/`, `B/` =
`.specs/HOS-1354-…/`, `N/` = `D/nucleo/`. Las líneas son las del texto al cerrar este registro;
el otro agente sigue editando `B/`, así que en §3 las anclas son de texto y no de línea.

**Conteo: 27 APLICAR · 1 DECLARAR · 2 OWNER.** 12 pedidos al orquestador y 3 propuestas para el
log. markdownlint exit 0 sobre los 16 archivos tocados.

## 1. Ítem → clasificación → dónde

| ítem | clase | archivo:línea |
|---|---|---|
| `N-G2V-01` = `N-G4V-05` (ALTA): el empuje de `PURGED` sale **después del commit** | APLICAR | `D/12:933-952` (§3.1: la regla y el porqué); `V/docs/03:536` (`PB9`), `:539` (`PB12`), `:718-720` (prosa), `:781-787` (⚠️ punto 8); `V/descomposicion.md:510` (criterio de `V6`) · pedidos P1–P3 (`A6` y `B/16`) |
| `F-8V1A2-005` (SIGUE): dónde vive el vínculo de la Partner `APROBADA` | APLICAR | `V/docs/02:480-497` (§2.7 nueva: `postulacion.partner_id` y `partner.owner_user_id`, la columna de hoy); `V/docs/03:1228-1231` |
| `N-G2V-02` (MEDIA): destaque sobre una ficha nunca publicada | APLICAR | aviso del archivado de `PB5` con los destaques: `V/docs/19:65`, `N/07:240` · la regla de `A1` no cambia (`G2-3` ya contesta: se cobra y el acto lo dice); el acto de un borrador nunca publicado es la compra → pedidos P6 (pantalla de compra) y P7 (NO cierra de `B/16`) |
| R3 caso `m`: el aviso de `PB5` no nombraba los destaques | APLICAR | `V/docs/19:65` (fila 18 ahora es `PB4` **y** `PB5`, con los destaques y sin *«vuelve sola»* para `PB5`); `N/07:240` |
| `N-G2V-03` (BAJA): inventario de «fila viva» | APLICAR | `N/01:571-572` (18 y 19 sin número en la prosa), `:577-578` (filas 25 y 26 nuevas: la cuarta comprobación y la búsqueda del empuje); `D/12:939` (la búsqueda enumera los dos estados) |
| `22-` §4 punto 1: hard delete del admin en los NO cierra; nombrar el borrado de la cuenta | APLICAR | `D/12:960-966`; `V/docs/03:781-784` (el de `B/16` ya lo corrigió X) |
| `22-` §4 punto 2: la fila `cubierto` decía *«el hard delete del día 180»* | APLICAR | `D/12:119` |
| `22-` §4 punto 4: el aviso de moderar no tenía correo | APLICAR | `N/07:241` (fila *«ficha moderada»* ✚); `V/docs/03:747` (NO cierra 3) |
| `N-G4V-01` (ALTA): la `Preference` del cambio de plan del viejo no vence | **OWNER** (`Y-1`) | confirmado en el código de `origin/staging`: `initiatePaidPlanUpgrade` (`subscription-checkout.service.ts:2092`) no pasa `expiresInMinutes`, y el adaptador de qzpay sólo escribe `expiration_date_to` si se lo pasan. Mientras tanto el texto lo nombra sin decidir: `D/16:123` y `:322` |
| `N-G4V-02` (MEDIA), la parte del corte | DECLARAR | `D/16:316-330` (la población y la causa del corte; el vacío lo nombra ya el NO cierra de `B/09`, que X escribió) · pedido P9 |
| `N-G4V-03` (MEDIA): la sonda del paso 3 con las rutas cerradas | APLICAR | `D/16:128` (alta por la API del proveedor, cancelada en el mismo paso; el paso 3 termina con ella cancelada), `:276` (la rama de aborto la relee y la cancela antes de restaurar) |
| `N-G4V-04` (MEDIA): el aborto no levantaba la regla del 0b | APLICAR | `D/16:265-271` (punto 1 de la rama de aborto), `:244` (herramienta 5) |
| `N-G4V-06` (MEDIA): `A1` exige no `MODERATED` y `ficha` excluía el estado | APLICAR | `D/12:1027` (firma: `admiteDestaque`), `:1062` (el sí o no, no el estado), `:1116` y `:1121` (trece campos); `V/descomposicion.md:59` · pedidos P4 y P5. Lo contesta `G4-2`: lo que decide entra al §4.1 |
| `N-G4V-08` (MEDIA): `extenderTrial` sin criterio de terminación | APLICAR | `V/descomposicion.md:508` (criterio de `V4`) · pedido P8 (`B9`) |
| `24-` §4 punto 1: el espejo del botón sin la condición | APLICAR | `V/descomposicion.md:374` |
| `24-` §4 punto 2: *«no puede nacer acá»* sin tachar | APLICAR | `V/descomposicion.md:90-93` |
| `24-` §4 punto 3: el criterio de `V2` sin estrategia | APLICAR | `V/descomposicion.md:506` |
| `24-` §4 punto 4: la fila de `V6` no nombraba `fichaPurgada` | APLICAR | `V/descomposicion.md:59` |
| `N-1` (ALTA): la segunda cuenta de la regla 5 es la misma persona | **OWNER** (`Y-2`) | `V/docs/17:328-335`, sin tocar |
| `N-2` (MEDIA): el detector de `G5-3` era ciego a la pausa larga | APLICAR | `N/08:305-325` (el predicado es la aritmética, no la duración, con el ejemplo de 29 días); `N/04:67` (invariante 24) · pedido P10; propuesta L3. Sigue la intención de `G5-3` (medir el regalo), sin mecanismo nuevo |
| `F-8V1D1-002` (SIGUE): *«cobrada»* por la lectura ancha | APLICAR | `V/docs/15:163-165`. Las otras dos (`B/descomposicion.md` criterio de `B10`, `B/spec.md:68`) ya las cambió X a *«pagando»*: verificado, no hace falta pedido |
| `25-` §4 punto 3a: `N/00` decía 124 | APLICAR | `N/00:43-46` (126, con el recuento: 127 encabezados menos la plantilla) |
| `25-` §4 punto 3b: `N/04:123` mandaba a `NUCLEO/00` §1, que no existe | APLICAR | `N/04:123` |
| `25-` §4 punto 2: la regla 5 acotaba la relectura de `S1` a *«su predecesora»* | APLICAR | `N/03:69`; `N/04:144` (`D17`) |
| `25-` §4 punto 7: la mitad (d) de `G-R3` escrita como invariante | APLICAR | `V/docs/20:61` |
| `N-G1-01` (MEDIA): la ficha del corte sin fecha de publicación | APLICAR | `V/docs/03:905-918` (cuenta como publicada en el instante de su escritura `C`; desempate por `created_at` y id); `V/docs/21:211-214`; `V/docs/19:66` (fila 19); `V/descomposicion.md:510` (criterio de `V6`). Es la lectura del criterio vigente sobre el dato que R1 no le dio, sin columna ni evento inventado |
| `21-` §4 punto 2: *«Las dos»* sin antecedente | APLICAR | `D/16:199-200` |
| `21-` §4 punto 3: la consulta de la población, descrita y no escrita | APLICAR | `D/07:160-219` (consultas 4a–4e, columnas verificadas contra `origin/staging`) |
| `21-` §4 punto 4: *«conserva el trial sin usar»* hasta el próximo `PB1` cubierto (`T6`) | APLICAR | `V/docs/21:421-425` |
| `21-` §4 punto 1: la declaración de `F-8V1C2-010` atribuía al viejo bajar las fichas al cancelar | APLICAR | `D/16:228-234` (la ficha entra como `L8`, no `L5`; verificado en `origin/staging`) |

## 2. Preguntas al owner

### Y-1 · ¿Qué se hace con la `Preference` del cambio de plan del sistema viejo, que no vence y que los 30 minutos del paso 0b no acotan?

El 0b espera 30 minutos porque es la vida de la preferencia de **addons** del viejo. El cambio a
un plan más caro también cobra por una preferencia de pago único, pero **sin vencimiento**:
`initiatePaidPlanUpgrade` no le pasa `expiresInMinutes` al adaptador, y el adaptador de qzpay sólo
pone `expiration_date_to` si se lo pasan (verificado en `origin/staging` el 2026-09-26). Una
abierta antes del 0b se puede pagar cuando sea. **Juan**: el lunes abre el cambio de Básico a
Premium en el sitio viejo y cierra la pestaña. El corte es el jueves. El viernes vuelve al link de
MercadoPago y paga la diferencia. El viejo ya no existe; el pago llega al handler nuevo sin
preapproval, no cae en la lápida de recepción ni en ninguna marca (`B/09`, NO cierra), y Juan pagó
una mejora que ningún sistema le presta y que nadie ve desde adentro.

1. **Vencerlas por API en el paso 1a.** La herramienta del corte toma las preferencias de cambio de
   plan que el viejo registró y siguen sin pago (los checkouts `mode: payment` de la base vieja) y
   les pone `expiration_date_to` = ahora con el método `expire` que el adaptador de qzpay ya tiene;
   cada una se relee para confirmar el vencimiento, como todo lo que el corte muta (`D5`).
   *Costo*: un paso más en el script del corte, y una medición en el paso 0 —que el proveedor
   rechaza pagar una preferencia vencida por update; no está en la matriz—. *Riesgo*: una
   preferencia creada por fuera de la base no se vence (hoy no hay ese camino). *Impacto*: `D/16`
   filas 0b y 1a, la herramienta 1, y una fila de la matriz.
2. **Declararlo con la causa de `G1-4`.** El guion ya le dice a cada persona que lo que pague en
   el viejo después del aviso no se devuelve (punto 4); la población se mide el día del corte
   —los cambios de plan abiertos sin pago— y se nombra en el «NO cierra» del §4.3. *Costo*: cero.
   *Riesgo*: un cobro sin servicio y sin detector, que sólo aparece si Juan reclama. *Impacto*:
   una frase en `D/16` §4.3 y en el NO cierra de `B/09`.
3. **Cerrar la ruta del cambio de plan del viejo días antes, con el aviso.** Achica cuántas se
   abren, pero no acota las ya abiertas: sola no cierra el caso, y combinada con la 2 sólo reduce
   la población.

**Recomendación: la 1.** Es la única que cierra el caso con la forma que el corte ya usa en todas
partes —mutar y verificar releyendo— y reusa un método que existe, así que el mecanismo que agrega
es un bucle en un script de una sola vez, no una pieza del sistema. Y la 2 choca con la razón por
la que el owner eligió `G2-1` contra la recomendación: *no acepta ni un cobro de más*. **La otra
posición, con honestidad**: con la cartera de hoy (tres suscriptores, cero pagos en la historia) la
población real es probablemente cero, y la 2 es coherente con `G1-4` y `G3-1`, que el owner ya
eligió declarar; si el owner la prefiere, el costo es sólo que la declaración tiene que decir que
el pago no deja rastro de nuestro lado.

### Y-2 · ¿La regla 5 de `V/17` (una acción administrativa nunca tiene `actor = sujeto`) tiene que proteger contra la misma persona con dos cuentas?

La regla compara **cuentas**, y su propio costo escrito le pide al que administra y es cliente
*«una segunda cuenta»*: con eso, la misma persona opera lo suyo desde la otra cuenta y `D11` se
cumple a la letra sin proteger nada, que era el daño del hallazgo original. **Juan** es `ADMIN` y
Partner Gold con pago manual. Separa `juan-admin` de `juan-cliente`, como la regla le pide. Desde
`juan-admin` registra el pago manual de `juan-cliente`: `actor ≠ sujeto`, el paso 3 no lo rechaza,
el permiso lo tiene. La suscripción queda cubierta un período sin que entre un peso. Con un owner
que opera solo, `juan-admin` puede ser la única cuenta con el permiso.

1. **Declararlo, con detector.** La regla 5 dice lo que hace —impide el error de operarse a sí
   mismo con la misma cuenta; no impide a una persona interesada con dos— y el resumen de
   `DEC-OBS-001` lista cada acción administrativa que mueve plata (registrar una cuota manual,
   cortesía, grant, revocación, reembolso) con actor y sujeto, para que el owner la revise.
   *Costo*: una línea del resumen, sobre el registro de auditoría que ya existe. *Riesgo*: el
   detector no distingue a la misma persona; la revisión es humana. *Impacto*: `V/17` §3.2 regla 5,
   `N/08` §4.1, y el NO cierra de `V/17`.
2. **Una segunda persona para las acciones que mueven plata.** La acción queda pendiente hasta que
   otra cuenta de staff la confirme. *Costo*: mecanismo nuevo (un estado de pendiente de
   confirmación en cada acción que mueve plata, con su pantalla y su vencimiento). *Riesgo*: con
   un solo operador, **bloquea la operación**: no hay segunda persona. *Impacto*: `N/08` §3 entero,
   `V/17`, `V5` y `V8`.
3. **Vincular las cuentas de una misma persona.** Al dar un rol de staff se declara qué cuentas de
   cliente son de esa persona, y el paso 3 compara contra el conjunto. *Costo*: una columna y una
   pantalla. *Riesgo*: lo declara el propio interesado, así que lo elude quien quiera eludirlo.

**Recomendación: la 1.** Con un owner que opera solo, el interesado que la regla no alcanza es el
propio owner, y contra él ninguna regla de autorización protege; lo que sí sirve es que quede a la
vista y que la regla no prometa más de lo que hace. Es la que no agrega mecanismo. **La otra
posición, con honestidad**: si el owner planea sumar staff (un empleado con `ADMIN` que además sea
cliente), el riesgo deja de ser teórico y la 2 es la única que lo cierra de verdad; se puede
decidir la 1 hoy y dejar escrito que la 2 entra cuando haya una segunda persona con el permiso.

## 3. Pedidos al orquestador

Todos sobre `B/` (de X). Las anclas son texto que hoy existe una sola vez en el archivo.

- **P1** · `B/docs/03-maquinas-de-estado.md` §8, fila `A6`. Ancla: *«que verticales emite en el
  mismo acto de `PB9`/`PB12` (`12-contrato…` §3.1)»*. Texto nuevo: *«que verticales emite ~~en el
  mismo acto de `PB9`/`PB12`~~ **por el mismo acto de `PB9`/`PB12`, después de su commit** (`12-contrato…`
  §3.1; FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`: un empuje anterior al commit llegaba con la ficha
  todavía sin `PURGED` y la relectura de `fichaPurgada` lo descartaba siempre)»*. `A6` no cambia:
  relee igual; lo que cambia es cuándo le llega.
- **P2** · `B/docs/16-addons.md` §4.2 (~471). Ancla: *«que verticales emite\n  en el mismo acto de
  `PB9`/`PB12` (`12-contrato…` §3.1)»*. Texto nuevo: el mismo cambio que P1.
- **P3** · `B/docs/16-addons.md`, NO cierra, viñeta *«El destaque de una ficha borrada todavía
  puede cobrar una vez más»*. Ancla: *«`A6` corre en el\n  acto del borrado por el empuje»*. Texto
  nuevo: *«`A6` corre ~~en el acto del borrado~~ **al recibir el empuje, que sale después del commit
  del borrado** (FASE 9 vuelta 1, `N-G2V-01`)»*.
- **P4** · `B/docs/03-maquinas-de-estado.md` §8, fila `A1`. Ancla: *«y en un estado que acepte
  destacarla —ni `PURGED` ni `MODERATED`—»*. Agregar a continuación: *«**—leído por
  `ficha(idDeFicha).admiteDestaque` del contrato §4.1, que contesta sí o no y define verticales;
  billing no lee el estado de la ficha** (FASE 9 vuelta 1, `N-G4V-06`)—»*.
- **P5** · `B/descomposicion.md` §2.6, fila 9 (`B10` — `A1`). Ancla: *«`ficha` (vertical y dueño del
  objetivo) y `políticaDeAddon` (`addon`, vigencia, tipo de scope de la versión)»*. Texto nuevo:
  *«`ficha` (vertical, dueño **y `admiteDestaque`** del objetivo; FASE 9 vuelta 1, `N-G4V-06`) y
  `políticaDeAddon` (`addon`, vigencia, **`díasDeVigencia`**, tipo de scope de la versión; la firma
  del contrato §4.1 lo trae, `24-verificado-G4` §4 punto 5)»*.
- **P6** · `B/docs/19-superficies.md` §4, fila nueva después de la `3-bis`: *«| 3-ter ✚ | al
  **comprar un destaque** (addon `LISTING`) **sobre una ficha que no está `PUBLISHED`** —un
  borrador, una archivada, una bajada por billing—, antes de confirmar | **que se cobra aunque la
  ficha no se vea, hasta que lo dé de baja** | `G2-3` (owner 2026-09-26); FASE 9 vuelta 1,
  `N-G2V-02`: un borrador que nunca se publicó no tiene otro acto que lo diga |»*. Qué es
  «publicada» lo pregunta la pantalla a verticales, como capa de composición (contrato §4.1).
- **P7** · `B/docs/16-addons.md`, NO cierra, viñeta *«Un destaque recurrente sobre una ficha que no
  se ve con la principal viva se sigue cobrando»*. Ancla: *«—`MODERATED`, bajada por excedente,
  `DRAFT` por `PB6`, `ARCHIVED` por `PB5`—»*. Texto nuevo: *«—`MODERATED`, bajada por excedente,
  `DRAFT` por `PB6`, `ARCHIVED` por `PB5` **(su aviso de archivado los nombra desde la FASE 9 vuelta
  1, R3 caso `m`: `V/19` §4 fila 18)**, **o un borrador que nunca se publicó, donde el acto es la
  compra y lo dice la pantalla de compra (`B/19` §4 fila 3-ter; `N-G2V-02`)**—»*.
- **P8** · `B/descomposicion.md` §4, criterio de terminación de `B9`. Agregar al final de la celda:
  *«; **y con `extenderTrial` → `RECHAZADA` el código de canje queda intacto, y el reintento con la
  misma `claveDeCanje` después de un `ACEPTADA` no extiende dos veces ni consume el código dos
  veces** (contrato §4.1; FASE 9 vuelta 1, `N-G4V-08`; la mitad de verticales está en el criterio
  de `V4`)»*.
- **P9** · `B/docs/09-conciliacion.md`, NO cierra del pago del addon de única vez. Ancla: *«la
  población son las preferencias abiertas en los minutos previos al 0b»*. Texto nuevo: *«la
  población son las preferencias **de addon** abiertas en los **30** minutos previos al 0b **—y las del
  cambio de plan del viejo, que no vencen: pendiente de la pregunta `Y-1` al owner
  (`27-cierre-Y-resto.md` §2; FASE 9 vuelta 1, `N-G4V-01`)—**»*. Coordina con `D/16:316-330`, que ya
  cita este NO cierra como el lugar del vacío.
- **P10** · El predicado de `N-2` en `B/`. Tres frases que decían *«pausa de menos de un ciclo»*:
  - `B/docs/03-maquinas-de-estado.md`, NO cierra, viñeta *«`S10` deja volver antes cuando la persona
    quiera»*. Ancla: *«una pausa de menos de un ciclo que cruza una fecha de cobro **no la
    cobra**»*. Texto nuevo: *«~~una pausa de menos de un ciclo que cruza una fecha de cobro~~ **toda
    pausa que cruza una fecha de cobro y termina fuera del aniversario, dure lo que dure** (FASE 9
    vuelta 1, `N-2`: con tres meses de pausa y vuelta al segundo día del ciclo son 29 días de
    regalo) **no la cobra**»*; y en el encabezado de la viñeta, *«regala hasta un ciclo»* queda.
  - `B/docs/09-conciliacion.md` (~66). Ancla: *«las pausas de menos de un ciclo que cruzaron una
    fecha de\ncobro salteada»*. Texto nuevo: *«las pausas ~~de menos de un ciclo~~ que cruzaron una
    fecha de cobro salteada **y regalaron días netos** (la cuenta está en `NUCLEO/08` §4.1; FASE 9
    vuelta 1, `N-2`)»*.
  - `B/docs/12-suscripcion.md`, NO cierra, viñeta *«La vuelta anticipada de una pausa regala hasta
    un ciclo»*: el ejemplo (pausa el 30, vuelve el 2) sigue siendo correcto; agregar después de
    *«cobra en el ciclo siguiente.»*: *«**Y no depende de cuánto dure la pausa**: pausar tres meses y
    volver el segundo día de un ciclo regala 29 días (FASE 9 vuelta 1, `N-2`).»*
- **P11** · `B/docs/03-maquinas-de-estado.md` §8, fila `A6`, y `B/docs/09-conciliacion.md` §3,
  cuarta comprobación: ninguno cambia de texto, pero sus selectores quedaron inventariados en
  `N/01` §2 como consumidores 23 y 25 de «fila viva» (`N-G2V-03`). Si X agrega un estado vivo a la
  instancia de addon, cambian los cuatro de sólo instancia (18, 23, 25, 26) en el mismo acto. Aviso,
  no edición.
- **P12** · Si el owner contesta `Y-1` con la 1, la matriz `D/06` necesita una fila nueva (el
  vencimiento por update de una preferencia, medido en el paso 0) y `B/06` su espejo; si contesta
  `Y-2` con la 1, `V/17` §3.2 regla 5 es mía y la escribo, y el detector va a `N/08` §4.1 (mío).
  Aviso, no edición.

## 4. Propuestas para el log

- **L1** · `DEC-ARCH-006`, implicación 4 (📌 de `G2-1`). Texto actual: *«emitido en el mismo acto
  de `PB9` y de `PB12`»*. Texto nuevo: *«emitido **por el mismo acto** de `PB9` y de `PB12`,
  **después de su commit** —como el aviso de cobertura: su consumidor relee `fichaPurgada`, y un
  empuje anterior al commit se descartaba siempre (FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`)—»*.
- **L2** · `DEC-ARCH-006`, implicación 5 (📌 de `G4-2`). Texto actual: *«`ficha(idDeFicha) → {
  vertical, dueño }`»*. Texto nuevo: *«`ficha(idDeFicha) → { vertical, dueño, admiteDestaque }` —el
  tercer campo es un sí o no, no el estado: lo exige `A1` (FASE 9 vuelta 1, `N-G4V-06`)—»*.
- **L3** · `DEC-SUB-010`, 📌 de `G5-3`. Texto actual: *«Una pausa de menos de un ciclo que cruza
  una fecha de cobro salteada regala ese ciclo»* y *«el barrido lista esas pausas»*. Texto nuevo:
  *«**Toda pausa que cruza una fecha de cobro salteada y termina fuera del aniversario regala días,
  dure lo que dure** (hasta casi un ciclo)»* y *«el barrido lista **las pausas con regalo neto
  positivo** —(próxima fecha después de la vuelta − vuelta) − (primera fecha salteada − inicio)—»*
  (FASE 9 vuelta 1, `N-2`: el predicado por duración era el ejemplo que motivó el detector, no la
  aritmética del daño).

## Key Learnings

1. **Un orden fijado para un evento hay que pasarlo por sus gemelos del mismo día.** El empuje de
   `PURGED` copiaba la forma del aviso (evento sin transporte, consumidor que relee) pero no su
   regla *«después del commit»*; con relectura, el evento temprano no se pierde a veces: se pierde
   siempre.
2. **Una delegación («lo declara `V/02`») sin texto del otro lado sigue llegando.** Se cierra
   escribiendo el otro lado, y conviene mirar primero el código: `partners.owner_user_id` ya existía
   y era el vínculo.
3. **Un estado asignado por migración hereda todos los datos que la máquina lee de ese estado.** La
   ficha del corte tenía estado y reloj, pero no fecha de publicación; la salida sin columna nueva
   fue definir la lectura (su escritura `C` como instante) y no inventar un evento en el registro.
4. **Verificar el sistema viejo contra `origin/staging`, no contra el clone principal.** El clone
   no tenía `billing_unpublished_at`; `origin/staging` sí, en la línea que el informe citaba.
5. **Un número de sección nuevo puede chocar con una referencia local huérfana.** `V/02` citaba
   *«§2.6»* a secas por `NUCLEO/02` §2.6; la sección nueva de Partner va en §2.7 y la referencia
   vieja quedó con su prefijo.
6. **Un tachado con `|` adentro rompe la tabla** (MD056): en una celda se tacha sin el separador.
7. **X había cerrado ya varios vecinos en `B/`** (el *«cobrada»* de `B10` y `B/spec`, el hard
   delete de `B/16`, el vacío de la preferencia en `B/09`): antes de escribir un pedido se relee el
   archivo ajeno, porque la mitad de los pedidos de un cierre en paralelo nacen vencidos.
