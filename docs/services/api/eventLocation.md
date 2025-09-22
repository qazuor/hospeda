# Event Location Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Búsquedas y Filtros](#busquedas-y-filtros)
- [Gestión de Ubicaciones](#gestion-de-ubicaciones)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `EventLocationService` gestiona las ubicaciones donde se realizan eventos. Proporciona un sistema detallado de direcciones y coordenadas geográficas para facilitar la localización precisa de eventos turísticos, culturales y de entretenimiento.

### Entidad EventLocation

Una ubicación de evento incluye:

- **Dirección Completa**: Calle, número, piso, apartamento
- **Ubicación Geográfica**: Ciudad, departamento, país, barrio
- **Coordenadas**: Latitud, longitud para mapas precisos
- **Identificación**: Nombre del lugar, referencias adicionales
- **Metadatos**: Información de auditoría y ciclo de vida

### Casos de Uso

- **Eventos Culturales**: Teatros, museos, centros culturales
- **Eventos Deportivos**: Estadios, complejos deportivos, canchas
- **Conferencias**: Centros de convenciones, hoteles, universidades
- **Festivales**: Parques, plazas, espacios al aire libre
- **Eventos Privados**: Salones, residencias, espacios únicos

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: EventLocationCreateInput)

Crea una nueva ubicación para eventos.

**Ejemplo:**
```typescript
{
    placeName: "Centro Cultural Recoleta",
    street: "Junín",
    number: "1930",
    neighborhood: "Recoleta",
    city: "Buenos Aires",
    department: "Ciudad Autónoma de Buenos Aires",
    country: "Argentina",
    state: "Buenos Aires",
    latitude: -34.5875,
    longitude: -58.3974,
    postalCode: "C1113AAX"
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene ubicación por ID
- `list(actor, params)` - Lista ubicaciones con filtros
- `update/patch(actor, id, input)` - Actualiza ubicación
- `softDelete/hardDelete(actor, id)` - Elimina ubicación

## 🔍 Búsquedas y Filtros {#busquedas-y-filtros}

### searchForList(actor: Actor, params: EventLocationSearchInput)

Búsqueda avanzada de ubicaciones con soporte para texto libre.

**Parámetros:**
```typescript
{
    q?: string;              // Búsqueda de texto libre
    filters?: {
        city?: string;       // Filtro por ciudad
        state?: string;      // Filtro por estado/provincia
        country?: string;    // Filtro por país
    };
    page?: number;
    pageSize?: number;
}
```

**Búsqueda de Texto Libre (q)**
Busca en múltiples campos:
- `city` (ciudad)
- `state` (estado/provincia)  
- `country` (país)
- `placeName` (nombre del lugar)

**Ejemplo:**
```typescript
// Buscar "Buenos Aires" en cualquier campo
const locations = await eventLocationService.searchForList(actor, {
    q: "Buenos Aires",
    page: 1,
    pageSize: 20
});

// Filtrar por ciudad específica
const buenosAiresLocations = await eventLocationService.searchForList(actor, {
    filters: { city: "Buenos Aires" },
    pageSize: 50
});
```

### Búsquedas Especializadas

```typescript
// Ubicaciones por región
const argentinaLocations = await eventLocationService.searchForList(actor, {
    filters: { country: "Argentina" }
});

// Centros culturales
const culturalCenters = await eventLocationService.searchForList(actor, {
    q: "centro cultural"
});

// Espacios al aire libre
const outdoorSpaces = await eventLocationService.searchForList(actor, {
    q: "parque plaza"
});
```

## 📍 Gestión de Ubicaciones {#gestion-de-ubicaciones}

### Estructura de Dirección Completa

```typescript
const completeLocation = {
    // Información del lugar
    placeName: "Teatro Nacional Cervantes",
    
    // Dirección detallada
    street: "Libertad",
    number: "815",
    floor: "PB",           // Planta baja
    apartment: undefined,  // No aplica para teatros
    
    // Ubicación geográfica
    neighborhood: "San Nicolás",
    city: "Buenos Aires",
    department: "Ciudad Autónoma de Buenos Aires",
    state: "Buenos Aires",
    country: "Argentina",
    postalCode: "C1012AAR",
    
    // Coordenadas GPS
    latitude: -34.6013,
    longitude: -58.3845
};
```

### Validaciones de Ubicación

- **Coordenadas GPS**: Latitud [-90, 90], longitud [-180, 180]
- **Códigos Postales**: Formato según país
- **Direcciones**: Campos opcionales pero estructurados
- **Nombres de Lugar**: Únicos por combinación ciudad/dirección

### Normalización Automática

El service aplica normalización automática:
- Capitalización de nombres de ciudades
- Formato estándar de direcciones
- Validación de coordenadas geográficas
- Limpieza de espacios extra en textos

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### EventLocationCreateInput

**Campos Base (heredados de BaseLocationSchema):**
- `latitude`: number (opcional)
- `longitude`: number (opcional)
- `postalCode`: string (opcional)

**Campos Específicos:**
- `street`: string (2-50 caracteres, opcional)
- `number`: string (1-10 caracteres, opcional)
- `floor`: string (1-10 caracteres, opcional)
- `apartment`: string (1-10 caracteres, opcional)
- `neighborhood`: string (2-50 caracteres, opcional)
- `city`: string (2-50 caracteres, opcional)
- `department`: string (2-50 caracteres, opcional)
- `placeName`: string (2-100 caracteres, opcional)

### Validaciones Especiales

```typescript
// Dirección mínima válida
{
    city: "Buenos Aires",
    country: "Argentina"
}

// Dirección completa
{
    placeName: "Palacio San Martín",
    street: "Arenales",
    number: "761",
    neighborhood: "Retiro",
    city: "Buenos Aires",
    department: "Ciudad Autónoma de Buenos Aires",
    state: "Buenos Aires",
    country: "Argentina",
    latitude: -34.5945,
    longitude: -58.3776
}
```

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | `EVENT_LOCATION_UPDATE` | Content Manager+ |
| `getById`, `list` | Actor válido | Usuario autenticado |
| `update`, `patch` | `EVENT_LOCATION_UPDATE` | Content Manager+ |
| `delete` | `EVENT_LOCATION_UPDATE` | Content Manager+ |
| `search`, `count` | Actor válido | Usuario autenticado |

### Características de Permisos

- **Lectura Pública**: Cualquier usuario autenticado puede consultar ubicaciones
- **Gestión Restringida**: Solo Content Manager+ puede crear/editar/eliminar
- **Sin Actor**: Todas las operaciones requieren usuario autenticado
- **Permisos Unificados**: Un solo permiso (`EVENT_LOCATION_UPDATE`) para todas las operaciones de escritura

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear Red de Ubicaciones Culturales

```typescript
const culturalLocations = [
    {
        placeName: "Teatro Colón",
        street: "Cerrito",
        number: "628",
        neighborhood: "San Nicolás",
        city: "Buenos Aires",
        department: "Ciudad Autónoma de Buenos Aires",
        country: "Argentina",
        latitude: -34.6010,
        longitude: -58.3835
    },
    {
        placeName: "Museo Nacional de Bellas Artes",
        street: "Av. del Libertador",
        number: "1473",
        neighborhood: "Recoleta",
        city: "Buenos Aires",
        department: "Ciudad Autónoma de Buenos Aires", 
        country: "Argentina",
        latitude: -34.5835,
        longitude: -58.3929
    },
    {
        placeName: "Centro Cultural Usina del Arte",
        street: "Agustín R. Caffarena",
        number: "1",
        neighborhood: "La Boca",
        city: "Buenos Aires",
        department: "Ciudad Autónoma de Buenos Aires",
        country: "Argentina",
        latitude: -34.6345,
        longitude: -58.3634
    }
];

for (const location of culturalLocations) {
    await eventLocationService.create(actor, location);
}
```

### Búsqueda y Filtrado Inteligente

```typescript
// Buscador de ubicaciones por proximidad
async function findNearbyLocations(searchTerm: string, region?: string) {
    const baseParams = {
        q: searchTerm,
        pageSize: 20
    };
    
    // Agregar filtro regional si se especifica
    if (region) {
        baseParams.filters = { city: region };
    }
    
    return await eventLocationService.searchForList(actor, baseParams);
}

// Ejemplos de uso
const museums = await findNearbyLocations("museo", "Buenos Aires");
const theaters = await findNearbyLocations("teatro");
const parks = await findNearbyLocations("parque", "Córdoba");
```

### Sistema de Recomendación de Ubicaciones

```typescript
// Sugerir ubicaciones por tipo de evento
async function suggestLocationsByEventType(eventType: string, city?: string) {
    const locationKeywords = {
        "cultural": ["teatro", "museo", "centro cultural", "galería"],
        "deportivo": ["estadio", "cancha", "complejo deportivo", "club"],
        "conferencia": ["centro convenciones", "hotel", "universidad", "auditorio"],
        "festival": ["parque", "plaza", "costanera", "espacio abierto"],
        "gastronómico": ["restaurant", "mercado", "food court", "patio"]
    };
    
    const keywords = locationKeywords[eventType] || [];
    const suggestions = [];
    
    for (const keyword of keywords) {
        const results = await eventLocationService.searchForList(actor, {
            q: keyword,
            filters: city ? { city } : undefined,
            pageSize: 5
        });
        suggestions.push(...results.items);
    }
    
    // Remover duplicados y retornar top 10
    const unique = suggestions.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
    );
    
    return unique.slice(0, 10);
}
```

### Dashboard de Ubicaciones

```typescript
// Análisis geográfico de ubicaciones
const locationAnalytics = {
    // Distribución por ciudad
    byCity: await eventLocationService.searchForList(actor, {
        pageSize: 1000 // Obtener todas para análisis
    }).then(result => {
        const cityCount = {};
        result.items.forEach(location => {
            cityCount[location.city] = (cityCount[location.city] || 0) + 1;
        });
        return Object.entries(cityCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
    }),
    
    // Ubicaciones más buscadas
    topSearches: [
        "teatro", "museo", "centro cultural", 
        "estadio", "parque", "hotel"
    ],
    
    // Cobertura geográfica
    coverage: {
        countries: new Set(),
        cities: new Set()
    }
};

// Mapa interactivo de ubicaciones
async function generateLocationMap(filters?: any) {
    const locations = await eventLocationService.searchForList(actor, {
        filters,
        pageSize: 500
    });
    
    return locations.items
        .filter(loc => loc.latitude && loc.longitude)
        .map(loc => ({
            id: loc.id,
            name: loc.placeName,
            coordinates: [loc.longitude, loc.latitude],
            address: `${loc.street} ${loc.number}, ${loc.city}`,
            type: determineLocationType(loc.placeName)
        }));
}

function determineLocationType(placeName: string): string {
    const name = placeName.toLowerCase();
    if (name.includes('teatro')) return 'theater';
    if (name.includes('museo')) return 'museum';
    if (name.includes('centro')) return 'center';
    if (name.includes('estadio')) return 'stadium';
    if (name.includes('parque')) return 'park';
    return 'venue';
}
```

---

**Nota**: El EventLocationService proporciona la base geográfica para el sistema de eventos, permitiendo localización precisa y búsquedas inteligentes para facilitar la planificación y promoción de eventos turísticos.
