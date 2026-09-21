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
