# Accommodation Review Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Búsquedas y Listados](#busquedas-y-listados)
- [Métricas y Estadísticas](#metricas-y-estadisticas)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `AccommodationReviewService` gestiona las reseñas y calificaciones de alojamientos. Proporciona un sistema completo de evaluación que permite a los huéspedes compartir experiencias y ayuda a futuros viajeros en sus decisiones de reserva.

### Entidad AccommodationReview

Una reseña de alojamiento incluye:

- **Evaluación**: Calificación numérica y comentarios escritos
- **Autor**: Usuario que escribió la reseña (con información de perfil)
- **Alojamiento**: Referencia al alojamiento evaluado
- **Detalles**: Fecha de estadía, tipo de habitación, motivo de viaje
- **Aspectos**: Calificaciones específicas (limpieza, servicio, ubicación, etc.)
- **Metadatos**: Fecha de publicación, estado de moderación

### Casos de Uso

- **Sistema de Reputación**: Calificaciones para alojamientos
- **Decisión de Reserva**: Información para futuros huéspedes
- **Mejora de Calidad**: Feedback para propietarios
- **Ranking de Alojamientos**: Ordenamiento por calidad

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: AccommodationReviewCreateInput)

Crea una nueva reseña de alojamiento.

**Ejemplo:**

```typescript
{
    accommodationId: "acc_hotel_palermo",
    rating: 4.5,
    title: "Excelente ubicación y servicio",
    content: "Hotel muy bien ubicado en el corazón de Palermo. Staff amable y habitaciones limpias. El desayuno podría mejorar pero en general muy recomendable.",
    stayDate: "2024-01-15",
    roomType: "Suite Junior",
    travelPurpose: "LEISURE",
    aspectRatings: {
        cleanliness: 5,
        service: 4,
        location: 5,
        value: 4,
        amenities: 4
    },
    wouldRecommend: true
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene reseña por ID
- `list(actor, params)` - Lista reseñas con filtros
- `update/patch(actor, id, input)` - Actualiza reseña
- `softDelete/hardDelete(actor, id)` - Elimina reseña

## 🔍 Búsquedas y Listados {#busquedas-y-listados}

### listByAccommodation(actor: Actor, params: AccommodationReviewListByAccommodationParams)

Lista reseñas de un alojamiento específico con estadísticas.

**Parámetros:**

```typescript
{
    accommodationId: string;
    page?: number;
    pageSize?: number;
    sortBy?: "date" | "rating" | "helpful";
    sortOrder?: "asc" | "desc";
    filters?: {
        rating?: { min?: number; max?: number };
        verified?: boolean;
        language?: string;
    }
}
```

**Respuesta con Estadísticas:**

```typescript
{
    data: {
        items: [/* reseñas */],
        total: 156,
        stats: {
            averageRating: 4.3,
            totalReviews: 156,
            ratingDistribution: {
                "5": 45,
                "4": 67,
                "3": 32,
                "2": 8,
                "1": 4
            },
            aspectAverages: {
                cleanliness: 4.5,
                service: 4.2,
                location: 4.7,
                value: 4.0,
                amenities: 4.1
            }
        }
    }
}
```

### listWithUser(actor: Actor, params: AccommodationReviewListWithUserParams)

Lista reseñas con información del usuario autor.

### search(actor: Actor, params: AccommodationReviewSearchParams)

Búsqueda avanzada de reseñas con múltiples filtros.

## 📊 Métricas y Estadísticas {#metricas-y-estadisticas}

### Cálculo de Estadísticas

```typescript
// Estadísticas automáticas por alojamiento
const accommodationStats = {
    averageRating: 4.3,        // Promedio general
    totalReviews: 156,         // Total de reseñas
    ratingDistribution: {      // Distribución por estrellas
        "5": 45, "4": 67, "3": 32, "2": 8, "1": 4
    },
    aspectAverages: {          // Promedios por aspecto
        cleanliness: 4.5,
        service: 4.2,
        location: 4.7,
        value: 4.0,
        amenities: 4.1
    },
    recentTrend: "improving",  // Tendencia reciente
    recommendationRate: 87     // % que recomendaría
};
```

### Filtros Avanzados

```typescript
// Reseñas de alto rating
const excellentReviews = await accommodationReviewService.search(actor, {
    filters: {
        rating: { min: 4.5, max: 5.0 },
        verified: true
    }
});

// Reseñas recientes
const recentReviews = await accommodationReviewService.search(actor, {
    filters: {
        dateRange: {
            from: "2024-01-01",
            to: "2024-03-31"
        }
    },
    sortBy: "date",
    sortOrder: "desc"
});

// Reseñas por propósito de viaje
const businessReviews = await accommodationReviewService.search(actor, {
    filters: {
        travelPurpose: "BUSINESS"
    }
});
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### AccommodationReviewCreateInput

**Campos Requeridos:**

- `accommodationId`: string (ID del alojamiento)
- `rating`: number (1.0 - 5.0)
- `content`: string (comentario escrito)

**Campos Opcionales:**

- `title`: string (título de la reseña)
- `stayDate`: date (fecha de estadía)
- `roomType`: string (tipo de habitación)
- `travelPurpose`: enum (motivo del viaje)
- `aspectRatings`: objeto con calificaciones específicas
- `wouldRecommend`: boolean
- `photos`: array de URLs de fotos

### Validaciones Específicas

- Rating: Debe estar entre 1.0 y 5.0
- Contenido: Mínimo 50 caracteres, máximo 2000
- Fecha de estadía: No puede ser futura
- Un usuario solo puede reseñar un alojamiento una vez

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | Usuario autenticado | Solo propias reseñas |
| `getById`, `list` | Público | Reseñas aprobadas |
| `update` | Usuario autor | Solo propias reseñas |
| `delete` | Usuario autor o Admin | Moderación |

### Políticas de Moderación

- Reseñas automáticamente visibles para usuarios verificados
- Revisión manual para nuevos usuarios
- Detección automática de contenido inapropiado
- Sistema de reportes por parte de la comunidad

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Dashboard de Reseñas para Alojamiento

```typescript
// Vista completa de reseñas para un hotel
const hotelReviews = await accommodationReviewService.listByAccommodation(actor, {
    accommodationId: "acc_hotel_boutique",
    page: 1,
    pageSize: 10,
    sortBy: "date",
    sortOrder: "desc"
});

// Mostrar estadísticas
console.log(`Calificación promedio: ${hotelReviews.data.stats.averageRating}/5`);
console.log(`Total de reseñas: ${hotelReviews.data.stats.totalReviews}`);
console.log(`Tasa de recomendación: ${hotelReviews.data.stats.recommendationRate}%`);
```

### Sistema de Análisis de Tendencias

```typescript
// Análisis de rendimiento mensual
async function getMonthlyPerformance(accommodationId: string, year: number) {
    const monthlyStats = [];
    
    for (let month = 1; month <= 12; month++) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
        
        const reviews = await accommodationReviewService.search(actor, {
            filters: {
                accommodationId,
                dateRange: { from: startDate, to: endDate }
            }
        });
        
        const avgRating = reviews.data.items.reduce((sum, review) => 
            sum + review.rating, 0) / reviews.data.items.length;
            
        monthlyStats.push({
            month: month,
            reviewCount: reviews.data.total,
            averageRating: avgRating || 0,
            trend: calculateTrend(avgRating, monthlyStats[month - 2]?.averageRating)
        });
    }
    
    return monthlyStats;
}
```

### Generador de Reportes de Calidad

```typescript
// Reporte de satisfacción del cliente
async function generateSatisfactionReport(accommodationId: string) {
    const allReviews = await accommodationReviewService.listByAccommodation(actor, {
        accommodationId,
        pageSize: 1000
    });
    
    const report = {
        summary: allReviews.data.stats,
        strengths: [],
        improvements: [],
        keyInsights: []
    };
    
    // Identificar fortalezas (aspectos con rating > 4.0)
    Object.entries(allReviews.data.stats.aspectAverages).forEach(([aspect, rating]) => {
        if (rating > 4.0) {
            report.strengths.push({ aspect, rating, status: 'excellent' });
        } else if (rating < 3.5) {
            report.improvements.push({ aspect, rating, priority: 'high' });
        }
    });
    
    // Análisis de comentarios frecuentes
    const commonPhrases = analyzeCommonPhrases(
        allReviews.data.items.map(review => review.content)
    );
    
    report.keyInsights = commonPhrases;
    
    return report;
}
```

---

**Nota**: El AccommodationReviewService es fundamental para el sistema de confianza y calidad, proporcionando transparencia en las evaluaciones y ayudando tanto a huéspedes como propietarios a tomar decisiones informadas.
