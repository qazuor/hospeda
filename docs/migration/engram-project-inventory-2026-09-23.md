# Inventario estructural de Engram — 2026-09-23

Consulta read-only de nombres, conteos y metadatos agregados. No se leyeron
contenidos de memorias.

## Grupos relacionados con Hospeda

- `hospeda`: 3.045 observaciones activas. Es el proyecto canónico actual.
- `Hospeda`: 2 observaciones activas. Es una variante de capitalización y debe
  revisarse antes de consolidarla.
- `hospeda-*`: varios proyectos de issues/specs históricos, cada uno con pocos
  registros. El grupo `hospeda3-*` fue soft-deleted en el Gate 216; no quedan
  observaciones activas en ese prefijo.
- `hospeda-api`, `hospeda-hos-*`, `hospeda-spec-*`, `hospeda-smoke-*` y
  `hospeda-beta-*` son namespaces históricos asociados por nombre, pero no se
  consolidan automáticamente porque pueden conservar contexto útil de una
  issue o spec.
- `api`, `admin`, `web`, `server-tools`, `seed` y `qzpay` tienen pocos registros
  y podrían ser sesiones antiguas detectadas desde subdirectorios; el nombre por
  sí solo no prueba que deban fusionarse.

## `tmp`

`tmp` tiene 5.259 observaciones activas y 9.492 sesiones. El 99,9% de las
observaciones son de tipo `passive` y fueron creadas por
`engram-autosave-SessionEnd`; las sesiones apuntan principalmente a `/tmp` y se
distribuyen entre 942 sesiones con observaciones.

Esto parece ruido de autosave, pero no se borra todavía en este gate porque el
grupo es grande y no se inspeccionó semánticamente. Requiere backup y una
decisión separada: soft-delete por lote, conservar sólo ventanas recientes o
desactivar el autosave que lo produce.

## Observaciones sin proyecto

Hay 1.078 observaciones activas sin nombre de proyecto. Sus sesiones tampoco
conservan un directorio útil para atribuirlas. No se deben fusionar con
`hospeda` por inferencia.

## Conclusión

El único grupo eliminado inequívocamente por autorización fue `hospeda3` y su
familia `hospeda3-*`. La siguiente revisión de memoria debe tratar por separado
`Hospeda`, los namespaces `hospeda-*`, `tmp` y las observaciones sin proyecto.
