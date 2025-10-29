# Destination Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Métodos de Búsqueda](#metodos-de-busqueda)
- [Métodos Especializados](#metodos-especializados)
- [Gestión de Estadísticas](#gestion-de-estadisticas)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `DestinationService` gestiona destinos turísticos en Hospeda. Maneja la información geográfica, turística y comercial de países, estados, ciudades y localidades. Proporciona operaciones CRUD completas, búsquedas geográficas, gestión de alojamientos asociados y estadísticas turísticas.

### Entidad Destination

Un destino incluye:

- **Información Geográfica**: País, estado, ciudad, coordenadas
- **Datos Turísticos**: Descripción, atracciones, puntos de interés
- **Multimedia**: Imágenes, videos, galería de destino
- **Estadísticas**: Número de alojamientos, ratings, reviews
- **SEO**: Meta descripciones, palabras clave para turismo
- **Moderación**: Estado de aprobación, visibilidad
- **Relaciones**: Alojamientos, atracciones, eventos asociados

### Jerarquía Geográfica

Los destinos se organizan en una estructura jerárquica:

```typescript
// Ejemplos de jerarquía
País: "España"
├── Estado/Región: "Cataluña"
│   ├── Ciudad: "Barcelona"
│   │   ├── Barrio: "Barrio Gótico"
│   │   └── Barrio: "Eixample"
│   └── Ciudad: "Girona"
└── Estado/Región: "Madrid"
    └── Ciudad: "Madrid"
```

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: DestinationCreateInput)

Crea un nuevo destino turístico.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `input`: Datos del destino a crear

**Permisos Requeridos:** `DESTINATION_CREATE`

**Validaciones:**

- Slug único (se genera automáticamente si no se proporciona)
- Coordenadas geográficas válidas
- Jerarquía geográfica consistente
- Nombre único por nivel geográfico

**Ejemplo de Input:**

```typescript
{
    name: "Barcelona",
    slug: "barcelona", // Opcional, se genera automáticamente
    summary: "Ciudad cosmopolita en la costa mediterránea de España",
    description: "Barcelona es una ciudad vibrante conocida por su arquitectura única, playas hermosas y rica cultura catalana...",
    isFeatured: true,
    
    location: {
        country: "España",
        state: "Cataluña",
        city: "Barcelona",
        zipCode: "08001",
        latitude: "41.3851",
        longitude: "2.1734"
    },
    
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/barcelona-city.jpg",
            moderationState: "APPROVED"
        },
        gallery: [
            {
                url: "https://images.unsplash.com/sagrada-familia.jpg",
                moderationState: "APPROVED"
            }
        ]
    },
    
    seo: {
        metaTitle: "Barcelona - Guía de Viaje Completa",
        metaDescription: "Descubre Barcelona: arquitectura de Gaudí, playas mediterráneas, gastronomía catalana y vida nocturna vibrante.",
        keywords: ["barcelona", "cataluña", "gaudí", "mediterráneo", "turismo"]
    }
}
```

**Respuesta:**

```typescript
{
    data: {
        id: "dest_123",
        name: "Barcelona",
        slug: "barcelona",
        // ... resto de campos
        accommodationsCount: 0, // Se actualiza automáticamente
        createdAt: "2024-09-22T10:00:00Z",
        updatedAt: "2024-09-22T10:00:00Z"
    }
}
```

### getById(actor: Actor, id: string)

Obtiene un destino por su ID.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `id`: ID del destino

**Permisos Requeridos:** `DESTINATION_READ` (público con restricciones de visibilidad)

**Ejemplo:**

```typescript
const result = await destinationService.getById(actor, "dest_123");
if (result.data) {
    console.log(result.data.name); // "Barcelona"
    console.log(result.data.accommodationsCount); // 245
}
```

### getBySlug(actor: Actor, slug: string)

Obtiene un destino por su slug.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `slug`: Slug del destino

**Ejemplo:**

```typescript
const result = await destinationService.getBySlug(actor, "barcelona");
```

### update(actor: Actor, id: string, input: DestinationUpdateInput)

Actualiza un destino existente (PUT - reemplaza completamente).

**Permisos Requeridos:** `DESTINATION_EDIT`

### patch(actor: Actor, id: string, input: DestinationPatchInput)

Actualiza parcialmente un destino (PATCH - actualización incremental).

**Permisos Requeridos:** `DESTINATION_EDIT`

**Ejemplo:**

```typescript
const result = await destinationService.patch(actor, "dest_123", {
    isFeatured: true,
    description: "Descripción actualizada con información más reciente..."
});
```

### softDelete(actor: Actor, id: string)

Elimina lógicamente un destino (soft delete).

**Permisos Requeridos:** `DESTINATION_DELETE`

**Nota:** También actualiza automáticamente los counts de alojamientos relacionados.

### hardDelete(actor: Actor, id: string)

Elimina físicamente un destino (hard delete - irreversible).

**Permisos Requeridos:** `DESTINATION_DELETE` + `ADMIN` role

### restore(actor: Actor, id: string)

Restaura un destino eliminado lógicamente.

**Permisos Requeridos:** `DESTINATION_EDIT`

### list(actor: Actor, params: DestinationSearchInput)

Lista destinos con paginación y filtros.

**Permisos Requeridos:** `DESTINATION_LIST`

**Parámetros de Búsqueda:**

```typescript
{
    q?: string;              // Búsqueda por texto (nombre, descripción)
    country?: string;        // Filtro por país
    state?: string;          // Filtro por estado/región
    city?: string;           // Filtro por ciudad
    isFeatured?: boolean;    // Solo destacados
    hasAccommodations?: boolean; // Solo con alojamientos
    page?: number;           // Página (default: 1)
    pageSize?: number;       // Elementos por página (default: 20, max: 100)
}
```

## 🔍 Métodos de Búsqueda {#metodos-de-busqueda}

### searchForList(actor: Actor, params: DestinationSearchInput)

Búsqueda optimizada para listados con información resumida.

**Respuesta Optimizada:**

- Solo campos esenciales para listados
- Información de ubicación simplificada
- Counts de alojamientos incluidos
- Imágenes principales únicamente

**Ejemplo:**

```typescript
const result = await destinationService.searchForList(actor, {
    q: "playa mediterráneo",
    country: "España",
    isFeatured: true,
    page: 1,
    pageSize: 10
});
```

## 🏨 Métodos Especializados {#metodos-especializados}

### getAccommodations(actor: Actor, params: GetDestinationAccommodationsInput)

Obtiene todos los alojamientos de un destino específico.

**Parámetros:**

```typescript
{
    destinationId: string;
    page?: number;
    pageSize?: number;
    type?: AccommodationType; // Filtro por tipo de alojamiento
}
```

**Respuesta:**

```typescript
{
    data: {
        accommodations: [
            {
                id: "acc_456",
                name: "Hotel Barcelona Center",
                type: "HOTEL",
                averageRating: 4.5,
                reviewsCount: 123,
                price: {
                    price: 180,
                    currency: "EUR"
                }
            }
            // ... más alojamientos
        ],
        total: 245,
        destination: {
            id: "dest_123",
            name: "Barcelona",
            slug: "barcelona"
        }
    }
}
```

**Ejemplo:**

```typescript
const result = await destinationService.getAccommodations(actor, {
    destinationId: "dest_123",
    type: "HOTEL",
    page: 1,
    pageSize: 20
});
```

### getSummary(actor: Actor, params: GetDestinationSummaryInput)

Obtiene un resumen del destino con estadísticas básicas.

**Parámetros:**

```typescript
{
    id: string;
}
```

**Respuesta:**

```typescript
{
    data: {
        id: "dest_123",
        name: "Barcelona",
        summary: "Ciudad cosmopolita...",
        accommodationsCount: 245,
        averageRating: 4.3,
        reviewsCount: 567,
        topAttractions: [
            "Sagrada Familia",
            "Park Güell", 
            "Casa Batlló"
        ],
        climate: "Mediterráneo",
        bestTimeToVisit: "Abril-Octubre"
    }
}
```

### getStats(actor: Actor, params: GetDestinationStatsInput)

Obtiene estadísticas detalladas del destino.

**Parámetros:**

```typescript
{
    id: string;
    includeMonthlyStats?: boolean; // Incluir estadísticas mensuales
}
```

**Respuesta:**

```typescript
{
    data: {
        destinationName: "Barcelona",
        accommodationsCount: 245,
        accommodationsByType: {
            HOTEL: 120,
            APARTMENT: 80,
            HOUSE: 30,
            VILLA: 15
        },
        averageRating: 4.3,
        totalReviews: 567,
        ratingDistribution: {
            5: 280,
            4: 200,
            3: 60,
            2: 20,
            1: 7
        },
        monthlyVisitors: [
            { month: "2024-01", visitors: 50000 },
            { month: "2024-02", visitors: 55000 }
            // ... más meses
        ],
        topAttractions: [
            {
                name: "Sagrada Familia",
                visits: 15000,
                rating: 4.8
            }
        ],
        priceRange: {
            min: 50,
            max: 500,
            average: 180,
            currency: "EUR"
        }
    }
}
```

## 📊 Gestión de Estadísticas {#gestion-de-estadisticas}

### updateStatsFromReview(reviewData)

Actualiza automáticamente las estadísticas cuando se crea/actualiza una reseña de destino.

**Uso:** Llamado automáticamente por el sistema de reseñas.

**Funcionalidad:**

- Recalcula rating promedio
- Actualiza count de reseñas
- Actualiza distribución de ratings

### updateAccommodationsCount(destinationId: string)

Actualiza el contador de alojamientos de un destino.

**Uso:** Llamado automáticamente cuando se crea/elimina un alojamiento.

**Ejemplo interno:**

```typescript
// Se ejecuta automáticamente cuando:
// - Se crea un nuevo alojamiento
// - Se elimina un alojamiento
// - Se cambia el destino de un alojamiento
await destinationService.updateAccommodationsCount("dest_123");
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### DestinationCreateInput

**Campos Requeridos:**

- `name`: string (3-100 caracteres)
- `summary`: string (10-300 caracteres)
- `description`: string (30-2000 caracteres)

**Campos Opcionales:**

- `slug`: string (se genera automáticamente)
- `isFeatured`: boolean (default: false)
- `location`: Datos de ubicación geográfica
- `media`: Multimedia (imágenes, videos)
- `seo`: Metadatos para SEO
- `tags`: Array de etiquetas

### Validaciones Específicas

**Coordenadas Geográficas:**

```typescript
latitude: "41.3851"    // ✅ Válido (-90 a 90)
longitude: "2.1734"    // ✅ Válido (-180 a 180)
```

**Jerarquía Geográfica:**

```typescript
location: {
    country: "España",     // ✅ Requerido
    state: "Cataluña",     // ✅ Opcional pero recomendado
    city: "Barcelona",     // ✅ Opcional
    zipCode: "08001"       // ✅ Opcional
}
```

**Slug Único:**

```typescript
// Se genera automáticamente desde el name
name: "Barcelona" → slug: "barcelona"
name: "New York City" → slug: "new-york-city"
```

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones Adicionales |
|-----------|---------|---------------------------|
| `create` | `DESTINATION_CREATE` | Solo admin o editor de contenido |
| `getById`, `getBySlug` | `DESTINATION_READ` | Respeta visibilidad |
| `list`, `searchForList` | `DESTINATION_LIST` | Solo públicos para guests |
| `update`, `patch` | `DESTINATION_EDIT` | Solo admin o editor |
| `softDelete` | `DESTINATION_DELETE` | Solo admin |
| `hardDelete` | `DESTINATION_DELETE` | Solo super admin |
| `restore` | `DESTINATION_EDIT` | Solo admin o editor |
| `getAccommodations` | `DESTINATION_READ` | Público |
| `getStats`, `getSummary` | `DESTINATION_READ` | Público |

### Roles y Permisos

```typescript
// Permisos por rol
GUEST: ['DESTINATION_READ', 'DESTINATION_LIST']
USER: ['DESTINATION_READ', 'DESTINATION_LIST'] 
HOST: ['DESTINATION_READ', 'DESTINATION_LIST']
ADMIN: ['DESTINATION_*'] // Todos los permisos
CONTENT_EDITOR: ['DESTINATION_CREATE', 'DESTINATION_EDIT', 'DESTINATION_READ', 'DESTINATION_LIST']
```

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear una Ciudad Turística Completa

```typescript
const ciudadData = {
    name: "San Sebastián",
    summary: "Elegante ciudad costera en el País Vasco conocida por su gastronomía y playas",
    description: "San Sebastián (Donostia en euskera) es una joya del norte de España, famosa por sus playas urbanas como La Concha, su excepcional gastronomía con múltiples restaurantes con estrellas Michelin, y el prestigioso Festival Internacional de Cine...",
    isFeatured: true,
    
    location: {
        country: "España",
        state: "País Vasco",
        city: "San Sebastián",
        latitude: "43.3183",
        longitude: "-1.9812"
    },
    
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/san-sebastian-beach.jpg",
            moderationState: "APPROVED"
        },
        gallery: [
            {
                url: "https://images.unsplash.com/pintxos-bar.jpg",
                moderationState: "APPROVED"
            },
            {
                url: "https://images.unsplash.com/monte-igueldo.jpg",
                moderationState: "APPROVED"
            }
        ]
    },
    
    seo: {
        metaTitle: "San Sebastián - Gastronomía y Playas del País Vasco",
        metaDescription: "Descubre San Sebastián: playas urbanas, gastronomía de clase mundial, festival de cine y cultura vasca única.",
        keywords: ["san sebastián", "donostia", "país vasco", "pintxos", "playa concha", "gastronomía"]
    }
};

const result = await destinationService.create(actor, ciudadData);
```

### Búsqueda Geográfica Avanzada

```typescript
// Buscar destinos costeros en España
const destinosCosteros = await destinationService.searchForList(actor, {
    q: "playa costa mar",
    country: "España",
    isFeatured: true,
    page: 1,
    pageSize: 15
});

// Buscar ciudades con muchos alojamientos
const ciudadesPopulares = await destinationService.searchForList(actor, {
    hasAccommodations: true,
    page: 1,
    pageSize: 20
});

// Procesar resultados
if (destinosCosteros.data) {
    destinosCosteros.data.items.forEach(destino => {
        console.log(`${destino.name} - ${destino.accommodationsCount} alojamientos`);
        console.log(`Rating: ${destino.averageRating} (${destino.reviewsCount} reseñas)`);
    });
}
```

### Gestión de Alojamientos por Destino

```typescript
// Obtener hoteles de lujo en Barcelona
const hotelesLujo = await destinationService.getAccommodations(actor, {
    destinationId: "dest_barcelona",
    type: "HOTEL",
    page: 1,
    pageSize: 10
});

// Filtrar por precio (en el frontend)
const hotelesCaros = hotelesLujo.data?.accommodations.filter(
    hotel => hotel.price && hotel.price.price > 200
);
```

### Análisis de Estadísticas Turísticas

```typescript
// Obtener estadísticas completas de un destino
const estadisticas = await destinationService.getStats(actor, {
    id: "dest_barcelona",
    includeMonthlyStats: true
});

if (estadisticas.data) {
    console.log(`${estadisticas.data.destinationName}:`);
    console.log(`- ${estadisticas.data.accommodationsCount} alojamientos`);
    console.log(`- Rating promedio: ${estadisticas.data.averageRating}`);
    console.log(`- Precio promedio: €${estadisticas.data.priceRange?.average}/noche`);
    
    // Analizar temporada alta
    const mesMasVisitado = estadisticas.data.monthlyVisitors?.reduce((prev, current) => 
        (prev.visitors > current.visitors) ? prev : current
    );
    console.log(`Mes más popular: ${mesMasVisitado?.month}`);
}

// Obtener resumen rápido
const resumen = await destinationService.getSummary(actor, {
    id: "dest_barcelona"
});
```

### Actualización de Información Turística

```typescript
// Actualizar información de temporada
const actualizacionTemporada = await destinationService.patch(actor, "dest_ibiza", {
    description: "Ibiza es mundialmente famosa por su vida nocturna vibrante, playas paradisíacas y ambiente bohemio. Durante el verano se convierte en el epicentro de la música electrónica mundial...",
    seo: {
        keywords: ["ibiza", "vida nocturna", "playas", "baleares", "fiesta", "música electrónica"]
    }
});

// Marcar como destino destacado
const destacar = await destinationService.patch(actor, "dest_sevilla", {
    isFeatured: true
});
```

### Gestión de Jerarquía Geográfica

```typescript
// Crear destinos con jerarquía
const paisVasco = await destinationService.create(actor, {
    name: "País Vasco",
    summary: "Región autónoma del norte de España",
    description: "El País Vasco combina tradición y modernidad...",
    location: {
        country: "España",
        state: "País Vasco"
    }
});

const bilbao = await destinationService.create(actor, {
    name: "Bilbao",
    summary: "Capital económica del País Vasco",
    description: "Bilbao es una ciudad industrial transformada...",
    location: {
        country: "España",
        state: "País Vasco",
        city: "Bilbao"
    }
});

const guggenheim = await destinationService.create(actor, {
    name: "Museo Guggenheim Bilbao",
    summary: "Icónico museo de arte contemporáneo",
    description: "El Guggenheim Bilbao es una obra maestra arquitectónica...",
    location: {
        country: "España",
        state: "País Vasco",
        city: "Bilbao",
        address: "Abandoibarra Etorb., 2"
    }
});
```

## 🚨 Manejo de Errores Comunes

### Errores de Validación Geográfica

```typescript
// Error por coordenadas inválidas
{
    error: {
        code: "VALIDATION_ERROR",
        message: "Invalid coordinates: latitude must be between -90 and 90",
        details: {
            fieldErrors: {
                location: ["Invalid latitude value"]
            }
        }
    }
}
```

### Errores de Slug Duplicado

```typescript
// Error por slug ya existente
{
    error: {
        code: "ALREADY_EXISTS",
        message: "Destination with slug 'barcelona' already exists",
        details: { slug: "barcelona" }
    }
}
```

### Errores de Jerarquía

```typescript
// Error por jerarquía geográfica inconsistente
{
    error: {
        code: "VALIDATION_ERROR",
        message: "Geographic hierarchy inconsistent: city specified without state",
        details: {
            location: "State is required when city is specified"
        }
    }
}
```

### Errores de Relaciones

```typescript
// Error al eliminar destino con alojamientos
{
    error: {
        code: "CONFLICT",
        message: "Cannot delete destination with active accommodations",
        details: {
            accommodationsCount: 45,
            suggestion: "Move accommodations to another destination first"
        }
    }
}
```

## 🔗 Relaciones con Otros Servicios

### Con AccommodationService

- Los alojamientos pertenecen a un destino
- Se actualiza automáticamente `accommodationsCount`
- Filtros de búsqueda por destino

### Con AttractionService

- Las atracciones están ubicadas en destinos
- Se incluyen en estadísticas de destino

### Con EventService

- Los eventos se realizan en destinos
- Contribuyen a estadísticas turísticas

### Con ReviewService

- Las reseñas afectan rating del destino
- Se actualizan automáticamente las estadísticas

---

**Nota**: El DestinationService es fundamental para la organización geográfica de toda la plataforma. Cambios en destinos pueden afectar múltiples servicios relacionados.
