# Attraction Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Gestión de Relaciones con Destinos](#gestion-de-relaciones-con-destinos)
- [Búsquedas y Filtros](#busquedas-y-filtros)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `AttractionService` gestiona las atracciones turísticas y puntos de interés que pueden asociarse con destinos. Las atracciones representan lugares, actividades y experiencias que los visitantes pueden explorar en cada destino, desde monumentos históricos hasta actividades de aventura.

### Entidad Attraction

Una atracción incluye:

- **Identificación**: ID único, slug URL-friendly, nombre descriptivo
- **Información**: Descripción detallada, categoría, tipo de atracción
- **Ubicación**: Coordenadas, dirección, información de acceso
- **Operación**: Horarios, precios, disponibilidad estacional
- **Relaciones**: Asociaciones con destinos específicos
- **Multimedia**: Imágenes, videos, recursos promocionales

### Tipos de Atracciones

- **Históricas**: Monumentos, museos, sitios arqueológicos
- **Naturales**: Parques, playas, montañas, reservas naturales
- **Culturales**: Teatros, galerías, centros culturales
- **Aventura**: Actividades deportivas, tours, experiencias extremas
- **Gastronómicas**: Restaurantes destacados, mercados, tours culinarios
- **Comerciales**: Mercados, tiendas, centros comerciales únicos

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: AttractionCreateInput)

Crea una nueva atracción turística.

**Ejemplo:**

```typescript
{
    name: "Museo de Arte Contemporáneo",
    description: "Colección única de arte latinoamericano contemporáneo con exposiciones rotativas",
    category: "CULTURAL",
    type: "MUSEUM",
    location: {
        latitude: -34.6037,
        longitude: -58.3816,
        address: "Av. San Juan 350, Buenos Aires"
    },
    operatingHours: {
        tuesday: "10:00-18:00",
        wednesday: "10:00-18:00",
        thursday: "10:00-20:00",
        friday: "10:00-18:00",
        saturday: "10:00-18:00",
        sunday: "12:00-18:00"
    },
    pricing: {
        general: 1500,
        students: 750,
        seniors: 1000,
        currency: "ARS"
    }
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene atracción por ID
- `getBySlug(actor, slug)` - Obtiene atracción por slug
- `list(actor, params)` - Lista atracciones con filtros
- `update/patch(actor, id, input)` - Actualiza atracción
- `softDelete/hardDelete(actor, id)` - Elimina atracción

### Generación Automática de Slug

```typescript
// Auto-generación desde nombre
{
    name: "Catedral de San Patricio"
    // Slug generado: "catedral-de-san-patricio"
}
```

## 🗺️ Gestión de Relaciones con Destinos {#gestion-de-relaciones-con-destinos}

### addAttractionToDestination(actor: Actor, params: AttractionAddToDestinationInput)

Asocia una atracción con un destino turístico.

**Parámetros:**

```typescript
{
    destinationId: string;
    attractionId: string;
}
```

**Ejemplo:**

```typescript
// Añadir museo a la ciudad
await attractionService.addAttractionToDestination(actor, {
    destinationId: "dest_buenos_aires",
    attractionId: "attr_museo_arte_contemporaneo"
});
```

### removeAttractionFromDestination(actor: Actor, params: AttractionRemoveFromDestinationInput)

Remueve la asociación entre atracción y destino.

### getAttractionsByDestination(actor: Actor, params: AttractionsByDestinationInput)

Obtiene todas las atracciones de un destino específico.

**Respuesta:**

```typescript
{
    data: {
        attractions: [
            {
                id: "attr_obelisco",
                name: "Obelisco de Buenos Aires",
                category: "HISTORICAL",
                type: "MONUMENT",
                rating: 4.2,
                reviewCount: 1250
            },
            {
                id: "attr_puerto_madero",
                name: "Puerto Madero",
                category: "COMMERCIAL",
                type: "DISTRICT",
                rating: 4.5,
                reviewCount: 890
            }
        ]
    }
}
```

### getDestinationsByAttraction(actor: Actor, params: DestinationsByAttractionInput)

Obtiene todos los destinos que incluyen una atracción específica.

**Ejemplo:**

```typescript
// Destinos que tienen playas
const result = await attractionService.getDestinationsByAttraction(actor, {
    attractionId: "attr_playa_copacabana"
});
```

## 🔍 Búsquedas y Filtros {#busquedas-y-filtros}

### listWithCounts(actor: Actor, params)

Lista atracciones con conteos de destinos asociados.

**Parámetros:**

```typescript
{
    filters?: {
        name?: string;           // Búsqueda por texto en nombre
        category?: string;       // Categoría de atracción
        type?: string;          // Tipo específico
        destinationId?: string; // Atracciones de destino específico
        hasLocation?: boolean;  // Con coordenadas GPS
        isAccessible?: boolean; // Accesible para discapacitados
        priceRange?: {          // Rango de precios
            min?: number;
            max?: number;
        }
    };
    pagination?: {
        page?: number;
        pageSize?: number;
    };
    sorting?: {
        field?: string;         // "name", "rating", "reviewCount"
        order?: "asc" | "desc";
    };
}
```

**Respuesta con Conteos:**

```typescript
{
    data: {
        items: [
            {
                id: "attr_machu_picchu",
                name: "Machu Picchu",
                category: "HISTORICAL",
                rating: 4.8,
                destinationCount: 3  // Número de destinos que incluyen esta atracción
            }
        ],
        total: 150,
        filters: {
            categories: ["HISTORICAL", "NATURAL", "CULTURAL"],
            priceRanges: [
                { label: "Gratis", min: 0, max: 0, count: 45 },
                { label: "Económico", min: 1, max: 1000, count: 78 },
                { label: "Premium", min: 1001, max: 5000, count: 27 }
            ]
        }
    }
}
```

### Búsquedas Especializadas

```typescript
// Atracciones mejor valoradas
const topRated = await attractionService.listWithCounts(actor, {
    sorting: { field: "rating", order: "desc" },
    pagination: { page: 1, pageSize: 10 }
});

// Atracciones gratuitas
const freeAttractions = await attractionService.listWithCounts(actor, {
    filters: { priceRange: { min: 0, max: 0 } }
});

// Atracciones por categoría
const museums = await attractionService.listWithCounts(actor, {
    filters: { category: "CULTURAL", type: "MUSEUM" }
});
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### AttractionCreateInput

**Campos Requeridos:**

- `name`: string (3-200 caracteres)
- `category`: string (categoría válida)

**Campos Opcionales:**

- `slug`: string (auto-generado si no se proporciona)
- `description`: string (hasta 2000 caracteres)
- `type`: string (tipo específico dentro de categoría)
- `location`: objeto con coordenadas y dirección
- `operatingHours`: objeto con horarios por día
- `pricing`: objeto con precios por tipo de entrada
- `contact`: información de contacto
- `website`: URL oficial
- `accessibility`: información de accesibilidad

### Validaciones Específicas

- **Slug único**: Generado automáticamente o validado por unicidad
- **Coordenadas GPS**: Latitud [-90, 90], longitud [-180, 180]
- **Horarios**: Formato HH:MM-HH:MM o "CLOSED"
- **Precios**: Números positivos con moneda válida
- **Categorías**: Lista predefinida de categorías válidas

### DestinationAttractionRelation

- `destinationId`: string (requerido)
- `attractionId`: string (requerido)
- Relación única (no duplicados)

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | `ATTRACTION_CREATE` | Content Manager+ |
| `getById`, `list` | `ATTRACTION_READ` | Público |
| `update`, `patch` | `ATTRACTION_EDIT` | Content Manager+ |
| `delete` | `ATTRACTION_DELETE` | Admin+ |
| `addAttractionToDestination` | `DESTINATION_EDIT` | Content Manager+ |
| `removeAttractionFromDestination` | `DESTINATION_EDIT` | Content Manager+ |

### Permisos Especiales

- **Atracciones Públicas**: Cualquier usuario puede ver
- **Gestión de Contenido**: Solo Content Manager+ puede crear/editar
- **Relaciones con Destinos**: Requiere permisos de gestión de destinos

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear Atracciones de una Ciudad

```typescript
const barcelonaAttractions = [
    {
        name: "Sagrada Familia",
        description: "Basílica icónica diseñada por Antoni Gaudí, patrimonio de la humanidad",
        category: "HISTORICAL",
        type: "BASILICA",
        location: {
            latitude: 41.4036,
            longitude: 2.1744,
            address: "Carrer de Mallorca, 401, Barcelona"
        },
        pricing: {
            basic: 26,
            guided: 34,
            tower: 36,
            currency: "EUR"
        },
        website: "https://sagradafamilia.org"
    },
    {
        name: "Park Güell",
        description: "Parque público con elementos arquitectónicos de Gaudí",
        category: "CULTURAL",
        type: "PARK",
        location: {
            latitude: 41.4145,
            longitude: 2.1527,
            address: "Carrer d'Olot, s/n, Barcelona"
        },
        pricing: {
            general: 10,
            reduced: 7,
            currency: "EUR"
        }
    }
];

for (const attraction of barcelonaAttractions) {
    await attractionService.create(actor, attraction);
}
```

### Configurar Destino con Atracciones

```typescript
const destinationId = "dest_barcelona";
const attractionIds = [
    "attr_sagrada_familia",
    "attr_park_guell",
    "attr_casa_batllo",
    "attr_las_ramblas",
    "attr_barceloneta_beach"
];

// Asociar todas las atracciones con Barcelona
for (const attractionId of attractionIds) {
    await attractionService.addAttractionToDestination(actor, {
        destinationId,
        attractionId
    });
}
```

### Sistema de Recomendaciones

```typescript
// Encontrar atracciones similares por categoría y ubicación
async function getRecommendedAttractions(attractionId: string) {
    const attraction = await attractionService.getById(actor, attractionId);
    
    if (!attraction.data) return [];
    
    // Buscar atracciones de la misma categoría
    const similar = await attractionService.listWithCounts(actor, {
        filters: {
            category: attraction.data.category
        },
        sorting: { field: "rating", order: "desc" },
        pagination: { pageSize: 5 }
    });
    
    // Excluir la atracción original
    return similar.data.items.filter(item => item.id !== attractionId);
}

// Itinerario sugerido por día
async function createDayItinerary(destinationId: string, preferences: string[]) {
    const attractions = await attractionService.getAttractionsByDestination(actor, {
        destinationId
    });
    
    // Filtrar por preferencias del usuario
    const filtered = attractions.data.attractions.filter(attr => 
        preferences.includes(attr.category)
    );
    
    // Agrupar por proximidad y tiempo de visita estimado
    return filtered.slice(0, 4); // Máximo 4 atracciones por día
}
```

### Dashboard de Atracciones

```typescript
// Estadísticas de atracciones
const analytics = {
    // Atracciones más populares
    topAttractions: await attractionService.listWithCounts(actor, {
        sorting: { field: "rating", order: "desc" },
        pagination: { pageSize: 10 }
    }),
    
    // Por categoría
    byCategory: {},
    
    // Distribución de precios
    pricingAnalysis: {
        free: await attractionService.count(actor, { 
            priceRange: { min: 0, max: 0 } 
        }),
        budget: await attractionService.count(actor, { 
            priceRange: { min: 1, max: 1000 } 
        }),
        premium: await attractionService.count(actor, { 
            priceRange: { min: 1001, max: null } 
        })
    }
};

// Llenar estadísticas por categoría
const categories = ["HISTORICAL", "NATURAL", "CULTURAL", "ADVENTURE"];
for (const category of categories) {
    analytics.byCategory[category] = await attractionService.count(actor, { 
        category 
    });
}
```

---

**Nota**: El AttractionService es fundamental para la experiencia turística, permitiendo a los visitantes descubrir y planificar actividades en cada destino, desde monumentos históricos hasta experiencias únicas de cada lugar.
