---
title: Resolver localidades abreviadas al importar un alojamiento
linear: HOS-346
statusSource: linear
created: 2026-08-16
type: fix
areas:
  - api
  - web
---

# Resolver localidades abreviadas al importar un alojamiento

## Overview

**Goal.** Que el importador resuelva `"C. del Uruguay"` a Concepción del Uruguay
sin volver a abrir el camino de pre-rellenados confiadamente equivocados que
mataron el intento anterior.

**Contexto que no se re-litiga.** Este trabajo se sacó deliberadamente del
PR #2529 tras cinco rondas de judgment-day. Cada ronda encontró un
pre-rellenado equivocado **en lo que la ronda anterior había agregado**. El
issue de Linear tiene el corpus adversarial completo y los siete hechos de
dominio; esta spec no los repite, los asume.

La lección central, que gobierna todo el diseño:

> El peligro NO es el match ambiguo, es el match **único y equivocado**. La UI
> pre-rellena cuando hay exactamente un candidato, así que **toda capa capaz de
> devolver una sola fila es un camino de escritura automática**. La ambigüedad
> es el resultado seguro.

## Por qué este diseño es distinto del que falló

El intento anterior hizo el **matching** más inteligente: capas de exact / alias
/ containment / tokens / Levenshtein más parseo de calificadores de dirección.
Cada capa nueva era una forma nueva de devolver una fila equivocada, y la
superficie de fallo era la *interacción* entre capas — que no se puede enumerar.

Este diseño **no toca el matching**. Cambia qué exige la **confianza**, y agrega
un único camino de resolución nuevo cuya superficie de fallo es enumerable.

Hay un hecho de dominio que hace que esto sea lo correcto y no una concesión:

> Entre Ríos tiene ~270 localidades y sólo **22** están en el catálogo.

O sea que **la respuesta correcta es "ninguna" la enorme mayoría de las veces**.
Un matcher ansioso no se equivoca de vez en cuando: se equivoca casi siempre. No
resolver es el comportamiento por defecto correcto, no una carencia.

## Alcance

### A — Plumbear la provincia (defensivo)

`RawExtraction` transporta hoy `scrapedLocality` y `scrapedCountry`, pero **no la
provincia** — pese a que los payloads la traen (`MlLocation.state`,
`administrative_area_level_1` de Google, `addressRegion` de JSON-LD). El hecho de
dominio #4 ya identificaba este plumbing como la primera pieza.

Se agrega `scrapedRegion` y la confianza pasa a exigir que la provincia no
contradiga a Entre Ríos.

**La propiedad que hace segura a esta pieza**: sólo puede **quitar** confianza,
nunca otorgarla. No agrega ni un match. Por construcción es incapaz de introducir
un pre-rellenado equivocado.

Cierra por sí sola:

- `Caseros, Buenos Aires, 1678` → Caseros (ER)
- los 6 destinos con homónimo en otra provincia (Caseros, Villa Elisa, San Justo,
  Santa Ana, Colón, San José)
- `Concórdia` (Santa Catarina) → Concordia (ER), el hecho de dominio #7

**Decisión del owner (2026-08-16): fail-OPEN ante provincia ausente.** Si el
payload no trae provincia, no bloquea; sólo bloquea cuando la trae **y**
contradice. Esto preserva las preselecciones automáticas que hoy funcionan en los
adapters que no llevan provincia.

Se deja registrado el costo, porque el hecho de dominio #6 advierte en la
dirección contraria: el hueco residual es el payload **sin provincia y sin
país**. Para MercadoLibre —el adapter donde se observó el caso— `country` sí
viene, así que `Concórdia`/Brasil ya rebota por país. El hueco no es teórico pero
sí angosto, y queda documentado como caso de test explícito.

### B — Tabla de alias curada

Un mapa cerrado y explícito de abreviatura normalizada → **slug** del catálogo,
resuelto con `DestinationService.getBySlug` (búsqueda exacta, sin `ILIKE`).

**Por qué esto es seguro donde el matcher por capas no lo era**: una tabla de
alias es **enumerable y auditable**. No puede sorprender con
`Colonia Elía → Colón`, porque `colonia elia` no es una clave. Cada respuesta de
una sola fila que produce fue aprobada por un humano una vez. La superficie de
fallo está acotada por el tamaño de la tabla, no por la interacción entre
heurísticas.

Reglas de la tabla, no negociables:

1. **Sólo entra lo observado en un payload real.** Arranca con la única
   abreviatura medida: `"C. del Uruguay"`. `Gchú`, `Cdad.` y `Pto.` son conjeturas
   de la ficha del smoke, no datos — entran cuando aparezcan.
2. **Igualdad exacta sobre la forma normalizada completa**, nunca substring. Así
   `"Salto, C. del Uruguay"` no matchea.
3. **Apunta al slug**, no al nombre: dos slugs del catálogo no derivan del nombre
   (`liebig` → "Pueblo Liebig", `paranacito` → "Villa Paranacito").
4. **Un alias ambiguo no entra.** Si la abreviatura puede designar dos lugares
   reales de la región, se queda afuera y el anfitrión elige.
5. El destino resuelto se valida `CITY` y no borrado antes de ofrecerse.

### C — Suite adversarial, verificada por mutación

El corpus del issue como suite. Además del corpus, casos nuevos para la pieza A y
para el alias. **Revertir cada guard tiene que romper al menos un test** — el
issue advierte que varias veces un test quedó verde describiendo una rama que
otro guard anterior ya interceptaba.

### No-objetivos (explícitos)

- **Nada de Levenshtein, tokens, containment ni parseo posicional de dirección.**
  Es exactamente lo que falló cinco veces.
- No se toca `AC-8.2` de SPEC-222: el resolver **nunca** fija `destinationId`.
  Sigue devolviendo candidatos y un booleano.
- No se ensancha `searchScope`.

## Acceptance criteria

- **AC-1** — `RawExtraction` transporta `scrapedRegion`, poblado por los adapters
  de MercadoLibre, Google Places y el extractor JSON-LD.
- **AC-2** — Con provincia presente y distinta de Entre Ríos, `confident` es
  `false` aunque el nombre coincida exactamente.
- **AC-3** — Con provincia ausente, el comportamiento actual se preserva
  (fail-open).
- **AC-4** — `"C. del Uruguay"` resuelve a Concepción del Uruguay con
  `confident: true` cuando ni provincia ni país contradicen.
- **AC-5** — Ninguna entrada del corpus adversarial produce `confident: true`.
- **AC-6** — El alias no dispara por substring: `"Salto, C. del Uruguay"` no
  resuelve.
- **AC-7** — Revertir cualquier guard nuevo rompe al menos un test.

## Riesgos

- **El importador de ML no se puede ejercitar end-to-end en local**:
  `external_oauth_credentials` está vacía (bloqueado por HOS-45). La verificación
  es por tests de resolver y adapter sobre payloads reales, como en #2529.
- **La tabla de alias crece por observación**, así que este issue no "termina" el
  problema: lo acota. Es deliberado.
