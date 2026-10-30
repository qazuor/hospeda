# Vueltas ciegas con Codex (HOS-1352, desde la vuelta 4)

Las vueltas 1 a 3 las corrió Claude Code. Desde la 4 las corre Codex con `codex exec`, con el mismo
método. Este archivo es el prompt para la sesión de Codex que orquesta, más lo que tiene que saber.

## Estado de partida

- Worktree: `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, branch
  `spec/HOS-1352-billing-verticals-redesign`, PR #3360 (abierto).
- Fuentes congeladas en `9149b84a25` (`scripts/comun.py` → `SHA`). `trazar` APROBADO, cobertura 750 de 750.
- Vuelta 3: 41 de 42 canarios detectados (VB 28/28, G 4/4, VA 9/10); 2 REAL BLOQUEA, ya corregidos en la
  pasada 6. Artefactos en `../vuelta-3/`.
- Decisiones del owner: hasta **CJ** (t16 de `docs/41-corte-del-mvp/10-decisiones-del-owner.md`). No se
  relitigan.

## Ciclo de una vuelta N

Desde la raíz del worktree, `S=.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/_trabajo/verificacion/codex`.
`MODEL` elige el modelo de Codex (vacío = el de tu config); `PAR` cuántos verificadores en paralelo (6).

1. `bash $S/vuelta.sh N preparar` — copia ciega en `~/.cache/hos1352/vuelta-N/v` (spec en HEAD sin
   `_trabajo` ni `scripts`; fuentes en el SHA congelado sin `spec-consolidada`; generadores sin
   `canarios_*.py`), copia prístina, briefs y bloques. Imprime las líneas de cada bloque VB: si alguno pasa
   de 3000 (sin contar los tramos g-secciones), partilo antes de seguir. VB-06 está en 3014 y se aceptó.
2. `bash $S/vuelta.sh N plantar` — un Codex aparte planta 42 canarios (28 VB, 4 G, 10 VA) y escribe
   `canarios.txt` FUERA de la copia ciega. Verificá: 42 líneas y que cada hunk de `canarios.diff` sea un
   canario.
3. `bash $S/vuelta.sh N verificar` — los 26 verificadores (14 VB, G1, G2, 10 VA), cada uno con su brief.
   Deben quedar 26 archivos en `v/salidas/`. Si falta uno, relanzalo solo.
4. `bash $S/vuelta.sh N emparejar` — cruce por línea de canarios contra hallazgos (aproximado) y
   `hallazgos-todos.txt` con los candidatos a canario marcados `CAN?`.
5. `bash $S/vuelta.sh N adjudicar` — un Codex adjudica: canarios confirmados semánticamente, únicos con
   veredicto (REAL BLOQUEA/MENOR, FUENTE, FALSO, GENERADOR, OWNER) y correcciones exactas.
6. Copiá los artefactos a `_trabajo/verificacion/vuelta-N/` (bloques, briefs, `canarios.txt`, `salidas/`,
   `adjudicacion/`) y commitealos.
7. **Criterio de corte**: la vuelta cierra el ciclo si trae **cero REAL BLOQUEA** y la detección de
   canarios es **≥ 39 de 42** con VB y G completos. Si la detección baja de eso, la vuelta no vale (el
   verificador no está mirando): no se adjudica como limpia aunque no traiga BLOQUEA.
8. Si no corta: pasada de correcciones (abajo), re-congelado si se tocaron fuentes, y vuelta N+1.

Si hay OWNER: las preguntas van en lote, desde la letra siguiente a la última de
`10-decisiones-del-owner.md` (hoy CK), con opciones, costo y riesgo, una recomendada y el ejemplo de
Juan (anfitrión de una cabaña en Colón que se suscribe al Básico la semana siguiente al corte). No se
aplica nada que dependa de la respuesta hasta tenerla.

## Pasada de correcciones

Plantilla: `../vuelta-3/brief-pasada6.txt` (copiala como `vuelta-N/brief-pasadaM.txt` y cambiá rutas,
SHA y letras). Tres grupos que no se pisan:

- **F · fuentes** (`docs/` de HOS-1352/1353/1354, nunca `spec-consolidada/`): residuos FUENTE y letras
  nuevas. En el decision log sólo se agregan 📌 nuevos y su remisión en la línea Estado.
- **G · generadores** (`scripts/`): arreglos GENERADOR, cada uno con su canario, probados en un sandbox
  (copia de `spec-consolidada` con la estructura `.specs/…`), sin regenerar sobre la spec real mientras S
  edita.
- **S · spec a mano** (los .md no generados y `scripts/generadores/g8/src/B4..B7.md`).

Orden: F, S y G fase 1 en paralelo → commits → re-congelado (G fase 2) → commits. Re-congelado, en este
orden (el inverso rompe g3 y g-secciones):

1. `scripts/comun.py` → `SHA` = el último commit de fuentes.
2. `python3 scripts/inventario.py --json`, `python3 scripts/asignar.py`, `python3 scripts/adjudicar.py`.
3. `python3 scripts/cobertura.py --reanclar` y después `--sellar` (reanclar no actualiza los hashes).
   `reanclar.py` no recorre `generadores/secciones/fuentes.json`: re-anclalo aparte. Una cita escrita
   antes de que exista su fila en la fuente se re-ancla mal: revisala a mano.
4. Regenerar g1 (después de cerrar la cobertura), g3, g8 (`g8/gen.py`) y secciones.
5. `pnpm exec markdownlint-cli2 --fix` sobre las salidas y biome sobre los JSON.
6. Verificación (cada una con la salida a un archivo, leyendo el exit code, nunca `| tail`):
   - `python3 scripts/trazar.py _trabajo/inventario.json _trabajo/adjudicacion.json . --cobertura=_trabajo/cobertura.json`
     desde `spec-consolidada/` → `APROBADO (0)`. Sin los posicionales imprime el uso y sale 1: rojo falso.
   - canarios: `scripts/canarios.py`, `scripts/canarios_cobertura.py`, `generadores/g1/canarios_g1.py`,
     `generadores/g3/canarios_g3.py`, `generadores/secciones/canarios_secciones.py` → 0 fallas.
   - `aristas.py` (0 violaciones) y `contar.py` (exit 0).
   - markdownlint sobre todos los .md de `spec-consolidada/` → 0.

## Reglas duras

- No se editan el PDR, la matriz (`06-mp-validation-matrix.md`) ni los informes.
- Commits: `CI=true git commit …` (sin TTY el pre-commit aborta en `pnpm install`); header en minúscula de
  100 caracteres como máximo (commitlint; si falla, el archivo queda staged y se cuela en el commit
  siguiente: revisá `git diff --cached` después de cada uno); `git add` con rutas explícitas, nunca `.`;
  un commit por llamada; sin atribución de IA; salida a archivo y exit code.
- Push sólo a `spec/HOS-1352-billing-verticals-redesign` y sólo con el PR #3360 abierto
  (`gh pr list --head <branch> --state all`).
- No se toca Linear desde las vueltas.
- El hook de Claude bloquea todo comando que nombre el directorio de caché de Python; en Codex no aplica,
  pero no lo commitees.

## Gotchas que ya costaron

- Las rutas de las fuentes empiezan con `.specs`: `rg` sin `--hidden` no ve nada y no avisa.
- Lo tachado está muerto, también si el tachado cruza líneas o encierra otro tachado. Los 📌 y las letras
  posteriores precisan o reemplazan: antes de dar una contradicción, buscá la decisión posterior.
- Un canario OMITE está mal plantado si la regla sigue viva en un TEST, un título o una definición.
- Los verificadores VA no miran los textos adjuntos de `04-catalogos`: G2 es el que encuentra esas
  omisiones.
- Las correcciones manuales también se equivocan de cita (`§3.4` por `§4.3`): cotejalas contra el título
  de la sección de la fuente congelada.

## Quién corre qué

Las etapas de `vuelta.sh` las corrés vos desde una terminal: cada una lanza `codex exec`, y un Codex
dentro del sandbox de otro Codex no tiene red para llamar al modelo. La sesión interactiva de Codex
entra después, para revisar la adjudicación y hacer la pasada.

## Prompt para la sesión interactiva de Codex (después de `adjudicar`)

> Sos el revisor de la vuelta ciega N de HOS-1352. Leé
> `.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/_trabajo/verificacion/codex/RUNBOOK.md`
> entero. Las etapas ya corrieron; los artefactos están en `~/.cache/hos1352/vuelta-N/`. Verificá que
> `canarios.txt` tenga 42 líneas, que haya 26 salidas en `v/salidas/` y que exista `adjudicacion/`.
> Mostrame: canarios detectados (por tipo y por bloque propio), únicos por veredicto, una línea por REAL
> BLOQUEA y GENERADOR, y las preguntas OWNER en lote si las hay, y decime si la vuelta corta según el
> criterio del runbook. No apliques correcciones ni commitees nada hasta que yo lo apruebe; cuando lo
> apruebe, seguí la sección «Pasada de correcciones».
