#!/usr/bin/env bash
# install.sh — wire the client tools into the user's fish shell.
#
# Unlike scripts/server-tools (which compiles a standalone binary for the VPS),
# these run straight from source: bun executes TypeScript, so there is nothing
# to build and an edit is live on the next invocation.
#
# The shell functions point at a DEDICATED STAGING CHECKOUT, not at whatever
# clone you happen to run this from. A tool whose behaviour changes when you
# switch branches to look at something else is not a tool you can rely on —
# and on a branch predating client-tools it would vanish entirely.
#
#   --here   Point the functions at THIS checkout instead. For hacking on hops
#            itself, where running the staging copy defeats the purpose.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FISH_FUNCTIONS="$HOME/.config/fish/functions"
USE_HERE=0
[ "${1:-}" = "--here" ] && USE_HERE=1

command -v bun >/dev/null 2>&1 || {
  echo "ERROR: bun no está en el PATH. Instalalo desde https://bun.sh"
  exit 1
}

# Resolve the main clone: git always lists it first.
REPO_ROOT="$(cd "$HERE" && git rev-parse --show-toplevel)"
MAIN_REPO="$(git -C "$REPO_ROOT" worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
STAGING_CLONE="$(dirname "$MAIN_REPO")/hospeda-staging"

if [ "$USE_HERE" -eq 1 ]; then
  TOOLS="$HERE"
  echo "== modo --here: las funciones apuntan a este checkout =="
else
  if [ ! -e "$STAGING_CLONE/.git" ]; then
    echo "== creando el checkout de staging en $STAGING_CLONE =="
    git -C "$MAIN_REPO" fetch origin staging
    git -C "$MAIN_REPO" worktree add --force "$STAGING_CLONE" staging
  fi
  TOOLS="$STAGING_CLONE/scripts/client-tools"
  if [ ! -f "$TOOLS/package.json" ]; then
    echo "AVISO: staging todavía no tiene scripts/client-tools."
    echo "       Las funciones van a apuntar a este checkout hasta que se mergee."
    TOOLS="$HERE"
  fi
fi

echo "== instalando dependencias en $TOOLS =="
(cd "$TOOLS" && bun install)

mkdir -p "$FISH_FUNCTIONS"

# One function per binary. Each is a thin passthrough: all the argument handling
# lives in the CLI, so these never need to change when a command gains a flag.
# `--local` as the first argument runs the copy in the current repo instead,
# which is what you want while developing hops itself.
write_function() {
  local name="$1" description="$2"
  cat > "$FISH_FUNCTIONS/$name.fish" <<EOF
function $name --description '$description'
    # Generado por scripts/client-tools/install.sh — no editar a mano.
    if test "\$argv[1]" = "--local"
        set -l here (git rev-parse --show-toplevel 2>/dev/null)
        if test -n "\$here" -a -x "\$here/scripts/client-tools/bin/$name"
            \$here/scripts/client-tools/bin/$name \$argv[2..]
            return \$status
        end
        echo "hops: no encontré client-tools en el repo actual" >&2
        return 1
    end
    $TOOLS/bin/$name \$argv
end
EOF
  echo "  $FISH_FUNCTIONS/$name.fish"
}

echo "== escribiendo funciones de fish =="
write_function hops 'Herramientas locales del monorepo (menu)'

# The command list comes from the registry itself. A second list kept by hand
# here is a list that goes stale the first time someone adds a command.
while IFS=$'\t' read -r name summary; do
  [ -n "$name" ] || continue
  write_function "hops-$name" "$(printf '%s' "$summary" | tr -d "'")"
done < <(bun "$TOOLS/src/index.ts" --commands)

echo
echo "== listo =="
echo "hops corre desde: $TOOLS"
echo
echo "Probá:  hops             (menú)"
echo "        hops --help      (lista de comandos)"
echo "        hops update      (traer lo último de staging)"
echo "        hops --local ... (correr la copia del repo donde estés parado)"
echo
echo "Las funciones se autocargan: no hace falta reiniciar la terminal."
