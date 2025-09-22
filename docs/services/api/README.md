# Documentación de API - Servicios Hospeda

## 📋 Índice

- [Visión General](#visión-general)
- [Patrón de Respuesta](#patrón-de-respuesta)
- [Códigos de Error](#códigos-de-error)
- [Autenticación y Permisos](#autenticación-y-permisos)
- [Servicios Disponibles](#servicios-disponibles)
- [Casos de Uso Comunes](#casos-de-uso-comunes)
- [Ejemplos de Integración](#ejemplos-de-integración)

## 🎯 Visión General

Los servicios de Hospeda proporcionan una API robusta y consistente para gestionar todos los aspectos de la plataforma de turismo. Cada servicio sigue patrones estandarizados para validación, autorización, logging y manejo de errores.

### Características Principales

- **🔒 Seguridad por Defecto**: Validación de permisos en todas las operaciones
- **✅ Validación Estricta**: Esquemas Zod para validación de entrada y salida
- **📊 Respuestas Consistentes**: Formato estándar para todas las respuestas
- **🚨 Manejo de Errores**: Códigos de error específicos y mensajes descriptivos
- **🔄 Operaciones Transaccionales**: Soporte para operaciones complejas
- **📄 Paginación**: Paginación consistente en todas las listas

## 🔧 Patrón de Respuesta

Todas las operaciones de servicio devuelven un `ServiceResult<T>` con este formato:

```typescript
interface ServiceResult<T> {
    data?: T;           // Datos de respuesta (si es exitoso)
    error?: {           // Información de error (si falla)
        code: ServiceErrorCode;
        message: string;
        details?: unknown;
    };
}
```

### Ejemplos de Respuestas

**✅ Operación Exitosa:**
```typescript
{
    data: {
        id: "acc_123",
        name: "Hotel Ejemplo",
        type: "HOTEL",
        // ... más propiedades
    }
}
```

**❌ Operación Fallida:**
```typescript
{
    error: {
        code: "NOT_FOUND",
        message: "Accommodation not found",
        details: { id: "invalid_id" }
    }
}
```

## 🚨 Códigos de Error

| Código | Descripción | Cuándo Ocurre |
|--------|-------------|---------------|
| `VALIDATION_ERROR` | Error de validación de entrada | Datos inválidos o faltantes |
| `FORBIDDEN` | Sin permisos suficientes | Actor sin permisos requeridos |
| `NOT_FOUND` | Recurso no encontrado | ID/slug no existe |
| `ALREADY_EXISTS` | Recurso ya existe | Conflicto de datos únicos |
| `INTERNAL_ERROR` | Error interno del sistema | Fallos de base de datos, etc. |
| `RATE_LIMIT_EXCEEDED` | Límite de velocidad excedido | Demasiadas peticiones |

## 🔐 Autenticación y Permisos

### Sistema de Actores

Los servicios utilizan un sistema de **Actor** que representa al usuario o entidad que ejecuta la operación:

```typescript
interface Actor {
    id: string;                    // ID del usuario
    role: UserRole;               // Rol (GUEST, USER, HOST, ADMIN)
    permissions: Permission[];     // Lista de permisos específicos
    email?: string;               // Email del usuario
    isAuthenticated: boolean;     // Estado de autenticación
}
```

### Tipos de Permisos

Los permisos siguen el patrón `{ENTITY}_{ACTION}`:

- **Lectura**: `ACCOMMODATION_READ`, `DESTINATION_READ`
- **Creación**: `ACCOMMODATION_CREATE`, `EVENT_CREATE`
- **Edición**: `ACCOMMODATION_EDIT`, `USER_EDIT`
- **Eliminación**: `ACCOMMODATION_DELETE`, `POST_DELETE`
- **Listado**: `ACCOMMODATION_LIST`, `USER_LIST`

## 📚 Servicios Disponibles

### 🏨 [Accommodation Service](./accommodation.md)
**Gestión de alojamientos (hoteles, casas, apartamentos)**

- ✅ **CRUD Completo**: Crear, leer, actualizar, eliminar alojamientos
- 🔍 **Búsqueda Avanzada**: Por destino, tipo, características, precio
- 📊 **Estadísticas**: Métricas de ocupación, ratings, reviews
- 📝 **FAQs**: Gestión de preguntas frecuentes
- 🏷️ **Etiquetas**: Sistema de categorización

### 🌟 [AccommodationReview Service](./accommodation-review.md)
**Sistema de reseñas para alojamientos**

- ⭐ **Calificaciones**: Sistema de 1-5 estrellas
- 💬 **Comentarios**: Reseñas detalladas de huéspedes
- 📊 **Agregación**: Cálculo automático de ratings promedio
- 🔒 **Moderación**: Control de contenido inapropiado

### 🛎️ [Amenity Service](./amenity.md)
**Gestión de amenidades y comodidades**

- 🏊 **Categorías**: Piscina, WiFi, Parking, etc.
- 🔧 **CRUD**: Operaciones completas de amenidades
- 🏨 **Asociaciones**: Vinculación con alojamientos

### 🎯 [Attraction Service](./attraction.md)
**Atracciones turísticas y puntos de interés**

- 🗺️ **Geolocalización**: Ubicaciones con coordenadas
- 📸 **Multimedia**: Imágenes y descripciones
- 🎫 **Categorización**: Tipos de atracciones

### 🌍 [Destination Service](./destination.md)
**Destinos turísticos y geografía**

- 🗺️ **Jerarquía Geográfica**: Países, estados, ciudades
- 🏨 **Alojamientos**: Listado por destino
- 📊 **Estadísticas**: Métricas de destinos
- ⭐ **Destacados**: Destinos populares

### 🌟 [DestinationReview Service](./destination-review.md)
**Reseñas de destinos turísticos**

- ⭐ **Calificaciones**: Ratings de destinos
- 📝 **Experiencias**: Reseñas de viajeros
- 📊 **Agregación**: Estadísticas de rating

### 🎉 [Event Service](./event.md)
**Eventos y actividades programadas**

- 📅 **Calendario**: Gestión de fechas y horarios
- 🎫 **Categorías**: Tipos de eventos
- 📍 **Ubicaciones**: Asociación con venues
- 👥 **Organizadores**: Gestión de responsables

### 📍 [EventLocation Service](./event-location.md)
**Ubicaciones y venues para eventos**

- 🏢 **Venues**: Salones, centros de convenciones
- 📏 **Capacidades**: Límites de asistencia
- 🛠️ **Facilidades**: Equipamiento disponible

### 👤 [EventOrganizer Service](./event-organizer.md)
**Organizadores de eventos**

- 👨‍💼 **Perfiles**: Información de organizadores
- 📊 **Estadísticas**: Historial de eventos
- ✅ **Verificación**: Estado de validación

### ⚡ [Feature Service](./feature.md)
**Características y atributos de alojamientos**

- 🏷️ **Atributos**: Propiedades específicas
- 🔧 **Configurables**: Características personalizables
- 🎯 **Filtros**: Para búsquedas avanzadas

### 🔐 [Permission Service](./permission.md)
**Sistema de permisos y autorización**

- 👤 **Roles**: Gestión de roles de usuario
- 🔑 **Permisos**: Control granular de acceso
- ✅ **Validación**: Verificación de autorizaciones

### 📝 [Post Service](./post.md)
**Sistema de publicaciones y contenido**

- 📰 **Blog**: Artículos y noticias
- 📷 **Multimedia**: Imágenes y videos
- 🎯 **Categorización**: Tipos de contenido
- 💝 **Patrocinios**: Contenido promocional

### 💰 [PostSponsor Service](./post-sponsor.md)
**Patrocinadores de contenido**

- 🏢 **Empresas**: Gestión de patrocinadores
- 💵 **Presupuestos**: Control de inversión
- 📊 **Métricas**: ROI y engagement

### 🤝 [PostSponsorship Service](./post-sponsorship.md)
**Gestión de patrocinios**

- 💼 **Contratos**: Acuerdos de patrocinio
- 📅 **Duraciones**: Períodos de actividad
- 💰 **Facturación**: Gestión de pagos

### 🏷️ [Tag Service](./tag.md)
**Sistema de etiquetas y categorización**

- 🔖 **Etiquetas**: Clasificación de contenido
- 🎯 **Asociaciones**: Vinculación con entidades
- 🔍 **Búsquedas**: Filtrado por tags

### 👥 [User Service](./user.md)
**Gestión de usuarios y perfiles**

- 👤 **Perfiles**: Información personal
- 🔐 **Autenticación**: Gestión de acceso
- 📊 **Estadísticas**: Actividad de usuarios

### ⭐ [UserBookmark Service](./user-bookmark.md)
**Favoritos y marcadores de usuario**

- ❤️ **Favoritos**: Alojamientos marcados
- 📋 **Listas**: Organización de favoritos
- 🔄 **Sincronización**: Entre dispositivos

## 🎯 Casos de Uso Comunes

### 1. Buscar Alojamientos por Destino

```typescript
// 1. Obtener destino
const destination = await destinationService.getBySlug(actor, "madrid");

// 2. Buscar alojamientos
const accommodations = await accommodationService.getByDestination(actor, {
    destinationId: destination.data.id,
    page: 1,
    pageSize: 20
});
```

### 2. Crear una Reseña

```typescript
// 1. Crear la reseña
const review = await accommodationReviewService.create(actor, {
    accommodationId: "acc_123",
    rating: 5,
    comment: "Excelente estadía",
    stayDate: "2024-03-15"
});

// 2. Las estadísticas se actualizan automáticamente
```

### 3. Gestionar Eventos

```typescript
// 1. Crear organizador
const organizer = await eventOrganizerService.create(actor, {
    name: "Eventos Turísticos SA",
    email: "contacto@eventos.com"
});

// 2. Crear ubicación
const location = await eventLocationService.create(actor, {
    name: "Centro de Convenciones",
    capacity: 500
});

// 3. Crear evento
const event = await eventService.create(actor, {
    title: "Festival de Turismo",
    organizerId: organizer.data.id,
    locationId: location.data.id,
    startDate: "2024-06-01",
    endDate: "2024-06-03"
});
```

## 🛠️ Ejemplos de Integración

### Frontend (React/Astro)

```typescript
// Hook para obtener alojamientos
const useAccommodations = (destinationId: string) => {
    const [accommodations, setAccommodations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAccommodations = async () => {
            try {
                const result = await accommodationService.getByDestination(
                    actor, 
                    { destinationId }
                );
                
                if (result.data) {
                    setAccommodations(result.data.accommodations);
                }
            } catch (error) {
                console.error('Error fetching accommodations:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAccommodations();
    }, [destinationId]);

    return { accommodations, loading };
};
```

### API Routes (Hono)

```typescript
// Endpoint para búsqueda de alojamientos
app.get('/accommodations/search', async (c) => {
    const actor = getActorFromContext(c);
    const query = c.req.query();

    const result = await accommodationService.search(actor, {
        q: query.q,
        destinationId: query.destination,
        type: query.type,
        minPrice: query.minPrice ? Number(query.minPrice) : undefined,
        maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
        page: query.page ? Number(query.page) : 1,
        pageSize: query.pageSize ? Number(query.pageSize) : 20
    });

    if (result.error) {
        return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
});
```

### Validación de Datos

```typescript
import { AccommodationCreateInputSchema } from '@repo/schemas';

// Validar entrada antes de llamar al servicio
const validateAndCreateAccommodation = async (rawInput: unknown) => {
    try {
        // Validar con Zod
        const validInput = AccommodationCreateInputSchema.parse(rawInput);
        
        // Llamar al servicio
        const result = await accommodationService.create(actor, validInput);
        
        return result;
    } catch (error) {
        if (error instanceof ZodError) {
            return {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input data',
                    details: error.errors
                }
            };
        }
        throw error;
    }
};
```

## 📊 Mejores Prácticas

### 1. Manejo de Errores

```typescript
const handleServiceResult = <T>(result: ServiceResult<T>) => {
    if (result.error) {
        switch (result.error.code) {
            case 'NOT_FOUND':
                throw new Error('Recurso no encontrado');
            case 'FORBIDDEN':
                throw new Error('Sin permisos suficientes');
            case 'VALIDATION_ERROR':
                throw new Error(`Datos inválidos: ${result.error.message}`);
            default:
                throw new Error('Error interno del sistema');
        }
    }
    return result.data!;
};
```

### 2. Paginación Consistente

```typescript
interface PaginationParams {
    page?: number;        // Página actual (default: 1)
    pageSize?: number;    // Elementos por página (default: 20, max: 100)
}

interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
}
```

### 3. Filtrado y Búsqueda

```typescript
// Todos los servicios con listado soportan estos parámetros
interface SearchParams {
    q?: string;           // Búsqueda por texto
    page?: number;        // Paginación
    pageSize?: number;    // Tamaño de página
    // ... filtros específicos por entidad
}
```

## 🔗 Enlaces Útiles

- **[Guía de Desarrollo](../desarrollo/README.md)**: Para crear nuevos servicios
- **[Esquemas Zod](../../packages/schemas/src/)**: Definiciones de validación
- **[Tipos TypeScript](../../packages/types/src/)**: Interfaces de datos
- **[Ejemplos de API](../../apps/api/src/routes/)**: Implementaciones de referencia

---

**Última actualización**: Septiembre 2025  
**Versión**: 1.0  
**Mantenido por**: Equipo de Backend Hospeda