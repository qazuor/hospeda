# Engram: snapshot estructural actual

Fecha de lectura: 2026-09-21.

Este documento sólo registra metadatos agregados de la instalación activa. No
contiene textos de memorias, secretos ni credenciales, y no autoriza ninguna
mutación.

## Resultado

La consulta read-only `engram projects list` encontró 202 proyectos. Los grupos
con mayor volumen son:

| Proyecto | Observaciones | Sesiones | Lectura operativa |
|---|---:|---:|---|
| `tmp` | 5.259 | 9.492 | Candidato a cuarentena; no debe entrar automáticamente en contexto |
| `hospeda` | 3.036 | 1.628 | Candidato principal para revisión curada |
| `hospeda3` | 108 | 101 | Mantener separado hasta verificar pertenencia |
| `Asistia` | 55 | 1 | Proyecto distinto; no mezclar por similitud de nombres |
| `new-asistia` | 27 | 5 | Revisar junto con Asistia, sin consolidar todavía |

También aparecen proyectos de worktrees, issues, specs, herramientas y
proyectos históricos con cero observaciones pero sesiones registradas. La lista
por sí sola no permite decidir si una memoria es vigente, duplicada o ruido.

## Incidencias de la consulta

Engram intentó consultar actualizaciones y recibió HTTP 401. No se mostró ni se
registró ningún valor de credencial y la consulta de proyectos terminó con
éxito. No se ejecutaron `export`, `import`, `sync`, `delete`, `consolidate` ni
`save`.

## Decisión operativa

La siguiente etapa debe ser una revisión humana por lotes sobre una copia
aislada de `~/.engram`, siguiendo [engram-review-batches.md](./engram-review-batches.md)
y [engram-human-approval-packet.md](./engram-human-approval-packet.md). El
primer lote recomendado es el de memorias vacías/sin título; no se debe empezar
por `tmp` ni por una consolidación global.

## Lote A: conteo read-only

La consulta directa sobre la base activa, usando `sqlite3 -readonly` y sin
seleccionar texto, confirmó:

- 33 observaciones con contenido vacío.
- 16 observaciones con título vacío.
- 33 filas involucradas en un único grupo de `normalized_hash` repetido.
- Las filas vacías o sin título se reparten en 24 para `hospeda` y 24 sin
  proyecto; los conjuntos pueden solaparse.

Estos números sólo delimitan el lote. Para revisar una entrada se debe copiar
la base completa, mostrar un ID por vez en una interfaz local y registrar una
decisión explícita. No se autoriza eliminar por conteo, hash o proyecto.

## Snapshot temporal de revisión

Se creó `/tmp/engram-review-a-20260921` con DB, WAL y SHM copiados, y se
verificó `PRAGMA integrity_check = ok`. El inventario de candidatos contiene
48 filas únicas (los criterios de contenido vacío y título vacío se solapan).
El único hash repetido involucra 33 filas, con IDs entre 567 y 9720. El CSV
temporal contiene sólo IDs, tipos, proyectos, tamaños, fechas y hashes; no
contiene títulos ni contenidos. Los checksums quedaron junto a la copia para
detectar cambios antes de cualquier revisión.

## Resultado del lote A en la copia

Con las decisiones humanas registradas se aplicó un borrado lógico de 45 filas
en la copia temporal y se ajustaron los títulos de tres memorias conservadas:

- `668`: auditoría de estructura del Admin Panel.
- `3553`: preferencia de ejecutar tests acotados.
- `3708`: regla SSR para cargar Leaflet sólo del lado cliente.

La copia quedó con 9.800 observaciones activas, cero candidatas restantes del
lote A y `PRAGMA integrity_check = ok`. La instalación activa no se modificó.
