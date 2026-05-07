# SPEC: Deploy de Hospeda a VPS Self-Hosted con Coolify

> **Versión**: 3.0
> **Fecha**: 2026-05-06 (revisión 3)
> **Autor**: qazuor + Claude
> **Estado**: Listo para ejecutar (auditado contra el repo + servicios externos; blockers explícitos listados al inicio de Fase 6)
> **Audiencia**: Cualquier persona, incluso sin conocimiento técnico avanzado, debería poder seguir este manual paso a paso.
>
> **Cambios v3 vs v2** (auditoría 2026-05-06):
>
> - Fase 0 ampliada: 3 timers nuevos (GitHub App de Coolify, pin de drizzle-kit, pre-flight de billing R2)
> - Fase 4: corregido el "no soporta Ubuntu 24.04" — Coolify soporta 22.04 LTS y 24.04 LTS
> - Fase 6: nuevo bloque "Estado actual del repo (BLOCKERS reales)" que enumera los 7 puntos pendientes detectados por la auditoría — Dockerfiles inexistentes, adapter Vercel activo, dep `@upstash/qstash`, Better Auth sin `crossSubDomainCookies`, workflows `cd-*` y `refresh-search.yml` activos, `vercel.json` × 3, `apps/api/src/cron/qstash.ts` y `setup-qstash-schedules.ts`, vars `QSTASH_*` en el registry
> - Fase 12: aclarado conteo de migrations manuales (21 forward + 7 `_down` = 26 archivos en disco; solo aplicamos los 21 forward al deploy inicial)
> - Fase 14: documentado que Better Stack free incluye **heartbeats** (no solo monitors HTTP) — útil para validar que cada cron in-process corrió
> - Servicios externos re-verificados (Vultr SP, Coolify API v1, Cloudflare R2, Resend, MercadoPago, Better Auth `crossSubDomainCookies`, Drizzle Kit push)
>
> **Cambios v2 vs v1**:
>
> - Fase 0 nueva: kickoff de timers externos (DNS, Resend, R2) al inicio en paralelo
> - Crons: 100% in-process en VPS vía `node-cron` (16 jobs); QStash y GH Actions cron eliminados
> - CI/CD: workflows `cd-*` eliminados (Coolify auto-deploy); CI workflows mantenidos sin Vercel
> - Scripts `env:*` migrados de Vercel API a Coolify API
> - Dockerfiles corregidos con TODOS los workspace deps reales por app
> - Better Auth `crossSubDomainCookies` con código exacto y location del archivo
> - Env vars completas en Fase 9 (Cloudinary, Resend, Sentry, MP, OAuth)
> - Fase 12 reescrita: flujo de migrations desde laptop, validación con `--resolve` antes del cutover, procedimiento de cutover de `api` con rollback
> - Smoke tests Fase 15 ampliados (SSO, cron, webhooks MP, email DKIM)
> - Apéndice C nuevo: checklist de cutover ejecutiva

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. Conceptos básicos que tenés que entender
3. [Arquitectura final](#3-arquitectura-final)
4. [Pre-requisitos y cuentas](#4-pre-requisitos)
5. **Fase 0 — Kickoff de timers externos (DNS, Resend, R2, BetterStack)** ← NUEVA, hacer primero
6. Fase 1 — Generar SSH key (referencia, ya hecho en Fase 0)
7. Fase 2 — Crear VPS en Vultr (referencia, ya hecho en Fase 0)
8. Fase 3 — Hardening del VPS
9. Fase 4 — Instalar Coolify
10. Fase 5 — Verificar DNS y configurar dominio Coolify
11. Fase 6 — Cambios de código (Dockerfiles + cron + CI/CD + env scripts)
12. Fase 7 — Configurar Postgres y Redis en Coolify
13. Fase 8 — Conectar GitHub a Coolify
14. Fase 9 — Crear las 3 apps en Coolify
15. Fase 10 — Configurar dominios y SSL
16. Fase 11 — Crear branch de staging
17. Fase 12 — Primer deploy y migrations
18. Fase 13 — Setup de backups automáticos
19. Fase 14 — Setup de monitoring (Better Stack)
20. Fase 15 — Smoke tests finales
21. Fase 16 — Cleanup de Vercel, Neon, Upstash
22. Apéndice A — Troubleshooting
23. Apéndice B — Runbook operacional
24. Apéndice C — Checklist de cutover (resumen ejecutivo)

---

## 1. Resumen ejecutivo

### Qué vamos a hacer

Mover Hospeda de **Vercel + Neon + Upstash** (cloud managed) a **un VPS Vultr en São Paulo + Coolify** (self-hosted). Vamos a tener:

- **1 servidor** (VPS Vultr, $24/mes)
- **3 apps en producción** (api, web, admin)
- **3 apps en staging** (la misma estructura, en otro branch)
- **1 base de datos Postgres** (compartida prod+staging por ahora; podemos separarlas después)
- **1 cache Redis**
- **Backups automáticos** a Cloudflare R2 (gratis)
- **Monitoring** con Better Stack (gratis)
- **CDN/DDoS protection** con Cloudflare (gratis, ya lo tenés)

### Por qué este cambio

- Vercel te falló múltiples veces durante los últimos días.
- Latencia desde Vercel (Virginia, USA) a Argentina: ~150-180ms. Desde São Paulo: ~30-50ms. **3-4x más rápido para tus usuarios reales**.
- Costo Vercel cuando lances en serio: $75-130/mes. VPS: $24/mes.
- Single point of debugging: cuando algo se rompe, vos tenés acceso total a logs, métricas, configuración.

### Cuánto vas a tardar

**Total realista**: 2-3 días de trabajo dedicado, distribuibles en 3-5 días con tiempos de espera (DNS propagation, etc.).

---

## 2. Conceptos básicos

Te explico cosas que vamos a usar, en lenguaje simple:

### VPS (Virtual Private Server)

Una computadora alquilada en un datacenter, con tu sistema operativo, tus archivos, tu IP. Es como tener una compu dedicada solo para vos, que está prendida 24/7 y conectada a internet, pero que físicamente está en São Paulo.

### Docker

Una herramienta que "empaqueta" tu app con todo lo que necesita (sistema, librerías, código) en una caja portable llamada **container**. Esa caja podés correrla en cualquier compu igual: tu laptop, el VPS, lo que sea. Hace que las apps no se peleen entre ellas y que sean fáciles de mover.

### Coolify

Una interfaz web (panel de control) que se instala en tu VPS y te permite gestionar Docker desde un navegador, sin tener que escribir comandos complicados. Es similar a Vercel pero corriendo en TU servidor. Te deja:

- Conectar tu repo GitHub
- Hacer deploy con un click
- Ver logs en tiempo real
- Configurar variables de entorno
- Crear bases de datos y cache
- Configurar dominios y SSL automático

### SSH

Es la forma de conectarte remotamente a tu VPS desde tu laptop, como si estuvieras sentado frente al servidor. Necesitás una "llave SSH" que es como una llave física pero digital.

### DNS

El sistema que traduce nombres (`hospeda.com.ar`) en direcciones IP (`192.0.2.1`). Cuando alguien escribe tu URL, el DNS le dice "anda a esta IP". Lo gestionamos en Cloudflare.

### Cloudflare

Un servicio que se pone "delante" de tu servidor. Hace 3 cosas para vos:

- **DNS**: traduce nombres a IPs
- **Proxy/CDN**: cachea contenido cerca del usuario, hace que cargue rápido
- **Seguridad**: bloquea ataques (DDoS, bots, etc.)

### Better Auth

La librería de autenticación que ya usás en Hospeda (login, signup, sessions). NO cambia con la migración, solo le tenemos que agregar una línea para que las cookies funcionen entre `web.hospeda.com.ar` y `admin.hospeda.com.ar`.

### Branch (rama)

En Git, un "branch" es una versión paralela de tu código. Vos hoy tenés `main`. Vamos a crear otro llamado `staging`. Las dos versiones se buildean por separado en Coolify y van a dominios distintos.

---

## 3. Arquitectura final

```
                    Internet
                       │
                       ▼
                   Cloudflare
                  (DNS + CDN)
                       │
                       ▼
              ┌─────────────────┐
              │  VPS Vultr SP   │
              │   $24/mes HF    │
              │  IP: x.x.x.x    │
              ├─────────────────┤
              │     Coolify     │
              │   (panel UI)    │
              ├─────────────────┤
              │  Traefik        │ ← reverse proxy + SSL
              ├─────────────────┤
              │ Postgres 16     │ ← base de datos
              │ Redis 7         │ ← cache
              ├─────────────────┤
              │ PRODUCCIÓN      │ (rama main)
              │  ├─ api         │ → api.hospeda.com.ar
              │  ├─ web         │ → hospeda.com.ar
              │  └─ admin       │ → admin.hospeda.com.ar
              ├─────────────────┤
              │ STAGING         │ (rama staging)
              │  ├─ api         │ → staging-api.hospeda.com.ar
              │  ├─ web         │ → staging.hospeda.com.ar
              │  └─ admin       │ → staging-admin.hospeda.com.ar
              └─────────────────┘

Servicios externos (gratis):
  ├─ Cloudinary  → uploads de imágenes de usuarios
  ├─ Sentry      → tracking de errores
  ├─ Resend      → envío de emails
  ├─ Cloudflare R2 → backups de la DB
  ├─ Better Stack → monitoring de uptime
  ├─ MercadoPago → pagos
  └─ GitHub      → código + CI/CD
```

---

## 4. Pre-requisitos

### Cuentas que necesitás (todas tienen versión gratis salvo Vultr)

- [x] **GitHub** — ya tenés (qazuor/hospeda)
- [x] **Cloudflare** — ya tenés con `hospeda.com.ar` configurado
- [x] **Cloudinary** — ya tenés
- [x] **Sentry** — ya tenés
- [ ] **Vultr** — vamos a crear ([https://www.vultr.com](https://www.vultr.com))
- [ ] **Resend** — vamos a crear ([https://resend.com](https://resend.com))
- [ ] **Cloudflare R2** — se activa desde tu cuenta Cloudflare (gratis)
- [ ] **Better Stack** — vamos a crear ([https://betterstack.com](https://betterstack.com))

### Conocimientos previos asumidos

- Sabés abrir una terminal/consola en tu compu
- Sabés copiar y pegar comandos
- Tenés Git instalado y sabés hacer commit/push básico
- Tenés acceso al repositorio en GitHub

### Lo que NO necesitás saber

- Linux administration avanzada (te paso comandos exactos)
- Docker (Coolify lo abstrae)
- Postgres administration (Coolify lo gestiona)

---

## Fase 0 — Kickoff de timers externos (PARALELIZAR LO QUE TARDA)

**Tiempo estimado**: 45-60 minutos de trabajo activo, dispara 1-24h de propagación en background
**Riesgo**: Bajo (todos los pasos son creación de cuentas y registros)

### Por qué esta fase existe

Hay cosas que **demoran sin que vos puedas hacer nada**:

- **DNS propagation**: 5-60 minutos (a veces hasta 24h en redes ISP lentas)
- **Verificación de dominio en Resend** (SPF/DKIM): 1-24h dependiendo del provider
- **Activación de Cloudflare R2**: instantánea pero a veces piden verificación de tarjeta
- **Aprovisionamiento de VPS Vultr**: 1-3 minutos
- **Aprobación de GitHub App**: instantánea

La idea de esta fase es **disparar todos los timers externos al inicio** y trabajar en otras cosas (hardening, código, Coolify) **mientras propagan en paralelo**. Sin esta fase, terminás esperando 30-60 min en el medio del flujo bloqueando la migración.

### Orden de ejecución (importante)

Los pasos están ordenados por dependencias. **0.1 → 0.2 → 0.3 son secuenciales** (la IP del VPS se necesita para el DNS). El resto se puede hacer en paralelo en otra pestaña/terminal.

### Paso 0.1 — Crear cuenta Vultr + cargar crédito

1. Andá a <https://www.vultr.com> → **Sign Up**
2. Completá email + password, confirmá email
3. Cargá mínimo $10 USD (tarjeta o PayPal)

**Mientras se confirma el pago** (puede tardar 1-5 min), pasá al 0.2.

### Paso 0.2 — Generar SSH key + subir a Vultr

(Esto es el contenido de las Fases 1 y 2.2 de la versión anterior — fusionado acá)

```bash
ls -la ~/.ssh/
# Si no existe id_ed25519, generá una:
ssh-keygen -t ed25519 -C "qazuor@hospeda"
cat ~/.ssh/id_ed25519.pub
```

Copiá la línea entera. En Vultr → **Account** → **SSH Keys** → **Add SSH Key**:

- Name: `qazuor-laptop`
- Key: pegar la pública

### Paso 0.3 — Crear VPS y obtener la IP

(Equivalente a la Fase 2 vieja — comprimida)

1. Vultr → **Products** → **Compute** → **Deploy New Server**
2. Configuración:
   - **Type**: Cloud Compute - High Frequency
   - **Location**: São Paulo (BRA)
   - **OS**: Ubuntu 22.04 LTS x64 (o 24.04 LTS x64 — ambas soportadas por Coolify)
   - **Plan**: $24/mo (2 CPU, 4GB RAM, 128GB NVMe)
   - **SSH Keys**: tickeá `qazuor-laptop`
   - **Hostname**: `hospeda-prod`
   - **Label**: `Hospeda Production`
   - **NO** actives "Automated Backups" (usamos R2 más barato + mejor)
   - **Vultr Firewall Group**: dejar vacío
3. Click **Deploy Now**
4. Esperá 1-3 min hasta que el status sea **Running**
5. **Anotá la IPv4** del server. La vamos a usar AHORA en el paso 0.4.

> **Nota crítica**: NO te pongás a hardenear el VPS todavía. Primero disparamos DNS (paso 0.4) para que empiece a propagar mientras vos hacés el hardening después.

### Paso 0.4 — Cargar TODOS los DNS records de una vez en Cloudflare

**Acción más importante de esta fase.** Apenas tenés la IP, vas a Cloudflare y cargás los 7 records de una sola vez. Cada minuto que pasa = más propagación lista cuando llegás a Fase 10.

1. <https://dash.cloudflare.com> → zona `hospeda.com.ar` → **DNS** → **Records**
2. **Identificá los records existentes**. Probablemente tenés `api` apuntando a Vercel (`cname.vercel-dns.com`).
   - **NO LO TOQUES TODAVÍA**. Lo switcheamos en Fase 12 cuando la API en VPS esté validada (sería el cutover).
3. **Agregá UNO POR UNO los 7 records nuevos**:

| Type | Name | Value | Proxy | TTL |
|------|------|-------|-------|-----|
| A | `coolify` | TU_IP_VPS | 🟠 Proxied | Auto |
| A | `@` (apex) | TU_IP_VPS | 🟠 Proxied | Auto |
| CNAME | `www` | `hospeda.com.ar` | 🟠 Proxied | Auto |
| A | `admin` | TU_IP_VPS | 🟠 Proxied | Auto |
| A | `staging` | TU_IP_VPS | 🟠 Proxied | Auto |
| A | `staging-api` | TU_IP_VPS | 🟠 Proxied | Auto |
| A | `staging-admin` | TU_IP_VPS | 🟠 Proxied | Auto |

> **Por qué NO incluimos `api` ahora**: la API actual está en Vercel y queremos que siga funcionando hasta que validemos la nueva en VPS. El cutover de `api.hospeda.com.ar` se hace en Fase 12 (paso explícito al final), una vez que `https://api.hospeda.com.ar/health` responde 200 desde el VPS.
>
> **Por qué TODOS proxied (🟠)**: Cloudflare cachea + protege DDoS + oculta tu IP real. La única excepción donde podés usar 🔘 DNS only es si Coolify pide HTTP-01 challenge para Let's Encrypt y falla — en ese caso, momentáneamente desactivás el proxy del subdominio que falla, esperás el cert y lo volvés a activar.

1. **Configurá SSL en modo "Full (strict)"**:
   - SSL/TLS → Overview → **Full (strict)**
   - **NO** "Flexible" (es inseguro)

1. **DNS empieza a propagar**. Tiempo estimado: 5-60 min (a veces 24h pero raro). Mientras propaga, seguís con los pasos siguientes.

### Paso 0.5 — Crear cuenta Resend + verificar dominio

> **Por qué Resend**: la spec ya menciona que se usa para envío de emails (transaccional, signup, recuperación de password). Si vas a salir de Vercel también querés salir de cualquier lock-in en email. Si ya estás usando otro provider (SendGrid, Mailgun, etc.) y querés mantenerlo, **saltá este paso**.

1. <https://resend.com> → Sign up
2. **Add Domain**: `hospeda.com.ar`
3. Resend te da 4 DNS records para agregar en Cloudflare:
   - 1 record TXT para verificación (`_resend.hospeda.com.ar` o similar)
   - 1 SPF (TXT) → `v=spf1 include:amazonses.com ~all` (o el include de Resend actual)
   - 2 DKIM (CNAME) → keys con prefijo `resend._domainkey...`
   - (opcional) DMARC TXT
4. **Agregá los 4 en Cloudflare DNS** (todos con Proxy 🔘 DNS only — los TXT/CNAME de email NO se proxean)
5. En Resend, click **Verify**. Puede tardar 5 min a 24h.

> **Importante**: si Resend no verifica en 1h, revisá que los records DNS estén bien (Cloudflare a veces rompe el formato de TXT muy largos). Usá `dig TXT _resend.hospeda.com.ar` para verificar que resuelve.

### Paso 0.6 — Activar Cloudflare R2 y crear bucket de backups

> **Heads-up**: Cloudflare a veces requiere validación adicional de tarjeta cuando activás R2 por primera vez (verificación 3D-Secure, monto de prueba reembolsable, etc.). Esto puede tomar 5 min a 24h dependiendo del banco. Hacelo HOY aunque no vayas a usarlo hasta Fase 13.

1. <https://dash.cloudflare.com> → **R2** (sidebar izquierdo)
2. Click **Enable R2**. Te puede pedir confirmar tarjeta (R2 es free hasta 10GB + 1M Class A ops/mes, después $0.015/GB).
3. **Create bucket**: `hospeda-backups`
4. **Manage R2 API Tokens** → **Create API token**:
   - Permissions: **Object Read & Write**
   - Bucket: solo `hospeda-backups`
   - TTL: sin expiración (o 1 año)
5. **Anotá** Access Key ID, Secret Access Key, Endpoint URL. Los vamos a usar en Fase 13.

### Paso 0.7 — Crear cuenta Better Stack

1. <https://betterstack.com> → Sign up
2. Plan **Free** (10 monitors, suficiente para 6 dominios + 4 más)
3. **NO** crees monitors todavía, los hacemos en Fase 14 cuando los dominios resuelvan.

### Paso 0.8 — MercadoPago: anotar URLs de webhook actuales

> **Por qué este paso**: cuando hagas el cutover de `api.hospeda.com.ar` a VPS (Fase 12), MercadoPago va a seguir mandando webhooks al MISMO host (`api.hospeda.com.ar`), o sea, no hay nada que reconfigurar en MP — pero **tenés que confirmar que está bien y que el path no cambió**.

1. <https://www.mercadopago.com.ar/developers/panel> → tu aplicación
2. **Webhooks** → anotá las URLs actuales (típicamente `https://api.hospeda.com.ar/api/v1/protected/billing/webhooks/mercadopago` o similar)
3. **Verificá** que el código de la API actual sigue exponiendo ese endpoint en el mismo path. Si no, necesitamos actualizar MP **después** del cutover.
4. **NO toques nada** en MP por ahora. Solo documentás.

> **Caso especial — webhooks NO configurados todavía**: si la pantalla de Webhooks dice "Aún no configuraste notificaciones" (no hay ninguna URL registrada), este paso es no-op acá. La configuración de webhooks se hace en **Paso 12.6** (post-cutover), cuando el endpoint del VPS ya esté respondiendo. Ver `Paso 12.6 — Configurar MercadoPago webhooks` más abajo.

### Paso 0.9 — (Opcional) Cuenta backup admin del VPS

Si querés un segundo punto de acceso de emergencia al VPS (por si tu laptop muere o perdés la SSH key), agregá una segunda SSH key (de otra máquina o de un colega de confianza) en el mismo paso de Vultr → SSH Keys, y agregala al server al crearlo. Los SSH keys se setean SOLO al crear el server por defecto, agregar una después requiere un paso manual.

### Paso 0.10 — Pre-aprobar GitHub App de Coolify

> **Por qué ahora**: Coolify se conecta a GitHub vía una **GitHub App** (Fase 8) para auto-deploy desde push. Si tu cuenta GitHub o la organización requiere aprobación manual de OAuth/Apps (común en orgs corporativas), enterarte el día del cutover frena toda la migración. Esto se chequea en 2 minutos.

1. Andá a <https://github.com/settings/applications> (cuenta personal) o <https://github.com/organizations/><TU_ORG>/settings/oauth_application_policy (org)
2. Verificá que **"Third-party application access policy"** esté en **"No restrictions"** o, si está restringida, agregá `Coolify` a la lista de apps aprobadas (o documentá quién tiene permisos para hacerlo)
3. **Anotá** quién es admin de la org/repo: cuando llegues a Fase 8 vas a necesitar que esa persona apruebe el install si tu user no es admin
4. **No instales la app todavía** — eso lo hacés en Fase 8 desde el panel de Coolify

### Paso 0.11 — Pin de versión de drizzle-kit

> **Por qué ahora**: `drizzle-kit` está en transición a v1.0 RC con cambios de comportamiento en el comando `push`. Si entre hoy y el cutover hacés un `pnpm update` casual y se sube de minor, el `db:fresh-dev` y la migration inicial en Fase 12 pueden romper. Pin la versión actual en el repo, hoy.

1. En tu laptop, en el repo:

   ```bash
   cd /home/qazuor/projects/WEBS/hospeda
   pnpm list drizzle-kit -r --depth=0 | grep drizzle-kit
   ```

2. Anotá la versión exacta (ej: `0.31.6`)
3. Editá `packages/db/package.json` y `package.json` (root) si tienen `drizzle-kit`: cambiá el rango `^X.Y.Z` o `~X.Y.Z` por la versión exacta `X.Y.Z` (sin caret/tilde)
4. Commit: `git commit -m "chore(db): pin drizzle-kit to <version> until VPS migration completes"`

> Después del cutover (Fase 16), podés revertir al rango original.

### Verificación de Fase 0

- [ ] VPS Vultr running, IP anotada
- [ ] 7 DNS records cargados en Cloudflare, todos proxied
- [ ] Cloudflare SSL en "Full (strict)"
- [ ] Cuenta Resend creada, dominio agregado, DNS records de email agregados (verificación en background)
- [ ] R2 bucket `hospeda-backups` creado, API token guardado en password manager (validación de tarjeta resuelta si aplicó)
- [ ] Cuenta Better Stack creada
- [ ] Webhooks de MercadoPago: URLs actuales documentadas, O confirmado que no hay webhooks configurados (en cuyo caso se crean en Paso 12.6)
- [ ] GitHub App policy verificada / admin de org identificado
- [ ] `drizzle-kit` pineado a versión exacta + commit

✅ **Fase 0 completa.** A partir de acá, **DNS está propagando en background** mientras hacés Fases 3, 4, 6 y 7. Cuando llegues a Fase 10, los dominios ya van a resolver.

### Verificar propagación DNS (en cualquier momento posterior)

```bash
dig coolify.hospeda.com.ar +short
dig hospeda.com.ar +short
dig admin.hospeda.com.ar +short
dig staging.hospeda.com.ar +short
```

Tienen que responder con IPs de Cloudflare (`172.67.x.x` o `104.21.x.x`). Si responden tu IP del VPS directo, significa que el proxy 🟠 está apagado — corregí en Cloudflare.

---

## Fase 1 — Generar SSH key

> **Ya hecho en Fase 0** (paso 0.2). Si no lo hiciste, andá a la sección 0.2 ahora. Esta fase queda como referencia/troubleshooting.

### Errores comunes con SSH

- **`Permission denied (publickey)`** al intentar conectarse: la SSH key no se subió bien o no se asoció al server. En Vultr → Server → Settings → SSH Keys, agregá la key. Si el server ya está creado y no tickeaste la key al crearlo, vas a tener que copiar la pública manualmente vía la consola web de Vultr (Server → View Console).
- **`id_rsa` en vez de `id_ed25519`**: ambos sirven. ed25519 es más moderno y corto, rsa funciona igual.
- **Passphrase olvidada**: si pusiste passphrase y la perdiste, generá una key nueva (no se puede recuperar) y reemplazá en el server.

---

## Fase 2 — Crear VPS en Vultr

> **Ya hecho en Fase 0** (pasos 0.1 y 0.3). Esta fase queda como referencia detallada por si necesitás recrear el VPS o entender qué configuraste.

**Costo**: $24 USD/mes (te cobran por hora, podés cancelar cualquier momento)

### Paso 2.1 — Crear cuenta en Vultr

1. Andá a <https://www.vultr.com>
2. Click en **"Sign Up"** (esquina superior derecha)
3. Completá email + password
4. Confirmá tu email
5. Vas a tener que cargar **mínimo $10 USD** en crédito antes de crear el primer server. Pagás con tarjeta o PayPal.

### Paso 2.2 — Subir tu SSH key a Vultr

Antes de crear el server, subí tu key:

1. En el menú izquierdo, click en **"Account"** → **"SSH Keys"**
   - URL directa: <https://my.vultr.com/sshkeys/>
2. Click botón **"Add SSH Key"** (azul, arriba a la derecha)
3. **Name**: `qazuor-laptop` (cualquier nombre identificable)
4. **Key**: pegá la clave pública que copiaste en Fase 1.3
5. Click **"Add SSH Key"**

### Paso 2.3 — Crear el server

1. En el menú izquierdo, click en **"Products"** → **"Compute"**
   - O click en el botón "+ Deploy" arriba.
2. Click **"Deploy New Server"** (botón "+ Deploy", esquina superior derecha)

### Paso 2.4 — Configurar el server

Vas a ver una pantalla con varias opciones. Configurá EXACTAMENTE así:

#### Choose Server (tipo de servidor)

- Click en **"Cloud Compute - High Frequency"**
  - **NO** elijas "Cloud Compute - Shared CPU" (es el más barato pero más lento).
  - **NO** elijas "Optimized Cloud Compute" (es más caro y no lo necesitás).

#### CPU & Storage Technology

- Debe estar seleccionado **"NVMe"** (es el único disponible para High Frequency)

#### Server Location (ubicación)

- Buscá y seleccioná **"São Paulo (BRA)"** 🇧🇷
- **NO** elijas Miami, Chile o Atlanta — São Paulo es el más cerca de Argentina

#### Server Image (sistema operativo)

- Click en la pestaña **"OS"**
- Seleccioná **"Ubuntu"** → **"22.04 LTS x64"** (recomendada por madurez) o **"24.04 LTS x64"** (también soportada por Coolify)
  - Cualquiera de las dos LTS funciona con el script oficial de Coolify. Si tenés dudas, quedate con 22.04
  - **NO** Debian (técnicamente funciona pero hay menos docs)
  - **NO** Ubuntu non-LTS (20.10, 23.10, etc.)

#### Server Size (tamaño)

- Buscá la fila que diga: **"$24/mo - 2 CPU, 4 GB RAM, 128 GB NVMe, 3 TB Bandwidth"**
- Click para seleccionarla

#### Add Auto Backups

- **No actives** "Automated Backups" (te ahorran $4.80/mes y nosotros vamos a hacer backups propios mejores con pg_dump + R2)

#### Add IPv6

- Dejalo activado (es gratis y en algún momento puede servir)

#### Server Hostname & Label

- **Hostname**: `hospeda-prod` (este nombre va a aparecer dentro del server)
- **Label**: `Hospeda Production` (este nombre lo ves vos en el dashboard de Vultr)

#### SSH Keys

- Tickeá la box correspondiente a la key que subiste (`qazuor-laptop` u otra)

#### Vultr Firewall Group

- Dejá vacío. Vamos a usar `ufw` directo en el servidor (más simple, gratis, igual de efectivo).

#### Disable Public IPv4 Address

- **NO actives** esta opción (necesitás IPv4 público para que la gente acceda)

### Paso 2.5 — Confirmar

- En el panel derecho de la pantalla, deberías ver:
  - Total: **$24.00/mo**
  - Location: São Paulo
  - Image: Ubuntu 22.04 LTS x64
  - Size: 2 vCPU, 4 GB RAM, 128 GB NVMe
- Click **"Deploy Now"** (botón azul abajo a la derecha)

### Paso 2.6 — Esperar el provisioning

- Vultr va a tardar 1-3 minutos en crear el server.
- Vas a ver una pantalla con el server "Installing".
- Cuando esté listo, va a aparecer "Running".

### Paso 2.7 — Anotar la IP

1. Click en el nombre del server (`hospeda-prod`) en la lista.
2. En la pestaña **"Overview"**, vas a ver:
   - **IP Address**: algo como `45.76.123.45` ← **anotá este número**, lo vamos a usar mucho
   - **Username**: `root`
   - **Password**: una password generada (igual no la vamos a usar, conectamos con SSH key)

### Paso 2.8 — Probar la conexión SSH

Desde tu laptop:

```bash
ssh root@45.76.123.45
```

(reemplazá `45.76.123.45` con tu IP real)

La primera vez te va a preguntar:

```
The authenticity of host '45.76.123.45 (45.76.123.45)' can't be established.
ED25519 key fingerprint is SHA256:xxxxxxxxxxxxxxxxxxxxxxxx.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Escribí **`yes`** y Enter.

Si todo está bien, vas a ver el prompt del server:

```
root@hospeda-prod:~#
```

✅ **Si llegás acá, fase 2 completa.** Salí del server con:

```bash
exit
```

### Errores comunes

- **"Permission denied (publickey)"**: tu SSH key no se subió bien o no la tickeaste al crear el server. Volvé a Vultr → Server → Settings → SSH Keys, agregá la key, después conectate.
- **"Connection refused"**: el server todavía está booteando. Esperá 1-2 min más.

---

## Fase 3 — Hardening del VPS

**Tiempo estimado**: 30 minutos
**Riesgo**: Medio (si configurás mal el firewall, te podés trabar afuera)

### Por qué

Apenas creás un VPS, está expuesto a internet. Hay bots que escanean IPs constantemente buscando servidores con SSH password débil, puertos abiertos, software desactualizado. Vamos a:

1. Actualizar el sistema
2. Crear un usuario que NO sea root (más seguro)
3. Configurar firewall (UFW)
4. Instalar fail2ban (banea IPs que intentan SSH brute force)
5. Deshabilitar password login (solo SSH key)

### Paso 3.1 — Conectarse y actualizar

```bash
ssh root@TU_IP_VPS
```

Una vez dentro:

```bash
apt update && apt upgrade -y
```

Esto baja la lista de paquetes y actualiza todo. Tarda 2-5 minutos. Si te pregunta algo durante el upgrade (raro), apretá Enter al default.

Cuando termine:

```bash
reboot
```

El server se va a reiniciar. Esperá 30 segundos y reconectate:

```bash
ssh root@TU_IP_VPS
```

### Paso 3.2 — Crear usuario no-root

```bash
adduser qazuor
```

Te va a pedir:

- **New password**: poné una password fuerte (anotala en tu password manager)
- **Retype new password**: la misma
- **Full Name**: `Qazuor` (o lo que quieras)
- El resto: Enter para dejar default
- **Is the information correct?**: `Y`

Agregar al grupo sudo (poder ejecutar comandos como root):

```bash
usermod -aG sudo qazuor
```

Copiar tu SSH key del root al user nuevo:

```bash
mkdir -p /home/qazuor/.ssh
cp /root/.ssh/authorized_keys /home/qazuor/.ssh/
chown -R qazuor:qazuor /home/qazuor/.ssh
chmod 700 /home/qazuor/.ssh
chmod 600 /home/qazuor/.ssh/authorized_keys
```

### Paso 3.3 — Probar el user nuevo (SIN cerrar la sesión actual)

**MUY IMPORTANTE**: NO cierres esta terminal todavía. Abrí **otra** terminal en tu laptop y probá:

```bash
ssh qazuor@TU_IP_VPS
```

Debería conectar sin pedirte password (porque ya tenés la SSH key).

Probá usar sudo:

```bash
sudo whoami
```

Te va a pedir la password del user qazuor (la que pusiste recién). Debería responder `root`.

Si todo funciona en la nueva terminal, **podés cerrar la terminal vieja** (la que estaba como root). De ahora en adelante usás siempre `qazuor`.

### Paso 3.4 — Configurar el firewall (UFW)

UFW (Uncomplicated Firewall) controla qué puertos están abiertos. Por defecto bloqueamos todo y abrimos solo lo que necesitamos.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp
```

Explicación de cada puerto:

- **OpenSSH** (puerto 22): para conectarte por SSH
- **80/tcp**: HTTP (para el desafío de SSL inicial de Let's Encrypt)
- **443/tcp**: HTTPS (las apps reales)
- **8000/tcp**: panel de Coolify (lo cerramos después con un dominio + SSL)

Activar el firewall:

```bash
sudo ufw enable
```

Te va a preguntar:

```
Command may disrupt existing ssh connections. Proceed with operation (y|n)?
```

Respondé `y`.

Verificar:

```bash
sudo ufw status verbose
```

Deberías ver:

```
Status: active
...
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
8000/tcp                   ALLOW IN    Anywhere
```

### Paso 3.5 — Instalar fail2ban

fail2ban detecta intentos de login fallidos por SSH y banea esas IPs automáticamente.

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Verificar:

```bash
sudo systemctl status fail2ban
```

Debería decir `active (running)`.

Apretá `q` para salir del status.

### Paso 3.6 — Deshabilitar password login en SSH

Ahora que confirmamos que la SSH key funciona, deshabilitamos el login por password (mucho más seguro).

> ⚠️ **Gotcha crítico de Ubuntu cloud images**: el archivo `/etc/ssh/sshd_config.d/50-cloud-init.conf` (creado por cloud-init) tiene `PasswordAuthentication yes` y **override** lo que pongas en el sshd_config principal. Si solo editás el archivo principal, el password auth queda activo y vas a tener intentos de brute-force que cuentan para fail2ban. Para evitar lockouts, usamos un archivo override con prioridad mayor.

#### 3.6.a — Editar sshd_config principal

```bash
sudo nano /etc/ssh/sshd_config
```

Buscá las siguientes líneas (Ctrl+W para buscar) y cambialas:

| Línea actual | Cambiar a |
|--------------|-----------|
| `#PasswordAuthentication yes` o `PasswordAuthentication yes` | `PasswordAuthentication no` |
| `#PermitRootLogin yes` o `PermitRootLogin yes` o `PermitRootLogin prohibit-password` | `PermitRootLogin no` |
| `Port 22` (si lo cambiaste a un puerto custom como 2222 antes) | `#Port 22` o sacarla |

Guardar: **Ctrl+O**, Enter, **Ctrl+X**.

#### 3.6.b — Crear override que pisa el cloud-init

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
EOF
```

> Si el `tee <<EOF` falla por indentación de paste, usá nano:
> `sudo nano /etc/ssh/sshd_config.d/99-hardening.conf`, pegá las 2 líneas SIN indentación, Ctrl+O, Enter, Ctrl+X.

Los archivos en `sshd_config.d/` se cargan alfabéticamente; `99-` gana sobre `50-cloud-init.conf`.

#### 3.6.c — Validar y reiniciar

```bash
sudo sshd -t                          # Si no devuelve nada, syntax OK
sudo systemctl restart ssh
```

**ADVERTENCIA**: NO cierres la terminal actual hasta verificar que podés conectarte desde otra. En **otra terminal** probá:

```bash
ssh -p TU_PUERTO_SSH qazuor@TU_IP_VPS         # Debe conectar SIN password
ssh -p TU_PUERTO_SSH -o PasswordAuthentication=no root@TU_IP_VPS   # Debe decir "Permission denied (publickey)"
```

Si Test 1 conecta y Test 2 falla con `Permission denied (publickey)` (NO `publickey,password`), todo OK ✅.

Si el segundo test dice `Permission denied (publickey,password)` → el override del cloud-init no se aplicó. Verificá `cat /etc/ssh/sshd_config.d/99-hardening.conf` y `sudo grep -nH "PasswordAuthentication" /etc/ssh/sshd_config.d/*`.

Si NO podés conectar en absoluto: vuelve a la terminal vieja, revertí los cambios y reiniciá SSH.

#### 3.6.d — Si te lockeaste por fail2ban (incidente común)

Si hiciste varios `ssh root@...` testeando, fail2ban probablemente baneó tu IP de casa después de 5 attempts → `Connection refused` desde TODO traffic de tu IP, incluso `qazuor`.

Recuperación:

1. **Vultr Web Console** (VNC, no requiere SSH) → ícono `>_` o `View Console` en la página del server.
2. Login: `qazuor` + password del user qazuor.
3. Desbanear:

   ```bash
   sudo fail2ban-client unban --all
   ```

4. Verificar SSH:

   ```bash
   sudo systemctl status ssh | head -5
   ```

5. Volver a probar desde tu laptop.

### Paso 3.7 — Configurar swap (memoria virtual)

Con 4GB de RAM, en momentos de carga alta podés quedarte corto. Swap es disco usado como RAM extra. Más lento, pero salva de OOM kills.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Verificar:

```bash
free -h
```

Deberías ver una línea `Swap:` con `2.0Gi`.

### Paso 3.8 — Configurar timezone

```bash
sudo timedatectl set-timezone America/Argentina/Buenos_Aires
```

Verificar:

```bash
date
```

### Paso 3.9 — Habilitar updates automáticos de seguridad

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

Te pregunta `Automatically download and install stable updates?` → Respondé `Yes`.

Esto instala automáticamente parches de seguridad cada noche, sin reiniciar el server (los reboots automáticos los dejamos manual para no tener sorpresas).

### Verificación de fase 3

- [x] Podés entrar como `qazuor` con SSH key, sin password
- [x] NO podés entrar como `root` (intentá `ssh root@IP` desde otra terminal — debería fallar)
- [x] `sudo ufw status` muestra los 4 puertos permitidos
- [x] `sudo systemctl status fail2ban` muestra running
- [x] `free -h` muestra 2GB de Swap
- [x] `date` muestra hora Argentina

✅ Fase 3 completa. Tu VPS está hardeneado.

---

## Fase 4 — Instalar Coolify

**Tiempo estimado**: 15 minutos
**Riesgo**: Bajo

### Paso 4.1 — Ejecutar el script de instalación

Conectate al VPS:

```bash
ssh qazuor@TU_IP_VPS
```

Ejecutá el comando oficial de Coolify:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Esto:

1. Instala Docker (si no estaba)
2. Crea el directorio `/data/coolify/`
3. Configura SSH interno
4. Levanta Coolify en port 8000

Tarda 5-10 minutos. Vas a ver mucho output. Cuando termina, ves un mensaje con la URL para acceder.

### Paso 4.2 — Acceder a Coolify por primera vez

Abrí en tu navegador:

```
http://TU_IP_VPS:8000
```

(Sí, http NO https — todavía no configuramos SSL para el panel)

Vas a ver una pantalla de **registro** (Sign Up).

**⚠️ MUY IMPORTANTE**: registrate **inmediatamente**. Si dejás Coolify accesible sin user, cualquiera que descubra tu IP puede tomar control.

### Paso 4.3 — Crear cuenta admin

- **Name**: `Qazuor`
- **Email**: tu email
- **Password**: una password fuerte (anotala)
- Click **"Register"**

El primer user creado se vuelve administrador automáticamente.

### Paso 4.4 — Configurar el dominio del panel

Por seguridad, queremos acceder al panel desde un dominio con SSL, no desde la IP. Vamos a usar `coolify.hospeda.com.ar` (subdominio).

> **Nota**: este paso lo completamos en la Fase 5 después de configurar DNS. Por ahora, seguís usando `http://TU_IP_VPS:8000`.

### Paso 4.5 — Resolver conflict del wizard con SSH hardenedo (gotcha si hardeneaste con port custom)

> ⚠️ **Aplica solo si en Fase 3 cambiaste el puerto SSH (ej. 22→2222) y/o pusiste `PermitRootLogin no`**. El wizard de Coolify (`Let's go!` → `This Machine`) intenta SSH a `localhost:22` como `root` para validar la conexión al Docker daemon. Si bloqueaste port 22 o root login, el wizard falla con "Server is not reachable".

**Solución** (re-habilitar SSH para tráfico interno sin re-exponer al internet):

1. **Re-activar `Port 22` en sshd_config principal**:

   ```bash
   sudo sed -i 's|^#Port 22.*|Port 22|' /etc/ssh/sshd_config
   sudo grep -nE "^Port" /etc/ssh/sshd_config
   # Debe mostrar: Port 22 y Port 2222 (o el puerto custom que usaste)
   ```

2. **Permitir root SSH solo desde rangos privados** (localhost + Docker bridge):

   ```bash
   sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'EOF'
   PasswordAuthentication no
   PermitRootLogin no

   Match Address 127.0.0.0/8,10.0.0.0/8,172.0.0.0/8,192.168.0.0/16
       PermitRootLogin prohibit-password
   EOF
   ```

3. **UFW: abrir puerto 22 solo a rangos privados** (internet sigue bloqueado):

   ```bash
   sudo ufw allow from 127.0.0.0/8 to any port 22 proto tcp
   sudo ufw allow from 10.0.0.0/8 to any port 22 proto tcp
   sudo ufw allow from 172.0.0.0/8 to any port 22 proto tcp
   ```

4. **Validar y reiniciar**:

   ```bash
   sudo sshd -t && sudo systemctl restart ssh
   ```

5. Volvé al browser y click `Check Again` en el wizard de Coolify. Debería pasar al Step 2 (Connection ✅) y Step 3 (Complete).

> Alternativa más limpia (no implementada por defecto): configurar Coolify para usar el puerto 2222 + un user no-root con permisos de Docker. Más laburo, pero elimina del todo el SSH root. Considerar para un hardening pass post-cutover.

### Verificación de fase 4

- [x] Podés entrar a `http://TU_IP_VPS:8000`
- [x] Tenés tu user admin creado
- [x] Wizard de Coolify completado (Steps Server / Connection / Complete todos verdes)
- [x] Skip Setup en el último paso (no creaste proyecto inicial)
- [x] Ves el dashboard de Coolify

✅ Fase 4 completa.

---

## Fase 5 — Verificar DNS y configurar dominio del panel Coolify

**Tiempo estimado**: 10 minutos (más espera de propagación si todavía no resolvió)
**Riesgo**: Bajo

> **Nota**: el grueso de DNS lo cargamos en **Fase 0**. Esta fase solo verifica que ya propagó y le dice a Coolify cuál es su dominio.

### Paso 5.1 — Verificar que DNS resolvió

Desde tu laptop:

```bash
dig coolify.hospeda.com.ar +short
dig hospeda.com.ar +short
dig admin.hospeda.com.ar +short
dig staging.hospeda.com.ar +short
```

Todos tienen que responder con IPs de Cloudflare (`172.67.x.x` o `104.21.x.x`).

**Si no responde nada o responde una IP que no es de Cloudflare**:

- Esperá 5-10 min más (puede tardar hasta 60 min en propagar)
- Verificá en Cloudflare DNS Records que los 7 estén creados con Proxy 🟠
- Si después de 1h sigue sin resolver, revisá los nameservers del dominio (`hospeda.com.ar`) — tienen que ser los de Cloudflare

### Paso 5.2 — Configurar el FQDN del panel de Coolify

Volvé al panel de Coolify (todavía estás entrando por `http://TU_IP_VPS:8000`):

1. Click en el ícono de engranaje (⚙️) → **Settings**
2. Buscá **Instance Settings** → **FQDN**
3. Escribí: `https://coolify.hospeda.com.ar`
4. Click **Save**

Coolify va a:

1. Pedir un cert SSL a Let's Encrypt para ese dominio (puede tardar 30s-2min)
2. Configurar Traefik para servir el panel
3. Activar HTTPS

Después de 1-2 min, probá:

```
https://coolify.hospeda.com.ar
```

Tiene que cargar el panel con candado verde (SSL válido).

> **Si Let's Encrypt falla**: revisá que el DNS resuelva a Cloudflare (paso 5.1), que el puerto 80/tcp esté abierto en UFW, y que Cloudflare SSL esté en **Full (strict)** (paso 0.4 setting). Si seguís con problemas, mirá los logs de Traefik en Coolify → Server → Proxy → Logs.

### Paso 5.3 — Cerrar el puerto 8000 en el firewall

Ahora que entrás por dominio + SSL, no necesitás más el 8000:

```bash
sudo ufw delete allow 8000/tcp
sudo ufw status
```

### Verificación de fase 5

- [ ] DNS resuelve para todos los subdominios (responde IPs de Cloudflare)
- [ ] `https://coolify.hospeda.com.ar` carga con SSL válido
- [ ] Puerto 8000 cerrado en UFW

✅ Fase 5 completa.

---

## Fase 6 — Cambios de código

**Tiempo estimado**: 2-4 horas
**Riesgo**: Medio (cambios reales al codebase)

### Estado actual del repo (BLOCKERS reales detectados por la auditoría 2026-05-06)

> **Importante**: la spec describe los cambios necesarios. Esta tabla lista lo que el repo **todavía NO tiene** al momento de empezar Fase 6, basado en la auditoría real del código. Cada ítem es una tarea pendiente que esta fase resuelve.

| # | Verificación | Estado actual | Resuelto por |
|---|---|---|---|
| B1 | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/admin/Dockerfile` | ❌ Ninguno existe | Paso 6.7 (crear los 3) |
| B2 | `apps/web/astro.config.mjs` usa `@astrojs/node` | ❌ Sigue con `adapter: vercel({...})` (línea ~64) | Paso 6.3 |
| B3 | Dep `@upstash/qstash` en `apps/api/package.json` | ❌ Sigue presente | Paso 6.5 |
| B4 | Better Auth con `advanced.crossSubDomainCookies` | ❌ `apps/api/src/lib/auth.ts` (~línea 559) tiene `trustedOrigins` pero NO el bloque `advanced` | Paso 6.6 |
| B5 | Workflows `cd-production.yml`, `cd-staging.yml`, `refresh-search.yml` | ❌ Los 3 siguen en `.github/workflows/` | Paso 6.4 |
| B6 | `apps/{api,web,admin}/vercel.json` | ❌ Los 3 siguen presentes | Paso 6.2 |
| B7 | `apps/api/src/cron/qstash.ts` y `scripts/setup-qstash-schedules.ts` | ❌ Los 2 siguen presentes; vars `QSTASH_*` siguen en `packages/config/src/env-registry.hospeda.ts` | Paso 6.5 |

> Antes de empezar 6.1, podés correr `git ls-files apps/api/Dockerfile apps/web/Dockerfile apps/admin/Dockerfile apps/api/vercel.json apps/web/vercel.json apps/admin/vercel.json apps/api/src/cron/qstash.ts scripts/setup-qstash-schedules.ts .github/workflows/cd-production.yml .github/workflows/cd-staging.yml .github/workflows/refresh-search.yml` para ver el estado actual y compararlo con esta tabla.

### Visión general

Tenemos que:

1. Eliminar archivos Vercel-only
2. Cambiar el adapter de Astro (web) a Node
3. Cambiar el preset de TanStack Start (admin) a Node
4. Eliminar código de QStash
5. Configurar Better Auth para SSO entre subdominios
6. Cambiar referencias de `VERCEL_GIT_COMMIT_SHA`
7. Crear Dockerfiles para las 3 apps

### Paso 6.1 — Crear branch de trabajo

En tu laptop, en el repo:

```bash
cd /home/qazuor/projects/WEBS/hospeda
git checkout main
git pull
git checkout -b chore/vps-migration
```

### Paso 6.2 — Eliminar archivos Vercel-only

```bash
# Entry point Vercel-specific
rm -f apps/api/api/index.js
rmdir apps/api/api 2>/dev/null

# Wrapper hono/vercel
rm -f apps/api/src/vercel.ts

# Vercel project configs
rm -f apps/api/vercel.json
rm -f apps/web/vercel.json
rm -f apps/admin/vercel.json

# Output buildeado de Vercel
rm -rf apps/api/.vercel
rm -rf apps/web/.vercel
rm -rf apps/admin/.vercel
```

> **Nota**: `rm -f` no falla si el archivo no existe. `rm -rf` tampoco. Es seguro.
>
> **Verificación**: después del rm, corré `rg -l "vercel" apps/ packages/ --type ts --type js --type json --type mjs` para confirmar que no quedó ninguna referencia accidental.

### Paso 6.3 — Cambiar adapter de Astro (web)

Editá `apps/web/astro.config.mjs`. Buscá la sección que importa y configura el adapter Vercel:

**Antes**:

```js
import vercel from '@astrojs/vercel';
// ...
export default defineConfig({
  // ...
  adapter: vercel({
    isr: {
      expiration: 86400,
      bypassToken: process.env.HOSPEDA_REVALIDATION_SECRET,
      exclude: [/^(\/(?:en|pt))?\/(auth|mi-cuenta|busqueda|feedback)(\/.*)?$/]
    },
    imageService: true
  })
});
```

**Después**:

```js
import node from '@astrojs/node';
// ...
export default defineConfig({
  // ...
  adapter: node({
    mode: 'standalone'
  })
});
```

Y instalar la dependencia + remover la vieja:

```bash
cd apps/web
pnpm remove @astrojs/vercel
pnpm add @astrojs/node
cd ../..
```

### Paso 6.4 — Configurar preset de TanStack Start (admin)

Editá `apps/admin/vite.config.ts`. Buscá el plugin `tanstackStart`:

**Antes**:

```ts
plugins: [
  // ...
  tanstackStart({ customViteReactPlugin: true }),
  // ...
]
```

**Después** (agregar la opción `target`):

```ts
plugins: [
  // ...
  tanstackStart({ 
    customViteReactPlugin: true,
    target: 'node-server'
  }),
  // ...
]
```

> **Nota**: Si Coolify detecta el build correcto solo (sin esto), podemos saltearlo. Pero ponerlo explícito asegura el preset Node.

### Paso 6.5 — Consolidar TODOS los crons en el VPS (`node-cron` in-process)

> **Decisión de arquitectura**: a partir de la migración, **el 100% de los crons corren in-process en la API del VPS** vía `node-cron`. NO hay crons en GitHub Actions, NO hay QStash externo, NO hay cron de Vercel. Una sola fuente de ejecución, una sola fuente de logs (Coolify), un solo lugar donde mirar cuando algo falla.

#### Inventario de crons que tenés que consolidar

Hoy hay **16 cron jobs** definidos en `apps/api/src/cron/schedules.manifest.ts`, todos con su handler en `apps/api/src/cron/jobs/`:

| Job | Schedule | Frecuencia |
|-----|----------|------------|
| `addon-expiry` | `0 5 * * *` | Diario 05:00 |
| `archive-abandoned-drafts` | `0 3 * * *` | Diario 03:00 |
| `archive-expired-promotions` | `0 * * * *` | Cada hora |
| `cloudinary-e2e-cleanup` | `0 2 * * 0` | Domingo 02:00 |
| `conversation-notification` | `*/5 * * * *` | Cada 5 min |
| `conversation-token-cleanup` | `0 3 * * *` | Diario 03:00 |
| `conversation-token-reminder` | `0 9 * * *` | Diario 09:00 |
| `dunning` | `0 6 * * *` | Diario 06:00 |
| `exchange-rate-fetch` | `*/15 * * * *` | Cada 15 min |
| `media-orphan-cleanup` | `0 0 * * 0` | Domingo 00:00 |
| `notification-log-purge` | `0 3 * * *` | Diario 03:00 |
| `notification-schedule` | `0 8 * * *` | Diario 08:00 |
| `page-revalidation` | `0 * * * *` | Cada hora |
| `search-index-refresh` | `0 */6 * * *` | Cada 6 horas |
| `trial-expiry` | `0 2 * * *` | Diario 02:00 |
| `webhook-retry` | `0 */1 * * *` | Cada hora |

**Plus** `.github/workflows/refresh-search.yml` que es un cron externo de GitHub Actions duplicando el `search-index-refresh`. Lo vamos a **eliminar** porque ya está cubierto in-process.

#### Acciones de código

1. **Configurar la env var del adapter** (la setear en Fase 9 en Coolify):

```
HOSPEDA_CRON_ADAPTER=node-cron
```

1. **Eliminar el adapter de QStash y el código auxiliar** (no se usa más):

```bash
rm apps/api/src/cron/qstash.ts
```

Editá `apps/api/src/cron/bootstrap.ts`, `index.ts` y `middleware.ts`: quitá imports de `./qstash` y la rama `case 'qstash'` del switch del adapter. Dejá solamente `node-cron` y `manual` (para tests/dev local).

1. **Eliminar `@upstash/qstash`** del `package.json` de la API:

```bash
cd apps/api
pnpm remove @upstash/qstash
cd ../..
```

1. **Eliminar el script de provisioning de QStash** y su workflow:

```bash
rm scripts/setup-qstash-schedules.ts
```

1. **Eliminar el GitHub Actions cron duplicado**:

```bash
rm .github/workflows/refresh-search.yml
```

1. **Limpiar env vars QStash** del registry y del Zod schema de la API:
   - En `packages/config/src/env-registry.*.ts` quitá las entradas `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `HOSPEDA_CRON_SECRET` (este último era para autenticar requests externas; in-process no lo necesita).
   - En `apps/api/src/utils/env.ts` quitá la validación Zod de las mismas.
   - Borrá los `.env.example` referencias.

1. **Verificar que el adapter `node-cron` en `bootstrap.ts` arranca todos los 16 jobs al boot de la API**, no expone endpoints HTTP `/api/v1/cron/*` (esos eran para QStash) y registra en logs el adapter activo + cantidad de jobs.

#### Validación

Después del primer deploy en VPS, en los logs de la API tenés que ver:

```
[cron] adapter=node-cron jobs=16 initialized
[cron] schedule registered: addon-expiry @ 0 5 * * *
[cron] schedule registered: archive-abandoned-drafts @ 0 3 * * *
... (los 16)
```

Si ves menos de 16 o aparece `adapter=qstash`, algo quedó mal en la limpieza.

> **Recordatorio operacional**: con `node-cron` in-process, si la API se reinicia (deploy nuevo, OOM kill, etc.) y un cron iba a correr en ese momento, **se pierde esa ejecución**. Para los crons críticos (dunning, exchange-rate-fetch, notification-schedule), el handler ya está diseñado idempotente — si una ejecución se pierde, la siguiente recupera. Si alguno no es idempotente, tenemos que revisarlo (riesgo bajo, pero anotalo).

### Paso 6.6 — Configurar Better Auth para SSO entre subdominios

Editá `apps/api/src/lib/auth.ts`. La config actual termina con `trustedOrigins: parseTrustedOrigins()` (línea ~559). Hay que agregar el bloque `advanced` con `crossSubDomainCookies` JUSTO ANTES de esa línea.

#### Cambio exacto

Buscá esto:

```ts
        trustedOrigins: parseTrustedOrigins()
    });
```

Y reemplazalo por:

```ts
        advanced: {
            crossSubDomainCookies: {
                enabled: true,
                // Sin punto al inicio. Better Auth lo expande a `.hospeda.com.ar`
                // internamente para que la cookie sea válida en todos los subdominios.
                domain: env.NODE_ENV === 'production' ? 'hospeda.com.ar' : undefined
            },
            useSecureCookies: env.NODE_ENV === 'production'
        },
        trustedOrigins: parseTrustedOrigins()
    });
```

> **Por qué `domain: undefined` en dev**: en local (`localhost:3000` y `localhost:4321`) NO hay subdominios; setear `domain: 'hospeda.com.ar'` rompería las cookies en dev. Con `undefined`, Better Auth usa el comportamiento default por host. En prod, sí queremos el SSO entre `hospeda.com.ar`, `admin.hospeda.com.ar` y `api.hospeda.com.ar`.

#### Validar `parseTrustedOrigins()`

Hoy el helper está en `apps/api/src/lib/auth.ts` (línea ~571) y lee `env.HOSPEDA_SITE_URL` + `env.HOSPEDA_ADMIN_URL`. Para producción VPS está perfecto: cuando seteás esas vars en Coolify (Fase 9) apuntando a `https://hospeda.com.ar` y `https://admin.hospeda.com.ar`, ya quedan como trusted origins.

> **Nota staging**: la app **`hospeda-api-staging`** (Fase 11) va a tener sus propias env vars en Coolify apuntando a `https://staging.hospeda.com.ar` y `https://staging-admin.hospeda.com.ar` — ese deployment las lee y configura sus propios trusted origins. NO necesitás listar las URLs de staging en la API de prod ni viceversa: cada deployment es independiente.

#### Verificación post-deploy (Fase 15 lo cubre)

Después del cutover, hacé lo siguiente desde un browser:

1. Login en `https://hospeda.com.ar/auth/signin/`
2. Sin cerrar la pestaña, navegá a `https://admin.hospeda.com.ar/`
3. Tenés que aparecer **logueado** sin que te pida login de nuevo. Si te lo pide → la cookie de session no se compartió → `crossSubDomainCookies` no se aplicó (o el browser está en strict cookie mode).

#### Si hay problemas con cookies SameSite

Better Auth setea `SameSite=Lax` por default, que funciona para SSO entre subdominios del mismo apex. Si necesitás que la session viaje en un POST cross-site (raro), tendrías que setear `SameSite=None` + `Secure=true`. Por ahora, default es lo correcto.

### Paso 6.7 — Reemplazar VERCEL_GIT_COMMIT_SHA

En 3 archivos, reemplazar:

- `process.env.VERCEL_GIT_COMMIT_SHA` → `process.env.HOSPEDA_GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA`

Archivos:

- `apps/web/astro.config.mjs:167`
- `apps/web/sentry.server.config.ts:11`
- `apps/admin/vite.config.ts:127`

Esto hace fallback: prefiere `HOSPEDA_GIT_SHA` (que vamos a setear en Coolify), pero si no existe usa el de Vercel.

### Paso 6.8 — Crear Dockerfiles

Vamos a crear 3 Dockerfiles, uno por app.

> **Nota previa**: la lista de packages a copiar se generó leyendo `apps/<app>/package.json` para detectar **TODOS los `workspace:*`** que cada app importa. Si en algún momento agregás un nuevo package al monorepo y una app empieza a usarlo, **tenés que agregar el `COPY packages/<nombre>/package.json` correspondiente** en el Dockerfile de esa app — si no, `pnpm install --frozen-lockfile` falla.

#### `apps/api/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ----- deps stage -----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
# Workspace deps (todas las @repo/* importadas por hospeda-api)
COPY packages/billing/package.json packages/billing/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY packages/feedback/package.json packages/feedback/
COPY packages/i18n/package.json packages/i18n/
COPY packages/logger/package.json packages/logger/
COPY packages/media/package.json packages/media/
COPY packages/notifications/package.json packages/notifications/
COPY packages/schemas/package.json packages/schemas/
COPY packages/service-core/package.json packages/service-core/
COPY packages/utils/package.json packages/utils/
# DevDep para el build stage (typecheck, tsup config)
COPY packages/typescript-config/package.json packages/typescript-config/
RUN pnpm install --frozen-lockfile

# ----- build stage -----
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN pnpm turbo run build --filter=hospeda-api

# ----- runner stage -----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./
# node_modules en runtime: solo prod deps. pnpm deploy genera el subset correcto.
COPY --from=build /repo/apps/api/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

#### `apps/web/Dockerfile`

```dockerfile
FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/
# Workspace deps (todas las @repo/* importadas por hospeda-web)
COPY packages/billing/package.json packages/billing/
COPY packages/config/package.json packages/config/
COPY packages/feedback/package.json packages/feedback/
COPY packages/i18n/package.json packages/i18n/
COPY packages/icons/package.json packages/icons/
COPY packages/logger/package.json packages/logger/
COPY packages/media/package.json packages/media/
COPY packages/schemas/package.json packages/schemas/
COPY packages/utils/package.json packages/utils/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN pnpm turbo run build --filter=hospeda-web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
COPY --from=build /repo/apps/web/dist ./dist
COPY --from=build /repo/apps/web/node_modules ./node_modules
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
```

#### `apps/admin/Dockerfile`

```dockerfile
FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/admin/package.json apps/admin/
# Workspace deps (todas las @repo/* importadas por admin)
COPY packages/auth-ui/package.json packages/auth-ui/
COPY packages/billing/package.json packages/billing/
COPY packages/config/package.json packages/config/
COPY packages/feedback/package.json packages/feedback/
COPY packages/i18n/package.json packages/i18n/
COPY packages/icons/package.json packages/icons/
COPY packages/logger/package.json packages/logger/
COPY packages/media/package.json packages/media/
COPY packages/schemas/package.json packages/schemas/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/tailwind-config/package.json packages/tailwind-config/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN pnpm turbo run build --filter=admin

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=build /repo/apps/admin/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

> **Nota sobre TanStack Start preset**: la opción `target: 'node-server'` del plugin `tanstackStart` (paso 6.4) se respeta vía la env var `NITRO_PRESET=node-server` durante el build. Verificá la doc oficial actual antes del primer build — TanStack Start cambia este flag con relativa frecuencia.
>
> **Iteración esperada**: estos Dockerfiles son una primera versión que cubre todos los packages declarados HOY. Es muy posible que el primer `docker build` rompa por algún detalle (ej. `pnpm-lock.yaml` requiere otro package que olvidamos, o `tsup` necesita que un package tenga `dist/` antes del build). Coolify te da logs claros — iteramos.

### Paso 6.9 — Crear `.dockerignore` en raíz del repo

Archivo `/.dockerignore`:

```
node_modules
**/node_modules
**/dist
**/.output
**/.nitro
**/.turbo
**/.next
**/.astro
**/.vercel
**/coverage
**/.env
**/.env.local
**/.env.*
.git
.github
.vscode
.idea
**/*.md
.claude
docs
```

### Paso 6.10 — Implementar endpoint `/api/revalidate` en web

Crear `apps/web/src/pages/api/revalidate.ts`:

```ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  
  if (secret !== process.env.HOSPEDA_REVALIDATION_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // En vez de revalidar páginas (no hay ISR), purgamos cache de Cloudflare
  const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;
  const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;
  
  if (!cfZoneId || !cfApiToken) {
    return new Response('Cloudflare not configured', { status: 500 });
  }
  
  const purgeRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ purge_everything: true })
    }
  );
  
  if (!purgeRes.ok) {
    return new Response('Cache purge failed', { status: 500 });
  }
  
  return new Response('OK', { status: 200 });
};
```

> **Nota**: `purge_everything: true` purga TODO el cache. Si el volumen lo justifica, podemos hacer purge selectivo por path.

### Paso 6.11 — Actualizar workflows de CI/CD

> **Decisión de arquitectura**: Coolify hace **auto-deploy** vía la GitHub App apenas detecta un push a la branch configurada (Fase 8). Eso reemplaza completamente los workflows de CD que apuntaban a Vercel. Los workflows de **CI** (lint, typecheck, test, e2e) se mantienen como gate antes del merge — sólo hay que sacarles cualquier referencia a Vercel.

#### Workflows a ELIMINAR

```bash
rm .github/workflows/cd-production.yml   # Deploy Vercel prod → Coolify lo hace ahora
rm .github/workflows/cd-staging.yml      # Deploy Vercel staging → Coolify lo hace ahora
rm .github/workflows/refresh-search.yml  # Cron externo → ya cubierto por node-cron in-process (Paso 6.5)
```

#### Workflows a MANTENER (con limpieza de Vercel)

| Workflow | Acción |
|----------|--------|
| `ci.yml` | Mantener. Quitar pasos de Vercel remote cache si los tiene. Mantener lint + typecheck + test. |
| `e2e-pr.yml` | Mantener. Asegurarse que apunta a `localhost` (Docker compose) o usa `staging.hospeda.com.ar` para E2E contra ambiente real. |
| `e2e-nightly.yml` | Mantener. Cambiar la URL target de Vercel preview → `https://staging.hospeda.com.ar`. |
| `docs.yml` | Mantener (no toca deploy). |
| `validate-docs.yml` | Mantener (no toca deploy). |

Buscá referencias residuales a Vercel y eliminálas:

```bash
rg -l "vercel|VERCEL_TOKEN|amondnet/vercel-action" .github/workflows/
```

Editá cada archivo que aparezca y quitá los steps relacionados.

#### Branch protection rules (en GitHub)

Para que el "no deploy si CI rompe" funcione vía branch protection (no vía workflow):

1. GitHub → Settings → Branches → `main` (y `staging`)
2. Edit rule:
   - ✅ **Require status checks to pass before merging**
   - ✅ Marcá `ci`, `e2e-pr` (los que querés exigir)
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Require linear history** (opcional)

Sin esa rule, alguien podría mergear un PR con CI roto y Coolify igual deploya.

### Paso 6.12 — Migrar scripts `env:*` de Vercel API a Coolify API

> **Contexto**: hoy `pnpm env:sync`, `env:pull`, `env:push`, `env:check` hablan con la **Vercel API** vía `scripts/env/utils/vercel-api.ts`. Después de la migración, las apps viven en Coolify, así que los scripts tienen que hablar con la **Coolify API** para que el flow `agregar var al registry → push a server` siga funcionando.

#### Estado actual (referencia)

```
scripts/env/
├── pull.ts     → trae env vars desde Vercel a .env local
├── push.ts     → sube .env local a Vercel
├── sync.ts     → interactivo: pregunta valor por var faltante en Vercel
├── check.ts    → valida que las vars del registry estén en Vercel
└── utils/
    ├── vercel-api.ts  → wrapper de Vercel API REST
    ├── prompts.ts     → @inquirer prompts
    └── registry.ts    → carga ENV_REGISTRY desde @repo/config
```

#### Plan de migración

**Opción recomendada (KISS)**: crear `scripts/env/utils/coolify-api.ts` paralelo a `vercel-api.ts`, con la misma interfaz (`listEnvVars`, `createEnvVar`, `updateEnvVar`, `readProjectConfig`). Cambiar los 4 scripts (`sync.ts`, `push.ts`, `pull.ts`, `check.ts`) para que importen de `coolify-api.ts` en vez de `vercel-api.ts`. Eliminar `vercel-api.ts`.

**Endpoints de la Coolify API que necesitamos**:

| Acción | Coolify API | Notas |
|--------|-------------|-------|
| Listar env vars de una app | `GET /api/v1/applications/{uuid}/envs` | Devuelve array de `{key, value, is_preview, ...}` |
| Crear env var | `POST /api/v1/applications/{uuid}/envs` | Body: `{key, value, is_preview, is_build_time, is_literal}` |
| Update env var | `PATCH /api/v1/applications/{uuid}/envs` | Body: `{key, value, ...}` (sobrescribe por `key`) |
| Eliminar env var | `DELETE /api/v1/applications/{uuid}/envs/{uuid_env}` | |

**Auth**: Bearer token. Generás uno en Coolify → **Keys & Tokens** → **+ New API Key**. Lo guardás en `.env.local` como `COOLIFY_API_TOKEN` y `COOLIFY_API_URL` (`https://coolify.hospeda.com.ar/api/v1`).

**Mapeo de "environments"**:

- Vercel tiene 3 environments por proyecto: `development`, `preview`, `production`.
- Coolify NO tiene ese concepto directo: cada combinación environment×branch es **una app distinta** en Coolify (ej. `hospeda-api-prod` y `hospeda-api-staging` son dos apps separadas, no dos environments de la misma app).
- En `coolify-api.ts`, el mapeo queda: `app + environment` → `app_uuid` específico. El script `sync.ts` resuelve eso vía un mapeo en config local (ej. `scripts/env/coolify-app-mapping.json`).

#### Archivo nuevo a crear

`scripts/env/utils/coolify-app-mapping.json`:

```json
{
  "api": {
    "production": "uuid-de-hospeda-api-prod",
    "staging": "uuid-de-hospeda-api-staging"
  },
  "web": {
    "production": "uuid-de-hospeda-web-prod",
    "staging": "uuid-de-hospeda-web-staging"
  },
  "admin": {
    "production": "uuid-de-hospeda-admin-prod",
    "staging": "uuid-de-hospeda-admin-staging"
  }
}
```

Los UUIDs salen de Coolify → cada app → **General** → "Application UUID" (visible en la URL del panel también).

> **Nota**: NO chequees ese JSON en git con UUIDs reales si te incomoda exponerlos. Podés usar env vars (`COOLIFY_APP_UUID_API_PROD`, etc.) o un `coolify-app-mapping.local.json` ignorado por git.

#### Quién hace el código

Los 4 scripts cambian poco — la mayoría es swap de import + adaptar la firma de `createEnvVar`/`listEnvVars` al payload de Coolify. **Unas 200-300 líneas tocadas.** Lo hacemos en un commit aparte, después de que Coolify esté funcionando (Fase 9), porque hasta entonces no tenés UUIDs.

#### Referencia operacional post-migración

```bash
# Antes (Vercel)
pnpm env:sync --app=api --env=production

# Después (Coolify) — misma firma, otro backend
pnpm env:sync --app=api --env=production
```

El usuario final no nota la diferencia. Solo cambia el backend.

### Paso 6.13 — Validar build local con Docker (recomendado, NO opcional)

Antes de pushear y dejar que Coolify intente buildear, validá los Dockerfiles en tu laptop. Te ahorra ~10 min por iteración (build local es más rápido que esperar Coolify + ver logs).

```bash
# Cada uno tarda ~3-8 min la primera vez
docker build -f apps/api/Dockerfile -t hospeda-api:test .
docker build -f apps/web/Dockerfile -t hospeda-web:test .
docker build -f apps/admin/Dockerfile -t hospeda-admin:test .
```

Si los 3 builds terminan con `Successfully tagged ...:test`, listo. Si falla alguno, iteramos.

> **Si tu laptop no tiene Docker**: instalá Docker Desktop (Mac/Windows) o `docker-ce` (Linux). En Linux con WSL puede ser más liviano usar `podman` que tiene CLI compatible (`alias docker=podman`).

### Paso 6.14 — Commit y push

```bash
git add -A
git status  # revisar que está todo OK
git commit -m "chore(deploy): migrate from Vercel to VPS self-hosted

- Remove Vercel-specific entry files and configs (.vercel/, vercel.json, vercel.ts, api/index.js)
- Switch Astro web from Vercel adapter to Node adapter (standalone)
- Switch admin TanStack Start to node-server preset
- Configure Better Auth crossSubDomainCookies for SSO
- Replace VERCEL_GIT_COMMIT_SHA fallback with HOSPEDA_GIT_SHA
- Add Dockerfiles for api, web, admin (multi-stage with workspace deps)
- Add /api/revalidate endpoint for cache invalidation via Cloudflare
- Consolidate all 16 cron jobs to node-cron in-process (drop QStash + GH Actions cron)
- Drop CD workflows (Coolify auto-deploys); keep CI for lint/typecheck/test gates
- Migrate env:* scripts from Vercel API to Coolify API"
git push -u origin chore/vps-migration
```

### Verificación de fase 6

- [ ] Branch `chore/vps-migration` creada
- [ ] Archivos Vercel-only eliminados (incluye `.vercel/` directories)
- [ ] Astro adapter cambiado a Node
- [ ] Admin TanStack Start preset configurado a `node-server`
- [ ] Crons: QStash eliminado, `node-cron` único adapter, `refresh-search.yml` eliminado
- [ ] Better Auth con `crossSubDomainCookies`
- [ ] Dockerfiles creados con TODOS los workspace deps
- [ ] `/api/revalidate` endpoint creado en web
- [ ] Workflows `cd-production.yml`, `cd-staging.yml`, `refresh-search.yml` eliminados
- [ ] Scripts `env:*` migrados a Coolify API (o tarea anotada para post-Fase 9)
- [ ] Builds Docker locales pasan (los 3)
- [ ] Commit hecho y pusheado a `chore/vps-migration`

✅ Fase 6 completa.

---

## Fase 7 — Postgres y Redis en Coolify

**Tiempo estimado**: 20 minutos
**Riesgo**: Bajo

### Paso 7.1 — Crear un Project en Coolify

Cada "Project" en Coolify agrupa apps + DBs relacionadas.

1. Entrá a `https://coolify.hospeda.com.ar`
2. Click **"Projects"** en el sidebar
3. Click **"+ New"** → **"Project"**
4. **Name**: `hospeda`
5. **Description**: `Hospeda monorepo (api + web + admin)`
6. Click **"Save"**

### Paso 7.2 — Agregar un Environment

Dentro del project, agregamos un environment llamado `production`.

1. Click en el project `hospeda`
2. Click **"+ Add Environment"** o el botón equivalente
3. **Name**: `production`
4. Save

> **Nota**: en una iteración futura agregamos `staging` como otro environment. Por ahora solo prod.

### Paso 7.3 — Crear Postgres

1. Dentro del environment `production`, click **"+ New Resource"**
2. Buscá la categoría **"Databases"**
3. Click **"PostgreSQL"** → la versión más nueva (16 o superior)
4. Configuración:
   - **Name**: `hospeda-postgres`
   - **PostgreSQL User**: `hospeda` (no uses `postgres` por seguridad)
   - **PostgreSQL Password**: clickeá el botón para generar una random fuerte. **COPIALA Y GUARDALA EN TU PASSWORD MANAGER**.
   - **PostgreSQL Database**: `hospeda`
   - **Port**: dejá default (5432)
   - **Image**: `postgres:16-alpine`
5. Click **"Save"**
6. Click **"Start"** para arrancar el container

Esperá 1-2 min hasta que el status diga **Running**.

### Paso 7.4 — Habilitar extensiones Postgres

Hospeda usa 3 extensiones: `uuid-ossp`, `pgcrypto`, `unaccent`.

Dentro de la página de tu Postgres en Coolify:

1. Click en pestaña **"Terminal"** (te conecta al psql del container)
2. Pegá:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
SELECT extname FROM pg_extension;
```

Deberías ver listadas las 3 (más `plpgsql` que viene por default).

### Paso 7.5 — Anotar la connection string

En la página del Postgres, sección **"Connection"**:

- **Internal URL** (para que las apps de Coolify se conecten): algo tipo `postgres://hospeda:PASSWORD@hospeda-postgres:5432/hospeda`
- **External URL** (para vos desde tu laptop): algo tipo `postgres://hospeda:PASSWORD@TU_IP_VPS:5432/hospeda`

**Anotá la INTERNAL URL** — la vamos a usar como env var en las apps.

### Paso 7.6 — Crear Redis

1. Dentro del environment `production`, **"+ New Resource"** → **"Databases"** → **"Redis"**
2. Configuración:
   - **Name**: `hospeda-redis`
   - **Redis Password**: clickeá generar (anotala)
   - **Port**: 6379 default
   - **Image**: `redis:7-alpine`
3. Save → Start

Anotá la **Internal URL**: `redis://:PASSWORD@hospeda-redis:6379`

### Verificación de fase 7

- [x] Postgres `hospeda-postgres` running
- [x] 3 extensiones habilitadas
- [x] Redis `hospeda-redis` running
- [x] Tenés copiadas las 2 connection strings internas

✅ Fase 7 completa.

---

## Fase 8 — Conectar GitHub a Coolify

**Tiempo estimado**: 10 minutos

### Paso 8.1 — Crear GitHub App desde Coolify

Coolify se conecta a GitHub vía una "GitHub App" propia (no Personal Access Token, más seguro).

1. En Coolify: **Sources** (sidebar) → **+ New Source** → **GitHub**
2. **Name**: `qazuor-github`
3. **Custom GitHub App**: dejá apagado (usamos default)
4. Click **"Save"**
5. Te va a redirigir a GitHub. Click **"Create GitHub App for qazuor"** (o tu user)
6. GitHub te pide confirmar permisos. Aceptá.
7. **Install** la app en `qazuor/hospeda` (o "All repositories")
8. Volvés a Coolify, ya conectado.

### Verificación de fase 8

- [x] Coolify muestra el source `qazuor-github` con check verde
- [x] Cuando creás una nueva app vas a poder seleccionar `qazuor/hospeda` como source

✅ Fase 8 completa.

---

## Fase 9 — Crear apps en Coolify

**Tiempo estimado**: 30 minutos
**Riesgo**: Medio (primera vez puede haber errores de build)

Vamos a crear las 3 apps de prod (`api`, `web`, `admin`). Repetí los pasos para cada una.

### Plantilla por cada app

1. Dentro del environment `production`, **"+ New Resource"** → **"Application"**
2. **Source**: `qazuor-github`
3. **Repository**: `qazuor/hospeda`
4. **Branch**: `chore/vps-migration` (cambiamos a `main` cuando mergeemos)
5. **Build Pack**: **Dockerfile**

### App 1: hospeda-api

| Campo | Valor |
|-------|-------|
| Name | `hospeda-api-prod` |
| Dockerfile Location | `apps/api/Dockerfile` |
| Build Context | `.` (raíz del repo) |
| Port Exposes | `3001` |
| Health Check Path | `/health` |

**Environment Variables** (click "Environment Variables", agregar uno por uno o paste bulk):

```bash
# === Runtime & networking ===
NODE_ENV=production
API_PORT=3001
API_HOST=0.0.0.0

# === DB & cache (hostnames internos de Coolify, no IPs) ===
HOSPEDA_DATABASE_URL=postgres://hospeda:PASSWORD@hospeda-postgres:5432/hospeda
HOSPEDA_REDIS_URL=redis://:PASSWORD@hospeda-redis:6379

# === URLs canónicas ===
HOSPEDA_API_URL=https://api.hospeda.com.ar
HOSPEDA_SITE_URL=https://hospeda.com.ar
HOSPEDA_ADMIN_URL=https://admin.hospeda.com.ar

# === Auth ===
HOSPEDA_BETTER_AUTH_URL=https://api.hospeda.com.ar/api/auth
HOSPEDA_BETTER_AUTH_SECRET=<generá: openssl rand -base64 48>

# === CORS ===
API_CORS_ORIGINS=https://hospeda.com.ar,https://admin.hospeda.com.ar

# === Git SHA (para Sentry release) ===
# Coolify expone SOURCE_COMMIT automáticamente. Mapeamos:
HOSPEDA_GIT_SHA=${SOURCE_COMMIT}

# === Cron ===
HOSPEDA_CRON_ADAPTER=node-cron

# === Cloudinary (uploads de imágenes) ===
HOSPEDA_CLOUDINARY_CLOUD_NAME=<de tu Cloudinary dashboard>
HOSPEDA_CLOUDINARY_API_KEY=<de tu Cloudinary dashboard>
HOSPEDA_CLOUDINARY_API_SECRET=<de tu Cloudinary dashboard>

# === Email transaccional (Resend) ===
HOSPEDA_RESEND_API_KEY=<de tu cuenta Resend>
HOSPEDA_RESEND_FROM_EMAIL=no-reply@hospeda.com.ar
HOSPEDA_RESEND_FROM_NAME=Hospeda

# === MercadoPago / QZPay (billing) ===
# IMPORTANTE: copiá los nombres exactos desde tu .env de Vercel actual.
# El paquete @qazuor/qzpay-mercadopago define las suyas (ej. ACCESS_TOKEN, PUBLIC_KEY).
# Listá las que usás hoy en Vercel y replicalas tal cual.

# === OAuth providers (Google / GitHub si aplica) ===
HOSPEDA_GOOGLE_CLIENT_ID=<de Google Cloud Console>
HOSPEDA_GOOGLE_CLIENT_SECRET=<de Google Cloud Console>

# === Sentry (error tracking) ===
HOSPEDA_SENTRY_DSN=<DSN del proyecto API en Sentry>

# === Rate limiting ===
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100

# === Cloudflare (para /api/revalidate desde web; OPTIONAL si usás web standalone) ===
# Estas las usa el endpoint /api/revalidate del web; en api NO hacen falta.

# === El resto: copiá de tu .env actual de Vercel ===
# Sugerencia: corré `pnpm env:pull --app=api --env=production` (versión Vercel)
# para obtener el listado completo, después subilo a Coolify.
```

> **Importante**:
>
> - `HOSPEDA_DATABASE_URL` y `HOSPEDA_REDIS_URL` usan los **hostnames internos de Coolify** (`hospeda-postgres` y `hospeda-redis`), no la IP del VPS. Coolify resuelve esos hostnames entre containers de la misma red.
> - `${SOURCE_COMMIT}` es una variable que Coolify **expande automáticamente** en build time al SHA del commit que está deployando. Mapeala a `HOSPEDA_GIT_SHA` para que Sentry reciba el release correcto en cada deploy.
> - Si Coolify NO expone `SOURCE_COMMIT` en tu versión, alternativa: en el Dockerfile de api, agregá `ARG GIT_SHA` y `ENV HOSPEDA_GIT_SHA=$GIT_SHA`, después en Coolify configurás un Build Argument llamado `GIT_SHA` con valor `${SOURCE_COMMIT}` o equivalente.
>
> **Verificación de env vars críticas** después de configurar todo:
>
> ```bash
> # Desde Coolify → app → Terminal del container
> env | grep HOSPEDA_ | sort
> ```
>
> Tenés que ver al menos: DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SITE_URL, ADMIN_URL, API_URL, RESEND_API_KEY, CLOUDINARY_*, CRON_ADAPTER=node-cron.

**Domains**: dejar vacío por ahora. Lo configuramos en Fase 10.

Click **"Save"**.

### App 2: hospeda-web

| Campo | Valor |
|-------|-------|
| Name | `hospeda-web-prod` |
| Dockerfile Location | `apps/web/Dockerfile` |
| Build Context | `.` |
| Port Exposes | `4321` |
| Health Check Path | `/` |

Env vars:

```bash
# === Runtime ===
NODE_ENV=production
HOST=0.0.0.0
PORT=4321

# === URLs canónicas (server-side, prefijo HOSPEDA_) ===
HOSPEDA_API_URL=https://api.hospeda.com.ar
HOSPEDA_SITE_URL=https://hospeda.com.ar
HOSPEDA_BETTER_AUTH_URL=https://api.hospeda.com.ar/api/auth

# === URLs canónicas (client-side, prefijo PUBLIC_) ===
PUBLIC_API_URL=https://api.hospeda.com.ar
PUBLIC_SITE_URL=https://hospeda.com.ar
PUBLIC_ADMIN_URL=https://admin.hospeda.com.ar

# === Sentry (browser + SSR) ===
PUBLIC_SENTRY_DSN=<DSN del proyecto Web en Sentry>
HOSPEDA_GIT_SHA=${SOURCE_COMMIT}

# === Cache invalidation (endpoint /api/revalidate) ===
HOSPEDA_REVALIDATION_SECRET=<generá: openssl rand -base64 32>
CLOUDFLARE_ZONE_ID=<de tu CF dashboard, en la zona hospeda.com.ar → Overview>
CLOUDFLARE_API_TOKEN=<crear token con permisos: Zone → Cache Purge → Edit en hospeda.com.ar>

# === Logging ===
PUBLIC_ENABLE_LOGGING=false

# === Resto de env vars ===
# Sugerencia: corré `pnpm env:pull --app=web --env=production` (versión Vercel)
# para obtener el listado completo, después subilo a Coolify.
```

> **Sobre `CLOUDFLARE_API_TOKEN`**: NO uses tu Global API Key (es root y rompe security). Creá un token específico:
>
> 1. Cloudflare → My Profile → API Tokens → **Create Token**
> 2. Custom token, permission: **Zone → Cache Purge → Edit**
> 3. Zone Resources: **Include → Specific zone → hospeda.com.ar**
> 4. Copiar el token, guardar en password manager
>
> Si nunca purgás cache desde la web, podés OMITIR `CLOUDFLARE_*` y comentar el endpoint `/api/revalidate` por ahora. Lo activás cuando lo necesites.

### App 3: hospeda-admin

| Campo | Valor |
|-------|-------|
| Name | `hospeda-admin-prod` |
| Dockerfile Location | `apps/admin/Dockerfile` |
| Build Context | `.` |
| Port Exposes | `3000` |
| Health Check Path | `/` |

Env vars:

```bash
# === Runtime ===
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# === URLs canónicas (server-side build, prefijo HOSPEDA_) ===
HOSPEDA_API_URL=https://api.hospeda.com.ar
HOSPEDA_SITE_URL=https://hospeda.com.ar

# === URLs canónicas (client-side, prefijo VITE_ — expuestas al browser) ===
VITE_API_URL=https://api.hospeda.com.ar
VITE_SITE_URL=https://hospeda.com.ar
VITE_BETTER_AUTH_URL=https://api.hospeda.com.ar/api/auth
VITE_APP_NAME=Hospeda Admin

# === Sentry (browser) ===
VITE_SENTRY_DSN=<DSN del proyecto Admin en Sentry>
HOSPEDA_GIT_SHA=${SOURCE_COMMIT}

# === Resto de env vars ===
# Sugerencia: corré `pnpm env:pull --app=admin --env=production` (versión Vercel)
# para obtener el listado completo, después subilo a Coolify.
```

> **Importante**: NUNCA pongas un `HOSPEDA_*_SECRET` en una env var con prefijo `VITE_` o `PUBLIC_`. Esos prefijos las exponen al bundle del browser, donde cualquiera las puede leer en DevTools. Solo URLs públicas, DSN de Sentry, nombres de app, etc.

### Verificación de fase 9

- [x] 3 apps creadas en Coolify
- [x] Env vars configuradas
- [x] Branch apunta a `chore/vps-migration`
- [x] Health check paths configurados

✅ Fase 9 completa.

---

## Fase 10 — Configurar dominios y SSL

**Tiempo estimado**: 15 minutos

### Paso 10.1 — Asignar dominios a cada app

Para cada app en Coolify, en pestaña **"Configuration"** → **"Domains"**:

| App | Domain |
|-----|--------|
| hospeda-api-prod | `https://api.hospeda.com.ar` |
| hospeda-web-prod | `https://hospeda.com.ar` y `https://www.hospeda.com.ar` |
| hospeda-admin-prod | `https://admin.hospeda.com.ar` |

Click **"Save"** después de cada uno. Coolify automáticamente:

1. Configura Traefik routing
2. Solicita cert SSL a Let's Encrypt vía HTTP challenge
3. Activa HTTPS

### Paso 10.2 — Configurar redirect www → apex

En la app `hospeda-web-prod`, en domains poné:

- **Primary**: `https://hospeda.com.ar`
- **Redirect**: `https://www.hospeda.com.ar` → `https://hospeda.com.ar`

### Verificación de fase 10

- [x] Cada dominio tiene check verde de SSL
- [x] Si hacés `curl -I https://api.hospeda.com.ar` ves cert válido

✅ Fase 10 completa.

---

## Fase 11 — Branch staging

**Tiempo estimado**: 10 minutos

### Paso 11.1 — Mergear cambios y crear staging

```bash
git checkout main
git merge chore/vps-migration
git push origin main

git branch staging
git push -u origin staging
```

### Paso 11.2 — Replicar las 3 apps en Coolify para staging

Por cada app de prod, **Clone** (botón en Coolify) y configurar:

| Original | Clone |
|----------|-------|
| hospeda-api-prod | hospeda-api-staging — branch `staging`, dominio `staging-api.hospeda.com.ar` |
| hospeda-web-prod | hospeda-web-staging — branch `staging`, dominio `staging.hospeda.com.ar` |
| hospeda-admin-prod | hospeda-admin-staging — branch `staging`, dominio `staging-admin.hospeda.com.ar` |

Mismas env vars excepto los URLs que apuntan a staging-*.hospeda.com.ar.

> **Tip**: en una iteración futura, separamos staging en su propia DB. Por ahora compartimos.

### Verificación de fase 11

- [x] Branch `staging` existe en GitHub
- [x] 3 apps de staging en Coolify
- [x] DNS de staging-* apunta al VPS

✅ Fase 11 completa.

---

## Fase 12 — Primer deploy + cutover de `api`

**Tiempo estimado**: 1-3 horas (depende de cuántas iteraciones de Dockerfile necesites)
**Riesgo**: Alto (es el momento donde algo se rompe)

> **Nota crítica**: el cutover de `api.hospeda.com.ar` (cambiar el DNS de Vercel al VPS) es el ÚLTIMO paso de esta fase, después de validar que la API en VPS responde correctamente. Hasta entonces, Vercel sigue sirviendo `api.hospeda.com.ar` y los users no notan nada.

### Paso 12.1 — Aplicar schema de DB ANTES del primer deploy de API

> **Por qué primero la DB**: si la API arranca contra una DB vacía, va a fallar en cada query. Mejor aplicar schema + extras manuales primero, después arrancar la API.

#### 12.1.a — Aplicar schema con `drizzle-kit push` desde tu laptop

El runner de Docker NO incluye `drizzle-kit` (es devDep, no se empaqueta). Lo corremos desde tu laptop usando la **external URL** del Postgres de Coolify.

```bash
# 1. Obtener la external URL desde Coolify → Postgres → Connection → "External URL"
# Tiene formato: postgres://hospeda:PASSWORD@TU_IP_VPS:5432/hospeda

# 2. Exportar como env var local (NO commitees esto)
export HOSPEDA_DATABASE_URL='postgres://hospeda:PASSWORD@TU_IP_VPS:5432/hospeda'

# 3. Desde la raíz del repo, push el schema
cd packages/db
pnpm db:push
# Equivale a: drizzle-kit push (lee schema.ts, genera DDL, aplica)

# 4. Verificar que las tablas se crearon
psql "$HOSPEDA_DATABASE_URL" -c "\\dt"
# Tenés que ver: accommodations, users, sessions, billing_*, etc. (~80+ tablas)
```

> **Si `drizzle-kit push` te pide confirmar destructive changes**: revisá CON CUIDADO qué quiere borrar. En una DB nueva no debería pedir nada destructive (todo es CREATE). Si pide DROP, abortá y revisá el schema.

#### 12.1.b — Aplicar los 21 SQL manuales (triggers, materialized views, CHECK constraints)

> **Conteo**: en disco hay **26 archivos** en `packages/db/src/migrations/manual/`: **21 forward** (`0001_*.sql` a `0021_*.sql`) y **7 rollbacks** (`*_down.sql`, para algunas migrations sensibles). En el deploy inicial aplicamos **solo los 21 forward** — los `_down` son herramientas de rescate manual, no parte del flujo normal.

```bash
# Desde la raíz del repo
cd packages/db/src/migrations/manual

# Aplicar SOLO los forward (NO los _down)
for f in $(ls 00*_*.sql | grep -v '_down\.sql$' | sort); do
  echo "Applying $f..."
  psql "$HOSPEDA_DATABASE_URL" -f "$f"
done
```

Output esperado: 21 mensajes `Applying 0001_xxx.sql ... CREATE` (o similar). Si alguno falla, anotá cuál y resolvé antes de seguir (típicamente: orden de dependencias entre triggers y tablas).

> **Atajo**: hay un script en `packages/db/scripts/apply-postgres-extras.sh` que hace lo mismo. Verificalo y usalo si está actualizado:
>
> ```bash
> bash packages/db/scripts/apply-postgres-extras.sh "$HOSPEDA_DATABASE_URL"
> ```

#### 12.1.c — Verificar extensiones Postgres

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SELECT extname FROM pg_extension ORDER BY extname;"
```

Tenés que ver: `pgcrypto`, `plpgsql`, `unaccent`, `uuid-ossp`. Si falta alguna, aplicala (deberías haberlo hecho en Paso 7.4 pero por las dudas):

```bash
psql "$HOSPEDA_DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto"; CREATE EXTENSION IF NOT EXISTS "unaccent";'
```

### Paso 12.2 — Trigger build de la API

1. En Coolify → `hospeda-api-prod` → click **Deploy**
2. Coolify hace `git pull` + `docker build` → la primera vez tarda 8-15 min (después es más rápido por layer cache)
3. Vas a ver logs en tiempo real:
   - **Build stage**: pnpm install + turbo build
   - **Runner stage**: COPY de artefactos
   - **Container start**: arranca node, valida env vars (Zod), conecta a DB y Redis, inicializa cron, escucha en :3001
4. Si todo OK, status pasa a **Running** y health check `/api/v1/health/` responde 200 → Coolify marca "Application is healthy"

#### Si el build falla

Errores comunes (ya cubiertos en Apéndice A):

- **`cannot find module '@repo/X'`** → falta `COPY packages/X/package.json` en el Dockerfile, o el package no está en deps de la app.
- **`pnpm install --frozen-lockfile` falla** → `pnpm-lock.yaml` desactualizado. Corré `pnpm install` local + commit + redeploy.
- **`turbo: command not found`** → falta enable corepack o turbo no se instaló.

#### Si el container arranca pero falla healthcheck

- Mirá logs del runner stage: ¿la API loggeó algo de error?
- Probable causa: env var faltante o DB no accesible. Revisá:

  ```bash
  # Desde Terminal del container
  env | grep HOSPEDA_ | sort
  # ¿Está DATABASE_URL? ¿Apunta al hostname interno?
  
  # Test de conectividad
  apk add postgresql-client && psql "$HOSPEDA_DATABASE_URL" -c "SELECT 1"
  ```

### Paso 12.3 — Verificar API arrancada (sin DNS cutover todavía)

La API está corriendo en el VPS pero `api.hospeda.com.ar` todavía apunta a Vercel. Para validar la del VPS, usá el **dominio interno de Coolify** o conectate por IP.

Coolify le asigna a cada app un dominio temporal tipo `app-id.coolify.hospeda.com.ar` o similar. En la página de la app → **Configuration** → **Domains**, vas a ver:

- El dominio configurado (`api.hospeda.com.ar`) → todavía con cert pendiente porque el DNS apunta a Vercel
- Un dominio interno asignado por Coolify

**Test alternativo** sin cambiar DNS, usando `--resolve`:

```bash
curl --resolve api.hospeda.com.ar:443:TU_IP_VPS https://api.hospeda.com.ar/api/v1/health/
```

Esto le dice a curl: "para api.hospeda.com.ar, usá esta IP en vez de la del DNS". Si responde 200, la API está sirviendo bien desde el VPS.

Si NO responde, problema en Coolify routing / Traefik / SSL. Resolvé antes de seguir.

### Paso 12.4 — Deploy de web y admin

Mismo proceso para `hospeda-web-prod` y `hospeda-admin-prod`. Click **Deploy** en cada uno.

Validar igual con `--resolve`:

```bash
curl --resolve hospeda.com.ar:443:TU_IP_VPS https://hospeda.com.ar/
curl --resolve admin.hospeda.com.ar:443:TU_IP_VPS https://admin.hospeda.com.ar/
```

> **Nota**: web y admin van a hacer requests a `https://api.hospeda.com.ar/...` que **AÚN apunta a Vercel**. Eso significa que tu primer test del VPS va a usar la API de Vercel (vieja). No es ideal pero es lo correcto en este momento — todavía no validamos la API standalone.

Para test end-to-end del VPS completo, podés temporalmente editar `/etc/hosts` en tu laptop:

```bash
# Solo para tu máquina, sin afectar nadie más
sudo sh -c 'echo "TU_IP_VPS api.hospeda.com.ar hospeda.com.ar admin.hospeda.com.ar" >> /etc/hosts'
```

Ahora desde tu browser, los 3 dominios resuelven al VPS. Probá flows reales (login, ver alojamientos, crear uno desde admin). Si funciona, listo para cutover.

**Cuando termines, eliminá la línea del `/etc/hosts`** para volver al estado normal.

### Paso 12.5 — Cutover: switchear DNS de `api.hospeda.com.ar` a VPS

> **Punto de no retorno parcial**. A partir de este paso, los users empiezan a usar la API del VPS. Si algo está mal, podés revertir cambiando DNS de vuelta a Vercel (rollback ~5 min, pero los DNS pueden tardar 5-30 min en propagar).

#### Pre-checks ANTES del cutover

- [ ] `curl --resolve api.hospeda.com.ar:443:TU_IP_VPS https://api.hospeda.com.ar/api/v1/health/` responde 200
- [ ] DB tiene todos los datos (si migraste data desde Neon, verificá count de tablas críticas)
- [ ] El proyecto Vercel de la API sigue activo (rollback fallback)
- [ ] Tenés la IP del VPS y los DNS records de Cloudflare a la vista

#### Procedimiento

1. Cloudflare → DNS → buscá el record de `api`
2. **Anotá el valor actual** (ej. `cname.vercel-dns.com`) por si necesitás revertir
3. Editá el record:
   - Type: `A` (cambiar de CNAME a A)
   - Name: `api`
   - IPv4: `TU_IP_VPS`
   - Proxy: 🟠 Proxied
4. Save
5. **Esperá 1-2 min** y validá:

   ```bash
   dig api.hospeda.com.ar +short
   # Tiene que responder con IPs de Cloudflare (172.67.x.x o 104.21.x.x)
   
   curl -I https://api.hospeda.com.ar/api/v1/health/
   # Tiene que responder 200
   ```

1. **Verificación de SSL**: Coolify ya debería haber pedido el cert de Let's Encrypt para `api.hospeda.com.ar` cuando configuraste el dominio en Fase 10. Verificalo:

   ```bash
   curl -vI https://api.hospeda.com.ar 2>&1 | grep -i "subject\|issuer"
   ```

   Issuer tiene que ser `Let's Encrypt`.

#### Si el cert NO se generó automáticamente

Coolify a veces no puede pedir el cert hasta que el DNS resuelve hacia él (chicken-and-egg con el HTTP-01 challenge). Después del cutover, en Coolify → app → Domains → click **Renew SSL** manualmente.

#### Rollback (si el cutover sale mal)

1. Cloudflare → DNS → record `api` → revertir a `cname.vercel-dns.com` (CNAME)
2. Esperá 5-10 min de propagación
3. Vercel sirve de nuevo
4. Investigá qué falló en VPS, corregí, re-intentá cutover

### Paso 12.6 — Configurar MercadoPago webhooks (post-cutover)

> **Por qué acá**: hasta este punto el endpoint `https://api.hospeda.com.ar/api/v1/protected/billing/webhooks/mercadopago` no estaba garantizado. Recién después del cutover (12.5) responde 200 desde el VPS de manera estable. Configurar MP antes habría mandado eventos a un endpoint inestable o equivocado (Vercel viejo).
>
> **Casos**:
>
> - **Webhooks YA configurados antes del cutover** (caso documentado en Paso 0.8): no hay nada que hacer acá; MP sigue mandando al MISMO host, que ahora resuelve al VPS. Saltá a "Validación" abajo.
> - **Webhooks NO configurados todavía** (caso no-op del Paso 0.8): hay que crearlos ahora. Seguí los pasos 1-5.

#### Crear/actualizar webhook en el panel de MP

1. <https://www.mercadopago.com.ar/developers/panel> → tu aplicación → **Webhooks** (sidebar `Notificaciones`)
2. Si no existe, click **Configurar notificaciones** (o `Editar` si ya hay uno).
3. Modo: **Productivo** (NO sandbox/test).
4. **URL de producción**: `https://api.hospeda.com.ar/api/v1/protected/billing/webhooks/mercadopago`
5. **Eventos a suscribir** (mínimo recomendado para Hospeda):
   - `payment` (creado/actualizado)
   - `merchant_order`
   - `subscription_preapproval` (si usás suscripciones)
   - `subscription_authorized_payment` (si usás suscripciones recurrentes)
   - `point_integration_wh` (solo si integrás Point físico, normalmente NO)
6. **Generá la "Clave secreta"** (signature secret). MP la usa para firmar el header `x-signature` de cada webhook. Copiala en password manager con clave `MP_WEBHOOK_SECRET`.
7. **Guardá el formulario** en MP.

#### Persistir el secret en el VPS

8. En Coolify → `hospeda-api-prod` → **Environment Variables**
9. Agregá / actualizá:
   - `MP_WEBHOOK_SECRET` = el valor copiado en el paso 6
   - (Si tu código usa otro nombre de env var, alineá según `apps/api/src/utils/env.ts` o `packages/billing` — el registry del proyecto manda)
10. Click **Restart** o redeploy de la API para que tome la nueva env.

#### Validación

11. Desde MP → Webhooks → **"Simular notificación"** (botón cerca del listado de webhooks). Elegí evento `payment.created` con un ID de prueba.
12. En Coolify → API logs, mirá si llegó el POST. Tenés que ver:

    ```
    [billing.webhooks.mercadopago] received event=payment.created id=...
    [billing.webhooks.mercadopago] signature_valid=true
    ```

13. Si `signature_valid=false`: el `MP_WEBHOOK_SECRET` no coincide. Repetí desde el paso 6 (regenerar secret y actualizar env var).
14. Si el log NO muestra nada: probablemente Cloudflare está bloqueando por WAF/Bot Fight Mode. Excepción: en CF → Security → WAF → agregá una regla "Skip" para `api.hospeda.com.ar/api/v1/protected/billing/webhooks/*` o agregá el rango de IPs de MP a la allowlist.

#### Rollback parcial

Si MP empieza a fallar tras el cutover y no hay tiempo de debuggear, **revertí el DNS de `api` a Vercel** (Paso 12.5 rollback). Vercel vuelve a recibir webhooks. Después corregís en VPS y re-cutover.

### Verificación de fase 12

- [ ] DB schema aplicado (drizzle push + 21 manual SQL + extensiones)
- [ ] 3 apps de prod (api, web, admin) deployadas y respondiendo 200 desde dominios reales
- [ ] DNS de `api` cutover hecho, cert SSL válido
- [ ] Login E2E funciona (web → SSO con admin)
- [ ] Crear/leer/editar accommodation desde admin → reflejado en web
- [ ] Logs limpios (sin errores recurrentes en Coolify)
- [ ] Cron logs muestran `[cron] adapter=node-cron jobs=16 initialized`
- [ ] MercadoPago webhook configurado (URL prod + secret + simulación 200) — ver Paso 12.6

✅ Fase 12 completa. **A partir de acá, Hospeda corre en VPS.** El proyecto Vercel sigue activo para rollback de emergencia, lo eliminás en Fase 16.

---

## Fase 13 — Backups

**Tiempo estimado**: 1 hora

### Paso 13.1 — Crear bucket Cloudflare R2

1. En Cloudflare dashboard → **R2** (sidebar)
2. Activar R2 (te pide tarjeta pero free hasta 10GB)
3. **Create bucket**: `hospeda-backups`
4. Crear API token: **Manage R2 API Tokens** → **Create API token**
5. **Permissions**: Object Read & Write
6. **Bucket**: solo `hospeda-backups`
7. Anotar Access Key ID + Secret Access Key + Endpoint URL

### Paso 13.2 — Configurar backups en Coolify

1. En el Postgres `hospeda-postgres` → pestaña **"Backups"**
2. **+ Add Backup**:
   - **Schedule**: daily at 03:00 (cron `0 3 * * *`)
   - **Destination**: S3-compatible
   - **Endpoint**: tu R2 endpoint URL
   - **Access Key / Secret**: del paso anterior
   - **Bucket**: `hospeda-backups`
   - **Retention**: 30 days

### Paso 13.3 — Test de restore

Después del primer backup nocturno, validar:

1. En Coolify → backup → click **"Restore to..."**
2. Restaurar a una DB temporal de testing
3. Verificar count de tablas matches

### Verificación de fase 13

- [x] Bucket R2 creado
- [x] Coolify configurado con backups daily
- [x] Test de restore exitoso

✅ Fase 13 completa.

---

## Fase 14 — Monitoring

**Tiempo estimado**: 20 minutos

### Paso 14.1 — Crear cuenta Better Stack

1. <https://betterstack.com> → Sign up
2. Plan: **Free** — incluye 10 HTTP monitors **+ heartbeats ilimitados** (los heartbeats los usamos en 14.4 para validar que cada cron in-process corrió)

### Paso 14.2 — Crear monitors

Para cada uno de los 3 dominios prod + 3 dominios staging:

1. **+ Create monitor**
2. **Name**: `Hospeda API Prod`
3. **URL**: `https://api.hospeda.com.ar/health`
4. **Frequency**: 3 minutos (free tier)
5. **Expected status**: 200
6. **Expected body** (opcional): contiene `"status":"ok"`
7. **Locations**: 5 ubicaciones (auto)
8. Save

Repetir para los otros 5.

### Paso 14.3 — Configurar alertas

En Better Stack → **On-call** → **Notification rules**:

- Email a tu cuenta
- (Opcional) Telegram, Slack

### Paso 14.4 — Heartbeats para los 16 cron jobs (recomendado, opcional)

> **Por qué**: los crons in-process (node-cron) corren dentro de la API. Si la API está OK pero un cron específico tira excepción y se silencia, el monitor HTTP no lo detecta. Un heartbeat por cron se cae si el cron deja de pingar y dispara alerta en minutos.

1. Better Stack → **Heartbeats** → **+ Create heartbeat**
2. Por cada cron job (16 en total — ver `apps/api/src/cron/jobs/`), creá uno con:
   - **Name**: `cron-<job-name>` (ej: `cron-search-index-refresh`)
   - **Period**: el intervalo del cron + 50% de margen (ej: si corre cada 5 min, period 8 min)
3. Better Stack te da una URL `https://uptime.betterstack.com/api/v1/heartbeat/<TOKEN>` por cada heartbeat
4. En el código del cron, después de `runWithLoggingAndValidation()`, agregá:

   ```ts
   await fetch(env.HEARTBEAT_URL_<JOB_NAME>, { method: 'POST' }).catch(() => {});
   ```

   (`.catch(() => {})` para que un fallo de heartbeat NO mate el cron)
5. Registrá `HEARTBEAT_URL_*` como env vars opcionales en `packages/config/src/env-registry.hospeda.ts` y en Coolify

> **Costo**: $0. Free tier de Better Stack incluye heartbeats sin límite de cantidad.

### Verificación de fase 14

- [ ] 6 HTTP monitors creados, todos UP
- [ ] Si parás manualmente uno (en Coolify), recibís alerta en <5min
- [ ] (Opcional) 16 heartbeats creados; cada uno reporta verde tras la primera ejecución del cron

✅ Fase 14 completa.

---

## Fase 15 — Smoke tests finales

Lista chequeable manual. **No marques completo hasta validar TODO.**

### Conectividad básica

- [ ] `curl -I https://api.hospeda.com.ar/api/v1/health/` → `HTTP/2 200`
- [ ] `curl -I https://hospeda.com.ar` → `HTTP/2 200`
- [ ] `curl -I https://admin.hospeda.com.ar` → `HTTP/2 200`
- [ ] `curl -I https://staging-api.hospeda.com.ar/api/v1/health/` → `HTTP/2 200`
- [ ] `curl -I https://staging.hospeda.com.ar` → `HTTP/2 200`
- [ ] `curl -I https://staging-admin.hospeda.com.ar` → `HTTP/2 200`
- [ ] `curl -I https://www.hospeda.com.ar` → `HTTP/2 301` redirect a apex

### SSL y headers

- [ ] Los 6 dominios tienen cert válido (sin warning de browser)
- [ ] Cloudflare proxy activo (`curl -sI https://api.hospeda.com.ar | grep -i "server\|cf-ray"` muestra `cloudflare`)
- [ ] HSTS header presente en respuestas HTTPS

### Auth & SSO

- [ ] Login en web con Google OAuth → callback funciona y redirige bien
- [ ] Login en web con email/password → funciona
- [ ] Después del login en web, **abrir nueva pestaña** y navegar a `https://admin.hospeda.com.ar` → tenés que estar **logueado sin que te pida credenciales** (SSO entre subdominios funcionando)
- [ ] Logout desde admin → en web también te quedás deslogueado (cookie de session compartida se borró)
- [ ] Inspeccionar cookie en DevTools → debe ser `Domain=.hospeda.com.ar` (con punto), `Secure`, `HttpOnly`, `SameSite=Lax`

### Funcionalidad core

- [ ] Crear un accommodation desde admin → aparece listado en web (`hospeda.com.ar/alojamientos/`)
- [ ] Editar el accommodation → cambios reflejados en web (puede requerir refresh si hay cache)
- [ ] Hard delete desde admin → desaparece de web

### Uploads (Cloudinary)

- [ ] Subir una imagen desde admin → llega a Cloudinary (visible en dashboard de Cloudinary)
- [ ] La URL retornada por la API tiene formato `https://res.cloudinary.com/{cloud-name}/...`
- [ ] La imagen se renderiza en web sin warnings de CORS

### Email (Resend)

- [ ] Triggear un signup nuevo → email de verificación llega al inbox
- [ ] El email tiene `From: Hospeda <no-reply@hospeda.com.ar>` (NO un dominio default de Resend)
- [ ] Triggear "olvidé mi password" → email de reset llega
- [ ] Headers del email: `SPF=pass`, `DKIM=pass`, `DMARC=pass` (visible en "View original" en Gmail)
- [ ] Si SPF/DKIM falla → revisá los DNS records de Resend en Cloudflare (Paso 0.5)

### Cron jobs (in-process)

- [ ] Logs de la API en Coolify muestran `[cron] adapter=node-cron jobs=16 initialized` al boot
- [ ] Esperar 5 min y revisar logs: tiene que haber un log de `conversation-notification` (corre `*/5 * * * *`)
- [ ] Esperar 15 min: tiene que haber log de `exchange-rate-fetch`
- [ ] Verificar que en la DB la tabla `exchange_rates` tiene un record con `created_at` reciente (menos de 20 min)
- [ ] Verificar que NO hay logs de `qstash` ni de `vercel cron` (eso significaría que algún adapter quedó vivo)

### MercadoPago webhooks

- [ ] Generar un pago de prueba (sandbox MP) → en logs de la API aparece el webhook recibido
- [ ] El response al webhook es 200 (MP reintenta si recibe ≠2xx)
- [ ] La transacción queda registrada en la DB (`billing_transactions` o similar)
- [ ] Si tenías webhooks pendientes en MP dashboard de la era Vercel → revisar que se procesaron o reenviar

### Errores y observabilidad

- [ ] Forzar un error en API (request inválido tipo `POST /api/v1/admin/accommodations` con body malformado) → response 400/422 + aparece en Sentry
- [ ] Forzar un error en web (browser console error) → aparece en Sentry con `release` correcto (= SHA del commit deployado)
- [ ] El campo `release` de Sentry no es `unknown` ni vacío — confirma que `HOSPEDA_GIT_SHA` se setea correctamente vía `${SOURCE_COMMIT}` de Coolify

### Logs y monitoring

- [ ] Logs de las 6 apps (3 prod + 3 staging) aparecen en Coolify → app → Logs
- [ ] Better Stack muestra los 6 monitors UP
- [ ] Manualmente detener `hospeda-web-prod` en Coolify → Better Stack alerta en <5min → restartear → status vuelve a UP

### Backups

- [ ] Pasar 1 noche → al día siguiente, en R2 bucket `hospeda-backups` aparece un dump nuevo
- [ ] Test de restore: restaurar el último backup a una DB temporal en Coolify, verificar `SELECT count(*) FROM accommodations` matchea

✅ Si todos los items están marcados, **deploy production READY**.

❌ Si alguno falla, NO procedas al cutover de `api.hospeda.com.ar` (DNS sigue apuntando a Vercel). Resolvelo primero.

---

## Fase 16 — Cleanup

### Paso 16.1 — Migrar email provider de Resend a Brevo (URGENTE post-cutover)

> 🔴 **Prioridad ALTA — hacer inmediatamente después de validar Fase 15**. NO esperar 1-2 semanas como el resto del cleanup. Sin esto los emails transaccionales (signup confirmation, password reset, booking notifications, etc.) NO se envían.

**Contexto**: en Fase 0.5 cambiamos el provider de email de Resend a Brevo (multi-domain en free tier). El dominio `hospeda.com.ar` está autenticado en Brevo (DKIM+DMARC+brevo-code en Cloudflare DNS). Pero `packages/email/` y `packages/config/src/env-registry.hospeda.ts` siguen referenciando Resend SDK y env vars `HOSPEDA_RESEND_*`. En Fase 9 se setearon placeholders en Coolify (`re_placeholder_pending_brevo_migration`) para que zod validation pase, pero `sendEmail()` falla en runtime.

**Pasos**:

1. **Refactorear `packages/email/`** para usar Brevo SDK (`@getbrevo/brevo`) o SMTP genérico vía `nodemailer`.
2. **Renombrar env vars** `HOSPEDA_RESEND_*` → `HOSPEDA_BREVO_*` (o `HOSPEDA_EMAIL_*` para neutralidad de provider futuro).
3. **Actualizar registry**: `packages/config/src/env-registry.hospeda.ts` — cambiar `name: 'HOSPEDA_RESEND_*'` y descripciones.
4. **Actualizar Zod schemas**: `apps/api/src/utils/env.ts`, `apps/web/src/utils/env.ts` (si aplica), etc.
5. **Buscar y reemplazar usos**: `grep -rn "HOSPEDA_RESEND_" apps/ packages/` y migrar cada referencia.
6. **Actualizar Coolify env vars**: reemplazar los 3 placeholders por los valores reales de Brevo (API key real está en password manager con clave `Hospeda - Brevo API key production`).
7. **Smoke test**: signup new user → verificar que recibe welcome email. Password reset request → verificar email. Si tenés email de bookings, probar uno.

**Verificación**:

- [ ] `packages/email/src/client.ts` usa Brevo SDK (no Resend)
- [ ] `grep -rn "HOSPEDA_RESEND" apps/ packages/` devuelve 0 matches en código (puede quedar en docs/CHANGELOG)
- [ ] Coolify env vars: `HOSPEDA_BREVO_API_KEY` con valor real, sin placeholder
- [ ] Signup E2E manda email a inbox real
- [ ] Brevo dashboard muestra el email enviado en `Statistics → Transactional`

### Paso 16.2 — Completar verificación de Facebook App (antes de launch público)

> 🟡 **Prioridad MEDIA — antes de habilitar signup público con Facebook OAuth**. La app de Facebook quedó en estado "Sin publicar" durante Fase 9 (modo Development/Test). En ese estado SOLO vos como admin podés loguearte con Facebook. Cualquier otro user que intente login con Facebook recibe un error tipo "App not available".

**Contexto**: en Fase 9 creamos la Facebook App `Hospeda` (App ID + App Secret en `HOSPEDA_FACEBOOK_CLIENT_ID|SECRET`) y configuramos OAuth Redirect URI a `https://api.hospeda.com.ar/api/auth/callback/facebook`. La app pasa todos los tests internos pero NO está publicada para usuarios externos.

**Pasos para publicar** (en <https://developers.facebook.com/apps/><APP_ID>/dashboard):

1. **Personalizar caso de uso "Autenticar y solicitar datos..."**
   - Especificar qué scopes de datos pedís (typicamente `email` y `public_profile` alcanzan).
   - Justificar cada scope con una explicación de uso.

2. **Revisar y completar requisitos de pruebas**
   - Verificar que el OAuth Redirect URI sea HTTPS (ya lo es: `api.hospeda.com.ar`).
   - Verificar que el Privacy Policy URL apunte a una URL pública válida (ej. `https://hospeda.com.ar/legal/privacidad`).
   - Verificar Terms of Service URL.

3. **Verificación del negocio (Business Verification)**
   - Es el paso más demorado: Meta verifica que tu empresa existe legalmente.
   - Necesitás: nombre legal de la empresa, número de identificación tributaria (CUIT en Argentina), dirección, persona de contacto.
   - Puede tomar 1-7 días hábiles.
   - Si Hospeda es un proyecto personal/freelance sin empresa formalizada, esto puede ser un blocker — considerá:
     - Registrar la empresa antes (CUIT, AFIP),
     - O usar tu propia identidad como Individual/Sole Proprietor.

4. **Revisión de la app (App Review)**
   - Meta revisa que el flujo de OAuth funcione end-to-end y respete las policies de privacidad.
   - Tenés que grabar un video de pantalla mostrando el flujo completo (signup → consent → return to app → user data displayed).
   - Puede tomar 1-3 días hábiles.

5. **Publicar la app**
   - Una vez completados los 4 anteriores, click "Publicar" en el Panel.
   - A partir de ese momento, cualquier user de Facebook puede loguearse en Hospeda.

**Verificación**:

- [ ] App status: "Publicada" (en lugar de "Sin publicar" / "Sin publicar (modo desarrollo)")
- [ ] Test E2E con cuenta de Facebook ajena al admin → puede loguearse y verifica datos
- [ ] No errores tipo "App not active" en logs

> Si no necesitás Facebook OAuth para launch (alcanza con Email/Password + Google OAuth), podés diferir indefinidamente y borrar las env vars `HOSPEDA_FACEBOOK_CLIENT_*` para que el código no muestre el botón "Login with Facebook".

### Paso 16.3 — Switch MercadoPago de SANDBOX a PRODUCTION (al ir a launch público)

> 🔴 **Crítico — antes del launch público real (cuando empieces a cobrar plata real)**.

**Contexto**: en Fase 9 configuramos MercadoPago en modo sandbox (`HOSPEDA_MERCADO_PAGO_SANDBOX=true`) con TEST access token, para poder testear sin cobros reales. El webhook secret quedó vacío porque MP webhooks se configuran en Paso 12.6 post-cutover.

**Pasos**:

1. **Obtener PROD access token** desde el panel de MP:
   - <https://www.mercadopago.com.ar/developers/panel/app> → tu app → **Credenciales de producción** → copiar Access Token (empieza con `APP_USR-`, igual formato que TEST).
   - Si MP te bloquea producción y exige homologación, completá los pasos requeridos primero (datos fiscales, validación de cuenta, KYC).

2. **Update env vars en Coolify** → `hospeda-api-prod` → Environment Variables:
   - `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`: reemplazar TEST token por PROD token.
   - `HOSPEDA_MERCADO_PAGO_SANDBOX`: cambiar de `true` a `false`.
   - Verificar que `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` esté seteado (debió hacerse en Paso 12.6).

3. **Restart** del container de `hospeda-api-prod` (Coolify lo hace automático tras Save).

4. **Smoke test E2E** de un pago real con monto chico ($100 ARS, una tarjeta tuya):
   - Crear booking → checkout → confirmar pago → verificar que el webhook llega y se procesa OK → verificar que aparece en MP dashboard como `approved`.
   - Reembolsar inmediatamente vía MP dashboard si todo OK.

5. **Logs check**: en Coolify → API logs, buscar `[billing.webhooks.mercadopago]` y verificar `signature_valid=true` en el evento del test.

**Verificación**:

- [ ] `HOSPEDA_MERCADO_PAGO_SANDBOX=false` en Coolify
- [ ] `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` empieza con `APP_USR-` y es el de PROD (no TEST)
- [ ] `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` no está vacío
- [ ] Smoke test E2E de pago real reembolsado OK

### Paso 16.4 — Cleanup post-cutover (1-2 semanas después)

**Solo después de 1-2 semanas estables corriendo en VPS:**

#### Vercel

1. Cancelar projects en Vercel dashboard
2. Plan: downgrade a Hobby (mantiene gratis si no usás)

#### Neon

1. Eliminar el proyecto en Neon dashboard

#### Upstash

1. Eliminar Redis y QStash en Upstash dashboard

---

## Apéndice A — Troubleshooting

### Build failures

#### `cannot find module '@repo/X'`

- **Causa**: el package no está siendo copiado en el `deps stage` del Dockerfile, o no está declarado como dep en `apps/<app>/package.json`.
- **Fix**: agregá `COPY packages/X/package.json packages/X/` al Dockerfile (después de los otros COPY de packages). Si el package no debería ser dep, remové el import.

#### `pnpm install --frozen-lockfile` falla con "missing specifier"

- **Causa**: `pnpm-lock.yaml` desactualizado respecto a algún `package.json`.
- **Fix**: corré `pnpm install` localmente, commit el lockfile, redeploy.

#### `turbo: command not found`

- **Causa**: corepack no está habilitado en la imagen base.
- **Fix**: confirmar que el Dockerfile tiene `RUN corepack enable` en el stage `base`.

#### Build "tarda 25+ min"

- **Causa**: Coolify no está cacheando layers entre builds, o el orden de los COPY es ineficiente.
- **Fix**: poner los COPY de `package.json` ANTES del `pnpm install` (ya está bien en los Dockerfiles propuestos). Verificar que Coolify tiene "Use Build Cache" habilitado en la app → Configuration.

### Runtime / container

#### `503 Service Unavailable` después de deploy

- **Causa**: el container arrancó pero el healthcheck (`/api/v1/health/`) no responde 200, o tarda más de N segundos.
- **Fix**: revisar logs en Coolify → app → Logs. Buscar trace de error en startup. Más común: env var faltante (Zod throws), DB no accesible, Redis no accesible.

#### `Cannot connect to database`

- **Causa**: hostname interno mal escrito en `HOSPEDA_DATABASE_URL`.
- **Fix**: usar `hospeda-postgres` (nombre del resource exacto en Coolify), NO IP, NO `localhost`. La red de Docker resuelve los nombres entre containers de la misma red.

#### `Cannot connect to Redis`

- Mismo patrón: usar `hospeda-redis`, NO IP.

#### `OOM killed` (Out Of Memory)

- **Causa**: la app excede los 4 GB de RAM del VPS.
- **Fix corto**: confirmar swap activo (`free -h`, debería mostrar 2 GB de swap del Paso 3.7).
- **Fix permanente**: bumpear el VPS a Vultr HF $48/mes (4 vCPU, 8 GB RAM, 256 GB NVMe). Vultr permite resize en caliente con 5-15 min de downtime.

### Cron

#### "Los crons no corren"

- Verificar `HOSPEDA_CRON_ADAPTER=node-cron` está seteado en la app de la API
- Verificar logs al boot: tiene que aparecer `[cron] adapter=node-cron jobs=16 initialized`
- Si dice `adapter=manual` o aparece `qstash` → la env var no se aplicó o quedó código residual.

#### "Un cron específico falla"

- Logs en Coolify mostrarán el stack trace del job.
- Test manual del job desde Terminal del container: `node -e "import('./dist/cron/jobs/Y.js').then(m => m.default())"`.

### DNS / SSL

#### "El dominio no resuelve"

- `dig <dominio> +short` desde tu laptop. Si responde IP del VPS directo (no de Cloudflare): proxy 🟠 está apagado. Encenderlo en Cloudflare DNS.
- Si NO responde: el record no existe o Cloudflare no es el authoritative DNS del dominio.

#### "Let's Encrypt no genera el cert"

- Causa típica: DNS no apunta al VPS al momento del HTTP-01 challenge.
- Fix: esperar propagación DNS → Coolify → app → Domains → click **Renew SSL**.
- Alternativa: temporalmente desactivar proxy de Cloudflare (🔘 DNS only) para que Let's Encrypt llegue directo al VPS, esperar el cert, volver a activar 🟠.

### Auth / SSO

#### "Login en web funciona, pero al ir a admin me pide login de nuevo"

- Causa: `crossSubDomainCookies` no está activo o el `domain` está mal seteado.
- Fix: revisar `apps/api/src/lib/auth.ts`, confirmar que el bloque `advanced.crossSubDomainCookies.enabled: true` está presente y `domain: 'hospeda.com.ar'` (sin punto, sin protocolo).
- Verificar en DevTools que la cookie de session tiene `Domain=.hospeda.com.ar`.

#### "Cookies no se guardan en producción"

- Causa: cookie sin `Secure=true` y la app está en HTTPS.
- Fix: confirmar `useSecureCookies: env.NODE_ENV === 'production'` en config Better Auth.

### MercadoPago

#### "Webhooks no llegan"

- Verificar URL configurada en MP dashboard apunta al endpoint correcto: `https://api.hospeda.com.ar/api/v1/protected/billing/webhooks/mercadopago`
- Si hubo cutover de DNS reciente, MP puede tener cache TTL de la IP vieja → reintentar webhooks manualmente desde MP dashboard.
- Logs de la API deben mostrar el request entrante de MP.

#### "Webhook llega pero responde 401"

- Causa: validación de signature de MP fallando.
- Fix: confirmar que la env var de la signing key de MP es la correcta para producción (no la de sandbox).

### Email (Resend)

#### "Emails no llegan"

- Cloudflare DNS records de Resend (SPF/DKIM) verificados? Resend dashboard te dice si están OK.
- `HOSPEDA_RESEND_API_KEY` válida (no expirada)?
- Logs de la API muestran el call a `client.emails.send` con response OK?

#### "Emails llegan pero a SPAM"

- SPF, DKIM, DMARC deben estar todos en `pass`. Verificar en Gmail "Show original" del email.
- DKIM signature debe ser del dominio `hospeda.com.ar` (no `resend.dev`).

### Backups

#### "Backups no se generan"

- Coolify → Postgres → Backups → ver historial. Si el último intento falló, el log dice el motivo.
- Causas comunes: token de R2 expirado, bucket eliminado, endpoint URL mal escrita.

---

## Apéndice B — Runbook operacional

### Deployar después de un cambio

```bash
git checkout main
git pull
# hacer cambios
git add <archivos>
git commit -m "fix: ..."
git push origin main
# Coolify detecta el push y hace auto-deploy. Mirar progreso en Coolify → app → Deployments.
```

Para staging: mismo flow pero con branch `staging`.

### Ver logs en vivo

- **Coolify UI**: app → Logs (más cómodo)
- **SSH**: `ssh qazuor@TU_IP_VPS && docker logs -f <container_name>` (más rápido para tail)
- Listar containers: `docker ps`

### Conectarse al VPS

```bash
ssh qazuor@TU_IP_VPS
# Si setearas el alias en ~/.ssh/config como `Host hospeda`:
ssh hospeda
```

Sugerencia: agregá a `~/.ssh/config`:

```
Host hospeda
    HostName TU_IP_VPS
    User qazuor
    IdentityFile ~/.ssh/id_ed25519
```

### Conectarse a la DB desde tu laptop

```bash
# External URL (visible en Coolify → Postgres → Connection)
psql "postgres://hospeda:PASSWORD@TU_IP_VPS:5432/hospeda"
```

Para clientes GUI (TablePlus, DBeaver, Postico), usar los mismos credenciales con SSL preferred.

### Restaurar DB de un backup

1. Coolify → Postgres `hospeda-postgres` → Backups
2. Seleccionar el backup deseado → click **Restore to...**
3. Opciones:
   - **A new database** (recomendado para testear el restore sin tocar prod)
   - **Replace existing** (DESTRUCTIVO, requiere confirmación)

Si necesitás restore manual desde R2:

```bash
# Desde tu laptop, descargar el dump
aws s3 cp --endpoint-url=https://<R2_ENDPOINT> s3://hospeda-backups/<backup-file>.sql.gz ./

# Restaurar
gunzip < backup.sql.gz | psql "$HOSPEDA_DATABASE_URL"
```

### Agregar un dominio nuevo

1. Cloudflare DNS: agregar A record proxied apuntando a IP VPS
2. Coolify → app → **Configuration → Domains** → agregar dominio
3. Esperar 1-2 min para que Coolify pida el cert SSL
4. Verificar: `curl -I https://nuevo-dominio.com.ar`

### Escalar verticalmente el VPS

1. Vultr → server → **Server Resize**
2. Seleccionar plan más grande (ej. HF $48/mes: 4 vCPU 8 GB)
3. Confirmar (5-15 min de downtime, el server se apaga, se mueve a hardware nuevo, se prende)
4. Después del resize, verificar `free -h` y `nproc` que reflejen los recursos nuevos
5. Si aumentaste RAM significativamente, podés deshabilitar swap o ampliarlo

### Rotar el `HOSPEDA_BETTER_AUTH_SECRET`

> **Cuidado**: rotar este secret invalida TODAS las sessions activas.

1. Generar nuevo secret: `openssl rand -base64 48`
2. Coolify → `hospeda-api-prod` → Environment Variables → editar `HOSPEDA_BETTER_AUTH_SECRET`
3. Save → Coolify reinicia el container
4. Repetir para `hospeda-api-staging`
5. Avisá a users que tienen que reloguearse

### Sincronizar env vars desde el registry

> Asume que los scripts `env:*` ya fueron migrados a Coolify API (Paso 6.12).

```bash
# Validar que el registry coincide con lo que hay en Coolify
pnpm env:check --app=api --env=production

# Subir las vars que faltan (interactivo, pregunta por valor)
pnpm env:sync --app=api --env=production

# Bajar las vars desde Coolify a un .env local (para debug)
pnpm env:pull --app=api --env=production > .env.api.prod.local
```

### Forzar redeploy sin push (rebuild de imagen)

Coolify → app → click **Redeploy** (botón). Útil cuando cambiás env vars y querés que el container las tome.

### Rollback de un deploy

#### Opción 1: revert del commit (recomendada para fixes)

```bash
git revert <SHA del commit malo>
git push origin main
# Coolify deploya el revert automáticamente.
```

#### Opción 2: redeploy de un build anterior (más rápido)

Coolify → app → **Deployments** → click en un deployment exitoso anterior → **Redeploy**. Vuelve a usar esa imagen Docker (no rebuildea).

### Pausar staging (ahorrar recursos del VPS)

Coolify → cada app `*-staging` → **Stop**. Postgres compartida sigue prendida. Para volver a usarlo: **Start**.

### Mover a otro VPS (en el futuro, si querés)

1. Snapshot de Vultr → restaurar en server nuevo (cambia IP)
2. O: setup nuevo Coolify desde cero, migrar resources (Coolify export/import en versiones recientes)
3. Cambiar DNS records al IP nuevo
4. Esperar propagación + validar
5. Bajar el viejo

---

## Apéndice C — Checklist de cutover (resumen ejecutivo)

> **Esta es la lista mínima crítica para el día del cutover**. Imprimila o tenela en otro monitor mientras ejecutás.

### Pre-cutover (días previos)

- [ ] Fase 0 hecha: VPS, DNS de todo MENOS `api`, R2, Better Stack, Resend (verificado)
- [ ] Fases 3-6 hechas: hardening, Coolify, código, dominios
- [ ] Postgres + Redis + 3 apps prod + 3 apps staging deployadas
- [ ] SSL válido en los 6 dominios (excepto `api` que sigue en Vercel)
- [ ] Backup automático funcionando (al menos 1 backup en R2)
- [ ] Better Stack monitorea los 6 dominios + el de Vercel actual
- [ ] Test E2E con `/etc/hosts` modificado completo y sin errores

### Día del cutover (`api.hospeda.com.ar` → VPS)

- [ ] Avisar al equipo + comunidad (Twitter/Discord/etc.) de "ventana de mantenimiento" (aunque no haya downtime real, por las dudas)
- [ ] Hacer un backup manual de Postgres en este momento exacto (snapshot pre-cutover)
- [ ] Verificar Vercel logs últimos 30 min — confirmar que NO hay tráfico anómalo activo
- [ ] **CUTOVER**: Cloudflare → DNS → record `api` → cambiar a A record con IP del VPS, proxy 🟠
- [ ] Esperar 2-5 min, validar `dig api.hospeda.com.ar` resuelve a Cloudflare
- [ ] Validar `curl -I https://api.hospeda.com.ar/api/v1/health/` → 200
- [ ] Probar login E2E desde browser real (no solo curl)
- [ ] Monitorear Sentry los primeros 30 min — picos de errores son la primera señal de problemas
- [ ] Monitorear logs de cada cron job — confirmar que los próximos triggered runs corren OK
- [ ] Monitorear MercadoPago dashboard — confirmar que webhooks siguen llegando

### Post-cutover (días siguientes)

- [ ] Día 1: smoke tests cada hora durante el día
- [ ] Día 2: revisar errores en Sentry, ajustar si hay regresiones
- [ ] Día 3-7: monitoreo pasivo, revisar Better Stack semanal
- [ ] Semana 2: ejecutar Fase 16 (cleanup Vercel/Neon/Upstash) SOLO si todo está estable

### Rollback de emergencia (si TODO falla)

1. Cloudflare → DNS → record `api` → revertir a `cname.vercel-dns.com` (CNAME)
2. Esperar propagación 5-10 min
3. Vercel sirve de nuevo
4. **NO toques nada más en el VPS** — investigar fríamente qué pasó
5. Notificar a usuarios si hubo impacto visible

---

## Sources

- [Coolify installation docs](http://coolify.io/docs/get-started/installation)
- [Vultr High Frequency Compute pricing](https://www.vultr.com/products/high-frequency-compute/)
- [Astro Node adapter docs](https://docs.astro.build/en/guides/integrations-guide/node/)
- [TanStack Start Hosting docs](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Better Auth cookies docs](https://www.better-auth.com/docs/concepts/cookies)
- [Cloudflare cache purge API](https://developers.cloudflare.com/cache/how-to/purge-cache/)
- [Better Stack Uptime free tier](https://betterstack.com/uptime)
