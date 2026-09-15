---
title: Worklog / Progress Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
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

## Próximo paso

**Arrancar FASE 1C.** Es lo que más urge:

- **Cuatro decisiones bloqueantes de FASE 2** sólo las puede cerrar el experimento
  (`BD-MP-01` a `BD-MP-04`). No las decide el owner.
- **`DEC-SUB-001` no se puede implementar** hasta saber el resultado de `EX-7`/`EX-8`.
- **FASE 1B sigue bloqueada** por `DEC-METH-001`: no se lee código hasta que el diseño esté
  cerrado.

En paralelo quedan **16 preguntas no bloqueantes** para el owner, en el §16 del análisis.
