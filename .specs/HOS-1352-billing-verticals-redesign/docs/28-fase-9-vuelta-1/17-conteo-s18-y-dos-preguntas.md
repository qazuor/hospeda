---
title: "FASE 9 vuelta 1 · el conteo de S18 con S36, y dos preguntas para el owner"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — el conteo de `S18` con `S36`, y dos preguntas

Cierra los tres residuos de `16-aplicado-segunda-tanda.md` §4. El §4.1 se aplicó (sale de la
decisión M del owner: *«`S36` dispara `S18` como `S23` y `S24`»*); el §4.2 y el §4.3 quedan como
preguntas, sin decidir. Fui el único agente editando. No toqué el log ni la matriz. Rutas: `V/` =
`.specs/HOS-1353-…/`, `B/` = `.specs/HOS-1354-…/`, `D/` = `.specs/HOS-1352-…/docs/`. Las líneas
son las del worktree al cerrar esta pasada.

## 1. Lo aplicado: `S36` entra en la cuenta de la predecesora

**El recuento, con script** sobre la tabla *«el dominio, recorrido por el lado de la
PREDECESORA»* (`B/03` §3.2), leyendo las filas numeradas no tachadas y su última columna:

- **10 salidas** (1, 2, 4, 5, 6, 7, 9, 10, 11, 12): eran nueve.
- **3 vivas** (1, 2, 11) y **7 terminales** (4, 5, 6, 7, 9, 10, 12): eran seis.
- **`S18` corre en OCHO de las diez**: las tres vivas (después de `S17`), `S12`, `S16`, el espejo,
  `S23` y `S36`. Faltan `S13` y `S27`, como antes (ver §4, residuo 1).
- **Caminos por los que la predecesora se muere sola y `S18` corre sin `S17`: SIETE** —`S12`,
  `S16`, el espejo, `S22`, `S23`, `S24` y `S36`—. El párrafo decía cinco y ya eran seis antes de
  `S36` (omitía `S24`).
- **En el contrato, las transiciones que no emiten: ocho de las diez** (eran siete de las nueve);
  las dos excepciones siguen siendo `S9` y `S4`.

| ítem | archivo:línea | estado |
|---|---|---|
| Fila 12 (`S36`, desde `ACTIVE` · `CANCEL_SCHEDULED`, terminal; desde `GRACE_PERIOD` no cuenta, como `S24`) | `B/03:390` | hecho |
| Encabezado de la tabla: ~~nueve~~ **diez**, *«y entra la 12»* | `B/03:373-375` | hecho |
| *«la 9 es la única que decide el propio cliente»* → **la 9 y la 12** | `B/03:411-416` | hecho |
| ~~seis~~ **siete terminales —4, 5, 6, 7, 9, 10 y 12—**, con su recuento | `B/03:422-427` | hecho |
| *«Diez menos dos más una: nueve»* → *«y diez con la 12»* | `B/03:473-474` | hecho |
| ~~SIETE de las nueve~~ **OCHO de las diez**; el aviso de *«todavía no está en esta cuenta»* tachado | `B/03:480-490` | hecho |
| La lista de *«cuando la predecesora se muere sola»* gana `S36`; ~~cinco~~ **siete** caminos | `B/03:504-506`, `:518` | hecho |
| ~~CINCO caminos~~ **SIETE**, con `S24` y `S36` nombrados y por qué ninguno deja viva una autorización; ~~tres~~ **siete** al cierre | `B/03:618-636` | hecho |
| `B/02`: ~~nueve~~ **diez**, y `S36` entre las bajas que la persona pide | `B/02:150-151` | hecho |
| `B/12`: *«fila 11 de las ~~nueve~~ diez»* | `B/12:612` | hecho |
| `B/20`: ~~nueve~~ **diez transiciones**, y `S36` en la enumeración | `B/20:116-128` | hecho |
| Contrato: ~~nueve~~ **diez**, *«y entra `S36`, la fila 12»* | `D/12-contrato-de-cobertura.md:447-449` | hecho |
| Contrato: `S36` no entra en la cuenta de *«caer al piso sin que nadie declare nada»*, **por la misma razón que `S24`: lo pidió el cliente** | `D/12-contrato-de-cobertura.md:460-465` | hecho |
| Contrato: ~~nueve~~ **diez** transiciones durante la ventana; ~~siete de los nueve~~ **ocho de los diez** no emiten; `S36` desde el grace con `S6` y `S24` | `D/12-contrato-de-cobertura.md:533-539` | hecho |

**markdownlint** sobre los seis archivos tocados y este registro: resultado en §4 al pie.

## 2. Pregunta P1 — la cortesía diferida que `S9` no re-emitió, si la sucesora ya cayó en el grace

**En una línea**: la sexta comprobación del barrido (`B/09:578-585`) busca la sucesora **en
`ACTIVE`**; si por `DEC-SUB-022` ya pasó a `GRACE_PERIOD`, no la ve. ¿Se ensancha, o se declara?

**Lo que investigué** (el diseño no lo contesta solo):

1. **`S9` corre en el mismo acto de la autorización** (`S2`), sólo desde `ACTIVE` (`B/03:155`). Si
   corre bien, la sucesora pasa a `PAUSED · COURTESY` en ese mismo acto y **el primer cobro nunca
   llega durante la cortesía**: el proveedor está pausado.
2. **Si `S9` intentó y el `PUT paused` no se aplicó**, `S9` no ocurre pero `S14` **ya abre la marca
   `PAUSA_NO_APLICADA`** sobre esa fila (`B/02:962`), que queda abierta pase lo que pase con el
   estado. Ahí ya hay una persona mirando, grace o no.
3. **El hueco real es uno solo**: `S9` **no se ejecutó nunca** (un proceso que se cae entre `S2` y
   `S9`; no pueden ser atómicos porque `S9` llama al proveedor). Para que la sucesora llegue al
   grace sin que el barrido la vea antes, hace falta además que **el primer cobro llegue antes del
   próximo barrido diario** —`D8` lo pone después del vencimiento de la ventana (`NUCLEO/04:135`),
   así que pasa si autorizó cerca del final de su ventana—, que **se rechace**, y que **la
   predecesora viniera pagando** (sin eso corre `S16`, no `S4`, `DEC-SUB-022`).
4. **Qué hay en juego**, en esa población:
   - **Si paga durante el grace**: `S5` la vuelve a `ACTIVE`, la sexta comprobación la ve al día
     siguiente y la marca 13 manda re-emitir y **devolver** (*«si ya cobró, sí»*, `B/02:953`). Se
     recupera todo, con un cobro que se devuelve.
   - **Si no paga**: `S6` la suspende. **Pierde acceso durante meses que tenía regalados**, recibe
     avisos de mora por un período que la cortesía cubría, y **el saldo queda diferido para
     siempre**: ninguno de los cuatro `motivo_cierre` (`B/02:687-692`) describe este desenlace,
     igual que el saldo de `S25` sobre una vertical discontinuada.
   - **Plata cobrada de más**: no, salvo el caso de arriba, que ya tiene su devolución.
5. **Por qué ensanchar no es gratis**: `S9` sale sólo de `ACTIVE`. Sobre una sucesora en grace
   no hay transición que re-emita ni que pause, así que una marca abierta ahí no tiene acción
   nombrada: la persona sólo puede esperar a que vuelva a `ACTIVE`.

**Opciones:**

1. **Dejar el detector en `ACTIVE` y declarar el hueco** en `B/09` §3, al lado del caso de `S3`.
   El texto diría que la población existe sólo si `S9` no corrió, que si la fila vuelve a `ACTIVE`
   la comprobación la levanta con su devolución, y que si termina suspendida el saldo queda
   diferido y sin emitir, como el de `S25`.
   - **Costo**: un párrafo.
   - **Riesgo**: en esa población, meses regalados perdidos y avisos de mora injustos. Se repara
     con un acto que ya existe: `SUPER_ADMIN` vuelve a otorgar la cortesía cuando la fila vuelva a
     `ACTIVE` (el primer disparador de `S9`), el mismo argumento que `DEC-GRANT-011`.
   - **Impacto**: `B/09` §3 y, si se quiere el espejo, `B/14` §4.4.
2. **Ensanchar el detector a `ACTIVE` o `GRACE_PERIOD`**, con la marca 13 diciendo qué hacer en el
   grace: avisarle a `SUPER_ADMIN`, y re-emitir y devolver cuando la fila vuelva a `ACTIVE`.
   - **Costo**: un término en el predicado, la fila 13 de `B/02` §2.5 y el término del
     `NUCLEO/01` §2.6.
   - **Riesgo**: si la fila termina suspendida, la marca queda abierta **sin acción posible**, que
     es lo que `B/09` §3 rechaza para el saldo de `S25`. Pone a una persona a mirar el caso antes
     de `S6`, pero no puede frenarlo.
   - **Impacto**: `B/09` §3, `B/02` §2.5 fila 13, `NUCLEO/01` §2.6, `B/20` (el guard que lee el
     término).
3. **Ensanchar y dejar que `S9`, por su segundo y tercer disparador, salga también de
   `GRACE_PERIOD`**: re-emitir la cortesía apaga el reloj del grace y pausa el proveedor.
   - **Costo**: un `desde` nuevo en `S9`, su cruce con el reloj del §4, una pausa sobre un
     preapproval con un cobro fallido en reintento, que no está medida, y una fila en la matriz.
   - **Riesgo**: comportamiento del proveedor sin medir, sobre una población que sólo existe si
     falla un proceso.
   - **Impacto**: `B/03` (`S9` y §4), `B/12`, `B/20`, `D/06` (propuesta a la matriz).

**Recomendación: la 1.** No agrega mecanismo. La población sólo existe si `S9` no se ejecutó, y
encima hacen falta tres condiciones más: un cobro antes del barrido, que se rechace, y una
predecesora que venía pagando. El fallo del `PUT` ya deja su propia marca. Y la rama que se puede
recuperar, la del cliente que paga en el grace, la recupera la comprobación que ya existe. Lo
único que se pierde es la rama que termina suspendida, y para esa ya hay un acto: volver a otorgar
la cortesía.

**Ejemplo.** Juan tiene Básico, mensual, con 3 meses de cortesía (`PAUSED`). El lunes a las 10
pide Premium. `S17` y `S18` cancelan Básico y le difieren los 3 meses, y la ventana vence el
jueves a las 10. Juan autoriza el jueves a las 9:50 y el proceso se cae entre `S2` y `S9`. El
primer cobro de Premium sale a las 10:05 y se rechaza. Como Juan venía pagando, entra en grace
(`DEC-SUB-022`). El barrido de las 3:00 del viernes busca la sucesora en `ACTIVE` y no la ve.

- **Con la 1**: si Juan actualiza la tarjeta y paga, vuelve a `ACTIVE`, y el sábado el barrido
  abre la marca 13: se le re-emiten los 3 meses y se le devuelve el cobro. Si no paga, queda
  suspendido con los 3 meses diferidos, y lo repara un `SUPER_ADMIN` que se los vuelva a otorgar.
- **Con la 2**: el viernes ya hay una marca y una persona sabe que Juan tenía 3 meses. Pero no
  puede hacer nada hasta que Juan pague, y si no paga la marca queda abierta.

**La otra posición, honesta**: la 2 cuesta un término, y es la misma forma que el contrato ya
corrigió en otro lado (ensanchar a *«en cualquier estado posterior»*). Con la 1, Juan recibe
avisos de mora por meses que le regalamos, y nadie lo sabe hasta que paga o lo suspenden.

**Texto propuesto si elige la 1** (para `B/09` §3, después del párrafo *«Y el caso en que la
sucesora NO llega a `ACTIVE`…»*):

> **Y el caso en que la sucesora llega al grace sin que `S9` haya corrido queda afuera, y es
> deliberado** (owner 2026-09-26, P1). Sólo existe si `S9` **no se ejecutó**: si intentó y el
> `PUT paused` no se aplicó, la fila ya tiene la marca `PAUSA_NO_APLICADA`. Y además hace falta
> que el primer cobro llegue antes del barrido, que se rechace y que la predecesora viniera pagando
> (`DEC-SUB-022`). Si la persona paga en el grace, `S5` devuelve la fila a `ACTIVE` y esta
> comprobación la levanta con su devolución. Si termina en `SUSPENDED`, **el saldo queda diferido
> y sin emitir**, como el que difirió `S25`, y quien firmó la cortesía **puede volver a otorgarla**
> cuando la fila vuelva a `ACTIVE`, que es el primer disparador de `S9` y no un mecanismo nuevo.

## 3. Pregunta P2 — por dónde extiende un trial `SUPER_ADMIN`

**En una línea**: la extensión de trial que firma `SUPER_ADMIN` y pasa el techo (`V/11` §3.4),
¿es una acción de verticales sobre su propia máquina, o una acción de billing que pasa por
`extenderTrial`?

**Lo que investigué:**

1. **Es un solo acto con tres nombres, y eso sí lo contesta el diseño.** `V/11` §3.2 dice que las
   extensiones vienen de **dos** instrumentos, el promo (§32) y la cortesía durante el trial
   (§34.1). El §3.4 opone *«canje de promo»* a *«extensión firmada por `SUPER_ADMIN`»*, y las
   cortesías las firma `SUPER_ADMIN` (`DEC-GRANT-002`). Así que la *«cortesía durante el trial»* de
   `B/14` §4.5 y §4.7, la *«extensión firmada por `SUPER_ADMIN`»* de `V/11` §3.4 y la acción
   *«extender un trial»* de `NUCLEO/08` §3 son la misma. Esa fila cita el §32, que es el canje
   self-service, y debería citar el §34.1. No puede ser la fila *«otorgar una cortesía temporal»*:
   ésa exige meses enteros y un plan mensual, y la del trial va en días.
2. **No toca nada de billing.** `DEC-GRANT-003` implicación 4: *«el §34.1 no toca al proveedor:
   durante el trial la cortesía extiende el trial, que es nuestro»*. Tampoco puede ser un
   `courtesy_grant`: su suscripción no es anulable (`B/02:515`), y un trial no tiene suscripción.
3. **La máquina ya la prevé**: `T4` tiene como evento *«promo de extensión **o cortesía**»*
   (`V/03:54`). Pero su efecto sólo dice por dónde llega la promo (`extenderTrial`).
4. **`extenderTrial` está definida para el canje** (contrato §4.1): llega con la clave de canje,
   el techo ya aplicado, y billing gasta el código sólo con `ACEPTADA`. No lleva quién firmó ni
   ninguna forma de saltear el techo.
5. **Lo que el diseño no dice**: en qué épica vive la acción, quién la construye, y si pasa por
   el contrato.

**Opciones:**

1. **Acción de verticales sobre su propia máquina, fuera del contrato.** La fila *«extender un
   trial»* de `NUCLEO/08` §3 corre `T4` con origen `SUPER_ADMIN` y motivo obligatorio, pasa el
   techo y se suma al total acumulado con su origen (`V/11` §3.5). La construye **V4**, dueña de la
   máquina de trial, con permiso propio y auditoría.
   - **Costo**: la fila de `NUCLEO/08` §3 (cita §34.1 y `V/11` §3.4), el efecto de `T4` en
     `V/03:54`, una línea en `V/11` §3.4, el criterio de V4 en `V/descomposicion.md`, y que
     `B/14` §4.5 diga que no es de billing.
   - **Riesgo**: la palabra *«cortesía»* queda repartida en dos épicas. La temporal, en meses,
     es de billing; la del trial, en días, es de verticales. Un panel que liste *«lo que regaló
     `SUPER_ADMIN»`* lee de dos lados.
   - **Impacto**: ninguno en el contrato ni en `DEC-ARCH-006`. `extenderTrial` sigue siendo la
     única escritura de billing en verticales, y sólo para el canje.
2. **Acción de billing que pasa por `extenderTrial` con un parámetro de origen.** La acción
   *«otorgar una cortesía»* de billing mira si el beneficiario está en trial. Si lo está, llama a
   `extenderTrial(user, vertical, días, clave, origen)`, y con `origen = SUPER_ADMIN` verticales
   saltea el techo.
   - **Costo**: cambia la firma del contrato §4.1 que `G4-2` acaba de fijar, la implicación 5 de
     `DEC-ARCH-006` (propuesta al log), `B/14` §4.5 y §4.7, la unidad `B9` y el criterio de V4. La
     clave de canje deja de ser la única fuente de idempotencia.
   - **Riesgo**: **el techo se saltea porque lo dice un parámetro que viene del otro lado**.
     Verticales no ve al actor, así que cualquier llamador de billing que ponga
     `origen = SUPER_ADMIN` pasa el techo. Para cerrarlo, el actor tendría que cruzar el contrato.
   - **Impacto**: contrato §4.1, `DEC-ARCH-006`, `B/14`, `B9`, `V4`, `V/03` `T4`.
3. *(variante de la 1)* **La 1, con un solo botón en Admin.** La capa de composición (contrato
   §4.1, abajo) muestra *«otorgar cortesía»* y, si el beneficiario está en trial, llama a la acción
   de verticales. La acción es la de la 1. Lo único que cambia es la superficie.
   - **Costo**: la 1, más una línea en la capa de composición.
   - **Riesgo**: el de la 1.
   - **Impacto**: el de la 1, más `B/19` / `V/19` si se quiere el botón único.

**Recomendación: la 1.** No agrega mecanismo: el evento ya está en `T4`, la fila de trial es de
verticales y `DEC-GRANT-003` impl. 4 dice que el trial *«es nuestro»* y no toca al proveedor.
Deja el contrato como lo dejó `G4-2`, con una sola escritura y sin un techo que se pueda saltear
por parámetro. Y quien responde por el día regalado (`V/11` §3.4) queda registrado donde vive el
techo. La 3 es la misma decisión, más cómoda para quien administra, y se puede sumar después.

**Ejemplo.** Juan está en el día 10 de su trial de Gastronomía. Ya canjeó un *+15* y llegó al
techo de 30. Una caída nuestra le comió tres días, y soporte le quiere regalar 5.

- **Con la 1**: un `SUPER_ADMIN` usa *«extender un trial»* en Admin y escribe el motivo. Verticales
  corre `T4` con origen `SUPER_ADMIN`, pasa el techo y en *Mi Suscripción* Juan ve *«35 días: 30
  por promo y techo, 5 de cortesía»*. Billing no se entera.
- **Con la 2**: el `SUPER_ADMIN` usa *«otorgar cortesía»* en billing. Billing ve que Juan está en
  trial y llama `extenderTrial(Juan, gastronomía, 5, clave, SUPER_ADMIN)`. Verticales pasa el techo
  porque se lo dice billing.

**La otra posición, honesta**: `DEC-GRANT-003` impl. 4 habla de *«dos implementaciones según el
estado del beneficiario»*, o sea de **una** cortesía con dos implementaciones, y las cortesías son
de billing (§34, `B/14`). La 2 respeta esa lectura: quien administra no tiene que saber si Juan
está en trial para regalarle algo. La 3 recoge ese argumento en la superficie sin mover el
contrato.

## 4. Residuos y verificación

1. **`S27` y `S18` se contradicen en `B/03`, y no lo toqué.** La fila de `S18` (`B/03:164`)
   nombra a `S27` en su segundo evento (*«o porque se discontinuó su vertical estando suspendida
   (`S27`; FASE 8 completa, `F-8CB1-002`)»*) y en su `desde` (la sucesora en `CANCEL_SCHEDULED`
   por la misma discontinuación). Pero el párrafo del conteo (`B/03:480-497`) dice *«las que faltan
   siguen siendo `S13` y `S27`»* y *«En `S27` el segundo evento de `S18` no la nombra»*. Si manda
   la fila, **`S18` corre en NUEVE de las diez** y la única que falta es `S13`. Además, los
   *«siete caminos»* de `:518` y `:618` pasan a ocho. Dejé el conteo con el criterio del párrafo
   (faltan `S13` y `S27`), porque corregirlo es razonar el caso de `S27`, y el párrafo dice que
   *«este § no razona todavía ese caso»*. Es trabajo sin decisión si la fila es la vigente.
2. **`S36` no figura en la salvedad 4 de `B/09` §3.** Su fila cancela el preapproval con la regla
   de relectura y el correo antes de la llamada, igual que `S23`, `S24` y `S31`. Pero la lista de
   `B/03:286` (*«trece de la salvedad 4»*) no la nombra. No es de este encargo: queda para quien
   aplicó `G5-4`.
3. **Enumeraciones de *«se muere sola»* fuera del alcance de M**: `B/09:346` (una cita, con
   `S13`), `NUCLEO/04:200` (*«por `S12` o por `S16`»*, histórica) y `B/12:143`. No son conteos de
   la tabla, así que no las toqué.

**markdownlint** (`npx markdownlint-cli2`) sobre `B/03`, `B/02`, `B/12`, `B/20`,
`D/12-contrato-de-cobertura.md` y este registro: exit 0.

## Key Learnings

1. Una tabla que numera las salidas de un conjunto y un párrafo que cuenta quién dispara una
   transición se desalinean en silencio. El párrafo de *«cinco caminos»* ya estaba mal antes de
   `S36`, porque `S24` se había sumado a la fila de `S18` sin sumarse a la cuenta.
2. Antes de recontar, hay que leer la fila de la transición contra su párrafo. La fila de `S18`
   nombra a `S27` y el párrafo dice que no. El número *«correcto»* depende de cuál de los dos
   manda.
3. Un detector de *«lo que no corrió»* condicionado a un estado sólo deja un hueco si el acto
   que se omitió no deja otra huella. El fallo del `PUT` de `S9` ya abre `PAUSA_NO_APLICADA`, así
   que el hueco de P1 se reduce a un proceso caído.
4. *«Cortesía durante el trial»*, *«extensión firmada por `SUPER_ADMIN`»* y *«extender un trial»*
   son el mismo acto con tres nombres en tres capítulos. La pregunta abierta no es cuántos actos
   son, sino de qué épica es ese acto.
