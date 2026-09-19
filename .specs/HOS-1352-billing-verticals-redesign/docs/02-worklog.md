---
title: Worklog / Progress Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-19
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

---

## 2026-09-18 (tarde) — El programa se parte en dos épicas, y el diseño se desarma

### Qué pasó

El owner decidió **partir el programa en dos épicas autónomas** (`DEC-ARCH-005`) y, en la misma
conversación, que la frontera entre ellas fuera **un contrato con dos implementaciones desde el día
uno** (`DEC-ARCH-006`). El desarme se ejecutó el mismo día.

El motivo: el bloqueo que tenía todo detenido —no saber con qué pasarela vamos a cobrar— **alcanza
al dinero y no alcanza a las capacidades**. Se estaba esperando por una razón que no aplicaba a la
mitad del programa.

### Lo que se midió antes de decidir

- **8 de 21 capítulos escritos no citan ninguna medición del proveedor** (contados con `rg`), y son
  casi exactamente la épica que arranca. El corte no hubo que inventarlo: ya estaba en el material.
- **De los cuatro capítulos de verticales, sólo tres referencias cruzan a billing**, y las tres
  viven en la sección *«Lo que este capítulo NO cierra»*. Son exclusiones —el capítulo diciendo que
  eso no es suyo—, no dependencias. **Eso es lo que autorizó el desarme.**
- **De las seis entidades del catálogo comercial, cinco no tienen un solo campo de dinero.** El
  precio vive en una sola tabla hoja, `billing_option`.

### Una corrección de alcance, y venía de un error de un sub-agente

Un agente clasificador afirmó que el acoplamiento más cargado era la derivación del plan de trial,
«porque lee el catálogo de planes en vivo», y marcó el trial como posiblemente-billing. **Verificado
contra el capítulo 02 §2.1: es al revés.** Lee `rank` y `vendible`, que están en `plan_version` y no
son un precio.

La consecuencia no es menor: **el catálogo de planes entero, menos `billing_option`, entra en la
épica que arranca hoy**. Verificar la afirmación más grave de un sub-agente cambió el alcance de una
épica.

### Qué se produjo

| | |
|---|---|
| `11-particion-del-programa.md` | el corte, su fundamento y el reparto capítulo por capítulo |
| `12-contrato-de-cobertura.md` | la frontera: un hecho y un aviso, con sus dos implementaciones y tres defensas |
| `DEC-ARCH-005` y `DEC-ARCH-006` | asentadas; el log queda en **48 decisiones** |
| el desarme | **7 capítulos al núcleo, 11 a verticales, 13 a billing**; `09-master-spec/` retirado |
| `HOS-1353/spec.md` | reescrita como spec **autónoma** |

### Cómo se verificó el desarme

**Antes de retirar ningún original**: 105 de 105 encabezados presentes en alguna mitad, y el volumen
de texto entre 1,06x y 1,29x del de partida.

Dos correcciones sobre lo que entregaron los agentes que partieron los capítulos:

1. Uno **declaró** haber dejado afuera los párrafos de apertura y las secciones *«NO cierra»* del 02
   y el 03, en vez de adivinar dónde iban — que era exactamente lo pedido. Se repusieron a mano.
2. Una verificación propia marcó 11 líneas como perdidas en los otros cinco capítulos y **eran
   falsos positivos míos**: el agente anotó las referencias cruzadas metiendo la marca dentro del
   paréntesis existente en vez de abrir uno nuevo, que resultó más legible que lo especificado.

### Lo que NO se decidió

- **Cuál es la pasarela.** Sigue en el paso 4 de 6, esperando la PRUEBA 0 y el KYC de Mobbex.
- **Si el capítulo 13 adopta el cargo puntual como modelo canónico.** Planteado, con sus tres
  opciones y una recomendación, y sin responder. Es la primera pregunta de HOS-1354.

---

## 2026-09-18 (tarde, II) — Autónomas para desarrollar, juntas para liberar

### Qué pasó

El owner aclaró el alcance de `DEC-ARCH-005`, y la aclaración canceló trabajo que se estaba por
proponer. **«Autónomas» era *cada una se desarrolla sin esperar a la otra*, no *cada una puede
salir a producción sola*.** Textual: *«van a llegar sí o sí juntas y terminadas ambas a
producción»*.

**Por qué importa**: con la lectura equivocada, esta sesión había propuesto una **tercera
implementación del contrato** —un adaptador sobre el billing actual, para que verticales pudiera
llegar a producción sin la otra épica—. Era código real sobre un sistema condenado, escrito para
tirarlo, **resolviendo un problema que el programa no tiene**. Se descartó.

### La decisión, y lo que la hace cumplir

`DEC-ARCH-007`. Y no queda librada a que alguien se acuerde: **el owner propuso una rama de
integración del paraguas**, y eso convierte *«no lo hagas»* en *«no se puede»* — misma forma que la
condición A de `DEC-ARCH-004`.

| | |
|---|---|
| rama de integración | `epic/HOS-1352-verticales-billing`, **nace con el primer código** |
| las sub-épicas | cortan de ella y mergean a ella, **nunca a `staging`** |
| `staging` → paraguas | **periódicamente y como obligación**, nunca al revés hasta el final |
| dónde se revisa | en los PRs de sub-épica → paraguas, no en el PR final |

Las tres condiciones que se le pusieron salen de los modos de falla conocidos de una rama de larga
vida: la divergencia contra un repo que se mueve mucho, un PR final demasiado grande para revisarse
de verdad, y que es una **excepción declarada** al flujo de 6 pasos del `CLAUDE.md` del repo — sin
declararla, el primer agente que entre la «corrige».

### El riesgo cambió de forma

**No es la coexistencia de dos sistemas en producción** —no la hay— **sino la espera**: si una
épica termina meses antes, su código espera. Lo acotan el merge periódico y la integración
continua; **cómo se integra sin activar** es materia de la FASE 7 de cada épica y quedó sin
resolver a propósito.

### Y las fases quedaron repartidas

5, 6 y 7 se parten limpio. 8 y 9, cada épica la suya **más una final sobre el conjunto**. La 10 se
desarrolla en paralelo y **despliega una sola vez**. **La 1C no se parte**: es billing entera. Las
3 y 4 ya se cumplieron en su nivel grueso al partir el programa.

### Qué se produjo

`DEC-ARCH-007` asentada —el log queda en **49 decisiones**, recontadas con `rg`—, la partición y
las dos specs actualizadas, el contrato con una sección nueva que explica **por qué no hay una
tercera implementación**, y **la spec autónoma de `HOS-1354`**, que faltaba.

### Una cosa que no se hizo, y a propósito

El owner pidió actualizar *«todas las specs, pdr, o cualquier md»*. **El PDR no se tocó**: su
propia regla dice que no se edita nunca y que toda desviación se registra como decisión en el log
— que es exactamente lo que se hizo.

---

## 2026-09-19 — FASE 8 completa, y la FASE 9 arranca por su requisito de entrada

### Ocho agentes adversariales, en tres pasadas

`DEC-ARCH-007` implicación 2 pedía que cada épica hiciera su FASE 8 **más una final sobre el
conjunto**. Se ejecutó así, y cada pasada se partió **por vector de ataque, no por capítulos**,
con el material completo para todos: A1 acceso cruzado · A2 máquinas y carreras · A3 datos y
acoplamiento · B1 doble cobro y pérdida de pago · B2 idempotencia y carreras · B3 conciliación y
migración · C1 la costura · C2 liberación y coexistencia.

La razón de partir por vector y no por racimo de capítulos es medible después: a un agente que
busca *«el doble cobro»* le sale un doble cobro con su camino o una ausencia argumentada; a uno
que busca *«romper»* le sale una lista de generalidades, y sólo lo primero lo puede resolver o
descartar la FASE 9. Partir por capítulos se descartó por la razón opuesta: un agente que ve
cuatro capítulos no puede ver el acoplamiento entre los otros, que es una de las diez categorías
del §65.

### 141 hallazgos, 48 críticos, y cuatro convergencias

Recontados con script sobre los ocho informes, que viven en
[`14-fase-8-adversarial/`](./14-fase-8-adversarial/). **Cuatro defectos los encontraron tres
agentes ciegos entre sí cada uno** — la señal de severidad más fuerte que produce el método, y
que una sola pasada por épica no habría dado:

1. **el contrato no transporta `grant` ni `addon`** — tres agentes, **las dos épicas**;
2. **el `UNIQUE` de suscripción viva hace inejecutable todo upgrade** — tres de billing;
3. **el trial no puede nacer** — tres de verticales;
4. **el preapproval huérfano / los terminales sin barrer** — tres de billing.

### La causa raíz, que ningún agente individual podía ver

Las cuatro tienen **la misma forma**: una regla validada contra el caso que la motivó y después
escrita como **cuantificador universal** sobre un dominio que incluye el caso donde es falsa. Y
las cuatro son una contradicción **entre dos capítulos, nunca dentro de uno**.

De ahí el quinto defecto, que no está en ningún informe individual: el método cierra huecos **por
capítulo**, lo que comprueba que un capítulo cubre sus casos y **nunca que una regla cubra los
suyos**, porque los suyos viven en otros capítulos. **No existe ningún lugar donde una regla se
verifique contra el dominio completo que cuantifica** — y el único artefacto que podía hacerlo era
el documento único que el desarme del 18/09 retiró.

### Tres cosas que se verificaron aparte, y una me corrigió a mí

- **`DEC-ARCH-007` tiene un mecanismo que no existe en el repo.** Medido: los 15 workflows
  declaran `main`, `staging` y `develop`, y **ninguno nombra `epic` ni un patrón `**`**. Un PR de
  sub-épica al paraguas entra **sin lint, sin typecheck, sin tests y sin los guards**. La regla
  está escrita cuatro veces en las specs y **cero veces en el repo**, y el único camino con CI
  completa es el que la decisión prohíbe.
- **La fila sin id de la matriz no era una novena `UNKNOWN`**: es un duplicado desactualizado de
  `EX-33`, `VERIFIED` en producción con tarjeta real desde el 16/09. El conteo del script —89
  filas, 49 `VERIFIED`, **8** `UNKNOWN`— **nunca estuvo mal**.
- **Los invariantes son 51, no 49**, y acá me equivoqué primero en la dirección contraria: informé
  49 apoyándome en dos frases del capítulo 04 que resultaron **anteriores a `D13` y `D14`**. Lo
  corrigió la pasada C. **Cuando varios agentes discrepan sobre un número, dirime la aritmética
  del documento, no la mayoría**: cuatro informes dijeron 49 y la suma dice 51.

### `DEC-METH-004` — la FASE 9 tiene cuatro salidas

Decisión del owner. El §65 manda actualizar cuatro documentos y el programa ya no vive sólo ahí:
el 18/09 se publicaron **25 issues de Linear** y unos **27 artifacts** contra un modelo que estos
hallazgos movieron. La fase cierra **el diseño, el registro, las sub-specs y lo publicado**, en
ese orden y con la propagación **al final**.

Y define **«resuelto»**: el camino del hallazgo, reejecutado sobre el texto corregido, ya no
llega — y para un **racimo**, además, la regla corregida se verifica contra **todo el dominio que
cuantifica**. Se descartó el criterio más barato —*«el capítulo dice qué pasa»*— porque **es el
que produjo la causa raíz**.

### El requisito de entrada de la FASE 9, ya escrito

[`15-fase-9/00-dominios-de-los-racimos.md`](./15-fase-9/00-dominios-de-los-racimos.md): cada
racimo con su dominio como **lista finita con fuente por elemento**, no como descripción. El
número que ordena la fase:

> **327 casos. La FASE 8 miró 63. Quedan 264 sin mirar.**

Y **siete dimensiones no se pueden enumerar desde los documentos**, que es el resultado más
valioso: son dominios que hoy **no se pueden cerrar**. Dos consecuencias duras: **R4 no tiene
dominio cerrable** —su eje son los estados del vínculo con el proveedor, y `provider_link` no
tiene columna de estado ni máquina, así que los valores se derivaron en vez de leerse, que *es* el
racimo— y **parte de R1 depende del capítulo 13, que no existe**.

### Las seis correcciones de registro, aplicadas

Con autorización del owner. **Tres resultaron ser otra cosa al medirlas**: los guards no son tres
cuentas en conflicto sino **un catálogo de 11 (`G1`…`G11`, sin huecos) más `G12` y `G13`
huérfanos**, nacidos en las descomposiciones y ausentes de todo capítulo `20`; y las máquinas no
son cuatro respuestas sino **ocho que pide el §63 contra nueve que define el capítulo 03**, con la
§10 que no es una máquina sino la regla de no-retroceso.

Y un criterio que quedó fijado al aplicarlas: **un registro fechado no se reescribe.** El §676 de
este mismo worklog dice «45 decisiones» y es correcto **en su fecha**; el barrido de
`04-open-decisions.md` verificó «50» y eso es lo que verificó, así que lleva nota al pie en vez de
un número nuevo. Sólo se corrigió el `03-handoff.md`, que **declara una regla vigente** y no narra
un momento.

### Qué se produjo

Nueve documentos nuevos en dos carpetas, el log en **51 decisiones**, la matriz intacta en
**89/49/8**, y el PDR sin tocar.

### Lo que no se hizo

**Ningún racimo se resolvió.** Está el andamiaje que permite resolverlos y no el trabajo. Y de la
FASE 8 sobreviven **dos falsos positivos declarados como tales** para que nadie los reabra: la
lista del cap. 19 §4 no perdió ítems —la unión de las dos mitades es 1–14— y `G7` no falta, está
en billing por reparto.

---

## 2026-09-19, tarde — las 33 decisiones, aplicadas a los capítulos

### Qué pasó

Los cinco racimos resueltos dejaron **37 decisiones del owner**, contestadas en la tanda de la
mañana. Esta entrada registra el **PASO 1** —aplicarlas a los capítulos— y el **PASO 2** —las seis
`DEC-` que faltaban y el registro—, que son los dos primeros del orden que `DEC-METH-006` fija y
que no se reordena.

**Siete commits**, de `4f34afa1a` a `8bf004a6d`, sobre `spec/HOS-1352-billing-verticals-redesign`
(PR #3360). Seis paquetes, y el primero es atómico por obligación: `D-01`, `D-04`, `D-05`, `D-06`
y `D-20` tocan todas el **contrato de cobertura**, que es la frontera, y `DEC-ARCH-006` dice que
**ninguna épica lo muta sola**.

### Una contradicción entre dos decisiones de la misma tanda, encontrada al aplicarlas

**`D-01` enumera `cubierto` sobre CUATRO tipos y `D-04` agrega un quinto TÍTULO.** No es una
discusión de nombres: `cubierto` tiene **tres consumidores declarados** —el paso 5 de la
autorización, `PB2` y el §6 del capítulo 15—, y si el piso contara, el campo quedaría en `true`
**para siempre y para todos**, cambiando el significado de los tres sin que ninguna decisión lo
hubiera dicho.

Es **la causa raíz del programa otra vez**: una regla validada contra el caso que la motivó y
escrita como cuantificador universal. Se le llevó al owner como una pregunta con dos opciones, y
**eligió la 2**: el piso es una clase aparte, `cubierto` conserva su significado comercial, y **el
paso 5 deja de ser `cubierto`**.

**La consecuencia se escribió en voz alta en vez de esconderse**: con un piso siempre presente,
**el paso 5 ya no rechaza a nadie** y toda la defensa se apoya en el paso 6. Eso obligó a reescribir
el argumento con que `V/17` §2.2 cierra `S-AUTH-01`, que se apoyaba textualmente en que *«ahí el
paso 5 no encuentra título»*, y a ampliar `G-R3` para que cubra **las dos** versiones no vendibles
de cada vertical.

### Y una promesa que una decisión hace y no cumple

**`D-04` afirma ser *«la única salida que además cierra `F-8A1-005`»*, y lo cierra a medias.** El
hallazgo tiene dos sujetos: el `Turista Free` se caía en el paso 5 y el título `BASE` lo destraba;
el `Guest` **se cae en el paso 1** —*«no autenticado»*— y nunca llega al 5.

No se resolvió en el paso 1 por dos razones independientes: admitir al `Guest` en el paso 1 deja
**dos** de los nueve pasos incapaces de rechazar a nadie, que es una decisión de arquitectura y no
la aplicación de una decisión tomada; y arrastra `A-ENT-02`, que el capítulo 17 declara
explícitamente que **no cierra**.

**Decisión del owner: queda para la 8-bis**, y se creó
[`15-fase-9/08-residuos-del-paso-1.md`](./15-fase-9/08-residuos-del-paso-1.md) para que la 8-bis
lo **recorra** en vez de redescubrirlo. Es el archivo donde viven los residuos del paso 1: lo que
una decisión promete y su aplicación no alcanza a cumplir.

### Qué cambió de forma, no sólo de texto

- **El contrato tiene tres clases de fuente y seis tipos.** `cubierto` cuenta sólo `TÍTULO`;
  `BASE` y `ADDON` no. `hasta` pasó de dos valores a cuatro. La referencia **no es anulable**, y
  eso obligó a que `courtesy_grant` y `permanent_grant` ganaran su columna.
- **El candado del §11 son dos claves**, partidas por `sucede_a`, y `RECONCILIATION_REQUIRED`
  **dejó de ser un estado**: pasó a ser una marca que no pisa el estado real. Entró
  `CHARGE_DECLINED` y **siguen siendo nueve**.
- **`T1` puede disparar.** Su condición vieja —*«no hay trial previo»*— decía lo mismo que su
  estado de origen **y lo negaba**: se cae por redundante, no por permisiva.
- **Los dos `21-migracion.md` describen que no se migra.** Cuatro de los cinco problemas críticos
  de la migración **pierden sujeto** y la unidad de trabajo que iba a escribirla no se crea.
- **Cuatro guards nuevos** y tres columnas de `vertical` que no existían.

### Qué se produjo

El decision log pasa de **54 a 60** decisiones y de **5 a 7** apartamientos declarados del PDR —
recontado con `rg -c "^### DEC-"` menos la plantilla, no a mano. Un documento nuevo del paraguas
(`16-fase-7-del-paraguas.md`) y uno nuevo de la fase (`15-fase-9/08-residuos-del-paso-1.md`). La
matriz **intacta**, y el PDR sin tocar.

### Lo que no se hizo, y por qué

**Las fichas de las dos `descomposicion.md` no se tocaron.** `D-07` nombra a `V4` y `D-10` a una
unidad de cada épica, pero eso es la **salida 3** de `DEC-METH-004`, y `DEC-METH-006` §3 la manda
hacer **una sola vez, después de la 8-bis** — porque si la 8-bis trae críticos, la 9-bis los
resuelve y habría que propagar 52 objetos de nuevo. La única excepción fue reemplazar
`RECONCILIATION_REQUIRED` en `HOS-1354/descomposicion.md`, que quedaba nombrando algo que dejó de
existir.

**Tampoco se tocaron el `CLAUDE.md` del repo ni los workflows** (`D-29`): son archivos del repo y
su aplicación **la decide el owner**, como ya declaraba `DEC-CI-001` implicación 1.
