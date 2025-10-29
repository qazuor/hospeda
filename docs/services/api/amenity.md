# Amenity Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Gestión de Relaciones con Alojamientos](#gestion-de-relaciones-con-alojamientos)
- [Tipos de Amenidades](#tipos-de-amenidades)
- [Búsquedas y Filtros](#busquedas-y-filtros)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `AmenityService` gestiona las comodidades y servicios disponibles en alojamientos. Las amenidades representan características físicas, servicios y facilidades que ofrecen los alojamientos como WiFi, piscina, gimnasio, etc. Proporciona operaciones CRUD completas y gestión de relaciones con alojamientos.

### Entidad Amenity

Una amenidad incluye:
/db/tsup.config.ts

- **Información Básica**: Nombre, slug, descripción
- **Clasificación**: Tipo (básica, premium, etc.), categoría
- **Presentación**: Ícono, color, orden de visualización
- **Precio**: Coste adicional si aplica
- **Relaciones**: Asociaciones con alojamientos específicos
- **Disponibilidad**: Estado, visibilidad, restricciones

### Tipos de Amenidades

```typescript
```typescript
enum AmenitiesType {
    BASIC = "BASIC",           // Servicios básicos gratuitos
    PREMIUM = "PREMIUM",       // Servicios premium con coste
    RECREATIONAL = "RECREATIONAL", // Entretenimiento y ocio
    BUSINESS = "BUSINESS",     // Servicios de negocios
    WELLNESS = "WELLNESS",     // Bienestar y salud
    ACCESSIBILITY = "ACCESSIBILITY", // Accesibilidad
    SAFETY = "SAFETY",         // Seguridad
    TRANSPORT = "TRANSPORT",   // Transporte y movilidad
    DINING = "DINING",         // Restauración
    OTHER = "OTHER"            // Otros servicios
}
```

```

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: AmenityCreateInput)

Crea una nueva amenidad.

**Ejemplo:**
```typescript
{
    name: "WiFi Gratuito",
    description: "Conexión a internet inalámbrica de alta velocidad",
    type: "BASIC",
    icon: "wifi",
    price: null, // Gratuito
    isAvailable: true
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene amenidad por ID
- `getBySlug(actor, slug)` - Obtiene amenidad por slug
- `list(actor, params)` - Lista amenidades con filtros
- `update/patch(actor, id, input)` - Actualiza amenidad
- `softDelete/hardDelete(actor, id)` - Elimina amenidad

## 🏨 Gestión de Relaciones con Alojamientos {#gestion-de-relaciones-con-alojamientos}

### addToAccommodation(actor: Actor, params: AmenityAddToAccommodationInput)

Asocia una amenidad con un alojamiento.

**Parámetros:**

```typescript
{
    amenityId: string;
    accommodationId: string;
    price?: {                // Precio específico para este alojamiento
        amount: number;
        currency: string;
    };
    isAvailable?: boolean;   // Disponibilidad en este alojamiento
    notes?: string;          // Notas específicas
}
```

**Ejemplo:**

```typescript
// Añadir spa con precio personalizado
await amenityService.addToAccommodation(actor, {
    amenityId: "amenity_spa",
    accommodationId: "acc_hotel_luxury",
    price: {
        amount: 50.00,
        currency: "EUR"
    },
    notes: "Disponible de 9:00 a 22:00"
});
```

### removeFromAccommodation(actor: Actor, params: AmenityRemoveFromAccommodationInput)

Remueve la asociación entre amenidad y alojamiento.

### getForAccommodation(actor: Actor, params: AmenityGetForAccommodationInput)

Obtiene todas las amenidades de un alojamiento específico.

**Respuesta:**

```typescript
{
    data: {
        accommodationId: "acc_hotel_beach",
        amenities: [
            {
                id: "amenity_wifi",
                name: "WiFi Gratuito",
                type: "BASIC",
                price: null,
                isAvailable: true
            },
            {
                id: "amenity_pool",
                name: "Piscina",
                type: "RECREATIONAL",
                price: null,
                isAvailable: true
            }
        ],
        totalAmenities: 2
    }
}
```

### getAccommodations(actor: Actor, params: AmenityGetAccommodationsInput)

Obtiene todos los alojamientos que tienen una amenidad específica.

**Ejemplo:**

```typescript
// Hoteles con piscina
const result = await amenityService.getAccommodations(actor, {
    amenityId: "amenity_pool",
    page: 1,
    pageSize: 20
});
```

## 🏷️ Tipos de Amenidades {#tipos-de-amenidades}

### Básicas (BASIC)

- WiFi gratuito
- Aire acondicionado
- Calefacción
- Ropa de cama
- Toallas

### Premium (PREMIUM)

- Spa y wellness
- Servicio de habitaciones 24h
- Conserjería
- Mayordomo personal
- Traslados privados

### Recreativas (RECREATIONAL)

- Piscina
- Gimnasio
- Centro deportivo
- Área de juegos
- Entretenimiento nocturno

### Negocios (BUSINESS)

- Centro de negocios
- Salas de reuniones
- Servicios de secretariado
- Impresión y fotocopiado
- Videoconferencia

### Bienestar (WELLNESS)

- Spa
- Masajes
- Sauna
- Jacuzzi
- Tratamientos de belleza

### Accesibilidad (ACCESSIBILITY)

- Acceso para sillas de ruedas
- Baños adaptados
- Ascensores
- Señalización braille
- Habitaciones adaptadas

## 🔍 Búsquedas y Filtros {#busquedas-y-filtros}

### Parámetros de Búsqueda

```typescript
{
    q?: string;              // Búsqueda por texto
    type?: AmenitiesType;    // Filtro por tipo
    isAvailable?: boolean;   // Solo disponibles
    hasPricing?: boolean;    // Con/sin coste adicional
    accommodationId?: string; // Amenidades de alojamiento específico
    page?: number;
    pageSize?: number;
}
```

### Búsquedas Populares

```typescript
// Amenidades gratuitas básicas
const basicFree = await amenityService.list(actor, {
    type: "BASIC",
    hasPricing: false
});

// Servicios premium
const premium = await amenityService.list(actor, {
    type: "PREMIUM",
    isAvailable: true
});

// Amenidades de wellness
const wellness = await amenityService.list(actor, {
    type: "WELLNESS"
});
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### AmenityCreateInput

**Campos Requeridos:**

- `name`: string (3-100 caracteres)
- `type`: AmenitiesType enum

**Campos Opcionales:**

- `description`: string (hasta 500 caracteres)
- `icon`: string (nombre del ícono)
- `price`: objeto de precio
- `isAvailable`: boolean (default: true)

### Validaciones

- Slug único generado desde name
- Precio válido si se especifica
- Tipo de amenidad válido
- Ícono de conjunto predefinido

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | `AMENITY_CREATE` | Solo admin |
| `getById`, `list` | `AMENITY_READ` | Público |
| `update`, `patch` | `AMENITY_EDIT` | Solo admin |
| `delete` | `AMENITY_DELETE` | Solo admin |
| `addToAccommodation` | `ACCOMMODATION_EDIT` | Host o admin |
| `removeFromAccommodation` | `ACCOMMODATION_EDIT` | Host o admin |

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear Set de Amenidades Básicas

```typescript
const basicAmenities = [
    {
        name: "WiFi Gratuito",
        type: "BASIC",
        icon: "wifi",
        description: "Internet inalámbrico de alta velocidad"
    },
    {
        name: "Aire Acondicionado", 
        type: "BASIC",
        icon: "ac",
        description: "Climatización en todas las habitaciones"
    },
    {
        name: "Piscina",
        type: "RECREATIONAL", 
        icon: "pool",
        description: "Piscina al aire libre"
    }
];

for (const amenity of basicAmenities) {
    await amenityService.create(actor, amenity);
}
```

### Configurar Amenidades de Hotel

```typescript
const hotelId = "acc_hotel_beach_resort";
const amenities = [
    { id: "amenity_wifi", price: null },
    { id: "amenity_pool", price: null },
    { 
        id: "amenity_spa", 
        price: { amount: 75, currency: "EUR" },
        notes: "Reserva previa requerida"
    }
];

for (const amenity of amenities) {
    await amenityService.addToAccommodation(actor, {
        amenityId: amenity.id,
        accommodationId: hotelId,
        price: amenity.price,
        notes: amenity.notes
    });
}
```

### Dashboard de Amenidades

```typescript
// Estadísticas de uso
const stats = {
    // Amenidades más populares
    popular: await amenityService.list(actor, {
        sortBy: "usage",
        sortOrder: "desc",
        pageSize: 10
    }),
    
    // Por tipo
    byType: {},
    
    // Amenidades premium más caras
    expensive: await amenityService.list(actor, {
        type: "PREMIUM",
        hasPricing: true,
        sortBy: "price",
        sortOrder: "desc"
    })
};

// Llenar estadísticas por tipo
for (const type of Object.values(AmenitiesType)) {
    stats.byType[type] = await amenityService.count(actor, { type });
}
```

---

**Nota**: El AmenityService es esencial para la caracterización detallada de alojamientos, permitiendo a los huéspedes filtrar y seleccionar propiedades basándose en los servicios y comodidades que necesitan.
