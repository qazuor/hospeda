---
title: Rediseño integral de Verticales, Billing, Trials, Entitlements, Limits y Complementos
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-18
type: feature
areas:
  - billing
  - api
  - db
  - web
  - admin
---

# Rediseño integral de Verticales y Billing

> **Esto es el paraguas del programa. Desde el 2026-09-18 no se implementa: se implementan sus dos
> hijas.**
>
> | | | |
> |---|---|---|
> | **HOS-1353 · Verticales** | capacidades, entitlements, limits y autorización | **arranca ya** |
> | **HOS-1354 · Billing** | cobro, suscripción y proveedor detrás de un adaptador | **espera la pasarela** |
>
> El bloqueo que tenía detenido al programa —no saber con qué pasarela vamos a cobrar— **alcanza al
> dinero y no alcanza a las capacidades** (`DEC-ARCH-005`).
>
> **Pero autónomas para desarrollar no quiere decir separadas para liberar: las dos llegan a
> producción juntas y terminadas** (`DEC-ARCH-007`). Ninguna sale sola.

## Cómo se libera: juntas, y el flujo lo hace cumplir

La separación existe **para poder trabajar**, no para poder desplegar. Y no queda librada a que
alguien se acuerde — misma lógica que la condición A de `DEC-ARCH-004`, convertir *«no lo hagas»*
en *«no se puede»*:

| | |
|---|---|
| **la rama de integración** | `epic/HOS-1352-verticales-billing`, **nace cuando exista el primer código**. Los documentos siguen yendo por su rama de spec, que sí va a `staging`: son documentación y no despliegan nada |
| **las sub-épicas** | cortan de ella y mergean **a ella**. Nunca a `staging` directamente |
| **`staging` → paraguas** | periódicamente y **como obligación**, nunca al revés hasta el final |
| **dónde se revisa** | **en los PRs de sub-épica → paraguas**, no en el PR final |

**Es una excepción declarada** al flujo de 6 pasos del `CLAUDE.md` del repo. Está escrita para que
el próximo agente que entre no la «corrija».

**«Terminada» para una épica no significa «en producción»**: significa lista y verificada contra el
contrato, esperando a la otra.

## Por dónde entrar

**Si venís a entender la partición**, tres documentos en este orden:

1. [`docs/11-particion-del-programa.md`](./docs/11-particion-del-programa.md) — por dónde pasa el
   corte y por qué: la frontera, el reparto capítulo por capítulo, y el punto que no es obvio, que
   el corte pasa **por dentro** del catálogo de planes.
2. [`docs/12-contrato-de-cobertura.md`](./docs/12-contrato-de-cobertura.md) — la frontera en sí. Es
   **el único lugar por donde las dos épicas se tocan**, y ninguna lo puede mutar sola.
3. [`docs/01-decision-log.md`](./docs/01-decision-log.md), las tres decisiones de arquitectura del
   owner: `DEC-ARCH-004` (el billing es nuestro, con la pasarela detrás de un adaptador),
   `DEC-ARCH-005` (las dos épicas autónomas) y `DEC-ARCH-006` (el contrato).

**Si venís a trabajar en una épica**, su spec se lee sola:
[`HOS-1353-verticales-capacidades-y-autorizacion/spec.md`](../HOS-1353-verticales-capacidades-y-autorizacion/spec.md).

**Si venís a retomar el programa entero**, seguí el orden de abajo.

## Orden de lectura obligatorio

Cualquier agente o persona que entre a este programa lee, en este orden, **antes de hacer
nada** (§66):

| # | Documento | Qué es |
|---|---|---|
| 1 | [`docs/00-PDR.md`](./docs/00-PDR.md) | El PDR rector del owner. **Inmutable.** |
| 2 | [`docs/01-decision-log.md`](./docs/01-decision-log.md) | Qué se decidió y por qué — **48 decisiones** |
| 3 | [`docs/02-worklog.md`](./docs/02-worklog.md) | Qué se hizo, cronológicamente |
| 4 | [`docs/03-handoff.md`](./docs/03-handoff.md) | Dónde estamos y cuál es el próximo paso exacto |
| 5 | [`docs/04-open-decisions.md`](./docs/04-open-decisions.md) | Qué falta decidir |
| 6 | [`docs/05-phase-1a-domain-analysis.md`](./docs/05-phase-1a-domain-analysis.md) | El análisis de dominio (FASE 1A) |
| 7 | [`docs/06-mp-validation-matrix.md`](./docs/06-mp-validation-matrix.md) | Qué sabemos de Mercado Pago, medido: **89 filas, 81 cerradas, 8 `UNKNOWN`** |
| 8 | [`docs/07-facts-inventory.md`](./docs/07-facts-inventory.md) | Cuántos clientes reales hay, medido |
| 9 | [`docs/08-phase-1b-code-discovery.md`](./docs/08-phase-1b-code-discovery.md) | El billing que corre hoy — **132 hallazgos**. **No es fuente de diseño** |
| 10 | [`docs/10-evaluacion-de-proveedor.md`](./docs/10-evaluacion-de-proveedor.md) | La evaluación de reemplazo de Mercado Pago |
| 11 | [`docs/11-particion-del-programa.md`](./docs/11-particion-del-programa.md) | Por dónde pasa el corte entre las dos épicas |
| 12 | [`docs/12-contrato-de-cobertura.md`](./docs/12-contrato-de-cobertura.md) | La frontera entre las dos |

**No confíes en memoria implícita, ni en engram, ni en ningún otro `CLAUDE.md`, ni en
documentación del repo, ni en un sistema de tracking.** El PDR es explícito al respecto (§3.5):
reutilizar conocimiento viejo como si siguiera vigente es una de las causas de que estemos acá.

## Dónde vive el diseño

**El diseño de FASE 2 ya no está en un solo lugar.** Se desarmó el 2026-09-18 en tres partes, y
`09-master-spec/` ya no existe:

| parte | dónde | qué |
|---|---|---|
| **El núcleo** | [`docs/nucleo/`](./docs/nucleo/) | **7 capítulos** — reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas de estado. Lo que las dos épicas comparten y no se puede partir sin romperlo |
| **Verticales** | `../HOS-1353-…/docs/` | **11 capítulos** |
| **Billing** | `../HOS-1354-…/docs/` | **13 capítulos** |

El mapa completo, con qué define cada uno, está en
[`docs/nucleo/00-indice.md`](./docs/nucleo/00-indice.md).

## Reglas del programa

- **`00-PDR.md` no se edita nunca.** Toda desviación se registra como decisión en `01`.
- **Sólo hay tres fuentes válidas de fundamento**: el PDR, una medición propia fechada, o una
  respuesta explícita del owner. No el código, no la documentación del repo, no un sistema de
  tracking, no la memoria de un agente.
- **Si un documento cita un `§`, el texto se verifica contra el PDR antes de escribirlo.**
- **Ningún documento de este programa referencia trabajo anterior.** Una referencia así es un
  defecto, no una fuente.
- Una decisión `ACCEPTED` no se edita: se crea otra que la marque `SUPERSEDED`.
- **El decision log y la matriz de Mercado Pago no se tocan sin el OK del owner**, y con las
  razones por delante.
- Ninguna decisión sobre Mercado Pago se toma mientras su fila de la matriz diga `UNKNOWN`.
- **Los conteos se recuentan con script, nunca a mano**: la matriz con
  [`contar-filas-de-la-matriz.py`](./docs/contar-filas-de-la-matriz.py), las decisiones con
  `rg -c "^### DEC-"` menos la plantilla del formato.
- **No se lee código para fundamentar una decisión funcional.**
- Todo documento declara `status: CURRENT | LEGACY | OBSOLETE | SUPERSEDED` en su frontmatter.
- El macro-estado del programa vive en **Linear**, no en estos archivos.

## Estado

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio, sin mirar código | ✅ **25 de 25 preguntas** |
| FASE 1B — discovery del sistema actual | ✅ **132 hallazgos**; 3 carriles abiertos, ninguno bloquea |
| FASE 1C — experimentación contra Mercado Pago | 🟡 **89 filas · 81 cerradas · 8 `UNKNOWN`** — cinco son el camino del cobro fallido, imposible de fabricar con Mercado Pago |
| FASE 1C-bis — evaluación de proveedor | 🟡 **paso 4 de 6** |
| FASE 2 — el diseño | 🟡 **21 de 22 capítulos**, desarmado en tres partes. Falta el `13` (Pagos) |
| FASE 3 · épicas · FASE 4 · spec por épica | ✅ **en su nivel grueso**: partir en dos épicas con su spec cada una *es* la 3 y la 4. Falta la descomposición fina adentro de cada una, y esa se hace por separado |
| FASE 5 · gap analysis · FASE 6 · rewrite/reuse · FASE 7 · estrategia | ⬜ **se parten limpio**: cada épica hace la suya |
| FASE 8 · revisión adversarial · FASE 9 · diseño final | ⬜ cada épica la suya, **más una final sobre el conjunto** |
| FASE 10 · implementación | ⬜ **se desarrolla en paralelo y despliega una sola vez** |

**La FASE 1C no se parte**: es billing entera y se va con `HOS-1354`.

**48 decisiones** — 3 de metodología y 45 funcionales. Ninguna pregunta del owner queda abierta, y
ningún bloqueante de diseño tampoco.

## La decisión que reorientó el programa

**`DEC-ARCH-004`** (2026-09-18): el billing se implementa **de nuestro lado**, en un package
propio, con la pasarela detrás de un adaptador. Al proveedor se le pide **cobrar, reembolsar, leer
y avisar**; el ciclo de vida es nuestro. `qzpay` se absorbe. Dos condiciones que la hacen exigible:
un **guard estático** que prohíba importar el SDK fuera del adaptador, y un **adaptador falso en
memoria desde el día uno**, que es lo que prueba que la abstracción no miente.

**Es la primera decisión de arquitectura del programa que no sale de una medición sino de un
criterio del owner**, y trae un riesgo declarado: **traslada los errores caros hacia nosotros** —
un doble cobro pasa a ser nuestro bug y es plata de un cliente real.

## Prohibiciones vigentes hasta FASE 10

Sin código productivo, sin migraciones, sin borrar código, sin tocar la DB productiva, sin
modificar la integración con Mercado Pago. Sí se permite investigar, documentar, ejecutar queries
de lectura, y crear scripts experimentales descartables.

**Excepción autorizada caso por caso: experimentos contra la cuenta productiva de Mercado Pago**,
con la tarjeta del owner y **presupuesto aprobado de antemano en un número exacto** — las sondas
abortan si el máximo a cobrar no coincide con la cifra autorizada.

## Lo que necesita al owner

1. **Enviar los dos textos de la PRUEBA 0** (§5.0 del documento 10) — desbloquea HOS-1354.
2. **Avisar cuando llegue el mail de habilitación de Mobbex** — ídem.
