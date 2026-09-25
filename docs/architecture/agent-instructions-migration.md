# Migración de instrucciones de agentes

Este documento define cómo se distribuye el conocimiento que hoy está repartido entre `CLAUDE.md`. La decisión es conservar una única fuente de verdad para las reglas universales y mover el conocimiento especializado a skills y documentos consultables. La migración se hace por etapas: primero inventario, después extracción y verificación, y recién al final eliminación de archivos legacy.

## Estado actual

| Ubicación | Tamaño aproximado | Tipo de contenido | Destino previsto |
|---|---:|---|---|
| `CLAUDE.md` | 1.235 líneas | arquitectura, comandos, seguridad, billing, Git, specs, worktrees y operación | `AGENTS.md` sólo para invariantes; el resto se separa entre skills, `docs/` y `qz`/`hops` |
| `apps/admin/CLAUDE.md` | 812 | TanStack Start, CRUD, tablas, auth, SSR, despliegue y gotchas | skill `hospeda-admin` + docs de CRUD/deploy |
| `apps/api/CLAUDE.md` | 942 | Hono, factories de rutas, middleware, auth, errores, billing y testing | skill `hospeda-api` + docs de API/billing/testing |
| `apps/web/CLAUDE.md` | 1.331 | Astro, islands, estilos, i18n, auth, SEO, testing y performance | skill `hospeda-web` + docs de frontend/SEO |
| `packages/db/CLAUDE.md` | 877 | Drizzle, PostgreSQL, migraciones, queries y seeds | skill `hospeda-db` + runbooks de base de datos |
| `packages/schemas/CLAUDE.md` | 616 | Zod, esquemas de API, transforms y validación | skill `hospeda-schemas` |
| `packages/seed/CLAUDE.md` | 935 | fixtures, seeds deterministas y reglas de datos de prueba | skill `hospeda-seeding` |
| `packages/service-core/CLAUDE.md` | 1.358 | servicios CRUD, errores, contexto, logging e integración | skill `hospeda-services` |
| `packages/billing/CLAUDE.md` | 170 | límites, entitlements y sincronización comercial | skill `hospeda-billing` |
| `packages/ai-core/CLAUDE.md` | 175 | proveedores AI y sincronización de modelos | skill `hospeda-ai` |
| `packages/email/CLAUDE.md` | 550 | plantillas React Email, configuración y previews | skill `hospeda-email` |
| `packages/i18n/CLAUDE.md` | 340 | traducciones, tipos generados y validación | skill `hospeda-i18n` |
| `packages/media/CLAUDE.md` | 140 | Cloudinary, subpaths, retries y fallback | skill `hospeda-media` |
| `packages/logger/CLAUDE.md` | 308 | logging estructurado y formatos por entorno | skill `hospeda-observability` |
| `packages/icons/CLAUDE.md` | 389 | Phosphor, pesos, accesibilidad e integración | skill `hospeda-ui` |
| `packages/auth-ui/CLAUDE.md` | 56 | componentes y patrones de autenticación | skill `hospeda-auth` |
| `packages/config/CLAUDE.md` | 48 | configuración compartida y registro de variables | skill `hospeda-config` |
| `packages/seed`, `packages/notifications`, `packages/utils` y configs menores | 12–935 | reglas locales de cada paquete | combinar en skills de dominio; no crear un agente por paquete |
| `packages/schemas/src/**/CLAUDE.md` | 12–13 cada uno | notas puntuales de subtipos | integrar en `hospeda-schemas`; eliminar duplicación |

Los archivos bajo `node_modules` o dependencias externas no forman parte de la fuente de verdad del proyecto y quedan fuera del inventario.

## Qué queda en `AGENTS.md`

`AGENTS.md` ya contiene el contrato corto para cualquier agente: alcance del monorepo, fuente de verdad, reglas de implementación, seguridad, verificación y política de documentación. No debe contener procedimientos largos, ejemplos de un dominio, historial de issues ni listas de gotchas de una aplicación.

## Qué se convierte en skill

Los skills serán project-locales y se cargarán bajo demanda. Cada uno debe tener un objetivo claro, señales de activación, fuentes de verdad y una sección de verificación. No debe copiar comandos que ya exponga `qz` o `hops`, ni repetir las reglas universales de `AGENTS.md`.

La fuente portable del proyecto se alojará en `.qz/knowledge/`. Su contrato se declara en `.qz/project.json` y puede renderizarse para cada CLI sin copiarlo a mano:

```json
{
  "knowledge": {
    "root": ".qz/knowledge",
    "instructions": "AGENTS.md",
    "skillsDir": "skills",
    "agentsDir": "agents",
    "commandsDir": "commands"
  }
}
```

El renderer genérico es `qz-kit project render`. Produce el layout compatible de OpenCode, Claude Code, Codex y Gentle Shell en un directorio indicado, sin tocar el repositorio fuente. La sincronización versionada se hace con `qz-kit project sync <proyecto> --plan|--check|--apply`; crea backup externo, rechaza sobrescrituras con drift salvo autorización explícita y no elimina recursos obsoletos automáticamente.

Orden recomendado de extracción:

1. `hospeda-api`, `hospeda-web` y `hospeda-admin`.
2. `hospeda-db`, `hospeda-schemas`, `hospeda-services` y `hospeda-seeding`.
3. `hospeda-billing`, `hospeda-auth`, `hospeda-i18n` y `hospeda-email`.
4. `hospeda-media`, `hospeda-ai`, `hospeda-observability`, `hospeda-ui` y `hospeda-config`.

La primera extracción ya está implementada para estos grupos. La etapa pendiente
es una auditoría de cobertura contra los documentos legacy, no la creación de
archivos adicionales por defecto.

## Legacy sin skill dedicado

La comparación inicial de los archivos pequeños deja estas decisiones. Se
mantienen durante la ventana de convivencia; esta tabla evita convertir cada
paquete de configuración en un skill independiente.

| Archivo | Clasificación | Destino | Motivo |
|---|---|---|---|
| `packages/biome-config/CLAUDE.md` | documentación/guard | `README.md`, Biome y pre-commit | Describe una configuración compartida que ya se ejecuta automáticamente. |
| `packages/tailwind-config/CLAUDE.md` | candidato a integrar | `hospeda-ui` + `README.md` del paquete | Sus reglas son tokens y tema visual, no un workflow autónomo. |
| `packages/typescript-config/CLAUDE.md` | documentación/invariante | `AGENTS.md`, `tsconfig` y docs de contribución | Las reglas estrictas son universales y el JSON es la fuente ejecutable. |
| `packages/utils/CLAUDE.md` | documentación normal | README y tests del paquete | Son convenciones de librería puras; no requieren carga contextual frecuente. |
| `packages/notifications/CLAUDE.md` | candidato a integrar | `hospeda-email`/`hospeda-services` + docs | La regla importante es centralizar transportes y validar payloads; no justifica otro skill. |
| `packages/schemas/src/**/CLAUDE.md` | legacy obsoleto | eliminar después de la revisión | Sólo contienen bloques auto-generados de claude-mem, sin reglas del código. |
| `packages/*/CLAUDE.md` bajo `node_modules` | externo | fuera del inventario | No pertenece al repositorio ni a su fuente de verdad. |

Los dos candidatos a integrar todavía deben compararse con el contenido actual
de `hospeda-ui`, `hospeda-email` y `hospeda-services` antes de modificar esos
skills. No se crea un skill por cada configuración de tooling.

## Qué se convierte en comando o documentación

| Contenido encontrado | Destino |
|---|---|
| `startIssue`, `closeIssue`, worktrees, env, promoción y verificación | comandos `qz-*` genéricos y `hops-*` del adapter |
| Recetas repetibles de testing, CI y deploy | scripts/guards y `docs/runbooks/` |
| Arquitectura estable y decisiones | `docs/architecture/` y `docs/decisions/` |
| Historial de cambios, ejemplos de issues y notas fechadas | documentación histórica, no instrucciones automáticas |
| Reglas de seguridad o invariantes que aplican siempre | `AGENTS.md` o guards ejecutables |

## Plan de extracción y retiro

- [x] Crear un `AGENTS.md` corto y universal.
- [x] Inventariar los `CLAUDE.md` del repositorio y sus responsabilidades.
- [x] Extraer los dominios principales a skills con pruebas de render para los cuatro clientes.
- [ ] Comparar cada skill contra su `CLAUDE.md` de origen para evitar pérdida de reglas.
- [x] Clasificar los `CLAUDE.md` pequeños sin skill dedicado y excluir los externos.
- [x] Materializar la capa de conocimiento en OpenCode, Claude Code, Codex y Gentle Shell con `qz-kit project sync`.
- [ ] Mover procedimientos a comandos/scripts y enlazarlos desde la documentación.
- [ ] Ejecutar una ventana de convivencia para Claude, OpenCode, Codex y Gentle Shell.
- [ ] Confirmar que los cuatro clientes leen `AGENTS.md` y los skills instalados.
- [ ] Eliminar los `CLAUDE.md` cuando no quede contenido único sin migrar.

La eliminación es una operación posterior y explícita. Hasta completar la comparación de contenido y la verificación en los cuatro clientes, los archivos legacy se conservan para no perder conocimiento.

## Criterio de finalización

La migración está completa cuando cada regla útil tiene un único hogar, cada workflow ejecutable tiene un wrapper versionado, ningún skill duplica otro, y un agente puede trabajar con `AGENTS.md` más los skills pertinentes sin necesitar leer un `CLAUDE.md` residual.
