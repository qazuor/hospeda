# Diseño de `qz promote` y `qz back-merge`

Este diseño separa el núcleo reutilizable de las decisiones de ramas de cada proyecto. No implementa comandos ni modifica GitHub, ramas o workflows.

## Decisión

`qz promote` y `qz back-merge` serán comandos genéricos, pero no asumirán nombres fijos como `staging` o `main`. Leerán un adapter de proyecto en `.qz/project.json`.

El modo predeterminado será `--plan`: inspecciona refs, divergencias, PRs, checks y riesgos, y produce un plan legible y JSON. Toda operación que cree PRs, haga merge, push, reset o cierre PRs exigirá `--confirm` y una segunda validación de estado.

## Configuración propuesta

```json
{
  "provider": "github",
  "issue": { "kind": "linear", "identifier": "HOS" },
  "branches": {
    "issueBase": "develop",
    "integration": "develop",
    "promotion": ["develop", "staging", "main"],
    "urgentTargets": ["staging", "main"],
    "protected": ["develop", "staging", "main"]
  },
  "policies": {
    "directIntegrationMerge": false,
    "requireGreenChecks": true,
    "requireCleanWorktree": true,
    "autoBackMerge": false
  }
}
```

Durante la transición Hospeda puede declarar `issueBase` e `integration` como `staging`; el cambio a `develop` requiere que la rama exista y que CI, Dependabot, worktrees, verify, closeout y documentación estén actualizados juntos.

## `qz promote`

### Plan/read-only

1. Valida que el origen y destino sean una pareja declarada en `promotion`.
2. Lee SHA locales/remotos, ahead/behind, divergencias y PRs abiertos.
3. Consulta checks, conflictos, labels y gates específicos del adapter.
4. Detecta cambios de configuración, migraciones, template DB y env drift.
5. Devuelve un plan con bloqueos, comandos que se ejecutarían y artefactos de evidencia.

### Aplicación futura

Con `--confirm` y una confirmación de destino explícita, abre o actualiza el PR de promoción. No hace merge implícito. La aprobación/merge sigue siendo humana salvo que el adapter declare una política distinta y ésta esté aprobada.

## `qz back-merge`

El back-merge recibe `--from` y `--to`, valida que la dirección esté permitida por el adapter y produce primero el mismo plan. El caso normal será `main -> staging` y, con `develop`, cualquier corrección que deba regresar a la línea de integración.

La aplicación abre un PR de back-merge en una rama temporal o reutiliza uno abierto. Nunca fuerza-pushea ramas protegidas ni resuelve conflictos automáticamente sin evidencia. `--confirm` sólo autoriza la creación/actualización del PR, no su merge.

## Aliases Hospeda

- `hops-promote` selecciona el adapter Hospeda y llama al núcleo `qz promote`.
- `hops-back-merge` selecciona el adapter Hospeda y llama al núcleo `qz back-merge`.
- Los aliases no duplican lógica.

## Política para `develop`

La promoción normal será `develop -> staging -> main`. El flujo urgente podrá abrir un PR directo a `staging` según una opción explícita del adapter. Los issues nuevos cortarán desde `develop` sólo después de completar el cambio de configuración y verificar que el template/env/base de datos correspondan a esa rama.

## Gaps que deben resolverse antes de activar `develop`

- Crear la rama remota y definir protección/permissions.
- Cambiar `project.config`, worktree, template y update para usar `issueBase`/`integration`.
- Separar los baselines de verify y reportes.
- Revisar CI, Dependabot y back-merge de seguridad.
- Definir qué cambios llegan automáticamente a develop y cuáles requieren PR.
- Probar una épica con varios issues sin promover a staging.
- Probar una urgencia directa a staging y su reconciliación posterior.

## Fuera de alcance

No se implementan comandos, no se crea `develop`, no se cambia CI, no se abre ningún PR y no se modifica Linear en esta etapa.
