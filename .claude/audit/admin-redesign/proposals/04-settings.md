---
proposal: settings
status: DRAFT (in active discussion)
version: 0.1
date-started: 2026-05-22
last-updated: 2026-05-22
depends-on: 01-information-architecture.md (v0.7+), 02-config-schema.md (v0.2+)
---

# Settings Pages — Field-level detail

> **Living document.** Field-by-field spec for every settings page in the admin. Anchored to IA doc §7 (Settings split in three places). Lockable decisions in [Decisions log](#decisions-log).

## How to read this doc

Each settings area is a page or set of pages with **fields**, where each field has:

- **Label** (es/en/pt — tri-locale required per schema §3.1)
- **Type** (`text`, `textarea`, `select`, `multi-select`, `toggle`, `radio`, `number`, `currency`, `date`, `time`, `tel`, `email`, `password`, `file`, `color`, `link-only`)
- **Validation** (Zod rule or constraint)
- **Required** (yes/no)
- **Default** (initial value)
- **Persistence** (API endpoint or `localStorage`)
- **Permissions** (required to view/edit)

For grouped pages, sections are separated with `───`.

---

## 1. Principles

### 1.1 Storage rule

- **Affects me only** → API (per-user settings table) for cross-device sync, OR `localStorage` for ephemeral UI prefs (e.g., sidebar collapsed state).
- **Affects all users / the system** → API (platform settings table).
- **Cannot survive a deploy or affect security** → localStorage is fine.
- **No mixed storage in one page**: a page is either all-API or all-localStorage. Never mix.

This kills the audit finding that "platform settings are scattered across 3 routes with mixed storage (API, localStorage)".

### 1.2 Save behavior

- **Auto-save on blur** for simple fields (text, select, toggle) with debounced API calls (500ms). Visual confirmation: a small "Guardado ✓" indicator next to the field.
- **Explicit save button** for grouped multi-field changes (e.g., webhook config with URL + secret + secret rotation).
- **Form-level validation** for atomic groups (e.g., SMTP config requires host + port + user + password all valid).

### 1.3 Danger zones

Operations that are destructive or affect all users (delete account, drop caches, reset metrics, force-sync) require **typed confirmation** with the exact action label:

```
Para confirmar, escribí "ELIMINAR CUENTA" abajo:
[                          ]
[Confirmar] [Cancelar]
```

No "Are you sure?" with a single button — that's too easy to misclick.

### 1.4 i18n

Every label, helper text, error message, success toast — tri-locale via `@repo/i18n`. No hardcoded strings (per i18n audit finding).

---

## 2. Storage map

| Setting area | Where it persists |
|--------------|-------------------|
| Mi cuenta → Perfil público (HOST) | API: `users` table (public_bio, public_avatar, etc.) |
| Mi cuenta → Datos personales | API: `users` table (private fields) |
| Mi cuenta → Preferencias | API: `user_settings` table |
| Mi cuenta → Notificaciones | API: `user_notification_preferences` table |
| Mi cuenta → Seguridad | API: Better Auth + `user_sessions`, `user_2fa` |
| Mi cuenta → Mis datos | API: GDPR endpoints |
| Mi cuenta → Conexiones | API: `user_oauth_links` |
| Mi facturación (HOST) | API: `subscriptions`, `invoices`, `payment_methods` |
| Plataforma → Configuración general | API: `platform_settings` (key-value) |
| Plataforma → Email | API: `email_config` |
| Plataforma → Cache & deploy | API: `cache_config` + ISR API |
| Plataforma → Tags del sistema | API: `tags` table |
| Plataforma → Configuración crítica | API: `platform_critical` (separate table for audit) |
| Comercial → Configuración billing | API: `billing_settings` |
| UI prefs (sidebar collapsed, table density) | `localStorage` |

This table makes the storage decision explicit per setting. No more "in `localStorage` and we forgot".

---

## 3. Mi cuenta

The 5 universal sub-pages of "Mi cuenta", visible to all roles. HOST sees them under main menu item §12.5; ADMIN/SUPER_ADMIN/EDITOR access via topbar avatar.

### 3.1 Perfil

Two variants depending on role:

- **HOST** sees both "Mi perfil público" + "Mis datos personales" as separate pages (per IA §12.5.1 + §12.5.2). Public profile is what guests see on the website.
- **EDITOR / ADMIN / SUPER_ADMIN** see only "Perfil" (no public-facing profile).

#### 3.1.1 Mi perfil público (HOST only)

| Field | Type | Required | Validation | Persistence |
|-------|------|----------|------------|-------------|
| Avatar | file | no | image, max 5MB, jpg/png/webp, square 400×400 recommended | API + media |
| Display name | text | yes | 2-50 chars, profanity filter | API |
| Bio público | textarea | no | max 500 chars, markdown allowed | API |
| Idiomas que hablo | multi-select | no | from i18n.supportedLocales | API |
| Foto de portada | file | no | image, max 5MB, 1200×400 recommended | API + media |
| Visibilidad del perfil | radio | yes | `public` / `guests-only` / `hidden` | API |

**Helper text** on `Visibilidad`: "Tu perfil aparece en la página pública de tus alojamientos. Si lo ocultás, los huéspedes no verán tu foto ni bio."

#### 3.1.2 Mis datos personales (HOST) / Perfil (other roles)

| Field | Type | Required | Validation | Persistence |
|-------|------|----------|------------|-------------|
| Nombre | text | yes | 2-100 chars | API |
| Apellido | text | yes | 2-100 chars | API |
| Email | email | yes | RFC 5322, **read-only here** — change via separate flow (§3.4.5) | API |
| Teléfono | tel | no | E.164 format with country code | API |
| Fecha de nacimiento | date | no | reasonable range (1900-current) | API |
| Documento de identidad | text | no | optional, freeform | API |
| Dirección | composite | no | street, city, state, postal code, country | API |
| Idioma de contacto | select | yes | es/en/pt — used for emails sent to me | API |

### 3.2 Preferencias

| Field | Type | Required | Default | Persistence |
|-------|------|----------|---------|-------------|
| Tema (admin) | radio | yes | `system` | API: user_settings.theme_admin |
| Tema (web) | radio | yes | `system` | API: user_settings.theme_web |
| Idioma UI (admin) | select | yes | `es` | API: user_settings.locale_admin |
| Idioma UI (web) | select | yes | `es` | API: user_settings.locale_web |
| Timezone | select | yes | auto-detected (modifiable) | API: user_settings.timezone |
| Formato de fecha | radio | yes | `DD/MM/YYYY` | API |
| Formato de hora | radio | yes | `24h` | API |
| Densidad de la interfaz | radio | no | `comfortable` (`compact`/`comfortable`/`spacious`) | API |
| Animaciones reducidas | toggle | no | `false` (respects OS prefers-reduced-motion if set) | API |
| Moneda preferida (display) | select | no | `ARS` | API |

Tema options: `system` (follows OS) / `light` / `dark`.
Idioma options: dynamically populated from `i18n.supportedLocales`.

### 3.3 Notificaciones

Two layers: **master toggle** + **per-channel** + **per-type** matrix.

#### Master

| Field | Type | Default | Persistence |
|-------|------|---------|-------------|
| Recibir notificaciones | toggle | `true` | API |

When OFF, everything below is disabled (greyed out) and no notifications are sent regardless of per-type settings.

#### Por canal

| Canal | Toggle | Default | Notes |
|-------|--------|---------|-------|
| Email | toggle | `true` | Always available |
| In-app | toggle | `true` | Always available — appears in topbar bell + `/inicio/inbox` |
| Push web (browser) | toggle | `false` | Requires browser permission grant |
| SMS | toggle | `false` | Requires phone + paid feature |

#### Por tipo (matrix)

| Tipo | Email | In-app | Push | SMS | Default |
|------|-------|--------|------|-----|---------|
| Consultas de huéspedes (HOST) | ✓ | ✓ | – | – | E+I on |
| Reseñas nuevas (HOST) | ✓ | ✓ | – | – | E+I on |
| Reservas confirmadas (HOST) | ✓ | ✓ | – | – | All on |
| Facturación / pagos | ✓ | ✓ | – | ✓ | E+I on |
| Newsletter de la plataforma | ✓ | – | – | – | E on |
| Acciones de seguridad (login, 2FA, password) | ✓ | ✓ | – | ✓ | All on |
| Actividad de mi cuenta | ✓ | ✓ | – | – | I on |
| Borradores / asignaciones (EDITOR) | – | ✓ | – | – | I on |
| Crons / alertas sistema (ADMIN+) | ✓ | ✓ | – | – | E+I on |

#### Quiet hours

| Field | Type | Default | Persistence |
|-------|------|---------|-------------|
| Activar quiet hours | toggle | `false` | API |
| Desde | time | `22:00` | API (when enabled) |
| Hasta | time | `08:00` | API (when enabled) |
| Permitir notificaciones urgentes (security) | toggle | `true` | API |

### 3.4 Seguridad

#### 3.4.1 Contraseña

| Field | Type | Notes |
|-------|------|-------|
| Cambiar contraseña | link-only | Opens `/me/change-password` flow with current password + new password + strength meter |

#### 3.4.2 Autenticación de dos factores (2FA)

| Field | Type | Notes |
|-------|------|-------|
| 2FA habilitado | toggle | When toggled on, opens setup wizard (QR + TOTP secret + verify with first code) |
| Códigos de respaldo | link-only | View, regenerate, download 8 backup codes (only if 2FA on) |
| Método preferido | radio | `TOTP` (default) / `SMS` (paid feature) |

#### 3.4.3 Sesiones activas

Tabla con una fila por sesión activa:

| Columna | Contenido |
|---------|-----------|
| Dispositivo | "Chrome on macOS" (parsed from user-agent) |
| Ubicación aproximada | "Buenos Aires, AR" (from IP geolocation) |
| IP | `192.168.x.x` |
| Última actividad | "hace 5 minutos" |
| Acciones | "Cerrar sesión" (revoca tokens) — la sesión actual NO se puede revocar desde acá |

**Botón global**: "Cerrar todas las sesiones excepto esta" (con typed confirmation).

#### 3.4.4 Historial de inicios de sesión

Tabla read-only de últimos 30 logins:
- Timestamp (relative + absolute on hover)
- IP + ubicación
- User-agent parseado
- Resultado (`success` / `failed` / `2fa-required`)
- Acciones sospechosas marcadas en rojo

#### 3.4.5 Cambiar email

Flow separado (no edit inline). Requiere:
1. Confirmar contraseña actual
2. Ingresar nuevo email
3. Verificar el nuevo email vía link (válido 24h)
4. El email anterior recibe notificación + opción de revertir (válido 7 días)

### 3.5 Mis datos (GDPR)

| Acción | UX | Persistencia |
|--------|----|--------------|
| Descargar mis datos | Botón → genera export async → email con link de descarga (válido 7 días). Formato: JSON + CSV adjunto en zip | API: `gdpr_export_requests` |
| Pausar mi cuenta | Botón → typed confirmation → la cuenta queda inaccesible pero los datos no se eliminan. Reversible | API: `users.status = 'paused'` |
| Solicitar eliminación de cuenta | Botón → typed confirmation + verificación por email → grace period de 30 días → eliminación definitiva. Durante el grace puede cancelarse | API: `gdpr_deletion_requests` |

**Importante**: la eliminación NO es instantánea. Es necesario un grace period para cumplir con compliance + dar oportunidad de cancelar.

### 3.6 Conexiones

#### OAuth providers

Lista de providers configurados en la plataforma (Google, Facebook, Apple, etc.). Por cada uno:

| Estado | Mostrar |
|--------|---------|
| Conectado | Avatar/nombre del provider + email vinculado + "Desconectar" |
| No conectado | "Conectar con [provider]" — abre OAuth flow |

**Regla**: no se puede desconectar el último provider si no hay password establecida. Mensaje: "Configurá una contraseña antes de desconectar [provider]."

#### API keys (HOST con plan que lo incluya — V1+)

V1: out of scope.
Post-V1: lista de keys con nombre, scope, last used, revocar.

---

## 4. Mi facturación (HOST only)

Sección de main menu §12.4 — NO está dentro de Mi cuenta para HOST.

### 4.1 Mi plan actual

Display read-only del plan vigente:

- Nombre del plan
- Precio + moneda + frecuencia (mensual/anual)
- Beneficios incluidos (lista bullet)
- Próximo cobro: fecha + monto
- Estado: `active` / `trial` / `past-due` / `cancelled` (con grace period info)

**Acciones**:
- Cambiar plan (link a comparativa de planes)
- Cancelar suscripción (typed confirmation + razón opcional)

### 4.2 Métodos de pago

Lista de métodos con:
- Tipo (tarjeta, débito automático)
- Últimos 4 dígitos / marca
- Vencimiento
- Default (badge)
- Acciones: marcar default, eliminar (si no es el único)

**Botón**: "Agregar método de pago" → flujo de MercadoPago / proveedor.

### 4.3 Historial de facturas

Tabla:
- Fecha
- Monto + moneda
- Concepto
- Estado (`paid` / `pending` / `refunded`)
- Acciones: ver factura (modal), descargar PDF

Filtros: rango de fechas, estado.

### 4.4 Uso de mi plan

Cards mostrando consumo vs límites del plan:
- Alojamientos publicados: 3 / 5
- Imágenes por alojamiento: 24 / 30
- Almacenamiento: 1.2 GB / 5 GB

Cada card con barra de progreso. Color warning a 80%, danger a 95%, bloqueo a 100%.

### 4.5 Próximo cobro

Pre-visualización detallada:
- Fecha
- Monto base
- Add-ons activos
- Descuentos (promociones, créditos)
- Impuestos
- **Total a cobrar**
- Método de pago a usar

---

## 5. Plataforma → Configuración (ADMIN/SUPER_ADMIN)

Sección §13.6 de la IA. Subdividida en 7 grupos.

### 5.1 Configuración general

#### Información del sitio

| Field | Type | Required | Validation | Persistence |
|-------|------|----------|------------|-------------|
| Nombre del sitio | text | yes | 2-100 chars | API |
| Tagline | text | no | max 200 chars | API |
| Logo | file | no | SVG/PNG, max 1MB | API + media |
| Favicon | file | no | ICO/PNG 32×32, max 50KB | API + media |
| OG image default | file | no | PNG/JPG 1200×630, max 1MB | API + media |
| Email de contacto público | email | yes | RFC 5322 | API |
| Teléfono público | tel | no | E.164 | API |
| Dirección | composite | no | calle, ciudad, provincia, país | API |
| Redes sociales | composite-list | no | platform + URL (FB, IG, X, YouTube, TikTok) | API |

#### SEO defaults

| Field | Type | Default | Persistence |
|-------|------|---------|-------------|
| Meta title template | text | `{title} \| Hospeda` | API |
| Meta description default | textarea | (placeholder copy) | API |
| OG image default | inherits §5.1.Información | – | – |
| Twitter card | radio | `summary_large_image` | API |
| robots.txt | textarea | (generated default) | API |
| Sitemap generation | toggle | `true` | API |
| Sitemap update interval | select | `daily` | API (when generation on) |
| Schema.org type por entidad | select-per-entity | `LodgingBusiness` for accommodations, `BlogPosting` for posts, etc. | API |

#### Localización

| Field | Type | Persistence |
|-------|------|-------------|
| Idiomas habilitados | multi-select | API |
| Idioma default | select (from habilitados) | API |
| Monedas habilitadas | multi-select | API |
| Moneda default | select (from habilitadas) | API |
| Timezones habilitados | multi-select | API |
| Timezone del servidor | select | API |
| Formato de fecha default | radio | API |
| Formato de hora default | radio | API |

#### Feature flags

Lista dinámica de todos los feature flags definidos. Cada uno:

| Columna | Contenido |
|---------|-----------|
| Nombre | flag key |
| Descripción | text (de la config) |
| Estado | toggle global on/off |
| Audiencia | "Todos" / "Por rol" / "Por user" / "% rollout" — abre modal |
| Última modificación | timestamp + user |

### 5.2 Email (infraestructura) — IA doc §13.6.3

#### Proveedor

| Field | Type | Required | Persistence |
|-------|------|----------|-------------|
| Proveedor | select | yes | `brevo` / `resend` / `sendgrid` / `smtp` | API: email_config.provider |
| API key | password (masked, reveal button) | yes (when not SMTP) | API: encrypted at rest |
| Sandbox mode | toggle | yes | `true` in non-prod | API |
| SMTP host/port/user/password | composite | only when provider=`smtp` | API: encrypted | API |

**Test send**: botón para enviar un mail de prueba a un destinatario.

#### Identidad del remitente

Lista de identidades. Por cada una:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| ID (interno) | text | yes | slug |
| Nombre | text | yes | max 100 |
| Email | email | yes | debe pertenecer a dominio verificado |
| Reply-to | email | no | RFC 5322 |
| Usado por | multi-select | no | tipos de email que usan esta identidad |

**Default identity**: una identidad debe estar marcada como `default` (fallback cuando ninguna otra aplica).

#### Dominios y DKIM/SPF/DMARC

| Por dominio | Mostrar |
|-------------|---------|
| Dominio | `mail.hospeda.com.ar` |
| Estado de verificación | `verified` / `pending` / `failed` (badge + última verificación) |
| Registros DNS requeridos | tabla read-only: SPF, DKIM, DMARC con valores específicos a copiar |
| Acciones | "Volver a verificar", "Eliminar" |

**Botón**: "Agregar dominio" → wizard.

#### Throttling y rate limits

| Field | Type | Default |
|-------|------|---------|
| Max emails por minuto | number | 60 |
| Max emails por hora | number | 1000 |
| Max emails por día | number | 10000 |
| Burst allowance | number | 100 |
| Max emails por user por día | number | 50 |

Valores se enforce server-side antes de llamar al proveedor.

#### Plantillas de sistema

Lista de plantillas transactionales. Por cada una:

| Field | Type |
|-------|------|
| ID | read-only slug |
| Nombre | text |
| Subject (es/en/pt) | text |
| Body (es/en/pt) | rich text editor (MJML o handlebars-flavored) |
| Variables disponibles | read-only list |
| Identidad remitente | select (de §5.2.Identidad) |
| Test send | button |
| Última modificación | timestamp + user |

Plantillas típicas: welcome, password-reset, email-verification, payment-receipt, payment-failed, host-new-inquiry, etc.

#### Unsubscribe y compliance

| Field | Type | Default | Persistence |
|-------|------|---------|-------------|
| Unsubscribe page URL | url | `/unsubscribe` | API |
| Footer GDPR (text per locale) | textarea ×3 | (placeholder) | API |
| Privacy policy link | url | `/legal/privacy` | API |
| Período de retención de datos (días) | number | 730 | API |
| Auto-eliminar suscriptores inactivos (días sin abrir) | number (0 = nunca) | 0 | API |

#### Logs de entregas

Tabla filtrable de TODO email enviado:

| Columna | Contenido |
|---------|-----------|
| Timestamp | absoluto |
| Tipo | transactional / newsletter / system |
| Destinatario | email |
| Asunto | text |
| Estado | `queued` / `sent` / `delivered` / `bounced` / `opened` / `clicked` / `complaint` |
| Identidad | from email |
| Ver detalle | modal con payload + tracking events |

Filtros: rango fechas, tipo, estado, destinatario.

### 5.3 Cache y deploy

#### ISR / Revalidación (config)

Tabla por entidad:

| Entidad | TTL (segundos) | Modo | Acciones |
|---------|----------------|------|----------|
| accommodation | 3600 | `stale-while-revalidate` / `revalidate` / `static` | Editar |
| destination | 7200 | swr | Editar |
| post | 1800 | swr | Editar |
| event | 600 | swr | Editar |

#### Revalidación manual

| Field | Type | Notes |
|-------|------|-------|
| Paths a revalidar | textarea | Una ruta por línea (`/destinos/concepcion`, `/blog/articulo-x`) |
| Tag-based revalidate | multi-select | Tags ISR (e.g., `posts`, `events`) |
| Purgar todo | button + typed confirmation | Danger zone — invalida todo el cache |

#### Historial de revalidaciones

Tabla read-only últimas 50 revalidaciones: timestamp, user, paths/tags, resultado, tiempo de ejecución.

### 5.4 Operaciones del sistema

#### Cron jobs

Tabla:

| Columna | Contenido |
|---------|-----------|
| Nombre | `dunning-reminders` |
| Schedule | `0 9 * * *` + descripción legible "Diario a las 9am" |
| Última ejecución | timestamp + duración + resultado |
| Próxima ejecución | timestamp |
| Estado | `enabled` / `disabled` / `failing` |
| Acciones | Trigger manual, ver logs, habilitar/deshabilitar |

#### Webhook events

Tabla filtrable de eventos recibidos + enviados:

| Columna | Contenido |
|---------|-----------|
| Timestamp | absoluto |
| Source / Target | provider name |
| Tipo | event name |
| Estado | `received` / `processed` / `failed` / `retrying` |
| Payload (preview) | first 100 chars |
| Acciones | Ver detalle (modal con payload completo + raw headers), reintentar |

#### Logs del sistema

| Field | Type |
|-------|------|
| Nivel | radio: `error` / `warn` / `info` / `debug` (cumulativo: si elegís warn ves warn+error) |
| Rango de fechas | date-range picker |
| Buscar texto | search input |
| Source filter | multi-select: `api`, `web`, `admin`, `cron`, `webhook`, etc. |

Resultado: tabla con timestamp + nivel + source + mensaje + contexto JSON.

#### Métricas internas

Cards con métricas en tiempo real:

- API latency (p50, p95, p99)
- DB query time avg
- Cache hit ratio
- Active connections (DB, Redis)
- Memory usage del proceso
- CPU usage
- Disk usage

Cada métrica con sparkline de últimas 24h.

### 5.5 Tags del sistema

Dos sub-pages:

#### Tags internas

CRUD con campos: ID slug, nombre (i18n), color, categoría, descripción, scope (entity types donde aplica), enabled.

#### Tags de sistema

CRUD similar para tags públicos de sistema.

### 5.6 Configuración crítica (SUPER_ADMIN ONLY)

#### Modo mantenimiento

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Modo mantenimiento activo | toggle | `false` | Toggle requiere typed confirmation |
| Mensaje (i18n) | textarea ×3 | (placeholder) | Mostrado en la página de mantenimiento |
| Apps afectadas | multi-select | `web` + `admin` | `web` / `admin` / `api` |
| IPs allowlist | textarea | (empty) | Una IP/rango por línea — bypass del mantenimiento |
| Inicio | datetime | now | Puede agendarse a futuro |
| Fin | datetime | – | Termina automáticamente |

#### Anuncios globales

Lista de banners activos. Por cada anuncio:

| Field | Type |
|-------|------|
| Título (i18n) | text ×3 |
| Mensaje (i18n) | textarea ×3 |
| Link opcional | url + label |
| Variante | radio: `info` / `warning` / `danger` / `success` |
| Dismissible | toggle |
| Apps donde se muestra | multi-select |
| Audiencias | multi-select de roles |
| Inicio / Fin | datetime each |
| Estado | `draft` / `active` / `expired` |

#### Danger zone

Acciones destructivas, cada una con typed confirmation + log a auditoría:

- **Drop all caches** — invalida ISR + Redis + CDN.
- **Recompute analytics** — re-procesa eventos desde X fecha.
- **Reset platform metrics** — solo testing.
- **Force re-sync con MercadoPago** — re-sincroniza todas las suscripciones.
- **Resetear contraseña de todos los users** — fuerza re-login + envía email reset (uso extremo, e.g., breach).

### 5.7 Auditoría (SUPER_ADMIN ONLY)

#### Log de acciones admin

Tabla:
- Timestamp
- User (avatar + nombre)
- Action (`user.update`, `setting.change`, `accommodation.delete`, etc.)
- Target (entity type + ID + nombre)
- IP
- Diff (button → modal con before/after JSON)

Filtros: user, action, target type, rango fechas.

#### Log de impersonations

Tabla:
- Timestamp inicio
- Impersonator (user + IP)
- Impersonated (target user + role)
- Razón (texto obligatorio al iniciar impersonation)
- Duración
- Acciones realizadas durante la impersonation (link al subset del audit log)

#### Cambios de permisos

Tabla:
- Timestamp
- Quien hizo el cambio (user)
- Sobre quien (target user)
- Permiso (added / removed)
- Razón (opcional)
- Antes → Después (diff del array de permisos)

---

## 6. Comercial → Configuración billing (ADMIN+)

IA doc §13.5.7 — operaciones de billing-specific (NO infra, eso va en Plataforma → Email/Webhooks).

### 6.1 Trial

| Field | Type | Default | Persistence |
|-------|------|---------|-------------|
| Duración del trial (días) | number | 14 | API |
| Auto-block al expirar | toggle | `true` | API |
| Mostrar trial CTA en signup | toggle | `true` | API |
| Texto CTA del trial (i18n) | text ×3 | "14 días gratis, sin tarjeta" | API |

### 6.2 Payment

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Grace period (días) | number | 7 | Después del impago antes de bloquear |
| Intentos de retry | number (1-10) | 3 | API |
| Intervalo entre retries (horas) | number | 24 | API |
| Moneda default | select | `ARS` | Sincronizada con Localización general |
| Aceptar pagos con débito automático | toggle | `true` | API |
| Aceptar pagos con tarjeta | toggle | `true` | API |
| Conversión automática (multi-currency) | toggle | `false` | Si on, usa Tipos de cambio (§13.5.6) |

### 6.3 Webhooks (read-only — config en Plataforma)

| Campo | Valor |
|-------|-------|
| Webhook URL | display only (set en Plataforma → Webhooks) |
| Webhook secret | masked + botón "Rotar secret" |
| Última recepción | timestamp + tipo |
| Eventos suscriptos | lista read-only |

Link "Configurar webhooks" → abre Plataforma → Webhooks (no edit aquí).

### 6.4 Reminders de pago

| Field | Type | Default |
|-------|------|---------|
| Enviar reminders de pago próximo | toggle | `true` |
| Días antes del vencimiento | number | 3 |
| Enviar recibo al pagar | toggle | `true` |
| Enviar aviso de fallo de pago | toggle | `true` |
| Reintentar email de aviso si falla | toggle | `true` |

### 6.5 Notas a clientes

Default templates (links a Plataforma → Email → Plantillas):
- payment-success
- payment-failed
- payment-reminder
- subscription-expiring
- subscription-cancelled

---

## 7. Permission gates per area

| Setting area | Permission required |
|--------------|---------------------|
| Mi cuenta (all sub-pages) | `USER_UPDATE_SELF` |
| Mi cuenta → Cambiar email | `USER_UPDATE_SELF` + actual password |
| Mi cuenta → Mis datos (export, pausar, delete) | `USER_UPDATE_SELF` (delete requires email verification too) |
| Mi facturación (HOST) | `BILLING_VIEW_OWN`, `SUBSCRIPTION_VIEW_OWN`, `PAYMENT_METHOD_MANAGE_OWN`, `INVOICE_VIEW_OWN` |
| Plataforma → Config general | `SETTINGS_GENERAL_VIEW` (read) + `SETTINGS_GENERAL_WRITE` (edit) |
| Plataforma → Email | `EMAIL_INFRA_VIEW` + `EMAIL_INFRA_WRITE` |
| Plataforma → Cache y deploy | `CACHE_VIEW` + `CACHE_WRITE` |
| Plataforma → Operaciones | `LOG_VIEW`, `CRON_VIEW` + `CRON_TRIGGER`, `WEBHOOK_VIEW` |
| Plataforma → Tags del sistema | `TAG_SYSTEM_VIEW` + `TAG_SYSTEM_WRITE` |
| Plataforma → Configuración crítica | `MAINTENANCE_MODE_WRITE`, `ANNOUNCEMENT_GLOBAL_WRITE`, `DANGER_ZONE_EXECUTE` (SUPER_ADMIN only) |
| Plataforma → Auditoría | `AUDIT_LOG_VIEW`, `IMPERSONATION_LOG_VIEW`, `PERMISSION_CHANGES_LOG_VIEW` (SUPER_ADMIN only) |
| Comercial → Config billing | `BILLING_SETTINGS_VIEW` + `BILLING_SETTINGS_WRITE` |

---

## 8. Special UX patterns

### 8.1 2FA setup wizard

Flow modal 3 steps:
1. Mostrar QR + secret manual. Indicar app recomendada (Google Authenticator, Authy, 1Password).
2. Ingresar primer código TOTP para verificar.
3. Mostrar 8 códigos de respaldo. Forzar descarga antes de cerrar el modal.

### 8.2 Cambiar email

Flow page-level (no inline):
1. `/me/security/change-email`
2. Ingresar password actual + nuevo email.
3. Mail al nuevo email con link de verificación (24h).
4. Después de verificar, mail al email anterior con notificación + opción "revertir" (7 días).

### 8.3 Danger zone confirmation pattern

Modal con:
- Título: "Confirmar [acción]"
- Descripción de qué hace y qué se pierde
- Input text: "Para confirmar, escribí `[ACCIÓN EN MAYÚSCULAS]` abajo"
- Botón `Confirmar` deshabilitado hasta que el input coincida exactamente
- Botón secundario `Cancelar` (default focus)

### 8.4 Test send (email)

Botón "Enviar prueba" abre modal:
- Destinatario (email, default: el del user actual)
- Identidad remitente (select)
- Plantilla (select, si aplica)
- Variables de prueba (key-value pairs)
- Botón "Enviar"
- Después de enviar: mostrar status del send (delivered? bounced?) en tiempo real

### 8.5 Auto-save indicator

Junto a cada field con auto-save:
- Estado idle: nada
- Estado saving: spinner pequeño + "Guardando..."
- Estado saved: ✓ + "Guardado" (fade out después de 2s)
- Estado error: ✕ + tooltip con error + botón retry

---

## Open questions

### A. Auto-save vs explicit save default [OPEN]

V1 propuesto: auto-save para fields simples, explicit save para grupos. ¿Te suena, o preferís TODO con explicit save (más predecible) o TODO auto-save (más fluido)?

### B. 2FA SMS soporte en V1 [OPEN]

2FA TOTP es suficiente para V1. SMS requiere proveedor + costos por mensaje. ¿Lo dejamos fuera de V1?

### C. Email change con grace period [OPEN]

Propuesta: el email anterior puede revertir el cambio durante 7 días. Esto agrega complejidad. ¿OK, o cambiamos a "cambio instantáneo, sin grace"?

### D. Detail level de notificaciones por tipo [OPEN]

Propuesta: matriz tipo × canal con ~9 tipos. ¿Está bien la granularidad o querés más/menos? Más = control fino pero overwhelm; menos = simplicidad pero "no quiero estos pero sí estos otros" pierde.

### E. localStorage usage [OPEN]

Propuesta: localStorage SOLO para UI prefs efímeras (sidebar collapsed, table density). El resto a API. ¿OK?

---

## Decisions log

| Date | Decision | Section |
|------|----------|---------|
| 2026-05-22 | Storage strategy: API para todo lo que afecta security/identity/cross-device; localStorage solo UI ephemeral (sidebar collapsed, table density). No mixing in one page | §1.1 |
| 2026-05-22 | Save behavior: auto-save on blur for simple fields (debounced 500ms); explicit save for grouped multi-field configs | §1.2 |
| 2026-05-22 | Danger zones use typed confirmation (exact text match) + button disabled until match. No simple "Are you sure?" | §1.3 |
| 2026-05-22 | All labels and messages tri-locale (es/en/pt) via @repo/i18n. Zero hardcoded strings | §1.4 |
| 2026-05-22 | HOST has 2-page Perfil split: "Mi perfil público" (what guests see) + "Mis datos personales" (private backoffice data). Other roles only have "Perfil" | §3.1 |
| 2026-05-22 | Notificaciones use a master toggle + per-channel toggles + per-type matrix. ~9 notification types, 4 channels (email, in-app, push web, SMS) | §3.3 |
| 2026-05-22 | Sesiones activas: shown with device/IP/location, revocable individually; current session NOT self-revocable; global "Cerrar todas las sesiones excepto esta" with typed confirmation | §3.4.3 |
| 2026-05-22 | Email change: separate page flow (no inline). Verification link 24h, revert window 7 days | §3.4.5, §8.2 |
| 2026-05-22 | GDPR: descargar datos (async + email link), pausar cuenta (reversible), eliminar cuenta (typed confirm + 30-day grace) | §3.5 |
| 2026-05-22 | Mi facturación as separate HOST main menu item (NOT inside Mi cuenta), with 5 sub-pages: Mi plan, Métodos de pago, Historial de facturas, Uso del plan, Próximo cobro | §4 |
| 2026-05-22 | Plataforma → Email organizes 7 sub-groups: Proveedor, Identidad, Dominios/DKIM, Throttling, Plantillas de sistema, Unsubscribe/Compliance, Logs de entregas | §5.2 |
| 2026-05-22 | Webhooks config in Comercial → Configuración billing is READ-ONLY display; edit happens in Plataforma → Webhooks (Operations vs Configuration split per IA §15) | §6.3 |
| 2026-05-22 | Reminders de pago: 5 toggles + days-before-due number; templates referenced from Plataforma → Email → Plantillas | §6.4 |
| 2026-05-22 | 2FA setup is a 3-step wizard with mandatory backup-codes download before closing | §8.1 |
| 2026-05-22 | Test send (email) is a global modal accessible from Plataforma → Email pages, with destinatario + identidad + plantilla + variables | §8.4 |

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial full draft. 7 main sections covering Mi cuenta (universal, 6 sub-pages), Mi facturación (HOST exclusive, 5 sub-pages), Plataforma → Configuración (7 groups with full field detail including Critical/Audit super-only), Comercial → Configuración billing (5 sub-areas), permission gates table, special UX patterns (2FA wizard, danger zone confirmation, email change flow, auto-save indicator). 5 open questions (save behavior default, SMS 2FA scope, email change grace, notification granularity, localStorage scope). |
