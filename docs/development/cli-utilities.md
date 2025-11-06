# 🛠️ CLI y Utilidades - Hospeda

Esta guía cubre todas las herramientas CLI, scripts personalizados y utilidades disponibles en el monorepo Hospeda.

## 📋 Requerimientos Previos

### Obligatorios

#### Node.js y pnpm

```bash
# Verificar versiones
node --version  # ≥18
pnpm --version  # ≥8.15.6
```

#### TSX (TypeScript Execution)

Instalado como dependencia de desarrollo, se usa para ejecutar scripts TypeScript:

```bash
# Verificar que está disponible
cd packages/seed
pnpm tsx --version
```

### Para Comandos Específicos

#### Docker (Scripts de BD)

Necesario para comandos `db:*`:

```bash
# Verificar Docker
docker --version
docker compose version

# Verificar contenedores
docker compose ps
```

#### Fly CLI (Para Deployment)

Solo necesario para `pnpm deploy:api`:

```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# En macOS
brew install flyctl

# Verificar
flyctl version
```

### Verificación del Entorno CLI

```bash
# Verificar acceso a comandos principales
cd packages/seed
pnpm seed --help

# Verificar comando de base de datos
pnpm db:studio --help

# Verificar build tools
cd packages/db
pnpm drizzle-kit --version
```

## 🚀 CLI Principales

### Seed CLI (`@repo/seed`)

El CLI de seeding permite gestionar datos de prueba y producción:

```bash
# Navegar al directorio seed
cd packages/seed

# Ver ayuda completa (no existe comando --help específico)
pnpm seed

# Comandos principales disponibles:
pnpm seed --required           # Datos esenciales (usuarios, permisos)
pnpm seed --example           # Datos de ejemplo para desarrollo  
pnpm seed --reset             # Reset database antes del seed
pnpm seed --migrate           # Ejecutar migraciones antes del seed

# Combinaciones útiles:
pnpm seed --reset --required --example    # Comando completo (usado en db:seed)
pnpm seed --required --continueOnError    # Continúa ante errores
pnpm seed --exclude=users,posts           # Excluye entidades específicas
```

#### Opciones Reales del CLI

```bash
# Opciones principales
--required             # Ejecuta seeds requeridos (datos esenciales)
--example              # Ejecuta seeds de ejemplo (datos demo)
--reset                # Resetea la base de datos antes del seed
--migrate              # Ejecuta migraciones antes del seed

# Opciones de control de errores
--rollbackOnError      # Rollback en caso de error (incompatible con continueOnError)
--continueOnError      # Continúa procesando aunque haya errores

# Opciones de filtrado  
--exclude=entity1,entity2   # Excluye entidades específicas del seed
```

#### Estructura Real del Seed Package

```
packages/seed/
├── src/
│   ├── cli.ts              # Entry point del CLI
│   ├── index.ts            # Función principal runSeed()
│   ├── required/           # Seeds de datos esenciales
│   │   ├── index.ts
│   │   ├── users.seed.ts
│   │   ├── destinations.seed.ts
│   │   ├── amenities.seed.ts
│   │   ├── features.seed.ts
│   │   ├── attractions.seed.ts
│   │   └── rolePermissions.seed.ts
│   ├── example/            # Seeds de datos de ejemplo
│   │   ├── index.ts
│   │   ├── accommodations.seed.ts
│   │   ├── events.seed.ts
│   │   ├── posts.seed.ts
│   │   ├── tagRelations.seed.ts
│   │   └── postSponsorships.seed.ts
│   ├── utils/              # Utilidades del seed
│   │   ├── db.ts
│   │   ├── dbReset.ts
│   │   ├── logger.ts
│   │   ├── seedContext.ts
│   │   └── superAdminLoader.ts
│   ├── data/               # Datos estáticos JSON
│   └── schemas/            # Esquemas de validación
├── scripts/                # Scripts de migración y validación
└── package.json           # Configuración CLI
```

#### Scripts Disponibles en Seed Package

```bash
# Scripts del package.json de @repo/seed
pnpm seed                               # CLI principal (tsx ./src/cli.ts)
pnpm seed:required                      # Solo datos requeridos
pnpm seed:example                       # Solo datos de ejemplo
pnpm migrate:accommodation-prices       # Migración específica de precios
pnpm validate:accommodations            # Validación de acomodaciones
```

```

### Database CLI Scripts

```bash
# Migración completa (reset + migrate + seed) - script del root
pnpm db:fresh              # Con sudo
pnpm db:fresh-no-sudo      # Sin sudo

# Scripts de base de datos (delegados a @repo/db)
pnpm db:migrate            # Aplicar migraciones (drizzle-kit push:pg)
pnpm db:generate           # Generar migraciones (drizzle-kit generate:pg)
pnpm db:studio             # Abrir Drizzle Studio

# Scripts de contenedores Docker
pnpm db:start              # Levantar PostgreSQL y Redis
pnpm db:stop               # Detener PostgreSQL y Redis
pnpm db:restart            # Reiniciar PostgreSQL y Redis
pnpm db:reset              # Reset containers + migrate
pnpm db:logs               # Ver logs de PostgreSQL

# Utilidades adicionales
pnpm pgadmin:start         # Iniciar pgAdmin
pnpm pgadmin:stop          # Detener pgAdmin
pnpm db:seed               # Ejecutar seed (--reset --required --example)
```

### Development CLI

```bash
# Desarrollo general
pnpm dev                    # Todo en modo desarrollo (turbo dev)
pnpm dev:admin             # Solo admin dashboard (script especial dev-admin.js)

# Build y verificación
pnpm build                 # Build completo (turbo build)
pnpm check                 # Biome check --write . (no turbo check)
pnpm clean                 # Limpiar artifacts (turbo clean)
pnpm typecheck             # Verificación de tipos (turbo typecheck)

# Calidad de código
pnpm lint                  # Linting (turbo lint)  
pnpm format                # Formato (turbo format)
```

## 🔧 Scripts Personalizados

### Scripts de Root (`package.json`)

```json
{
  "scripts": {
    // Desarrollo
    "dev": "turbo dev",
    "dev:api": "turbo dev --filter=hospeda-api",
    "dev:web": "turbo dev --filter=hospeda-web",
    "dev:admin": "turbo dev --filter=hospeda-admin",
    
    // Build y testing
    "build": "turbo build",
    "test": "turbo test",
    "test:watch": "turbo test:watch",
    "test:coverage": "turbo test:coverage",
    
    // Base de datos
    "db:fresh": "turbo db:fresh",
    "db:migrate": "turbo db:migrate", 
    "db:rollback": "turbo db:rollback",
    "db:studio": "turbo db:studio",
    "db:generate": "turbo db:generate",
    "db:validate": "turbo db:validate",
    
    // Calidad de código
    "check": "turbo check",
    "lint": "turbo lint",
    "format": "turbo format",
    "typecheck": "turbo typecheck",
    
    // Utilidades
    "clean": "turbo clean",
    "reset": "turbo reset && pnpm install",
    "seed": "turbo seed",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  }
}
```

### Scripts Avanzados

#### Script de Migración de Tests (`scripts/migrate-test-imports.cjs`)

Script que migra imports de `@repo/types` a `@repo/schemas` en archivos de test.

```bash
# Ejecutar migración de imports en tests
node scripts/migrate-test-imports.cjs
```

#### Script de Verificación de Migraciones (`scripts/check-migration-status.sh`)

Script para verificar el estado de migraciones.

```bash
# Verificar estado de migraciones
chmod +x scripts/check-migration-status.sh
./scripts/check-migration-status.sh
```

#### Script de Generación de Package.json para Producción (`scripts/generate-api-prod-package.ts`)

Genera package.json optimizado para producción del API.

```bash
# Generar package.json optimizado para producción
pnpm prepare:api:prod
# Ejecuta: tsx scripts/generate-api-prod-package.ts
```

#### Script de Desarrollo Admin (`scripts/dev-admin.js`)

Script especial para desarrollo del admin dashboard.

```bash
# Iniciar admin en modo desarrollo
pnpm dev:admin
# Ejecuta: node scripts/dev-admin.js
```

## 📁 Estructura de CLI Tools

### Seed Package Structure (Real)

```text
packages/seed/
├── src/
│   ├── cli.ts               # Entry point CLI (tsx ./src/cli.ts)
│   ├── index.ts             # Función principal runSeed()
│   ├── required/            # Seeds de datos esenciales
│   │   ├── index.ts
│   │   ├── users.seed.ts
│   │   ├── destinations.seed.ts
│   │   ├── amenities.seed.ts
│   │   ├── features.seed.ts
│   │   ├── attractions.seed.ts
│   │   └── rolePermissions.seed.ts
│   ├── example/             # Seeds de datos de ejemplo
│   │   ├── index.ts
│   │   ├── accommodations.seed.ts
│   │   ├── events.seed.ts
│   │   ├── posts.seed.ts
│   │   ├── tagRelations.seed.ts
│   │   └── postSponsorships.seed.ts
│   ├── utils/               # Utilidades del seed
│   │   ├── db.ts            # Configuración de base de datos
│   │   ├── dbReset.ts       # Reset de base de datos
│   │   ├── logger.ts        # Logging del seed
│   │   ├── seedContext.ts   # Contexto del seed
│   │   ├── superAdminLoader.ts # Carga del super admin
│   │   ├── errorHistory.js  # Historial de errores
│   │   ├── summaryTracker.js # Tracking de resumen
│   │   └── validateAllManifests.js # Validación
│   ├── data/                # Datos estáticos JSON
│   │   └── destination/     # Datos de destinos
│   ├── schemas/             # Esquemas de validación JSON
│   └── scripts/             # Scripts de migración específicos
├── package.json             # Configuración del package
└── README.md               # Documentación
```

### CLI Command Implementation

El CLI del seed package está implementado de forma simple y directa:

```typescript
// packages/seed/src/cli.ts - Implementación real
#!/usr/bin/env node

import { runSeed } from './index.js';

// Parsing básico de argumentos
const args = process.argv.slice(2);

const options = {
    required: args.includes('--required'),
    example: args.includes('--example'),
    reset: args.includes('--reset'),
    migrate: args.includes('--migrate'),
    rollbackOnError: args.includes('--rollbackOnError'),
    continueOnError: args.includes('--continueOnError'),
    exclude: [] as string[]
};

// Parsing de --exclude=entity1,entity2
const excludeArg = args.find((arg) => arg.startsWith('--exclude='));
if (excludeArg) {
    const list = excludeArg.replace('--exclude=', '');
    options.exclude = list.split(',').map((s) => s.trim());
}

// Ejecutar el seed
runSeed(options);
```

**Nota**: No utiliza Commander.js ni framework CLI complejo, sino parsing básico de argumentos.

## 🔄 Workflow Scripts

### Desarrollo Completo

```bash
# 1. Setup inicial
git clone `<repo>`
cd hospeda
pnpm install

# 2. Setup base de datos
pnpm docker:up              # Levantar PostgreSQL y Redis
pnpm db:fresh              # Migrar y seedear

# 3. Desarrollo
pnpm dev                   # Levantar todo en modo dev

# 4. Testing
pnpm test                  # Ejecutar tests
pnpm check                 # Verificar calidad código
```

### Deploy Pipeline

```bash
# 1. Verificación pre-deploy
pnpm check                 # Biome check --write .
pnpm test                  # Tests completos (turbo test)
pnpm build                 # Build de producción (turbo build)

# 2. Deploy específico API
pnpm deploy:api           # Build API + prepare prod + deploy Fly.io
# Equivale a: pnpm build:api && pnpm prepare:api:prod && flyctl deploy

# Scripts individuales del deploy API:
pnpm build:api            # Solo build del API
pnpm prepare:api:prod     # Generar package.json para producción  
```

**Nota**: No hay scripts separados para `pnpm deploy:web` - solo existe `deploy:api`.

### Maintenance Scripts

```bash
# Cleanup de desarrollo
pnpm clean                # Limpiar build artifacts (turbo clean)
# No existe: pnpm reset  

# Database maintenance
# No existen estos scripts específicos:
# pnpm db:validate
# pnpm seed clean
# pnpm seed required

# Scripts reales de maintenance:
pnpm db:reset             # Reset containers + migrate
pnpm db:fresh             # Reset completo con seed
pnpm db:seed              # Re-ejecutar seed completo
```

## 🐳 Docker CLI

### Comandos Docker Compose

```bash
# Servicios principales
docker-compose up -d               # Levantar todos los servicios
docker-compose up -d postgres      # Solo PostgreSQL
docker-compose up -d redis         # Solo Redis

# Management
docker-compose ps                  # Ver estado servicios
docker-compose logs postgres       # Ver logs PostgreSQL
docker-compose stop               # Parar servicios
docker-compose down               # Parar y remover containers

# Troubleshooting
docker-compose down -v            # Remover volumes
docker-compose pull              # Actualizar imágenes
docker-compose restart postgres  # Reiniciar PostgreSQL
```

### Docker para API (Producción)

```bash
# Build imagen (usando Dockerfile.api)
docker build -f Dockerfile.api -t hospeda-api .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  hospeda-api

# Debug container
docker run -it hospeda-api sh
```

**Configuración real**: El contenedor expone puerto 3000 y usa las variables de entorno definidas en el Dockerfile.api.

## 🔍 Debugging y Troubleshooting

### Database Debugging

```bash
# Conectar a PostgreSQL (usando nombres de contenedor reales)
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev

# Comandos de Drizzle (ejecutados desde @repo/db)
cd packages/db
pnpm drizzle-kit drop --config drizzle.config.ts
pnpm drizzle-kit studio --config drizzle.config.ts

# Reset completo de DB (scripts reales)
pnpm db:reset             # docker-compose down -v + up + migrate
pnpm db:fresh             # Versión completa con seed
```

### Development Debugging

```bash
# Ver logs detallados (variable de entorno)
DEBUG=* pnpm dev

# Testing de packages específicos
pnpm --filter @repo/service-core test
pnpm --filter @repo/service-core test:watch
pnpm --filter @repo/service-core test:coverage

# Verificar dependencias
pnpm why <package-name>
pnpm outdated

# No existe: pnpm --filter @repo/service-core test:debug
```

### Performance Profiling

```bash
# Build analysis (no hay script específico de profile)
pnpm build

# Bundle analysis para web
cd apps/web  
pnpm analyze          # astro build --verbose

# Database query profiling
pnpm db:studio        # Drizzle Studio para ver queries en tiempo real

# No existen estos scripts:
# pnpm build --profile
# pnpm analyze (a nivel root)
```

## 📊 Utilidades de Monitoreo

### Health Checks

```bash
# API health (cuando esté ejecutándose)
curl http://localhost:3000/health

# Database connectivity (usando Drizzle Studio)
pnpm db:studio

# No existen estos scripts específicos:
# pnpm db:validate
# pnpm services:status
```

### Logs y Metrics

```bash
# Structured logs (Docker containers)
pnpm db:logs          # docker-compose logs -f postgres

# No existen estos scripts específicos de logs/metrics:
# pnpm logs:api
# pnpm logs:web
# pnpm metrics:collect
# pnpm metrics:report
```

## 🔗 CLI Extensions

### Instalación de Herramientas Adicionales

```bash
# Drizzle Kit global
npm install -g drizzle-kit

# Turbo global
npm install -g turbo

# Docker buildx
docker buildx install
```

### Configuración de Aliases

```bash
# Agregar a ~/.bashrc o ~/.zshrc
alias hdev="pnpm dev"
alias hbuild="pnpm build"
alias htest="pnpm test"
alias hdb="pnpm db:fresh"
alias hseed="pnpm seed"
alias hcheck="pnpm check"
```

## 📚 Recursos CLI

### Documentación de Comandos

- **TurboRepo**: [Documentación oficial](https://turbo.build/repo/docs)
- **Drizzle Kit**: [CLI Reference](https://orm.drizzle.team/kit-docs/overview)
- **Vitest**: [CLI Options](https://vitest.dev/guide/cli.html)
- **Biome**: [CLI Commands](https://biomejs.dev/reference/cli/)

### Scripts de Ayuda

```bash
# Ver todos los scripts disponibles (funciona en cualquier package)
pnpm run

# Ver scripts de un package específico
pnpm --filter @repo/seed run

# Ver configuración de workspace
pnpm config list --global
```
