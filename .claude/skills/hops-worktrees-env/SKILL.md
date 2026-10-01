---
name: hops-worktrees-env
description: Worktrees, branches, envs y base de datos local de Hospeda.
---

# Worktrees y entorno

- `hops start-issue HOS-NNN` crea la branch desde `develop` por defecto.
- Usá `--base staging` sólo para trabajo urgente que deba saltear `develop`.
- Crear una spec no crea worktree; el worktree aparece cuando empieza la
  implementación.
- Los worktrees reciben envs desde el checkout protegido `hospeda-staging`.
  No copies secretos manualmente ni leas valores para describirlos.
- El bootstrap debe sembrar o fusionar las claves de `.env.example` generado
  sin sobrescribir valores existentes. Las variables que cambian por puerto
  deben declararse también en `portEnvWrites`; si no, el navegador puede seguir
  apuntando al puerto por defecto.
- `hops env --drift` y `hops close-issue --plan` comparan variables presentes,
  faltantes, obsoletas y cross-checks sin mostrar valores.
- La DB de worktree usa el template registrado. Si el fingerprint está viejo o
  no registrado, hay que actualizarlo antes de confiar en la base.
- Usá `hops wt-clean` para inventariar y limpiar; nunca elimines worktrees
  protegidos (`develop`, `staging`, `main`) ni uno ajeno a la tarea.
