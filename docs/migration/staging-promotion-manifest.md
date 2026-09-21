# Manifest de promoción hacia `staging`

Este manifest se calcula contra `staging...HEAD` y debe revisarse antes de
cualquier promoción. Estado actual: **planificado; no aplicado**.

- Rama fuente: `chore/opencode-gentle-ai-migration`
- Rama destino: `staging`
- Archivos candidatos: 110
- Código operativo: 73
- Documentación de migración: 32
- Configuración del proyecto: 3
- Bootstrap genérico: 1
- Artifact tooling: 1

## Orden recomendado

1. Configuración del proyecto y guards.
2. Código de envs, worktrees, template y DB.
3. Comandos `hops` y sus tests.
4. Validación en un worktree temporal.
5. Documentación de migración.
6. Artifact tooling y bootstrap genérico.
7. `hops update --json`, drift, template status y E2E completo.

## Regla de seguridad

No hacer merge ciego de toda la rama. El bloque operativo debe revisarse como
unidad; los documentos, artifact y bootstrap pueden viajar en el mismo PR sólo
si la revisión lo aprueba.

No se incluyen `.env`, credenciales, bases Engram ni estados locales. Este
manifest tampoco crea `develop`, cambia protecciones, muta Linear, hace push,
instala plugins ni activa `qz install --apply`.

La lista exacta de archivos se regenera con:

```bash
git diff --name-only staging...HEAD
```
