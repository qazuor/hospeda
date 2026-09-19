# Contrato de trazabilidad Linear ↔ `.specs` ↔ Gentle SDD

Este contrato mantiene una sola fuente de verdad para cada dimensión y permite que los agentes encuentren toda la evidencia sin duplicar estados.

## Identidad mínima

Cada cambio complejo debe conservar:

```yaml
linearIssue: HOS-123
specPath: .specs/HOS-123-feature/spec.md
sddChange: feature-name
worktree: ../hospeda-hos-123-feature
branch: feat/hos-123-feature
```

El bloque puede vivir en frontmatter de `spec.md` y en metadata del change SDD. Los valores deben coincidir; si no coinciden, el comando read-only bloquea el cierre y reporta la divergencia.

## Autoridad por campo

| Campo | Autoridad |
|---|---|
| existencia, prioridad, estado macro, dependencias | Linear |
| requisitos técnicos y decisiones de implementación | `.specs/spec.md` |
| proposal/design/tasks/verify del cambio complejo | Gentle SDD |
| commits, branch y merge | Git/PR |
| estado del worktree, env y DB | `hops`/`qz` y archivos locales derivados |
| closeout y evidencia final | `.specs/closeout.md` enlazando verify |

## Lifecycle

1. `start-issue` resuelve Linear y crea/enlaza `.specs` sólo cuando corresponde.
2. Para un cambio complejo, `sdd-new`/`sdd-explore` registra `HOS-NNN` y `specPath`.
3. Design/tasks/apply/verify viven en el change SDD y dejan evidencia versionada.
4. `verify` comprueba requisitos, escenarios, tests y estado del worktree.
5. `close-issue --plan` compara Linear, spec, SDD, Git y PR; no muta nada.
6. `archive` de Gentle sólo archiva su change y enlaza el closeout; nunca borra `.specs`.
7. El cambio de Linear a Done ocurre en el flujo explícito de cierre aprobado.

## Reglas de divergencia

- Linear sin `.specs` puede ser válido para bugs/NO-SPEC.
- `.specs` sin Linear es inválido para una spec nueva.
- SDD sin `HOS-NNN` sólo puede existir como exploración no comprometida.
- Un change archivado con verify ausente bloquea closeout.
- El adapter nunca inventa estados de Linear a partir de archivos locales.

## Fuera de alcance

No se implementan comandos ni se sincroniza Linear en este paso. El contrato debe aprobarse antes de adaptar specs nuevas.
