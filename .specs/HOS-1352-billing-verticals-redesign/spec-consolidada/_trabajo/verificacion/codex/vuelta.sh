#!/usr/bin/env bash
# Blind verification round N for HOS-1352, driven by `codex exec`.
# Usage: vuelta.sh <N> <stage>   stages: preparar | plantar | verificar | emparejar | adjudicar
# Env: MODEL (codex model; empty = config default), PAR (parallel verifiers, default 6),
#      VR (round dir, default ~/.cache/hos1352/vuelta-N).
set -euo pipefail

N="${1:?round number}"; STAGE="${2:?stage}"
W=/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign
P=.specs/HOS-1352-billing-verticals-redesign
C="$W/$P/spec-consolidada"
K="$C/_trabajo/verificacion/codex"
VR="${VR:-$HOME/.cache/hos1352/vuelta-$N}"
V="$VR/v"                      # blind copy: the ONLY thing verifiers see
PAR="${PAR:-6}"
MODEL_ARGS=(); [[ -n "${MODEL:-}" ]] && MODEL_ARGS=(-m "$MODEL")

head_sha() { git -C "$W" rev-parse --short=8 HEAD; }
frozen_sha() { python3 -c "import sys; sys.path.insert(0,'$C/scripts'); import comun; print(comun.SHA)"; }

case "$STAGE" in
preparar)
  [[ -e "$VR" ]] && { echo "ya existe $VR"; exit 1; }
  S=$(head_sha); F=$(frozen_sha)
  mkdir -p "$V/s/$S" "$V/fuentes" "$V/generadores" "$V/salidas" "$VR/tmp"
  git -C "$W" archive HEAD "$P/spec-consolidada" ":(exclude)$P/spec-consolidada/_trabajo" ":(exclude)$P/spec-consolidada/scripts" | tar -x -C "$VR/tmp"
  cp -r "$VR/tmp/$P/spec-consolidada/." "$V/s/$S/"; rm -rf "$VR/tmp"
  git -C "$W" archive "$F" .specs/HOS-1352-billing-verticals-redesign .specs/HOS-1353-verticales-capacidades-y-autorizacion .specs/HOS-1354-billing-cobro-y-proveedor ":(exclude)$P/spec-consolidada" | tar -x -C "$V/fuentes"
  mkdir -p "$VR/tmp"
  git -C "$W" archive HEAD "$P/spec-consolidada/scripts/generadores" ":(exclude)*canarios_*.py" | tar -x -C "$VR/tmp"
  cp -r "$VR/tmp/$P/spec-consolidada/scripts/generadores/." "$V/generadores/"; rm -rf "$VR/tmp"
  cp -r "$V/s/$S" "$VR/pristina"
  # briefs: last round's, with paths rewritten
  PREV="$C/_trabajo/verificacion/vuelta-3"
  for b in vb va g; do
    sed -e "s#/tmp/claude-1000/-home-qazuor-projects-WEBS-hospeda2/491befa1-fbbc-467d-84dc-c5b4e15f5eea/scratchpad/v3#$V#g" \
        -e "s#s/a10f010e/#s/$S/#g" -e "s#vuelta 3#vuelta $N#g" "$PREV/brief-$b.txt" > "$V/brief-$b.txt"
  done
  sed -e "s#spec en s/a10f010e/, fuentes en fuentes/ congeladas en 591034c665#spec en s/$S/, fuentes en fuentes/ congeladas en $F#" \
      -e "s#Vuelta 3#Vuelta $N#" "$PREV/bloques.txt" > "$V/bloques.txt"
  echo "copia ciega: $V (spec $S, fuentes $F)"
  echo "== líneas por bloque VB (sin tramos g-secciones; tope 3000):"
  cd "$V/s/$S"
  grep '^VB-' "$V/bloques.txt" | while IFS='|' read -r id files; do
    t=0; for f in $files; do
      n=$(awk '/<!-- g-secciones: inicio/{g=1} {if(!g)n++} /<!-- g-secciones: fin -->/{g=0} END{print n+0}' "$f"); t=$((t+n)); done
    printf '%s %6d %s\n' "$id" "$t" "$([[ $t -gt 3000 ]] && echo '<-- MÁS DE 3000')"
  done
  ;;
plantar)
  S=$(ls "$V/s"); PREVS=$(ls -d "$C"/_trabajo/verificacion/vuelta-*/canarios.txt | tr '\n' ' ')
  sed -e "s#@VR@#$VR#g" -e "s#@V@#$V#g" -e "s#@S@#$S#g" -e "s#@PREVS@#$PREVS#g" "$K/prompt-canarios.txt" |
    codex exec "${MODEL_ARGS[@]}" -s workspace-write -C "$VR" --skip-git-repo-check -o "$VR/plantar.out" -
  diff -r "$VR/pristina" "$V/s/$S" > "$VR/canarios.diff" || true
  echo "registro: $(grep -c . "$VR/canarios.txt") líneas (deben ser 42); hunks: $(grep -c '^[0-9]' "$VR/canarios.diff")"
  ;;
verificar)
  ids=$(grep -E '^(VB-|G1|G2|VA-)' "$V/bloques.txt" | cut -d'|' -f1 | tr -d ' ')
  run_one() {
    local id="$1" brief
    case "$id" in VB-*) brief=brief-vb.txt;; G*) brief=brief-g.txt;; VA-*) brief=brief-va.txt;; esac
    local pre=""; [[ "$brief" != brief-vb.txt ]] && pre="Leé primero \`$V/brief-vb.txt\`, después \`$V/$brief\`."
    local prompt="Respondé en español. Sos el verificador $id de una vuelta ciega. V=$V. $pre Leé \`$V/$brief\` y seguilo al pie de la letra. Tu bloque es la línea $id de \`$V/bloques.txt\`. Tu ID de salida es $id. No uses git ni ningún tracker, no escribas fuera de \`$V/salidas/\`."
    codex exec "${MODEL_ARGS[@]}" -s workspace-write -C "$V" --skip-git-repo-check -o "$VR/run-$id.out" "$prompt" > "$VR/run-$id.log" 2>&1
    echo "$id exit=$? salida=$([[ -s $V/salidas/$id.txt ]] && echo ok || echo FALTA)"
  }
  export -f run_one; export V VR; export MODEL_ARGS_STR="${MODEL:-}"
  # shellcheck disable=SC2016
  printf '%s\n' $ids | xargs -P "$PAR" -I{} bash -c 'MODEL_ARGS=(); [[ -n "$MODEL_ARGS_STR" ]] && MODEL_ARGS=(-m "$MODEL_ARGS_STR"); run_one {}'
  echo "salidas: $(ls "$V/salidas" | wc -l) de 26"
  ;;
emparejar)
  cd "$VR"; ln -sfn "$V" v3; cp canarios.txt v3-canarios.txt
  python3 "$K/emparejar.py"; python3 "$K/extraer.py"
  mv v3-hallazgos-todos.txt hallazgos-todos.txt; rm -f v3 v3-canarios.txt
  ;;
adjudicar)
  S=$(ls "$V/s"); F=$(frozen_sha); mkdir -p "$VR/adjudicacion"
  sed -e "s#@VR@#$VR#g" -e "s#@V@#$V#g" -e "s#@S@#$S#g" -e "s#@F@#$F#g" -e "s#@N@#$N#g" "$K/prompt-adjudicador.txt" |
    codex exec "${MODEL_ARGS[@]}" -s workspace-write -C "$VR" --skip-git-repo-check -o "$VR/adjudicar.out" -
  ;;
*) echo "etapa desconocida: $STAGE"; exit 2;;
esac
