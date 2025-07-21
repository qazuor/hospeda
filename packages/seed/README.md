# 📦 Sistema de Seed - Portal Turístico Hosped.ar

Este documento define en profundidad cómo debe funcionar el sistema de seed para poblar la base de datos del monorepo del proyecto Hosped.ar. El objetivo es garantizar una estructura robusta, predecible y fácil de mantener, apta tanto para entornos de producción como de desarrollo o testing.

---

## 🧠 Objetivo general

El sistema de seed debe cumplir dos funciones principales:

1. **Poblar la base de datos con datos obligatorios** para el correcto funcionamiento del sistema (roles, permisos, configuraciones mínimas, destinos iniciales, etc.).
2. **Proveer datos de ejemplo** ricos y variados, utilizados exclusivamente para desarrollo, testing automatizado o validación visual en ambientes no productivos.

Esta distinción permite asegurar que en producción solo se cargue lo necesario, mientras que en desarrollo se simulan escenarios realistas sin comprometer datos reales.

---

## 🧱 Principios del diseño del sistema

* **Modularidad total**: cada entidad debe tener su seed en un archivo separado.
* **Separación de dominios**: datos requeridos y de ejemplo van en carpetas diferentes.
* **Declarativo y explícito**: solo se cargan archivos JSON listados en un manifest.
* **Reutilización de lógica**: todo código genérico debe abstraerse en utilidades reutilizables.
* **Uso prioritario de servicios**: se deben utilizar los servicios (`@repo/services`) para insertar datos y así validar lógicas de negocio y relaciones.
* **Compatibilidad con transacciones**: el sistema debe permitir rollback ante errores.
* **Trazabilidad total**: logs detallados y summary final del proceso.

---

## 📦 Estructura esperada del package `@repo/seed`

```
@repo/seed/
├── required/                      # Seeds obligatorios para producción/dev/test
│   ├── users.seed.ts
│   ├── destinations.seed.ts
│   ├── index.ts
├── example/                       # Seeds de ejemplo (solo dev/test)
│   ├── accommodations.seed.ts
│   ├── users.seed.ts
│   ├── index.ts
├── manifest/                      # Listado explícito de JSONs por entidad
│   ├── required.manifest.json
│   └── example.manifest.json
├── data/                          # Datos JSON, organizados por entidad
│   ├── users/001.json
│   ├── accommodations/...
├── utils/                         # Funciones genéricas reutilizables
│   ├── logger.ts
│   ├── loadJsonFile.ts
│   ├── summaryTracker.ts
│   ├── dbReset.ts
│   ├── migrateRunner.ts
│   ├── seedRunner.ts
│   └── withTransaction.ts
├── cli.ts                         # Entrada CLI
└── index.ts                       # Orquestador global
```

---

## ⚙️ Flags disponibles en CLI

El comando puede ejecutarse con distintos flags para modificar su comportamiento:

| Flag                | Descripción                                                         |
| ------------------- | ------------------------------------------------------------------- |
| `--required`        | Ejecuta los seeds requeridos (mínimos para que el sistema funcione) |
| `--example`         | Ejecuta los seeds de ejemplo (solo para testing y desarrollo)       |
| `--reset`           | Borra datos existentes antes de insertar                            |
| `--migrate`         | Ejecuta las migraciones de la base antes de comenzar                |
| `--rollbackOnError` | Si falla una inserción, hace rollback de toda la entidad            |
| `--continueOnError` | Si falla una inserción, continúa con los archivos restantes         |
| `--exclude=foo,bar` | Entidades que deben excluirse del reset (por ej: roles, permisos)   |

> ⚠️ Los flags `--rollbackOnError` y `--continueOnError` son mutuamente excluyentes.

---

## 🔄 Ejecución con rollback (transacciones)

Cuando se ejecuta con `--rollbackOnError`, cada seed debe estar envuelto en una transacción:

```ts
import { db } from '@repo/db'
import { withTransaction } from '../utils/withTransaction'

await withTransaction(db, async (tx) => {
  for (const item of data) {
    await MyService.create(item, { db: tx })
  }
})
```

Esto permite que, si ocurre un error en uno de los ítems, no se inserte nada de esa entidad.

---

## 🧹 Reset de base de datos

Si se pasa `--reset`, el sistema eliminará datos de las entidades antes de ejecutar los seeds. Esto incluye:

* Eliminar datos en orden seguro (de hijos a padres).
* Opción de excluir entidades protegidas (ej: roles, permissions).
* Mostrar logs por tabla borrada o excluida.

```ts
await resetDatabase(['roles', 'permissions'])
```

Internamente, se usan los objetos Drizzle de cada entidad para ejecutar `db.delete(...)` de forma segura y ordenada.

---

## 📊 Logging y resumen final

El sistema debe mostrar:

* Inicio y fin de cada seed
* Ítems cargados correctamente (por archivo)
* Archivos que fallaron y causa del error
* Resumen agrupado al final:

```
✅ Seed completado
📊 Summary:
- Users: 5 insertados
- Destinations: 4 insertados
- Accommodations: 12 insertados, 2 errores
⚠️ Errores:
- accommodations/009.json → invalid destinationId
```

---

## ➕ Cómo agregar una nueva entidad

1. Crear archivo `example/foo.seed.ts` o `required/foo.seed.ts`
2. Crear carpeta `data/foo/` con archivos JSON individuales
3. Agregar los archivos al manifest correspondiente
4. Importar el seed en `example/index.ts` o `required/index.ts`
5. Usar `loadJsonFiles`, `seedRunner` y el servicio correspondiente

Ejemplo:

```ts
import { AccommodationService } from '@repo/services'
import { loadJsonFiles } from '../utils/loadJsonFile'
import { seedRunner } from '../utils/seedRunner'
import exampleManifest from '../manifest/example.manifest.json'

export async function seedAccommodations() {
  const files = await loadJsonFiles('data/accommodations', exampleManifest.accommodations)
  await seedRunner({
    entityName: 'Accommodations',
    items: files,
    async process(item) {
      await AccommodationService.createAccommodation(item)
    }
  })
}
```

---

## 🛡️ Recomendaciones técnicas y buenas prácticas

* Siempre validar que los archivos JSON tengan estructura válida y completa.
* Si usás Zod para validaciones, podés validar antes de insertar.
* El sistema debe evitar duplicados si no hay `--reset`, asegurando que los servicios sean idempotentes.
* Los logs deben ser coloridos, claros y fácilmente escaneables visualmente.
* En ambientes CI, considerar exportar el summary como JSON para análisis posterior.

---

## 🧪 Ejemplos de ejecución

```bash
# Cargar solo los datos requeridos en entorno limpio
pnpm seed --required --reset --migrate

# Cargar datos de ejemplo para desarrollo, sin borrar lo existente
pnpm seed --example --continueOnError

# Cargar todo pero preservando permisos y roles
pnpm seed --required --reset --exclude=roles,permissions
```

---

# Seed System Documentation

## Overview

The seed system provides a flexible and extensible way to load data into the database. It uses a factory pattern with customizable callbacks to handle different types of entities and their relationships.

## Core Components

### 1. Seed Factory System

The `createSeedFactory` function creates a seed function with customizable callbacks:

```typescript
import { createSeedFactory, createExcludingNormalizer } from './utils/index.js';

export const seedAmenities = createSeedFactory({
    entityName: 'Amenities',
    serviceClass: AmenityService,
    folder: 'src/data/amenity',
    files: requiredManifest.amenities,
    
    // Exclude slug field as it's auto-generated
    normalizer: createExcludingNormalizer(['slug']),
    
    // Custom entity info for better logging
    getEntityInfo: (item) => {
        const amenity = item as { name: string; type?: string };
        const typeInfo = amenity.type ? ` (${amenity.type})` : '';
        return `"${amenity.name}"${typeInfo}`;
    }
});
```

### 2. Available Callbacks

| Callback | Purpose | When Executed |
|----------|---------|---------------|
| `normalizer` | Transform JSON data | Before entity creation |
| `getEntityInfo` | Format logging info | During processing |
| `preProcess` | Validation/transformation | Before entity creation |
| `postProcess` | Post-creation logic | After successful creation |
| `relationBuilder` | Create relationships | After entity creation |
| `errorHandler` | Custom error handling | When errors occur |
| `validateBeforeCreate` | Additional validation | Before service call |
| `transformResult` | Transform result | After successful creation |

### 3. Normalizers

Pre-built normalizers for common data transformations:

```typescript
import { 
    createFieldMapper,
    createExcludingNormalizer,
    createIncludingNormalizer,
    createDateTransformer,
    createCombinedNormalizer
} from './utils/index.js';

// Map JSON fields to service input fields
const fieldMapper = createFieldMapper({
    name: 'name',
    description: 'description',
    type: 'type'
});

// Exclude specific fields
const excludingNormalizer = createExcludingNormalizer(['slug', 'id']);

// Include only specific fields
const includingNormalizer = createIncludingNormalizer(['name', 'description']);

// Transform date strings to Date objects
const dateTransformer = createDateTransformer(['createdAt', 'updatedAt']);

// Combine multiple normalizers
const combinedNormalizer = createCombinedNormalizer(
    createExcludingNormalizer(['slug']),
    createDateTransformer(['createdAt'])
);
```

### 4. Relation Builders

Helpers for creating relationships between entities:

```typescript
import { 
    createManyToManyRelation,
    createOneToManyRelation,
    createCustomRelationBuilder
} from './utils/index.js';

// Many-to-many relationship
const manyToManyBuilder = createManyToManyRelation(
    'attractions',
    'attractions',
    AttractionService,
    'addAttractionToDestination'
);

// One-to-many relationship
const oneToManyBuilder = createOneToManyRelation(
    'attractions',
    'attractions',
    AttractionService,
    'updateAttraction'
);

// Custom relationship with validation
const customBuilder = createCustomRelationBuilder(
    'attractions',
    'attractions',
    (context, seedIds) => {
        const validIds = seedIds.filter(id => 
            context.idMapper.getRealId('attractions', id)
        );
        return {
            isValid: validIds.length === seedIds.length,
            validIds,
            missingIds: seedIds.filter(id => !validIds.includes(id))
        };
    }
);
```

### 5. Error Handlers

Custom error handling strategies:

```typescript
import { 
    createRetryErrorHandler,
    createContinueOnErrorHandler,
    createDetailedErrorHandler,
    createGroupedErrorHandler
} from './utils/index.js';

// Retry on transient errors
const retryHandler = createRetryErrorHandler(3);

// Continue on specific error codes
const continueHandler = createContinueOnErrorHandler(['ALREADY_EXISTS']);

// Detailed error logging
const detailedHandler = createDetailedErrorHandler(true);

// Group similar errors
const groupedHandler = createGroupedErrorHandler();
```

## Usage Examples

### Simple Seed (No Customization)

```typescript
export const seedSimple = createSeedFactory({
    entityName: 'SimpleEntity',
    serviceClass: SimpleService,
    folder: 'src/data/simple',
    files: requiredManifest.simple
});
```

### Seed with Custom Normalization

```typescript
export const seedWithNormalization = createSeedFactory({
    entityName: 'ComplexEntity',
    serviceClass: ComplexService,
    folder: 'src/data/complex',
    files: requiredManifest.complex,
    
    normalizer: (data) => ({
        name: data.name as string,
        description: data.description as string,
        customField: data.someComplexField ? 'processed' : 'default'
    })
});
```

### Seed with Relationships

```typescript
export const seedWithRelations = createSeedFactory({
    entityName: 'Destinations',
    serviceClass: DestinationService,
    folder: 'src/data/destination',
    files: requiredManifest.destinations,
    
    normalizer: createExcludingNormalizer(['slug']),
    
    relationBuilder: async (result, item, context) => {
        const destinationId = result.data?.id;
        const seedAttractionIds = (item as any).attractions || [];
        
        for (const seedId of seedAttractionIds) {
            const realId = context.idMapper.getRealId('attractions', seedId);
            if (realId) {
                await attractionService.addAttractionToDestination(
                    context.actor!,
                    { destinationId, attractionId: realId }
                );
            }
        }
    }
});
```

### Seed with Custom Validation

```typescript
export const seedWithValidation = createSeedFactory({
    entityName: 'Users',
    serviceClass: UserService,
    folder: 'src/data/user',
    files: requiredManifest.users,
    
    validateBeforeCreate: (data) => {
        if (data.role === 'SUPER_ADMIN') {
            throw new Error('Super admin must be created separately');
        }
        return true;
    },
    
    postProcess: async (result, item, context) => {
        if (result.data.role === 'ADMIN') {
            await sendWelcomeEmail(result.data.email);
        }
    }
});
```

### Seed with Custom Error Handling

```typescript
export const seedWithErrorHandling = createSeedFactory({
    entityName: 'ComplexEntity',
    serviceClass: ComplexService,
    folder: 'src/data/complex',
    files: requiredManifest.complex,
    
    errorHandler: (error, item, context) => {
        if (error.code === 'SPECIAL_ERROR') {
            console.log('Special handling for:', item);
            context.specialRetryQueue.push(item);
        } else {
            // Default error handling
            summaryTracker.trackError('ComplexEntity', 'unknown', error.message);
        }
    }
});
```

## Migration Guide

### From Old Seed System

**Before:**
```typescript
export async function seedAmenities(context: SeedContext) {
    // 100+ lines of boilerplate code
    // Manual error handling
    // Manual ID mapping
    // Manual relationship creation
}
```

**After:**
```typescript
export const seedAmenities = createSeedFactory({
    entityName: 'Amenities',
    serviceClass: AmenityService,
    folder: 'src/data/amenity',
    files: requiredManifest.amenities,
    normalizer: createExcludingNormalizer(['slug'])
});
```

## Best Practices

1. **Use appropriate normalizers** for common transformations
2. **Implement custom error handling** for specific error scenarios
3. **Validate relationships** before creating them
4. **Use descriptive entity info** for better logging
5. **Handle edge cases** in custom callbacks
6. **Test seeds thoroughly** before production use

## Troubleshooting

### Common Issues

1. **Type errors with ServiceConstructor**: Ensure service classes are compatible
2. **Missing ID mappings**: Verify entities are seeded in correct order
3. **Relationship failures**: Check that related entities exist
4. **Validation errors**: Review input data and normalizers

### Debug Tips

1. Use `createDetailedErrorHandler(true)` to see input data
2. Add logging in custom callbacks
3. Check ID mapper statistics after seeding
4. Verify file paths and manifests

---

