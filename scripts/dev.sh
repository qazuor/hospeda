#!/bin/bash
# Script para ejecutar hospeda en modo desarrollo
# Verifica y levanta los servicios Docker si es necesario

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_ENV_FILE="$PROJECT_DIR/docker/.env"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Cargar variables de entorno de docker/.env si existe
if [ -f "$DOCKER_ENV_FILE" ]; then
    export $(grep -v '^#' "$DOCKER_ENV_FILE" | xargs)
fi

# Valores por defecto
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-hospeda}"
POSTGRES_PORT="${POSTGRES_PORT:-5436}"
REDIS_PORT="${REDIS_PORT:-6381}"

POSTGRES_CONTAINER="${PROJECT_NAME}-postgres"
REDIS_CONTAINER="${PROJECT_NAME}-redis"

echo -e "${BLUE}🔍 Verificando servicios Docker para ${CYAN}${PROJECT_NAME}${NC}..."
echo -e "   PostgreSQL: puerto ${POSTGRES_PORT}"
echo -e "   Redis: puerto ${REDIS_PORT}"
echo ""

# Función para verificar si un contenedor está corriendo
check_container() {
    docker ps --format '{{.Names}}' | grep -q "^$1$"
}

# Función para verificar si un puerto está en uso
check_port() {
    local port=$1
    if command -v ss &> /dev/null; then
        ss -tuln | grep -q ":$port "
    elif command -v netstat &> /dev/null; then
        netstat -tuln | grep -q ":$port "
    else
        lsof -i ":$port" &> /dev/null
    fi
}

# Función para esperar que PostgreSQL esté listo
wait_for_postgres() {
    echo -e "${YELLOW}⏳ Esperando a que PostgreSQL esté listo...${NC}"
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec "$POSTGRES_CONTAINER" pg_isready -U "${POSTGRES_USER:-hospeda_user}" -d "${POSTGRES_DB:-hospeda_dev}" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL está listo${NC}"
            return 0
        fi
        echo -e "   Intento $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ PostgreSQL no respondió después de $max_attempts intentos${NC}"
    return 1
}

# Función para esperar que Redis esté listo
wait_for_redis() {
    echo -e "${YELLOW}⏳ Esperando a que Redis esté listo...${NC}"
    local max_attempts=15
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec "$REDIS_CONTAINER" redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis está listo${NC}"
            return 0
        fi
        echo -e "   Intento $attempt/$max_attempts..."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ Redis no respondió después de $max_attempts intentos${NC}"
    return 1
}

# Verificar si Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está corriendo. Por favor inicia Docker primero.${NC}"
    exit 1
fi

# Verificar conflictos de puertos antes de levantar
POSTGRES_RUNNING=$(check_container "$POSTGRES_CONTAINER" && echo "yes" || echo "no")
REDIS_RUNNING=$(check_container "$REDIS_CONTAINER" && echo "yes" || echo "no")

if [ "$POSTGRES_RUNNING" = "no" ]; then
    if check_port "$POSTGRES_PORT"; then
        echo -e "${RED}❌ El puerto $POSTGRES_PORT ya está en uso por otro proceso${NC}"
        echo -e "   Posibles soluciones:"
        echo -e "   1. Cambiar POSTGRES_PORT en docker/.env"
        echo -e "   2. Detener el proceso que usa el puerto: ${YELLOW}lsof -i :$POSTGRES_PORT${NC}"
        exit 1
    fi
fi

if [ "$REDIS_RUNNING" = "no" ]; then
    if check_port "$REDIS_PORT"; then
        echo -e "${RED}❌ El puerto $REDIS_PORT ya está en uso por otro proceso${NC}"
        echo -e "   Posibles soluciones:"
        echo -e "   1. Cambiar REDIS_PORT en docker/.env"
        echo -e "   2. Detener el proceso que usa el puerto: ${YELLOW}lsof -i :$REDIS_PORT${NC}"
        exit 1
    fi
fi

# Levantar contenedores si es necesario
if [ "$POSTGRES_RUNNING" = "no" ] || [ "$REDIS_RUNNING" = "no" ]; then
    echo -e "${YELLOW}📦 Levantando servicios Docker...${NC}"
    cd "$PROJECT_DIR"
    docker compose --env-file docker/.env up -d postgres redis

    # Esperar a que los servicios estén listos
    wait_for_postgres
    wait_for_redis
else
    echo -e "${GREEN}✅ PostgreSQL ya está corriendo ($POSTGRES_CONTAINER)${NC}"
    echo -e "${GREEN}✅ Redis ya está corriendo ($REDIS_CONTAINER)${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Iniciando servidores de desarrollo...${NC}"
echo ""

# Ejecutar el script dev-all.js existente con los argumentos pasados
cd "$PROJECT_DIR"
node scripts/dev-all.js "$@"
