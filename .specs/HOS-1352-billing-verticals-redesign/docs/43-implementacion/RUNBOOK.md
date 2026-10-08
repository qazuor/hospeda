# Implementación de HOS-1352 con agentes (FASE 10 en adelante)

Para trabajar sin un coordinador central: el owner elige el agente y le da una hoja, y el agente la
lleva hasta un PR verde. Las reglas de abajo reemplazan a la coordinación.

## Lo que hay

- **La spec**: `.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/` (cerrada el 2026-10-03,
  0 BLOQUEA). Es la ÚNICA fuente para implementar (`DEC-METH-019`). Mientras #3360 no esté
  mergeado, se lee desde el worktree de la spec:
  `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`.
- **El árbol**: 209 hojas en Linear bajo HOS-1352 (`42-arbol-linear/arbol.json`; `creados.json`
  mapea cada clave a su issue). Cada hoja dice qué AC cubre, en qué archivo de la spec están, de qué
  depende y por qué (`por_que`), y en qué fase va (`corte`: `hecha`, `mvp`, `fase-1` a `fase-4`). Al
  2026-10-07 quedan **130 hojas del MVP** (320 AC, camino crítico de 24 hojas); las de `fase-*` no se
  implementan en esta épica. El calendario de olas está al final de `42-arbol-linear/arbol.md`.
- **La rama épica**: `epic/HOS-1352-verticales-billing` (`DEC-ARCH-016`, `DEC-CI-001`). Todos los
  PR de las hojas van ahí, NO a `staging`. La épica se mergea a `staging` una sola vez, al final.
- **El orden**: `python3 siguiente.py` (en esta carpeta) lista las hojas listas: las del MVP cuyas
  dependencias del árbol están todas en Done **y** que no tienen en Linear una relación «blocked by»
  abierta (algunas existen sólo en Linear; el script las lee y muestra la hoja como RETENIDA). Nunca
  propone una hoja de `fase-*`. Corre sólo con `LINEAR_API_KEY` y no escribe nada.

## Quién hace qué

| Rol | Modelo | Por qué |
|---|---|---|
| Implementador de piezas de dinero y máquinas de estado (`B3`, `B4`, `B5`, `B7`, `B11`, `B12`) | Codex | Un error ahí cobra mal; vale el costo |
| Implementador del resto | OpenCode con un flash (GLM 5.3, DeepSeek V4, Qwen3.8 o MiMo 2.6) | Volumen; lo atajan los gates y el revisor |
| Revisor de cada PR | Un modelo **distinto** del que implementó, con contexto limpio | Ojos frescos; nunca el mismo agente |
| Merge | El owner | Nunca un agente (`CLAUDE.md`, ramas protegidas) |

Cuando `siguiente.py` muestre varias listas de piezas distintas, se pueden correr en paralelo, en
worktrees separados (uno por implementador: dos agentes sobre el mismo worktree se pisan).

### PRs agrupados

Una hoja es la unidad de revisión, pero un PR puede llevar **hasta 3 hojas y unas 8 AC** cuando
están listas a la vez y encadenadas o vecinas. Reglas:

- **Nunca se mezcla una pieza de plata (`B3`, `B4`, `B5`, `B7`, `B11`) con otra pieza** en el mismo
  PR: un PR de plata es de una sola pieza. El calendario de `arbol.md` agrupa siempre dentro de una
  pieza.
- **Título**: el tag es el de la **primera** hoja (`[HOS-N] <tipo>(<scope>): …`); el cuerpo lista
  **todas** las hojas con su `HOS-N` y, por hoja, sus AC con el archivo:línea de la implementación y
  del TEST. Sin `Closes` ni otra palabra mágica.
- El revisor revisa hoja por hoja dentro del PR, con la misma definición de hecho.
- Al mergear, las hojas que no están en el título no se mueven solas en Linear: pasalas a Done a
  mano.

## El ciclo de una hoja

1. `python3 siguiente.py` → elegí una hoja LISTA (`HOS-N`).
2. Abrí el implementador en el worktree de implementación (abajo) y pegale el **prompt del
   implementador** con `HOS-N`. El agente:
   1. lee la hoja en Linear (por la API, con `LINEAR_API_KEY`) y la sección de la spec que cita;
   2. **si es la primera hoja de su pieza**: corre la verificación spec → fuente de esa pieza (regla del
      handoff) y, si encuentra un BLOQUEA, FRENA y lo reporta: no se codea sobre una spec rota;
      **si la hoja agrega una superficie a la interfaz del proveedor** (`@repo/payments`), agrega también
      al falso las mentiras y reglas de esa superficie, cada una con su fila en la lista de `G15` y su
      prueba (Coord-2; el reparto está en `B1.md`, `AC:B1:13` y `AC:B1:14`);
   3. corta `feat/HOS-N-<slug>` desde `origin/epic/HOS-1352-verticales-billing`;
   4. implementa SÓLO los AC de la hoja, cada uno con el TEST que le asigna el mapa AC→test de
      la pieza (mismo ID: `TEST:<pieza>:<n>` en el nombre o en un comentario del test);
   5. corre los gates (abajo), commitea y abre el PR a la rama épica con título
      `[HOS-N] <tipo>(<scope>): <descripción>`. Sin `Closes` ni magic words en el cuerpo: el merge lo
      cierra igual;
   6. corre `hops ci --wait` y deja el PR verde.
3. Abrí el revisor (otro modelo, sesión nueva) con el **prompt del revisor** y el número de PR. Si
   encuentra algo, se lo pasás al implementador y se repite.
4. `hops merge` → si dice LISTO, mergeás vos (`gh pr merge <N> --merge`). Linear pasa la hoja a Done.
5. Volvé al paso 1.

## Contra qué se da el OK a una hoja (definición de hecho)

Una hoja está hecha cuando cumple TODO esto. Si falta uno, no está hecha:

1. **Cada AC de la hoja** (campo `acs` de su nodo, también en su descripción) está implementado tal
   como lo dice la pieza en la spec, y tiene su TEST con el tipo que dice el mapa AC→test (unit,
   integración, e2e…). El TEST falla si se revierte la implementación (mutación mínima, hecha por el
   revisor).
2. **Nada fuera de la hoja**: no implementa AC de otras hojas ni «mejoras» que la spec no pide.
3. **Los guards** que la spec asigna a la pieza (`04-catalogos.md`, `GUARD:*`) y los del repo
   (`pnpm check:guards` si aplica) pasan.
4. **Los gates**: typecheck, lint (Biome) y los tests de los paquetes tocados, corridos por paquete
   (`pnpm --filter <paquete> ...`; nunca la suite completa de un paquete grande en local), con
   `CI=true`. CI del PR en verde (`hops ci --wait` → exit 0).
5. **Reglas del repo** (`CLAUDE.md`): estándares de código, migraciones por su carril, seed
   dual-write si toca datos sembrados y env vars registradas si agrega alguna.
6. **El revisor aprobó**, con evidencia por AC.

Lo que NO es criterio: que «ande», que el agente diga que terminó, o un CI verde sin los TEST de
los AC.

## Si la spec está mal o falta algo

El agente NO improvisa. Frena, deja un comentario en la hoja de Linear con la evidencia (spec
archivo:línea, fuente archivo:línea) y te avisa. Si hace falta una decisión, va al owner como letra
nueva de `41-corte-del-mvp/10-decisiones-del-owner.md` (la próxima es **DE**). La spec se corrige en
la rama de la spec, no en la de la hoja.

## El worktree de implementación

Uno solo para la épica. Las hojas son branches dentro de él, cortadas de la épica. Se crea una vez:

```bash
bash ~/.claude/skills/worktree/scripts/wt-create.sh feat hos-1352-impl
cd ../hospeda-feat-hos-1352-impl   # la ruta que imprima
git fetch origin && git switch --detach origin/epic/HOS-1352-verticales-billing
```

Cada hoja corta su branch desde ahí: `git switch -c feat/HOS-N-<slug> origin/epic/HOS-1352-verticales-billing`.

`hops start-issue` NO sirve acá: corta de `staging` y abre Claude. Para levantar los servers y la
DB del worktree: `hops servers-up`.

**Antes de la primera hoja**: la épica está atrás de `staging` (27 commits al 2026-10-04). Se
sincroniza con un PR de `staging` a la épica, sin branch intermedia:
`gh pr create --base epic/HOS-1352-verticales-billing --head staging --title "[NOSPEC:sync-umbrella] chore: merge staging into the umbrella branch"`.
No le pongas `HOS-1352` en el título: la automatización de Linear cerraría el paraguas al mergear.
Cuando el CI esté verde, se mergea con `--merge`. El guard `scripts/check-umbrella-branch-target.sh` no
se mete: sólo frena los PR a `staging` o `main` que llevan commits de la épica. Conviene repetir la
sincronización cada tanto, por ejemplo una vez por semana.

## Prompt del implementador

> Sos el implementador de la hoja `HOS-N` de HOS-1352. Antes de empezar, leé
> `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign/.specs/HOS-1352-billing-verticals-redesign/docs/43-implementacion/RUNBOOK.md`
> entero, el `CLAUDE.md` de la raíz y el de cada app o paquete que vayas a tocar. Seguí «El ciclo de
> una hoja», pasos 2.1 a 2.6, y la «definición de hecho». Leé la hoja en Linear con la API
> (`LINEAR_API_KEY`). Implementá sólo sus AC, cada uno con su TEST. Si la spec está mal o es
> ambigua, frená y reportalo; no improvises. Commits en inglés con conventional commits, sin
> atribución de IA, con `git add` de rutas explícitas y `CI=true git commit`. No mergees. Al
> terminar, mostrame: el PR, cada AC con el archivo:línea de su implementación y de su TEST, la
> salida de los gates y la de `hops ci --wait`.

## Prompt del revisor

> Sos el revisor escéptico del PR `#P` (hoja `HOS-N` de HOS-1352), con contexto limpio. Leé
> `.../docs/43-implementacion/RUNBOOK.md`, la hoja en Linear y la pieza de la spec que cita. Por
> cada AC de la hoja: (1) mostrá dónde está implementado y si dice exactamente lo que dice la spec;
> (2) revertí a mano la implementación de ese AC en una copia, corré su TEST y confirmá que falla;
> (3) marcá todo lo que el PR haga fuera de la hoja. Revisá además los gates del RUNBOOK y las
> reglas de `CLAUDE.md`. No edites el PR. Veredicto: APROBADO o CAMBIOS, con la lista de cambios y
> su evidencia.
