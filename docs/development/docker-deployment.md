# 🐳 Docker y Deployment - Hospeda

Esta guía cubre la configuración de Docker Compose para desarrollo local, análisis del Dockerfile.api y deployment en Fly.io.

## 📋 Requerimientos Previos

### Para Desarrollo Local

#### Docker y Docker Compose

**Obligatorio** para ejecutar PostgreSQL, Redis y pgAdmin localmente:

```bash
# Verificar instalación
docker --version       # ≥20.10
docker compose version # ≥2.0

# Verificar que Docker está ejecutándose
docker info
```

**Instalación rápida:**

- **Ubuntu/Debian**: Ver [instalación detallada](./README.md#docker-y-docker-compose)
- **macOS**: `brew install --cask docker`
- **Windows**: Docker Desktop desde docker.com

#### Permisos de Docker (Linux)

```bash
# Agregar usuario al grupo docker (evita usar sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verificar permisos
docker run hello-world
```

### Para Deployment en Fly.io

#### Fly CLI

```bash
# Instalación
curl -L https://fly.io/install.sh | sh

# En macOS
brew install flyctl

# Verificar instalación
flyctl version

# Login (necesario para deployment)
flyctl auth login
```

#### Variables de Entorno

Asegúrate de tener configuradas las variables necesarias en tu entorno de Fly.io.

### Verificación de Setup

```bash
# Verificar Docker
docker compose --version
docker network ls

# Verificar Fly CLI (si planeas hacer deployment)
flyctl status --app your-app-name
```

## 🏗️ Construcción de la API

### Proceso Completo

```bash
# Construir API para producción
pnpm build:api

# Generar package.json para producción
pnpm prepare:api:prod

# Construir imagen Docker
docker build -f Dockerfile.api -t hospeda-api .

# Ejecutar contenedor
docker run -p 3000:3000 hospeda-api
```

### Scripts Explicados

#### `pnpm build:api`

Compila la API usando tsup:

```bash
# Equivale a:
pnpm --filter hospeda-api build
```

**Resultado:**

- Código TypeScript compilado a JavaScript
- Archivos en `apps/api/dist/`
- Optimizado para producción

#### `pnpm prepare:api:prod`

Genera un `package.json` específico para producción:

```bash
# Ejecuta:
pnpm exec tsx scripts/generate-api-prod-package.ts
```

**Que hace:**

- Lee `apps/api/package.json`
- Extrae solo dependencias de producción
- Crea `apps/api/package.prod.json`
- Excluye devDependencies y scripts de desarrollo

## 🐳 Dockerfile Explicado

### Estructura del Dockerfile.api

```dockerfile
# Imagen base optimizada
FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar build compilado
COPY apps/api/dist ./dist

# Copiar package.json de producción
COPY apps/api/package.prod.json ./package.json

# Instalar solo dependencias de producción
RUN npm install -g pnpm && pnpm install --prod

# Variables de entorno
ENV NODE_ENV=production

# Puerto de la aplicación
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/index.js"]
```

### Por qué esta Estrategia

**Ventajas:**

- **Imagen pequeña**: Solo archivos necesarios
- **Rápida construcción**: Build local, no en Docker
- **Cacheable**: Separación de capas optimizada
- **Segura**: Sin código fuente en producción

## 🚀 Despliegue en Fly.io

### Comando Único

```bash
pnpm deploy:api
```

### Proceso Detallado

```bash
# 1. Construir API
pnpm build:api

# 2. Generar package.json optimizado
pnpm prepare:api:prod

# 3. Desplegar con Fly.io
flyctl deploy --config apps/api/fly.toml --dockerfile Dockerfile.api
```

### Configuración Fly.io

El archivo `apps/api/fly.toml` contiene:

```toml
app = "hospeda-api"
primary_region = "scl"  # Santiago, Chile

[build]
  dockerfile = "../../Dockerfile.api"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
```

## 🔧 Desarrollo Local con Docker

### Servicios de Base de Datos

```bash
# Iniciar servicios
pnpm db:start

# Ver logs
pnpm db:logs

# Detener servicios
pnpm db:stop
```

### Configuración Docker Compose

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: hospeda_postgres
    environment:
      POSTGRES_DB: hospeda_dev
      POSTGRES_USER: hospeda_user
      POSTGRES_PASSWORD: hospeda_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hospeda_user -d hospeda_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: hospeda_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: hospeda_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin123
    ports:
      - "8080:80"
    depends_on:
      postgres:
        condition: service_healthy
```

## 🌐 URLs y Puertos

### Desarrollo Local

- **API**: `http://localhost:3000`
- **Web**: `http://localhost:4321`
- **Admin**: `http://localhost:3000` (TanStack Start)
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **pgAdmin**: `http://localhost:8080`
- **Drizzle Studio**: Abre automáticamente

### Producción

- **API**: `https://hospeda-api.fly.dev`
- **Web**: Configurar según deploy
- **Admin**: Configurar según deploy

## 🔐 Variables de Entorno

### Desarrollo (.env.local)

```bash
# Base de datos
HOSPEDA_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@localhost:5432/hospeda_dev

# Redis
HOSPEDA_REDIS_URL=redis://localhost:6379

# Clerk (Auth)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# API
API_PORT=3000
API_HOST=localhost
```

### Producción

```bash
# Configurar en Fly.io
flyctl secrets set DATABASE_URL=postgresql://...
flyctl secrets set REDIS_URL=redis://...
flyctl secrets set CLERK_SECRET_KEY=sk_live_...
```

## 📦 Scripts de Construcción

### Por Aplicación

```bash
# API
pnpm --filter hospeda-api build

# Web (Astro)
pnpm --filter hospeda-web build

# Admin (TanStack Start)
pnpm --filter admin build
```

### Por Paquete

```bash
# Service Core
pnpm --filter @repo/service-core build

# Schemas
pnpm --filter @repo/schemas build

# Database
pnpm --filter @repo/db build
```

## 🐛 Troubleshooting

### Error: Cannot connect to Docker daemon

```bash
# Iniciar Docker
sudo systemctl start docker

# Verificar estado
sudo systemctl status docker

# Agregar usuario a grupo docker
sudo usermod -aG docker $USER
# Logout y login
```

### Error: Puerto en uso

```bash
# Ver qué usa el puerto
sudo lsof -i :3000

# Matar proceso
sudo kill -9 <PID>

# O cambiar puerto
export API_PORT=3001
```

### Error: Build falla

```bash
# Limpiar cache
pnpm clean

# Reconstruir todo
pnpm build

# Ver logs detallados
pnpm build:api --verbose
```

### Error: Fly.io deploy falla

```bash
# Ver logs
flyctl logs

# Verificar configuración
flyctl status

# Redeploy
flyctl deploy --verbose
```

## 🚀 Optimizaciones

### Imagen Docker

1. **Multi-stage builds** (para proyectos más complejos)
2. **Alpine Linux** para imágenes pequeñas
3. **Layer caching** con orden optimizado
4. **Health checks** para monitoreo

### Fly.io

1. **Auto-scaling** configurado
2. **Health checks** habilitados
3. **HTTPS** forzado
4. **Región optimizada** (Santiago, Chile)

### Performance

1. **Compilación local** (más rápida que Docker)
2. **Dependencies optimizadas** (solo producción)
3. **Node.js 20** (performance mejorada)
4. **pnpm** (package manager rápido)

## 📊 Monitoreo

### Logs de Aplicación

```bash
# Desarrollo
pnpm dev  # logs en consola

# Producción (Fly.io)
flyctl logs --app hospeda-api
```

### Métricas

```bash
# Docker local
docker stats

# Fly.io
flyctl status
flyctl metrics
```

### Health Checks

```bash
# Local
curl http://localhost:3000/health

# Producción
curl https://hospeda-api.fly.dev/health
```

## 🔧 Comandos Útiles

### Docker

```bash
# Ver imágenes
docker images

# Ver contenedores
docker ps -a

# Limpiar sistema
docker system prune -f

# Logs de contenedor
docker logs hospeda_postgres
```

### Fly.io

```bash
# Estado de la app
flyctl status

# Logs en tiempo real
flyctl logs --follow

# Escalar instancias
flyctl scale count 2

# SSH a la instancia
flyctl ssh console
```

## 🎯 Mejores Prácticas

1. **Siempre testea localmente antes de desplegar**
2. **Usa builds locales para imágenes más pequeñas**
3. **Configura health checks apropiados**
4. **Mantén variables de entorno seguras**
5. **Monitorea logs y métricas regularmente**
6. **Usa caché de Docker layers efectivamente**
7. **Documenta cambios en configuración**

## 🔗 Enlaces Útiles

- [Fly.io Docs](https://fly.io/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js in Production](https://nodejs.org/en/docs/guides/)
