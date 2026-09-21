# client-tools — el `hops` de tu máquina

El gemelo local de [`server-tools`](../server-tools/README.md). Aquel opera el VPS
(Docker, Coolify, backups, DB de producción); éste opera **tu clon del repo**:
estadísticas, worktrees, y arranque de issues.

Misma forma deliberadamente: un binario `hops` que sin argumentos abre un menú y
con argumentos despacha a un sub-comando.

```bash
hops                      # menú interactivo
hops --help               # lista de comandos
hops stats --section code # un comando directo
```

Cada comando existe **además** como binario propio, con los mismos argumentos:

```bash
hops-stats
hops-wt-clean
hops-start-issue 273
```

No son atajos que dupliquen lógica: son alias que entran por el mismo dispatcher,
así que `hops stats` y `hops-stats` no pueden divergir. Hay un test que lo exige.

## Comandos

| Comando | Qué hace |
|---|---|
| `artifact` | Valida, publica, lista y lee el estado de artifacts locales versionados. |
| `stats` | Estadísticas del repo: código, tests, deuda, Git, PRs, Linear y disco. |
| `wt-clean` | Inventaría y limpia worktrees seleccionados, con sus recursos asociados. |
| `start-issue` | Lee Linear, prepara el worktree y abre Claude u OpenCode (`--agent`). |
| `close-issue` | Preflight de cierre: cambios, commits, spec, PR, CI y smoke gates. |
| `handoff` | Produce un handoff autocontenido con hechos, hallazgos y próximo paso. |
| `recap` | Resume el estado estático de la sesión/worktree para el agente. |
| `context` | Entrega contexto compacto y verificable de un issue/worktree. |
| `issue-preflight` | Consulta issue, labels y recursos de Linear sin mutar nada. |
| `smoke-plan` | Calcula los smoke gates requeridos por labels del issue. |
| `verify` | Ejecuta los pasos del CI local; usar primero `--changed`. |
| `test` | Ejecuta tests por categoría o paquete. |
| `ci` | Consulta el estado del PR y sus checks, con espera opcional. |
| `merge` | Dictamina si el PR está listo; no hace merge. |
| `env` | Comprueba variables necesarias sin imprimir secretos. |
| `run` | Busca y ejecuta scripts del repo con argumentos explícitos. |
| `db-start` / `db-stop` | Inicia o detiene Postgres y Redis compartidos. |
| `db-migrate` / `db-seed` | Migra o carga la base del worktree. |
| `db-studio` / `db-fresh` | Abre Drizzle Studio o rehace la base desde template. |
| `db-update-template` | Actualiza el template de base desde staging. |
| `servers-up` / `servers-down` | Levanta o detiene los servidores del worktree. |
| `update` | Actualiza client-tools desde la copia de staging. |

Cada uno tiene su propio `--help` con el detalle.

## `hops ci --wait` — esperar el CI en una sola llamada

`hops ci` contesta "¿está verde ahora?". Con `--wait` bloquea hasta que el run
cierra y devuelve **una línea**. No imprime nada mientras espera: si hubiera que
leer los estados intermedios para encontrar la respuesta, no habría ahorrado la
lectura.

```bash
hops ci --wait                 # techo de 30 minutos
hops ci --wait --timeout=15    # en minutos, entre 1 y 180
```

### Códigos de salida

| Código | Titular | Qué pasó |
|---|---|---|
| 0 | `VERDE` | Cerró y pasó |
| 1 | `ROJO` / `CI CORTADO` / `EN CONFLICTO` / `SIN PR` / `NO PUDE CONSULTAR` | Cerró mal, o no se pudo preguntar |
| 3 | `SIN ARRANCAR` | Cero checks en toda la espera: **no corrió nada** |
| 4 | `TIMEOUT` | Seguían corriendo al llegar al techo |

**`CI CORTADO` no es un test roto.** Sale cuando *todos* los checks fallados
fueron cortados (`CANCELLED` / `TIMED_OUT`): el `timeout-minutes` del job, o un
push nuevo que reemplazó el run. Bloquea el merge igual — los checks no están
verdes — pero no hay nada que debuggear, se re-corren. Si además hay una falla
real, el titular vuelve a ser `ROJO`: un fallo genuino nunca se esconde detrás
de una cancelación.

**3 y 4 no son fallas.** Son las dos formas de no saber, y tienen código propio
justamente para que no se confundan con una falla: si `TIMEOUT` saliera 1,
quien lee el resultado se pone a debuggear un rojo que nunca existió. Un 4 se
reintenta con más `--timeout`; un 3 se resuelve redisparando el workflow (un
commit vacío alcanza) o resolviendo el conflicto que impide que GitHub lo
dispare.

### Qué NO cubre

- **No dice por qué falló.** Lista los checks rojos por nombre y nada más; el
  diagnóstico (job, step, líneas del log) es otro comando.
- **No mira si el PR se puede mergear.** `BEHIND`, `BLOCKED` y las reglas de la
  base no entran en el veredicto: esto responde por los checks, no por el merge.
  Para eso está `hops merge`.
- **No sirve en `main` ni en `staging`**, que no tienen PR propio.
- **Depende de que la branch se resuelva.** Si el worktree está en detached
  HEAD, el comando corta con exit 1 en vez de consultar por una branch inventada.

## `hops merge` — el gate, en un veredicto

Dictamina si el PR de la branch se puede mergear. **No mergea**: el merge sigue
siendo una decisión tuya. Devuelve **una sola razón**, la primera que bloquea —
una lista de seis problemas es una lista para triar; la primera razón es la
cosa que hay que ir a arreglar.

```bash
hops merge
```

| Código | Titular | Qué pasó |
|---|---|---|
| 0 | `LISTO` | Abierto, a staging, `CLEAN`, y todos los checks verdes |
| 1 | `BLOQUEADO` | Hay una razón concreta, y te la dice |
| 3 | `NO SÉ` | GitHub nunca terminó de calcular la mergeabilidad |

### Por qué reconsulta

`mergeable` y `mergeStateStatus` se calculan **de forma perezosa**: GitHub
arranca el cálculo cuando se los pedís y contesta `UNKNOWN` mientras tanto.
Medido acá: **3 de 8 PRs abiertos dieron `UNKNOWN` en la primera consulta y 0
de 8 en la segunda**. Leer ese `UNKNOWN` como "se puede mergear" es fail-open;
leerlo como conflicto es mentira. Por eso se reconsulta, y si aun así no
resuelve, el veredicto es `NO SÉ` con código propio.

### Qué mira, y qué no

- **`BEHIND` bloquea aunque esté todo verde.** Esos checks corrieron sobre otro
  merge-base: no dicen nada del código que realmente se mergearía.
- **Los checks se juzgan uno por uno**, no por `UNSTABLE`: ese estado dice "no
  está verde" sin distinguir un test roto de uno que todavía corre, y esas dos
  cosas se responden distinto.
- **No mira el título.** De eso ya se ocupa el check `Validate PR Title`, y su
  resultado llega con los demás checks. Re-derivar ese regex acá crearía una
  segunda fuente de verdad que diverge apenas alguien toque el workflow.

## Instalación

```bash
./install.sh
```

Instala dependencias y escribe cuatro funciones de fish en
`~/.config/fish/functions/`. Se autocargan: no hace falta reiniciar la terminal.
`./uninstall.sh` las borra.

Para una instalación automatizada que no permita caer a otra rama si
`hospeda-staging` todavía no tiene el tooling actualizado:

```bash
./install.sh --strict-staging
```

Para validar la fuente sin instalar dependencias ni escribir funciones de Fish:

```bash
./install.sh --check --strict-staging
```

`--here` sigue disponible para desarrollar el propio CLI desde el checkout
actual.

## Correr con bun, no con Node

Como `server-tools`, este paquete corre con **bun** y vive fuera del workspace de
pnpm (`pnpm-workspace.yaml` sólo incluye `apps/*` y `packages/*`). Tiene su propio
`package.json`, su propio `bun.lock` y su propio `tsconfig.json`.

La diferencia con el del servidor es que acá **no hay paso de compilación**. Allá
`install.sh` compila un binario standalone con `bun build --compile` porque el VPS
no debería depender del árbol de fuentes; acá los binarios de `bin/` son shims
`#!/usr/bin/env bun` que ejecutan el TypeScript directamente. Editás un archivo y
la próxima corrida ya lo usa. No hay `dist/` que se quede viejo.

```bash
bun install --frozen-lockfile # dependencias reproducibles
bun test          # tests
bunx tsc --noEmit # typecheck
bun run src/index.ts <comando>   # correr sin instalar
```

## Agregar un comando

1. Escribí la lógica en `src/commands/<nombre>/`, exportando una función que
   reciba `{ argv }` y **devuelva** el exit code (nunca `process.exit`: un comando
   que se apropia de la salida no se puede componer ni volver al menú).
2. Envolvela en `src/commands/<nombre>/command.ts` como un `ClientCommand`.
3. Registrala en `src/registry.ts`. La carga es dinámica a propósito: `stats`
   arrastra una docena de colectores, y pagarlos para imprimir un `--help` hace
   que el menú se sienta lento sin razón.
4. Creá `bin/hops-<nombre>` copiando cualquiera de los existentes.

El test de `test/registry.test.ts` falla si un comando queda sin binario, si un
binario queda sin comando, o si una entrada del registro apunta a un módulo que
no carga.

## Configuración

`stats` y `start-issue` consultan la API de Linear. Necesitan una key personal en
`~/.config/hops-stats/config`:

```
LINEAR_API_KEY='lin_api_...'
```

El archivo, y no sólo la variable de entorno: una universal de fish no la ve un
subproceso ni un cron. `chmod 600`.

El workflow de worktrees busca primero los scripts versionados en
`scripts/worktree/`. Para una instalación externa o una copia de transición se
puede indicar otra ubicación con `HOPS_WORKTREE_SCRIPT_DIR`; sólo se usa si allí
existe `wt-create.sh`. El fallback histórico en `~/.claude/skills/worktree`
queda como compatibilidad temporal.

## `hops artifact` — snapshots locales

Con el servidor local de `tools/artifact-app` corriendo:

```bash
hops artifact validate ./bundle.json
hops artifact publish ./bundle.json
hops artifact list
```

`publish` ejecuta el publisher determinista del prototipo y no llama al modelo,
Linear ni Engram. `list` solo consulta el endpoint local. El command no publica
remotamente ni cambia Git.
