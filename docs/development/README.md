# 🚀 Guía de Desarrollo - Hospeda

Esta guía cubre todos los aspectos del desarrollo en el monorepo Hospeda, incluyendo configuración inicial, scripts disponibles y flujos de trabajo.

## 📋 Requerimientos Previos

Antes de comenzar, asegúrate de tener instaladas las siguientes herramientas:

### Requerimientos Obligatorios

#### Node.js (≥18)

```bash
# Verificar versión
node --version  # Debe ser ≥18

# Instalación en Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalación en macOS
brew install node

# Instalación en Windows
# Descargar desde: https://nodejs.org/
```

#### pnpm (≥8.15.6)

```bash
# Instalación global
npm install -g pnpm@8.15.6

# Verificar instalación
pnpm --version  # Debe ser ≥8.15.6

# Alternativa con corepack (recomendado)
corepack enable
corepack prepare pnpm@8.15.6 --activate
```

#### Docker y Docker Compose

Para desarrollo local con PostgreSQL y Redis:

**Ubuntu/Debian:**

```bash
# Instalar Docker
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker

# Verificar instalación
docker --version
docker compose version
```

**macOS:**

```bash
# Instalar Docker Desktop
brew install --cask docker

# O descargar desde: https://www.docker.com/products/docker-desktop
```

**Windows:**

```bash
# Descargar Docker Desktop desde: https://www.docker.com/products/docker-desktop
# Asegúrate de tener WSL2 habilitado
```

#### Git

```bash
# Ubuntu/Debian
sudo apt-get install git

# macOS
brew install git

# Windows
# Descargar desde: https://git-scm.com/downloads

# Verificar instalación
git --version
```

### Requerimientos Opcionales

#### VS Code (Recomendado)

```bash
# Ubuntu/Debian
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
sudo apt update
sudo apt install code

# macOS
brew install --cask visual-studio-code

# Windows
# Descargar desde: https://code.visualstudio.com/
```

#### Extensiones VS Code Recomendadas

- **Biome** - Linting y formateo
- **TypeScript Importer** - Auto-import para TypeScript
- **Thunder Client** - Testing de APIs
- **Docker** - Gestión de contenedores
- **PostgreSQL** - Gestión de base de datos

### Verificación de Instalación

Ejecuta los siguientes comandos para verificar que todo está instalado correctamente:

```bash
# Verificar versiones
node --version     # ≥18
pnpm --version     # ≥8.15.6
docker --version  # ≥20.10
git --version     # Cualquier versión reciente

# Verificar que Docker está ejecutándose
docker run hello-world

# Verificar que Docker Compose funciona
docker compose --version
```

## 📋 Tabla de Contenidos

- [Configuración Inicial](#configuración-inicial)
- [Scripts del Monorepo](#scripts-del-monorepo)
- [Base de Datos](#base-de-datos)
- [Seeds y Datos de Ejemplo](#seeds-y-datos-de-ejemplo)
- [Docker y Despliegue](#docker-y-despliegue)
- [Testing](#testing)
- [Herramientas de TODO](#herramientas-de-todo)

---

## 🔧 Configuración Inicial

### Prerrequisitos

- **Node.js** >= 18
- **pnpm** >= 8.15.6
- **Docker** y **Docker Compose**
- **PostgreSQL** (opcional si usas Docker)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/qazuor/hospeda.git
cd hospeda

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus configuraciones
```

---

## 📦 Scripts del Monorepo

### 🔨 Desarrollo General

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Inicia todos los servicios en modo desarrollo |
| `pnpm dev:admin` | Inicia solo el panel de administración |
| `pnpm build` | Construye todos los paquetes |
| `pnpm clean` | Limpia node_modules y dist de todos los paquetes |
| `pnpm typecheck` | Verifica tipos en todo el monorepo |

### 🎨 Código y Calidad

| Script | Descripción |
|--------|-------------|
| `pnpm lint` | Ejecuta linting en todos los paquetes |
| `pnpm format` | Formatea código con Biome |
| `pnpm check` | Ejecuta Biome check con auto-fix |

### 🧪 Testing

| Script | Descripción |
|--------|-------------|
| `pnpm test` | Ejecuta todos los tests |
| `pnpm test:watch` | Ejecuta tests en modo watch |
| `pnpm test:coverage` | Genera reporte de cobertura |

---

## 🗄️ Base de Datos

### 🚀 Inicio Rápido de Base de Datos

**Para crear y poblar la base de datos desde cero:**

```bash
# Opción 1: Con sudo (recomendado)
pnpm db:fresh

# Opción 2: Sin sudo
pnpm db:fresh-no-sudo
```

Este comando:

1. Destruye contenedores y volúmenes existentes
2. Levanta PostgreSQL y Redis
3. Genera migraciones
4. Aplica migraciones
5. Ejecuta seeds (datos requeridos + ejemplos)

### 📊 Scripts de Base de Datos

#### Gestión de Contenedores

| Script | Descripción |
|--------|-------------|
| `pnpm db:start` | Inicia PostgreSQL y Redis |
| `pnpm db:stop` | Detiene PostgreSQL y Redis |
| `pnpm db:restart` | Reinicia PostgreSQL y Redis |
| `pnpm db:logs` | Muestra logs de PostgreSQL |

#### Migraciones

| Script | Descripción |
|--------|-------------|
| `pnpm db:generate` | Genera nuevas migraciones |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:reset` | Resetea DB (borra datos, mantiene estructura) |

#### Herramientas

| Script | Descripción |
|--------|-------------|
| `pnpm db:studio` | Abre Drizzle Studio (GUI para DB) |
| `pnpm pgadmin:start` | Inicia pgAdmin (interfaz web) |
| `pnpm pgadmin:stop` | Detiene pgAdmin |

### 🔗 Conexiones de Base de Datos

- **PostgreSQL**: `localhost:5432`
  - Database: `hospeda_dev`
  - Usuario: `hospeda_user`
  - Contraseña: `hospeda_pass`

- **pgAdmin**: `http://localhost:8080`
  - Email: `admin@example.com`
  - Contraseña: `admin123`

- **Drizzle Studio**: Se abre automáticamente en el navegador

---

## 🌱 Seeds y Datos de Ejemplo

### 🎯 Scripts de Seeding

| Script | Descripción |
|--------|-------------|
| `pnpm db:seed` | Ejecuta todos los seeds (requeridos + ejemplos) |
| `pnpm --filter @repo/seed seed --help` | Muestra ayuda del CLI de seeds |

### 📝 Opciones del CLI de Seeds

```bash
# Seed completo (recomendado para desarrollo)
pnpm --filter @repo/seed seed --reset --required --example

# Solo datos requeridos (usuarios, roles, permisos)
pnpm --filter @repo/seed seed --reset --required

# Solo datos de ejemplo
pnpm --filter @repo/seed seed --example

# Seed específico
pnpm --filter @repo/seed seed --entity=accommodations
```

### 🗂️ Tipos de Datos

- **Required**: Usuarios admin, roles, permisos, amenidades básicas
- **Example**: Acomodaciones, destinos, eventos, reseñas, posts

---

## 🐳 Docker y Despliegue

### 🏗️ Construcción de API

```bash
# Preparar API para producción
pnpm build:api
pnpm prepare:api:prod

# Construir imagen Docker
docker build -f Dockerfile.api -t hospeda-api .

# Ejecutar contenedor
docker run -p 3000:3000 hospeda-api
```

### 🚀 Despliegue en Fly.io

```bash
# Desplegar API completa
pnpm deploy:api
```

Este comando:

1. Construye la API
2. Prepara package.json para producción
3. Despliega en Fly.io

### 🌐 URLs de Servicios

- **API**: `http://localhost:3000`
- **Web**: `http://localhost:4321`
- **Admin**: `http://localhost:3000` (TanStack Start)

---

## 🧪 Testing

### 📋 Scripts por Paquete

Cada paquete tiene sus propios scripts de testing:

```bash
# API
cd apps/api
pnpm test
pnpm test:watch
pnpm test:coverage

# Service Core
cd packages/service-core
pnpm test
pnpm test:coverage

# Schemas
cd packages/schemas
pnpm test
```

### 🎯 Testing Específico

```bash
# Test específico por archivo
pnpm --filter @repo/service-core test:file -- accommodation.test.ts

# Test con interfaz UI
pnpm --filter @repo/service-core test:ui
```

---

## ✅ Herramientas de TODO

### 🔧 Scripts de TODO Linear

| Script | Descripción |
|--------|-------------|
| `pnpm todo:setup` | Configura integración con Linear |
| `pnpm todo:sync` | Sincroniza TODOs con Linear |
| `pnpm todo:sync:verbose` | Sincronización con logs detallados |
| `pnpm todo:watch` | Vigilancia continua de TODOs |
| `pnpm todo:clean` | Limpia TODOs obsoletos |

---

## 🔄 Flujo de Trabajo Completo

### 🎬 Empezar a Desarrollar

```bash
# 1. Configurar base de datos
pnpm db:fresh

# 2. Iniciar servicios
pnpm dev

# 3. Verificar que todo funciona
pnpm test
```

### 🔄 Desarrollo Diario

```bash
# Iniciar base de datos
pnpm db:start

# Desarrollar
pnpm dev

# Al terminar
pnpm db:stop
```

### 🚀 Preparar para Producción

```bash
# 1. Verificar calidad de código
pnpm check
pnpm typecheck

# 2. Ejecutar todos los tests
pnpm test

# 3. Construir para producción
pnpm build

# 4. Desplegar API (si es necesario)
pnpm deploy:api
```

---

## 🔍 Troubleshooting

### Problemas Comunes

**Base de datos no se conecta:**

```bash
pnpm db:restart
pnpm db:logs
```

**Errores de permisos de Docker:**

```bash
# Usar versión con sudo
pnpm db:fresh
```

**Cache de build corrupto:**

```bash
pnpm clean
pnpm build
```

---

## 📚 Guías Especializadas

### Guías Detalladas

- **[🗄️ Database Setup Guide](./database-setup.md)** - Setup completo de base de datos, migraciones y seeding
- **[🐳 Docker & Deployment Guide](./docker-deployment.md)** - Configuración Docker y deployment en Fly.io
- **[🧪 Testing Guide](./testing-guide.md)** - Estrategias de testing, factories y mejores prácticas
- **[🛠️ CLI & Utilities Guide](./cli-utilities.md)** - Herramientas CLI, scripts y utilidades del monorepo

### Documentación Técnica

- **[🏗️ Architecture Overview](../architecture/README.md)** - Arquitectura general del sistema
- **[📡 API Documentation](../api/)** - Documentación de APIs y endpoints
- **[🔧 Services Documentation](../services/)** - Servicios y lógica de negocio

**Seeds fallan:**

```bash
# Resetear completamente la DB
pnpm db:fresh
```

---

## 📞 Soporte

- **Issues**: [GitHub Issues](https://github.com/qazuor/hospeda/issues)
- **Email**: <qazuor@gmail.com>
- **Documentación**: Ver carpeta `/docs`
