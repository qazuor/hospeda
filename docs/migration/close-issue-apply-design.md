# Diseño de aplicación de `close-issue`

Fecha: 2026-09-23.

`hops close-issue --plan` ya reúne el estado local, Linear, PR/CI, specs,
closeout y drift de variables. La fase de aplicación debe consumir ese plan y
rechazar cualquier dato incompleto antes de tocar un servicio externo.

## Contrato propuesto

```text
hops close-issue --plan --json
hops close-issue --apply --confirm HOS-NNN [--cleanup-worktree]
```

- `--plan` sigue siendo siempre read-only.
- `--apply` exige `--confirm` con el identificador exacto del issue.
- `--json` devuelve cada acción con `planned`, `applied`, `skipped` o `failed`.
- Sin `--cleanup-worktree` nunca elimina el worktree.
- El flujo sólo puede ejecutarse desde el worktree del issue y nunca sobre
  `main`, `staging` o `develop`.

## Orden seguro

1. Repetir el preflight inmediatamente antes de aplicar.
2. Rechazar si hay cambios sin commit, commits sin upstream, drift obligatorio,
   Linear/PR/CI no verificables, PR no mergeado o gates de smoke pendientes.
3. Aplicar únicamente el cambio de estado de Linear cuando el issue ya cumple
   los gates y el estado final configurado existe.
4. Leer Linear nuevamente y registrar el estado observado.
5. Limpiar el worktree sólo si se pidió explícitamente, está limpio y la
   branch ya no contiene commits exclusivos respecto de su upstream.
6. Emitir un recibo final; cualquier fallo posterior queda como `failed` y no
   se intenta compensar automáticamente.

## Límites

- No hace merge, push, cierre de PR ni back-merge: esos flujos tienen sus
  propios comandos y confirmaciones.
- No modifica specs ni crea `closeout.md` automáticamente.
- No exporta valores de `.env`, tokens ni respuestas completas de Linear.
- La mutación de Linear necesita una función GraphQL específica, una prueba
  aislada contra un issue descartable y una lectura posterior obligatoria.

## Estado

El preflight y su wrapper OpenCode están implementados. La mutación queda
pendiente de aprobación de la política de cierre y de una sesión con acceso
read/write controlado a Linear; no se ejecutó durante esta etapa.
