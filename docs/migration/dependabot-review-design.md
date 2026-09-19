# Diseño de revisión semanal de Dependabot

La revisión debe ser un informe read-only que ayude a decidir cada PR. No debe aprobar, cerrar, rebasear, mergear ni cambiar labels automáticamente.

## Comando propuesto

`hops dependabot-review [--json] [--base <branch>] [--pr <number>]`

En el núcleo futuro: `qz dependabot-review`, con el adapter declarando proveedor y ramas.

## Qué analiza

- PRs abiertos por `dependabot[bot]` y su rama base.
- Diferencia de manifests y lockfile.
- Semver y si el update es agrupado.
- Changelog/release notes disponibles en el PR.
- Checks, conflictos, draft y antigüedad.
- Uso real en el monorepo (`package.json`, imports y workspace).
- Reglas de `.github/dependabot.yml`, ignores y cooldown.
- Dependencias coordinadas: Tiptap, Better Auth, Expo, AI SDK, Radix, TanStack y otras registradas.
- Riesgo de migración, cambios de runtime, build, tests y supply chain.

## Salidas posibles

Cada PR recibe exactamente una recomendación inicial:

1. **Cerrar**: no aporta valor, está obsoleto, duplicado o bloqueado por una política vigente.
2. **Hacer como NO-SPEC**: cambio pequeño, acotado y verificable sin issue de producto.
3. **Crear HOS en backlog**: requiere migración, coordinación o trabajo posterior.
4. **Bloqueado**: falta changelog, checks o evidencia para decidir.

La salida humana resume razones y próximos pasos. `--json` conserva evidencia, URLs, SHA, checks y recomendación para un artifact o agente.

## Seguridad

El comando sólo consulta GitHub y el checkout local. Cualquier acción mutante queda fuera del comando inicial. El agente debe presentar el informe y esperar decisión humana antes de ejecutar el resultado.

## Integración futura

- Skill del agente: explica cómo interpretar el informe y cuándo crear un issue.
- Artifact opcional: tablero de PRs con recomendación, riesgo, evidencia y decisión humana.
- Hook semanal opcional: sólo genera un reporte; no abre issues ni modifica PRs.

## Criterios de aceptación

- No confunde actualizaciones normales a `staging` con security updates que GitHub dirige a `main`.
- Detecta grupos que deben moverse coordinadamente.
- No recomienda cerrar un PR sólo por falta de secretos en CI de Dependabot.
- Permite repetir el análisis sin duplicar decisiones ni escribir estado.
- No imprime tokens, envs ni contenido sensible.

No se implementa el comando en este paso.
