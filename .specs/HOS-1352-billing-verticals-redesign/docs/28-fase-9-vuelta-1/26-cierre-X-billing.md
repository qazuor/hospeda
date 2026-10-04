---
title: "FASE 9 vuelta 1 · cierre X — los ítems de billing de la verificación"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — cierre X: billing

Cierre de los ítems de billing que dejaron abiertos los informes de verificación `21-` a `25-`:
los «SIGUE», los casos vecinos y la §4 de texto vencido que viven en
`.specs/HOS-1354-billing-cobro-y-proveedor/` (`B/`). Criterio de clasificación: el de la base de
cierre (APLICAR · DECLARAR por `DEC-METH-015` · OWNER). Sólo se editaron archivos de `B/`; lo que
vive en otro lado va en §3. Las líneas son las del texto al terminar este cierre.

## 1. Ítems

| ítem | origen | clasificación | dónde |
|---|---|---|---|
| `F-8V1B2-005` (SIGUE) — las dos gemelas que decían que la marca impide la sucesión | `23-` §1 | APLICAR | `B/03:1484-1487` (la marca bloquea *escribir* un `sucede_a`, no deshace el que existe) · `B/05:374-388` (la frase contradictoria tachada; la excepción vale falle la condición que falle) |
| `N-G3V-01` — el barrido sin motivo para un cobro sobre una `SUSPENDED` (o `GRACE_PERIOD`) con las cuatro condiciones | `23-` §3 | APLICAR | `B/05:339-350` · `B/02:962` (motivo 19, quién lo abre) · `B/09:137` · `B/descomposicion.md:725` (criterio de `B5`) |
| `N-G3V-02` — el asiento del motivo 19 era `P1` a secas | `23-` §3 | APLICAR | `B/05:320-330` (cada receptora con su regla, que es la del asiento) · `B/02:962` (columna del asiento) · `B/09:137` · `B/descomposicion.md:725` |
| `N-G3V-03` — la lápida de recepción fuera de la tabla de terminales y nadie cancela su preapproval | `23-` §3 | **OWNER** (`X-1`) | owner |
| `N-G1-02` — la lápida de recepción nace `CANCELLED` sobre un preapproval vivo (`B/21` ~225) | `21-` §3 | **OWNER** (`X-1`, la misma pregunta) | owner |
| R4, hueco del barrido — casos 1, 4, 5, 8, 9 y 17 | `23-` §2.1 | 1, 4, 5, 8, 9: APLICAR (vía `N-G3V-01`/`02`) · 17: **OWNER** (`X-1`) | como arriba |
| `N-G3V-04` — `S36` falta en la enumeración del desempate y en las salidas del grace | `23-` §3 | APLICAR | `B/05:309` · `B/03:1604` |
| `N-G3V-05` — la atribución falsa a `EX-15` en tres gemelas | `23-` §3 | APLICAR | `B/02:83-86` · `B/03:850-853` · `B/16:784-786` |
| `B/05:241-242` — el barrido abre `COBRO_SIN_REGISTRAR` sin condición | `23-` §4 | APLICAR | `B/05:242-244` |
| `B/05:361-363` y `B/03:1480-1481` | `23-` §4 | APLICAR (son `F-8V1B2-005`) | como arriba |
| `F-8V1D1-002` (SIGUE), partes de billing | `25-` §3.5 | APLICAR | `B/descomposicion.md:730` · `B/spec.md:68` · la de `V/15` → pedido 1 |
| `N-3` — `S36` no sale de `PAUSED` | `25-` §3.4 | **OWNER** (`X-2`) | owner |
| `N-4` — `S36` «con la regla de relectura de `S17`» contra `B/09` §3 y `B/03:286` | `25-` §3.4 | APLICAR (el conjunto contesta: `S22`–`S24` y la salvedad 4 la cuentan sin rama de fallo) | `B/03:182` · `B/09:184` |
| `B/descomposicion.md:672-673` — 14/17 guards | `25-` §4.1 | APLICAR | `B/descomposicion.md:672-675` (13 y 18) |
| `B/09:173` — «trece» | `25-` §4.4 | APLICAR | `B/09:173` (catorce) |
| `B/03:316-317` — la lista de las que cancelan en el proveedor sin `S36` ni `S1` | `25-` §4.5 | APLICAR | `B/03:315-320` (diecisiete, recontadas con script sobre las filas que remiten a la regla) |
| el «otro monto» de `B6` sin el tope | `25-` §4.6 | APLICAR | `B/descomposicion.md:132` (fila) · `:726` (criterio) |
| `N-G1-03` — la FK a `plan_version(id, vertical)` sin su `UNIQUE` | `21-` §3 | APLICAR, fuera de `B/` | pedido 2 (`V/02` §2.1) |
| `N-G4V-02` — el pago diferido de una `Preference` no tiene dónde caer | `24-` §3 | DECLARAR | `B/09:928-936` (el «NO cierra» de órdenes) · el texto de `D/16:317` es de Y → pedido 5 |
| `N-G4V-07` — `S1` no lee `vendible` | `24-` §3 | APLICAR | `B/03:147` · `B/19:293-295` · `B/descomposicion.md:337` y `:723` · el contrato → pedido 4 |
| `N-G4V-09` — la fila de invalidación del catálogo de addons | `24-` §3 | APLICAR, fuera de `B/` | pedido 3 (`V/02` §2.4) |
| `B/16:981` — el hard delete del admin en el «NO cierra» | `22-` §4.1 | APLICAR | `B/16:981-986` (ahora nombra el borrado de la cuenta pendiente en `NUCLEO/08` §1, como el contrato §3.1) |
| `S33` con `S7` → `CANCEL_SCHEDULED` | `22-` §4.3 | DECLARAR | `B/03:179` (`S33` corre sólo hacia `ACTIVE`) · `B/16:994-1000` (el residuo, con causa) |

**Conteo**: **16 APLICAR** (dos de ellos sólo por pedido: `N-G1-03` y `N-G4V-09`), **2
DECLARAR** y **2 OWNER** (`X-1` junta `N-G3V-03`, `N-G1-02` y el
caso 17 de R4; `X-2` es `N-3`). Contado por ítem de la tabla, sin repetir las dos filas de §4 de
`23-` que son `F-8V1B2-005` ni las filas de R4 que se cierran por `N-G3V-01`/`02`.

Notas donde el renglón no alcanza:

- **`N-G3V-01` y `N-G3V-02` se escribieron juntos**: la lista de *«puede recibir el cobro»* de
  `B/05` §3 ahora dice también cómo recibe cada una, y ese camino es el del asiento del motivo 19.
  La `GRACE_PERIOD`/`SUSPENDED` con las cuatro condiciones no entra a la lista del evento (el
  evento sí corre el §3 sobre ellas): entra sólo al barrido, que abre el 19 y cuyo asiento corre
  `S5`/`S7`. El destino es el que `03-` §2.1 ya había escrito para el caso 4 (*«`19`, igual que
  hoy»*).
- **`N-4`**: las cinco filas hermanas (`S22`–`S25`) dicen *«con la regla de relectura de `S17`»* y
  `B/09` §3 las da *«sin rama de fallo»*; la salvedad 4 y la lista de `B/03:286` ya cuentan a `S36`.
  Lo que faltaba es decir que de `S17` se toma la relectura y no el *«si falla, no ocurre»*. Con la
  otra lectura, una llamada fallida perdía la revocación sin marca (evento humano, nadie lo
  reevalúa), que es lo contrario de la parte 1 de `DEC-RF-001`.
- **`N-G4V-07`**: aplicado porque es la gemela exacta de `admiteAltas` (misma superficie, misma
  guarda) y ningún flujo legítimo pasa por `S1` con una versión no vendible: los grants anclan sin
  `S1` y la de piso y la de pre-trial no se suscriben.
- **`N-G4V-02`**: declarado en `B/09` y no en la lápida porque abrir la conciliación de un pago
  sin preapproval para una población de un solo día agrega mecanismo; `G1-4` ya acepta lo pagado
  en el viejo por lo que el corte corta.
- **§4 punto 3 de `22-`**: declarado porque falla hacia no cobrar, no da acceso y no borra nada.
  Reanudar el complemento de una principal que ya se va cobraría un addon para un título que
  muere en `S12`.

## 2. Preguntas al owner

### `X-1` · ¿Quién cancela el preapproval de una lápida de recepción?

La lápida de recepción (`G3-2`) nace `CANCELLED` —la forma de fila de R6 lo exige— sobre un
preapproval que **nadie canceló**: el de un cliente del viejo que el censo no vio, o una sonda.
Ninguna fila manda cancelarlo, la tabla de puertas terminales de `B/09` §3 no la nombra, y la
salvedad 4 dice *«y la lápida»* sin decir cuál de las dos. Cuando una persona levanta la marca, la
fila queda terminal, fuera del barrido y con el preapproval cobrando.

1. **La cancela el handler al escribirla, y entra en la salvedad 4.** El mismo acto que escribe la
   lápida manda la cancelación (con la relectura; sin destinatario conocido el correo no bloquea,
   como ya dice `B/03` §3.2) y la fila entra a la tabla de `B/09` §3 como **no exenta** —la dejó
   sin poder cobrar una llamada nuestra—, con reintento del barrido y la marca 16 a los 3 días.
   *Costo*: una fila en la tabla de `B/09` §3, la frase del handler en `B/09` §2.4 y `B/02` §2.2,
   *«la lápida»* → *«las dos lápidas»* en la salvedad 4 y en `B/03:286`, y recontar la salvedad 4
   (catorce → quince). *Riesgo*: cancela una autorización que el corte ya había decidido cancelar
   (el paso 1b cancela todas las del viejo) o una sonda nuestra; el sistema nuevo nunca crea un
   preapproval que no nombre su fila (`B/02` §2.2), así que no alcanza a un cliente actual.
   *Impacto*: el `CANCELLED` pasa a ser verdad eventual, igual que en las otras catorce, y resuelve
   `N-G1-02` sin tocar R6.
2. **La cancela una persona, como parte de resolver la marca.** El motivo 7 (o el 6) sobre una
   lápida de recepción incluye cancelar su preapproval con la acción *«cancelar una suscripción»*,
   y la marca no se puede levantar mientras la relectura lo vea vivo. *Costo*: una frase en el
   motivo 7/6 de `B/02` §2.5 y una condición en `S15`. *Riesgo*: depende de que la persona lo haga;
   si levanta igual (o la condición no se implementa), el cobro siguiente con el aviso perdido no
   lo ve nadie. Mantiene una fila `CANCELLED` sobre algo vivo hasta que alguien actúe.
3. **Se declara.** *Costo*: cero. *Riesgo*: mueve plata todos los meses sobre un ex-cliente; cada
   cobro con aviso abre marca, pero el que pierde el aviso (`WH-5`) no. No califica bien para
   `DEC-METH-015` (hay plata en un camino que se repite).

**Recomendación: 1.** Es lo robusto y no agrega mecanismo: reusa la salvedad 4 y el reintento que
ya existen, y cumple lo que el corte quería (ninguna autorización vieja viva). La posición de la 2
es honesta: el sistema cancelaría solo la autorización de alguien que no sabe quién es, y hay quien
prefiere que eso lo decida una persona mirando el caso; el costo es que el cierre depende de que se
acuerde.

**Juan.** El censo no vio el preapproval viejo de Juan. Un mes después del corte cobra. Con (1), el
handler escribe la lápida, abre la marca 7 y en el mismo acto cancela el preapproval; si la llamada
falla, el barrido la reintenta y a los 3 días marca. La operadora devuelve y levanta: no hay
segundo cobro. Con (2), la operadora devuelve, cancela a mano y recién ahí puede levantar. Con (3),
al mes siguiente Juan paga otra vez, el aviso se pierde y nadie lo ve.

### `X-2` · ¿La revocación (`S36`) sale también de `PAUSED`?

`G5-4` eligió la opción que enumeraba *«desde `ACTIVE`, `GRACE_PERIOD` o `CANCEL_SCHEDULED`»*, y
dentro de los 10 días del cobro Juan puede haber pausado (`S8`). Desde `PAUSED` ninguna fila de
revocación existe y `RF1` dice que lo crea `S36`: la persona vuelve a la baja de `S22` más un
reembolso aparte, las *«dos cosas»* que la parte 1 de `DEC-RF-001` prohíbe.

1. **Extender `S36` a `PAUSED`, con los dos motivos.** Cancela el preapproval pausado (`EX-11`:
   sobre una pausada se deja cancelar), corta el servicio en el acto como `S22`, escribe `fin_real`
   en la `subscription_pause`, crea `RF1` por el total, y si la fila es predecesora dispara `S18`.
   *Costo*: la celda `desde` de `S36`, la fila 12 de las salidas de la predecesora (`B/03` §3.3,
   que hoy dice `ACTIVE` · `CANCEL_SCHEDULED`), el caso de `B/20` y la lista de *«la principal
   termina»* de `S33` (sus complementos pausados por `S32` mueren por orfandad). *Riesgo*: bajo;
   `S22` ya hace todo menos el reembolso.
2. **Declararlo.** La revocación desde `PAUSED` se hace a mano con `S22` y un reembolso, y se
   escribe en el «NO cierra» de `B/03` con causa. *Costo*: un párrafo. *Riesgo*: son las dos
   acciones en el orden que alguien recuerde, en una ventana chica (pausar dentro de los 10 días
   del cobro).

**Recomendación: 1.** La condición legal es el plazo, no el estado, y `S22` ya hace el corte: la
fila sólo le suma el `RF1` en el mismo acto. La 2 es defendible si se quiere que `G5-4` quede
exactamente como se eligió hasta que entre el botón, a costa de una ventana manual.

**Juan.** Juan paga el 1/oct, el 3/oct pausa un mes y el 5/oct escribe que se arrepiente. Con (1),
la persona registra la revocación: el preapproval pausado se cancela, la pausa se cierra y el
reembolso total espera confirmación, en un acto. Con (2), la persona da de baja por `S22` y tiene
que acordarse de pedir el reembolso aparte.

## 3. Pedidos al orquestador

1. **`V/15` §*(la orfandad `USER`/`GLOBAL`)*, `F-8V1D1-002`** —
   `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:163-164`.
   Ancla: `hay una principal viva y cobrada ni un ancla viva** (\`B/16\` §4.2), así que \`A5\` lo corta.`
   Texto nuevo: `hay una principal viva y ~~cobrada~~ pagando ni un ancla viva** (\`B/16\` §4.2), así que \`A5\` lo corta.`
   y la línea siguiente: `~~*«Cobrada»*~~ *«Pagando»* (\`NUCLEO/01\` §2, no el campo \`cobrada\` del contrato; FASE 9 vuelta 1, \`F-8V1D1-002\`) se lee como en \`S4\`: …` (el resto igual).
2. **`V/02` §2.1, fila `plan_version`, columna de restricciones, `N-G1-03`** —
   `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:48`.
   Ancla: `**\`UNIQUE(id, plan_id)\`**, que pide la FK de \`B/02\` §2.4 ·`
   Texto nuevo (agregar a continuación): `**\`UNIQUE(id, vertical)\`**, que pide la FK compuesta \`(versión, vertical)\` de \`subscription\` en \`B/02\` §2.2 —Postgres no acepta una FK compuesta sin una restricción única sobre exactamente esas columnas, aunque \`id\` sea clave— (FASE 9 vuelta 1, \`N-G1-03\`) ·`
3. **`V/02` §2.4, tabla de invalidación, `N-G4V-09`** — mismo archivo, línea 534.
   Ancla: `| **se publica una versión nueva de ~~un \`addon_version\`~~ un \`addon\`** (su madre desde la FASE 8 completa, \`F-8CA3-011\`, §2.1) | es lo que otorga el addon, y desde el corte por campo ya no vive en billing |`
   Texto nuevo: `| ~~**se publica una versión nueva de ~~un \`addon_version\`~~ un \`addon\`** (su madre desde la FASE 8 completa, \`F-8CA3-011\`, §2.1)~~ | ~~es lo que otorga el addon, y desde el corte por campo ya no vive en billing~~ **Tachada** (FASE 9 vuelta 1, \`N-G4V-09\`), como la de las suscripciones: la instancia ancla una versión que no se mueve (\`B/02\` §2.4, *«lo ya comprado no cambia»*), así que una versión nueva no cambia lo que otorga ninguna instancia viva, y saber quién tiene instancias de ese addon es de billing y no cruza |`
   (si el tachado anidado no renderiza, tachar sólo el texto sin el `~~un \`addon_version\`~~` interno).
4. **Contrato §4.1, `N-G4V-07`** —
   `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1130-1133`.
   Ancla: `lo cumplía ninguna fila; también es un consumidor más de un campo ya declarado.`
   Texto nuevo: `lo cumplía ninguna fila; también es un consumidor más de un campo ya declarado. **Y desde la FASE 9 vuelta 1 \`S1\` lee también \`vigente\`/\`vendible\`**: una versión retirada no admite altas ni sucesiones aunque se llegue al checkout por un link viejo (\`B/03\` §3.2; \`N-G4V-07\`). Otro consumidor de un campo ya declarado.`
5. **`D/16` §4.2, `N-G4V-02` — coordinar con Y, que tiene el corte** —
   `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:317`.
   Ancla: `al 0b; el pago llega como desconocido y cae donde cae todo desconocido sin fila (\`F-8V1B3-001\`).`
   Texto nuevo: `al 0b; el pago llega como desconocido ~~y cae donde cae todo desconocido sin fila (\`F-8V1B3-001\`)~~ **y sin preapproval, así que no cae en la lápida de recepción (\`G3-2\`, que es para preapprovals) ni en ninguna marca: cae en el vacío declarado de \`B/09\`, «lo que este capítulo NO cierra», sobre la conciliación de un pago sin preapproval** (FASE 9 vuelta 1, \`N-G4V-02\`).`
   Si Y ya reescribió ese párrafo, basta con que la causa nombre ese «NO cierra» de `B/09`.

## 4. Propuestas para el log

Ninguna. `X-1` y `X-2`, si el owner las contesta, pueden pedir un 📌 (en `DEC-CONC-002` y en
`DEC-RF-001` respectivamente); el texto se propone con la respuesta.

## Key Learnings

1. Una lista de *«puede recibir el cobro»* que nombra estados sin decir **cómo** recibe cada uno
   invita a un único asiento para todos; el motivo correcto con el asiento equivocado mueve plata
   igual. Conviene escribir la regla por estado en la misma lista que consumen los dos productores.
2. *«Con la regla de `S17`»* se usó en cinco filas hermanas para decir *«releé antes de llamar»*,
   no *«si falla, no ocurre»*; sobre una fila con evento humano la segunda lectura pierde el acto.
   Al citar una regla ajena hay que decir qué mitad se toma.
3. Una decisión del owner cuya opción enumeraba estados (`G5-4`) no se extiende a un estado
   omitido aunque la ley lo pida: el vecino (`PAUSED`) vuelve como pregunta, no como aplicación.
4. Un recuento de *«las filas que remiten a la regla»* se hace mejor con script sobre la tabla que
   sobre la lista que lo afirma: la lista tenía quince y la tabla diecisiete (`S1` y `S36`).
5. Una forma de fila compartida por dos escritores (`clase = LÁPIDA`) hereda una restricción
   (`CANCELLED`) que sólo es verdad para uno; decidir quién hace verdadera la restricción para el
   otro es de producto, no de redacción.
