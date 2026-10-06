---
title: "FASE 9 completa · R4 y R6 — cortesía, pausa, promos y addons"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R4 y R6 — cortesía, pausa, promos y addons

`DEC-METH-004` (`01-decision-log.md:144`) pide dos cosas para declarar un racimo resuelto: que el
camino de cada hallazgo, reejecutado sobre el texto corregido, ya no llegue, **y** que la regla
corregida se verifique contra **todo** el dominio que cuantifica. Este documento hace las dos cosas
para `R4` (4 hallazgos) y `R6` (6 hallazgos), sobre el texto tal como está hoy.

**No edita nada.** Toda corrección va propuesta; la aplica el orquestador.

Abreviaturas: `B/` es `HOS-1354-billing-cobro-y-proveedor/docs/`, `V/` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `N/` es `HOS-1352-…/docs/nucleo/`, y lo
que no lleva prefijo es `HOS-1352-…/docs/`. Los números después de `:` son líneas del archivo.

## Resumen

| racimo | hallazgos | DEJA DE LLEGAR | SIGUE LLEGANDO | LLEGA A OTRA COSA | dominio | OK | falla | otros |
|---|---|---|---|---|---|---|---|---|
| `R4` | 4 | 1 | 3 | 0 | 41 | 21 | 18 | 2 indeterminados |
| `R6` | 6 | 5 | 1 | 0 | 75 | 49 | 14 | 6 N/A · 3 borde · 3 declarados |
| | **10** | **6** | **4** | **0** | **116** | **70** | **32** | |

Conteos por script: `scratchpad/recuento-r4-r6.py` (sesión del 2026-09-25), salida en §R4.4 y §R6.4.

**Lo que no cierra, en una línea**: tres hallazgos de los diez **no fueron tocados**
(`F-8CB2-003`, `F-8CC1-004`, `F-8CA1-008`: cero citas en el corpus fuera de los informes), uno cerró
su camino principal pero **sigue llegando por dos puertas del paso 7** (`F-8CB1-001`), y el arreglo
de `F-8CA2-003` **abrió el error contrario**: cancela el destaque de un cliente que sigue pagando.

---

## R4 · Cortesía y pausa valen lo que cruzan, no lo que prometen

### R4.1 La regla corregida, tal como quedó

`DEC-GRANT-003` implicación 6, precisada (`01-decision-log.md:1758-1763`):

> **La regla**: la cortesía temporal se otorga **sólo sobre planes mensuales y en meses enteros**
> —la misma validación de la pausa, `DEC-SUB-010`, **pero sólo su término del ciclo** […]—, así que
> N meses saltean exactamente N cobros. **Sobre un plan anual no se ofrece**

La tabla del capítulo (`B/14-promos-cortesias-y-grants.md:619-622`):

> | **la unidad** | **meses enteros**: N meses saltean exactamente N cobros |
> | **el plan** | **sólo mensual** — la misma validación de la pausa […] Es condición de `S9` por su primer disparador (`B/03` §3.2) |
> | **un plan anual** | **no se ofrece** […] |
> | **cortesía sobre cortesía** | **se suman meses**, no se reemplazan […] |

Saldo redondeado para arriba (`B/14:631-632`): *«se redondea **para arriba** (`B/02` §2.4)»*.
Sobre anual se pierde con aviso (`B/14:633-637`): *«**el saldo se pierde y se avisa antes**. Si la
sucesora es de plan anual, `S18` cierra el saldo con `motivo_cierre = DESTINO_DE_PLAN_ANUAL`»*.

La condición en la tabla de transiciones (`B/03-maquinas-de-estado.md:136`, `S9`): *«**Y, por el
primer disparador, la fila es de un plan MENSUAL y la cortesía se firma en MESES ENTEROS**»* y
*«**En el segundo y el tercer disparador este término no se evalúa porque no hace falta**: un saldo
que iba a caer sobre una fila de plan anual ya se cerró antes»*.

La pausa y su `fin_real` (`B/03:1553-1556`, §5): *«**Las cuatro terminales** mandan la fila a
`CANCELLED` y **cierran la pausa** —el `fin_real` lo escriben `S22`, `S25`, **y desde el
2026-09-25 también `S13` y `S17`**»*.

### R4.2 El dominio

La regla cuantifica sobre **todas las puertas por las que una concesión pausa un preapproval**,
contra **todos los ciclos**, más los cruces y las salidas de la pausa que la regla escribe.

| eje | casos | fuente |
|---|---|---|
| **A · puertas × ciclo** | 4 puertas (`S9` por sus tres disparadores, y la promo bajo el piso de `B/14` §1.3 regla 2, que *«se ejecuta con el mecanismo de la cortesía»*) × 4 ciclos (mensual, trimestral, semestral, anual) = 16, más la cortesía durante el trial = **17** | puertas: `B/03:136`, `B/14:67-70`; ciclos: `N/01-glosario.md:279` *«mensual, trimestral, semestral, anual»* y `B/02-modelo-de-datos.md:31`; trial: `B/14:623` |
| **C · salidas de `PAUSED` (¿escriben `fin_real`?)** | `S10`, `S22`, `S25`, `S13`, `S17`, `S6` (contracargo sobre cortesía), el espejo del §10.1, y `S20`/`S21` sobre una fila de complemento = **9** | `B/03:1549-1556` (§5), `B/03:133` (`S6`), `B/03:2576` (espejo) |
| **D · entradas a `PAUSED` (¿se verifican releyendo?)** | `S8`, `S9` = **2** | `B/03:135-136` |
| **E · cruces cortesía × pausa** | los tres de `DEC-GRANT-004` = **3** | `01-decision-log.md:1785-1790` |
| **F · pausa × addon recurrente** | 2 motivos (`CUSTOMER_REQUEST`, `COURTESY`) × 4 scopes = **8** | motivos: `B/02:50`; scopes: `B/16-addons.md:415-419` |
| **G · fracción del saldo diferido** | sus dos escritores, `S18` y `S25` = **2** | `B/14:626-627` |

**Tamaño: 41 casos.**

### R4.3 Los caminos reejecutados

#### `F-8CB1-001` (CRÍT) — la cortesía regala cero días o un ciclo entero · **SIGUE LLEGANDO** (por el paso 7)

1. *Juan tiene un plan anual en `ACTIVE`.* Sin cambio.
2. *El 20/dic `SUPER_ADMIN` le firma 30 días; corre `S9`.* **Se corta acá.** `S9` exige, por el
   primer disparador, *«la fila es de un plan MENSUAL y la cortesía se firma en MESES ENTEROS»* y
   *«**Sobre una fila de plan anual `S9` no ocurre**»* (`B/03:136`). La superficie lo dice antes
   (`B/19-superficies.md:122`, fila 13-ter).
3. a 5. No ocurren.
6. *Variante mensual, 10 días del 5 al 15.* **Se corta**: la unidad es *«**meses enteros**: N meses
   saltean exactamente N cobros»* (`B/14:619`). Diez días no se pueden firmar.
7. *Los mismos caminos por el segundo y el tercer disparador de `S9`, y por la promo bajo el piso.*
   **Sigue llegando por dos de sus tres puertas:**
   - **Disparadores 2 y 3 sobre una fila trimestral o semestral.** El cierre del saldo cubre sólo
     el anual: *«**y si la sucesora es de plan anual, el saldo no se escribe: se CIERRA con
     `motivo_cierre = DESTINO_DE_PLAN_ANUAL`**»* (`B/03:145`, `S18`), y `S9` no evalúa el término
     en esos disparadores (`B/03:136`, citado en R4.1). Juan tiene 1 mes de saldo y se cambia a un
     plan **trimestral**: `S18` le escribe `saldo_meses = 1`, `S9` re-emite y pausa un mes. Si ese
     mes cruza la fecha trimestral, `PS-6` (`06-mp-validation-matrix.md:212`) saltea **3 meses**;
     si no la cruza, vale **cero**. Es el mecanismo del hallazgo, intacto.
   - **La promo bajo el piso.** `B/14:67-70` sigue diciendo *«Si el resultado cae por debajo del
     piso, el descuento NO se aplica mutando el monto. Se ejecuta con el mecanismo de la cortesía:
     **pausar en el proveedor**»*, y `B/14:71-72` *«un descuento del 100 % no es un descuento: es
     una cortesía por el período que dure»*. No hay fila en `B/03` §3.2 que lo ejecute (`rg -n
     "piso|100 %|100%" B/03` no devuelve ninguna transición), no hereda la restricción a mensual, y
     **no tiene fin**: el contador de la promo sólo baja con un cobro confirmado (`B/14:207-209`), y
     en pausa no hay cobro.
   - La tercera puerta, el **anual** por los disparadores 2 y 3, **sí se cortó** (`DESTINO_DE_PLAN_ANUAL`).

**Veredicto: SIGUE LLEGANDO.** El camino principal (pasos 1-6) deja de llegar; el paso 7 llega por
los ciclos trimestral y semestral y por la promo bajo el piso.

#### `F-8CB2-003` — una pausa aceptada y no aplicada se espeja como reanudación · **SIGUE LLEGANDO**

1. *`SUPER_ADMIN` otorga 2 meses; `S9` lleva a `PAUSED · COURTESY` y «se pausa en el proveedor».*
   Igual: `B/03:136` efectos, *«se pausa en el proveedor y **el servicio se sostiene de nuestro
   lado**»*.
2. *El `PUT paused` devuelve `200` y no se aplica.* Igual: `B/03:2633` sigue diciendo que el caso
   está *«medido nueve veces»*.
3. *`S9` no relee.* **No se corta.** `S8` (`B/03:135`) y `S9` (`B/03:136`) siguen sin rama de
   fallo ni relectura. `S10` sí la tiene: *«**el `PUT` se aplicó, confirmado por relectura**»*
   (`B/03:137`).
4. *La relectura da `authorized` contra `PAUSED` y la tabla dice `S10`.* **No se corta**:
   `B/03:2571`, *«| `authorized` | `PAUSED` | **`S10`**: el proveedor reanudó»*.
5. *El cobro entra sobre días regalados y no se marca.* **No se corta**: el motivo 12 sigue acotado
   al tramo *«**entre `S2` y la re-emisión de una cortesía diferida**»* (`B/02:913`).

`rg -n "F-8CB2-003"` sobre los tres `docs/` (excluidos los informes de fase) no devuelve nada, y
tampoco `PAUSA_NO_APLICADA` ni *«nunca se pausó»*. **Veredicto: SIGUE LLEGANDO. No se tocó.**

#### `F-8CC1-004` — la pausa del cliente sigue cobrando los addons recurrentes · **SIGUE LLEGANDO**

1. *Juan con Alojamiento `ACTIVE` y un addon `VERTICAL_SUBSCRIPTION` recurrente.* Sin cambio.
2. *Pausa 4 meses; se pausa el principal, el complemento no.* **No se corta**: `S8`
   (`B/03:135`) pausa *«en el proveedor»* una sola fila, y `B/16:606-611` sigue diciendo *«**La
   suspensión y la pausa no dejan huérfano a nada** […] El addon sigue su curso y **su reloj no se
   congela**»*.
3. *`cobertura()` no emite `SUSCRIPCIÓN` y el pliegue descarta el `COMPLEMENTO`.* **No se corta**:
   `12-contrato-de-cobertura.md:410`, *«| `PAUSED` por `CUSTOMER_REQUEST` | **no** |»*, y
   `V/15-entitlements-y-limits.md:131`, *«las de clase `COMPLEMENTO` SÓLO SI hay al menos una de
   clase `TÍTULO` viva»*.
4. *El complemento cobra 4 veces y el aviso habla sólo de la ficha.* **No se corta**: la fila 5-bis
   (`B/19:110`) sigue diciendo sólo *«qué le pasa a la ficha mientras dure la pausa»*, y lo que el
   contrato deja abierto nombra sólo la suspensión (`12-contrato-de-cobertura.md:302-303`).

Cero citas de `F-8CC1-004` en el corpus. **Veredicto: SIGUE LLEGANDO. No se tocó**, y pide una
decisión (§R4.5, AL OWNER 1).

#### `F-8CD1-007` — `S13` y `S17` cortan una pausa sin escribir `fin_real` · **DEJA DE LLEGAR**

1. *Juan pausa 4 meses.* Sin cambio.
2. *Al mes cambia de plan: `S17` cancela la predecesora `PAUSED`.* Sin cambio.
3. *La `subscription_pause` queda sin `fin_real`.* **Se corta**: `S17` (`B/03:144`) *«**Y si la
   fila estaba `PAUSED`, cierra la pausa escribiéndole `fin_real`**, como `S22` y `S25`»*, y lo
   mismo `S13` (`B/03:140`).
4. No ocurre.

**Veredicto: DEJA DE LLEGAR.** Pero la regla que el hallazgo invocaba —*toda salida de `PAUSED`
que corta la pausa escribe su fin real*— **no se cumple en todo su dominio**: `S10` y el espejo no
lo escriben (R4.4, eje C), y dos pasajes siguen enumerando las salidas viejas (CONTRADICCIONES 2).

### R4.4 El dominio recorrido

| # | caso | resultado | por qué (cita) |
|---|---|---|---|
| A1·m/t/s/a | `S9` disp. 1 × mensual, trimestral, semestral, anual | **OK ×4** | mensual permitido en meses; los otros tres, *«la fila es de un plan MENSUAL»* (`B/03:136`) |
| A2·m | `S9` disp. 2 × mensual | **OK** | N meses = N cobros |
| A2·t, A2·s | `S9` disp. 2 × trimestral, semestral | **FALLA ×2** | el cierre es sólo *«si la sucesora es de plan anual»* (`B/03:145`) y el término no se evalúa (`B/03:136`) |
| A2·a | `S9` disp. 2 × anual | **OK** | `DESTINO_DE_PLAN_ANUAL` (`B/02:663`) |
| A3·m | `S9` disp. 3 × mensual | **OK** | |
| A3·t, A3·s | `S9` disp. 3 × trimestral, semestral | **FALLA ×2** | el cierre es *«`S2` del alta nueva de plan anual»* (`B/02:663`) |
| A3·a | `S9` disp. 3 × anual | **OK** | ídem |
| A4 ×4 | promo bajo el piso × los cuatro ciclos | **FALLA ×4** | sin transición, sin restricción de ciclo y sin fin (`B/14:67-72`, `B/14:207-209`) |
| A5 | cortesía durante el trial | **OK** | *«extiende el trial, que es nuestro, y **sigue en días**»* (`B/14:623`) |
| E1 | en cortesía, pide pausar | **FALLA** | `B/03:1600` dice *«en cortesía pide pausar → **se permite**»*, pero `S8` sale sólo de `ACTIVE` (`B/03:135`) y `puedePausar()` exige `estado == ACTIVE` (`N/01:778`); la fila en cortesía está `PAUSED`. No hay transición |
| E2 | en pausa, otorgar cortesía | **OK** | `S9`: *«no hay pausa vigente»* (`B/03:136`) |
| E3 | cortesía sobre cortesía | **FALLA** | la regla dice sumar (`B/14:622`), pero `S9` sale sólo de `ACTIVE` y exige *«no hay pausa vigente»* (`B/03:136`): la única transición que otorga cortesía **bloquea** la segunda |
| C·S10 | reanudar (fin o vuelta antes) | **FALLA** | la fila `S10` (`B/03:137`) no escribe `fin_real`, y `B/03:1553-1556` enumera los escritores sin ella. Con `B/02:50` —*«a lo sumo una sin `fin_real` por suscripción»*— una segunda pausa sobre la misma fila choca con la restricción, y quien vuelve antes consume los meses previstos |
| C·S22, S25, S13, S17, S6 | las otras cinco | **OK ×5** | `B/03:149`, `:152`, `:140`, `:144`, `:133` |
| C·espejo | el proveedor cancela una `PAUSED` | **FALLA** | `B/03:2576` la manda a `CANCELLED` sin `fin_real`; no figura entre las salidas de §5 |
| C·S20, S21 | sobre una fila de complemento `PAUSED` | **INDETERMINADO ×2** | `B/03:1551-1552` las nombra como salidas de una complemento pausada, pero ninguna transición pausa una fila de complemento (`S8` y `S9` pausan *«la suscripción»*), y ninguna de las dos escribe `fin_real` |
| D·S8, D·S9 | entrar a `PAUSED` | **FALLA ×2** | sin relectura (`F-8CB2-003`) |
| F·CR ×4 | `CUSTOMER_REQUEST` × los 4 scopes | **FALLA ×4** | `F-8CC1-004`; en `USER`/`GLOBAL` sólo cuando no hay título en otra vertical compatible |
| F·CO ×4 | `COURTESY` × los 4 scopes | **OK ×4** | la cortesía **emite** `tipo: CORTESÍA` (`12-contrato-de-cobertura.md:411`), que es título: el complemento se cobra y se recibe |
| G·S18, G·S25 | fracción del saldo | **OK ×2** | redondeo para arriba, declarado (`B/14:631-632`) |

Recuento (script):

```text
R4 total 41
  por eje: {'A': 17, 'C': 9, 'D': 2, 'E': 3, 'F': 8, 'G': 2}
  por resultado: {'FALLA': 18, 'INDET': 2, 'OK': 21}
```

### R4.5 Residuos

#### AL OWNER

**AL OWNER 1 · Los addons recurrentes durante una pausa del cliente (`F-8CC1-004`, no tratado).**
Juan paga Alojamiento y un «+30 fotos» mensual. Pausa 4 meses. El plan no le cobra; el addon le
cobra 4 veces y no le da nada, porque sin título el pliegue lo descarta. Nadie se lo dice.

1. **Pausar también sus complementos recurrentes de esa vertical** (`LISTING` y
   `VERTICAL_SUBSCRIPTION`; `USER`/`GLOBAL` sólo si no queda título en otra vertical compatible),
   por los mismos meses. Costo: N llamadas más por pausa, cada una con relectura, y darle
   `PAUSED` a la fila de complemento (que `B/03:1551-1552` ya presupone). Riesgo: más llamadas que
   pueden fallar. Cobra exactamente lo que se presta.
2. **Aceptar el cobro y decirlo** en la fila 5-bis antes de confirmar. Costo: una línea de
   superficie. Riesgo: cobra por algo que el propio diseño decide no prestar.
3. **Prohibir pausar con addons recurrentes vivos.** Costo: bajo. Riesgo: niega un derecho del
   plan por un producto accesorio.

**Recomendación: 1.** Es el argumento de `DEC-ADDON-004` (*«el addon COMPLEMENTA algo que ya no
está»*, `B/16:746-748`) aplicado a un producto que vendemos, no a una mora.

**AL OWNER 2 · La promo bajo el piso ejecutada pausando (A4, paso 7 de `F-8CB1-001`).** Juan canjea
un «100 % el primer mes» (o dos promos apiladas que dejan el monto en ARS 10). El §1.3 regla 2
manda pausar, no hay transición que lo haga, y aunque la hubiera, el contador no baja sin cobro:
la pausa no termina nunca, o —por la regla 1 del núcleo— no pasa nada y Juan paga precio lleno.

1. **Rechazar el canje (o el apilado) cuyo monto compuesto cae bajo el piso**, con el motivo en
   pantalla. Costo: una validación en el canje. Lo gratis ya tiene dos instrumentos: el trial y la
   cortesía.
2. **Ejecutarlo como cortesía de verdad**: transición propia, sólo mensual, duración en meses =
   cobros. Costo: una fila nueva y su motivo de pausa. Riesgo: una tercera forma de pausar.
3. **Bajar hasta el piso** (ARS 15). Ya descartado por `DEC-GRANT-003`: cobra a quien le dijimos
   que no pagaba.

**Recomendación: 1.**

#### SIN TRATAR, corrección sin decisión

**`F-8CB2-003`.** Toca plata fuera del camino principal (requiere un `PUT` aceptado y no aplicado).
Texto propuesto para los efectos de `S8` y `S9` (`B/03:135-136`), copiando la rama de `S10`:

> **Y el `PUT paused` se confirma por relectura**, la misma regla que `S10` y `S17`. Si la relectura
> sigue viendo `authorized`, **la transición no ocurre**: la fila se queda en `ACTIVE`, no se abre
> la `subscription_pause`, y se pone la marca con motivo `PAUSA_NO_APLICADA` (`B/02` §2.5, motivo
> nuevo). En `S9` el aviso a `SUPER_ADMIN` dice que la cortesía no se aplicó.

Y en `B/03:2571`, el par `authorized`/`PAUSED`: *«`S10` sólo si la fila tiene una
`subscription_pause` cuyo `PUT` se confirmó; si no, es `PAUSA_NO_APLICADA`»*. Obliga a recontar
el catálogo de motivos de `B/02` §2.5 (hoy veinte).

#### DE BORDE

- **Complemento en `PAUSED` y su `fin_real` (C·S20/S21).** `rg -n "complemento.*PAUSED|PAUSED.*complemento" B/` no
  encuentra la declaración. Si se elige AL OWNER 1 opción 1, deja de ser borde y hay que escribirlo.
  Si no, texto propuesto para *«Lo que esta mitad NO cierra»* de `B/03`: *«**Si una fila de
  complemento puede estar `PAUSED`** no lo dice ninguna transición: `S8` y `S9` pausan la
  principal. `§5` nombra a `S20` y `S21` como salidas de una complemento pausada; si la población
  existe, ninguna de las dos escribe `fin_real`. Causa: la pausa se diseñó sobre la principal.»*
- **El espejo sobre una `PAUSED` (C·espejo).** No mueve plata: consume cupo de pausa. No está
  declarado. La corrección es una frase en `B/03:2576`: *«y si la fila estaba `PAUSED`, se escribe
  `fin_real` con el día de la relectura»*. Preferible corregir a declarar: es la misma escritura
  que ya hacen cinco salidas.

#### CONTRADICCIONES DE TEXTO

1. **«Anual» donde la regla dice «no mensual» (A2·t/s, A3·t/s).** La regla: *«**el plan** | **sólo
   mensual**»* (`B/14:620`), `N/01:305`. El cierre dice anual: `B/03:145` (`S18`), `B/03:136`
   (*«un saldo que iba a caer sobre una fila de plan anual»*), `B/02:663`
   (`DESTINO_DE_PLAN_ANUAL`), `B/14:621` y `:633-637`, `B/19:122-123` (13-ter y 13-quater),
   `N/08-auditoria-y-observabilidad.md:142`. **Corrección**: donde dice *«plan anual»* en esos
   pasajes, *«plan no mensual (trimestral, semestral o anual)»*, y el motivo pasa a
   `DESTINO_DE_PLAN_NO_MENSUAL`. Mueve plata; es mecánica porque la regla del owner ya dice
   «sólo mensual».
2. **Las salidas de `PAUSED` y quién escribe `fin_real`.** `B/03:721-728` dice *«`PAUSED` tiene
   otras ~~tres~~ cuatro salidas»* (`S22`, `S13`, `S25`, `S6`) y *«`S22` y `S25` además cierran la
   pausa escribiéndole `fin_real`»*; `B/09-conciliacion.md:485-490`, *«Las otras ~~tres~~ cuatro
   salidas»* y *«`S22`, `S25` **y `S6`** además escriben el `fin_real`»*. Los dos omiten `S17` y el
   espejo, y omiten que `S13` y `S17` escriben `fin_real` (`B/03:140`, `:144`, `:1553-1556`).
   **Corrección**: *«cinco salidas terminales —`S22`, `S13`, `S17`, `S25` y el espejo del §10.1—
   y `S6`; todas escriben `fin_real`»* (con el espejo, si se aplica el borde de arriba).
3. **`S10` no escribe `fin_real` (C·S10).** `B/03:137` no lo dice; `B/02:50` exige *«a lo sumo una
   sin `fin_real` por suscripción»*; la razón está en `S22` (`B/03:149`): *«una pausa que se
   corta sin registrar su fin real le come al cliente meses que no usó»*. **Corrección**, en los
   efectos de `S10`: *«**Se escribe `fin_real` en la `subscription_pause`** con el día de la
   reanudación confirmada; si la persona vuelve antes, los meses no usados no cuentan contra
   `DEC-SUB-004`»*. Es el caso más frecuente del dominio: toda pausa termina por acá.
4. **Cortesía sobre cortesía (E3).** `DEC-GRANT-004` punto 3, `B/14:622` y `B/19:122` dicen
   *«se suman meses»*; `S9` (`B/03:136`) sale sólo de `ACTIVE` y exige *«no hay pausa vigente»*.
   **Corrección**: una fila nueva, `PAUSED · COURTESY` → *el mismo estado*, evento
   *«`SUPER_ADMIN` otorga cortesía»*, efectos *«suma los meses a `courtesy_grant.fin` y a
   `subscription_pause.fin_previsto`; al proveedor no se manda nada (sigue `paused`)»*.
5. **En cortesía pide pausar (E1).** `B/03:1600` y `N/01:804-806` (*«la función responde que sí»*)
   contra `N/01:778` (*«estado == ACTIVE»*) y `S8` desde `ACTIVE` (`B/03:135`). **Corrección**: una
   fila `PAUSED · COURTESY` → `PAUSED · CUSTOMER_REQUEST`, evento *«la persona pide pausar»*,
   condición *«confirmó el aviso de que pierde la cortesía»*, efectos *«cierra la
   `subscription_pause` de la cortesía con `fin_real`, abre una nueva de la persona, nada al
   proveedor»*; y en `N/01` precisión 3, cambiar *«la función responde que sí»* por *«no la decide
   `puedePausar()`: la decide esa fila»*.

---

## R6 · Promos y addons sin ciclo de vida

### R6.1 La regla corregida, tal como quedó

Addon `LISTING` muere con la principal (`B/16:417`):

> **una de dos**: la ficha **se borró** —**cualquier llegada a `PURGED`** […]—, **o la suscripción
> principal de la vertical de la ficha cumple la condición de la fila de abajo**: dejó de ser fila
> viva, ninguna sucesión la releva y ningún grant permanente la releva

Promos con contador (`B/14:203-205`): *«**El contador es `promo_redemption.cobros_restantes`** […]
**nulo** es `forever`, **N > 0** son N cobros con descuento por delante y **0** es agotado»*; y
`S30` (`B/03:157`): *«`P1` deja en 0 el `cobros_restantes` […] **se muta `transaction_amount` […]
al monto sin esa promo, recalculado con las que siguen vivas**»*.

Las promos no sobreviven un cambio de plan (`B/14:101-103`): *«**las promos NO sobreviven a un
cambio de plan.** […] si la persona cambia de plan —upgrade, downgrade o de ciclo (§2.3)—, **la
promo se pierde**»*.

Addon de única vez (`B/16:74`, `:95`): *«**El cobro de única vez va por `/v1/orders`.**»* y
*«**`/v1/orders` es idempotente por `X-Idempotency-Key`** […] **una orden sin respuesta se
recupera reenviándola con la misma clave**»*.

Entidad madre (`V/02-modelo-de-datos.md:36`): `addon ──< addon_version ──┬──< …`.

### R6.2 El dominio

| eje | casos | fuente |
|---|---|---|
| **H · orfandad de un addon recurrente** | 4 scopes × 6 situaciones del título (muere sin relevo; relevado por sucesión; la sucesora abandona con la predecesora viva; relevado por grant; grant revocado; ficha borrada) = **24** | scopes `B/16:415-419`; situaciones `B/16:418`, `:451-457`, `:654-656`, `B/03:2368-2369` |
| **I · promos** | 12 eventos (cobro confirmado; llega a 0 en `ACTIVE`, en `PAUSED`, en `GRACE_PERIOD`; upgrade o ciclo; ventana del downgrade; acto del downgrade; cortesía; aumento `DEC-MP-002`; pagador manual; `S13`; monto compuesto bajo el piso) × 3 duraciones (primer cobro, N, forever) = **36** | duraciones `B/02:490`; eventos `B/14` §1.3, §2.2-§2.5, §4.2, `B/03:157`, `B/12-suscripcion.md:193-200` |
| **J · cobro de única vez** | con respuesta; timeout y la orden existía; timeout y no existía; misma clave con otro cuerpo; conciliación; marca; producción = **7** | `06-mp-validation-matrix.md:396` (`EX-41`), `B/16:95`, `:866-872` |
| **K · linaje del addon** | la instancia ancla; re-apunte al mismo addon; invalidación con sujeto; dos productos sobre una versión = **4** | `V/02:40-100`, `B/02:487` |
| **L · emisión de `USER`/`GLOBAL`** | 2 scopes × vertical compatible / no compatible = **4** | `12-contrato-de-cobertura.md:615`, `B/02:487` |

**Tamaño: 75 casos.**

### R6.3 Los caminos reejecutados

#### `F-8CA2-003` (CRÍT) — el addon `LISTING` sobrevive a la principal · **DEJA DE LLEGAR**

1. *Juan con Alojamiento `ACTIVE` y un «Destaque» mensual sobre la ficha F.* Sin cambio.
2. *Baja: `S11` → `S12` → `CANCELLED`; `PB2` baja F.* Sin cambio.
3. *La condición de `LISTING` es «la ficha se borró»; F existe; `A5` no corre.* **Se corta**:
   `B/16:417` agrega la segunda mitad, y `A5` la lee (`B/03:2368`, *«**y para `LISTING`, además
   del borrado de la ficha, esa misma condición leída sobre la principal de la vertical de la
   ficha**»*). `S12` es uno de los disparadores y la re-evaluación mira *«las instancias `LISTING`
   cuyas fichas son del mismo `user + vertical`»* (`B/16:676-678`).
4. y 5. No ocurren: `A5` → `CANCELLED`, `S21` corta el complemento (`B/16:437-439`).

**Veredicto: DEJA DE LLEGAR.** Pero el arreglo abrió el error contrario (R6.5, AL OWNER 3), y la
severidad del hallazgo nombraba también `USER`/`GLOBAL`, que no se tocaron (AL OWNER 4).

#### `F-8CB1-007` — las promos acotadas no terminan · **DEJA DE LLEGAR**

1. *Canjea «20 % los primeros 3 cobros»; el monto se muta a 800.* Sin cambio.
2. *Pasan tres cobros; nada cuenta ni restituye.* **Se corta**: `P1` *«lo decrementa en uno en el
   mismo acto […] y si llega a 0 corre `S30`»* (`B/03:1635`), y `S30` muta al monto sin la promo
   (`B/03:157`), con relectura y reintento de 3 días (`B/14:251-256`).
3. *Upgrade con «20 % forever»; `S18` re-aplica y la mutación falla.* **Se corta**: `S18` ya no
   re-aplica nada, *«**`S18` NO re-apunta `promo_redemption.subscription_id`**»* (`B/14:108-111`),
   y la sucesora *«nace con el precio de lista, y ése es ahora el precio que corresponde»*.

**Veredicto: DEJA DE LLEGAR.** El dominio (eje I) encuentra el downgrade roto (CONTRADICCIONES 1).

#### `F-8CB1-008` — el addon de única vez sin mecanismo, idempotencia ni registro · **DEJA DE LLEGAR**

1. *Compra «Boost 7 días»; la orden da timeout.* Sin cambio.
2. *La recuperación de `B/05` §1.2 pregunta por suscripciones.* **Se corta**: *«una orden sin
   respuesta se recupera reenviándola con la misma clave: si ya existía, vuelve la misma; si no, se
   crea»* (`B/16:95`), sobre `EX-41` `VERIFIED` (`06-mp-validation-matrix.md:396`).
3. *Reintentar puede cobrar dos veces; no reintentar deja plata sin fila.* **Se corta**: misma
   clave, *«**un solo pago**»* (`EX-41`); y el pago tiene fila, *«`B/02` §2.3 le agrega a `payment`
   la referencia a `addon_instance`, con un CHECK de que exactamente una de las dos es no nula»*
   (`B/16:82-85`).

**Veredicto: DEJA DE LLEGAR.** Quedan tres cosas declaradas (eje J) y una contradicción menor
(CONTRADICCIONES 3).

#### `F-8CA3-011` — `addon_version` sin entidad madre · **DEJA DE LLEGAR**

El hallazgo nombra tres consecuencias. **(1) La invalidación sin sujeto** se corta:
`V/02:481`, *«**se publica una versión nueva de ~~un `addon_version`~~ un `addon`**»*. **(2) El
re-apunte a una versión que otorga otra cosa** se corta: *«**Y sólo se re-apunta a otra versión
DEL MISMO `addon`**»* (`B/02:487`). **(3) Dos productos compartiendo versión** no tiene regla
(K4, borde).

**Veredicto: DEJA DE LLEGAR** en lo que ponía en riesgo (el linaje de la invalidación).

#### `F-8CB1-016` — el aumento sobre una suscripción con promo · **DEJA DE LLEGAR**

El hallazgo: *«Ningún texto dice si el aumento parte del precio de lista o del monto con
descuento»*. **Se corta**: el monto esperado es *«el precio de su versión de plan menos las promos
vivas según su contador […] **Ese precio es el vigente de la versión, con los aumentos de
`DEC-MP-002` ya aplicados**»* (`B/14:241-244`; mismo texto en `B/09:109` y `B/03:157`), y el
aumento es *«una mutación NUESTRA»* que se reintenta contra ese monto (`B/14:251-256`). Parte del
precio de lista, y la promo se vuelve a restar.

**Veredicto: DEJA DE LLEGAR.** Matiz: ningún texto dice con esas palabras que el `PUT` del aumento
apunta al monto esperado; se deduce de que el reintento lo compara contra él. De borde.

#### `F-8CA1-008` — el contrato no dice en qué verticales se emite un addon `USER`/`GLOBAL` · **SIGUE LLEGANDO**

1. *Addon `USER` «+20 fotos» compatible sólo con Alojamiento; Juan tiene Gastronomía `ACTIVE`.*
2. *Billing emite todos sus `USER` en `cobertura(Juan, Gastronomía)`.* **No se corta**: la fila
   del addon en el mapeo sigue siendo *«| addon | los cuatro del §40 | `LISTING` · `VERTICAL` ·
   `USER` · `GLOBAL` |»* (`12-contrato-de-cobertura.md:615`), sin condición de compatibilidad.
   `rg -n "compatib" 12-contrato-de-cobertura.md` devuelve sólo `:267` y `:699`, ninguna sobre la
   emisión.
3. *El pliegue lo admite y Gastronomía recibe +20 fotos.* **No se corta** (`V/15:131`).

Cero citas en el corpus. **Veredicto: SIGUE LLEGANDO. No se tocó.**

### R6.4 El dominio recorrido

**Eje H · orfandad (24).**

| scope | h1 muere sin relevo | h2 sucesión | h3 sucesora abandona, predecesora viva | h4 grant | h5 grant revocado | h6 ficha borrada |
|---|---|---|---|---|---|---|
| `LISTING` | OK (`B/16:417`) | OK | **FALLA** (AL OWNER 3) | OK | OK (`B/16:550-555`) | OK (`B/16:441-449`) |
| `VERTICAL_SUBSCRIPTION` | OK (`B/16:418`) | OK | OK: cuelga de la predecesora, que sigue viva | OK | OK | N/A |
| `USER` | **FALLA**: *«la cuenta se borró»* (`B/16:419`) | OK | OK | OK | OK (tercera cláusula de `A5`) | N/A |
| `GLOBAL` | **FALLA**: ídem | OK | OK | OK | OK | N/A |

**Eje I · promos (36).**

| evento | primer cobro | N cobros | forever | cita |
|---|---|---|---|---|
| e1 cobro confirmado | OK | OK | OK (nulo no baja) | `B/03:1635` |
| e2 llega a 0 en `ACTIVE` | OK | OK | N/A | `S30`, `B/03:157` |
| e3 llega a 0 en `PAUSED` | OK | OK | N/A | *«ese mes sale con descuento, y se acepta»* (`B/14:265-270`) |
| e4 llega a 0 con la fila en `GRACE_PERIOD` | BORDE | BORDE | N/A | `P1` corre dentro de `S5` (`B/03`, `S5`) y `S30` sale sólo de `ACTIVE` (`B/03:157`); el orden no está escrito |
| e5 upgrade o ciclo | OK | OK | OK | `B/14:108-111` |
| e6 ventana del downgrade | **FALLA** | **FALLA** | **FALLA** | CONTRADICCIONES 1 |
| e7 acto que aplica el downgrade | **FALLA** | **FALLA** | **FALLA** | ídem: escribe 0 y *«`S30` no corre»* (`B/02:593-596`) |
| e8 cortesía en curso | OK | OK | OK | `B/14:354-356` |
| e9 aumento | OK | OK | OK | `B/14:241-244` |
| e10 pagador manual | OK | OK | OK | *«No hay promos para el pagador manual»* (`B/14:287`) |
| e11 `S13` | OK | OK | OK | cancela toda obligación (`B/03:140`) |
| e12 compuesto bajo el piso | **FALLA** | **FALLA** | **FALLA** | AL OWNER 2 (R4) |

**Eje J · única vez (7).** j1-j4 **OK** (`EX-41`: misma orden, un pago; `409` con otro cuerpo;
`B/16:95`). j5 conciliación, j6 marca y j7 producción: **DECLARADOS** en `B/16:866-872`
(*«**su pago no lo ve la conciliación ni admite una marca** […] **Y está medido sólo en sandbox**»*),
`B/09:835-841` y `B/02:372-378`.

**Eje K · linaje (4).** k1-k3 **OK** (`B/02:487`, `V/02:481`, `V/02:92-100`). k4 **BORDE**: nada
impide que dos `addon_product` apunten a la misma `addon_version`.

**Eje L · emisión (4).** Compatible **OK** ×2; no compatible **FALLA** ×2 (`F-8CA1-008`).

Recuento (script):

```text
R6 total 75
  por eje: {'H': 24, 'I': 36, 'J': 7, 'K': 4, 'L': 4}
  por resultado: {'BORDE': 3, 'DECLARADO': 3, 'FALLA': 14, 'NA': 6, 'OK': 49}
```

### R6.5 Residuos

#### AL OWNER

**AL OWNER 3 · El arreglo de `F-8CA2-003` cancela el destaque de un cliente que sigue pagando
(H·LISTING·h3).** Juan paga Alojamiento `ACTIVE` y un Destaque mensual sobre su ficha. Intenta un
upgrade y abandona el checkout: la sucesora pasa a `ABANDONED` por `S3`. La regla dice que la
principal que se lee es *«la **más reciente**»* (`B/16:455-457`): es la sucesora abandonada, que
*«dejó de ser fila viva»*, sin sucesión ni grant que la releve. `S3` es un momento de
re-evaluación (`B/16:654`) y el punto 3 mira las `LISTING` del mismo `user + vertical`
(`B/16:676-678`). El Destaque queda huérfano, `A5` cancela el preapproval (irreversible, `PA-5`) y
`S21` escribe el motivo 14, *no devolver*. Juan sigue pagando el plan y perdió lo que compró. No es
raro: en producción hay 3 `abandoned` de 8 filas (`25-fase-8-completa/00-hallazgos.md` §4).

1. **Leer la mitad nueva sobre el conjunto, no sobre una fila**: el `LISTING` queda huérfano si
   **ninguna** principal de ese `user + vertical` es fila viva y no hay ancla viva ahí. Costo: una
   frase en `B/16:417` y `:451-457`. Cubre también el caso de `S31` (predecesora `SUSPENDED` viva,
   sucesora cortada).
2. **Excluir `ABANDONED` de «la más reciente».** Costo: una salvedad. Riesgo: `S31` desde
   `ACTIVE` deja la sucesora `CANCELLED` con la predecesora viva, y el caso reaparece.
3. **Dejarlo y declararlo.** Riesgo: pérdida irreversible sobre el camino normal.

**Recomendación: 1.**

**AL OWNER 4 · El addon `USER`/`GLOBAL` recurrente sigue cobrando cuando no queda ningún título
(H·USER/GLOBAL·h1).** Juan tiene Alojamiento y un addon `USER` mensual. Se da de baja. Su única
condición de orfandad es *«la cuenta se borró»* (`B/16:419`): el preapproval sigue cobrando, el
pliegue lo descarta en toda vertical, y ninguna comprobación lo ve porque la instancia no es
terminal. Es el mecanismo crítico de `F-8CA2-003` en otros dos scopes; el hallazgo lo nombraba en
su severidad.

1. **Huérfano también cuando, en ninguna vertical compatible del producto, hay una principal
   fila viva ni un ancla viva.** Costo: una fila en `B/16:419`, y la re-evaluación en las mismas
   transiciones. Riesgo: ninguno nuevo.
2. **Declararlo** en *«Lo que este capítulo NO cierra»*. Riesgo: débito mensual a un ex-cliente.

**Recomendación: 1.**

**`F-8CA1-008` (no tratado, acceso cruzado).** No pide decisión según su propio informe, pero es
acceso en camino principal, así que va al owner para el OK. Texto propuesto para
`12-contrato-de-cobertura.md` §2.7, debajo de la tabla de `:612-615`: *«**Una fuente `ADDON` de
alcance `USER` o `GLOBAL` se emite sólo en las verticales compatibles de su producto**
(`addon_product`, `B/02` §2.4). En una vertical no compatible no se emite, igual que un grant no
transporta el ancla de otra vertical.»* Y un guard gemelo de `G-R2-B`. **Recomendación: aplicarlo.**

#### DE BORDE

- **e4 · la promo que se agota con la fila en `GRACE_PERIOD`.** `rg -n "GRACE" B/14` no encuentra
  la declaración. Texto propuesto para *«Lo que este capítulo NO cierra»* de `B/14`: *«**Si el cobro
  que agota una promo es el que saca a la fila del grace** (`S5`), el orden entre `P1` y `S30` no
  está escrito: `S30` sale sólo de `ACTIVE`. Si `P1` corre antes, la mutación no ocurre y el barrido
  abre `DIVERGENCIA_DE_MONTO` en el acto. Causa: `S30` se escribió sobre el cobro ordinario.»*
- **k4 · dos productos sobre una misma versión.** No declarado. Texto propuesto para `B/02` §2.4,
  fila de `addon_product`: *«Nada impide que dos productos anclen versiones del mismo `addon` —dos
  precios para la misma capacidad—; es legítimo y no rompe el linaje, porque la instancia ancla su
  versión.»*
- **j5-j7 · conciliación, marca y producción de la orden.** **Ya declarados**: `B/16:866-872`,
  `B/09:835-841`, `B/02:372-378`, y producción en `B/06-proveedor.md:457-459`.
- **El matiz de `F-8CB1-016`** (el aumento apunta al monto esperado por deducción). Texto propuesto
  para `B/14` §2.4, tras `:244`: *«**El aumento de `DEC-MP-002` muta al monto esperado**, con la
  versión nueva: parte del precio de lista y vuelve a restar las promos vivas.»*

#### CONTRADICCIONES DE TEXTO

1. **El monto esperado en la ventana del downgrade (e6, e7).** De un lado,
   `B/14:119`: *«en esa ventana el monto esperado es el del plan NUEVO desde el pedido»*, y
   `B/14:688`, *«el del plan nuevo desde el pedido»*. Del otro, `B/14:260-261`: *«Entre el pedido
   de un downgrade y el acto que lo aplica, el monto esperado es el del plan vigente»*, y lo mismo
   `B/12:200` y `B/09:109`. En esa ventana el plan vigente es **el viejo**. Además la derivación
   resta la promo **según su contador** (`B/14:241-243`), que sigue vivo hasta el acto
   (`B/12:193-196`), mientras la superficie promete *«el importe nuevo ya no lleva el descuento»*
   (`B/19:112`). Y en el acto *«`S30` no corre»* (`B/02:593-596`), así que si el monto del pedido
   llevaba la promo nadie la saca. **Corrección**: la promo se termina **en el pedido**, en el mismo
   acto en que `DEC-SUB-008` muta el monto: ese acto escribe `cobros_restantes = 0` y muta al precio
   de lista del plan nuevo. En `B/14:113-119`, `B/12:193-200` y `B/02:593-596` cambiar *«el acto que
   aplica el cambio programado»* por *«el pedido del downgrade»*, y en `B/14:260-261`, `B/12:200` y
   `B/09:109` cambiar *«plan vigente»* por *«plan nuevo, sin promos»*.
2. **Cuántas transiciones sacan a una principal de las filas vivas.** `A5` (`B/03:2368`): *«la
   pueden cumplir las **seis** transiciones […] —`S3`, `S12`, `S13`, `S16`, `S17` y el espejo del
   §10.1—»*. `B/16:630-636`: *«**las doce**»*, sumando `S22`, `S23`, `S24`, `S25`, `S27` y `S28`.
   Y las doce omiten **`S31`** (`B/03:158`), que lleva a una sucesora principal a `ABANDONED` o
   `CANCELLED`. **Corrección**: `B/03:2368` remite a la lista de `B/16` §4.3 en vez de copiarla, y
   esa lista gana `S31` (trece).
3. **`B/05` §1.2 contra la recuperación de la orden.** `B/05-idempotencia-y-concurrencia.md:52-55`:
   *«Mandamos crear, el proveedor crea **y cobra**, y la respuesta se pierde […] **Sólo se resuelve
   preguntándole al proveedor**»*. Para `/v1/orders` es falso desde `EX-41`: se resuelve reenviando
   con la misma clave (`B/16:95`). **Corrección**: una frase al final del §1.2, *«Vale para
   `/preapproval`, que ignora el header (`EX-17`). **El cobro de única vez por `/v1/orders` sí lo
   cubre un candado**: se reenvía con la misma `X-Idempotency-Key` (`EX-41`, `B/16` §1.4).»*

---

## Lo que pide acción, junto

| # | qué | clase | dónde |
|---|---|---|---|
| 1 | addons recurrentes durante la pausa del cliente | AL OWNER | `F-8CC1-004`, `B/16` §4.2, `B/03` `S8` |
| 2 | promo bajo el piso | AL OWNER | `B/14` §1.3 |
| 3 | el `LISTING` muere por una sucesora abandonada | AL OWNER | `B/16:417`, `:451-457` |
| 4 | `USER`/`GLOBAL` sin título siguen cobrando | AL OWNER | `B/16:419` |
| 5 | emisión de `USER`/`GLOBAL` en verticales no compatibles | AL OWNER (OK a un texto) | `F-8CA1-008`, contrato §2.7 |
| 6 | pausa aceptada y no aplicada | sin tratar, corrección | `F-8CB2-003`, `B/03` `S8`/`S9`, `:2571` |
| 7 | «anual» por «no mensual» | contradicción | R4, CONTRADICCIONES 1 |
| 8 | salidas de `PAUSED` y `fin_real` | contradicción | R4, CONTRADICCIONES 2 |
| 9 | `S10` sin `fin_real` | contradicción | R4, CONTRADICCIONES 3 |
| 10 | cortesía sobre cortesía sin fila | contradicción | R4, CONTRADICCIONES 4 |
| 11 | en cortesía pide pausar sin fila | contradicción | R4, CONTRADICCIONES 5 |
| 12 | monto esperado en el downgrade | contradicción | R6, CONTRADICCIONES 1 |
| 13 | seis contra doce (y `S31`) | contradicción | R6, CONTRADICCIONES 2 |
| 14 | `B/05` §1.2 contra `EX-41` | contradicción | R6, CONTRADICCIONES 3 |
| 15-19 | complemento `PAUSED`, espejo sin `fin_real`, `GRACE` + `S30`, dos productos por versión, aumento → monto esperado | de borde | R4.5 y R6.5 |
