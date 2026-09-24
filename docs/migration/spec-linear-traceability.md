# Contrato de trazabilidad Linear ↔ ODD ↔ `.specs` ↔ Gentle SDD

Este contrato mantiene una sola fuente de verdad para cada dimensión y permite que los agentes encuentren toda la evidencia sin duplicar estados.

## Identidad mínima

Cada cambio complejo debe conservar:

```yaml
linearIssue: HOS-123
specPath: .specs/HOS-123-feature/spec.md
    oddTask: odd/tasks/HOS-123-feature.md
    sddChange: null # sólo si la persona pidió SDD explícitamente
worktree: ../hospeda-hos-123-feature
branch: feat/hos-123-feature
```

El bloque puede vivir en frontmatter de `spec.md` y en metadata del change SDD. Los valores deben coincidir; si no coinciden, el comando read-only bloquea el cierre y reporta la divergencia.

## Autoridad por campo

| Campo | Autoridad |
|---|---|
| existencia, prioridad, estado macro, dependencias | Linear |
| requisitos técnicos y decisiones de implementación | `.specs/spec.md` |
| documento recuperable de ejecución | ODD (`odd/tasks/`) |
| proposal/design/tasks/verify solicitado explícitamente | Gentle SDD |
| commits, branch y merge | Git/PR |
| estado del worktree, env y DB | `hops`/`qz` y archivos locales derivados |
| closeout y evidencia final | `.specs/closeout.md` enlazando verify |

## Lifecycle

1. `start-issue` resuelve Linear y prepara ODD; crea/enlaza `.specs` sólo cuando corresponde.
2. ODD mantiene un único documento recuperable para trabajo sustancial y registra `HOS-NNN`, `specPath` y `worktree`.
3. Sólo ante un pedido explícito, `sdd-new`/`sdd-explore` registra `HOS-NNN` y `specPath` y crea el change formal.
4. Design/tasks/apply/verify viven en el change SDD sólo en ese caso y dejan evidencia versionada.
5. `verify` comprueba requisitos, escenarios, tests y estado del worktree.
6. `close-issue --plan` compara Linear, ODD/spec, SDD si existe, Git y PR; no muta nada.
7. `archive` de Gentle sólo archiva un change SDD explícito y enlaza el closeout; nunca borra `.specs`.
8. El cambio de Linear a Done ocurre en el flujo explícito de cierre aprobado.

## Reglas de divergencia

- Linear sin `.specs` puede ser válido para bugs/NO-SPEC.
- `.specs` sin Linear es inválido para una spec nueva.
- ODD sin `HOS-NNN` puede existir para exploración general; un change SDD sin `HOS-NNN` sólo puede existir como exploración no comprometida.
- Un change archivado con verify ausente bloquea closeout.
- El adapter nunca inventa estados de Linear a partir de archivos locales.

## Fuera de alcance

Este contrato documenta la decisión aprobada: ODD por defecto, Linear para tracking, `.specs` para contrato técnico y SDD sólo por pedido explícito. La implementación del adaptador queda como trabajo posterior.
