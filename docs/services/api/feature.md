# Feature Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Gestión de Relaciones con Alojamientos](#gestion-de-relaciones-con-alojamientos)
- [Búsquedas y Filtros](#busquedas-y-filtros)
- [Características Especiales](#caracteristicas-especiales)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `FeatureService` gestiona las características y funcionalidades distintivas de los alojamientos. Las features representan aspectos únicos, servicios especiales y comodidades destacadas que diferencian cada propiedad. Opera como un sistema de etiquetado avanzado con relaciones many-to-many hacia alojamientos.

### Entidad Feature

Una característica incluye:

- **Identificación**: ID único, slug URL-friendly, nombre descriptivo
- **Contenido**: Descripción, ícono representativo
- **Clasificación**: Características integradas (builtin) vs personalizadas
- **Destacado**: Sistema de features principales (featured)
- **Relaciones**: Asociaciones con alojamientos específicos
- **Personalización**: Notas y comentarios por alojamiento

### Diferencia con Amenities

Mientras que las **amenidades** son servicios y comodidades estándar (WiFi, piscina, aire acondicionado), las **features** son características distintivas y únicas:

- **Amenities**: "¿Qué servicios tiene?"
- **Features**: "¿Qué lo hace especial?"

**Ejemplos de Features:**

- "Vista panorámica al océano"
- "Arquitectura histórica del s.XVIII"
- "Chef privado disponible"
- "Huerto orgánico propio"
- "Arte local exclusivo"
- "Experiencias personalizadas"

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: FeatureCreateInput)

Crea una nueva característica distintiva.

**Ejemplo:**

```typescript
{
    name: "Vista panorámica al mar",
    description: "Vistas espectaculares de 360° al océano Atlántico desde todas las habitaciones",
    icon: "panoramic-view",
    isBuiltin: false,    // Característica personalizada
    isFeatured: true     // Destacada en listados
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene feature por ID
- `getBySlug(actor, slug)` - Obtiene feature por slug
- `list(actor, params)` - Lista features con filtros
- `update/patch(actor, id, input)` - Actualiza feature
- `softDelete/hardDelete(actor, id)` - Elimina feature

### Generación Automática de Slug

```typescript
// Auto-generación desde nombre
{
    name: "Chef Michelin Disponible"
    // Slug generado: "chef-michelin-disponible"
}

// Slug personalizado
{
    name: "Experiencia Gastronómica Única",
    slug: "gastronomia-premium"
}
```

## 🏨 Gestión de Relaciones con Alojamientos {#gestion-de-relaciones-con-alojamientos}

### addFeatureToAccommodation(actor: Actor, params: AddFeatureToAccommodationInput)

Asocia una característica distintiva con un alojamiento.

**Parámetros:**

```typescript
{
    accommodationId: string;
    featureId: string;
    comments?: string;      // Contexto específico del alojamiento
}
```

**Ejemplo:**

```typescript
// Añadir vista al mar con contexto específico
await featureService.addFeatureToAccommodation(actor, {
    accommodationId: "acc_villa_costa",
    featureId: "feature_ocean_view",
    comments: "Vista directa desde suite principal y terraza, especialmente espectacular al amanecer"
});
```

### removeFeatureFromAccommodation(actor: Actor, params: RemoveFeatureFromAccommodationInput)

Remueve la asociación entre característica y alojamiento.

### getFeaturesForAccommodation(actor: Actor, params: GetFeaturesForAccommodationInput)

Obtiene todas las características distintivas de un alojamiento.

**Respuesta:**

```typescript
{
    data: {
        features: [
            {
                id: "feature_ocean_view",
                name: "Vista panorámica al mar",
                description: "Vistas espectaculares de 360° al océano",
                icon: "panoramic-view",
                isFeatured: true
            },
            {
                id: "feature_historical",
                name: "Arquitectura histórica",
                description: "Edificio del siglo XVIII restaurado",
                icon: "historical-building",
                isFeatured: true
            }
        ]
    }
}
```

### getAccommodationsByFeature(actor: Actor, params: GetAccommodationsByFeatureInput)

Obtiene todos los alojamientos que tienen una característica específica.

**Ejemplo:**

```typescript
// Propiedades con chef privado
const result = await featureService.getAccommodationsByFeature(actor, {
    featureId: "feature_private_chef"
});
```

## 🔍 Búsquedas y Filtros {#busquedas-y-filtros}

### searchForList(actor: Actor, params)

Búsqueda avanzada con conteo de alojamientos asociados.

**Parámetros:**

```typescript
{
    filters?: {
        name?: string;       // Búsqueda por texto en nombre
        slug?: string;       // Búsqueda exacta por slug
        isFeatured?: boolean; // Solo características destacadas
        isBuiltin?: boolean; // Solo características integradas/personalizadas
    };
    pagination?: {
        page?: number;
        pageSize?: number;
    };
}
```

**Respuesta con Conteos:**

```typescript
{
    data: {
        items: [
            {
                id: "feature_ocean_view",
                name: "Vista panorámica al mar",
                isFeatured: true,
                accommodationCount: 15  // Número de alojamientos con esta feature
            },
            {
                id: "feature_private_chef",
                name: "Chef privado disponible",
                isFeatured: true,
                accommodationCount: 8
            }
        ],
        total: 2
    }
}
```

### Búsquedas Populares

```typescript
// Características más destacadas
const featured = await featureService.searchForList(actor, {
    filters: { isFeatured: true },
    pagination: { page: 1, pageSize: 20 }
});

// Características personalizadas (no builtin)
const custom = await featureService.searchForList(actor, {
    filters: { isBuiltin: false }
});

// Buscar por palabra clave
const gourmet = await featureService.searchForList(actor, {
    filters: { name: "chef" }
});
```

## ⭐ Características Especiales {#caracteristicas-especiales}

### Features Integradas vs Personalizadas

**Builtin Features (isBuiltin: true)**

- Características predefinidas del sistema
- Mantenidas por administradores
- Consistentes entre propiedades
- Ejemplos: "Pet-friendly", "Business Center", "Eco-friendly"

**Features Personalizadas (isBuiltin: false)**

- Creadas por hosts para destacar singularidades
- Específicas de cada propiedad
- Mayor flexibilidad de contenido
- Ejemplos: "Colección de arte original", "Viñedo propio", "Spa termal natural"

### Sistema de Features Destacadas

```typescript
// Características principales para marketing
const featuredFeatures = {
    isFeatured: true,
    examples: [
        "Vista panorámica única",
        "Experiencia gastronómica exclusiva",
        "Actividades de aventura",
        "Patrimonio histórico",
        "Sostenibilidad excepcional"
    ]
};
```

### Personalización por Alojamiento

```typescript
// Mismo feature, diferentes contextos
const beachVilla = {
    featureId: "feature_ocean_view",
    comments: "Vista directa al mar desde todas las habitaciones, ideal para amaneceres"
};

const mountainCabin = {
    featureId: "feature_panoramic_view", 
    comments: "Vista de 180° a los picos nevados, especialmente hermosa en invierno"
};
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### FeatureCreateInput

**Campos Requeridos:**

- `name`: string (2-100 caracteres)

**Campos Opcionales:**

- `slug`: string (auto-generado si no se proporciona)
- `description`: string (10-500 caracteres)
- `icon`: string (1-100 caracteres)
- `isBuiltin`: boolean (default: false)
- `isFeatured`: boolean (default: false)

### Validaciones de Slug

- Patrón: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Longitud: 3-100 caracteres
- Único en el sistema
- Auto-generación desde name si no se proporciona

### AccommodationFeatureRelation

- `accommodationId`: string (requerido)
- `featureId`: string (requerido)
- `comments`: string (5-300 caracteres, opcional)
- `hostReWriteName`: string (3-100 caracteres, opcional)

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | `FEATURE_CREATE` | Content Manager+ |
| `getById`, `list` | `FEATURE_READ` | Público |
| `update`, `patch` | `FEATURE_EDIT` | Content Manager+ |
| `delete` | `FEATURE_DELETE` | Admin+ |
| `addFeatureToAccommodation` | `ACCOMMODATION_EDIT` | Host (propia) o Admin |
| `removeFeatureFromAccommodation` | `ACCOMMODATION_EDIT` | Host (propia) o Admin |

### Permisos Especiales

- **Builtin Features**: Solo Admin puede crear/editar
- **Featured Status**: Solo Content Manager+ puede modificar
- **Accommodation Relations**: Host puede gestionar sus propias propiedades

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear Características Distintivas

```typescript
const luxuryFeatures = [
    {
        name: "Chef Michelin Disponible",
        description: "Chef con estrella Michelin disponible para experiencias gastronómicas privadas",
        icon: "chef-hat",
        isFeatured: true,
        isBuiltin: false
    },
    {
        name: "Helipuerto Privado",
        description: "Acceso directo en helicóptero con helipuerto en la propiedad",
        icon: "helicopter",
        isFeatured: true,
        isBuiltin: false
    },
    {
        name: "Spa Termal Natural",
        description: "Aguas termales naturales con propiedades terapéuticas únicas",
        icon: "hot-spring",
        isFeatured: true,
        isBuiltin: false
    }
];

for (const feature of luxuryFeatures) {
    await featureService.create(actor, feature);
}
```

### Configurar Villa de Lujo

```typescript
const luxuryVillaId = "acc_villa_paradise";
const uniqueFeatures = [
    {
        id: "feature_ocean_360",
        comments: "Vista panorámica de 360° al océano desde la torre principal"
    },
    {
        id: "feature_private_beach",
        comments: "Playa privada de 200 metros con acceso exclusivo para huéspedes"
    },
    {
        id: "feature_wine_cellar",
        comments: "Bodega con colección de 500 vinos internacionales y cata guiada"
    },
    {
        id: "feature_yacht_dock",
        comments: "Muelle privado para yates hasta 80 pies, combustible incluido"
    }
];

for (const feature of uniqueFeatures) {
    await featureService.addFeatureToAccommodation(actor, {
        accommodationId: luxuryVillaId,
        featureId: feature.id,
        comments: feature.comments
    });
}
```

### Dashboard de Características

```typescript
// Análisis de popularidad de features
const analytics = {
    // Features más populares por número de alojamientos
    mostPopular: await featureService.searchForList(actor, {
        pagination: { page: 1, pageSize: 10 }
    }),
    
    // Features destacadas
    featured: await featureService.searchForList(actor, {
        filters: { isFeatured: true }
    }),
    
    // Features personalizadas vs integradas
    customVsBuiltin: {
        custom: await featureService.count(actor, { isBuiltin: false }),
        builtin: await featureService.count(actor, { isBuiltin: true })
    }
};

// Reporte de utilización
const utilizationReport = analytics.mostPopular.data.items.map(feature => ({
    name: feature.name,
    accommodationCount: feature.accommodationCount,
    utilizationRate: `${((feature.accommodationCount / totalAccommodations) * 100).toFixed(1)}%`,
    category: feature.isBuiltin ? 'Integrada' : 'Personalizada'
}));
```

### Sistema de Recomendaciones

```typescript
// Encontrar alojamientos similares por features compartidas
async function findSimilarAccommodations(accommodationId: string) {
    // Obtener features del alojamiento
    const currentFeatures = await featureService.getFeaturesForAccommodation(actor, {
        accommodationId
    });
    
    // Buscar alojamientos con features similares
    const similarAccommodations = new Map();
    
    for (const feature of currentFeatures.data.features) {
        const accommodationsWithFeature = await featureService.getAccommodationsByFeature(actor, {
            featureId: feature.id
        });
        
        for (const acc of accommodationsWithFeature.data.accommodations) {
            if (acc.id !== accommodationId) {
                const count = similarAccommodations.get(acc.id) || 0;
                similarAccommodations.set(acc.id, count + 1);
            }
        }
    }
    
    // Ordenar por número de features compartidas
    return Array.from(similarAccommodations.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
}
```

---

**Nota**: El FeatureService permite destacar las características únicas de cada alojamiento, diferenciándolo de la competencia y ayudando a los huéspedes a encontrar experiencias especiales que se adapten a sus preferencias específicas.
