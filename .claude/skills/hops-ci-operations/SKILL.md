---
name: hops-ci-operations
description: Diagnóstico de CI, merge gates y operaciones de Coolify en Hospeda.
---

# CI y operaciones

- Ejecutá `hops merge --plan` antes de recomendar un merge.
- Un PR `DIRTY` o `CONFLICTING` puede no disparar workflows de `pull_request`;
  resolver conflictos es el paso correcto, no reintentar el mismo push.
- Un estado `UNKNOWN` de GitHub requiere reconsulta y no equivale a estar listo.
- El adapter valida checks, conflictos, base esperada y estado del PR. No
  inventes un resultado cuando GitHub no respondió.
- Las particularidades de Coolify y producción son operativas y sensibles:
  consultá los comandos read-only del adapter y no copies credenciales ni
  endpoints privados a instrucciones compartidas.

## Coolify

- Tratá Coolify como una capa externa de despliegue; el repositorio y Git siguen
  siendo la fuente de verdad del código.
- Usá identificadores y labels declarados por la plataforma para localizar una
  aplicación o contenedor. No hardcodees nombres derivados de una ejecución
  concreta.
- Para inspección preferí `hops server find`, `hops server docker-by-name`,
  `hops server env-list`, `hops server logs`, `hops server health` y
  `hops server free-mem`. Sus salidas deben redaccionar valores sensibles.
- `redeploy`, `exec`, `app-restart`, `env-set`, `env-delete`, `env-pull` y
  limpieza de logs son operaciones con efectos: requieren destino explícito y
  confirmación según la política del comando.
- Separá las operaciones de diagnóstico read-only de las mutaciones de deploy,
  restart o rollback. Las últimas requieren autorización explícita.
- Las URLs, tokens, IDs de recursos y archivos de credenciales permanecen fuera
  del adapter versionado y nunca deben aparecer en logs o reportes.
