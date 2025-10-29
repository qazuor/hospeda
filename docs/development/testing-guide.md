# 🧪 Guía de Testing - Hospeda

Esta guía cubre todas las estrategias de testing, scripts disponibles y mejores prácticas para el proyecto Hospeda.

## 📋 Requerimientos Previos

### Obligatorios

#### Node.js y pnpm

```bash
# Verificar versiones mínimas
node --version  # ≥18
pnpm --version  # ≥8.15.6
```

#### Vitest (Incluido en el proyecto)

El framework de testing ya está configurado en todos los packages.

### Opcionales pero Recomendados

#### VS Code con Extensiones

- **Vitest** - Integración con VS Code
- **Test Explorer UI** - Vista de tests en sidebar
- **Coverage Gutters** - Mostrar coverage en el editor

#### Docker (Para tests de integración)

Si planeas ejecutar tests que requieren base de datos:

```bash
# Verificar Docker
docker --version
docker compose --version
```

### Verificación del Entorno de Testing

```bash
# Verificar que Vitest funciona
cd packages/service-core
pnpm test --version

# Verificar factories de testing
cd packages/service-core
ls test/factories/

# Ejecutar test básico
pnpm test --passWithNoTests
```

## 🎯 Estrategia de Testing

### Tipos de Tests

- **Unit Tests**: Servicios, modelos, utilidades
- **Integration Tests**: APIs, bases de datos
- **Schema Tests**: Validación de esquemas Zod
- **Factory Tests**: Generadores de datos de prueba

### Herramientas

- **Vitest**: Framework de testing principal
- **Zod**: Validación de schemas
- **Factories**: Generación de datos de prueba
- **Coverage**: Reporte de cobertura

## 🚀 Ejecución de Tests

### Comandos Principales

```bash
# Todos los tests del monorepo
pnpm test

# Tests en modo watch
pnpm test:watch

# Tests con cobertura
pnpm test:coverage
```

### Por Paquete/App

```bash
# Service Core (más importante)
pnpm --filter @repo/service-core test

# Schemas
pnpm --filter @repo/schemas test

# API
pnpm --filter hospeda-api test

# Database models
pnpm --filter @repo/db test
```

### Tests Específicos

```bash
```bash
# Archivo específico
pnpm --filter @repo/service-core test:file -- accommodation.test.ts

# Con patrón
pnpm --filter @repo/service-core test -- --grep "AccommodationService"

# UI interactiva
pnpm --filter @repo/service-core test:ui
```

```

## 📂 Estructura de Tests

### Service Core (`packages/service-core/test/`)

```text
test/
├── base/                    # Tests de servicios base (sin implementar)
├── crud/                    # Tests de BaseCrudService (sin implementar)
├── factories/              # Factories para datos de prueba ✅
│   ├── accommodationFactory.ts
│   ├── accommodationScenarioFactory.ts
│   ├── actorFactory.ts
│   ├── amenityFactory.ts
│   ├── attractionFactory.ts
│   ├── baseEntityFactory.ts
│   ├── baseServiceFactory.ts
│   ├── destinationFactory.ts
│   ├── eventFactory.ts
│   ├── eventLocationFactory.ts
│   ├── eventOrganizerFactory.ts
│   ├── featureFactory.ts
│   ├── postFactory.ts
│   ├── postSponsorFactory.ts
│   ├── postSponsorshipFactory.ts
│   ├── tagFactory.ts
│   ├── userBookmarkFactory.ts
│   ├── userFactory.ts
│   └── utilsFactory.ts
├── helpers/                # Utilidades de testing
├── services/               # Tests por servicio
│   ├── accommodation/
│   ├── destination/
│   └── user/
├── setupTest.ts           # Setup de tests
└── utils/                 # Utilidades de testing
```

### Schemas (`packages/schemas/test/`)

Estructura de tests para validación de esquemas Zod.

## 🏭 Factories de Datos

### Uso de Factories

```typescript
import { createAccommodationFactory } from '../factories/accommodationFactory';

// Crear accommodation de prueba
const accommodation = createAccommodationFactory();

// Con datos específicos
const accommodation = createAccommodationFactory({
  name: 'Test Hotel',
  type: AccommodationTypeEnum.HOTEL
});
```

### Factories Disponibles

- `accommodationFactory` - Acomodaciones
- `userFactory` - Usuarios
- `postFactory` - Posts
- `tagFactory` - Tags
- `amenityFactory` - Amenidades
- `featureFactory` - Características
- `destinationFactory` - Destinos
- `eventFactory` - Eventos

### Crear Nueva Factory

```typescript
// packages/service-core/test/factories/myEntityFactory.ts
import type { MyEntity } from '@repo/schemas';

export const createMyEntityFactory = (overrides?: Partial<MyEntity>): MyEntity => ({
  id: crypto.randomUUID(),
  name: 'Test Entity',
  description: 'Test description',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});
```

## 🔧 Configuración de Tests

### Vitest Config

```typescript
// packages/service-core/vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html'],
      exclude: ['test/**', 'dist/**']
    }
  }
});
```

### Setup de Tests

```typescript
// test/setup.ts
import { beforeEach } from 'vitest';
import { resetAllMocks } from './utils/mocks';

beforeEach(() => {
  resetAllMocks();
});
```

## 🎪 Testing de Servicios

### Estructura Típica

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { AccommodationService } from '../../src/services/accommodation';
import { createAccommodationFactory } from '../factories/accommodationFactory';
import { createMockUserActor } from '../utils/actor';

describe('AccommodationService', () => {
  let service: AccommodationService;
  let actor: Actor;

  beforeEach(() => {
    service = createServiceTestInstance(AccommodationService);
    actor = createMockUserActor();
  });

  describe('create', () => {
    test('should create accommodation successfully', async () => {
      // Arrange
      const input = createAccommodationFactory();
      
      // Act
      const result = await service.create(actor, input);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(input.name);
    });

    test('should fail with invalid input', async () => {
      // Arrange
      const invalidInput = { name: '' };
      
      // Act & Assert
      await expect(service.create(actor, invalidInput))
        .rejects
        .toThrow('Validation error');
    });
  });
});
```

### Patrones Comunes

#### Test de CRUD Completo

```typescript
describe('CRUD Operations', () => {
  test('should create, read, update, delete', async () => {
    // Create
    const input = createEntityFactory();
    const created = await service.create(actor, input);
    
    // Read
    const found = await service.getById(actor, { id: created.data.id });
    expect(found.data).toEqual(created.data);
    
    // Update
    const updateInput = { name: 'Updated Name' };
    const updated = await service.update(actor, { 
      id: created.data.id, 
      ...updateInput 
    });
    expect(updated.data.name).toBe('Updated Name');
    
    // Delete
    await service.softDelete(actor, { id: created.data.id });
    const deleted = await service.getById(actor, { id: created.data.id });
    expect(deleted.data.deletedAt).toBeDefined();
  });
});
```

#### Test de Permisos

```typescript
describe('Permissions', () => {
  test('should allow admin to create', async () => {
    const adminActor = createMockAdminActor();
    const input = createEntityFactory();
    
    const result = await service.create(adminActor, input);
    expect(result.success).toBe(true);
  });

  test('should deny guest to create', async () => {
    const guestActor = createMockGuestActor();
    const input = createEntityFactory();
    
    await expect(service.create(guestActor, input))
      .rejects
      .toThrow('Insufficient permissions');
  });
});
```

#### Test de Relaciones

```typescript
describe('Relations', () => {
  test('should add amenity to accommodation', async () => {
    // Arrange
    const accommodation = await service.create(actor, createAccommodationFactory());
    const amenity = await amenityService.create(actor, createAmenityFactory());
    
    // Act
    await service.addAmenityToAccommodation(actor, {
      accommodationId: accommodation.data.id,
      amenityId: amenity.data.id
    });
    
    // Assert
    const amenities = await service.getAmenitiesForAccommodation(actor, {
      accommodationId: accommodation.data.id
    });
    expect(amenities.data).toHaveLength(1);
    expect(amenities.data[0].id).toBe(amenity.data.id);
  });
});
```

## 📊 Testing de Schemas

### Validación Exitosa

```typescript
import { describe, test, expect } from 'vitest';
import { AccommodationCreateInputSchema } from '@repo/schemas';

describe('AccommodationCreateInputSchema', () => {
  test('should validate correct input', () => {
    const input = {
      name: 'Test Hotel',
      description: 'A nice hotel',
      type: 'HOTEL',
      destinationId: crypto.randomUUID()
    };

    const result = AccommodationCreateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  test('should reject invalid input', () => {
    const input = {
      name: '', // Empty name should fail
      type: 'INVALID_TYPE'
    };

    const result = AccommodationCreateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error.issues).toHaveLength(2);
  });
});
```

### Fixtures de Testing

```typescript
// packages/schemas/test/fixtures/accommodation.fixtures.ts
export const validAccommodationInput = {
  name: 'Hotel Test',
  description: 'Un hotel de prueba',
  type: AccommodationTypeEnum.HOTEL,
  destinationId: crypto.randomUUID(),
  address: {
    street: 'Calle Test 123',
    city: 'Ciudad Test',
    province: 'Provincia Test',
    country: 'Argentina'
  }
};

export const invalidAccommodationInputs = [
  { ...validAccommodationInput, name: '' },
  { ...validAccommodationInput, type: 'INVALID' },
  { ...validAccommodationInput, destinationId: 'not-uuid' }
];
```

## 📈 Coverage y Reportes

### Generar Reportes

```bash
# Coverage completo
pnpm test:coverage

# Solo service-core
pnpm --filter @repo/service-core test:coverage

# Ver reporte HTML
open packages/service-core/coverage/index.html
```

### Configurar Umbrales

```typescript
// vitest.config.ts (configuración real de service-core)
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: false,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/']
        }
    }
});
```

## 🐛 Debugging Tests

### Modo Debug

```bash
# Tests con logs detallados (no hay test:debug específico)
DEBUG=true pnpm test

# Vitest UI mode (disponible en apps/web y apps/admin)
cd apps/web
pnpm test:ui
```

### Tips de Debugging

1. **Usar console.log temporalmente**
2. **Breakpoints en VS Code**
3. **Test específico con `.only`**
4. **Verificar datos de factories**

```typescript
test.only('debug this specific test', async () => {
  const data = createEntityFactory();
  console.log('Factory data:', data);
  
  const result = await service.create(actor, data);
  console.log('Service result:', result);
  
  expect(result.success).toBe(true);
});
```

## 🎯 Mejores Prácticas

### Estructura de Tests

1. **Arrange-Act-Assert**: Estructura clara
2. **Descriptive names**: Nombres descriptivos
3. **Single responsibility**: Un concepto por test
4. **Independent tests**: Tests independientes

### Datos de Prueba

1. **Use factories**: Para datos consistentes
2. **Realistic data**: Datos realistas
3. **Edge cases**: Casos límite
4. **Invalid data**: Datos inválidos

### Mocking

1. **Mock external dependencies**: APIs, bases de datos
2. **Don't mock what you test**: No hacer mock del código bajo prueba
3. **Reset mocks**: Limpiar entre tests

### Performance

1. **Parallel execution**: Ejecución paralela
2. **Test isolation**: Aislamiento de tests
3. **Fast feedback**: Feedback rápido

## 🔧 Scripts Útiles

### Por Paquete (Scripts Reales)

```bash
# Service Core
cd packages/service-core
pnpm test                    # vitest run --passWithNoTests
pnpm test:watch             # vitest  
pnpm test:coverage          # vitest run --coverage
pnpm test:file              # vitest run --passWithNoTests

# Schemas
cd packages/schemas  
pnpm test                   # vitest run --passWithNoTests

# Database
cd packages/db
pnpm test                   # vitest run --passWithNoTests

# API
cd apps/api
pnpm test                   # vitest run --passWithNoTests
pnpm test:watch             # vitest
pnpm test:coverage          # vitest run --coverage

# Web
cd apps/web  
pnpm test                   # vitest run --passWithNoTests
pnpm test:ui                # vitest --ui

# Admin
cd apps/admin
pnpm test                   # vitest run --passWithNoTests  
pnpm test:ui                # vitest --ui
```

### Filtros Útiles

```bash
# Por patrón de archivo
pnpm test -- accommodation

# Por nombre de test
pnpm test -- --grep "should create"

# Tests modificados
pnpm test -- --changed

# Tests relacionados
pnpm test -- --related src/services/accommodation.service.ts
```

## 🔗 Enlaces Útiles

- [Vitest Docs](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Zod Testing](https://zod.dev/)
