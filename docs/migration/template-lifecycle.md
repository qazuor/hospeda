# Template de bases para worktrees

El template acelera `wt-create`: cada worktree clona una base ya migrada y
seeded en lugar de reconstruirla desde cero. El template activo es una base
dorada; no se usa para trabajo manual.

## Frescura

`template.sh status` lee metadata dentro de la base. El manifest contiene el
commit fuente, el fingerprint de schemas/migraciones/extras/seeds, el número de
migraciones y la fecha de construcción. `wt-create` compara ese fingerprint
con `origin/<baseBranch>` antes de clonar. Si falta el journal o el manifest,
el template se considera legacy y la creación se detiene.

## Reconstrucción

Se construye una base candidata aislada desde cero:

```text
db vacía → db:migrate → db:apply-extras → db:seed → validaciones → manifest
```

La candidata no reemplaza automáticamente al template activo. El operador la
inspecciona y la promueve conservando el template anterior como rollback:

```bash
bash scripts/worktree/template.sh status hospeda_template
bash scripts/worktree/template.sh build-candidate hospeda_template_candidate_YYYYMMDD
bash scripts/worktree/template.sh promote hospeda_template_candidate_YYYYMMDD hospeda_template --confirm
```

La promoción rechaza conexiones activas y renombra la base anterior a
`hospeda_template_backup_<timestamp>`. No se borran backups automáticamente.

## Regla de seguridad

No usar `db:push --force` sobre el template ni estampar manualmente el journal.
Las bases históricas sin journal deben reconstruirse desde cero; así las
migraciones versionadas y los extras quedan trazables y el clon rápido sigue
siendo seguro.
