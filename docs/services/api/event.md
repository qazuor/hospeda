# Event Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Métodos de Búsqueda](#metodos-de-busqueda)
- [Métodos Especializados](#metodos-especializados)
- [Gestión de Fechas y Precios](#gestion-de-fechas-y-precios)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `EventService` gestiona eventos turísticos y culturales en Hospeda. Maneja la información de eventos, fechas, precios, ubicaciones y organizadores. Proporciona operaciones CRUD completas, búsquedas avanzadas por categoría, ubicación, fechas y organizador.

### Entidad Event

Un evento incluye:

- **Información Básica**: Nombre, descripción, categoría, duración
- **Fechas y Horarios**: Fecha de inicio, fin, horarios específicos
- **Precios**: Gratuito, precio único, múltiples tarifas
- **Ubicación**: Integración con destinos, dirección específica
- **Organizador**: Información del organizador o empresa
- **Multimedia**: Imágenes, videos, galería del evento
- **Moderación**: Estado de aprobación, visibilidad
- **SEO**: Meta descripciones, palabras clave
- **Relaciones**: Destinos, alojamientos, atracciones asociadas

### Categorías de Eventos

Los eventos se clasifican en múltiples categorías:

```typescript
enum EventCategory {
    CULTURAL = "CULTURAL",      // Museos, exposiciones, arte
    ENTERTAINMENT = "ENTERTAINMENT", // Conciertos, shows, teatro
    SPORTS = "SPORTS",          // Deportes, competencias
    FOOD = "FOOD",              // Gastronomía, degustaciones
    NATURE = "NATURE",          // Senderismo, actividades al aire libre
    EDUCATION = "EDUCATION",    // Talleres, conferencias
    BUSINESS = "BUSINESS",      // Networking, conferencias
    RELIGIOUS = "RELIGIOUS",    // Eventos religiosos, festivales
    SEASONAL = "SEASONAL",      // Eventos estacionales, fiestas
    OTHER = "OTHER"             // Otros eventos
}
```

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: EventCreateInput)

Crea un nuevo evento.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `input`: Datos del evento a crear

**Permisos Requeridos:** `EVENT_CREATE`

**Validaciones:**

- Slug único (se genera automáticamente si no se proporciona)
- Fechas válidas (inicio antes que fin)
- Precios válidos (no negativos)
- Ubicación válida (coordenadas, referencia a destino)
- Organizador válido

**Ejemplo de Input:**

```typescript
{
    name: "Festival de Jazz de Barcelona",
    slug: "festival-jazz-barcelona-2024", // Opcional, se genera automáticamente
    summary: "El festival de jazz más importante de Cataluña con artistas internacionales",
    description: "El Festival Internacional de Jazz de Barcelona celebra su 25ª edición con una programación excepcional que incluye grandes nombres del jazz mundial...",
    category: "ENTERTAINMENT",
    isFeatured: true,
    
    // Fechas del evento
    dates: {
        startDate: "2024-07-15T18:00:00Z",
        endDate: "2024-07-20T23:00:00Z",
        timezone: "Europe/Madrid",
        isAllDay: false,
        recurring: {
            type: "NONE"
        }
    },
    
    // Precios
    pricing: {
        isFree: false,
        basePrice: {
            price: 45.00,
            currency: "EUR"
        },
        tiers: [
            {
                name: "Entrada General",
                price: 45.00,
                currency: "EUR",
                description: "Acceso a todos los conciertos"
            },
            {
                name: "VIP",
                price: 85.00,
                currency: "EUR", 
                description: "Acceso VIP con zona preferente"
            }
        ]
    },
    
    // Ubicación
    location: {
        destinationId: "dest_barcelona",
        venue: "Palau de la Música Catalana",
        address: "Carrer de Palau de la Música, 4-6, 08003 Barcelona",
        coordinates: {
            latitude: "41.3875",
            longitude: "2.1755"
        }
    },
    
    // Organizador
    organizer: {
        name: "Barcelona Music Foundation",
        email: "info@barcelonamusicfest.com",
        phone: "+34 93 123 4567",
        website: "https://barcelonamusicfest.com"
    },
    
    // Multimedia
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/jazz-festival.jpg",
            moderationState: "APPROVED"
        },
        gallery: [
            {
                url: "https://images.unsplash.com/jazz-performers.jpg",
                moderationState: "APPROVED"
            }
        ]
    },
    
    // SEO
    seo: {
        metaTitle: "Festival de Jazz Barcelona 2024 - Entradas y Programación",
        metaDescription: "Disfruta del mejor jazz internacional en Barcelona. Entradas desde 45€. Del 15 al 20 de julio en el Palau de la Música.",
        keywords: ["jazz", "festival", "barcelona", "música", "conciertos"]
    }
}
```

**Respuesta:**

```typescript
{
    data: {
        id: "event_123",
        name: "Festival de Jazz de Barcelona",
        slug: "festival-jazz-barcelona-2024",
        // ... resto de campos
        createdAt: "2024-09-22T10:00:00Z",
        updatedAt: "2024-09-22T10:00:00Z"
    }
}
```

### getById(actor: Actor, id: string)

Obtiene un evento por su ID.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `id`: ID del evento

**Permisos Requeridos:** `EVENT_READ` (público con restricciones de visibilidad)

**Ejemplo:**

```typescript
const result = await eventService.getById(actor, "event_123");
if (result.data) {
    console.log(result.data.name); // "Festival de Jazz de Barcelona"
    console.log(result.data.dates.startDate); // "2024-07-15T18:00:00Z"
}
```

### getBySlug(actor: Actor, slug: string)

Obtiene un evento por su slug.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `slug`: Slug del evento

**Ejemplo:**

```typescript
const result = await eventService.getBySlug(actor, "festival-jazz-barcelona-2024");
```

### update(actor: Actor, id: string, input: EventUpdateInput)

Actualiza un evento existente (PUT - reemplaza completamente).

**Permisos Requeridos:** `EVENT_EDIT`

### patch(actor: Actor, id: string, input: EventPatchInput)

Actualiza parcialmente un evento (PATCH - actualización incremental).

**Permisos Requeridos:** `EVENT_EDIT`

**Ejemplo:**

```typescript
const result = await eventService.patch(actor, "event_123", {
    pricing: {
        isFree: false,
        basePrice: {
            price: 50.00, // Actualizar precio
            currency: "EUR"
        }
    },
    isFeatured: true
});
```

### softDelete(actor: Actor, id: string)

Elimina lógicamente un evento (soft delete).

**Permisos Requeridos:** `EVENT_DELETE`

### hardDelete(actor: Actor, id: string)

Elimina físicamente un evento (hard delete - irreversible).

**Permisos Requeridos:** `EVENT_DELETE` + `ADMIN` role

### restore(actor: Actor, id: string)

Restaura un evento eliminado lógicamente.

**Permisos Requeridos:** `EVENT_EDIT`

### list(actor: Actor, params: EventSearchInput)

Lista eventos con paginación y filtros.

**Permisos Requeridos:** `EVENT_LIST`

**Parámetros de Búsqueda:**

```typescript
{
    q?: string;                  // Búsqueda por texto (nombre, descripción)
    category?: EventCategory;    // Filtro por categoría
    destinationId?: string;      // Filtro por destino
    organizerId?: string;        // Filtro por organizador
    isFree?: boolean;           // Solo eventos gratuitos
    isFeatured?: boolean;       // Solo eventos destacados
    startDate?: string;         // Eventos después de esta fecha
    endDate?: string;           // Eventos antes de esta fecha
    page?: number;              // Página (default: 1)
    pageSize?: number;          // Elementos por página (default: 20, max: 100)
}
```

## 🔍 Métodos de Búsqueda {#metodos-de-busqueda}

### searchForList(actor: Actor, params: EventSearchInput)

Búsqueda optimizada para listados con información resumida.

**Respuesta Optimizada:**

- Solo campos esenciales para listados
- Información de fechas simplificada
- Precios básicos únicamente
- Imagen principal únicamente

**Ejemplo:**

```typescript
const result = await eventService.searchForList(actor, {
    q: "jazz música",
    category: "ENTERTAINMENT",
    destinationId: "dest_barcelona",
    isFeatured: true,
    page: 1,
    pageSize: 10
});
```

## 🎭 Métodos Especializados {#metodos-especializados}

### getUpcoming(actor: Actor, params: EventUpcomingInput)

Obtiene eventos próximos ordenados por fecha.

**Parámetros:**

```typescript
{
    destinationId?: string;      // Filtro por destino
    category?: EventCategory;    // Filtro por categoría
    days?: number;              // Próximos X días (default: 30)
    page?: number;
    pageSize?: number;
}
```

**Respuesta:**

```typescript
{
    data: {
        events: [
            {
                id: "event_123",
                name: "Festival de Jazz de Barcelona",
                category: "ENTERTAINMENT",
                dates: {
                    startDate: "2024-07-15T18:00:00Z",
                    endDate: "2024-07-20T23:00:00Z"
                },
                pricing: {
                    isFree: false,
                    basePrice: {
                        price: 45.00,
                        currency: "EUR"
                    }
                },
                daysUntilStart: 25
            }
            // ... más eventos
        ],
        total: 15
    }
}
```

**Ejemplo:**

```typescript
const result = await eventService.getUpcoming(actor, {
    destinationId: "dest_barcelona",
    category: "ENTERTAINMENT",
    days: 7, // Próximos 7 días
    page: 1,
    pageSize: 10
});
```

### getFreeEvents(actor: Actor, params: EventFreeInput)

Obtiene solo eventos gratuitos.

**Parámetros:**

```typescript
{
    destinationId?: string;
    category?: EventCategory;
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**

```typescript
const result = await eventService.getFreeEvents(actor, {
    destinationId: "dest_madrid",
    category: "CULTURAL"
});
```

### getByCategory(actor: Actor, params: EventByCategoryInput)

Obtiene eventos filtrados por categoría específica.

**Parámetros:**

```typescript
{
    category: EventCategory;     // Categoría requerida
    destinationId?: string;      // Filtro por destino
    isFeatured?: boolean;        // Solo destacados
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**

```typescript
const result = await eventService.getByCategory(actor, {
    category: "FOOD",
    destinationId: "dest_valencia",
    isFeatured: true
});
```

### getByLocation(actor: Actor, params: EventByLocationInput)

Obtiene eventos por ubicación específica (coordenadas + radio).

**Parámetros:**

```typescript
{
    latitude: string;            // Latitud del punto central
    longitude: string;           // Longitud del punto central
    radiusKm?: number;          // Radio de búsqueda en km (default: 10)
    category?: EventCategory;
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**

```typescript
const result = await eventService.getByLocation(actor, {
    latitude: "41.3851",
    longitude: "2.1734",
    radiusKm: 5, // 5km alrededor de las coordenadas
    category: "SPORTS"
});
```

### getByOrganizer(actor: Actor, params: EventByOrganizerInput)

Obtiene eventos de un organizador específico.

**Parámetros:**

```typescript
{
    organizerId: string;         // ID del organizador
    category?: EventCategory;
    page?: number;
    pageSize?: number;
}
```

### getByAuthor(actor: Actor, params: EventByAuthorInput)

Obtiene eventos creados por un usuario específico.

**Parámetros:**

```typescript
{
    authorId: string;           // ID del usuario autor
    visibility?: VisibilityEnum; // Filtro por visibilidad
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**

```typescript
const result = await eventService.getByAuthor(actor, {
    authorId: "user_456",
    visibility: "PUBLIC"
});
```

### getSummary(actor: Actor, params: EventSummaryInput)

Obtiene un resumen estadístico de eventos.

**Parámetros:**

```typescript
{
    destinationId?: string;      // Filtro por destino
    category?: EventCategory;    // Filtro por categoría
    timeframe?: "WEEK" | "MONTH" | "YEAR"; // Marco temporal
}
```

**Respuesta:**

```typescript
{
    data: {
        totalEvents: 156,
        upcomingEvents: 45,
        freeEvents: 23,
        eventsByCategory: {
            ENTERTAINMENT: 45,
            CULTURAL: 32,
            FOOD: 28,
            SPORTS: 25,
            NATURE: 15,
            OTHER: 11
        },
        averagePrice: 35.50,
        currency: "EUR",
        topDestinations: [
            {
                destinationId: "dest_barcelona",
                destinationName: "Barcelona",
                eventCount: 45
            },
            {
                destinationId: "dest_madrid", 
                destinationName: "Madrid",
                eventCount: 32
            }
        ],
        upcomingHighlights: [
            {
                id: "event_123",
                name: "Festival de Jazz de Barcelona",
                startDate: "2024-07-15T18:00:00Z"
            }
        ]
    }
}
```

## 📅 Gestión de Fechas y Precios {#gestion-de-fechas-y-precios}

### Estructura de Fechas

Los eventos manejan fechas complejas con múltiples opciones:

```typescript
// Evento de un día
dates: {
    startDate: "2024-07-15T18:00:00Z",
    endDate: "2024-07-15T22:00:00Z",
    timezone: "Europe/Madrid",
    isAllDay: false
}

// Evento de todo el día
dates: {
    startDate: "2024-07-15T00:00:00Z",
    endDate: "2024-07-15T23:59:59Z",
    timezone: "Europe/Madrid",
    isAllDay: true
}

// Evento recurrente
dates: {
    startDate: "2024-07-15T18:00:00Z",
    endDate: "2024-07-15T22:00:00Z",
    timezone: "Europe/Madrid",
    isAllDay: false,
    recurring: {
        type: "WEEKLY",
        interval: 1,
        daysOfWeek: ["MONDAY", "WEDNESDAY", "FRIDAY"],
        endRecurrence: "2024-12-31T23:59:59Z"
    }
}
```

### Estructura de Precios

Los eventos soportan múltiples modelos de precios:

```typescript
// Evento gratuito
pricing: {
    isFree: true
}

// Precio único
pricing: {
    isFree: false,
    basePrice: {
        price: 25.00,
        currency: "EUR"
    }
}

// Múltiples tarifas
pricing: {
    isFree: false,
    basePrice: {
        price: 45.00,
        currency: "EUR"
    },
    tiers: [
        {
            name: "Estudiantes",
            price: 25.00,
            currency: "EUR",
            description: "Descuento para estudiantes con carnet",
            conditions: ["student_id_required"]
        },
        {
            name: "VIP",
            price: 85.00,
            currency: "EUR",
            description: "Acceso VIP con zona preferente y catering",
            maxQuantity: 50
        }
    ]
}
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### EventCreateInput

**Campos Requeridos:**

- `name`: string (3-100 caracteres)
- `summary`: string (10-300 caracteres)
- `description`: string (30-2000 caracteres)
- `category`: EventCategory enum
- `dates`: Estructura de fechas válida

**Campos Opcionales:**

- `slug`: string (se genera automáticamente)
- `isFeatured`: boolean (default: false)
- `pricing`: Estructura de precios
- `location`: Datos de ubicación
- `organizer`: Información del organizador
- `media`: Multimedia (imágenes, videos)
- `seo`: Metadatos para SEO

### Validaciones Específicas

**Fechas:**

```typescript
// ✅ Válido
startDate: "2024-07-15T18:00:00Z"
endDate: "2024-07-15T22:00:00Z"   // Después del inicio

// ❌ Inválido
startDate: "2024-07-15T18:00:00Z"
endDate: "2024-07-15T16:00:00Z"   // Antes del inicio
```

**Precios:**

```typescript
// ✅ Válido
pricing: {
    isFree: false,
    basePrice: {
        price: 25.00,     // Positivo
        currency: "EUR"   // Moneda válida
    }
}

// ❌ Inválido  
pricing: {
    isFree: false,
    basePrice: {
        price: -10.00,    // Negativo no permitido
        currency: "EUR"
    }
}
```

**Coordenadas:**

```typescript
// ✅ Válido
coordinates: {
    latitude: "41.3851",    // -90 a 90
    longitude: "2.1734"     // -180 a 180
}
```

**Slug Único:**

```typescript
// Se genera automáticamente desde el name
name: "Festival de Jazz Barcelona" → slug: "festival-de-jazz-barcelona"
name: "Conferencia Tech 2024" → slug: "conferencia-tech-2024"
```

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones Adicionales |
|-----------|---------|---------------------------|
| `create` | `EVENT_CREATE` | Solo usuarios verificados |
| `getById`, `getBySlug` | `EVENT_READ` | Respeta visibilidad |
| `list`, `searchForList` | `EVENT_LIST` | Solo públicos para guests |
| `update`, `patch` | `EVENT_EDIT` | Solo autor o admin |
| `softDelete` | `EVENT_DELETE` | Solo autor o admin |
| `hardDelete` | `EVENT_DELETE` | Solo super admin |
| `restore` | `EVENT_EDIT` | Solo autor o admin |
| `getUpcoming`, `getFreeEvents` | `EVENT_READ` | Público |
| `getByCategory`, `getByLocation` | `EVENT_READ` | Público |
| `getByOrganizer`, `getByAuthor` | `EVENT_READ` | Respeta visibilidad privada |
| `getSummary` | `EVENT_READ` | Público |

### Roles y Permisos

```typescript
// Permisos por rol
GUEST: ['EVENT_READ', 'EVENT_LIST']
USER: ['EVENT_READ', 'EVENT_LIST', 'EVENT_CREATE']
HOST: ['EVENT_READ', 'EVENT_LIST', 'EVENT_CREATE', 'EVENT_EDIT'] // Solo sus eventos
ADMIN: ['EVENT_*'] // Todos los permisos
EVENT_MANAGER: ['EVENT_CREATE', 'EVENT_EDIT', 'EVENT_DELETE', 'EVENT_READ', 'EVENT_LIST']
```

### Visibilidad y Permisos

```typescript
// Eventos públicos - visibles para todos
visibility: "PUBLIC"

// Eventos privados - solo para usuarios con permisos especiales
visibility: "PRIVATE"

// Eventos en borrador - solo para el autor y admins
visibility: "DRAFT"
```

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear un Evento Cultural Completo

```typescript
const eventoMuseo = {
    name: "Noche de los Museos Madrid",
    summary: "Una noche especial para descubrir los museos de Madrid con entrada gratuita",
    description: "La Noche de los Museos es un evento anual que permite visitar gratuitamente los principales museos de Madrid durante toda la noche. Una oportunidad única para disfrutar del arte y la cultura en un ambiente especial...",
    category: "CULTURAL",
    isFeatured: true,
    
    dates: {
        startDate: "2024-05-18T18:00:00Z",
        endDate: "2024-05-19T02:00:00Z",
        timezone: "Europe/Madrid",
        isAllDay: false
    },
    
    pricing: {
        isFree: true
    },
    
    location: {
        destinationId: "dest_madrid",
        venue: "Múltiples museos de Madrid",
        address: "Centro de Madrid"
    },
    
    organizer: {
        name: "Ayuntamiento de Madrid",
        email: "cultura@madrid.es",
        phone: "+34 91 480 00 08",
        website: "https://www.madrid.es"
    },
    
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/madrid-museums-night.jpg",
            moderationState: "APPROVED"
        }
    },
    
    seo: {
        metaTitle: "Noche de los Museos Madrid 2024 - Entrada Gratuita",
        metaDescription: "Descubre los museos de Madrid gratis durante la Noche de los Museos. 18 de mayo, de 18:00 a 02:00.",
        keywords: ["museos madrid", "noche museos", "gratis", "cultura", "arte"]
    }
};

const result = await eventService.create(actor, eventoMuseo);
```

### Búsqueda de Eventos por Múltiples Criterios

```typescript
// Buscar eventos gastronómicos en Valencia
const eventosCocina = await eventService.searchForList(actor, {
    q: "gastronomía cocina chef",
    category: "FOOD",
    destinationId: "dest_valencia",
    isFeatured: true,
    page: 1,
    pageSize: 10
});

// Eventos deportivos próximos en Barcelona
const eventosDeporte = await eventService.getUpcoming(actor, {
    destinationId: "dest_barcelona", 
    category: "SPORTS",
    days: 14, // Próximas 2 semanas
    page: 1,
    pageSize: 20
});

// Eventos gratuitos culturales
const eventosGratis = await eventService.getFreeEvents(actor, {
    category: "CULTURAL",
    page: 1,
    pageSize: 15
});

// Procesar resultados
if (eventosCocina.data) {
    eventosCocina.data.items.forEach(evento => {
        console.log(`${evento.name} - ${evento.category}`);
        console.log(`Fecha: ${evento.dates.startDate}`);
        if (!evento.pricing.isFree) {
            console.log(`Precio: €${evento.pricing.basePrice?.price}`);
        }
    });
}
```

### Gestión de Eventos Recurrentes

```typescript
// Crear clase de yoga semanal
const claseYoga = {
    name: "Yoga al Amanecer en la Playa",
    summary: "Sesión de yoga matutina frente al mar",
    description: "Comienza tu día con energía positiva practicando yoga en la playa mientras sale el sol...",
    category: "NATURE",
    
    dates: {
        startDate: "2024-06-01T06:00:00Z",
        endDate: "2024-06-01T07:30:00Z",
        timezone: "Europe/Madrid",
        isAllDay: false,
        recurring: {
            type: "WEEKLY",
            interval: 1,
            daysOfWeek: ["MONDAY", "WEDNESDAY", "FRIDAY"],
            endRecurrence: "2024-08-31T23:59:59Z"
        }
    },
    
    pricing: {
        isFree: false,
        basePrice: {
            price: 15.00,
            currency: "EUR"
        },
        tiers: [
            {
                name: "Bono 10 clases",
                price: 120.00,
                currency: "EUR",
                description: "Ahorra con el bono de 10 clases"
            }
        ]
    },
    
    location: {
        destinationId: "dest_valencia",
        venue: "Playa de la Malvarrosa",
        coordinates: {
            latitude: "39.4819",
            longitude: "-0.3253"
        }
    }
};

const result = await eventService.create(actor, claseYoga);
```

### Búsqueda Geográfica de Eventos

```typescript
// Buscar eventos en un radio de 10km desde las coordenadas del usuario
const eventosNearby = await eventService.getByLocation(actor, {
    latitude: "41.3851", // Coordenadas del usuario
    longitude: "2.1734",
    radiusKm: 10,
    category: "ENTERTAINMENT",
    page: 1,
    pageSize: 20
});

// Filtrar por precio en el frontend
const eventosBaratos = eventosNearby.data?.items.filter(evento => 
    evento.pricing.isFree || 
    (evento.pricing.basePrice && evento.pricing.basePrice.price <= 30)
);
```

### Análisis de Estadísticas de Eventos

```typescript
// Obtener resumen de eventos por destino
const estadisticas = await eventService.getSummary(actor, {
    destinationId: "dest_barcelona",
    timeframe: "MONTH"
});

if (estadisticas.data) {
    console.log(`Barcelona - ${estadisticas.data.totalEvents} eventos este mes`);
    console.log(`Eventos gratuitos: ${estadisticas.data.freeEvents}`);
    console.log(`Precio promedio: €${estadisticas.data.averagePrice}`);
    
    // Analizar categorías más populares
    const categoriaTop = Object.entries(estadisticas.data.eventsByCategory)
        .sort(([,a], [,b]) => b - a)[0];
    console.log(`Categoría más popular: ${categoriaTop[0]} (${categoriaTop[1]} eventos)`);
    
    // Mostrar eventos destacados próximos
    estadisticas.data.upcomingHighlights.forEach(evento => {
        console.log(`Destacado: ${evento.name} - ${evento.startDate}`);
    });
}
```

### Gestión de Eventos de Organizador

```typescript
// Obtener todos los eventos de un organizador específico
const eventosOrganizador = await eventService.getByOrganizer(actor, {
    organizerId: "org_festival_music",
    page: 1,
    pageSize: 20
});

// Obtener eventos creados por un usuario
const misEventos = await eventService.getByAuthor(actor, {
    authorId: actor.user.id, // Eventos del usuario actual
    visibility: "PUBLIC"
});

// Actualizar precios de eventos en lote (requiere lógica de negocio adicional)
if (misEventos.data) {
    for (const evento of misEventos.data.items) {
        if (evento.pricing && !evento.pricing.isFree) {
            await eventService.patch(actor, evento.id, {
                pricing: {
                    ...evento.pricing,
                    basePrice: {
                        price: evento.pricing.basePrice.price * 1.1, // Incremento 10%
                        currency: evento.pricing.basePrice.currency
                    }
                }
            });
        }
    }
}
```

### Gestión de Eventos Destacados

```typescript
// Marcar evento como destacado
const destacar = await eventService.patch(actor, "event_123", {
    isFeatured: true
});

// Actualizar información del evento para mejor SEO
const actualizarSEO = await eventService.patch(actor, "event_123", {
    seo: {
        metaTitle: "Festival de Jazz Barcelona 2024 - Mejor Festival de España",
        metaDescription: "No te pierdas el Festival de Jazz más importante de España. Barcelona, julio 2024. Entradas disponibles.",
        keywords: ["festival jazz", "barcelona", "música", "entradas", "2024", "españa"]
    }
});

// Actualizar multimedia del evento
const actualizarMedia = await eventService.patch(actor, "event_123", {
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/jazz-festival-2024.jpg",
            moderationState: "APPROVED"
        },
        gallery: [
            {
                url: "https://images.unsplash.com/stage-setup.jpg",
                moderationState: "APPROVED"
            },
            {
                url: "https://images.unsplash.com/audience-dancing.jpg",
                moderationState: "APPROVED"
            }
        ]
    }
});
```

## 🚨 Manejo de Errores Comunes

### Errores de Validación de Fechas

```typescript
// Error por fecha de fin anterior al inicio
{
    error: {
        code: "VALIDATION_ERROR",
        message: "End date must be after start date",
        details: {
            fieldErrors: {
                dates: ["endDate must be after startDate"]
            }
        }
    }
}
```

### Errores de Precios

```typescript
// Error por precio negativo
{
    error: {
        code: "VALIDATION_ERROR",
        message: "Price cannot be negative",
        details: {
            fieldErrors: {
                pricing: ["basePrice.price must be greater than 0"]
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
        message: "Event with slug 'festival-jazz-barcelona-2024' already exists",
        details: { slug: "festival-jazz-barcelona-2024" }
    }
}
```

### Errores de Ubicación

```typescript
// Error por coordenadas inválidas
{
    error: {
        code: "VALIDATION_ERROR",
        message: "Invalid coordinates",
        details: {
            location: "Latitude must be between -90 and 90"
        }
    }
}
```

### Errores de Permisos

```typescript
// Error por falta de permisos
{
    error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions to edit this event",
        details: {
            required: ["EVENT_EDIT"],
            userRole: "USER"
        }
    }
}
```

## 🔗 Relaciones con Otros Servicios

### Con DestinationService

- Los eventos están ubicados en destinos específicos
- Búsquedas por destino incluyen eventos
- Estadísticas de destino incluyen eventos

### Con AccommodationService

- Los eventos pueden estar asociados a alojamientos
- Paquetes evento + alojamiento
- Recomendaciones de alojamiento cerca de eventos

### Con UserService

- Los usuarios pueden crear eventos (con permisos)
- Sistema de favoritos y asistencia a eventos
- Notificaciones de eventos de interés

### Con BookingService

- Reservas de entradas para eventos de pago
- Gestión de capacidad y disponibilidad
- Confirmaciones y cancelaciones

### Con ReviewService

- Reseñas de eventos por parte de asistentes
- Ratings que afectan visibilidad del evento
- Feedback para organizadores

---

**Nota**: El EventService es crucial para la oferta cultural y de entretenimiento de la plataforma. Los eventos enriquecen significativamente la experiencia turística y pueden influir en las decisiones de viaje de los usuarios.
