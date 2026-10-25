---
title: PDR — Rubros de ficha y «Comer y salir»
linear: HOS-1787
statusSource: linear
created: 2026-10-25
status: CURRENT
---

# 00 · PDR (requisitos del owner)

Lo que pidió el owner, tal como salió de la conversación del 2026-10-24/25. Este archivo es la
fuente de verdad de los **requisitos**; las **decisiones** con su porqué viven en
[`01-decision-log.md`](01-decision-log.md).

## El problema

La vertical Gastronomía incluye locales que no son gastronomía: bares, pubs, boliches. Su nombre y
su modelo no los representan.

## Lo que el owner quiere

1. **Una sola vertical** para comer y para salir, no una vertical nueva. Se compararon las dos
   opciones (vertical nueva vs. una vertical con variantes) desde producto, clientes y usuarios; el
   owner eligió una vertical por los locales híbridos (resto-bar, cervecería con cocina) y por la
   reversibilidad.
2. **Campos y secciones distintos según qué es el local.** A un boliche no le corresponde la carta;
   a un restaurante no le corresponden las cosas de la noche. Lo que se ve y se edita depende de eso.
3. **Que el mecanismo sea genérico, no algo de gastronomía.** Textual: *«donde empezamos a meter
   código específico, es donde nos metemos en lío que provocan que después para que quede bien
   tenemos que escribirlo de cero de nuevo como con HOS-1352»*. Arranca con comer vs. noche, pero
   después tiene que servir para, por ejemplo, Alojamiento: casa común vs. hotel vs. complejo de
   cabañas.
4. **No cobrar distinto por el rubro.** Se exploraron planes por familia, addons ocultos de costo
   cero y un addon de «rubro extra»; el owner los descartó porque traen más problemas de los que
   resuelven. Precio diferenciado, si algún día, vía addons por ficha de «más de algo», nunca info
   esencial (B10, post-corte de HOS-1352).
5. **Renombrar la vertical en TODOS lados** aprovechando que no hay fichas reales de gastronomía:
   código, URLs, i18n keys y strings, documentación, schemas, tablas, parámetros, etc. — no sólo la
   URL. Nombre público «Comer y salir»; nombre interno `venue`.
6. **Organización como HOS-1352, más chica**: un issue paraguas con hijos por fase; el renombrado
   es el primer hijo y bloquea a todos los demás. Spec y sub-specs en `.md`, decision log,
   hallazgos y guards, con vueltas de revisión adversarial hechas por subagentes buscando
   problemas, edge cases, corner cases, ambigüedades y faltantes.
7. **La regla «una ficha = un local físico = una dirección»** va en un issue aparte, relacionado.

## Fuera de alcance

- Cobrar distinto por rubro (ver punto 4).
- Una vertical nueva.
- Rubros adicionales más allá de `gastronomia` y `noche` (karaoke, salón de eventos, vinoteca…):
  se suman cuando haya casos reales.
- Partner y Turista: no tienen ficha.
