# Auditoría de dependencias y supply chain — 2026-09-23

Se ejecutó `pnpm audit --prod --json` en modo read-only sobre el worktree de
migración. No se modificaron manifests, lockfiles ni cachés.

## Resultado

- Exit code: `1` porque el audit encontró vulnerabilidades.
- Dependencias productivas analizadas: `1.339` directas/transitivas; opcionales:
  `362`.
- Advisories agrupadas: `45`.
- Severidad reportada: `1 critical`, `26 high`, `19 moderate`, `1 low`.

El número de advisories no equivale al número de paquetes únicos: varias
alertas pertenecen a la misma dependencia y a distintas versiones/rangos.

## Prioridad inmediata

| Paquete | Versión observada | Severidad | Corrección reportada | Origen/uso |
|---|---:|---:|---:|---|
| `astro` | `7.1.6` | critical + moderate | `>=7.2.8` / `>=7.2.4` | dependencia directa de `apps/web` |
| `sharp` | `0.35.3` | high | `>=0.35.4` | Astro, `@vercel/og` y dependencia de desarrollo |
| `hono` | `4.13.0` | moderate | `>=4.13.5` | API y adaptadores Hono |
| `vitest` | `4.1.10` | moderate | `>=4.1.11` | toolchain de tests |
| `@tiptap/core` | `3.29.2` | high + moderate | `>=3.30.5` | editor web/admin |
| `js-yaml` | `4.3.1` | high | `>=4.3.2` | transitiva, principalmente Astro/Expo |
| `svgo` | `4.0.2` | high + moderate | `>=4.1.0` | transitiva de Astro |
| `@xmldom/xmldom` | `0.8.13` | high + moderate | `>=0.8.15` | transitiva de Expo |

La alerta crítica de Astro merece un issue de seguridad separado y una
actualización controlada. No se debe resolver con `pnpm update --latest` a
ciegas: Astro, Hono, Tiptap y sus adaptadores pueden requerir cambios de
runtime y pruebas de producción.

## Recomendación

1. Crear una issue de mantenimiento prioritaria para Astro/Sharp/Hono y probar
   primero las versiones mínimas parcheadas (`7.2.8`, `0.35.4`, `4.13.5`).
2. Actualizar en grupos pequeños, cada uno con `hops verify --changed --json`,
   build de las apps afectadas y smoke tests.
3. Revisar las alertas transitivas de Expo (`@xmldom/xmldom`) por separado; no
   actualizar Expo como efecto lateral de una corrección web.
4. Mantener los plugins OpenCode fuera de esta actualización: sus dependencias
   deben auditarse en un perfil aislado antes de entrar al stack.
5. No usar `pnpm audit --fix` automáticamente; puede cambiar el lockfile y
   saltarse las decisiones de compatibilidad.

## Estado del gate

El inventario está completo y reproducible, pero el gate de dependencias queda
**pendiente** hasta aplicar las correcciones en issues separados y validar el
runtime. El audit no leyó secretos ni ejecutó mutaciones.
