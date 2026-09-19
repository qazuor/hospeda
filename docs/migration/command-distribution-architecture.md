# Distribución unificada de comandos e instrucciones

La fuente de verdad debe vivir en un repositorio de tooling separado del código de Hospeda. Cada cliente recibe archivos derivados, nunca una copia editada manualmente.

## Capas

| Capa | Contenido | Alcance |
|---|---|---|
| `qz-core` | CLI genérico, adapters, guards, bootstrap y contratos | Cualquier proyecto |
| `hops-hospeda` | Linear HOS, DB/template, servidores, envs, specs y aliases | Sólo Hospeda |
| `agent-packs` | Adaptadores de instalación para Codex, OpenCode y Claude | Máquina/cliente |
| Proyecto | `.qz/project.json`, `AGENTS.md`, `CLAUDE.md` compatible y overrides | Checkout concreto |

## Fuente y derivados

La fuente canónica tendrá un manifest con versión, hashes y destino por cliente. El instalador:

1. detecta clientes disponibles;
2. crea un plan sin escribir nada;
3. verifica que el destino esté dentro de una allowlist;
4. instala mediante copias versionadas o archivos generados;
5. deja un manifest de origen/hash/versión;
6. valida que Codex, OpenCode y Claude reciban las mismas reglas semánticas.

No se recomiendan symlinks como mecanismo principal: rompen al mover repositorios, complican backups y pueden apuntar a una rama mutable. Las copias generadas son más robustas; el manifest permite detectar drift y regenerar.

## Reglas de precedencia

1. Instrucciones universales globales.
2. Perfil del cliente (Codex/OpenCode/Claude).
3. Adaptador del proyecto.
4. Instrucciones locales del checkout.
5. Overrides explícitos y versionados.

`AGENTS.md` será corto y universal. `CLAUDE.md` se conservará como archivo compatible generado desde la misma fuente, sin conocimiento exclusivo de Claude. OpenCode usará sus commands/skills derivados y Codex su distribución equivalente.

## Actualización

- `qz install --plan` muestra drift.
- `qz install --apply` requiere confirmación y backup previo.
- `qz install --check` valida hashes y destinos.
- La actualización nunca pisa un archivo local modificado sin crear backup y reportar conflicto.
- El instalador genérico no instala el adapter Hospeda salvo que detecte y confirme el proyecto.

## Hospeda

El adapter Hospeda registra `hops`, `hops-staging`, `.claude/project.config.json`, `.qz/project.json`, `hospeda-staging`, fuentes de env, template DB, wrappers Fish y comandos `/hops-*`. El bootstrap genérico sólo prepara la workstation; el adapter de proyecto deja el checkout listo.

## Criterios para implementarlo

- instalar una workstation nueva en modo plan y apply;
- detectar los tres clientes y omitir los ausentes;
- regenerar comandos después de un cambio en la fuente;
- detectar divergencia en `AGENTS.md`/`CLAUDE.md`/skills;
- no leer ni copiar secretos;
- rollback completo desde el manifest y backups;
- prueba con una segunda configuración de proyecto antes de extraer `qz` del tooling Hospeda.

La implementación queda para la etapa final del tooling, después de validar el contrato con Hospeda y un segundo proyecto.
