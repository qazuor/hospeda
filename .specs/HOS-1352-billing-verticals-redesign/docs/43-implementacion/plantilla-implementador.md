# Plantilla del prompt del implementador (coordinación por Claude)

El coordinador la llena por hoja y la pasa a `codex exec` u `opencode run`. Nada queda librado a
que el agente «entienda»: el alcance va escrito y después lo verifica `alcance.py`.

## Cómo la llena el coordinador

1. Copia el texto de cada AC de la hoja desde la pieza de la spec, LITERAL.
2. Arma la lista de **rutas permitidas**: los globs de los archivos que esos AC pueden tocar,
   deducidos de la spec (modelo, rutas, servicios, tests) y del código actual. Va en
   `<worktree>/.hoja/permitidas.txt`, una ruta o glob por línea. Lo que no está ahí no se toca.
3. Lista los AC de las hojas HERMANAS de la pieza, como lo que NO hay que hacer.
4. Fija el tope: un paquete por lanzamiento, o 90 minutos.

## El prompt

```text
Sos un implementador con alcance CERRADO. Hacés exactamente lo que dice esta tarea: ni más ni menos.

TAREA: hoja {HOS-N} ({clave}) de HOS-1352, pieza {pieza}. Worktree: {ruta}. Branch: {branch} (ya creada; no cambies de branch).

QUÉ HACER (los AC, copiados literal de la spec {archivo}:{líneas}):
{AC:x:n — texto literal}
{AC:x:m — texto literal}
Cada AC lleva su test con el ID del mapa AC→test de la pieza: {TEST:x:n (tipo)}, {TEST:x:m (tipo)}.

QUÉ NO HACER (son de otras hojas; aunque los veas a mano, no los toques):
{AC de las hojas hermanas, uno por línea}

ARCHIVOS: sólo podés crear, editar o borrar archivos que matcheen .hoja/permitidas.txt. Si para cumplir un AC necesitás tocar otro archivo, NO lo toques: anotalo en el informe como PEDIDO DE ALCANCE, con el motivo, y seguí con lo demás.

PROHIBIDO, sin excepción:
- Borrar un archivo o un test que no esté en permitidas.txt. Si algo deja de compilar fuera de tu alcance, no lo «arregles»: reportalo.
- Usar git para escribir (commit, add, stash, checkout de archivos, reset, push). El coordinador maneja git.
- Correr typecheck, lint o tests del monorepo entero (pnpm -r, turbo sin filtro) o la suite completa de apps/api, packages/service-core o packages/db. Typecheck y lint por paquete con --filter; tests sólo de los archivos que tocaste, con CI=true.
- Decidir algo de producto. Si la spec es ambigua, contradice al código o falta algo: FRENÁ y reportalo.
- Refactors, renombres, formateos o «mejoras» que ningún AC pide.

TOPE: {un paquete | 90 minutos}. Al llegar, frená y escribí el informe aunque no hayas terminado.

PROGRESO (obligatorio, te vigilan): agregá una línea a .hoja/progreso.md ANTES de cada paso y cada vez que termines uno, con este formato:
HH:MM | PASO n/total | qué estás haciendo | archivo(s) | siguiente
Por ejemplo: «14:32 | PASO 3/7 | adapto el middleware de cuota | apps/api/src/middlewares/ai-quota.ts | test del AC:U1:2».
Antes de tocar el primer archivo, escribí tu plan como PASO 0 con la lista numerada de pasos. Si pasan 15 minutos sin que puedas escribir una línea nueva, porque un comando tarda o porque estás trabado, escribí qué está pasando. Un vigía externo te corta si: tocás un archivo fuera de permitidas.txt, el worktree no cambia en 20 minutos o superás el tope.

INFORME OBLIGATORIO: al terminar o frenar, escribí .hoja/informe.md con EXACTAMENTE estas secciones:
## Estado
HECHO | PARCIAL | FRENADO, y una línea de por qué.
## AC
Por cada AC: estado, implementación (archivo:línea) y test (archivo:línea, con su TEST:x:n).
## Archivos tocados
Cada archivo con A/M/D y una línea de qué y por qué.
## Pedidos de alcance
Archivos fuera de permitidas.txt que harían falta, con el motivo. Vacío si no hay.
## Preguntas
Ambigüedades o decisiones que no tomaste. Vacío si no hay.
## Gates
Comando exacto y resultado de cada uno.
```

## Cómo lo lanza y lo vigila el coordinador

1. Lanza el agente en segundo plano, con su salida a un log:
   - Codex: `codex exec --json ... > <wt>/.hoja/agente.log 2>&1`. Cada herramienta que usa queda como un evento.
   - OpenCode: `opencode run --format json ... > <wt>/.hoja/agente.log 2>&1`.
2. Con su PID, lanza el vigía, también en segundo plano:
   `python3 vigia.py <wt> <pid> --tope 90 --idle 20 --cada 5 --matar`.
   El harness avisa cuando el vigía sale. El código de salida dice por qué:
   - 0: el agente terminó;
   - 2: se fue de alcance, y el vigía ya lo mató;
   - 3: quedó quieto 20 minutos (colgado o en loop);
   - 4: llegó al tope.
3. Mientras corre, cualquiera puede ver el estado:
   - `tail -f <wt>/.hoja/vigia.log`: una línea cada 5 minutos, con tiempo, archivos cambiados, último cambio, CPU y la última línea del agente;
   - `tail -f <wt>/.hoja/progreso.md`: el plan y los pasos que va escribiendo el agente;
   - `<wt>/.hoja/agente.log`: el detalle de cada acción.
4. Si el agente no escribe `progreso.md`, el vigía igual lo controla por los archivos que cambian. El
   progreso sirve para entender qué hace; la seguridad no depende de que el agente lo escriba.

## Lo que hace el coordinador al volver

1. `python3 alcance.py <worktree>`: si un archivo tocado no matchea `permitidas.txt`, la hoja se
   RECHAZA sin mirar más. Revierte esos archivos y relanza al implementador con el rechazo.
2. Lee el informe y el diff. Los pedidos de alcance los aprueba él (sumándolos a
   `permitidas.txt` y relanzando) o los sube al owner si implican producto.
3. Lanza al revisor, que es otro modelo, con mutación por AC.
4. Recién con el revisor APROBADO: commitea, pushea, abre el PR y corre `hops ci --wait`.
