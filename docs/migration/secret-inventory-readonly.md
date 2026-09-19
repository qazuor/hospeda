# Inventario read-only de secretos y credenciales

La inspección sólo registró nombres, ubicaciones y mecanismos. No se leyeron valores de `.env`, tokens, claves privadas, cookies ni passwords.

## Fuentes locales

- `.env.local` por aplicación: API, web, admin, e2e y Docker; ignorados y no versionados.
- `.env.example`: contratos de variables, sin valores reales.
- `~/.config/opencode/auth.json`: auth de proveedores; respaldar sin mostrar contenido.
- `~/.claude` y configuración de Gentle/OpenCode: permisos, MCP y perfiles; inspeccionar nombres/rutas, no payloads.
- `~/.engram/engram.db`: memoria; no es un almacén de secretos y no se versiona.
- GitHub/Linear/Sentry/MCP: credenciales externas configuradas fuera del repo.

## Familias detectadas en ejemplos

- API/auth: `HOSPEDA_BETTER_AUTH_SECRET`, `HOSPEDA_BETTER_AUTH_URL`.
- Hash/HMAC/webhooks: `HOSPEDA_LOCATION_SALT`, `HOSPEDA_VIEWS_HASH_SECRET`, `HOSPEDA_REVALIDATION_SECRET`, `HOSPEDA_BREVO_WEBHOOK_SECRET`, `HOSPEDA_NEWSLETTER_HMAC_SECRET`.
- DB: `HOSPEDA_DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- URLs públicas: `HOSPEDA_API_URL`, `HOSPEDA_SITE_URL`, `HOSPEDA_ADMIN_URL`, `PUBLIC_API_URL`, `PUBLIC_SITE_URL`, `VITE_*`.

La lista anterior es un inventario de nombres documentados; no implica que estén presentes ni que sus valores sean válidos.

## Reglas para la instalación futura

1. Respaldar archivos y stores de auth cifrados o con permisos restringidos, sin imprimirlos.
2. No copiar `.env.local` desde un proyecto a otro automáticamente; usar una fuente local protegida y reconciliación por nombres.
3. Separar valores de workstation, worktree, staging y producción.
4. Rechazar DSN con password embebida en JSON versionado y cualquier secreto staged.
5. El bootstrap sólo crea plantillas y reporta variables faltantes; nunca inventa secretos.
6. Los agentes reciben nombres, schemas y comandos de diagnóstico, nunca valores.
7. Toda restauración de auth requiere acción humana y prueba de rollback.

## Estado

El inventario está completo a nivel de mecanismos conocidos. La aprobación final de qué credenciales respaldar/restaurar queda para la etapa de instalación reproducible.
