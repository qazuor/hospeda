# Auditoría read-only de Engram

Fecha: 2026-09-15.

Esta auditoría se ejecutó sobre una copia temporal de `~/.engram` en
`/tmp/hospeda-engram-audit-20260915`. La base original no se usó para exportar,
listar proyectos ni ejecutar diagnósticos.

## Revalidación posterior a la limpieza de memorias

Se creó una nueva copia temporal del estado actual en
`/tmp/hospeda-engram-audit-current-20260915` y se comparó con el export anterior.

- DB actual: 71,483,392 bytes; WAL: 8,474,872 bytes; SHM: 32,768 bytes.
- Observaciones actuales: 9.706, frente a 9.850 en el inventario anterior.
- Sesiones: 11.776, sin reducción observable; prompts: 65.
- La diferencia por IDs es 149 observaciones eliminadas y 5 nuevas.
- Las 149 eliminadas pertenecían al proyecto `hospeda`; por tipo fueron 44
  decisions, 43 discoveries, 35 bugfixes, 10 architecture y grupos menores.
- Las 5 nuevas son 3 `session_summary` y 2 `decision`, repartidas entre
  `hospeda` y `hospeda2`.
- No quedan filas con `deleted_at`; la reducción parece eliminación física o
  una operación equivalente, no soft-delete.

La copia actual pasa `PRAGMA integrity_check = ok`, igual que la copia anterior.
`PRAGMA foreign_key_check` devuelve 97 observaciones que referencian sesiones
ausentes; esas violaciones ya estaban presentes en la copia anterior y no se
atribuyen a la limpieza reciente. No se repararon ni se eliminaron esas filas.

## Integridad de la copia

- DB: 68,231,168 bytes.
- WAL: 4,836,912 bytes.
- SHM: 32,768 bytes.
- Los tres checksums coinciden con el backup Stage 0 y con la instalación activa.
- La base original no mostró cambios de contenido después de la prueba.

## Inventario agregado

- 11.772 sesiones.
- 9.850 observaciones.
- 65 prompts.
- 199 nombres de proyecto.
- Los mayores grupos son `tmp` (5.259 observaciones), `hospeda` (2.103),
  `hospeda2` (946) y 1.103 observaciones sin proyecto.
- Tipos principales: `passive` (5.632), `decision` (1.040),
  `session_summary` (917), `discovery` (801) y `bugfix` (621).
- `tmp` concentra 5.259 observaciones y casi todas son `passive`; debe quedar
  como candidato a cuarentena, no a incorporación automática.
- 1.103 observaciones no tienen proyecto asignado. `hospeda` concentra la
  memoria más útil para conservar inicialmente: decisiones, descubrimientos,
  bugfixes y resúmenes.
- Hay 2.957 observaciones con `topic_key` y 2.877 claves distintas; el campo
  necesita una revisión de duplicados real sobre títulos/contenidos en la copia.
- El análisis por hash encontró un único grupo de 33 observaciones con contenido
  exactamente vacío. Hay 16 observaciones sin título.
- Hay 259 grupos de títulos repetidos (1.431 observaciones involucradas), pero
  el título repetido no prueba que el contenido sea duplicado; no se eliminarán
  por título solamente.
- Las 1.103 observaciones sin proyecto están compuestas principalmente por
  decisiones, descubrimientos, bugfixes y arquitectura, así que requieren
  clasificación antes de asignarlas o descartarlas.

## Hallazgos

La memoria está efectivamente mezclada: contiene proyectos temporales, nombres
de worktrees/issues, variantes de Hospeda y observaciones sin proyecto. El tipo
`passive` representa más de la mitad del volumen, por lo que no conviene activar
todo el contenido indiscriminadamente como contexto automático.

La interfaz disponible para curación incluye `tui`, `projects consolidate`,
`conflicts`, `delete` con soft-delete por defecto, `export` y
`obsidian-export`. El binario intenta comprobar actualizaciones por Internet y
algunos comandos de ayuda abren una migración de DB; por eso todas las pruebas
futuras deben usar una copia y una variable `ENGRAM_DATA_DIR` aislada.

Engram `1.20.0` no expone un subcomando `restore`. `import` recibe un archivo y
modifica la base, por lo que no es equivalente a restaurar el estado completo.
El rollback debe basarse en una copia consistente de todo `~/.engram`, incluidos
DB, WAL, SHM y metadatos, verificada con checksums. El JSON exportado sirve como
segunda red de auditoría, pero no reemplaza el backup binario.

## Resultado del dry-run de consolidación

El algoritmo sugirió cuatro grupos, pero dos son demasiado amplios para aplicar
sin revisión humana:

- `Asistia` + `new-asistia` → `Asistia`: candidato razonable, pendiente de
  verificar pertenencia.
- Decenas de proyectos HOS, SPEC, worktrees y nombres genéricos → `hospeda`:
  no aplicar automáticamente porque mezclaría historiales con distinta
  trazabilidad.
- `qazuor` → `qazuor.com`: revisar antes de fusionar.
- `claude-config` → `tmp`: sugerencia incorrecta; debe rechazarse.

Por lo tanto, `projects consolidate --all` no será la estrategia de limpieza.
Sólo se usarán fusiones explícitas y revisadas, con export previo.

## Procedimiento recomendado

1. Conservar el backup Stage 0 sin tocarlo.
2. Crear una copia de trabajo nueva y verificar DB/WAL/SHM.
3. Exportar JSON y generar un inventario agregado por proyecto, tipo, fecha y
   duplicados sin mostrar contenidos sensibles.
4. Clasificar proyectos en conservar, fusionar, congelar o descartar.
5. Usar `projects consolidate --dry-run` antes de cualquier consolidación.
6. Revisar conflictos y duplicados en la copia; preferir soft-delete.
7. Probar búsquedas y contexto para `hospeda` y los proyectos HOS relevantes.
8. Probar restauración en una tercera copia.
9. Recién después conectar el proyecto depurado al MCP de OpenCode.

No se ejecutaron `save`, `delete`, `consolidate --apply`, `sync`, `import`,
`setup`, `serve` ni `mcp` contra la DB histórica.

## Checkpoint read-only de la instalación activa — 2026-09-17

Se copió `~/.engram` a un directorio temporal y se ejecutaron las consultas con
`PRAGMA query_only=ON`. La DB activa actual pasa `integrity_check = ok` y
mantiene 97 filas devueltas por `foreign_key_check`, la misma anomalía ya
observada en la auditoría previa.

- observaciones: 9.754;
- sesiones: 11.801;
- prompts: 65;
- mutaciones de sync locales: 47.461;
- proyectos distintos en observaciones: 55;
- scopes distintos: 2;
- proyectos sin asignar: 1.103;
- principales grupos: `tmp` 5.259, `hospeda` 1.990, `hospeda2` 963;
- tipo `passive`: 5.644 observaciones.

La diferencia respecto del checkpoint anterior no se interpreta como limpieza
ni como deterioro sin una comparación por IDs y hashes. No se modificó la DB,
no se ejecutó sync/import/consolidate y no se muestran contenidos de memoria.

## Métricas de curación — 2026-09-17

Sobre otra copia temporal del mismo estado activo:

- 33 observaciones tienen contenido vacío;
- 16 no tienen título;
- hay 1 grupo de hash duplicado que involucra 33 filas;
- hay 259 grupos de títulos repetidos que involucran 1.445 filas;
- `tmp/passive` concentra 5.257 filas;
- las decisiones, descubrimientos y bugfixes sin proyecto siguen siendo una
  parte relevante y no deben asignarse automáticamente a `hospeda`.

Estas métricas sólo generan candidatos de revisión. No prueban que una fila sea
descartable: los títulos repetidos pueden representar sesiones distintas y un
hash compartido debe revisarse junto con proyecto, fechas y referencias.
