---
title: Worklog / Progress Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-17
status: CURRENT
---

# Worklog

Registro cronológico exigido por el [PDR](./00-PDR.md) §3.2. Tiene que poder responder, en
cualquier momento: **"¿Qué hicimos hasta ahora y por qué?"**

Se escribe hacia abajo. Nada se edita retroactivamente: si algo resultó estar mal, se agrega
una entrada nueva que lo diga.

---

## 2026-09-15 — Reset del programa

### Qué pasó

Una pasada anterior de este mismo programa produjo análisis, decisiones y mediciones que
resultaron **contaminados**: parte de su fundamento venía de fuentes que el §0 prohíbe
explícitamente usar como tales — comportamiento legacy, documentación obsoleta,
implementaciones actuales, memoria de sesiones previas y suposiciones sobre Mercado Pago.

El caso que lo destapó: se le atribuyó al PDR una afirmación que el PDR **no hace**. Eso es
peor que usar información vieja, porque falsifica el origen de la afirmación y la vuelve
irrastreable: quien la lea después no tiene forma de saber que hay que verificarla.

Una auditoría posterior encontró que el problema no era aislado. Había citas a secciones del
PDR que decían otra cosa, decisiones apoyadas en artefactos preexistentes leídos como estado
actual, y conteos que no reproducían.

### Qué se decidió

**Reset total** (`DEC-METH-001`): el único documento que sobrevive es
[`00-PDR.md`](./00-PDR.md). Todo lo demás se rehace desde cero.

El owner eligió esta opción por sobre dos alternativas menos drásticas (conservar las
decisiones ya tomadas, o conservar además los hechos ya medidos). El motivo: **cero
herencia**, ni siquiera un resultado medido por una sesión contaminada.

### Qué se hizo

1. **Verificación de integridad del PDR.** Se comprobó contra el historial de git que
   `00-PDR.md` fue introducido por un único commit y que su contenido no fue modificado desde
   entonces. Sigue siendo verbatim.
2. **Borrado** de todos los demás documentos del programa, incluidas las sondas de Mercado
   Pago. No se archivaron ni se marcaron como históricos: se eliminaron. Un documento marcado
   `LEGACY` que queda a mano vuelve a contaminar, y §3.5 advierte justamente sobre *"permitir
   que documentación antigua parezca vigente"*.
3. **FASE 0 rehecha** (§65): Decision Log, este Worklog y el Handoff, más el índice del
   programa.
4. **FASE 1A rehecha** (§67): lectura crítica del PDR contra sí mismo, sin mirar código, sin
   consultar documentación del repo, sin tracking y sin memoria.

### Problema de método que queda registrado

Las tres reglas que se agregaron al Decision Log salen directamente de lo que falló:

- Sólo se admiten **tres fuentes** de fundamento: el PDR, una medición propia fechada, o una
  respuesta explícita del owner.
- Si una decisión cita un `§`, **el texto se verifica contra el PDR antes de escribirla**.
- Ningún documento de este programa referencia trabajo anterior. Un enlace a algo previo es un
  defecto, no una fuente.

---

## 2026-09-15 — FASE 0

**Completada.** Los cuatro entregables del §65:

| Documento | Qué es |
|---|---|
| [`00-PDR.md`](./00-PDR.md) | Ya estaba, verbatim, con integridad verificada |
| [`01-decision-log.md`](./01-decision-log.md) | Formato del §3.4, reglas, y `DEC-METH-001` |
| [`02-worklog.md`](./02-worklog.md) | Este archivo |
| [`03-handoff.md`](./03-handoff.md) | Handoff vivo del §3.3 |

Más el índice en [`../spec.md`](../spec.md) con el orden de lectura obligatorio del §66.

**Decisiones tomadas**: una, `DEC-METH-001` (reset total), decidida por el owner.

---

## 2026-09-15 — FASE 1A

**Entregada.** Análisis crítico del dominio en
[`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md).

### Qué se investigó

Únicamente el PDR, leído entero y contra sí mismo. Cada `§` citado se verificó contra el texto
antes de escribirlo.

### Qué se encontró

**101 hallazgos** agrupados por dominio, con ID estable:

| Categoría | Cantidad |
|---|---|
| Contradicciones internas del PDR | 5 |
| Ambigüedades | 13 |
| **Decisiones bloqueantes de FASE 2** | **12** |
| Decisiones abiertas no bloqueantes | 5 |
| Edge cases sin regla | 12 |
| Riesgos | 5 |
| Requisitos aparentemente olvidados | 35 |
| Objeciones | 6 |
| Mejoras sugeridas | 9 |
| Pendientes de validación con Mercado Pago | toda la sección 4 |

De las 12 bloqueantes, **8 las decide el owner** y **4 las decide el experimento** de FASE 1C
— no se pueden responder por conversación porque dependen de hechos del proveedor que §58
exige comprobar.

### Lo más estructural que apareció

- **Los planes**: el PDR nunca dice si son mutables o versionados, y define encima de esa
  respuesta la derivación del Trial Plan, el enforcement de excedentes, los cambios de precio
  y el recálculo de limits.
- **"El plan más premium" no es computable.** §10.3 lo exige y ningún lado define el orden.
- **§9 es inaplicable tal como está escrito**: no se puede evaluar una capacidad sin nombrarla
  en código. Hace falta acotar el principio, o se va a violar en silencio.
- **§7 y §8 no traen criterio para distinguirse.** "Motor único" y "comportamiento específico
  de vertical" son las dos correctas, y sin una regla escrita cualquier divergencia futura se
  justifica sola como Eje 2.
- **La matriz de cambio de plan tiene seis celdas sin política**, porque §27 y §28 definen
  upgrade/downgrade sobre un eje y §18 crea dos.
- **Falta el estado "autorización creada y todavía no completada"**, que el modelo del §5.6
  vuelve estructural: existe siempre, por diseño.
- **Faltan la baja online y el derecho de revocación**, que el PDR no menciona en ningún lado
  y son obligaciones para cobrar por débito automático.

### Experimentos realizados

**Ninguno.** FASE 1C no empezó y no puede empezar antes de que el owner responda 1A. La matriz
de [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) quedó armada con sus **53
filas en `UNKNOWN`**: 42 de la matriz mínima del §60 y 11 agregadas por el propio análisis,
marcadas como agregadas.

### Mediciones realizadas

**Ninguna.** Varias decisiones dependen de cuántos clientes reales hay (`O-MIG-01` señala que
el propio §56 apoya su conclusión en un *"hay pocos customers actuales"* sin número). Medirlo
no rompe ninguna prohibición — §4 permite explícitamente *"ejecutar queries"* e *"inspeccionar
DB"* — pero está cerca de la línea del §67, así que **se preguntó en vez de asumirlo**
(pregunta 24).

### Preguntas abiertas

**25**, en el §16 del análisis. Las 8 primeras son bloqueantes.

### Respuestas del owner

Ninguna todavía.

---

## 2026-09-15 — Cierre de las 8 bloqueantes que decide el owner

Se recorrieron una por una, con alternativas y consecuencias sobre la mesa. **Nueve decisiones
registradas** en [`01-decision-log.md`](./01-decision-log.md).

| Pregunta | Decisión |
|---|---|
| `BD-ARCH-01` planes mutables o versionados | `DEC-ARCH-001` — híbrido: se versiona lo que tiene efecto |
| `BD-ARCH-02` orden entre planes | `DEC-ARCH-002` — rank explícito, sólo los vendibles |
| `C-TRIAL-01` "1 ficha" contra los limits de Basic | `DEC-TRIAL-001` — overrides declarados en DB, por vertical |
| `BD-TRIAL-01` derivación en vivo o congelada | `DEC-TRIAL-002` — trinquete: en vivo, nunca empeora |
| `BD-SUB-01` la matriz tier × ciclo | `DEC-SUB-001` — sube ya, baja espera, el ciclo se aplica ya |
| `C-PARTNER-01` trial de Partner | `DEC-TRIAL-003` — configurable por plan, en cero hoy |
| `BD-MIG-01` qué se le promete a quien paga | `DEC-MIG-001` — coordinación manual de las 5, cero código |
| `BD-TRIAL-02` señal de identidad | `DEC-TRIAL-004` — el email normalizado bloquea, el resto observa |
| `O-METH-02` conteos de producción | `DEC-METH-002` — autorizados, con fecha y método |

### Un cambio de orden, y por qué

`BD-MIG-01` se planteó **después** de medir, no antes. El §56 apoya su preferencia por la
coordinación manual en un *"hay pocos customers actuales"* que el PDR no cuantifica
(`O-MIG-01`), y decidir sobre una premisa sin verificar era repetir el error que motivó el
reset. Así que se adelantó la pregunta 24, se autorizó medir, y recién entonces se preguntó.

### Mediciones realizadas

Tres consultas read-only contra producción, en [`07-facts-inventory.md`](./07-facts-inventory.md).

**La premisa del §56 quedó verificada por goleada**: cero pagos cobrados en la historia del
sistema, **tres** relaciones con compromiso de cobro vivo y dos cortesías. Gastronomía,
experiencia y partner tienen cero filas. El primer trial vence el **2026-09-26**.

### Una decisión que no se puede implementar todavía

`DEC-SUB-001` está tomada pero **condicionada a FASE 1C**: compensar en días requiere correr
la primera fecha de cobro sobre una suscripción ya autorizada, y eso está en `UNKNOWN`
(`EX-7`/`EX-8`). Su plan B ya está declarado, así que si el experimento dice que no, entra
solo y no hay que volver a preguntar.

### Problemas encontrados

Al redactar `DEC-TRIAL-002` apareció una ambigüedad de orden entre el trinquete y los
overrides de `DEC-TRIAL-001`: aplicar el piso antes de los overrides dejaba un agujero por el
que bajar un override degradaba a los trials en curso. Se corrigió en el acto fijando que **el
trinquete se aplica al final, sobre el resultado completo**.

---

## 2026-09-15 — Cierre de las 16 preguntas no bloqueantes

Mismo formato, una por una. **Diecinueve decisiones más**, para un total de **28**.

| Pregunta | Decisión |
|---|---|
| `A-TRIAL-01` publicación inmediata o mediada | `DEC-TRIAL-005` — inmediata: publicar es quedar visible |
| `M-TRIAL-01` trial de Turista | `DEC-TRIAL-006` — sí; el botón `Empezar` del §47 |
| `M-TRIAL-02` estado pre-trial | `DEC-TRIAL-007` — borradores ilimitados, archivado por inactividad |
| `R-TRIAL-01` entitlements caros en trial | `DEC-ENT-001` — todas las funciones, con cuota propia de trial |
| `OD-ENT-01` reset de las cuotas | `DEC-ENT-002` — mensual siempre, sin arrastre |
| `A-ENT-01` alcance de la herencia VIP | `DEC-ENT-003` — entitlements y limits; no puede comprar VIP |
| `A-ENT-01` (b) el VIP previo ya pago | `DEC-ENT-004` — se cancela ya, sin reembolso |
| `C-SUB-01` grace de 10 días | `DEC-SUB-002` — en DB por plan, default 10 |
| `E-SUB-03` cambiar de plan en grace | `DEC-SUB-003` — permitido, es el camino de recuperación |
| `OD-SUB-01` ventana de límites de pausa | `DEC-SUB-004` — por user + vertical |
| `E-ADDON-01`/`02` addon sobre ficha borrada o despublicada | `DEC-ADDON-001` — se pierde con la ficha; el reloj no se congela |
| `M-PROMO-01` cupo de un promo code | `DEC-PROMO-001` — cupo total + ventana de validez |
| `OD-PROMO-01` scope "verticales futuras" | `DEC-PROMO-002` — permitido sin restricción |
| `M-GRANT-01` Free Forever y el dinero cobrado | `DEC-GRANT-001` — corta ya sin reembolso; revocar no restaura |
| `A-GRANT-01` quién otorga una cortesía | `DEC-GRANT-002` — sólo `SUPER_ADMIN` |
| `C-DATA-01` retención a los 90 y 180 días | `DEC-DATA-001` — oculto del público, visible al dueño, dos avisos |
| `O-LEGAL-01` comprobante no fiscal | `DEC-LEGAL-001` — confirmado, sin fecha ni disparador |
| `O-METH-03` criterio de FASE 5 | `DEC-METH-003` — se define al empezar FASE 5, y es su gate |

### Tres apartamientos declarados del PDR

No son errores: son decisiones conscientes que se apartan del texto, registradas como tales
porque el PDR no se edita (§3.1).

- **`DEC-ENT-001`** contra el §10.3, que dice *"exactamente los entitlements del plan más
  premium"*: los medidos llevan cuota propia de trial.
- **`DEC-GRANT-002`** contra el §34, que dice *"Admin puede otorgar"*: la cortesía temporal
  pasa a ser exclusiva de `SUPER_ADMIN`, para que una cortesía sin tope no sea un Free Forever
  otorgado por quien no podía otorgarlo.
- **`DEC-LEGAL-001`** deja explícito que *"cuando entre ARCA"* no es un disparador y que nada
  va a avisar.

### Dos decisiones tomadas contra la recomendación

Con su riesgo declarado, no re-litigadas:

- **`DEC-ENT-004`** y **`DEC-GRANT-001`** — cancelar sin reembolso. Hoy el monto es un mes
  parcial porque todas las suscripciones vivas son mensuales (medido). Anotadas para revisar
  el día que exista un ciclo anual.

### Tres hallazgos nuevos, residuo de decisiones tomadas

- **`E-TRIAL-04`** — con publicación inmediata toda moderación es reactiva, y bajar una ficha
  ya publicada no devuelve el trial (§10.2).
- **`E-ENT-01`** — qué pasa con los beneficios de turista heredados cuando el plan comercial
  se suspende.
- **`E-SUB-05`** — cómo se compensan días sobre una suscripción que está en deuda.

### Dos cosas que se cerraron solas

- **`E-TRIAL-01`** quedó **disuelto** por `DEC-TRIAL-005`: sin revisión previa no hay rechazo
  posterior.
- **`R-DATA-01`** quedó **resuelto** por `DEC-DATA-001`: los dos avisos tapan el silencio entre
  el `+60` de la campaña y el día 90.

### Una corrección de método, en el momento

Al redactar `DEC-TRIAL-002` apareció una ambigüedad de orden entre el trinquete y los overrides
de `DEC-TRIAL-001`. Se corrigió fijando que el trinquete se aplica **al final, sobre el
resultado completo**: aplicarlo antes dejaba un agujero por el que bajar un override degradaba
a los trials en curso.

---

## 2026-09-15 — FASE 1C, sondas 01 a 03

**21 de 55 filas medidas.** El owner entregó las credenciales del sandbox; quedaron **fuera del
repo**, leídas por entorno, y ningún script las contiene.

Se consiguió **autorizar por API con un `card_token`**, sin navegador, lo que destrabó todo el
bloque post-autorización sin depender de un flujo manual.

### El hallazgo que atraviesa todo lo demás

**Mercado Pago acepta cambios que no aplica, y responde `2xx`.** Cuatro casos medidos: el campo
`items` al crear, dos intentos aislados de cambiar `frequency`, y un token de tarjeta guardada
que se genera con `201` y después no sirve.

**Un `2xx` no prueba que el cambio se haya aplicado.** Toda mutación exige relectura y
comparación campo por campo. Es la regla que más va a pesar en el diseño del reconciliador.

### Lo que cambió una decisión ya tomada

`EX-4` salió `NOT_SUPPORTED`: el ciclo de una suscripción autorizada no se puede mutar. Eso
dejó a **`DEC-SUB-001` sin mecanismo**.

En vez de re-decidir ahí mismo, **se midió lo que elegía entre las dos salidas posibles**
(sonda 03): recrear la suscripción **no exige recargar la tarjeta, sólo el código de
seguridad**. Con ese dato, `DEC-SUB-005` mantuvo la política intacta y reemplazó sólo el
mecanismo.

Decidir antes de medir habría sido repetir el error que motivó el reset.

### Otras dos bloqueantes quedaron decidibles

- **`BD-MP-03`**: `PC-1` y `PC-3` `VERIFIED` — el monto de una autorizada se muta **sin nuevo
  consentimiento** del proveedor.
- **`BD-MP-04`**: `EX-5` `NOT_SUPPORTED` — una autorización cubre **un solo monto**.

### Dos defectos del proveedor que condicionan el diseño

- **`/preapproval/search` ignora `external_reference` en silencio** (111 resultados con
  cualquier valor), y ése es nuestro único vínculo con el dominio. Hay que guardar el id del
  proveedor y leer por `GET`. En `/v1/payments/search` el mismo filtro **sí** funciona.
- **El piso es ARS 15**: una cortesía "sin cobrar" bajando el monto no existe.

### Lo que no se pudo medir, y por qué

Renovaciones, grace y efectos reales de la pausa necesitan **que pase tiempo** — la pausa de la
sonda duró 1,3 segundos y de eso **no se concluye nada** sobre §26.4. Webhooks necesitan **un
endpoint público**. Reembolsos y los correos del proveedor siguen sin probarse.

---

## 2026-09-15 — FASE 1C: el reloj, y tres conteos que mentían

Sin credenciales en el entorno de esta sesión no se pudo medir nada nuevo. Se hizo lo que no
dependía de ellas.

### Se corrigieron tres afirmaciones falsas en los propios documentos del programa

Las mediciones de webhooks (`WH-1`, `WH-4`, `EX-2`) entraron a la matriz **sin actualizar sus
totales**, así que tres documentos afirmaban un estado que la propia matriz desmentía:

| Documento | Decía | Es |
|---|---|---|
| `06-mp-validation-matrix.md` (cabecera y resumen) | 5 parciales, 32 `UNKNOWN`, "tres casos" del §0 | **8** parciales, **29** `UNKNOWN`, **cinco** casos |
| `03-handoff.md` | "21 de 55 filas medidas", 5 parciales, 32 `UNKNOWN` | **26 de 55**, 8 parciales, 29 `UNKNOWN` |
| `04-open-decisions.md` | "hoy **las 53 filas** dicen `UNKNOWN`" (dos veces) | 29 de **55**, y `BD-MP-03`/`BD-MP-04` ya no |

No es contabilidad: la regla 3 del Decision Log y el §61 **prohíben decidir sobre una fila
`UNKNOWN`**. Un documento que dice que las 53 filas están en `UNKNOWN` bloquea dos decisiones
que ya se pueden tomar. El `DEC-SUB-001` del handoff describía además un condicional que
`DEC-SUB-005` ya había reemplazado.

### El atajo para las diecisiete filas que sólo esperan tiempo

`RN-1..3`, `GR-1..3`, `PS-2`/`4`/`5`/`6`, `PA-4`, `EX-1`, `UP-1`/`2`, `DW-1`/`2` y `CT-1`/`3`
no están en `UNKNOWN` por falta de permisos: **esperan que el proveedor ejecute un ciclo**.

La espera no es de un mes. Sale de una medición que ya estaba hecha y que nadie había usado
para esto: al rechazar `frequency_type: "years"`, el proveedor contestó *"valid ones are
`[days, months]`"* (`FR-4`). **Un ciclo diario pone una renovación real a 24 h.**

Eso **no está medido** y no se dio por cierto: que `days` se acepte al crear no prueba que se
guarde ni que se ejecute. Es el primer control de la sonda 05, por relectura, siguiendo el §0.

### Dos sondas nuevas, verificadas en seco

- [`probe-05-arrancar-el-reloj.sh`](./mp-probes/probe-05-arrancar-el-reloj.sh) — crea **siete**
  suscripciones de ciclo diario (una por bloque de filas), deja hechas las mutaciones del día 0
  —bajar el monto, subirlo, llevarlo al piso de ARS 15, pausar— y escribe un manifiesto.
- [`probe-06-leer-el-reloj.sh`](./mp-probes/probe-06-leer-el-reloj.sh) — vuelve a las 24 h,
  48 h y 72 h y reporta el **delta entre dos fotos fechadas**, no el estado. Con `REANUDAR=1`
  toma la foto antes y después de reanudar la pausa: ese par es el que decide el §26.4.

Las dos se corrieron contra un `curl` stubbeado, sin tocar la red. **La corrida en seco
encontró dos defectos que habrían costado un día de calendario cada uno**: una variable con
`Ñ` que bajo `set -u` mataba la sonda después del primer sujeto —seis de siete no se creaban—,
y un `request.json` que guardaba un `card_token_id: null` que nunca se había mandado, o sea
evidencia falsificada.

### Lo que quedó esperando al owner

Cuatro cosas, y ninguna es una decisión de diseño: credenciales en el entorno, una aplicación
de Mercado Pago aparte para pruebas (el webhook es por aplicación y su URL no se cambia por
API), qué credenciales habilitan reembolsos en sandbox, y la casilla del comprador de prueba.

---

## 2026-09-15 — El reloj arrancó, y la sonda 07

El owner cargó las credenciales. **31 de 57 filas medidas** (eran 26 de 55).

### Un supuesto que era falso, y lo corrigió el owner

Se había escrito un guard que exigía que el access token empezara con `TEST-`. **Está mal**:
el modo de pruebas actual de Mercado Pago se arma creando un **usuario vendedor de prueba** y,
bajo él, una aplicación propia, cuyas credenciales empiezan con `APP_USR-` y son
**indistinguibles por su forma** de unas productivas. Ese guard bloqueaba el caso bueno y
habría dejado pasar el malo.

El discriminador real lo da el proveedor: `GET /users/me` → `tags: ["test_user", …]`. El guard
ahora exige ese tag, y además verifica que **comprador y vendedor no sean la misma cuenta**.

### El ciclo diario funciona: el reloj está corriendo

`frequency: 1, frequency_type: "days"` se acepta, se autoriza y **queda así**, verificado por
relectura en los seis sujetos: `authorized`, un cobro al crear, `next_payment_date` al día
siguiente. Siete suscripciones vivas, una por bloque de filas. Se leen con la sonda 06 desde
el 2026-09-16 ~11:30.

### Cuatro mediciones nuevas

- **`PC-2` tiene techo**: el rango real es **ARS 15 a ARS 2.000.000**.
- **`UP-1`/`UP-2` a `PARTIALLY`**: subir el monto queda aplicado en el acto y **no cobra la
  diferencia**; `next_payment_date` no se mueve. Cuánto cobra en el ciclo siguiente lo dice
  el reloj.
- **`PA-4`**: una tarjeta que va a rechazar **no llega a crear la suscripción** (`400
  CC_VAL_433`), porque la validación ocurre antes. Consecuencia incómoda: **no se puede
  fabricar un cobro fallido eligiendo una tarjeta mala**, y `RN-2`/`GR-*` quedaron sin
  mecanismo salvo el intento de `renov-falla3`.
- **`EX-12` `NOT_SUPPORTED`**: un `card_token` sirve para **una sola** suscripción. La primera
  corrida de la sonda 05 tokenizó una vez y reusó: **perdió cinco de siete sujetos**. Importa
  fuera de la sonda, porque todo reintento de creación —y `DEC-SUB-005`— tiene que tokenizar
  de nuevo.

### `EX-11` — qué se puede hacer sobre una suscripción pausada

La sonda 05 devolvió al pasar `400 "You can not modify a paused preapproval."`. El mensaje
sugería mucho más de lo que se había probado, así que se midió con la **sonda 07**, y con
control:

| Sobre el mismo sujeto | |
|---|---|
| cambiar el monto **estando pausada** | `400`, y el monto **no se movió** |
| cambiar el monto **ya reanudada** | `200`, y el monto **cambió** |

El segundo es el control y es lo que hace válida la conclusión: **bloquea el estado, no la
operación**. Y por otro lado, **cancelar una pausada sí funciona**: la pausa no atrapa al
cliente.

Esto abre `E-SUB-06`: un cambio de precio programado (`DEC-MP-001`) que cae sobre una
suscripción pausada **no se puede aplicar en su fecha efectiva**.

### Un `NOT_SUPPORTED` que casi se inventa

El primer intento de la sonda 07 se comió un **`429 local_rate_limited`** justo en el paso que
decidía. Un `429` no dice que la operación esté prohibida: dice que **no llegó a evaluarse**.
Darlo por `NOT_SUPPORTED` habría fabricado una limitación inexistente. La sonda reintenta con
backoff y la conclusión de arriba es de la corrida limpia.

Es el reverso del §0: allá un `2xx` no probaba que algo se aplicara; acá un error no prueba
que algo esté prohibido. **Ningún código de estado, de ninguna familia, alcanza solo.**

---

## 2026-09-15 — Los webhooks dejaron de ser inobservables

El owner repuntó el webhook de la aplicación de prueba a un receptor propio.
**36 de 60 filas medidas.**

### Por qué hizo falta un receptor propio

Medir webhooks contra staging era medir **nuestra interpretación** del
proveedor: la tabla guarda el evento ya normalizado —MP manda
`subscription_authorized_payment` y el log lo llama `invoice.updated`— y **no
guarda headers**, así que la firma no se podía ni mirar. Los túneles no
funcionan desde este entorno. La salida fue un Worker en la cuenta de
Cloudflare del owner, que guarda cada POST tal cual llega.

### Cinco filas cerradas, y dos corrigen supuestos

- **`EX-2` a `VERIFIED`**: el cuerpo trae **`version`**, un contador monótono
  por recurso (5, 9, 11, 12 en orden causal). Lo anterior —"el id del evento
  cambia en cada reentrega, deduplicá por tipo + recurso"— seguía siendo
  cierto, pero se había medido sobre la tabla normalizada de staging, que **no
  guarda este campo**. Con `version` además se puede **descartar un evento
  viejo que llega tarde**, que es lo que `M-CONC-02` pedía.
- **`EX-14` `NOT_SUPPORTED`**: un `payment.created` de la cuenta de prueba
  llega con **`live_mode: true`**. **No se puede distinguir sandbox de
  producción mirando el evento.** Segundo caso del día en que una señal que
  *parece* indicar entorno no lo indica — el primero fue el prefijo `TEST-`.
- **`EX-15` `VERIFIED`**: **mutar el monto NO emite ningún webhook.** 91
  segundos de ventana sin entregas, con la mutación aplicada, y la `version`
  del recurso saltando de 5 a 9: el recurso cambió y el proveedor no avisó.
  Crear, pausar, reanudar y cancelar sí notifican.
- **`EX-13` `PARTIALLY`**: llega `x-signature: ts=…,v1=<hex64>` en todas las
  entregas reales. Falta la clave secreta del panel: hoy la firma se **ve**,
  no se **verifica**.
- **`WH-2` `VERIFIED`**: demoras de **0,6 s a 32 s**, muy variables.

### Lo que esto le hace a `DEC-MP-001`

La decisión dice que un cambio de precio se aplica mutando el monto. Ahora se
sabe que esa operación **puede responder `2xx` sin aplicarse** (§0) **y no
emite ningún evento**. No hay vía de confirmación asincrónica: la única forma
de saber si un aumento se aplicó es **releer y comparar**. No invalida la
decisión —sigue siendo la única que no le pide nada al cliente— pero vuelve la
relectura **obligatoria**.

### Tres defectos de método propios

1. **La marca de tiempo se anotaba al terminar la llamada, no al enviarla.**
   La corría casi un segundo y hacía que un evento posterior a la acción
   apareciera como anterior. Toda la atribución se apoya en esa marca.
2. **La sonda no reintentaba ante `429`.** La corrida de 60 s se comió uno en
   el cambio de monto: la mutación no se aplicó y el paso no pudo afirmar
   nada. Segunda vez en el día.
3. **El lector buscaba la firma en `.eventos[0]`**, que era un POST de prueba
   propio sin firma, e informaba "sin headers de firma" con la firma presente
   en todas las entregas reales. Un falso negativo sobre justo la pregunta que
   el receptor venía a contestar.

Y una lección que costó dos corridas: **para atribuir un evento a una acción
hay que espaciar las acciones más que la demora máxima de entrega**. Con 1,4 s
era imposible; con 20 s seguía siendo ambiguo; con 90 s es una lectura.

---

## 2026-09-16 y 09-17 — FASE 1B, y un hueco de este mismo documento

> **Este worklog no tiene entradas de FASE 1B entre el 2026-09-15 y hoy.** Las hay: son 104
> hallazgos, `F-1B-001` a `F-1B-104`, escritos en
> [`08-phase-1b-code-discovery.md`](./08-phase-1b-code-discovery.md), que hizo de registro.
> No se reconstruyen acá hacia atrás —el §3.2 pide un registro cronológico, no uno inventado
> después— pero queda anotado que **el registro de 1B vive en `08`, no en este archivo**.

### Lo que se cerró el 2026-09-17

Tres carriles, en el orden que pedía el handoff.

**1. La sonda que `F-1B-093` no había podido correr, anda.** Los dos intentos anteriores
fallaron —uno por resolución de módulos de `tsx`, el otro matado por el techo de cinco
minutos—. Escrita como test de vitest dentro de `apps/api`, construye la app con `initApp()`
y vuelca `app.routes` más el documento OpenAPI **en 31 segundos**. Reproduce los seis números
de `F-1B-016` exacto.

Lo que agregó no es el número sino su condición: **los 1.032 handlers se miden con billing sin
inicializar**, y la causa está medida y no inferida — el mock global de `@repo/db` de
`apps/api` no exporta `createBillingAdapter`, el `catch` de `getBillingInstance` se lo traga, y
las dos fábricas de qzpay devuelven routers vacíos. Faltan 48 rutas y todo el webhook de
MercadoPago. `F-1B-105` a `F-1B-108`.

De paso corrigió dos atribuciones: los 9 handlers de billing fuera del contrato **no son de
qzpay** (cinco son un 404 que hospeda registra a propósito), y `createBillingRoutes` declara
**34** registros y no 30.

**2. `apps/api/src/services` quedó en 185 de 185 archivos.** Los 74 que este registro no citaba
—19.654 líneas— se leyeron en siete carriles delegados con contrato de evidencia estricto.
`F-1B-109` a `F-1B-119`.

Dos correcciones a hallazgos anteriores salieron de ahí y se verificaron a mano antes de
escribirlas: de los dos módulos de métricas de billing **sólo uno está montado** (`F-1B-077`
los contaba a los dos, por confundir `routes/metrics/` con `routes/billing/metrics.ts`), y el
segundo puente de reconciliación tiene **12** call sites y no 13 (`F-1B-062` contaba la
declaración).

**3. Qué agregan las 125 migraciones estructurales.** `F-1B-120` a `F-1B-122`. El hallazgo que
cruza con el resto del relevamiento: de las 21 columnas que hospeda le agregó a tablas
`billing_*`, **trece caen sobre tablas que modela qzpay, y las trece son invisibles para sus
mappers de lectura** — verificado leyendo el fuente de qzpay en el ancla, no citando
`F-1B-096`.

### Cómo se trabajó, y qué falló

Siete sub-agentes en paralelo, cada uno con el contrato de evidencia del `08` en el prompt
—`archivo:línea` obligatorio, el docblock no vale como prueba, contar el denominador antes de
recorrerlo, sin juicios— y el contexto ya medido que necesitaban para orientarse.

**Se verificaron a mano las siete afirmaciones más graves antes de escribir ninguna**: el
módulo de métricas no montado, el tamaño del archivo contra su propio docblock, la lectura de
credencial fuera del `try`, los call sites del puente, el `JOIN` ausente de `getSystemUsage`,
los imports de `certificate-render.ts` y los mappers de qzpay. **Las siete se sostuvieron**, y
dos afinaron un número que el sub-agente había redondeado.

Dos trampas de medición nuevas, que van al contador:

1. **Comparar `app.routes` contra el documento OpenAPI sin normalizar las dos grafías de
   parámetro** (`:id` contra `{id}`) marca como «no documentada» a **toda** ruta parametrizada:
   149 en vez de 49. Fue el primer resultado y era todo falso.
2. **El `ADD COLUMN` número 182 está dentro de un comentario** (`0123_brief_nebula.sql:3`, que
   explica un modo de falla citando la frase). Son 181. Tercera vez que la causa de un conteo
   inflado es la propia documentación del código.

### Segunda tanda del 2026-09-17 — cinco carriles más, y uno que no necesitaba lo que decía necesitar

**El carril que estaba anotado como «necesita una base alcanzable» no la necesitaba.**
`F-1B-105` había medido que lo único que impide inicializar billing bajo el arnés de tests es un
export que le falta al mock de `@repo/db`. Reponerlo a nivel de archivo con un `vi.mock` alcanza:
la app se construye igual, `billingConfigured` da `true`, y el inventario real son **1.078
handlers** — 1.032 era el piso (`F-1B-123`).

**Y de ahí salió un hallazgo que no se buscaba.** La primera corrida dio 1.056 en vez de 1.078
porque la sonda llamaba `mountQZPayAdminTier()` **después** de `initApp()`, y `apps/api/src/index.ts`
lo hace **antes** (`:301` contra `:359`). Hono copia las rutas de un sub-app al montarlo, así que
el orden es load-bearing: invertir esas dos líneas hace desaparecer **22 rutas de admin de
billing, once de ellas mutantes**, sin romper nada visible. La consecuencia más ancha es que
**`initApp()` no construye la app que se sirve** (`F-1B-124`).

Cerrados además: las **358 FK internas** —el grafo es una estrella, 253 apuntan a `users`
(`F-1B-126`)—, los **50 archivos de `hono` y `react`** de qzpay, con lo que **qzpay queda relevado
entero** (`F-1B-127`, `F-1B-128`), los **cuatro vocabularios de estado** que faltaban
(`F-1B-125`) y los **sospechosos de la matriz de gates** (`F-1B-129`).

**Una verificación que evitó un hallazgo falso.** Con la sonda mal ordenada, la lectura obvia era
*«`mountQZPayAdminTier()` es un no-op, las 22 rutas no existen en producción»*. Mirar el orden de
`index.ts` antes de escribirlo mostró lo contrario: en producción el orden es el correcto y las 22
existen. El hallazgo real quedó en la fragilidad del orden, no en una ausencia.

---

## Próximo paso

**Leer el reloj con la sonda 06, desde el 2026-09-16 ~11:30.** Es lo único que no se puede
apurar, y de ahí salen `RN-*`, `GR-*`, `PS-2`/`4`/`5`/`6`, `EX-1`, `UP-2`, `DW-*` y `CT-*`.

Después:

- **`BD-MP-01` (pausa) y `BD-MP-02` (cortesía)** siguen bloqueando FASE 2, y las dos dependen
  de lo que devuelva la 06. `EX-11` ya le adelantó a `BD-MP-01` dos restricciones duras.
- **`BD-MP-04` espera al owner**: la medición no la cerró.
- **`WH-4` y `WH-5`** se fuerzan con el interruptor `--fail` del receptor.
- **`EX-13`** necesita la clave secreta de webhook del panel.
- ⚠️ **Restaurar el webhook de staging** cuando termine 1C: hoy la app de
  prueba apunta a la sonda, y el `PUT` por API da `403`, así que es a mano.
- **FASE 1B sigue bloqueada** por `DEC-METH-001`: no se lee código hasta que el diseño esté
  cerrado.

**Las 25 preguntas de FASE 1A están respondidas, pero FASE 1C abrió una nueva.** `BD-MP-04`
tiene sus filas medidas y **le sobrevivió una elección de diseño**: con un solo monto por
autorización (`EX-5`) y varias autorizaciones conviviendo (`EX-6`), un addon recurrente se
puede implementar de dos maneras y las dos funcionan. Está planteada con su cuadro y una
recomendación en `04-open-decisions.md`. Lo demás que falta del owner es **habilitación, no
decisión**.

---

## 2026-09-17 — Cierre de FASE 1B y arranque de FASE 2

### Qué pasó, en orden

**De madrugada, tres hallazgos que cerraron el último carril grande de 1B.** El carril era **la
frontera conceptual qzpay↔hospeda**: siete hallazgos previos la tocaban de costado y ninguno la
enunciaba entera.

- **`F-1B-130`** — el módulo que existe para desambiguar las dos grafías de «cancelada» opera hoy
  sobre **cero filas**, y la cifra de producción que su docblock cita para justificarse no se
  reproduce contra la base: al 2026-08-15, fecha del módulo, la tabla tenía **dos** filas.
- **`F-1B-131`** — **«cancelar a fin de período» desde el admin ejecuta todos los efectos de una
  baja inmediata menos el status**: revoca addons, despublica la ficha de comercio y limpia
  entitlements el mismo día, mientras la fila sigue `active`. Y es la opción **por defecto** del
  diálogo. Cadena verificada eslabón por eslabón. Contradice el §24 y `DEC-SUB-009`. **No se
  tocó** (§4).
- **`F-1B-132`** — la frontera, enunciada: **seis repartos sobre las mismas 27 tablas y ninguno
  coincide**. Hospeda tiene el DDL y la decisión, qzpay el modelo y la superficie; la escritura va
  **14 tablas a 13** (205 escrituras crudas de hospeda, medidas); el vocabulario de estados no lo
  gobierna nadie. Y **el corte no es por entidad sino por camino**.

**Al mediodía arrancó FASE 2.** El owner aprobó el eje **híbrido** —núcleo transversal, después
subdominios, después ejecución—, con **22 capítulos, un archivo cada uno**, en `09-master-spec/`.

**La Parte I quedó completa el mismo día** — los 10 archivos de `00` a `09` — y con ella **30 de
los 72 huecos técnicos cerrados**.

### Por qué así

El owner preguntó explícitamente si la spec se estaba escribiendo *«habiendo analizado todo el
código actual»*, con marcas de qué se reusa y qué se reescribe. **No, y es deliberado**: eso es
FASE 5. El §0 prohíbe que la implementación existente condicione el diseño, y `DEC-METH-003` puso
la clasificación detrás de un gate. FASE 1B ya relevó el código —132 hallazgos con `archivo:línea`—
y ese registro es el insumo de FASE 5, **no fuente de diseño de FASE 2**.

### Dos decisiones nuevas, las dos del owner

- **`DEC-ARCH-003`** — los dos `SUSPENDED` del PDR se separan; el del trial es **`TRIAL_EXPIRED`**.
- **`DEC-OBS-001`** — `RECONCILIATION_REQUIRED` avisa por listado accionable más correo
  **agregado**, no uno por evento.

Con eso son **45 decisiones** y **cuatro apartamientos declarados** del PDR.

### Una corrección propia, registrada y no escondida

El capítulo 03 afirmaba que los eventos del proveedor **no traen orden confiable**, y sobre esa
premisa justificaba la regla de no-retroceso. **Era falsa**: `EX-2` está `VERIFIED` y mide que el
cuerpo trae un contador **`version` monótono por recurso**. La conclusión —releer el recurso en vez
de creerle al evento— no cambió, porque un evento ordenado sigue sin decir el estado actual; lo que
cambió es la razón, y ahora el contador **se usa**: descarta un evento viejo sin gastar una
relectura.

Es el tipo de defecto que este programa persigue: una razón caduca debajo de una conclusión
correcta, que ningún test ve.

### Un error operativo, corregido

Un `git add` de un **directorio** —no de archivos sueltos— coló al repo
`probe-08-webhook-sink/.wrangler/cache/wrangler-account.json`, con el account ID de Cloudflare del
owner. Sacado con `git rm --cached` y `.wrangler/` agregado al `.gitignore` (`1ee6347f0` →
`561183907`). El scanner de secretos del pre-commit **no lo frenó**: un account ID no matchea
ningún patrón de credencial.

### Qué queda para la próxima sesión

1. **Leer los tres relojes** —`pausa-real` y `renov-falla3` en sandbox, `apagon` en producción—,
   que vencen el mismo 2026-09-17 y contestan **cinco de las ocho filas `UNKNOWN`**. Comandos y
   horas exactas en [`03-handoff.md`](./03-handoff.md).
2. **Seguir por el capítulo 10** de la Master Spec.
