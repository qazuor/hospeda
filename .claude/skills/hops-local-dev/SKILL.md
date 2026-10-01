---
name: hops-local-dev
description: Arranque y diagnóstico seguro del entorno local de Hospeda.
triggers:
  - entorno local
  - levantar Hospeda
  - dev servers
  - health checks
  - .env.local
---

# Desarrollo local

- Usá la configuración declarativa de `.qz/project.json` y los wrappers del
  adapter para levantar API, web y admin. No reconstruyas puertos o comandos a
  mano si el adapter ya los conoce.
- Preferí iniciar cada aplicación por separado cuando el runner del monorepo
  tenga demasiadas tareas persistentes o un límite de concurrencia incompatible.
- Verificá el endpoint de salud de cada servicio antes de informar que el
  entorno está listo. Un servidor escuchando no equivale a una aplicación sana.
- Los `.env.local` son archivos locales y pueden contener secretos. No los
  leas, muestres, sobrescribas ni copies manualmente; usá la reconciliación de
  env del adapter y el checkout protegido configurado para Hospeda.
- Las bases de datos de worktrees deben crearse mediante el flujo de worktrees
  y su template validado. No uses un reset global de Docker para reparar una
  sola base.
- Si aparece un error de esquema, diferenciá migración, push de esquema y
  datos de seed antes de actuar. No destruyas volúmenes sin autorización
  explícita.
- Después de un `git push`, verificá la referencia remota contra el commit local;
  una salida resumida del wrapper no es evidencia suficiente.

## Seguridad

Este skill no contiene URLs privadas, usuarios, contraseñas, tokens ni valores
de variables. Las credenciales pertenecen al entorno local y deben permanecer
fuera de los archivos versionados y de las instrucciones compartidas.
