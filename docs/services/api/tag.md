# Tag Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Gestión de Relaciones](#gestion-de-relaciones)
- [Métodos Especializados](#metodos-especializados)
- [Sistema de Colores](#sistema-de-colores)
- [Búsquedas y Filtros](#busquedas-y-filtros)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `TagService` gestiona el sistema de etiquetas en Hospeda. Las etiquetas permiten categorizar y organizar contenido de manera flexible. Pueden asociarse a posts, alojamientos, destinos, eventos y otros tipos de entidades. Proporciona operaciones CRUD completas, gestión de relaciones con entidades y análisis de popularidad.

### Entidad Tag

Una etiqueta incluye:

- **Información Básica**: Nombre, slug, descripción
- **Presentación**: Color, ícono, estilo visual
- **Relaciones**: Asociaciones con múltiples tipos de entidades
- **Estadísticas**: Número de usos, popularidad
- **Gestión**: Estado del ciclo de vida, moderación
- **Metadatos**: Categoría, prioridad, visibilidad

### Tipos de Entidades Soportadas

Las etiquetas pueden asociarse con:

```typescript
enum EntityType {
    POST = "POST",                    // Artículos y contenido
    ACCOMMODATION = "ACCOMMODATION",  // Alojamientos
    DESTINATION = "DESTINATION",      // Destinos turísticos  
    EVENT = "EVENT",                  // Eventos
    ATTRACTION = "ATTRACTION",        // Atracciones
    USER = "USER"                     // Perfiles de usuario
}
```

### Sistema de Colores

```typescript
enum TagColor {
    BLUE = "BLUE",           // #3B82F6 - Información general
    GREEN = "GREEN",         // #10B981 - Naturaleza, sostenibilidad
    RED = "RED",             // #EF4444 - Alertas, urgencia
    YELLOW = "YELLOW",       // #F59E0B - Destacados, ofertas
    PURPLE = "PURPLE",       // #8B5CF6 - Premium, lujo
    PINK = "PINK",           // #EC4899 - Romance, parejas
    ORANGE = "ORANGE",       // #F97316 - Aventura, actividades
    GRAY = "GRAY",           // #6B7280 - Neutral, informativo
    INDIGO = "INDIGO",       // #6366F1 - Tecnología, moderna
    TEAL = "TEAL"            // #14B8A6 - Relajación, spa
}
```

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: TagCreateInput)

Crea una nueva etiqueta.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `input`: Datos de la etiqueta a crear

**Permisos Requeridos:** `TAG_CREATE`

**Validaciones:**

- Nombre único (slug se genera automáticamente)
- Color válido del sistema
- Nombre entre 2-50 caracteres
- Descripción opcional hasta 200 caracteres

**Ejemplo de Input:**

```typescript
{
    name: "Playa",
    slug: "playa", // Opcional, se genera automáticamente
    description: "Destinos y alojamientos cerca de playas",
    color: "BLUE",
    category: "LOCATION", // Opcional, para organización interna
    isSystemTag: false,   // false para tags creados por usuarios
    priority: 1          // Prioridad para ordenamiento (1-10)
}
```

**Respuesta:**

```typescript
{
    data: {
        id: "tag_123",
        name: "Playa",
        slug: "playa",
        description: "Destinos y alojamientos cerca de playas",
        color: "BLUE",
        usageCount: 0, // Se actualiza automáticamente
        lifecycleState: "ACTIVE",
        createdAt: "2024-09-22T10:00:00Z",
        updatedAt: "2024-09-22T10:00:00Z"
    }
}
```

### getById(actor: Actor, id: string)

Obtiene una etiqueta por su ID.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `id`: ID de la etiqueta

**Permisos Requeridos:** `TAG_READ` (público)

**Ejemplo:**

```typescript
const result = await tagService.getById(actor, "tag_123");
if (result.data) {
    console.log(result.data.name); // "Playa"
    console.log(result.data.usageCount); // 245 (número de usos)
}
```

### getBySlug(actor: Actor, slug: string)

Obtiene una etiqueta por su slug.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `slug`: Slug de la etiqueta

**Ejemplo:**

```typescript
const result = await tagService.getBySlug(actor, "playa");
```

### update(actor: Actor, id: string, input: TagUpdateInput)

Actualiza una etiqueta existente (PUT - reemplaza completamente).

**Permisos Requeridos:** `TAG_EDIT`

### patch(actor: Actor, id: string, input: TagPatchInput)

Actualiza parcialmente una etiqueta (PATCH - actualización incremental).

**Permisos Requeridos:** `TAG_EDIT`

**Ejemplo:**

```typescript
const result = await tagService.patch(actor, "tag_123", {
    description: "Destinos costeros y alojamientos con acceso directo a playa",
    color: "TEAL", // Cambiar color
    priority: 2    // Aumentar prioridad
});
```

### softDelete(actor: Actor, id: string)

Elimina lógicamente una etiqueta (soft delete).

**Permisos Requeridos:** `TAG_DELETE`

**Funcionalidad:**

- Mantiene relaciones existentes con entidades
- La etiqueta no aparece en búsquedas nuevas
- Preserva estadísticas históricas

### hardDelete(actor: Actor, id: string)

Elimina físicamente una etiqueta (hard delete - irreversible).

**Permisos Requeridos:** `TAG_DELETE` + `ADMIN` role

**Advertencia:** Elimina todas las relaciones con entidades.

### restore(actor: Actor, id: string)

Restaura una etiqueta eliminada lógicamente.

**Permisos Requeridos:** `TAG_EDIT`

### list(actor: Actor, params: TagSearchInput)

Lista etiquetas con paginación y filtros.

**Permisos Requeridos:** `TAG_LIST`

**Parámetros de Búsqueda:**

```typescript
{
    q?: string;                  // Búsqueda por texto (nombre, descripción)
    color?: TagColor;           // Filtro por color
    category?: string;          // Filtro por categoría
    isSystemTag?: boolean;      // Solo tags del sistema o de usuario
    minUsageCount?: number;     // Mínimo número de usos
    sortBy?: "name" | "usage" | "created"; // Ordenamiento
    sortOrder?: "asc" | "desc"; // Dirección del ordenamiento
    page?: number;              // Página (default: 1)
    pageSize?: number;          // Elementos por página (default: 20, max: 100)
}
```

## 🔗 Gestión de Relaciones {#gestion-de-relaciones}

### addToEntity(actor: Actor, params: TagAddToEntityInput)

Asocia una etiqueta con una entidad.

**Parámetros:**

```typescript
{
    tagId: string;              // ID de la etiqueta
    entityType: EntityType;     // Tipo de entidad
    entityId: string;          // ID de la entidad
}
```

**Permisos Requeridos:** `TAG_ASSOCIATE` + permisos de la entidad

**Funcionalidad:**

- Incrementa automáticamente el `usageCount` de la etiqueta
- Previene duplicados (misma etiqueta en misma entidad)
- Valida que la entidad existe y es accesible

**Ejemplo:**

```typescript
// Asociar etiqueta "Playa" a un destino
const result = await tagService.addToEntity(actor, {
    tagId: "tag_playa",
    entityType: "DESTINATION",
    entityId: "dest_valencia"
});

// Asociar etiqueta "Romántico" a un alojamiento
const romantic = await tagService.addToEntity(actor, {
    tagId: "tag_romantico", 
    entityType: "ACCOMMODATION",
    entityId: "acc_hotel_boutique"
});
```

### removeFromEntity(actor: Actor, params: TagRemoveFromEntityInput)

Remueve la asociación entre una etiqueta y una entidad.

**Parámetros:**

```typescript
{
    tagId: string;              // ID de la etiqueta
    entityType: EntityType;     // Tipo de entidad
    entityId: string;          // ID de la entidad
}
```

**Permisos Requeridos:** `TAG_DISSOCIATE` + permisos de la entidad

**Funcionalidad:**

- Decrementa automáticamente el `usageCount` de la etiqueta
- No genera error si la asociación no existe

**Ejemplo:**

```typescript
const result = await tagService.removeFromEntity(actor, {
    tagId: "tag_playa",
    entityType: "DESTINATION", 
    entityId: "dest_valencia"
});
```

### getForEntity(actor: Actor, params: TagGetForEntityInput)

Obtiene todas las etiquetas asociadas a una entidad.

**Parámetros:**

```typescript
{
    entityType: EntityType;     // Tipo de entidad
    entityId: string;          // ID de la entidad
    includeInactive?: boolean; // Incluir etiquetas inactivas
}
```

**Respuesta:**

```typescript
{
    data: {
        entityType: "ACCOMMODATION",
        entityId: "acc_hotel_barcelona",
        tags: [
            {
                id: "tag_123",
                name: "Playa",
                slug: "playa",
                color: "BLUE",
                description: "Cerca de la playa"
            },
            {
                id: "tag_456",
                name: "Romántico",
                slug: "romantico",
                color: "PINK",
                description: "Perfecto para parejas"
            }
        ],
        totalTags: 2
    }
}
```

**Ejemplo:**

```typescript
// Obtener etiquetas de un alojamiento
const result = await tagService.getForEntity(actor, {
    entityType: "ACCOMMODATION",
    entityId: "acc_hotel_barcelona"
});

// Obtener etiquetas de un post
const postTags = await tagService.getForEntity(actor, {
    entityType: "POST",
    entityId: "post_guia_barcelona"
});
```

### getEntitiesByTag(actor: Actor, params: TagGetEntitiesByTagInput)

Obtiene todas las entidades asociadas a una etiqueta específica.

**Parámetros:**

```typescript
{
    tagId: string;              // ID de la etiqueta
    entityType?: EntityType;    // Filtrar por tipo de entidad
    page?: number;
    pageSize?: number;
}
```

**Respuesta:**

```typescript
{
    data: {
        tag: {
            id: "tag_playa",
            name: "Playa",
            color: "BLUE"
        },
        entities: [
            {
                entityType: "DESTINATION",
                entityId: "dest_valencia",
                entityData: {
                    name: "Valencia",
                    slug: "valencia"
                }
            },
            {
                entityType: "ACCOMMODATION", 
                entityId: "acc_hotel_beach",
                entityData: {
                    name: "Hotel Beach Resort",
                    slug: "hotel-beach-resort"
                }
            }
        ],
        total: 45,
        entityCounts: {
            DESTINATION: 12,
            ACCOMMODATION: 23,
            POST: 8,
            EVENT: 2
        }
    }
}
```

**Ejemplo:**

```typescript
// Obtener todos los destinos con etiqueta "Playa"
const beachDestinations = await tagService.getEntitiesByTag(actor, {
    tagId: "tag_playa",
    entityType: "DESTINATION",
    page: 1,
    pageSize: 20
});

// Obtener todas las entidades con etiqueta "Lujo"
const luxuryEntities = await tagService.getEntitiesByTag(actor, {
    tagId: "tag_lujo",
    page: 1,
    pageSize: 50
});
```

## 🏆 Métodos Especializados {#metodos-especializados}

### getPopularTags(actor: Actor, params: TagGetPopularInput)

Obtiene las etiquetas más populares ordenadas por número de usos.

**Parámetros:**

```typescript
{
    limit?: number;             // Número de etiquetas a devolver (default: 10, max: 50)
    entityType?: EntityType;    // Filtrar por tipo de entidad
    minUsageCount?: number;     // Mínimo número de usos
}
```

**Respuesta:**

```typescript
{
    data: {
        tags: [
            {
                id: "tag_playa",
                name: "Playa",
                color: "BLUE",
                usageCount: 245,
                rank: 1
            },
            {
                id: "tag_centro",
                name: "Centro Ciudad",
                color: "GRAY",
                usageCount: 198,
                rank: 2
            },
            {
                id: "tag_familia",
                name: "Familiar",
                color: "GREEN",
                usageCount: 167,
                rank: 3
            }
        ],
        totalTags: 3
    }
}
```

**Ejemplo:**

```typescript
// Top 20 etiquetas más populares
const popularTags = await tagService.getPopularTags(actor, {
    limit: 20
});

// Etiquetas populares solo para alojamientos
const accommodationTags = await tagService.getPopularTags(actor, {
    limit: 15,
    entityType: "ACCOMMODATION",
    minUsageCount: 10
});
```

### searchByName(actor: Actor, params: TagSearchByNameInput)

Búsqueda de etiquetas por nombre con coincidencias parciales.

**Parámetros:**

```typescript
{
    query: string;              // Texto de búsqueda
    limit?: number;             // Límite de resultados (default: 10)
    exactMatch?: boolean;       // Solo coincidencias exactas
}
```

**Ejemplo:**

```typescript
// Búsqueda con coincidencias parciales
const results = await tagService.searchByName(actor, {
    query: "play",
    limit: 10
});
// Devuelve: ["Playa", "Playero", "Playlist"]

// Búsqueda exacta
const exact = await tagService.searchByName(actor, {
    query: "Playa",
    exactMatch: true
});
```

### getTagStats(actor: Actor, params: TagStatsInput)

Obtiene estadísticas detalladas de uso de etiquetas.

**Parámetros:**

```typescript
{
    tagId?: string;             // Stats de una etiqueta específica
    timeframe?: "WEEK" | "MONTH" | "YEAR"; // Marco temporal
    includeEntityBreakdown?: boolean; // Desglose por tipo de entidad
}
```

**Respuesta:**

```typescript
{
    data: {
        tagName: "Playa",
        totalUsage: 245,
        usageByEntityType: {
            DESTINATION: 45,
            ACCOMMODATION: 123,
            POST: 67,
            EVENT: 8,
            ATTRACTION: 2
        },
        usageOverTime: [
            {
                date: "2024-09-01",
                newUsages: 12
            },
            {
                date: "2024-09-02", 
                newUsages: 8
            }
        ],
        topEntities: [
            {
                entityType: "ACCOMMODATION",
                entityId: "acc_hotel_beach",
                entityName: "Hotel Beach Resort"
            }
        ]
    }
}
```

## 🎨 Sistema de Colores {#sistema-de-colores}

### Semántica de Colores

Cada color tiene un significado sugerido para mantener consistencia:

```typescript
const colorSemantics = {
    BLUE: {
        hex: "#3B82F6",
        usage: ["Información general", "Ubicación", "Servicios"],
        examples: ["Centro", "WiFi", "Información"]
    },
    
    GREEN: {
        hex: "#10B981", 
        usage: ["Naturaleza", "Sostenibilidad", "Familiar"],
        examples: ["Eco-friendly", "Parque", "Familiar", "Jardín"]
    },
    
    RED: {
        hex: "#EF4444",
        usage: ["Urgencia", "Importante", "Restricciones"],
        examples: ["Solo adultos", "No mascotas", "Reserva ya"]
    },
    
    YELLOW: {
        hex: "#F59E0B",
        usage: ["Destacados", "Ofertas", "Atención"],
        examples: ["Oferta", "Destacado", "Novedad"]
    },
    
    PURPLE: {
        hex: "#8B5CF6",
        usage: ["Premium", "Lujo", "VIP"],
        examples: ["Lujo", "Premium", "Exclusivo", "VIP"]
    },
    
    PINK: {
        hex: "#EC4899",
        usage: ["Romance", "Parejas", "Especial"],
        examples: ["Romántico", "Luna de miel", "Parejas"]
    },
    
    ORANGE: {
        hex: "#F97316",
        usage: ["Aventura", "Actividades", "Energía"],
        examples: ["Aventura", "Deportes", "Activo"]
    },
    
    GRAY: {
        hex: "#6B7280",
        usage: ["Neutral", "Informativo", "General"],
        examples: ["General", "Básico", "Estándar"]
    },
    
    INDIGO: {
        hex: "#6366F1",
        usage: ["Tecnología", "Moderno", "Digital"],
        examples: ["Smart", "Tecnológico", "Digital"]
    },
    
    TEAL: {
        hex: "#14B8A6",
        usage: ["Relajación", "Spa", "Wellness"],
        examples: ["Spa", "Relajante", "Wellness", "Zen"]
    }
};
```

### Aplicación de Colores

```typescript
// Crear etiquetas con semántica de color apropiada
const ecoTag = await tagService.create(actor, {
    name: "Eco-friendly",
    color: "GREEN", // Verde para sostenibilidad
    description: "Alojamiento sostenible y respetuoso con el medio ambiente"
});

const luxuryTag = await tagService.create(actor, {
    name: "Lujo",
    color: "PURPLE", // Púrpura para premium
    description: "Experiencia de alta gama y servicios exclusivos"
});

const beachTag = await tagService.create(actor, {
    name: "Playa",
    color: "BLUE", // Azul para ubicación/información
    description: "Cerca de la playa o con acceso directo"
});
```

## 🔍 Búsquedas y Filtros {#busquedas-y-filtros}

### Búsqueda Avanzada

```typescript
// Búsqueda combinada con múltiples filtros
const advancedSearch = await tagService.list(actor, {
    q: "playa costa mar",        // Texto de búsqueda
    color: "BLUE",               // Solo etiquetas azules
    minUsageCount: 10,           // Mínimo 10 usos
    sortBy: "usage",             // Ordenar por popularidad
    sortOrder: "desc",           // Más populares primero
    page: 1,
    pageSize: 20
});

// Filtrar etiquetas del sistema vs usuario
const systemTags = await tagService.list(actor, {
    isSystemTag: true,           // Solo tags predefinidos
    sortBy: "name",
    sortOrder: "asc"
});

const userTags = await tagService.list(actor, {
    isSystemTag: false,          // Solo tags creados por usuarios
    minUsageCount: 5,
    sortBy: "created",
    sortOrder: "desc"            // Más recientes primero
});
```

### Autocomplete y Sugerencias

```typescript
// Sistema de autocomplete para formularios
const getSuggestions = async (query: string, entityType?: EntityType) => {
    // 1. Búsqueda por nombre parcial
    const nameMatches = await tagService.searchByName(actor, {
        query: query,
        limit: 5
    });
    
    // 2. Etiquetas populares para el tipo de entidad
    const popularForType = await tagService.getPopularTags(actor, {
        entityType: entityType,
        limit: 5
    });
    
    // 3. Combinar y deduplicar resultados
    const suggestions = [
        ...nameMatches.data.tags,
        ...popularForType.data.tags.filter(
            tag => !nameMatches.data.tags.some(match => match.id === tag.id)
        )
    ].slice(0, 10);
    
    return suggestions;
};

// Uso en formulario de creación de post
const postTagSuggestions = await getSuggestions("play", "POST");
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### TagCreateInput

**Campos Requeridos:**

- `name`: string (2-50 caracteres)
- `color`: TagColor enum

**Campos Opcionales:**

- `slug`: string (se genera automáticamente)
- `description`: string (hasta 200 caracteres)
- `category`: string (organización interna)
- `isSystemTag`: boolean (default: false)
- `priority`: number (1-10, default: 5)

### Validaciones Específicas

**Nombre Único:**

```typescript
// ✅ Válido
name: "Nueva Etiqueta"

// ❌ Inválido - ya existe
name: "Playa" // Error: tag with this name already exists
```

**Slug Único:**

```typescript
// Se genera automáticamente desde el name
name: "Centro Ciudad" → slug: "centro-ciudad"
name: "WiFi Gratis" → slug: "wifi-gratis"

// Si existe conflicto, se añade número
"centro-ciudad" → "centro-ciudad-2"
```

**Colores Válidos:**

```typescript
// ✅ Válido
color: "BLUE"
color: "GREEN"

// ❌ Inválido
color: "MAGENTA" // No existe en el enum
```

**Prioridad:**

```typescript
// ✅ Válido
priority: 1     // Máxima prioridad
priority: 5     // Prioridad media (default)
priority: 10    // Mínima prioridad

// ❌ Inválido
priority: 0     // Fuera del rango
priority: 11    // Fuera del rango
```

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones Adicionales |
|-----------|---------|---------------------------|
| `create` | `TAG_CREATE` | Solo usuarios verificados |
| `getById`, `getBySlug` | `TAG_READ` | Público |
| `list`, `searchByName` | `TAG_LIST` | Público |
| `update`, `patch` | `TAG_EDIT` | Solo admin o creador |
| `softDelete` | `TAG_DELETE` | Solo admin |
| `hardDelete` | `TAG_DELETE` | Solo super admin |
| `restore` | `TAG_EDIT` | Solo admin |
| `getPopularTags` | `TAG_READ` | Público |
| `getForEntity` | `TAG_READ` | Público |
| `getEntitiesByTag` | `TAG_READ` | Público |
| `addToEntity` | `TAG_ASSOCIATE` | + permisos de entidad |
| `removeFromEntity` | `TAG_DISSOCIATE` | + permisos de entidad |
| `getTagStats` | `TAG_READ` | Admin o analista |

### Roles y Permisos

```typescript
// Permisos por rol
GUEST: ['TAG_READ', 'TAG_LIST']
USER: ['TAG_READ', 'TAG_LIST', 'TAG_CREATE', 'TAG_ASSOCIATE']
HOST: ['TAG_READ', 'TAG_LIST', 'TAG_CREATE', 'TAG_ASSOCIATE', 'TAG_EDIT'] // Solo sus tags
CONTENT_MANAGER: ['TAG_*'] // Todos excepto hard delete
ADMIN: ['TAG_*'] // Todos los permisos
```

### Autorización de Asociaciones

```typescript
// Para asociar etiquetas a entidades, se requiere:
addToEntity: {
    // Permisos de tag
    TAG_ASSOCIATE: true,
    
    // + Permisos específicos de la entidad
    POST: "POST_EDIT",
    ACCOMMODATION: "ACCOMMODATION_EDIT", 
    DESTINATION: "DESTINATION_EDIT",
    EVENT: "EVENT_EDIT",
    ATTRACTION: "ATTRACTION_EDIT",
    USER: "USER_EDIT" // Solo propio perfil
}
```

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Sistema de Etiquetas para Alojamientos

```typescript
// Crear etiquetas específicas para alojamientos
const accommodationTags = [
    {
        name: "Piscina",
        color: "BLUE",
        description: "Alojamiento con piscina",
        category: "AMENITY"
    },
    {
        name: "Pet-Friendly",
        color: "GREEN", 
        description: "Admite mascotas",
        category: "POLICY"
    },
    {
        name: "Lujo",
        color: "PURPLE",
        description: "Alojamiento de alta gama",
        category: "TIER"
    },
    {
        name: "Céntrico",
        color: "GRAY",
        description: "Ubicación céntrica",
        category: "LOCATION"
    }
];

// Crear las etiquetas
for (const tagData of accommodationTags) {
    await tagService.create(actor, tagData);
}

// Asociar etiquetas a un hotel específico
const hotelId = "acc_hotel_luxury_beach";
const tagsToAdd = ["tag_piscina", "tag_lujo", "tag_pet_friendly"];

for (const tagId of tagsToAdd) {
    await tagService.addToEntity(actor, {
        tagId: tagId,
        entityType: "ACCOMMODATION",
        entityId: hotelId
    });
}
```

### Sistema de Categorización de Posts

```typescript
// Etiquetas para contenido editorial
const contentTags = [
    {
        name: "Guía Completa",
        color: "INDIGO",
        description: "Guías detalladas y completas",
        category: "CONTENT_TYPE"
    },
    {
        name: "Tips Locales",
        color: "ORANGE",
        description: "Consejos de locales",
        category: "CONTENT_TYPE"
    },
    {
        name: "Presupuesto Bajo",
        color: "YELLOW",
        description: "Viajes económicos",
        category: "BUDGET"
    },
    {
        name: "Gastronomía",
        color: "RED",
        description: "Contenido sobre comida y bebida",
        category: "TOPIC"
    }
];

// Crear y asociar a posts
const postId = "post_guia_barcelona";
await tagService.addToEntity(actor, {
    tagId: "tag_guia_completa",
    entityType: "POST",
    entityId: postId
});

await tagService.addToEntity(actor, {
    tagId: "tag_gastronomia",
    entityType: "POST", 
    entityId: postId
});
```

### Dashboard de Análisis de Etiquetas

```typescript
// Dashboard completo para administradores
const getTagDashboard = async () => {
    // 1. Etiquetas más populares
    const popularTags = await tagService.getPopularTags(actor, {
        limit: 20
    });
    
    // 2. Distribución por tipo de entidad
    const entityBreakdown = {};
    for (const entityType of Object.values(EntityType)) {
        const tags = await tagService.getPopularTags(actor, {
            entityType: entityType,
            limit: 10
        });
        entityBreakdown[entityType] = tags.data.tags;
    }
    
    // 3. Etiquetas recientes
    const recentTags = await tagService.list(actor, {
        sortBy: "created",
        sortOrder: "desc",
        page: 1,
        pageSize: 10
    });
    
    // 4. Etiquetas sin usar
    const unusedTags = await tagService.list(actor, {
        minUsageCount: 0,
        sortBy: "created",
        sortOrder: "desc",
        page: 1,
        pageSize: 20
    });
    
    // 5. Estadísticas por color
    const colorStats = {};
    for (const color of Object.values(TagColor)) {
        const colorTags = await tagService.list(actor, {
            color: color,
            page: 1,
            pageSize: 100
        });
        colorStats[color] = {
            count: colorTags.data?.total || 0,
            averageUsage: colorTags.data?.items.reduce(
                (sum, tag) => sum + tag.usageCount, 0
            ) / (colorTags.data?.items.length || 1)
        };
    }
    
    return {
        popularTags: popularTags.data.tags,
        entityBreakdown,
        recentTags: recentTags.data?.items,
        unusedTags: unusedTags.data?.items,
        colorStats,
        totalTags: await tagService.count(actor, {})
    };
};
```

### Sistema de Recomendaciones Basado en Etiquetas

```typescript
// Recomendar contenido basado en etiquetas
const getRecommendations = async (userId: string, entityType: EntityType) => {
    // 1. Obtener etiquetas de interés del usuario (basado en actividad)
    const userInteractionTags = await getUserInterestTags(userId);
    
    // 2. Buscar entidades con etiquetas similares
    const recommendations = [];
    
    for (const tag of userInteractionTags) {
        const entities = await tagService.getEntitiesByTag(actor, {
            tagId: tag.id,
            entityType: entityType,
            page: 1,
            pageSize: 5
        });
        
        recommendations.push(...entities.data.entities);
    }
    
    // 3. Deduplicar y ordenar por relevancia
    const uniqueRecommendations = deduplicateEntities(recommendations);
    const scoredRecommendations = calculateRelevanceScore(
        uniqueRecommendations, 
        userInteractionTags
    );
    
    return scoredRecommendations.slice(0, 10);
};

// Obtener alojamientos recomendados
const recommendedAccommodations = await getRecommendations(
    "user_123",
    "ACCOMMODATION"
);
```

### Gestión de Etiquetas Multiidioma

```typescript
// Sistema básico para etiquetas en múltiples idiomas
const createMultilingualTag = async (baseTagData: any, translations: any) => {
    // 1. Crear etiqueta base (inglés)
    const baseTag = await tagService.create(actor, {
        ...baseTagData,
        name: translations.en,
        description: translations.en_description
    });
    
    // 2. Crear variantes en otros idiomas con referencia a la base
    const languages = ['es', 'fr', 'de'];
    const relatedTags = [];
    
    for (const lang of languages) {
        if (translations[lang]) {
            const localizedTag = await tagService.create(actor, {
                ...baseTagData,
                name: translations[lang],
                description: translations[`${lang}_description`],
                category: `${baseTagData.category}_${lang}`,
                parentTagId: baseTag.data.id // Referencia no estándar
            });
            relatedTags.push(localizedTag.data);
        }
    }
    
    return {
        baseTag: baseTag.data,
        localizedTags: relatedTags
    };
};

// Crear etiqueta "Playa" en múltiples idiomas
const beachTags = await createMultilingualTag(
    {
        color: "BLUE",
        category: "LOCATION",
        isSystemTag: true
    },
    {
        en: "Beach",
        en_description: "Near beach or with beach access",
        es: "Playa", 
        es_description: "Cerca de la playa o con acceso directo",
        fr: "Plage",
        fr_description: "Près de la plage ou avec accès direct",
        de: "Strand",
        de_description: "In Strandnähe oder mit direktem Zugang"
    }
);
```

## 🚨 Manejo de Errores Comunes

### Errores de Validación

```typescript
// Error por nombre duplicado
{
    error: {
        code: "ALREADY_EXISTS",
        message: "Tag with name 'Playa' already exists",
        details: {
            field: "name",
            value: "Playa",
            existingTagId: "tag_123"
        }
    }
}
```

### Errores de Asociación

```typescript
// Error por entidad no encontrada
{
    error: {
        code: "NOT_FOUND",
        message: "Entity not found",
        details: {
            entityType: "ACCOMMODATION",
            entityId: "acc_nonexistent",
            operation: "addToEntity"
        }
    }
}

// Error por asociación duplicada
{
    error: {
        code: "ALREADY_EXISTS",
        message: "Tag already associated with this entity",
        details: {
            tagId: "tag_playa",
            entityType: "ACCOMMODATION",
            entityId: "acc_hotel_beach"
        }
    }
}
```

### Errores de Permisos

```typescript
// Error por falta de permisos para asociar
{
    error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions to associate tag with entity",
        details: {
            required: ["TAG_ASSOCIATE", "ACCOMMODATION_EDIT"],
            userPermissions: ["TAG_ASSOCIATE"]
        }
    }
}
```

## 🔗 Relaciones con Otros Servicios

### Con PostService

- Los posts pueden tener múltiples etiquetas
- Búsquedas de posts por etiquetas
- Análisis de tendencias en contenido

### Con AccommodationService

- Etiquetas para amenidades y características
- Filtros de búsqueda por etiquetas
- Categorización de tipos de alojamiento

### Con DestinationService

- Etiquetas para características del destino
- Organización por tipos de turismo
- Búsquedas temáticas de destinos

### Con EventService

- Categorización de eventos por etiquetas
- Filtros temáticos de eventos
- Recomendaciones basadas en intereses

### Con UserService

- Etiquetas de intereses del usuario
- Personalización de recomendaciones
- Perfiles de preferencias

---

**Nota**: El TagService es fundamental para la organización y descubrimiento de contenido en Hospeda. Proporciona un sistema flexible de categorización que mejora significativamente la experiencia de búsqueda y navegación del usuario.
