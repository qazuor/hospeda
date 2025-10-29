# 🗄️ Guía de Setup de Base de Datos - Hospeda

Esta guía cubre la configuración completa de la base de datos PostgreSQL, Redis, migraciones con Drizzle ORM y herramientas de gestión.

## 📋 Requerimientos Previos

### Obligatorios para Desarrollo Local

#### Docker y Docker Compose

La base de datos PostgreSQL y Redis se ejecutan en contenedores Docker:

**Verificar instalación:**

```bash
docker --version       # ≥20.10
docker compose version # ≥2.0
```

**Si no tienes Docker instalado:**

- **Ubuntu/Debian**: Ver [guía principal](./README.md#docker-y-docker-compose)
- **macOS**: `brew install --cask docker`
- **Windows**: Descargar Docker Desktop

#### Node.js y pnpm

Para ejecutar comandos de Drizzle y seeds:

```bash
node --version  # ≥18
pnpm --version  # ≥8.15.6
```

### Verificar Configuración

```bash
# Verificar que Docker está ejecutándose
docker info

# Verificar acceso a comandos de Drizzle
cd packages/db
pnpm drizzle-kit --version
```

## 🚀 Inicio Rápido

### Opción 1: Configuración Completa (Recomendada)

```bash
# Un solo comando para todo
pnpm db:fresh
```

### Opción 2: Paso a Paso

```bash
# 1. Iniciar contenedores
pnpm db:start

# 2. Generar migraciones (si es necesario)
pnpm db:generate

# 3. Aplicar migraciones
pnpm db:migrate

# 4. Poblar con datos
pnpm db:seed
```

## 📋 Pasos Detallados

### 1. 🐳 Iniciar Servicios de Base de Datos

```bash
# Iniciar PostgreSQL y Redis
pnpm db:start
```

**Que hace esto:**

- Levanta PostgreSQL en puerto 5432
- Levanta Redis en puerto 6379
- Crea volúmenes persistentes
- Ejecuta healthchecks

**Verificar que funcionó:**

```bash
# Ver logs
pnpm db:logs

# Ver contenedores
docker ps
```

### 2. 🔧 Generar Migraciones

```bash
# Solo si hay cambios en schemas
pnpm db:generate
```

**Cuando usar:**

- Después de modificar archivos en `packages/db/src/schemas/`
- Cuando agregues nuevas tablas o campos
- Al cambiar relaciones entre tablas

### 3. 📊 Aplicar Migraciones

```bash
# Aplicar cambios a la base de datos
pnpm db:migrate
```

**Que hace:**

- Lee archivos de migración generados
- Aplica cambios a PostgreSQL
- Actualiza estructura de tablas

### 4. 🌱 Poblar con Datos (Seeds)

```bash
# Opción completa (recomendada para desarrollo)
pnpm db:seed

# O usar el CLI directamente
pnpm --filter @repo/seed seed --reset --required --example
```

**Tipos de datos que se crean:**

**Datos Requeridos:**

- Usuario super administrador
- Roles y permisos del sistema
- Amenidades básicas (WiFi, Parking, etc.)
- Características básicas (Vista al mar, etc.)
- Atracciones principales

**Datos de Ejemplo:**

- Acomodaciones de prueba
- Destinos turísticos
- Eventos y organizadores
- Reseñas y calificaciones
- Posts de blog
- Bookmarks de usuarios

## 🔧 Gestión Diaria

### Iniciar/Detener Base de Datos

```bash
# Iniciar
pnpm db:start

# Detener
pnpm db:stop

# Reiniciar
pnpm db:restart
```

### Resetear Base de Datos

```bash
# Resetear manteniendo volúmenes
pnpm db:reset

# Resetear completamente (borra todo)
pnpm db:fresh
```

## 🛠️ Herramientas de Administración

### Drizzle Studio (Recomendado)

```bash
# Abrir interfaz web
pnpm db:studio
```

**Características:**

- Interfaz moderna y rápida
- Edición en tiempo real
- Explorador de relaciones
- Consultas SQL

### pgAdmin (Alternativa)

```bash
# Iniciar pgAdmin
pnpm pgadmin:start

# Acceder en: http://localhost:8080
# Email: admin@example.com
# Password: admin123
```

## 📊 Información de Conexión

### PostgreSQL

```
Host: localhost
Port: 5432
Database: hospeda_dev
Username: hospeda_user
Password: hospeda_pass
```

### URL de Conexión

```
postgresql://hospeda_user:hospeda_pass@localhost:5432/hospeda_dev
```

### Redis

```
Host: localhost
Port: 6379
No password
```

## 🔍 Solución de Problemas

### Error: Puerto 5432 en uso

```bash
# Ver que está usando el puerto
sudo lsof -i :5432

# Detener servicio local de PostgreSQL
sudo systemctl stop postgresql

# O cambiar puerto en docker-compose.yml
```

### Error: Permisos de Docker

```bash
# Usar sudo
sudo pnpm db:fresh

# O agregar usuario a grupo docker
sudo usermod -aG docker $USER
# Logout y login
```

### Error: Contenedor no inicia

```bash
# Ver logs detallados
docker logs hospeda_postgres

# Limpiar volúmenes
docker-compose down -v
pnpm db:fresh
```

### Error: Seeds fallan

```bash
# Verificar que la DB esté disponible
pnpm db:logs

# Resetear completamente
pnpm db:fresh

# Ejecutar seeds paso a paso
pnpm --filter @repo/seed seed --required
pnpm --filter @repo/seed seed --example
```

### Error: Migraciones fallan

```bash
# Ver estado de migraciones
pnpm --filter @repo/db db:studio

# Regenerar migraciones
pnpm --filter @repo/db db:regenerate

# Aplicar manualmente
pnpm db:migrate
```

## 🔄 Flujos de Trabajo

### Desarrollo Diario

```bash
# Al empezar
pnpm db:start

# Al terminar
pnpm db:stop
```

### Cambios en Esquemas

```bash
# 1. Modificar archivos en packages/db/src/schemas/
# 2. Generar migración
pnpm db:generate

# 3. Aplicar cambios
pnpm db:migrate

# 4. Verificar en Drizzle Studio
pnpm db:studio
```

### Reset Completo

```bash
# Cuando algo va mal
pnpm db:fresh
```

### Backup de Datos

```bash
# Crear backup
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev > backup.sql

# Restaurar backup
docker exec -i hospeda_postgres psql -U hospeda_user hospeda_dev < backup.sql
```

## 📈 Monitoreo

### Verificar Estado

```bash
# Healthcheck de contenedores
docker ps

# Logs en tiempo real
pnpm db:logs

# Conexión directa
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev
```

### Métricas de Uso

```bash
# Espacio usado por la DB
docker exec hospeda_postgres du -sh /var/lib/postgresql/data

# Estadísticas de tablas (en psql)
\dt+
```

## 🎯 Tips y Mejores Prácticas

1. **Siempre usa `pnpm db:fresh` cuando empieces un nuevo feature**
2. **Crea backups antes de cambios importantes**
3. **Usa Drizzle Studio para explorar datos**
4. **Revisa logs si algo no funciona**
5. **Mantén las migraciones pequeñas y específicas**
6. **Usa seeds para tener datos consistentes**
7. **No edites datos requeridos manualmente**

## 🔗 Enlaces Útiles

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
