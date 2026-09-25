---
title: "FASE 8 completa · el consolidado de los 133 hallazgos"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa — el consolidado

Nueve agentes adversariales (Opus, `DEC-METH-014`) atacaron el diseño vigente el 2026-09-24:
el núcleo, las dos épicas y el contrato de cobertura. Trabajaron **ciegos entre sí y ciegos del
historial**: no leyeron `14-`…`23-` ni los rastros. Ninguno escribió código ni tocó un archivo que
no fuera su informe.

Este documento no repite los hallazgos: los **agrupa por causa**. La convergencia entre agentes
ciegos es la señal de severidad.

> **Lo que este documento NO hace.** No propone soluciones y no decide nada. Qué racimo se arregla
> y cuál se declara con causa lo decide el owner, racimo por racimo. El tope de dos vueltas de
> `DEC-METH-013` empieza a contar **después** de esta revisión.

---

## 1. Los números, recontados

Contados con script sobre los nueve archivos, no a mano.

| informe | vector | hallazgos | CRÍT | ALTA | MEDIA | BAJA | piden al owner |
|---|---|---|---|---|---|---|---|
| `A1` | acceso cruzado y autorización | 14 | 1 | 6 | 6 | 1 | 2 |
| `A2` | máquinas, carreras y huérfanos | 17 | 4 | 6 | 6 | 1 | 6 |
| `A3` | datos, migración y acoplamiento | 13 | 2 | 5 | 5 | 1 | 1 |
| `B1` | doble cobro y pérdida de pago | 18 | 1 | 7 | 8 | 2 | 6 |
| `B2` | máquinas, idempotencia y carreras | 14 | 2 | 5 | 5 | 2 | 3 |
| `B3` | conciliación, datos y migración | 19 | 2 | 5 | 8 | 4 | 3 |
| `C1` | la costura | 13 | 1 | 5 | 5 | 2 | 4 |
| `C2` | liberación, coexistencia y migración | 9 | 2 | 2 | 4 | 1 | 1 |
| `D1` | coherencia del conjunto | 16 | 0 | 4 | 6 | 6 | 2 |
| | **total** | **133** | **15** | **45** | **53** | **20** | **28** |

**Contra la primera FASE 8** (141 hallazgos, 48 críticos): el total bajó poco, **los críticos
bajaron a menos de un tercio**. Los críticos de hoy no son los de entonces: ninguno reabre
un mecanismo que la FASE 9 cerró. Cambió la forma del defecto (§3).

**Las citas se verificaron con script.** De las 323 citas con bloque textual, 317 aparecen literalmente
en el archivo citado; las 6 restantes se revisaron a mano y **también existen** (un link markdown
o un salto de línea dentro de la cita, o dos pasajes pegados). **Ninguna cita inventada.**

**Dos hallazgos de registro verificados por el orquestador antes de consolidar**, porque tocan
la regla «la matriz manda»:

- `06-mp-validation-matrix.md:197` (`GR-3`) sigue diciendo que la sonda 49 *«está bloqueada»* y
  que *«ventana de 24 h»* y *«ventana de un ciclo»* son indistinguibles; `RC-7` (:276) repite
  *«Sigue sin saberse si las 24 h son fijas o son el ciclo»*. **La medición del 24/09 (48,0 h
  sobre ciclo de 2 días) no llegó a la matriz.**
- El log tiene **dos IDs duplicados**: `DEC-ARCH-008` y `DEC-ENT-002`. El «111 decisiones» cuenta
  encabezados; los IDs únicos son **109**.

---

## 2. Los racimos

Un racimo es un conjunto de hallazgos con **una sola causa**. Van ordenados por lo que está en
juego: plata primero, después contenido, después acceso, después registro. La columna
**agentes** cuenta cuántos vectores ciegos llegaron a la misma causa.

| racimo | causa | CRÍT | agentes | en juego |
|---|---|---|---|---|
| **R1** | el grace de tarjeta no arranca, y su base no está en la matriz | 2 | 4 | plata |
| **R2** | el corte es ciego a lo que vive sólo en el proveedor | 3 | 3 | plata |
| **R3** | `S6` contra el cobro en vuelo y contra la sucesión | 0 | 4 | plata |
| **R4** | cortesía y pausa valen lo que cruzan, no lo que prometen | 1 | 4 | plata |
| **R5** | el correo bloquea la cancelación de la predecesora | 1 | 2 | plata |
| **R6** | promos y addons sin ciclo de vida | 1 | 3 | plata |
| **R7** | la conciliación ve y no puede escribir, ni salir | 0 | 3 | plata |
| **R8** | el cambio de plan: quién decide la dirección, y el grace | 0 | 4 | plata |
| **R9** | el reloj de `inactiva_desde` borra contenido | 3 | 4 | contenido |
| **R10** | la cobertura cambia y verticales no se entera | 1 | 3 | contenido |
| **R11** | discontinuar una vertical no apaga la cobertura | 1 | 2 | acceso |
| **R12** | el trial se quema sin pago y el addon suma sobre él | 0 | 4 | acceso |
| **R13** | la presencia de Partner no tiene máquina | 0 | 3 | acceso |
| **R14** | los cupos se cuentan sin serializar | 0 | 2 | acceso |
| — | dos críticos sin convergencia | 2 | 1 | acceso / contenido |
| — | registro: conteos, referencias, textos vencidos | 0 | — | registro |

Críticos: 2 + 3 + 1 + 1 + 1 + 3 + 1 + 1 + 2 = **15**, igual al conteo del §1.

### R1 · El grace del pagador con tarjeta no arranca, y su base no está en la matriz — 2 CRÍT, 4 agentes

`B/12` §1.2-1.3 hace arrancar el grace cuando el proveedor *«deja de reintentar»*. `GR-3`
(`VERIFIED`) mide que ese instante no emite evento y que la pausa del proveedor cae 80-105 s
**antes**. Por eso `S4` no tiene disparador y `S6` salta directo desde `ACTIVE`, sin grace ni avisos.
Con la otra lectura posible (grace desde el primer rechazo), el moroso usa un ciclo entero, un año
en el anual. Y la regla que lo sostiene (`DEC-SUB-019`, *«grace < ciclo»*) se apoya en la sonda 49,
que la matriz registra bloqueada.

- `F-8CB2-002` CRÍT · `F-8CB3-002` CRÍT · `F-8CB1-006` · `F-8CB2-007` · `F-8CD1-001` · `F-8CB3-012` ·
  `F-8CB1-018` · `F-8CB2-013`

### R2 · El corte es ciego a lo que vive sólo en el proveedor — 3 CRÍT, 3 agentes

El censo del corte se midió sobre `billing_subscriptions`. No ve los `preapproval_plan` del sistema
viejo, cuyos links públicos siguen vendiendo porque `DEC-MP-007` los sacó del diseño nuevo y nadie
los archiva. Tampoco ve los checkouts sin vincular ni los sujetos de sonda: la matriz cuenta 108
preapprovals en producción contra 8 filas locales. Todo cobro que entra por ahí llega como
desconocido y se re-vincula a la suscripción nueva: *«pagó dos veces y el sistema registra una»*
(`B/21` §2.5). Además, el paso irreversible del corte va antes de los que pueden fallar, y nadie es
dueño del rollback.

- `F-8CB3-001` CRÍT · `F-8CC2-001` CRÍT · `F-8CC2-002` CRÍT · `F-8CB3-008` · `F-8CB3-014` ·
  `F-8CA3-007` · `F-8CC2-004` · `F-8CC2-005` · `F-8CC2-007` · `F-8CC2-008`

### R3 · `S6` contra el cobro en vuelo y contra la sucesión — 4 agentes

Desde `DEC-SUB-019`, `S6` cancela el preapproval. Un reintento que ya estaba en vuelo entra, `S7`
reactiva la fila sobre un preapproval cancelado y el espejo la pasa a `CANCELLED` al día
siguiente: **Juan pagó el período y se queda sin servicio, sin marca de devolución.** A eso se
suman tres problemas de la misma zona:

- `B/03` §4 (prosa) y la fila `S6` (tabla) dicen cosas distintas sobre si `S6` corre durante una
  sucesión. Una de las dos lecturas da servicio infinito redeclarando una sucesión cada 72 h.
- El suspendido con tarjeta no tiene cómo volver, porque `G-R1-A` prohíbe la sucesión desde
  `SUSPENDED`.
- *«Todavía no se sabe»* bloquea `S6` sin límite.

- `F-8CB1-003` · `F-8CB2-004` · `F-8CD1-004` · `F-8CB1-005` · `F-8CB2-008` · `F-8CB1-002` ·
  `F-8CB2-009` · `F-8CB3-004`

### R4 · Cortesía y pausa valen lo que cruzan, no lo que prometen — 1 CRÍT, 4 agentes

La cortesía se implementa pausando. El proveedor saltea ciclos enteros en pausa (`PS-6`) y no mueve
la fecha al reanudar (`PS-5`), así que una cortesía de 30 días regala cero días o un ciclo entero
(casi un año en el anual). `S9` no pasa por `puedePausar()`. Hay tres casos más del mismo mecanismo:

- una pausa aceptada y no aplicada se espeja como reanudación;
- la pausa pedida por el cliente sigue cobrando sus addons recurrentes;
- `S13` y `S17` cortan una pausa sin escribir `fin_real`.

- `F-8CB1-001` CRÍT · `F-8CB2-003` · `F-8CC1-004` · `F-8CD1-007`

### R5 · El correo bloquea la cancelación de la predecesora — 1 CRÍT, 2 agentes

`DEC-MAIL-001` exige que salga nuestro correo antes de cancelar. `NUCLEO/07` §4.2 suprime para
siempre un destinatario con rebote duro. Entonces la predecesora de un cambio de plan nunca se
cancela y **cobran las dos**, sin detector. La condición no figura en ninguna transición.

- `F-8CB2-001` CRÍT · `F-8CD1-006`

### R6 · Promos y addons sin ciclo de vida — 1 CRÍT, 3 agentes

- Un addon recurrente de alcance `LISTING` sobrevive a la muerte de la principal y sigue cobrando
  (su orfandad sólo se define como *«la ficha se borró»*).
- Las promos de *«primer cobro»* y de *«N cobros»* no tienen contador ni fin.
- El addon de única vez no tiene mecanismo de cobro, idempotencia medida ni fila donde registrarse.
- `addon_version` no tiene entidad madre.

- `F-8CA2-003` CRÍT · `F-8CB1-007` · `F-8CB1-008` · `F-8CA3-011` · `F-8CB1-016` · `F-8CA1-008`

### R7 · La conciliación ve y no puede escribir, ni salir — 3 agentes

- El barrido detecta un cobro aprobado que no tenemos, pero no tiene camino para escribirlo, y
  `C6` descarta la aprobación de un reintento.
- El período de un cobro sale de `next_payment_date`, que el proveedor mueve solo.
- Nada avisa si el barrido deja de correr.
- La excepción de `D17` y la recuperación tras timeout usan un `search` que en producción devuelve un
  subconjunto (`RC-1`).
- El comprobante no tiene emisor.

- `F-8CB3-003` · `F-8CB3-005` · `F-8CB3-006` · `F-8CB3-007` · `F-8CB3-009` · `F-8CB3-010` ·
  `F-8CB3-011` · `F-8CB2-014` · `F-8CB1-014` · `F-8CB1-011` · `F-8CB1-012` · `F-8CB1-013` ·
  `F-8CB1-015`

### R8 · El cambio de plan: quién decide la dirección, y qué pasa en grace — 4 agentes

`DEC-SUB-003` (vigente) promete *«cobro inmediato»* y *«si falla, sigue en grace»*. La sucesión
(`D8`, `B/12` §5.2) cobra después de la ventana: si ese primer cobro falla, la vieja ya está
`CANCELLED` y Juan queda sin nada. Además hay dos dueños de la dirección del cambio: el `rank` según
`V/10` y el veredicto según `DEC-ARCH-008` y el contrato. Y *«está pagando las dos»* es falso
durante la doble emisión, porque la sucesora ya se llevó el crédito.

- `F-8CD1-002` · `F-8CB1-009` · `F-8CD1-003` · `F-8CC1-013` · `F-8CA1-012` · `F-8CC1-007` ·
  `F-8CB1-004` · `F-8CC1-010`

### R9 · El reloj de `inactiva_desde` borra contenido — 3 CRÍT, 4 agentes

La columna sólo la escriben los hechos que reinician el reloj (`PB2` tiene prohibido escribirla y
`G-R6-B` la vigila), así que mide desde el último reinicio y no desde la pérdida de cobertura. **Una
pausa legítima de 120 días borra el contenido al día 91 de la caída.** `D16` y `G-R5` vigilan
`120 < 180` cuando la cuenta real es `120 + 90 < 180`. El diseño ya lo había arreglado sólo para la
discontinuación. Y el corte no dice con qué valor nace la columna en las fichas existentes: el
único que la lista admite es `created_at`, que manda al hard delete, en la primera corrida, a toda
ficha de más de 180 días.

- `F-8CA2-001` CRÍT · `F-8CA3-001` CRÍT · `F-8CA3-002` CRÍT · `F-8CC2-003` · `F-8CA2-008` ·
  `F-8CA2-014` · `F-8CD1-009` · `F-8CA3-009`

### R10 · La cobertura cambia y verticales no se entera — 1 CRÍT, 3 agentes

El contrato define bien qué es estar cubierto, pero no cuándo se entera verticales. Falta el mapa de
qué transiciones emiten el aviso, su durabilidad, y un emisor para cuando vence una fecha sin
transición. Las relecturas de respaldo existen sólo para los actos que **quitan** (`PB4`, `PB5`,
día 180), nunca para los que **devuelven** (`PB3`, `PB7`). Con un aviso perdido, la ficha de un
cliente que paga queda abajo para siempre.

- `F-8CA2-002` CRÍT · `F-8CC1-005` · `F-8CA1-007` · `F-8CC1-009` · `F-8CC1-011` · `F-8CA2-015` ·
  `F-8CA1-009` · `F-8CC1-008` · `F-8CA2-016`

### R11 · Discontinuar una vertical no apaga la cobertura — 1 CRÍT, 2 agentes

El estado de la vertical viaja sólo hacia billing. El contrato no lo consulta y `T1` no mira
`admite_altas`, así que grants, cortesías y trials nuevos siguen cubriendo después del fin de
servicio. `PB2` no puede disparar, porque para esa gente `cubierto` nunca pasa a falso.

- `F-8CC1-001` CRÍT · `F-8CA2-007`

### R12 · El trial se quema sin pago y el addon suma sobre él — 4 agentes

- `ACTIVE` cuenta como título antes de cualquier pago. Un alta cuyo primer cobro se rechaza 26-44
  minutos después ya quemó el trial para siempre.
- El primer rechazo lo reclaman tres filas (`S4`, `S16`, el espejo), y el orden de llegada decide
  entre tres destinos.
- `V/11` §5.3 y `V/15` §2.6 pliegan distinto un addon `USER`/`GLOBAL` sobre un trial, y la regla de
  `V/11` no tiene guard.

- `F-8CA2-006` · `F-8CC1-002` · `F-8CB2-006` · `F-8CB1-010` · `F-8CA1-004` · `F-8CA2-011` ·
  `F-8CC1-006` · `F-8CA2-013` · `F-8CA3-003` · `F-8CA3-008`

### R13 · La presencia de Partner no tiene máquina — 3 agentes

`V/18` y `V/19` se remiten la definición el uno al otro. No hay entidad, máquina ni reloj de
retención: **un Gold que deja de pagar sigue publicado.** Además, `T7` no alcanza a los partners
del camino B, y el 410 del código de hoy contradice la regla de indistinguibilidad.

- `F-8CA1-005` · `F-8CA2-005` · `F-8CA3-006` · `F-8CA2-012` · `F-8CA1-014`

### R14 · Los cupos se cuentan sin serializar — 2 agentes

Contar y después escribir, sin lock: dos `PB1` concurrentes superan cualquier cupo, incluido el
invariante *«una sola ficha en trial»*. El reconciliador no se entera, porque se dispara por cambios
del conjunto efectivo y no del conteo. La carrera `PB1` contra `PB2` deja una ficha pública gratis
hasta 90 días. **La única regla de concurrencia del programa vive en `B/05`**, y verticales no tiene
ninguna.

- `F-8CA1-006` · `F-8CA2-010` · `F-8CA2-009`

### Dos críticos sin convergencia

- **`F-8CA1-001`: la vertical declarada no se compara con la del recurso.** Con Alojamiento pago,
  Juan publica una ficha de Gastronomía declarando que es de Alojamiento. Queda publicada gratis, y
  como editar la ficha reinicia el reloj de `PB4`, nunca se archiva.
- **`F-8CA2-004`: la baja por moderación y el borrado de una ficha no tienen transición en
  `PB1`-`PB8`.** Desde `DEC-TRIAL-005`, la moderación reactiva es el único control de contenido y
  queda inejecutable.

Un solo agente no es señal débil cuando la cita es literal y el camino es corto. Los dos se
verificaron contra el texto.

### Resto: acceso fino y registro

Los que no entran en un racimo de causa:

- **Acceso fino**: `F-8CA1-002`, `F-8CA1-003`, `F-8CA1-010`, `F-8CA1-011`, `F-8CA1-013`,
  `F-8CA3-004`, `F-8CA3-005`, `F-8CA3-010`, `F-8CC1-003`.
- **Resto de billing**: `F-8CB2-005` (cuota `AWAITING` huérfana), `F-8CB2-010`, `F-8CB2-011`,
  `F-8CB2-012`, `F-8CB1-017`, `F-8CB3-015`, `F-8CB3-016`, `F-8CB3-019`, `F-8CD1-005`.
- **Registro**:
  - `F-8CD1-008` (IDs duplicados)
  - `F-8CD1-010` (*fila viva* a medio propagar)
  - `F-8CD1-011` a `F-8CD1-016`
  - `F-8CB3-013`, `F-8CB3-017`, `F-8CB3-018`
  - `F-8CA3-012`, `F-8CA3-013`
  - `F-8CC2-006`, `F-8CC2-009`
  - `F-8CC1-012`
  - `F-8CA2-017`

---

## 3. La forma del defecto cambió

Los nueve agentes, sin verse, describen la misma forma en sus *Key Learnings*:

1. **La regla vieja sobrevive en el lugar viejo.** Los cuatro `ALTA` de `D1` son eso. `R1`, `R3` y
   `R8` también: `B/12` §1.2-1.3 se escribió con `GR-3` en `UNKNOWN`, y `DEC-SUB-003` antes de la
   sucesión.
2. **La prosa contra la tabla.** Reglas que viven en el log o en un párrafo (el correo antes de
   cancelar, `S6` en sucesión, el corte del addon en trial) no están en la tabla de transiciones ni
   en el guard. Por la regla 1 del núcleo, quedan inaplicables o admiten dos lecturas.
3. **Lo que ocurre en el proveedor contra lo que nos enteramos.** Garantías escritas sobre el
   instante del proveedor, ejecutadas al recibir el webhook (`R3`, `R8`, `R10`).
4. **El censo lee sólo nuestra base** (`R2`, `F-8CA3-012`).
5. **La matriz no registró lo medido el 24/09** (sonda 49, lotes del minuto `:02`, `RN-3`), que es
   justo lo que citan las decisiones de ese día.

---

## 4. Fuera de diseño: un aviso operativo de hoy

`C2` señala que las **tres filas `abandoned`** de producción tienen fin de trial el **26 y 27/09**.
Por el mecanismo de `F-8CC2-002`, alguna podría tener una autorización viva sin vincular del lado del
proveedor. **Consultarlo es una lectura `GET` sobre producción y lo decide el owner.** Nadie la
ejecutó.
