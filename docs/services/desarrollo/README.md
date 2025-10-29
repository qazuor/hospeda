# Guía de Desarrollo de Servicios

## 📋 Índice

- [Introducción](#introducción)
- [Arquitectura Interna](#arquitectura-interna)
- [Crear un Nuevo Servicio](#crear-un-nuevo-servicio)
- [Patrones y Convenciones](#patrones-y-convenciones)
- [Validación y Permisos](#validación-y-permisos)
- [Testing](#testing)
- [Mejores Prácticas](#mejores-prácticas)

## 🎯 Introducción

Esta guía está dirigida a desarrolladores que necesitan **crear nuevos servicios** o **modificar servicios existentes** en Hospeda. Aquí encontrarás toda la información técnica necesaria para mantener la consistencia y calidad de la arquitectura de servicios.

## 🏗️ Arquitectura Interna

### Estructura de Capas

```text
┌─────────────────┐
│   API Routes    │  ← Capa de presentación (Hono routes)
├─────────────────┤
│    Services     │  ← Lógica de negocio (este layer)
├─────────────────┤
│     Models      │  ← Acceso a datos (Drizzle ORM)
├─────────────────┤
│   Database      │  ← PostgreSQL
└─────────────────┘
```

### Componentes Core del Service Layer

#### 1. BaseCrudService

Clase base que proporciona operaciones CRUD estándar:

```typescript
abstract class BaseCrudService<
    TEntity,
    TModel extends BaseModel<TEntity>,
    TCreateSchema,
    TUpdateSchema,
    TSearchSchema
> {
    protected constructor(
        protected ctx: ServiceContext,
        protected model: TModel
    ) {}

    // Métodos CRUD base
    async create(actor: Actor, input: TCreateSchema): Promise<ServiceResult<TEntity>>
    async getById(actor: Actor, id: string): Promise<ServiceResult<TEntity>>
    async update(actor: Actor, id: string, input: TUpdateSchema): Promise<ServiceResult<TEntity>>
    async softDelete(actor: Actor, id: string): Promise<ServiceResult<void>>
    // ... más métodos
}
```

#### 2. ServiceContext

Proporciona acceso a recursos compartidos:

```typescript
interface ServiceContext {
    db: Database;           // Instancia de Drizzle
    logger: Logger;         // Logger configurado
    config: Config;         // Configuración de la app
}
```

#### 3. Actor System

Sistema de autenticación y autorización:

```typescript
interface Actor {
    id: string;
    role: UserRole;
    permissions: Permission[];
    email?: string;
    isAuthenticated: boolean;
}
```

#### 4. ServiceResult

Tipo de respuesta estandarizado:

```typescript
type ServiceResult<T> = {
    data?: T;
    error?: ServiceError;
}

interface ServiceError {
    code: ServiceErrorCode;
    message: string;
    details?: unknown;
}
```

## 🔨 Crear un Nuevo Servicio

### Paso 1: Definir los Tipos

En `packages/types/src/{entity}/`:

```typescript
// packages/types/src/example/example.types.ts
export interface Example {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface ExampleCreateInput {
    name: string;
    description: string;
    isActive?: boolean;
}

export interface ExampleUpdateInput {
    name?: string;
    description?: string;
    isActive?: boolean;
}

export interface ExampleSearchInput {
    q?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}
```

### Paso 2: Crear los Schemas Zod

En `packages/schemas/src/{entity}/`:

```typescript
// packages/schemas/src/example/example.schema.ts
import { z } from 'zod';

export const ExampleCreateInputSchema = z.object({
    name: z.string()
        .min(1, 'zodError.example.name.required')
        .max(100, 'zodError.example.name.maxLength'),
    description: z.string()
        .min(10, 'zodError.example.description.minLength')
        .max(500, 'zodError.example.description.maxLength'),
    isActive: z.boolean().optional().default(true)
});

export const ExampleUpdateInputSchema = ExampleCreateInputSchema.partial();

export const ExampleSearchInputSchema = z.object({
    q: z.string().optional(),
    isActive: z.boolean().optional(),
    page: z.number().min(1).optional().default(1),
    pageSize: z.number().min(1).max(100).optional().default(20)
});

export type ExampleCreateInput = z.infer<typeof ExampleCreateInputSchema>;
export type ExampleUpdateInput = z.infer<typeof ExampleUpdateInputSchema>;
export type ExampleSearchInput = z.infer<typeof ExampleSearchInputSchema>;
```

### Paso 3: Crear el Schema de Base de Datos

En `packages/db/src/schemas/{entity}/`:

```typescript
// packages/db/src/schemas/example/example.schema.ts
import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const exampleTable = pgTable('examples', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    name: text('name').notNull(),
    description: text('description').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

export type ExampleRow = typeof exampleTable.$inferSelect;
export type ExampleInsert = typeof exampleTable.$inferInsert;
```

### Paso 4: Crear el Model

En `packages/db/src/models/{entity}.model.ts`:

```typescript
// packages/db/src/models/example.model.ts
import { BaseModel } from '../base/base.model.js';
import { exampleTable, type ExampleRow } from '../schemas/example/example.schema.js';
import type { Example, ExampleSearchInput } from '@repo/types/example';

export class ExampleModel extends BaseModel<Example> {
    protected table = exampleTable;
    protected entityName = 'example';

    // Override findAll para búsqueda personalizada
    async findAll(options: ExampleSearchInput = {}) {
        const { q, isActive, page = 1, pageSize = 20 } = options;
        
        let query = this.db
            .select()
            .from(this.table)
            .where(isNull(this.table.deletedAt));

        // Búsqueda por texto
        if (q) {
            query = query.where(
                or(
                    ilike(this.table.name, `%${q}%`),
                    ilike(this.table.description, `%${q}%`)
                )
            );
        }

        // Filtro por estado
        if (typeof isActive === 'boolean') {
            query = query.where(eq(this.table.isActive, isActive));
        }

        // Paginación
        const offset = (page - 1) * pageSize;
        query = query.limit(pageSize).offset(offset);

        return query;
    }
}
```

### Paso 5: Crear el Service

En `packages/service-core/src/services/{entity}/{entity}.service.ts`:

```typescript
// packages/service-core/src/services/example/example.service.ts
import { BaseCrudService } from '../../base/crud.service.js';
import { ExampleModel } from '@repo/db/models/example.model';
import { runWithLoggingAndValidation } from '../../utils/service-logger.js';
import type { ServiceContext } from '../../types/service.types.js';
import type { 
    Example, 
    ExampleCreateInput, 
    ExampleUpdateInput, 
    ExampleSearchInput 
} from '@repo/types/example';

export class ExampleService extends BaseCrudService<
    Example,
    ExampleModel,
    ExampleCreateInput,
    ExampleUpdateInput,
    ExampleSearchInput
> {
    constructor(
        ctx: ServiceContext,
        model: ExampleModel = new ExampleModel(ctx.db)
    ) {
        super(ctx, model);
    }

    // Métodos de negocio específicos
    async activate(actor: Actor, id: string) {
        return runWithLoggingAndValidation(
            'example.activate',
            { id },
            actor,
            async () => {
                // Validar permisos
                if (!actor.permissions.includes('EXAMPLE_EDIT')) {
                    return this.forbidden();
                }

                // Buscar entidad
                const example = await this.model.findById(id);
                if (!example) {
                    return this.notFound('Example not found');
                }

                // Actualizar estado
                const updated = await this.model.update(id, { isActive: true });
                return this.success(updated);
            }
        );
    }

    async deactivate(actor: Actor, id: string) {
        return runWithLoggingAndValidation(
            'example.deactivate',
            { id },
            actor,
            async () => {
                if (!actor.permissions.includes('EXAMPLE_EDIT')) {
                    return this.forbidden();
                }

                const example = await this.model.findById(id);
                if (!example) {
                    return this.notFound('Example not found');
                }

                const updated = await this.model.update(id, { isActive: false });
                return this.success(updated);
            }
        );
    }

    // Override de validaciones base si es necesario
    protected validateCreatePermissions(actor: Actor): boolean {
        return actor.permissions.includes('EXAMPLE_CREATE');
    }

    protected validateUpdatePermissions(actor: Actor): boolean {
        return actor.permissions.includes('EXAMPLE_EDIT');
    }

    protected validateDeletePermissions(actor: Actor): boolean {
        return actor.permissions.includes('EXAMPLE_DELETE');
    }
}
```

### Paso 6: Crear Tests

En `packages/service-core/test/services/{entity}/`:

```typescript
// packages/service-core/test/services/example/create.test.ts
import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { ExampleService } from '../../../src/services/example/example.service.js';
import { createServiceTestInstance } from '../../utils/service-test-utils.js';
import { createMockUserActor } from '../../factories/actorFactory.js';
import { createMockExampleCreateInput } from '../../factories/exampleFactory.js';

describe('ExampleService.create', () => {
    let service: ExampleService;
    let model: any;

    beforeEach(() => {
        const testInstance = createServiceTestInstance(ExampleService);
        service = testInstance.service;
        model = testInstance.model;
    });

    it('should create an example when permissions and input are valid', async () => {
        // Arrange
        const actor = createMockUserActor({ permissions: ['EXAMPLE_CREATE'] });
        const input = createMockExampleCreateInput();
        const created = { ...input, id: 'mock-id' };
        (model.create as Mock).mockResolvedValue(created);

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe('mock-id');
        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalledWith(input);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createMockUserActor({ permissions: [] });
        const input = createMockExampleCreateInput();

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });
});
```

### Paso 7: Crear Factory para Tests

En `packages/service-core/test/factories/{entity}Factory.ts`:

```typescript
// packages/service-core/test/factories/exampleFactory.ts
import type { ExampleCreateInput, ExampleUpdateInput } from '@repo/types/example';
import { getMockId } from './utilsFactory.js';

export const createMockExampleCreateInput = (
    overrides: Partial<ExampleCreateInput> = {}
): ExampleCreateInput => ({
    name: 'Test Example',
    description: 'This is a test example with sufficient description length',
    isActive: true,
    ...overrides
});

export const createMockExampleUpdateInput = (
    overrides: Partial<ExampleUpdateInput> = {}
): ExampleUpdateInput => ({
    name: 'Updated Example',
    description: 'This is an updated test example with sufficient description',
    ...overrides
});

export const createMockExample = (overrides: Partial<Example> = {}): Example => ({
    id: getMockId('example'),
    name: 'Test Example',
    description: 'This is a test example',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
});
```

## 🎯 Patrones y Convenciones

### Nomenclatura

- **Servicios**: `{Entity}Service` (ej: `ExampleService`)
- **Modelos**: `{Entity}Model` (ej: `ExampleModel`)
- **Tipos**: `{Entity}`, `{Entity}CreateInput`, etc.
- **Schemas**: `{Entity}CreateInputSchema`, etc.
- **Tablas**: `{entity}Table` (ej: `exampleTable`)

### Estructura de Archivos

```text
packages/
├── types/src/{entity}/
│   └── {entity}.types.ts
├── schemas/src/{entity}/
│   └── {entity}.schema.ts
├── db/src/
│   ├── schemas/{entity}/
│   │   └── {entity}.schema.ts
│   └── models/
│       └── {entity}.model.ts
└── service-core/src/services/{entity}/
    └── {entity}.service.ts
```

### Métodos Estándar

Todos los servicios DEBEN implementar:

- `create(actor: Actor, input: TCreateInput)`
- `getById(actor: Actor, id: string)`
- `update(actor: Actor, id: string, input: TUpdateInput)`
- `softDelete(actor: Actor, id: string)`
- `list(actor: Actor, search: TSearchInput)`

## 🛡️ Validación y Permisos

### Sistema de Permisos

Los permisos siguen el patrón `{ENTITY}_{ACTION}`:

```typescript
enum Permission {
    // Example permissions
    EXAMPLE_CREATE = 'EXAMPLE_CREATE',
    EXAMPLE_READ = 'EXAMPLE_READ',
    EXAMPLE_EDIT = 'EXAMPLE_EDIT',
    EXAMPLE_DELETE = 'EXAMPLE_DELETE',
    EXAMPLE_LIST = 'EXAMPLE_LIST'
}
```

### Validación de Entrada

SIEMPRE validar entrada usando Zod schemas:

```typescript
async create(actor: Actor, input: ExampleCreateInput) {
    return runWithLoggingAndValidation(
        'example.create',
        input,
        actor,
        async () => {
            // La validación ocurre automáticamente por el schema
            
            if (!this.validateCreatePermissions(actor)) {
                return this.forbidden();
            }

            const created = await this.model.create(input);
            return this.success(created);
        }
    );
}
```

### Validación de Negocio

Para reglas de negocio complejas:

```typescript
private async validateBusinessRules(input: ExampleCreateInput): Promise<string[]> {
    const errors: string[] = [];

    // Ejemplo: validar que el nombre sea único
    const existing = await this.model.findByName(input.name);
    if (existing) {
        errors.push('Name already exists');
    }

    // Más validaciones...
    
    return errors;
}
```

## 🧪 Testing

### Estructura de Tests

```text
test/services/{entity}/
├── create.test.ts
├── read.test.ts
├── update.test.ts
├── delete.test.ts
├── list.test.ts
├── {entity}.helpers.test.ts
├── {entity}.permissions.test.ts
└── {entity}.normalizers.test.ts
```

### Casos de Prueba Estándar

Para cada método, probar:

1. **Happy Path**: Operación exitosa
2. **Permisos**: Falta de permisos
3. **Validación**: Datos inválidos
4. **Not Found**: Entidad no existe
5. **Errores de DB**: Simulación de errores

### Mocking

Usar los factories consistentemente:

```typescript
// ✅ Bueno
const actor = createMockUserActor({ permissions: ['EXAMPLE_CREATE'] });
const input = createMockExampleCreateInput({ name: 'Custom Name' });

// ❌ Malo - hardcodear datos
const actor = { id: '123', permissions: ['EXAMPLE_CREATE'] };
const input = { name: 'Test', description: 'Test desc' };
```

## ✅ Mejores Prácticas

### 1. Manejo de Errores

```typescript
// ✅ Usar ServiceErrorCode enum
return this.error(ServiceErrorCode.NOT_FOUND, 'Example not found');

// ❌ No hardcodear strings
return { error: { code: 'NOT_FOUND', message: 'Not found' } };
```

### 2. Logging

```typescript
// ✅ Usar runWithLoggingAndValidation
return runWithLoggingAndValidation('example.create', input, actor, async () => {
    // lógica
});

// ❌ No logging manual
console.log('Creating example...');
```

### 3. Transacciones

Para operaciones múltiples:

```typescript
async createExampleWithRelations(actor: Actor, input: ComplexInput) {
    return runWithLoggingAndValidation(
        'example.createWithRelations',
        input,
        actor,
        async () => {
            return this.ctx.db.transaction(async (trx) => {
                const example = await this.model.create(input.example, trx);
                const relations = await this.relationModel.createMany(
                    input.relations.map(r => ({ ...r, exampleId: example.id })),
                    trx
                );
                return { example, relations };
            });
        }
    );
}
```

### 4. Paginación Consistente

```typescript
// Siempre incluir metadatos de paginación
interface PaginatedResult<T> {
    items: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        hasNextPage: boolean;
    };
}
```

### 5. Soft Delete por Defecto

- Usar `softDelete()` por defecto
- Implementar `hardDelete()` solo si es necesario
- Usar `restore()` para recuperar entidades

### 6. Normalización de Datos

Crear normalizers para transformar datos:

```typescript
export const normalizeExample = (example: ExampleRow): Example => ({
    id: example.id,
    name: example.name,
    description: example.description,
    isActive: example.isActive,
    createdAt: example.createdAt,
    updatedAt: example.updatedAt,
    deletedAt: example.deletedAt || undefined
});
```

### 7. Documentación de Métodos

```typescript
/**
 * Activa un ejemplo específico
 * 
 * @param actor - Actor que ejecuta la operación
 * @param id - ID del ejemplo a activar
 * @returns ServiceResult con el ejemplo actualizado
 * 
 * @throws ServiceErrorCode.FORBIDDEN - Si el actor no tiene permisos
 * @throws ServiceErrorCode.NOT_FOUND - Si el ejemplo no existe
 * @throws ServiceErrorCode.INTERNAL_ERROR - Si hay error de DB
 */
async activate(actor: Actor, id: string): Promise<ServiceResult<Example>>
```

## 🔧 Comandos Útiles

```bash
# Crear y ejecutar tests del nuevo servicio
pnpm test --filter=service-core -- example

# Verificar tipos
pnpm typecheck --filter=service-core

# Generar documentación de tipos
pnpm build --filter=types
pnpm build --filter=schemas

# Ejecutar migraciones si creaste nuevas tablas
pnpm db:migrate
```

---

**Nota**: Esta guía asume familiaridad con TypeScript, Drizzle ORM, y los patrones establecidos en Hospeda. Para dudas específicas, consulta el código existente o contacta al equipo de arquitectura.
