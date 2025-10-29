# Destination Review Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Búsquedas y Listados](#busquedas-y-listados)
- [Métricas y Estadísticas](#metricas-y-estadisticas)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `DestinationReviewService` gestiona las reseñas y evaluaciones de destinos turísticos. Permite a los viajeros compartir experiencias sobre ciudades, regiones y lugares, ayudando a otros turistas a planificar sus viajes y descubrir nuevos destinos.

### Entidad DestinationReview

Una reseña de destino incluye:

- **Evaluación**: Calificación general y aspectos específicos del destino
- **Experiencia**: Comentarios detallados sobre la visita
- **Autor**: Usuario que escribió la reseña con información de perfil
- **Destino**: Referencia al lugar evaluado
- **Contexto**: Época del año, duración de estadía, tipo de viaje
- **Aspectos**: Calificaciones específicas (cultura, gastronomía, actividades, etc.)
- **Recomendaciones**: Consejos y sugerencias para futuros visitantes

### Casos de Uso

- **Guía de Viaje Colaborativa**: Información de primera mano sobre destinos
- **Planificación de Viajes**: Decisiones informadas sobre dónde ir
- **Promoción Turística**: Reputación y atractivo de destinos
- **Feedback para Autoridades**: Mejoras en infraestructura turística

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: DestinationReviewCreateInput)

Crea una nueva reseña de destino.

**Ejemplo:**

```typescript
{
    destinationId: "dest_mendoza",
    rating: 4.7,
    title: "Mendoza: Capital mundial del vino y paisajes únicos",
    content: "Mendoza superó todas mis expectativas. La combinación de bodegas de clase mundial, paisajes de montaña espectaculares y gastronomía excepcional la convierte en un destino imperdible. La hospitalidad de los mendocinos es extraordinaria.",
    visitDate: "2024-02-15",
    stayDuration: 7,
    travelType: "LEISURE",
    seasonVisited: "SUMMER",
    aspectRatings: {
        culture: 4.5,
        gastronomy: 5.0,
        activities: 4.8,
        safety: 4.2,
        transportation: 3.8,
        accommodation: 4.6,
        value: 4.4
    },
    wouldRecommend: true,
    bestTimeToVisit: ["SPRING", "SUMMER", "FALL"],
    recommendedDuration: 5
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene reseña por ID
- `list(actor, params)` - Lista reseñas con filtros
- `update/patch(actor, id, input)` - Actualiza reseña
- `softDelete/hardDelete(actor, id)` - Elimina reseña

## 🔍 Búsquedas y Listados {#busquedas-y-listados}

### listByDestination(actor: Actor, params: DestinationReviewListByDestinationParams)

Lista reseñas de un destino específico con estadísticas completas.

**Parámetros:**

```typescript
{
    destinationId: string;
    page?: number;
    pageSize?: number;
    sortBy?: "date" | "rating" | "helpful" | "duration";
    sortOrder?: "asc" | "desc";
    filters?: {
        rating?: { min?: number; max?: number };
        season?: "SPRING" | "SUMMER" | "FALL" | "WINTER";
        travelType?: "LEISURE" | "BUSINESS" | "ADVENTURE" | "FAMILY";
        stayDuration?: { min?: number; max?: number };
    }
}
```

**Respuesta con Estadísticas:**

```typescript
{
    data: {
        items: [/* reseñas */],
        total: 234,
        stats: {
            averageRating: 4.4,
            totalReviews: 234,
            ratingDistribution: {
                "5": 89,
                "4": 98,
                "3": 35,
                "2": 9,
                "1": 3
            },
            aspectAverages: {
                culture: 4.3,
                gastronomy: 4.6,
                activities: 4.5,
                safety: 4.1,
                transportation: 3.9,
                accommodation: 4.2,
                value: 4.0
            },
            seasonalRatings: {
                "SPRING": 4.5,
                "SUMMER": 4.4,
                "FALL": 4.6,
                "WINTER": 4.2
            },
            recommendationRate: 91,
            averageStayDuration: 5.2
        }
    }
}
```

### Búsquedas Especializadas

```typescript
// Reseñas por temporada
const summerReviews = await destinationReviewService.search(actor, {
    filters: {
        destinationId: "dest_bariloche",
        season: "SUMMER"
    }
});

// Viajes familiares
const familyReviews = await destinationReviewService.search(actor, {
    filters: {
        travelType: "FAMILY",
        rating: { min: 4.0 }
    }
});

// Estadías prolongadas
const longStayReviews = await destinationReviewService.search(actor, {
    filters: {
        stayDuration: { min: 10 }
    }
});
```

## 📊 Métricas y Estadísticas {#metricas-y-estadisticas}

### Análisis Estacional

```typescript
// Rendimiento por estación
const seasonalAnalysis = {
    spring: {
        averageRating: 4.5,
        reviewCount: 67,
        topAspects: ["culture", "activities", "weather"],
        commonKeywords: ["flores", "clima perfecto", "festivales"]
    },
    summer: {
        averageRating: 4.4,
        reviewCount: 123,
        topAspects: ["activities", "gastronomy"],
        commonKeywords: ["playa", "sol", "actividades al aire libre"]
    },
    fall: {
        averageRating: 4.6,
        reviewCount: 89,
        topAspects: ["gastronomy", "culture", "scenery"],
        commonKeywords: ["colores", "vendimia", "paisajes"]
    },
    winter: {
        averageRating: 4.2,
        reviewCount: 45,
        topAspects: ["culture", "gastronomy"],
        commonKeywords: ["acogedor", "museos", "gastronomía"]
    }
};
```

### Dashboard de Destino

```typescript
// Métricas integrales de destino
const destinationDashboard = {
    overall: {
        rating: 4.4,
        totalReviews: 234,
        recommendationRate: 91,
        ranking: "#3 en Argentina"
    },
    strengths: [
        { aspect: "gastronomy", rating: 4.6, highlight: "Vinos de clase mundial" },
        { aspect: "activities", rating: 4.5, highlight: "Deportes de aventura" },
        { aspect: "culture", rating: 4.3, highlight: "Historia vitivinícola" }
    ],
    improvements: [
        { aspect: "transportation", rating: 3.9, suggestion: "Mejorar transporte público" }
    ],
    seasonalTrends: seasonalAnalysis,
    competitorComparison: {
        similar: ["Salta", "San Juan", "La Rioja"],
        betterThan: ["La Rioja", "San Juan"],
        worseThan: ["Salta"]
    }
};
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### DestinationReviewCreateInput

**Campos Requeridos:**

- `destinationId`: string (ID del destino)
- `rating`: number (1.0 - 5.0)
- `content`: string (experiencia detallada)

**Campos Opcionales:**

- `title`: string (título de la reseña)
- `visitDate`: date (fecha de visita)
- `stayDuration`: number (días de estadía)
- `travelType`: enum (tipo de viaje)
- `seasonVisited`: enum (estación del año)
- `aspectRatings`: objeto con calificaciones específicas
- `wouldRecommend`: boolean
- `bestTimeToVisit`: array de estaciones recomendadas
- `recommendedDuration`: number (días recomendados)
- `tips`: string (consejos para viajeros)

### Validaciones Específicas

- Rating: Entre 1.0 y 5.0
- Contenido: Mínimo 100 caracteres para destinos
- Duración de estadía: Máximo 365 días
- Fecha de visita: No puede ser futura
- Un usuario puede reseñar el mismo destino múltiples veces

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | Usuario autenticado | Verificación opcional |
| `getById`, `list` | Público | Reseñas aprobadas |
| `update` | Usuario autor | Solo propias reseñas |
| `delete` | Usuario autor o Admin | Moderación |

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Guía Colaborativa de Destino

```typescript
// Vista completa de un destino
const destinationGuide = await destinationReviewService.listByDestination(actor, {
    destinationId: "dest_mendoza",
    page: 1,
    pageSize: 20,
    sortBy: "helpful",
    sortOrder: "desc"
});

// Generar recomendaciones automáticas
const autoRecommendations = {
    bestTimeToVisit: calculateBestSeason(destinationGuide.data.stats.seasonalRatings),
    recommendedDuration: Math.round(destinationGuide.data.stats.averageStayDuration),
    topExperiences: extractTopExperiences(destinationGuide.data.items),
    budgetTips: extractBudgetTips(destinationGuide.data.items)
};
```

### Sistema de Rankings

```typescript
// Ranking de destinos por calificación
async function generateDestinationRankings(region: string) {
    const destinations = await getDestinationsByRegion(region);
    const rankings = [];
    
    for (const destination of destinations) {
        const reviews = await destinationReviewService.listByDestination(actor, {
            destinationId: destination.id,
            pageSize: 1000
        });
        
        rankings.push({
            destination: destination,
            rating: reviews.data.stats.averageRating,
            reviewCount: reviews.data.stats.totalReviews,
            recommendationRate: reviews.data.stats.recommendationRate,
            score: calculateCompositeScore(reviews.data.stats)
        });
    }
    
    return rankings.sort((a, b) => b.score - a.score);
}
```

### Análisis de Satisfacción por Perfil

```typescript
// Satisfacción por tipo de viajero
async function analyzeByTravelerProfile(destinationId: string) {
    const profiles = ["LEISURE", "BUSINESS", "ADVENTURE", "FAMILY"];
    const analysis = {};
    
    for (const profile of profiles) {
        const reviews = await destinationReviewService.search(actor, {
            filters: {
                destinationId,
                travelType: profile
            }
        });
        
        analysis[profile] = {
            averageRating: calculateAverage(reviews.data.items, 'rating'),
            reviewCount: reviews.data.total,
            topComplaints: extractCommonComplaints(reviews.data.items),
            topPraises: extractCommonPraises(reviews.data.items),
            recommendationRate: calculateRecommendationRate(reviews.data.items)
        };
    }
    
    return analysis;
}
```

---

**Nota**: El DestinationReviewService completa el ecosistema de evaluaciones turísticas, proporcionando información valiosa sobre destinos que complementa las reseñas de alojamientos y ayuda a crear una experiencia de viaje integral.
