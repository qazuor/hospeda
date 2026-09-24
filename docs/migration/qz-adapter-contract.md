# Contrato del adapter qz

`.qz/project.json` describe únicamente comportamiento portable y no secreto de
un proyecto para los comandos genéricos `qz-*`. Hospeda puede agregar su propia
capa `hops-*`, pero no debe obligar al núcleo a conocer nombres de apps,
credenciales o bases concretas.

## Secciones declarativas

- `projectId`, `adapter`, `displayName`: identidad del proyecto.
- `issues`: proveedor, team key y patrón de identificadores.
- `branches`: base, protegidas, patrón de branches, promoción y back-merges.
- `worktree`: patrón de path, fuente protegida de envs, install y build.
- `database`: estrategia, container/template, patrón de nombres, archivo y
  variable de conexión, fingerprints y tablas sentinel.
- `servers`: id, puerto inicial, variable de puerto, comando de arranque y
  health path.
- `commands`: prefijos y origen de comandos del proyecto.

## Fuera del adapter

No se ponen en `.qz/project.json` passwords, tokens, claves, URLs privadas,
templates de conexión con credenciales, defaults sensibles ni comandos de
limpieza destructiva. Esos datos permanecen en configuración protegida local o
en un mecanismo específico del proyecto.

## Compatibilidad

Los scripts aceptan `.qz/project.json` como fuente principal y conservan
fallback a `.claude/project.config.json` durante la migración. El fallback se
retira sólo cuando el contrato cubra de forma segura todos los casos de uso y
exista validación de migración para cada proyecto.

## Validación mínima

```bash
node tools/qz/validate-project.mjs .
```

El validador es read-only, rechaza campos sensibles conocidos y verifica las
formas necesarias para branches, worktrees, DB, servidores y prefijos.
