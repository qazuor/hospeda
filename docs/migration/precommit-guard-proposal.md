# Propuesta de guards pre-commit para Hospeda

Fecha: 2026-09-15.

## Estado actual

`.husky/pre-commit` ya ejecuta:

1. escaneo de patrones de secretos en el diff staged;
2. `lint-staged` para formato/lint;
3. guard contra `ilike()` inseguro;
4. un hook tolerante del paquete GitHub workflow.

Los guards de dominio se ejecutan principalmente en CI mediante
`pnpm check:guards`, con muchos checks específicos de schemas, env, i18n,
Cloudinary, seed, seguridad y billing.

## Guards adicionales de bajo costo

### Agregar al pre-commit

- bloquear archivos `.env*`, claves, cookies y dumps agregados al índice;
- detectar DSN/URLs con password embebida en archivos trackeados;
- impedir cambios staged fuera del worktree actual;
- impedir modificaciones accidentales a `main`/`staging`;
- validar JSON/YAML/TOML de configuración modificados;
- exigir `HOS-NNN` o `NOSPEC` en metadata cuando un cambio toca `.specs`;
- detectar archivos generados grandes o binarios nuevos;
- ejecutar sólo guards de dominio relacionados con rutas staged.

### Mantener en CI o `hops verify`

- suite completa de guards;
- Semgrep/CodeQL/auditoría de dependencias;
- builds, E2E, browser y cobertura completa;
- consultas Linear/GitHub, DB, Engram o red;
- migraciones, seeds y arranque de Docker.

## Reglas para no gastar tokens

- el hook debe fallar con mensaje accionable y comando de reparación;
- no debe pedir al agente que interprete logs enormes;
- debe producir una línea de resumen y guardar detalle sólo si falla;
- no debe autoarreglar lógica ni generar commits;
- cada guard necesita una prueba positiva y una negativa para no volverse
  fail-open.

No se modificó `.husky` ni `package.json` en esta etapa.
