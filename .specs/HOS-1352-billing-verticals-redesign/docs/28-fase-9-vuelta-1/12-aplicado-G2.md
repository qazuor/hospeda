---
title: "FASE 9 vuelta 1 · G2 aplicado — el fin de la ficha, el addon y el aviso de cobertura"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G2 aplicado

Aplicación de `02-G2-purged-addons-y-aviso.md` (§2, §3, §4 y §5) con las decisiones del owner de
`10-decisiones-del-owner.md`: **G2-1 = 2** (contra la recomendación), **G2-2 = 1**, **G2-3 = 1**,
**G2-4 = 1**. Rutas: `V/` = `.specs/HOS-1353-…/`, `B/` = `.specs/HOS-1354-…/`, `D/` =
`.specs/HOS-1352-…/docs/`. Las líneas son las del 2026-09-26 al cerrar esta aplicación; otros
grupos editan los mismos archivos, así que pueden correrse.

## 1. Qué se aplicó

| ítem / decisión | archivo:línea | estado |
|---|---|---|
| §5.1 · `PB9`: `A5` → `A6` | `V/docs/03-maquinas-de-estado.md:534` | hecho |
| §5.2 · `PB12`: ídem | `V/docs/03-maquinas-de-estado.md:537` | hecho |
| §5.3 · *«la moderación y el borrado del dueño»*, el párrafo del evento | `V/docs/03-maquinas-de-estado.md:~706-720` | hecho |
| §5.4 · inventario de fila viva, fila 18 sin *«único»* | `D/nucleo/01-glosario.md:571` | hecho |
| §5.5 · fila 23, el `desde` de `A6` | `D/nucleo/01-glosario.md:575` | hecho |
| §5.6 · fila 24, el `desde` de `S32`; fila 19 sin *«único»* | `D/nucleo/01-glosario.md:576`, `:572` (y la frase de la fila 20, `:573`, que repetía el *«único»* del 19) | hecho; `G-R1-E` no lleva conteo numérico que recontar (verificado en `B/20` §2) |
| §5.7 · contrato §3, *«quién emite»* (censo de emisores) | `D/12-contrato-de-cobertura.md:844` | hecho, como párrafo en negrita y no como `####` (un encabezado habría dejado el resto del §3 debajo de él) |
| §5.8 · contrato §5.1, la de arranque emite | `D/12-contrato-de-cobertura.md:1112` | hecho |
| §5.9 · `B/03` §3.2, frase antes de la tabla | `B/docs/03-maquinas-de-estado.md:141-143` | hecho |
| §5.10 · contrato §3, `T8` entre los que esperan el primer pago | `D/12-contrato-de-cobertura.md:827` | hecho |
| §5.11 · `V/03` §9 ⚠️ punto 3, y `V/03` §2 ⚠️ punto 4 | `V/docs/03-maquinas-de-estado.md:1174`, `:194` | hecho |
| §5.12 · contrato §2.1, `PB1` en la fila `cubierto` | `D/12-contrato-de-cobertura.md:119` | hecho |
| §5.13 · `V/spec.md`, `T8` al derecho | `V/spec.md:~229-232` | hecho |
| §5.14 · `V/03` §11: `PP1`, `PP3` y *«reclamar no es una transición»* | `V/docs/03-maquinas-de-estado.md:1194`, `:1196`, `:1204` | hecho |
| §5.15 · `V/18` §2.5 sin baja, y su NO cierra | `V/docs/18-partner.md:259`, `:295` | hecho |
| §5.16 · `N/07` §6, trial por vencer y recuperación; `V/03` §2 efecto de `T3` | `D/nucleo/07-outbox-y-notificaciones.md:225-226`; `V/docs/03-maquinas-de-estado.md:53` | hecho |
| §5.17 · `B/16` NO cierra, residuo de 4a | `B/docs/16-addons.md:992` | hecho, ampliado a la suspensión (G2-2 vuelve a `S6` un evento de `S32`, con el mismo residuo) |
| §5.18 · `PB2` relee dentro del lock; reconciliador | `V/docs/03-maquinas-de-estado.md:527`, `:1051` | hecho |
| §5.19 · el `UNIQUE` del hash resuelve la carrera `T6`/`T8` | `V/docs/03-maquinas-de-estado.md:318` | hecho |
| §5.20 · ordinales de la tabla de consecuencias; `V/18` §1 | `V/docs/03-maquinas-de-estado.md:255`, `:267`, `:285`, `:340` (título) y `~:353` (*«el tercer renglón»*, que la propuesta no nombraba); `V/docs/18-partner.md:90` | hecho |
| **G2-1 (opción 2)** · contrato §3: el empuje | `D/12-contrato-de-cobertura.md:902` (§3.1 nuevo) | hecho |
| G2-1 · contrato §4.1: la consulta `fichaPurgada` como red, y el principio de la dirección inversa | `D/12-contrato-de-cobertura.md:986` (firma), `:990` (recuadro), `:994` (párrafo) | hecho |
| G2-1 · `V/03` §9: `PB9`/`PB12` empujan; párrafo de cómo se entera billing; ⚠️ punto 8 | `V/docs/03-maquinas-de-estado.md:534`, `:537`, `:714`, `:772` | hecho |
| G2-1 · `B/03` §8 (`A6`): los dos caminos y la relectura | `B/docs/03-maquinas-de-estado.md:2496` | hecho |
| G2-1 · `B/09` §3, cuarta comprobación | `B/docs/09-conciliacion.md:464` | hecho |
| G2-1 · `B/16` §4.2 y NO cierra | `B/docs/16-addons.md:468`, `:970` | hecho |
| G2-1 · quién lo construye | `V/descomposicion.md:364` | hecho: la consulta y el empuje de `PB12` en V6, el empuje de `PB9` en V9 (`PB9` es de V9) |
| **G2-2 (1)** · `S32` evento y `desde`; nota del `fin_previsto` nulo | `B/docs/03-maquinas-de-estado.md:178` | hecho |
| G2-2 · `S33` evento; `S6` sale de la lista de terminaciones | `B/docs/03-maquinas-de-estado.md:179` | hecho (ver §4) |
| G2-2 · `B/03` §5, primer párrafo | `B/docs/03-maquinas-de-estado.md:1631` | hecho |
| G2-2 · `B/16` §4.2 y NO cierra (sin detector) | `B/docs/16-addons.md:~657-660`, `:671`, `:~935`, `:983` | hecho |
| G2-2 · `B/19` §4 fila 10 | `B/docs/19-superficies.md:116` | hecho |
| **G2-3 (1)** · `V/19` §4: fila 8, fila 24 (moderar), fila 25 (despublicar) | `V/docs/19-superficies.md:62`, `:70`, `:71` | hecho |
| G2-3 · `N/07` §6, excedente | `D/nucleo/07-outbox-y-notificaciones.md:235` | hecho |
| G2-3 · `B/16` NO cierra | `B/docs/16-addons.md:987` | hecho |
| G2-3 · cierra en parte el NO cierra 3 de `V/03` §9 | `V/docs/03-maquinas-de-estado.md:743` | hecho |
| **G2-4 (1)** · ⚠️ de `T7` | `V/docs/03-maquinas-de-estado.md:385` | hecho |

**Lo que agregué al contrato §4.1, para que G4 lo cuente**: **una firma** —
`fichaPurgada(ficha) → sí | no`—, que es **una pregunta más y un campo más** (hoy el texto sigue
diciendo *«siete campos en tres preguntas»*; con la mía serían ocho en cuatro, antes de las de
G4); el párrafo **«Y una pregunta que no es de catálogo: `fichaPurgada`»**; y el recuadro del
principio, que ahora dice que la inversa transporta *«un único hecho de instancia, empujado (§3.1)
y consultado»*. **No toqué** *«Son siete campos en tres preguntas»*, *«Y quién construye las tres
consultas»* ni la regla de vigilancia del §4.2. **Y agregué un §3.1** con el evento empujado
*«la ficha F llegó a PURGED»*: es el primer evento de verticales a billing, y si la regla de G4
cuenta eventos además de preguntas, también entra.

Markdownlint: `npx markdownlint-cli2` sobre los 12 archivos tocados, **0 issues**, exit 0.

## 2. Lo que dejó declarado la opción elegida contra la recomendación (G2-1 = 2)

El owner eligió **el empuje con la consulta como red** porque no acepta ni un cobro de más. Queda
declarado, con la causa y *«owner 2026-09-26, G2-1»*, en tres lugares:

- `B/16`, *«Lo que este capítulo NO cierra»* (`:970`): **el empuje no tiene transporte durable**
  —el outbox del núcleo es de correos—; si se pierde, la red es `fichaPurgada` leída por el barrido
  diario y vuelve el día de atraso, con el cobro que el empuje venía a evitar, que `S21` pone delante
  de una persona con el motivo 14. Lo mismo, **sin empuje**, para una ficha que desaparece sin pasar
  por `PB9` ni `PB12` (el hard delete del admin, `F-8V1A1-003`). Y **dos mecanismos para un mismo
  hecho**, con la exigencia de que `A6` sea idempotente frente a los dos.
- `V/03` §9, ⚠️ de *«la moderación y el borrado del dueño»*, punto 8 (`:772`): lo mismo desde
  verticales, y la aclaración de que **éste sí puede mover plata** aunque el encabezado del ⚠️ diga
  lo contrario.
- Contrato §3.1 (`:902`): el empuje **no se cree solo** —`A6` relee `fichaPurgada` antes de
  cancelar—, y **la red es la consulta, no el empuje**.

## 3. Propuestas para el log y la matriz

**Para `01-decision-log.md`** (lo aplica el orquestador con OK del owner): `DEC-ARCH-006` ganó un
empuje en la dirección inversa. Texto propuesto, como implicación nueva de esa decisión:

> **Implicación (FASE 9 vuelta 1, owner 2026-09-26, G2-1).** El contrato gana un segundo evento,
> el primero de verticales a billing: *«la ficha F llegó a `PURGED`»*, emitido en el mismo acto de
> `PB9` y de `PB12`, cuyo único consumidor es `A6`. No tiene transporte durable; su red es la
> consulta `fichaPurgada(ficha) → sí | no` del §4.1, leída por el barrido diario de billing. Se
> eligió contra la recomendación (sólo la consulta, con hasta un día de atraso) porque el owner no
> acepta ni un cobro de más; el día de atraso vuelve sólo si el empuje se pierde, y queda declarado
> en `B/16` NO cierra.

**Para `06-mp-validation-matrix.md`**: ninguna.

## 4. Residuos y choques con otros grupos

1. **G4 y el §4.1**: agregué una firma, un párrafo y reescribí el recuadro del principio (§1,
   arriba). Los conteos del §4.1 y la regla del §4.2 quedan para G4.
2. **`S33` listaba *«`S6` sobre una cortesía»* como una terminación de la principal.** `SUSPENDED`
   es fila viva y no termina nada; con G2-2 además pausa los complementos. Lo taché y agregué las
   terminaciones reales desde `SUSPENDED` (`S23`, `S27`). Es una corrección que la propuesta no
   nombraba y que G2-2 volvió necesaria.
3. **`PB5` (archivada desde borrador) no tiene un aviso que nombre los destaques** (G2-3 lo pone
   en la lista de casos, pero ninguna fila de `V/19` §4 es la del archivado desde borrador: la 18
   es la de `PB4`). La causa sigue siendo del dueño y la baja está a mano; queda como residuo sin
   escribir. Si se quiere, es una frase en la fila de ese aviso cuando exista.
4. **`B/descomposicion.md` no dice qué unidad de billing consume el empuje** (el lado de `A6`). No
   lo escribí: `A6` ya tiene unidad, y el consumo es una rama más de esa fila.
5. **El §3.1 del contrato es un número nuevo** dentro de un §3 que no tenía sub-secciones; si otro
   grupo agrega un §3.x, que mire la numeración.
6. **`V/03` §9**: G1 (G1-5) escribió en las mismas filas `PB9`/`PB12` al mismo tiempo; las dos
   ediciones conviven sin pisarse.
7. `V/21:328` cita la frase tachada *«la tercera fila es nueva y es deliberada»*, pero dentro de un
   bloque ya tachado (2g): no la toqué.

## Key Learnings

1. Con varios agentes escribiendo el mismo archivo, `Edit` rechaza por mtime aunque la zona no se
   haya tocado: lo que funcionó fue leer 1-3 líneas y editar en el mismo turno, y reintentar.
2. Un empuje sin transporte durable no reemplaza a la consulta: la vuelve la red. Contra un estado
   final (`PURGED`), la consulta tardía es exacta; lo que cuesta un empuje perdido es tiempo, no
   una respuesta equivocada.
3. Extender un evento (`S32` a `S6`) obliga a revisar las listas de «terminaciones» de la fila
   gemela (`S33`): una fila viva que figuraba como terminal quedó contradicha.
4. Nombrar filas por ordinal se vence a la primera fila nueva; el mismo defecto apareció en un
   lugar que la propuesta no listaba (*«el tercer renglón»*) y en mi propio ⚠️ nuevo, que tuve que
   reescribir por contenido.
5. Asignar la construcción a «la dueña de `PB12`» dejaba afuera a `PB9`, que es de V9: el empuje
   tiene dos emisores y dos unidades.
