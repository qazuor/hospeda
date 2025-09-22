# Accommodation Service

## 📋 Índice

- [Visión General](#visión-general)
- [Métodos CRUD Básicos](#métodos-crud-básicos)
- [Métodos de Búsqueda](#métodos-de-búsqueda)
- [Métodos Especializados](#métodos-especializados)
- [Gestión de FAQs](#gestión-de-faqs)
- [Gestión de IA Data](#gestión-de-ia-data)
- [Esquemas de Validación](#esquemas-de-validación)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General

El `AccommodationService` es el servicio principal para la gestión de alojamientos en Hospeda. Maneja hoteles, casas, apartamentos y todo tipo de hospedaje turístico. Proporciona operaciones CRUD completas, búsquedas avanzadas, gestión de reseñas, FAQs y datos de inteligencia artificial.

### Entidad Accommodation

Un alojamiento incluye:

- **Información Básica**: Nombre, descripción, tipo, ubicación
- **Datos Comerciales**: Precios, disponibilidad, políticas
- **Multimedia**: Imágenes, videos, galería
- **Características**: Amenidades, features, capacidad
- **Geolocalización**: Coordenadas, dirección completa
- **SEO**: Meta descripciones, palabras clave
- **Moderación**: Estado de aprobación, visibilidad
- **Estadísticas**: Ratings, número de reseñas

### Tipos de Alojamiento

```typescript
enum AccommodationType {
    HOTEL = 'HOTEL',
    APARTMENT = 'APARTMENT', 
    HOUSE = 'HOUSE',
    VILLA = 'VILLA',
    CABIN = 'CABIN',
    GUESTHOUSE = 'GUESTHOUSE',
    HOSTEL = 'HOSTEL',
    RESORT = 'RESORT'
}
```

## 🔧 Métodos CRUD Básicos

Todos los métodos CRUD heredan de `BaseCrudService` y siguen el patrón estándar:

### create(actor: Actor, input: AccommodationCreateInput)

Crea un nuevo alojamiento.

**Parámetros:**
- `actor`: Actor que ejecuta la operación
- `input`: Datos del alojamiento a crear

**Permisos Requeridos:** `ACCOMMODATION_CREATE`

**Validaciones:**
- Slug único (se genera automáticamente si no se proporciona)
- Destino válido y existente
- Usuario propietario válido
- Datos de contacto válidos (teléfono internacional)
- Ubicación con coordenadas válidas

**Ejemplo de Input:**
```typescript
{
    name: "Hotel Plaza Central",
    slug: "hotel-plaza-central", // Opcional, se genera automáticamente
    summary: "Un hotel moderno en el centro de la ciudad",
    description: "Hotel Plaza Central ofrece comodidades de lujo...",
    type: "HOTEL",
    destinationId: "dest_123",
    ownerId: "user_456",
    contactInfo: {
        mobilePhone: "+1234567890"
    },
    location: {
        country: "España",
        state: "Madrid",
        city: "Madrid",
        zipCode: "28001",
        latitude: "40.4168",
        longitude: "-3.7038"
    },
    price: {
        price: 150,
        currency: "EUR"
    },
    extraInfo: {
        capacity: 4,
        bedrooms: 2,
        bathrooms: 2,
        minNights: 1
    }
}
```

**Respuesta:**
```typescript
{
    data: {
        id: "acc_789",
        name: "Hotel Plaza Central",
        slug: "hotel-plaza-central",
        // ... resto de campos
        createdAt: "2024-09-22T10:00:00Z",
        updatedAt: "2024-09-22T10:00:00Z"
    }
}
```

### getById(actor: Actor, id: string)

Obtiene un alojamiento por su ID.

**Parámetros:**
- `actor`: Actor que ejecuta la operación
- `id`: ID del alojamiento

**Permisos Requeridos:** `ACCOMMODATION_READ` (público con restricciones de visibilidad)

**Ejemplo:**
```typescript
const result = await accommodationService.getById(actor, "acc_789");
if (result.data) {
    console.log(result.data.name); // "Hotel Plaza Central"
}
```

### getBySlug(actor: Actor, slug: string)

Obtiene un alojamiento por su slug.

**Parámetros:**
- `actor`: Actor que ejecuta la operación  
- `slug`: Slug del alojamiento

**Ejemplo:**
```typescript
const result = await accommodationService.getBySlug(actor, "hotel-plaza-central");
```

### update(actor: Actor, id: string, input: AccommodationUpdateInput)

Actualiza un alojamiento existente (PUT - reemplaza completamente).

**Permisos Requeridos:** `ACCOMMODATION_EDIT`

**Validaciones:**
- El actor debe ser el propietario o tener permisos administrativos
- Todos los campos requeridos deben estar presentes

### patch(actor: Actor, id: string, input: AccommodationPatchInput)

Actualiza parcialmente un alojamiento (PATCH - actualización incremental).

**Permisos Requeridos:** `ACCOMMODATION_EDIT`

**Ejemplo:**
```typescript
const result = await accommodationService.patch(actor, "acc_789", {
    price: {
        price: 175,
        currency: "EUR"
    }
});
```

### softDelete(actor: Actor, id: string)

Elimina lógicamente un alojamiento (soft delete).

**Permisos Requeridos:** `ACCOMMODATION_DELETE`

### hardDelete(actor: Actor, id: string)

Elimina físicamente un alojamiento (hard delete - irreversible).

**Permisos Requeridos:** `ACCOMMODATION_DELETE` + `ADMIN` role

### restore(actor: Actor, id: string)

Restaura un alojamiento eliminado lógicamente.

**Permisos Requeridos:** `ACCOMMODATION_EDIT`

### list(actor: Actor, params: AccommodationSearchInput)

Lista alojamientos con paginación y filtros.

**Permisos Requeridos:** `ACCOMMODATION_LIST`

**Parámetros de Búsqueda:**
```typescript
{
    q?: string;              // Búsqueda por texto
    type?: AccommodationType; // Filtro por tipo
    destinationId?: string;  // Filtro por destino
    ownerId?: string;        // Filtro por propietario
    isFeatured?: boolean;    // Solo destacados
    minPrice?: number;       // Precio mínimo
    maxPrice?: number;       // Precio máximo
    page?: number;           // Página (default: 1)
    pageSize?: number;       // Elementos por página (default: 20, max: 100)
}
```

## 🔍 Métodos de Búsqueda

### searchWithRelations(actor: Actor, params: AccommodationSearchInput)

Búsqueda avanzada con datos relacionados incluidos (destino, propietario, etc.).

**Respuesta Incluye:**
- Datos del alojamiento
- Información del destino
- Datos del propietario
- Amenidades asociadas
- Features del alojamiento

### getByDestination(actor: Actor, params: AccommodationByDestinationParams)

Obtiene todos los alojamientos de un destino específico.

**Parámetros:**
```typescript
{
    destinationId: string;
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**
```typescript
const result = await accommodationService.getByDestination(actor, {
    destinationId: "dest_madrid",
    page: 1,
    pageSize: 20
});
```

### getByOwner(actor: Actor, params: WithOwnerIdParams)

Obtiene todos los alojamientos de un propietario específico.

**Parámetros:**
```typescript
{
    ownerId: string;
}
```

### getTopRated(actor: Actor, params: AccommodationTopRatedParams)

Obtiene los alojamientos mejor calificados.

**Parámetros:**
```typescript
{
    limit?: number;          // Límite de resultados (default: 10)
    destinationId?: string;  // Opcional: filtrar por destino
}
```

### getTopRatedByDestination(actor: Actor, params: AccommodationTopRatedParams)

Obtiene los alojamientos mejor calificados de un destino específico.

## 📊 Métodos Especializados

### getSummary(actor: Actor, params: AccommodationSummaryParams)

Obtiene un resumen del alojamiento con estadísticas básicas.

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
        id: "acc_789",
        name: "Hotel Plaza Central",
        summary: "Un hotel moderno...",
        averageRating: 4.5,
        reviewsCount: 23,
        type: "HOTEL",
        priceRange: "€€€",
        mainImage: "https://..."
    }
}
```

### getStats(actor: Actor, params: AccommodationStatsInput)

Obtiene estadísticas detalladas del alojamiento.

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
        accommodationName: "Hotel Plaza Central",
        totalReviews: 23,
        averageRating: 4.5,
        ratingDistribution: {
            5: 15,
            4: 6,
            3: 2,
            2: 0,
            1: 0
        },
        occupancyRate: 0.85,
        monthlyStats: [...]
    }
}
```

### updateStatsFromReview(reviewData)

Método interno que actualiza automáticamente las estadísticas cuando se crea/actualiza una reseña.

**Uso:** Llamado automáticamente por el sistema de reseñas.

## ❓ Gestión de FAQs

### getFaqs(actor: Actor, params: AccommodationFaqListInput)

Obtiene las preguntas frecuentes de un alojamiento.

**Parámetros:**
```typescript
{
    accommodationId: string;
}
```

### addFaq(actor: Actor, input: AccommodationFaqAddInput)

Agrega una nueva FAQ al alojamiento.

**Permisos Requeridos:** `ACCOMMODATION_EDIT`

**Parámetros:**
```typescript
{
    accommodationId: string;
    question: string;        // Pregunta (3-200 caracteres)
    answer: string;         // Respuesta (10-1000 caracteres)
    order?: number;         // Orden de visualización
}
```

### updateFaq(actor: Actor, input: AccommodationFaqUpdateInput)

Actualiza una FAQ existente.

**Parámetros:**
```typescript
{
    accommodationId: string;
    faqId: string;
    question?: string;
    answer?: string;
    order?: number;
}
```

### removeFaq(actor: Actor, input: AccommodationFaqRemoveInput)

Elimina una FAQ del alojamiento.

**Parámetros:**
```typescript
{
    accommodationId: string;
    faqId: string;
}
```

## 🤖 Gestión de IA Data

### getAllIAData(actor: Actor, input: AccommodationIaDataListInput)

Obtiene todos los datos de IA asociados al alojamiento.

**Parámetros:**
```typescript
{
    accommodationId: string;
}
```

### addIAData(actor: Actor, input: AccommodationIaDataAddInput)

Agrega nuevos datos de IA al alojamiento.

**Permisos Requeridos:** `ACCOMMODATION_EDIT`

**Parámetros:**
```typescript
{
    accommodationId: string;
    dataType: string;       // Tipo de dato IA
    content: object;        // Contenido del dato
    confidence?: number;    // Nivel de confianza (0-1)
}
```

### updateIAData(actor: Actor, input: AccommodationIaDataUpdateInput)

Actualiza datos de IA existentes.

### removeIAData(actor: Actor, input: AccommodationIaDataRemoveInput)

Elimina datos de IA del alojamiento.

## ✅ Esquemas de Validación

### AccommodationCreateInput

**Campos Requeridos:**
- `name`: string (3-100 caracteres)
- `summary`: string (10-300 caracteres)  
- `description`: string (30-2000 caracteres)
- `type`: AccommodationType enum
- `destinationId`: UUID válido
- `ownerId`: UUID válido

**Campos Opcionales:**
- `slug`: string (se genera automáticamente)
- `isFeatured`: boolean (default: false)
- `contactInfo`: Información de contacto
- `location`: Datos de ubicación
- `media`: Multimedia (imágenes, videos)
- `price`: Información de precios
- `extraInfo`: Capacidad, habitaciones, etc.
- `tags`: Array de etiquetas

### Validaciones Específicas

**Teléfono Móvil:**
```typescript
// Debe seguir formato internacional E.164
mobilePhone: "+1234567890" // ✅ Válido
mobilePhone: "+1-234-567-890" // ❌ Inválido (no guiones)
```

**Coordenadas:**
```typescript
latitude: "40.4168"    // ✅ Válido (-90 a 90)
longitude: "-3.7038"   // ✅ Válido (-180 a 180)
```

**Precios:**
```typescript
price: {
    price: 150,           // ✅ Número positivo
    currency: "EUR"       // ✅ Código ISO 4217
}
```

## 🔐 Permisos Requeridos

| Operación | Permiso | Restricciones Adicionales |
|-----------|---------|---------------------------|
| `create` | `ACCOMMODATION_CREATE` | - |
| `getById`, `getBySlug` | `ACCOMMODATION_READ` | Respeta visibilidad |
| `list`, `search` | `ACCOMMODATION_LIST` | Solo públicos para guests |
| `update`, `patch` | `ACCOMMODATION_EDIT` | Solo propietario o admin |
| `softDelete` | `ACCOMMODATION_DELETE` | Solo propietario o admin |
| `hardDelete` | `ACCOMMODATION_DELETE` | Solo admin |
| `restore` | `ACCOMMODATION_EDIT` | Solo propietario o admin |
| FAQ management | `ACCOMMODATION_EDIT` | Solo propietario o admin |
| IA Data management | `ACCOMMODATION_EDIT` | Solo propietario o admin |

### Validación de Propietario

```typescript
// El actor debe ser el propietario o tener rol ADMIN
const canEdit = actor.id === accommodation.ownerId || 
                actor.role === 'ADMIN' ||
                actor.permissions.includes('ACCOMMODATION_ADMIN');
```

## 💡 Ejemplos de Uso

### Crear un Hotel Completo

```typescript
const hotelData = {
    name: "Grand Hotel Barcelona",
    summary: "Hotel de lujo en el corazón de Barcelona",
    description: "El Grand Hotel Barcelona ofrece elegancia y confort excepcional en una ubicación privilegiada del Passeig de Gràcia...",
    type: "HOTEL",
    destinationId: "dest_barcelona",
    ownerId: "user_123",
    
    contactInfo: {
        mobilePhone: "+34666123456",
        personalEmail: "info@grandhotelbarcelona.com",
        website: "https://grandhotelbarcelona.com"
    },
    
    location: {
        country: "España",
        state: "Cataluña", 
        city: "Barcelona",
        zipCode: "08007",
        address: "Passeig de Gràcia, 101",
        latitude: "41.3851",
        longitude: "2.1734"
    },
    
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/hotel-exterior.jpg",
            moderationState: "APPROVED"
        },
        gallery: [
            {
                url: "https://images.unsplash.com/hotel-lobby.jpg",
                moderationState: "APPROVED"
            }
        ]
    },
    
    price: {
        price: 280,
        currency: "EUR"
    },
    
    extraInfo: {
        capacity: 6,
        bedrooms: 3,
        bathrooms: 2,
        minNights: 1,
        maxNights: 30,
        smokingAllowed: false
    },
    
    tags: ["lujo", "centro", "wifi", "piscina"]
};

const result = await accommodationService.create(actor, hotelData);
```

### Búsqueda con Filtros

```typescript
// Buscar hoteles en Madrid bajo 200€
const searchResult = await accommodationService.searchWithRelations(actor, {
    q: "hotel centro",
    type: "HOTEL",
    destinationId: "dest_madrid",
    maxPrice: 200,
    isFeatured: true,
    page: 1,
    pageSize: 10
});

// Procesar resultados
if (searchResult.data) {
    searchResult.data.items.forEach(hotel => {
        console.log(`${hotel.name} - €${hotel.price?.price}/noche`);
        console.log(`Rating: ${hotel.averageRating} (${hotel.reviewsCount} reseñas)`);
        console.log(`Destino: ${hotel.destination?.name}`);
    });
}
```

### Gestión de FAQs

```typescript
// Agregar FAQ
const faqResult = await accommodationService.addFaq(actor, {
    accommodationId: "acc_789",
    question: "¿Incluye desayuno?",
    answer: "Sí, el desayuno buffet está incluido en todas nuestras tarifas.",
    order: 1
});

// Listar todas las FAQs
const faqsResult = await accommodationService.getFaqs(actor, {
    accommodationId: "acc_789"
});
```

### Actualización de Precios

```typescript
// Actualizar solo el precio
const updateResult = await accommodationService.patch(actor, "acc_789", {
    price: {
        price: 195,
        currency: "EUR"
    }
});
```

### Obtener Estadísticas

```typescript
// Obtener estadísticas detalladas
const statsResult = await accommodationService.getStats(actor, {
    id: "acc_789"
});

if (statsResult.data) {
    console.log(`Promedio de rating: ${statsResult.data.averageRating}`);
    console.log(`Total de reseñas: ${statsResult.data.totalReviews}`);
    console.log(`Tasa de ocupación: ${statsResult.data.occupancyRate * 100}%`);
}

// Obtener top alojamientos por destino
const topRatedResult = await accommodationService.getTopRatedByDestination(actor, {
    destinationId: "dest_madrid",
    limit: 5
});
```

## 🚨 Manejo de Errores Comunes

### Errores de Validación

```typescript
// Error por teléfono inválido
{
    error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed: contactInfo: zodError.common.contact.mobilePhone.international",
        details: {
            fieldErrors: {
                contactInfo: ["Phone must be in international format"]
            }
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
        message: "Actor lacks required permission: ACCOMMODATION_EDIT"
    }
}
```

### Errores de Entidad

```typescript
// Error por alojamiento no encontrado
{
    error: {
        code: "NOT_FOUND",
        message: "Accommodation not found",
        details: { id: "invalid_id" }
    }
}
```

---

**Nota**: Para casos de uso específicos o integraciones personalizadas, consulta la [Guía de Desarrollo](../desarrollo/README.md) o contacta al equipo de backend.