# Abiertos de la redacción · g4-corte-indice

Archivos: `00-indice.md`, `30-el-corte.md`, `80-abiertos.md`, `90-retirados.md`.

## Los tipos de test mínimos de cuatro ítems del corte chocan con lo que admite `CORTE`

- **Qué falta**: un tipo de test para `DEC-TEST-002`, `PASO:3`, `PASO:3a` (y en parte `PASO:0`) que
  cumpla a la vez el contrato de cobertura y la regla de la pseudo-pieza.
- **Ítems afectados**: `DEC-TEST-002` (mínimo `migración desde cero`), `PASO:3` y `PASO:3a`
  (mínimos `migración desde cero` y `migración sobre datos`), `PASO:0` (además de los dos smoke,
  `migración desde cero`); todos con dueña `CORTE` en `_trabajo/cobertura.json`.
- **Por qué las fuentes no lo deciden**: BE (`D/41-corte-del-mvp/10-decisiones-del-owner.md:109`) y
  el tercer 📌 de `DEC-METH-019` (`D/01-decision-log.md:7987`) dicen que un `TEST:CORTE:n` es *«smoke
  manual … o guard estático»*, y `trazar.py` R12 rechaza otro tipo; pero `cobertura.json` pide
  tipos de migración para esos cuatro ítems. Y `DEC-TEST-002` dice además que *«no lo vigila un
  guard»* (`D/01-decision-log.md:5301`), así que tampoco cabe un guard estático. En
  `30-el-corte.md` escribí smoke manual (`TEST:CORTE:7`, `:8`, `:9`, `:18`) y lo marqué inferido.
- **Pregunta al owner**: ¿qué test cubre la parte de migración de esos ítems?
  1. **Recomendada.** El `TEST:CORTE` queda como smoke manual (el ensayo en `staging` y el corte en
     producción), y la migración desde cero y sobre datos se prueba en `V6`, que es la proveedora de
     la migración del paso 3 (`cobertura.json`, `tambien_lo_ejercen` de `PASO:3` y `PASO:3a`); se
     corrigen los mínimos de `cobertura.json` para `CORTE`. Costo: bajo, un cambio de herramienta.
     Riesgo: que `V6` no escriba esos tests; lo ataja su propia cobertura.
  2. Ampliar BE para que `TEST:CORTE` admita los dos tipos de migración. Costo: tocar `trazar.py` y
     una letra nueva. Riesgo: un test de migración sin pieza que lo construya.
  3. Mover la dueña de `PASO:3` y `PASO:3a` a `V6`. Costo: reabre la asignación de BE. Riesgo: `V6`
     dueña de pasos que opera una persona.
  - Ejemplo: la migración que escribe la ficha de Juan entre las cinco de la lista se prueba desde
    cero en `V6`; el día del corte, quien opera verifica a mano que la ficha de Juan nació `PUBLISHED`.

## El ensayo no dice si recorre la rama de aborto

- **Qué falta**: si el ensayo del paso 0 en `staging` ejercita la rama de aborto (restaurar el 2b,
  redesplegar la imagen vieja, los inversos (b) y (c), la regla del 0b puesta hasta el reintento).
- **Ítems afectados**: `PASO:2b`, `DEC-MIG-005#📌7`, `DEC-MIG-002#📌3`; `AC:CORTE:5` y
  `TEST:CORTE:6` de `30-el-corte.md`.
- **Por qué las fuentes no lo deciden**: el ensayo *«es verde cuando cada verificación que este §4.2
  nombra pasó, en su orden»* (`D/16-fase-7-del-paraguas.md:146`, `:1055`), y la rama de aborto es
  parte del §4.2 (`:432`–`:494`), pero ninguna línea dice que el ensayo la recorra; el momento 3 sólo
  pide releer *«las dos situaciones que una restauración no deshace»* (`:1050`). `TEST:CORTE:6` está
  marcado inferido.
- **Pregunta al owner**: ¿se ensaya la rama de aborto antes del corte?
  1. **Recomendada.** Sí: el ensayo en `staging` la recorre una vez, provocando una falla después del
     1b, con la misma copia de la base. Costo: una corrida más del ensayo. Riesgo: ninguno sobre
     producción; es la única red que ve la rama antes del día del corte.
  2. No: se declara que la rama de aborto se corre por primera vez si hace falta, el día del corte.
     Costo: cero. Riesgo: una restauración nunca probada sobre producción.
  - Ejemplo: si el día del corte el 1b deja sin cancelar el preapproval de una de las tres cuentas
    con débito, la rama restaura el 2b y Juan, que todavía no existe como cliente, no ve nada; las
    cinco cuentas esperan el reintento con el sitio en sólo lectura.

## Con qué etiqueta va el smoke de la medición de `EX-49`

- **Qué falta**: la etiqueta de smoke (`staging` o `prod`) de la medición de `EX-49` y del tope de
  purgas del borde.
- **Ítems afectados**: `PASO:0`, `MP:EX-49`; `AC:CORTE:2` y `TEST:CORTE:2`.
- **Por qué las fuentes no lo deciden**: el paso 0 son *«tres cosas y ninguna en producción»*
  (`D/16-fase-7-del-paraguas.md:146`), pero la medición lee *«la distribución de dominios de la tabla
  de usuarios de producción»* y manda correos a cuentas reales del owner (misma línea), y el momento 4
  la pone entre los gates del corte real (`:1064`). Escribí `prod` (inferido).
- **Pregunta al owner**: ¿con qué etiqueta se registra?
  1. **Recomendada.** `prod`: lee datos de producción y es gate del corte real. Costo: ninguno.
     Riesgo: confundirla con un smoke que muta producción; no muta nada.
  2. `staging`, a la letra de *«ninguna en producción»*. Costo: ninguno. Riesgo: que la etiqueta
     de `staging` se retire sin haber leído la tabla real.
  - Ejemplo: si Juan se registra con una casilla de Outlook con puntos, la lista medida decide si su
    seudónimo los ignora; se mide sobre la tabla de producción antes del corte.
