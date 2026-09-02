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
| `stats` | Estadísticas del repo: código, tests, deuda técnica, cobertura por paquete, commits, higiene de PRs, balance del backlog de Linear y uso de disco. Con historial para comparar corridas. |
| `wt-clean` | Lista los worktrees con su estado, te deja tildar cuáles borrar, y los da de baja completos vía `wt-remove.sh` (servers + base de datos + worktree + branch). |
| `start-issue` | Lee un issue de Linear, arma el worktree con su branch cortada de `staging`, y abre Claude adentro. |

Cada uno tiene su propio `--help` con el detalle.

## Instalación

```bash
./install.sh
```

Instala dependencias y escribe cuatro funciones de fish en
`~/.config/fish/functions/`. Se autocargan: no hace falta reiniciar la terminal.
`./uninstall.sh` las borra.

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
bun install       # dependencias
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
